/**
 * Resolves the appropriate Reviewer based on the Requester's level.
 * Rule: candidate.level > requester.level (Nearest Higher)
 */
export const resolveReviewer = (requesterId, department, masterUsers, reviewUsers) => {
  console.log(`[Routing] Resolving Reviewer for Requester: ${requesterId} in Dept: ${department}`);
  
  const requester = masterUsers.find(u => u.id === requesterId);
  if (!requester) {
    console.error(`[Routing] Requester ${requesterId} not found in master data.`);
    return null;
  }

  const reqLevel = requester.level || 0;

  // Rule 1 & 2: Pull from review_master_data_user, same department, level > requester
  // Note: reviewUsers only has {id, name, dept}, so we must cross-reference masterUsers for `level`.
  let candidates = reviewUsers.filter(u => {
    const hasDeptAccess = !u.depts || u.depts.length === 0 || u.depts.includes(department);
    if (!hasDeptAccess) return false;
    if (u.id === requesterId) return false; // SoD
    const m = masterUsers.find(mu => mu.id === u.id);
    if (!m) return false;
    if (m.isDcc || m.role === 'DCC_ADMIN') return false; // Explicitly exclude DCC
    return (m.level || 0) > reqLevel;
  });
  
  if (candidates.length > 0) {
    // Sort ascending to find the Nearest Higher
    candidates.sort((a, b) => {
       const lA = masterUsers.find(mu => mu.id === a.id)?.level || 0;
       const lB = masterUsers.find(mu => mu.id === b.id)?.level || 0;
       return lA - lB;
    });
    const selected = candidates[0];
    const sLevel = masterUsers.find(mu => mu.id === selected.id)?.level || 0;
    console.log(`[Routing] Found Nearest Higher Reviewer: ${selected.id} (${selected.name}) - Level ${sLevel} (Requester Level was ${reqLevel})`);
    return { id: selected.id, level: sLevel, dept: department };
  }

  console.log(`[Routing] No direct higher level found for Requester Level ${reqLevel}. Skipping Review step...`);
  return null;
};

/**
 * Resolves the appropriate Approver based on the Reviewer's level (and excluding Requester).
 * Rule: candidate.level > reviewer.level (Nearest Higher)
 */
export const resolveApprover = (requesterId, reviewerId, department, masterUsers, approveUsers) => {
  console.log(`[Routing] Resolving Approver for Reviewer: ${reviewerId} (Requester: ${requesterId}) in Dept: ${department}`);
  
  const reviewer = masterUsers.find(u => u.id === reviewerId);
  const revLevel = reviewer ? (reviewer.level || 0) : 0;

  // Rule 1 & 3: Pull from approve_master_data_user, level > reviewer, enforce SoD
  let candidates = approveUsers.filter(u => {
    const hasDeptAccess = !u.depts || u.depts.length === 0 || u.depts.includes(department);
    if (!hasDeptAccess) return false;
    if (u.id === requesterId) return false; // SoD
    if (u.id === reviewerId) return false; // SoD
    const m = masterUsers.find(mu => mu.id === u.id);
    if (!m) return false;
    if (m.isDcc || m.role === 'DCC_ADMIN') return false; // Explicitly exclude DCC
    return (m.level || 0) > revLevel;
  });
  
  if (candidates.length > 0) {
    candidates.sort((a, b) => {
       const lA = masterUsers.find(mu => mu.id === a.id)?.level || 0;
       const lB = masterUsers.find(mu => mu.id === b.id)?.level || 0;
       return lA - lB;
    });
    const selected = candidates[0];
    const sLevel = masterUsers.find(mu => mu.id === selected.id)?.level || 0;
    console.log(`[Routing] Found Nearest Higher Approver: ${selected.id} (${selected.name}) - Level ${sLevel} (Reviewer Level was ${revLevel})`);
    return { id: selected.id, level: sLevel, dept: department };
  }

  console.log(`[Routing] No direct higher level found for Reviewer Level ${revLevel}. Skipping Approve step...`);
  return null;
};
