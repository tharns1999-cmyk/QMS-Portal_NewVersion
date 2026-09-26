/**
 * documentNamingHelper.js
 *
 * Centralized ISO-Standard Document Naming and Download Helper
 * Formula: {รหัสเอกสาร}_{ชื่อเอกสาร}_Rev{ฉบับที่}_{สถานะ}.pdf
 */

export const generateQmsDownloadName = ({
  docCode = 'DOC',
  title = 'Document',
  revision = '00',
  systemStatus = 'DRAFT', // 'DRAFT', 'ACTIVE', 'EFFECTIVE', 'SUPERSEDED', 'OBSOLETE'
  isControlledPrint = false
}) => {
  // ทำความสะอาดชื่อไฟล์ ตัดอักขระพิเศษ ป้องกันอักขระที่ระบบปฏิบัติการไม่รองรับ
  const rawCode = String(docCode || 'DOC').trim();
  const cleanCode = rawCode.replace(/[^a-zA-Z0-9-]/g, '') || 'DOC';

  const rawTitle = String(title || 'Document').trim();
  const cleanTitle = rawTitle
    .replace(/[^a-zA-Z0-9ก-๙\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Document';

  const rawRev = String(revision ?? '00').replace(/\D/g, '');
  const cleanRev = rawRev ? rawRev.padStart(2, '0') : '00';

  let statusSuffix = 'DRAFT';
  const normalizedStatus = String(systemStatus || 'DRAFT').toUpperCase();

  if (normalizedStatus === 'SUPERSEDED') {
    statusSuffix = 'SUPERSEDED';
  } else if (normalizedStatus === 'OBSOLETE') {
    statusSuffix = 'OBSOLETE';
  } else if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'EFFECTIVE') {
    statusSuffix = isControlledPrint ? 'CONTROLLED' : 'UNCONTROLLED';
  } else {
    // สถานะ PENDING, REVIEW, APPROVE, REVISE ถือเป็น DRAFT ทั้งหมด
    statusSuffix = 'DRAFT';
  }

  return `${cleanCode}_${cleanTitle}_Rev${cleanRev}_${statusSuffix}.pdf`;
};

/**
 * Trigger immediate browser file download via standard <a> anchor element
 */
export const triggerBrowserDownload = (blobOrUrl, fileName) => {
  if (!blobOrUrl || typeof window === 'undefined') return;
  const isString = typeof blobOrUrl === 'string';
  const url = isString ? blobOrUrl : URL.createObjectURL(blobOrUrl);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (!isString) {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore revocation errors
      }
    }, 15000);
  }
};

/**
 * Format document header title as: รหัสเอกสาร - ชื่อเอกสาร (Rev. xx)
 */
export const formatDarHeaderTitle = (dar, fallbackCode = 'No Code', fallbackTitle = 'ไม่ระบุชื่อเอกสาร') => {
  if (!dar) return `${fallbackCode} - ${fallbackTitle} (Rev. 00)`;
  const code = dar.docCode || dar.doc_code || dar.docNo || dar.code || fallbackCode;
  const title = dar.title || dar.docName || dar.documentName || dar.docTitle || dar.name || fallbackTitle;
  const rawRev = dar.targetRevision || dar.newRevision || dar.revision || dar.rev || '00';
  const cleanRev = String(rawRev).replace(/\D/g, '').padStart(2, '0');
  return `${code} - ${title} (Rev. ${cleanRev})`;
};
