import { PDFDocument, degrees } from 'pdf-lib';
import { WATERMARK_CONFIG } from '../config/qmsRegistry';
import { getBangkokFormattedTimestamp } from './UniversalWatermarkService';
import { drawIsoDiagonalWatermark } from '../utils/pdfStamper';

export { WATERMARK_CONFIG, drawIsoDiagonalWatermark };

export const THAI_SAFE_FALLBACK_MAP = {
  '(สำเนาควบคุม — บังคับใช้ปฏิบัติงานจริง)': '(CONTROLLED COPY - OPERATIONAL USE ONLY)',
  '(สำเนาไม่ควบคุม — ใช้เพื่อการอ้างอิงเท่านั้น)': '(FOR REFERENCE ONLY - UNCONTROLLED COPY)',
  '(เอกสารฉบับยกเลิก — มีฉบับใหม่บังคับใช้แทน)': '(SUPERSEDED DOCUMENT - REPLACED BY NEW REVISION)',
  '(เอกสารยกเลิกการใช้งานถาวร)': '(PERMANENTLY RETIRED - OBSOLETE)',
  '(เอกสารร่าง — อยู่ระหว่างจัดทำ/ทบทวน)': '(DRAFT - UNDER REVIEW / NOT EFFECTIVE)'
};

/**
 * สร้างแผ่นภาพลายน้ำแบบคมชัดสูงด้วย HTML5 Canvas
 * ใช้ Text Rendering Engine ของเบราว์เซอร์เพื่อเรนเดอร์ภาษาไทยวรรณยุกต์ซ้อน (OpenType Shaping) ได้อย่างสมบูรณ์แบบ 100%
 *
 * @param {Object} options
 * @param {Array<{text: string, size?: number, scale?: number, weight?: string, isBold?: boolean}>} options.lines
 * @param {string} [options.colorHex='#DC2626']
 * @param {number} [options.opacity=0.18]
 * @param {number} [options.scale=2]
 * @returns {string} PNG Data URL
 */
export const generateWatermarkCanvas = ({ lines = [], colorHex = '#DC2626', opacity = 0.18, scale = 2 }) => {
  // Safe fallback if DOM or Canvas 2D is unavailable (e.g. Node/JSDOM in testing environments)
  const TRANSPARENT_1X1_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return TRANSPARENT_1X1_PNG;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;

  if (!ctx) {
    return TRANSPARENT_1X1_PNG;
  }

  // ตั้งค่าขนาด Canvas พื้นฐาน (ความละเอียดสูง 2x - 3x สำหรับ Retina Display)
  const canvasWidth = 1000 * scale;
  const canvasHeight = 400 * scale;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // แปลงขนาดและสไตล์ของแต่ละบรรทัด
  const normalizedLines = (lines || []).map(line => {
    if (typeof line === 'string') {
      return { text: line, size: 24 * scale, weight: 'normal' };
    }
    const rawSize = line.size || (line.scale ? Math.round(52 * line.scale) : 24);
    const weight = line.weight || (line.isBold ? 'bold' : 'normal');
    return {
      text: line.text || '',
      size: rawSize * scale,
      weight
    };
  });

  if (normalizedLines.length === 0) {
    return canvas.toDataURL ? canvas.toDataURL('image/png') : TRANSPARENT_1X1_PNG;
  }

  // คำนวณความสูงรวมเพื่อจัดให้อยู่ตรงกลางแนวดิ่ง (Vertical Centering)
  const lineHeightMultiplier = 1.35;
  const totalHeight = normalizedLines.reduce((acc, l) => acc + (l.size * lineHeightMultiplier), 0);
  let currentY = centerY - (totalHeight / 2) + ((normalizedLines[0]?.size || 24 * scale) * 0.5);

  normalizedLines.forEach((line) => {
    ctx.font = `${line.weight} ${line.size}px 'Sarabun', 'Noto Sans Thai', 'TH Sarabun New', 'Helvetica Neue', sans-serif`;
    ctx.fillStyle = colorHex;
    ctx.fillText(line.text, centerX, currentY);
    currentY += line.size * lineHeightMultiplier;
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

  const colorHex = watermarkConfig.colorHex || '#DC2626';
  const opacity = typeof watermarkConfig.opacity === 'number' ? watermarkConfig.opacity : 0.18;

  const pngDataUrl = generateWatermarkCanvas({
    lines,
    colorHex,
    opacity
  });

  const watermarkImage = await pdfDoc.embedPng(pngDataUrl);

  for (const page of pages) {
    const { width, height } = page.getSize();
    const angleRad = Math.atan2(height, width);
    const angleDeg = angleRad * (180 / Math.PI);

    // ปรับขนาดภาพตามสัดส่วนกระดาษจริง
    const imgWidth = Math.min(width, height) * 0.95;
    const imgHeight = imgWidth * (watermarkImage.height / watermarkImage.width);

    // True Geometric Centering:
    // จัดศูนย์กลางลายน้ำแท้จริง โดยคำนวณ origin offset ให้จุดกึ่งกลางของภาพหมุนตรงกับกึ่งกลางกระดาษ (width / 2, height / 2) พอดี
    const centerX = width / 2;
    const centerY = height / 2;
    const originX = centerX - (imgWidth / 2) * Math.cos(angleRad) + (imgHeight / 2) * Math.sin(angleRad);
    const originY = centerY - (imgWidth / 2) * Math.sin(angleRad) - (imgHeight / 2) * Math.cos(angleRad);

    page.drawImage(watermarkImage, {
      x: originX,
      y: originY,
      width: imgWidth,
      height: imgHeight,
      rotate: degrees(angleDeg),
      xSkew: degrees(0),
      ySkew: degrees(0),
      opacity: opacity
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
  const config = WATERMARK_CONFIG[normType] || 
                 WATERMARK_CONFIG[normType.replace('_COPY', '')] || 
                 WATERMARK_CONFIG.UNCONTROLLED;

  const normalizedMeta = {
    ...meta,
    docCode: meta.docCode || meta.document_code || meta.doc_code || meta.title || '-',
    revNo: meta.revNo ?? meta.rev ?? meta.revision ?? meta.docVersion ?? '00',
    copyNo: meta.copyNo || meta.copyNumber || meta.ccNumber || '01',
    issueNo: meta.issueNo || meta.issueNumber || meta.issue_no || '01',
    holderDept: meta.holderDept || meta.targetDept || meta.recipientDepartment || meta.department || meta.userDept || 'DCC',
    issuedDate: meta.issuedDate || meta.effectiveDate || '-',
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
