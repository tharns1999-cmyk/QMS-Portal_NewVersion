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
