import { PDFDocument, rgb } from 'pdf-lib';

/**
 * Ensure TH Sarabun New font is loaded and ready before drawing on canvas.
 */
let fontLoadPromise = null;
export const ensureThSarabunFontLoaded = async () => {
  if (typeof document === 'undefined' || !document.fonts) return;
  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    try {
      // 1. Check if TH Sarabun New is already available
      if (document.fonts.check('16px "TH Sarabun New"')) {
        await document.fonts.ready;
        return;
      }

      // 2. Try loading system/registered font
      try {
        await Promise.race([
          document.fonts.load('16px "TH Sarabun New"'),
          new Promise((resolve) => setTimeout(resolve, 200))
        ]);
      } catch {
        // Fallback to registering font files
      }

      // 3. Register FontFace fallback from /fonts/ folder under family "TH Sarabun New"
      if (!document.fonts.check('16px "TH Sarabun New"') && typeof FontFace !== 'undefined') {
        try {
          const fontRegular = new FontFace('TH Sarabun New', 'url(/fonts/Sarabun-Regular.ttf)', { weight: 'normal' });
          const fontBold = new FontFace('TH Sarabun New', 'url(/fonts/Sarabun-Bold.ttf)', { weight: 'bold' });
          await Promise.allSettled([fontRegular.load(), fontBold.load()]);
          document.fonts.add(fontRegular);
          document.fonts.add(fontBold);
        } catch {
          // Ignore if cannot fetch
        }
      }

      await document.fonts.ready;
    } catch (e) {
      console.warn('Font loading check completed with fallback:', e);
    }
  })();

  return fontLoadPromise;
};

/**
 * Helper: Format sign-off date to Thailand readable date (BE)
 * @param {Date|string|number} dateInput
 * @returns {string}
 */
export const formatSignOffDate = (dateInput) => {
  if (!dateInput || dateInput === '-') return '-';
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear() + 543; // Buddhist Era
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    if (hours === '00' && minutes === '00') {
      return `${day}/${month}/${year}`;
    }
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return String(dateInput);
  }
};

/**
 * Helper: Generate dynamic cursive handwritten signature data URL from text/style
 * Uses HTML5 Canvas off-screen rendering with smooth anti-aliased cursive script and paraph flourish.
 */
export const generateCursiveSignatureDataUrl = (nameOrInitials = 'Beam', style = 'BRUSH_SCRIPT') => {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const textToDraw = nameOrInitials || 'Signature';

    let fontChoice = 'italic bold 48px "Brush Script MT", "Caveat", "Segoe Script", "Dancing Script", cursive, "TH Sarabun New"';
    if (style === 'FORMAL_SERIF') {
      fontChoice = 'italic bold 40px "Times New Roman", Times, Georgia, serif';
    } else if (style === 'MODERN_SANS') {
      fontChoice = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    } else if (style === 'CLASSIC_CALLIGRAPHY') {
      fontChoice = 'italic 44px "Snell Roundhand", "Apple Chancery", cursive';
    }

    ctx.font = fontChoice;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(textToDraw, 180, 60);

    // Dynamic hand-drawn flourish stroke (authentic signature underline paraph)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(70, 94);
    ctx.bezierCurveTo(130, 84, 220, 102, 290, 88);
    ctx.bezierCurveTo(250, 98, 170, 102, 110, 96);
    ctx.stroke();

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('generateCursiveSignatureDataUrl failed:', err);
    return null;
  }
};

/**
 * Extract active user signature image asset:
 * 1. user.signatureImage (from MasterDataHub "จัดการลายเซ็นอิเล็กทรอนิกส์")
 * 2. user.signatureUrl / user.eSignDataUrl / user.signature
 * 3. Fallback to generating a cursive signature data URL if user has registered signature or name
 */
export const getActiveUserSignatureAsset = (user) => {
  if (!user) return null;

  // 1. Direct active signature asset saved from MasterDataHub
  if (user.signatureImage && typeof user.signatureImage === 'string' && user.signatureImage.length > 20) {
    return user.signatureImage;
  }
  if (user.eSignDataUrl && typeof user.eSignDataUrl === 'string') {
    return user.eSignDataUrl;
  }
  if (user.signatureUrl && typeof user.signatureUrl === 'string') {
    return user.signatureUrl;
  }
  if (user.signature && typeof user.signature === 'string' && user.signature.startsWith('data:image/')) {
    return user.signature;
  }
  if (user.eSign && typeof user.eSign === 'string' && user.eSign.startsWith('data:image/')) {
    return user.eSign;
  }

  // 2. Synthesize an authentic handwritten signature image from user profile
  if (user.hasRegisteredSignature || user.signatureType || user.signatureInitials || user.name) {
    const text = user.signatureInitials || user.name || 'Beam';
    const style = user.signatureStyle || 'BRUSH_SCRIPT';
    return generateCursiveSignatureDataUrl(text, style);
  }

  return null;
};

/**
 * Safely resolve and format the DAR submission date from all possible fields.
 * NEVER returns '-' for a submitted DAR.
 */
export const resolveSubmissionDate = (dar, task, darTimeline = []) => {
  const submitTl = (darTimeline || []).find(t => 
    t && (
      t.action === 'SUBMIT' || 
      t.action === 'REQUEST' || 
      t.action === 'CREATE' || 
      t.action === 'Created' || 
      t.action === 'Submitted'
    )
  );

  const rawCandidate = 
    dar?.submittedAt || 
    dar?.submitted_at || 
    dar?.requestDate || 
    dar?.request_date || 
    dar?.createdAt || 
    dar?.created_at || 
    dar?.date || 
    dar?.timestamp || 
    task?.createdAt || 
    task?.created_at || 
    task?.submittedAt || 
    task?.date || 
    task?.timestamp || 
    submitTl?.date || 
    submitTl?.timestamp || 
    submitTl?.createdAt;

  if (rawCandidate && rawCandidate !== '-') {
    const formatted = formatSignOffDate(rawCandidate);
    if (formatted && formatted !== '-') {
      return formatted;
    }
  }

  // Fallback to today's date formatted in Buddhist Era (DD/MM/YYYY)
  return formatSignOffDate(new Date());
};

/**
 * Generate a sign-off stamp image (3 columns: Requester, Reviewer, Approver)
 * using HTML5 Canvas with HiDPI Supersampling (4x) and TH Sarabun New font.
 * 
 * @param {Object} signOffData - { requester, reviewer, approver }
 * Each role object: { name, position, timestamp, status, statusText }
 * @returns {Promise<string>} Data URL of the generated PNG image
 */
export const generateSignOffStampImage = async ({ requester = {}, reviewer = {}, approver = {} } = {}) => {
  await ensureThSarabunFontLoaded();

  const canvas = document.createElement('canvas');
  const scale = 3; // HiDPI Supersampling
  const width = 500 * scale;
  const height = 120 * scale;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 1. ถมพื้นหลังขาวทึบ 100% ป้องกันเส้นตารางเดิมใน PDF ทะลุ
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 500, 120);

  // 2. ตีกรอบนอกและเส้นแบ่งคอลัมน์ (3 คอลัมน์เท่ากัน คอลัมน์ละ 166.6px)
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 500, 120);

  const colWidth = 500 / 3;
  ctx.beginPath();
  // เส้นแบ่งคอลัมน์
  ctx.moveTo(colWidth, 0); ctx.lineTo(colWidth, 120);
  ctx.moveTo(colWidth * 2, 0); ctx.lineTo(colWidth * 2, 120);
  // เส้นแบ่งแถว: แถว 1 (24px), แถว 2 (48px), แถว 3 (48px)
  ctx.moveTo(0, 24); ctx.lineTo(500, 24);
  ctx.moveTo(0, 72); ctx.lineTo(500, 72);
  ctx.stroke();

  // Helper โหลดภาพลายเซ็น
  const loadImg = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 1500); // 1.5s timeout
    img.src = src;
  });

  const cols = [
    { title: 'ผู้จัดทำ', data: requester },
    { title: 'ผู้ทบทวน', data: reviewer },
    { title: 'ผู้อนุมัติ', data: approver }
  ];

  for (let i = 0; i < cols.length; i++) {
    const { title, data } = cols[i];
    const xOffset = i * colWidth;

    // แถวที่ 1: หัวข้อบทบาท (Header)
    ctx.font = 'bold 11px "TH Sarabun New", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.fillText(title, xOffset + colWidth / 2, 16);

    // หากขั้นตอนยังไม่เสร็จสิ้น (Pending): ปล่อยช่องแถว 2 และ 3 ว่างเปล่า 100%
    const status = (data?.status || '').toUpperCase();
    const isExplicitPending = data?.isPending === true || 
      status.includes('PENDING') || 
      status.includes('WAIT') || 
      status === 'DRAFT' ||
      !status;

    const isCompleted = data?.isCompleted === true || (
      Boolean(data) && 
      !isExplicitPending && 
      (status === 'SUBMITTED' || status === 'REVIEWED' || status === 'APPROVED' || status === 'COMPLETED')
    );

    if (!data || !isCompleted) {
      continue;
    }

    // แถวที่ 2: วาดภาพ E-Signature จริง
    const signatureSrc = data.signatureImage || data.signature; // Support both keys
    if (signatureSrc) {
      const sigImg = await loadImg(signatureSrc);
      if (sigImg) {
        const maxImgW = colWidth - 20;
        const maxImgH = 40;
        const ratio = Math.min(maxImgW / sigImg.width, maxImgH / sigImg.height, 1);
        const drawW = sigImg.width * ratio;
        const drawH = sigImg.height * ratio;
        ctx.drawImage(
          sigImg,
          xOffset + (colWidth - drawW) / 2,
          24 + (48 - drawH) / 2,
          drawW,
          drawH
        );
      }
    }

    // แถวที่ 3: ข้อมูลผู้ลงนามจริง 3 บรรทัด
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px "TH Sarabun New", sans-serif';
    ctx.fillText(data.name || '', xOffset + colWidth / 2, 85);

    ctx.font = '10px "TH Sarabun New", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(data.position || '', xOffset + colWidth / 2, 98);

    const dateText = data.date || data.timestamp || ''; // Support both keys
    ctx.fillStyle = '#64748b';
    ctx.fillText(dateText, xOffset + colWidth / 2, 111);
  }

  return canvas.toDataURL('image/png');
};

/**
 * Stamp the FIRST page of a PDF with the sign-off table (Legacy compatibility)
 * @param {Uint8Array|ArrayBuffer} originalPdfBytes - The source PDF
 * @param {Object} signOffData - The data for the stamp { requester, reviewer, approver }
 * @returns {Promise<Uint8Array>} The modified PDF bytes
 */
export const stampDocumentFirstPage = async (originalPdfBytes, signOffData) => {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width } = firstPage.getSize();

  const pngDataUrl = await generateSignOffStampImage(signOffData);
  const pngImage = await pdfDoc.embedPng(pngDataUrl);

  const stampWidth = Math.min(540, width - 40);
  const stampHeight = (stampWidth / pngImage.width) * pngImage.height;

  const x = (width - stampWidth) / 2;
  const y = 20;

  // Mask out underlying PDF content/ghost lines with solid white rectangle
  firstPage.drawRectangle({
    x,
    y,
    width: stampWidth,
    height: stampHeight,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });

  firstPage.drawImage(pngImage, {
    x,
    y,
    width: stampWidth,
    height: stampHeight,
  });

  return await pdfDoc.save();
};

/**
 * Stamp the LAST page of a PDF with the dynamic sign-off matrix table in the footer.
 * Conforms to ISO 9001 QMS Process Automation specifications.
 * 
 * @param {Uint8Array|ArrayBuffer} originalPdfBytes - The source PDF
 * @param {Object} signOffData - The data for the stamp { requester, reviewer, approver }
 * @returns {Promise<Uint8Array>} The modified PDF bytes
 */
export const stampDocumentLastPage = async (originalPdfBytes, signOffData) => {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();
  const rotationAngle = lastPage.getRotation().angle;

  // 1. Generate stamp image
  const pngDataUrl = await generateSignOffStampImage(signOffData);
  const pngImage = await pdfDoc.embedPng(pngDataUrl);

  // 2. Calculate dimensions and positioning
  const margin = 20;
  const stampWidth = Math.min(540, width - 40);
  const stampHeight = (stampWidth / pngImage.width) * pngImage.height;

  let x = (width - stampWidth) / 2;
  let y = margin; // 20pt from bottom

  // Handle Rotation to keep the stamp physically in the footer of the viewed page
  if (rotationAngle === 90) {
    x = margin;
    y = (height - stampHeight) / 2;
  } else if (rotationAngle === 180) {
    x = (width - stampWidth) / 2;
    y = height - stampHeight - margin;
  } else if (rotationAngle === 270) {
    x = width - stampWidth - margin;
    y = (height - stampHeight) / 2;
  }

  // Mask out underlying PDF content/ghost lines with solid white rectangle
  lastPage.drawRectangle({
    x,
    y,
    width: stampWidth,
    height: stampHeight,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });

  lastPage.drawImage(pngImage, {
    x,
    y,
    width: stampWidth,
    height: stampHeight,
  });

  return await pdfDoc.save();
};

/**
 * Generate a stamp image for External Documents
 * @param {Object} stampData - Data for the stamp (e.g. { docCode, title, timestamp, status })
 * @returns {Promise<string>} Data URL of the generated PNG image
 */
export const generateExternalDocStampImage = async (stampData) => {
  // Ensure TH Sarabun New is loaded before drawing
  await ensureThSarabunFontLoaded();

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    // HiDPI Supersampling (1200 x 220) - 5x supersampled vs 240pt on PDF
    const width = 1200;
    const height = 220;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if ('textRendering' in ctx) {
      ctx.textRendering = 'optimizeLegibility';
    }

    // 1. Transparent Background (100% frameless, no background or border)
    ctx.clearRect(0, 0, width, height);

    // 2. Right-Aligned Typography setup
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    // Stamp Red (Crimson/Carmine) with 60% opacity as requested
    ctx.fillStyle = 'rgba(220, 38, 38, 0.60)'; 

    // Right-Margin Safety Buffer to avoid edge clipping (e.g. 2569 or ')')
    const paddingRight = 36;
    const FONT_FAMILY = '"TH Sarabun New", "THSarabunNew", "Sarabun", sans-serif';
    
    // Line 1: รหัสเอกสาร (ฉบับต้นทาง: [เวอร์ชัน]) - Bold Monospace / TH Sarabun New
    ctx.font = `bold 50px ${FONT_FAMILY}`;
    const docCode = stampData?.docCode || stampData?.edCode || 'EXT-DOC';
    let originRev = stampData?.docRev || stampData?.sourceVersion || stampData?.edition || '-';
    if (originRev === '00' || originRev === 'Rev.00' || originRev === 'Rev. 00') {
      originRev = stampData?.sourceVersion || stampData?.edition || '-';
      if (originRev === '00' || originRev === 'Rev.00' || originRev === 'Rev. 00') {
        originRev = '-';
      }
    }
    ctx.fillText(`${docCode} (ฉบับต้นทาง: ${originRev})`, width - paddingRight, 50);

    // Line 2: ชื่อเอกสาร (Truncate if too long)
    ctx.font = `normal 42px ${FONT_FAMILY}`;
    let docTitle = stampData?.title || 'External Document';
    const maxTextWidth = width - paddingRight - 80; 
    if (ctx.measureText(docTitle).width > maxTextWidth) {
      while (docTitle.length > 0 && ctx.measureText(docTitle + '...').width > maxTextWidth) {
        docTitle = docTitle.slice(0, -1);
      }
      docTitle += '...';
    }
    ctx.fillText(docTitle, width - paddingRight, 112);

    // Line 3: Effective Date - Compact Caption size
    ctx.font = `normal 38px ${FONT_FAMILY}`;
    const effectiveDate = stampData?.timestamp || '-';
    ctx.fillText(`Effective Date: ${effectiveDate}`, width - paddingRight, 170);

    resolve(canvas.toDataURL('image/png'));
  });
};

/**
 * Stamp ALL pages of an External Document at the Top Right corner, handling page rotation.
 * @param {Uint8Array|ArrayBuffer} pdfBytes - The source PDF
 * @param {Object} stampData - The data for the stamp
 * @returns {Promise<Uint8Array>} The modified PDF bytes
 */
export const stampExternalDocumentTopRight = async (pdfBytes, stampData) => {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  
  // 1. Generate stamp image once
  const pngDataUrl = await generateExternalDocStampImage(stampData);
  
  // 2. Embed image once
  const stampImage = await pdfDoc.embedPng(pngDataUrl);

  const margin = 16; 
  const stampWidth = 240; // Scaled down & compact width for seamless top-right alignment
  const stampHeight = (stampWidth / stampImage.width) * stampImage.height;

  // 3. Iterate and stamp all pages
  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const rotationAngle = page.getRotation().angle;

    // Default Top-Right coordinates (unrotated)
    let x = width - stampWidth - margin;
    let y = height - stampHeight - margin;

    // Handle Rotation to keep the stamp physically at the Top Right of the viewed page
    if (rotationAngle === 90) {
      // Page is rotated 90 degrees clockwise.
      // The visual top-right is (x: width, y: 0) in the unrotated coordinate system
      x = width - stampWidth - margin;
      y = margin;
    } else if (rotationAngle === 180) {
      // Rotated 180 degrees. Visual top-right is bottom-left unrotated (0, 0).
      x = margin;
      y = margin;
    } else if (rotationAngle === 270) {
      // Rotated 270 degrees clockwise. Visual top-right is top-left unrotated (0, height).
      x = margin;
      y = height - stampHeight - margin;
    }

    page.drawImage(stampImage, {
      x,
      y,
      width: stampWidth,
      height: stampHeight,
    });
  });

  // 4. Save and return
  return await pdfDoc.save();
};

/**
 * Generate an Uncontrolled Copy watermark image
 * Enhanced with 4x HiDPI Supersampling (300+ DPI) & high-quality anti-aliasing for vector-like sharpness
 */
export const generateUncontrolledWatermarkImage = async ({ docCode, docTitle, docRev, downloadedBy, downloadDate }) => {
  await ensureThSarabunFontLoaded();

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');

    // 4x HiDPI Supersampling Architecture (300+ DPI Print Sharpness)
    // Base logical dimensions: 600 x 300 pt (matches physical PDF target bounds)
    // Scale multiplier: 4x -> Physical Canvas: 2400 x 1200 px (~330 DPI)
    // This compresses 4x pixel density into the target PDF area, eliminating pixelation and stair-stepping.
    const SCALE = 4;
    const BASE_WIDTH = 600;
    const BASE_HEIGHT = 300;

    canvas.width = BASE_WIDTH * SCALE;   // 2400 px
    canvas.height = BASE_HEIGHT * SCALE; // 1200 px
    const ctx = canvas.getContext('2d', { alpha: true });

    // Enable high-quality anti-aliasing & subpixel text smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if ('textRendering' in ctx) {
      ctx.textRendering = 'optimizeLegibility';
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // จัดกึ่งกลางโดยไม่ต้องหมุนมุมเอียง (0 องศา แนวนอน)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const FONT_FAMILY = '"TH Sarabun New", "Noto Sans Thai", "Sarabun", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. หัวข้อหลักภาษาอังกฤษ (Bold, โทนสีแดงมาตรฐานตรายาง ความทึบแสง 50% ตามสเปก, 4x Supersampled)
    ctx.fillStyle = 'rgba(225, 29, 72, 0.50)';
    ctx.font = `bold ${Math.round(29 * SCALE)}px ${FONT_FAMILY}`; // 116px
    ctx.fillText('UNCONTROLLED COPY', centerX, centerY - Math.round(32.5 * SCALE)); // -130px

    // 2. หัวข้อย่อยภาษาไทย (Semi-bold, ความทึบแสง 48%, 4x Supersampled)
    ctx.fillStyle = 'rgba(225, 29, 72, 0.48)';
    ctx.font = `600 ${Math.round(18 * SCALE)}px ${FONT_FAMILY}`; // 72px
    ctx.fillText('สำเนาไม่ควบคุม (ใช้สำหรับอ้างอิงเท่านั้น)', centerX, centerY - Math.round(5 * SCALE)); // -20px

    // 3. เส้นขีดคั่นแนวนอนบางๆ สไตล์ Minimal (ความทึบแสง 42%, 4x Supersampled)
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.42)';
    ctx.lineWidth = Math.max(1, 0.75 * SCALE); // 3px
    ctx.beginPath();
    ctx.moveTo(centerX - Math.round(175 * SCALE), centerY + Math.round(12.5 * SCALE)); // -700px, +50px
    ctx.lineTo(centerX + Math.round(175 * SCALE), centerY + Math.round(12.5 * SCALE)); // +700px, +50px
    ctx.stroke();

    // 4. ข้อมูล Metadata ประจำเอกสาร (Normal, ขนาดกะทัดรัด คมชัด ความทึบแสง 44%, 4x Supersampled)
    ctx.fillStyle = 'rgba(225, 29, 72, 0.44)';
    ctx.font = `normal ${Math.round(10.5 * SCALE)}px ${FONT_FAMILY}`; // 42px
    const formattedRev = docRev ? (String(docRev).startsWith('Rev') ? docRev : `Rev.${docRev}`) : 'Rev.00';
    ctx.fillText(`รหัส: ${docCode || '-'}  |  ฉบับ: ${formattedRev}  |  ชื่อ: ${docTitle || '-'}`, centerX, centerY + Math.round(27.5 * SCALE)); // +110px
    ctx.fillText(`ผู้ดาวน์โหลด: ${downloadedBy || 'Authorized User'}  |  วันที่: ${downloadDate || '-'}`, centerX, centerY + Math.round(42.5 * SCALE)); // +170px

    // 5. ข้อความเตือนตามมาตรฐาน ISO (Italic, ความทึบแสง 40%, 4x Supersampled)
    ctx.fillStyle = 'rgba(225, 29, 72, 0.40)';
    ctx.font = `italic ${Math.round(8 * SCALE)}px ${FONT_FAMILY}`; // 32px
    ctx.fillText('* เอกสารนี้ไม่มีการปรับปรุงเมื่อมีการแก้ไข โปรดตรวจสอบฉบับล่าสุดในระบบก่อนใช้งาน *', centerX, centerY + Math.round(60 * SCALE)); // +240px

    ctx.restore();
    resolve(canvas.toDataURL('image/png'));
  });
};

/**
 * Apply the Uncontrolled watermark to all pages of a PDF
 */
export const applyUncontrolledWatermarkToPdf = async (pdfBytes, metadata) => {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const watermarkPngUrl = await generateUncontrolledWatermarkImage(metadata);
  const watermarkImage = await pdfDoc.embedPng(watermarkPngUrl);

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const watermarkWidth = width * 0.88;
    const watermarkHeight = (watermarkWidth / watermarkImage.width) * watermarkImage.height;

    page.drawImage(watermarkImage, {
      x: (width - watermarkWidth) / 2,
      y: (height - watermarkHeight) / 2, // วางกึ่งกลางหน้ากระดาษในแนวนอน
      width: watermarkWidth,
      height: watermarkHeight,
    });
  });

  return await pdfDoc.save();
};

/**
 * Generate a State-Aware DRAFT Watermark image
 * Specifications:
 * - Line 1: DRAFT (Large Bold)
 * - Line 2: ฉบับร่าง (สำหรับทบทวนและพิจารณาเท่านั้น)
 * - Line 3: ห้ามนำไปใช้ปฏิบัติงานจริง (NOT FOR OPERATIONAL USE)
 * - HiDPI 4x Supersampling with TH Sarabun New font
 * - 30% - 40% Opacity in Deep Carmine / Amber-Red
 */
export const generateDraftWatermarkImage = async (metadata = {}) => {
  await ensureThSarabunFontLoaded();

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');

    const SCALE = 4;
    const BASE_WIDTH = 640;
    const BASE_HEIGHT = 400;

    canvas.width = BASE_WIDTH * SCALE;   // 2560 px
    canvas.height = BASE_HEIGHT * SCALE; // 1600 px
    const ctx = canvas.getContext('2d', { alpha: true });

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if ('textRendering' in ctx) {
      ctx.textRendering = 'optimizeLegibility';
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Rotate 45 degrees or -35 degrees diagonal across the page
    const angle = -35 * (Math.PI / 180);
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);

    const FONT_FAMILY = '"TH Sarabun New", "Noto Sans Thai", "Sarabun", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 35% opacity tone
    const primaryColor = 'rgba(225, 29, 72, 0.38)';
    const secondaryColor = 'rgba(225, 29, 72, 0.36)';
    const warningColor = 'rgba(225, 29, 72, 0.34)';
    const metaColor = 'rgba(225, 29, 72, 0.30)';

    // Line 1: DRAFT (Large bold header)
    ctx.fillStyle = primaryColor;
    ctx.font = `bold ${Math.round(44 * SCALE)}px ${FONT_FAMILY}`;
    ctx.fillText('DRAFT', 0, -Math.round(44 * SCALE));

    // Line 2: ฉบับร่าง (สำหรับทบทวนและพิจารณาเท่านั้น)
    ctx.fillStyle = secondaryColor;
    ctx.font = `bold ${Math.round(20 * SCALE)}px ${FONT_FAMILY}`;
    ctx.fillText('ฉบับร่าง (สำหรับทบทวนและพิจารณาเท่านั้น)', 0, -Math.round(4 * SCALE));

    // Divider Line
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.28)';
    ctx.lineWidth = Math.max(1, 0.8 * SCALE);
    ctx.beginPath();
    ctx.moveTo(-Math.round(180 * SCALE), Math.round(16 * SCALE));
    ctx.lineTo(Math.round(180 * SCALE), Math.round(16 * SCALE));
    ctx.stroke();

    // Line 3: ห้ามนำไปใช้ปฏิบัติงานจริง (NOT FOR OPERATIONAL USE)
    ctx.fillStyle = warningColor;
    ctx.font = `600 ${Math.round(13.5 * SCALE)}px ${FONT_FAMILY}`;
    ctx.fillText('ห้ามนำไปใช้ปฏิบัติงานจริง (NOT FOR OPERATIONAL USE)', 0, Math.round(32 * SCALE));

    // Optional Line 4: DAR reference & Date
    if (metadata.darNo || metadata.docCode) {
      ctx.fillStyle = metaColor;
      ctx.font = `normal ${Math.round(11 * SCALE)}px ${FONT_FAMILY}`;
      const darText = metadata.darNo ? `DAR: ${metadata.darNo}` : '';
      const docText = metadata.docCode ? `Doc: ${metadata.docCode}` : '';
      const dateText = metadata.timestamp ? `วันที่: ${metadata.timestamp}` : '';
      const parts = [darText, docText, dateText].filter(Boolean).join('  |  ');
      if (parts) {
        ctx.fillText(parts, 0, Math.round(50 * SCALE));
      }
    }

    ctx.restore();
    resolve(canvas.toDataURL('image/png'));
  });
};

/**
 * Apply the State-Aware DRAFT watermark to all pages of a PDF
 * @param {Uint8Array|ArrayBuffer} pdfBytes - Source PDF bytes
 * @param {Object} metadata - Optional metadata (darNo, docCode, timestamp)
 * @returns {Promise<Uint8Array>} Stamped PDF bytes
 */
export const applyDraftWatermarkToPdf = async (pdfBytes, metadata = {}) => {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const watermarkPngUrl = await generateDraftWatermarkImage(metadata);
  const watermarkImage = await pdfDoc.embedPng(watermarkPngUrl);

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const watermarkWidth = width * 0.90;
    const watermarkHeight = (watermarkWidth / watermarkImage.width) * watermarkImage.height;

    page.drawImage(watermarkImage, {
      x: (width - watermarkWidth) / 2,
      y: (height - watermarkHeight) / 2,
      width: watermarkWidth,
      height: watermarkHeight,
    });
  });

  return await pdfDoc.save();
};

export { rawBlobRegistry } from './fileStorage';

/**
 * Resolve pristine raw PDF Blob from storage using High-Performance Resilient Architecture:
 *
 * Layer 0: rawBlobRegistry (clean in-session raw blobs — 0ms instant cache hit)
 * Layer 1: IndexedDB (ground-truth persistent store)
 * Layer 2: inMemoryBlobRegistry (in-memory session store)
 * Layer 3: dar/task object fields (fallback for embedded blobs passed directly)
 * Layer 4: resolveFileBlob universal resolver
 *
 * @param {string} fileId - Primary file storage key
 * @param {string[]} [fallbackKeys=[]] - Additional keys to try in order
 * @param {Object|null} [darObject=null] - DAR/task object for last-resort field extraction
 * @returns {Promise<Blob|null>}
 */
export const resolveRawFileBlob = async (fileId, fallbackKeys = [], darObject = null) => {
  const { initDB, inMemoryBlobRegistry, rawBlobRegistry, resolveFileBlob } = await import('./fileStorage');

  const toBlob = (result) => {
    if (!result) return null;
    if (typeof Blob !== 'undefined' && result instanceof Blob) return result;
    if (result instanceof ArrayBuffer) return new Blob([result], { type: 'application/pdf' });
    if (ArrayBuffer.isView(result)) return new Blob([result.buffer], { type: 'application/pdf' });
    return null;
  };

  const extraKeysFromDar = darObject ? [
    darObject.attachedFile?.fileId,
    darObject.attachedFile?.id,
    darObject.attachedFile?.key,
    darObject.attachedFile?.name,
    darObject.fileId,
    darObject.file_id,
    darObject.id,
    darObject.darNumber,
    darObject.darNo,
    darObject.docCode,
    darObject.document_code,
    darObject.title
  ] : [];

  const allKeys = Array.from(new Set([fileId, ...fallbackKeys, ...extraKeysFromDar].filter(Boolean)));

  // ── LAYER 0: Clean Raw In-Memory Registry (Instant 0ms Cache) ─────────
  for (const key of allKeys) {
    if (rawBlobRegistry && rawBlobRegistry.has(String(key))) {
      const blob = toBlob(rawBlobRegistry.get(String(key)));
      if (blob) return blob;
    }
  }

  // ── LAYER 1: IndexedDB ─────────────────────────────────────────────────
  const fetchFromIDB = async (key) => {
    if (!key) return null;
    try {
      const db = await initDB();
      return await new Promise((resolve) => {
        const tx = db.transaction('attachments', 'readonly');
        const store = tx.objectStore('attachments');
        const req = store.get(String(key));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  };

  for (const key of allKeys) {
    const blob = toBlob(await fetchFromIDB(key));
    if (blob) {
      if (rawBlobRegistry) rawBlobRegistry.set(String(key), blob);
      return blob;
    }
  }

  // ── LAYER 2: In-Memory Binary Registry Fallback ────────────────────────
  for (const key of allKeys) {
    if (inMemoryBlobRegistry && inMemoryBlobRegistry.has(String(key))) {
      const blob = toBlob(inMemoryBlobRegistry.get(String(key)));
      if (blob) {
        if (rawBlobRegistry) rawBlobRegistry.set(String(key), blob);
        return blob;
      }
    }
  }

  // ── LAYER 3: DAR/task object direct field extraction ───────────────────
  if (darObject) {
    const candidates = [
      darObject.attachedFile,
      darObject.file,
      darObject.fileBlob,
      darObject.blob,
      darObject.pdfBlob,
      darObject.attachment,
      darObject.attachedFile?.file,
      darObject.attachedFile?.blob
    ];
    for (const field of candidates) {
      const blob = toBlob(field);
      if (blob) return blob;
    }
    // Also try data URL fields
    const dataUrls = [
      darObject.fileData,
      darObject.dataUrl,
      typeof darObject.attachedFile === 'string' ? darObject.attachedFile : null,
      typeof darObject.file === 'string' ? darObject.file : null,
    ];
    for (const dataUrl of dataUrls) {
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
        try {
          const res = await fetch(dataUrl);
          return await res.blob();
        } catch { /* continue */ }
      }
    }
  }

  // ── LAYER 4: Universal File Storage Resolver Fallback ───────────────────
  if (darObject && typeof resolveFileBlob === 'function') {
    try {
      const fallbackBlob = await resolveFileBlob(darObject, fileId);
      if (fallbackBlob) return fallbackBlob;
    } catch { /* continue */ }
  }

  return null;
};

/**
 * Sequential Stamping Pipeline for DAR Document Previews:
 * 1. Stamp dynamic Signatory Matrix on the last page footer
 * 2. Stamp state-aware DRAFT watermark across center of all pages
 * 3. Return final stamped PDF bytes
 *
 * SINGLE-LAYER MUTUALLY EXCLUSIVE GUARANTEE:
 * This function ONLY ever applies the DRAFT watermark as the center watermark.
 * No CONFIDENTIAL / UNCONTROLLED / CONTROLLED stamps are applied here.
 *
 * @param {Uint8Array|ArrayBuffer} rawPdfBytes - Must be a PRISTINE UNSTAMPED PDF
 * @param {Object} options - { signOffData, draftMetadata }
 * @returns {Promise<Uint8Array>}
 */
export const stampDarPreviewPdf = async (rawPdfBytes, { signOffData = {}, draftMetadata = {} } = {}) => {
  // Step 1: Stamp Signatory Matrix on the last page footer only
  let stampedBytes = await stampDocumentLastPage(rawPdfBytes, signOffData);

  // Step 2: Stamp DRAFT watermark on ALL pages — exclusively, no other center watermark
  stampedBytes = await applyDraftWatermarkToPdf(stampedBytes, draftMetadata);

  return stampedBytes;
};

