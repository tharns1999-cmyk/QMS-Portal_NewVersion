const REASON_MAP = {
  'PROCESS_IMPROVEMENT': 'ปรับปรุงกระบวนการทำงานให้ดีขึ้น',
  'AUDIT_FINDING': 'แก้ไข/ยกเลิกตามข้อเสนอแนะจากการตรวจติดตาม (Audit Finding)',
  'MANAGEMENT_REVIEW': 'ทบทวนโดยฝ่ายบริหาร (Management Review)',
  'PROCESS_CHANGE': 'ปรับปรุงกระบวนการและควบรวมกับเอกสารอื่น',
  'PROCESS_REMOVED': 'ยกเลิกกระบวนการทำงานดังกล่าวแล้ว',
  'DUPLICATED': 'เอกสารซ้ำซ้อน',
  'OTHER': 'อื่นๆ'
};

export const getDarReason = (dar) => {
  if (!dar) return { title: 'เหตุผลในการร้องขอ', value: '-' };
  
  const mapReason = (val) => REASON_MAP[val] || val;

  if (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') {
    return {
      title: 'เหตุผลในการร้องขอ',
      value: dar.requestReason || '-'
    };
  } else if (dar.type === 'REVISION') {
    return {
      title: 'เหตุผลในการแก้ไข',
      value: dar.changeReason === 'OTHER' ? dar.otherReason : (mapReason(dar.changeReason) || '-')
    };
  } else if (dar.type === 'OBSOLETE') {
    return {
      title: 'เหตุผลในการยกเลิก',
      value: dar.obsoleteReason === 'OTHER' ? dar.otherReason : (mapReason(dar.obsoleteReason) || '-')
    };
  }
  
  return { title: 'เหตุผลในการร้องขอ', value: '-' };
};

export const getDarDetail = (dar) => {
  if (!dar) return { title: 'รายละเอียดเพิ่มเติม', value: '-' };
  
  if (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') {
    return {
      title: 'รายละเอียดเพิ่มเติม',
      value: dar.requestDetail || '-'
    };
  } else if (dar.type === 'REVISION') {
    return {
      title: 'สรุปการเปลี่ยนแปลง',
      value: dar.changeSummary || '-'
    };
  } else if (dar.type === 'OBSOLETE') {
    return {
      title: 'รายละเอียดเพิ่มเติม/แผนรองรับ',
      value: dar.obsoleteDetail || dar.recallPlan || '-'
    };
  }
  
  return { title: 'รายละเอียดเพิ่มเติม', value: '-' };
};

export const getDarDocInfo = (dar, documents) => {
  if (!dar) return { docCode: '-', docType: '-', docRev: '-' };
  
  if (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') {
    return {
      docCode: dar.docIdInput || '-',
      docType: dar.docType || '-',
      docRev: dar.docRev || '00'
    };
  } else if (dar.type === 'REVISION' || dar.type === 'OBSOLETE') {
    const refDoc = documents?.find(d => d.id === dar.docIdRef);
    if (refDoc) {
      const docType = refDoc.title.split('-')[0] || '-';
      return {
        docCode: refDoc.title || '-',
        docType: docType,
        docRev: refDoc.rev || '-'
      };
    }
  }
  
  return { docCode: '-', docType: '-', docRev: '-' };
};

export const getRequesterName = (dar, masterUsers) => {
  if (!dar) return '-';
  const u = masterUsers?.find(u => u.id === dar.requesterId);
  return u ? u.name : (dar.requester || '-');
};

export const getReviewerName = (dar, timeline) => {
  if (!dar || !timeline) return '-';
  const tl = timeline.slice().reverse().find(t => t.darId === dar.id && (t.action === 'Reviewed' || t.action === 'Review'));
  return tl ? tl.user : (dar.reviewer || '-');
};

export const getApproverName = (dar, timeline) => {
  if (!dar || !timeline) return '-';
  const tl = timeline.slice().reverse().find(t => t.darId === dar.id && (t.action === 'Approved' || t.action === 'Approve'));
  return tl ? tl.user : (dar.approver || '-');
};

export const getAckNames = (dar, timeline) => {
  if (!dar || !timeline) return '-';
  const acks = timeline.filter(t => t.darId === dar.id && (t.action === 'Acknowledged' || t.action === 'Ack'));
  if (acks.length > 0) {
    return [...new Set(acks.map(a => a.user))].join(', ');
  }
  return '-';
};

/**
 * Universal Draft check
 * Returns true if the DAR is a draft (unsubmitted)
 */
export const isDarDraft = (dar) => {
  if (!dar) return false;
  return Boolean(
    dar.isDraft || 
    dar.status === 'DRAFT' || 
    String(dar.id).startsWith('draft_')
  );
};

/**
 * Checks if currentUser is the creator / requester of the DAR
 */
export const isDarRequester = (dar, currentUser) => {
  if (!dar || !currentUser) return false;
  const userIds = [currentUser.id, currentUser.empId].filter(Boolean);
  const userNames = [currentUser.name, currentUser.fullName].filter(Boolean);

  const darRequesterIds = [dar.requesterId, dar.requester_id, dar.createdBy, dar.created_by].filter(Boolean);
  const isMatchId = darRequesterIds.some(id => userIds.includes(id));
  if (isMatchId) return true;

  if (dar.requester && (userIds.includes(dar.requester) || userNames.includes(dar.requester))) return true;
  if (dar.createdByName && userNames.includes(dar.createdByName)) return true;

  return false;
};

/**
 * Universal Draft Privacy Guard:
 * Drafts can ONLY be viewed by their creator/requester, regardless of user role.
 */
export const canViewDar = (dar, currentUser) => {
  if (!dar || !currentUser) return false;
  if (isDarDraft(dar)) {
    return isDarRequester(dar, currentUser);
  }
  return true;
};

/**
 * Standardize Department Codes (e.g. QA, QA/QC, QAQC -> QA/QC)
 */
export const normalizeDeptCode = (d) => {
  if (!d) return '';
  const val = typeof d === 'object' ? (d.id || d.code || d.dept || d.department || d.dept_code) : d;
  if (typeof val !== 'string') return '';
  const clean = val.trim().toUpperCase();
  if (clean === 'QA' || clean === 'QA/QC' || clean === 'QAQC' || clean === 'QC') {
    return 'QA/QC';
  }
  return clean;
};

export const deptMatches = (d1, d2) => {
  const s1 = normalizeDeptCode(d1);
  const s2 = normalizeDeptCode(d2);
  if (!s1 || !s2) return false;
  return s1 === s2;
};

/**
 * Check if the user is authorized to create/revise documents for the given department.
 * Supports DCC/QMR/EXEC/MGMT wildcards and multi-department scoping (affiliated_departments).
 */
export const isUserAuthorizedForDocDept = (docDeptRaw, currentUser) => {
  if (!currentUser) return false;

  const cleanUserDept = normalizeDeptCode(currentUser.department);
  const cleanUserPrimaryDept = normalizeDeptCode(currentUser.primary_department);

  // Wildcard roles: DCC Admin, QMR, Executive / Management, DC
  const isWildcard = 
    Boolean(currentUser.isDcc) || 
    Boolean(currentUser.isQmr) || 
    Boolean(currentUser.isSuperAdmin) ||
    currentUser.role === 'DCC_ADMIN' || 
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'QMR' ||
    currentUser.role === 'EXEC' ||
    currentUser.role === 'MGMT' ||
    ['DC', 'DCC', 'QMR', 'EXEC', 'MGMT'].includes(cleanUserDept) ||
    ['DC', 'DCC', 'QMR', 'EXEC', 'MGMT'].includes(cleanUserPrimaryDept);

  if (isWildcard) return true;

  const docDept = normalizeDeptCode(docDeptRaw);
  if (!docDept) return false;

  const userDepts = [
    currentUser.department,
    currentUser.dept,
    currentUser.primary_department,
    currentUser.dept_code,
    ...(Array.isArray(currentUser.departments) ? currentUser.departments : []),
    ...(Array.isArray(currentUser.secondaryDepartments) ? currentUser.secondaryDepartments : []),
    ...(Array.isArray(currentUser.affiliated_departments) ? currentUser.affiliated_departments : []),
    ...(Array.isArray(currentUser.depts) ? currentUser.depts : [])
  ].map(normalizeDeptCode).filter(Boolean);

  return userDepts.includes(docDept);
};

export const IN_FLIGHT_DAR_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_REVIEW',
  'UNDER_REVIEW',
  'PENDING_APPROVE',
  'PENDING_APPROVAL',
  'UNDER_APPROVAL',
  'IN_PROGRESS'
];

export const TERMINAL_DAR_STATUSES = [
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'OBSOLETE'
];

/**
 * Checks if a document has any concurrent DAR currently in-flight.
 * Completed, rejected, or cancelled DARs must NEVER lock the document.
 */
export const isDocumentLockedByInFlightDar = (doc, dars = [], currentDraftId = null) => {
  if (!doc) return false;
  
  return (dars || []).some(dar => {
    if (!dar) return false;
    // Exclude the draft currently being edited
    if (currentDraftId && (String(dar.id) === String(currentDraftId) || String(dar.dar_no) === String(currentDraftId) || String(dar.darNo) === String(currentDraftId))) {
      return false;
    }

    const isDocMatch = 
      (dar.docId && String(dar.docId) === String(doc.id)) ||
      (dar.docIdRef && String(dar.docIdRef) === String(doc.id)) ||
      (dar.targetDocumentId && String(dar.targetDocumentId) === String(doc.id)) ||
      (dar.document_code && (dar.document_code === doc.code || dar.document_code === doc.title || dar.document_code === doc.document_code)) ||
      (dar.doc_code && (dar.doc_code === doc.code || dar.doc_code === doc.title || dar.doc_code === doc.document_code)) ||
      (dar.docCode && (dar.docCode === doc.code || dar.docCode === doc.title || dar.docCode === doc.document_code)) ||
      (dar.docTitle && (dar.docTitle === doc.code || dar.docTitle === doc.title || dar.docTitle === doc.name));

    if (!isDocMatch) return false;

    const darStatus = String(dar.status || '').trim().toUpperCase();
    
    // Terminal statuses never lock
    if (TERMINAL_DAR_STATUSES.includes(darStatus)) return false;

    // Must be in-flight
    return IN_FLIGHT_DAR_STATUSES.includes(darStatus) || Boolean(dar.isDraft);
  });
};

/**
 * Predicate to determine if a document is eligible for revision in DarRevisionForm.
 */
export const isDocumentEligibleForRevision = (doc, currentUser, dars = [], currentDraftId = null) => {
  if (!doc) return false;

  // 1. Status must be ACTIVE or EFFECTIVE (case-insensitive)
  const status = String(doc.status || (doc.is_active ? 'ACTIVE' : '')).trim().toUpperCase();
  if (status !== 'EFFECTIVE' && status !== 'ACTIVE') return false;
  if (doc.is_obsolete || doc.is_superseded || status === 'OBSOLETE' || status === 'SUPERSEDED') return false;

  // 2. Department authorization (Canonical scoping with normalizeDeptCode & wildcards)
  const docDept = doc.department || doc.dept || doc.owner_dept || doc.ownerDepartmentId;
  if (!isUserAuthorizedForDocDept(docDept, currentUser)) return false;

  // 3. In-flight DAR check: No concurrent in-flight DARs
  if (isDocumentLockedByInFlightDar(doc, dars, currentDraftId)) return false;

  return true;
};


