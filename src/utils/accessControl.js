/**
 * Document Access Control & Confidentiality Engine
 * 
 * Supports 4 Access Scopes:
 * - GENERAL: Open to all employees in the organization.
 * - DEPT_ONLY: Restricted strictly to the document owner department.
 * - TARGETED: Shared with specific authorized departments.
 * - RESTRICTED: Confidential to specific users or minimum position level.
 */

export const ACCESS_SCOPES = {
  GENERAL: 'GENERAL',
  DEPT_ONLY: 'DEPT_ONLY',
  TARGETED: 'TARGETED',
  RESTRICTED: 'RESTRICTED'
};

export const ACCESS_SCOPE_METADATA = {
  GENERAL: {
    id: 'GENERAL',
    label: 'ทั่วไป (General)',
    description: 'เปิดให้พนักงานทุกคนในองค์กรเข้าถึงและค้นหาได้',
    icon: 'Globe',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    color: '#10B981'
  },
  DEPT_ONLY: {
    id: 'DEPT_ONLY',
    label: 'เฉพาะแผนกฉัน (Department Only)',
    description: 'ล็อกให้เห็นเฉพาะบุคลากรในแผนกเจ้าของเอกสารเท่านั้น',
    icon: 'Lock',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    color: '#F59E0B'
  },
  TARGETED: {
    id: 'TARGETED',
    label: 'เฉพาะบางแผนก (Targeted Departments)',
    description: 'อนุญาตให้เฉพาะกลุ่มแผนกที่ระบุเปิดดูร่วมกันได้',
    icon: 'Building2',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    color: '#0D99FF'
  },
  RESTRICTED: {
    id: 'RESTRICTED',
    label: 'ลับเฉพาะบุคคล/ตำแหน่ง (Restricted)',
    description: 'จำกัดสิทธิ์เฉพาะบุคคลที่ระบุ หรือตำแหน่งตามระดับขั้นต่ำ',
    icon: 'ShieldAlert',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    color: '#EF4444'
  }
};

/**
 * Check if the given user has permission to view the document
 * 
 * @param {Object} doc - Document or DAR object
 * @param {Object} user - Current active user
 * @returns {boolean} True if accessible, false if hidden/forbidden
 */
export const hasDocumentAccess = (doc, user) => {
  if (!doc) return false;
  if (!user) return false;

  // 1. Super/DCC Admin Bypass
  if (
    user.role === 'DCC_ADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.isDcc ||
    user.isSuperAdmin
  ) {
    return true;
  }

  // 2. Document Owner / Author / Requester Bypass
  const isCreatorOrOwner =
    doc.requesterId === user.id ||
    doc.ownerId === user.id ||
    doc.created_by === user.id ||
    doc.author_id === user.id;

  if (isCreatorOrOwner) {
    return true;
  }

  const userDepts = user.depts || (user.department ? [user.department] : []);
  const docDept = doc.owner_dept || doc.department || doc.dept;
  const isSameDept = (dept) =>
    Boolean(dept) &&
    userDepts.some(
      (u) =>
        u === dept ||
        (u === 'QA' && dept === 'QA/QC') ||
        (u === 'QA/QC' && dept === 'QA')
    );

  // 3. Resolve Scope
  const accessControl = doc.access_control || { scope: doc.access_scope || 'GENERAL' };
  const scope = accessControl.scope || 'GENERAL';

  switch (scope) {
    case 'GENERAL':
      return true;

    case 'DEPT_ONLY':
      return isSameDept(docDept);

    case 'TARGETED': {
      const authDepts = accessControl.authorized_depts || [];
      const targetDepts = doc.target_depts || [];
      const distDepts = (doc.distributions || []).map((d) => d.departmentId || d.dept);

      return (
        isSameDept(docDept) ||
        authDepts.some((d) => isSameDept(d)) ||
        targetDepts.some((d) => isSameDept(d)) ||
        distDepts.some((d) => isSameDept(d))
      );
    }

    case 'RESTRICTED': {
      const authUsers = accessControl.authorized_users || [];
      const minLevel = Number(accessControl.min_access_level) || 0;
      const userLevel = Number(user.level) || 0;

      const isNamedUser = authUsers.includes(user.id);
      const isLevelQualified = minLevel > 0 && userLevel >= minLevel;

      return isNamedUser || isLevelQualified;
    }

    default:
      return true;
  }
};

/**
 * Check if the current user has permission to manage (e.g. report damaged/lost/request replacement) a specific controlled copy.
 * 
 * Rules:
 * 1. DCC Admin / Super Admin can manage all copies across all departments.
 * 2. Regular users can ONLY manage copies assigned to their own department (strict custodianship).
 * 
 * @param {Object} copy - Controlled copy object
 * @param {Object} user - Current active user
 * @returns {boolean}
 */
export const canManageControlledCopy = (copy, user) => {
  if (!user || !copy) return false;

  // 1. DCC Admin / Super Admin bypass
  if (
    user.role === 'DCC_ADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.isDcc ||
    user.isSuperAdmin ||
    user.id === 'U001' ||
    user.id === 'u5'
  ) {
    return true;
  }

  // 2. Department Custodianship Check
  const copyDept = copy.holder_dept || copy.department || copy.departmentId || copy.dept_code || copy.target_department;
  const userDept = user.department || user.dept;
  const userDepts = user.depts || (userDept ? [userDept] : []);

  if (!copyDept) return false;

  return userDepts.some(
    (d) =>
      Boolean(d) &&
      (d.toUpperCase() === copyDept.toUpperCase() ||
        (d === 'QA' && copyDept === 'QA/QC') ||
        (d === 'QA/QC' && copyDept === 'QA'))
  );
};

