/**
 * Role-Based Actionable Task Scoping and Filtering Engine
 * 
 * Ensures that operational tasks (Distribution, Recall, Register, Replacement)
 * are strictly restricted to DCC Admin and DC staff.
 * Prevents task leaks to Executive, QMR, or other department members.
 * Enforces that personal task inboxes and sidebar badge counts only reflect
 * actionable tasks assigned to or waiting on the current user.
 */

export const isDccAdmin = (user) => {
  if (!user) return false;
  return Boolean(
    user.role === 'DCC_ADMIN' ||
    user.isDccAdmin === true ||
    (Array.isArray(user.permissions) && user.permissions.includes('DCC_ADMIN')) ||
    user.role === 'SUPER_ADMIN' ||
    (user.isDcc === true && !['GENERAL_USER', 'DEPT_ADMIN', 'DCC_STAFF', 'APPROVER', 'REVIEWER', 'MGMT'].includes(user.role))
  );
};

export const isDccExclusiveTask = (task) => {
  if (!task) return false;
  const normType = (task.type || task.taskType || task.task_type || task.category || '').toUpperCase();
  const title = String(task.title || '');

  const isDist = 
    normType === 'DISTRIBUTION' ||
    normType === 'DCC_DISTRIBUTE' ||
    normType === 'DCC_ISSUE' ||
    normType === 'DCC_ISSUE_CONTROLLED_COPIES' ||
    normType === 'DCC_REPLACEMENT' ||
    task.taskType === 'DISTRIBUTION' ||
    task.taskType === 'DCC_ISSUE_CONTROLLED_COPIES' ||
    title.includes('แจกจ่าย') ||
    title.includes('จัดพิมพ์และส่งมอบ') ||
    title.includes('ขอออกสำเนาควบคุมเพิ่มเติม') ||
    title.includes('ออกสำเนาควบคุมทดแทน');

  const isRecall = 
    normType === 'RECALL' ||
    normType === 'DCC_RECALL' ||
    normType === 'DCC_RECALL_WITH_CHECKLIST' ||
    normType === 'RECALL_HARDCOPY' ||
    normType === 'OBSOLETE_RECALL' ||
    task.taskType === 'RECALL' ||
    task.taskType === 'DCC_RECALL_WITH_CHECKLIST' ||
    title.includes('เรียกคืน') ||
    title.includes('Recall');

  return isDist || isRecall;
};

export const isDccUser = (user) => {
  if (!user) return false;
  return Boolean(
    user.isDcc || 
    user.role === 'DCC_ADMIN' || 
    user.role === 'DCC_STAFF' || 
    user.role === 'SUPER_ADMIN' || 
    user.department === 'DC' || 
    user.dept === 'DC' ||
    user.primary_department === 'DC' ||
    (user.affiliated_departments && (user.affiliated_departments.includes('DC') || user.affiliated_departments.includes('DCC'))) ||
    (user.depts && (user.depts.includes('DC') || user.depts.includes('DCC'))) ||
    user.id === 'EMP-001' || 
    user.id === 'U001' || 
    user.id === 'u5'
  );
};

export const isDccOperationalTask = (task) => {
  if (!task) return false;
  const normType = (task.type || task.taskType || task.task_type || task.category || '').toUpperCase();
  return (
    isDccExclusiveTask(task) ||
    [
      'DCC_CHECK', 'DCC_REGISTER', 'DCC_DISTRIBUTE', 'DCC_RECALL',
      'DISTRIBUTION', 'RECALL', 'DCC_ACTION', 'DCC_ISSUE',
      'DCC_RECALL_WITH_CHECKLIST', 'RECALL_HARDCOPY',
      'CC_REPLACEMENT_APPROVAL', 'DCC_REPLACEMENT', 'DCC_ISSUE_CONTROLLED_COPIES'
    ].includes(normType) ||
    normType.startsWith('DCC_') ||
    task.assignedToRole === 'DCC_ADMIN' ||
    task.assignedToRole === 'DCC_STAFF' ||
    task.target_role === 'DCC' ||
    task.targetRole === 'DCC_ADMIN'
  );
};

/**
 * Compares two department identifiers with normalization and alias equivalence (QA <-> QA/QC <-> QC)
 */
export const isSameDepartment = (deptA, deptB) => {
  if (!deptA || !deptB) return false;
  let a = String(deptA).trim().toUpperCase();
  let b = String(deptB).trim().toUpperCase();
  if (a === 'DCC') a = 'DC';
  if (b === 'DCC') b = 'DC';
  if (a === b) return true;
  if ((a === 'QA' || a === 'QA/QC' || a === 'QC') && (b === 'QA' || b === 'QA/QC' || b === 'QC')) return true;
  return false;
};

/**
 * Checks if a user belongs to a target department (primary, department, depts, or affiliated_departments)
 */
export const userMatchesDepartment = (user, dept) => {
  if (!user || !dept) return false;
  const userDepts = [
    user.department,
    user.dept,
    user.primary_department,
    ...(user.depts || []),
    ...(user.affiliated_departments || [])
  ].filter(Boolean);
  return userDepts.some(d => isSameDepartment(d, dept));
};

/**
 * Extracts normalized numeric level from user (supports numbers, 'L6', 'Level 6', approval_level, etc.)
 */
export const getUserLevelNumber = (user) => {
  if (!user) return 1;
  const raw = user.level ?? user.approval_level ?? user.approvalLevel ?? '';
  const parsed = parseInt(String(raw).replace(/\D/g, ''), 10);
  return isNaN(parsed) ? 1 : parsed;
};

export const isLevel6Plus = (user) => {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  const pos = String(user.position || '').toUpperCase();
  if (role === 'EXECUTIVE' || role === 'MANAGING_DIRECTOR' || role === 'BOARD' || user.isExecutive) {
    return true;
  }
  if (pos.includes('MANAGING DIRECTOR') || pos.includes('GENERAL MANAGER') || pos.includes('EXECUTIVE') || pos.includes('DIRECTOR') || pos.includes('QMR/BOARD') || pos.includes('BOARD')) {
    return true;
  }
  return getUserLevelNumber(user) >= 6;
};

export const isLevel1To5 = (user) => {
  if (!user) return false;
  if (isLevel6Plus(user)) return false;
  const lvl = getUserLevelNumber(user);
  return lvl >= 1 && lvl < 6;
};

export const isReceiptTask = (task) => {
  if (!task) return false;
  const normType = (task.type || task.taskType || task.task_type || task.category || '').toUpperCase();
  const title = String(task.title || '');
  return (
    normType === 'RECEIPT' || 
    normType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || 
    normType === 'CONFIRM_RECEIPT' ||
    task.category === 'RECEIPT' ||
    Boolean(task.id?.includes('task-receipt-')) ||
    title.includes('ตรวจรับ') ||
    title.includes('ตรวจรับเล่ม') ||
    title.includes('ตรวจรับสำเนา') ||
    title.includes('ตรวจรับเอกสาร')
  );
};

export const isActionableTask = (task, currentUser) => {
  if (!task || !currentUser) return false;

  // 1. Reactive completion filter: immediately drop completed or resolved tasks
  if (task.status === 'COMPLETED' || task.status === 'RESOLVED' || task.is_completed === true) {
    return false;
  }

  const dccAdmin = isDccAdmin(currentUser);

  // 2. Strict DCC Admin Exclusive Task Gatekeeper (ISO 9001 Section 7.5.3):
  // Distribution (printing, binding, dispatch) and Recall (recall, destruction) tasks
  // are EXCLUSIVELY actionable by DCC Admin.
  // Non-DCC Admin users (QMR, GM, Executives, Dept Admins, general users)
  // MUST NEVER see Distribution or Recall tasks under ANY circumstances.
  if (isDccExclusiveTask(task)) {
    return dccAdmin;
  }

  const isDcc = isDccUser(currentUser);
  const isDccOp = isDccOperationalTask(task);

  // 3. Other DCC Operational Tasks:
  // Strictly scoped to DCC Admin or DC department staff only.
  // Executives, QMR, and other department users MUST NEVER see these in their inbox or badge counter.
  if (isDccOp) {
    return isDcc;
  }

  const userDepts = currentUser?.affiliated_departments || 
    currentUser?.depts || 
    (currentUser?.primary_department ? [currentUser.primary_department] : (currentUser?.department ? [currentUser.department] : []));
  const userApprovalLevel = Number(currentUser?.approval_level || currentUser?.level || 1);
  const normType = (task.type || task.taskType || task.task_type || task.category || '').toUpperCase();

  // 4. Department-Pooled Receipt Task (Physical controlled copy confirmation at department stations):
  // Strictly scoped to destination department. Never leak to DCC or other departments.
  // 🛡️ Phase 2: Level 1–5 Assignment & Visibility Guard (Exempt Level 6+)
  // Executive users (Level 6+: GM, Plant Manager, QMR, or level >= 6 / 'L6'):
  // Cut all RECEIPT tasks from task inbox and badge counters even if they belong to/oversee that department.
  if (isReceiptTask(task)) {
    if (isLevel6Plus(currentUser)) {
      return false;
    }

    const taskDept = task.target_department || task.targetDepartment || task.destinationDept || task.destination_dept || task.recipientDepartment || task.recipient_department || task.assignedToDept || task.currentHandlerDepartment || task.department || task.holder_dept || '';
    const isDeptMatch = userMatchesDepartment(currentUser, taskDept) || userDepts.some(uDept => isSameDepartment(uDept, taskDept));
    const taskAssigneeId = task.assigneeId || task.assignee_id || task.assignedToUserId || task.target_user_id;
    const isAssigneeMatch = Boolean(taskAssigneeId && (taskAssigneeId === currentUser?.id || task.assigneeName === currentUser?.name));
    return isDeptMatch || isAssigneeMatch;
  }

  // 🛡️ Separation of Duties: Requester must NEVER review or approve their own submission
  const isRequester = Boolean(
    (task.requesterId && (task.requesterId === currentUser?.id || task.requesterId === currentUser?.empId)) ||
    (task.requesterName && task.requesterName === currentUser?.name)
  );
  const isReviewOrApprove = [
    'REVIEW', 'DAR_REVIEW', 'EXT_REVIEW', 'EXTERNAL_REVIEW',
    'APPROVE', 'DAR_APPROVE', 'APPROVAL', 'EXT_APPROVAL', 'EXTERNAL_APPROVAL'
  ].includes(normType);

  if (isRequester && isReviewOrApprove) {
    return false;
  }

  // 5. Direct user assignment (for person-specific workflow tasks):
  // When a task specifies an Assignee ID for an individual user, it MUST ONLY be actionable by that specific user.
  const taskAssigneeId = task.assigneeId || task.assignee_id || task.assignedToUserId || task.target_user_id;
  if (taskAssigneeId) {
    return Boolean(
      taskAssigneeId === currentUser?.id || 
      taskAssigneeId === currentUser?.empId || 
      task.assigneeName === currentUser?.name
    );
  }

  // 6. Department Workflow Tasks (Review / Approve / Revise / Ack) without specific assignee (Pooled):
  // Must match department AND user's level must meet required approval level
  const isDeptReviewOrApprove = [
    'REVIEW', 'DAR_REVIEW', 'EXT_REVIEW', 'EXTERNAL_REVIEW', 
    'APPROVE', 'DAR_APPROVE', 'APPROVAL', 'EXT_APPROVAL', 'EXTERNAL_APPROVAL',
    'REVISE', 'EXTERNAL_REVISE', 'ACK', 'ACKNOWLEDGE'
  ].includes(normType);

  if (isDeptReviewOrApprove) {
    const taskDept = task.department || task.target_department || task.targetDepartment || task.destinationDept || task.assignedToDept || task.currentHandlerDepartment || task.holder_dept || '';
    const isDeptMatch = Boolean(taskDept && userDepts.some(uDept => isSameDepartment(uDept, taskDept)));
    const requiredLevel = Number(task.required_approval_level || task.requiredLevel || task.currentHandlerLevel || task.min_level || 1);
    const isLevelMatch = userApprovalLevel >= requiredLevel;

    return isDeptMatch && isLevelMatch;
  }

  // 7. Generic unassigned department pooled tasks:
  const taskDept = task.department || task.target_department || task.targetDepartment || task.destinationDept || task.assignedToDept || task.currentHandlerDepartment || task.holder_dept || '';
  if (!taskAssigneeId && taskDept && userDepts.some(uDept => isSameDepartment(uDept, taskDept))) {
    return true;
  }

  return false;
};

export default {
  isDccAdmin,
  isDccExclusiveTask,
  isDccUser,
  isDccOperationalTask,
  isSameDepartment,
  userMatchesDepartment,
  getUserLevelNumber,
  isLevel6Plus,
  isLevel1To5,
  isReceiptTask,
  isActionableTask
};

