/**
 * documentUtils.js
 * 
 * Central QMS Document & Numbering Utilities
 * Conforms to ISO 9001:2015 Clause 7.5.3 Monotonic Non-Recycling Document Code Standard
 */

export {
  escapeRegex,
  formatDocumentRunningNumber,
  generateDocumentCode,
  getNextSequenceNumber,
  calculateNextDocumentSequence,
  calculateNextExternalDocSequence,
  checkDocumentCodeCollision
} from '../services/numberingService';

import numberingService from '../services/numberingService';
export default numberingService;

/**
 * Checks if a string contains Thai characters
 * @param {string} text 
 * @returns {boolean}
 */
export const isThaiText = (text) => /[\u0E00-\u0E7F]/.test(String(text || ''));

/**
 * Resolves genuine alphanumeric document code (e.g. WI-QC-01, SOP-PD-001)
 * Rejects Thai descriptions from being treated as document codes.
 * Supports both resolveDocCode(doc) and resolveDocCode(copy, doc).
 * 
 * @param {Object} primary - Document object or copy instance
 * @param {Object|null} secondary - Optional linked master document
 * @returns {string} Clean document code
 */
export const resolveDocCode = (primary, secondary = null) => {
  if (!primary && !secondary) return '-';
  const p = primary || {};
  const s = secondary || {};

  const candidates = [
    p.document_code,
    p.doc_code,
    p.docCode,
    p.code,
    p.docNo,
    p.doc_no,
    p.documentCode,
    p.edCode,
    s.document_code,
    s.doc_code,
    s.docCode,
    s.code,
    s.docNo,
    s.doc_no,
    s.documentCode,
    s.edCode,
    p.title,
    s.title,
    p.docTitle,
    s.docTitle
  ];

  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim() !== '' && !isThaiText(c)) {
      return c.trim();
    }
  }

  return p.document_code || p.doc_code || p.docCode || p.code || p.docNo || p.documentCode ||
         s.document_code || s.doc_code || s.docCode || s.code || s.docNo || s.documentCode ||
         (p.title && !isThaiText(p.title) ? p.title : null) ||
         (s.title && !isThaiText(s.title) ? s.title : null) ||
         'DOC-UNKNOWN';
};

/**
 * Resolves descriptive document title/name in Thai or English.
 * Prioritizes actual document names over alphanumeric codes.
 * 
 * @param {Object} primary - Document object or copy instance
 * @param {Object|null} secondary - Optional linked master document
 * @returns {string} Document descriptive title
 */
export const resolveDocTitle = (primary, secondary = null) => {
  if (!primary && !secondary) return '-';
  const p = primary || {};
  const s = secondary || {};

  const candidates = [
    p.document_title,
    p.doc_title,
    p.docName,
    p.documentName,
    p.name,
    p.document_name,
    s.document_title,
    s.doc_title,
    s.name,
    s.document_name,
    s.docName,
    isThaiText(p.docTitle) ? p.docTitle : null,
    isThaiText(p.title) ? p.title : null,
    isThaiText(s.docTitle) ? s.docTitle : null,
    isThaiText(s.title) ? s.title : null,
    p.docTitle,
    p.title,
    p.name,
    s.docTitle,
    s.title,
    s.name
  ];

  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim() !== '') {
      return c.trim();
    }
  }

  return '';
};

/**
 * Resolves document revision formatted with 'Rev.' prefix (e.g. 'Rev.01')
 * 
 * @param {Object} primary - Document or copy instance
 * @param {Object|null} secondary - Optional linked master document
 * @returns {string}
 */
export const resolveDocVersion = (primary, secondary = null) => {
  const p = primary || {};
  const s = secondary || {};
  const v = p.doc_version || p.rev || p.revision || s.rev || s.revision || s.doc_version || '01';
  const str = String(v).replace(/^Rev\.?\s*/i, '');
  return str ? `Rev.${str}` : 'Rev.01';
};

/**
 * Resolves the owning department of a document or copy
 * 
 * @param {Object} primary - Document or copy instance
 * @param {Object|null} secondary - Optional linked master document
 * @returns {string} Department code (e.g. 'QC', 'PD')
 */
export const resolveOwnerDept = (primary, secondary = null) => {
  const p = primary || {};
  const s = secondary || {};
  return s.department || s.owner_dept || s.ownerDepartment || p.department || p.dept || p.owner_dept || p.ownerDepartment || p.holder_dept || '-';
};

/**
 * Finds the master document associated with a copy instance
 * 
 * @param {Object} copy - Controlled copy record
 * @param {Array} documents - Internal document master list
 * @param {Array} externalDocuments - External document master list
 * @returns {Object|null} Master document or null
 */
export const resolveCopyDoc = (copy, documents = [], externalDocuments = []) => {
  if (!copy) return null;
  const docId = String(copy.doc_id || copy.docId || copy.external_doc_id || '');
  if (!docId) return null;
  return (documents || []).find(d => String(d.id) === docId)
    || (externalDocuments || []).find(d => String(d.id) === docId) || null;
};

/**
 * Converts revision string (e.g. '00', '01', 'Rev.02', 'A') to numeric sequence index
 * @param {string|number} revStr 
 * @returns {number}
 */
export const getRevisionIndex = (revStr) => {
  if (!revStr && revStr !== 0) return 0;
  const clean = String(revStr).replace(/^rev\.?\s*/i, '').trim();
  const num = parseInt(clean, 10);
  if (!isNaN(num)) return num;
  if (clean.length === 1) return clean.toUpperCase().charCodeAt(0) - 65;
  return 0;
};

/**
 * Compares two revision identifiers
 * Returns negative if revA < revB, 0 if equal, positive if revA > revB
 * @param {string|number} revA 
 * @param {string|number} revB 
 * @returns {number}
 */
export const compareRevisions = (revA, revB) => {
  return getRevisionIndex(revA) - getRevisionIndex(revB);
};

/**
 * ISO 9001 Clause 7.5.3 — Periodic Review Helpers
 * ─────────────────────────────────────────────────
 * These helpers operate on lightweight date strings (YYYY-MM-DD)
 * and are intentionally separate from PeriodicReviewService.js
 * to allow use in documentUtils-dependent paths (e.g. Library, DocumentDetailModal).
 */

/**
 * Adds specified number of years to a date string (YYYY-MM-DD or ISO).
 * Properly handles leap-year edge cases (e.g. 2024-02-29 + 1 year = 2025-02-28).
 *
 * @param {string} baseDateStr - ISO date string or YYYY-MM-DD
 * @param {number} years - number of years to add (default 1)
 * @returns {string} YYYY-MM-DD date or '' if falsy/invalid
 */
export const addYears = (baseDateStr, years = 1) => {
  if (!baseDateStr) return '';
  const str = String(baseDateStr).split('T')[0].trim();
  const parts = str.split('-');
  if (parts.length < 3) {
    const dt = new Date(baseDateStr);
    if (isNaN(dt.getTime())) return '';
    dt.setFullYear(dt.getFullYear() + years);
    return dt.toISOString().split('T')[0];
  }
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';

  const targetYear = y + years;
  // Leap year edge case: 2024-02-29 -> 2025-02-28 (if target year is not leap year)
  if (m === 2 && d === 29) {
    const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
    const targetDay = isLeap ? 29 : 28;
    return `${targetYear}-02-${String(targetDay).padStart(2, '0')}`;
  }
  return `${targetYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

/**
 * Returns document review cycle in years based on document type:
 * - QP, SOP: 1 year
 * - WI, FM: 2 years
 * - Other/Default: 1 year
 *
 * @param {string} docType - Document type or title prefix (e.g. 'QP', 'SOP', 'WI', 'FM')
 * @returns {number} cycle in years
 */
export const getReviewCycleYears = (docType) => {
  const type = String(docType || '').toUpperCase().trim();
  if (
    type === 'WI' || 
    type === 'FM' || 
    type.startsWith('WI-') || 
    type.startsWith('FM-') || 
    type.startsWith('WI_') || 
    type.startsWith('FM_') ||
    type.includes('/WI/') ||
    type.includes('/FM/')
  ) {
    return 2;
  }
  return 1;
};

/**
 * Returns a date string after adding cycle years (default 1 year) to the supplied base date.
 * Safe for use in both store actions and pure utility calculations.
 *
 * @param {string} baseDateStr - ISO date string or YYYY-MM-DD
 * @param {number} [years=1] - number of years
 * @returns {string} YYYY-MM-DD date, or '' if baseDateStr is falsy
 */
export const calculateNextReviewDate = (baseDateStr, years = 1) => {
  return addYears(baseDateStr, years);
};

/**
 * Returns a normalized review status string based on distance between today and nextReviewDueDate.
 *
 * @param {string} nextReviewDueDate - YYYY-MM-DD date of next due review
 * @param {Date|string} [today=new Date()] - reference date
 * @returns {'OVERDUE' | 'DUE_SOON' | 'UP_TO_DATE'} review urgency status
 */
export const getReviewStatus = (nextReviewDueDate, today = new Date()) => {
  if (!nextReviewDueDate) return 'UP_TO_DATE';
  const now = new Date(today);
  now.setHours(0, 0, 0, 0);
  const due = new Date(nextReviewDueDate);
  due.setHours(0, 0, 0, 0);
  if (isNaN(due.getTime())) return 'UP_TO_DATE';
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'OVERDUE';     // เกินกำหนด
  if (diffDays <= 30) return 'DUE_SOON';  // ใกล้ถึงกำหนดใน 30 วัน
  return 'UP_TO_DATE';                   // ปกติ
};

/**
 * Returns normalized status flag strictly as OVERDUE, DUE_SOON, or UP_TO_DATE:
 * - OVERDUE: today > next_review_date
 * - DUE_SOON: next_review_date - today <= 30 days
 * - UP_TO_DATE: > 30 days
 *
 * @param {string} nextReviewDueDate - YYYY-MM-DD date of next due review
 * @param {Date|string} [today=new Date()] - reference date
 * @returns {'OVERDUE' | 'DUE_SOON' | 'UP_TO_DATE'}
 */
export const getReviewStatusFlag = (nextReviewDueDate, today = new Date()) => {
  return getReviewStatus(nextReviewDueDate, today);
};



