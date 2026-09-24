import { PDFDocument } from 'pdf-lib';

/**
 * Generate a sign-off stamp image (3 columns: Requester, Reviewer, Approver)
 * using HTML5 Canvas to prevent Thai vowel rendering issues.
 * @param {Object} signOffData - { requester, reviewer, approver }
 * Each role object should have { name, position, timestamp }
 * @returns {Promise<string>} Data URL of the generated PNG image
 */
export const generateSignOffStampImage = async ({ requester, reviewer, approver }) => {
  return new Promise((resolve) => {
    // Create canvas
    const canvas = document.createElement('canvas');
    const width = 600;
    const height = 220;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Background (transparent or white, let's use white for clarity or transparent. A white box is better for stamp)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Columns
    const colWidth = width / 3;
    
    // Draw vertical lines
    ctx.beginPath();
    ctx.moveTo(colWidth, 0);
    ctx.lineTo(colWidth, height);
    ctx.moveTo(colWidth * 2, 0);
    ctx.lineTo(colWidth * 2, height);
    ctx.stroke();

    const drawRoleColumn = (roleData, title, xOffset) => {
      // Title Box
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(xOffset + 2, 2, colWidth - 4, 40);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, xOffset + colWidth / 2, 22);

      // Bottom Line (Border under title)
      ctx.beginPath();
      ctx.moveTo(xOffset, 42);
      ctx.lineTo(xOffset + colWidth, 42);
      ctx.stroke();

      // Digital Stamp Text in the middle
      ctx.save();
      ctx.translate(xOffset + colWidth / 2, 100);
      ctx.rotate(-15 * Math.PI / 180);
      ctx.fillStyle = 'rgba(20, 174, 92, 0.3)'; // Semi-transparent green
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('APPROVED', 0, 0);
      ctx.restore();

      // Signature line (dotted)
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.moveTo(xOffset + 20, 140);
      ctx.lineTo(xOffset + colWidth - 20, 140);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // Details
      ctx.fillStyle = '#000000';
      ctx.font = '14px sans-serif';
      ctx.fillText(roleData?.name || '-', xOffset + colWidth / 2, 160);
      
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(roleData?.position || '-', xOffset + colWidth / 2, 180);
      
      ctx.font = '12px monospace';
      ctx.fillText(roleData?.timestamp || '-', xOffset + colWidth / 2, 200);
    };

    drawRoleColumn(requester, 'ผู้จัดทำ (Requester)', 0);
    drawRoleColumn(reviewer, 'ผู้ทบทวน (Reviewer)', colWidth);
    drawRoleColumn(approver, 'ผู้อนุมัติ (Approver)', colWidth * 2);

    resolve(canvas.toDataURL('image/png'));
  });
};

/**
 * Stamp the first page of a PDF with the sign-off table
 * @param {Uint8Array|ArrayBuffer} originalPdfBytes - The source PDF
 * @param {Object} signOffData - The data for the stamp { requester, reviewer, approver }
 * @returns {Promise<Uint8Array>} The modified PDF bytes
 */
export const stampDocumentFirstPage = async (originalPdfBytes, signOffData) => {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();

  // 1. Generate stamp image
  const pngDataUrl = await generateSignOffStampImage(signOffData);
  const pngImage = await pdfDoc.embedPng(pngDataUrl);

  // 2. Calculate position (Bottom Right or Top Right)
  // Let's put it at the Top Right below typical headers, or bottom right.
  // The spec says: "คำนวณพิกัดมุมขวาบน หรือส่วนล่างของหน้าแรก"
  // Let's go with top right, just below header (e.g. y = height - stampHeight - 40)
  // Wait, the prompt example had: y: 20 (which is bottom right because origin is bottom-left in PDF)
  const stampWidth = 260; // scale down
  const stampHeight = (stampWidth / pngImage.width) * pngImage.height;

  firstPage.drawImage(pngImage, {
    x: width - stampWidth - 20, // Right align with 20pt margin
    y: 40, // 40pt from bottom
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
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const width = 300;
    const height = 120; // Increased height
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Background (white with some opacity for better reading)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(0, 0, width, height);

    // Border (Red for external doc control)
    ctx.strokeStyle = '#dc2626'; // red-600
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // Top Header
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(2, 2, width - 4, 30);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXTERNAL DOCUMENT CONTROL', width / 2, 17);

    // Document Info
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(stampData?.docCode || 'EXT-DOC', width / 2, 52);

    ctx.fillStyle = '#1f2937'; // gray-800
    ctx.font = 'bold 13px sans-serif';
    const originRev = stampData?.docRev && stampData.docRev !== '00' ? stampData.docRev : (stampData?.docRev || '-');
    ctx.fillText(`ฉบับต้นทาง: ${originRev}`, width / 2, 74);

    ctx.fillStyle = '#4b5563'; // gray-600
    ctx.font = '12px sans-serif';
    ctx.fillText(`มีผล: ${stampData?.timestamp || '-'}`, width / 2, 94);
    
    // Status (Optional corner or bottom)
    ctx.fillStyle = stampData?.status === 'OBSOLETE' ? '#dc2626' : '#16a34a'; // green-600 for ACTIVE
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(stampData?.status === 'OBSOLETE' ? 'OBSOLETE' : 'CONTROLLED', width / 2, 110);

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

  const margin = 20; 
  const stampWidth = 200; 
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
 */
export const generateUncontrolledWatermarkImage = ({ docCode, docTitle, docRev, downloadedBy, downloadDate }) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 600; // ปรับสัดส่วนให้แบนลงตามแนวนอน
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // จัดกึ่งกลางโดยไม่ต้องหมุนมุมเอียง (0 องศา)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // ใช้โทนสีแดงกุหลาบแบบ Minimal Transparency เพื่อให้อ่านเอกสารหลักรู้เรื่อง
    ctx.fillStyle = 'rgba(225, 29, 72, 0.16)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. หัวข้อหลักภาษาอังกฤษ (ตัวตรง Bold)
    ctx.font = 'bold 58px "Noto Sans Thai", "Sarabun", -apple-system, sans-serif';
    ctx.fillText('UNCONTROLLED COPY', centerX, centerY - 65);

    // 2. หัวข้อย่อยภาษาไทย
    ctx.font = '600 36px "Noto Sans Thai", "Sarabun", -apple-system, sans-serif';
    ctx.fillText('สำเนาไม่ควบคุม (ใช้สำหรับอ้างอิงเท่านั้น)', centerX, centerY - 10);

    // 3. เส้นขีดคั่นแนวนอนบางๆ สไตล์ Minimal
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX - 350, centerY + 25);
    ctx.lineTo(centerX + 350, centerY + 25);
    ctx.stroke();

    // 4. ข้อมูล Metadata ประจำเอกสาร (ตัวตรง ขนาดกะทัดรัด)
    ctx.font = 'normal 20px "Noto Sans Thai", "Sarabun", sans-serif';
    ctx.fillText(`รหัส: ${docCode || '-'}  |  ฉบับ: Rev.${docRev || '00'}  |  ชื่อ: ${docTitle || '-'}`, centerX, centerY + 55);
    ctx.fillText(`ผู้ดาวน์โหลด: ${downloadedBy}  |  วันที่: ${downloadDate}`, centerX, centerY + 85);

    // 5. ข้อความเตือนตามมาตรฐาน ISO
    ctx.font = 'italic 16px "Noto Sans Thai", "Sarabun", sans-serif';
    ctx.fillText('* เอกสารนี้ไม่มีการปรับปรุงเมื่อมีการแก้ไข โปรดตรวจสอบฉบับล่าสุดในระบบก่อนใช้งาน *', centerX, centerY + 120);

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
    const watermarkWidth = width * 0.9;
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
