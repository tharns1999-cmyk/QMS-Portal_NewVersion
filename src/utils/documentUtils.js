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
    p.docNo,
    p.doc_no,
    p.documentCode,
    p.doc_code,
    p.docCode,
    p.code,
    p.edCode,
    p.document_code,
    s.docNo,
    s.doc_no,
    s.documentCode,
    s.doc_code,
    s.docCode,
    s.code,
    s.edCode,
    s.document_code,
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

  return p.docNo || p.doc_code || p.docCode || p.code || p.documentCode ||
         s.docNo || s.doc_code || s.docCode || s.code || s.documentCode ||
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
    p.docName,
    p.documentName,
    p.name,
    p.document_name,
    s.name,
    s.document_name,
    s.docName,
    s.document_name,
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
 * Returns a date string exactly 1 year after the supplied base date.
 * Safe for use in both store actions and pure utility calculations.
 *
 * @param {string} baseDateStr - ISO date string or YYYY-MM-DD
 * @returns {string} YYYY-MM-DD date one year later, or '' if baseDateStr is falsy
 */
export const calculateNextReviewDate = (baseDateStr) => {
  if (!baseDateStr) return '';
  const date = new Date(baseDateStr);
  if (isNaN(date.getTime())) return '';
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().split('T')[0];
};

/**
 * Returns a normalized review status string based on the distance
 * between today and the nextReviewDueDate.
 *
 * @param {string} nextReviewDueDate - YYYY-MM-DD date of next due review
 * @returns {'OVERDUE' | 'UPCOMING' | 'ON_SCHEDULE'} review urgency status
 */
export const getReviewStatus = (nextReviewDueDate) => {
  if (!nextReviewDueDate) return 'ON_SCHEDULE';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(nextReviewDueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'OVERDUE';     // เกินกำหนด
  if (diffDays <= 30) return 'UPCOMING';  // ใกล้ถึงกำหนดใน 30 วัน
  return 'ON_SCHEDULE';                   // ปกติ
};


