import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resolveReviewer, resolveApprover } from '../utils/workflowResolver';
import { generateSchedules, generateTasksForSchedules, calculateNextReviewDate } from '../services/PeriodicReviewService';
import { 
  createOrGetLinkedDarDraft, 
  validateLinkedDarSource, 
  resolveLockedSourceDocument, 
  getLinkedActionStatus, 
  syncRevisionEffective, 
  syncObsoleteCompleted 
} from '../services/PeriodicReviewDarLinkService';
import { 
  STANDARD_STATIONS, 
  calculateCopyAllocations, 
  cleanLocationName,
  formatDocumentRunningNumber, 
  calculateNextDocumentSequence,
  calculateNextExternalDocSequence
} from '../services/MasterDataService';
import { getMockQaSeedData } from '../data/mockQaWorkflowSeed';
import { hasDocumentAccess, canUserAccessDocument } from '../utils/accessControl';
import { calculateTaskDueDate } from '../utils/slaCalculator';
import { generateInternalDarNumber } from '../utils/darNumberGenerator';
import { 
  isSameDepartment, 
  userMatchesDepartment, 
  isDccAdmin, 
  isDccExclusiveTask, 
  isDccOperationalTask,
  getUserLevelNumber,
  isLevel6Plus,
  isLevel1To5,
  isReceiptTask,
  isActionableTask
} from '../utils/taskFilter';

export const getUserDepartments = (user) => {
  if (!user) return [];
  const depts = [];
  if (user.department) depts.push(user.department);
  if (user.primary_department) depts.push(user.primary_department);
  if (user.dept) depts.push(user.dept);
  if (user.dept_code) depts.push(user.dept_code);
  if (Array.isArray(user.departments)) depts.push(...user.departments);
  if (Array.isArray(user.secondaryDepartments)) depts.push(...user.secondaryDepartments);
  if (Array.isArray(user.depts)) depts.push(...user.depts);
  if (Array.isArray(user.affiliated_departments)) depts.push(...user.affiliated_departments);
  return [...new Set(depts.filter(Boolean))];
};

export { 
  canUserAccessDocument, 
  hasDocumentAccess, 
  calculateTaskDueDate, 
  generateInternalDarNumber, 
  isSameDepartment, 
  userMatchesDepartment, 
  isDccAdmin, 
  isDccExclusiveTask, 
  isDccOperationalTask,
  getUserLevelNumber,
  isLevel6Plus,
  isLevel1To5,
  isReceiptTask,
  isActionableTask
};

export const resolveDccAdminUserId = (masterUsers) => {
  const admin = (masterUsers || []).find(u => isDccAdmin(u));
  return admin?.id || 'EMP-001';
};

/**
 * Helper to determine if a notification is visible to the given user.
 * Supports:
 * - Direct target: n.userId === user.id || n.user_id === user.id || n.userId === user.empId
 * - Target array: n.targetUserIds?.includes(user.id || user.empId)
 * - Department: n.targetDepartment or n.department matching any of user's depts
 * - Global broadcast: n.isGlobal || n.global || n.scope === 'GLOBAL'
 * - Default broadcast: no specific target user, department or scope specified
 */
export const isNotificationVisibleToUser = (notification, user) => {
  if (!notification) return false;
  if (!user) return true;

  // 1. Global / Organization-wide announcement
  if (notification.isGlobal || notification.global || notification.scope === 'GLOBAL') {
    return true;
  }

  // 2. Direct user targeting
  const targetId = notification.userId || notification.user_id;
  const userEmpId = user.empId || user.id;
  if (targetId && (targetId === user.id || targetId === userEmpId)) {
    return true;
  }

  // 3. Multi-user targeting
  if (Array.isArray(notification.targetUserIds) && notification.targetUserIds.length > 0) {
    if (notification.targetUserIds.includes(user.id) || (userEmpId && notification.targetUserIds.includes(userEmpId))) {
      return true;
    }
  }

  // 4. Department-level targeting
  const targetDept = notification.targetDepartment || notification.recipientDept || (notification.userId ? null : notification.department);
  if (targetDept) {
    const userDepts = [
      user.department,
      user.dept,
      user.primary_department,
      ...(Array.isArray(user.departments) ? user.departments : []),
      ...(Array.isArray(user.affiliated_departments) ? user.affiliated_departments : []),
      ...(Array.isArray(user.depts) ? user.depts : []),
      ...(Array.isArray(user.secondaryDepartments) ? user.secondaryDepartments : [])
    ].filter(Boolean);

    if (userDepts.some(d => String(d).trim().toLowerCase() === String(targetDept).trim().toLowerCase())) {
      return true;
    }
  }

  // 5. If no target specified at all (neither userId, user_id, targetUserIds, nor targetDept) -> broadcast
  if (!targetId && (!Array.isArray(notification.targetUserIds) || notification.targetUserIds.length === 0) && !targetDept) {
    return true;
  }

  return false;
};

/**
 * Helper to determine if a notification has been read by the given user.
 * Supports:
 * - Read tracking array: n.readBy?.includes(userId)
 * - Legacy / single-user flags: (n.userId === userId || n.user_id === userId) && (n.isRead || n.read)
 */
export const isNotificationReadByUser = (notification, userId) => {
  if (!notification) return true;
  if (!userId) return Boolean(notification.isRead || notification.read);

  // 1. Check per-user read tracking array
  if (Array.isArray(notification.readBy) && notification.readBy.includes(userId)) {
    return true;
  }

  // 2. If notification is specifically for this user and flagged as read
  const targetId = notification.userId || notification.user_id;
  if (targetId && targetId === userId && (notification.isRead || notification.read)) {
    return true;
  }

  // 3. If single-user notification without readBy array, check isRead / read
  if (!notification.isGlobal && !notification.targetDepartment && (!Array.isArray(notification.targetUserIds) || notification.targetUserIds.length <= 1) && (notification.isRead || notification.read)) {
    return true;
  }

  return false;
};

// 1. Master Data Users (Roles: DCC_ADMIN, DEPT_ADMIN, GENERAL_USER)
export const MASTER_DATA_USER = [
  { 
    id: 'EMP-001', 
    empId: 'EMP-001', 
    name: 'ธนาวุฒิ สมควรกิจดำรง', 
    fullName: 'ธนาวุฒิ สมควรกิจดำรง', 
    email: 'thanawut.s@company.com', 
    position: 'Technology Project Leader / DCC Supervisor', 
    level: 4, 
    approval_level: 4, 
    role: 'DCC_ADMIN', 
    isDcc: true, 
    isQmr: false, 
    depts: ['DC'], 
    department: 'DC', 
    dept: 'DC', 
    primary_department: 'DC', 
    affiliated_departments: ['DC'], 
    status: 'Active', 
    pin: '123456', 
    failedPinAttempts: 0, 
    isLocked: false, 
    lastPinChangedAt: '2026-01-01T00:00:00.000Z', 
    signatureType: 'TYPOGRAPHIC', 
    signatureStyle: 'FORMAL_SERIF', 
    signatureInitials: 'TNW-DC', 
    hasRegisteredSignature: true, 
    certificateSerial: 'CERT-2026-DC001', 
    permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER', 'DCC_ADMIN'],
    canCreateDar: true,
    canAccessTasks: true,
    canViewRegister: true,
    isWorkflowUser: true
  },
  { id: 'U003', empId: 'EMP-003', name: 'กัลยาณี พลไกร', fullName: 'กัลยาณี พลไกร', email: 'kalyanee.p@company.com', position: 'Production Assistant Manager', level: 5, approval_level: 5, role: 'DEPT_ADMIN', isDcc: false, isQmr: false, depts: ['PD', 'QA/QC'], department: 'PD', dept: 'PD', primary_department: 'PD', departments: ['PD', 'QA/QC'], secondaryDepartments: ['QA/QC', 'QA'], affiliated_departments: ['PD', 'QA/QC'], status: 'ACTIVE', pin: '123456', failedPinAttempts: 0, isLocked: false, lastPinChangedAt: '2026-01-01T00:00:00.000Z', signatureType: 'TYPOGRAPHIC', signatureStyle: 'CLASSIC_CALLIGRAPHY', signatureInitials: 'KYN-PD', hasRegisteredSignature: true, certificateSerial: 'CERT-2026-PD003', permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'], canCreateDar: true, canAccessTasks: true, canViewRegister: true, isWorkflowUser: true },
  { id: 'U004', empId: 'EMP-004', name: 'คุณเรย์', fullName: 'คุณเรย์', email: 'ray.gm@company.com', position: 'General Manager / QMR', level: 6, approval_level: 6, role: 'DEPT_ADMIN', isDcc: false, isQmr: true, depts: ['MGMT'], department: 'MGMT', dept: 'MGMT', primary_department: 'MGMT', affiliated_departments: ['MGMT'], status: 'ACTIVE', pin: '123456', failedPinAttempts: 0, isLocked: false, lastPinChangedAt: '2026-01-01T00:00:00.000Z', signatureType: 'TYPOGRAPHIC', signatureStyle: 'FORMAL_SERIF', signatureInitials: 'RAY-GM', hasRegisteredSignature: true, certificateSerial: 'CERT-2026-GM004', permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER', 'QMR_ACCESS'], canCreateDar: true, canAccessTasks: true, canViewRegister: true, isWorkflowUser: true },
  { id: 'U005', empId: 'EMP-005', name: 'บีม', fullName: 'บีม', email: 'beam.qa@company.com', position: 'QAQC Supervisor', level: 4, approval_level: 4, role: 'DEPT_ADMIN', isDcc: false, isQmr: false, depts: ['QA/QC'], department: 'QA/QC', dept: 'QA/QC', primary_department: 'QA/QC', affiliated_departments: ['QA/QC'], status: 'ACTIVE', pin: '123456', failedPinAttempts: 0, isLocked: false, lastPinChangedAt: '2026-01-01T00:00:00.000Z', signatureType: 'TYPOGRAPHIC', signatureStyle: 'BRUSH_SCRIPT', signatureInitials: 'BM-QA', hasRegisteredSignature: true, certificateSerial: 'CERT-2026-QA005', permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'], canCreateDar: true, canAccessTasks: true, canViewRegister: true, isWorkflowUser: true },
  { id: 'U006', empId: 'EMP-006', name: 'รัตนพล', fullName: 'รัตนพล', email: 'rattanapol.en@company.com', position: 'Engineering Supervisor', level: 4, approval_level: 4, role: 'DEPT_ADMIN', isDcc: false, isQmr: false, depts: ['EN'], department: 'EN', dept: 'EN', primary_department: 'EN', affiliated_departments: ['EN'], status: 'ACTIVE', pin: '123456', failedPinAttempts: 0, isLocked: false, lastPinChangedAt: '2026-01-01T00:00:00.000Z', signatureType: 'TYPOGRAPHIC', signatureStyle: 'MODERN_SANS', signatureInitials: 'RTP-EN', hasRegisteredSignature: true, certificateSerial: 'CERT-2026-EN006', permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'], canCreateDar: true, canAccessTasks: true, canViewRegister: true, isWorkflowUser: true },
  { id: 'U007', empId: 'EMP-007', name: 'ชัยวัฒน์', fullName: 'ชัยวัฒน์', email: 'chaiwat.en@company.com', position: 'Engineering Assistant Manager', level: 5, approval_level: 5, role: 'DEPT_ADMIN', isDcc: false, isQmr: false, depts: ['EN'], department: 'EN', dept: 'EN', primary_department: 'EN', affiliated_departments: ['EN'], status: 'ACTIVE', pin: '123456', failedPinAttempts: 0, isLocked: false, lastPinChangedAt: '2026-01-01T00:00:00.000Z', signatureType: 'TYPOGRAPHIC', signatureStyle: 'FORMAL_SERIF', signatureInitials: 'CWT-EN', hasRegisteredSignature: true, certificateSerial: 'CERT-2026-EN007', permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'], canCreateDar: true, canAccessTasks: true, canViewRegister: true, isWorkflowUser: true },
  { id: 'U008', empId: 'EMP-008', name: 'คุณกิต', fullName: 'คุณกิต', email: 'kit.fin@company.com', position: 'Finance Director', level: 7, approval_level: 7, role: 'DEPT_ADMIN', isDcc: false, isQmr: false, depts: ['FIN'], department: 'FIN', dept: 'FIN', primary_department: 'FIN', affiliated_departments: ['FIN'], status: 'ACTIVE', pin: '123456', failedPinAttempts: 0, isLocked: false, lastPinChangedAt: '2026-01-01T00:00:00.000Z', signatureType: 'TYPOGRAPHIC', signatureStyle: 'MODERN_SANS', signatureInitials: 'KIT-FIN', hasRegisteredSignature: true, certificateSerial: 'CERT-2026-FN008', permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'], canCreateDar: true, canAccessTasks: true, canViewRegister: true, isWorkflowUser: true },
  { id: 'U009', empId: 'EMP-009', name: 'คุณนัท', fullName: 'คุณนัท', email: 'nut.md@company.com', position: 'Managing Director', level: 8, approval_level: 8, role: 'DEPT_ADMIN', isDcc: false, isQmr: false, depts: ['EXEC'], department: 'EXEC', dept: 'EXEC', primary_department: 'EXEC', affiliated_departments: ['EXEC'], status: 'ACTIVE', pin: '123456', failedPinAttempts: 0, isLocked: false, lastPinChangedAt: '2026-01-01T00:00:00.000Z', signatureType: 'TYPOGRAPHIC', signatureStyle: 'CLASSIC_CALLIGRAPHY', signatureInitials: 'NUT-MD', hasRegisteredSignature: true, certificateSerial: 'CERT-2026-EX009', permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'], canCreateDar: true, canAccessTasks: true, canViewRegister: true, isWorkflowUser: true },
  { id: 'U010', empId: 'EMP-010', name: 'สมชาย การตลาด', fullName: 'สมชาย การตลาด', email: 'somchai.mkt@company.com', position: 'Sales Executive', level: 3, approval_level: 3, role: 'GENERAL_USER', isDcc: false, isQmr: false, depts: ['MKT'], department: 'MKT', dept: 'MKT', primary_department: 'MKT', affiliated_departments: ['MKT'], status: 'ACTIVE', pin: '123456', failedPinAttempts: 0, isLocked: false, lastPinChangedAt: '2026-01-01T00:00:00.000Z', signatureType: 'TYPOGRAPHIC', signatureStyle: 'MODERN_SANS', signatureInitials: 'SCM-MKT', hasRegisteredSignature: true, certificateSerial: 'CERT-2026-MK010', permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'], canCreateDar: true, canAccessTasks: true, canViewRegister: true, isWorkflowUser: true }
];

// 2. Master Departments
export const MASTER_DEPARTMENTS = [
  { id: 'DC', name: 'DC (Document Control)', nameTh: 'ฝ่ายควบคุมเอกสาร / Document Control', nameEn: 'Document Control Department', headUserId: 'EMP-001', headName: 'ธนาวุฒิ สมควรกิจดำรง', status: 'ACTIVE', color: 'sky' },
  { id: 'PD', name: 'PD (Production)', nameTh: 'ฝ่ายผลิต', nameEn: 'Production Department', headUserId: 'U003', headName: 'กัลยาณี พลไกร', status: 'ACTIVE', color: 'indigo' },
  { id: 'QA/QC', name: 'QA/QC', nameTh: 'ฝ่ายประกันและควบคุมคุณภาพ', nameEn: 'Quality Assurance & Control', headUserId: 'U005', headName: 'บีม', status: 'ACTIVE', color: 'emerald' },
  { id: 'WH', name: 'WH (Warehouse)', nameTh: 'ฝ่ายคลังสินค้าและโลจิสติกส์', nameEn: 'Warehouse & Logistics', headUserId: 'U005', headName: 'บีม', status: 'ACTIVE', color: 'amber' },
  { id: 'EN', name: 'EN (Engineering)', nameTh: 'ฝ่ายวิศวกรรมและซ่อมบำรุง', nameEn: 'Engineering & Maintenance', headUserId: 'U006', headName: 'รัตนพล', status: 'ACTIVE', color: 'blue' },
  { id: 'PC', name: 'PC (Purchasing)', nameTh: 'ฝ่ายจัดซื้อ', nameEn: 'Purchasing Department', headUserId: 'U004', headName: 'คุณเรย์', status: 'ACTIVE', color: 'purple' },
  { id: 'HR&GA', name: 'HR&GA', nameTh: 'ฝ่ายทรัพยากรบุคคลและธุรการ', nameEn: 'Human Resources & General Affairs', headUserId: 'U004', headName: 'คุณเรย์', status: 'ACTIVE', color: 'rose' },
  { id: 'HSE', name: 'HSE (Safety)', nameTh: 'ฝ่ายความปลอดภัยและสิ่งแวดล้อม', nameEn: 'Health, Safety & Environment', headUserId: 'U004', headName: 'คุณเรย์', status: 'ACTIVE', color: 'teal' },
  { id: 'MKT', name: 'MKT (Marketing)', nameTh: 'ฝ่ายการตลาดและการขาย', nameEn: 'Marketing & Sales', headUserId: 'U010', headName: 'สมชาย การตลาด', status: 'ACTIVE', color: 'cyan' },
  { id: 'ST', name: 'ST (Store)', nameTh: 'ฝ่ายจัดเก็บวัตถุดิบ', nameEn: 'Store & Inventory', headUserId: 'U005', headName: 'บีม', status: 'ACTIVE', color: 'slate' }
];

export const MASTER_DATA_DEPT = MASTER_DEPARTMENTS;
export const SYSTEM_CORE_DEPTS = ['DC', 'QA/QC', 'QA/QC'];

// 3. Master Document Types (2-Digit Base Running Number Standard: 01-99 ➔ 100+)
export const MASTER_DOCUMENT_TYPES = [
  { id: 'QM', code: 'QM', name: 'Quality Manual', nameTh: 'คู่มือคุณภาพ', namingPattern: 'QM-{Dept}-{##}', is_form_type: false, reviewCycleMonths: 12, retentionPeriodYears: 5, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'คู่มือระบบการบริหารคุณภาพตามมาตรฐานสากล' },
  { id: 'SOP', code: 'SOP', name: 'Standard Operating Procedure', nameTh: 'ระเบียบปฏิบัติงาน', namingPattern: 'SOP-{Dept}-{##}', is_form_type: false, reviewCycleMonths: 12, retentionPeriodYears: 3, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'ขั้นตอนและระเบียบการดำเนินงานข้ามสายงาน' },
  { id: 'WI', code: 'WI', name: 'Work Instruction', nameTh: 'คู่มือการปฏิบัติงาน', namingPattern: 'WI-{Dept}-{##}', is_form_type: false, reviewCycleMonths: 12, retentionPeriodYears: 3, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'คำแนะนำขั้นตอนการทำงานเฉพาะจุดปฏิบัติงาน' },
  { id: 'FM', code: 'FM', name: 'Form / Record Format', nameTh: 'แบบฟอร์มบันทึกข้อมูล', namingPattern: 'FM-{Dept}-{##}', is_form_type: true, reviewCycleMonths: 24, retentionPeriodYears: 2, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'แบบฟอร์มเปล่าสำหรับบันทึกผลการปฏิบัติงาน' },
  { id: 'SD', code: 'SD', name: 'Supporting Document', nameTh: 'เอกสารสนับสนุน', namingPattern: 'SD-{Dept}-{##}', is_form_type: false, reviewCycleMonths: 24, retentionPeriodYears: 3, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'เอกสารอ้างอิงและข้อมูลทางวิชาการสนับสนุน' },
  { id: 'SPEC', code: 'SPEC', name: 'Standard Specification', nameTh: 'ข้อกำหนดและสเปกมาตรฐาน', namingPattern: 'SPEC-{Dept}-{##}', is_form_type: false, reviewCycleMonths: 12, retentionPeriodYears: 5, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'เกณฑ์มาตรฐานคุณลักษณะวัตถุดิบและผลิตภัณฑ์' },
  { id: 'ED', code: 'ED', name: 'External Document & Regulation', nameTh: 'เอกสารภายนอกและกฎหมาย', namingPattern: 'ED-{Dept}-{##}', is_form_type: false, isFormBypass: true, reviewCycleMonths: 12, retentionPeriodYears: 5, status: 'ACTIVE', category: 'EXTERNAL', allowDar: false, description: 'เอกสาร กฎหมาย มาตรฐาน และคู่มือจากหน่วยงานภายนอก' }
];

// 4. Default Signature & Security Settings (21 CFR Part 11 Compliant)
export const DEFAULT_SIGNATURE_SETTINGS = {
  pinLength: 6,
  maxFailedAttempts: 3,
  defaultPin: '123456',
  requireTermsAcknowledgment: true,
  requireReasonForSigning: true,
  requireReAuthentication: true,
  enableTimestampAuthority: true,
  dualSignOffOnObsolete: true,
  auditTrailLogging: true,
  signatureStampFormat: 'STANDARD_WITH_METADATA', // 'STANDARD_WITH_METADATA', 'FORMAL_BOXED_STAMP', 'MINIMAL_LEAN'
  allowDrawnSignature: true,
  allowUploadedSignature: true,
  allowTypographicSignature: true
};

// 5. Default SLA Settings (Days)
export const DEFAULT_SLA_SETTINGS = {
  reviewSlaDays: 3,
  approvalSlaDays: 3,
  hardcopyReceiptSlaDays: 5,
  recallSlaDays: 7,
  darCreationSlaDays: 3
};

// 6. Default Approval Routing Matrix by Document Type
export const DEFAULT_APPROVAL_MATRIX = [
  { docType: 'QM', doc_type: 'QM', nameTh: 'คู่มือคุณภาพ (Quality Manual)', minRequesterLevel: 4, min_requester_level: 4, requiredReviewerLevel: 6, required_reviewer_level: 6, requiredApproverLevel: 8, required_approver_level: 8, requireAckDefault: true, require_ack_default: true, description: 'คู่มือระบบการบริหารคุณภาพตามมาตรฐานสากล' },
  { docType: 'SOP', doc_type: 'SOP', nameTh: 'ระเบียบปฏิบัติงาน (Standard Operating Procedure)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 6, required_approver_level: 6, requireAckDefault: true, require_ack_default: true, description: 'ขั้นตอนและระเบียบการดำเนินงานข้ามสายงาน' },
  { docType: 'WI', doc_type: 'WI', nameTh: 'คู่มือการปฏิบัติงาน (Work Instruction)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 5, required_approver_level: 5, requireAckDefault: false, require_ack_default: false, description: 'คำแนะนำขั้นตอนการทำงานเฉพาะจุดปฏิบัติงาน' },
  { docType: 'FM', doc_type: 'FM', nameTh: 'แบบฟอร์มบันทึกข้อมูล (Form / Record Format)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 5, required_approver_level: 5, requireAckDefault: false, require_ack_default: false, description: 'แบบฟอร์มเปล่าสำหรับบันทึกผลการปฏิบัติงาน' },
  { docType: 'SD', doc_type: 'SD', nameTh: 'เอกสารสนับสนุน (Supporting Document)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 5, required_approver_level: 5, requireAckDefault: true, require_ack_default: true, description: 'เอกสารอ้างอิงและข้อมูลทางวิชาการสนับสนุน' },
  { docType: 'SPEC', doc_type: 'SPEC', nameTh: 'ข้อกำหนดและสเปกมาตรฐาน (Standard Specification)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 5, required_approver_level: 5, requireAckDefault: true, require_ack_default: true, description: 'เกณฑ์มาตรฐานคุณลักษณะวัตถุดิบและผลิตภัณฑ์' },
  { docType: 'ED', doc_type: 'ED', nameTh: 'เอกสารภายนอกและกฎหมาย (External Document)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 6, required_approver_level: 6, requireAckDefault: false, require_ack_default: false, description: 'เอกสาร กฎหมาย มาตรฐาน และคู่มือจากหน่วยงานภายนอก' }
];

export const REQUEST_MASTER_DATA_USER = MASTER_DATA_USER.map(u => ({ 
  id: u.id, 
  empId: u.empId || u.id, 
  name: u.name, 
  depts: u.affiliated_departments || u.depts, 
  affiliated_departments: u.affiliated_departments || u.depts, 
  department: u.primary_department || u.department, 
  primary_department: u.primary_department || u.department, 
  level: u.approval_level || u.level, 
  approval_level: u.approval_level || u.level 
}));
export const REVIEW_MASTER_DATA_USER = [...REQUEST_MASTER_DATA_USER];
export const APPROVE_MASTER_DATA_USER = [...REQUEST_MASTER_DATA_USER];

// Combine mock lists
export const MOCK_DOC_FORMATS = [
  { id: 1, format: 'WI-[YY]-[RUN_NO]' },
  { id: 2, format: 'MN-[YY]-[RUN_NO]' },
];

export const MOCK_DARS = [
  {
    id: 'DAR-MOCK-1',
    darNo: 'DAR-2607-001',
    type: 'NEW',
    title: 'MN-QA-001',
    name: 'คู่มือคุณภาพ (Quality Manual)',
    status: 'PENDING_REVIEW',
    department: 'QA/QC',
    requesterId: 'U005',
    requestDate: '2026-07-01T08:00:00Z',
    reason: 'จัดทำคู่มือคุณภาพฉบับใหม่ให้สอดคล้องกับนโยบาย',
    reviewerId: 'U003',
    approverId: 'U009'
  },
  {
    id: 'DAR-MOCK-2',
    darNo: 'DAR-2607-002',
    type: 'REVISION',
    title: 'SOP-WH-002',
    name: 'ขั้นตอนการรับสินค้าเข้าคลัง',
    status: 'PENDING_APPROVAL',
    department: 'WH',
    requesterId: 'U001',
    requestDate: '2026-06-25T08:00:00Z',
    reason: 'ปรับปรุงขั้นตอนการตรวจสอบพาเลท',
    reviewerId: 'U005',
    approverId: 'U004',
    docId: 'DOC-MOCK-WH-002',
    revisesRev: '02'
  },
  {
    id: 'DAR-MOCK-3',
    darNo: 'DAR-2607-003',
    type: 'OBSOLETE',
    title: 'WI-PD-010',
    name: 'การใช้งานเครื่องซีลถุง',
    status: 'PENDING_DCC',
    department: 'PD',
    requesterId: 'U001',
    requestDate: '2026-07-08T08:00:00Z',
    reason: 'ยกเลิกเครื่องจักร เลิกผลิต',
    reviewerId: 'U003',
    approverId: 'U004',
    docId: 'DOC-MOCK-PD-010'
  }
];

export const MOCK_TASKS = [
  {
    id: 'TASK-MOCK-1',
    type: 'REVIEW',
    darId: 'DAR-MOCK-1',
    docId: 'DOC-MOCK-QA-001',
    docCode: 'MN-QA-001',
    doc_code: 'MN-QA-001',
    docTitle: 'คู่มือคุณภาพ (Quality Manual)',
    docName: 'คู่มือคุณภาพ (Quality Manual)',
    title: 'ทบทวนคำร้อง (Review DAR) - MN-QA-001',
    assigneeId: 'U003',
    department: 'QA',
    target_department: 'QA',
    owner_dept: 'QA',
    currentHandlerDepartment: 'QA',
    status: 'PENDING',
    createdAt: '2026-07-01T08:00:00Z',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Due Soon (in 2 days)
  },
  {
    id: 'TASK-MOCK-2',
    type: 'APPROVE',
    darId: 'DAR-MOCK-2',
    docId: 'DOC-MOCK-WH-002',
    docCode: 'SOP-WH-002',
    doc_code: 'SOP-WH-002',
    docTitle: 'ขั้นตอนการรับสินค้าเข้าคลัง',
    docName: 'ขั้นตอนการรับสินค้าเข้าคลัง',
    title: 'อนุมัติคำร้อง (Approve DAR) - SOP-WH-002',
    assigneeId: 'U004',
    department: 'WH',
    target_department: 'WH',
    owner_dept: 'WH',
    currentHandlerDepartment: 'WH',
    status: 'PENDING',
    createdAt: '2026-06-25T08:00:00Z',
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Overdue (5 days ago)
  },
  {
    id: 'TASK-MOCK-3',
    type: 'DCC_ACTION',
    darId: 'DAR-MOCK-3',
    docId: 'DOC-MOCK-PD-010',
    docCode: 'WI-PD-010',
    doc_code: 'WI-PD-010',
    docTitle: 'การใช้งานเครื่องซีลถุง',
    docName: 'การใช้งานเครื่องซีลถุง',
    title: 'ดำเนินการอัปเดตระบบ (DCC Action) - WI-PD-010',
    assigneeId: 'U001',
    department: 'PD',
    target_department: 'PD',
    owner_dept: 'PD',
    currentHandlerDepartment: 'PD',
    status: 'PENDING',
    createdAt: '2026-07-08T08:00:00Z',
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // Normal
  },
  {
    id: 'TASK-MOCK-4',
    type: 'ACKNOWLEDGE',
    docId: 'DOC-MOCK-1', // SOP-PD-001
    docCode: 'SOP-PD-001',
    doc_code: 'SOP-PD-001',
    docTitle: 'มาตรฐานการควบคุมเครื่องตรวจจับโลหะ (Metal Detector)',
    docName: 'มาตรฐานการควบคุมเครื่องตรวจจับโลหะ (Metal Detector)',
    title: 'รับทราบการประกาศใช้เอกสารใหม่ - SOP-PD-001',
    assigneeId: 'U001',
    department: 'PD',
    target_department: 'PD',
    owner_dept: 'PD',
    currentHandlerDepartment: 'PD',
    status: 'PENDING',
    createdAt: '2026-07-05T08:00:00Z',
    dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Overdue by 1 day
  }
];

export const MOCK_TIMELINE = [
  {
    id: 'TL-1',
    darId: 'DAR-MOCK-2',
    action: 'SUBMIT',
    actor: 'U001',
    timestamp: '2026-06-25T08:00:00Z',
    comment: 'ปรับปรุงขั้นตอนการตรวจสอบพาเลท'
  },
  {
    id: 'TL-2',
    darId: 'DAR-MOCK-2',
    action: 'REVIEW',
    actor: 'U005',
    timestamp: '2026-06-26T10:00:00Z',
    comment: 'ตรวจสอบความถูกต้องเรียบร้อย'
  }
];

export const MOCK_DOCUMENTS = [
  {
    id: 'DOC-MOCK-1',
    title: 'SOP-PD-001',
    name: 'มาตรฐานการควบคุมเครื่องตรวจจับโลหะ (Metal Detector)',
    status: 'EFFECTIVE',
    department: 'PD',
    ownerId: 'U003', // Document Owner (Production Assistant Manager)
    effectiveDate: '2025-07-16', // Due Soon (7 days left for 12 months)
    rev: '01',
    access_control: {
      scope: 'GENERAL',
      authorized_depts: [],
      authorized_users: [],
      min_access_level: 1
    }
  },
  {
    id: 'DOC-MOCK-2',
    title: 'WI-PD-015',
    name: 'ขั้นตอนการล้างทำความสะอาดข้าวเหนียว',
    status: 'EFFECTIVE',
    department: 'PD',
    ownerId: 'U003',
    effectiveDate: '2025-05-25', // Overdue (Escalated)
    rev: '01',
    access_control: {
      scope: 'DEPT_ONLY',
      authorized_depts: ['PD'],
      authorized_users: [],
      min_access_level: 1
    }
  },
  {
    id: 'DOC-MOCK-WH-002',
    title: 'SOP-WH-002',
    name: 'ขั้นตอนการรับสินค้าเข้าคลัง',
    status: 'EFFECTIVE',
    department: 'WH',
    ownerId: 'U005',
    effectiveDate: '2024-11-20',
    rev: '02',
    access_control: {
      scope: 'TARGETED',
      authorized_depts: ['WH', 'PD', 'QA/QC'],
      authorized_users: [],
      min_access_level: 1
    }
  },
  {
    id: 'DOC-MOCK-PD-010',
    title: 'WI-PD-010',
    name: 'การใช้งานเครื่องซีลถุง',
    status: 'EFFECTIVE',
    department: 'PD',
    ownerId: 'U003',
    effectiveDate: '2024-03-10',
    rev: '05',
    access_control: {
      scope: 'RESTRICTED',
      authorized_depts: ['PD'],
      authorized_users: ['U001', 'U003'],
      min_access_level: 4
    }
  }
];

export const CONTROLLED_COPY_STATUS = {
  PENDING_ISSUE: 'PENDING_ISSUE',
  DISPATCHED_PENDING_RECEIPT: 'DISPATCHED_PENDING_RECEIPT',
  ISSUED_ACTIVE: 'ISSUED_ACTIVE',
  PENDING_RECALL: 'PENDING_RECALL',
  RECALLED_DESTROYED: 'RECALLED_DESTROYED',
  // Backward compatibility aliases
  ACTIVE: 'ACTIVE',
  PENDING_RECEIPT: 'PENDING_RECEIPT',
  REPLACEMENT_REQUESTED: 'REPLACEMENT_REQUESTED',
  RECALLED: 'RECALLED'
};

export const MOCK_CONTROLLED_COPY_INSTANCES = [
  {
    id: 'CC-MOCK-1',
    doc_id: 'DOC-MOCK-1',
    docId: 'DOC-MOCK-1',
    doc_code: 'WI-PD-001',
    docTitle: 'WI-PD-001',
    docName: 'ขั้นตอนการล้างทำความสะอาดเครื่องผสม',
    doc_version: '01',
    rev: '01',
    copy_no: '01',
    ccNumber: 'CC-001',
    issue_no: '01',
    issueNumber: 'I01',
    holder_dept: 'PD',
    department: 'PD',
    departmentId: 'PD',
    holder_name: 'PD (ฝ่ายผลิต)',
    holderId: 'PD',
    location: 'Line 1 - Mixing (ห้องผสม)',
    locationName: 'Line 1 - Mixing (ห้องผสม)',
    status: 'ISSUED_ACTIVE',
    is_replacement: false,
    dispatched_at: '2025-07-17T08:00:00Z',
    dispatched_by: 'ธนาวุฒิ สมควรกิจดำรง (DCC)',
    dateIssued: '2025-07-17',
    receipt_confirmed_at: '2025-07-17T09:30:00Z',
    receipt_confirmed_by: 'กัลยาณี พลไกร',
    receipt_remarks: 'Verified physical stamp and station binder',
    recall_task_id: null
  },
  {
    id: 'CC-MOCK-2',
    doc_id: 'DOC-MOCK-WH-002',
    docId: 'DOC-MOCK-WH-002',
    doc_code: 'WI-WH-002',
    docTitle: 'WI-WH-002',
    docName: 'ขั้นตอนการจัดเก็บวัตถุดิบและสารก่อภูมิแพ้',
    doc_version: '02',
    rev: '02',
    copy_no: '01',
    ccNumber: 'CC-001',
    issue_no: '01',
    issueNumber: 'I01',
    holder_dept: 'WH',
    department: 'WH',
    departmentId: 'WH',
    holder_name: 'WH (ฝ่ายคลังสินค้าและโลจิสติกส์)',
    holderId: 'WH',
    location: 'คลังสินค้าวัตถุดิบ RM Store',
    locationName: 'คลังสินค้าวัตถุดิบ RM Store',
    status: 'DISPATCHED_PENDING_RECEIPT',
    is_replacement: false,
    dispatched_at: '2026-07-08T10:00:00Z',
    dispatched_by: 'ธนาวุฒิ สมควรกิจดำรง (DCC)',
    dateIssued: '2026-07-08',
    receipt_confirmed_at: null,
    receipt_confirmed_by: null,
    receipt_remarks: null,
    recall_task_id: null
  }
];

export const calculateSLAStatus = (effectiveDate, currentDate) => {
  if (!effectiveDate) return 'NORMAL';

  const eff = new Date(effectiveDate);
  eff.setHours(0, 0, 0, 0);
  const cur = new Date(currentDate);
  cur.setHours(0, 0, 0, 0);

  const diffTime = eff.getTime() - cur.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'OVERDUE';
  if (diffDays <= 3) return 'DUE_SOON';
  return 'NORMAL';
};

/**
 * Robust Safe Auto-Running EDR Generator (ISO 9001 & Year Sequence Compliance)
 * Calculates maximum sequence for current Christian calendar year (e.g. 2026).
 * Concurrency & Seed Guard: ensures generated key never collides with existing requests.
 */
export const generateNextEdrNumber = (requests = []) => {
  const year = new Date().getFullYear(); // บังคับใช้ ค.ศ. เสมอ (เช่น 2026)
  const prefix = `EDR-${year}-`;
  
  const matchedNumbers = (requests || [])
    .map(r => {
      const code = r?.requestNo || r?.edrNumber || r?.requestId || r?.id || '';
      if (typeof code === 'string' && code.startsWith(prefix)) {
        const parts = code.split('-');
        const seqStr = parts[2];
        return seqStr ? parseInt(seqStr, 10) : 0;
      }
      return 0;
    })
    .filter(n => !isNaN(n) && n > 0);

  let maxSeq = matchedNumbers.length > 0 ? Math.max(...matchedNumbers) : 0;
  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;

  // Concurrency & Seed Guard: loop increment if candidate already exists
  const existingCodes = new Set(
    (requests || []).flatMap(r => [r?.id, r?.requestId, r?.requestNo, r?.edrNumber].filter(Boolean))
  );
  while (existingCodes.has(candidate)) {
    nextSeq += 1;
    candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  return candidate;
};

/**
 * Resolves recipient department for a controlled copy or receipt task.
 * Strict ISO 9001 Invariant:
 * 1. Physical station / location (e.g. 'EN Office (Master)') determines recipient department.
 * 2. NEVER falls back to docOwnerDept ('PD').
 */
export const resolveReceiptTaskDepartment = (copyOrTask, matchedCopy = null) => {
  if (!copyOrTask) return 'EN';

  // 1. Check station or location
  const loc = 
    matchedCopy?.station_id || 
    matchedCopy?.locationId || 
    matchedCopy?.location || 
    matchedCopy?.locationName || 
    matchedCopy?.location_name ||
    copyOrTask.station_id ||
    copyOrTask.locationId ||
    copyOrTask.location || 
    copyOrTask.locationName || 
    copyOrTask.location_name || '';

  const foundStation = STANDARD_STATIONS.find(s => 
    s.id === loc || 
    s.name === loc || 
    (loc && typeof loc === 'string' && (loc.includes(s.name) || (s.name && s.name.includes(loc))))
  );

  if (foundStation?.departmentId) {
    return foundStation.departmentId === 'DCC' ? 'DC' : foundStation.departmentId;
  }

  const textToCheck = `${typeof loc === 'string' ? loc : ''} ${copyOrTask.title || ''} ${copyOrTask.description || ''}`;
  if (textToCheck.includes('EN Office') || textToCheck.includes('EN-') || textToCheck.includes('(EN)')) {
    return 'EN';
  }
  if (textToCheck.includes('WH Office') || textToCheck.includes('WH-') || textToCheck.includes('(WH)') || textToCheck.includes('คลังสินค้า')) {
    return 'WH';
  }
  if (textToCheck.includes('QC Lab') || textToCheck.includes('QA/QC') || textToCheck.includes('QA Office') || textToCheck.includes('ห้องแล็บ')) {
    return 'QA/QC';
  }

  // 2. Explicit target/recipient department fields
  const explicitTargetDept = 
    copyOrTask.target_department || 
    copyOrTask.targetDepartment || 
    copyOrTask.recipientDepartment || 
    copyOrTask.recipient_department || 
    copyOrTask.destinationDept || 
    copyOrTask.destination_dept ||
    matchedCopy?.targetDepartment || 
    matchedCopy?.target_department || 
    matchedCopy?.recipientDepartment || 
    matchedCopy?.recipient_department || 
    matchedCopy?.destinationDept || 
    matchedCopy?.destination_dept;

  if (explicitTargetDept && explicitTargetDept !== 'DCC') {
    return explicitTargetDept === 'DCC' ? 'DC' : explicitTargetDept;
  }

  // 3. Fallback to copy department or task department if valid and non-DCC
  const fallbackDept = 
    copyOrTask.department || 
    copyOrTask.departmentId || 
    copyOrTask.dept_code || 
    copyOrTask.deptCode || 
    copyOrTask.holder_dept || 
    copyOrTask.dept || 
    matchedCopy?.department || 
    matchedCopy?.departmentId || 
    matchedCopy?.dept_code || 
    matchedCopy?.deptCode;

  if (fallbackDept && fallbackDept !== 'DCC') {
    return fallbackDept === 'DCC' ? 'DC' : fallbackDept;
  }

  return 'EN';
};

export const cleanupDccTasks = (tasks, instances, documents, dars = []) => {
  const safeInstances = instances || [];
  const safeDocs = documents || [];
  const safeDars = dars || [];

  const hasPendingDist = safeInstances.some(i => 
    i.status === 'PENDING_ISSUE' || 
    i.status === 'PENDING_PRINT' ||
    i.status === 'PENDING_DISPATCH'
  );

  return (tasks || []).map(t => {
    if (!t) return t;
    let updated = t;
    if (
      t.target_department === 'DCC' ||
      t.targetDepartment === 'DCC' ||
      t.department === 'DCC' ||
      t.dept === 'DCC' ||
      t.assignedToDept === 'DCC' ||
      t.destinationDept === 'DCC' ||
      t.currentHandlerDepartment === 'DCC'
    ) {
      updated = {
        ...updated,
        target_department: updated.target_department === 'DCC' ? 'DC' : updated.target_department,
        targetDepartment: updated.targetDepartment === 'DCC' ? 'DC' : updated.targetDepartment,
        department: updated.department === 'DCC' ? 'DC' : updated.department,
        dept: updated.dept === 'DCC' ? 'DC' : updated.dept,
        assignedToDept: updated.assignedToDept === 'DCC' ? 'DC' : updated.assignedToDept,
        destinationDept: updated.destinationDept === 'DCC' ? 'DC' : updated.destinationDept,
        currentHandlerDepartment: updated.currentHandlerDepartment === 'DCC' ? 'DC' : updated.currentHandlerDepartment
      };
    }

    // Ensure task has clear origin distinction (INTERNAL vs EXTERNAL)
    let origin = updated.origin;
    if (!origin) {
      if (
        updated.referenceType === 'EXTERNAL_DOC' ||
        (updated.type && String(updated.type).startsWith('EXT_')) ||
        (updated.taskType && String(updated.taskType).startsWith('EXT_')) ||
        updated.extAction ||
        updated.is_external ||
        updated.isExternal ||
        String(updated.doc_code || updated.docCode || '').startsWith('ED-') ||
        (updated.title && (updated.title.includes('เอกสารภายนอก') || updated.title.includes('External Doc')))
      ) {
        origin = 'EXTERNAL';
      } else {
        origin = 'INTERNAL';
      }
    }
    updated = { ...updated, origin };

    // Populate missing docTitle/docName from master documents, DARs, or copy instances
    if (!updated.docName || !updated.docTitle || updated.docTitle === updated.doc_code) {
      const docCode = updated.doc_code || updated.docCode || updated.document_code;
      const docId = updated.docId || updated.doc_id;
      const matchedDoc = safeDocs.find(d => 
        (docId && String(d.id) === String(docId)) ||
        (docCode && (d.title === docCode || d.document_code === docCode || d.code === docCode))
      );
      const matchedDar = safeDars.find(d => String(d.id) === String(updated.darId));
      const matchedInst = safeInstances.find(i => String(i.id) === String(updated.copyId || updated.copy_id));

      const officialName = 
        matchedDoc?.name || 
        matchedDoc?.document_name || 
        matchedDar?.name || 
        matchedDar?.document_name || 
        matchedInst?.docName || 
        matchedInst?.name;

      if (officialName) {
        updated = {
          ...updated,
          docTitle: officialName,
          docName: officialName,
          docCode: docCode || matchedDoc?.title || matchedDoc?.document_code || updated.docCode
        };
      }
    }

    // Contextual Revision Scoping Data Alignment:
    // Ensure task holds explicit sourceRevision and targetRevision from DAR or Document if not already set
    if (updated.darId) {
      const matchedDar = safeDars.find(d => String(d.id) === String(updated.darId));
      if (matchedDar) {
        const darSourceRev = matchedDar.sourceRevision || matchedDar.revisesRev || matchedDar.previousRev || (matchedDar.type === 'REVISION' ? (safeDocs.find(d => String(d.id) === String(matchedDar.docIdRef || matchedDar.docId))?.rev || '00') : null);
        const darTargetRev = matchedDar.targetRevision || matchedDar.rev || matchedDar.targetRev || matchedDar.proposedRev;
        if (!updated.sourceRevision && darSourceRev) {
          updated.sourceRevision = darSourceRev;
        }
        if (!updated.targetRevision && darTargetRev) {
          updated.targetRevision = darTargetRev;
        }
      }
    }

    // Strict Task Department Scoping:
    // Enforce that task.department is ALWAYS bound to the document or DAR owner department, NEVER the assignee's department!
    const effectiveDocCode = updated.doc_code || updated.docCode || updated.document_code || updated.title || '';
    const effectiveDocId = updated.docId || updated.doc_id;
    const taskDar = safeDars.find(d => String(d.id) === String(updated.darId));
    const taskDoc = safeDocs.find(d => 
      (effectiveDocId && String(d.id) === String(effectiveDocId)) ||
      (effectiveDocCode && (d.title === effectiveDocCode || d.document_code === effectiveDocCode || d.code === effectiveDocCode))
    );
    let ownerDept = taskDar?.department || taskDoc?.department;
    if (!ownerDept) {
      if (String(effectiveDocCode).includes('-PD-') || String(updated.title).includes('-PD-') || String(updated.darId).includes('-PD-')) {
        ownerDept = 'PD';
      }
    }

    const isDccTask = isDccExclusiveTask(updated) || isDccOperationalTask(updated);
    const isReceipt = isReceiptTask(updated);

    if (isDccTask) {
      updated = {
        ...updated,
        department: 'DC',
        target_department: 'DC',
        targetDepartment: 'DC',
        targetRole: 'DCC_ADMIN',
        target_role: 'DCC_ADMIN',
        assignedToRole: 'DCC_ADMIN'
      };
    } else if (isReceipt) {
      // 🛡️ Phase 1: Controlled Copy Receipt Task MUST be routed strictly to recipient department, NEVER ownerDept
      const targetCopyId = String(updated.copy_id || updated.copyId || updated.instanceId || '');
      const matchedCopy = safeInstances.find(i => String(i.id) === targetCopyId);
      const cleanRecipientDept = resolveReceiptTaskDepartment(updated, matchedCopy);

      updated = {
        ...updated,
        department: cleanRecipientDept,
        target_department: cleanRecipientDept,
        targetDepartment: cleanRecipientDept,
        destinationDept: cleanRecipientDept,
        destination_dept: cleanRecipientDept,
        recipientDepartment: cleanRecipientDept,
        recipient_department: cleanRecipientDept,
        currentHandlerDepartment: cleanRecipientDept,
        assignedToDept: cleanRecipientDept,
        dept_code: cleanRecipientDept
      };
    } else if (ownerDept) {
      const cleanDept = ownerDept === 'DCC' ? 'DC' : ownerDept;
      updated = {
        ...updated,
        department: cleanDept,
        target_department: cleanDept,
        owner_dept: cleanDept,
        currentHandlerDepartment: cleanDept
      };
    }

    return updated;
  }).filter(t => {
    // 1. Immediately drop tasks already completed/resolved (except active DISPATCHED_TRACKING or damaged recall tasks for DCC)
    if (t.status === 'COMPLETED' || t.status === 'RESOLVED' || t.is_completed === true) {
      if (t.delivery_status === 'DISPATCHED_TRACKING' || (t.type === 'DCC_RECALL' && (t.isDamaged || t.copyId || t.copy_id))) return true;
      return false;
    }

    // 2. Distribution Tasks (DCC_DISTRIBUTE, DCC_ISSUE, DISTRIBUTION)
    if (t.type === 'DCC_DISTRIBUTE' || t.type === 'DCC_ISSUE' || t.taskType === 'DCC_DISTRIBUTE' || t.taskType === 'DISTRIBUTION' || t.task_type === 'DISTRIBUTION') {
      if (t.delivery_status === 'DISPATCHED_TRACKING') return true;
      const targetRev = t.targetRevision || t.revision || t.doc_version || t.rev;
      const targetDocCode = t.doc_code || t.docTitle || t.document_code;
      const targetDocId = String(t.docId || t.doc_id || '');

      // Strict Decoupling: check if ANY copy of this document and this revision is in pending issue/print/dispatch
      const hasMatchingCopiesPendingIssue = safeInstances.some(i => {
        const isDocMatch = 
          (targetDocId && String(i.doc_id || i.docId) === targetDocId) ||
          (targetDocCode && (i.doc_code === targetDocCode || i.docTitle === targetDocCode || i.document_code === targetDocCode)) ||
          (t.darId && (String(i.darId || i.superseded_by_dar) === String(t.darId)));

        const isRevMatch = !targetRev || targetRev === 'ALL' || (i.rev === targetRev || i.doc_version === targetRev || i.revision === targetRev);

        const isPendingDist = i.status === 'PENDING_ISSUE' || i.status === 'PENDING_PRINT' || i.status === 'PENDING_DISPATCH';

        return isDocMatch && isRevMatch && isPendingDist;
      });

      if (targetDocId || targetDocCode || t.darId) {
        return hasMatchingCopiesPendingIssue;
      }
      return hasPendingDist;
    }

    // 3. Recall Tasks (DCC_RECALL, DCC_RECALL_WITH_CHECKLIST, RECALL, OBSOLETE_RECALL, RECALL_HARDCOPY)
    if (
      t.type === 'DCC_RECALL' || 
      t.type === 'DCC_RECALL_WITH_CHECKLIST' || 
      t.taskType === 'DCC_RECALL_WITH_CHECKLIST' || 
      t.type === 'RECALL' || 
      t.type === 'OBSOLETE_RECALL' ||
      t.type === 'RECALL_HARDCOPY' ||
      t.taskType === 'RECALL' ||
      t.task_type === 'RECALL'
    ) {
      const targetDocId = String(t.docId || t.doc_id || '');
      let targetDocCode = t.doc_code || t.docTitle || t.document_code || '';
      let targetRev = t.targetRevision || t.doc_version || t.rev || t.revision || '';

      // If not set directly on task, try extracting from title (e.g. "Obsolete: SOP-QA-003" or "Rev.00")
      if (!targetDocCode && t.title) {
        const matchObs = t.title.match(/Obsolete:\s*([A-Za-z0-9\-_]+)/i);
        if (matchObs) targetDocCode = matchObs[1].trim();
      }
      if (!targetRev && t.title) {
        const matchRev = t.title.match(/Rev\.?([0-9]+)/i);
        if (matchRev) targetRev = matchRev[1].trim();
      }

      // If darId is set, find DAR
      if (t.darId) {
        const dar = safeDars.find(d => String(d.id) === String(t.darId) || d.dar_no === t.darId);
        if (dar) {
          if (!targetDocCode) targetDocCode = dar.docIdRef || dar.docCode || dar.doc_code || dar.title;
        }
      }

      // Check matching master document status
      const matchingDoc = safeDocs.find(d => 
        (targetDocId && String(d.id) === targetDocId) ||
        (targetDocCode && (d.title === targetDocCode || d.name === targetDocCode || d.code === targetDocCode || d.document_code === targetDocCode))
      );

      // If task specifically targeted supersededCopyIds
      if (t.supersededCopyIds && Array.isArray(t.supersededCopyIds) && t.supersededCopyIds.length > 0) {
        const hasUnresolvedTargetCopies = safeInstances.some(i => 
          t.supersededCopyIds.includes(i.id) &&
          (i.status === 'SUPERSEDED_PENDING_RECALL' || i.status === 'PENDING_RECALL' || i.status === 'DAMAGED_PENDING_RECALL' || i.status === 'RECALLED' || i.status === 'OBSOLETE_PENDING_RECALL' || i.status === 'DAMAGED_PENDING_REPLACEMENT')
        );
        return hasUnresolvedTargetCopies;
      }

      // Find relevant copies for this recall task
      const relevantCopies = safeInstances.filter(i => {
        const isDocMatch = 
          (targetDocId && String(i.doc_id || i.docId) === targetDocId) ||
          (targetDocCode && (i.doc_code === targetDocCode || i.docTitle === targetDocCode || i.document_code === targetDocCode)) ||
          (matchingDoc && (String(i.doc_id || i.docId) === String(matchingDoc.id) || i.doc_code === matchingDoc.title || i.docTitle === matchingDoc.title));
        
        if (!isDocMatch) return false;

        // If specific revision was specified, match revision
        if (targetRev && targetRev !== 'ALL' && (i.rev || i.doc_version || i.revision)) {
          const copyRev = i.rev || i.doc_version || i.revision;
          if (copyRev !== targetRev && copyRev !== `0${targetRev}` && `0${copyRev}` !== targetRev) {
            return false;
          }
        }
        return true;
      });

      // If task is already completed, preserve it
      if (t.is_completed || t.status === 'COMPLETED') {
        return true;
      }

      // If task is specifically tied to a single copy (e.g. damaged copy recall)
      if (t.copyId || t.instanceId || t.copy_id || t.isDamaged || t.is_damaged) {
        const targetCopyId = String(t.copyId || t.instanceId || t.copy_id || '');
        const copy = targetCopyId ? safeInstances.find(i => String(i.id) === targetCopyId) : null;
        if (copy) {
          // Never drop recall task for damaged copy until copy is destroyed or archived
          const isNotYetDestroyed = copy.status !== 'DESTROYED' && copy.status !== 'RECALLED_DESTROYED' && copy.status !== 'ARCHIVED_OBSOLETE' && copy.status !== 'LOST' && copy.status !== 'LOST_RECORDED';
          if ((copy.isDamaged || copy.is_damaged || t.isDamaged || t.is_damaged) && isNotYetDestroyed) {
            return true;
          }
          return copy.status === 'SUPERSEDED_PENDING_RECALL' || copy.status === 'PENDING_RECALL' || copy.status === 'DAMAGED_PENDING_RECALL' || copy.status === 'RECALLED' || copy.status === 'DAMAGED_PENDING_REPLACEMENT';
        }
        if (t.isDamaged || t.is_damaged) return true;
      }

      if (relevantCopies.length === 0) {
        // If no copies exist at all for this doc, check if global has any pending recalls
        return safeInstances.some(i => i.status === 'SUPERSEDED_PENDING_RECALL' || i.status === 'PENDING_RECALL' || i.status === 'DAMAGED_PENDING_RECALL' || i.status === 'RECALLED' || i.status === 'OBSOLETE_PENDING_RECALL' || i.status === 'DAMAGED_PENDING_REPLACEMENT');
      }

      // If ANY copy is still SUPERSEDED_PENDING_RECALL, PENDING_RECALL, DAMAGED_PENDING_RECALL, RECALLED, or OBSOLETE_PENDING_RECALL, or active under obsolete/superseded document, keep the task!
      const hasUnrecalledCopy = relevantCopies.some(i => 
        i.status === 'SUPERSEDED_PENDING_RECALL' ||
        i.status === 'PENDING_RECALL' ||
        i.status === 'DAMAGED_PENDING_RECALL' ||
        i.status === 'RECALLED' ||
        i.status === 'OBSOLETE_PENDING_RECALL' ||
        i.status === 'DAMAGED_PENDING_REPLACEMENT' ||
        (matchingDoc && (matchingDoc.status === 'SUPERSEDED' || matchingDoc.status === 'SUPERSEDED_ARCHIVED' || matchingDoc.status === 'OBSOLETE' || matchingDoc.status === 'OBSOLETE_ARCHIVED') && (i.status === 'ACTIVE' || i.status === 'ISSUED_ACTIVE' || i.status === 'RECEIVED'))
      );

      return hasUnrecalledCopy;
    }

    // 4. Replacement Tasks (DCC_REPLACEMENT)
    if (t.type === 'DCC_REPLACEMENT') {
      if (t.requestId) {
        const inst = safeInstances.find(i => String(i.id) === String(t.requestId));
        if (inst) return inst.status === 'REPLACEMENT_REQUESTED';
      }
      return safeInstances.some(i => i.status === 'REPLACEMENT_REQUESTED');
    }

    // 5. Hardcopy Receipt Confirmation Tasks (DEPT_CONFIRM_HARDCOPY_RECEIPT, CONFIRM_RECEIPT)
    if (
      t.type === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || 
      t.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || 
      t.type === 'CONFIRM_RECEIPT' ||
      t.task_type === 'CONFIRM_RECEIPT'
    ) {
      const targetCopyId = String(t.copy_id || t.copyId || t.instanceId);
      const inst = safeInstances.find(i => String(i.id) === targetCopyId);
      if (inst && (inst.status === 'ISSUED_ACTIVE' || inst.status === 'ACTIVE' || inst.receipt_confirmed_at)) {
        return false; // Loop guard eliminates completed receipt tasks
      }
      return true;
    }

    return true;
  });
};

export const reconcileAndResolveTasks = (tasks, instances, documents, dars = []) => {
  return cleanupDccTasks(tasks, instances, documents, dars);
};

/**
 * Creates a receipt task for a controlled copy instance.
 * Strict Invariants:
 * 1. task.department is ALWAYS bound to the recipient department (copy.department or copy.targetDepartment), NEVER docOwnerDept (PD).
 * 2. Assignee is strictly restricted to Level 1-5 personnel. Level 6+ executives (GM, QMR, PM) are excluded.
 */
export const createReceiptTask = (copy, relatedDoc = null, relatedDar = null, masterUsers = MASTER_DATA_USER) => {
  if (!copy) return null;
  const targetId = String(copy.id || '');
  const destinationDept = resolveReceiptTaskDepartment(copy, copy);

  let requesterId = null;
  let requesterName = null;

  // L1-L5 only: never assign to Level 6+
  if (copy.requester_id || copy.requesterId || copy.holderId) {
    const candidateId = copy.requester_id || copy.requesterId || copy.holderId;
    const candidateUser = (masterUsers || []).find(u => u.id === candidateId || u.empId === candidateId);
    if (candidateUser && userMatchesDepartment(candidateUser, destinationDept) && isLevel1To5(candidateUser)) {
      requesterId = candidateUser.id;
      requesterName = candidateUser.name;
    }
  }

  if (!requesterId && relatedDar) {
    const darReqId = relatedDar.requester_id || relatedDar.requesterId || relatedDar.userId || relatedDar.requester?.id || relatedDar.created_by || relatedDar.createdBy;
    const darReqUser = (masterUsers || []).find(u => u.id === darReqId || u.empId === darReqId);
    if (darReqUser && userMatchesDepartment(darReqUser, destinationDept) && isLevel1To5(darReqUser)) {
      requesterId = darReqId;
      requesterName = darReqUser.name || relatedDar.requester_name || relatedDar.requesterName || relatedDar.requester;
    }
  }

  if (!requesterId) {
    const deptUsers = (masterUsers || []).filter(u => userMatchesDepartment(u, destinationDept) && isLevel1To5(u));
    const nonDccDeptUsers = deptUsers.filter(u => !u.isDcc && u.role !== 'DCC_ADMIN');
    const candidatePool = nonDccDeptUsers.length > 0 ? nonDccDeptUsers : deptUsers;

    const primaryDeptUsers = candidatePool.filter(u => isSameDepartment(u.primary_department || u.department || u.dept, destinationDept));
    const finalCandidates = primaryDeptUsers.length > 0 ? primaryDeptUsers : candidatePool;

    const supervisorUser = finalCandidates.find(u => u.level === 5 || u.level === 4 || u.role === 'DEPT_ADMIN' || u.role === 'SUPERVISOR') || finalCandidates[0];
    if (supervisorUser) {
      requesterId = supervisorUser.id;
      requesterName = supervisorUser.name;
    } else {
      requesterId = null;
      requesterName = `${destinationDept} Controller`;
    }
  }

  const docOfficialTitle = copy.docName || copy.name || copy.documentName || relatedDoc?.name || relatedDoc?.document_name || relatedDar?.name || copy.doc_code || copy.docTitle || 'เอกสารควบคุม';
  const docCode = copy.doc_code || copy.docTitle || copy.title || relatedDoc?.title || '';
  const dispatchedAt = new Date().toISOString();

  return {
    id: `task-receipt-${targetId}-${Date.now()}`,
    type: 'DEPT_CONFIRM_HARDCOPY_RECEIPT',
    taskType: 'DEPT_CONFIRM_HARDCOPY_RECEIPT',
    task_type: 'CONFIRM_RECEIPT',
    category: 'RECEIPT',
    title: `ตรวจรับเอกสารควบคุมฉบับพิมพ์: ${docOfficialTitle} (${docCode}) (Copy ${copy.copy_no || copy.ccNumber || '01'})`,
    description: `กรุณาตรวจสอบเอกสารฉบับพิมพ์จริงที่จุดใช้งาน ${copy.location || copy.locationName || destinationDept} (${destinationDept}) และยืนยันการรับเอกสาร`,
    copy_id: targetId,
    copyId: targetId,
    instanceId: targetId,
    doc_id: String(copy.doc_id || copy.docId || relatedDoc?.id || relatedDar?.id || ''),
    darId: relatedDar ? String(relatedDar.id) : (copy.dar_id || String(relatedDoc?.id || '')),
    doc_code: docCode,
    docCode: docCode,
    docTitle: docOfficialTitle,
    docName: docOfficialTitle,
    doc_version: copy.doc_version || copy.rev || '01',
    copy_no: copy.copy_no || copy.ccNumber || '01',
    location: copy.location || copy.locationName || destinationDept || '',
    location_name: copy.location || copy.locationName || destinationDept || '',
    target_department: destinationDept,
    targetDepartment: destinationDept,
    recipientDepartment: destinationDept,
    recipient_department: destinationDept,
    destinationDept: destinationDept,
    destination_dept: destinationDept,
    department: destinationDept,
    dept_code: destinationDept,
    currentHandlerDepartment: destinationDept,
    isDepartmentPool: true,
    isSharedTask: true,
    shared_pool: true,
    is_shared_task: true,
    assignee_id: requesterId,
    assigneeId: requesterId,
    assignee_name: requesterName,
    assigneeName: requesterName,
    assignee_dept: destinationDept,
    assignedToDept: destinationDept,
    assignedToRole: 'DEPARTMENT_CONTROLLER',
    origin: (
      copy.is_external ||
      copy.isExternal ||
      copy.doc_type === 'ED' ||
      copy.docType === 'ED' ||
      String(docCode).startsWith('ED-') ||
      Boolean(copy.external_doc_id || copy.externalDocId)
    ) ? 'EXTERNAL' : 'INTERNAL',
    status: 'PENDING',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: dispatchedAt,
    priority: 'HIGH'
  };
};

export const getUserActionableTasks = (tasks = [], user = null) => {
  if (!user) return [];
  return (tasks || []).filter(t => isActionableTask(t, user));
};

export const getUserTaskBadgeCount = (tasks = [], user = null) => {
  if (!user) return 0;
  const actionable = getUserActionableTasks(tasks, user);
  return actionable.filter(t => t.actionRequired !== false && !t.is_completed && t.status !== 'COMPLETED').length;
};

/**
 * Deduplicates and returns only genuine active physical copies for a given document.
 * Filters out retired, destroyed, voided, or superseded copies, and deduplicates by copy number.
 * Ensures the physical copy count and sequential numbering reflect reality.
 */
export const getActivePhysicalCopies = (copies = [], doc = null) => {
  if (!doc) return [];
  const docId = String(doc.id || '');
  const docCode = String(doc.edCode || doc.doc_code || doc.title || '');
  const docTitle = String(doc.title || '');

  // 1. Raw matches by doc id or title/code
  const rawMatches = (copies || []).filter(c => {
    const cDocId = String(c.doc_id || c.docId || c.external_doc_id || c.externalDocId || '');
    const cDocCode = String(c.doc_code || c.docCode || '');
    const cDocTitle = String(c.doc_title || c.docTitle || '');
    return (
      (docId && cDocId === docId) ||
      (docCode && (cDocCode === docCode || cDocTitle === docCode)) ||
      (docTitle && (cDocCode === docTitle || cDocTitle === docTitle))
    );
  });

  // 2. Filter out non-physical or decommissioned copies
  const inactiveStatuses = new Set([
    'RETIRED',
    'DESTROYED',
    'RECALLED_DESTROYED',
    'REPLACED_VOID',
    'VOID',
    'SUPERSEDED_ARCHIVED'
  ]);

  const physicalCandidates = rawMatches.filter(c => {
    const status = (c.status || '').toUpperCase();
    return !inactiveStatuses.has(status);
  });

  // Helper to extract numeric copy number
  const getCopyNumberInt = (c) => {
    const raw = c.copy_number ?? c.copyNumber ?? c.copy_no ?? c.copyNo ?? (c.ccNumber ? c.ccNumber.replace(/\D/g, '') : null) ?? c.copy_id;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  // 3. Deduplicate by unique copy number
  const deduplicated = physicalCandidates.reduce((acc, current) => {
    const copyNum = getCopyNumberInt(current);
    const existingIndex = acc.findIndex(item => getCopyNumberInt(item) === copyNum);
    if (existingIndex === -1) {
      acc.push(current);
    } else {
      // If a duplicate copy number is found, prioritize the active/issued instance over a pending or unconfirmed one
      const existing = acc[existingIndex];
      const isCurrentActive = current.status === 'ISSUED_ACTIVE' || current.status === 'ACTIVE';
      const isExistingActive = existing.status === 'ISSUED_ACTIVE' || existing.status === 'ACTIVE';
      if (isCurrentActive && !isExistingActive) {
        acc[existingIndex] = current;
      }
    }
    return acc;
  }, []);

  // Sort ascending by copy number
  return deduplicated.sort((a, b) => getCopyNumberInt(a) - getCopyNumberInt(b));
};

// ================= STORE ================= //
export const getInitialStoreState = () => ({
  masterUsers: MASTER_DATA_USER,
  requestUsers: REQUEST_MASTER_DATA_USER,
  reviewUsers: REVIEW_MASTER_DATA_USER,
  approveUsers: APPROVE_MASTER_DATA_USER,
  masterDepartments: MASTER_DEPARTMENTS,
  departments: MASTER_DEPARTMENTS,
  documentTypes: MASTER_DOCUMENT_TYPES,
  distributionLocations: JSON.parse(JSON.stringify(STANDARD_STATIONS.map(s => ({ ...s, status: s.status || 'ACTIVE' })))),
  signatureSettings: { ...DEFAULT_SIGNATURE_SETTINGS },
  slaSettings: { ...DEFAULT_SLA_SETTINGS },
  approvalMatrix: JSON.parse(JSON.stringify(DEFAULT_APPROVAL_MATRIX)),
  approval_matrix: JSON.parse(JSON.stringify(DEFAULT_APPROVAL_MATRIX)),
  docFormats: MOCK_DOC_FORMATS,
  dars: [],
  darRequests: [],
  tasks: [],
  timeline: [],
  documents: [],
  externalDocuments: [],
  externalRequests: [],
  externalAuditTrail: [],
  notifications: [
    {
      id: 'noti-init-sys-01',
      title: 'ยินดีต้อนรับสู่ระบบ QMS Portal',
      message: 'ระบบศูนย์ควบคุมเอกสารคุณภาพและบันทึกพร้อมให้บริการตามมาตรฐาน ISO 9001:2015',
      link: '/portal',
      type: 'INFO',
      category: 'SYSTEM',
      isGlobal: true,
      isRead: false,
      read: false,
      readBy: [],
      timestamp: new Date().toISOString()
    },
    {
      id: 'noti-init-ext-01',
      userId: 'U003',
      targetUserIds: ['U003'],
      title: 'มีเอกสารภายนอกรอการทบทวน',
      message: 'คำร้อง EDR-2026-0001 (Compendium of Methods for the Microbiological Examination of Foods) รอให้คุณดำเนินการทบทวน',
      link: '/dcc/tasks',
      type: 'TASK_ASSIGNED',
      category: 'EXTERNAL_DOC',
      isRead: false,
      read: false,
      readBy: [],
      timestamp: new Date().toISOString()
    },
    {
      id: 'noti-init-ext-02',
      userId: 'U004',
      targetUserIds: ['U004'],
      title: 'มีเอกสารภายนอกรอการอนุมัติ',
      message: 'คำร้อง EDR-2026-0002 (ประกาศกระทรวงสาธารณสุข ฉบับที่ 444 (พ.ศ. 2566)) ผ่านการทบทวนแล้ว รอให้คุณพิจารณาอนุมัติ',
      link: '/dcc/tasks',
      type: 'TASK_ASSIGNED',
      category: 'EXTERNAL_DOC',
      isRead: false,
      read: false,
      readBy: [],
      timestamp: new Date().toISOString()
    },
    {
      id: 'noti-init-ext-03',
      userId: 'U005',
      targetUserIds: ['U005'],
      title: 'คำร้องเอกสารภายนอกถูกส่งกลับแก้ไข',
      message: 'คำร้อง EDR-2026-0004 ถูกส่งกลับแก้ไขโดย กัลยาณี พลไกร: กรุณาแนบไฟล์มาตรฐานฉบับแปลภาษาไทยเพิ่มเติม',
      link: '/dcc/external/my-requests?id=EDR-2026-0004',
      type: 'ACTION_REQUIRED',
      category: 'EXTERNAL_DOC',
      isRead: false,
      read: false,
      readBy: [],
      timestamp: new Date().toISOString()
    },
    {
      id: 'noti-init-ext-04',
      userId: 'U005',
      targetUserIds: ['U005'],
      title: 'คำร้องเอกสารภายนอกได้รับการอนุมัติแล้ว',
      message: 'เอกสาร ED-QA-03 (Compendium of Methods for the Microbiological Examination of Foods) ได้รับการอนุมัติและขึ้นทะเบียนในคลังเรียบร้อยแล้ว',
      link: '/dcc/external/my-requests?id=EDR-2026-0001',
      type: 'SUCCESS',
      category: 'EXTERNAL_DOC',
      isRead: false,
      read: false,
      readBy: [],
      timestamp: new Date().toISOString()
    },
    {
      id: 'noti-init-ext-05',
      userId: 'U005',
      targetUserIds: ['U005'],
      title: 'มีสำเนาควบคุมใหม่รอตรวจรับ',
      message: 'กรุณาตรวจรับสำเนาเล่ม 01 สำหรับเอกสาร ED-QA-03',
      link: '/dcc/tasks',
      type: 'TASK_ASSIGNED',
      category: 'EXTERNAL_DOC',
      isRead: false,
      read: false,
      readBy: [],
      timestamp: new Date().toISOString()
    }
  ],
  actionLog: [],
  copyRequests: [],
  documentControlledCopies: [],
  controlledCopyInstances: [],
  controlledCopyAuditTrail: [],
  copyDispositionRecords: [],
  dispositionHistory: [],
  periodicReviewSchedules: [],
  periodicReviewTasks: [],
  periodicReviewRecords: [],
  distributionLogs: [],
  acknowledgments: [],
  darHistory: [],
  mockDateOffset: 0,
  currentUser: { 
    ...MASTER_DATA_USER[0], 
    department: 'DC', 
    depts: ['DC'], 
    primary_department: 'DC', 
    affiliated_departments: ['DC'],
    approval_level: 4 
  },
});

const useStore = create(persist((set, get) => ({
  ...getInitialStoreState(),

  // EXCLUSIVELY FOR TESTING - Resets store to deterministic initial state
  resetStore: () => set(getInitialStoreState()),

  // Auto-running EDR Number Generator
  generateNextEdrNumber: () => generateNextEdrNumber(get().externalRequests || []),

  // DEV TOOL: Factory Reset Transactions to Clean Slate (Preserving Master Data 100%)
  resetTransactionDataToCleanSlate: () => {
    set({
      dars: [],
      darRequests: [],
      tasks: [],
      timeline: [],
      documents: [],
      externalDocuments: [],
      externalRequests: [],
      externalAuditTrail: [],
      notifications: [],
      actionLog: [],
      copyRequests: [],
      documentControlledCopies: [],
      controlledCopyInstances: [],
      controlledCopyAuditTrail: [],
      copyDispositionRecords: [],
      dispositionHistory: [],
      periodicReviewSchedules: [],
      periodicReviewTasks: [],
      periodicReviewRecords: [],
      distributionLogs: [],
      acknowledgments: [],
      darHistory: []
    });

    if (typeof window !== 'undefined' && window.localStorage) {
      const storageKey = 'qms-storage-uat-v7';
      try {
        const persisted = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (persisted && persisted.state) {
          persisted.state.dars = [];
          persisted.state.darRequests = [];
          persisted.state.tasks = [];
          persisted.state.timeline = [];
          persisted.state.documents = [];
          persisted.state.externalDocuments = [];
          persisted.state.externalRequests = [];
          persisted.state.externalAuditTrail = [];
          persisted.state.notifications = [];
          persisted.state.actionLog = [];
          persisted.state.copyRequests = [];
          persisted.state.documentControlledCopies = [];
          persisted.state.controlledCopyInstances = [];
          persisted.state.controlledCopyAuditTrail = [];
          persisted.state.copyDispositionRecords = [];
          persisted.state.dispositionHistory = [];
          persisted.state.periodicReviewSchedules = [];
          persisted.state.periodicReviewTasks = [];
          persisted.state.periodicReviewRecords = [];
          persisted.state.distributionLogs = [];
          persisted.state.acknowledgments = [];
          persisted.state.darHistory = [];
          localStorage.setItem(storageKey, JSON.stringify(persisted));
        }
      } catch (err) {
        console.error('Failed to reset persisted storage:', err);
      }
    }
  },

  // DEV TOOL: Seed comprehensive QA workflow mock data (for manual testing & UAT)
  seedComprehensiveQaMockData: () => {
    const seed = getMockQaSeedData();
    set(state => ({
      ...state,
      ...seed
    }));

    if (typeof window !== 'undefined' && window.localStorage) {
      const storageKey = 'qms-storage-uat-v7';
      try {
        const persisted = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (persisted && persisted.state) {
          Object.assign(persisted.state, seed);
          localStorage.setItem(storageKey, JSON.stringify(persisted));
        }
      } catch (err) {
        console.error('Failed to persist seeded mock data:', err);
      }
    }
  },

  setMockDateOffset: (days) => set({ mockDateOffset: days }),

  initializePeriodicReviews: () => set(state => {
    if (state.periodicReviewSchedules && state.periodicReviewSchedules.length > 0) return state;
    const schedules = generateSchedules(state.documents || [], state.externalDocuments || [], []);
    const tasks = generateTasksForSchedules(schedules, []);
    return { periodicReviewSchedules: schedules, periodicReviewTasks: tasks };
  }),

  submitPeriodicReview: (scheduleId, outcome, comment, linkedActionId = null, linkageStatus = null, idempotencyKey = null) => set(state => {
    const schedules = [...state.periodicReviewSchedules];
    const tasks = [...state.periodicReviewTasks];
    const records = [...(state.periodicReviewRecords || [])];
    
    const scheduleIndex = schedules.findIndex(s => s.id === scheduleId);
    if (scheduleIndex === -1) return state;
    
    const schedule = { ...schedules[scheduleIndex] };
    
    // Find active task
    const taskIndex = tasks.findIndex(t => t.scheduleId === scheduleId && t.status === 'ACTION_REQUIRED');
    if (taskIndex !== -1) {
      tasks[taskIndex] = { ...tasks[taskIndex], status: 'COMPLETED', updatedAt: new Date().toISOString() };
    }

    let newStatus = 'COMPLETED';
    let requiresLinkedAction = false;

    if (outcome === 'REVISION_REQUIRED' || outcome === 'OBSOLETE_REQUIRED') {
      newStatus = 'IN_PROGRESS';
      requiresLinkedAction = true;
    } else if (outcome === 'NO_CHANGE') {
      newStatus = 'COMPLETED';
    }

    schedule.status = newStatus;
    schedule.outcome = outcome; // Save outcome
    if (linkedActionId) schedule.linkedActionId = linkedActionId;
    if (linkageStatus) schedule.linkageStatus = linkageStatus;
    if (idempotencyKey) schedule.idempotencyKey = idempotencyKey;
    
    // Clear due state as action is taken
    schedule.dueState = 'NOT_YET_DUE';
    schedule.updatedAt = new Date().toISOString();
    
    if (!requiresLinkedAction) {
      schedule.currentScheduledReviewDate = calculateNextReviewDate(schedule.originalReviewAnchorDate, schedule.frequencyMonths, new Date());
      schedule.nextReviewDate = schedule.currentScheduledReviewDate;
      // Also reset status back to upcoming for next cycle if it's completed entirely
      schedule.status = 'UPCOMING';
    }

    schedules[scheduleIndex] = schedule;

    records.push({
      id: `PRR-${Date.now()}`,
      scheduleId,
      outcome,
      comment,
      linkedActionId,
      reviewedByUserId: state.currentUser.id,
      reviewedAt: new Date().toISOString()
    });

    return {
      periodicReviewSchedules: schedules,
      periodicReviewTasks: tasks,
      periodicReviewRecords: records,
      actionLog: [{
        id: `LOG-${Date.now()}`,
        actionType: 'PERIODIC_REVIEW_SUBMITTED',
        details: `Periodic review submitted for ${schedule.documentNumber} with outcome ${outcome}`,
        actor: state.currentUser.name,
        actorId: state.currentUser.id,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  retryPeriodicReviewLinkage: (scheduleId, newLinkedActionId) => set(state => {
    const schedules = [...state.periodicReviewSchedules];
    const scheduleIndex = schedules.findIndex(s => s.id === scheduleId);
    if (scheduleIndex === -1) return state;
    
    schedules[scheduleIndex] = { 
      ...schedules[scheduleIndex], 
      linkedActionId: newLinkedActionId, 
      linkageStatus: 'SUCCESS',
      updatedAt: new Date().toISOString()
    };
    return { periodicReviewSchedules: schedules };
  }),
  // --- Narrow Dependency-Injection Seam for Testing Real Workflow ---
  // Safe because these methods only orchestrate existing actions and are explicitly designed to take adapter dependencies
  submitPeriodicReviewWithDarAction: (scheduleId, outcome, comment, darPayload, darAdapter) => {
    const store = get();
    const idempotencyKey = `PERIODIC_REVIEW_${scheduleId}_${outcome}`;
    try {
      const newLinkedId = darAdapter(darPayload);
      store.submitPeriodicReview(scheduleId, outcome, comment, newLinkedId, 'SUCCESS', idempotencyKey);
    } catch {
      store.submitPeriodicReview(scheduleId, outcome, comment, null, 'FAILED', idempotencyKey);
    }
  },

  retryPeriodicReviewLinkageWithDarAction: (scheduleId, darPayload, darAdapter) => {
    const store = get();
    const schedule = store.periodicReviewSchedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    
    // Check idempotency visually
    if (schedule.linkedActionId && schedule.linkageStatus === 'SUCCESS') return;

    try {
      const newLinkedId = darAdapter(darPayload);
      store.retryPeriodicReviewLinkage(scheduleId, newLinkedId);
    } catch {
      // Intentionally swallow to maintain FAILED state
    }
  },
  // --- Periodic Review DAR Linkage Service Wrappers ---
  createOrGetLinkedDarDraft: (reviewId, outcome, darPayload) => {
    const schedule = get().periodicReviewSchedules.find(s => s.id === reviewId);
    if (!schedule) throw new Error('Schedule not found');
    return createOrGetLinkedDarDraft(schedule, outcome, darPayload, get);
  },

  validateLinkedDarSource: (draft) => {
    return validateLinkedDarSource(draft, get);
  },

  resolveLockedSourceDocument: (draft) => {
    return resolveLockedSourceDocument(draft, get);
  },

  getLinkedActionStatus: (darStatus) => {
    return getLinkedActionStatus(darStatus);
  },

  syncRevisionEffective: (dar) => {
    syncRevisionEffective(dar, get, set);
  },

  syncObsoleteCompleted: (dar) => {
    syncObsoleteCompleted(dar, get, set);
  },
  
  // Document Access Verification Engine (Auto-whitelisting for Workflow Participants & Admins)
  canUserAccessDocument: (doc, user) => canUserAccessDocument(doc, user || get().currentUser),
  // ------------------------------------------------------------------

  // Default user is DCC Admin (U001 - ธนาวุฒิ)
  currentUser: { 
    ...MASTER_DATA_USER[0], 
    department: 'DC', 
    departments: ['DC'],
    secondaryDepartments: [],
    depts: ['DC'],
    primary_department: 'DC',
    affiliated_departments: ['DC']
  },

  setCurrentUser: (userId) => set((state) => {
    const baseUser = state.masterUsers.find(u => u.id === userId || u.empId === userId);
    if (!baseUser) return state;

    // Find departments from any of the lists
    const req = state.requestUsers.find(u => u.id === userId || u.empId === userId);
    const rev = state.reviewUsers.find(u => u.id === userId || u.empId === userId);
    const app = state.approveUsers.find(u => u.id === userId || u.empId === userId);
    const depts = baseUser.depts || req?.depts || rev?.depts || app?.depts || (baseUser.department ? [baseUser.department] : ['DC']);

    // The primary active department
    const userDeptsList = Array.isArray(baseUser.departments) ? baseUser.departments : (Array.isArray(depts) ? depts : [baseUser.department].filter(Boolean));
    const activeDept = baseUser.primary_department || baseUser.department || userDeptsList[0] || 'DC';
    const secondaryDepts = baseUser.secondaryDepartments || (Array.isArray(baseUser.affiliated_departments) ? baseUser.affiliated_departments.filter(d => d !== activeDept) : userDeptsList.filter(d => d !== activeDept));
    const permissions = (baseUser.permissions && baseUser.permissions.length > 0)
      ? baseUser.permissions
      : ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'];

    return { 
      currentUser: { 
        ...baseUser, 
        department: activeDept, 
        primary_department: activeDept, 
        departments: userDeptsList,
        secondaryDepartments: secondaryDepts,
        depts,
        permissions,
        canCreateDar: baseUser.canCreateDar !== undefined ? Boolean(baseUser.canCreateDar) : true,
        canAccessTasks: baseUser.canAccessTasks !== undefined ? Boolean(baseUser.canAccessTasks) : true,
        canViewRegister: baseUser.canViewRegister !== undefined ? Boolean(baseUser.canViewRegister) : true,
        isWorkflowUser: baseUser.isWorkflowUser !== undefined ? Boolean(baseUser.isWorkflowUser) : true
      }
    };
  }),

  logAction: (logEntry, maybeDetails) => set((state) => {
    let actionType = 'ACTIVITY';
    let details = '-';
    let actor = state.currentUser?.name || 'System';
    let actorId = state.currentUser?.id || 'SYSTEM';
    let actorRole = state.currentUser?.role || state.currentUser?.position || 'User';
    let category = 'SYSTEM';
    let timestamp = new Date().toISOString();

    if (typeof logEntry === 'string') {
      actionType = logEntry;
      details = maybeDetails !== undefined ? maybeDetails : '-';
    } else if (typeof logEntry === 'object' && logEntry !== null) {
      actionType = logEntry.actionType || logEntry.action || logEntry.action_type || 'ACTIVITY';
      details = logEntry.details || logEntry.detail || logEntry.remarks || logEntry.remark || logEntry.comment || '-';
      actor = logEntry.actor || logEntry.user || logEntry.actorName || logEntry.userName || state.currentUser?.name || 'System';
      actorId = logEntry.actorId || logEntry.userId || logEntry.user_id || state.currentUser?.id || 'SYSTEM';
      actorRole = logEntry.actorRole || logEntry.role || logEntry.user_role || state.currentUser?.role || 'User';
      category = logEntry.category || 'SYSTEM';
      timestamp = logEntry.timestamp || logEntry.created_at || logEntry.createdAt || logEntry.date || logEntry.time || new Date().toISOString();
    }

    const newLog = {
      id: (typeof logEntry === 'object' && logEntry?.id) ? logEntry.id : `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      actionType,
      action: actionType,
      action_type: actionType,
      details,
      actor,
      user: actor,
      actorId,
      user_id: actorId,
      actorRole,
      role: actorRole,
      user_role: actorRole,
      category,
      timestamp,
      created_at: timestamp,
      createdAt: timestamp,
      date: timestamp,
      rawDate: timestamp
    };

    return {
      actionLog: [newLog, ...(state.actionLog || [])]
    };
  }),

  addNotification: (arg1, arg2, arg3, arg4, arg5, arg6, arg7) => set(state => {
    let notifObj = {};
    if (typeof arg1 === 'object' && arg1 !== null) {
      notifObj = { ...arg1 };
    } else {
      notifObj = {
        userId: arg1,
        title: arg2,
        message: arg3,
        link: arg4,
        relatedTaskId: arg5,
        category: arg6,
        ...(arg7 || {})
      };
    }

    const title = notifObj.title || 'การแจ้งเตือน';
    const message = notifObj.message || notifObj.description || '';
    const nowIso = new Date().toISOString();

    const cat = notifObj.category || (
      title.includes('DAR') || notifObj.docCode?.includes('DAR') ? 'DAR' :
      (title.includes('เอกสารภายนอก') || notifObj.link?.includes('external') || notifObj.docCode?.startsWith('ED')) ? 'EXTERNAL_DOC' :
      (title.includes('สำเนา') || title.includes('ทดแทน') || title.includes('เรียกคืน')) ? 'CONTROLLED_COPY' :
      'SYSTEM'
    );

    const type = notifObj.type || (
      title.includes('รอการ') || title.includes('งานใหม่') || title.includes('ภาระงาน') ? 'TASK_ASSIGNED' :
      title.includes('ปฏิเสธ') || title.includes('ไม่ผ่าน') ? 'REJECTED' :
      title.includes('ส่งกลับ') ? 'ACTION_REQUIRED' :
      title.includes('สำเร็จ') || title.includes('อนุมัติแล้ว') ? 'SUCCESS' :
      title.includes('ยกเลิก') ? 'OBSOLETE' :
      'INFO'
    );

    const newEntry = {
      id: notifObj.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: notifObj.userId || notifObj.user_id || null,
      user_id: notifObj.userId || notifObj.user_id || null,
      targetUserIds: Array.isArray(notifObj.targetUserIds) ? notifObj.targetUserIds : (notifObj.userId ? [notifObj.userId] : []),
      targetDepartment: notifObj.targetDepartment || notifObj.department || null,
      isGlobal: Boolean(notifObj.isGlobal || notifObj.global),
      title,
      message,
      description: message,
      type,
      category: cat,
      docCode: notifObj.docCode || notifObj.doc_code || null,
      refId: notifObj.refId || notifObj.referenceId || null,
      link: notifObj.link || '/tasks',
      isRead: false,
      read: false,
      readBy: [],
      timestamp: notifObj.timestamp || nowIso,
      createdAt: notifObj.createdAt || nowIso,
      created_at: notifObj.created_at || nowIso,
      relatedTaskId: notifObj.relatedTaskId || null
    };

    return {
      notifications: [newEntry, ...(state.notifications || [])]
    };
  }),
  markNotificationAsReadByTaskId: (taskId, userId) => set(state => {
    const currentUserId = userId || state.currentUser?.id;
    return {
      notifications: (state.notifications || []).map(n => {
        if (String(n.relatedTaskId) === String(taskId)) {
          const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
          if (currentUserId && !readBy.includes(currentUserId)) {
            readBy.push(currentUserId);
          }
          return { ...n, isRead: true, read: true, readBy };
        }
        return n;
      })
    };
  }),
  markNotificationAsRead: (id, userId) => set(state => {
    const currentUserId = userId || state.currentUser?.id;
    return {
      notifications: (state.notifications || []).map(n => {
        if (String(n.id) === String(id)) {
          const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
          if (currentUserId && !readBy.includes(currentUserId)) {
            readBy.push(currentUserId);
          }
          return { ...n, isRead: true, read: true, readBy };
        }
        return n;
      })
    };
  }),
  markAsRead: (id, userId) => set(state => {
    const currentUserId = userId || state.currentUser?.id;
    return {
      notifications: (state.notifications || []).map(n => {
        if (String(n.id) === String(id)) {
          const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
          if (currentUserId && !readBy.includes(currentUserId)) {
            readBy.push(currentUserId);
          }
          return { ...n, isRead: true, read: true, readBy };
        }
        return n;
      })
    };
  }),
  markAllNotificationsAsRead: (userId) => set(state => {
    const currentUserId = userId || state.currentUser?.id;
    return {
      notifications: (state.notifications || []).map(n => {
        const isVisible = !currentUserId || isNotificationVisibleToUser(n, state.currentUser || { id: currentUserId });
        if (isVisible) {
          const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
          if (currentUserId && !readBy.includes(currentUserId)) {
            readBy.push(currentUserId);
          }
          return { ...n, isRead: true, read: true, readBy };
        }
        return n;
      })
    };
  }),
  markAllAsRead: (userId) => set(state => {
    const currentUserId = userId || state.currentUser?.id;
    return {
      notifications: (state.notifications || []).map(n => {
        const isVisible = !currentUserId || isNotificationVisibleToUser(n, state.currentUser || { id: currentUserId });
        if (isVisible) {
          const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
          if (currentUserId && !readBy.includes(currentUserId)) {
            readBy.push(currentUserId);
          }
          return { ...n, isRead: true, read: true, readBy };
        }
        return n;
      })
    };
  }),
  clearNotifications: (userId) => set(state => ({
    notifications: userId ? (state.notifications || []).filter(n => n.userId !== userId && n.user_id !== userId) : []
  })),
  pruneOldNotifications: () => set(state => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    return {
      notifications: (state.notifications || []).filter(
        n => (!n.isRead && !n.read) || ((n.created_at || n.createdAt || n.timestamp) && (n.created_at || n.createdAt || n.timestamp) >= ninetyDaysAgo)
      )
    };
  }),

  registerExternalDoc: (doc) => set((state) => {
    const dept = doc.department || doc.dept || (state.currentUser ? (state.currentUser.department || 'QA/QC') : 'QA/QC');
    const edType = (state.documentTypes || []).find(t => t.code === 'ED' || t.id === 'ED');
    const pattern = edType?.namingPattern || 'ED-{Dept}-{##}';
    const nextSeq = calculateNextExternalDocSequence(dept, state.externalDocuments);
    const seqNum = formatDocumentRunningNumber(nextSeq);
    const edCode = doc.edCode || doc.doc_code || doc.docNo || pattern
      .replace('{Type}', 'ED')
      .replace('{Dept}', dept)
      .replace('{###}', seqNum)
      .replace('{##}', seqNum);
    const newId = doc.id || edCode || `EXT-${Date.now()}`;

    // Review Cycle & Validity
    const reviewCycleMonths = Number(doc.reviewCycleMonths) || 12;
    const effectiveDate = doc.effectiveDate || new Date().toISOString().split('T')[0];
    const effDateObj = new Date(effectiveDate);
    effDateObj.setMonth(effDateObj.getMonth() + reviewCycleMonths);
    const nextReviewDate = doc.nextReviewDate || effDateObj.toISOString().split('T')[0];

    let initialStatus = 'ACTIVE';
    let newTasks = [...state.tasks];
    let newNotifications = [...state.notifications];

    const ownerId = doc.ownerId || (state.currentUser ? state.currentUser.id : 'U001');
    const requesterName = state.currentUser?.fullName || state.currentUser?.name || doc.ownerName || 'User';

    const requestId = doc.requestNo || doc.requestId || doc.edrNumber || generateNextEdrNumber(state.externalRequests || []);

    if (doc.reviewerId) {
      initialStatus = 'PENDING_EXT_REVIEW';
      newTasks.push({
        id: `extt-${Date.now()}-rev`,
        referenceType: 'EXTERNAL_DOC',
        referenceId: newId,
        docId: newId,
        docCode: edCode,
        doc_code: edCode,
        docTitle: doc.title,
        docName: doc.title,
        title: `${edCode}: ${doc.title}`,
        type: 'EXTERNAL_REVIEW',
        taskType: 'EXTERNAL_REVIEW',
        assigneeId: doc.reviewerId,
        requesterId: ownerId,
        requesterName: requesterName,
        requesterDepartment: dept,
        department: dept,
        origin: 'EXTERNAL',
        status: 'PENDING',
        extAction: 'REGISTER'
      });
      newNotifications.push({
        id: `notif-ext-rev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: doc.reviewerId,
        targetUserIds: [doc.reviewerId],
        title: 'มีเอกสารภายนอกรอการทบทวน',
        message: `คำร้อง ${requestId} (${doc.title}) รอให้คุณดำเนินการทบทวน`,
        link: '/dcc/tasks',
        type: 'TASK_ASSIGNED',
        category: 'EXTERNAL_DOC',
        isRead: false,
        read: false,
        readBy: [],
        timestamp: new Date().toISOString(),
        docCode: edCode,
        refId: requestId
      });
    } else if (doc.approverId) {
      initialStatus = 'PENDING_EXT_APPROVAL';
      newTasks.push({
        id: `extt-${Date.now()}-app`,
        referenceType: 'EXTERNAL_DOC',
        referenceId: newId,
        docId: newId,
        docCode: edCode,
        doc_code: edCode,
        docTitle: doc.title,
        docName: doc.title,
        title: `${edCode}: ${doc.title}`,
        type: 'EXTERNAL_APPROVAL',
        taskType: 'EXTERNAL_APPROVAL',
        assigneeId: doc.approverId,
        requesterId: ownerId,
        requesterName: requesterName,
        requesterDepartment: dept,
        department: dept,
        origin: 'EXTERNAL',
        status: 'PENDING',
        extAction: 'REGISTER'
      });
      newNotifications.push({
        id: `notif-ext-app-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: doc.approverId,
        targetUserIds: [doc.approverId],
        title: 'มีเอกสารภายนอกรอการอนุมัติ',
        message: `คำร้อง ${requestId} (${doc.title}) รอให้คุณดำเนินการพิจารณาอนุมัติ`,
        link: '/dcc/tasks',
        type: 'TASK_ASSIGNED',
        category: 'EXTERNAL_DOC',
        isRead: false,
        read: false,
        readBy: [],
        timestamp: new Date().toISOString(),
        docCode: edCode,
        refId: requestId
      });
    }

    if (initialStatus === 'ACTIVE' && doc.acknowledgees && doc.acknowledgees.length > 0) {
      doc.acknowledgees.forEach(uid => {
        newTasks.push({
          id: `extt-${Date.now()}-ack-${uid}`,
          referenceType: 'EXTERNAL_DOC',
          referenceId: newId,
          docCode: edCode,
          doc_code: edCode,
          docTitle: doc.title,
          docName: doc.title,
          title: `${edCode}: ${doc.title}`,
          type: 'Ack',
          assigneeId: uid,
          origin: 'EXTERNAL',
          status: 'PENDING'
        });
        newNotifications.push({ id: Date.now() + Math.random(), userId: uid, title: 'โปรดรับทราบเอกสาร', message: `เอกสารภายนอก "${edCode} - ${doc.title}" บังคับใช้แล้ว โปรดรับทราบ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
      });
    }

    // Handle Physical Controlled Copies on Demand (if requested and immediately ACTIVE)
    const stations = doc.distributions || doc.physical_distribution || [];
    let newCreatedCopies = [];
    if (initialStatus === 'ACTIVE' && stations.length > 0) {
      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split('T')[0];
      newCreatedCopies = stations.map((station, index) => {
        const copyNoStr = String(index + 1).padStart(2, '0');
        const ccNumStr = `CC-${String(index + 1).padStart(3, '0')}`;
        const holderDept = station.departmentId || station.dept_code || station.dept || dept;
        const locName = station.locationName || station.station_name || station.name || station.location || `${holderDept} Head Office`;
        const locId = station.locationId || station.station_id || station.id || `${holderDept}-LOC-${index + 1}`;
        return {
          id: `cc-ext-${newId}-${copyNoStr}`,
          doc_id: newId,
          docId: newId,
          external_doc_id: newId,
          externalDocId: newId,
          doc_code: edCode,
          docCode: edCode,
          doc_title: doc.title,
          docTitle: doc.title,
          doc_type: 'ED',
          docType: 'ED',
          docName: doc.title,
          doc_version: doc.rev || '00',
          rev: doc.rev || '00',
          copy_no: copyNoStr,
          copyNo: copyNoStr,
          ccNumber: ccNumStr,
          issue_no: '01',
          issueNumber: 'I01',
          holder_dept: holderDept,
          department: holderDept,
          departmentId: holderDept,
          dept_code: holderDept,
          holder_name: `${holderDept} (${locName})`,
          location: locName,
          locationName: locName,
          locationId: locId,
          station_id: locId,
          station_name: locName,
          status: 'PENDING_ISSUE',
          is_replacement: false,
          is_adhoc: false,
          is_external: true,
          isExternal: true,
          requested_by: state.currentUser?.name || 'Owner Department',
          requested_at: nowIso,
          dateIssued: todayStr
        };
      });

      newTasks.push({
        id: `task-dcc-issue-ext-${newId}-${Date.now()}`,
        referenceType: 'EXTERNAL_DOC',
        type: 'DCC_DISTRIBUTE',
        taskType: 'DCC_ISSUE_CONTROLLED_COPIES',
        title: `จัดพิมพ์และส่งมอบสำเนาควบคุมเอกสารภายนอก: ${edCode} (${stations.length} จุด)`,
        description: `มีคำขอสำเนาควบคุมสำหรับเอกสารภายนอก ${edCode} จำนวน ${stations.length} เล่ม กรุณาจัดพิมพ์และแจกจ่าย`,
        docId: newId,
        externalDocId: newId,
        doc_code: edCode,
        docCode: edCode,
        docTitle: doc.title,
        docName: doc.title,
        department: 'DC',
        target_department: 'DC',
        doc_version: doc.rev || '00',
        assigneeId: resolveDccAdminUserId(state.masterUsers),
        assignedToRole: 'DCC_ADMIN',
        targetRole: 'DCC_ADMIN',
        target_role: 'DCC_ADMIN',
        origin: 'EXTERNAL',
        status: 'PENDING',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: nowIso
      });
    }

    const issuerValue = doc.issuer || doc.officialIssuer || doc.source || '';
    const newExternalDoc = {
      ...doc,
      id: newId,
      doc_code: edCode,
      docNo: edCode,
      edCode,
      department: dept,
      status: initialStatus,
      ownerId: state.currentUser ? state.currentUser.id : 'U001',
      rev: doc.rev || '00',
      source: issuerValue,
      issuer: issuerValue,
      officialIssuer: issuerValue,
      distributions: stations,
      physical_distribution: stations,
      is_physical_copy: Boolean(doc.is_physical_copy || doc.isPhysicalCopy || stations.length > 0),
      reviewCycleMonths,
      nextReviewDate,
      requestId,
      edrNumber: requestId,
      changeReason: doc.reason || doc.changeReason || 'ขึ้นทะเบียนเอกสารภายนอกใหม่',
      createdAt: new Date().toISOString()
    };

    const prevCopies = state.documentControlledCopies || state.controlledCopyInstances || [];
    const finalCopies = [...prevCopies, ...newCreatedCopies];

    const reviewerObj = (state.masterUsers || []).find(u => u.id === doc.reviewerId);
    const approverObj = (state.masterUsers || []).find(u => u.id === doc.approverId);
    const nowIso = new Date().toISOString();

    const newExternalRequest = {
      id: requestId,
      requestId,
      requestNo: requestId,
      edrNumber: requestId,
      docId: newId,
      documentId: newId,
      externalDocId: newId,
      edCode,
      doc_code: edCode,
      docCode: edCode,
      documentCode: edCode,
      title: doc.title,
      source: issuerValue,
      issuer: issuerValue,
      officialIssuer: issuerValue,
      sourceVersion: doc.sourceVersion || doc.edition || '',
      requestType: 'NEW',
      rev: doc.rev || '00',
      effectiveDate: effectiveDate,
      nextReviewDate: nextReviewDate,
      reviewCycleMonths: reviewCycleMonths,
      department: dept,
      requesterId: ownerId,
      requesterName,
      requesterDepartment: dept,
      requesterRole: state.currentUser?.position || state.currentUser?.role || 'Requester',
      reviewerId: doc.reviewerId || null,
      reviewerName: reviewerObj ? (reviewerObj.fullName || reviewerObj.name) : null,
      reviewerRole: reviewerObj?.position || 'Reviewer',
      approverId: doc.approverId || null,
      approverName: approverObj ? (approverObj.fullName || approverObj.name) : null,
      approverRole: approverObj?.position || 'Approver',
      status: initialStatus,
      returnReason: null,
      revisionComment: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      signoffs: [
        {
          step: 'REQUEST',
          stepName: 'ยื่นคำร้อง',
          role: 'ผู้ยื่นคำร้อง',
          userId: ownerId,
          userName: requesterName,
          userRole: state.currentUser?.position || 'Requester',
          status: 'COMPLETED',
          date: nowIso,
          comment: doc.reason || 'ยื่นคำร้องขอขึ้นทะเบียนเอกสารภายนอกใหม่'
        },
        {
          step: 'REVIEW',
          stepName: 'ทบทวนเอกสาร',
          role: 'ผู้ทบทวน',
          userId: doc.reviewerId || null,
          userName: reviewerObj ? (reviewerObj.fullName || reviewerObj.name) : '-',
          userRole: reviewerObj?.position || 'Reviewer',
          status: doc.reviewerId ? 'PENDING' : 'SKIPPED',
          date: null,
          comment: null
        },
        {
          step: 'APPROVE',
          stepName: 'อนุมัติเอกสาร',
          role: 'ผู้อนุมัติ',
          userId: doc.approverId || null,
          userName: approverObj ? (approverObj.fullName || approverObj.name) : '-',
          userRole: approverObj?.position || 'Approver',
          status: doc.approverId ? (doc.reviewerId ? 'WAITING' : 'PENDING') : 'SKIPPED',
          date: null,
          comment: null
        }
      ]
    };

    return {
      externalDocuments: initialStatus === 'ACTIVE' ? [newExternalDoc, ...state.externalDocuments] : state.externalDocuments,
      externalRequests: [newExternalRequest, ...(state.externalRequests || [])],
      documentControlledCopies: finalCopies,
      controlledCopyInstances: finalCopies,
      tasks: newTasks,
      notifications: newNotifications,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'EXT_DOC_REGISTER',
        details: `Registered new external document: ${edCode} - ${doc.title}`,
        actor: state.currentUser?.name || 'User',
        actorId: state.currentUser?.id || 'U001',
        actorRole: state.currentUser?.role || state.currentUser?.position,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])],
      externalAuditTrail: [{
        id: `EXTA-${Date.now()}`,
        docId: newId,
        docTitle: doc.title,
        docCode: edCode,
        action: 'REGISTER',
        actor: state.currentUser?.name || 'User',
        actorId: state.currentUser?.id || 'U001',
        date: new Date().toISOString(),
        details: `Registered external document ${edCode} (Status: ${initialStatus})`
      }, ...state.externalAuditTrail]
    };
  }),

  // Triggered when requesting to Update an existing document (create new revision)
  updateExternalDoc: (id, updates) => set((state) => {
    const oldDoc = state.externalDocuments.find(d => d.id === id || d.edCode === id || d.doc_code === id);
    if (!oldDoc) return state;

    const currentRevNum = parseInt(String(oldDoc.rev || oldDoc.revision || '0').replace(/\D/g, '') || '0', 10);
    const originalRevStr = updates.originalRevision ? String(updates.originalRevision).replace(/\D/g, '').padStart(2, '0') : String(currentRevNum).padStart(2, '0');
    const targetRevNum = updates.targetRevision ? parseInt(String(updates.targetRevision).replace(/\D/g, '') || '1', 10) : (currentRevNum + 1);
    const targetRevStr = String(targetRevNum).padStart(2, '0');
    const newRevStr = targetRevStr;

    const reviewCycleMonths = Number(updates.reviewCycleMonths || oldDoc.reviewCycleMonths) || 12;
    const effectiveDate = updates.effectiveDate || oldDoc.effectiveDate || new Date().toISOString().split('T')[0];
    const effDateObj = new Date(effectiveDate);
    effDateObj.setMonth(effDateObj.getMonth() + reviewCycleMonths);
    const nextReviewDate = updates.nextReviewDate || effDateObj.toISOString().split('T')[0];

    const edCode = oldDoc.edCode || oldDoc.doc_code || oldDoc.docNo || id;
    const newId = `EXT-${Date.now()}`;
    const issuerValue = updates.issuer || updates.officialIssuer || updates.source || oldDoc.issuer || oldDoc.officialIssuer || oldDoc.source || '';

    const ownerId = updates.ownerId || oldDoc.ownerId || (state.currentUser ? state.currentUser.id : 'U001');
    const requesterName = state.currentUser?.fullName || state.currentUser?.name || updates.ownerName || oldDoc.ownerName || 'User';

    const requestId = updates.requestNo || updates.requestId || updates.edrNumber || generateNextEdrNumber(state.externalRequests || []);

    const newDoc = {
      ...oldDoc,
      ...updates,
      id: newId,
      edCode,
      doc_code: edCode,
      docNo: edCode,
      rev: newRevStr,
      revision: `Rev.${newRevStr}`,
      source: issuerValue,
      issuer: issuerValue,
      officialIssuer: issuerValue,
      status: 'PENDING_EXT_REVIEW',
      previousDocId: oldDoc.id,
      reviewCycleMonths,
      nextReviewDate,
      requestId,
      edrNumber: requestId,
      changeReason: updates.reason || updates.changeReason || '-',
      requesterName,
      updatedAt: new Date().toISOString()
    };

    const newTasks = [...state.tasks];
    const newNotifications = [...state.notifications];

    if (newDoc.reviewerId) {
      newTasks.push({
        id: `extt-${Date.now()}-rev`,
        referenceType: 'EXTERNAL_DOC',
        referenceId: newId,
        docId: newId,
        docCode: edCode,
        doc_code: edCode,
        docTitle: newDoc.title,
        docName: newDoc.title,
        title: `${edCode}: ${newDoc.title} (Rev.${newRevStr})`,
        type: 'EXTERNAL_REVIEW',
        taskType: 'EXTERNAL_REVIEW',
        assigneeId: newDoc.reviewerId,
        requesterId: ownerId,
        requesterName: requesterName,
        requesterDepartment: newDoc.department,
        department: newDoc.department,
        origin: 'EXTERNAL',
        status: 'PENDING',
        extAction: 'UPDATE'
      });
      newNotifications.push({
        id: Date.now() + Math.random(),
        userId: newDoc.reviewerId,
        title: 'มีเอกสารภายนอกรอการทบทวน',
        message: `คำร้อง ${requestId} (${newDoc.title}) รอให้คุณดำเนินการทบทวน`,
        link: '/dcc/tasks',
        type: 'TASK_ASSIGNED',
        category: 'EXTERNAL_DOC',
        isRead: false,
        read: false,
        timestamp: new Date().toISOString()
      });
    } else {
      newDoc.status = 'PENDING_EXT_APPROVAL';
      newTasks.push({
        id: `extt-${Date.now()}-app`,
        referenceType: 'EXTERNAL_DOC',
        referenceId: newId,
        docId: newId,
        docCode: edCode,
        doc_code: edCode,
        docTitle: newDoc.title,
        docName: newDoc.title,
        title: `${edCode}: ${newDoc.title} (Rev.${newRevStr})`,
        type: 'EXTERNAL_APPROVAL',
        taskType: 'EXTERNAL_APPROVAL',
        assigneeId: newDoc.approverId,
        requesterId: ownerId,
        requesterName: requesterName,
        requesterDepartment: newDoc.department,
        department: newDoc.department,
        origin: 'EXTERNAL',
        status: 'PENDING',
        extAction: 'UPDATE'
      });
      newNotifications.push({
        id: Date.now() + Math.random(),
        userId: newDoc.approverId,
        title: 'มีเอกสารภายนอกรอการอนุมัติ',
        message: `คำร้อง ${requestId} (${newDoc.title}) รอให้คุณดำเนินการพิจารณาอนุมัติ`,
        link: '/dcc/tasks',
        type: 'TASK_ASSIGNED',
        category: 'EXTERNAL_DOC',
        isRead: false,
        read: false,
        timestamp: new Date().toISOString()
      });
    }
    const targetRevId = newDoc.reviewerId;
    const targetAppId = newDoc.approverId;
    const reviewerObj = (state.masterUsers || []).find(u => u.id === targetRevId);
    const approverObj = (state.masterUsers || []).find(u => u.id === targetAppId);
    const nowIso = new Date().toISOString();

    const newExternalRequest = {
      id: requestId,
      requestId,
      requestNo: requestId,
      edrNumber: requestId,
      docId: newId,
      documentId: newId,
      externalDocId: newId,
      previousDocId: oldDoc.id,
      edCode,
      doc_code: edCode,
      docCode: edCode,
      documentCode: edCode,
      title: newDoc.title,
      source: issuerValue,
      issuer: issuerValue,
      officialIssuer: issuerValue,
      sourceVersion: updates.sourceVersion || updates.edition || oldDoc.sourceVersion || oldDoc.edition || '',
      requestType: 'REVISION',
      type: 'REVISION',
      actionType: 'REVISION',
      extAction: 'UPDATE',
      originalRevision: originalRevStr,
      targetRevision: targetRevStr,
      rev: targetRevStr,
      revision: `Rev.${targetRevStr}`,
      effectiveDate: effectiveDate,
      nextReviewDate: nextReviewDate,
      reviewCycleMonths: reviewCycleMonths,
      accessScope: updates.accessScope || oldDoc.accessScope || 'General',
      accessDepartments: updates.accessDepartments || oldDoc.accessDepartments || [],
      accessUsers: updates.accessUsers || oldDoc.accessUsers || [],
      reason: updates.reason || '',
      changeReason: updates.reason || updates.changeReason || '',
      department: newDoc.department,
      requesterId: ownerId,
      requesterName,
      requesterDepartment: newDoc.department,
      requesterRole: state.currentUser?.position || state.currentUser?.role || 'Requester',
      reviewerId: targetRevId || null,
      reviewerName: reviewerObj ? (reviewerObj.fullName || reviewerObj.name) : null,
      reviewerRole: reviewerObj?.position || 'Reviewer',
      approverId: targetAppId || null,
      approverName: approverObj ? (approverObj.fullName || approverObj.name) : null,
      approverRole: approverObj?.position || 'Approver',
      status: targetRevId ? 'PENDING_EXT_REVIEW' : 'PENDING_EXT_APPROVAL',
      returnReason: null,
      revisionComment: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      signoffs: [
        {
          step: 'REQUEST',
          stepName: 'ยื่นคำร้อง',
          role: 'ผู้ยื่นคำร้อง',
          userId: ownerId,
          userName: requesterName,
          userRole: state.currentUser?.position || 'Requester',
          status: 'COMPLETED',
          date: nowIso,
          comment: updates.reason || `ขอปรับปรุงเอกสารฉบับใหม่เป็น Rev.${newRevStr}`
        },
        {
          step: 'REVIEW',
          stepName: 'ทบทวนเอกสาร',
          role: 'ผู้ทบทวน',
          userId: targetRevId || null,
          userName: reviewerObj ? (reviewerObj.fullName || reviewerObj.name) : '-',
          userRole: reviewerObj?.position || 'Reviewer',
          status: targetRevId ? 'PENDING' : 'SKIPPED',
          date: null,
          comment: null
        },
        {
          step: 'APPROVE',
          stepName: 'อนุมัติเอกสาร',
          role: 'ผู้อนุมัติ',
          userId: targetAppId || null,
          userName: approverObj ? (approverObj.fullName || approverObj.name) : '-',
          userRole: approverObj?.position || 'Approver',
          status: targetAppId ? (targetRevId ? 'WAITING' : 'PENDING') : 'SKIPPED',
          date: null,
          comment: null
        }
      ]
    };

    return {
      externalDocuments: state.externalDocuments,
      externalRequests: [newExternalRequest, ...(state.externalRequests || [])],
      tasks: newTasks,
      notifications: newNotifications,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'EXT_DOC_REVISE_REQUEST',
        details: `Requested update for external document: ${edCode} - ${newDoc.title} to Rev ${newRevStr}`,
        actor: state.currentUser?.name || 'User',
        actorId: state.currentUser?.id || 'U001',
        actorRole: state.currentUser?.role || state.currentUser?.position,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])],
      externalAuditTrail: [{
        id: `EXTA-${Date.now()}`,
        docId: newId,
        docTitle: newDoc.title,
        docCode: edCode,
        action: 'UPDATE_REQUEST',
        actor: state.currentUser?.name || 'User',
        actorId: state.currentUser?.id || 'U001',
        date: new Date().toISOString(),
        details: `Requested update for ${edCode} to Rev ${newRevStr}`
      }, ...state.externalAuditTrail]
    };
  }),

  // Handle immediate withdraw/delete (deprecated, keeping empty to avoid crash if called)
  withdrawExternalDoc: (_id, _reason) => set(state => state),

  // Handle immediate revise (replaced by updateExternalDoc above)
  reviseExternalDoc: (_id, _updates) => set(state => state),

  // Triggered when requesting to Obsolete a document
  obsoleteExternalDoc: (id, payload) => set((state) => {
    const oldDoc = state.externalDocuments.find(d => d.id === id);
    if (!oldDoc) return state;

    let newTasks = [...state.tasks];
    let newNotifications = [...state.notifications];

    const obsoleteEffDate = payload.effectiveDate || payload.obsoleteEffectiveDate || new Date().toISOString().split('T')[0];
    // Store obsolete request details inside the document temporarily while preserving official ACTIVE status
    const updatedDoc = {
      ...oldDoc,
      status: oldDoc.status || 'ACTIVE',
      pendingObsolete: true,
      obsoleteReason: payload.reason,
      effectiveDate: obsoleteEffDate,
      obsoleteEffectiveDate: obsoleteEffDate,
      obsoleteDate: obsoleteEffDate,
      obsoleteReviewerId: payload.reviewerId,
      obsoleteApproverId: payload.approverId
    };

    if (payload.reviewerId) {
      newTasks.push({
        id: `extt-${Date.now()}-rev`,
        referenceType: 'EXTERNAL_DOC',
        referenceId: id,
        title: oldDoc.title,
        type: 'EXT_REVIEW',
        assigneeId: payload.reviewerId,
        origin: 'EXTERNAL',
        status: 'PENDING',
        extAction: 'OBSOLETE'
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: payload.reviewerId, title: 'ขอยกเลิกเอกสารภายนอก', message: `รอตรวจสอบการยกเลิก "${oldDoc.title}"`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
    } else {
      newTasks.push({
        id: `extt-${Date.now()}-app`,
        referenceType: 'EXTERNAL_DOC',
        referenceId: id,
        title: oldDoc.title,
        type: 'EXT_APPROVAL',
        assigneeId: payload.approverId,
        origin: 'EXTERNAL',
        status: 'PENDING',
        extAction: 'OBSOLETE'
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: payload.approverId, title: 'ขอยกเลิกเอกสารภายนอก', message: `รออนุมัติการยกเลิก "${oldDoc.title}"`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
    }

    const requestId = payload.requestNo || payload.requestId || payload.edrNumber || generateNextEdrNumber(state.externalRequests || []);
    const targetRevId = payload.reviewerId;
    const targetAppId = payload.approverId;
    const reviewerObj = (state.masterUsers || []).find(u => u.id === targetRevId);
    const approverObj = (state.masterUsers || []).find(u => u.id === targetAppId);
    const nowIso = new Date().toISOString();
    const ownerId = state.currentUser ? state.currentUser.id : (oldDoc.ownerId || 'U001');
    const requesterName = state.currentUser?.fullName || state.currentUser?.name || oldDoc.ownerName || 'User';
    const edCode = oldDoc.edCode || oldDoc.doc_code || oldDoc.id;

    const newExternalRequest = {
      id: requestId,
      requestId,
      requestNo: requestId,
      edrNumber: requestId,
      docId: oldDoc.id,
      documentId: oldDoc.id,
      externalDocId: oldDoc.id,
      edCode,
      doc_code: edCode,
      docCode: edCode,
      documentCode: edCode,
      title: oldDoc.title,
      requestType: 'OBSOLETE',
      effectiveDate: obsoleteEffDate,
      obsoleteEffectiveDate: obsoleteEffDate,
      obsoleteDate: obsoleteEffDate,
      department: oldDoc.department,
      requesterId: ownerId,
      requesterName,
      requesterDepartment: oldDoc.department,
      requesterRole: state.currentUser?.position || state.currentUser?.role || 'Requester',
      reviewerId: targetRevId || null,
      reviewerName: reviewerObj ? (reviewerObj.fullName || reviewerObj.name) : null,
      reviewerRole: reviewerObj?.position || 'Reviewer',
      approverId: targetAppId || null,
      approverName: approverObj ? (approverObj.fullName || approverObj.name) : null,
      approverRole: approverObj?.position || 'Approver',
      status: targetRevId ? 'PENDING_EXT_REVIEW' : 'PENDING_EXT_APPROVAL',
      returnReason: null,
      revisionComment: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      signoffs: [
        {
          step: 'REQUEST',
          stepName: 'ยื่นคำร้อง',
          role: 'ผู้ยื่นคำร้อง',
          userId: ownerId,
          userName: requesterName,
          userRole: state.currentUser?.position || 'Requester',
          status: 'COMPLETED',
          date: nowIso,
          comment: payload.reason || 'ขอยกเลิกการใช้งานเอกสารภายนอก (Obsolete)'
        },
        {
          step: 'REVIEW',
          stepName: 'ทบทวนเอกสาร',
          role: 'ผู้ทบทวน',
          userId: targetRevId || null,
          userName: reviewerObj ? (reviewerObj.fullName || reviewerObj.name) : '-',
          userRole: reviewerObj?.position || 'Reviewer',
          status: targetRevId ? 'PENDING' : 'SKIPPED',
          date: null,
          comment: null
        },
        {
          step: 'APPROVE',
          stepName: 'อนุมัติเอกสาร',
          role: 'ผู้อนุมัติ',
          userId: targetAppId || null,
          userName: approverObj ? (approverObj.fullName || approverObj.name) : '-',
          userRole: approverObj?.position || 'Approver',
          status: targetAppId ? (targetRevId ? 'WAITING' : 'PENDING') : 'SKIPPED',
          date: null,
          comment: null
        }
      ]
    };

    return {
      externalDocuments: state.externalDocuments.map(d => d.id === id ? updatedDoc : d),
      externalRequests: [newExternalRequest, ...(state.externalRequests || [])],
      tasks: newTasks,
      notifications: newNotifications,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'EXT_DOC_OBSOLETE_REQUEST',
        details: `Requested obsolete for external document: ${oldDoc.title}`,
        actor: state.currentUser.name,
        actorId: state.currentUser.id,
        actorRole: state.currentUser.role || state.currentUser.position,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])],
      externalAuditTrail: [{
        id: `EXTA-${Date.now()}`,
        docId: id,
        action: 'OBSOLETE_REQUEST',
        actor: state.currentUser.name,
        actorId: state.currentUser.id,
        date: new Date().toISOString(),
        details: `Requested obsolete: ${payload.reason}`
      }, ...state.externalAuditTrail]
    };
  }),

  logExternalDownload: (id) => set((state) => {
    const doc = state.externalDocuments.find(d => d.id === id);
    const docTitle = doc ? doc.title : id;
    return {
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'EXT_DOC_DOWNLOAD',
        details: `Downloaded external document "${docTitle}"`,
        actor: state.currentUser.name,
        actorId: state.currentUser.id,
        actorRole: state.currentUser.role || state.currentUser.position,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])],
      externalAuditTrail: [{
        id: `EXTA-${Date.now()}`,
        docId: id,
        action: 'DOWNLOAD',
        actor: state.currentUser.name,
        actorId: state.currentUser.id,
        date: new Date().toISOString(),
        details: 'Downloaded confidential document'
      }, ...state.externalAuditTrail]
    };
  }),

  // ─── External Document Controlled Copy Disposition Handler ────────────────
  recordExternalCopyDisposition: (docId, copyNumber, dispositionData = {}) => set((state) => {
    const {
      dispositionAction = 'SHREDDED', // 'SHREDDED' | 'STAMPED_VOID'
      recalledAt = new Date().toISOString(),
      recalledBy = state.currentUser?.name || 'DCC Officer',
      notes = '',
      witnessName = '',
      referenceNo = ''
    } = dispositionData;

    const finalStatus = dispositionAction === 'SHREDDED' ? 'DESTROYED' : 'RECALLED';
    const targetDocIdStr = String(docId || '').trim();
    const targetDoc = (state.externalDocuments || []).find(d => 
      String(d.id) === targetDocIdStr || 
      String(d.edCode || d.doc_code || d.docNo || '').toUpperCase() === targetDocIdStr.toUpperCase()
    );
    const targetDocCode = targetDoc?.edCode || targetDoc?.doc_code || targetDocIdStr;
    const targetDocTitle = targetDoc?.title || targetDoc?.name || targetDocCode;

    const targetCopiesList = Array.isArray(copyNumber) ? copyNumber.map(String) : [String(copyNumber)];

    const allCopies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies || []);

    const isMatchCopy = (c) => {
      const matchDoc = String(c.externalDocId || c.external_doc_id || c.docId || c.doc_id) === targetDocIdStr ||
                       (targetDoc && String(c.externalDocId || c.external_doc_id || c.docId || c.doc_id) === String(targetDoc.id)) ||
                       (targetDocCode && (String(c.doc_code || c.docCode || '').trim().toUpperCase() === targetDocCode.toUpperCase()));
      if (!matchDoc) return false;

      if (targetCopiesList.includes('ALL')) return true;

      const cId = String(c.id);
      const cNo = String(c.copy_no || c.copyNo || c.ccNumber || '');
      const cNoClean = cNo.replace(/\D/g, '');
      const cNum = String(c.copyNumber || '');

      return targetCopiesList.some(target => {
        const tStr = String(target).trim();
        const tClean = tStr.replace(/\D/g, '');
        return cId === tStr || 
               cNo === tStr || 
               (tClean && cNoClean === tClean) || 
               cNum === tStr ||
               `Copy ${tClean}` === tStr ||
               `CC-${tClean.padStart(3, '0')}` === tStr;
      });
    };

    let affectedCount = 0;
    const updatedCopies = allCopies.map(c => {
      if (isMatchCopy(c)) {
        affectedCount++;
        return {
          ...c,
          status: finalStatus,
          disposition_method: dispositionAction,
          dispositionAction: dispositionAction,
          recalled_at: recalledAt,
          recalledAt: recalledAt,
          dateRecalled: recalledAt.split('T')[0],
          recalled_by: recalledBy,
          recalledBy: recalledBy,
          disposed_by_name: recalledBy,
          disposed_by_id: state.currentUser?.id || 'U001',
          dcc_notes: notes || c.dcc_notes,
          notes: notes || c.notes,
          witness_name: witnessName || c.witness_name,
          reference_no: referenceNo || c.reference_no,
          ...(dispositionAction === 'SHREDDED' ? {
            destroyed_at: recalledAt,
            dateDestroyed: recalledAt.split('T')[0]
          } : {})
        };
      }
      return c;
    });

    const updatedDocs = (state.externalDocuments || []).map(d => {
      const isTargetDoc = String(d.id) === targetDocIdStr || 
                          (targetDoc && String(d.id) === String(targetDoc.id)) ||
                          (targetDocCode && (String(d.edCode || d.doc_code || '').toUpperCase() === targetDocCode.toUpperCase()));
      if (isTargetDoc && Array.isArray(d.controlledCopies)) {
        return {
          ...d,
          controlledCopies: d.controlledCopies.map(c => {
            if (isMatchCopy(c)) {
              return {
                ...c,
                status: finalStatus,
                disposition_method: dispositionAction,
                recalled_at: recalledAt,
                recalled_by: recalledBy,
                notes: notes || c.notes,
                ...(dispositionAction === 'SHREDDED' ? {
                  destroyed_at: recalledAt,
                  dateDestroyed: recalledAt.split('T')[0]
                } : {})
              };
            }
            return c;
          })
        };
      }
      return d;
    });

    const matchedCopies = allCopies.filter(isMatchCopy);
    const newDispositionRecords = (matchedCopies.length > 0 ? matchedCopies : [{ copy_no: copyNumber }]).map(copy => ({
      id: `DISP-EXT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      copyId: copy.id || `${targetDocIdStr}-${copy.copy_no || copyNumber}`,
      copy_id: copy.id || `${targetDocIdStr}-${copy.copy_no || copyNumber}`,
      docCode: targetDocCode,
      docTitle: targetDocTitle,
      revision: copy.rev || targetDoc?.rev || '01',
      copyNumber: copy.copy_no ? (String(copy.copy_no).startsWith('Copy') ? copy.copy_no : `Copy ${copy.copy_no}`) : `Copy ${copyNumber}`,
      copy_no: copy.copy_no || copyNumber || '01',
      department: copy.holder_dept || copy.department || targetDoc?.department || '-',
      location: copy.location || copy.locationName || '-',
      dispositionType: finalStatus,
      dispositionMethod: dispositionAction,
      disposedBy: state.currentUser ? `${state.currentUser.name} (${state.currentUser.role || 'DCC'})` : `${recalledBy} (DCC)`,
      disposed_by_name: recalledBy,
      disposed_by_id: state.currentUser?.id || 'U001',
      disposedAt: recalledAt,
      witnessName: witnessName || '',
      referenceNo: referenceNo || '',
      notes: notes || ''
    }));

    const actionLabel = dispositionAction === 'SHREDDED' ? 'ย่อยทำลายทิ้ง (Shred / Destroy)' : 'ประทับตรายกเลิก (Stamp VOID / Archive)';
    const auditLog = {
      id: `EXTA-DISP-${Date.now()}`,
      docId: targetDoc?.id || targetDocIdStr,
      docCode: targetDocCode,
      action: finalStatus === 'DESTROYED' ? 'COPY_DESTROYED' : 'COPY_RECALLED',
      actor: recalledBy,
      actorId: state.currentUser?.id || 'U001',
      date: recalledAt,
      timestamp: recalledAt,
      details: `DCC บันทึกการจัดการสำเนา (${actionLabel}) จำนวน ${affectedCount || 1} ชุด ${notes ? `(หมายเหตุ: ${notes})` : ''}`
    };

    const actionLogEntry = {
      id: `LOG-EXT-DISP-${Date.now()}`,
      actionType: 'EXT_COPY_DISPOSITION',
      action: 'EXT_COPY_DISPOSITION',
      actor: recalledBy,
      details: `DCC บันทึกการจัดการสำเนา (${actionLabel}) สำหรับเอกสารภายนอก ${targetDocCode} (${targetDocTitle}) จำนวน ${affectedCount || 1} ชุด`,
      date: recalledAt,
      timestamp: recalledAt
    };

    const remainingPendingForDoc = updatedCopies.some(c => {
      const matchDoc = String(c.externalDocId || c.external_doc_id || c.docId || c.doc_id) === targetDocIdStr ||
                       (targetDoc && String(c.externalDocId || c.external_doc_id || c.docId || c.doc_id) === String(targetDoc.id)) ||
                       (targetDocCode && (String(c.doc_code || c.docCode || '').trim().toUpperCase() === targetDocCode.toUpperCase()));
      return matchDoc && (c.status === 'PENDING_RECALL' || c.status === 'SUPERSEDED_PENDING_RECALL' || c.status === 'OBSOLETE_PENDING_RECALL');
    });

    const updatedTasks = (state.tasks || []).map(t => {
      const isRecallTask = t.type === 'DCC_RECALL_WITH_CHECKLIST' || t.taskType === 'DCC_RECALL_WITH_CHECKLIST' || t.type === 'DCC_RECALL';
      const isMatchDoc = (t.docId && (String(t.docId) === targetDocIdStr || (targetDoc && String(t.docId) === String(targetDoc.id)))) ||
                         (t.externalDocId && (String(t.externalDocId) === targetDocIdStr || (targetDoc && String(t.externalDocId) === String(targetDoc.id)))) ||
                         (t.doc_code && targetDocCode && String(t.doc_code).toUpperCase() === targetDocCode.toUpperCase()) ||
                         (t.docCode && targetDocCode && String(t.docCode).toUpperCase() === targetDocCode.toUpperCase());
      if (isRecallTask && isMatchDoc && !remainingPendingForDoc) {
        return {
          ...t,
          status: 'COMPLETED',
          is_completed: true,
          completed_at: recalledAt,
          resolved_at: recalledAt,
          resolved_by: recalledBy
        };
      }
      return t;
    });

    return {
      controlledCopyInstances: updatedCopies,
      documentControlledCopies: updatedCopies,
      externalDocuments: updatedDocs,
      copyDispositionRecords: [...newDispositionRecords, ...(state.copyDispositionRecords || [])],
      dispositionHistory: [...newDispositionRecords, ...(state.dispositionHistory || [])],
      externalAuditTrail: [auditLog, ...(state.externalAuditTrail || [])],
      actionLog: [actionLogEntry, ...(state.actionLog || [])],
      tasks: updatedTasks
    };
  }),

  processExternalTask: (taskId, action, comment) => set((state) => {
    // ─── Phase 2: Defensive Task Lookup ───────────────────────────────────
    // Primary: find by taskId. Fallback: find by referenceId or docCode.
    let taskIndex = state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      // Fallback: search by referenceId or docCode (handles ID mismatch edge cases)
      taskIndex = state.tasks.findIndex(t =>
        t.referenceId === taskId || t.docId === taskId || t.docCode === taskId
      );
    }
    if (taskIndex === -1) return state;

    const task = state.tasks[taskIndex];

    // ─── Phase 2.1: Precise Request Resolution (ISO 9001 Immutability) ───
    // First, resolve the exact request belonging to this task
    const matchingReq = (state.externalRequests || []).find(r =>
      r.id === task.referenceId || r.requestId === task.referenceId ||
      r.docId === task.referenceId || r.externalDocId === task.referenceId ||
      (task.docId && (r.docId === task.docId || r.externalDocId === task.docId)) ||
      (task.id && (r.taskId === task.id || r.reviewTaskId === task.id || r.approvalTaskId === task.id))
    ) || (state.externalRequests || []).find(r =>
      task.docCode && (r.edCode === task.docCode || r.doc_code === task.docCode || r.documentCode === task.docCode) &&
      (r.status === 'PENDING' || r.status === 'PENDING_EXT_REVIEW' || r.status === 'PENDING_EXT_APPROVAL' || r.status === 'IN_PROGRESS')
    );

    // Look up doc: check exact ID match in externalDocuments first
    let doc = (state.externalDocuments || []).find(d =>
      (task.referenceId && String(d.id) === String(task.referenceId)) ||
      (task.docId && String(d.id) === String(task.docId)) ||
      (matchingReq?.docId && String(d.id) === String(matchingReq.docId))
    );

    // If doc not yet in externalDocuments (e.g. pending revision draft), construct from matchingReq
    if (!doc && matchingReq) {
      doc = {
        id: matchingReq.docId || matchingReq.externalDocId || task.docId || task.referenceId || `EXT-${Date.now()}`,
        edCode: matchingReq.edCode || matchingReq.doc_code || matchingReq.docCode || task.docCode,
        doc_code: matchingReq.doc_code || matchingReq.edCode || task.docCode,
        title: matchingReq.title || matchingReq.docTitle || task.docTitle,
        department: matchingReq.department || matchingReq.requesterDepartment || task.department,
        reviewerId: matchingReq.reviewerId,
        approverId: matchingReq.approverId,
        ownerId: matchingReq.requesterId || task.requesterId,
        ownerName: matchingReq.requesterName || task.requesterName,
        status: matchingReq.status,
        rev: matchingReq.targetRevision || matchingReq.rev || '01',
        changeReason: matchingReq.changeReason || matchingReq.reason || '-',
        requestId: matchingReq.requestId || matchingReq.requestNo || matchingReq.id,
        edrNumber: matchingReq.requestNo || matchingReq.edrNumber || matchingReq.requestId || matchingReq.id,
        ...matchingReq
      };
    }

    // Defensive fallback: find active doc for that docCode (avoid matching superseded/obsolete docs)
    if (!doc) {
      doc = (state.externalDocuments || []).find(d =>
        task.docCode && (d.edCode === task.docCode || d.doc_code === task.docCode) &&
        d.status !== 'SUPERSEDED' && d.status !== 'OBSOLETE'
      ) || (state.externalDocuments || []).find(d =>
        task.docCode && (d.edCode === task.docCode || d.doc_code === task.docCode)
      );
    }

    if (!doc && task.metadata) {
      doc = { ...task.metadata };
    }
    if (!doc) return state;

    const isObsolete = task.extAction === 'OBSOLETE' || matchingReq?.requestType === 'OBSOLETE' || matchingReq?.type === 'OBSOLETE';
    const isRevision = !isObsolete && ['REVISION', 'UPDATE', 'REVISE'].includes(
      matchingReq?.requestType || matchingReq?.type || matchingReq?.actionType || matchingReq?.extAction || task.extAction || ''
    );

    const reqNo = matchingReq?.requestNo || matchingReq?.requestId || matchingReq?.id || task.referenceId || doc.edCode || 'EDR';
    const reqId = matchingReq?.id || matchingReq?.requestId || task.referenceId;
    const requesterId = matchingReq?.requesterId || task.requesterId || doc.ownerId || 'U001';
    const docCode = doc.edCode || doc.doc_code || doc.docNo || matchingReq?.edCode || task.docCode || doc.title;
    const docTitle = doc.title || doc.name || matchingReq?.title || task.docTitle || 'เอกสารภายนอก';



    let newDocStatus = doc.status;
    let newTasks = state.tasks.filter(t => t.id !== taskId);
    let newNotifications = [...state.notifications];
    let updatedDocs = [...state.externalDocuments];
    let currentCopies = state.documentControlledCopies || state.controlledCopyInstances || [];
    let newCreatedCopies = [];

    // ─── Helper: Safe notification push (never crashes on bad userId) ─────
    const safeNotify = (notif) => {
      try {
        if (notif && (notif.userId || notif.isGlobal || notif.targetDepartment || (Array.isArray(notif.targetUserIds) && notif.targetUserIds.length > 0))) {
          newNotifications.push({
            ...notif,
            readBy: Array.isArray(notif.readBy) ? notif.readBy : [],
            isRead: Boolean(notif.isRead || notif.read),
            read: Boolean(notif.isRead || notif.read)
          });
        }
      } catch { /* swallow */ }
    };

    // APPROVE Action
    if (action === 'APPROVE') {
      if (task.type === 'EXT_REVIEW' || task.type === 'EXTERNAL_REVIEW') {
        const approverId = isObsolete ? doc.obsoleteApproverId : (doc.approverId || task.approverId || matchingReq?.approverId);
        if (approverId) {
          newDocStatus = 'PENDING_EXT_APPROVAL';
          const newTaskId = `extt-${Date.now()}-app`;
          const edCode = doc.edCode || doc.doc_code || doc.docNo || doc.id;
          newTasks.push({
            id: newTaskId,
            referenceType: 'EXTERNAL_DOC',
            referenceId: doc.id,
            docId: doc.id,
            docCode: edCode,
            doc_code: edCode,
            docTitle: doc.title,
            docName: doc.title,
            title: `${edCode}: ${doc.title}`,
            type: 'EXTERNAL_APPROVAL',
            taskType: 'EXTERNAL_APPROVAL',
            assigneeId: approverId,
            requesterId: requesterId,
            requesterName: task.requesterName || doc.ownerName || 'User',
            requesterDepartment: doc.department,
            department: doc.department,
            origin: 'EXTERNAL',
            status: 'PENDING',
            extAction: task.extAction
          });
          // Phase 1 Point 2: Notify Approver (safe dispatch)
          safeNotify({
            id: Date.now() + Math.random(),
            userId: approverId,
            title: 'มีเอกสารภายนอกรอการอนุมัติ',
            message: `คำร้อง ${reqNo} (${docTitle}) ผ่านการทบทวนแล้ว รอให้คุณพิจารณาอนุมัติ`,
            link: '/dcc/tasks',
            type: 'TASK_ASSIGNED',
            category: 'EXTERNAL_DOC',
            isRead: false,
            read: false,
            timestamp: new Date().toISOString(),
            relatedTaskId: newTaskId
          });
          // Phase 1 Point 2: Notify Requester (safe dispatch)
          safeNotify({
            id: Date.now() + Math.random() + 0.1,
            userId: requesterId,
            title: 'คำร้องผ่านการทบทวนแล้ว',
            message: `คำร้อง ${reqNo} ผ่านการทบทวนและส่งต่อให้ผู้อนุมัติแล้ว`,
            link: `/dcc/external/my-requests?id=${reqId}`,
            type: 'WORKFLOW_UPDATE',
            category: 'EXTERNAL_DOC',
            isRead: false,
            read: false,
            timestamp: new Date().toISOString()
          });
          // Phase 2: activityLog audit trail is handled in the updatedRequests map below
        } else {
          // If no approver, it's fully approved
          newDocStatus = isObsolete ? 'OBSOLETE_ARCHIVED' : 'ACTIVE';
        }
      } else if (task.type === 'EXT_APPROVAL' || task.type === 'EXTERNAL_APPROVAL') {
        newDocStatus = isObsolete ? 'OBSOLETE_ARCHIVED' : 'ACTIVE';
      }

      // ─── REVISION Lifecycle: Retire prior revision to SUPERSEDED ───────────
      // When a REVISION request is fully approved:
      //   1. Prior document record → SUPERSEDED (not OBSOLETE) with audit metadata
      //   2. Prior controlled copies → PENDING_RECALL
      //   3. Create DCC recall task for physical copy retrieval
      //   4. Notify requester of successful revision publication
      if (newDocStatus === 'ACTIVE' && isRevision) {
        const resolvedPrevDocId = String(
          matchingReq?.previousDocId || doc.previousDocId || doc.previousRevDocId || ''
        );
        const priorDoc = (state.externalDocuments || []).find(d =>
          (resolvedPrevDocId && String(d.id) === resolvedPrevDocId) ||
          (d.edCode && (d.edCode === (doc.edCode || docCode) || d.doc_code === (doc.edCode || docCode)) && d.status === 'ACTIVE' && String(d.id) !== String(doc.id))
        );
        const prevDocId = priorDoc ? String(priorDoc.id) : resolvedPrevDocId;
        const supersededAt = new Date().toISOString();

        const priorRevNum = parseInt(String(matchingReq?.originalRevision || priorDoc?.rev || priorDoc?.revision || '0').replace(/\D/g, '') || '0', 10);
        const priorRevStr = String(priorRevNum).padStart(2, '0');
        const nextRevNum = matchingReq?.targetRevision
          ? parseInt(String(matchingReq.targetRevision).replace(/\D/g, '') || '1', 10)
          : (matchingReq?.rev ? parseInt(String(matchingReq.rev).replace(/\D/g, '') || '1', 10) : priorRevNum + 1);
        const newRevLabel = String(nextRevNum).padStart(2, '0');

        // Step 1: Mark prior revision as SUPERSEDED
        if (prevDocId) {
          updatedDocs = updatedDocs.map(d => {
            if (String(d.id) === prevDocId) {
              return {
                ...d,
                status: 'SUPERSEDED',
                is_superseded: true,
                supersededAt,
                supersededByRev: newRevLabel,
                supersededByDocId: doc.id,
                supersededByCode: doc.edCode || doc.doc_code || doc.docNo || docCode,
                supersededByRequestId: matchingReq?.id || matchingReq?.requestId || task.referenceId,
                supersededByEdrNumber: matchingReq?.requestNo || matchingReq?.edrNumber || reqNo
              };
            }
            return d;
          });

          // Step 2: Recall physical controlled copies of prior revision
          const prevActiveCopiesForRevision = currentCopies.filter(c =>
            (String(c.doc_id || c.docId || c.external_doc_id || c.externalDocId) === prevDocId) &&
            (c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE' || c.status === 'DISPATCHED_PENDING_RECEIPT')
          );

          if (prevActiveCopiesForRevision.length > 0) {
            currentCopies = currentCopies.map(c => {
              if (
                String(c.doc_id || c.docId || c.external_doc_id || c.externalDocId) === prevDocId &&
                c.status !== 'DESTROYED' && c.status !== 'RECALLED' && c.status !== 'ARCHIVED_OBSOLETE'
              ) {
                return { ...c, status: 'PENDING_RECALL' };
              }
              return c;
            });

            // Step 3: Create DCC recall task for superseded copy retrieval
            const supersededDoc = priorDoc || state.externalDocuments.find(d => String(d.id) === prevDocId);
            const supersededCode = supersededDoc?.edCode || supersededDoc?.doc_code || docCode;
            const nowIsoRevision = new Date().toISOString();
            newTasks.push({
              id: `task-dcc-recall-revision-${prevDocId}-${Date.now()}`,
              referenceType: 'EXTERNAL_DOC',
              type: 'DCC_RECALL_WITH_CHECKLIST',
              taskType: 'DCC_RECALL_WITH_CHECKLIST',
              title: `เรียกคืนเอกสารภายนอกฉบับ Superseded: ${supersededCode} (Rev.${supersededDoc?.rev || priorRevStr}) จำนวน ${prevActiveCopiesForRevision.length} จุด`,
              description: `เอกสาร ${docCode} ได้ออก Rev.${newRevLabel} ใหม่แล้ว ฉบับเดิม Rev.${supersededDoc?.rev || priorRevStr} ถูกเปลี่ยนสถานะเป็น Superseded กรุณาเรียกคืนตาม Checklist`,
              docId: prevDocId,
              externalDocId: prevDocId,
              doc_code: supersededCode,
              docCode: supersededCode,
              docTitle: supersededDoc?.title || supersededDoc?.name || supersededCode,
              docName: supersededDoc?.title || supersededDoc?.name || supersededCode,
              department: 'DC',
              target_department: 'DC',
              doc_version: supersededDoc?.rev || priorRevStr,
              assigneeId: resolveDccAdminUserId(state.masterUsers),
              assignedToRole: 'DCC_ADMIN',
              targetRole: 'DCC_ADMIN',
              target_role: 'DCC_ADMIN',
              origin: 'EXTERNAL',
              status: 'PENDING',
              priority: 'HIGH',
              dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              createdAt: nowIsoRevision
            });

            // Notify DCC Admin about superseded recall task
            const dccAdminId = resolveDccAdminUserId(state.masterUsers);
            if (dccAdminId) {
              safeNotify({
                id: `notif-edr-recall-dcc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                userId: dccAdminId,
                targetUserIds: [dccAdminId],
                title: 'ภาระงานเรียกคืนสำเนาเอกสารภายนอกตกรุ่น',
                message: `เอกสาร ${docCode} ได้ออก Rev.${newRevLabel} แล้ว กรุณาเรียกคืนสำเนาเดิม Rev.${supersededDoc?.rev || priorRevStr} (${prevActiveCopiesForRevision.length} จุด)`,
                link: '/controlled-copy',
                type: 'TASK_ASSIGNED',
                category: 'CONTROLLED_COPY',
                isRead: false,
                read: false,
                readBy: [],
                timestamp: nowIsoRevision,
                docCode: docCode
              });
            }

            // Notify copy holders' departments to return old physical copies
            const holderDepts = Array.from(new Set(prevActiveCopiesForRevision.map(c => c.holder_dept || c.department || c.dept).filter(Boolean)));
            holderDepts.forEach(hDept => {
              safeNotify({
                id: `notif-edr-recall-dept-${hDept}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                targetDepartment: hDept,
                isGlobal: false,
                title: `แจ้งเตือนเรียกคืนสำเนาเอกสารภายนอก: ${docCode}`,
                message: `เอกสาร ${docCode} มีการปรับปรุงฉบับใหม่ กรุณาส่งคืนสำเนาเดิมต่อเจ้าหน้าที่ DCC`,
                link: '/controlled-copy',
                type: 'ACTION_REQUIRED',
                category: 'CONTROLLED_COPY',
                isRead: false,
                read: false,
                readBy: [],
                timestamp: nowIsoRevision,
                docCode: docCode
              });
            });
          }
        }

        // Step 4: Notify requester — revision published successfully
        safeNotify({
          id: `notif-edr-revpub-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          userId: requesterId,
          targetUserIds: [requesterId],
          title: 'เอกสารภายนอกฉบับปรับปรุงได้รับการอนุมัติแล้ว',
          message: `เอกสาร ${docCode} Rev.${newRevLabel} (${docTitle}) ได้รับการอนุมัติเรียบร้อยแล้ว ฉบับก่อนหน้าถูกเปลี่ยนสถานะเป็น Superseded โดยอัตโนมัติ`,
          link: `/dcc/external/my-requests?id=${reqId}`,
          type: 'SUCCESS',
          category: 'EXTERNAL_DOC',
          isRead: false,
          read: false,
          readBy: [],
          timestamp: new Date().toISOString(),
          docCode: docCode,
          refId: reqId
        });
      }
      // ─── End REVISION Lifecycle ──────────────────────────────────────────────

      // Handle Physical Controlled Copies on Final Approval
      if (newDocStatus === 'ACTIVE') {
        // Phase 1 Point 4: Notify Requester of Success
        safeNotify({
          id: `notif-edr-req-succ-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          userId: requesterId,
          targetUserIds: [requesterId],
          title: 'คำร้องเอกสารภายนอกได้รับการอนุมัติแล้ว',
          message: `เอกสาร ${docCode} (${docTitle}) ได้รับการอนุมัติและขึ้นทะเบียนในคลังเรียบร้อยแล้ว`,
          link: `/dcc/external/my-requests?id=${reqId}`,
          type: 'SUCCESS',
          category: 'EXTERNAL_DOC',
          isRead: false,
          read: false,
          readBy: [],
          timestamp: new Date().toISOString(),
          docCode: docCode,
          refId: reqId
        });

        // Notify DCC Admin of Approval
        const dccAdminId = resolveDccAdminUserId(state.masterUsers);
        if (dccAdminId && dccAdminId !== requesterId) {
          safeNotify({
            id: `notif-edr-dcc-app-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            userId: dccAdminId,
            targetUserIds: [dccAdminId],
            title: 'คำร้องเอกสารภายนอกได้รับการอนุมัติแล้ว',
            message: `คำร้อง ${reqNo} (${docCode} - ${docTitle}) ได้รับการอนุมัติแล้ว พร้อมสำหรับขึ้นทะเบียน/แจกจ่าย`,
            link: '/tasks',
            type: 'TASK_ASSIGNED',
            category: 'EXTERNAL_DOC',
            isRead: false,
            read: false,
            readBy: [],
            timestamp: new Date().toISOString(),
            docCode: docCode,
            refId: reqId
          });
        }

        // Notify destination department personnel of document publication
        safeNotify({
          id: `notif-edr-dept-pub-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          targetDepartment: doc.department,
          isGlobal: !doc.department,
          title: `ประกาศใช้เอกสารภายนอก: ${docCode}`,
          message: `เอกสารภายนอก "${docTitle}" (${docCode}) ขึ้นทะเบียนและมีผลบังคับใช้แล้ว`,
          link: '/dcc/external/library',
          type: 'INFO',
          category: 'EXTERNAL_DOC',
          isRead: false,
          read: false,
          readBy: [],
          timestamp: new Date().toISOString(),
          docCode: docCode,
          refId: reqId
        });

        const stations = doc.distributions || doc.physical_distribution || [];
        const docVer = doc.rev || doc.sourceVersion || '01';
        const nowIso = new Date().toISOString();
        const todayStr = nowIso.split('T')[0];

        if (stations.length > 0) {
          newCreatedCopies = stations.map((station, index) => {
            const copyNoStr = String(index + 1).padStart(2, '0');
            const ccNumStr = `CC-${String(index + 1).padStart(3, '0')}`;
            const holderDept = station.departmentId || station.dept_code || station.dept || doc.department;
            const locName = station.locationName || station.station_name || station.name || station.location || `${holderDept} Head Office`;
            const locId = station.locationId || station.station_id || station.id || `${holderDept}-LOC-${index + 1}`;
            return {
              id: `cc-ext-${doc.id || docCode}-${copyNoStr}`,
              doc_id: doc.id,
              docId: doc.id,
              external_doc_id: doc.id,
              externalDocId: doc.id,
              doc_code: docCode,
              docCode: docCode,
              doc_title: doc.title,
              docTitle: doc.title,
              doc_type: 'ED',
              docType: 'ED',
              docName: doc.title,
              doc_version: docVer,
              rev: docVer,
              copy_no: copyNoStr,
              copyNo: copyNoStr,
              ccNumber: ccNumStr,
              issue_no: '01',
              issueNumber: 'I01',
              holder_dept: holderDept,
              department: holderDept,
              departmentId: holderDept,
              dept_code: holderDept,
              holder_name: `${holderDept} (${locName})`,
              location: locName,
              locationName: locName,
              locationId: locId,
              station_id: locId,
              station_name: locName,
              status: 'PENDING_ISSUE',
              is_replacement: false,
              is_adhoc: false,
              is_external: true,
              isExternal: true,
              requested_by: doc.ownerName || state.currentUser?.name || 'Owner Department',
              requested_at: nowIso,
              dateIssued: todayStr
            };
          });

          newTasks.push({
            id: `task-dcc-issue-ext-${doc.id}-${Date.now()}`,
            referenceType: 'EXTERNAL_DOC',
            type: 'DCC_DISTRIBUTE',
            taskType: 'DCC_ISSUE_CONTROLLED_COPIES',
            title: `จัดพิมพ์และส่งมอบสำเนาควบคุมเอกสารภายนอก: ${docCode} (${stations.length} จุด)`,
            description: `มีคำขอสำเนาควบคุมสำหรับเอกสารภายนอก ${docCode} จำนวน ${stations.length} เล่ม กรุณาจัดพิมพ์และแจกจ่าย`,
            docId: doc.id,
            externalDocId: doc.id,
            doc_code: docCode,
            docCode: docCode,
            docTitle: doc.title || docCode,
            docName: doc.title || docCode,
            department: 'DC',
            target_department: 'DC',
            doc_version: docVer,
            assigneeId: resolveDccAdminUserId(state.masterUsers),
            assignedToRole: 'DCC_ADMIN',
            targetRole: 'DCC_ADMIN',
            target_role: 'DCC_ADMIN',
            origin: 'EXTERNAL',
            status: 'PENDING',
            priority: 'HIGH',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            createdAt: nowIso
          });

          // Phase 1 Point 4: Notify controlled copy recipient department staff (level < 6)
          stations.forEach((station, index) => {
            const copyNoStr = String(index + 1).padStart(2, '0');
            const holderDept = station.departmentId || station.dept_code || station.dept || doc.department;
            const deptStaff = (state.masterUsers || []).filter(u =>
              u && !u.isDcc && u.role !== 'DCC_ADMIN' &&
              (u.department === holderDept || (u.depts || []).includes(holderDept)) &&
              (Number(u.approval_level ?? u.level ?? 1) < 6)
            );
            deptStaff.forEach(staff => {
              newNotifications.push({
                id: Date.now() + Math.random(),
                userId: staff.id,
                title: 'มีสำเนาควบคุมใหม่รอตรวจรับ',
                message: `กรุณาตรวจรับสำเนาเล่ม ${copyNoStr} สำหรับเอกสาร ${docCode}`,
                link: '/dcc/tasks',
                type: 'TASK_ASSIGNED',
                category: 'EXTERNAL_DOC',
                isRead: false,
                read: false,
                timestamp: new Date().toISOString()
              });
            });
          });
        }
      } else if (newDocStatus === 'OBSOLETE_ARCHIVED' && isObsolete) {
        // Automatic Recall for Obsoleted External Document
        const targetDocId = String(doc.id);
        const activeDocCopies = currentCopies.filter(c => 
          (String(c.doc_id || c.docId || c.external_doc_id || c.externalDocId) === targetDocId ||
           (docCode && (c.doc_code === docCode || c.docCode === docCode))) &&
          c.status !== 'DESTROYED' && c.status !== 'RECALLED' && c.status !== 'ARCHIVED_OBSOLETE'
        );

        if (activeDocCopies.length > 0) {
          currentCopies = currentCopies.map(c => {
            const isMatch = String(c.doc_id || c.docId || c.external_doc_id || c.externalDocId) === targetDocId ||
                            (docCode && (c.doc_code === docCode || c.docCode === docCode));
            if (isMatch && c.status !== 'DESTROYED' && c.status !== 'RECALLED' && c.status !== 'ARCHIVED_OBSOLETE') {
              return { ...c, status: 'PENDING_RECALL' };
            }
            return c;
          });

          const docCode = doc.edCode || doc.doc_code || doc.title;
          newTasks.push({
            id: `task-dcc-recall-ext-${targetDocId}-${Date.now()}`,
            referenceType: 'EXTERNAL_DOC',
            type: 'DCC_RECALL_WITH_CHECKLIST',
            taskType: 'DCC_RECALL_WITH_CHECKLIST',
            title: `เรียกคืนและทำลายเอกสารภายนอกที่ถูกยกเลิก: ${docCode} จำนวน ${activeDocCopies.length} จุด`,
            description: `เอกสารภายนอก ${docCode} ถูกยกเลิกการใช้งานแล้ว กรุณาเรียกคืนฉบับกระดาษตาม Checklist`,
            docId: targetDocId,
            externalDocId: targetDocId,
            doc_code: docCode,
            docCode: docCode,
            docTitle: doc.title || doc.name || docCode,
            docName: doc.title || doc.name || docCode,
            department: 'DC',
            target_department: 'DC',
            doc_version: doc.rev || '01',
            assigneeId: resolveDccAdminUserId(state.masterUsers),
            assignedToRole: 'DCC_ADMIN',
            targetRole: 'DCC_ADMIN',
            target_role: 'DCC_ADMIN',
            origin: 'EXTERNAL',
            status: 'PENDING',
            priority: 'HIGH',
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          });
        }
      }

      // REJECT / REVISE / RETURN Action
    } else if (action === 'REJECT' || action === 'REVISE' || action === 'RETURN') {
      const isReviewStep = task.type === 'EXT_REVIEW' || task.type === 'EXTERNAL_REVIEW';
      const isReturnForRevision = action === 'REVISE' || action === 'RETURN' || (action === 'REJECT' && isReviewStep);

      newTasks = newTasks.filter(t => t.id !== taskId);

      if (isReturnForRevision) {
        // Phase 1 Point 3: Return for Revision
        newDocStatus = 'REVISE_REQUESTED';
        const newTaskId = `extt-${Date.now()}-revise`;
        const actorName = state.currentUser?.fullName || state.currentUser?.name || (isReviewStep ? 'ผู้ทบทวน' : 'ผู้อนุมัติ');
        const shortComment = (comment || 'กรุณาแก้ไขรายละเอียดเอกสารภายนอกตามข้อเสนอแนะ').slice(0, 100);

        newTasks.push({
          id: newTaskId,
          referenceType: 'EXTERNAL_DOC',
          referenceId: doc.id,
          docId: doc.id,
          docCode: edCode,
          doc_code: edCode,
          docTitle: doc.title,
          docName: doc.title,
          title: `แก้ไขคำร้องเอกสารภายนอก: ${edCode} - ${doc.title}`,
          type: 'EXTERNAL_REVISE',
          taskType: 'EXTERNAL_REVISE',
          assigneeId: requesterId,
          requesterId: requesterId,
          reviewerId: doc.reviewerId,
          approverId: doc.approverId,
          returnReason: comment || 'กรุณาแก้ไขรายละเอียดเอกสารภายนอกตามข้อเสนอแนะ',
          rejectReason: comment || 'กรุณาแก้ไขรายละเอียดเอกสารภายนอกตามข้อเสนอแนะ',
          comment: comment,
          origin: 'EXTERNAL',
          status: 'PENDING',
          priority: 'HIGH',
          department: doc.department,
          extAction: task.extAction || 'REGISTER',
          returnedBy: actorName,
          returnedById: state.currentUser?.id,
          returnedRole: isReviewStep ? 'ผู้ทบทวน (Reviewer)' : 'ผู้อนุมัติ (Approver)',
          createdAt: new Date().toISOString()
        });

        // Phase 1 Point 3: Notify Requester
        newNotifications.push({
          id: Date.now() + Math.random(),
          userId: requesterId,
          title: 'คำร้องเอกสารภายนอกถูกส่งกลับแก้ไข',
          message: `คำร้อง ${reqNo} ถูกส่งกลับแก้ไขโดย ${actorName}: ${shortComment}`,
          link: `/dcc/external/my-requests?id=${reqId}`,
          type: 'ACTION_REQUIRED',
          category: 'EXTERNAL_DOC',
          isRead: false,
          read: false,
          timestamp: new Date().toISOString()
        });
      } else {
        // Phase 1 Point 5: Approver Rejection / Obsolete Rejection
        if (isObsolete) {
          newDocStatus = 'ACTIVE';
        } else {
          newDocStatus = 'REJECTED';
        }

        // Phase 1 Point 5: Notify Requester
        newNotifications.push({
          id: Date.now() + Math.random(),
          userId: requesterId,
          title: 'คำร้องเอกสารภายนอกไม่ได้รับการอนุมัติ',
          message: `คำร้อง ${reqNo} ไม่ผ่านการอนุมัติ: ${comment || 'ไม่ผ่านเกณฑ์การพิจารณาอนุมัติ'}`,
          link: `/dcc/external/my-requests?id=${reqId}`,
          type: 'REJECTED',
          category: 'EXTERNAL_DOC',
          isRead: false,
          read: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (action === 'APPROVE') {
      if (newDocStatus === 'ACTIVE') {
        // Propagate effectiveDate, issuer, accessScope, reviewCycle, and department from the matching request
        const resolvedRequest = matchingReq || (state.externalRequests || []).find(r =>
          r.docId === doc.id || r.externalDocId === doc.id ||
          (doc.edCode && (r.edCode === doc.edCode || r.doc_code === doc.edCode))
        );
        const resolvedIssuer = doc.issuer || doc.officialIssuer || doc.source || resolvedRequest?.issuer || resolvedRequest?.officialIssuer || resolvedRequest?.source || '';
        const resolvedEffectiveDate = doc.effectiveDate || resolvedRequest?.effectiveDate || new Date().toISOString().split('T')[0];
        const resolvedAccessScope = doc.accessScope || resolvedRequest?.accessScope || 'General';
        const resolvedAccessDepts = doc.accessDepartments || resolvedRequest?.accessDepartments || [];
        const resolvedAccessUsers = doc.accessUsers || resolvedRequest?.accessUsers || [];
        const resolvedReviewCycle = Number(doc.reviewCycleMonths || resolvedRequest?.reviewCycleMonths || 12);
        const resolvedDept = doc.department || resolvedRequest?.department || 'QA';

        if (isRevision) {
          // REVISION: create or update the distinct new ACTIVE record
          const priorDocId = String(resolvedRequest?.previousDocId || doc.previousDocId || doc.previousRevDocId || '');
          const priorDoc = (state.externalDocuments || []).find(d =>
            (priorDocId && String(d.id) === priorDocId) ||
            (d.edCode && (d.edCode === (doc.edCode || docCode) || d.doc_code === (doc.edCode || docCode)) && String(d.id) !== String(doc.id))
          );
          const finalPrevDocId = priorDoc ? String(priorDoc.id) : priorDocId;

          const priorRevNum = parseInt(String(resolvedRequest?.originalRevision || priorDoc?.rev || priorDoc?.revision || '0').replace(/\D/g, '') || '0', 10);
          const nextRevNum = resolvedRequest?.targetRevision
            ? parseInt(String(resolvedRequest.targetRevision).replace(/\D/g, '') || '1', 10)
            : (resolvedRequest?.rev ? parseInt(String(resolvedRequest.rev).replace(/\D/g, '') || '1', 10) : priorRevNum + 1);
          const targetRevStr = String(nextRevNum).padStart(2, '0');

          // ISO 9001 Immutability Guard: A new revision MUST NEVER overwrite a historical (superseded/obsolete) record or its prior revision
          let candidateId = (doc.id && String(doc.id) !== finalPrevDocId) 
            ? String(doc.id) 
            : (resolvedRequest?.docId && String(resolvedRequest.docId) !== finalPrevDocId ? String(resolvedRequest.docId) : '');

          const isHistoricalRecord = (idToCheck) => {
            if (!idToCheck) return false;
            return updatedDocs.some(d => 
              String(d.id) === String(idToCheck) && 
              (d.status === 'SUPERSEDED' || d.status === 'OBSOLETE' || d.is_superseded || d.is_obsolete || String(d.id) === String(finalPrevDocId))
            );
          };

          if (!candidateId || isHistoricalRecord(candidateId)) {
            candidateId = `EXT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          }
          const newDocRecordId = candidateId;

          const reqId = resolvedRequest?.id || resolvedRequest?.requestId || task.referenceId;
          const edrNumber = resolvedRequest?.requestNo || resolvedRequest?.edrNumber || reqNo;
          const reqChangeReason = resolvedRequest?.changeReason || resolvedRequest?.reason || resolvedRequest?.remarks || doc.changeReason || '-';
          const reqRequester = resolvedRequest?.requesterName || resolvedRequest?.requester?.name || doc.requesterName || doc.ownerName || 'User';
          const reqReviewer = resolvedRequest?.reviewerName || resolvedRequest?.reviewer?.name || doc.reviewerName || '-';
          const reqApprover = state.currentUser?.fullName || state.currentUser?.name || doc.approverName || 'Approver';

          const newActiveDoc = {
            ...(priorDoc || {}),
            ...doc,
            id: newDocRecordId,
            edCode: docCode,
            doc_code: docCode,
            docNo: docCode,
            title: resolvedRequest?.title || doc.title || priorDoc?.title || docTitle,
            status: 'ACTIVE',
            is_superseded: false,
            is_obsolete: false,
            rev: targetRevStr,
            revision: `Rev.${targetRevStr}`,
            sourceVersion: resolvedRequest?.sourceVersion || doc.sourceVersion || `Rev.${targetRevStr}`,
            previousDocId: finalPrevDocId,
            effectiveDate: resolvedEffectiveDate,
            issuer: resolvedIssuer,
            officialIssuer: resolvedIssuer,
            source: resolvedIssuer,
            accessScope: resolvedAccessScope,
            accessDepartments: resolvedAccessDepts,
            accessUsers: resolvedAccessUsers,
            reviewCycleMonths: resolvedReviewCycle,
            department: resolvedDept,
            // ผูกความสัมพันธ์กับคำร้องใบนี้โดยตรง
            requestId: reqId,
            edrNumber: edrNumber,
            changeReason: reqChangeReason,
            // บันทึกรายชื่อผู้ดำเนินการของ Revision นี้
            requesterName: reqRequester,
            reviewerName: reqReviewer,
            approverName: reqApprover,
            approvedAt: new Date().toISOString(),
            approverId: state.currentUser?.id || doc.approverId,
            createdAt: doc.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          const existingIdx = updatedDocs.findIndex(d => 
            String(d.id) === String(newDocRecordId) &&
            !d.is_superseded &&
            !d.is_obsolete &&
            d.status !== 'SUPERSEDED' &&
            d.status !== 'OBSOLETE'
          );
          if (existingIdx >= 0) {
            updatedDocs[existingIdx] = newActiveDoc;
          } else {
            updatedDocs = [newActiveDoc, ...updatedDocs];
          }
        } else {
          // NEW registration: update or insert
          const reqId = resolvedRequest?.id || resolvedRequest?.requestId || doc.requestId || task.referenceId;
          const edrNumber = resolvedRequest?.requestNo || resolvedRequest?.edrNumber || doc.edrNumber || reqNo;
          const reqChangeReason = resolvedRequest?.changeReason || resolvedRequest?.reason || doc.changeReason || 'ขึ้นทะเบียนเอกสารภายนอกใหม่ (Initial Registration)';
          const reqRequester = resolvedRequest?.requesterName || resolvedRequest?.requester?.name || doc.requesterName || doc.ownerName || 'User';
          const reqReviewer = resolvedRequest?.reviewerName || resolvedRequest?.reviewer?.name || doc.reviewerName || '-';
          const reqApprover = state.currentUser?.fullName || state.currentUser?.name || doc.approverName || 'Approver';

          const approvedDoc = {
            ...doc,
            status: 'ACTIVE',
            approvedAt: new Date().toISOString(),
            approverId: state.currentUser?.id || doc.approverId,
            effectiveDate: resolvedEffectiveDate,
            source: resolvedIssuer,
            issuer: resolvedIssuer,
            officialIssuer: resolvedIssuer,
            accessScope: resolvedAccessScope,
            accessDepartments: resolvedAccessDepts,
            accessUsers: resolvedAccessUsers,
            reviewCycleMonths: resolvedReviewCycle,
            department: resolvedDept,
            requestId: reqId,
            edrNumber: edrNumber,
            changeReason: reqChangeReason,
            requesterName: reqRequester,
            reviewerName: reqReviewer,
            approverName: reqApprover,
            updatedAt: new Date().toISOString()
          };
          const existingIdx = updatedDocs.findIndex(d => String(d.id) === String(doc.id));
          if (existingIdx >= 0) {
            updatedDocs[existingIdx] = { ...updatedDocs[existingIdx], ...approvedDoc };
          } else {
            updatedDocs = [approvedDoc, ...updatedDocs];
          }
        }
      } else if (newDocStatus === 'OBSOLETE_ARCHIVED' || newDocStatus === 'OBSOLETE') {
        const obsEffDate = matchingReq?.effectiveDate || matchingReq?.obsoleteEffectiveDate || doc.obsoleteEffectiveDate || doc.effectiveDate || new Date().toISOString().split('T')[0];
        updatedDocs = updatedDocs.map(d => (d.id === doc.id || (doc.edCode && (d.edCode === doc.edCode || d.doc_code === doc.edCode))) ? {
          ...d,
          status: 'OBSOLETE',
          is_obsolete: true,
          obsoletedAt: new Date().toISOString(),
          obsoleteDate: obsEffDate,
          effectiveDate: obsEffDate,
          obsoleteEffectiveDate: obsEffDate,
          obsoleteApproverId: state.currentUser?.id || doc.approverId,
          controlledCopies: (d.controlledCopies || []).map(c => {
            if (c.status !== 'DESTROYED' && c.status !== 'RECALLED' && c.status !== 'ARCHIVED_OBSOLETE') {
              return { ...c, status: 'PENDING_RECALL' };
            }
            return c;
          })
        } : d);

        // Notify Requester
        if (requesterId) {
          safeNotify({
            id: `notif-edr-obs-req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            userId: requesterId,
            targetUserIds: [requesterId],
            title: 'คำร้องขอยกเลิกเอกสารภายนอกสำเร็จ',
            message: `เอกสารภายนอก "${docTitle}" (${docCode}) ได้รับการอนุมัติยกเลิกถาวรแล้ว`,
            link: '/dcc/external/my-requests',
            type: 'SUCCESS',
            category: 'EXTERNAL_DOC',
            isRead: false,
            read: false,
            readBy: [],
            timestamp: new Date().toISOString(),
            docCode: docCode,
            refId: reqId
          });
        }

        // Broadcast Obsolete to department and organization
        safeNotify({
          id: `notif-edr-obs-broad-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          isGlobal: true,
          targetDepartment: doc.department,
          title: `ประกาศยกเลิกเอกสารภายนอก: ${docCode}`,
          message: `เอกสารภายนอก "${docTitle}" (${docCode}) ถูกยกเลิกถาวร (Obsolete) แล้ว ห้ามนำไปใช้งาน`,
          link: '/dcc/external/library',
          type: 'OBSOLETE',
          category: 'EXTERNAL_DOC',
          isRead: false,
          read: false,
          readBy: [],
          timestamp: new Date().toISOString(),
          docCode: docCode,
          refId: reqId
        });
      }
    } else if (action === 'REJECT' || action === 'REVISE' || action === 'RETURN') {
      // Golden Rule: Approver/Reviewer rejects or returns request -> update externalRequests ONLY.
      // Strictly purge from externalDocuments if it was created or pending.
      if (!isObsolete) {
        if (isRevision) {
          // Only purge the draft/pending revision doc, preserve the prior document!
          updatedDocs = updatedDocs.filter(d => String(d.id) !== String(doc.id) && String(d.id) !== String(task.referenceId));
        } else {
          updatedDocs = updatedDocs.filter(d => d.id !== doc.id && d.id !== task.referenceId && (!doc.edCode || (d.edCode !== doc.edCode && d.doc_code !== doc.edCode)));
        }
      } else {
        // If an obsolete request is rejected, the document remains ACTIVE
        updatedDocs = updatedDocs.map(d => (d.id === doc.id || d.id === task.referenceId) ? {
          ...d,
          pendingObsolete: false,
          status: 'ACTIVE'
        } : d);
      }
    }
    const finalCopiesState = (action === 'APPROVE') ? [...currentCopies, ...newCreatedCopies] : (state.documentControlledCopies || state.controlledCopyInstances || []);

    const targetReqId = matchingReq?.id || matchingReq?.requestId;
    const targetDocId = matchingReq?.docId || matchingReq?.externalDocId || doc?.id || task.referenceId;

    const updatedRequests = (state.externalRequests || []).map(r => {
      // ISO 9001 Immutability: Strictly match ONLY the specific request for this workflow step
      const isMatch = (targetReqId && (r.id === targetReqId || r.requestId === targetReqId)) ||
                      (targetDocId && (r.docId === targetDocId || r.externalDocId === targetDocId)) ||
                      (task.referenceId && (r.id === task.referenceId || r.requestId === task.referenceId || r.docId === task.referenceId));
      if (!isMatch) return r;

      const isReviewStep = task.type === 'EXT_REVIEW' || task.type === 'EXTERNAL_REVIEW';
      const isApproveStep = task.type === 'EXT_APPROVAL' || task.type === 'EXTERNAL_APPROVAL';
      const nowIso = new Date().toISOString();

      let nextSignoffs = (r.signoffs || []).map(s => {
        if (isReviewStep && s.step === 'REVIEW') {
          return {
            ...s,
            status: action === 'APPROVE' ? 'COMPLETED' : 'RETURNED',
            date: nowIso,
            comment: comment || (action === 'APPROVE' ? 'ผ่านการทบทวน (Reviewed & Verified)' : 'ส่งกลับแก้ไข (Return for Revision)')
          };
        }
        if (isApproveStep && s.step === 'APPROVE') {
          return {
            ...s,
            status: action === 'APPROVE' ? 'COMPLETED' : (isObsolete ? 'REJECTED' : 'RETURNED'),
            date: nowIso,
            comment: comment || (action === 'APPROVE' ? 'อนุมัติเรียบร้อย (Approved)' : (isObsolete ? 'ไม่อนุมัติ (Rejected)' : 'ส่งกลับแก้ไข (Return for Revision)'))
          };
        }
        return s;
      });

      if (action === 'APPROVE' && isReviewStep) {
        nextSignoffs = nextSignoffs.map(s => s.step === 'APPROVE' && (s.status === 'WAITING' || s.status === 'PENDING') ? { ...s, status: 'PENDING' } : s);
      }

      let reqFinalStatus = r.status;
      if (action === 'APPROVE') {
        if (newDocStatus === 'ACTIVE' || newDocStatus === 'OBSOLETE_ARCHIVED') {
          reqFinalStatus = 'APPROVED';
        } else if (newDocStatus === 'PENDING_EXT_APPROVAL') {
          reqFinalStatus = 'PENDING_EXT_APPROVAL';
        }
      } else if (action === 'REJECT' || action === 'REVISE' || action === 'RETURN') {
        const isReturnForRevision = action === 'REVISE' || action === 'RETURN' || (action === 'REJECT' && isReviewStep);
        if (isReturnForRevision) {
          reqFinalStatus = 'REVISE_REQUESTED';
        } else {
          reqFinalStatus = 'REJECTED';
        }
      }

      // Phase 2: build activityLog audit entry for REVIEW → APPROVE
      const baseLog = Array.isArray(r.activityLog) ? [...r.activityLog] : [];
      if (action === 'APPROVE' && isReviewStep) {
        baseLog.push({
          action: 'REVIEWED',
          actor: state.currentUser?.name || state.currentUser?.fullName || 'Reviewer',
          role: state.currentUser?.role || 'Reviewer',
          department: state.currentUser?.department || doc.department,
          timestamp: nowIso,
          comment: comment || '-'
        });
      }

      return {
        ...r,
        status: reqFinalStatus,
        returnReason: action === 'REJECT' ? comment : r.returnReason,
        revisionComment: action === 'REJECT' ? comment : r.revisionComment,
        signoffs: nextSignoffs,
        activityLog: baseLog,
        ...(action === 'APPROVE' && isReviewStep ? { reviewedAt: nowIso } : {}),
        updatedAt: nowIso
      };
    });

    return {
      tasks: newTasks,
      notifications: newNotifications,
      externalDocuments: updatedDocs,
      externalRequests: updatedRequests,
      documentControlledCopies: finalCopiesState,
      controlledCopyInstances: finalCopiesState,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: `EXT_WORKFLOW_${action}`,
        details: `Processed task ${taskId} (${action}) for external document "${doc.title}"`,
        actor: state.currentUser.name,
        actorId: state.currentUser.id,
        actorRole: state.currentUser.role || state.currentUser.position,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])],
      externalAuditTrail: [{
        id: `EXTA-${Date.now()}`,
        docId: doc.id,
        action: `TASK_${action}_${task.type.toUpperCase()}`,
        actor: state.currentUser.name,
        actorId: state.currentUser.id,
        date: new Date().toISOString(),
        details: comment || `Processed external task (${task.type})`
      }, ...state.externalAuditTrail]
    };
  }),

  // Closed-Loop Resubmit External Document after Revision
  resubmitExternalDoc: (id, updates, taskId) => set((state) => {
    const oldDoc = (state.externalDocuments || []).find(d => d.id === id || d.edCode === id || d.doc_code === id) ||
                   (state.externalRequests || []).find(r => r.id === id || r.requestId === id || r.docId === id || r.externalDocId === id || r.edCode === id);
    if (!oldDoc) return state;

    const reviewerId = updates.reviewerId || oldDoc.reviewerId;
    const approverId = updates.approverId || oldDoc.approverId;
    const newStatus = reviewerId ? 'PENDING_EXT_REVIEW' : 'PENDING_EXT_APPROVAL';
    const edCode = oldDoc.edCode || oldDoc.doc_code || oldDoc.docNo || id;

    const updatedDoc = {
      ...oldDoc,
      ...updates,
      id: oldDoc.id,
      status: newStatus,
      reviewerId,
      approverId,
      returnReason: null,
      revisionComment: null,
      updatedAt: new Date().toISOString()
    };

    // Close/remove the revise task
    let newTasks = state.tasks.filter(t => t.id !== taskId && !(t.referenceId === oldDoc.id && (t.type === 'EXTERNAL_REVISE' || t.type === 'REVISE')));
    let newNotifications = [...state.notifications];

    if (reviewerId) {
      const newTaskId = `extt-${Date.now()}-rev`;
      newTasks.push({
        id: newTaskId,
        referenceType: 'EXTERNAL_DOC',
        referenceId: oldDoc.id,
        docId: oldDoc.id,
        docCode: edCode,
        doc_code: edCode,
        docTitle: updatedDoc.title,
        docName: updatedDoc.title,
        title: `${edCode}: ${updatedDoc.title}`,
        type: 'EXTERNAL_REVIEW',
        taskType: 'EXTERNAL_REVIEW',
        assigneeId: reviewerId,
        requesterId: updatedDoc.ownerId || state.currentUser?.id || 'U001',
        requesterName: state.currentUser?.fullName || state.currentUser?.name,
        requesterDepartment: updatedDoc.department,
        department: updatedDoc.department,
        origin: 'EXTERNAL',
        status: 'PENDING',
        extAction: oldDoc.extAction || 'REGISTER'
      });
      newNotifications.push({
        id: Date.now() + Math.random(),
        userId: reviewerId,
        title: 'งานใหม่รอการตรวจสอบ (ส่งกลับแก้ไขแล้ว)',
        message: `คำขอสำหรับเอกสารภายนอก "${edCode} - ${updatedDoc.title}" ได้รับการแก้ไขและส่งกลับมาให้ตรวจสอบอีกครั้ง`,
        isRead: false,
        link: '/tasks',
        timestamp: new Date().toISOString()
      });
    } else if (approverId) {
      const newTaskId = `extt-${Date.now()}-app`;
      newTasks.push({
        id: newTaskId,
        referenceType: 'EXTERNAL_DOC',
        referenceId: oldDoc.id,
        docId: oldDoc.id,
        docCode: edCode,
        doc_code: edCode,
        docTitle: updatedDoc.title,
        docName: updatedDoc.title,
        title: `${edCode}: ${updatedDoc.title}`,
        type: 'EXTERNAL_APPROVAL',
        taskType: 'EXTERNAL_APPROVAL',
        assigneeId: approverId,
        requesterId: updatedDoc.ownerId || state.currentUser?.id || 'U001',
        requesterName: state.currentUser?.fullName || state.currentUser?.name,
        requesterDepartment: updatedDoc.department,
        department: updatedDoc.department,
        origin: 'EXTERNAL',
        status: 'PENDING',
        extAction: oldDoc.extAction || 'REGISTER'
      });
      newNotifications.push({
        id: Date.now() + Math.random(),
        userId: approverId,
        title: 'งานใหม่รอการอนุมัติ (ส่งกลับแก้ไขแล้ว)',
        message: `คำขอสำหรับเอกสารภายนอก "${edCode} - ${updatedDoc.title}" ได้รับการแก้ไขและส่งกลับมาให้อนุมัติอีกครั้ง`,
        isRead: false,
        link: '/tasks',
        timestamp: new Date().toISOString()
      });
    }

    let matchedAnyRequest = false;
    const updatedRequests = (state.externalRequests || []).map(r => {
      const isMatch = r.id === oldDoc.id || r.requestId === oldDoc.id || r.requestNo === oldDoc.id ||
                      r.docId === oldDoc.id || r.documentId === oldDoc.id || r.externalDocId === oldDoc.id ||
                      (oldDoc.requestId && (r.id === oldDoc.requestId || r.requestId === oldDoc.requestId));
      if (!isMatch) return r;
      matchedAnyRequest = true;

      const nowIso = new Date().toISOString();
      const nextSignoffs = (r.signoffs || []).map(s => {
        if (s.step === 'REVIEW') {
          return { ...s, status: reviewerId ? 'PENDING' : 'SKIPPED', date: null, comment: null };
        }
        if (s.step === 'APPROVE') {
          return { ...s, status: approverId ? (reviewerId ? 'WAITING' : 'PENDING') : 'SKIPPED', date: null, comment: null };
        }
        return s;
      });

      nextSignoffs.push({
        step: 'RESUBMIT',
        stepName: 'แก้ไขและส่งตรวจใหม่',
        role: 'ผู้ยื่นคำร้อง',
        userId: state.currentUser?.id || oldDoc.ownerId,
        userName: state.currentUser?.fullName || state.currentUser?.name,
        userRole: state.currentUser?.position || 'Requester',
        status: 'COMPLETED',
        date: nowIso,
        comment: updates.reason || 'แก้ไขรายละเอียดและส่งคำร้องตรวจใหม่อีกครั้ง'
      });

      return {
        ...r,
        requestNo: r.requestNo || r.requestId || r.id,
        requestId: r.requestId || r.requestNo || r.id,
        docCode: r.docCode || edCode,
        documentCode: r.documentCode || edCode,
        edCode: r.edCode || edCode,
        docId: r.docId || oldDoc.id,
        documentId: r.documentId || oldDoc.id,
        title: updatedDoc.title,
        status: newStatus,
        returnReason: null,
        revisionComment: null,
        signoffs: nextSignoffs,
        updatedAt: nowIso
      };
    });

    // Auto-Heal: If no existing request in externalRequests matched, construct and prepend one
    if (!matchedAnyRequest) {
      const newReqId = generateNextEdrNumber(state.externalRequests || []);
      const nowIso = new Date().toISOString();
      const reviewerUser = (state.masterUsers || []).find(u => u.id === reviewerId);
      const approverUser = (state.masterUsers || []).find(u => u.id === approverId);

      const newResubmitReq = {
        id: newReqId,
        requestId: newReqId,
        requestNo: newReqId,
        edrNumber: newReqId,
        docId: oldDoc.id,
        documentId: oldDoc.id,
        externalDocId: oldDoc.id,
        edCode,
        doc_code: edCode,
        docCode: edCode,
        documentCode: edCode,
        title: updatedDoc.title,
        requestType: 'NEW',
        department: updatedDoc.department || 'QA',
        requesterId: updatedDoc.ownerId || state.currentUser?.id || 'U001',
        requesterName: state.currentUser?.fullName || state.currentUser?.name || updatedDoc.ownerName || 'User',
        requesterDepartment: updatedDoc.department || 'QA',
        requesterRole: state.currentUser?.position || 'Requester',
        reviewerId: reviewerId || null,
        reviewerName: reviewerUser ? (reviewerUser.fullName || reviewerUser.name) : '-',
        reviewerRole: 'Reviewer',
        approverId: approverId || null,
        approverName: approverUser ? (approverUser.fullName || approverUser.name) : '-',
        approverRole: 'Approver',
        status: newStatus,
        returnReason: null,
        revisionComment: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        signoffs: [
          {
            step: 'REQUEST',
            stepName: 'ยื่นคำร้อง',
            role: 'ผู้ยื่นคำร้อง',
            userId: state.currentUser?.id || oldDoc.ownerId,
            userName: state.currentUser?.fullName || state.currentUser?.name,
            userRole: state.currentUser?.position || 'Requester',
            status: 'COMPLETED',
            date: nowIso,
            comment: updates.reason || 'ยื่นคำร้องขึ้นทะเบียนเอกสารภายนอก'
          },
          {
            step: 'REVIEW',
            stepName: 'ทบทวนเอกสาร',
            role: 'ผู้ทบทวน',
            userId: reviewerId || null,
            userName: reviewerUser ? (reviewerUser.fullName || reviewerUser.name) : '-',
            userRole: 'Reviewer',
            status: reviewerId ? 'PENDING' : 'SKIPPED',
            date: null,
            comment: null
          },
          {
            step: 'APPROVE',
            stepName: 'อนุมัติเอกสาร',
            role: 'ผู้อนุมัติ',
            userId: approverId || null,
            userName: approverUser ? (approverUser.fullName || approverUser.name) : '-',
            userRole: 'Approver',
            status: approverId ? (reviewerId ? 'WAITING' : 'PENDING') : 'SKIPPED',
            date: null,
            comment: null
          }
        ]
      };
      updatedRequests.unshift(newResubmitReq);
    }

    return {
      externalDocuments: state.externalDocuments.filter(d => String(d.id) !== String(oldDoc.id) && String(d.id) !== String(id)),
      externalRequests: updatedRequests,
      tasks: newTasks,
      notifications: newNotifications,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'EXT_DOC_RESUBMIT',
        details: `Resubmitted external document: ${edCode} - ${updatedDoc.title} after revision`,
        actor: state.currentUser?.name || 'User',
        actorId: state.currentUser?.id || 'U001',
        actorRole: state.currentUser?.role || state.currentUser?.position,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])],
      externalAuditTrail: [{
        id: `EXTA-${Date.now()}`,
        docId: oldDoc.id,
        action: 'RESUBMIT',
        actor: state.currentUser?.name || 'User',
        actorId: state.currentUser?.id || 'U001',
        date: new Date().toISOString(),
        details: `Resubmitted external document after revision`
      }, ...state.externalAuditTrail]
    };
  }),

  addDarAndReturnId: (dar) => {
    let newDarId = '';
    set((state) => {
      const date = new Date();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yy = String(date.getFullYear()).slice(-2);
      const prefix = `DAR`;
      const suffix = `-${mm}-${yy}`;
      
      const existingDarsThisMonth = state.dars.filter(d => d.id.endsWith(suffix));
      let nextRun = 1;
      if (existingDarsThisMonth.length > 0) {
         const runNums = existingDarsThisMonth.map(d => parseInt(d.id.replace(prefix, '').split('-')[0]));
         nextRun = Math.max(...runNums) + 1;
      }
      newDarId = `${prefix}${String(nextRun).padStart(2, '0')}${suffix}`;
      
      const distributions = dar.distributions || [];
      const newDar = { ...dar, id: newDarId, distributions };

      const today = new Date();
      today.setDate(today.getDate() + state.mockDateOffset);
      const todayStr = today.toISOString().split('T')[0];

      const reviewSla = calculateTaskDueDate({
        submissionDate: newDar.date || todayStr,
        effectiveDate: newDar.effectiveDate,
        stepSlaDays: state.slaSettings?.reviewSlaDays || 3,
        mockDateOffset: state.mockDateOffset
      });

      let newTasks = [...state.tasks];
      let newNotifications = [...state.notifications];
      let realStatus = dar.isDraft ? 'DRAFT' : 'UNDER_REVIEW';
      
      // Generate Reviewer Task
      if (!dar.isDraft) {
        realStatus = 'UNDER_REVIEW';
        let reviewerObj = resolveReviewer(
          newDar.requesterId, 
          newDar.department, 
          state.masterUsers, 
          state.reviewUsers, 
          newDar.docType, 
          state.approvalMatrix
        );
        
        if (reviewerObj) {
          const newTaskId = `t-${Date.now()}`;
          const darDept = newDar.department || 'PD';
          newTasks.push({
            id: newTaskId,
            referenceType: 'INTERNAL_DAR', referenceId: newDar.id,
            darId: newDar.id, title: newDar.title, type: 'Review',
            assigneeId: reviewerObj.id,
            department: darDept,
            target_department: darDept,
            owner_dept: darDept,
            currentHandlerDepartment: darDept,
            currentHandlerLevel: reviewerObj.level,
            dueDate: reviewSla.dueDate,
            cancelDate: reviewSla.cancelDate,
            isUrgent: reviewSla.isUrgent,
            isFastTrack: reviewSla.isFastTrack,
            priority: reviewSla.isUrgent ? 'URGENT' : 'NORMAL',
            slaType: reviewSla.slaType,
            effectiveDate: reviewSla.effectiveDate,
            status: 'NORMAL'
          });
          newNotifications.push({ id: Date.now() + Math.random(), userId: reviewerObj.id, title: 'งานใหม่รอการตรวจสอบ', message: `DAR "${newDar.title}" รอการตรวจสอบจากคุณ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
        }
      }

      return { 
        dars: [...state.dars, { ...newDar, status: realStatus }],
        tasks: newTasks,
        notifications: newNotifications,
        timeline: [...state.timeline, { 
          id: Date.now(), darId: newDar.id, action: 'Created', user: state.currentUser.name, date: new Date().toLocaleString(), comment: 'Submitted request' 
        }],
        actionLog: [{
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actionType: 'DAR_SUBMIT',
          actor: state.currentUser.name,
          details: `Submitted DAR ${newDar.id}`,
          timestamp: new Date().toISOString()
        }, ...(state.actionLog || [])]
      };
    });
    return newDarId;
  },

  updateTask: (taskId, updates) => set((state) => {
    const newTasks = state.tasks.map(t => {
      // Note: task processing starts here
      // Check both id and taskId
      if (t.id === taskId || t.taskId === taskId) {
        return { ...t, ...updates };
      }
      return t;
    });
    return { tasks: newTasks };
  }),

  addDar: (dar) => set((state) => {
    // Generate new ID DAR-YYYY-XXX upon non-draft submission
    let newDarId = dar.id;
    let allocatedDarNumber = dar.darNumber || null;

    if (!dar.isDraft && dar.status !== 'DRAFT') {
      const targetYear = new Date().getFullYear();
      allocatedDarNumber = dar.darNumber || generateInternalDarNumber(state.dars, targetYear);
      newDarId = allocatedDarNumber;
    } else if (!newDarId) {
      newDarId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    const today = new Date();
    today.setDate(today.getDate() + (state.mockDateOffset || 0));
    const todayStr = today.toISOString().split('T')[0];

    const newDar = { 
      ...dar, 
      id: newDarId, 
      darNumber: allocatedDarNumber,
      darNo: allocatedDarNumber,
      dar_no: allocatedDarNumber,
      title: dar.title || dar.docTitle || dar.name || 'Untitled Document',
      name: dar.name || dar.title || dar.docTitle || 'Untitled Document',
      docTitle: dar.docTitle || dar.name || dar.title || 'Untitled Document',
      department: dar.department || state.currentUser?.department || 'PD',
      requesterId: dar.requesterId || dar.requester_id || state.currentUser?.id || 'EMP-001',
      date: dar.date || dar.createdAt?.split('T')[0] || todayStr,
      type: dar.type || 'NEW',
      distributions: dar.distributions || []
    };

    if (newDar.type === 'NEW' || newDar.type === 'NEW_DOCUMENT') {
      const selectedTypeObj = (state.documentTypes || []).find(t => (t.code || t.id) === newDar.docType);
      const pattern = selectedTypeObj?.namingPattern || `${newDar.docType}-{Dept}-{##}`;
      const nextSeq = calculateNextDocumentSequence(newDar.docType, newDar.department, state.documents, state.dars);
      const seqFormatted = formatDocumentRunningNumber(nextSeq);
      if (pattern.includes('{Type}') || pattern.includes('{Dept}') || pattern.includes('{###}') || pattern.includes('{##}')) {
        newDar.docIdInput = pattern
          .replace('{Type}', newDar.docType)
          .replace('{Dept}', newDar.department)
          .replace('{###}', seqFormatted)
          .replace('{##}', seqFormatted);
      } else {
        newDar.docIdInput = `${newDar.docType}-${newDar.department}-${seqFormatted}`;
      }
    }

    // When a DAR is added, it needs a Reviewer assigned from the same department
    // Criteria: candidate.level >= minReviewerLevel (L4+ threshold with linear escalation)
    let reviewerObj = null;
    if (!newDar.manualReviewerId) {
      reviewerObj = resolveReviewer(
        newDar.requesterId, 
        newDar.department, 
        state.masterUsers, 
        state.reviewUsers, 
        newDar.docType, 
        state.approvalMatrix
      );
    } else {
      const u = state.masterUsers.find(m => m.id === newDar.manualReviewerId);
      if (u) reviewerObj = { id: u.id, level: u.level, dept: newDar.department };
    }

    // Safety fallback: if no candidate found in pool, escalate to management
    if (!reviewerObj) {
      const fallback = state.masterUsers.find(m => 
        m.id !== newDar.requesterId && 
        (!m.isDcc || newDar.department === 'DC') && 
        ((m.approval_level || m.level || 0) >= 4 || m.isQmr || m.role === 'DEPT_ADMIN')
      );
      if (fallback) {
        reviewerObj = { id: fallback.id, level: fallback.approval_level || fallback.level || 4, dept: fallback.department || newDar.department };
      }
    }

    const reviewSla = calculateTaskDueDate({
      submissionDate: newDar.date || todayStr,
      effectiveDate: newDar.effectiveDate,
      stepSlaDays: state.slaSettings?.reviewSlaDays || 3,
      mockDateOffset: state.mockDateOffset
    });

    let newTasks = [...state.tasks];
    let newNotifications = [...state.notifications];
    let realStatus = dar.isDraft ? 'DRAFT' : 'UNDER_REVIEW';

    if (!dar.isDraft && reviewerObj) {
      const newTaskId = `t-${Date.now()}`;
      const docCode = newDar.docCode || newDar.document_code || newDar.docIdInput || newDar.docId || newDar.title || newDar.darNumber;
      const docOfficialTitle = newDar.docTitle || newDar.name || newDar.document_name || newDar.docName || newDar.title;
      newTasks.push({
        id: newTaskId,
        referenceType: 'INTERNAL_DAR', referenceId: newDar.id,
        darId: newDar.id,
        docId: newDar.docId || newDar.id,
        docCode: docCode,
        doc_code: docCode,
        docTitle: docOfficialTitle,
        docName: docOfficialTitle,
        title: `[DAR ทบทวน] ${docOfficialTitle} (${docCode})`,
        type: 'Review',
        taskType: 'DAR_REVIEW',
        task_type: 'DAR_REVIEW',
        assigneeId: reviewerObj.id,
        assignee_id: reviewerObj.id,
        assigneeName: reviewerObj.name || '',
        department: newDar.department || newDar.dept || 'PD',
        target_department: newDar.department || newDar.dept || 'PD',
        owner_dept: newDar.department || newDar.dept || 'PD',
        currentHandlerDepartment: newDar.department || newDar.dept || 'PD',
        currentHandlerLevel: reviewerObj.level,
        required_approval_level: reviewerObj.level,
        dueDate: reviewSla.dueDate,
        cancelDate: reviewSla.cancelDate,
        isUrgent: reviewSla.isUrgent,
        isFastTrack: reviewSla.isFastTrack,
        priority: reviewSla.isUrgent ? 'URGENT' : 'NORMAL',
        slaType: reviewSla.slaType,
        effectiveDate: reviewSla.effectiveDate,
        status: 'NORMAL'
      });
      newNotifications.push({ 
        id: `notif-dar-rev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, 
        userId: reviewerObj.id, 
        targetUserIds: [reviewerObj.id],
        title: 'งานใหม่รอการตรวจสอบ', 
        message: `DAR "${docOfficialTitle}" (${docCode}) รอการตรวจสอบจากคุณ`, 
        type: 'TASK_ASSIGNED',
        category: 'DAR',
        isRead: false, 
        read: false,
        readBy: [],
        link: '/tasks', 
        timestamp: new Date().toISOString(), 
        relatedTaskId: newTaskId,
        docCode: docCode,
        refId: newDar.id
      });
    }

    return {
      dars: [...state.dars, { ...newDar, status: realStatus }],
      darRequests: [...(state.dars || []), { ...newDar, status: realStatus }],
      tasks: newTasks,
      notifications: newNotifications,
      timeline: [...state.timeline, { 
        id: Date.now(), darId: newDar.id, action: 'Created', user: state.currentUser.name, date: new Date().toLocaleString(), comment: 'Submitted request' 
      }],
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: dar.isDraft ? 'DRAFT_SAVED' : 'DAR_SUBMITTED',
        actor: state.currentUser.name,
        details: `Submitted DAR ${newDar.darNumber || newDar.id}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  submitDar: (dar) => {
    return get().addDar({ ...dar, isDraft: false });
  },

  // Universal DAR Draft Save & Upsert Action
  saveDarDraft: (draftData) => set((state) => {
    const list = state.dars || [];
    const targetId = draftData.id || draftData.dar_no || draftData.darNo;
    
    // Check if draft already exists
    const existingIndex = list.findIndex(
      (d) => String(d.id) === String(targetId) || (targetId && (String(d.dar_no) === String(targetId) || String(d.darNo) === String(targetId)))
    );

    let updatedDars;
    let savedId = targetId;

    if (existingIndex >= 0) {
      // In-place update
      const existing = list[existingIndex];
      savedId = existing.id;
      const updatedDraft = {
        ...existing,
        ...draftData,
        id: existing.id,
        darNumber: null,
        darNo: null,
        dar_no: null,
        status: 'DRAFT',
        isDraft: true,
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      updatedDars = [...list];
      updatedDars[existingIndex] = updatedDraft;
    } else {
      // Insert new draft with temporary auto-generated draft ID if not provided
      if (!savedId) {
        savedId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      }

      const newDraft = {
        ...draftData,
        id: savedId,
        darNumber: null,
        darNo: null,
        dar_no: null,
        status: 'DRAFT',
        isDraft: true,
        requesterId: draftData.requesterId || draftData.requester_id || state.currentUser?.id,
        requester_name: draftData.requester_name || state.currentUser?.name,
        department: draftData.department || draftData.owner_dept || state.currentUser?.department || 'QA/QC',
        created_at: draftData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      updatedDars = [newDraft, ...list];
    }

    return {
      dars: updatedDars,
      darRequests: updatedDars,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'DRAFT_SAVED',
        actor: state.currentUser?.name || 'User',
        details: `Saved DAR Draft ${savedId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  deleteDar: (darId) => set((state) => {
    const updatedDars = (state.dars || []).filter(d => d.id !== darId && d.dar_no !== darId && d.darNo !== darId);
    return {
      dars: updatedDars,
      darRequests: updatedDars,
      tasks: state.tasks.filter(t => t.darId !== darId),
      timeline: state.timeline.filter(t => t.darId !== darId),
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'DAR_DELETE',
        actor: state.currentUser?.name || 'System',
        details: `Deleted DAR ${darId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  removeTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== taskId)
  })),

  processWorkflow: (taskId, action, comment) => {
    let newlyCompletedDar = null;
    let targetTask = null;
    let targetDar = null;
    set((state) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return state;

    const dar = state.dars.find(d => d.id === task.darId);
    if (!dar) return state;

    targetTask = task;
    targetDar = dar;

    const newTasks = state.tasks.filter(t => t.id !== taskId);
    let newStatus = dar.status;

    const today = new Date();
    today.setDate(today.getDate() + state.mockDateOffset);
    const _dueDateStr = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const _cancelDateStr = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let newNotifications = state.notifications.map(n => n.relatedTaskId === taskId ? { ...n, isRead: true } : n);

    if (task.type === 'Review' || task.type === 'REVIEW') {
      if (action === 'APPROVE') {
        newStatus = 'PENDING_APPROVAL';

        // Find Approver (Rule: candidate.level >= minApproverLevel, Linear Multi-Stage Pipeline)
        let approverObj = null;
        if (!dar.manualApproverId) {
          approverObj = resolveApprover(
            dar.requesterId, 
            task.assigneeId, 
            dar.department, 
            state.masterUsers, 
            state.approveUsers, 
            dar.docType || dar.doc_type, 
            state.approvalMatrix
          );
        } else {
          const u = state.masterUsers.find(m => m.id === dar.manualApproverId);
          if (u) approverObj = { id: u.id, level: u.level, dept: dar.department };
        }

        // Safety escalation fallback if still not resolved
        if (!approverObj) {
          const fallback = state.masterUsers.find(m => 
            m.id !== dar.requesterId && 
            m.id !== task.assigneeId && 
            (!m.isDcc || dar.department === 'DC') && 
            ((m.approval_level || m.level || 0) >= 5 || m.isQmr || m.role === 'DEPT_ADMIN')
          ) || state.masterUsers.find(m => m.id !== dar.requesterId && m.id !== task.assigneeId);

          if (fallback) {
            approverObj = { id: fallback.id, level: fallback.approval_level || fallback.level || 5, dept: fallback.department || dar.department };
          }
        }

        if (approverObj) {
          const approverSla = calculateTaskDueDate({
            submissionDate: today,
            effectiveDate: dar.effectiveDate,
            stepSlaDays: state.slaSettings?.approvalSlaDays || 3,
            mockDateOffset: state.mockDateOffset
          });
          const newTaskId = `t-${Date.now()}`;
          const docCode = dar.docIdInput || dar.title || dar.darNumber || dar.doc_number;
          const docOfficialTitle = dar.name || dar.document_name || dar.docName || dar.title;
          const darDept = dar.department || 'PD';
          newTasks.push({
            id: newTaskId, referenceType: 'INTERNAL_DAR', referenceId: dar.id, darId: dar.id,
            docId: dar.docId || dar.id,
            docCode: docCode,
            doc_code: docCode,
            docTitle: docOfficialTitle,
            docName: docOfficialTitle,
            title: `[DAR รออนุมัติ] ${docOfficialTitle} (${docCode})`,
            type: 'Approve', assigneeId: approverObj.id,
            department: darDept,
            target_department: darDept,
            owner_dept: darDept,
            currentHandlerDepartment: darDept,
            currentHandlerLevel: approverObj.level,
            dueDate: approverSla.dueDate, cancelDate: approverSla.cancelDate,
            isUrgent: approverSla.isUrgent, isFastTrack: approverSla.isFastTrack, priority: approverSla.isUrgent ? 'URGENT' : 'NORMAL', slaType: approverSla.slaType, effectiveDate: approverSla.effectiveDate,
            status: 'NORMAL'
          });
          newNotifications.push({
            id: `notif-dar-app-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            userId: approverObj.id,
            targetUserIds: [approverObj.id],
            title: 'งานใหม่รอการอนุมัติ',
            message: `DAR "${dar.title}" รอการอนุมัติจากคุณ`,
            type: 'TASK_ASSIGNED',
            category: 'DAR',
            isRead: false,
            read: false,
            readBy: [],
            link: '/tasks',
            timestamp: new Date().toISOString(),
            relatedTaskId: newTaskId,
            docCode: docCode,
            refId: dar.id
          });

          if (dar.requesterId) {
            newNotifications.push({
              id: `notif-dar-revpass-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              userId: dar.requesterId,
              targetUserIds: [dar.requesterId],
              title: 'DAR ผ่านการทบทวนแล้ว',
              message: `DAR "${dar.title}" ผ่านการทบทวนแล้ว และถูกส่งต่อให้ผู้อนุมัติพิจารณา`,
              type: 'WORKFLOW_UPDATE',
              category: 'DAR',
              isRead: false,
              read: false,
              readBy: [],
              link: '/tasks',
              timestamp: new Date().toISOString(),
              docCode: docCode,
              refId: dar.id
            });
          }
        }
      } else if (action === 'RETURN') {
        newStatus = 'RETURNED_FOR_REVISION';
        const reviseSla = calculateTaskDueDate({
          submissionDate: today,
          effectiveDate: dar.effectiveDate,
          stepSlaDays: state.slaSettings?.darCreationSlaDays || 3,
          mockDateOffset: state.mockDateOffset
        });
        const newTaskId = `t-${Date.now()}`;
        const docCode = dar.docIdInput || dar.title || dar.darNumber || dar.doc_number;
        const docOfficialTitle = dar.name || dar.document_name || dar.docName || dar.title;
        const darDept = dar.department || 'PD';
        newTasks.push({
          id: newTaskId, referenceType: 'INTERNAL_DAR', referenceId: dar.id, darId: dar.id,
          docId: dar.docId || dar.id,
          docCode: docCode,
          doc_code: docCode,
          docTitle: docOfficialTitle,
          docName: docOfficialTitle,
          title: `[DAR ส่งกลับแก้ไข] ${docOfficialTitle} (${docCode})`,
          type: 'Revise', assigneeId: dar.requesterId,
          department: darDept,
          target_department: darDept,
          owner_dept: darDept,
          currentHandlerDepartment: darDept,
          dueDate: reviseSla.dueDate, cancelDate: reviseSla.cancelDate,
          isUrgent: reviseSla.isUrgent, isFastTrack: reviseSla.isFastTrack, priority: reviseSla.isUrgent ? 'URGENT' : 'NORMAL', slaType: reviseSla.slaType, effectiveDate: reviseSla.effectiveDate,
          status: 'NORMAL'
        });
        newNotifications.push({
          id: `notif-dar-return1-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          userId: dar.requesterId,
          targetUserIds: [dar.requesterId],
          title: 'DAR ถูกส่งกลับแก้ไข',
          message: `DAR "${dar.title}" ถูกส่งกลับให้คุณแก้ไข${comment ? `: ${comment}` : ''}`,
          type: 'ACTION_REQUIRED',
          category: 'DAR',
          isRead: false,
          read: false,
          readBy: [],
          link: '/tasks',
          timestamp: new Date().toISOString(),
          relatedTaskId: newTaskId,
          docCode: docCode,
          refId: dar.id
        });
      }
    } else if (task.type === 'Approve') {
      if (action === 'APPROVE') {
        const todayStr = today.toISOString().split('T')[0];
        const isImmediateEffective = !dar.effectiveDate || dar.effectiveDate <= todayStr;

        if (dar.ackRequirement === 'REQUIRED') {
          newStatus = 'WAITING_ACKNOWLEDGEMENT';
        } else {
          newStatus = isImmediateEffective ? 'COMPLETED' : 'APPROVED_WAITING_EFFECTIVE';
        }

        // Notify Requester of Approval
        if (dar.requesterId) {
          newNotifications.push({
            id: `notif-dar-approved-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            userId: dar.requesterId,
            targetUserIds: [dar.requesterId],
            title: 'DAR ได้รับการอนุมัติแล้ว',
            message: `คำร้อง DAR "${dar.title}" ได้รับการอนุมัติเรียบร้อยแล้ว`,
            type: 'SUCCESS',
            category: 'DAR',
            isRead: false,
            read: false,
            readBy: [],
            link: '/tasks',
            timestamp: new Date().toISOString(),
            docCode: dar.docIdInput || dar.title,
            refId: dar.id
          });
        }

        // Notify DCC Admin of Approval (pending DCC processing)
        const dccAdminId = resolveDccAdminUserId(state.masterUsers);
        if (dccAdminId) {
          newNotifications.push({
            id: `notif-dar-dccapp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            userId: dccAdminId,
            targetUserIds: [dccAdminId],
            title: 'DAR ได้รับการอนุมัติแล้ว (รอ DCC ดำเนินการ)',
            message: `คำร้อง DAR "${dar.title}" ได้รับการอนุมัติแล้ว กรุณาดำเนินการขั้นต่อไป`,
            type: 'TASK_ASSIGNED',
            category: 'DAR',
            isRead: false,
            read: false,
            readBy: [],
            link: '/tasks',
            timestamp: new Date().toISOString(),
            docCode: dar.docIdInput || dar.title,
            refId: dar.id
          });
        }

        if (newStatus === 'WAITING_ACKNOWLEDGEMENT' && dar.ackUserIds?.length > 0) {
          const ackSla = calculateTaskDueDate({
            submissionDate: today,
            effectiveDate: dar.effectiveDate,
            stepSlaDays: 3,
            mockDateOffset: state.mockDateOffset
          });
          const docCode = dar.docIdInput || dar.title || dar.darNumber || dar.doc_number;
          const docOfficialTitle = dar.name || dar.document_name || dar.docName || dar.title;
          const darDept = dar.department || 'PD';
          dar.ackUserIds.forEach(uid => {
            const newTaskId = `t-${Date.now()}-${uid}`;
            newTasks.push({
              id: newTaskId, referenceType: 'INTERNAL_DAR', referenceId: dar.id, darId: dar.id,
              docId: dar.docId || dar.id,
              docCode: docCode,
              doc_code: docCode,
              docTitle: docOfficialTitle,
              docName: docOfficialTitle,
              title: `[รับทราบเอกสาร] ${docOfficialTitle} (${docCode})`,
              type: 'Ack', assigneeId: uid,
              department: darDept,
              target_department: darDept,
              owner_dept: darDept,
              currentHandlerDepartment: darDept,
              dueDate: ackSla.dueDate, cancelDate: ackSla.cancelDate,
              isUrgent: ackSla.isUrgent, isFastTrack: ackSla.isFastTrack, priority: ackSla.isUrgent ? 'URGENT' : 'NORMAL', slaType: ackSla.slaType, effectiveDate: ackSla.effectiveDate,
              status: 'NORMAL'
            });
            newNotifications.push({
              id: `notif-ack-${Date.now()}-${uid}`,
              userId: uid,
              targetUserIds: [uid],
              title: 'โปรดรับทราบเอกสาร',
              message: `DAR "${dar.title}" บังคับใช้แล้ว โปรดรับทราบ`,
              type: 'ACTION_REQUIRED',
              category: 'DAR',
              isRead: false,
              read: false,
              readBy: [],
              link: '/tasks',
              timestamp: new Date().toISOString(),
              relatedTaskId: newTaskId,
              docCode: docCode,
              refId: dar.id
            });
          });
        }
      } else if (action === 'RETURN') {
        newStatus = 'RETURNED_FOR_REVISION';
        const reviseSla = calculateTaskDueDate({
          submissionDate: today,
          effectiveDate: dar.effectiveDate,
          stepSlaDays: state.slaSettings?.darCreationSlaDays || 3,
          mockDateOffset: state.mockDateOffset
        });
        const newTaskId = `t-${Date.now()}`;
        const docCode = dar.docIdInput || dar.title || dar.darNumber || dar.doc_number;
        const docOfficialTitle = dar.name || dar.document_name || dar.docName || dar.title;
        const darDept = dar.department || 'PD';
        newTasks.push({
          id: newTaskId, referenceType: 'INTERNAL_DAR', referenceId: dar.id, darId: dar.id,
          docId: dar.docId || dar.id,
          docCode: docCode,
          doc_code: docCode,
          docTitle: docOfficialTitle,
          docName: docOfficialTitle,
          title: `[DAR ส่งกลับแก้ไข] ${docOfficialTitle} (${docCode})`,
          type: 'Revise', assigneeId: dar.requesterId,
          department: darDept,
          target_department: darDept,
          owner_dept: darDept,
          currentHandlerDepartment: darDept,
          dueDate: reviseSla.dueDate, cancelDate: reviseSla.cancelDate,
          isUrgent: reviseSla.isUrgent, isFastTrack: reviseSla.isFastTrack, priority: reviseSla.isUrgent ? 'URGENT' : 'NORMAL', slaType: reviseSla.slaType, effectiveDate: reviseSla.effectiveDate,
          status: 'NORMAL'
        });
        newNotifications.push({
          id: `notif-dar-return2-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          userId: dar.requesterId,
          targetUserIds: [dar.requesterId],
          title: 'DAR ถูกส่งกลับแก้ไข',
          message: `DAR "${dar.title}" ถูกส่งกลับให้คุณแก้ไข${comment ? `: ${comment}` : ''}`,
          type: 'ACTION_REQUIRED',
          category: 'DAR',
          isRead: false,
          read: false,
          readBy: [],
          link: '/tasks',
          timestamp: new Date().toISOString(),
          relatedTaskId: newTaskId,
          docCode: docCode,
          refId: dar.id
        });
      } else if (action === 'REJECT') {
        newStatus = 'REJECTED';
        if (dar.requesterId) {
          newNotifications.push({
            id: `notif-dar-rejected-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            userId: dar.requesterId,
            targetUserIds: [dar.requesterId],
            title: 'คำร้อง DAR ไม่ได้รับการอนุมัติ',
            message: `DAR "${dar.title}" ไม่ผ่านการอนุมัติ${comment ? `: ${comment}` : ''}`,
            type: 'REJECTED',
            category: 'DAR',
            isRead: false,
            read: false,
            readBy: [],
            link: '/tasks',
            timestamp: new Date().toISOString(),
            docCode: dar.docIdInput || dar.title,
            refId: dar.id
          });
        }
      }
    } else if (task.type === 'Ack') {
      if (action === 'ACKNOWLEDGE') {
        // Check if there are other pending Ack tasks for this DAR
        const remainingAcks = newTasks.filter(t => t.darId === dar.id && t.type === 'Ack');
        if (remainingAcks.length === 0) {
          const today = new Date();
          today.setDate(today.getDate() + state.mockDateOffset);
          const todayStr = today.toISOString().split('T')[0];
          
          if (!dar.effectiveDate || dar.effectiveDate <= todayStr) {
            newStatus = 'COMPLETED';
          } else {
            newStatus = 'APPROVED_WAITING_EFFECTIVE';
          }
        }
      }
    }

    const updatedDars = state.dars.map(d => d.id === dar.id ? { ...d, status: newStatus } : d);
    if (newStatus === 'COMPLETED' && dar.status !== 'COMPLETED') {
      newlyCompletedDar = { ...dar, status: 'COMPLETED' };
    }

    let timelineActionLabel = action;
    if (action === 'APPROVE') {
      timelineActionLabel = task.type === 'Review' ? 'Reviewed' : 'Approved';
    } else if (action === 'RETURN') {
      timelineActionLabel = 'Returned for Revision';
    } else if (action === 'REJECT') {
      timelineActionLabel = 'Rejected';
    } else if (action === 'ACKNOWLEDGE') {
      timelineActionLabel = 'Acknowledged';
    }

    const newTimeline = [...state.timeline, {
      id: Date.now(), darId: dar.id, action: timelineActionLabel, user: state.currentUser.name, date: new Date().toLocaleString(), comment: comment || '-', isChat: false, userId: state.currentUser.id
    }];

    let updatedDocs = state.documents;
    if (newStatus === 'COMPLETED' || newStatus === 'REJECTED' || newStatus === 'CANCELLED' || (action === 'APPROVE' && (targetTask?.type === 'Approve' || targetTask?.type === 'APPROVE'))) {
      const targetDocCode = dar.document_code || dar.doc_code || dar.code || dar.docCode || dar.title;
      const targetDocId = dar.docIdRef || dar.docId || dar.doc_id || dar.targetDocumentId;
      updatedDocs = (state.documents || []).map(d => {
        const isDocMatch = 
          (targetDocId && String(d.id) === String(targetDocId)) ||
          (targetDocCode && (d.document_code === targetDocCode || d.doc_code === targetDocCode || d.code === targetDocCode || d.title === targetDocCode));
        if (isDocMatch) {
          return {
            ...d,
            isLocked: false,
            hasPendingDar: false
          };
        }
        return d;
      });
    }

    const newState = {
      documents: updatedDocs,
      tasks: newTasks,
      notifications: newNotifications,
      dars: updatedDars,
      timeline: newTimeline,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: `WORKFLOW_${action}`,
        details: `Processed task ${taskId} (${action}) for DAR ${dar.title}`,
        actor: state.currentUser.name,
        actorId: state.currentUser.id,
        actorRole: state.currentUser.role || state.currentUser.position,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };

    return newState;
    });

    const targetDarToPublish = ((targetTask?.type === 'Approve' || targetTask?.type === 'APPROVE') && action === 'APPROVE') ? targetDar : newlyCompletedDar;
    if (targetDarToPublish) {
      const store = get();
      if (store.syncRevisionEffective) store.syncRevisionEffective(targetDarToPublish);
      if (store.syncObsoleteCompleted) store.syncObsoleteCompleted(targetDarToPublish);
      if (store.publishApprovedDar) {
        store.publishApprovedDar(targetDarToPublish.id);
      } else if (targetDarToPublish.type === 'REVISION') {
        store.publishDarRevision(targetDarToPublish.id);
      } else if (targetDarToPublish.type === 'OBSOLETE') {
        store.publishObsoleteDar(targetDarToPublish.id);
      }
    }
  },

  // Complete task alias forwarding to processWorkflow
  completeTask: (taskId, action, comment) => {
    return get().processWorkflow(taskId, action, comment);
  },

  // Advance workflow stage alias forwarding to processWorkflow
  advanceWorkflowStage: (taskId, action, comment) => {
    return get().processWorkflow(taskId, action, comment);
  },

  // Generic createTask helper enforcing Task Department Scoping (Document/DAR Owner Authority)
  createTask: (taskInput) => set((state) => {
    if (!taskInput) return state;
    const safeDars = state.dars || [];
    const safeDocs = state.documents || [];
    const matchedDar = safeDars.find(d => String(d.id) === String(taskInput.darId));
    const docCode = taskInput.doc_code || taskInput.docCode || taskInput.document_code || '';
    const docId = taskInput.docId || taskInput.doc_id;
    const matchedDoc = safeDocs.find(d => 
      (docId && String(d.id) === String(docId)) ||
      (docCode && (d.title === docCode || d.document_code === docCode || d.code === docCode))
    );

    let ownerDept = matchedDar?.department || matchedDoc?.department || taskInput.department;
    if (!ownerDept) {
      if (String(docCode).includes('-PD-') || String(taskInput.title).includes('-PD-') || String(taskInput.darId).includes('-PD-')) {
        ownerDept = 'PD';
      }
    }
    const cleanDept = ownerDept === 'DCC' ? 'DC' : (ownerDept || 'PD');

    const newTask = {
      ...taskInput,
      id: taskInput.id || `t-${Date.now()}`,
      department: cleanDept,
      target_department: cleanDept,
      owner_dept: cleanDept,
      currentHandlerDepartment: cleanDept
    };

    return {
      tasks: [newTask, ...state.tasks]
    };
  }),

  resubmitDar: (darId, updatedData, taskId) => set((state) => {
    const dar = state.dars.find(d => d.id === darId);
    if (!dar) return state;

    const newTasks = state.tasks.filter(t => t.id !== taskId);
    const updatedDars = state.dars.map(d => d.id === darId ? { ...d, ...updatedData, status: 'UNDER_REVIEW' } : d);
    let newNotifications = [...state.notifications];

    const reviewerObj = resolveReviewer(
      dar.requesterId, 
      dar.department, 
      state.masterUsers, 
      state.reviewUsers, 
      dar.docType || dar.doc_type, 
      state.approvalMatrix
    );
    const assignedReviewerId = reviewerObj?.id || reviewerObj;

    if (assignedReviewerId) {
      const today = new Date();
      today.setDate(today.getDate() + state.mockDateOffset);
      const _todayStr = today.toISOString().split('T')[0];
      const taskSla = calculateTaskDueDate({
        submissionDate: today,
        effectiveDate: updatedData.effectiveDate || dar.effectiveDate,
        stepSlaDays: state.slaSettings?.reviewSlaDays || 3,
        mockDateOffset: state.mockDateOffset
      });

      const docCode = updatedData.title || dar.title || dar.docIdInput;
      const docOfficialTitle = updatedData.name || dar.name || updatedData.title || dar.title;
      const darDept = dar.department || updatedData.department || 'PD';
      newTasks.push({
        id: `t-${Date.now()}`,
        referenceType: 'INTERNAL_DAR', referenceId: dar.id,
        darId: dar.id,
        docId: dar.docId || dar.id,
        docCode: docCode,
        doc_code: docCode,
        docTitle: docOfficialTitle,
        docName: docOfficialTitle,
        title: `[DAR ทบทวนใหม่] ${docOfficialTitle} (${docCode})`,
        type: 'Review',
        assigneeId: assignedReviewerId,
        department: darDept,
        target_department: darDept,
        owner_dept: darDept,
        currentHandlerDepartment: darDept,
        currentHandlerLevel: reviewerObj?.level || 4,
        dueDate: taskSla.dueDate,
        cancelDate: taskSla.cancelDate,
        isUrgent: taskSla.isUrgent,
        isFastTrack: taskSla.isFastTrack,
        priority: taskSla.isUrgent ? 'URGENT' : 'NORMAL',
        slaType: taskSla.slaType,
        effectiveDate: taskSla.effectiveDate,
        status: 'NORMAL'
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: assignedReviewerId, title: 'งานใหม่รอการตรวจสอบ', message: `DAR "${updatedData.title || dar.title}" ถูกส่งมาใหม่ รอการตรวจสอบจากคุณ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
    }

    return {
      dars: updatedDars,
      tasks: newTasks,
      notifications: newNotifications,
      timeline: [...state.timeline, {
        id: Date.now(), darId: dar.id, action: 'Resubmitted', user: state.currentUser.name, date: new Date().toLocaleString(), comment: 'Resubmitted after revision'
      }],
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: `DAR_RESUBMIT`,
        details: `Resubmitted DAR ${dar.title}`,
        actor: state.currentUser.name,
        actorId: state.currentUser.id,
        actorRole: state.currentUser.role || state.currentUser.position,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  submitCopyRequest: (docId, reason, qty, dept) => set((state) => {
    const doc = state.documents.find(d => d.id === docId);
    if (!doc) return state;

    const request = {
      id: `CR-${Date.now()}`,
      docId,
      docTitle: doc.title,
      requesterId: state.currentUser.id,
      department: dept,
      reason,
      qty,
      status: 'PENDING_MANAGER_APPROVAL',
      dateRequested: new Date().toISOString().split('T')[0]
    };

    const managerObj = state.masterUsers.find(u => u.department === state.currentUser.department && u.level > state.currentUser.level) ||
      state.masterUsers.find(u => u.level > state.currentUser.level);

    let newTasks = [...state.tasks];
    let newNotifications = [...state.notifications];

    if (managerObj) {
      const newTaskId = `t-${Date.now()}-cra`;
      const copyDept = doc.department || dept || state.currentUser.department || 'PD';
      newTasks.push({
        id: newTaskId,
        title: `อนุมัติเบิกสำเนาเพิ่มเติม (${doc.title})`,
        type: 'CC_REPLACEMENT_APPROVAL',
        assigneeId: managerObj.id,
        department: copyDept,
        target_department: copyDept,
        owner_dept: copyDept,
        status: 'PENDING',
        requestId: request.id
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: managerObj.id, title: 'อนุมัติเบิกสำเนา', message: `คำขอเบิกสำเนา ${doc.title} รอการอนุมัติ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
    } else {
      request.status = 'PENDING_DCC_DISTRIBUTION';
      const newTaskId = `t-${Date.now()}-ccd`;
      newTasks.push({
        id: newTaskId,
        title: `แจกจ่ายสำเนาเพิ่มเติม (${doc.title})`,
        type: 'DCC_REPLACEMENT',
        assigneeId: 'U001',
        department: 'DC',
        target_department: 'DC',
        owner_dept: 'DC',
        status: 'PENDING',
        requestId: request.id
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: 'U001', title: 'คำขอเบิกสำเนา', message: `มีคำขอเบิกสำเนา ${doc.title} ที่ผ่านการอนุมัติแล้ว`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
    }

    return {
      copyRequests: [request, ...state.copyRequests],
      tasks: newTasks,
      notifications: newNotifications,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: `COPY_REQUEST_SUBMIT`,
        details: `Requested ${qty} copies of ${doc.title}`,
        actor: state.currentUser.name,
        actorId: state.currentUser.id,
        actorRole: state.currentUser.role || state.currentUser.position,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  approveCopyRequest: (taskId, action) => set((state) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return state;

    const request = state.copyRequests.find(r => r.id === task.requestId);
    if (!request) return state;

    const newTasks = state.tasks.filter(t => t.id !== taskId);
    let newNotifications = state.notifications.map(n => n.relatedTaskId === taskId ? { ...n, isRead: true } : n);
    let newCopyRequests = [...state.copyRequests];

    if (action === 'APPROVE') {
      const updatedReq = { ...request, status: 'PENDING_DCC_DISTRIBUTION' };
      newCopyRequests = newCopyRequests.map(r => r.id === request.id ? updatedReq : r);

      const newTaskId = `t-${Date.now()}-ccd`;
      newTasks.push({
        id: newTaskId,
        title: `แจกจ่ายสำเนาเพิ่มเติม (${request.docTitle})`,
        type: 'DCC_REPLACEMENT',
        assigneeId: 'U001',
        department: 'DC',
        target_department: 'DC',
        owner_dept: 'DC',
        status: 'PENDING',
        requestId: request.id
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: 'U001', title: 'คำขอเบิกสำเนา', message: `มีคำขอเบิกสำเนา ${request.docTitle} ที่ผ่านการอนุมัติแล้ว`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
      newNotifications.push({ id: Date.now() + Math.random(), userId: request.requesterId, title: 'คำขอเบิกสำเนาได้รับการอนุมัติ', message: `คำขอเบิกสำเนา ${request.docTitle} ได้รับการอนุมัติแล้ว รอ DCC แจกจ่าย`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
    } else {
      const updatedReq = { ...request, status: 'REJECTED' };
      newCopyRequests = newCopyRequests.map(r => r.id === request.id ? updatedReq : r);
      newNotifications.push({ id: Date.now() + Math.random(), userId: request.requesterId, title: 'คำขอเบิกสำเนาถูกปฏิเสธ', message: `คำขอเบิกสำเนา ${request.docTitle} ไม่ได้รับการอนุมัติ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
    }

    return {
      tasks: newTasks,
      notifications: newNotifications,
      copyRequests: newCopyRequests,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: `COPY_REQUEST_${action}`,
        details: `Processed Copy Request ${request.id} for ${request.docTitle}`,
        actor: state.currentUser.name,
        actorId: state.currentUser.id,
        actorRole: state.currentUser.role || state.currentUser.position,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  simulatedDate: new Date().toISOString().split('T')[0],

  simulateNextDay: () => {
    set((state) => {
      const current = new Date(state.simulatedDate);
      current.setDate(current.getDate() + 1);
      return { simulatedDate: current.toISOString().split('T')[0] };
    });
    useStore.getState().checkSLA();
  },

  checkSLA: () => {
    let newlyCompletedDars = [];
    set((state) => {
    const today = new Date();
    today.setDate(today.getDate() + (state.mockDateOffset || 0));
    const todayStr = state.simulatedDate || today.toISOString().split('T')[0];
    const activeStatuses = ['DRAFT', 'UNDER_REVIEW', 'PENDING_APPROVAL', 'RETURNED_FOR_REVISION', 'WAITING_ACKNOWLEDGEMENT'];
    const activeExtStatuses = ['PENDING_EXT_REVIEW', 'PENDING_EXT_APPROVAL', 'RETURNED_FOR_REVISION'];
    
    const darIdsToCancel = state.dars
      .filter(d => activeStatuses.includes(d.status))
      .filter(d => calculateSLAStatus(d.effectiveDate, todayStr) === 'OVERDUE')
      .map(d => d.id);

    const extDocIdsToCancel = state.externalDocuments
      .filter(d => activeExtStatuses.includes(d.status))
      .filter(d => calculateSLAStatus(d.effectiveDate, todayStr) === 'OVERDUE')
      .map(d => d.id);
    
    let newTasks = state.tasks
      .filter(t => !darIdsToCancel.includes(t.darId) && !extDocIdsToCancel.includes(t.referenceId))
      .map(t => {
        let sla = 'NORMAL';
        if (t.darId) {
          const dar = state.dars.find(d => d.id === t.darId);
          if (dar && activeStatuses.includes(dar.status)) {
            sla = calculateSLAStatus(dar.effectiveDate, todayStr);
          }
        } else if (t.referenceType === 'EXTERNAL_DOC' && t.referenceId) {
          const extDoc = state.externalDocuments.find(d => d.id === t.referenceId);
          if (extDoc && activeExtStatuses.includes(extDoc.status)) {
            sla = calculateSLAStatus(extDoc.effectiveDate, todayStr);
          }
        }
        return { ...t, status: sla };
      });

    let newDars = state.dars.map(d => darIdsToCancel.includes(d.id) ? { ...d, status: 'CANCELLED_OVERDUE' } : d);
    let newExtDocs = state.externalDocuments.map(d => extDocIdsToCancel.includes(d.id) ? { ...d, status: 'CANCELLED_OVERDUE' } : d);
    let newDocuments = [...state.documents];
    const newTimeline = [...state.timeline];
    let newActionLog = state.actionLog ? [...state.actionLog] : [];
    let newExtAuditTrail = state.externalAuditTrail ? [...state.externalAuditTrail] : [];

    darIdsToCancel.forEach(darId => {
      newTimeline.push({
        id: Date.now() + Math.random(), darId, action: 'System Cancel', user: 'System (SLA Engine)', date: new Date().toLocaleString(), comment: 'Auto-cancelled due to Overdue Effective Date'
      });
    });

    extDocIdsToCancel.forEach(extId => {
      newActionLog.unshift({
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'SYSTEM_CANCEL',
        details: `External document cancelled due to Overdue SLA`,
        actor: 'System (SLA Engine)',
        actorId: 'SYS',
        date: new Date().toISOString()
      });
      newExtAuditTrail.unshift({
        id: `EXTA-${Date.now()}-${Math.random()}`,
        docId: extId,
        action: 'SYSTEM_CANCEL',
        actor: 'System (SLA Engine)',
        actorId: 'SYS',
        date: new Date().toISOString(),
        details: 'Auto-cancelled due to Overdue Effective Date'
      });
    });

    const waitingEffectiveDars = newDars.filter(d => d.status === 'APPROVED_WAITING_EFFECTIVE' && d.effectiveDate <= todayStr);

    let newControlledCopyInstances = [...state.controlledCopyInstances];
    let newAuditTrail = [...state.controlledCopyAuditTrail];
    let newNotifications = [...state.notifications];

    if (waitingEffectiveDars.length > 0) {
      waitingEffectiveDars.forEach(dar => {
        const completedDar = { ...dar, status: 'COMPLETED' };
        newlyCompletedDars.push(completedDar);
        newDars = newDars.map(d => d.id === dar.id ? completedDar : d);
        
        if (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') {
          const newDoc = {
            id: `doc-${Date.now()}-${Math.random()}`,
            darId: dar.id,
            title: dar.docIdInput || 'TBD',
            name: dar.title,
            status: 'EFFECTIVE',
            rev: '00',
            department: dar.department,
            controlledCopy: 0,
            effectiveDate: dar.effectiveDate || todayStr,
            distributions: dar.distributions || [],
            access_control: dar.access_control || { scope: 'GENERAL' }
          };
          newDocuments.push(newDoc);
          newNotifications.push({ id: Date.now() + Math.random(), userId: dar.requesterId, title: 'เอกสารบังคับใช้แล้ว', message: `เอกสารใหม่ "${dar.title}" มีผลบังคับใช้แล้ว`, isRead: false, link: '/library', timestamp: new Date().toISOString() });

          if (!newDoc.title.startsWith('FM')) {
            const allocations = calculateCopyAllocations(newDoc.department, newDoc.distributions || []);
            const allTargets = allocations.allAllocations || [];

            if (allTargets.length > 0) {
              const distSla = calculateTaskDueDate({
                submissionDate: today,
                effectiveDate: dar.effectiveDate || newDoc.effectiveDate,
                stepSlaDays: state.slaSettings?.hardcopyReceiptSlaDays || 3,
                mockDateOffset: state.mockDateOffset
              });
              const distDocOfficialTitle = newDoc.name || dar.name || newDoc.title;
              newTasks.push({
                id: `task-dist-${Date.now()}-${Math.random()}`,
                title: `แจกจ่ายเอกสาร Controlled Copy (NEW): ${distDocOfficialTitle} (${newDoc.title})`,
                description: `กรุณาพิมพ์และแจกจ่ายสำเนาควบคุมสำหรับเอกสาร ${newDoc.title} (${distDocOfficialTitle}) จำนวน ${allTargets.length} แผนก/จุดใช้งาน`,
                type: 'DCC_DISTRIBUTE',
                taskType: 'DISTRIBUTION',
                task_type: 'DISTRIBUTION',
                status: 'PENDING',
                assigneeId: resolveDccAdminUserId(state.masterUsers),
                assignedToRole: 'DCC_ADMIN',
                targetRole: 'DCC_ADMIN',
                target_role: 'DCC_ADMIN',
                department: 'DC',
                target_department: 'DC',
                docId: newDoc.id,
                doc_id: newDoc.id,
                document_code: newDoc.title,
                doc_code: newDoc.title,
                docCode: newDoc.title,
                docTitle: distDocOfficialTitle,
                docName: distDocOfficialTitle,
                dueDate: distSla.dueDate,
                cancelDate: distSla.cancelDate,
                isUrgent: distSla.isUrgent,
                isFastTrack: distSla.isFastTrack,
                priority: distSla.isUrgent ? 'URGENT' : 'HIGH',
                slaType: distSla.slaType,
                effectiveDate: distSla.effectiveDate,
                darId: dar.id
              });

              allTargets.forEach((dist, idx) => {
                const deptName = dist.departmentId || dist.dept || dist.dept_code || newDoc.department;
                const locName = cleanLocationName(dist.station_name || dist.locationName || dist.name || dist.location || `${deptName} Head Office`);
                const locId = dist.station_id || dist.locationId || dist.id || `${deptName}-LOC-${idx + 1}`;
                const copyNo = dist.copy_no || dist.copyNo || String(idx + 1).padStart(2, '0');
                const nextCcNum = `CC-${String(idx + 1).padStart(3, '0')}`;
                const isOrigin = dist.isOwner || dist.copyNo === '01' || copyNo === '01';
                const newInst = {
                  id: `inst-${Date.now()}-${idx}`,
                  doc_id: newDoc.id,
                  docId: newDoc.id,
                  doc_code: newDoc.title,
                  docTitle: newDoc.title,
                  docName: newDoc.name,
                  doc_version: newDoc.rev,
                  rev: newDoc.rev,
                  copy_no: copyNo,
                  copyNo: copyNo,
                  ccNumber: nextCcNum,
                  issue_no: '01',
                  issueNumber: 'I01',
                  holder_dept: deptName,
                  department: deptName,
                  departmentId: deptName,
                  dept_code: deptName,
                  target_department: deptName,
                  targetDepartment: deptName,
                  recipientDepartment: deptName,
                  recipient_department: deptName,
                  owner_dept: newDoc.department,
                  holder_name: `${deptName} (${locName})`,
                  location: locName,
                  locationName: locName,
                  locationId: locId,
                  station_id: locId,
                  station_name: locName,
                  is_master: false,
                  isMaster: false,
                  is_owner: isOrigin,
                  isOwner: isOrigin,
                  copy_type: 'CONTROLLED',
                  copyType: 'CONTROLLED',
                  status: 'PENDING_ISSUE',
                  is_replacement: false,
                  dispatched_at: null,
                  dispatched_by: null,
                  dateIssued: todayStr,
                  receipt_confirmed_at: null,
                  receipt_confirmed_by: null,
                  receipt_remarks: null,
                  recall_task_id: null
                };
                const alreadyExists = newControlledCopyInstances.some(inst => {
                  const isMatchDoc = (String(inst.docId || inst.doc_id) === String(createdDoc.id)) ||
                                     (inst.doc_code === createdDoc.title || inst.docTitle === createdDoc.title);
                  const isMatchRev = String(inst.rev || inst.doc_version || inst.revision) === String(createdDoc.rev);
                  const isMatchCopyNo = String(inst.copy_no || inst.copyNo || inst.ccNumber).replace(/\D/g, '') === String(copyNo).replace(/\D/g, '');
                  return isMatchDoc && isMatchRev && isMatchCopyNo;
                });
                if (!alreadyExists) {
                  newControlledCopyInstances.push(newInst);
                }

                newAuditTrail.push({
                  id: `audit-${Date.now()}-${idx}`,
                  timestamp: new Date().toISOString(),
                  user: 'System (SLA Engine)',
                  action: 'AUTO_GENERATE',
                  docTitle: newInst.docTitle,
                  docRev: newInst.rev,
                  ccNumber: newInst.ccNumber,
                  oldStatus: '-',
                  newStatus: newInst.status,
                  remarks: `Auto-generated CC for ${deptName} (${locName}) upon document effective`
                });
              });
            }
          }
        } else if (dar.type === 'REVISION') {
          const targetDocId = dar.docIdRef || dar.docId || dar.doc_id;
          let targetCode = dar.document_code || dar.doc_code || dar.docCode || dar.docIdInput;
          if (!targetCode && targetDocId) {
            const found = newDocuments.find(d => String(d.id) === String(targetDocId));
            if (found) targetCode = found.document_code || found.code || found.title;
          }
          if (!targetCode && dar.title && !dar.title.startsWith('[')) {
            targetCode = dar.title;
          }

          const matchingOldDocs = newDocuments.filter(doc => {
            const code = doc.document_code || doc.code || doc.title;
            return (targetCode && code === targetCode) || (targetDocId && String(doc.id) === String(targetDocId));
          });
          const oldDoc = matchingOldDocs.find(d => d.status === 'EFFECTIVE') || matchingOldDocs[matchingOldDocs.length - 1];

          if (oldDoc || targetCode) {
             const oldRev = oldDoc ? (oldDoc.revision || oldDoc.rev) : (dar.previous_revision || dar.previousRev || '00');
             const currentRevNum = parseInt(oldRev, 10) || 0;
             const newRevNum = currentRevNum + 1;
             const newRevStr = dar.revision || dar.rev || (newRevNum < 10 ? `0${newRevNum}` : `${newRevNum}`);

             // Single Effective Invariant: Update ALL previous revisions of this document code to SUPERSEDED
             newDocuments = newDocuments.map(doc => {
               const code = doc.document_code || doc.code || doc.title;
               const isMatch = (targetCode && code === targetCode) || (targetDocId && String(doc.id) === String(targetDocId));
               if (isMatch) {
                 return { ...doc, status: 'SUPERSEDED', is_active: false, is_superseded: true, superseded_at: doc.superseded_at || new Date().toISOString() };
               }
               return doc;
             });
             
             const newDoc = {
               id: `doc-${Date.now()}-${Math.random()}`,
               darId: dar.id,
               document_code: targetCode || oldDoc?.document_code || oldDoc?.title,
               code: targetCode || oldDoc?.code || oldDoc?.title,
               title: oldDoc ? oldDoc.title : targetCode,
               name: dar.title || oldDoc?.name || 'Procedure Document',
               status: 'EFFECTIVE',
               is_active: true,
               is_superseded: false,
               is_obsolete: false,
               rev: newRevStr,
               revision: newRevStr,
               department: dar.department || oldDoc?.department || 'PD',
               controlledCopy: oldDoc?.controlledCopy || 0,
               effectiveDate: dar.effectiveDate || todayStr,
               distributions: dar.distributions && dar.distributions.length > 0 ? dar.distributions : (oldDoc?.distributions || []),
               access_control: dar.access_control || oldDoc?.access_control || { scope: 'GENERAL' }
             };
             newDocuments.push(newDoc);
             newNotifications.push({ id: Date.now() + Math.random(), userId: dar.requesterId, title: 'ฉบับปรับปรุงบังคับใช้แล้ว', message: `เอกสารปรับปรุง "${dar.title}" มีผลบังคับใช้เป็น Rev.${newDoc.rev} แล้ว`, isRead: false, link: '/library', timestamp: new Date().toISOString() });

              if (!newDoc.title.startsWith('FM')) {
                // Universal Superseded Copy Recall Invariant: Mark ALL active / received copies of oldDoc as PENDING_RECALL across all stations
                const isMatchingOldCopy = (inst) => {
                  const copyCode = inst.document_code || inst.doc_code || inst.docTitle;
                  const isDocMatch = (oldDoc && String(inst.docId || inst.doc_id) === String(oldDoc.id)) ||
                                     (targetCode && copyCode === targetCode) ||
                                     (oldDoc?.title && copyCode === oldDoc.title);
                  const copyRev = inst.rev || inst.doc_version || inst.revision;
                  if (copyRev && String(copyRev) === String(newDoc.rev)) {
                    return false;
                  }
                  const isOldRev = copyRev ? (String(copyRev) === String(oldRev) || copyRev < newDoc.rev) : true;
                  const isActive = inst.status === 'ACTIVE' || inst.status === 'ISSUED_ACTIVE' || inst.status === 'RECEIVED' || inst.status === 'DISPATCHED_PENDING_RECEIPT';
                  return isDocMatch && isOldRev && isActive;
                };

                const oldCopiesToRecall = newControlledCopyInstances.filter(isMatchingOldCopy);

                newControlledCopyInstances = newControlledCopyInstances.map(inst => {
                  if (isMatchingOldCopy(inst)) {
                    newAuditTrail.unshift({
                      id: `audit-supersede-${Date.now()}-${inst.id}`,
                      timestamp: new Date().toISOString(),
                      user: 'System (SLA Engine)',
                      action: 'SUPERSEDED_PENDING_RECALL',
                      docTitle: inst.doc_code || inst.docTitle || targetCode,
                      docRev: inst.rev || inst.doc_version || oldRev,
                      ccNumber: inst.ccNumber || inst.copy_no,
                      oldStatus: inst.status,
                      newStatus: 'SUPERSEDED_PENDING_RECALL',
                      remarks: `Superseded by Rev.${newDoc.rev} (DAR ${dar.id}). Set to SUPERSEDED_PENDING_RECALL for physical recall/destruction.`
                    });

                    return {
                      ...inst,
                      status: 'SUPERSEDED_PENDING_RECALL',
                      is_superseded: true,
                      superseded_at: new Date().toISOString(),
                      superseded_by_dar: dar.dar_no || dar.id,
                      superseded_by_rev: newDoc.rev,
                      recall_reason: `เอกสารมีการปรับปรุง Revision ใหม่ (Superseded by Rev.${newDoc.rev})`
                    };
                  }
                  return inst;
                });

                newActionLog.unshift({
                  id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  actionType: 'REVISION_PUBLISHED',
                  actor: 'System (SLA Engine)',
                  details: `เอกสาร ${newDoc.title} ปรับปรุงเป็น Rev.${newDoc.rev}: สำเนาเดิม Rev.${oldRev} ทั้งหมด (${oldCopiesToRecall.length} เล่ม) ถูกตั้งสถานะเรียกคืน (SUPERSEDED_PENDING_RECALL)`,
                  timestamp: new Date().toISOString()
                });
                
                const allocations = calculateCopyAllocations(newDoc.department, newDoc.distributions || []);
                const allTargets = allocations.allAllocations || [];

                // Universal Recall Task: ALWAYS created if there are copies to recall or if oldDoc had controlled copies
                if (oldCopiesToRecall.length > 0 || (oldDoc && oldDoc.controlledCopy > 0)) {
                  const recallDocOfficialTitle = oldDoc?.name || newDoc.name || dar.name || targetCode;
                  newTasks.push({
                    id: `task-recall-${targetCode}-${oldRev}-${Date.now()}`,
                    type: 'DCC_RECALL',
                    taskType: 'RECALL',
                    task_type: 'RECALL',
                    targetRole: 'DCC_ADMIN',
                    target_role: 'DCC_ADMIN',
                    assignedToRole: 'DCC_ADMIN',
                    assigneeId: resolveDccAdminUserId(state.masterUsers),
                    department: 'DC',
                    target_department: 'DC',
                    docId: oldDoc?.id,
                    doc_id: oldDoc?.id,
                    document_code: targetCode,
                    doc_code: targetCode,
                    docCode: targetCode,
                    docTitle: recallDocOfficialTitle,
                    docName: recallDocOfficialTitle,
                    targetRevision: oldRev,
                    revision: oldRev,
                    doc_version: oldRev,
                    title: `[เรียกคืนสำเนาตกรุ่น] ${recallDocOfficialTitle} (${targetCode} Rev.${oldRev})`,
                    description: `เอกสาร ${targetCode} (${recallDocOfficialTitle}) มีการอัปเดตเป็น Rev.${newDoc.rev} แล้ว กรุณาเรียกคืนเอกสารฉบับเดิม (Rev.${oldRev}) จากทุกสถานีใช้งาน (${oldCopiesToRecall.length} จุด)`,
                    copies_to_recall: oldCopiesToRecall.map(c => ({
                      id: c.id,
                      copy_no: c.copy_no || c.copyNo,
                      holder_dept: c.holder_dept || c.department,
                      location: c.location || c.locationName,
                      status: c.status
                    })),
                    supersededCopyIds: oldCopiesToRecall.map(c => c.id),
                    status: 'PENDING',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    priority: 'HIGH',
                    darId: dar.id,
                    createdAt: new Date().toISOString()
                  });
                }

                if (allTargets.length > 0) {
                  const distSla = calculateTaskDueDate({
                    submissionDate: today,
                    effectiveDate: dar.effectiveDate || newDoc.effectiveDate,
                    stepSlaDays: state.slaSettings?.hardcopyReceiptSlaDays || 3,
                    mockDateOffset: state.mockDateOffset
                  });
                  const distDocOfficialTitle = newDoc.name || dar.name || newDoc.title;
                  newTasks.push({
                    id: `task-dist-${newDoc.title}-${newDoc.rev}-${Date.now()}`,
                    title: `แจกจ่ายเอกสาร Controlled Copy: ${distDocOfficialTitle} (${newDoc.title} Rev.${newDoc.rev})`,
                    description: `กรุณาพิมพ์และแจกจ่ายสำเนาควบคุมสำหรับเอกสาร ${newDoc.title} (${distDocOfficialTitle}) (Rev.${newDoc.rev}) จำนวน ${allTargets.length} แผนก/จุดใช้งาน`,
                    type: 'DCC_DISTRIBUTE',
                    taskType: 'DISTRIBUTION',
                    task_type: 'DISTRIBUTION',
                    targetRole: 'DCC_ADMIN',
                    target_role: 'DCC_ADMIN',
                    assignedToRole: 'DCC_ADMIN',
                    assigneeId: resolveDccAdminUserId(state.masterUsers),
                    department: 'DC',
                    target_department: 'DC',
                    docId: newDoc.id,
                    doc_id: newDoc.id,
                    document_code: newDoc.title,
                    doc_code: newDoc.title,
                    docCode: newDoc.title,
                    docTitle: distDocOfficialTitle,
                    docName: distDocOfficialTitle,
                    targetRevision: newDoc.rev,
                    revision: newDoc.rev,
                    doc_version: newDoc.rev,
                    status: 'PENDING',
                    dueDate: distSla.dueDate,
                    cancelDate: distSla.cancelDate,
                    isUrgent: distSla.isUrgent,
                    isFastTrack: distSla.isFastTrack,
                    priority: distSla.isUrgent ? 'URGENT' : 'HIGH',
                    slaType: distSla.slaType,
                    effectiveDate: distSla.effectiveDate,
                    darId: dar.id,
                    createdAt: new Date().toISOString()
                  });

                  allTargets.forEach((dist, idx) => {
                    const deptName = dist.departmentId || dist.dept || dist.dept_code || newDoc.department;
                    const locName = cleanLocationName(dist.station_name || dist.locationName || dist.name || dist.location || `${deptName} Head Office`);
                    const locId = dist.station_id || dist.locationId || dist.id || `${deptName}-LOC-${idx + 1}`;
                    const copyNo = dist.copy_no || dist.copyNo || String(idx + 1).padStart(2, '0');
                    const nextCcNum = `CC-${String(idx + 1).padStart(3, '0')}`;
                    const isOrigin = dist.isOwner || dist.copyNo === '01' || copyNo === '01';

                    const newInst = {
                      id: `inst-${Date.now()}-${idx}`,
                      doc_id: newDoc.id,
                      docId: newDoc.id,
                      doc_code: newDoc.title,
                      docTitle: newDoc.title,
                      docName: newDoc.name,
                      doc_version: newDoc.rev,
                      rev: newDoc.rev,
                      revision: newDoc.rev,
                      copy_no: copyNo,
                      copyNo: copyNo,
                      ccNumber: nextCcNum,
                      issue_no: '01',
                      issueNumber: 'I01',
                      holder_dept: deptName,
                      department: deptName,
                      departmentId: deptName,
                      dept_code: deptName,
                      target_department: deptName,
                      targetDepartment: deptName,
                      recipientDepartment: deptName,
                      recipient_department: deptName,
                      owner_dept: newDoc.department,
                      holder_name: `${deptName} (${locName})`,
                      location: locName,
                      locationName: locName,
                      locationId: locId,
                      station_id: locId,
                      station_name: locName,
                      is_master: false,
                      isMaster: false,
                      is_owner: isOrigin,
                      isOwner: isOrigin,
                      copy_type: 'CONTROLLED',
                      copyType: 'CONTROLLED',
                      status: 'PENDING_ISSUE',
                      is_replacement: false,
                      dispatched_at: null,
                      dispatched_by: null,
                      dateIssued: todayStr,
                      receipt_confirmed_at: null,
                      receipt_confirmed_by: null,
                      receipt_remarks: null,
                      recall_task_id: null
                    };
                    const alreadyExists = newControlledCopyInstances.some(inst => {
                      const isMatchDoc = (String(inst.docId || inst.doc_id) === String(newDoc.id)) ||
                                         (inst.doc_code === newDoc.title || inst.docTitle === newDoc.title);
                      const isMatchRev = String(inst.rev || inst.doc_version || inst.revision) === String(newDoc.rev);
                      const isMatchCopyNo = String(inst.copy_no || inst.copyNo || inst.ccNumber).replace(/\D/g, '') === String(copyNo).replace(/\D/g, '');
                      return isMatchDoc && isMatchRev && isMatchCopyNo;
                    });
                    if (!alreadyExists) {
                      newControlledCopyInstances.push(newInst);
                    }
                    
                    newAuditTrail.push({
                      id: `audit-${Date.now()}-${idx}`,
                      timestamp: new Date().toISOString(),
                      user: 'System (SLA Engine)',
                      action: 'AUTO_GENERATE',
                      docTitle: newInst.docTitle,
                      docRev: newInst.rev,
                      ccNumber: newInst.ccNumber,
                      oldStatus: '-',
                      newStatus: newInst.status,
                      remarks: `Auto-generated CC for ${deptName} (${locName}) upon new revision effective`
                    });
                  });
                }
              }
            }
        } else if (dar.type === 'OBSOLETE') {
          const targetDocId = dar.docIdRef || dar.docId || dar.doc_id;
          let targetDocCode = dar.document_code || dar.doc_code || dar.docCode || dar.docIdInput;
          if (!targetDocCode && targetDocId) {
            const found = newDocuments.find(d => String(d.id) === String(targetDocId));
            if (found) {
              targetDocCode = found.document_code || found.code || found.title;
            }
          }
          if (!targetDocCode) {
            targetDocCode = dar.title?.startsWith('[') ? dar.title.replace(/^\[.*?\]\s*/, '') : dar.title;
          }

          // 1. Cascade Obsolete across ALL revisions of targetDocCode
          newDocuments = newDocuments.map(doc => {
            const docCode = doc.document_code || doc.code || doc.title;
            const isMatch = (targetDocCode && docCode === targetDocCode) || (targetDocId && String(doc.id) === String(targetDocId));
            if (isMatch) {
              return {
                ...doc,
                status: 'OBSOLETE',
                is_obsolete: true,
                obsolete_dar_id: dar.id,
                obsolete_date: todayStr
              };
            }
            return doc;
          });
          
          // 2. Mark active copies across ALL revisions as OBSOLETE_PENDING_RECALL
          const isTargetCopy = (inst) => {
            const cCode = inst.document_code || inst.doc_code || inst.docTitle;
            const isMatch = (targetDocCode && cCode === targetDocCode) || (targetDocId && String(inst.docId || inst.doc_id) === String(targetDocId));
            const isActive = inst.status === 'ACTIVE' || inst.status === 'ISSUED_ACTIVE' || inst.status === 'RECEIVED' || inst.status === 'DISPATCHED_PENDING_RECEIPT';
            return isMatch && isActive;
          };

          const obsoleteCopiesToRecall = newControlledCopyInstances.filter(isTargetCopy);

          newControlledCopyInstances = newControlledCopyInstances.map(inst => {
            if (isTargetCopy(inst)) {
              return {
                ...inst,
                status: 'OBSOLETE_PENDING_RECALL',
                obsolete_at: new Date().toISOString(),
                obsolete_by_dar: dar.dar_no || dar.id,
                recall_reason: `เอกสารถูกประกาศยกเลิกการใช้งาน (Obsolete DAR ${dar.dar_no || dar.id})`
              };
            }
            return inst;
          });

          // 3. Invalidate/dismiss pending tasks for this document
          newTasks = newTasks.map(t => {
            const isTaskMatch = (t.document_code && t.document_code === targetDocCode) ||
                                (t.doc_code && t.doc_code === targetDocCode) ||
                                (t.docTitle && t.docTitle === targetDocCode) ||
                                (t.doc_id && String(t.doc_id) === String(targetDocId)) ||
                                (t.title && targetDocCode && t.title.includes(targetDocCode));
            const isPendingWorkflow = t.type === 'RECEIPT_CONFIRMATION' || t.type === 'DOCUMENT_RECEIPT' ||
                                      t.type === 'DCC_RECEIPT' || t.type === 'DAR_REVIEW' || t.type === 'DAR_APPROVE';
            if (isTaskMatch && isPendingWorkflow && t.status !== 'COMPLETED' && t.status !== 'DISMISSED') {
              return {
                ...t,
                status: 'DISMISSED',
                is_dismissed: true,
                dismissed_reason: `เอกสาร ${targetDocCode} ถูกยกเลิกการใช้งาน (OBSOLETE) จึงยกเลิกงานตกค้างอัตโนมัติ`
              };
            }
            return t;
          });
          
          // 4. Create DCC Recall Task
          const obsoleteTargetDoc = (newDocuments || []).find(d => (targetDocCode && (d.title === targetDocCode || d.document_code === targetDocCode)) || (targetDocId && String(d.id) === String(targetDocId)));
          const obsoleteDocOfficialTitle = obsoleteTargetDoc?.name || obsoleteTargetDoc?.document_name || dar.name || targetDocCode;
          newTasks.push({
            id: `task-recall-${targetDocCode}-ALL-${Date.now()}`,
            type: 'DCC_RECALL',
            taskType: 'RECALL',
            task_type: 'RECALL',
            targetRole: 'DCC_ADMIN',
            target_role: 'DCC_ADMIN',
            assignedToRole: 'DCC_ADMIN',
            assigneeId: resolveDccAdminUserId(state.masterUsers),
            department: 'DC',
            target_department: 'DC',
            docId: targetDocId,
            doc_id: targetDocId,
            document_code: targetDocCode,
            doc_code: targetDocCode,
            docCode: targetDocCode,
            docTitle: obsoleteDocOfficialTitle,
            docName: obsoleteDocOfficialTitle,
            targetRevision: 'ALL',
            revision: 'ALL',
            doc_version: 'ALL',
            title: `[เรียกคืนสำเนาเอกสารยกเลิก] ${obsoleteDocOfficialTitle} (${targetDocCode}) (ทั้งหมด ${obsoleteCopiesToRecall.length} เล่ม)`,
            description: `เอกสาร ${targetDocCode} (${obsoleteDocOfficialTitle}) ถูกประกาศยกเลิกการใช้งาน (OBSOLETE) แล้ว กรุณาเรียกคืนสำเนาทั้งหมด (${obsoleteCopiesToRecall.length} ชุด) เพื่อดำเนินการทำลายหรือจัดเก็บ`,
            copies_to_recall: obsoleteCopiesToRecall.map(c => ({
              id: c.id,
              copy_no: c.copy_no || c.copyNo,
              holder_dept: c.holder_dept || c.department,
              location: c.location || c.locationName,
              status: c.status
            })),
            supersededCopyIds: obsoleteCopiesToRecall.map(c => c.id),
            status: 'PENDING',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'HIGH',
            darId: dar.id,
            createdAt: new Date().toISOString()
          });

          newNotifications.push({ id: Date.now() + Math.random(), userId: dar.requesterId, title: 'ยกเลิกเอกสารสำเร็จ', message: `เอกสาร "${targetDocCode}" ถูกยกเลิกและย้ายไปเก็บที่ Archive แล้ว`, isRead: false, link: '/library', timestamp: new Date().toISOString() });
        }

        newTimeline.push({
          id: Date.now() + Math.random(), darId: dar.id, action: 'Auto Publish', user: 'System (Lifecycle Engine)', date: new Date().toLocaleString(), comment: 'Document changed to EFFECTIVE status automatically'
        });
      });
    }

    if (darIdsToCancel.length === 0 && waitingEffectiveDars.length === 0 && JSON.stringify(newTasks) === JSON.stringify(state.tasks)) {
      return state;
    }

    return {
      tasks: cleanupDccTasks(newTasks, newControlledCopyInstances, newDocuments),
      dars: newDars,
      externalDocuments: newExtDocs,
      documents: newDocuments,
      timeline: newTimeline,
      documentControlledCopies: newControlledCopyInstances,
      controlledCopyInstances: newControlledCopyInstances,
      controlledCopyAuditTrail: newAuditTrail,
      notifications: newNotifications,
      actionLog: newActionLog,
      externalAuditTrail: newExtAuditTrail
    };
    });

    if (newlyCompletedDars.length > 0) {
      const store = get();
      newlyCompletedDars.forEach(dar => {
        store.syncRevisionEffective(dar);
        store.syncObsoleteCompleted(dar);
      });
    }
    get().checkScheduledEffectiveDocs?.();
  },

  addComment: (darId, commentStr, user) => set((state) => {
    const cleanDarId = String(darId || '').trim();
    if (!cleanDarId || !commentStr?.trim()) return state;
    const newTimeline = [...state.timeline, {
      id: Date.now(),
      darId: cleanDarId,
      action: 'Comment',
      user: user?.name || user?.fullName || 'ผู้ใช้งาน',
      date: new Date().toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      comment: commentStr.trim(),
      isChat: true,
      userId: user?.id || user?.empId || 'U-GUEST'
    }];
    return { timeline: newTimeline };
  }),

  cancelDar: (darId) => {
    set((state) => {
      const updatedDars = state.dars.map(d => d.id === darId ? { ...d, status: 'CANCELLED' } : d);
      return { dars: updatedDars };
    });
    
    set((state) => {
      return {
        dars: state.dars.filter(d => d.id !== darId),
        tasks: state.tasks.filter(t => t.darId !== darId),
        timeline: state.timeline.filter(t => t.darId !== darId),
        actionLog: [{
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actionType: 'DAR_CANCEL',
          actor: state.currentUser.name,
          details: `Cancelled DAR ${darId}`,
          timestamp: new Date().toISOString()
        }, ...(state.actionLog || [])]
      };
    });
  },

  // Phase 1.5 Departmental Access Control
  canAccessDocument: (userId, documentDept, distributions = []) => {
    // We need to look up the user dynamically to get their updated properties
    const user = MASTER_DATA_USER.find(u => u.id === userId);
    if (!user) return false;

    if (documentDept === user.dept) return true;
    if (distributions && distributions.some(d => d.dept === user.dept || d.departmentId === user.dept)) return true;
    if (user.level >= 5) return true; // Global view for Asst. Manager and above
    if (user.isDcc) return true; // DCC Admin view metadata
    return false;
  },

  canDownloadDocument: (doc, user) => {
    if (!doc || !user) return false;
    if (user.isDcc || user.role === 'DCC_ADMIN') return true;
    if (doc && doc.title && doc.title.startsWith('FM')) return true;
    if (user.level >= 5) return true; // Global download for Asst. Manager and above

    const userDept = user.department || user.dept;
    const userDepts = user.depts || (userDept ? [userDept] : []);
    const docDept = doc.owner_dept || doc.department;

    const isMatch = (targetDept) => {
      if (!targetDept) return false;
      return userDepts.some(u => u === targetDept || (u === 'QA/QC' && targetDept === 'QA/QC') || (u === 'QA/QC' && targetDept === 'QA/QC'));
    };

    // 1. Own department document
    if (isMatch(docDept)) {
      return true;
    }

    // 2. Target departments list
    if (doc.target_depts && doc.target_depts.some(d => isMatch(d))) {
      return true;
    }

    // 3. Distributed to user's department
    if (doc.distributions && doc.distributions.some(d => {
      const dDept = d.departmentId || d.dept;
      return isMatch(dDept);
    })) {
      return true;
    }

    return false;
  },

  // --- CONTROLLED COPY STATE MACHINE & LIFECYCLE METHODS ---
  createReceiptTask: (copy, relatedDoc, relatedDar) => {
    return createReceiptTask(copy, relatedDoc, relatedDar, useStore.getState().masterUsers);
  },
  distributeCopies: (docIdOrCopyIds, copiesToDispatch) => {
    return useStore.getState().dispatchControlledCopies(docIdOrCopyIds, copiesToDispatch);
  },
  dispatchControlledCopy: (copyId) => set((state) => {
    const targetId = String(copyId);
    const copies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies && state.documentControlledCopies.length > 0 ? state.documentControlledCopies : (state.controlledCopyInstances || []));
    const copy = copies.find(c => String(c.id) === targetId);
    if (!copy) return state;

    const dispatchedAt = new Date().toISOString();
    const dispatchedBy = state.currentUser ? state.currentUser.name : 'DCC Admin';

    // 1. Resolve DAR & Doc details
    const allDars = [...(state.dars || []), ...(state.darRequests || [])];
    const copyDocCode = copy.doc_code || copy.docTitle || copy.title;
    const copyDocId = String(copy.doc_id || copy.docId || copy.dar_id || copy.darId || '');

    const relatedDar = allDars.find(d => 
      (copyDocId && String(d.id) === copyDocId) ||
      (copyDocCode && (d.title === copyDocCode || d.doc_code === copyDocCode || d.code === copyDocCode)) ||
      (copy.dar_id && String(d.id) === String(copy.dar_id))
    );

    const relatedDoc = (state.documents || []).find(d => 
      String(d.id) === copyDocId || (copyDocCode && d.title === copyDocCode)
    );

    // 2. Resolve Target Department (Recipient department MUST ALWAYS take precedence over docOwnerDept)
    // Cross-department routing: Recipient department of this copy MUST ALWAYS take precedence over docOwnerDept!
    const destinationDept = resolveReceiptTaskDepartment(copy, copy);

    // 4. Resolve strictly targeted recipient/requester for this department (Level 1-5 ONLY; exclude Level 6+)
    let requesterId = null;
    let requesterName = null;

    // Check if the copy itself already specified a valid holder in destinationDept (must be L1-L5)
    if (copy.requester_id || copy.requesterId || copy.holderId) {
      const candidateId = copy.requester_id || copy.requesterId || copy.holderId;
      const candidateUser = (state.masterUsers || []).find(u => u.id === candidateId || u.empId === candidateId);
      if (candidateUser && userMatchesDepartment(candidateUser, destinationDept) && isLevel1To5(candidateUser)) {
        requesterId = candidateUser.id;
        requesterName = candidateUser.name;
      }
    }

    // If DAR requester belongs to destinationDept, prioritize DAR requester if L1-L5
    if (!requesterId && relatedDar) {
      const darReqId = relatedDar.requester_id || relatedDar.requesterId || relatedDar.userId || relatedDar.requester?.id || relatedDar.created_by || relatedDar.createdBy;
      const darReqUser = (state.masterUsers || []).find(u => u.id === darReqId || u.empId === darReqId);

      if (darReqUser && userMatchesDepartment(darReqUser, destinationDept) && isLevel1To5(darReqUser)) {
        requesterId = darReqId;
        requesterName = darReqUser.name || relatedDar.requester_name || relatedDar.requesterName || relatedDar.requester;
      }
    }

    // If no assignee or candidate not in destinationDept or is Level 6+, select L1-L5 employee in destinationDept
    if (!requesterId) {
      const deptUsers = (state.masterUsers || []).filter(u => userMatchesDepartment(u, destinationDept) && isLevel1To5(u));
      const nonDccDeptUsers = deptUsers.filter(u => !u.isDcc && u.role !== 'DCC_ADMIN');
      const candidatePool = nonDccDeptUsers.length > 0 ? nonDccDeptUsers : deptUsers;

      const primaryDeptUsers = candidatePool.filter(u => isSameDepartment(u.primary_department || u.department || u.dept, destinationDept));
      const finalCandidates = primaryDeptUsers.length > 0 ? primaryDeptUsers : candidatePool;

      const supervisorUser = finalCandidates.find(u => u.level === 5 || u.level === 4 || u.role === 'DEPT_ADMIN' || u.role === 'SUPERVISOR') || finalCandidates[0];
      if (supervisorUser) {
        requesterId = supervisorUser.id;
        requesterName = supervisorUser.name;
      } else {
        requesterId = null;
        requesterName = `${destinationDept} Controller`;
      }
    }

    const updatedCopy = {
      ...copy,
      status: 'DISPATCHED_PENDING_RECEIPT',
      dispatched_at: dispatchedAt,
      dispatched_by: dispatchedBy,
      dispatched_to_dept: destinationDept,
      holder_dept: destinationDept,
      department: destinationDept,
      dept_code: destinationDept,
      target_department: destinationDept,
      targetDepartment: destinationDept,
      recipientDepartment: destinationDept,
      recipient_department: destinationDept,
      requester_id: requesterId,
      requester_name: requesterName,
      dateIssued: dispatchedAt.split('T')[0]
    };

    const newCopies = copies.map(c => {
      if (String(c.id) === targetId) {
        return updatedCopy;
      }
      if (copy.is_replacement && copy.replaced_copy_id && String(c.id) === String(copy.replaced_copy_id)) {
        // 🛡️ Strict ISO 9001 Invariant: If original copy is awaiting recall/destruction (DAMAGED/SUPERSEDED),
        // do NOT wipe its status to REPLACED_VOID on dispatch. It MUST remain DAMAGED_PENDING_RECALL or RECALLED
        // until physical retrieval and destruction in Tab 3 (Recall Checklist).
        const isAwaitingPhysicalRecall = c.isDamaged || c.status === 'DAMAGED_PENDING_RECALL' || c.status === 'PENDING_RECALL' || c.status === 'RECALLED' || c.status === 'DAMAGED_PENDING_REPLACEMENT';
        return {
          ...c,
          status: isAwaitingPhysicalRecall ? c.status : 'REPLACED_VOID',
          replaced_at: dispatchedAt,
          replaced_by: dispatchedBy,
          replacement_dispatched_at: dispatchedAt
        };
      }
      return c;
    });

    // Create DEPT_CONFIRM_HARDCOPY_RECEIPT Task strictly targeted to destination department and assignee
    const newTaskId = `task-receipt-${targetId}-${Date.now()}`;
    const docOfficialTitle = copy.docName || copy.name || copy.documentName || relatedDoc?.name || relatedDoc?.document_name || relatedDar?.name || copy.doc_code || copy.docTitle || 'เอกสารควบคุม';
    const docCode = copy.doc_code || copy.docTitle || copy.title || relatedDoc?.title || '';
    const newTask = {
      id: newTaskId,
      type: 'DEPT_CONFIRM_HARDCOPY_RECEIPT',
      taskType: 'DEPT_CONFIRM_HARDCOPY_RECEIPT',
      task_type: 'CONFIRM_RECEIPT',
      category: 'RECEIPT',
      title: `ตรวจรับเอกสารควบคุมฉบับพิมพ์: ${docOfficialTitle} (${docCode}) (Copy ${copy.copy_no || copy.ccNumber || '01'})`,
      description: `กรุณาตรวจสอบเอกสารฉบับพิมพ์จริงที่จุดใช้งาน ${copy.location || copy.locationName || destinationDept} (${destinationDept}) และยืนยันการรับเอกสาร`,
      copy_id: targetId,
      copyId: targetId,
      instanceId: targetId,
      doc_id: copyDocId,
      darId: relatedDar ? String(relatedDar.id) : copyDocId,
      doc_code: docCode,
      docCode: docCode,
      docTitle: docOfficialTitle,
      docName: docOfficialTitle,
      doc_version: copy.doc_version || copy.rev || '01',
      copy_no: copy.copy_no || copy.ccNumber || '01',
      location: copy.location || copy.locationName || destinationDept || '',
      location_name: copy.location || copy.locationName || destinationDept || '',
      target_department: destinationDept,
      targetDepartment: destinationDept,
      recipientDepartment: destinationDept,
      recipient_department: destinationDept,
      destinationDept: destinationDept,
      destination_dept: destinationDept,
      department: destinationDept,
      dept_code: destinationDept,
      currentHandlerDepartment: destinationDept,
      isDepartmentPool: true,
      isSharedTask: true,
      shared_pool: true,
      is_shared_task: true,
      assignee_id: requesterId,
      assigneeId: requesterId,
      assignee_name: requesterName,
      assigneeName: requesterName,
      assignee_dept: destinationDept,
      assignedToDept: destinationDept,
      assignedToRole: 'DEPARTMENT_CONTROLLER',
      status: 'PENDING',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: dispatchedAt,
      priority: 'HIGH'
    };

    const auditLog = {
      id: `audit-${Date.now()}`,
      timestamp: dispatchedAt,
      user: dispatchedBy,
      action: 'DISPATCH_COPY',
      docTitle: copy.doc_code || copy.docTitle,
      docRev: copy.doc_version || copy.rev,
      ccNumber: copy.copy_no || copy.ccNumber,
      oldStatus: copy.status,
      newStatus: 'DISPATCHED_PENDING_RECEIPT',
      remarks: `Dispatched controlled copy to ${destinationDept} (${copy.location || copy.locationName}) - Assigned to recipient ${requesterName || destinationDept} (${requesterId || 'Dept Pool'})`
    };

    const notif = {
      id: `notif-receipt-${Date.now()}`,
      userId: requesterId || 'U002',
      title: 'เอกสารควบคุมฉบับพิมพ์จัดส่งถึงแผนกแล้ว',
      message: `กรุณาตรวจรับเอกสาร ${copy.doc_code || copy.docTitle} (Copy ${copy.copy_no || copy.ccNumber}) ประจำจุด ${copy.location || copy.locationName}`,
      isRead: false,
      link: '/tasks',
      timestamp: dispatchedAt
    };

    // Check remaining pending copies for this document in newCopies
    const relatedDocId = String(copyDocId || copy.doc_id || copy.docId || '');
    const relatedDocCode = copy.doc_code || copy.docTitle || copy.title || '';
    const relatedDarId = relatedDar ? String(relatedDar.id) : (copy.dar_id ? String(copy.dar_id) : '');

    const docCopies = newCopies.filter(c => {
      return (relatedDocId && String(c.doc_id || c.docId) === relatedDocId) ||
             (relatedDocCode && (c.doc_code === relatedDocCode || c.docTitle === relatedDocCode));
    });

    const pendingDocCopies = docCopies.filter(c => 
      c.status === 'PENDING_ISSUE' || 
      c.status === 'PENDING_PRINT' || 
      c.status === 'PENDING_DISPATCH'
    );

    const isAllDispatched = docCopies.length > 0 && pendingDocCopies.length === 0;

    // Update existing distribution tasks for this document/DAR
    // 🛡️ Strict Isolation Guard: Never touch, complete, or dismiss DCC_RECALL tasks!
    const updatedTasks = state.tasks.map(t => {
      // Strict Invariant: Ignore all recall task types completely
      const isRecallTask = t.type === 'DCC_RECALL' || 
                           t.type === 'DCC_RECALL_WITH_CHECKLIST' || 
                           t.type === 'RECALL' || 
                           t.type === 'OBSOLETE_RECALL' ||
                           t.type === 'RECALL_HARDCOPY' ||
                           t.taskType === 'RECALL' || 
                           t.taskType === 'DCC_RECALL_WITH_CHECKLIST' ||
                           t.task_type === 'RECALL' ||
                           t.isDamaged === true ||
                           t.is_damaged === true;
      if (isRecallTask) return t;

      const isDistTask = t.type === 'DCC_DISTRIBUTE' || 
                         t.type === 'DCC_ISSUE' || 
                         t.taskType === 'DCC_DISTRIBUTE' ||
                         t.taskType === 'DISTRIBUTION' ||
                         t.task_type === 'DISTRIBUTION' ||
                         t.taskType === 'DCC_ISSUE_CONTROLLED_COPIES';
      if (!isDistTask) return t;

      // For replacement copy tasks tied specifically to this dispatched copy
      if (t.copyId || t.copy_id || t.instanceId) {
        const taskCopyId = String(t.copyId || t.copy_id || t.instanceId);
        if (taskCopyId === targetId) {
          return {
            ...t,
            status: 'COMPLETED',
            is_completed: true,
            completedAt: dispatchedAt,
            actionRequired: false,
            isUrgent: false,
            priority: 'NORMAL',
            delivery_status: 'DISPATCHED_TRACKING',
            tracking_status: 'WAITING_RECEIPT',
            status_label: 'ติดตามการส่งมอบ (รอปลายทางตรวจรับ)',
            title: `ติดตามการส่งมอบ: ${relatedDocCode || t.doc_code || t.title} (รอปลายทางตรวจรับ)`,
            description: `DCC ได้บันทึกส่งมอบสำเนาทดแทนแล้ว (${dispatchedAt.split('T')[0]}) อยู่ระหว่างรอแผนกปลายทางตรวจรับเล่มสำเนาทางกายภาพ`
          };
        }
        // If tied to another copy ID, do not modify
        return t;
      }

      const isMatch = (relatedDarId && String(t.darId) === relatedDarId) ||
                      (relatedDocId && (String(t.docId) === relatedDocId || String(t.doc_id) === relatedDocId)) ||
                      (relatedDocCode && (t.doc_code === relatedDocCode || t.docTitle === relatedDocCode || t.title?.includes(relatedDocCode)));
      if (!isMatch) return t;

      if (isAllDispatched) {
        return {
          ...t,
          status: 'COMPLETED',
          is_completed: true,
          completedAt: dispatchedAt,
          actionRequired: false,
          isUrgent: false,
          priority: 'NORMAL',
          delivery_status: 'DISPATCHED_TRACKING',
          tracking_status: 'WAITING_RECEIPT',
          status_label: 'ติดตามการส่งมอบ (รอปลายทางตรวจรับ)',
          title: `ติดตามการส่งมอบ: ${relatedDocCode || t.doc_code || t.title} (รอปลายทางตรวจรับ)`,
          description: `DCC ได้บันทึกส่งมอบสำเนาครบทุกฉบับแล้ว (${dispatchedAt.split('T')[0]}) อยู่ระหว่างรอแผนกปลายทางตรวจรับเล่มสำเนาทางกายภาพ`
        };
      } else {
        const dispatchedCount = docCopies.length - pendingDocCopies.length;
        return {
          ...t,
          title: `แจกจ่ายสำเนาควบคุม: ${relatedDocCode || t.doc_code || t.title} (ส่งมอบแล้ว ${dispatchedCount}/${docCopies.length})`,
          description: `อยู่ระหว่างส่งมอบสำเนา (ส่งมอบแล้ว ${dispatchedCount}/${docCopies.length} ฉบับ) ยังคงเหลือสำเนาที่ต้องพิมพ์/ส่งมอบอีก ${pendingDocCopies.length} ฉบับ`
        };
      }
    });

    return {
      documentControlledCopies: newCopies,
      controlledCopyInstances: newCopies,
      tasks: [newTask, ...updatedTasks.filter(t => t.id !== newTaskId)],
      controlledCopyAuditTrail: [auditLog, ...state.controlledCopyAuditTrail],
      notifications: [notif, ...state.notifications],
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'CC_DISPATCH',
        actor: dispatchedBy,
        details: `Dispatched controlled copy ${targetId} to ${destinationDept}`,
        timestamp: dispatchedAt
      }, ...(state.actionLog || [])]
    };
  }),

  // Batch dispatch helper & aliases
  dispatchControlledCopies: (docIdOrCopyIds, copiesToDispatch) => {
    if (Array.isArray(docIdOrCopyIds)) {
      docIdOrCopyIds.forEach(id => {
        useStore.getState().dispatchControlledCopy(id);
      });
      return;
    }
    if (Array.isArray(copiesToDispatch)) {
      copiesToDispatch.forEach(copy => {
        useStore.getState().dispatchControlledCopy(copy.id || copy);
      });
      return;
    }
    if (typeof docIdOrCopyIds === 'string') {
      const state = useStore.getState();
      const copies = (state.controlledCopyInstances || state.documentControlledCopies || []).filter(c => 
        (c.doc_id === docIdOrCopyIds || c.docId === docIdOrCopyIds || c.doc_code === docIdOrCopyIds || c.docTitle === docIdOrCopyIds) && 
        (c.status === 'PENDING_ISSUE' || c.status === 'PENDING_PRINT' || c.status === 'PENDING_DISPATCH')
      );
      copies.forEach(c => {
        useStore.getState().dispatchControlledCopy(c.id);
      });
    }
  },

  dispatchCopy: (copyId) => useStore.getState().dispatchControlledCopy(copyId),
  dispatchAllCopies: (docIdOrCopyIds, copiesToDispatch) => useStore.getState().dispatchControlledCopies(docIdOrCopyIds, copiesToDispatch),
  getUserActionableTasks: (user) => getUserActionableTasks(useStore.getState().tasks, user || useStore.getState().currentUser),
  getUserTaskBadgeCount: (user) => getUserTaskBadgeCount(useStore.getState().tasks, user || useStore.getState().currentUser),

  confirmHardcopyReceipt: (copyId, taskId, recipientData = {}) => set((state) => {
    // Strict Type Coercion to prevent comparison bugs
    const targetCopyId = String(copyId);
    const targetTaskId = taskId ? String(taskId) : null;
    const copies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies && state.documentControlledCopies.length > 0 ? state.documentControlledCopies : (state.controlledCopyInstances || []));
    const copy = copies.find(c => String(c.id) === targetCopyId);
    if (!copy) return state;

    const user = state.currentUser;
    const isWildcard = user?.isDcc || user?.role === 'DCC_ADMIN' || user?.role === 'QMR' || user?.isQmr || user?.id === 'u5';
    const _userDepts = user?.affiliated_departments || user?.depts || (user?.primary_department ? [user.primary_department] : (user?.department ? [user.department] : []));
    
    const targetDept = copy.holder_dept || copy.department || copy.target_department || copy.dept_code;
    
    // 🛡️ Strict Authorization Guard with DCC Admin / QMR Wildcard Bypass:
    if (!isWildcard && targetDept && !userMatchesDepartment(user, targetDept)) {
      console.warn(`[Guard] Unauthorized confirmHardcopyReceipt: User ${user?.name} (${user?.primary_department || user?.department}) cannot confirm receipt for copy ${targetCopyId} (${targetDept})`);
      return state;
    }

    const confirmedAt = recipientData.timestamp || new Date().toISOString();
    const confirmedBy = recipientData.actor_name || recipientData.name || (state.currentUser ? state.currentUser.name : 'Recipient User');
    const actorUserId = recipientData.receiver_user_id || recipientData.actor_user_id || user?.id || user?.empId || 'UNKNOWN_USER';
    const remarks = recipientData.remarks || 'Confirmed hardcopy receipt and physical verification at point of use';
    const clientIp = recipientData.client_ip || '127.0.0.1';
    const sessionId = recipientData.session_id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const docId = copy.doc_code || copy.docTitle || copy.document_id || recipientData.document_id || 'UNKNOWN_DOC';
    const revision = copy.doc_version || copy.rev || recipientData.revision || '01';
    const copyIdentifier = copy.copy_no ? `Copy ${copy.copy_no}` : (copy.ccNumber || `Copy ${targetCopyId}`);

    const updatedCopy = {
      ...copy,
      status: 'ISSUED_ACTIVE',
      copy_status: 'ACTIVE',
      display_status: 'ACTIVE',
      receipt_status: 'ACTIVE',
      isActive: true,
      received_by: confirmedBy,
      received_by_id: actorUserId,
      received_by_name: confirmedBy,
      received_at: confirmedAt,
      holder_id: actorUserId,
      holderId: actorUserId,
      holder_name: confirmedBy,
      holderName: confirmedBy,
      receipt_confirmed_at: confirmedAt,
      receipt_confirmed_by: confirmedBy,
      receipt_confirmed_by_id: actorUserId,
      receipt_remarks: remarks
    };

    const newCopies = copies.map(c => {
      if (String(c.id) === targetCopyId) {
        return updatedCopy;
      }
      if (copy.is_replacement && copy.replaced_copy_id && String(c.id) === String(copy.replaced_copy_id)) {
        // 🛡️ Strict ISO 9001 Invariant: If original copy is awaiting recall/destruction (DAMAGED/SUPERSEDED),
        // preserve its status until physically retrieved and destroyed in Tab 3.
        const isAwaitingPhysicalRecall = c.isDamaged || c.status === 'DAMAGED_PENDING_RECALL' || c.status === 'PENDING_RECALL' || c.status === 'RECALLED' || c.status === 'DAMAGED_PENDING_REPLACEMENT';
        return {
          ...c,
          status: isAwaitingPhysicalRecall ? c.status : 'REPLACED_VOID',
          replaced_at: confirmedAt,
          replaced_by: confirmedBy
        };
      }
      return c;
    });

    // Department-Pooled Task Dismissal: Immediately remove task for ALL users in the target department
    const updatedTasks = state.tasks.filter(t => {
      if (targetTaskId && String(t.id) === targetTaskId) return false;
      if (
        (t.type === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || t.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || t.task_type === 'CONFIRM_RECEIPT' || t.type === 'CONFIRM_RECEIPT' || t.category === 'RECEIPT') &&
        (String(t.copy_id) === targetCopyId || String(t.copyId) === targetCopyId || String(t.instanceId) === targetCopyId)
      ) {
        return false;
      }
      return true;
    });

    // 11 Mandatory Audit Trail Fields + Multi-Department Tracking
    const auditLog = {
      id: `audit-${Date.now()}`,
      log_id: `LOG-REC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      copy_id: targetCopyId,
      document_id: docId,
      revision: revision,
      copy_identifier: copyIdentifier,
      target_department: targetDept || 'PD',
      task_department: targetDept || 'PD',
      action: 'PHYSICAL_COPY_RECEIVED',
      actor_user_id: actorUserId,
      actor_name: confirmedBy,
      actor_primary_department: user?.primary_department || user?.department || recipientData.actor_primary_department || 'UNKNOWN',
      timestamp: confirmedAt,
      remarks: remarks,
      client_ip: clientIp,
      session_id: sessionId,
      // Backward compatibility fields
      user: confirmedBy,
      docTitle: docId,
      docRev: revision,
      ccNumber: copy.copy_no || copy.ccNumber || '01',
      oldStatus: copy.status,
      newStatus: 'ISSUED_ACTIVE'
    };

    const notif = {
      id: `notif-confirmed-${Date.now()}`,
      userId: state.currentUser ? state.currentUser.id : 'U002',
      title: 'ยืนยันการรับเอกสารควบคุมสำเร็จ',
      message: `คุณได้ยืนยันการรับเอกสาร ${copy.doc_code || copy.docTitle} (Copy ${copy.copy_no || copy.ccNumber}) เรียบร้อยแล้ว`,
      isRead: false,
      link: '/controlled-copy',
      timestamp: confirmedAt
    };

    // If all copies of this document are now active/confirmed, mark tracking distribution task complete
    const remainingUnconfirmedCopies = newCopies.filter(c => {
      const isSameDoc = (docId && (c.doc_code === docId || c.docTitle === docId || String(c.doc_id || c.docId) === String(copy.doc_id || copy.docId)));
      return isSameDoc && c.status !== 'ISSUED_ACTIVE' && c.status !== 'ACTIVE' && c.status !== 'VOID' && c.status !== 'REPLACED_VOID';
    });
    const isAllConfirmed = remainingUnconfirmedCopies.length === 0;

    const finalTasks = updatedTasks.map(t => {
      if (t.delivery_status === 'DISPATCHED_TRACKING' && isAllConfirmed) {
        const isMatch = (copy.doc_code && (t.doc_code === copy.doc_code || t.title?.includes(copy.doc_code)));
        if (isMatch) {
          return {
            ...t,
            delivery_status: 'ALL_RECEIPTS_CONFIRMED',
            tracking_status: 'DONE',
            status: 'COMPLETED',
            is_completed: true,
            title: `การแจกจ่ายเสร็จสมบูรณ์: ${copy.doc_code || t.title}`,
            description: `ทุกแผนกได้ตรวจรับเล่มสำเนาควบคุมครบถ้วนแล้ว ณ ${confirmedAt.split('T')[0]}`
          };
        }
      }
      return t;
    });

    return {
      documentControlledCopies: newCopies,
      controlledCopyInstances: newCopies,
      tasks: cleanupDccTasks(finalTasks, newCopies, state.documents),
      controlledCopyAuditTrail: [auditLog, ...(state.controlledCopyAuditTrail || [])],
      physicalCopyAuditLogs: [auditLog, ...(state.physicalCopyAuditLogs || [])],
      notifications: [notif, ...state.notifications],
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'PHYSICAL_COPY_RECEIVED',
        actor: confirmedBy,
        actorUserId: actorUserId,
        details: `Confirmed physical hardcopy receipt for copy ${targetCopyId} (${docId}) by dept ${targetDept}`,
        timestamp: confirmedAt
      }, ...(state.actionLog || [])]
    };
  }),

  // Backward compatibility alias for confirmCcReceipt
  confirmCcReceipt: (instId, taskId, recipientData) => {
    return useStore.getState().confirmHardcopyReceipt(instId, taskId, recipientData);
  },

  completeRecallChecklist: (taskId, checkedCopyIds = [], outcome = 'RECALLED_DESTROYED') => set((state) => {
    const targetTaskId = String(taskId);
    const checkedSet = new Set((checkedCopyIds || []).map(id => String(id)));
    const recalledAt = new Date().toISOString();
    const recalledBy = state.currentUser ? state.currentUser.name : 'DCC Admin';
    const finalStatus = (outcome === 'RECALLED_OBSOLETE' || outcome === 'ARCHIVED_OBSOLETE') ? 'RECALLED_OBSOLETE' : 'RECALLED_DESTROYED';

    const copies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies && state.documentControlledCopies.length > 0 ? state.documentControlledCopies : (state.controlledCopyInstances || []));
    const newCopies = copies.map(copy => {
      if (checkedSet.has(String(copy.id))) {
        return {
          ...copy,
          status: finalStatus,
          recalled_at: recalledAt,
          recalled_by: recalledBy,
          dateRecalled: recalledAt.split('T')[0]
        };
      }
      return copy;
    });

    // Hard Delete: Eliminate the recall task from array
    const updatedTasks = state.tasks.filter(t => String(t.id) !== targetTaskId);

    // 🛡️ Dedicated Disposition Ledger Entries (Append-Only)
    const newDispositionRecords = copies
      .filter(copy => checkedSet.has(String(copy.id)))
      .map(copy => ({
        id: `DISP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        copyId: copy.id,
        copy_id: copy.id,
        docCode: copy.doc_code || copy.docTitle || '',
        docTitle: copy.docName || copy.doc_title || copy.docTitle || '',
        revision: copy.doc_version || copy.rev || '01',
        copyNumber: copy.copy_no ? (String(copy.copy_no).startsWith('Copy') ? copy.copy_no : `Copy ${copy.copy_no}`) : (copy.ccNumber || 'Copy 01'),
        copy_no: copy.copy_no || copy.ccNumber || '01',
        department: copy.holder_dept || copy.department || '',
        location: copy.location || copy.locationName || copy.station_name || '',
        dispositionType: finalStatus.includes('OBSOLETE') ? 'ARCHIVED_OBSOLETE' : 'DESTROYED',
        dispositionMethod: finalStatus.includes('OBSOLETE') ? 'STAMP_AND_ARCHIVE' : 'SHRED',
        disposedBy: state.currentUser ? `${state.currentUser.name} (${state.currentUser.empId || state.currentUser.role || 'DCC'})` : `${recalledBy} (DCC)`,
        disposed_by_name: recalledBy,
        disposed_by_id: state.currentUser?.id || 'U001',
        disposedAt: recalledAt,
        witnessName: '',
        referenceNo: targetTaskId,
        notes: `Recall Checklist completion: ${outcome}`
      }));

    const auditLog = {
      id: `audit-recall-${Date.now()}`,
      timestamp: recalledAt,
      user: recalledBy,
      action: 'COMPLETE_RECALL_CHECKLIST',
      oldStatus: 'PENDING_RECALL',
      newStatus: finalStatus,
      remarks: `DCC completed physical recall checklist for ${checkedSet.size} copies (${finalStatus})`
    };

    return {
      documentControlledCopies: newCopies,
      controlledCopyInstances: newCopies,
      copyDispositionRecords: [...newDispositionRecords, ...(state.copyDispositionRecords || [])],
      dispositionHistory: [...newDispositionRecords, ...(state.dispositionHistory || [])],
      tasks: cleanupDccTasks(updatedTasks, newCopies, state.documents),
      controlledCopyAuditTrail: [auditLog, ...state.controlledCopyAuditTrail],
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'CC_RECALL_COMPLETE',
        actor: recalledBy,
        details: `Completed recall checklist for task ${targetTaskId} (${checkedSet.size} copies) -> ${finalStatus}`,
        timestamp: recalledAt
      }, ...(state.actionLog || [])]
    };
  }),

  // ─── NEW: Zero-Hard-Delete Obsolete Publish Action ───────────────────────
  publishObsoleteDar: (darId) => set((state) => {
    const dar = state.dars.find(d => d.id === darId || d.dar_no === darId);
    if (!dar) return state;

    const targetDocId = dar.docIdRef || dar.docId || dar.doc_id || dar.targetDocumentId;
    const refDoc = targetDocId ? state.documents.find(d => String(d.id) === String(targetDocId)) : null;
    let targetDocCode = dar.document_code || dar.doc_code || dar.docCode || dar.docIdInput || (refDoc ? (refDoc.document_code || refDoc.doc_code || refDoc.code || refDoc.docCode || refDoc.title) : null);
    if (!targetDocCode && dar.title) {
      targetDocCode = dar.title.startsWith('[') ? dar.title.replace(/^\[.*?\]\s*/, '') : dar.title;
    }
    const obsoleteAt = new Date().toISOString();
    const darNo = dar.dar_no || dar.id;

    // Rule 2: Cascade Obsolete All Historical Versions (ยกเลิกยกตระกูล)
    // Matches EVERY Revision having the same document code, whether previously ACTIVE or SUPERSEDED
    const isDocMatchCode = (doc) => {
      if (targetDocId && String(doc.id) === String(targetDocId)) return true;
      const docCode = doc.document_code || doc.doc_code || doc.code || doc.docCode || doc.title;
      if (targetDocCode && docCode && docCode.trim().toLowerCase() === targetDocCode.trim().toLowerCase()) return true;
      if (refDoc) {
        const refCode = refDoc.document_code || refDoc.doc_code || refDoc.code || refDoc.docCode || refDoc.title;
        if (refCode && docCode && docCode.trim().toLowerCase() === refCode.trim().toLowerCase()) return true;
      }
      return false;
    };

    // 1. Cascade Obsolete: Mark EVERY Revision of this document code OBSOLETE
    const updatedDocs = state.documents.map(doc => {
      if (isDocMatchCode(doc)) {
        return {
          ...doc,
          status: 'OBSOLETE',
          is_active: false,
          is_superseded: false,
          is_obsolete: true,
          obsolete_at: obsoleteAt,
          obsoleted_at: obsoleteAt,
          obsolete_dar_id: darNo,
          obsolete_reason: dar.obsoleteReason || dar.reason || 'ถูกยกเลิกตามคำร้อง DAR',
          obsolete_detail: dar.obsoleteDetail || dar.description || '',
        };
      }
      return doc;
    });

    // 2. Set all active copies across ALL revisions to OBSOLETE_PENDING_RECALL
    const copies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies || []);

    const isMatchCopy = (copy) => {
      const copyDocCode = copy.document_code || copy.doc_code || copy.docTitle;
      const matchDoc = 
        (targetDocId && (String(copy.doc_id) === String(targetDocId) || String(copy.docId) === String(targetDocId))) ||
        (targetDocCode && copyDocCode && copyDocCode.trim().toLowerCase() === targetDocCode.trim().toLowerCase()) ||
        (refDoc && copyDocCode && (refDoc.document_code || refDoc.code || refDoc.title) === copyDocCode) ||
        updatedDocs.some(d => (String(d.id) === String(copy.doc_id || copy.docId) || (d.document_code || d.code || d.title) === copyDocCode) && d.status === 'OBSOLETE');
      const isActive = copy.status === 'ISSUED_ACTIVE' || copy.status === 'ACTIVE' || copy.status === 'RECEIVED' || copy.status === 'DISPATCHED_PENDING_RECEIPT' || copy.status === 'PENDING_RECALL' || copy.status === 'OBSOLETE_PENDING_RECALL' || copy.status === 'SUPERSEDED_PENDING_RECALL';
      return matchDoc && isActive;
    };

    const obsoleteCopiesToRecall = copies.filter(isMatchCopy);

    const updatedCopies = copies.map(copy => {
      if (isMatchCopy(copy)) {
        return {
          ...copy,
          status: 'OBSOLETE_PENDING_RECALL',
          recall_reason: `เอกสารถูกขอยกเลิกถาวร (Obsolete DAR: ${darNo})`,
          obsolete_pending_at: obsoleteAt,
        };
      }
      return copy;
    });

    // 3. Update DAR status to COMPLETED
    const updatedDars = state.dars.map(d => d.id === dar.id ? { ...d, status: 'COMPLETED' } : d);

    // 4. Task Invalidation: Invalidate/dismiss pending workflow & receipt tasks for this obsoleted document
    const invalidatedTasks = state.tasks.filter(t => {
      const isTargetDocTask = 
        (t.doc_code && t.doc_code === targetDocCode) ||
        (t.docTitle && t.docTitle === targetDocCode) ||
        (t.document_code && t.document_code === targetDocCode) ||
        (targetDocId && String(t.docId) === String(targetDocId)) ||
        (t.darId && String(t.darId) === String(dar.id));
      const isPendingWorkflowOrReceipt = 
        t.type === 'RECEIPT' || 
        t.type === 'Review' || 
        t.type === 'Approve' || 
        t.type === 'Ack' || 
        t.type === 'CONFIRM_RECEIPT' || 
        t.type === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || 
        t.type === 'DCC_DISTRIBUTE' || 
        t.type === 'DCC_ISSUE';
      return !(isTargetDocTask && isPendingWorkflowOrReceipt);
    });

    // 5. Create DCC Recall Task
    const newTasks = [...invalidatedTasks];
    if (obsoleteCopiesToRecall.length > 0 || (dar.recallPlan && dar.recallPlan.length > 0) || (dar.totalControlledCopies && dar.totalControlledCopies > 0) || (dar.controlledCopy && dar.controlledCopy > 0)) {
      const matchedDoc = (state.documents || []).find(d => (targetDocCode && (d.title === targetDocCode || d.document_code === targetDocCode)) || (targetDocId && String(d.id) === String(targetDocId)));
      const docOfficialTitle = matchedDoc?.name || matchedDoc?.document_name || dar.name || targetDocCode;
      newTasks.push({
        id: `task-recall-${targetDocCode}-ALL-${Date.now()}`,
        type: 'DCC_RECALL',
        taskType: 'RECALL',
        task_type: 'RECALL',
        targetRole: 'DCC_ADMIN',
        target_role: 'DCC_ADMIN',
        assignedToRole: 'DCC_ADMIN',
        assigneeId: resolveDccAdminUserId(state.masterUsers),
        department: 'DC',
        target_department: 'DC',
        docId: targetDocId,
        doc_id: targetDocId,
        document_code: targetDocCode,
        doc_code: targetDocCode,
        docCode: targetDocCode,
        docTitle: docOfficialTitle,
        docName: docOfficialTitle,
        targetRevision: 'ALL',
        revision: 'ALL',
        doc_version: 'ALL',
        title: `[เรียกคืนสำเนาขอยกเลิก] ${docOfficialTitle} (${targetDocCode})`,
        description: `เอกสาร ${targetDocCode} ทุก Revision ถูกยกเลิกถาวรตาม ${darNo} กรุณาเรียกคืนสำเนาจากทุกจุด (${obsoleteCopiesToRecall.length} ชุด) และดำเนินการทำลาย/ประทับตรา OBSOLETE`,
        copies_to_recall: obsoleteCopiesToRecall.map(c => ({
          id: c.id,
          copy_no: c.copy_no || c.copyNo,
          holder_dept: c.holder_dept || c.department,
          location: c.location || c.locationName,
          status: c.status
        })),
        supersededCopyIds: obsoleteCopiesToRecall.map(c => c.id),
        status: 'PENDING',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'HIGH',
        darId: dar.id,
        createdAt: obsoleteAt
      });
    }

    // 6. Audit log
    const auditLog = {
      id: `audit-obs-${Date.now()}`,
      timestamp: obsoleteAt,
      user: state.currentUser ? state.currentUser.name : 'System',
      action: 'DOCUMENT_OBSOLETED',
      docTitle: targetDocCode,
      remarks: `เอกสาร ${targetDocCode} ทุก Revision ถูกยกเลิกถาวรตามคำร้อง ${darNo} (Cascade Obsolete) — รอ DCC เรียกคืนสำเนา ${obsoleteCopiesToRecall.length} ชุด`,
      actionType: 'DOCUMENT_OBSOLETED',
      actor: state.currentUser ? state.currentUser.name : 'System',
      details: `เอกสาร ${targetDocCode} ทุก Revision ถูกยกเลิกถาวรตามคำร้อง ${darNo} (Cascade Obsolete) — รอ DCC เรียกคืนสำเนา ${obsoleteCopiesToRecall.length} ชุด`
    };

    const actionLogEntry = {
      id: `LOG-OBS-${Date.now()}`,
      actionType: 'DOCUMENT_OBSOLETED',
      action: 'DOCUMENT_OBSOLETED',
      actor: state.currentUser ? state.currentUser.name : 'System',
      details: `เอกสาร ${targetDocCode} ทุก Revision ถูกยกเลิกถาวรตามคำร้อง ${darNo} (Cascade Obsolete) — รอ DCC เรียกคืนสำเนา ${obsoleteCopiesToRecall.length} ชุด`,
      timestamp: obsoleteAt
    };

    const newNotifications = [...(state.notifications || [])];
    if (dar.requesterId) {
      newNotifications.push({
        id: `notif-obs-req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: dar.requesterId,
        targetUserIds: [dar.requesterId],
        title: 'คำร้องขอยกเลิกเอกสารสำเร็จ',
        message: `คำร้องยกเลิกเอกสาร "${docOfficialTitle}" (${targetDocCode}) ได้รับการดำเนินการเรียบร้อยแล้ว`,
        type: 'SUCCESS',
        category: 'DAR',
        isRead: false,
        read: false,
        readBy: [],
        link: '/dcc/documents',
        timestamp: obsoleteAt,
        docCode: targetDocCode,
        refId: dar.id
      });
    }

    newNotifications.push({
      id: `notif-obs-broad-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      isGlobal: true,
      targetDepartment: dar.department,
      title: `ประกาศยกเลิกเอกสาร: ${targetDocCode}`,
      message: `เอกสาร "${docOfficialTitle}" (${targetDocCode}) ถูกยกเลิกถาวร (Obsolete) แล้ว ห้ามนำไปใช้งานหรืออ้างอิง`,
      type: 'OBSOLETE',
      category: 'DAR',
      isRead: false,
      read: false,
      readBy: [],
      link: '/dcc/documents',
      timestamp: obsoleteAt,
      docCode: targetDocCode,
      refId: dar.id
    });

    if (obsoleteCopiesToRecall.length > 0) {
      const dccAdminId = resolveDccAdminUserId(state.masterUsers);
      if (dccAdminId) {
        newNotifications.push({
          id: `notif-obs-recall-dcc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          userId: dccAdminId,
          targetUserIds: [dccAdminId],
          title: 'ภาระงานเรียกคืนสำเนาเอกสารยกเลิกถาวร',
          message: `เอกสาร ${targetDocCode} ถูกยกเลิกถาวรตาม ${darNo} กรุณาเรียกคืนสำเนาจากทุกจุด (${obsoleteCopiesToRecall.length} ชุด)`,
          type: 'TASK_ASSIGNED',
          category: 'CONTROLLED_COPY',
          isRead: false,
          read: false,
          readBy: [],
          link: '/controlled-copy',
          timestamp: obsoleteAt,
          docCode: targetDocCode,
          refId: dar.id
        });
      }

      const holderDepts = Array.from(new Set(obsoleteCopiesToRecall.map(c => c.holder_dept || c.department).filter(Boolean)));
      holderDepts.forEach(dept => {
        newNotifications.push({
          id: `notif-obs-recall-dept-${dept}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          targetDepartment: dept,
          isGlobal: false,
          title: `แจ้งเตือนเรียกคืนสำเนาเอกสารยกเลิก: ${targetDocCode}`,
          message: `เอกสาร ${targetDocCode} ถูกยกเลิกถาวรแล้ว กรุณาส่งคืนสำเนาควบคุมทั้งหมดต่อเจ้าหน้าที่ DCC`,
          type: 'ACTION_REQUIRED',
          category: 'CONTROLLED_COPY',
          isRead: false,
          read: false,
          readBy: [],
          link: '/controlled-copy',
          timestamp: obsoleteAt,
          docCode: targetDocCode,
          refId: dar.id
        });
      });
    }

    return {
      documents: updatedDocs,
      dars: updatedDars,
      controlledCopyInstances: updatedCopies,
      documentControlledCopies: updatedCopies,
      tasks: newTasks,
      controlledCopyAuditTrail: [auditLog, ...(state.controlledCopyAuditTrail || [])],
      notifications: newNotifications,
      actionLog: [actionLogEntry, ...(state.actionLog || [])]
    };
  }),

  // ─── NEW: DCC Physical Copy Disposition (Stamp & Archive OR Destroy) ──────
  confirmCopiesRecalled: (taskId, destructionDetails = {}) => set((state) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return state;

    const targetDocCode = task.document_code || task.doc_code || task.docTitle;
    const recalledAt = new Date().toISOString();
    const finalStatus = destructionDetails.finalStatus || 'DESTROYED';
    const method = destructionDetails.method || 'SHREDDING';
    const actor = state.currentUser ? state.currentUser.name : 'DCC Officer';

    // 1. Mark recalled copies as DESTROYED
    const copies = state.controlledCopyInstances || state.documentControlledCopies || [];
    const updatedCopies = copies.map(c => {
      const matchDoc = (c.document_code || c.doc_code || c.docTitle) === targetDocCode ||
                       (task.copyId && String(task.copyId) === String(c.id)) ||
                       (task.instanceId && String(task.instanceId) === String(c.id)) ||
                       (task.copies_to_recall && task.copies_to_recall.some(rc => rc.id === c.id)) ||
                       (task.supersededCopyIds && task.supersededCopyIds.some(sid => sid === c.id));
      const isPending = c.status === 'PENDING_RECALL' || c.status === 'DAMAGED_PENDING_RECALL' || c.status === 'OBSOLETE_PENDING_RECALL' || c.status === 'SUPERSEDED_PENDING_RECALL';
      if (matchDoc && isPending) {
        return {
          ...c,
          status: finalStatus,
          destroyed_at: recalledAt,
          recalled_at: recalledAt,
          destruction_method: method,
          destruction_notes: destructionDetails.notes || 'ทำลายตามระเบียบควบคุมเอกสาร'
        };
      }
      return c;
    });

    // 2. Mark recall task as RESOLVED
    const updatedTasks = state.tasks.map(t => t.id === taskId ? {
      ...t,
      status: 'RESOLVED',
      is_completed: true,
      resolved_at: recalledAt,
      resolved_by: actor
    } : t);

    // 3. Audit trail
    const auditLog = {
      id: `audit-recall-close-${Date.now()}`,
      timestamp: recalledAt,
      user: actor,
      action: 'RECALL_COMPLETED_DESTROYED',
      docTitle: targetDocCode,
      remarks: `DCC ยืนยันการเรียกคืนและทำลายเล่มสำเนา (${method}) สำหรับเอกสาร ${targetDocCode} เรียบร้อยแล้ว`
    };

    return {
      tasks: cleanupDccTasks(updatedTasks, updatedCopies, state.documents, state.dars),
      controlledCopyInstances: updatedCopies,
      documentControlledCopies: updatedCopies,
      controlledCopyAuditTrail: [auditLog, ...(state.controlledCopyAuditTrail || [])],
      actionLog: [{
        id: `LOG-RECALL-CLOSE-${Date.now()}`,
        actionType: 'RECALL_COMPLETED_DESTROYED',
        actor,
        details: `Closed Recall Task ${taskId} for ${targetDocCode} -> ${finalStatus}`,
        timestamp: recalledAt
      }, ...(state.actionLog || [])]
    };
  }),

  completeCopyRecallAndArchive: ({ documentCode, collectedCopyIds, dispositionMethod, notes, witnessName, referenceNo, taskId }) => set((state) => {
    const collectedSet = new Set((collectedCopyIds || []).map(id => String(id)));
    const recalledAt = new Date().toISOString();
    const recalledBy = state.currentUser ? state.currentUser.name : 'DCC Officer';
    const finalStatus = dispositionMethod === 'STAMP_AND_ARCHIVE' ? 'ARCHIVED_OBSOLETE' : 'DESTROYED';

    const copies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies || []);

    const updatedCopies = copies.map(copy => {
      if (collectedSet.has(String(copy.id))) {
        return {
          ...copy,
          status: finalStatus,
          disposition_method: dispositionMethod,
          disposition_type: finalStatus,
          recalled_at: recalledAt,
          recalled_by: recalledBy,
          dcc_notes: notes || '',
          witness_name: witnessName || '',
          reference_no: referenceNo || '',
          dateRecalled: recalledAt.split('T')[0],
          dateDestroyed: finalStatus === 'DESTROYED' ? recalledAt.split('T')[0] : copy.dateDestroyed
        };
      }
      return copy;
    });

    // 🛡️ Dedicated Disposition Ledger Entries (Append-Only for ISO 9001 Compliance)
    const newDispositionRecords = copies
      .filter(copy => collectedSet.has(String(copy.id)))
      .map(copy => ({
        id: `DISP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        copyId: copy.id,
        copy_id: copy.id,
        docCode: copy.doc_code || copy.docTitle || documentCode || '',
        docTitle: copy.docName || copy.doc_title || copy.docTitle || '',
        revision: copy.doc_version || copy.rev || '01',
        copyNumber: copy.copy_no ? (String(copy.copy_no).startsWith('Copy') ? copy.copy_no : `Copy ${copy.copy_no}`) : (copy.ccNumber || 'Copy 01'),
        copy_no: copy.copy_no || copy.ccNumber || '01',
        department: copy.holder_dept || copy.department || '',
        location: copy.location || copy.locationName || copy.station_name || '',
        dispositionType: finalStatus,
        dispositionMethod: dispositionMethod || (finalStatus === 'ARCHIVED_OBSOLETE' ? 'STAMP_AND_ARCHIVE' : 'DESTROY_SCRAP'),
        disposedBy: state.currentUser ? `${state.currentUser.name} (${state.currentUser.empId || state.currentUser.role || 'DCC'})` : `${recalledBy} (DCC)`,
        disposed_by_name: recalledBy,
        disposed_by_id: state.currentUser?.id || 'U001',
        disposedAt: recalledAt,
        witnessName: witnessName || '',
        witness_name: witnessName || '',
        referenceNo: referenceNo || '',
        reference_no: referenceNo || '',
        notes: notes || ''
      }));

    // Resolve Recall Task
    let updatedTasks = (state.tasks || []).map(t => {
      // STRICT ISOLATION GUARD: Never touch distribution tasks!
      if (t.type === 'DCC_DISTRIBUTE' || t.taskType === 'DISTRIBUTION' || t.task_type === 'DISTRIBUTION') return t;

      const isTargetTask = (taskId && String(t.id) === String(taskId)) ||
        (documentCode && (t.doc_code === documentCode || t.docTitle === documentCode || t.title?.includes(documentCode))) ||
        (t.darId && state.dars.some(d => d.id === t.darId && (d.docIdRef === documentCode || d.title === documentCode || d.doc_code === documentCode)));

      if (isTargetTask && (t.type === 'DCC_RECALL' || t.type === 'DCC_RECALL_WITH_CHECKLIST' || t.taskType === 'DCC_RECALL_WITH_CHECKLIST' || t.taskType === 'RECALL' || t.task_type === 'RECALL' || t.type === 'RECALL' || t.type === 'OBSOLETE_RECALL' || t.type === 'RECALL_HARDCOPY')) {
        // If task has supersededCopyIds, check if all superseded copies are resolved
        if (t.supersededCopyIds && Array.isArray(t.supersededCopyIds) && t.supersededCopyIds.length > 0) {
          const allResolved = t.supersededCopyIds.every(id => {
            const c = updatedCopies.find(copy => String(copy.id) === String(id));
            return !c || c.status === 'DESTROYED' || c.status === 'ARCHIVED_OBSOLETE' || c.status === 'OBSOLETE' || c.status === 'RECALLED';
          });
          if (allResolved) {
            return {
              ...t,
              status: 'COMPLETED',
              is_completed: true,
              completed_at: recalledAt
            };
          }
          return t;
        }

        // Check if there are any remaining copies with PENDING_RECALL / SUPERSEDED_PENDING_RECALL / OBSOLETE_PENDING_RECALL for this doc
        const remainingPending = updatedCopies.some(c => 
          (c.doc_code === documentCode || c.docTitle === documentCode || (c.doc_id && state.documents.some(d => String(d.id) === String(c.doc_id) && d.title === documentCode))) &&
          (c.status === 'PENDING_RECALL' || c.status === 'DAMAGED_PENDING_RECALL' || c.status === 'SUPERSEDED_PENDING_RECALL' || c.status === 'OBSOLETE_PENDING_RECALL')
        );

        if (!remainingPending || collectedSet.size >= (copies.filter(c => c.doc_code === documentCode || c.docTitle === documentCode).length || 1)) {
          return {
            ...t,
            status: 'COMPLETED',
            is_completed: true,
            completed_at: recalledAt
          };
        }
      }
      return t;
    });

    const cleanedTasks = cleanupDccTasks(updatedTasks, updatedCopies, state.documents, state.dars);

    const auditLog = {
      id: `audit-disp-${Date.now()}`,
      timestamp: recalledAt,
      user: recalledBy,
      action: 'CONTROLLED_COPY_DISPOSITION',
      docTitle: documentCode,
      remarks: `DCC ทำการ ${dispositionMethod === 'STAMP_AND_ARCHIVE' ? 'ประทับตรา OBSOLETE และเก็บเข้าคลังประวัติ' : 'ทำลาย (Shred/Destroy)'} สำหรับเอกสาร ${documentCode} จำนวน ${collectedSet.size} ชุด ${notes ? `(${notes})` : ''}`
    };

    const actionLogEntry = {
      id: `LOG-DISP-${Date.now()}`,
      actionType: 'CONTROLLED_COPY_DISPOSITION',
      action: 'CONTROLLED_COPY_DISPOSITION',
      actor: recalledBy,
      details: `DCC ดำเนินการ ${dispositionMethod} สำหรับ ${documentCode} (${collectedSet.size} ชุด): ${notes || 'เรียบร้อย'}`,
      timestamp: recalledAt
    };

    return {
      controlledCopyInstances: updatedCopies,
      documentControlledCopies: updatedCopies,
      copyDispositionRecords: [...newDispositionRecords, ...(state.copyDispositionRecords || [])],
      dispositionHistory: [...newDispositionRecords, ...(state.dispositionHistory || [])],
      tasks: cleanedTasks,
      controlledCopyAuditTrail: [auditLog, ...(state.controlledCopyAuditTrail || [])],
      actionLog: [actionLogEntry, ...(state.actionLog || [])]
    };
  }),

  reconcileAndResolveTasks: () => set((state) => {
    const instances = state.controlledCopyInstances || state.documentControlledCopies || [];
    return {
      tasks: cleanupDccTasks(state.tasks, instances, state.documents, state.dars)
    };
  }),

  // ─── NEW: Auto-Publish Master Document upon Final Approval ───────────────
  publishNewDocumentDar: (darId) => set((state) => {
    const dar = state.dars.find(d => d.id === darId || d.dar_no === darId || d.darNumber === darId);
    if (!dar) return state;

    const today = new Date();
    today.setDate(today.getDate() + (state.mockDateOffset || 0));
    const todayStr = state.simulatedDate || today.toISOString().split('T')[0];
    const isEffectiveTodayOrPast = !dar.effectiveDate || dar.effectiveDate <= todayStr;
    const docStatus = isEffectiveTodayOrPast ? 'EFFECTIVE' : 'SCHEDULED_EFFECTIVE';

    const targetCode = dar.docIdInput || dar.document_code || dar.doc_code || dar.docCode || dar.code || dar.title;
    const docName = dar.title || dar.name || targetCode;

    // Check if document already exists
    const existingIndex = state.documents.findIndex(d => 
      (dar.id && String(d.darId) === String(dar.id)) || 
      (targetCode && (d.document_code === targetCode || d.code === targetCode || d.title === targetCode))
    );

    let updatedDocs = [...state.documents];
    let createdDoc;

    if (existingIndex >= 0) {
      createdDoc = {
        ...updatedDocs[existingIndex],
        status: docStatus,
        effectiveDate: dar.effectiveDate || todayStr,
        effective_date: dar.effectiveDate || todayStr,
        published_at: isEffectiveTodayOrPast ? (updatedDocs[existingIndex].published_at || new Date().toISOString()) : null,
        access_control: dar.access_control || updatedDocs[existingIndex].access_control || { scope: 'GENERAL' },
        distributions: dar.distributions && dar.distributions.length > 0 ? dar.distributions : updatedDocs[existingIndex].distributions
      };
      updatedDocs[existingIndex] = createdDoc;
    } else {
      createdDoc = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        darId: dar.id,
        darNumber: dar.darNumber || dar.id,
        document_code: targetCode,
        code: targetCode,
        title: targetCode,
        name: docName,
        docName: docName,
        status: docStatus,
        rev: dar.rev || dar.revision || '00',
        revision: dar.rev || dar.revision || '00',
        docType: dar.docType || (targetCode ? targetCode.split('-')[0] : 'SOP'),
        department: dar.department || 'PD',
        ownerId: dar.requesterId || dar.requester_id,
        requesterId: dar.requesterId,
        effectiveDate: dar.effectiveDate || todayStr,
        effective_date: dar.effectiveDate || todayStr,
        published_at: isEffectiveTodayOrPast ? new Date().toISOString() : null,
        distributions: dar.distributions || [],
        access_control: dar.access_control || { scope: 'GENERAL' },
        file: dar.file || null,
        relatedStandards: dar.relatedStandards || []
      };
      updatedDocs.push(createdDoc);
    }

    // Controlled Copies & DCC Distribution (Non-blocking for digital publishing)
    let newCreatedCopies = [];
    let newAuditLogs = [...(state.controlledCopyAuditTrail || [])];
    let newTasks = [...state.tasks];

    if (!targetCode.startsWith('FM')) {
      const allocations = calculateCopyAllocations(createdDoc.department, createdDoc.distributions || []);
      const allTargets = allocations.allAllocations || [];

      if (allTargets.length > 0) {
        allTargets.forEach((dist, idx) => {
          const deptName = dist.departmentId || dist.dept || dist.dept_code || createdDoc.department;
          const locName = cleanLocationName(dist.station_name || dist.locationName || dist.name || dist.location || `${deptName} Head Office`);
          const locId = dist.station_id || dist.locationId || dist.id || `${deptName}-LOC-${idx + 1}`;
          const copyNo = dist.copy_no || dist.copyNo || String(idx + 1).padStart(2, '0');
          const nextCcNum = `CC-${String(idx + 1).padStart(3, '0')}`;
          const isOrigin = dist.isOwner || dist.copyNo === '01' || copyNo === '01';

          const newInst = {
            id: `inst-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            doc_id: createdDoc.id,
            docId: createdDoc.id,
            doc_code: createdDoc.title,
            docTitle: createdDoc.title,
            docName: createdDoc.name,
            doc_version: createdDoc.rev,
            rev: createdDoc.rev,
            copy_no: copyNo,
            copyNo: copyNo,
            ccNumber: nextCcNum,
            issue_no: '01',
            issueNumber: 'I01',
            holder_dept: deptName,
            department: deptName,
            departmentId: deptName,
            dept_code: deptName,
            target_department: deptName,
            targetDepartment: deptName,
            recipientDepartment: deptName,
            recipient_department: deptName,
            owner_dept: createdDoc.department,
            holder_name: `${deptName} (${locName})`,
            location: locName,
            locationName: locName,
            locationId: locId,
            station_id: locId,
            station_name: locName,
            is_master: false,
            isMaster: false,
            is_owner: isOrigin,
            isOwner: isOrigin,
            copy_type: 'CONTROLLED',
            copyType: 'CONTROLLED',
            status: 'PENDING_ISSUE',
            is_replacement: false,
            dispatched_at: null,
            dispatched_by: null,
            dateIssued: todayStr,
            receipt_confirmed_at: null,
            receipt_confirmed_by: null,
            receipt_remarks: null,
            recall_task_id: null
          };
          newCreatedCopies.push(newInst);

          newAuditLogs.unshift({
            id: `audit-${Date.now()}-${idx}`,
            timestamp: new Date().toISOString(),
            user: 'System (Lifecycle Engine)',
            action: 'AUTO_GENERATE',
            docTitle: newInst.docTitle,
            docRev: newInst.rev,
            ccNumber: newInst.ccNumber,
            oldStatus: '-',
            newStatus: newInst.status,
            remarks: `Auto-generated CC for ${deptName} (${locName}) upon document effective`
          });
        });

        const hasExistingDistTask = newTasks.some(t => t.darId === dar.id && t.type === 'DCC_DISTRIBUTE');
        if (!hasExistingDistTask) {
          const distSla = calculateTaskDueDate({
            submissionDate: new Date(),
            effectiveDate: dar.effectiveDate || createdDoc.effectiveDate,
            stepSlaDays: state.slaSettings?.hardcopyReceiptSlaDays || 3,
            mockDateOffset: state.mockDateOffset
          });
          const distDocOfficialTitle = createdDoc.name || dar.name || createdDoc.title;
          newTasks.push({
            id: `task-dist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            title: `แจกจ่ายเอกสาร Controlled Copy (NEW): ${distDocOfficialTitle} (${createdDoc.title})`,
            description: `กรุณาพิมพ์และแจกจ่ายสำเนาควบคุมสำหรับเอกสาร ${createdDoc.title} (${distDocOfficialTitle}) จำนวน ${allTargets.length} แผนก/จุดใช้งาน`,
            type: 'DCC_DISTRIBUTE',
            status: 'PENDING',
            assigneeId: 'U001',
            assignedToRole: 'DCC_ADMIN',
            target_role: 'DCC',
            department: 'DC',
            target_department: 'DC',
            docId: createdDoc.id,
            doc_id: createdDoc.id,
            document_code: createdDoc.title,
            doc_code: createdDoc.title,
            docCode: createdDoc.title,
            docTitle: distDocOfficialTitle,
            docName: distDocOfficialTitle,
            dueDate: distSla.dueDate,
            cancelDate: distSla.cancelDate,
            isUrgent: distSla.isUrgent,
            isFastTrack: distSla.isFastTrack,
            priority: distSla.isUrgent ? 'URGENT' : 'HIGH',
            slaType: distSla.slaType,
            effectiveDate: distSla.effectiveDate,
            darId: dar.id
          });
        }
      }
    }

    const updatedDars = state.dars.map(d => {
      if (d.id === dar.id) {
        return {
          ...d,
          status: isEffectiveTodayOrPast ? (d.ackRequirement === 'REQUIRED' && d.ackUserIds?.length > 0 ? 'WAITING_ACKNOWLEDGEMENT' : 'COMPLETED') : 'APPROVED_WAITING_EFFECTIVE'
        };
      }
      return d;
    });

    const currentCopies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies || []);
    const finalCopies = [...currentCopies, ...newCreatedCopies];

    const actionLogEntry = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actionType: 'DOCUMENT_PUBLISHED',
      actor: 'System (Lifecycle Engine)',
      details: `เอกสารใหม่ ${createdDoc.title} เผยแพร่สถานะ ${createdDoc.status} เรียบร้อยแล้ว`,
      timestamp: new Date().toISOString()
    };

    const newNotifications = [...(state.notifications || [])];
    if (dar.requesterId) {
      newNotifications.push({
        id: `notif-pub-new-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: dar.requesterId,
        targetUserIds: [dar.requesterId],
        title: 'เอกสารใหม่ได้รับการประกาศใช้แล้ว',
        message: `เอกสาร "${createdDoc.title}" (${createdDoc.document_code || dar.docIdInput || ''}) ได้รับการประกาศใช้เรียบร้อยแล้ว`,
        type: 'SUCCESS',
        category: 'DAR',
        isRead: false,
        read: false,
        readBy: [],
        link: '/dcc/documents',
        timestamp: new Date().toISOString(),
        docCode: createdDoc.document_code || dar.docIdInput,
        refId: dar.id
      });
    }
    const targetDept = createdDoc.department || dar.department;
    newNotifications.push({
      id: `notif-pub-dept-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      targetDepartment: targetDept,
      isGlobal: !targetDept,
      title: `ประกาศใช้เอกสารใหม่: ${createdDoc.document_code || dar.docIdInput || ''}`,
      message: `เอกสาร "${createdDoc.title}" มีผลบังคับใช้แล้ว กรุณาศึกษาและปฏิบัติตาม`,
      type: 'INFO',
      category: 'DAR',
      isRead: false,
      read: false,
      readBy: [],
      link: '/dcc/documents',
      timestamp: new Date().toISOString(),
      docCode: createdDoc.document_code || dar.docIdInput,
      refId: dar.id
    });

    return {
      documents: updatedDocs,
      dars: updatedDars,
      controlledCopyInstances: finalCopies,
      documentControlledCopies: finalCopies,
      tasks: cleanupDccTasks(newTasks, finalCopies, updatedDocs),
      controlledCopyAuditTrail: newAuditLogs,
      notifications: newNotifications,
      actionLog: [actionLogEntry, ...(state.actionLog || [])]
    };
  }),

  publishApprovedDar: (darId) => {
    const state = get();
    const dar = state.dars.find(d => d.id === darId || d.dar_no === darId || d.darNumber === darId);
    if (!dar) return;

    if (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') {
      get().publishNewDocumentDar(dar.id);
    } else if (dar.type === 'REVISION' || dar.type === 'REVISE') {
      get().publishDarRevision(dar.id);
    } else if (dar.type === 'OBSOLETE') {
      get().publishObsoleteDar(dar.id);
    }
  },

  approveDar: (darId, comment = 'Approved') => {
    const state = get();
    const task = (state.tasks || []).find(t => 
      (t.darId === darId || t.referenceId === darId) && 
      (t.type === 'Approve' || t.type === 'APPROVE')
    );
    if (task) {
      get().processWorkflow(task.id, 'APPROVE', comment);
    } else {
      const dar = (state.dars || []).find(d => d.id === darId || d.dar_no === darId || d.darNumber === darId);
      if (dar) {
        get().publishApprovedDar(dar.id);
      }
    }
  },

  checkScheduledEffectiveDocs: () => set((state) => {
    const today = new Date();
    today.setDate(today.getDate() + (state.mockDateOffset || 0));
    const todayStr = state.simulatedDate || today.toISOString().split('T')[0];

    const scheduledDocs = (state.documents || []).filter(d => 
      d.status === 'SCHEDULED_EFFECTIVE' && (d.effective_date || d.effectiveDate) && todayStr >= (d.effective_date || d.effectiveDate)
    );

    if (scheduledDocs.length === 0) return state;

    let updatedDocs = [...state.documents];
    let updatedDars = [...state.dars];
    let newTasks = [...state.tasks];
    let newControlledCopies = [...(state.controlledCopyInstances || state.documentControlledCopies || [])];
    let newAuditTrail = [...(state.controlledCopyAuditTrail || [])];
    let newActionLog = [...(state.actionLog || [])];

    scheduledDocs.forEach(doc => {
      const targetCode = doc.document_code || doc.code || doc.title;

      updatedDocs = updatedDocs.map(d => {
        if (d.id === doc.id) {
          return {
            ...d,
            status: 'EFFECTIVE',
            is_active: true,
            is_superseded: false,
            is_obsolete: false,
            published_at: d.published_at || new Date().toISOString()
          };
        }
        const docCode = d.document_code || d.doc_code || d.code || d.docCode || d.title;
        const isSameCode = targetCode && docCode && docCode.toLowerCase() === targetCode.toLowerCase();
        if (isSameCode) {
          return {
            ...d,
            status: 'SUPERSEDED',
            is_active: false,
            is_superseded: true,
            superseded_at: d.superseded_at || new Date().toISOString()
          };
        }
        return d;
      });

      if (doc.darId) {
        updatedDars = updatedDars.map(dar => {
          if ((dar.id === doc.darId || dar.dar_no === doc.darId || dar.darNumber === doc.darId) && 
              (dar.status === 'APPROVED_WAITING_EFFECTIVE' || dar.status === 'WAITING_EFFECTIVE')) {
            return { ...dar, status: 'COMPLETED' };
          }
          return dar;
        });
      }

      newActionLog.unshift({
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'SCHEDULED_DOCUMENT_ACTIVATED',
        actor: 'System (Lifecycle Engine)',
        details: `เอกสาร ${doc.title} ที่ถึงกำหนดวันบังคับใช้ (${doc.effective_date || doc.effectiveDate}) ได้เปลี่ยนสถานะเป็น EFFECTIVE อัตโนมัติ`,
        timestamp: new Date().toISOString()
      });
    });

    return {
      documents: updatedDocs,
      dars: updatedDars,
      tasks: cleanupDccTasks(newTasks, newControlledCopies, updatedDocs),
      controlledCopyInstances: newControlledCopies,
      documentControlledCopies: newControlledCopies,
      controlledCopyAuditTrail: newAuditTrail,
      actionLog: newActionLog
    };
  }),

  publishDarRevision: (darId) => set((state) => {
    const dar = state.dars.find(d => d.id === darId || d.dar_no === darId || d.darNumber === darId);
    if (!dar) return state;

    const targetDocId = dar.docIdRef || dar.docId || dar.doc_id || dar.targetDocumentId;
    const refDoc = targetDocId ? state.documents.find(d => String(d.id) === String(targetDocId)) : null;
    let targetCode = dar.document_code || dar.doc_code || dar.docCode || dar.docIdInput || (refDoc ? (refDoc.document_code || refDoc.doc_code || refDoc.code || refDoc.docCode || refDoc.title) : null);
    if (!targetCode && dar.title) {
      targetCode = dar.title.startsWith('[') ? dar.title.replace(/^\[.*?\]\s*/, '') : dar.title;
    }
    
    // Strict code matching to find previous revisions
    const isDocMatchCode = (doc) => {
      if (targetDocId && String(doc.id) === String(targetDocId)) return true;
      const code = doc.document_code || doc.doc_code || doc.code || doc.docCode || doc.title;
      if (targetCode && code && code.trim().toLowerCase() === targetCode.trim().toLowerCase()) return true;
      if (refDoc) {
        const refCode = refDoc.document_code || refDoc.doc_code || refDoc.code || refDoc.docCode || refDoc.title;
        if (refCode && code && code.trim().toLowerCase() === refCode.trim().toLowerCase()) return true;
      }
      return false;
    };

    const matchingDocs = state.documents.filter(isDocMatchCode);
    const oldDoc = matchingDocs.find(d => d.status === 'EFFECTIVE' || d.status === 'ACTIVE' || d.is_active) || matchingDocs[matchingDocs.length - 1];

    const oldRev = oldDoc ? (oldDoc.revision || oldDoc.rev) : (dar.previous_revision || dar.previousRev || '00');
    const currentRevNum = parseInt(oldRev, 10) || 0;
    const newRevNum = currentRevNum + 1;
    const newRevStr = dar.revision || dar.rev || (newRevNum < 10 ? `0${newRevNum}` : `${newRevNum}`);
    
    const today = new Date();
    today.setDate(today.getDate() + (state.mockDateOffset || 0));
    const todayStr = state.simulatedDate || today.toISOString().split('T')[0];
    const isEffectiveTodayOrPast = !dar.effectiveDate || dar.effectiveDate <= todayStr;
    const docStatus = isEffectiveTodayOrPast ? 'EFFECTIVE' : 'SCHEDULED_EFFECTIVE';

    // 1. Single Active Revision Invariant: If effective today or past, update ALL previous revisions of this code to SUPERSEDED
    let updatedDocs = state.documents.map(doc => {
      if (isEffectiveTodayOrPast && isDocMatchCode(doc)) {
        return {
          ...doc,
          status: 'SUPERSEDED',
          is_active: false,
          is_superseded: true,
          isLocked: false,
          hasPendingDar: false,
          superseded_at: doc.superseded_at || new Date().toISOString()
        };
      }
      if (isDocMatchCode(doc)) {
        return {
          ...doc,
          isLocked: false,
          hasPendingDar: false
        };
      }
      return doc;
    });

    const newDocId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newDoc = {
      id: newDocId,
      darId: dar.id,
      darNumber: dar.darNumber || dar.id,
      document_code: targetCode || oldDoc?.document_code || oldDoc?.code || oldDoc?.title,
      doc_code: targetCode || oldDoc?.doc_code || oldDoc?.document_code || oldDoc?.code || oldDoc?.title,
      code: targetCode || oldDoc?.code || oldDoc?.document_code || oldDoc?.title,
      docCode: targetCode || oldDoc?.code || oldDoc?.document_code || oldDoc?.title,
      title: oldDoc ? oldDoc.title : targetCode,
      name: dar.title || oldDoc?.name || 'Procedure Document',
      docName: dar.title || oldDoc?.name || 'Procedure Document',
      status: docStatus,
      is_active: isEffectiveTodayOrPast,
      is_superseded: false,
      is_obsolete: false,
      isLocked: false,
      hasPendingDar: false,
      rev: newRevStr,
      revision: newRevStr,
      doc_version: newRevStr,
      department: dar.department || oldDoc?.department || 'PD',
      controlledCopy: oldDoc?.controlledCopy || 0,
      effectiveDate: dar.effectiveDate || todayStr,
      effective_date: dar.effectiveDate || todayStr,
      published_at: isEffectiveTodayOrPast ? new Date().toISOString() : null,
      distributions: dar.distributions && dar.distributions.length > 0 ? dar.distributions : (oldDoc?.distributions || []),
      access_control: dar.access_control || oldDoc?.access_control || { scope: 'GENERAL' }
    };
    updatedDocs.push(newDoc);

    // 2. Mark ALL existing active / received copies of the old revision as PENDING_RECALL across ALL stations
    let currentCopies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies && state.documentControlledCopies.length > 0 ? state.documentControlledCopies : (state.controlledCopyInstances || []));

    const isOldCopy = (copy) => {
      const copyCode = copy.document_code || copy.doc_code || copy.docTitle;
      const isDocMatch = (oldDoc && (String(copy.doc_id || copy.docId) === String(oldDoc.id))) ||
                         (targetCode && copyCode === targetCode) ||
                         (oldDoc?.title && copyCode === oldDoc.title);
      const copyRev = copy.rev || copy.doc_version || copy.revision;
      if (copyRev && String(copyRev) === String(newRevStr)) {
        return false;
      }
      const isRevMatch = copyRev ? (String(copyRev) === String(oldRev) || copyRev < newRevStr) : true;
      const isActive = copy.status === 'ISSUED_ACTIVE' || copy.status === 'ACTIVE' || copy.status === 'RECEIVED' || copy.status === 'DISPATCHED_PENDING_RECEIPT';
      return isDocMatch && isRevMatch && isActive;
    };

    let newAuditLogs = [...(state.controlledCopyAuditTrail || [])];
    const recalledCopies = currentCopies.filter(isOldCopy);

    const updatedCopies = currentCopies.map(copy => {
      if (isOldCopy(copy)) {
        newAuditLogs.unshift({
          id: `audit-supersede-${Date.now()}-${copy.id}`,
          timestamp: new Date().toISOString(),
          user: 'System (Lifecycle Engine)',
          action: 'SUPERSEDED_PENDING_RECALL',
          docTitle: copy.doc_code || copy.docTitle || targetCode,
          docRev: copy.rev || copy.doc_version || oldRev,
          ccNumber: copy.ccNumber || copy.copy_no,
          oldStatus: copy.status,
          newStatus: 'SUPERSEDED_PENDING_RECALL',
          remarks: `Superseded by Rev.${newRevStr} (DAR ${dar.id}). Set to SUPERSEDED_PENDING_RECALL for physical recall/destruction.`
        });

        return {
          ...copy,
          status: 'SUPERSEDED_PENDING_RECALL',
          is_superseded: true,
          superseded_at: new Date().toISOString(),
          superseded_by_dar: dar.dar_no || dar.id,
          superseded_by_rev: newRevStr,
          recall_reason: `เอกสารมีการปรับปรุง Revision ใหม่ (Superseded by Rev.${newRevStr})`
        };
      }
      return copy;
    });

    // 3. Create new copies for Rev.01 based on dar.distributions
    let newCreatedCopies = [];
    const allocations = calculateCopyAllocations(newDoc.department, newDoc.distributions || []);
    const allTargets = allocations.allAllocations || [];

    allTargets.forEach((dist, idx) => {
      const deptName = dist.departmentId || dist.dept || dist.dept_code || newDoc.department;
      const locName = cleanLocationName(dist.station_name || dist.locationName || dist.name || dist.location || `${deptName} Head Office`);
      const locId = dist.station_id || dist.locationId || dist.id || `${deptName}-LOC-${idx + 1}`;
      const copyNo = dist.copy_no || dist.copyNo || String(idx + 1).padStart(2, '0');
      const nextCcNum = `CC-${String(idx + 1).padStart(3, '0')}`;
      const isOrigin = dist.isOwner || dist.copyNo === '01' || copyNo === '01';

      const newInst = {
        id: `inst-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        doc_id: newDoc.id,
        docId: newDoc.id,
        doc_code: newDoc.title,
        docTitle: newDoc.title,
        docName: newDoc.name,
        doc_version: newDoc.rev,
        rev: newDoc.rev,
        copy_no: copyNo,
        copyNo: copyNo,
        ccNumber: nextCcNum,
        issue_no: '01',
        issueNumber: 'I01',
        holder_dept: deptName,
        department: deptName,
        departmentId: deptName,
        dept_code: deptName,
        target_department: deptName,
        targetDepartment: deptName,
        recipientDepartment: deptName,
        recipient_department: deptName,
        owner_dept: newDoc.department,
        holder_name: `${deptName} (${locName})`,
        location: locName,
        locationName: locName,
        locationId: locId,
        station_id: locId,
        station_name: locName,
        is_master: false,
        isMaster: false,
        is_owner: isOrigin,
        isOwner: isOrigin,
        copy_type: 'CONTROLLED',
        copyType: 'CONTROLLED',
        status: 'PENDING_ISSUE',
        is_replacement: false,
        dispatched_at: null,
        dispatched_by: null,
        dateIssued: todayStr,
        receipt_confirmed_at: null,
        receipt_confirmed_by: null,
        receipt_remarks: null,
        recall_task_id: null
      };
      const alreadyExists = currentCopies.some(inst => {
        const isMatchDoc = (String(inst.docId || inst.doc_id) === String(newDoc.id)) ||
                           (inst.doc_code === newDoc.title || inst.docTitle === newDoc.title);
        const isMatchRev = String(inst.rev || inst.doc_version || inst.revision) === String(newDoc.rev);
        const isMatchCopyNo = String(inst.copy_no || inst.copyNo || inst.ccNumber).replace(/\D/g, '') === String(copyNo).replace(/\D/g, '');
        return isMatchDoc && isMatchRev && isMatchCopyNo;
      });
      if (!alreadyExists) {
        newCreatedCopies.push(newInst);
      }

      newAuditLogs.unshift({
        id: `audit-${Date.now()}-${idx}`,
        timestamp: new Date().toISOString(),
        user: 'System (Lifecycle Engine)',
        action: 'AUTO_GENERATE',
        docTitle: newInst.docTitle,
        docRev: newInst.rev,
        ccNumber: newInst.ccNumber,
        oldStatus: '-',
        newStatus: newInst.status,
        remarks: `Auto-generated CC for ${deptName} (${locName}) upon new revision effective`
      });
    });

    // 4. Create DCC Tasks
    let newTasks = [...state.tasks];

    // Distribution Task: Decoupled for new revision distribution
    if (allTargets.length > 0) {
      const distSla = calculateTaskDueDate({
        submissionDate: new Date(),
        effectiveDate: dar.effectiveDate || newDoc.effectiveDate,
        stepSlaDays: state.slaSettings?.hardcopyReceiptSlaDays || 3,
        mockDateOffset: state.mockDateOffset
      });
      const distDocOfficialTitle = newDoc.name || dar.name || newDoc.title;
      newTasks.push({
        id: `task-dist-${newDoc.title}-${newDoc.rev}-${Date.now()}`,
        title: `แจกจ่ายเอกสาร Controlled Copy: ${distDocOfficialTitle} (${newDoc.title} Rev.${newDoc.rev})`,
        description: `กรุณาพิมพ์และแจกจ่ายสำเนาควบคุมสำหรับเอกสาร ${newDoc.title} (${distDocOfficialTitle}) (Rev.${newDoc.rev}) จำนวน ${allTargets.length} แผนก/จุดใช้งาน`,
        type: 'DCC_DISTRIBUTE',
        taskType: 'DISTRIBUTION',
        task_type: 'DISTRIBUTION',
        target_role: 'DCC',
        assignedToRole: 'DCC_ADMIN',
        assigneeId: 'EMP-001',
        department: 'DC',
        target_department: 'DC',
        docId: newDoc.id,
        doc_id: newDoc.id,
        document_code: newDoc.title,
        doc_code: newDoc.title,
        docCode: newDoc.title,
        docTitle: distDocOfficialTitle,
        docName: distDocOfficialTitle,
        targetRevision: newDoc.rev,
        revision: newDoc.rev,
        doc_version: newDoc.rev,
        status: 'PENDING',
        priority: distSla.isUrgent ? 'URGENT' : 'HIGH',
        isUrgent: distSla.isUrgent,
        isFastTrack: distSla.isFastTrack,
        dueDate: distSla.dueDate,
        cancelDate: distSla.cancelDate,
        slaType: distSla.slaType,
        effectiveDate: distSla.effectiveDate,
        darId: dar.id,
        createdAt: new Date().toISOString()
      });
    }

    // Universal Recall Task: Decoupled for old revision recall
    const copiesToRecall = recalledCopies.map(c => ({
      id: c.id,
      copy_no: c.copy_no || c.copyNo,
      holder_dept: c.holder_dept || c.department,
      location: c.location || c.locationName,
      status: c.status
    }));

    if (recalledCopies.length > 0 || oldDoc) {
      const recallTaskId = `task-recall-${targetCode}-${oldRev}-${Date.now()}`;
      const recallDocOfficialTitle = oldDoc?.name || newDoc.name || dar.name || targetCode;
      const recallTask = {
        id: recallTaskId,
        type: 'DCC_RECALL',
        taskType: 'RECALL',
        task_type: 'RECALL',
        targetRole: 'DCC_ADMIN',
        target_role: 'DCC_ADMIN',
        assignedToRole: 'DCC_ADMIN',
        assigneeId: resolveDccAdminUserId(state.masterUsers),
        department: 'DC',
        target_department: 'DC',
        docId: oldDoc?.id,
        doc_id: oldDoc?.id,
        document_code: targetCode,
        doc_code: targetCode,
        docCode: targetCode,
        docTitle: recallDocOfficialTitle,
        docName: recallDocOfficialTitle,
        targetRevision: oldRev,
        revision: oldRev,
        doc_version: oldRev,
        supersededCopyIds: recalledCopies.map(c => c.id),
        copies_to_recall: copiesToRecall,
        status: 'PENDING',
        priority: 'HIGH',
        darId: dar.id,
        title: `[เรียกคืนสำเนาตกรุ่น] ${recallDocOfficialTitle} (${targetCode} Rev.${oldRev})`,
        description: `เอกสาร ${targetCode} มีการอัปเดตเป็น Rev.${newRevStr} แล้ว กรุณาเรียกคืนเอกสารฉบับเดิม (Rev.${oldRev}) จากทุกสถานีใช้งาน (${recalledCopies.length} จุด)`,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      };
      newTasks.push(recallTask);
    }

    // 5. Update DAR status to COMPLETED
    const updatedDars = state.dars.map(d => d.id === dar.id ? { ...d, status: 'COMPLETED' } : d);

    // 6. Action Log
    const actionLogEntry = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actionType: 'REVISION_PUBLISHED',
      actor: 'System (Lifecycle Engine)',
      details: `เอกสาร ${newDoc.title} ปรับปรุงเป็น Rev.${newRevStr}: สำเนาเดิม Rev.${oldRev} ทั้งหมด (${recalledCopies.length} เล่ม) ถูกตั้งสถานะเรียกคืน (SUPERSEDED_PENDING_RECALL)`,
      timestamp: new Date().toISOString()
    };

    const finalCopies = [...updatedCopies, ...newCreatedCopies];

    const newNotifications = [...(state.notifications || [])];
    if (dar.requesterId) {
      newNotifications.push({
        id: `notif-pub-rev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: dar.requesterId,
        targetUserIds: [dar.requesterId],
        title: 'เอกสารฉบับปรับปรุงประกาศใช้แล้ว',
        message: `เอกสาร "${newDoc.title}" Rev.${newRevStr} ประกาศใช้เรียบร้อยแล้ว`,
        type: 'SUCCESS',
        category: 'DAR',
        isRead: false,
        read: false,
        readBy: [],
        link: '/dcc/documents',
        timestamp: new Date().toISOString(),
        docCode: targetCode,
        refId: dar.id
      });
    }

    const targetDept = newDoc.department || dar.department;
    newNotifications.push({
      id: `notif-pub-revdept-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      targetDepartment: targetDept,
      isGlobal: !targetDept,
      title: `ประกาศใช้เอกสารฉบับปรับปรุง: ${targetCode} Rev.${newRevStr}`,
      message: `เอกสาร "${newDoc.title}" ปรับปรุงเป็น Rev.${newRevStr} มีผลบังคับใช้แล้ว`,
      type: 'INFO',
      category: 'DAR',
      isRead: false,
      read: false,
      readBy: [],
      link: '/dcc/documents',
      timestamp: new Date().toISOString(),
      docCode: targetCode,
      refId: dar.id
    });

    if (recalledCopies.length > 0) {
      const dccAdminId = resolveDccAdminUserId(state.masterUsers);
      if (dccAdminId) {
        newNotifications.push({
          id: `notif-recall-dcc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          userId: dccAdminId,
          targetUserIds: [dccAdminId],
          title: 'ภาระงานเรียกคืนสำเนาตกรุ่น',
          message: `เอกสาร ${targetCode} มีการอัปเดตเป็น Rev.${newRevStr} กรุณาเรียกคืนสำเนาเดิม Rev.${oldRev} (${recalledCopies.length} จุด)`,
          type: 'TASK_ASSIGNED',
          category: 'CONTROLLED_COPY',
          isRead: false,
          read: false,
          readBy: [],
          link: '/controlled-copy',
          timestamp: new Date().toISOString(),
          docCode: targetCode
        });
      }

      const holderDepts = Array.from(new Set(recalledCopies.map(c => c.holder_dept || c.department).filter(Boolean)));
      holderDepts.forEach(dept => {
        newNotifications.push({
          id: `notif-recall-dept-${dept}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          targetDepartment: dept,
          isGlobal: false,
          title: `แจ้งเตือนเรียกคืนสำเนาควบคุมตกรุ่น: ${targetCode}`,
          message: `เอกสาร ${targetCode} ได้ออก Rev.${newRevStr} แล้ว กรุณาส่งคืนสำเนาเดิม Rev.${oldRev} ต่อเจ้าหน้าที่ DCC`,
          type: 'ACTION_REQUIRED',
          category: 'CONTROLLED_COPY',
          isRead: false,
          read: false,
          readBy: [],
          link: '/controlled-copy',
          timestamp: new Date().toISOString(),
          docCode: targetCode
        });
      });
    }

    return {
      documents: updatedDocs,
      dars: updatedDars,
      controlledCopyInstances: finalCopies,
      documentControlledCopies: finalCopies,
      tasks: cleanupDccTasks(newTasks, finalCopies, updatedDocs),
      controlledCopyAuditTrail: newAuditLogs,
      notifications: newNotifications,
      actionLog: [actionLogEntry, ...(state.actionLog || [])]
    };
  }),

  issueControlledCopy: (docTitle, dept, location = null, locationId = null) => set((state) => {
    const doc = state.documents.find(d => d.title === docTitle && d.status === 'EFFECTIVE');
    if (!doc) return state;

    const copies = state.documentControlledCopies || state.controlledCopyInstances || [];
    const existingCopies = copies.filter(c => (c.doc_code || c.docTitle) === docTitle);
    const nextCcNum = `CC-${String(existingCopies.length + 1).padStart(3, '0')}`;
    const copyNo = String(existingCopies.length + 1).padStart(2, '0');
    const locName = location || `${dept} Head Office`;
    const locId = locationId || `${dept}-LOC-${existingCopies.length + 1}`;

    const newInst = {
      id: `inst-${Date.now()}`,
      doc_id: doc.id,
      docId: doc.id,
      doc_code: doc.title,
      docTitle: doc.title,
      docName: doc.name,
      doc_version: doc.rev,
      rev: doc.rev,
      copy_no: copyNo,
      copyNo: copyNo,
      ccNumber: nextCcNum,
      issue_no: '01',
      issueNumber: 'I01',
      holder_dept: dept,
      department: dept,
      departmentId: dept,
      dept_code: dept,
      holder_name: `${dept} (${locName})`,
      location: locName,
      locationName: locName,
      locationId: locId,
      station_id: locId,
      station_name: locName,
      status: 'PENDING_ISSUE',
      is_replacement: false,
      dispatched_at: null,
      dispatched_by: null,
      dateIssued: new Date().toISOString().split('T')[0],
      receipt_confirmed_at: null,
      receipt_confirmed_by: null,
      receipt_remarks: null,
      recall_task_id: null
    };

    const auditLog = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: state.currentUser.name,
      action: 'ISSUE_COPY',
      docTitle: newInst.docTitle,
      docRev: newInst.rev,
      ccNumber: newInst.ccNumber,
      oldStatus: '-',
      newStatus: newInst.status,
      remarks: `Issued new controlled copy to ${dept} (${locName})`
    };

    const finalCopies = [...copies, newInst];
    return {
      documentControlledCopies: finalCopies,
      controlledCopyInstances: finalCopies,
      controlledCopyAuditTrail: [auditLog, ...state.controlledCopyAuditTrail],
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'CC_ISSUE',
        actor: state.currentUser.name,
        details: `Issued controlled copy for ${docTitle} at ${locName}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  requestAdditionalControlledCopies: (docId, newLocationsList = [], reason = '') => set((state) => {
    const isInternal = state.documents.some(d => String(d.id) === String(docId) || d.title === docId);
    const doc = state.documents.find(d => String(d.id) === String(docId) || d.title === docId)
      || (state.externalDocuments || []).find(d => String(d.id) === String(docId) || d.edCode === docId || d.title === docId);
    if (!doc) return state;

    const isExternal = !isInternal;
    const docCode = doc.edCode || doc.doc_code || doc.title;
    const docTitle = doc.title;
    const docName = doc.name || doc.title;
    const docVersion = doc.rev || doc.sourceVersion || '01';

    const copies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies && state.documentControlledCopies.length > 0 ? state.documentControlledCopies : (state.controlledCopyInstances || []));

    // Deduplicate & filter active physical copies using getActivePhysicalCopies
    const activeDocCopies = getActivePhysicalCopies(copies, doc);

    // Calculate maximum sequential copy number from pure physical active copies
    const copyNumbers = activeDocCopies.map(c => {
      const rawNum = c.copy_number ?? c.copyNumber ?? c.copy_no ?? c.copyNo ?? (c.ccNumber ? c.ccNumber.replace(/\D/g, '') : null);
      const parsed = parseInt(rawNum, 10);
      return isNaN(parsed) ? 0 : parsed;
    });
    let maxCopyNo = copyNumbers.length > 0 ? Math.max(...copyNumbers, 0) : 0;

    const requesterName = state.currentUser ? state.currentUser.name : 'Owner Department';
    const requesterDept = state.currentUser ? (state.currentUser.department || state.currentUser.dept) : (doc.department || 'PD');
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    const newCreatedCopies = [];
    const newAuditLogs = [];
    const newTargetDepts = new Set((doc.distributions || []).map(d => d.departmentId || d.dept));
    if (doc.department) newTargetDepts.add(doc.department);

    newLocationsList.forEach((loc, idx) => {
      maxCopyNo += 1;
      const copyNoStr = String(maxCopyNo).padStart(2, '0');
      const ccNumStr = `CC-${String(maxCopyNo).padStart(3, '0')}`;
      
      // Target Department of this station: MUST be strictly preserved, NEVER falling back to doc.department
      const targetDept = loc.target_department || loc.targetDepartment || loc.departmentId || loc.department || loc.dept || loc.dept_code;
      const dept = targetDept || (loc.locationId && state.distributionLocations?.find(s => s.id === loc.locationId)?.departmentId) || requesterDept;
      newTargetDepts.add(dept);

      const locName = loc.station_name || loc.locationName || loc.location_name || loc.name || loc.location || `${dept} Head Office`;
      const locId = loc.station_id || loc.location_id || loc.locationId || loc.id || `${dept}-LOC-${idx + 1}`;

      const newCopy = {
        id: `cc-adhoc-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        doc_id: doc.id,
        docId: doc.id,
        external_doc_id: isExternal ? doc.id : null,
        externalDocId: isExternal ? doc.id : null,
        doc_code: docCode,
        docCode: docCode,
        doc_title: docTitle,
        docTitle: docTitle,
        doc_type: isExternal ? 'ED' : (doc.type || 'SOP'),
        docType: isExternal ? 'ED' : (doc.type || 'SOP'),
        docName: docName,
        doc_version: docVersion,
        rev: docVersion,
        copy_no: copyNoStr,
        copyNo: copyNoStr,
        copy_number: maxCopyNo,
        copyNumber: maxCopyNo,
        ccNumber: ccNumStr,
        issue_no: '01',
        issueNumber: 'I01',
        owner_dept: doc.department || 'PD',
        target_department: dept,       // << MANDATORY field for cross-department routing
        targetDepartment: dept,
        destination_dept: dept,
        destinationDept: dept,
        holder_dept: dept,
        department: dept,
        departmentId: dept,
        dept_code: dept,
        holder_name: `${dept} (${locName})`,
        location: locName,
        locationName: locName,
        location_name: locName,
        locationId: locId,
        location_id: locId,
        station_id: locId,
        station_name: locName,
        status: 'PENDING_ISSUE',
        is_replacement: false,
        is_adhoc: true,
        is_external: isExternal,
        isExternal: isExternal,
        request_reason: reason,
        requested_by: requesterName,
        requested_at: nowIso,
        dispatched_at: null,
        dispatched_by: null,
        receipt_confirmed_at: null,
        receipt_confirmed_by: null,
        receipt_remarks: null,
        recall_task_id: null,
        dateIssued: todayStr
      };

      newCreatedCopies.push(newCopy);

      newAuditLogs.push({
        id: `audit-adhoc-${Date.now()}-${idx}`,
        timestamp: nowIso,
        user: requesterName,
        action: 'REQUEST_ADDITIONAL_COPIES',
        docTitle: docCode,
        docRev: docVersion,
        ccNumber: ccNumStr,
        oldStatus: '-',
        newStatus: 'PENDING_ISSUE',
        remarks: `Requested ad-hoc copy for ${dept} (${locName}). Reason: ${reason}`
      });
    });

    // Update Document distributions
    const updatedDistributions = [...(doc.distributions || [])];
    newLocationsList.forEach(loc => {
      const dept = loc.departmentId || loc.dept || loc.dept_code || requesterDept;
      const locName = loc.station_name || loc.locationName || loc.name || loc.location || `${dept} Head Office`;
      const locId = loc.station_id || loc.locationId || loc.id;
      if (!updatedDistributions.some(d => (d.departmentId === dept || d.dept === dept || d.dept_code === dept) && (d.locationId === locId || d.station_id === locId))) {
        updatedDistributions.push({
          departmentId: dept,
          dept: dept,
          dept_code: dept,
          locationId: locId,
          station_id: locId,
          locationName: locName,
          station_name: locName,
          location: locName,
          name: locName,
          isCustom: !!(loc.isCustom || loc.is_custom)
        });
      }
    });

    const updatedDocuments = isInternal
      ? state.documents.map(d => d.id === doc.id ? { ...d, distributions: updatedDistributions, target_depts: Array.from(newTargetDepts) } : d)
      : state.documents;

    const updatedExternalDocs = isExternal
      ? (state.externalDocuments || []).map(d => d.id === doc.id ? { ...d, distributions: updatedDistributions } : d)
      : state.externalDocuments;

    // Create DCC task for issuing copies
    const taskId = `task-dcc-issue-${doc.id}-${Date.now()}`;
    const docOfficialTitle = doc.name || doc.document_name || doc.docName || doc.title || docCode;
    const dccTask = {
      id: taskId,
      type: 'DCC_DISTRIBUTE',
      taskType: 'DCC_ISSUE_CONTROLLED_COPIES',
      title: `ขอออกสำเนาควบคุมเพิ่มเติม: ${docOfficialTitle} (${docCode}) (${newLocationsList.length} จุด)`,
      description: `แผนก ${requesterDept} โดยคุณ ${requesterName} ขอรับสำเนาควบคุมเพิ่มเติมสำหรับ ${docCode} (${docOfficialTitle}) (Rev.${docVersion}) จำนวน ${newLocationsList.length} เล่ม เหตุผล: ${reason}`,
      docId: doc.id,
      darId: isInternal ? doc.id : null,
      externalDocId: isExternal ? doc.id : null,
      doc_code: docCode,
      docCode: docCode,
      docTitle: docOfficialTitle,
      docName: docOfficialTitle,
      doc_version: docVersion,
      assigneeId: resolveDccAdminUserId(state.masterUsers),
      assignedToRole: 'DCC_ADMIN',
      targetRole: 'DCC_ADMIN',
      target_role: 'DCC_ADMIN',
      department: 'DC',
      target_department: 'DC',
      targetDepartment: 'DC',
      status: 'PENDING',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: nowIso
    };

    const finalCopies = [...copies, ...newCreatedCopies];

    return {
      documents: updatedDocuments,
      externalDocuments: updatedExternalDocs,
      documentControlledCopies: finalCopies,
      controlledCopyInstances: finalCopies,
      tasks: [dccTask, ...state.tasks],
      controlledCopyAuditTrail: [...newAuditLogs, ...state.controlledCopyAuditTrail],
      notifications: [{
        id: `notif-adhoc-${Date.now()}`,
        userId: 'U001',
        title: 'มีคำขอออกสำเนาควบคุมเพิ่มเติม',
        message: `แผนก ${requesterDept} ขอรับสำเนาควบคุมสำหรับ ${docCode} เพิ่มเติม ${newLocationsList.length} จุด`,
        isRead: false,
        link: '/controlled-copy?tab=PENDING_ISSUE',
        timestamp: nowIso
      }, ...state.notifications],
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'REQUEST_ADDITIONAL_COPIES',
        actor: requesterName,
        details: `Requested ${newLocationsList.length} additional copies for ${docCode}`,
        timestamp: nowIso
      }, ...(state.actionLog || [])]
    };
  }),

  reportCcDamagedLost: (instId, type, reason) => set((state) => {
    const targetId = String(instId || '').trim();
    if (!targetId) return state;

    // 1. Comprehensive Copy Resolution across all controlled copy stores
    const copiesPool = [
      ...(state.controlledCopyInstances || []),
      ...(state.documentControlledCopies || [])
    ];
    let inst = copiesPool.find(i => String(i.id) === targetId || String(i.copyId || i.ccNumber) === targetId);

    // Fallback: search in nested document.controlledCopies
    if (!inst && Array.isArray(state.documents)) {
      for (const d of state.documents) {
        if (Array.isArray(d.controlledCopies)) {
          const found = d.controlledCopies.find(c => String(c.id) === targetId || String(c.copyId || c.ccNumber) === targetId);
          if (found) {
            inst = {
              ...found,
              docId: found.docId || d.id,
              doc_id: found.doc_id || d.id,
              docTitle: found.docTitle || d.title,
              doc_code: found.doc_code || d.title,
              holder_dept: found.holder_dept || found.department || d.department
            };
            break;
          }
        }
      }
    }

    if (!inst) {
      console.warn(`[reportCcDamagedLost] Controlled copy instance with ID ${targetId} not found in state.`);
      return state;
    }

    // 🛡️ Idempotency Guard: prevent duplicate reporting on copy already in terminal or pending state
    const invalidStatuses = [
      'PENDING_RECALL', 'DAMAGED_PENDING_RECALL', 'LOST', 'LOST_RECORDED',
      'DECLARED_LOST', 'RECALLED', 'DESTROYED', 'RECALLED_DESTROYED',
      'REPLACED_VOID', 'DAMAGED_PENDING_REPLACEMENT'
    ];
    if (invalidStatuses.includes(inst.status) || (type === 'DAMAGED' && (inst.isDamaged || inst.status === 'DAMAGED_PENDING_RECALL' || inst.status === 'PENDING_RECALL'))) {
      console.warn(`[reportCcDamagedLost] Copy ${targetId} is already in state ${inst.status}. Skipping duplicate request.`);
      return state;
    }

    // 🛡️ Dynamic RBAC & Department Custodianship Guard
    const user = state.currentUser;
    const isDccUser = Boolean(
      !user ||
      user.isDcc ||
      user.isSuperAdmin ||
      user.role === 'DCC_ADMIN' ||
      user.role === 'SUPER_ADMIN' ||
      user.role === 'ADMIN' ||
      user.role === 'QMR' ||
      user.isQmr ||
      user.id === 'U001' ||
      user.id === 'u5' ||
      user.department === 'DC' ||
      user.department === 'DCC' ||
      user.dept === 'DC' ||
      user.dept === 'DCC' ||
      (user.permissions && (user.permissions.includes('DCC_ADMIN') || user.permissions.includes('ADMIN')))
    );

    const copyDept = (inst.holder_dept || inst.department || inst.departmentId || inst.dept_code || inst.target_department || '').toString().trim();
    const rawUserDepts = user ? [
      user.primary_department,
      user.department,
      user.dept,
      user.dept_code,
      ...(Array.isArray(user.departments) ? user.departments : []),
      ...(Array.isArray(user.secondaryDepartments) ? user.secondaryDepartments : []),
      ...(Array.isArray(user.affiliated_departments) ? user.affiliated_departments : []),
      ...(Array.isArray(user.depts) ? user.depts : [])
    ] : [];
    const userDepts = Array.from(new Set(rawUserDepts.map(d => (typeof d === 'object' ? (d?.id || d?.code || d?.dept || d?.department) : d)?.toString().trim().toUpperCase()).filter(Boolean)));

    // Also check if user is the document creator / owner
    const relatedDoc = (state.documents || []).find(d => 
      String(d.id) === String(inst.doc_id || inst.docId) || 
      d.title === (inst.doc_code || inst.docTitle) || 
      d.document_code === (inst.doc_code || inst.docTitle)
    );
    const isDocCreator = Boolean(user && relatedDoc && (
      relatedDoc.createdBy === user.id ||
      relatedDoc.created_by === user.id ||
      relatedDoc.requesterId === user.id ||
      relatedDoc.ownerId === user.id
    ));

    const isAuthorizedDept = Boolean(
      !copyDept || 
      userDepts.length === 0 ||
      userDepts.some(d => isSameDepartment(d, copyDept)) ||
      isDocCreator
    );

    if (user && !isDccUser && !isAuthorizedDept) {
      console.warn(`[Security Guard] Unauthorized reportCcDamagedLost: User ${user?.name} (${user?.department}) cannot manage copy for department ${copyDept}`);
      throw new Error(`ปฏิเสธการทำรายการ: คุณไม่มีสิทธิ์จัดการสำเนาควบคุมของแผนก ${copyDept}`);
    }

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const reporterName = user?.name || user?.fullName || 'Authorized User';

    // 2. Safe Issue Number Calculation (Guarded against non-string types)
    const rawIssue = String(inst.issue_no || inst.issueNumber || '1');
    const currentIssue = parseInt(rawIssue.replace(/\D/g, ''), 10) || 1;
    const nextIssueNo = String(currentIssue + 1).padStart(2, '0');
    const nextIssue = `I${nextIssueNo}`;

    const isDamaged = type === 'DAMAGED';
    const newStatus = isDamaged ? 'DAMAGED_PENDING_RECALL' : 'LOST';

    const docOfficialTitle = inst.docName || inst.name || relatedDoc?.name || relatedDoc?.document_name || inst.doc_code || inst.docTitle || 'เอกสารควบคุม';
    const docCode = inst.doc_code || inst.docTitle || relatedDoc?.title || relatedDoc?.document_code || 'DOC';
    const dccAdminId = resolveDccAdminUserId(state.masterUsers);

    // 3. Audit log entry
    const auditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: nowIso,
      user: reporterName,
      action: isDamaged ? 'REPORT_DAMAGED' : 'REPORT_LOST',
      docTitle: docCode,
      docRev: inst.doc_version || inst.rev || '01',
      ccNumber: inst.copy_no || inst.ccNumber || '01',
      oldStatus: inst.status,
      newStatus: newStatus,
      remarks: isDamaged 
        ? `สำเนาชุดที่ ${inst.copy_no || inst.ccNumber || '01'} ได้รับการแจ้งชำรุดโดย ${reporterName} (${copyDept || inst.department}) -> สร้างงานเรียกคืนเล่มเดิม (DAMAGED_PENDING_RECALL) และตั้งเรื่องออกสำเนาทดแทน (เหตุผล: ${reason})`
        : `สำเนาชุดที่ ${inst.copy_no || inst.ccNumber || '01'} ได้รับการแจ้งสูญหายโดย ${reporterName} (${copyDept || inst.department}) -> ปลดออกจากทะเบียนสำเนาใช้งาน (LOST) และตั้งเรื่องออกสำเนาทดแทน (เหตุผล: ${reason})`
    };

    // 4. Replacement Copy Instance (Enqueued to PENDING_ISSUE for DCC)
    const replacementCopy = {
      id: `cc-rep-${inst.id}-${Date.now()}`,
      doc_id: inst.doc_id || inst.docId,
      docId: inst.doc_id || inst.docId,
      external_doc_id: inst.external_doc_id || inst.externalDocId,
      externalDocId: inst.external_doc_id || inst.externalDocId,
      doc_code: docCode,
      docCode: docCode,
      doc_title: docOfficialTitle,
      docTitle: docOfficialTitle,
      docName: docOfficialTitle,
      doc_type: inst.doc_type || inst.docType,
      docType: inst.doc_type || inst.docType,
      doc_version: inst.doc_version || inst.rev || '01',
      rev: inst.doc_version || inst.rev || '01',
      copy_no: inst.copy_no || inst.ccNumber || '01',
      copyNo: inst.copy_no || inst.ccNumber || '01',
      ccNumber: inst.ccNumber || (inst.copy_no ? (inst.copy_no.startsWith('CC-') || inst.copy_no.startsWith('Copy') ? inst.copy_no : `Copy ${inst.copy_no}`) : 'Copy 01'),
      issue_no: nextIssueNo,
      issueNumber: nextIssue,
      holder_dept: copyDept || inst.department,
      department: copyDept || inst.department,
      departmentId: copyDept || inst.department,
      dept_code: copyDept || inst.department,
      holder_name: inst.holder_name || `${copyDept || inst.department} (${inst.location || inst.locationName || 'Main Station'})`,
      location: inst.location || inst.locationName || `${copyDept || 'Station'} Point-of-Use`,
      locationName: inst.location || inst.locationName || `${copyDept || 'Station'} Point-of-Use`,
      locationId: inst.locationId || inst.station_id || `${copyDept}-STATION`,
      station_id: inst.locationId || inst.station_id || `${copyDept}-STATION`,
      station_name: inst.location || inst.locationName || `${copyDept || 'Station'} Point-of-Use`,
      status: 'PENDING_ISSUE',
      is_replacement: true,
      is_adhoc: false,
      isDamaged: false,
      is_damaged: false,
      replaced_copy_id: inst.id,
      replacement_reason: `${type}: ${reason}`,
      requested_by: reporterName,
      requested_at: nowIso,
      dateIssued: todayStr,
      dispatched_at: null,
      dispatched_by: null,
      receipt_confirmed_at: null,
      receipt_confirmed_by: null,
      receipt_remarks: null,
      recall_task_id: null
    };

    // 5. Task for DCC to Issue Replacement Copy
    const dccIssueTask = {
      id: `task-dcc-replacement-${inst.id}-${Date.now()}`,
      type: 'DCC_DISTRIBUTE',
      taskType: 'DCC_ISSUE_CONTROLLED_COPIES',
      task_type: 'DISTRIBUTION',
      title: `ออกสำเนาควบคุมทดแทน (Issue ${nextIssueNo}): ${docOfficialTitle} (${docCode}) (${inst.copy_no || inst.ccNumber || '01'})`,
      description: `แผนก ${copyDept || inst.department} แจ้ง${isDamaged ? 'ชำรุด' : 'สูญหาย'} ประจำจุด ${inst.location || inst.locationName || 'สถานีใช้งาน'} เหตุผล: ${reason}`,
      docId: inst.doc_id || inst.docId,
      doc_id: inst.doc_id || inst.docId,
      doc_code: docCode,
      docCode: docCode,
      docTitle: docOfficialTitle,
      docName: docOfficialTitle,
      doc_version: inst.doc_version || inst.rev || '01',
      copyId: replacementCopy.id,
      copy_id: replacementCopy.id,
      instanceId: replacementCopy.id,
      copy_no: inst.copy_no || inst.ccNumber || '01',
      issue_no: nextIssueNo,
      issueNumber: nextIssue,
      assigneeId: dccAdminId,
      assignedToRole: 'DCC_ADMIN',
      targetRole: 'DCC_ADMIN',
      target_role: 'DCC_ADMIN',
      department: 'DC',
      target_department: 'DC',
      targetDepartment: 'DC',
      status: 'PENDING',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: nowIso
    };

    // 6. Recall Task for DCC (ONLY for DAMAGED, NEVER for LOST)
    let dccRecallTask = null;
    if (isDamaged) {
      dccRecallTask = {
        id: `task-dcc-recall-${inst.id}-${Date.now()}`,
        type: 'DCC_RECALL',
        taskType: 'RECALL',
        task_type: 'RECALL',
        title: `เรียกคืนสำเนาชำรุด: ${docOfficialTitle} (${docCode}) (${inst.copy_no ? (inst.copy_no.startsWith('Copy') ? inst.copy_no : `Copy ${inst.copy_no}`) : (inst.ccNumber || 'Copy 01')})`,
        description: `แผนก ${copyDept || inst.department} แจ้งชำรุด ประจำจุด ${inst.location || inst.locationName || copyDept} เหตุผล: ${reason} (กรุณาเรียกคืนเล่มชำรุดมาทำลายตามระเบียบ ISO 9001)`,
        docId: inst.doc_id || inst.docId,
        doc_id: inst.doc_id || inst.docId,
        doc_code: docCode,
        docCode: docCode,
        docTitle: docOfficialTitle,
        docName: docOfficialTitle,
        doc_version: inst.doc_version || inst.rev || '01',
        copyId: inst.id,
        copy_id: inst.id,
        instanceId: inst.id,
        copy_no: inst.copy_no || inst.ccNumber || '01',
        location: inst.location || inst.locationName || copyDept,
        department: 'DC',
        holder_dept: copyDept || inst.department,
        target_department: 'DC',
        targetDepartment: 'DC',
        targetRole: 'DCC_ADMIN',
        target_role: 'DCC_ADMIN',
        assignedToRole: 'DCC_ADMIN',
        assigneeId: dccAdminId,
        status: 'PENDING',
        priority: 'HIGH',
        isDamaged: true,
        is_damaged: true,
        reason: 'DAMAGED',
        actionRequired: true,
        is_completed: false,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: nowIso
      };
    }

    // 7. Dynamic Notifications
    const newNotifications = [...(state.notifications || [])];
    newNotifications.push({
      id: `notif-rep-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: dccAdminId,
      targetUserIds: [dccAdminId],
      targetRole: 'DCC_ADMIN',
      targetDepartment: 'DC',
      title: `มีคำขอออกสำเนาทดแทน (${isDamaged ? 'ชำรุด' : 'สูญหาย'})`,
      message: `แผนก ${copyDept || inst.department} แจ้งออกสำเนาทดแทน ${docCode} (${inst.copy_no || inst.ccNumber || '01'}) จุด ${inst.location || inst.locationName || 'สถานีใช้งาน'}`,
      type: 'TASK_ASSIGNED',
      category: 'CONTROLLED_COPY',
      isRead: false,
      read: false,
      readBy: [],
      link: isDamaged ? '/controlled-copy?tab=RECALL_CHECKLIST' : '/controlled-copy?tab=PENDING_ISSUE',
      timestamp: nowIso,
      docCode: docCode
    });

    if (user?.id) {
      newNotifications.push({
        id: `notif-rep-req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: user.id,
        targetUserIds: [user.id],
        title: 'ยื่นคำร้องขอสำเนาทดแทนสำเร็จ',
        message: `แจ้ง${isDamaged ? 'ชำรุด' : 'สูญหาย'} สำหรับสำเนา ${docCode} (${inst.copy_no || inst.ccNumber || '01'}) เรียบร้อยแล้ว (รอ DCC จัดพิมพ์ Issue ${nextIssueNo})`,
        type: 'SUCCESS',
        category: 'CONTROLLED_COPY',
        isRead: false,
        read: false,
        readBy: [],
        link: '/library',
        timestamp: nowIso,
        docCode: docCode
      });
    }

    // 8. Unified Update across Controlled Copy Instances and Documents
    const existingCopies = [
      ...(state.controlledCopyInstances || []),
      ...(state.documentControlledCopies || [])
    ];
    const seenIds = new Set();
    const updatedCopies = [];

    existingCopies.forEach(c => {
      const cId = String(c.id);
      if (seenIds.has(cId)) return;
      seenIds.add(cId);

      if (cId === targetId) {
        updatedCopies.push({
          ...c,
          status: newStatus,
          isDamaged: isDamaged,
          is_damaged: isDamaged,
          isLost: !isDamaged,
          is_lost: !isDamaged,
          replacementReason: type,
          replacement_reason: type,
          reportType: type,
          reportReason: reason,
          reportRequesterName: reporterName,
          reportRequesterId: user ? user.id : null,
          reportedAt: nowIso,
          reported_at: nowIso
        });
      } else {
        updatedCopies.push(c);
      }
    });

    updatedCopies.push(replacementCopy);

    // Also update document.controlledCopies in state.documents if present
    const updatedDocs = (state.documents || []).map(d => {
      if (Array.isArray(d.controlledCopies) && d.controlledCopies.some(c => String(c.id) === targetId)) {
        return {
          ...d,
          controlledCopies: [
            ...d.controlledCopies.map(c => String(c.id) === targetId ? {
              ...c,
              status: newStatus,
              isDamaged: isDamaged,
              is_damaged: isDamaged,
              isLost: !isDamaged,
              is_lost: !isDamaged,
              reportedAt: nowIso
            } : c),
            replacementCopy
          ]
        };
      }
      return d;
    });

    const tasksToAdd = dccRecallTask ? [dccRecallTask, dccIssueTask] : [dccIssueTask];

    return {
      documents: updatedDocs,
      documentControlledCopies: updatedCopies,
      controlledCopyInstances: updatedCopies,
      controlledCopyAuditTrail: [auditLog, ...(state.controlledCopyAuditTrail || [])],
      tasks: [...tasksToAdd, ...(state.tasks || [])],
      notifications: newNotifications,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'CC_REPORT_REPLACEMENT',
        actor: reporterName,
        details: `Reported copy ${targetId} as ${type} and auto-enqueued replacement copy ${replacementCopy.id}`,
        timestamp: nowIso
      }, ...(state.actionLog || [])]
    };
  }),

  // Backward compatibility & RBAC aliases
  reportCopyDamaged: ({ copyId, reason, requestReplacement: _requestReplacement, type = 'DAMAGED' } = {}) => {
    return useStore.getState().reportCcDamagedLost(copyId, type, reason);
  },
  requestCopyReplacement: (copyId, reason, type = 'DAMAGED') => {
    return useStore.getState().reportCcDamagedLost(copyId, type, reason);
  },
  reportCopyIssue: (copyId, type = 'DAMAGED', reason = '') => {
    return useStore.getState().reportCcDamagedLost(copyId, type, reason);
  },

  // Record physical receipt of recalled copy by DCC
  recordCopyRecalled: (copyId, notes = '') => set((state) => {
    const targetId = String(copyId);
    const copies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies || []);
    const inst = copies.find(i => String(i.id) === targetId);
    if (!inst) return state;

    const nowIso = new Date().toISOString();
    const userName = state.currentUser ? state.currentUser.name : 'DCC Officer';

    const updatedCopies = copies.map(i => {
      if (String(i.id) === targetId) {
        return {
          ...i,
          status: 'RECALLED',
          recalled_at: nowIso,
          recalled_by: userName,
          dcc_notes: notes || i.dcc_notes || '',
          dateRecalled: nowIso.split('T')[0]
        };
      }
      return i;
    });

    const auditLog = {
      id: `audit-recall-${Date.now()}`,
      timestamp: nowIso,
      user: userName,
      action: 'CC_RECALL_RECEIVED',
      docTitle: inst.doc_code || inst.docTitle,
      docRev: inst.doc_version || inst.rev,
      ccNumber: inst.copy_no || inst.ccNumber,
      oldStatus: inst.status,
      newStatus: 'RECALLED',
      remarks: `DCC บันทึกรับคืนเล่มชำรุด Copy ${inst.copy_no || inst.ccNumber} จากแผนก ${inst.holder_dept || inst.department} เรียบร้อยแล้ว (รอทำลาย)`
    };

    return {
      controlledCopyInstances: updatedCopies,
      documentControlledCopies: updatedCopies,
      controlledCopyAuditTrail: [auditLog, ...(state.controlledCopyAuditTrail || [])],
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'CC_RECALL_RECEIVED',
        actor: userName,
        details: `Recorded physical receipt of recalled copy ${targetId}`,
        timestamp: nowIso
      }, ...(state.actionLog || [])]
    };
  }),

  markCopyRecalled: (copyId, notes) => useStore.getState().recordCopyRecalled(copyId, notes),
  receiveRecallCopy: (copyId, notes) => useStore.getState().recordCopyRecalled(copyId, notes),

  // Quick-toggle physical receipt of recalled copy (Step 1 <-> Step 2)
  toggleCopyRecallReceived: (copyId) => set((state) => {
    const targetId = String(copyId);
    const copies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies || []);
    const inst = copies.find(i => String(i.id) === targetId);
    if (!inst) return state;

    const isCurrentlyReceived = inst.status === 'RECALLED' || inst.status === 'RECEIVED_AT_DCC' || inst.status === 'RECALLED_HELD_AT_DCC';
    const nowIso = new Date().toISOString();
    const userName = state.currentUser ? state.currentUser.name : 'DCC Officer';

    let newStatus;
    let recalledAt;
    let recalledBy;

    if (isCurrentlyReceived) {
      // Revert to Step 1 (Waiting for collection)
      newStatus = inst.previous_recall_status || 
                  (inst.isDamaged || inst.is_damaged ? 'DAMAGED_PENDING_RECALL' : 'SUPERSEDED_PENDING_RECALL');
      recalledAt = null;
      recalledBy = null;
    } else {
      // Advance to Step 2 (Held at DCC awaiting disposition/destruction)
      newStatus = 'RECALLED';
      recalledAt = nowIso;
      recalledBy = userName;
    }

    const updatedCopies = copies.map(c => {
      if (String(c.id) === targetId) {
        return {
          ...c,
          status: newStatus,
          previous_recall_status: isCurrentlyReceived ? null : (c.status || 'PENDING_RECALL'),
          recalled_at: recalledAt,
          recalled_by: recalledBy,
          dateRecalled: recalledAt ? recalledAt.split('T')[0] : null
        };
      }
      return c;
    });

    const auditLog = {
      id: `audit-toggle-recall-${Date.now()}`,
      timestamp: nowIso,
      user: userName,
      action: isCurrentlyReceived ? 'CC_RECALL_RECEIPT_REVERTED' : 'CC_RECALL_RECEIVED',
      docTitle: inst.doc_code || inst.docTitle,
      docRev: inst.doc_version || inst.rev,
      ccNumber: inst.copy_no || inst.ccNumber,
      oldStatus: inst.status,
      newStatus: newStatus,
      remarks: isCurrentlyReceived
        ? `DCC ยกเลิกการบันทึกรับคืนเล่ม Copy ${inst.copy_no || inst.ccNumber} (กลับสู่สถานะรอเก็บเล่มจากหน้างาน)`
        : `DCC บันทึกตรวจรับเล่มจริง Copy ${inst.copy_no || inst.ccNumber} ประจำจุด ${inst.location || inst.locationName} กลับสู่ DCC เรียบร้อยแล้ว (รอการจัดการ/ทำลาย)`
    };

    return {
      controlledCopyInstances: updatedCopies,
      documentControlledCopies: updatedCopies,
      controlledCopyAuditTrail: [auditLog, ...(state.controlledCopyAuditTrail || [])],
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: isCurrentlyReceived ? 'CC_RECALL_REVERT' : 'CC_RECALL_RECEIVED',
        actor: userName,
        details: `${isCurrentlyReceived ? 'Reverted' : 'Recorded'} physical receipt of copy ${targetId}`,
        timestamp: nowIso
      }, ...(state.actionLog || [])]
    };
  }),

  // Destroy recalled physical copy and resolve DCC_RECALL tasks
  destroyControlledCopy: (copyId, dispositionMethod = 'SHRED', notes = '', witnessName = '', referenceNo = '') => set((state) => {
    const targetId = String(copyId);
    const copies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies || []);
    const inst = copies.find(i => String(i.id) === targetId);
    if (!inst) return state;

    const nowIso = new Date().toISOString();
    const userName = state.currentUser ? state.currentUser.name : 'DCC Officer';

    const updatedCopies = copies.map(i => {
      if (String(i.id) === targetId) {
        return {
          ...i,
          status: 'DESTROYED',
          disposition_type: 'DESTROYED',
          destroyed_at: nowIso,
          destroyed_by: userName,
          recalled_at: i.recalled_at || nowIso,
          recalled_by: i.recalled_by || userName,
          disposition_method: dispositionMethod,
          dcc_notes: notes || i.dcc_notes || '',
          witness_name: witnessName || i.witness_name || '',
          reference_no: referenceNo || i.reference_no || '',
          dateDestroyed: nowIso.split('T')[0]
        };
      }
      return i;
    });

    // 🛡️ Dedicated Disposition Ledger Entry (Append-Only)
    const dispRecord = {
      id: `DISP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      copyId: inst.id,
      copy_id: inst.id,
      docCode: inst.doc_code || inst.docTitle || '',
      docTitle: inst.docName || inst.doc_title || inst.docTitle || '',
      revision: inst.doc_version || inst.rev || '01',
      copyNumber: inst.copy_no ? (String(inst.copy_no).startsWith('Copy') ? inst.copy_no : `Copy ${inst.copy_no}`) : (inst.ccNumber || 'Copy 01'),
      copy_no: inst.copy_no || inst.ccNumber || '01',
      department: inst.holder_dept || inst.department || '',
      location: inst.location || inst.locationName || inst.station_name || '',
      dispositionType: 'DESTROYED',
      dispositionMethod: dispositionMethod,
      disposedBy: state.currentUser ? `${state.currentUser.name} (${state.currentUser.empId || state.currentUser.role || 'DCC'})` : `${userName} (DCC)`,
      disposed_by_name: userName,
      disposed_by_id: state.currentUser?.id || 'U001',
      disposedAt: nowIso,
      witnessName: witnessName || '',
      witness_name: witnessName || '',
      referenceNo: referenceNo || '',
      reference_no: referenceNo || '',
      notes: notes || ''
    };

    // Check and resolve any DCC_RECALL task associated with this copy or document
    const updatedTasks = (state.tasks || []).map(t => {
      // STRICT ISOLATION GUARD: Never touch distribution tasks!
      if (t.type === 'DCC_DISTRIBUTE' || t.taskType === 'DISTRIBUTION' || t.task_type === 'DISTRIBUTION') return t;

      const isRecallTask = t.type === 'DCC_RECALL' || t.taskType === 'RECALL' || t.task_type === 'RECALL' || t.type === 'RECALL';
      if (!isRecallTask) return t;

      const isMatch = (t.copyId && String(t.copyId) === targetId) ||
                      (t.instanceId && String(t.instanceId) === targetId) ||
                      (t.copy_id && String(t.copy_id) === targetId) ||
                      (t.supersededCopyIds && Array.isArray(t.supersededCopyIds) && t.supersededCopyIds.some(sid => String(sid) === targetId));

      if (isMatch) {
        if (t.supersededCopyIds && Array.isArray(t.supersededCopyIds) && t.supersededCopyIds.length > 0) {
          const allResolved = t.supersededCopyIds.every(id => {
            const c = updatedCopies.find(copy => String(copy.id) === String(id));
            return !c || c.status === 'DESTROYED' || c.status === 'ARCHIVED_OBSOLETE' || c.status === 'OBSOLETE' || c.status === 'RECALLED';
          });
          if (allResolved) {
            return {
              ...t,
              status: 'COMPLETED',
              is_completed: true,
              actionRequired: false,
              completedAt: nowIso,
              completed_at: nowIso
            };
          }
          return t;
        }

        return {
          ...t,
          status: 'COMPLETED',
          is_completed: true,
          actionRequired: false,
          completedAt: nowIso,
          completed_at: nowIso
        };
      }
      return t;
    });

    const cleanedTasks = cleanupDccTasks(updatedTasks, updatedCopies, state.documents, state.dars);

    const auditLog = {
      id: `audit-destroy-${Date.now()}`,
      timestamp: nowIso,
      user: userName,
      action: 'CONTROLLED_COPY_DISPOSITION',
      docTitle: inst.doc_code || inst.docTitle,
      docRev: inst.doc_version || inst.rev,
      ccNumber: inst.copy_no || inst.ccNumber,
      oldStatus: inst.status,
      newStatus: 'DESTROYED',
      remarks: `DCC บันทึกการทำลาย (${dispositionMethod}) สำหรับสำเนา Copy ${inst.copy_no || inst.ccNumber} ของ ${inst.doc_code || inst.docTitle} เรียบร้อยแล้ว`
    };

    return {
      controlledCopyInstances: updatedCopies,
      documentControlledCopies: updatedCopies,
      copyDispositionRecords: [dispRecord, ...(state.copyDispositionRecords || [])],
      dispositionHistory: [dispRecord, ...(state.dispositionHistory || [])],
      tasks: cleanedTasks,
      controlledCopyAuditTrail: [auditLog, ...(state.controlledCopyAuditTrail || [])],
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'CC_DESTROYED',
        actor: userName,
        details: `Destroyed copy ${targetId} via ${dispositionMethod}`,
        timestamp: nowIso
      }, ...(state.actionLog || [])]
    };
  }),

  recordCopyDestroyed: (copyId, method, notes, witnessName, referenceNo) => useStore.getState().destroyControlledCopy(copyId, method, notes, witnessName, referenceNo),

  approveCcReplacement: (taskId) => set((state) => {
    const task = state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return state;

    const instId = String(task.instanceId);
    const copies = state.documentControlledCopies || state.controlledCopyInstances || [];
    const oldInst = copies.find(i => String(i.id) === instId);
    if (!oldInst) return state;

    const updatedInstances = copies.map(inst =>
      String(inst.id) === instId ? { ...inst, status: oldInst.reportType } : inst
    );

    const currentIssue = parseInt((oldInst.issue_no || oldInst.issueNumber || '1').replace('I', '')) || 1;
    const nextIssue = `I${String(currentIssue + 1).padStart(2, '0')}`;
    const nextIssueNo = String(currentIssue + 1).padStart(2, '0');

    const newInst = {
      ...oldInst,
      id: `inst-${Date.now()}`,
      copy_no: oldInst.copy_no || oldInst.ccNumber,
      ccNumber: oldInst.copy_no || oldInst.ccNumber,
      issue_no: nextIssueNo,
      issueNumber: nextIssue,
      status: 'PENDING_ISSUE',
      is_replacement: true,
      dispatched_at: null,
      dispatched_by: null,
      dateIssued: new Date().toISOString().split('T')[0],
      receipt_confirmed_at: null,
      receipt_confirmed_by: null,
      receipt_remarks: null,
      reportType: undefined,
      reportReason: undefined,
      reportRequesterName: undefined,
      reportRequesterId: undefined
    };

    const auditLog = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: state.currentUser.name,
      action: 'APPROVE_REPLACEMENT',
      docTitle: oldInst.doc_code || oldInst.docTitle,
      docRev: oldInst.doc_version || oldInst.rev,
      ccNumber: oldInst.copy_no || oldInst.ccNumber,
      oldStatus: oldInst.status,
      newStatus: oldInst.reportType,
      remarks: `Manager approved replacement for ${oldInst.reportType}. New Issue: ${nextIssue}`
    };

    const newTasks = state.tasks.filter(t => String(t.id) !== String(taskId));
    let newNotifs = state.notifications.map(n => String(n.relatedTaskId) === String(taskId) ? { ...n, isRead: true } : n);

    newNotifs.push({
      id: `notif-dcc-${Date.now()}`,
      userId: 'U001',
      title: 'จัดพิมพ์เอกสารทดแทน',
      message: `ผู้จัดการได้อนุมัติเอกสารทดแทนสำหรับ ${oldInst.copy_no || oldInst.ccNumber} กรุณาจัดพิมพ์และแจกจ่าย`,
      isRead: false,
      link: '/controlled-copy',
      timestamp: new Date().toISOString()
    });

    const finalInstances = [...updatedInstances, newInst];
    return { 
      documentControlledCopies: finalInstances,
      controlledCopyInstances: finalInstances,
      controlledCopyAuditTrail: [auditLog, ...state.controlledCopyAuditTrail],
      tasks: cleanupDccTasks(newTasks, finalInstances, state.documents),
      notifications: newNotifs,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'CC_REPLACE_APPROVE',
        actor: state.currentUser.name,
        details: `Approved replacement for task ${taskId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  rejectCcReplacement: (taskId, reason) => set((state) => {
    const task = state.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return state;

    const instId = String(task.instanceId);
    const copies = state.documentControlledCopies || state.controlledCopyInstances || [];
    const inst = copies.find(i => String(i.id) === instId);
    if (!inst) return state;

    const auditLog = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: state.currentUser.name,
      action: 'REJECT_REPLACEMENT',
      docTitle: inst.doc_code || inst.docTitle,
      docRev: inst.doc_version || inst.rev,
      ccNumber: inst.copy_no || inst.ccNumber,
      oldStatus: inst.status,
      newStatus: 'ISSUED_ACTIVE',
      remarks: `Manager rejected replacement request. Reason: ${reason}`
    };

    const newTasks = state.tasks.filter(t => String(t.id) !== String(taskId));
    let newNotifs = state.notifications.map(n => String(n.relatedTaskId) === String(taskId) ? { ...n, isRead: true } : n);

    newNotifs.push({
      id: `notif-rej-${Date.now()}`,
      userId: inst.reportRequesterId,
      title: 'ปฏิเสธคำขอทดแทนเอกสาร',
      message: `คำขอทดแทนเอกสาร ${inst.copy_no || inst.ccNumber} ถูกปฏิเสธ: ${reason}`,
      isRead: false,
      link: '/dashboard',
      timestamp: new Date().toISOString()
    });

    const updatedCopies = copies.map(i =>
      String(i.id) === instId ? { ...i, status: 'ISSUED_ACTIVE', reportType: undefined, reportReason: undefined, reportRequesterName: undefined, reportRequesterId: undefined } : i
    );

    return {
      documentControlledCopies: updatedCopies,
      controlledCopyInstances: updatedCopies,
      controlledCopyAuditTrail: [auditLog, ...state.controlledCopyAuditTrail],
      tasks: newTasks,
      notifications: newNotifs,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'CC_REPLACE_REJECT',
        actor: state.currentUser.name,
        details: `Rejected replacement for task ${taskId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  recallControlledCopy: (instId) => set((state) => {
    const targetId = String(instId);
    const copies = state.documentControlledCopies || state.controlledCopyInstances || [];
    const inst = copies.find(i => String(i.id) === targetId);
    if (!inst) return state;

    const auditLog = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: state.currentUser.name,
      action: 'RECALL_COPY',
      docTitle: inst.doc_code || inst.docTitle,
      docRev: inst.doc_version || inst.rev,
      ccNumber: inst.copy_no || inst.ccNumber,
      oldStatus: inst.status,
      newStatus: 'RECALLED_DESTROYED',
      remarks: `Recalled copy due to obsolescence or new revision`
    };

    const newInstances = copies.map(i => 
      String(i.id) === targetId ? { ...i, status: 'RECALLED_DESTROYED', dateRecalled: new Date().toISOString().split('T')[0], recalled_at: new Date().toISOString(), recalled_by: state.currentUser.name } : i
    );
    return {
      documentControlledCopies: newInstances,
      controlledCopyInstances: newInstances,
      controlledCopyAuditTrail: [auditLog, ...state.controlledCopyAuditTrail],
      tasks: cleanupDccTasks(state.tasks, newInstances, state.documents),
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'CC_RECALL',
        actor: state.currentUser.name,
        details: `Recalled copy ${targetId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  distributeDocument: (docId, deptId) => set((state) => {
    let updatedDocs = [...state.documents];
    const docIndex = updatedDocs.findIndex(d => d.id === docId);

    if (docIndex > -1) {
      const doc = updatedDocs[docIndex];
      const updatedDistributions = (doc.distributions || []).map(dist => {
        const dId = dist.departmentId || dist.dept;
        if (dId === deptId) {
          return { ...dist, isDistributed: true, distributedAt: new Date().toISOString() };
        }
        return dist;
      });
      updatedDocs[docIndex] = { ...doc, distributions: updatedDistributions };
    }
    
    return { 
      documents: updatedDocs,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'DOC_DISTRIBUTE',
        actor: state.currentUser.name,
        details: `Distributed document ${docId} to ${deptId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  distributeAllDocument: (docId) => set((state) => {
    let updatedDocs = [...state.documents];
    const docIndex = updatedDocs.findIndex(d => d.id === docId);

    if (docIndex > -1) {
      const doc = updatedDocs[docIndex];
      const updatedDistributions = (doc.distributions || []).map(dist => {
        return { ...dist, isDistributed: true, distributedAt: new Date().toISOString() };
      });
      updatedDocs[docIndex] = { ...doc, distributions: updatedDistributions };
    }
    
    return { 
      documents: updatedDocs,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'DOC_DISTRIBUTE_ALL',
        actor: state.currentUser.name,
        details: `Distributed document ${docId} to all departments`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  // ================= MASTER DATA ACTIONS ================= //

  // --- 1. User Management Actions ---
  addMasterUser: (userData) => set((state) => {
    const newId = userData.id || `U${String(Date.now()).slice(-4)}`;
    const empId = userData.empId || `EMP-${String((state.masterUsers || []).length + 1).padStart(3, '0')}`;
    const primaryDept = userData.primary_department || userData.department || userData.dept || 'QA/QC';
    const rawAffiliated = userData.affiliated_departments || userData.depts || (userData.department ? [userData.department] : [primaryDept]);
    const affiliatedDepts = Array.from(new Set([primaryDept, ...(Array.isArray(rawAffiliated) ? rawAffiliated : [rawAffiliated])]));
    const approvalLevel = Number(userData.approval_level || userData.level) || 1;
    const isQmr = userData.role === 'QMR' || Boolean(userData.isQmr);
    const isDcc = userData.role === 'DCC_ADMIN' || Boolean(userData.isDcc);

    const basePermissions = ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'];
    if (isDcc) basePermissions.push('DCC_ADMIN');
    if (isQmr) basePermissions.push('QMR_ACCESS');
    const userPermissions = (userData.permissions && userData.permissions.length > 0)
      ? Array.from(new Set([...basePermissions, ...userData.permissions]))
      : basePermissions;

    const newUser = {
      id: newId,
      empId,
      name: userData.name,
      fullName: userData.fullName || userData.name,
      email: userData.email || `${newId.toLowerCase()}@company.com`,
      department: primaryDept,
      dept: primaryDept,
      primary_department: primaryDept,
      depts: affiliatedDepts,
      affiliated_departments: affiliatedDepts,
      position: userData.position || 'Staff',
      role: userData.role || 'GENERAL_USER',
      level: approvalLevel,
      approval_level: approvalLevel,
      isDcc,
      isQmr,
      status: userData.status || 'Active',
      pin: userData.pin || '123456',
      failedPinAttempts: 0,
      isLocked: false,
      lastPinChangedAt: new Date().toISOString(),
      permissions: userPermissions,
      canCreateDar: userData.canCreateDar !== undefined ? Boolean(userData.canCreateDar) : true,
      canAccessTasks: userData.canAccessTasks !== undefined ? Boolean(userData.canAccessTasks) : true,
      canViewRegister: userData.canViewRegister !== undefined ? Boolean(userData.canViewRegister) : true,
      isWorkflowUser: userData.isWorkflowUser !== undefined ? Boolean(userData.isWorkflowUser) : true,
      signatureType: userData.signatureType || 'TYPOGRAPHIC',
      signatureStyle: userData.signatureStyle || 'MODERN_SANS',
      signatureInitials: userData.signatureInitials || `${(userData.name || newId).slice(0, 3).toUpperCase()}-${primaryDept}`,
      hasRegisteredSignature: userData.hasRegisteredSignature ?? true
    };

    const updatedUsers = [...(state.masterUsers || []), newUser];
    const userRoleObj = (u) => ({
      id: u.id,
      empId: u.empId || u.id,
      name: u.name,
      depts: u.affiliated_departments || u.depts,
      affiliated_departments: u.affiliated_departments || u.depts,
      department: u.primary_department || u.department,
      primary_department: u.primary_department || u.department,
      level: u.approval_level || u.level,
      approval_level: u.approval_level || u.level
    });

    return {
      masterUsers: updatedUsers,
      requestUsers: updatedUsers.map(userRoleObj),
      reviewUsers: updatedUsers.map(userRoleObj),
      approveUsers: updatedUsers.map(userRoleObj),
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_USER_CREATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Created user ${newUser.name} (${newUser.id}) with role ${newUser.role}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  updateMasterUser: (userId, userData) => set((state) => {
    const updatedUsers = (state.masterUsers || []).map(u => {
      if (u.id === userId) {
        const primaryDept = userData.primary_department || userData.department || u.primary_department || u.department || 'QA/QC';
        const rawAffiliated = userData.affiliated_departments || userData.depts || u.affiliated_departments || u.depts || [primaryDept];
        const affiliatedDepts = Array.from(new Set([primaryDept, ...(Array.isArray(rawAffiliated) ? rawAffiliated : [rawAffiliated])]));
        const approvalLevel = userData.approval_level !== undefined 
          ? Number(userData.approval_level) 
          : (userData.level !== undefined ? Number(userData.level) : (u.approval_level || u.level || 1));
        const isQmr = userData.role === 'QMR' ? true : (userData.isQmr !== undefined ? Boolean(userData.isQmr) : Boolean(u.isQmr));

        const updated = {
          ...u,
          ...userData,
          department: primaryDept,
          dept: primaryDept,
          primary_department: primaryDept,
          depts: affiliatedDepts,
          affiliated_departments: affiliatedDepts,
          level: approvalLevel,
          approval_level: approvalLevel,
          isDcc: userData.role === 'DCC_ADMIN' ? true : (userData.role ? false : u.isDcc),
          isQmr: isQmr,
          permissions: (userData.permissions && userData.permissions.length > 0) ? userData.permissions : (u.permissions?.length > 0 ? u.permissions : ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER']),
          canCreateDar: userData.canCreateDar !== undefined ? Boolean(userData.canCreateDar) : (u.canCreateDar ?? true),
          canAccessTasks: userData.canAccessTasks !== undefined ? Boolean(userData.canAccessTasks) : (u.canAccessTasks ?? true),
          canViewRegister: userData.canViewRegister !== undefined ? Boolean(userData.canViewRegister) : (u.canViewRegister ?? true),
          isWorkflowUser: userData.isWorkflowUser !== undefined ? Boolean(userData.isWorkflowUser) : (u.isWorkflowUser ?? true)
        };
        return updated;
      }
      return u;
    });

    const updatedCurrentUser = state.currentUser?.id === userId
      ? { ...state.currentUser, ...(updatedUsers.find(u => u.id === userId) || {}) }
      : state.currentUser;

    const userRoleObj = (u) => ({
      id: u.id,
      empId: u.empId || u.id,
      name: u.name,
      depts: u.affiliated_departments || u.depts,
      affiliated_departments: u.affiliated_departments || u.depts,
      department: u.primary_department || u.department,
      primary_department: u.primary_department || u.department,
      level: u.approval_level || u.level,
      approval_level: u.approval_level || u.level
    });

    return {
      masterUsers: updatedUsers,
      currentUser: updatedCurrentUser,
      requestUsers: updatedUsers.map(userRoleObj),
      reviewUsers: updatedUsers.map(userRoleObj),
      approveUsers: updatedUsers.map(userRoleObj),
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_USER_UPDATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Updated user ${userId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  toggleUserStatus: (userId) => set((state) => {
    const updatedUsers = (state.masterUsers || []).map(u => {
      if (u.id === userId) {
        const newStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        return { ...u, status: newStatus };
      }
      return u;
    });

    return {
      masterUsers: updatedUsers,
      requestUsers: updatedUsers.map(u => ({ id: u.id, name: u.name, depts: u.depts, department: u.department, level: u.level })),
      reviewUsers: updatedUsers.map(u => ({ id: u.id, name: u.name, depts: u.depts, department: u.department, level: u.level })),
      approveUsers: updatedUsers.map(u => ({ id: u.id, name: u.name, depts: u.depts, department: u.department, level: u.level }))
    };
  }),

  resetUserPassword: (userId) => set((state) => {
    return {
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_USER_PASSWORD_RESET',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Reset password to default for user ${userId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  resetUserPin: (userId) => set((state) => {
    const defaultPin = state.signatureSettings?.defaultPin || '123456';
    const updatedUsers = (state.masterUsers || []).map(u => {
      if (u.id === userId) {
        return { 
          ...u, 
          pin: defaultPin, 
          failedPinAttempts: 0, 
          isLocked: false, 
          lastPinChangedAt: new Date().toISOString() 
        };
      }
      return u;
    });

    return {
      masterUsers: updatedUsers,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_USER_PIN_RESET',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Reset signing PIN to default for user ${userId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  unlockUserAccount: (userId) => set((state) => {
    const updatedUsers = (state.masterUsers || []).map(u => {
      if (u.id === userId) {
        return { ...u, isLocked: false, failedPinAttempts: 0 };
      }
      return u;
    });

    return {
      masterUsers: updatedUsers,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_USER_UNLOCKED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Unlocked account for user ${userId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  updateUserSignatureProfile: (userId, profileData) => set((state) => {
    const updatedUsers = (state.masterUsers || []).map(u => {
      if (u.id === userId) {
        return {
          ...u,
          ...profileData,
          hasRegisteredSignature: true,
          lastSignatureUpdatedAt: new Date().toISOString()
        };
      }
      return u;
    });

    return {
      masterUsers: updatedUsers,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        actionType: 'MASTER_USER_SIGNATURE_UPDATED',
        action: 'อัปเดตโปรไฟล์ลายเซ็นดิจิทัล',
        actor: state.currentUser?.name || 'DCC Officer',
        user: state.currentUser?.name || 'DCC Officer',
        details: `Updated digital signature profile for user ${userId} (${profileData.signatureType || 'TYPOGRAPHIC'})`,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        date: new Date().toISOString(),
        category: 'SYSTEM'
      }, ...(state.actionLog || [])]
    };
  }),

  // --- 2. Department Management Actions ---
  addDepartment: (deptData) => {
    try {
      set((state) => {
        const rawId = String(deptData?.id || deptData?.code || deptData?.deptCode || '').toUpperCase().trim();
        const rawNameTh = String(deptData?.nameTh || deptData?.name || deptData?.name_th || rawId).trim();
        const rawNameEn = String(deptData?.nameEn || deptData?.name_en || deptData?.name || rawId).trim();
        const headNameVal = deptData?.headName || deptData?.manager || '';

        if (!rawId) {
          throw new Error('รหัสแผนกไม่ถูกต้อง');
        }

        const newDept = {
          id: rawId,
          code: rawId,
          deptCode: rawId,
          name: rawNameTh,
          nameTh: rawNameTh,
          name_th: rawNameTh,
          nameEn: rawNameEn,
          name_en: rawNameEn,
          headUserId: deptData?.headUserId || '',
          headName: headNameVal,
          manager: headNameVal,
          status: deptData?.status || 'ACTIVE',
          color: deptData?.color || 'indigo'
        };

        const currentDepts = state.departments || state.masterDepartments || [];
        if (currentDepts.some(d => String(d.id || d.code || d.deptCode || '').toUpperCase().trim() === newDept.id)) {
          throw new Error(`รหัสแผนก "${newDept.id}" มีอยู่ในระบบแล้ว`);
        }

        const updatedDepts = [...currentDepts, newDept];
        return {
          departments: updatedDepts,
          masterDepartments: updatedDepts,
          actionLog: [{
            id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            actionType: 'MASTER_DEPT_CREATED',
            actor: state.currentUser?.name || 'DCC Officer',
            details: `Created department ${newDept.id} (${newDept.nameTh})`,
            timestamp: new Date().toISOString()
          }, ...(state.actionLog || [])]
        };
      });
      return true;
    } catch (err) {
      console.error('addDepartment error:', err);
      throw err;
    }
  },

  updateDepartment: (deptId, deptData) => {
    try {
      set((state) => {
        const currentDepts = state.departments || state.masterDepartments || [];
        const oldCode = String(deptId || deptData?.oldCode || '').trim().toUpperCase();
        const newCode = String(deptData?.id || deptData?.code || deptData?.deptCode || deptId || '').trim().toUpperCase();
        const isCodeChanged = Boolean(oldCode && newCode && oldCode !== newCode);

        if (!newCode) {
          throw new Error('รหัสแผนกไม่ถูกต้อง');
        }

        // Case-Insensitive Uniqueness Check (prevent duplicate department code)
        if (isCodeChanged) {
          const duplicateDept = currentDepts.find(d => {
            const existingCode = String(d.id || d.code || d.deptCode || '').trim().toUpperCase();
            const isSelf = existingCode === oldCode;
            return !isSelf && existingCode === newCode;
          });
          if (duplicateDept) {
            throw new Error(`รหัสแผนก "${newCode}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`);
          }
        }

        const headNameVal = deptData.headName !== undefined 
          ? deptData.headName 
          : (deptData.manager !== undefined ? deptData.manager : undefined);

        // 1. Update Departments Collection
        const updatedDepts = currentDepts.map(d => {
          const c = String(d.id || d.code || d.deptCode || '').trim().toUpperCase();
          if (c === oldCode) {
            return {
              ...d,
              ...deptData,
              id: newCode,
              code: newCode,
              deptCode: newCode,
              name: deptData.name || deptData.nameTh || d.name,
              nameTh: deptData.nameTh || deptData.name || d.nameTh,
              name_th: deptData.nameTh || deptData.name || d.name_th || d.nameTh,
              nameEn: deptData.nameEn !== undefined ? deptData.nameEn : (d.nameEn || d.name_en || ''),
              name_en: deptData.nameEn !== undefined ? deptData.nameEn : (d.name_en || d.nameEn || ''),
              headUserId: deptData.headUserId !== undefined ? deptData.headUserId : d.headUserId,
              headName: headNameVal !== undefined ? headNameVal : (d.headName || d.manager || ''),
              manager: headNameVal !== undefined ? headNameVal : (d.manager || d.headName || '')
            };
          }
          return d;
        });

    // If code has NOT changed, return simple single-collection update
    if (!isCodeChanged) {
      return {
        departments: updatedDepts,
        masterDepartments: updatedDepts,
        actionLog: [{
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actionType: 'MASTER_DEPT_UPDATED',
          actor: state.currentUser?.name || 'DCC Officer',
          details: `Updated department ${deptId}`,
          timestamp: new Date().toISOString()
        }, ...(state.actionLog || [])]
      };
    }

    // 2. Cascading Relational Propagation Engine (Atomic-like single set call)
    const matchDept = (val) => {
      if (!val) return false;
      if (typeof val === 'string') {
        return val.trim().toUpperCase() === oldCode;
      }
      if (typeof val === 'object') {
        const code = val.id || val.code || val.dept || val.department || val.departmentId;
        return typeof code === 'string' && code.trim().toUpperCase() === oldCode;
      }
      return false;
    };

    const replaceDeptString = (val) => {
      if (!val) return val;
      if (typeof val === 'string') {
        return val.trim().toUpperCase() === oldCode ? newCode : val;
      }
      return val;
    };

    // 2.1 Master Users & Participant lists
    const updateUsersCollection = (usersList) => {
      if (!Array.isArray(usersList)) return usersList;
      return usersList.map(u => {
        let changed = false;
        let updated = { ...u };
        if (matchDept(u.department)) { updated.department = newCode; changed = true; }
        if (matchDept(u.dept)) { updated.dept = newCode; changed = true; }
        if (matchDept(u.primary_department)) { updated.primary_department = newCode; changed = true; }
        if (matchDept(u.dept_code)) { updated.dept_code = newCode; changed = true; }
        if (Array.isArray(u.departments)) {
          updated.departments = u.departments.map(d => replaceDeptString(d));
          changed = true;
        }
        if (Array.isArray(u.secondaryDepartments)) {
          updated.secondaryDepartments = u.secondaryDepartments.map(d => replaceDeptString(d));
          changed = true;
        }
        if (Array.isArray(u.affiliated_departments)) {
          updated.affiliated_departments = u.affiliated_departments.map(d => replaceDeptString(d));
          changed = true;
        }
        if (Array.isArray(u.depts)) {
          updated.depts = u.depts.map(d => replaceDeptString(d));
          changed = true;
        }
        return changed ? updated : u;
      });
    };

    const updatedMasterUsers = updateUsersCollection(state.masterUsers);
    const updatedRequestUsers = updateUsersCollection(state.requestUsers);
    const updatedReviewUsers = updateUsersCollection(state.reviewUsers);
    const updatedApproveUsers = updateUsersCollection(state.approveUsers);

    // 2.2 Current Session User (Prevent privilege loss)
    let updatedCurrentUser = state.currentUser;
    if (state.currentUser) {
      let cuChanged = false;
      let newCu = { ...state.currentUser };
      if (matchDept(newCu.department)) { newCu.department = newCode; cuChanged = true; }
      if (matchDept(newCu.dept)) { newCu.dept = newCode; cuChanged = true; }
      if (matchDept(newCu.primary_department)) { newCu.primary_department = newCode; cuChanged = true; }
      if (matchDept(newCu.dept_code)) { newCu.dept_code = newCode; cuChanged = true; }
      if (Array.isArray(newCu.departments)) {
        newCu.departments = newCu.departments.map(d => replaceDeptString(d));
        cuChanged = true;
      }
      if (Array.isArray(newCu.secondaryDepartments)) {
        newCu.secondaryDepartments = newCu.secondaryDepartments.map(d => replaceDeptString(d));
        cuChanged = true;
      }
      if (Array.isArray(newCu.affiliated_departments)) {
        newCu.affiliated_departments = newCu.affiliated_departments.map(d => replaceDeptString(d));
        cuChanged = true;
      }
      if (Array.isArray(newCu.depts)) {
        newCu.depts = newCu.depts.map(d => replaceDeptString(d));
        cuChanged = true;
      }
      if (cuChanged) {
        updatedCurrentUser = newCu;
      }
    }

    // 2.3 Master Documents
    const updatedDocuments = (state.documents || []).map(doc => {
      let changed = false;
      let updated = { ...doc };

      if (matchDept(doc.department)) { updated.department = newCode; changed = true; }
      if (matchDept(doc.owner_dept)) { updated.owner_dept = newCode; changed = true; }
      if (matchDept(doc.dept)) { updated.dept = newCode; changed = true; }
      if (matchDept(doc.dept_code)) { updated.dept_code = newCode; changed = true; }

      if (Array.isArray(doc.controlledCopies)) {
        updated.controlledCopies = doc.controlledCopies.map(copy => {
          let copyChanged = false;
          let c = { ...copy };
          if (matchDept(c.department)) { c.department = newCode; copyChanged = true; }
          if (matchDept(c.holder_dept)) { c.holder_dept = newCode; copyChanged = true; }
          if (matchDept(c.dept)) { c.dept = newCode; copyChanged = true; }
          return copyChanged ? c : copy;
        });
        changed = true;
      }

      if (Array.isArray(doc.distributions)) {
        updated.distributions = doc.distributions.map(dist => {
          let distChanged = false;
          let d = { ...dist };
          if (matchDept(d.departmentId)) { d.departmentId = newCode; distChanged = true; }
          if (matchDept(d.department)) { d.department = newCode; distChanged = true; }
          if (matchDept(d.dept)) { d.dept = newCode; distChanged = true; }
          return distChanged ? d : dist;
        });
        changed = true;
      }
      if (Array.isArray(doc.distributed_depts)) {
        updated.distributed_depts = doc.distributed_depts.map(d => replaceDeptString(d));
        changed = true;
      }
      if (Array.isArray(doc.distributionTargets)) {
        updated.distributionTargets = doc.distributionTargets.map(d => replaceDeptString(d));
        changed = true;
      }

      if (doc.access_control && Array.isArray(doc.access_control.departments)) {
        updated.access_control = {
          ...doc.access_control,
          departments: doc.access_control.departments.map(d => replaceDeptString(d))
        };
        changed = true;
      }
      if (Array.isArray(doc.accessDepartments)) {
        updated.accessDepartments = doc.accessDepartments.map(d => replaceDeptString(d));
        changed = true;
      }

      return changed ? updated : doc;
    });

    // 2.4 Controlled Copies (Store Collections)
    const updateCopiesCollection = (copiesList) => {
      if (!Array.isArray(copiesList)) return copiesList;
      return copiesList.map(copy => {
        let changed = false;
        let c = { ...copy };
        if (matchDept(c.department)) { c.department = newCode; changed = true; }
        if (matchDept(c.holder_dept)) { c.holder_dept = newCode; changed = true; }
        if (matchDept(c.dept)) { c.dept = newCode; changed = true; }
        return changed ? c : copy;
      });
    };

    const updatedControlledCopyInstances = updateCopiesCollection(state.controlledCopyInstances);
    const updatedDocumentControlledCopies = updateCopiesCollection(state.documentControlledCopies);

    // 2.5 External Documents
    const updatedExternalDocuments = (state.externalDocuments || []).map(doc => {
      let changed = false;
      let updated = { ...doc };

      if (matchDept(doc.department)) { updated.department = newCode; changed = true; }
      if (matchDept(doc.dept)) { updated.dept = newCode; changed = true; }
      if (matchDept(doc.owner_dept)) { updated.owner_dept = newCode; changed = true; }

      if (Array.isArray(doc.distributions)) {
        updated.distributions = doc.distributions.map(dist => {
          let distChanged = false;
          let d = { ...dist };
          if (matchDept(d.departmentId)) { d.departmentId = newCode; distChanged = true; }
          if (matchDept(d.department)) { d.department = newCode; distChanged = true; }
          if (matchDept(d.dept)) { d.dept = newCode; distChanged = true; }
          return distChanged ? d : dist;
        });
        changed = true;
      }
      if (Array.isArray(doc.distributed_depts)) {
        updated.distributed_depts = doc.distributed_depts.map(d => replaceDeptString(d));
        changed = true;
      }
      if (Array.isArray(doc.accessDepartments)) {
        updated.accessDepartments = doc.accessDepartments.map(d => replaceDeptString(d));
        changed = true;
      }
      if (Array.isArray(doc.controlledCopies)) {
        updated.controlledCopies = doc.controlledCopies.map(copy => {
          let copyChanged = false;
          let c = { ...copy };
          if (matchDept(c.department)) { c.department = newCode; copyChanged = true; }
          if (matchDept(c.holder_dept)) { c.holder_dept = newCode; copyChanged = true; }
          if (matchDept(c.dept)) { c.dept = newCode; copyChanged = true; }
          return copyChanged ? c : copy;
        });
        changed = true;
      }

      return changed ? updated : doc;
    });

    // 2.6 DAR Workflow Records
    const updateDarsCollection = (darList) => {
      if (!Array.isArray(darList)) return darList;
      return darList.map(dar => {
        let changed = false;
        let updated = { ...dar };

        if (matchDept(dar.department)) { updated.department = newCode; changed = true; }
        if (matchDept(dar.requestingDepartment)) { updated.requestingDepartment = newCode; changed = true; }
        if (matchDept(dar.requesting_dept)) { updated.requesting_dept = newCode; changed = true; }
        if (matchDept(dar.dept)) { updated.dept = newCode; changed = true; }
        if (matchDept(dar.owner_dept)) { updated.owner_dept = newCode; changed = true; }
        if (matchDept(dar.targetDept)) { updated.targetDept = newCode; changed = true; }

        if (Array.isArray(dar.targetDepartments)) {
          updated.targetDepartments = dar.targetDepartments.map(d => replaceDeptString(d));
          changed = true;
        }
        if (Array.isArray(dar.distributions)) {
          updated.distributions = dar.distributions.map(dist => {
            let distChanged = false;
            let d = { ...dist };
            if (matchDept(d.departmentId)) { d.departmentId = newCode; distChanged = true; }
            if (matchDept(d.department)) { d.department = newCode; distChanged = true; }
            if (matchDept(d.dept)) { d.dept = newCode; distChanged = true; }
            return distChanged ? d : dist;
          });
          changed = true;
        }
        if (Array.isArray(dar.distributed_depts)) {
          updated.distributed_depts = dar.distributed_depts.map(d => replaceDeptString(d));
          changed = true;
        }

        return changed ? updated : dar;
      });
    };

    const updatedDars = updateDarsCollection(state.dars);
    const updatedDarRequests = updateDarsCollection(state.darRequests);

    // 2.7 Tasks Collections
    const updateTasksCollection = (taskList) => {
      if (!Array.isArray(taskList)) return taskList;
      return taskList.map(task => {
        let changed = false;
        let updated = { ...task };

        if (matchDept(task.department)) { updated.department = newCode; changed = true; }
        if (matchDept(task.dept)) { updated.dept = newCode; changed = true; }
        if (matchDept(task.assignedToDept)) { updated.assignedToDept = newCode; changed = true; }
        if (matchDept(task.assignee_dept)) { updated.assignee_dept = newCode; changed = true; }
        if (matchDept(task.target_department)) { updated.target_department = newCode; changed = true; }
        if (matchDept(task.targetDepartment)) { updated.targetDepartment = newCode; changed = true; }
        if (matchDept(task.currentHandlerDepartment)) { updated.currentHandlerDepartment = newCode; changed = true; }
        if (matchDept(task.requester_dept)) { updated.requester_dept = newCode; changed = true; }
        if (matchDept(task.owner_dept)) { updated.owner_dept = newCode; changed = true; }

        return changed ? updated : task;
      });
    };

    const updatedTasks = updateTasksCollection(state.tasks);
    const updatedPeriodicReviewTasks = updateTasksCollection(state.periodicReviewTasks);

    // 2.8 Approval Matrix
    const updateMatrixCollection = (matrixList) => {
      if (!Array.isArray(matrixList)) return matrixList;
      return matrixList.map(entry => {
        let changed = false;
        let updated = { ...entry };
        if (matchDept(entry.departmentId)) { updated.departmentId = newCode; changed = true; }
        if (matchDept(entry.department)) { updated.department = newCode; changed = true; }
        if (matchDept(entry.dept)) { updated.dept = newCode; changed = true; }
        return changed ? updated : entry;
      });
    };

    const updatedApprovalMatrix = updateMatrixCollection(state.approvalMatrix);
    const updatedApprovalMatrixAlt = updateMatrixCollection(state.approval_matrix);

    // 2.9 Distribution Locations & Copy Requests
    const updatedLocations = (state.distributionLocations || []).map(loc => {
      let changed = false;
      let updated = { ...loc };
      if (matchDept(loc.departmentId)) { updated.departmentId = newCode; changed = true; }
      if (matchDept(loc.department)) { updated.department = newCode; changed = true; }
      if (matchDept(loc.dept)) { updated.dept = newCode; changed = true; }
      return changed ? updated : loc;
    });

    const updatedCopyRequests = (state.copyRequests || []).map(req => {
      let changed = false;
      let updated = { ...req };
      if (matchDept(req.department)) { updated.department = newCode; changed = true; }
      if (matchDept(req.dept)) { updated.dept = newCode; changed = true; }
      if (matchDept(req.requesting_dept)) { updated.requesting_dept = newCode; changed = true; }
      return changed ? updated : req;
    });

    // Return all cascaded collections in a single atomic state batch
    return {
      departments: updatedDepts,
      masterDepartments: updatedDepts,
      masterUsers: updatedMasterUsers,
      requestUsers: updatedRequestUsers,
      reviewUsers: updatedReviewUsers,
      approveUsers: updatedApproveUsers,
      currentUser: updatedCurrentUser,
      documents: updatedDocuments,
      controlledCopyInstances: updatedControlledCopyInstances,
      documentControlledCopies: updatedDocumentControlledCopies,
      externalDocuments: updatedExternalDocuments,
      dars: updatedDars,
      darRequests: updatedDarRequests,
      tasks: updatedTasks,
      periodicReviewTasks: updatedPeriodicReviewTasks,
      approvalMatrix: updatedApprovalMatrix,
      approval_matrix: updatedApprovalMatrixAlt,
      distributionLocations: updatedLocations,
      copyRequests: updatedCopyRequests,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_DEPT_UPDATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Updated department ${oldCode} to ${newCode} with cascading relational propagation`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  });
  return true;
} catch (err) {
  console.error('updateDepartment error:', err);
  throw err;
}
},

  // --- 2.1 Department Dependency Pre-check & Deactivation ---
  checkDepartmentDependencies: (targetDeptId) => {
    const state = get();
    const allDocs = state.documents || [];
    const activeDocs = allDocs.filter(d => 
      (d.department === targetDeptId || d.owner_dept === targetDeptId) && 
      (d.status === 'EFFECTIVE' || d.status === 'ACTIVE')
    );

    const instances = state.controlledCopyInstances || [];
    const docCopies = state.documentControlledCopies || [];
    const copyList = instances.length > 0 ? instances : docCopies;
    const activeCopies = copyList.filter(c => 
      (c.holder_dept === targetDeptId || c.department === targetDeptId) && 
      (c.status === 'ACTIVE' || c.status === 'RECEIVED')
    );

    const allTasks = state.tasks || [];
    const pendingTasks = allTasks.filter(t => 
      (t.target_department === targetDeptId || t.department === targetDeptId || t.dept === targetDeptId) && 
      t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    );

    const allUsers = state.masterUsers || [];
    const affectedUsers = [];
    allUsers.forEach(u => {
      const primary = u.primary_department || u.department || u.dept;
      const affiliated = Array.isArray(u.affiliated_departments) ? u.affiliated_departments : (Array.isArray(u.depts) ? u.depts : []);
      const uniqueDepts = Array.from(new Set([primary, ...affiliated].filter(Boolean)));
      if (uniqueDepts.includes(targetDeptId)) {
        const remainingDepts = uniqueDepts.filter(d => d !== targetDeptId);
        const isSingleDept = remainingDepts.length === 0;
        affectedUsers.push({
          ...u,
          isSingleDept,
          remainingDepts,
          currentPrimary: primary,
          nextPrimary: isSingleDept ? null : (primary === targetDeptId ? remainingDepts[0] : primary)
        });
      }
    });

    const isCoreDept = SYSTEM_CORE_DEPTS.includes(targetDeptId);

    return {
      targetDeptId,
      isCoreDept,
      activeDocsCount: activeDocs.length,
      activeCopiesCount: activeCopies.length,
      pendingTasksCount: pendingTasks.length,
      affectedUsers,
      activeDocs,
      activeCopies,
      pendingTasks
    };
  },

  deactivateDepartment: (targetDeptId, fallbackDepartmentId) => {
    const state = get();

    // Guardrail 1: System Core Departments Guard
    if (SYSTEM_CORE_DEPTS.includes(targetDeptId)) {
      throw new Error(`แผนก "${targetDeptId}" เป็นแผนกหลักของระบบควบคุมคุณภาพและเอกสาร (System Core Department) ไม่อนุญาตให้ระงับการใช้งาน`);
    }

    // Guardrail 2: Dependency Pre-check (Active Docs, Active Copies, Pending Tasks)
    const check = get().checkDepartmentDependencies(targetDeptId);
    if (check.activeDocsCount > 0 || check.activeCopiesCount > 0 || check.pendingTasksCount > 0) {
      const reasons = [];
      if (check.activeDocsCount > 0) reasons.push(`เอกสารแม่บทที่มีผลบังคับใช้ ${check.activeDocsCount} รายการ`);
      if (check.activeCopiesCount > 0) reasons.push(`สำเนาควบคุมถือครองจริง ${check.activeCopiesCount} เล่ม`);
      if (check.pendingTasksCount > 0) reasons.push(`งานคงค้างในระบบ ${check.pendingTasksCount} รายการ`);
      throw new Error(`ไม่สามารถระงับแผนก "${targetDeptId}" ได้เนื่องจากมีภาระผูกพันคงค้าง: ${reasons.join(', ')}`);
    }

    // Guardrail 3: Single-dept Users Fallback Validation
    const singleDeptUsers = check.affectedUsers.filter(u => u.isSingleDept);
    if (singleDeptUsers.length > 0) {
      if (!fallbackDepartmentId) {
        throw new Error(`กรุณาระบุแผนกใหม่ (Fallback Department) สำหรับย้ายพนักงานที่ไม่มีแผนกรอง (${singleDeptUsers.length} คน)`);
      }
      if (fallbackDepartmentId === targetDeptId) {
        throw new Error(`แผนกใหม่ต้องไม่ใช่แผนกที่กำลังจะถูกระงับการใช้งาน`);
      }
      const availableDepts = state.departments || state.masterDepartments || [];
      const targetFallback = availableDepts.find(d => d.id === fallbackDepartmentId);
      if (!targetFallback || targetFallback.status === 'INACTIVE') {
        throw new Error(`แผนกปลายทาง "${fallbackDepartmentId}" ไม่พร้อมใช้งานหรือถูกระงับอยู่`);
      }
    }

    // User Re-assignment Handling
    const migrateUser = (u) => {
      const primary = u.primary_department || u.department || u.dept;
      const affiliated = Array.isArray(u.affiliated_departments) ? u.affiliated_departments : (Array.isArray(u.depts) ? u.depts : []);
      const uniqueDepts = Array.from(new Set([primary, ...affiliated].filter(Boolean)));
      if (!uniqueDepts.includes(targetDeptId)) return u;

      const remainingDepts = uniqueDepts.filter(d => d !== targetDeptId);
      if (remainingDepts.length > 0) {
        // Multi-dept user: remove targetDeptId, shift primary if needed
        const newPrimary = (primary === targetDeptId) ? remainingDepts[0] : primary;
        return {
          ...u,
          primary_department: newPrimary,
          department: newPrimary,
          dept: newPrimary,
          affiliated_departments: remainingDepts,
          depts: remainingDepts
        };
      } else {
        // Single-dept user: re-assign to fallbackDepartmentId
        return {
          ...u,
          primary_department: fallbackDepartmentId,
          department: fallbackDepartmentId,
          dept: fallbackDepartmentId,
          affiliated_departments: [fallbackDepartmentId],
          depts: [fallbackDepartmentId]
        };
      }
    };

    const updatedMasterUsers = (state.masterUsers || []).map(migrateUser);
    const updatedRequestUsers = (state.requestUsers || []).map(migrateUser);
    const updatedReviewUsers = (state.reviewUsers || []).map(migrateUser);
    const updatedApproveUsers = (state.approveUsers || []).map(migrateUser);
    const updatedCurrentUser = state.currentUser ? migrateUser(state.currentUser) : state.currentUser;

    // Department Status & Lead Cleanup
    const currentDepts = state.departments || state.masterDepartments || [];
    const updatedDepts = currentDepts.map(d => {
      if (d.id === targetDeptId) {
        return {
          ...d,
          status: 'INACTIVE',
          headUserId: '',
          headName: 'ยังไม่ได้กำหนด (ระงับการใช้งานแล้ว)'
        };
      }
      return d;
    });

    set({
      masterUsers: updatedMasterUsers,
      requestUsers: updatedRequestUsers,
      reviewUsers: updatedReviewUsers,
      approveUsers: updatedApproveUsers,
      currentUser: updatedCurrentUser,
      departments: updatedDepts,
      masterDepartments: updatedDepts,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_DEPT_DEACTIVATED',
        actor: state.currentUser?.name || 'DCC Admin',
        details: `Deactivated department ${targetDeptId}. Reassigned ${check.affectedUsers.length} user(s). Fallback: ${fallbackDepartmentId || 'N/A'}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    });

    return {
      success: true,
      targetDeptId,
      migratedUsersCount: check.affectedUsers.length
    };
  },

  reactivateDepartment: (deptId) => set((state) => {
    const currentDepts = state.departments || state.masterDepartments || [];
    const updatedDepts = currentDepts.map(d => {
      if (d.id === deptId) {
        return {
          ...d,
          status: 'ACTIVE',
          headName: d.headName === 'ยังไม่ได้กำหนด (ระงับการใช้งานแล้ว)' ? 'ยังไม่ได้กำหนด' : d.headName
        };
      }
      return d;
    });

    return {
      departments: updatedDepts,
      masterDepartments: updatedDepts,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_DEPT_REACTIVATED',
        actor: state.currentUser?.name || 'DCC Admin',
        details: `Reactivated department ${deptId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  toggleDepartmentStatus: (deptId) => {
    const state = get();
    const currentDepts = state.departments || state.masterDepartments || [];
    const targetDept = currentDepts.find(d => d.id === deptId);
    if (!targetDept) return;

    if (targetDept.status === 'INACTIVE') {
      get().reactivateDepartment(deptId);
    } else {
      // Find a safe fallback if possible, else throws if single-dept exists
      const availableFallback = currentDepts.find(d => d.id !== deptId && d.status !== 'INACTIVE');
      get().deactivateDepartment(deptId, availableFallback?.id);
    }
  },

  // --- 3. Document Type Actions ---
  addDocumentType: (typeData) => set((state) => {
    const code = typeData.code.toUpperCase().trim();
    const currentTypes = state.documentTypes || [];
    if (currentTypes.some(t => t.code === code || t.id === code)) {
      throw new Error(`รหัสประเภทเอกสาร "${code}" มีอยู่ในระบบแล้ว`);
    }

    const category = typeData.category || (code === 'ED' ? 'EXTERNAL' : 'INTERNAL');
    const allowDar = typeData.allowDar !== undefined ? Boolean(typeData.allowDar) : (category !== 'EXTERNAL' && code !== 'ED');

    const newType = {
      id: code,
      code: code,
      name: typeData.name || code,
      nameTh: typeData.nameTh || typeData.name || code,
      namingPattern: typeData.namingPattern || `${code}-{Dept}-{##}`,
      is_form_type: Boolean(typeData.is_form_type),
      reviewCycleMonths: Number(typeData.reviewCycleMonths) || 12,
      retentionPeriodYears: Number(typeData.retentionPeriodYears) || 3,
      category,
      allowDar,
      status: typeData.status || 'ACTIVE',
      description: typeData.description || ''
    };

    const updatedTypes = [...currentTypes, newType];
    return {
      documentTypes: updatedTypes,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_DOCTYPE_CREATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Created document type ${newType.code} (${newType.nameTh})`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  updateDocumentType: (typeId, typeData) => set((state) => {
    const currentTypes = state.documentTypes || [];
    const updatedTypes = currentTypes.map(t => {
      if (t.id === typeId || t.code === typeId) {
        const category = typeData.category !== undefined ? typeData.category : (t.category || (t.code === 'ED' ? 'EXTERNAL' : 'INTERNAL'));
        const allowDar = typeData.allowDar !== undefined ? Boolean(typeData.allowDar) : (t.allowDar !== undefined ? t.allowDar : (category !== 'EXTERNAL' && t.code !== 'ED'));
        return {
          ...t,
          ...typeData,
          category,
          allowDar,
          reviewCycleMonths: typeData.reviewCycleMonths !== undefined ? Number(typeData.reviewCycleMonths) : t.reviewCycleMonths,
          retentionPeriodYears: typeData.retentionPeriodYears !== undefined ? Number(typeData.retentionPeriodYears) : t.retentionPeriodYears,
          is_form_type: typeData.is_form_type !== undefined ? Boolean(typeData.is_form_type) : t.is_form_type
        };
      }
      return t;
    });

    return {
      documentTypes: updatedTypes,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_DOCTYPE_UPDATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Updated document type ${typeId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  toggleDocumentTypeStatus: (typeId) => set((state) => {
    const currentTypes = state.documentTypes || [];
    const updatedTypes = currentTypes.map(t => {
      if (t.id === typeId || t.code === typeId) {
        return { ...t, status: t.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' };
      }
      return t;
    });

    return {
      documentTypes: updatedTypes
    };
  }),

  // --- 4. Point-of-Use Locations (Matrix) Actions ---
  addDistributionLocation: (locData) => set((state) => {
    const newLoc = {
      id: locData.id || `${locData.departmentId}-${Date.now().toString().slice(-4)}`,
      departmentId: locData.departmentId,
      name: cleanLocationName(locData.name),
      code: locData.code || locData.id,
      isMasterOffice: Boolean(locData.isMasterOffice),
      description: locData.description || '',
      status: locData.status || 'ACTIVE'
    };

    const currentLocs = state.distributionLocations || [];
    const updatedLocs = [...currentLocs, newLoc];

    return {
      distributionLocations: updatedLocs,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_LOCATION_CREATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Created station ${newLoc.name} (${newLoc.id}) in ${newLoc.departmentId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  updateDistributionLocation: (locId, locData) => set((state) => {
    const currentLocs = state.distributionLocations || [];
    const updatedLocs = currentLocs.map(l => {
      if (l.id === locId) {
        return {
          ...l,
          ...locData,
          isMasterOffice: locData.isMasterOffice !== undefined ? Boolean(locData.isMasterOffice) : l.isMasterOffice
        };
      }
      return l;
    });

    return {
      distributionLocations: updatedLocs,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_LOCATION_UPDATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Updated station ${locId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  toggleLocationStatus: (locId) => set((state) => {
    const currentLocs = state.distributionLocations || [];
    const updatedLocs = currentLocs.map(l => {
      if (l.id === locId) {
        return { ...l, status: l.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' };
      }
      return l;
    });

    return {
      distributionLocations: updatedLocs
    };
  }),

  deleteDistributionLocation: (locId) => {
    const state = get();
    const allCopies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies || []);
    
    // Check if any copy is actively using or pending receipt/recall at this location
    const activeAttachedCopy = allCopies.find(c => 
      (c.location_id === locId || c.locationId === locId || c.location === locId) &&
      (c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE' || c.status === 'PENDING_ISSUE' || c.status === 'DISPATCHED_PENDING_RECEIPT')
    );

    if (activeAttachedCopy) {
      throw new Error(`ไม่สามารถลบจุดใช้งานนี้ได้ เนื่องจากมีสำเนาควบคุม (${activeAttachedCopy.doc_code || activeAttachedCopy.docTitle} - Copy ${activeAttachedCopy.copy_no || activeAttachedCopy.ccNumber}) ใช้งานอยู่จริงหน้างาน (กรุณาเปลี่ยนสถานะเป็น Inactive แทน)`);
    }

    set(state => ({
      distributionLocations: (state.distributionLocations || []).filter(l => l.id !== locId),
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_LOCATION_DELETED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Deleted point-of-use station ${locId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    }));
    return true;
  },

  // --- 5. Settings Actions ---
  updateSignatureSettings: (settings) => set((state) => ({
    signatureSettings: { ...(state.signatureSettings || DEFAULT_SIGNATURE_SETTINGS), ...settings },
    actionLog: [{
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actionType: 'MASTER_SIGNATURE_SETTINGS_UPDATED',
      actor: state.currentUser?.name || 'DCC Officer',
      details: 'Updated e-signature security policies',
      timestamp: new Date().toISOString()
    }, ...(state.actionLog || [])]
  })),

  updateSlaSettings: (settings) => set((state) => ({
    slaSettings: { ...(state.slaSettings || DEFAULT_SLA_SETTINGS), ...settings },
    actionLog: [{
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actionType: 'MASTER_SLA_SETTINGS_UPDATED',
      actor: state.currentUser?.name || 'DCC Officer',
      details: 'Updated workflow SLA thresholds',
      timestamp: new Date().toISOString()
    }, ...(state.actionLog || [])]
  })),

  updateApprovalMatrix: (matrix) => set((state) => ({
    approvalMatrix: matrix,
    approval_matrix: matrix,
    actionLog: [{
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actionType: 'MASTER_APPROVAL_MATRIX_UPDATED',
      actor: state.currentUser?.name || 'DCC Officer',
      details: 'Updated approval routing matrix by document type',
      timestamp: new Date().toISOString()
    }, ...(state.actionLog || [])]
  })),

  updateApprovalMatrixEntry: (docType, entryData) => set((state) => {
    const current = state.approvalMatrix || DEFAULT_APPROVAL_MATRIX;
    const exists = current.some(item => (item.docType || item.doc_type) === docType);
    let updated;
    if (exists) {
      updated = current.map(item => {
        if ((item.docType || item.doc_type) === docType) {
          const minReq = entryData.minRequesterLevel ?? entryData.min_requester_level ?? item.minRequesterLevel ?? item.min_requester_level ?? 1;
          const reqRev = entryData.requiredReviewerLevel ?? entryData.required_reviewer_level ?? item.requiredReviewerLevel ?? item.required_reviewer_level ?? 4;
          const reqApp = entryData.requiredApproverLevel ?? entryData.required_approver_level ?? item.requiredApproverLevel ?? item.required_approver_level ?? 6;
          const reqAck = Boolean(entryData.requireAckDefault ?? entryData.require_ack_default ?? item.requireAckDefault ?? item.require_ack_default ?? false);
          
          return {
            ...item,
            ...entryData,
            docType,
            doc_type: docType,
            minRequesterLevel: minReq,
            min_requester_level: minReq,
            requiredReviewerLevel: reqRev,
            required_reviewer_level: reqRev,
            requiredApproverLevel: reqApp,
            required_approver_level: reqApp,
            requireAckDefault: reqAck,
            require_ack_default: reqAck
          };
        }
        return item;
      });
    } else {
      const minReq = entryData.minRequesterLevel ?? entryData.min_requester_level ?? 1;
      const reqRev = entryData.requiredReviewerLevel ?? entryData.required_reviewer_level ?? 4;
      const reqApp = entryData.requiredApproverLevel ?? entryData.required_approver_level ?? 5;
      const reqAck = Boolean(entryData.requireAckDefault ?? entryData.require_ack_default ?? false);
      const newEntry = {
        docType,
        doc_type: docType,
        ...entryData,
        minRequesterLevel: minReq,
        min_requester_level: minReq,
        requiredReviewerLevel: reqRev,
        required_reviewer_level: reqRev,
        requiredApproverLevel: reqApp,
        required_approver_level: reqApp,
        requireAckDefault: reqAck,
        require_ack_default: reqAck
      };
      updated = [...current, newEntry];
    }

    return {
      approvalMatrix: updated,
      approval_matrix: updated,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_APPROVAL_MATRIX_ENTRY_UPDATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Updated approval routing matrix entry for document type ${docType}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  // Expose Setters for Demo Data Loader
  setTasks: (tasks) => set({ tasks }),
  setDars: (dars) => set({ dars }),
  setTimeline: (timeline) => set({ timeline })
}), {
  name: 'qms-storage-uat-v7',
  version: 4,
  migrate: (persistedState, version) => {
    if (!version || version < 4) {
      if (persistedState.masterUsers && Array.isArray(persistedState.masterUsers)) {
        persistedState.masterUsers = persistedState.masterUsers.map(u => ({
          ...u,
          permissions: (u.permissions && u.permissions.length > 0) ? u.permissions : ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'],
          canCreateDar: u.canCreateDar ?? true,
          canAccessTasks: u.canAccessTasks ?? true,
          canViewRegister: u.canViewRegister ?? true,
          isWorkflowUser: u.isWorkflowUser ?? true
        }));
        const userRoleObj = (u) => ({
          id: u.id,
          empId: u.empId || u.id,
          name: u.name,
          depts: u.affiliated_departments || u.depts,
          affiliated_departments: u.affiliated_departments || u.depts,
          department: u.primary_department || u.department,
          primary_department: u.primary_department || u.department,
          level: u.approval_level || u.level,
          approval_level: u.approval_level || u.level
        });
        persistedState.requestUsers = persistedState.masterUsers.map(userRoleObj);
        persistedState.reviewUsers = [...persistedState.requestUsers];
        persistedState.approveUsers = [...persistedState.requestUsers];
      }
      if (persistedState.currentUser) {
        persistedState.currentUser = {
          ...persistedState.currentUser,
          permissions: (persistedState.currentUser.permissions && persistedState.currentUser.permissions.length > 0) ? persistedState.currentUser.permissions : ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'],
          canCreateDar: persistedState.currentUser.canCreateDar ?? true,
          canAccessTasks: persistedState.currentUser.canAccessTasks ?? true,
          canViewRegister: persistedState.currentUser.canViewRegister ?? true,
          isWorkflowUser: persistedState.currentUser.isWorkflowUser ?? true
        };
      }
    }
    if (!version || version < 3) {
      // Force refresh of master users, departments, and default active user to Thanawut (EMP-001)
      persistedState.masterUsers = MASTER_DATA_USER;
      persistedState.masterDepartments = MASTER_DEPARTMENTS;
      persistedState.departments = MASTER_DEPARTMENTS;
      persistedState.currentUser = { ...MASTER_DATA_USER[0] };
    }
    if (version < 2 || !version) {
      // Clean slate migration: purge all mock transactions while preserving master data
      persistedState.tasks = [];
      persistedState.dars = [];
      persistedState.darRequests = [];
      persistedState.timeline = [];
      persistedState.actionLog = [];
      persistedState.notifications = [];
      persistedState.documents = [];
      persistedState.externalDocuments = [];
      persistedState.documentControlledCopies = [];
      persistedState.controlledCopyInstances = [];
      persistedState.controlledCopyAuditTrail = [];
      persistedState.periodicReviewSchedules = [];
      persistedState.periodicReviewTasks = [];
      persistedState.periodicReviewRecords = [];
      persistedState.distributionLogs = [];
      persistedState.acknowledgments = [];
      persistedState.darHistory = [];
    }

    // Eradicate legacy 'DCC' department code and migrate task departments to owner department
    if (persistedState.tasks && Array.isArray(persistedState.tasks)) {
      const persistedDars = persistedState.dars || [];
      const persistedDocs = persistedState.documents || [];
      persistedState.tasks = persistedState.tasks.map(t => {
        if (!t) return t;
        let updated = { ...t };
        if (updated.target_department === 'DCC') updated.target_department = 'DC';
        if (updated.targetDepartment === 'DCC') updated.targetDepartment = 'DC';
        if (updated.department === 'DCC') updated.department = 'DC';
        if (updated.dept === 'DCC') updated.dept = 'DC';
        if (updated.assignedToDept === 'DCC') updated.assignedToDept = 'DC';
        if (updated.destinationDept === 'DCC') updated.destinationDept = 'DC';
        if (updated.currentHandlerDepartment === 'DCC') updated.currentHandlerDepartment = 'DC';

        // Data Migration: Ensure task.department is strictly bound to document/DAR owner department
        const docCode = updated.doc_code || updated.docCode || updated.document_code || '';
        const docId = updated.docId || updated.doc_id;
        const matchedDoc = persistedDocs.find(d => 
          (docId && String(d.id) === String(docId)) ||
          (docCode && (d.title === docCode || d.document_code === docCode || d.code === docCode))
        );
        const matchedDar = persistedDars.find(d => String(d.id) === String(updated.darId));
        let ownerDept = matchedDar?.department || matchedDoc?.department;
        if (!ownerDept) {
          if (String(docCode).includes('-PD-') || String(updated.title).includes('-PD-') || String(updated.darId).includes('-PD-')) {
            ownerDept = 'PD';
          }
        }
        if (ownerDept) {
          const cleanDept = ownerDept === 'DCC' ? 'DC' : ownerDept;
          updated.department = cleanDept;
          updated.target_department = cleanDept;
          updated.owner_dept = cleanDept;
          updated.currentHandlerDepartment = cleanDept;
        }
        return updated;
      });
    }
    if (persistedState.currentUser) {
      if (persistedState.currentUser.department === 'DCC') persistedState.currentUser.department = 'DC';
      if (persistedState.currentUser.primary_department === 'DCC') persistedState.currentUser.primary_department = 'DC';
      if (persistedState.currentUser.dept === 'DCC') persistedState.currentUser.dept = 'DC';
      if (Array.isArray(persistedState.currentUser.affiliated_departments)) {
        persistedState.currentUser.affiliated_departments = Array.from(new Set(persistedState.currentUser.affiliated_departments.map(d => d === 'DCC' ? 'DC' : d)));
      }
      if (Array.isArray(persistedState.currentUser.depts)) {
        persistedState.currentUser.depts = Array.from(new Set(persistedState.currentUser.depts.map(d => d === 'DCC' ? 'DC' : d)));
      }
    }

    return persistedState;
  },
  onRehydrateStorage: () => (state) => {
    if (state && state.tasks && Array.isArray(state.tasks)) {
      let hasChange = false;
      const safeDars = state.dars || [];
      const safeDocs = state.documents || [];
      const cleaned = state.tasks.map(t => {
        if (!t) return t;
        let updated = { ...t };
        let changed = false;
        if (
          t.target_department === 'DCC' ||
          t.targetDepartment === 'DCC' ||
          t.department === 'DCC' ||
          t.dept === 'DCC' ||
          t.assignedToDept === 'DCC' ||
          t.destinationDept === 'DCC' ||
          t.currentHandlerDepartment === 'DCC'
        ) {
          changed = true;
          updated.target_department = t.target_department === 'DCC' ? 'DC' : t.target_department;
          updated.targetDepartment = t.targetDepartment === 'DCC' ? 'DC' : t.targetDepartment;
          updated.department = t.department === 'DCC' ? 'DC' : t.department;
          updated.dept = t.dept === 'DCC' ? 'DC' : t.dept;
          updated.assignedToDept = t.assignedToDept === 'DCC' ? 'DC' : t.assignedToDept;
          updated.destinationDept = t.destinationDept === 'DCC' ? 'DC' : t.destinationDept;
          updated.currentHandlerDepartment = t.currentHandlerDepartment === 'DCC' ? 'DC' : t.currentHandlerDepartment;
        }

        // Fix task department scoping (e.g. PD tasks like DAR-2026-002 / SOP-PD-01)
        const docCode = updated.doc_code || updated.docCode || updated.document_code || '';
        const docId = updated.docId || updated.doc_id;
        const matchedDoc = safeDocs.find(d => 
          (docId && String(d.id) === String(docId)) ||
          (docCode && (d.title === docCode || d.document_code === docCode || d.code === docCode))
        );
        const matchedDar = safeDars.find(d => String(d.id) === String(updated.darId));
        let ownerDept = matchedDar?.department || matchedDoc?.department;
        if (!ownerDept) {
          if (String(docCode).includes('-PD-') || String(updated.title).includes('-PD-') || String(updated.darId).includes('-PD-')) {
            ownerDept = 'PD';
          }
        }
        
        const isDccTask = isDccExclusiveTask(updated) || isDccOperationalTask(updated);
        const isReceipt = isReceiptTask(updated);
        if (isDccTask) {
          if (updated.department !== 'DC' || updated.target_department !== 'DC' || updated.targetRole !== 'DCC_ADMIN') {
            changed = true;
            updated.department = 'DC';
            updated.target_department = 'DC';
            updated.targetDepartment = 'DC';
            updated.targetRole = 'DCC_ADMIN';
            updated.target_role = 'DCC_ADMIN';
            updated.assignedToRole = 'DCC_ADMIN';
          }
        } else if (isReceipt) {
          const safeCopies = state.controlledCopyInstances || state.documentControlledCopies || [];
          const targetCopyId = String(updated.copy_id || updated.copyId || updated.instanceId || '');
          const matchedCopy = safeCopies.find(i => String(i.id) === targetCopyId);

          const cleanRecipientDept = resolveReceiptTaskDepartment(updated, matchedCopy);

          if (
            updated.department !== cleanRecipientDept ||
            updated.target_department !== cleanRecipientDept ||
            updated.destinationDept !== cleanRecipientDept ||
            updated.assignedToDept !== cleanRecipientDept
          ) {
            changed = true;
            updated.department = cleanRecipientDept;
            updated.target_department = cleanRecipientDept;
            updated.targetDepartment = cleanRecipientDept;
            updated.destinationDept = cleanRecipientDept;
            updated.destination_dept = cleanRecipientDept;
            updated.recipientDepartment = cleanRecipientDept;
            updated.recipient_department = cleanRecipientDept;
            updated.currentHandlerDepartment = cleanRecipientDept;
            updated.assignedToDept = cleanRecipientDept;
            updated.dept_code = cleanRecipientDept;
          }
        } else if (ownerDept) {
          const cleanDept = ownerDept === 'DCC' ? 'DC' : ownerDept;
          if (updated.department !== cleanDept || updated.target_department !== cleanDept) {
            changed = true;
            updated.department = cleanDept;
            updated.target_department = cleanDept;
            updated.owner_dept = cleanDept;
            updated.currentHandlerDepartment = cleanDept;
          }
        }

        if (changed) hasChange = true;
        return updated;
      });
      if (hasChange) {
        useStore.setState({ tasks: cleaned });
      }
    }
  },
  partialize: (state) => ({
    currentUser: state.currentUser,
    masterUsers: state.masterUsers,
    requestUsers: state.requestUsers,
    reviewUsers: state.reviewUsers,
    approveUsers: state.approveUsers,
    masterDepartments: state.masterDepartments,
    departments: state.departments,
    documentTypes: state.documentTypes,
    distributionLocations: state.distributionLocations,
    signatureSettings: state.signatureSettings,
    slaSettings: state.slaSettings,
    approvalMatrix: state.approvalMatrix,
    approval_matrix: state.approval_matrix,
    tasks: state.tasks,
    notifications: state.notifications,
    dars: state.dars,
    timeline: state.timeline,
    documents: state.documents,
    externalDocuments: state.externalDocuments,
    externalRequests: state.externalRequests,
    documentControlledCopies: state.documentControlledCopies,
    controlledCopyInstances: state.controlledCopyInstances,
    controlledCopyAuditTrail: state.controlledCopyAuditTrail,
    copyDispositionRecords: state.copyDispositionRecords,
    dispositionHistory: state.dispositionHistory,
    actionLog: state.actionLog,
    periodicReviewSchedules: state.periodicReviewSchedules,
    periodicReviewTasks: state.periodicReviewTasks,
    periodicReviewRecords: state.periodicReviewRecords
  })
}));

// Auto-cleanup legacy local storage cache and heal stale tasks in storage
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.removeItem('qms-storage-uat-v6');
  } catch {
    // Ignore in non-browser or sandbox environments
  }

  try {
    const storageKey = 'qms-storage-uat-v7';
    const persisted = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (persisted && persisted.state && Array.isArray(persisted.state.tasks)) {
      let migrated = false;
      persisted.state.tasks = persisted.state.tasks.map(t => {
        if (isReceiptTask(t)) {
          const loc = t.location || t.locationName || t.location_name || '';
          const text = `${t.title || ''} ${t.description || ''} ${loc}`;
          if (text.includes('EN Office') || text.includes('EN-') || text.includes('(EN)')) {
            if (t.department !== 'EN') {
              migrated = true;
              return {
                ...t,
                department: 'EN',
                target_department: 'EN',
                targetDepartment: 'EN',
                destinationDept: 'EN',
                destination_dept: 'EN',
                recipientDepartment: 'EN',
                recipient_department: 'EN',
                currentHandlerDepartment: 'EN',
                assignedToDept: 'EN',
                dept_code: 'EN'
              };
            }
          }
        }
        return t;
      });
      if (migrated) {
        localStorage.setItem(storageKey, JSON.stringify(persisted));
      }
    }

    // Self-healing migration for ISO 9001 Clause 7.5.3: Ensure external document historical snapshots are immutable
    if (persisted && persisted.state && Array.isArray(persisted.state.externalDocuments)) {
      let extDocsMigrated = false;
      const seedData = getMockQaSeedData();

      // Ensure ED-QA-01-R00 (Rev.00) exists and is preserved with distinct historical metadata
      const r00Index = persisted.state.externalDocuments.findIndex(d => d.id === 'ED-QA-01-R00');
      const seedR00 = seedData.externalDocuments.find(d => d.id === 'ED-QA-01-R00');
      if (r00Index === -1 && seedR00) {
        persisted.state.externalDocuments.unshift({ ...seedR00 });
        extDocsMigrated = true;
      } else if (r00Index >= 0 && seedR00) {
        const r00Doc = persisted.state.externalDocuments[r00Index];
        if (r00Doc.rev !== '00' || r00Doc.edrNumber !== 'EDR-2026-0001' || r00Doc.changeReason !== seedR00.changeReason) {
          persisted.state.externalDocuments[r00Index] = {
            ...r00Doc,
            rev: '00',
            revision: 'Rev.00',
            status: 'SUPERSEDED',
            is_superseded: true,
            requestId: 'EDR-2026-0001',
            edrNumber: 'EDR-2026-0001',
            changeReason: seedR00.changeReason
          };
          extDocsMigrated = true;
        }
      }

      // Ensure ED-QA-01 (Rev.01) retains its own distinct changeReason and EDR number
      const r01Index = persisted.state.externalDocuments.findIndex(d => d.id === 'ED-QA-01');
      const seedR01 = seedData.externalDocuments.find(d => d.id === 'ED-QA-01');
      if (r01Index >= 0 && seedR01) {
        const r01Doc = persisted.state.externalDocuments[r01Index];
        if (r01Doc.rev === '01' && (!r01Doc.changeReason || r01Doc.changeReason.includes('EDR-2026-0005') || (seedR00 && r01Doc.changeReason === seedR00.changeReason))) {
          persisted.state.externalDocuments[r01Index] = {
            ...r01Doc,
            edrNumber: 'EDR-2026-0002',
            requestId: 'EDR-2026-0002',
            changeReason: seedR01.changeReason
          };
          extDocsMigrated = true;
        }
      }

      if (extDocsMigrated) {
        localStorage.setItem(storageKey, JSON.stringify(persisted));
      }
    }
  } catch {
    // Ignore in non-browser or sandbox environments
  }
}

export default useStore;

