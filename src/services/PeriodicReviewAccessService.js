export const resolveReviewOwnerDepartmentId = (review, schedule, document) => {
  if (review && review.ownerDepartmentId) return review.ownerDepartmentId;
  if (schedule && schedule.ownerDepartmentId) return schedule.ownerDepartmentId;
  if (document && document.ownerDepartmentId) return document.ownerDepartmentId;
  if (document && document.department) return document.department; // Legacy fallback
  return null;
};

// Fallback logic for current mock model where users just have `depts` array and global `level`
export const getUserDepartmentMembership = (user, ownerDepartmentId) => {
  if (!user) return null;

  // 1. Check departmentMemberships array if it exists (Multi-department position authority)
  if (user.departmentMemberships && Array.isArray(user.departmentMemberships)) {
    const membership = user.departmentMemberships.find(m => m.departmentId === ownerDepartmentId);
    if (membership && membership.isActive) {
      return membership;
    }
    // If we have departmentMemberships but no match, do NOT fallback to legacy depts array 
    // for this department, because the new model is the source of truth if present.
    // Wait, let's be safe and fallback if not found? The requirement says "When departmentMemberships exist... Use the positionLevel of the matching Owner Department only."
    if (user.departmentMemberships.length > 0) {
        return null;
    }
  }

  // 2. Compatibility fallback for current mock model
  if (user.depts && user.depts.includes(ownerDepartmentId)) {
    return {
      departmentId: ownerDepartmentId,
      positionLevel: user.level || 0,
      isActive: true
    };
  }
  
  return null;
};

export const isMemberOfOwnerDepartment = (user, ownerDepartmentId) => {
  const membership = getUserDepartmentMembership(user, ownerDepartmentId);
  return !!(membership && membership.isActive);
};

export const getPositionLevelForDepartment = (user, ownerDepartmentId) => {
  const membership = getUserDepartmentMembership(user, ownerDepartmentId);
  return membership ? membership.positionLevel : 0;
};

export const canViewAllPeriodicReviews = (user) => {
  if (!user) return false;
  return user.isDcc === true || user.role === 'DCC_ADMIN';
};

export const canViewPeriodicReview = (user, review, document) => {
  if (canViewAllPeriodicReviews(user)) return true;
  
  const ownerDept = resolveReviewOwnerDepartmentId(review, review, document);
  return isMemberOfOwnerDepartment(user, ownerDept);
};

export const canPerformPeriodicReview = (user, review, document) => {
  if (!user) return false;

  // 1. Is Document Owner
  const ownerUserId = review?.ownerUserId || document?.ownerId;
  if (user.id === ownerUserId) return true;

  // 2. Is Permitted Backup in that specific Owner Department (Level >= 4 for Supervisor/Manager)
  const ownerDept = resolveReviewOwnerDepartmentId(review, review, document);
  if (isMemberOfOwnerDepartment(user, ownerDept)) {
    const posLevel = getPositionLevelForDepartment(user, ownerDept);
    if (posLevel >= 4) return true;
  }

  // 3. Documented Override
  // Currently no new overrides invented in this phase.
  
  return false;
};

export const canExportPeriodicReviews = (user) => {
  return canViewAllPeriodicReviews(user) || (user.depts && user.depts.length > 0);
};

export const normalizePeriodicReviewRecord = (record, currentDate = new Date()) => {
  const normalized = { ...record };
  normalized.legacyStatus = record.status;
  
  // Normalize Status and Outcome from legacy blends
  const oldStatus = record.status || '';
  const oldOutcome = record.outcome || '';
  
  // Outcome Mapping
  switch (oldOutcome) {
    case 'INTERNAL_NO_CHANGE':
    case 'EXTERNAL_CONFIRM_CURRENT':
      normalized.outcome = 'NO_CHANGE'; break;
    case 'INTERNAL_REVISION_REQUIRED':
    case 'EXTERNAL_NEW_VERSION':
      normalized.outcome = 'REVISION_REQUIRED'; break;
    case 'INTERNAL_OBSOLETE_REQUIRED':
    case 'EXTERNAL_NO_LONGER_APPLICABLE':
      normalized.outcome = 'OBSOLETE_REQUIRED'; break;
    default:
      normalized.outcome = oldOutcome || null;
  }

  // Status Mapping based on explicit COMPLETED legacy statuses
  if (oldStatus.startsWith('COMPLETED') || oldStatus === 'COMPLETED') {
    normalized.status = 'COMPLETED';
    
    // Some legacy statuses contained the outcome implicitly
    if (oldStatus === 'COMPLETED_NO_CHANGE' || oldStatus === 'COMPLETED_EXTERNAL_CONFIRMED') {
      normalized.outcome = 'NO_CHANGE';
    } else if (oldStatus === 'COMPLETED_WITH_REVISION') {
      normalized.outcome = 'REVISION_REQUIRED';
    } else if (oldStatus === 'COMPLETED_WITH_OBSOLETE' || oldStatus === 'COMPLETED_NO_LONGER_APPLICABLE') {
      normalized.outcome = 'OBSOLETE_REQUIRED';
    }
  } else if (oldStatus === 'ACTION_IN_PROGRESS' || oldStatus === 'IN_PROGRESS') {
    normalized.status = 'IN_PROGRESS';
  } else {
    // Dynamic Date Calculation for UPCOMING, DUE_SOON, DUE, OVERDUE
    if (record.nextReviewDate) {
      const today = new Date(currentDate);
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(record.nextReviewDate);
      dueDate.setHours(0, 0, 0, 0);
      
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        normalized.status = 'OVERDUE';
      } else if (diffDays === 0) {
        normalized.status = 'DUE';
      } else if (diffDays <= 30) {
        normalized.status = 'DUE_SOON';
      } else {
        normalized.status = 'UPCOMING';
      }
    } else {
      normalized.status = 'UPCOMING';
    }
  }
  
  return normalized;
};

export const getVisiblePeriodicReviews = (user, schedules, documents) => {
  if (!schedules) return [];
  return schedules.filter(schedule => {
    const doc = documents?.find(d => d.id === schedule.documentId || d.id === schedule.externalDocumentId);
    return canViewPeriodicReview(user, schedule, doc);
  }).map(schedule => normalizePeriodicReviewRecord(schedule));
};

export const getPeriodicReviewForUser = (reviewId, user, periodicReviewSchedules, documents) => {
  const schedule = periodicReviewSchedules?.find(s => s.id === reviewId);
  if (!schedule) return { status: 'NOT_FOUND' };
  
  const doc = documents?.find(d => d.id === schedule.documentId || d.id === schedule.externalDocumentId);
  
  if (!canViewPeriodicReview(user, schedule, doc)) {
    return {
      status: 'ACCESS_DENIED',
      message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลการทบทวนเอกสารนี้ ข้อมูลนี้จำกัดเฉพาะแผนกเจ้าของเอกสารและ QAQC'
    };
  }
  
  return {
    status: 'SUCCESS',
    data: normalizePeriodicReviewRecord(schedule),
    document: doc
  };
};
