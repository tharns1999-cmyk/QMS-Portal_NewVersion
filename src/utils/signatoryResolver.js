/**
 * signatoryResolver.js
 *
 * Progressive Workflow Signatory Resolver (100% Dynamic & Data-Driven)
 * ======================================================================
 * Computes the state of each signatory column (ผู้จัดทำ / ผู้ทบทวน / ผู้อนุมัติ)
 * dynamically from DAR workflow steps, history timeline, and master user profiles.
 * ZERO hardcoded names or fallback strings.
 */

import { inMemoryBlobRegistry } from './fileStorage';

/**
 * Extract active user signature asset from user object or in-memory blob cache
 */
export const getSignatureAsset = (user) => {
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

/**
 * Format timestamp to Thai Buddhist Calendar date string (DD/MM/BBBB)
 */
export const formatSignatoryDate = (raw) => {
  if (!raw || raw === '-') return '';
  try {
    const d = raw instanceof Date ? raw : new Date(raw);
    if (isNaN(d.getTime())) return '';
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

/**
 * Resolve progressive signatory data for the 3-column matrix based on workflow stage.
 *
 * @param {{ dar: Object, task: Object, masterDoc: Object, stage: string, masterUsers: Array, users: Array, currentUser: Object }} opts
 * @returns {{ requester: Object, reviewer: Object, approver: Object }}
 */
export const resolveProgressiveSignatories = ({
  dar = {},
  task = {},
  masterDoc = {},
  stage = 'REVIEW',
  masterUsers = [],
  users = [],
  currentUser = null
} = {}) => {
  const allUsers = [...(masterUsers || []), ...(users || [])];
  const steps = dar?.workflowSteps || [];
  const history = dar?.workflowHistory || dar?.timeline || task?.history || [];

  // Helper ค้นหา User Profile จาก allUsers
  const getUserProfile = (userId, userName) => {
    if (!userId && !userName) return null;
    return allUsers.find(u => 
      (userId && (u.id === userId || u.userId === userId || u.empId === userId)) ||
      (userName && (u.name === userName || u.fullName === userName))
    ) || null;
  };

  // ----------------------------------------------------
  // 1. กล่องผู้จัดทำ (Requester)
  // ----------------------------------------------------
  const step1Def = steps.find(s => s.role === 'REQUESTER' || s.step === 1);
  const reqHistory = history.find(h => h.role === 'REQUESTER' || h.step === 1 || h.action === 'SUBMIT' || h.action === 'REQUEST' || h.action === 'CREATE' || h.action === 'Created');
  const reqUserId = reqHistory?.userId || step1Def?.userId || dar?.requesterId || dar?.requester_id || currentUser?.id;
  const reqNameFallback = reqHistory?.userName || step1Def?.userName || dar?.requesterName || dar?.requester_name || currentUser?.name || '';
  const reqProfile = getUserProfile(reqUserId, reqNameFallback);

  const requester = {
    title: 'ผู้จัดทำ',
    name: reqProfile?.name || reqProfile?.fullName || step1Def?.userName || reqNameFallback,
    position: reqProfile?.position || reqProfile?.role || step1Def?.position || dar?.requesterPosition || '',
    date: formatSignatoryDate(reqHistory?.timestamp || step1Def?.timestamp || dar?.submittedAt || dar?.createdAt || dar?.date || new Date()),
    signatureImage: getSignatureAsset(reqProfile) || null,
    isCompleted: true
  };

  // ----------------------------------------------------
  // 2. กล่องผู้ทบทวน (Reviewer)
  // ----------------------------------------------------
  const step2Def = steps.find(s => s.role === 'REVIEWER' || s.step === 2);
  const revHistory = history.find(h => h.role === 'REVIEWER' || h.step === 2 || h.action === 'REVIEW' || h.action === 'APPROVE_REVIEW' || h.action === 'Reviewed');
  const isReviewCompleted = stage === 'APPROVE' || stage === 'MASTER' || Boolean(revHistory) || dar?.status === 'APPROVED' || dar?.status === 'PENDING_APPROVAL';

  const revUserId = revHistory?.userId || step2Def?.userId || dar?.reviewerId || dar?.reviewer_id;
  const revNameFallback = revHistory?.userName || step2Def?.userName || dar?.reviewerName || dar?.reviewer_name || dar?.reviewedBy || '';
  const revProfile = getUserProfile(revUserId, revNameFallback);

  const reviewer = {
    title: 'ผู้ทบทวน',
    name: isReviewCompleted ? (revProfile?.name || revProfile?.fullName || step2Def?.userName || revNameFallback || '') : '',
    position: isReviewCompleted ? (revProfile?.position || revProfile?.role || step2Def?.position || dar?.reviewerRole || '') : '',
    date: isReviewCompleted ? formatSignatoryDate(revHistory?.timestamp || dar?.reviewedAt || task?.updatedAt || task?.reviewedAt) : '',
    signatureImage: isReviewCompleted ? (getSignatureAsset(revProfile) || null) : null,
    isCompleted: isReviewCompleted && Boolean(revProfile?.name || step2Def?.userName || revNameFallback)
  };

  // ----------------------------------------------------
  // 3. กล่องผู้อนุมัติ (Approver)
  // ----------------------------------------------------
  const step3Def = steps.find(s => s.role === 'APPROVER' || s.step === 3);
  const appHistory = history.find(h => h.role === 'APPROVER' || h.step === 3 || h.action === 'APPROVE' || h.action === 'Approved');
  const isApproveCompleted = stage === 'MASTER' || Boolean(appHistory) || dar?.status === 'APPROVED' || masterDoc?.status === 'ACTIVE';

  const appUserId = appHistory?.userId || step3Def?.userId || dar?.approverId || dar?.approver_id;
  const appNameFallback = appHistory?.userName || step3Def?.userName || dar?.approverName || dar?.approver_name || '';
  const appProfile = getUserProfile(appUserId, appNameFallback);

  const approver = {
    title: 'ผู้อนุมัติ',
    name: isApproveCompleted ? (appProfile?.name || appProfile?.fullName || step3Def?.userName || appNameFallback || '') : '',
    position: isApproveCompleted ? (appProfile?.position || appProfile?.role || step3Def?.position || dar?.approverRole || '') : '',
    date: isApproveCompleted ? formatSignatoryDate(appHistory?.timestamp || dar?.approvedAt || task?.updatedAt) : '',
    signatureImage: isApproveCompleted ? (getSignatureAsset(appProfile) || null) : null,
    isCompleted: isApproveCompleted && Boolean(appProfile?.name || step3Def?.userName || appNameFallback)
  };

  return { requester, reviewer, approver };
};
