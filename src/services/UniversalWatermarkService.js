/**
 * UniversalWatermarkService.js
 * 
 * Enterprise Document Security & Watermark Engine (Client-Side 100%)
 * Powered by pdf-lib and fontkit.
 * Conforms to ISO 9001 / Document Control System (DCS) Standards.
 * 
 * STRICT GRAPHIC RULES:
 * 1. Zero Stamp Box & Footer: NO rectangles, borders, or footers (drawRectangle is completely eliminated).
 * 2. Multi-line Center Diagonal: Multiple lines of text stacked top-to-bottom along a 45-degree axis (rotate: degrees(45)).
 * 3. 2D Affine Transformation (Center Pivot): Coordinates computed with exact 2D rotation matrix around (cx, cy).
 * 4. Opacity Control: Fixed between 0.60 – 0.70 per preset.
 * 5. Blank Form FM Bypass: Active FM/FORM documents receive zero watermark (100% clean). Only OBSOLETE forms get stamped.
 */

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export const WATERMARK_TYPES = {
  UNCONTROLLED_COPY: 'UNCONTROLLED_COPY',
  OFFICIAL_MASTER_COPY: 'OFFICIAL_MASTER_COPY',
  STRICTLY_CONFIDENTIAL: 'STRICTLY_CONFIDENTIAL',
  CONTROLLED_COPY: 'CONTROLLED_COPY',
  CONTROLLED_COPY_REPLACEMENT: 'CONTROLLED_COPY_REPLACEMENT',
  OBSOLETE: 'OBSOLETE',
  SUPERSEDED: 'SUPERSEDED',
  DRAFT: 'DRAFT'
};

/**
 * Convert Hex color string to pdf-lib rgb() object
 * @param {string} hex - e.g. "#DC2626" or "DC2626"
 * @returns {Object|null}
 */
export const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return null;
};

/**
 * Helper: Format date/time to Thailand local time (Asia/Bangkok - GMT+7) in YYYY-MM-DD HH:mm format
 * @param {Date|string|number} [dateInput=new Date()]
 * @returns {string} e.g. "2026-08-24 10:58"
 */
export const getBangkokFormattedTimestamp = (dateInput = new Date()) => {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find(p => p.type === type)?.value || '';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');

  return `${year}-${month}-${day} ${hour}:${minute}`;
};

/**
 * Helper: Format date to Thailand local time (Asia/Bangkok - GMT+7) in YYYY-MM-DD format
 * @param {Date|string|number} [dateInput=new Date()]
 * @returns {string} e.g. "2026-08-24"
 */
export const getBangkokFormattedDate = (dateInput = new Date()) => {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find(p => p.type === type)?.value || '';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');

  return `${year}-${month}-${day}`;
};

/**
 * Default Color and Opacity Presets for the DCS Watermark types
 */
export const WATERMARK_PRESETS = {
  UNCONTROLLED_COPY: {
    color: rgb(0.80, 0.35, 0.10), // Dark Orange
    opacity: 0.65,
    title: 'UNCONTROLLED COPY'
  },
  OFFICIAL_MASTER_COPY: {
    color: rgb(0.15, 0.25, 0.75), // Navy Blue
    opacity: 0.60,
    title: 'OFFICIAL MASTER COPY'
  },
  STRICTLY_CONFIDENTIAL: {
    color: rgb(0.85, 0.10, 0.20), // Rose Red
    opacity: 0.70,
    title: 'STRICTLY CONFIDENTIAL - EXTERNAL RELEASE'
  },
  CONTROLLED_COPY: {
    color: rgb(0.05, 0.60, 0.30), // Emerald Green
    opacity: 0.65,
    title: 'CONTROLLED COPY'
  },
  CONTROLLED_COPY_REPLACEMENT: {
    color: rgb(0.85, 0.40, 0.0), // Amber Orange
    opacity: 0.65,
    title: 'CONTROLLED COPY (REPLACEMENT)'
  },
  OBSOLETE: {
    color: rgb(0.80, 0.05, 0.05), // Dark Crimson Red
    opacity: 0.70,
    title: 'OBSOLETE - DO NOT USE'
  },
  SUPERSEDED: {
    color: rgb(0.851, 0.467, 0.024), // Amber / Orange (#D97706)
    opacity: 0.65,
    title: 'SUPERSEDED'
  },
  DRAFT: {
    color: rgb(0.85, 0.55, 0.0), // Amber
    opacity: 0.65,
    title: 'DRAFT / UNDER REVIEW'
  }
};

export class UniversalWatermarkService {
  /**
   * Cached custom font buffer for Thai support
   */
  static cachedFontBytes = null;

  /**
   * Static helper for Bangkok timezone timestamp
   */
  static getBangkokTimestamp(dateInput = new Date()) {
    return getBangkokFormattedTimestamp(dateInput);
  }

  /**
   * Static helper for Bangkok timezone date
   */
  static getBangkokDate(dateInput = new Date()) {
    return getBangkokFormattedDate(dateInput);
  }

  /**
   * Helper: Check if document is an Active Form that should bypass watermarking (Clean Form 100%)
   */
  static isBlankFormBypass(metadata = {}) {
    const docType = String(metadata.docType || metadata.doc_type || '').toUpperCase();
    const docCode = String(metadata.docCode || metadata.doc_code || metadata.title || '').toUpperCase();
    const status = String(metadata.status || '').toUpperCase();

    // Forms bypass watermarking unless they are obsolete
    const isFormType = docType === 'FM' || docType === 'FORM' || docCode.startsWith('FM-') || docCode.startsWith('FM');
    const isObsolete = status === 'OBSOLETE' || status === 'OBSOLETE_ARCHIVED';

    return isFormType && !isObsolete;
  }

  /**
   * Helper: Map department code to Thai display name
   */
  static getDepartmentNameTh(deptCode) {
    if (!deptCode) return '';
    const clean = String(deptCode).trim().toUpperCase();
    const map = {
      'PD': 'ฝ่ายผลิต',
      'PRODUCTION': 'ฝ่ายผลิต',
      'QA': 'ฝ่ายประกันคุณภาพ',
      'QC': 'ฝ่ายควบคุมคุณภาพ',
      'QA/QC': 'ฝ่ายประกันและควบคุมคุณภาพ',
      'QAQC': 'ฝ่ายประกันและควบคุมคุณภาพ',
      'WH': 'ฝ่ายคลังสินค้าและโลจิสติกส์',
      'WAREHOUSE': 'ฝ่ายคลังสินค้าและโลจิสติกส์',
      'EN': 'ฝ่ายวิศวกรรมและซ่อมบำรุง',
      'ENG': 'ฝ่ายวิศวกรรมและซ่อมบำรุง',
      'ENGINEERING': 'ฝ่ายวิศวกรรมและซ่อมบำรุง',
      'PC': 'ฝ่ายจัดซื้อ',
      'PURCHASING': 'ฝ่ายจัดซื้อ',
      'HR': 'ฝ่ายทรัพยากรบุคคลและธุรการ',
      'HR&GA': 'ฝ่ายทรัพยากรบุคคลและธุรการ',
      'HSE': 'ฝ่ายความปลอดภัยและสิ่งแวดล้อม',
      'SAFETY': 'ฝ่ายความปลอดภัยและสิ่งแวดล้อม',
      'MKT': 'ฝ่ายการตลาดและการขาย',
      'MARKETING': 'ฝ่ายการตลาดและการขาย',
      'ST': 'ฝ่ายจัดเก็บวัตถุดิบ',
      'STORE': 'ฝ่ายจัดเก็บวัตถุดิบ',
      'RD': 'ฝ่ายวิจัยและพัฒนา',
      'R&D': 'ฝ่ายวิจัยและพัฒนา',
      'ACC': 'ฝ่ายบัญชีและการเงิน',
      'FIN': 'ฝ่ายการเงิน',
      'MGMT': 'ฝ่ายบริหารจัดการ',
      'EXEC': 'ฝ่ายบริหาร'
    };
    return map[clean] || '';
  }

  /**
   * Resolve and sanitize parent metadata for display (Never internal UUIDs)
   */
  static sanitizeMetadata(metadata = {}) {
    const isExternal = Boolean(
      metadata.is_external || 
      metadata.isExternal || 
      metadata.docType === 'ED' || 
      metadata.doc_type === 'ED' || 
      String(metadata.docCode || metadata.doc_code || metadata.edCode || metadata.title || '').toUpperCase().startsWith('ED-')
    );

    const docCode = metadata.edCode || metadata.docCode || metadata.doc_code || metadata.docNo || metadata.title || 'DOC-001';
    const docTitle = metadata.docTitle || metadata.docName || metadata.name || (metadata.title !== docCode ? metadata.title : '') || '';
    const sourceEdition = metadata.sourceVersion || metadata.source_version || metadata.edition || metadata.sourceEdition || '';
    const source = metadata.source || '';
    
    let docVersion = metadata.docVersion || metadata.doc_version || metadata.rev || '00';
    
    // Ensure version format is clean (e.g. "01" instead of "Rev.01" when prefixed)
    docVersion = String(docVersion).replace(/^REV\.?/i, '').padStart(2, '0');

    const nextVersion = metadata.nextVersion || metadata.next_version || String(parseInt(docVersion, 10) + 1).padStart(2, '0');
    
    // Resolve Holder Department (Department Entity instead of personal name)
    const holderDept = metadata.holderDept || metadata.holder_dept || metadata.holderDeptCode || metadata.department || metadata.userDept || 'PD';
    const holderDeptName = metadata.holderDeptName || metadata.holder_dept_name || metadata.deptNameTh || this.getDepartmentNameTh(holderDept) || '';
    const formattedHolder = holderDeptName ? `${holderDept} (${holderDeptName})` : holderDept;

    // Bangkok timezone formatted dates
    const effectiveDate = metadata.effectiveDate || metadata.effective_date ? (
      String(metadata.effectiveDate || metadata.effective_date).includes('T')
        ? getBangkokFormattedDate(metadata.effectiveDate || metadata.effective_date)
        : String(metadata.effectiveDate || metadata.effective_date)
    ) : getBangkokFormattedDate();

    const obsoleteDate = metadata.obsoleteDate || metadata.obsolete_date ? (
      String(metadata.obsoleteDate || metadata.obsolete_date).includes('T')
        ? getBangkokFormattedDate(metadata.obsoleteDate || metadata.obsolete_date)
        : String(metadata.obsoleteDate || metadata.obsolete_date)
    ) : getBangkokFormattedDate();

    const issuedAt = metadata.issuedAt || metadata.issued_at || metadata.issueDate || metadata.issue_date ? (
      String(metadata.issuedAt || metadata.issued_at || metadata.issueDate || metadata.issue_date).includes('T')
        ? getBangkokFormattedDate(metadata.issuedAt || metadata.issued_at || metadata.issueDate || metadata.issue_date)
        : String(metadata.issuedAt || metadata.issued_at || metadata.issueDate || metadata.issue_date)
    ) : getBangkokFormattedDate();

    const timestamp = metadata.timestamp ? (
      String(metadata.timestamp).includes('T')
        ? getBangkokFormattedTimestamp(metadata.timestamp)
        : String(metadata.timestamp)
    ) : getBangkokFormattedTimestamp();

    return {
      docCode,
      docTitle,
      sourceEdition,
      source,
      isExternal,
      docVersion,
      nextVersion,
      docType: isExternal ? 'ED' : (metadata.docType || metadata.doc_type || docCode.split('-')[0] || 'WI'),
      status: metadata.status || 'ACTIVE',
      userName: metadata.userName || metadata.user_name || metadata.requesterName || 'Authorized User',
      userDept: metadata.userDept || metadata.user_dept || metadata.department || 'PD',
      effectiveDate,
      obsoleteDate,
      scope: metadata.scope || metadata.internalExternal || (isExternal ? 'EXTERNAL' : 'INTERNAL'),
      copyNo: String(metadata.copyNo || metadata.copy_no || '01').padStart(2, '0'),
      issueNo: String(metadata.issueNo || metadata.issue_no || '01').padStart(2, '0'),
      location: metadata.location || metadata.locationName || metadata.station_name || metadata.locationId || metadata.station_id || `${holderDept} Head Office`,
      holderDept,
      holderDeptName,
      holderEntity: formattedHolder,
      holderName: metadata.holderName || metadata.holder_name || formattedHolder,
      issuedAt,
      issuedBy: metadata.issuedBy || metadata.issued_by || metadata.issued_by_role || metadata.dccName || 'DCC',
      dccName: metadata.dccName || metadata.dcc_name || 'DCC Admin',
      darNo: metadata.darNo || metadata.dar_no || metadata.darId || 'DAR-REQ-001',
      authorizedScope: metadata.authorizedScope || metadata.authorized_scope || metadata.recipientCompany || 'Authorized Partner',
      fileHashPrefix: metadata.fileHashPrefix || metadata.file_hash_prefix || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'.slice(0, 12),
      timestamp
    };
  }

  /**
   * Generate line definitions based on the requested watermark type
   */
  static getWatermarkLines(type, meta) {
    if (meta.subLines && Array.isArray(meta.subLines) && meta.subLines.length > 0) {
      const mainHeader = meta.mainText || (WATERMARK_PRESETS[type]?.title || type);
      return [
        { text: mainHeader, size: 28, isBold: true },
        ...meta.subLines.map((lineText, idx) => ({
          text: lineText,
          size: idx === 0 ? 14 : 12,
          isBold: idx === 0
        }))
      ];
    }

    if (meta.isExternal) {
      const docLabel = meta.docTitle ? `Doc: ${meta.docCode} | Title: ${meta.docTitle}` : `Doc: ${meta.docCode}`;
      const sourceSuffix = meta.sourceEdition ? ` (Source: ${meta.sourceEdition})` : '';

      switch (type) {
        case WATERMARK_TYPES.UNCONTROLLED_COPY:
          return [
            { text: 'UNCONTROLLED COPY - FOR REFERENCE ONLY', size: 24, isBold: true },
            { text: docLabel, size: 13, isBold: true },
            { text: `Ver: Rev.${meta.docVersion}${sourceSuffix} | Custodian: ${meta.holderDept}`, size: 13 },
            { text: `Printed By: ${meta.userName} (${meta.userDept})`, size: 12 },
            { text: `Timestamp: ${meta.timestamp} | Status: Valid on Print Date Only`, size: 12 },
            { text: '*VALIDITY NOT GUARANTEED IF STORED LOCALLY OR PRINTED*', size: 11, isBold: true }
          ];

        case WATERMARK_TYPES.OFFICIAL_MASTER_COPY:
          return [
            { text: 'OFFICIAL MASTER COPY', size: 30, isBold: true },
            { text: docLabel, size: 14, isBold: true },
            { text: `Ver: Rev.${meta.docVersion}${sourceSuffix} | Custodian: ${meta.holderDept}`, size: 13 },
            { text: `Effective Date: ${meta.effectiveDate} | DCC Archive`, size: 12 },
            { text: `SHA-256: ${meta.fileHashPrefix}... (Integrity Sealed)`, size: 11 }
          ];

        case WATERMARK_TYPES.STRICTLY_CONFIDENTIAL:
          return [
            { text: 'STRICTLY CONFIDENTIAL - EXTERNAL RELEASE', size: 22, isBold: true },
            { text: docLabel, size: 13, isBold: true },
            { text: `Ver: Rev.${meta.docVersion}${sourceSuffix} | Scope: ${meta.authorizedScope}`, size: 13 },
            { text: `Released By: ${meta.dccName} | Timestamp: ${meta.timestamp}`, size: 12 },
            { text: '*UNAUTHORIZED DUPLICATION & DISTRIBUTION IS PROHIBITED*', size: 10, isBold: true }
          ];

        case WATERMARK_TYPES.CONTROLLED_COPY:
          return [
            { text: 'CONTROLLED COPY', size: 30, isBold: true },
            { text: docLabel, size: 13, isBold: true },
            { text: `Ver: Rev.${meta.docVersion}${sourceSuffix} | Copy: ${meta.copyNo}`, size: 13, isBold: true },
            { text: `Loc: ${meta.location} | Issue: ${meta.issueNo} | Custodian: ${meta.holderEntity}`, size: 13 },
            { text: `Issued By: ${meta.issuedBy || 'DCC'} | Date: ${meta.issuedAt}`, size: 12 },
            { text: '*CONTROLLED DOCUMENT - DO NOT DUPLICATE*', size: 11, isBold: true }
          ];

        case WATERMARK_TYPES.CONTROLLED_COPY_REPLACEMENT:
          return [
            { text: 'CONTROLLED COPY (REPLACEMENT)', size: 24, isBold: true },
            { text: docLabel, size: 13, isBold: true },
            { text: `Ver: Rev.${meta.docVersion}${sourceSuffix} | Copy: ${meta.copyNo}`, size: 13, isBold: true },
            { text: `Loc: ${meta.location} | Issue: ${meta.issueNo} | Custodian: ${meta.holderEntity}`, size: 13 },
            { text: '*PREVIOUS ISSUE IS VOID & INVALID - DO NOT DUPLICATE*', size: 11, isBold: true }
          ];

        case WATERMARK_TYPES.OBSOLETE:
          return [
            { text: 'OBSOLETE - DO NOT USE', size: 30, isBold: true },
            { text: 'เอกสารยกเลิก - ห้ามนำไปปฏิบัติงาน (CANCELLED DOCUMENT)', size: 16, isBold: true },
            { text: docLabel, size: 13 },
            { text: `Rev: Rev.${meta.docVersion}${sourceSuffix} | Obsoleted: ${meta.obsoleteDate}`, size: 12 },
            { text: `Obsolete DAR Ref: ${meta.obsoleteDarId || meta.darNo || 'DAR-OBSOLETE'}`, size: 12 }
          ];

        case WATERMARK_TYPES.SUPERSEDED:
          return [
            { text: 'SUPERSEDED - FOR REFERENCE ONLY', size: 30, isBold: true },
            { text: 'เอกสารฉบับเดิมตกรุ่น - ใช้อ้างอิงประวัติเท่านั้น (SUPERSEDED REVISION)', size: 15, isBold: true },
            { text: docLabel, size: 13 },
            { text: `Rev: Rev.${meta.docVersion}${sourceSuffix} | Historical Rev.${meta.docVersion}`, size: 12 },
            { text: `Replaced By: Rev.${meta.supersededByRev || meta.nextVersion || 'Latest'}`, size: 12 }
          ];

        case WATERMARK_TYPES.DRAFT:
        default:
          return [
            { text: 'DRAFT / UNDER REVIEW', size: 30, isBold: true },
            { text: 'ฉบับร่างระหว่างดำเนินการ - ห้ามใช้ปฏิบัติงาน', size: 16, isBold: true },
            { text: docLabel, size: 13 },
            { text: `Ver: Rev.${meta.docVersion}${sourceSuffix}`, size: 12 }
          ];
      }
    }

    switch (type) {
      case WATERMARK_TYPES.UNCONTROLLED_COPY:
        return [
          { text: 'UNCONTROLLED COPY', size: 30, isBold: true },
          { text: `FOR REFERENCE ONLY (${meta.scope.toUpperCase()})`, size: 15, isBold: true },
          { text: `Doc: ${meta.docCode} | Ver: Rev.${meta.docVersion}`, size: 14 },
          { text: `Printed By: ${meta.userName} (${meta.userDept}) | Date: ${meta.timestamp}`, size: 12 }
        ];

      case WATERMARK_TYPES.OFFICIAL_MASTER_COPY:
        return [
          { text: 'OFFICIAL MASTER COPY', size: 30, isBold: true },
          { text: `Doc: ${meta.docCode} | Ver: Rev.${meta.docVersion}`, size: 15, isBold: true },
          { text: 'Document Control Center (DCC Archive)', size: 14 },
          { text: `Effective Date: ${meta.effectiveDate}`, size: 13 },
          { text: `SHA-256: ${meta.fileHashPrefix}... (Integrity Sealed)`, size: 11 }
        ];

      case WATERMARK_TYPES.STRICTLY_CONFIDENTIAL:
        return [
          { text: 'STRICTLY CONFIDENTIAL - EXTERNAL RELEASE', size: 22, isBold: true },
          { text: `Doc: ${meta.docCode} | Ver: Rev.${meta.docVersion}`, size: 14, isBold: true },
          { text: `Authorized Scope: ${meta.authorizedScope}`, size: 13 },
          { text: `Released By: ${meta.dccName} | ${meta.timestamp}`, size: 12 },
          { text: '*UNAUTHORIZED DUPLICATION & DISTRIBUTION IS PROHIBITED*', size: 10, isBold: true }
        ];

      case WATERMARK_TYPES.CONTROLLED_COPY:
        return [
          { text: 'CONTROLLED COPY', size: 30, isBold: true },
          { text: `Doc: ${meta.docCode} | Ver: Rev.${meta.docVersion}`, size: 15, isBold: true },
          { text: `Copy No: ${meta.copyNo} | Issue: ${meta.issueNo} | Holder: ${meta.holderEntity}`, size: 14 },
          { text: `Loc: ${meta.location} | Issued By: ${meta.issuedBy || 'DCC'}`, size: 13 },
          { text: `Issued: ${meta.issuedAt} | *DO NOT DUPLICATE*`, size: 12 }
        ];

      case WATERMARK_TYPES.CONTROLLED_COPY_REPLACEMENT:
        return [
          { text: 'CONTROLLED COPY (REPLACEMENT)', size: 24, isBold: true },
          { text: `Doc: ${meta.docCode} | Ver: Rev.${meta.docVersion}`, size: 15, isBold: true },
          { text: `Copy No: ${meta.copyNo} | Issue: ${meta.issueNo} | Holder: ${meta.holderEntity}`, size: 14, isBold: true },
          { text: `Loc: ${meta.location} | Issued By: ${meta.issuedBy || 'DCC'}`, size: 13 },
          { text: '*PREVIOUS ISSUE IS VOID & INVALID*', size: 12, isBold: true }
        ];

      case WATERMARK_TYPES.OBSOLETE:
        return [
          { text: 'OBSOLETE - DO NOT USE', size: 30, isBold: true },
          { text: 'เอกสารยกเลิก - ห้ามนำไปปฏิบัติงาน (CANCELLED DOCUMENT)', size: 16, isBold: true },
          { text: `Doc: ${meta.docCode} | Rev: Rev.${meta.docVersion}`, size: 14 },
          { text: `Obsolete DAR Ref: ${meta.obsoleteDarId || meta.darNo || 'DAR-OBSOLETE'} | Date: ${meta.obsoleteDate || meta.timestamp}`, size: 12 },
          { text: `Printed By: ${meta.userName} (${meta.userDept})`, size: 12 }
        ];

      case WATERMARK_TYPES.SUPERSEDED:
        return [
          { text: 'SUPERSEDED - FOR REFERENCE ONLY', size: 30, isBold: true },
          { text: 'เอกสารฉบับเดิมตกรุ่น - ใช้อ้างอิงประวัติเท่านั้น (SUPERSEDED REVISION)', size: 15, isBold: true },
          { text: `Doc: ${meta.docCode} | Rev: Rev.${meta.docVersion}`, size: 14 },
          { text: `Superseded By: Rev.${meta.supersededByRev || meta.nextVersion || 'Latest'}`, size: 12 },
          { text: `Printed By: ${meta.userName} (${meta.userDept}) | Date: ${meta.timestamp}`, size: 12 }
        ];

      case WATERMARK_TYPES.DRAFT:
      default:
        return [
          { text: 'DRAFT / UNDER REVIEW', size: 30, isBold: true },
          { text: 'ฉบับร่างระหว่างดำเนินการ - ห้ามใช้ปฏิบัติงาน', size: 16, isBold: true },
          { text: `DAR Ref: ${meta.darNo} | Doc: ${meta.docCode}`, size: 14 }
        ];
    }
  }

  /**
   * Load and register custom TrueType Thai font with fallback
   */
  static async loadFont(pdfDoc) {
    pdfDoc.registerFontkit(fontkit);

    if (this.cachedFontBytes) {
      try {
        const font = await pdfDoc.embedFont(this.cachedFontBytes);
        return { font, isCustom: true };
      } catch {
        // Fallback below
      }
    }

    // 1. Try Browser fetch
    if (typeof fetch === 'function') {
      const fontUrls = [
        '/fonts/Sarabun-Regular.ttf',
        '/fonts/NotoSansThai-Regular.ttf',
        '/fonts/Sarabun-Bold.ttf'
      ];

      for (const url of fontUrls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const fontBytes = await res.arrayBuffer();
            this.cachedFontBytes = fontBytes;
            const font = await pdfDoc.embedFont(fontBytes);
            return { font, isCustom: true };
          }
        } catch {
          // Try next font
        }
      }
    }

    // 2. Try Node.js fs module in server / test environment
    try {
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const candidatePaths = [
          path.resolve(process.cwd(), 'public/fonts/Sarabun-Regular.ttf'),
          path.resolve(process.cwd(), 'public/fonts/NotoSansThai-Regular.ttf'),
          path.resolve(process.cwd(), 'fonts/Sarabun-Regular.ttf')
        ];

        for (const fontPath of candidatePaths) {
          if (fs.existsSync(fontPath)) {
            const fontBuffer = fs.readFileSync(fontPath);
            this.cachedFontBytes = fontBuffer;
            const font = await pdfDoc.embedFont(fontBuffer);
            return { font, isCustom: true };
          }
        }
      }
    } catch {
      // Fallback below
    }

    // 3. Fallback to Standard Helvetica Bold (Latin / WinAnsi only)
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    return { font, isCustom: false };
  }

  /**
   * Sanitize text string for standard WinAnsi fonts if custom TrueType is unavailable
   */
  static safeWinAnsiText(text) {
    if (!text) return '';
    // Map common Thai DCS phrases and department names if fallback WinAnsi is active
    const phraseMap = {
      'เอกสารยกเลิก - ห้ามนำไปปฏิบัติงานเด็ดขาด (CANCELLED DOCUMENT)': 'CANCELLED DOCUMENT - STRICTLY DO NOT OPERATE',
      'เอกสารยกเลิก - ห้ามนำไปปฏิบัติงาน': 'OBSOLETE - DO NOT OPERATE',
      'เอกสารฉบับเดิมตกรุ่น - ใช้อ้างอิงประวัติเท่านั้น (SUPERSEDED REVISION)': 'SUPERSEDED REVISION - FOR REFERENCE ONLY',
      'ฉบับร่างระหว่างดำเนินการ - ห้ามใช้ปฏิบัติงาน': 'DRAFT - NOT FOR OPERATIONAL USE',
      'ฝ่ายผลิต': 'Production',
      'ฝ่ายประกันคุณภาพ': 'Quality Assurance',
      'ฝ่ายควบคุมคุณภาพ': 'Quality Control',
      'ฝ่ายประกันและควบคุมคุณภาพ': 'Quality Assurance & Control',
      'ฝ่ายคลังสินค้าและโลจิสติกส์': 'Warehouse & Logistics',
      'ฝ่ายวิศวกรรมและซ่อมบำรุง': 'Engineering & Maintenance',
      'ฝ่ายจัดซื้อ': 'Purchasing',
      'ฝ่ายทรัพยากรบุคคลและธุรการ': 'HR & GA',
      'ฝ่ายความปลอดภัยและสิ่งแวดล้อม': 'HSE',
      'ฝ่ายการตลาดและการขาย': 'Marketing & Sales',
      'ฝ่ายจัดเก็บวัตถุดิบ': 'Store & Inventory'
    };

    let result = text;
    for (const [th, en] of Object.entries(phraseMap)) {
      result = result.replaceAll(th, en);
    }

    // Strip characters outside WinAnsi range (0x20 - 0x7E, 0xA0 - 0xFF)
    return result.replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim();
  }

  /**
   * Main Entry Point: Stamps PDF Buffer / Uint8Array with Multi-Line Center Diagonal Watermark
   * 
   * @param {Uint8Array|ArrayBuffer|Buffer} pdfBytesOrBuffer - Source PDF
   * @param {string|Object} watermarkType - One of WATERMARK_TYPES or config object
   * @param {Object} metadata - Document and Action metadata
   * @returns {Promise<Uint8Array>} - Processed PDF
   */
  static async stampPdf(pdfBytesOrBuffer, watermarkType = WATERMARK_TYPES.UNCONTROLLED_COPY, metadata = {}) {
    let resolvedType = watermarkType;
    let combinedMeta = { ...metadata };

    if (watermarkType && typeof watermarkType === 'object' && (watermarkType.type || watermarkType.mainText || watermarkType.watermarkType)) {
      resolvedType = watermarkType.watermarkType || watermarkType.type;
      combinedMeta = {
        ...watermarkType.metadata,
        mainText: watermarkType.mainText,
        subLines: watermarkType.subLines,
        customColor: watermarkType.color,
        ...metadata
      };
    }

    const meta = this.sanitizeMetadata(combinedMeta);

    // Rule: Blank Form FM Bypass
    if (this.isBlankFormBypass(meta) && resolvedType !== WATERMARK_TYPES.OBSOLETE && resolvedType !== 'OBSOLETE') {
      if (pdfBytesOrBuffer instanceof Uint8Array) {
        return pdfBytesOrBuffer;
      }
      return new Uint8Array(pdfBytesOrBuffer);
    }

    const pdfDoc = await PDFDocument.load(pdfBytesOrBuffer);
    const { font, isCustom } = await this.loadFont(pdfDoc);

    const basePreset = WATERMARK_PRESETS[resolvedType] || WATERMARK_PRESETS.UNCONTROLLED_COPY;
    const customRgb = combinedMeta.customColor ? hexToRgb(combinedMeta.customColor) : null;
    const preset = {
      ...basePreset,
      color: customRgb || basePreset.color
    };

    const lines = this.getWatermarkLines(resolvedType, { ...combinedMeta, ...meta, mainText: combinedMeta.mainText, subLines: combinedMeta.subLines });

    const pages = pdfDoc.getPages();
    const theta = Math.PI / 4; // 45 degrees
    const cosTheta = Math.cos(theta); // ~0.7071
    const sinTheta = Math.sin(theta); // ~0.7071

    for (const page of pages) {
      const { width, height } = page.getSize();
      const cx = width / 2;
      const cy = height / 2;

      const lineSpacings = lines.map(l => l.size * 1.35);

      let totalStackHeight = 0;
      for (let i = 0; i < lineSpacings.length - 1; i++) {
        totalStackHeight += lineSpacings[i];
      }

      // Compute local (u, v) and rotated (x, y) coordinates for each line
      let accumulatedOffset = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const rawText = line.text;
        const text = isCustom ? rawText : this.safeWinAnsiText(rawText);
        
        let textWidth;
        try {
          textWidth = font.widthOfTextAtSize(text, line.size);
        } catch {
          textWidth = text.length * line.size * 0.55;
        }

        // Local unrotated coordinates:
        // u = horizontal offset along text baseline (centered)
        // v = vertical offset perpendicular to baseline (stacked top-to-bottom)
        const u = -textWidth / 2;
        const v = (totalStackHeight / 2) - accumulatedOffset;

        // 2D Rotation Matrix around center pivot (cx, cy)
        const x = cx + (u * cosTheta) - (v * sinTheta);
        const y = cy + (u * sinTheta) + (v * cosTheta);

        page.drawText(text, {
          x,
          y,
          size: line.size,
          font: font,
          color: preset.color,
          opacity: preset.opacity,
          rotate: degrees(45)
        });

        accumulatedOffset += lineSpacings[i];
      }
    }

    return await pdfDoc.save();
  }

  /**
   * Helper: Generate a realistic, formatted multi-page QMS Standard Document
   * 
   * @param {Object} doc - Document info { title, name, rev, department, effectiveDate, status }
   * @param {Object} meta - Metadata options
   * @returns {Promise<Uint8Array>}
   */
  static async generateQmsPdfDocument(doc = {}, meta = {}) {
    const pdfDoc = await PDFDocument.create();
    const { font, isCustom } = await this.loadFont(pdfDoc);

    const docCode = doc.title || meta.docCode || 'WI-PD-001';
    const docTitle = doc.name || meta.title || 'Standard Operating Procedure';
    const docRev = doc.rev || meta.docVersion || '01';
    const docDept = doc.department || meta.userDept || 'PD';
    const docEff = doc.effectiveDate || meta.effectiveDate ? (
      String(doc.effectiveDate || meta.effectiveDate).includes('T')
        ? getBangkokFormattedDate(doc.effectiveDate || meta.effectiveDate)
        : String(doc.effectiveDate || meta.effectiveDate)
    ) : getBangkokFormattedDate();

    const safe = (t) => isCustom ? t : this.safeWinAnsiText(t);
    const draw = (page, text, opts) => {
      const sanitized = safe(text);
      if (!sanitized) return;
      page.drawText(sanitized, { font, ...opts });
    };

    // Page 1: Quality Management Header & Procedure Outline
    const page1 = pdfDoc.addPage([595.28, 841.89]); // Standard A4 (595 x 842 pt)
    const { width: p1W, height: p1H } = page1.getSize();

    // Top Header Grid
    draw(page1, 'QUALITY MANAGEMENT SYSTEM (ISO 9001 / FSSC 22000)', {
      x: 50,
      y: p1H - 45,
      size: 10,
      color: rgb(0.3, 0.35, 0.45)
    });

    draw(page1, `DOCUMENT NUMBER: ${docCode}`, {
      x: 50,
      y: p1H - 70,
      size: 16,
      color: rgb(0.1, 0.15, 0.25)
    });

    draw(page1, `TITLE: ${docTitle}`, {
      x: 50,
      y: p1H - 92,
      size: 12,
      color: rgb(0.2, 0.25, 0.35)
    });

    draw(page1, `Revision: Rev.${docRev}   |   Owner Dept: ${docDept}   |   Effective: ${docEff}`, {
      x: 50,
      y: p1H - 115,
      size: 10,
      color: rgb(0.4, 0.45, 0.55)
    });

    // Content Section 1
    draw(page1, '1. วัตถุประสงค์ (PURPOSE)', { x: 50, y: p1H - 155, size: 12, color: rgb(0.1, 0.2, 0.4) });
    draw(page1, 'เอกสารนี้จัดทำขึ้นเพื่อกำหนดมาตรฐานและขั้นตอนการปฏิบัติงานในพื้นที่ควบคุม ให้สอดคล้องตามมาตรฐานสากล', { x: 50, y: p1H - 175, size: 10, color: rgb(0.2, 0.2, 0.2) });

    // Content Section 2
    draw(page1, '2. ขอบเขตการบังคับใช้ (SCOPE & APPLICABILITY)', { x: 50, y: p1H - 210, size: 12, color: rgb(0.1, 0.2, 0.4) });
    draw(page1, `บังคับใช้ครอบคลุมทุกสถานีงานและจุดใช้งานจริง (Point of Use) ภายในฝ่าย ${docDept} และหน่วยงานที่เกี่ยวข้อง`, { x: 50, y: p1H - 230, size: 10, color: rgb(0.2, 0.2, 0.2) });

    // Content Section 3: Responsibility Table
    draw(page1, '3. หน้าที่และความรับผิดชอบ (RESPONSIBILITIES)', { x: 50, y: p1H - 265, size: 12, color: rgb(0.1, 0.2, 0.4) });
    draw(page1, '- ผู้ปฏิบัติงานประจำจุด: ปฏิบัติตาม Work Instruction อย่างเคร่งครัด', { x: 60, y: p1H - 285, size: 10, color: rgb(0.2, 0.2, 0.2) });
    draw(page1, '- หัวหน้างาน / Supervisor: ทวนสอบการบันทึกข้อมูลและสุ่มตรวจความถูกต้องทุกกะการทำงาน', { x: 60, y: p1H - 305, size: 10, color: rgb(0.2, 0.2, 0.2) });
    draw(page1, '- DCC Officer: ควบคุมสำเนาแจกจ่ายและจัดการเอกสารตกรุ่น (Obsolete Recall)', { x: 60, y: p1H - 325, size: 10, color: rgb(0.2, 0.2, 0.2) });

    // Content Section 4: Operational Standard Workflow
    draw(page1, '4. ขั้นตอนการปฏิบัติงานมาตรฐาน (STANDARD OPERATING PROCEDURE)', { x: 50, y: p1H - 365, size: 12, color: rgb(0.1, 0.2, 0.4) });
    draw(page1, 'ขั้นตอนที่ 1: ตรวจสอบความพร้อมของเครื่องจักร อุปกรณ์ และสภาพแวดล้อมก่อนเริ่มงาน', { x: 60, y: p1H - 390, size: 10, color: rgb(0.2, 0.2, 0.2) });
    draw(page1, 'ขั้นตอนที่ 2: บันทึกค่าพารามิเตอร์ควบคุมและตรวจวัดตามแบบฟอร์มตรวจสอบประจำวัน', { x: 60, y: p1H - 410, size: 10, color: rgb(0.2, 0.2, 0.2) });
    draw(page1, 'ขั้นตอนที่ 3: หากพบสิ่งผิดปกติ ให้หยุดกระบวนการทันทีและรายงานต่อหัวหน้างานตามสายบังคับบัญชา', { x: 60, y: p1H - 430, size: 10, color: rgb(0.2, 0.2, 0.2) });
    draw(page1, 'ขั้นตอนที่ 4: สรุปผลการปฏิบัติงานและส่งมอบรายงานเมื่อสิ้นสุดกะการทำงาน', { x: 60, y: p1H - 450, size: 10, color: rgb(0.2, 0.2, 0.2) });

    // Page Number
    draw(page1, `Page 1 of 2  -  Document Control System (QMS Portal)`, {
      x: p1W / 2 - 120,
      y: 35,
      size: 9,
      color: rgb(0.5, 0.5, 0.5)
    });

    // Page 2: Safety & Quality Control Measures
    const page2 = pdfDoc.addPage([595.28, 841.89]);
    const { width: p2W, height: p2H } = page2.getSize();

    draw(page2, `DOCUMENT NUMBER: ${docCode}  (Rev.${docRev})`, {
      x: 50,
      y: p2H - 45,
      size: 10,
      color: rgb(0.4, 0.45, 0.55)
    });

    draw(page2, '5. ข้อกำหนดด้านความปลอดภัยและสุขอนามัย (FOOD SAFETY & EHS)', { x: 50, y: p2H - 90, size: 12, color: rgb(0.1, 0.2, 0.4) });
    draw(page2, '- สวมใส่อุปกรณ์คุ้มครองความปลอดภัยส่วนบุคคล (PPE) ตามมาตรฐานตลอดเวลา', { x: 60, y: p2H - 115, size: 10, color: rgb(0.2, 0.2, 0.2) });
    draw(page2, '- ห้ามนำอาหาร เครื่องดื่ม หรือสิ่งของส่วนตัวเข้าสู่พื้นที่ปฏิบัติงาน', { x: 60, y: p2H - 135, size: 10, color: rgb(0.2, 0.2, 0.2) });
    draw(page2, '- ล้างมือและฆ่าเชื้อตามสุขลักษณะส่วนบุคคลก่อนเข้าสู่บริเวณไลน์ผลิต', { x: 60, y: p2H - 155, size: 10, color: rgb(0.2, 0.2, 0.2) });

    draw(page2, '6. บันทึกคุณภาพและแบบฟอร์มที่เกี่ยวข้อง (QUALITY RECORDS & FORMS)', { x: 50, y: p2H - 200, size: 12, color: rgb(0.1, 0.2, 0.4) });
    draw(page2, '- FM-PD-001: แบบฟอร์มตรวจรับและเตรียมวัตถุดิบประจำวัน', { x: 60, y: p2H - 225, size: 10, color: rgb(0.2, 0.2, 0.2) });
    draw(page2, '- FM-QA-002: ใบบันทึกผลการตรวจวิเคราะห์คุณภาพหน้างาน (In-process QC Log)', { x: 60, y: p2H - 245, size: 10, color: rgb(0.2, 0.2, 0.2) });

    draw(page2, '7. ประวัติการแก้ไขเอกสาร (REVISION HISTORY)', { x: 50, y: p2H - 290, size: 12, color: rgb(0.1, 0.2, 0.4) });
    draw(page2, `- Rev.${docRev}: ปรับปรุงเนื้อหาขั้นตอนการปฏิบัติงานให้สอดคล้องตามมาตรฐานระบบคุณภาพ`, { x: 60, y: p2H - 315, size: 10, color: rgb(0.2, 0.2, 0.2) });

    draw(page2, `Page 2 of 2  -  Document Control System (QMS Portal)`, {
      x: p2W / 2 - 120,
      y: 35,
      size: 9,
      color: rgb(0.5, 0.5, 0.5)
    });

    return await pdfDoc.save();
  }

  /**
   * Helper: Generate stamped PDF bytes for a given document and user
   * @param {Object} doc - Document info { title, name, rev, department, effectiveDate, status, ... }
   * @param {string} watermarkType - One of WATERMARK_TYPES
   * @param {Object} [user={}] - User info { name, department, ... }
   * @param {Object} [options={}] - Extra options { reason, location, ... }
   * @returns {Promise<Uint8Array>}
   */
  static async generateStampingPDF(doc = {}, watermarkType = WATERMARK_TYPES.UNCONTROLLED_COPY, user = {}, options = {}) {
    const rawPdfBytes = await this.generateQmsPdfDocument(doc, { ...options, userDept: user?.department || doc?.department });
    const metadata = {
      docCode: doc.title || options.docCode,
      docVersion: doc.rev || options.docVersion,
      docType: (doc.title || options.docCode || '').split('-')[0],
      status: doc.status || options.status || 'ACTIVE',
      userName: user?.name || options.userName,
      userDept: user?.department || doc.department || options.userDept,
      effectiveDate: doc.effectiveDate || options.effectiveDate,
      watermarkType,
      ...options
    };
    return await this.stampPdf(rawPdfBytes, watermarkType, metadata);
  }

  /**
   * Helper: Generate downloadable PDF blob for browser clients
   */
  static async createWatermarkedBlob(pdfBytesOrBuffer, watermarkType, metadata = {}) {
    const outputBytes = await this.stampPdf(pdfBytesOrBuffer, watermarkType, metadata);
    return new Blob([outputBytes], { type: 'application/pdf' });
  }

  /**
   * Helper: Directly download watermarked PDF in browser or open in new tab
   */
  static async downloadWatermarkedPdf(doc, watermarkType = WATERMARK_TYPES.UNCONTROLLED_COPY, meta = {}, openInTab = false) {
    const rawPdfBytes = await this.generateQmsPdfDocument(doc, meta);
    const watermarkedBytes = await this.stampPdf(rawPdfBytes, watermarkType, {
      docCode: doc.title || meta.docCode,
      docVersion: doc.rev || meta.docVersion,
      docType: (doc.title || meta.docCode || '').split('-')[0],
      status: doc.status || meta.status || 'ACTIVE',
      userName: meta.userName,
      userDept: meta.userDept || doc.department,
      effectiveDate: doc.effectiveDate || meta.effectiveDate,
      ...meta
    });

    const blob = new Blob([watermarkedBytes], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);

    if (openInTab) {
      window.open(url, '_blank');
      return url;
    }

    const link = document.createElement('a');
    link.href = url;
    const typeLabel = typeof watermarkType === 'string' ? watermarkType : (watermarkType?.type || 'WATERMARKED');
    const filename = `${doc.title || meta.docCode || 'DOCUMENT'}_${typeLabel}.pdf`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return url;
  }

  /**
   * Universal PDF Generation & Download Helper
   * Automatically resolves watermark config if not explicitly provided
   */
  static async generateAndDownloadPdf(doc, watermarkConfigOrType, options = {}, openInTab = false) {
    let watermarkType = WATERMARK_TYPES.UNCONTROLLED_COPY;
    let extraMeta = { ...options };

    if (watermarkConfigOrType && typeof watermarkConfigOrType === 'object' && (watermarkConfigOrType.type || watermarkConfigOrType.mainText || watermarkConfigOrType.watermarkType)) {
      watermarkType = watermarkConfigOrType.watermarkType || watermarkConfigOrType.type;
      extraMeta = {
        ...watermarkConfigOrType.metadata,
        mainText: watermarkConfigOrType.mainText,
        subLines: watermarkConfigOrType.subLines,
        customColor: watermarkConfigOrType.color,
        ...options
      };
    } else if (typeof watermarkConfigOrType === 'string') {
      watermarkType = watermarkConfigOrType;
    } else {
      const resolved = resolveWatermarkConfig(doc, options);
      watermarkType = resolved.watermarkType || resolved.type;
      extraMeta = {
        ...resolved.metadata,
        mainText: resolved.mainText,
        subLines: resolved.subLines,
        customColor: resolved.color,
        ...options
      };
    }

    return await this.downloadWatermarkedPdf(doc, watermarkType, extraMeta, openInTab);
  }

  /**
   * Resolve Watermark configuration for a document and context
   */
  static resolveWatermarkConfig(doc, options = {}) {
    return resolveWatermarkConfig(doc, options);
  }

  /**
   * Build Watermark Sub-Lines strictly separated by status
   */
  static buildWatermarkSubLines(doc = {}, watermarkType = 'UNCONTROLLED', options = {}) {
    return buildWatermarkSubLines(doc, watermarkType, options);
  }
}

/**
 * สร้างรายการข้อความบรรทัดย่อยใต้ลายน้ำตามประเภทสถานะเอกสาร
 * Strict separation: OBSOLETE (Cancelled) vs SUPERSEDED (Outdated revision)
 */
export const buildWatermarkSubLines = (doc = {}, watermarkType = 'UNCONTROLLED', options = {}) => {
  const docCode = doc?.document_code || doc?.doc_code || doc?.title || doc?.id || '-';
  const docRev = String(doc?.revision || doc?.rev || doc?.doc_version || '00').replace(/^REV\.?/i, '').padStart(2, '0');
  const nowStr = (options.timestamp || getBangkokFormattedTimestamp(new Date())).split(' ')[0] || new Date().toISOString().split('T')[0];
  const userStr = options.currentUser?.name 
    ? `${options.currentUser.name} (${options.currentUser.department || options.currentUser.dept || 'HQ'})` 
    : (options.userName ? `${options.userName} (${options.userDept || 'HQ'})` : 'QMS System');

  const normalizedType = (watermarkType || '').toUpperCase();

  // 🚫 1. กรณีเอกสารยกเลิก (OBSOLETE) — ห้ามมีคำว่า "Superseded By" เด็ดขาด 100%!
  if (
    normalizedType === 'OBSOLETE' || 
    doc?.status?.toUpperCase().startsWith('OBSOLETE') || 
    doc?.is_obsolete
  ) {
    const darRef = doc?.obsolete_dar_id || doc?.obsolete_dar_no || doc?.dar_id || doc?.dar_no || doc?.darId || doc?.darNo || 'DAR-OBSOLETE';
    return [
      'เอกสารยกเลิก - ห้ามนำไปปฏิบัติงาน (CANCELLED DOCUMENT)',
      `Doc: ${docCode} | Rev: Rev.${docRev}`,
      `Obsolete DAR Ref: ${darRef} | Date: ${nowStr}`,
      `Printed By: ${userStr}`,
    ];
  }

  // ⏳ 2. กรณีเอกสารตกรุ่นจากการ Revise (SUPERSEDED) — มีคำว่า Superseded By ได้
  if (
    normalizedType === 'SUPERSEDED' || 
    doc?.status?.toUpperCase().startsWith('SUPERSEDED') || 
    doc?.is_superseded || 
    options.isHistoricalRev
  ) {
    const nextRev = doc?.superseded_by_rev || options.supersededByRev || doc?.nextVersion || 'Latest';
    return [
      'เอกสารฉบับเดิมตกรุ่น - ใช้อ้างอิงประวัติเท่านั้น (SUPERSEDED REVISION)',
      `Doc: ${docCode} | Rev: Rev.${docRev}`,
      `Superseded By: Rev.${nextRev} | Date: ${nowStr}`,
      `Printed By: ${userStr}`,
    ];
  }

  // 🖨️ 3. กรณีสำเนาควบคุม (CONTROLLED COPY)
  if (
    normalizedType === 'CONTROLLED' || 
    normalizedType === 'CONTROLLED_COPY' || 
    options.copyInfo || 
    options.isControlledCopy
  ) {
    const copyInfo = options.copyInfo || {};
    return [
      'OFFICIAL CONTROLLED COPY — DO NOT DUPLICATE',
      `Doc: ${docCode} | Rev: Rev.${docRev}`,
      `Copy: ${copyInfo.copy_number || copyInfo.copy_no || copyInfo.ccNumber || 'Copy 01'} | Station: ${copyInfo.station_name || copyInfo.location || copyInfo.locationName || 'Master'}`,
      `Issued Date: ${nowStr} | Issuer: ${userStr}`,
    ];
  }

  // 📄 4. กรณีเอกสารใช้งานทั่วไป (UNCONTROLLED COPY)
  return [
    'FOR REFERENCE ONLY (INTERNAL USE)',
    `Doc: ${docCode} | Ver: Rev.${docRev}`,
    `Printed Date: ${nowStr} | User: ${userStr}`,
  ];
};

/**
 * Universal Watermark Config Resolver
 * Determines correct watermark preset, main text, colors, sub-lines, and metadata based on document state
 */
export const resolveWatermarkConfig = (doc = {}, options = {}) => {
  const status = (doc?.status || '').toUpperCase();
  const currentUser = options.currentUser || {};
  const copyInfo = options.copyInfo || null;
  const nowStr = getBangkokFormattedTimestamp(new Date());

  const docCode = doc?.document_code || doc?.doc_code || doc?.docCode || doc?.title || doc?.edCode || 'DOC-001';
  const docVersion = String(doc?.revision || doc?.rev || doc?.doc_version || doc?.docVersion || '00').replace(/^REV\.?/i, '').padStart(2, '0');
  const userDisplayName = currentUser.name || currentUser.username || options.userName || 'User';
  const userDept = currentUser.department || currentUser.dept || options.userDept || doc?.department || 'HQ';

  // 1. Controlled Copy
  if (copyInfo && (copyInfo.copy_number || copyInfo.copy_no || copyInfo.ccNumber || options.isControlledCopy)) {
    const copyNum = copyInfo.copy_number || copyInfo.copy_no || copyInfo.ccNumber || '01';
    const copyDept = copyInfo.holder_dept || copyInfo.department || copyInfo.holderDept || '-';
    const station = copyInfo.station_name || copyInfo.location || copyInfo.locationName || copyInfo.station || '-';
    const dccName = currentUser.name || options.dccName || 'DCC System';

    return {
      type: 'CONTROLLED',
      watermarkType: WATERMARK_TYPES.CONTROLLED_COPY,
      mainText: 'CONTROLLED COPY',
      color: '#2563EB', // Cobalt Blue
      subLines: buildWatermarkSubLines(doc, 'CONTROLLED', { ...options, copyInfo, currentUser }),
      metadata: {
        docCode,
        docVersion,
        copyNo: copyNum,
        holderDept: copyDept,
        location: station,
        issuedBy: dccName,
        timestamp: nowStr
      }
    };
  }

  // 2. กรณีเป็นเอกสารขอยกเลิกถาวร (OBSOLETE)
  if (
    status === 'OBSOLETE' ||
    status === 'OBSOLETE_ARCHIVED' ||
    status === 'ARCHIVED_OBSOLETE' ||
    status === 'OBSOLETE_PENDING_RECALL' ||
    status.startsWith('OBSOLETE') ||
    doc?.is_obsolete
  ) {
    const obsoleteDarRef = doc?.obsolete_dar_id || doc?.obsolete_dar_no || doc?.dar_id || doc?.darId || doc?.darNo || 'DAR-OBSOLETE';

    return {
      type: 'OBSOLETE',
      watermarkType: WATERMARK_TYPES.OBSOLETE,
      mainText: 'OBSOLETE - DO NOT USE',
      color: '#DC2626', // Crimson Red
      subLines: buildWatermarkSubLines(doc, 'OBSOLETE', { ...options, currentUser }),
      metadata: {
        docCode,
        docVersion,
        obsoleteDarId: obsoleteDarRef,
        darNo: obsoleteDarRef,
        userName: userDisplayName,
        userDept,
        timestamp: nowStr
      }
    };
  }

  // 3. กรณีเป็นฉบับเดิมตกรุ่นจากการ Revise (SUPERSEDED)
  if (
    status === 'SUPERSEDED' ||
    status === 'SUPERSEDED_ARCHIVED' ||
    status === 'OUTDATED' ||
    Boolean(doc?.is_superseded) ||
    options.isHistoricalRev
  ) {
    const nextRev = doc?.superseded_by_rev || doc?.nextVersion || 'Latest';

    return {
      type: 'SUPERSEDED',
      watermarkType: WATERMARK_TYPES.SUPERSEDED,
      mainText: 'SUPERSEDED - FOR REFERENCE ONLY',
      color: '#D97706', // Amber / Orange
      subLines: buildWatermarkSubLines(doc, 'SUPERSEDED', { ...options, currentUser }),
      metadata: {
        docCode,
        docVersion,
        supersededByRev: nextRev,
        nextVersion: nextRev,
        userName: userDisplayName,
        userDept,
        timestamp: nowStr
      }
    };
  }

  // 4. Default: Active / Reference Uncontrolled Copy
  return {
    type: 'UNCONTROLLED',
    watermarkType: WATERMARK_TYPES.UNCONTROLLED_COPY,
    mainText: 'UNCONTROLLED COPY',
    color: '#EA580C', // Rust Orange
    subLines: buildWatermarkSubLines(doc, 'UNCONTROLLED', { ...options, currentUser }),
    metadata: {
      docCode,
      docVersion,
      userName: userDisplayName,
      userDept,
      timestamp: nowStr
    }
  };
};

export default UniversalWatermarkService;
