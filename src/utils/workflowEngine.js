/**
 * workflowEngine.js
 *
 * Rule-Based Workflow Generator & Dynamic Signatory Route Engine
 * Enforces dynamic, department-aware routing without hardcoded fallback names.
 */

export const generateDynamicWorkflow = (requesterUser, docDepartment, allUsers = []) => {
  if (!requesterUser || !docDepartment) return [];

  // Helper ตรวจสอบแผนก (ครอบคลุมทั้งหลักและรอง)
  const isMatchDept = (u, dept) => {
    if (!u || !dept) return false;
    const targetDept = String(dept).toUpperCase().trim();
    const uDept = String(u.department || u.dept || u.primaryDepartment || u.primary_department || '').toUpperCase().trim();
    if (uDept === targetDept) return true;
    if (Array.isArray(u.secondaryDepartments) && u.secondaryDepartments.some(d => String(d).toUpperCase().trim() === targetDept)) return true;
    if (Array.isArray(u.departments) && u.departments.some(d => String(d).toUpperCase().trim() === targetDept)) return true;
    if (Array.isArray(u.depts) && u.depts.some(d => String(d).toUpperCase().trim() === targetDept)) return true;
    if (Array.isArray(u.affiliated_departments) && u.affiliated_departments.some(d => String(d).toUpperCase().trim() === targetDept)) return true;
    return false;
  };

  const isActive = (u) => {
    if (!u) return false;
    if (!u.status) return true;
    return String(u.status).toUpperCase() === 'ACTIVE';
  };

  // 1. ผู้จัดทำ (Step 1 - Requester)
  const step1 = {
    step: 1,
    role: 'REQUESTER',
    userId: requesterUser.id || requesterUser.userId || requesterUser.empId,
    userName: requesterUser.name || requesterUser.fullName || '',
    position: requesterUser.position || requesterUser.role || '',
    status: 'COMPLETED',
    timestamp: new Date().toISOString()
  };

  // 2. ค้นหาผู้ทบทวน (Step 2 - Level 5 ในแผนกเดียวกัน)
  let reviewerUser = allUsers.find(u => 
    isActive(u) && 
    Number(u.level || u.approval_level) === 5 && 
    isMatchDept(u, docDepartment)
  );

  // Fallback: หากแผนกนั้นไม่มี L5 ให้ใช้ผู้บริหารฝ่ายคุณภาพ/ตัวแทนฝ่ายบริหาร (MGMT / L6)
  if (!reviewerUser) {
    reviewerUser = allUsers.find(u => 
      isActive(u) && 
      (u.department === 'MGMT' || u.dept === 'MGMT' || u.role === 'QMR' || u.isQmr || Number(u.level || u.approval_level) === 6)
    );
  }

  const step2 = {
    step: 2,
    role: 'REVIEWER',
    userId: reviewerUser?.id || reviewerUser?.userId || null,
    userName: reviewerUser?.name || reviewerUser?.fullName || '',
    position: reviewerUser?.position || reviewerUser?.role || '',
    status: 'PENDING',
    timestamp: null
  };

  // 3. ค้นหาผู้อนุมัติ (Step 3 - Level 6 หรือ Level 8)
  const reviewerUserId = reviewerUser?.id || reviewerUser?.userId;
  let approverUser = allUsers.find(u => 
    isActive(u) && 
    Number(u.level || u.approval_level) >= 6 && 
    (u.department === 'MGMT' || u.department === 'EXEC' || u.dept === 'MGMT' || u.dept === 'EXEC') &&
    (u.id || u.userId) !== reviewerUserId
  );

  // Fallback: หากไม่พบใน MGMT/EXEC ให้ค้นหาผู้มี level >= 6 คนอื่นที่ไม่ใช่ reviewer
  if (!approverUser) {
    approverUser = allUsers.find(u => 
      isActive(u) && 
      Number(u.level || u.approval_level) >= 6 && 
      (u.id || u.userId) !== reviewerUserId
    );
  }

  const step3 = {
    step: 3,
    role: 'APPROVER',
    userId: approverUser?.id || approverUser?.userId || null,
    userName: approverUser?.name || approverUser?.fullName || '',
    position: approverUser?.position || approverUser?.role || '',
    status: 'PENDING',
    timestamp: null
  };

  return [step1, step2, step3];
};
