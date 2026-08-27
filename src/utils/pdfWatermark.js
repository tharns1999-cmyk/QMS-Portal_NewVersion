/**
 * pdfWatermark.js
 * 
 * Enterprise Document Security & Watermark Resolution Engine
 * Conforms to ISO 9001 / Document Control System (DCS) Standards.
 */

import { 
  UniversalWatermarkService, 
  WATERMARK_TYPES, 
  WATERMARK_PRESETS,
  getBangkokFormattedTimestamp,
  getBangkokFormattedDate
} from '../services/UniversalWatermarkService';

/**
 * สร้างรายการข้อความบรรทัดย่อยใต้ลายน้ำตามประเภทสถานะเอกสาร
 * Strict separation: OBSOLETE (Cancelled) vs SUPERSEDED (Outdated revision)
 */
export const buildWatermarkSubLines = (doc = {}, watermarkType = 'UNCONTROLLED', options = {}) => {
  const docCode = doc.document_code || doc.doc_code || doc.title || doc.id || '-';
  const docRev = String(doc.revision || doc.rev || doc.doc_version || '00').replace(/^REV\.?/i, '').padStart(2, '0');
  const nowStr = (options.timestamp || getBangkokFormattedTimestamp(new Date())).split(' ')[0] || new Date().toISOString().split('T')[0];
  const userStr = options.currentUser?.name 
    ? `${options.currentUser.name} (${options.currentUser.department || options.currentUser.dept || 'HQ'})` 
    : (options.userName ? `${options.userName} (${options.userDept || 'HQ'})` : 'QMS System');

  const normalizedType = (watermarkType || '').toUpperCase();

  // 🚫 1. กรณีเอกสารยกเลิก (OBSOLETE) — ห้ามมีคำว่า "Superseded By" เด็ดขาด 100%!
  if (
    normalizedType === 'OBSOLETE' || 
    doc.status?.toUpperCase().startsWith('OBSOLETE') || 
    doc.is_obsolete
  ) {
    const darRef = doc.obsolete_dar_id || doc.obsolete_dar_no || doc.dar_id || doc.dar_no || doc.darId || doc.darNo || 'DAR-OBSOLETE';
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
    doc.status?.toUpperCase().startsWith('SUPERSEDED') || 
    doc.is_superseded || 
    options.isHistoricalRev
  ) {
    const nextRev = doc.superseded_by_rev || options.supersededByRev || doc.nextVersion || 'Latest';
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
 * ตรวจสอบและระบุประเภทลายน้ำตามสถานะเอกสารและบริบทการดาวน์โหลด
 * @param {Object} doc - ข้อมูลเอกสาร
 * @param {Object} options - ข้อมูลเสริม เช่น copyInfo, currentUser, isHistoricalRev, dccName
 * @returns {Object} การตั้งค่าลายน้ำ (type, watermarkType, mainText, color, subLines, metadata)
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

  // 1. กรณีเป็นสำเนาควบคุม (Controlled Copy)
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

  // 4. ค่าตั้งต้น: เอกสารใช้งานทั่วไป (UNCONTROLLED COPY)
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

export { 
  UniversalWatermarkService, 
  WATERMARK_TYPES, 
  WATERMARK_PRESETS,
  getBangkokFormattedTimestamp,
  getBangkokFormattedDate
};

export default {
  buildWatermarkSubLines,
  resolveWatermarkConfig,
  UniversalWatermarkService,
  WATERMARK_TYPES,
  WATERMARK_PRESETS
};
