/**
 * signatoryResolver.js
 *
 * Progressive Workflow Signatory Resolver
 * =========================================
 * Computes the state of each signatory column (ผู้จัดทำ / ผู้ทบทวน / ผู้อนุมัติ)
 * according to the current workflow stage so the PDF matrix is stamped progressively:
 *
 *   REVIEW  → ผู้จัดทำ filled | ผู้ทบทวน blank | ผู้อนุมัติ blank
 *   APPROVE → ผู้จัดทำ filled | ผู้ทบทวน filled | ผู้อนุมัติ blank
 *   MASTER  → ผู้จัดทำ filled | ผู้ทบทวน filled | ผู้อนุมัติ filled
 */

import { inMemoryBlobRegistry } from './fileStorage';

/**
 * Resolve signatory data for the 3-column matrix based on workflow stage.
 *
 * @param {{ dar: Object, task: Object, masterDoc: Object, stage: string, masterUsers: Array, users: Array, currentUser: Object }} opts
 * @returns {{ requester: Object, reviewer: Object, approver: Object }}
 */
export const resolveProgressiveSignatories = ({
  dar = null,
  task = null,
  masterDoc = null,
  stage = 'REVIEW',   // 'REVIEW' | 'APPROVE' | 'MASTER'
  masterUsers = [],
  users = [],
  currentUser = null
} = {}) => {
  const allUsers = [...(masterUsers || []), ...(users || [])];

  const findUser = (id, name) => {
    if (!id && !name) return null;
    return allUsers.find(u => u && (
      (id && (u.id === id || u.empId === id)) ||
      (name && (u.name === name || u.fullName === name))
    )) || null;
  };

  // ─── 1. ผู้จัดทำ (Requester) — always completed ──────────────────────────
  const reqName = dar?.requesterName || dar?.requester_name || 'ผู้ร้องขอ';
  const reqId   = dar?.requesterId  || dar?.requester_id;
  const reqUser = findUser(reqId, reqName);

  // Resolve signature asset from user record
  const getSignatureAsset = (user) => {
    if (!user) return null;
    const uid = user.id || user.empId || user.userId;
    const inMemorySig = uid ? (inMemoryBlobRegistry?.get(`user_sig_${uid}`) || (user.id ? inMemoryBlobRegistry?.get(`user_sig_${user.id}`) : null)) : null;
    return (
      user.signatureImage ||
      inMemorySig ||
      user.eSignDataUrl  ||
      user.signatureUrl  ||
      (typeof user.signature === 'string' && user.signature.startsWith('data:image/') ? user.signature : null) ||
      (typeof user.eSign     === 'string' && user.eSign.startsWith('data:image/')     ? user.eSign     : null) ||
      null
    );
  };

  // Resolve submission date
  const resolveDate = (raw) => {
    if (!raw || raw === '-') return '';
    try {
      const d = raw instanceof Date ? raw : new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      const day   = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year  = d.getFullYear() + 543;
      return `${day}/${month}/${year}`;
    } catch { return String(raw); }
  };

  const reqDateRaw = dar?.submittedAt || dar?.submitted_at || dar?.requestDate || dar?.createdAt || dar?.date || task?.createdAt || task?.date;

  const fallbackReqUser = findUser('U005') || reqUser;
  
  const requester = {
    title: 'ผู้จัดทำ',
    name:          reqUser?.name        || reqUser?.fullName  || dar?.requesterName || 'บีม',
    position:      reqUser?.position    || reqUser?.role      || dar?.requesterPosition || 'QAQC Supervisor',
    date:          resolveDate(reqDateRaw) || resolveDate(new Date()),
    signatureImage: getSignatureAsset(reqUser) || getSignatureAsset(fallbackReqUser),
    isCompleted:   true
  };

  // ─── 2. ผู้ทบทวน (Reviewer) ───────────────────────────────────────────────
  const isReviewCompleted =
    stage === 'APPROVE' ||
    stage === 'MASTER'  ||
    dar?.status === 'APPROVED'          ||
    dar?.status === 'PENDING_APPROVAL'  ||
    masterDoc != null;

  let reviewer;
  if (isReviewCompleted) {
    const history = dar?.workflowHistory || dar?.history || task?.history || [];
    const reviewRecord = history.find(h => h.role === 'REVIEWER' || h.step === 2 || h.action === 'REVIEW');
    
    const revNameFallback = dar?.reviewerName || dar?.reviewer_name || dar?.reviewedBy || '';
    const revIdFallback = dar?.reviewerId || dar?.reviewer_id;
    
    let revUser = findUser(reviewRecord?.userId || revIdFallback, revNameFallback) || (stage === 'APPROVE' ? currentUser : null);

    const revDateRaw = reviewRecord?.timestamp || dar?.reviewedAt || dar?.reviewDate || task?.reviewedAt || '';

    reviewer = {
      title: 'ผู้ทบทวน',
      name:          revUser?.name     || revUser?.fullName || revNameFallback || 'กัลยาณี พลไกร',
      position:      revUser?.position || revUser?.role     || dar?.reviewerRole || 'Production Assistant Manager',
      date:          resolveDate(revDateRaw),
      signatureImage: getSignatureAsset(revUser),
      isCompleted:   true
    };
  } else {
    reviewer = {
      title: 'ผู้ทบทวน',
      name: '', position: '', date: '', signatureImage: null,
      isCompleted: false
    };
  }

  // ─── 3. ผู้อนุมัติ (Approver) ─────────────────────────────────────────────
  const isApproveCompleted =
    stage === 'MASTER'          ||
    dar?.status === 'APPROVED'  ||
    masterDoc?.status === 'ACTIVE';

  let approver;
  if (isApproveCompleted) {
    const appName = dar?.approverName || dar?.approver_name || '';
    const appId   = dar?.approverId   || dar?.approver_id;
    const appUser = findUser(appId, appName);
    const appDateRaw = dar?.approvedAt || dar?.approveDate || '';

    approver = {
      title: 'ผู้อนุมัติ',
      name:          appUser?.name     || appUser?.fullName || appName || '',
      position:      appUser?.position || appUser?.role     || dar?.approverRole || 'General Manager / QMR',
      date:          resolveDate(appDateRaw),
      signatureImage: getSignatureAsset(appUser),
      isCompleted:   true
    };
  } else {
    approver = {
      title: 'ผู้อนุมัติ',
      name: '', position: '', date: '', signatureImage: null,
      isCompleted: false
    };
  }

  return { requester, reviewer, approver };
};
