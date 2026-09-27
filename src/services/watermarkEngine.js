import { PDFDocument, degrees } from 'pdf-lib';
import { WATERMARK_CONFIG } from '../config/qmsRegistry';
import { getBangkokFormattedTimestamp } from './UniversalWatermarkService';
import { drawIsoDiagonalWatermark } from '../utils/pdfStamper';

export { WATERMARK_CONFIG, drawIsoDiagonalWatermark };

export const THAI_SAFE_FALLBACK_MAP = {
  '(สำเนาควบคุม — บังคับใช้ปฏิบัติงานจริง)': '(CONTROLLED COPY - OPERATIONAL USE ONLY)',
  '(สำเนาไม่ควบคุม — ใช้เพื่อการอ้างอิงเท่านั้น)': '(FOR REFERENCE ONLY - UNCONTROLLED COPY)',
  '(สำเนาไม่ควบคุม — สำหรับอ้างอิงเท่านั้น)': '(FOR REFERENCE ONLY - UNCONTROLLED COPY)',
  '(เอกสารฉบับยกเลิก — มีฉบับใหม่บังคับใช้แทน)': '(SUPERSEDED DOCUMENT - REPLACED BY NEW REVISION)',
  '(เอกสารฉบับยกเลิก — มีฉบับใหม่ประกาศใช้แทน)': '(SUPERSEDED DOCUMENT - REPLACED BY NEW REVISION)',
  '(เอกสารยกเลิกการใช้งานถาวร)': '(PERMANENTLY RETIRED - OBSOLETE)',
  '(เอกสารร่าง — อยู่ระหว่างจัดทำ/ทบทวน)': '(DRAFT - UNDER REVIEW / NOT EFFECTIVE)'
};

/**
 * สร้างแผ่นภาพลายน้ำแบบคมชัดสูงด้วย HTML5 Canvas (Ultra-HD 4x Resolution)
 * ใช้ Text Rendering Engine ของเบราว์เซอร์เพื่อเรนเดอร์ภาษาไทยวรรณยุกต์ซ้อน (OpenType Shaping) ได้อย่างสมบูรณ์แบบ 100%
 *
 * @param {Object} options
 * @param {Array<{text: string, size?: number, scale?: number, weight?: string, isBold?: boolean, letterSpacing?: number}>} options.lines
 * @param {string} [options.colorHex='#DC2626']
 * @param {number} [options.opacity=0.18]
 * @param {number} [options.scale=4]
 * @returns {string} PNG Data URL
 */
export const generateWatermarkCanvas = ({ lines = [], colorHex = '#1F40B0', opacity: _opacity = 0.16, scale = 4 }) => {
  // Safe fallback if DOM or Canvas 2D is unavailable (e.g. Node/JSDOM in testing environments)
  const TRANSPARENT_1X1_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return TRANSPARENT_1X1_PNG;
  }

  // แปลงขนาดและสไตล์ของแต่ละบรรทัด
  const normalizedLines = (lines || []).map(line => {
    if (typeof line === 'string') {
      return { text: line, size: 24, weight: '400', letterSpacing: 0 };
    }
    const rawSize = line.size || (line.scale ? Math.round(52 * line.scale) : 24);
    const weight = line.weight || (line.isBold ? '600' : '400');
    return {
      text: line.text || '',
      size: rawSize,
      weight,
      letterSpacing: typeof line.letterSpacing === 'number' ? line.letterSpacing : 0
    };
  });

  if (normalizedLines.length === 0) {
    return TRANSPARENT_1X1_PNG;
  }

  // วัดขนาดความกว้างจริงของข้อความทุกบรรทัดเพื่อทำ Auto-Fit Bounding Box
  const dummyCanvas = document.createElement('canvas');
  const dummyCtx = dummyCanvas && dummyCanvas.getContext ? dummyCanvas.getContext('2d') : null;

  let maxTextWidth = 0;
  let totalHeight = 0;
  const lineSpacingRatio = 1.34;

  normalizedLines.forEach((line) => {
    const fontSize = line.size * scale;
    const fontStr = `${line.weight || '400'} ${fontSize}px 'Sarabun', 'Noto Sans Thai', 'TH Sarabun New', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`;
    if (dummyCtx) {
      dummyCtx.font = fontStr;
    }

    let measuredWidth = 0;
    if (dummyCtx && typeof dummyCtx.measureText === 'function') {
      try {
        const metrics = dummyCtx.measureText(line.text);
        if (metrics && typeof metrics.width === 'number' && metrics.width > 0) {
          measuredWidth = metrics.width;
        }
      } catch {
        // Fallback below
      }
    }

    // Fallback if measureText is not implemented (e.g. JSDOM mock context) or returns 0
    if (!measuredWidth || measuredWidth <= 0) {
      measuredWidth = (line.text || '').length * (fontSize * 0.58);
    }

    const textW = measuredWidth + ((line.letterSpacing || 0) * scale * (line.text || '').length);
    if (textW > maxTextWidth) {
      maxTextWidth = textW;
    }
    totalHeight += (fontSize * lineSpacingRatio);
  });

  // สร้าง Canvas ขนาดกระชับ พอดีกับข้อความจริง (บวก Padding เล็กน้อยเพื่อป้องกันสระ/วรรณยุกต์ล้น)
  const canvas = document.createElement('canvas');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

  if (!ctx) {
    return TRANSPARENT_1X1_PNG;
  }

  const horizontalPadding = 50 * scale;
  const verticalPadding = 35 * scale;

  canvas.width = Math.ceil(maxTextWidth + horizontalPadding * 2);
  canvas.height = Math.ceil(totalHeight + verticalPadding * 2);

  // ตั้งค่าความคมชัดสูงสุด (Ultra-HD High-DPI Sharpness)
  if ('imageSmoothingEnabled' in ctx) {
    ctx.imageSmoothingEnabled = true;
  }
  if ('imageSmoothingQuality' in ctx) {
    ctx.imageSmoothingQuality = 'high';
  }

  if (typeof ctx.clearRect === 'function') {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const centerX = canvas.width / 2;
  let currentY = verticalPadding + (normalizedLines[0].size * scale * 0.6);

  normalizedLines.forEach((line) => {
    const fontSize = line.size * scale;
    ctx.font = `${line.weight || '400'} ${fontSize}px 'Sarabun', 'Noto Sans Thai', 'TH Sarabun New', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`;
    ctx.fillStyle = colorHex;

    // จัด Letter Spacing หากมีกำหนดไว้
    if (line.letterSpacing && 'letterSpacing' in ctx) {
      try {
        ctx.letterSpacing = `${line.letterSpacing * scale}px`;
      } catch {
        // Safe fallback
      }
    } else if ('letterSpacing' in ctx) {
      try {
        ctx.letterSpacing = '0px';
      } catch {
        // Safe fallback
      }
    }

    if (typeof ctx.fillText === 'function') {
      ctx.fillText(line.text, centerX, currentY);
    }
    currentY += (fontSize * lineSpacingRatio);
  });

  return canvas.toDataURL ? canvas.toDataURL('image/png') : TRANSPARENT_1X1_PNG;
};

/**
 * นำภาพ PNG ลายน้ำที่สร้างจาก Canvas ฝังลงในเอกสาร PDF
 *
 * @param {PDFDocument} pdfDoc
 * @param {Object} watermarkConfig
 * @param {Object} [meta={}]
 * @returns {Promise<void>}
 */
export const applyCanvasWatermarkToPdf = async (pdfDoc, watermarkConfig, meta = {}) => {
  const pages = pdfDoc.getPages();
  const lines = typeof watermarkConfig.getLines === 'function'
    ? watermarkConfig.getLines(meta)
    : (typeof watermarkConfig.lines === 'function' ? watermarkConfig.lines(meta) : []);

  const colorHex = watermarkConfig.colorHex || '#1F40B0';
  const opacity = typeof watermarkConfig.opacity === 'number' ? watermarkConfig.opacity : 0.16;

  const pngDataUrl = generateWatermarkCanvas({
    lines,
    colorHex,
    opacity,
    scale: 4
  });

  const watermarkImage = await pdfDoc.embedPng(pngDataUrl);

  for (const page of pages) {
    const { width, height } = page.getSize();
    const isPortrait = height >= width;

    // ปรับองศาความชันให้ลาดลงมาทางขวา สวยงาม สบายตา (Ergonomic Watermark Angle)
    // Portrait: 30° / Landscape: 25°
    const angleDeg = isPortrait ? 30 : 25;
    const angleRad = (angleDeg * Math.PI) / 180;

    // ขยายขนาดลายน้ำให้เด่นชัด (ครอบคลุม 85% ของความกว้างหน้ากระดาษแนวตั้ง / 70% แนวนอน)
    const imgWidth = isPortrait ? (width * 0.85) : (width * 0.70);
    const imgHeight = imgWidth * (watermarkImage.height / watermarkImage.width);

    // True Geometric Centering:
    // สูตรหมุนรอบจุดกึ่งกลางกระดาษเป๊ะ 100% ชดเชยจุดเริ่มต้น (Bottom-Left) ของ pdf-lib
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const drawX = (width / 2) - ((imgWidth / 2) * cosA - (imgHeight / 2) * sinA);
    const drawY = (height / 2) - ((imgWidth / 2) * sinA + (imgHeight / 2) * cosA);

    page.drawImage(watermarkImage, {
      x: drawX,
      y: drawY,
      width: imgWidth,
      height: imgHeight,
      rotate: degrees(angleDeg),
      opacity: typeof watermarkConfig.opacity === 'number' ? watermarkConfig.opacity : 0.16
    });
  }
};

/**
 * Canvas-to-Embedded-PNG Watermark Engine
 * Conforms to ISO 9001:2015 Document Security Specifications.
 * Eliminates Thai diacritic glyph tearing bugs by rendering on HTML5 Canvas and embedding as high-res PNG.
 *
 * @param {PDFDocument|Uint8Array|ArrayBuffer|Blob} pdfDocOrBytes
 * @param {string} watermarkType - One of CONTROLLED, UNCONTROLLED, SUPERSEDED, OBSOLETE, DRAFT
 * @param {Object} meta - Document metadata
 * @returns {Promise<PDFDocument|Uint8Array>}
 */
export const drawStandardIsoWatermark = async (pdfDocOrBytes, watermarkType = 'UNCONTROLLED', meta = {}) => {
  let pdfDoc = pdfDocOrBytes;
  let isStandaloneBytes = false;

  if (!pdfDoc || typeof pdfDoc.getPages !== 'function') {
    isStandaloneBytes = true;
    let rawBytes = pdfDocOrBytes;
    if (typeof Blob !== 'undefined' && rawBytes instanceof Blob) {
      rawBytes = await rawBytes.arrayBuffer();
    }
    pdfDoc = await PDFDocument.load(rawBytes);
  }

  const normType = String(watermarkType || 'UNCONTROLLED').toUpperCase();
  if (normType === 'CLEAN' || normType === 'CLEAN_MASTER' || normType === 'MASTER_CLEAN' || normType === 'NONE') {
    if (isStandaloneBytes) {
      return await pdfDoc.save();
    }
    return pdfDoc;
  }

  const config = WATERMARK_CONFIG[normType] || 
                 WATERMARK_CONFIG[normType.replace('_COPY', '')] || 
                 (!normType.includes('UNCONTROLLED') && normType.includes('CONTROLLED') ? WATERMARK_CONFIG.CONTROLLED : null) ||
                 WATERMARK_CONFIG.UNCONTROLLED;

  const rawCopy = meta.copyNo || meta.copyNumber || meta.copy_no || meta.ccNumber || '01';
  const copyMatch = String(rawCopy).match(/\d+/);
  const cleanCopyNo = copyMatch ? copyMatch[0].padStart(2, '0') : String(rawCopy).padStart(2, '0');

  const rawIssue = meta.issueNo || meta.issueNumber || meta.issue_no || '01';
  const issueMatch = String(rawIssue).match(/\d+/);
  const cleanIssueNo = issueMatch ? issueMatch[0].padStart(2, '0') : '01';

  const normalizedMeta = {
    ...meta,
    docCode: meta.docCode || meta.document_code || meta.doc_code || meta.title || '-',
    revNo: meta.revNo ?? meta.rev ?? meta.revision ?? meta.docVersion ?? '00',
    copyNo: cleanCopyNo,
    issueNo: cleanIssueNo,
    holderDept: meta.holderDept || meta.recipientDept || meta.targetDept || meta.recipientDepartment || meta.department || meta.userDept || 'DCC',
    location: meta.location || meta.loc || meta.pointOfUse || meta.targetLocation || meta.locationName || meta.station_name || '-',
    loc: meta.location || meta.loc || meta.pointOfUse || meta.targetLocation || meta.locationName || meta.station_name || '-',
    issuedDate: meta.issuedDate || meta.dispatchDate || meta.dateIssued || meta.effectiveDate || '-',
    effectiveDate: meta.effectiveDate || meta.issuedDate || '-',
    userName: meta.userName || meta.name || 'Authorized User',
    userDept: meta.userDept || meta.department || 'QMS',
    timestamp: meta.timestamp || (typeof getBangkokFormattedTimestamp === 'function' ? getBangkokFormattedTimestamp() : new Date().toISOString()),
    darNo: meta.darNo || meta.darNumber || meta.id || '-',
    replacedByRev: meta.replacedByRev || meta.replaced_by_rev || 'Latest',
    obsoleteDate: meta.obsoleteDate || meta.obsolete_date || meta.effectiveDate || ''
  };

  await applyCanvasWatermarkToPdf(pdfDoc, config, normalizedMeta);

  if (isStandaloneBytes) {
    return await pdfDoc.save();
  }
  return pdfDoc;
};

export default {
  WATERMARK_CONFIG,
  generateWatermarkCanvas,
  applyCanvasWatermarkToPdf,
  drawStandardIsoWatermark,
  drawIsoDiagonalWatermark
};
