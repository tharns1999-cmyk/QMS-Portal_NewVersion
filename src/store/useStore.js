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
  formatDocumentRunningNumber, 
  generateDocumentCode,
  calculateNextDocumentSequence,
  calculateNextExternalDocSequence
} from '../services/MasterDataService';
import { getMockQaSeedData } from '../data/mockQaWorkflowSeed';
import { hasDocumentAccess, canUserAccessDocument } from '../utils/accessControl';

export { canUserAccessDocument, hasDocumentAccess };

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
  { id: 'U003', empId: 'EMP-003', name: 'กัลยาณี พลไกร', fullName: 'กัลยาณี พลไกร', email: 'kalyanee.p@company.com', position: 'Production Assistant Manager', level: 5, approval_level: 5, role: 'DEPT_ADMIN', isDcc: false, isQmr: false, depts: ['PD', 'QA'], department: 'PD', dept: 'PD', primary_department: 'PD', affiliated_departments: ['PD', 'QA'], status: 'ACTIVE', pin: '123456', failedPinAttempts: 0, isLocked: false, lastPinChangedAt: '2026-01-01T00:00:00.000Z', signatureType: 'TYPOGRAPHIC', signatureStyle: 'CLASSIC_CALLIGRAPHY', signatureInitials: 'KYN-PD', hasRegisteredSignature: true, certificateSerial: 'CERT-2026-PD003', permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'], canCreateDar: true, canAccessTasks: true, canViewRegister: true, isWorkflowUser: true },
  { id: 'U004', empId: 'EMP-004', name: 'คุณเรย์', fullName: 'คุณเรย์', email: 'ray.gm@company.com', position: 'General Manager / QMR', level: 6, approval_level: 6, role: 'DEPT_ADMIN', isDcc: false, isQmr: true, depts: ['MGMT'], department: 'MGMT', dept: 'MGMT', primary_department: 'MGMT', affiliated_departments: ['MGMT'], status: 'ACTIVE', pin: '123456', failedPinAttempts: 0, isLocked: false, lastPinChangedAt: '2026-01-01T00:00:00.000Z', signatureType: 'TYPOGRAPHIC', signatureStyle: 'FORMAL_SERIF', signatureInitials: 'RAY-GM', hasRegisteredSignature: true, certificateSerial: 'CERT-2026-GM004', permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER', 'QMR_ACCESS'], canCreateDar: true, canAccessTasks: true, canViewRegister: true, isWorkflowUser: true },
  { id: 'U005', empId: 'EMP-005', name: 'บีม', fullName: 'บีม', email: 'beam.qa@company.com', position: 'QAQC Supervisor', level: 4, approval_level: 4, role: 'DEPT_ADMIN', isDcc: false, isQmr: false, depts: ['QA'], department: 'QA', dept: 'QA', primary_department: 'QA', affiliated_departments: ['QA'], status: 'ACTIVE', pin: '123456', failedPinAttempts: 0, isLocked: false, lastPinChangedAt: '2026-01-01T00:00:00.000Z', signatureType: 'TYPOGRAPHIC', signatureStyle: 'BRUSH_SCRIPT', signatureInitials: 'BM-QA', hasRegisteredSignature: true, certificateSerial: 'CERT-2026-QA005', permissions: ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'], canCreateDar: true, canAccessTasks: true, canViewRegister: true, isWorkflowUser: true },
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
export const SYSTEM_CORE_DEPTS = ['DC', 'QA', 'QA/QC'];

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
    department: 'QA',
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
    title: 'ทบทวนคำร้อง (Review DAR) - MN-QA-001',
    assigneeId: 'U003',
    status: 'PENDING',
    createdAt: '2026-07-01T08:00:00Z',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Due Soon (in 2 days)
  },
  {
    id: 'TASK-MOCK-2',
    type: 'APPROVE',
    darId: 'DAR-MOCK-2',
    title: 'อนุมัติคำร้อง (Approve DAR) - SOP-WH-002',
    assigneeId: 'U004',
    status: 'PENDING',
    createdAt: '2026-06-25T08:00:00Z',
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Overdue (5 days ago)
  },
  {
    id: 'TASK-MOCK-3',
    type: 'DCC_ACTION',
    darId: 'DAR-MOCK-3',
    title: 'ดำเนินการอัปเดตระบบ (DCC Action) - WI-PD-010',
    assigneeId: 'U001',
    status: 'PENDING',
    createdAt: '2026-07-08T08:00:00Z',
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // Normal
  },
  {
    id: 'TASK-MOCK-4',
    type: 'ACKNOWLEDGE',
    docId: 'DOC-MOCK-1', // SOP-PD-001
    title: 'รับทราบการประกาศใช้เอกสารใหม่ - SOP-PD-001',
    assigneeId: 'U001',
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
      authorized_depts: ['WH', 'PD', 'QA'],
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

export const cleanupDccTasks = (tasks, instances, documents, dars = []) => {
  const safeInstances = instances || [];
  const safeDocs = documents || [];
  const safeDars = dars || [];

  const hasPendingDist = safeInstances.some(i => 
    i.status === 'PENDING_RECEIPT' || 
    i.status === 'DISPATCHED_PENDING_RECEIPT' || 
    i.status === 'PENDING_ISSUE' || 
    i.status === 'PENDING_PRINT'
  );

  return (tasks || []).filter(t => {
    // 1. Immediately drop tasks already completed/resolved
    if (t.status === 'COMPLETED' || t.status === 'RESOLVED' || t.is_completed === true) {
      return false;
    }

    // 2. Distribution Tasks (DCC_DISTRIBUTE, DCC_ISSUE)
    if (t.type === 'DCC_DISTRIBUTE' || t.type === 'DCC_ISSUE' || t.taskType === 'DCC_DISTRIBUTE') {
      const doc = safeDocs.find(d => d.darId === t.darId || d.id === t.docId || d.title === t.doc_code);
      if (doc) {
        return safeInstances.some(i => 
          (String(i.doc_id || i.docId) === String(doc.id) || i.doc_code === doc.title || i.docTitle === doc.title) && 
          (i.status === 'PENDING_RECEIPT' || i.status === 'PENDING_ISSUE' || i.status === 'PENDING_PRINT' || i.status === 'DISPATCHED_PENDING_RECEIPT')
        );
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
      t.taskType === 'RECALL'
    ) {
      const targetDocId = String(t.docId || t.doc_id || '');
      let targetDocCode = t.doc_code || t.docTitle || t.document_code || '';
      let targetRev = t.doc_version || t.rev || t.revision || '';

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

      if (relevantCopies.length === 0) {
        // If no copies exist at all for this doc, check if global has any pending recalls
        return safeInstances.some(i => i.status === 'PENDING_RECALL' || i.status === 'OBSOLETE_PENDING_RECALL');
      }

      // If ANY copy is still PENDING_RECALL or OBSOLETE_PENDING_RECALL, or active under obsolete/superseded document, keep the task!
      const hasUnrecalledCopy = relevantCopies.some(i => 
        i.status === 'PENDING_RECALL' ||
        i.status === 'OBSOLETE_PENDING_RECALL' ||
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
  externalAuditTrail: [],
  notifications: [],
  actionLog: [],
  copyRequests: [],
  documentControlledCopies: [],
  controlledCopyInstances: [],
  controlledCopyAuditTrail: [],
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

  // DEV TOOL: Factory Reset Transactions to Clean Slate (Preserving Master Data 100%)
  resetTransactionDataToCleanSlate: () => {
    set({
      dars: [],
      darRequests: [],
      tasks: [],
      timeline: [],
      documents: [],
      externalDocuments: [],
      externalAuditTrail: [],
      notifications: [],
      actionLog: [],
      copyRequests: [],
      documentControlledCopies: [],
      controlledCopyInstances: [],
      controlledCopyAuditTrail: [],
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
          persisted.state.externalAuditTrail = [];
          persisted.state.notifications = [];
          persisted.state.actionLog = [];
          persisted.state.copyRequests = [];
          persisted.state.documentControlledCopies = [];
          persisted.state.controlledCopyInstances = [];
          persisted.state.controlledCopyAuditTrail = [];
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
    const activeDept = baseUser.primary_department || baseUser.department || depts[0] || 'DC';
    const permissions = (baseUser.permissions && baseUser.permissions.length > 0)
      ? baseUser.permissions
      : ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'];

    return { 
      currentUser: { 
        ...baseUser, 
        department: activeDept, 
        primary_department: activeDept, 
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

  addNotification: (userId, title, message, link, relatedTaskId = null, category = null) => set(state => {
    const cat = category || (title.includes('DAR') ? 'DAR' : (title.includes('สำเนา') || title.includes('ทดแทน')) ? 'CONTROLLED_COPY' : 'SYSTEM');
    const nowIso = new Date().toISOString();
    return {
      notifications: [{
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId,
        user_id: userId,
        title,
        message,
        description: message,
        category: cat,
        isRead: false,
        read: false,
        link,
        timestamp: nowIso,
        createdAt: nowIso,
        created_at: nowIso,
        relatedTaskId
      }, ...(state.notifications || [])]
    };
  }),
  markNotificationAsReadByTaskId: (taskId) => set(state => ({
    notifications: (state.notifications || []).map(n => String(n.relatedTaskId) === String(taskId) ? { ...n, isRead: true, read: true } : n)
  })),
  markNotificationAsRead: (id) => set(state => ({
    notifications: (state.notifications || []).map(n => String(n.id) === String(id) ? { ...n, isRead: true, read: true } : n)
  })),
  markAsRead: (id) => set(state => ({
    notifications: (state.notifications || []).map(n => String(n.id) === String(id) ? { ...n, isRead: true, read: true } : n)
  })),
  markAllNotificationsAsRead: (userId) => set(state => ({
    notifications: (state.notifications || []).map(n => !userId || n.userId === userId || n.user_id === userId ? { ...n, isRead: true, read: true } : n)
  })),
  markAllAsRead: (userId) => set(state => ({
    notifications: (state.notifications || []).map(n => !userId || n.userId === userId || n.user_id === userId ? { ...n, isRead: true, read: true } : n)
  })),
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
    const dept = doc.department || doc.dept || (state.currentUser ? (state.currentUser.department || 'QA') : 'QA');
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

    if (doc.reviewerId) {
      initialStatus = 'PENDING_EXT_REVIEW';
      newTasks.push({
        id: `extt-${Date.now()}-rev`,
        referenceType: 'EXTERNAL_DOC',
        referenceId: newId,
        title: `${edCode}: ${doc.title}`,
        type: 'EXT_REVIEW',
        assigneeId: doc.reviewerId,
        status: 'PENDING',
        extAction: 'REGISTER'
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: doc.reviewerId, title: 'งานใหม่รอการตรวจสอบ', message: `เอกสารภายนอก "${edCode} - ${doc.title}" รอการตรวจสอบจากคุณ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
    } else if (doc.approverId) {
      initialStatus = 'PENDING_EXT_APPROVAL';
      newTasks.push({
        id: `extt-${Date.now()}-app`,
        referenceType: 'EXTERNAL_DOC',
        referenceId: newId,
        title: `${edCode}: ${doc.title}`,
        type: 'EXT_APPROVAL',
        assigneeId: doc.approverId,
        status: 'PENDING',
        extAction: 'REGISTER'
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: doc.approverId, title: 'งานใหม่รอการอนุมัติ', message: `เอกสารภายนอก "${edCode} - ${doc.title}" รอการอนุมัติจากคุณ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
    }

    if (initialStatus === 'ACTIVE' && doc.acknowledgees && doc.acknowledgees.length > 0) {
      doc.acknowledgees.forEach(uid => {
        newTasks.push({
          id: `extt-${Date.now()}-ack-${uid}`,
          referenceType: 'EXTERNAL_DOC',
          referenceId: newId,
          title: `${edCode}: ${doc.title}`,
          type: 'Ack',
          assigneeId: uid,
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
          doc_version: doc.rev || doc.sourceVersion || '01',
          rev: doc.rev || doc.sourceVersion || '01',
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
        type: 'DCC_DISTRIBUTE',
        taskType: 'DCC_ISSUE_CONTROLLED_COPIES',
        title: `จัดพิมพ์และส่งมอบสำเนาควบคุมเอกสารภายนอก: ${edCode} (${stations.length} จุด)`,
        description: `มีคำขอสำเนาควบคุมสำหรับเอกสารภายนอก ${edCode} จำนวน ${stations.length} เล่ม กรุณาจัดพิมพ์และแจกจ่าย`,
        docId: newId,
        externalDocId: newId,
        doc_code: edCode,
        doc_version: doc.rev || doc.sourceVersion || '01',
        assigneeId: 'U001',
        assignedToRole: 'DCC_ADMIN',
        status: 'PENDING',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: nowIso
      });
    }

    const newExternalDoc = {
      ...doc,
      id: newId,
      doc_code: edCode,
      docNo: edCode,
      edCode,
      department: dept,
      status: initialStatus,
      ownerId: state.currentUser ? state.currentUser.id : 'U001',
      rev: doc.rev || '01',
      distributions: stations,
      physical_distribution: stations,
      is_physical_copy: Boolean(doc.is_physical_copy || doc.isPhysicalCopy || stations.length > 0),
      reviewCycleMonths,
      nextReviewDate,
      createdAt: new Date().toISOString()
    };

    const prevCopies = state.documentControlledCopies || state.controlledCopyInstances || [];
    const finalCopies = [...prevCopies, ...newCreatedCopies];

    return {
      externalDocuments: [newExternalDoc, ...state.externalDocuments],
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

    const currentRevNum = parseInt(oldDoc.rev, 10) || 0;
    const newRevNum = currentRevNum + 1;
    const newRevStr = newRevNum < 10 ? `0${newRevNum}` : `${newRevNum}`;

    const reviewCycleMonths = Number(updates.reviewCycleMonths || oldDoc.reviewCycleMonths) || 12;
    const effectiveDate = updates.effectiveDate || oldDoc.effectiveDate || new Date().toISOString().split('T')[0];
    const effDateObj = new Date(effectiveDate);
    effDateObj.setMonth(effDateObj.getMonth() + reviewCycleMonths);
    const nextReviewDate = updates.nextReviewDate || effDateObj.toISOString().split('T')[0];

    const edCode = oldDoc.edCode || oldDoc.doc_code || oldDoc.docNo || id;
    const newId = `EXT-${Date.now()}`;
    const newDoc = {
      ...oldDoc,
      ...updates,
      id: newId,
      edCode,
      doc_code: edCode,
      docNo: edCode,
      rev: newRevStr,
      status: 'PENDING_EXT_REVIEW',
      previousDocId: oldDoc.id,
      reviewCycleMonths,
      nextReviewDate,
      updatedAt: new Date().toISOString()
    };

    const newTasks = [...state.tasks];
    const newNotifications = [...state.notifications];

    if (newDoc.reviewerId) {
      newTasks.push({
        id: `extt-${Date.now()}-rev`,
        referenceType: 'EXTERNAL_DOC',
        referenceId: newId,
        title: `${edCode}: ${newDoc.title} (Rev.${newRevStr})`,
        type: 'EXT_REVIEW',
        assigneeId: newDoc.reviewerId,
        status: 'PENDING',
        extAction: 'UPDATE'
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: newDoc.reviewerId, title: 'งานใหม่รอการตรวจสอบ', message: `คำขออัปเดตเอกสารภายนอก "${edCode} - ${newDoc.title}" รอการตรวจสอบจากคุณ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
    } else {
      newDoc.status = 'PENDING_EXT_APPROVAL';
      newTasks.push({
        id: `extt-${Date.now()}-app`,
        referenceType: 'EXTERNAL_DOC',
        referenceId: newId,
        title: `${edCode}: ${newDoc.title} (Rev.${newRevStr})`,
        type: 'EXT_APPROVAL',
        assigneeId: newDoc.approverId,
        status: 'PENDING',
        extAction: 'UPDATE'
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: newDoc.approverId, title: 'งานใหม่รอการอนุมัติ', message: `คำขออัปเดตเอกสารภายนอก "${edCode} - ${newDoc.title}" รอการอนุมัติจากคุณ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
    }

    return {
      externalDocuments: [newDoc, ...state.externalDocuments],
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
    let newStatus = 'PENDING_EXT_REVIEW';

    // Store obsolete request details inside the document temporarily
    const updatedDoc = {
      ...oldDoc,
      status: newStatus,
      obsoleteReason: payload.reason,
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
        status: 'PENDING',
        extAction: 'OBSOLETE'
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: payload.reviewerId, title: 'ขอยกเลิกเอกสารภายนอก', message: `รอตรวจสอบการยกเลิก "${oldDoc.title}"`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
    } else {
      updatedDoc.status = 'PENDING_EXT_APPROVAL';
      newTasks.push({
        id: `extt-${Date.now()}-app`,
        referenceType: 'EXTERNAL_DOC',
        referenceId: id,
        title: oldDoc.title,
        type: 'EXT_APPROVAL',
        assigneeId: payload.approverId,
        status: 'PENDING',
        extAction: 'OBSOLETE'
      });
      newNotifications.push({ id: Date.now() + Math.random(), userId: payload.approverId, title: 'ขอยกเลิกเอกสารภายนอก', message: `รออนุมัติการยกเลิก "${oldDoc.title}"`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
    }

    return {
      externalDocuments: state.externalDocuments.map(d => d.id === id ? updatedDoc : d),
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

  processExternalTask: (taskId, action, comment) => set((state) => {
    const taskIndex = state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return state;

    const task = state.tasks[taskIndex];
    const docIndex = state.externalDocuments.findIndex(d => d.id === task.referenceId);
    if (docIndex === -1) return state;

    const doc = state.externalDocuments[docIndex];
    const isUpdate = task.extAction === 'UPDATE';
    const isObsolete = task.extAction === 'OBSOLETE';

    let newDocStatus = doc.status;
    let newTasks = state.tasks.filter(t => t.id !== taskId);
    let newNotifications = [...state.notifications];
    let updatedDocs = [...state.externalDocuments];
    let currentCopies = state.documentControlledCopies || state.controlledCopyInstances || [];
    let newCreatedCopies = [];

    // APPROVE Action
    if (action === 'APPROVE') {
      if (task.type === 'EXT_REVIEW') {
        const approverId = isObsolete ? doc.obsoleteApproverId : doc.approverId;
        if (approverId) {
          newDocStatus = 'PENDING_EXT_APPROVAL';
          const newTaskId = `extt-${Date.now()}-app`;
          newTasks.push({
            id: newTaskId,
            referenceType: 'EXTERNAL_DOC',
            referenceId: doc.id,
            title: doc.title,
            type: 'EXT_APPROVAL',
            assigneeId: approverId,
            status: 'PENDING',
            extAction: task.extAction
          });
          newNotifications.push({ id: Date.now() + Math.random(), userId: approverId, title: 'งานใหม่รอการอนุมัติ', message: `เอกสารภายนอก "${doc.title}" รอการอนุมัติจากคุณ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
        } else {
          // If no approver, it's fully approved
          newDocStatus = isObsolete ? 'OBSOLETE_ARCHIVED' : 'ACTIVE';
        }
      } else if (task.type === 'EXT_APPROVAL') {
        newDocStatus = isObsolete ? 'OBSOLETE_ARCHIVED' : 'ACTIVE';
      }

      // If fully approved and it's an UPDATE, obsolete the previous document
      if (newDocStatus === 'ACTIVE' && isUpdate && doc.previousDocId) {
        updatedDocs = updatedDocs.map(d => d.id === doc.previousDocId ? { ...d, status: 'OBSOLETE_ARCHIVED' } : d);
      }

      // Handle Physical Controlled Copies on Final Approval
      if (newDocStatus === 'ACTIVE') {
        const stations = doc.distributions || doc.physical_distribution || [];
        const docCode = doc.edCode || doc.doc_code || doc.title;
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
            type: 'DCC_DISTRIBUTE',
            taskType: 'DCC_ISSUE_CONTROLLED_COPIES',
            title: `จัดพิมพ์และส่งมอบสำเนาควบคุมเอกสารภายนอก: ${docCode} (${stations.length} จุด)`,
            description: `มีคำขอสำเนาควบคุมสำหรับเอกสารภายนอก ${docCode} จำนวน ${stations.length} เล่ม กรุณาจัดพิมพ์และแจกจ่าย`,
            docId: doc.id,
            externalDocId: doc.id,
            doc_code: docCode,
            doc_version: docVer,
            assigneeId: 'U001',
            assignedToRole: 'DCC_ADMIN',
            status: 'PENDING',
            priority: 'HIGH',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            createdAt: nowIso
          });
        }

        // Automatic Recall for Previous Revision (when updated)
        if (isUpdate && doc.previousDocId) {
          const prevDocId = String(doc.previousDocId);
          const prevActiveCopies = currentCopies.filter(c => 
            (String(c.doc_id || c.docId || c.external_doc_id || c.externalDocId) === prevDocId) &&
            (c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE' || c.status === 'DISPATCHED_PENDING_RECEIPT')
          );

          if (prevActiveCopies.length > 0) {
            currentCopies = currentCopies.map(c => {
              if (String(c.doc_id || c.docId || c.external_doc_id || c.externalDocId) === prevDocId && (c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE')) {
                return { ...c, status: 'PENDING_RECALL' };
              }
              return c;
            });

            const oldDoc = state.externalDocuments.find(d => String(d.id) === prevDocId);
            const oldDocCode = oldDoc?.edCode || oldDoc?.doc_code || docCode;
            newTasks.push({
              id: `task-dcc-recall-ext-${prevDocId}-${Date.now()}`,
              type: 'DCC_RECALL_WITH_CHECKLIST',
              taskType: 'DCC_RECALL_WITH_CHECKLIST',
              title: `เรียกคืนและทำลายเอกสารภายนอกฉบับเดิม: ${oldDocCode} (Rev.${oldDoc?.rev || '01'}) จำนวน ${prevActiveCopies.length} จุด`,
              description: `เอกสารภายนอก ${docCode} ได้ประกาศใช้เวอร์ชันใหม่แล้ว กรุณาเรียกคืนฉบับเดิมตาม Checklist`,
              docId: prevDocId,
              externalDocId: prevDocId,
              doc_code: oldDocCode,
              doc_version: oldDoc?.rev || '01',
              assigneeId: 'U001',
              assignedToRole: 'DCC_ADMIN',
              status: 'PENDING',
              priority: 'HIGH',
              dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              createdAt: nowIso
            });
          }
        }
      } else if (newDocStatus === 'OBSOLETE_ARCHIVED' && isObsolete) {
        // Automatic Recall for Obsoleted External Document
        const targetDocId = String(doc.id);
        const activeDocCopies = currentCopies.filter(c => 
          (String(c.doc_id || c.docId || c.external_doc_id || c.externalDocId) === targetDocId) &&
          (c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE' || c.status === 'DISPATCHED_PENDING_RECEIPT')
        );

        if (activeDocCopies.length > 0) {
          currentCopies = currentCopies.map(c => {
            if (String(c.doc_id || c.docId || c.external_doc_id || c.externalDocId) === targetDocId && (c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE')) {
              return { ...c, status: 'PENDING_RECALL' };
            }
            return c;
          });

          const docCode = doc.edCode || doc.doc_code || doc.title;
          newTasks.push({
            id: `task-dcc-recall-ext-${targetDocId}-${Date.now()}`,
            type: 'DCC_RECALL_WITH_CHECKLIST',
            taskType: 'DCC_RECALL_WITH_CHECKLIST',
            title: `เรียกคืนและทำลายเอกสารภายนอกที่ถูกยกเลิก: ${docCode} จำนวน ${activeDocCopies.length} จุด`,
            description: `เอกสารภายนอก ${docCode} ถูกยกเลิกการใช้งานแล้ว กรุณาเรียกคืนฉบับกระดาษตาม Checklist`,
            docId: targetDocId,
            externalDocId: targetDocId,
            doc_code: docCode,
            doc_version: doc.rev || '01',
            assigneeId: 'U001',
            assignedToRole: 'DCC_ADMIN',
            status: 'PENDING',
            priority: 'HIGH',
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          });
        }
      }

      // REJECT Action
    } else if (action === 'REJECT') {
      if (isObsolete) {
        // Obsolete rejected -> Return to ACTIVE
        newDocStatus = 'ACTIVE';
      } else {
        // Register/Update rejected -> DRAFT/REJECTED
        newDocStatus = 'REJECTED';
      }
      newTasks = newTasks.filter(t => t.referenceId !== doc.id);
      newNotifications.push({ id: Date.now() + Math.random(), userId: doc.ownerId, title: 'คำขอถูกปฏิเสธ', message: `คำขอสำหรับ "${doc.title}" ถูกปฏิเสธ: ${comment}`, isRead: false, link: '/external-docs', timestamp: new Date().toISOString() });
    }

    updatedDocs = updatedDocs.map(d => d.id === doc.id ? { ...d, status: newDocStatus } : d);
    const finalCopiesState = (action === 'APPROVE') ? [...currentCopies, ...newCreatedCopies] : (state.documentControlledCopies || state.controlledCopyInstances || []);

    return {
      tasks: newTasks,
      notifications: newNotifications,
      externalDocuments: updatedDocs,
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
      const dueDateStr = new Date(today.getTime() + 3*24*60*60*1000).toISOString().split('T')[0];
      const cancelDateStr = new Date(today.getTime() + 4*24*60*60*1000).toISOString().split('T')[0];

      let newTasks = [...state.tasks];
      let newNotifications = [...state.notifications];
      let realStatus = dar.isDraft ? 'DRAFT' : 'UNDER_REVIEW';
      
      // Generate Reviewer Task
      if (!dar.isDraft) {
        const resolveReviewer = (reqId, dept, masters, reviewers) => {
          const reqUser = masters.find(u => u.id === reqId);
          if (!reqUser) return null;
          const candidates = reviewers.filter(u => u.department === dept && u.level > reqUser.level);
          if (candidates.length === 0) return null;
          candidates.sort((a,b) => a.level - b.level);
          return { id: candidates[0].id, level: candidates[0].level, dept: candidates[0].department };
        };
        
        let reviewerObj = resolveReviewer(newDar.requesterId, newDar.department, state.masterUsers, state.reviewUsers);
        
        if (reviewerObj) {
          const newTaskId = `t-${Date.now()}`;
          newTasks.push({
            id: newTaskId,
            referenceType: 'INTERNAL_DAR', referenceId: newDar.id,
            darId: newDar.id, title: newDar.title, type: 'Review',
            assigneeId: reviewerObj.id,
            currentHandlerDepartment: reviewerObj.dept,
            currentHandlerLevel: reviewerObj.level,
            dueDate: dueDateStr, cancelDate: cancelDateStr, status: 'NORMAL'
          });
          newNotifications.push({ id: Date.now() + Math.random(), userId: reviewerObj.id, title: 'งานใหม่รอการตรวจสอบ', message: `DAR "${newDar.title}" รอการตรวจสอบจากคุณ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
        } else {
           realStatus = 'PENDING_APPROVAL';
           // Not fully replicating the approver fallback here, assuming standard DARs will find a reviewer in demo
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
    // Generate new ID DARXX-MM-YY
    const date = new Date();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    // Find highest running number for this month
    const prefix = `DAR`;
    const suffix = `-${mm}-${yy}`;

    const existingDarsThisMonth = state.dars.filter(d => d.id.endsWith(suffix));
    let nextRun = 1;
    if (existingDarsThisMonth.length > 0) {
      const runNums = existingDarsThisMonth.map(d => parseInt(d.id.replace(prefix, '').split('-')[0]));
      nextRun = Math.max(...runNums) + 1;
    }
    const newDarId = `${prefix}${String(nextRun).padStart(2, '0')}${suffix}`;

    // Ensure distributions array is present
    const distributions = dar.distributions || [];

    const newDar = { ...dar, id: newDarId, distributions };

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
    // Criteria: candidate.level > requester.level (Nearest Higher)
    let reviewerObj = null;
    if (!newDar.manualReviewerId) {
      reviewerObj = resolveReviewer(newDar.requesterId, newDar.department, state.masterUsers, state.reviewUsers);
    } else {
      const u = state.masterUsers.find(m => m.id === newDar.manualReviewerId);
      if (u) reviewerObj = { id: u.id, level: u.level, dept: newDar.department };
    }

    const today = new Date();
    today.setDate(today.getDate() + state.mockDateOffset);
    const dueDateStr = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const cancelDateStr = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let newTasks = [...state.tasks];
    let newNotifications = [...state.notifications];
    let realStatus = dar.isDraft ? 'DRAFT' : 'UNDER_REVIEW';

    if (!dar.isDraft) {
      if (reviewerObj) {
        const newTaskId = `t-${Date.now()}`;
        newTasks.push({
          id: newTaskId,
          referenceType: 'INTERNAL_DAR', referenceId: newDar.id,
          darId: newDar.id,
          title: newDar.title,
          type: 'Review',
          assigneeId: reviewerObj.id,
          currentHandlerDepartment: reviewerObj.dept,
          currentHandlerLevel: reviewerObj.level,
          dueDate: dueDateStr,
          cancelDate: cancelDateStr,
          status: 'NORMAL'
        });
        newNotifications.push({ id: Date.now() + Math.random(), userId: reviewerObj.id, title: 'งานใหม่รอการตรวจสอบ', message: `DAR "${newDar.title}" รอการตรวจสอบจากคุณ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
      } else {
        // Skip Review -> PENDING_APPROVAL
        realStatus = 'PENDING_APPROVAL';
        let approverObj = null;
        if (!newDar.manualApproverId) {
          approverObj = resolveApprover(newDar.requesterId, newDar.requesterId, newDar.department, state.masterUsers, state.approveUsers);
        } else {
          const u = state.masterUsers.find(m => m.id === newDar.manualApproverId);
          if (u) approverObj = { id: u.id, level: u.level, dept: newDar.department };
        }

        if (approverObj) {
          newTasks.push({
            id: `t-${Date.now()}`, referenceType: 'INTERNAL_DAR', referenceId: newDar.id, darId: newDar.id, title: newDar.title, type: 'Approve', assigneeId: approverObj.id,
            currentHandlerDepartment: approverObj.dept, currentHandlerLevel: approverObj.level,
            dueDate: dueDateStr, cancelDate: cancelDateStr, status: 'NORMAL'
          });
          newNotifications.push({ id: Date.now() + Math.random(), userId: approverObj.id, title: 'งานใหม่รอการอนุมัติ', message: `DAR "${newDar.title}" รอการอนุมัติจากคุณ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
        } else {
          realStatus = dar.ackRequirement === 'REQUIRED' ? 'WAITING_ACKNOWLEDGEMENT' : 'APPROVED_WAITING_EFFECTIVE';
          if (realStatus === 'WAITING_ACKNOWLEDGEMENT' && dar.ackUserIds?.length > 0) {
            dar.ackUserIds.forEach(uid => {
              newTasks.push({
                id: `t-${Date.now()}-${uid}`, referenceType: 'INTERNAL_DAR', referenceId: newDar.id, darId: newDar.id, title: newDar.title, type: 'Ack', assigneeId: uid,
                dueDate: dueDateStr, cancelDate: cancelDateStr, status: 'NORMAL'
              });
              newNotifications.push({ id: Date.now() + Math.random(), userId: uid, title: 'โปรดรับทราบเอกสาร', message: `DAR "${newDar.title}" บังคับใช้แล้ว โปรดรับทราบ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString() });
            });
          }
        }
      }
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
        actionType: 'DAR_SUBMIT',
        actor: state.currentUser.name,
        details: `Submitted DAR ${newDar.id}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  // Universal DAR Draft Save & Upsert Action
  saveDarDraft: (draftData) => set((state) => {
    const list = state.dars || [];
    const targetId = draftData.id || draftData.dar_no || draftData.darNo;
    
    // Check if draft already exists
    const existingIndex = list.findIndex(
      (d) => d.id === targetId || (targetId && (d.dar_no === targetId || d.darNo === targetId))
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
        status: 'DRAFT',
        isDraft: true,
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      updatedDars = [...list];
      updatedDars[existingIndex] = updatedDraft;
    } else {
      // Insert new draft with auto-generated ID if not provided
      if (!savedId) {
        const date = new Date();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yy = String(date.getFullYear()).slice(-2);
        const prefix = `DAR`;
        const suffix = `-${mm}-${yy}`;
        const existingThisMonth = list.filter(d => d.id?.endsWith(suffix));
        let nextRun = 1;
        if (existingThisMonth.length > 0) {
          const runNums = existingThisMonth.map(d => parseInt(String(d.id).replace(prefix, '').split('-')[0]) || 0);
          nextRun = Math.max(...runNums) + 1;
        }
        savedId = `${prefix}${String(nextRun).padStart(2, '0')}${suffix}`;
      }

      const newDraft = {
        ...draftData,
        id: savedId,
        dar_no: draftData.dar_no || draftData.darNo || savedId,
        status: 'DRAFT',
        isDraft: true,
        requesterId: draftData.requesterId || draftData.requester_id || state.currentUser?.id,
        requester_name: draftData.requester_name || state.currentUser?.name,
        department: draftData.department || draftData.owner_dept || state.currentUser?.department || 'QA',
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
      darRequests: updatedDars
    };
  }),

  removeTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== taskId)
  })),

  processWorkflow: (taskId, action, comment) => {
    let newlyCompletedDar = null;
    set((state) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return state;

    const dar = state.dars.find(d => d.id === task.darId);
    if (!dar) return state;

    const newTasks = state.tasks.filter(t => t.id !== taskId);
    let newStatus = dar.status;

    const today = new Date();
    today.setDate(today.getDate() + state.mockDateOffset);
    const dueDateStr = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const cancelDateStr = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let newNotifications = state.notifications.map(n => n.relatedTaskId === taskId ? { ...n, isRead: true } : n);

    if (task.type === 'Review') {
      if (action === 'APPROVE') {
        newStatus = 'PENDING_APPROVAL';

        // Find Approver (Rule: candidate.level > reviewer.level, Nearest Higher)
        let approverObj = null;
        if (!dar.manualApproverId) {
          approverObj = resolveApprover(dar.requesterId, task.assigneeId, dar.department, state.masterUsers, state.approveUsers);
        } else {
          const u = state.masterUsers.find(m => m.id === dar.manualApproverId);
          if (u) approverObj = { id: u.id, level: u.level, dept: dar.department };
        }

        if (approverObj) {
          const newTaskId = `t-${Date.now()}`;
          newTasks.push({
            id: newTaskId, referenceType: 'INTERNAL_DAR', referenceId: dar.id, darId: dar.id, title: dar.title, type: 'Approve', assigneeId: approverObj.id,
            currentHandlerDepartment: approverObj.dept, currentHandlerLevel: approverObj.level,
            dueDate: dueDateStr, cancelDate: cancelDateStr, status: 'NORMAL'
          });
          newNotifications.push({ id: Date.now() + Math.random(), userId: approverObj.id, title: 'งานใหม่รอการอนุมัติ', message: `DAR "${dar.title}" รอการอนุมัติจากคุณ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
        } else {
          newStatus = dar.ackRequirement === 'REQUIRED' ? 'WAITING_ACKNOWLEDGEMENT' : 'APPROVED_WAITING_EFFECTIVE';
          if (newStatus === 'WAITING_ACKNOWLEDGEMENT' && dar.ackUserIds?.length > 0) {
            dar.ackUserIds.forEach(uid => {
              const newTaskId = `t-${Date.now()}-${uid}`;
              newTasks.push({
                id: newTaskId, referenceType: 'INTERNAL_DAR', referenceId: dar.id, darId: dar.id, title: dar.title, type: 'Ack', assigneeId: uid,
                dueDate: dueDateStr, cancelDate: cancelDateStr, status: 'NORMAL'
              });
              newNotifications.push({ id: Date.now() + Math.random(), userId: uid, title: 'โปรดรับทราบเอกสาร', message: `DAR "${dar.title}" บังคับใช้แล้ว โปรดรับทราบ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
            });
          }
        }
      } else if (action === 'RETURN') {
        newStatus = 'RETURNED_FOR_REVISION';
        const newTaskId = `t-${Date.now()}`;
        newTasks.push({
          id: newTaskId, referenceType: 'INTERNAL_DAR', referenceId: dar.id, darId: dar.id, title: dar.title, type: 'Revise', assigneeId: dar.requesterId,
          dueDate: dueDateStr, cancelDate: cancelDateStr, status: 'NORMAL'
        });
        newNotifications.push({ id: Date.now() + Math.random(), userId: dar.requesterId, title: 'DAR ถูกส่งกลับแก้ไข', message: `DAR "${dar.title}" ถูกส่งกลับให้คุณแก้ไข`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
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

        if (newStatus === 'WAITING_ACKNOWLEDGEMENT' && dar.ackUserIds?.length > 0) {
          dar.ackUserIds.forEach(uid => {
            const newTaskId = `t-${Date.now()}-${uid}`;
            newTasks.push({
              id: newTaskId, referenceType: 'INTERNAL_DAR', referenceId: dar.id, darId: dar.id, title: dar.title, type: 'Ack', assigneeId: uid,
              dueDate: dueDateStr, cancelDate: cancelDateStr, status: 'NORMAL'
            });
            newNotifications.push({ id: Date.now() + Math.random(), userId: uid, title: 'โปรดรับทราบเอกสาร', message: `DAR "${dar.title}" บังคับใช้แล้ว โปรดรับทราบ`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
          });
        }
      } else if (action === 'RETURN') {
        newStatus = 'RETURNED_FOR_REVISION';
        const newTaskId = `t-${Date.now()}`;
        newTasks.push({
          id: newTaskId, referenceType: 'INTERNAL_DAR', referenceId: dar.id, darId: dar.id, title: dar.title, type: 'Revise', assigneeId: dar.requesterId,
          dueDate: dueDateStr, cancelDate: cancelDateStr, status: 'NORMAL'
        });
        newNotifications.push({ id: Date.now() + Math.random(), userId: dar.requesterId, title: 'DAR ถูกส่งกลับแก้ไข', message: `DAR "${dar.title}" ถูกส่งกลับให้คุณแก้ไข`, isRead: false, link: '/tasks', timestamp: new Date().toISOString(), relatedTaskId: newTaskId });
      } else if (action === 'REJECT') {
        newStatus = 'REJECTED';
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

    const newState = {
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

    if (newlyCompletedDar) {
      const store = get();
      store.syncRevisionEffective(newlyCompletedDar);
      store.syncObsoleteCompleted(newlyCompletedDar);
      if (newlyCompletedDar.type === 'REVISION') {
        store.publishDarRevision(newlyCompletedDar.id);
      } else if (newlyCompletedDar.type === 'OBSOLETE') {
        store.publishObsoleteDar(newlyCompletedDar.id);
      }
    }
  },

  resubmitDar: (darId, updatedData, taskId) => set((state) => {
    const dar = state.dars.find(d => d.id === darId);
    if (!dar) return state;

    const newTasks = state.tasks.filter(t => t.id !== taskId);
    const updatedDars = state.dars.map(d => d.id === darId ? { ...d, ...updatedData, status: 'UNDER_REVIEW' } : d);
    let newNotifications = [...state.notifications];

    const assignedReviewerId = resolveReviewer(dar.requesterId, dar.department, state.masterUsers, state.reviewUsers);

    if (assignedReviewerId) {
      const today = new Date();
      today.setDate(today.getDate() + state.mockDateOffset);
      newTasks.push({
        id: `t-${Date.now()}`,
        referenceType: 'INTERNAL_DAR', referenceId: dar.id,
        darId: dar.id,
        title: updatedData.title || dar.title,
        type: 'Review',
        assigneeId: assignedReviewerId,
        dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        cancelDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
      newTasks.push({
        id: newTaskId,
        title: `อนุมัติเบิกสำเนาเพิ่มเติม (${doc.title})`,
        type: 'CC_REPLACEMENT_APPROVAL',
        assigneeId: managerObj.id,
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
    const todayStr = state.simulatedDate;
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
              newTasks.push({
                id: `task-dist-${Date.now()}-${Math.random()}`,
                title: `แจกจ่ายเอกสาร Controlled Copy (NEW)`,
                description: `กรุณาพิมพ์และแจกจ่ายสำเนาควบคุมสำหรับเอกสาร ${newDoc.title} จำนวน ${allTargets.length} แผนก/จุดใช้งาน`,
                type: 'DCC_DISTRIBUTE',
                status: 'PENDING',
                assigneeId: 'U001',
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                priority: 'HIGH',
                darId: dar.id
              });

              allTargets.forEach((dist, idx) => {
                const deptName = dist.departmentId || dist.dept || dist.dept_code || newDoc.department;
                const locName = dist.station_name || dist.locationName || dist.name || dist.location || (dist.isMaster ? `${deptName} Head Office (จุดคุมงานหลัก Master)` : `${deptName} Station ${idx + 1}`);
                const locId = dist.station_id || dist.locationId || dist.id || `${deptName}-LOC-${idx + 1}`;
                const copyNo = dist.copy_no || dist.copyNo || String(idx + 1).padStart(2, '0');
                const nextCcNum = `CC-${String(idx + 1).padStart(3, '0')}`;
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
                  holder_name: `${deptName} (${locName})`,
                  location: locName,
                  locationName: locName,
                  locationId: locId,
                  station_id: locId,
                  station_name: locName,
                  is_master: !!dist.isMaster || !!dist.is_master,
                  isMaster: !!dist.isMaster || !!dist.is_master,
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
                newControlledCopyInstances.push(newInst);

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
                 return { ...doc, status: 'SUPERSEDED', is_superseded: true };
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
                  const isOldRev = !inst.rev || !inst.doc_version || inst.rev === oldRev || inst.doc_version === oldRev || inst.revision === oldRev;
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
                      newStatus: 'PENDING_RECALL',
                      remarks: `Superseded by Rev.${newDoc.rev} (DAR ${dar.id}). Set to PENDING_RECALL for physical recall/destruction.`
                    });

                    return {
                      ...inst,
                      status: 'PENDING_RECALL',
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
                  details: `เอกสาร ${newDoc.title} ปรับปรุงเป็น Rev.${newDoc.rev}: สำเนาเดิม Rev.${oldRev} ทั้งหมด (${oldCopiesToRecall.length} เล่ม) ถูกตั้งสถานะเรียกคืน (PENDING_RECALL)`,
                  timestamp: new Date().toISOString()
                });
                
                const allocations = calculateCopyAllocations(newDoc.department, newDoc.distributions || []);
                const allTargets = allocations.allAllocations || [];

                // Universal Recall Task: ALWAYS created if there are copies to recall or if oldDoc had controlled copies
                if (oldCopiesToRecall.length > 0 || (oldDoc && oldDoc.controlledCopy > 0)) {
                  newTasks.push({
                    id: `task-recall-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    type: 'RECALL_HARDCOPY',
                    taskType: 'DCC_RECALL_WITH_CHECKLIST',
                    target_role: 'DCC',
                    assignedToRole: 'DCC_ADMIN',
                    assigneeId: 'U001',
                    department: 'QA',
                    document_code: targetCode,
                    doc_code: targetCode,
                    revision: oldRev,
                    doc_version: oldRev,
                    title: `[เรียกคืนสำเนาตกรุ่น] เรียกคืนเอกสาร Controlled Copy ${targetCode} (Rev.${oldRev})`,
                    description: `เอกสาร ${targetCode} มีการอัปเดตเป็น Rev.${newDoc.rev} แล้ว กรุณาเรียกคืนเอกสารฉบับเดิม (Rev.${oldRev}) จากทุกสถานีใช้งาน (${oldCopiesToRecall.length} จุด)`,
                    copies_to_recall: oldCopiesToRecall.map(c => ({
                      id: c.id,
                      copy_no: c.copy_no || c.copyNo,
                      holder_dept: c.holder_dept || c.department,
                      location: c.location || c.locationName,
                      status: c.status
                    })),
                    status: 'PENDING_RECALL',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    priority: 'HIGH',
                    darId: dar.id,
                    createdAt: new Date().toISOString()
                  });
                }

                if (allTargets.length > 0) {
                  newTasks.push({
                    id: `task-dist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    title: `แจกจ่ายเอกสาร Controlled Copy (Rev.${newDoc.rev})`,
                    description: `กรุณาพิมพ์และแจกจ่ายสำเนาควบคุมสำหรับเอกสาร ${newDoc.title} จำนวน ${allTargets.length} แผนก/จุดใช้งาน`,
                    type: 'DCC_DISTRIBUTE',
                    status: 'PENDING',
                    assigneeId: 'U001',
                    assignedToRole: 'DCC_ADMIN',
                    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    priority: 'HIGH',
                    darId: dar.id
                  });

                  allTargets.forEach((dist, idx) => {
                    const deptName = dist.departmentId || dist.dept || dist.dept_code || newDoc.department;
                    const locName = dist.station_name || dist.locationName || dist.name || dist.location || (dist.isMaster ? `${deptName} Head Office (จุดคุมงานหลัก Master)` : `${deptName} Station ${idx + 1}`);
                    const locId = dist.station_id || dist.locationId || dist.id || `${deptName}-LOC-${idx + 1}`;
                    const copyNo = dist.copy_no || dist.copyNo || String(idx + 1).padStart(2, '0');
                    const nextCcNum = `CC-${String(idx + 1).padStart(3, '0')}`;

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
                      holder_name: `${deptName} (${locName})`,
                      location: locName,
                      locationName: locName,
                      locationId: locId,
                      station_id: locId,
                      station_name: locName,
                      is_master: !!dist.isMaster || !!dist.is_master,
                      isMaster: !!dist.isMaster || !!dist.is_master,
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
                    newControlledCopyInstances.push(newInst);
                    
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
          
          // 4. Create RECALL_HARDCOPY Task for DCC
          newTasks.push({
            id: `task-recall-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'RECALL_HARDCOPY',
            taskType: 'RECALL',
            target_role: 'DCC',
            assignedToRole: 'DCC_ADMIN',
            assigneeId: 'U001',
            department: 'QA',
            document_code: targetDocCode,
            revision: 'ALL',
            title: `[เรียกคืนสำเนาเอกสารยกเลิก] เอกสาร ${targetDocCode} (ทั้งหมด ${obsoleteCopiesToRecall.length} เล่ม)`,
            description: `เอกสาร ${targetDocCode} ถูกประกาศยกเลิกการใช้งาน (OBSOLETE) แล้ว กรุณาเรียกคืนสำเนาทั้งหมด (${obsoleteCopiesToRecall.length} ชุด) เพื่อดำเนินการทำลายหรือจัดเก็บ`,
            copies_to_recall: obsoleteCopiesToRecall.map(c => ({
              id: c.id,
              copy_no: c.copy_no || c.copyNo,
              holder_dept: c.holder_dept || c.department,
              location: c.location || c.locationName,
              status: c.status
            })),
            status: 'PENDING_RECALL',
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
  },

  addComment: (darId, commentStr, user) => set((state) => {
    const newTimeline = [...state.timeline, {
      id: Date.now(), darId: darId, action: 'Comment', user: user.name, date: new Date().toLocaleString(), comment: commentStr, isChat: true, userId: user.id
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

  deleteDar: (darId) => set((state) => {
    return {
      dars: state.dars.filter(d => d.id !== darId),
      tasks: state.tasks.filter(t => t.darId !== darId),
      timeline: state.timeline.filter(t => t.darId !== darId),
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'DAR_DELETE',
        actor: state.currentUser.name,
        details: `Deleted DAR ${darId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

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
      return userDepts.some(u => u === targetDept || (u === 'QA' && targetDept === 'QA/QC') || (u === 'QA/QC' && targetDept === 'QA'));
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

    // 2. Identify whether this copy is Master Copy (Copy 01)
    const isMasterCopy = copy.is_master || copy.isMaster || copy.copy_no === '01' || copy.copy_no === 1 || copy.copyNo === '01' || copy.copyNo === 1 || copy.ccNumber === 'CC-001' || copy.ccNumber === '01';

    // 3. Resolve Owner Department vs Target Department
    const docOwnerDept = relatedDoc?.department || relatedDar?.department || copy.owner_dept || 'PD';

    // Cross-department routing: target_department of this specific copy MUST take precedence over docOwnerDept!
    const explicitTargetDept = copy.target_department || copy.targetDepartment;
    const destinationDept = explicitTargetDept || 
      (isMasterCopy && !copy.holder_dept && !copy.destinationDept ? docOwnerDept : null) ||
      copy.holder_dept || 
      copy.destinationDept || 
      copy.destination_dept || 
      copy.departmentId || 
      copy.dept_code || 
      (copy.department && copy.department !== docOwnerDept ? copy.department : null) || 
      copy.location_dept || 
      (isMasterCopy ? docOwnerDept : (copy.department || docOwnerDept || 'QA'));

    // 4. Resolve strictly targeted recipient/requester for this department
    let requesterId = null;
    let requesterName = null;

    // Check if the copy itself already specified a valid holder in destinationDept
    if (copy.requester_id || copy.requesterId || copy.holderId) {
      const candidateId = copy.requester_id || copy.requesterId || copy.holderId;
      const candidateUser = (state.masterUsers || []).find(u => u.id === candidateId);
      if (candidateUser && (candidateUser.department === destinationDept || (candidateUser.depts && candidateUser.depts.includes(destinationDept)))) {
        requesterId = candidateUser.id;
        requesterName = candidateUser.name;
      }
    }

    // If DAR requester belongs to destinationDept, prioritize DAR requester
    if (!requesterId && relatedDar) {
      const darReqId = relatedDar.requester_id || relatedDar.requesterId || relatedDar.userId || relatedDar.requester?.id || relatedDar.created_by || relatedDar.createdBy;
      const darReqUser = (state.masterUsers || []).find(u => u.id === darReqId);
      const darReqDept = darReqUser?.department || (darReqUser?.depts ? darReqUser.depts[0] : null) || relatedDar.department;

      if (darReqDept === destinationDept && darReqUser) {
        requesterId = darReqId;
        requesterName = darReqUser.name || relatedDar.requester_name || relatedDar.requesterName || relatedDar.requester;
      }
    }

    // If no assignee or assignee is not in destinationDept, find supervisor/officer in destinationDept
    if (!requesterId) {
      const deptUsers = (state.masterUsers || []).filter(u => u.department === destinationDept || (u.depts && u.depts.includes(destinationDept)));
      // Prefer departmental users who are NOT DCC Admin so the recipient is the actual department staff
      const nonDccDeptUsers = deptUsers.filter(u => !u.isDcc && u.role !== 'DCC_ADMIN');
      const candidateDeptUsers = nonDccDeptUsers.length > 0 ? nonDccDeptUsers : deptUsers;

      const supervisorUser = candidateDeptUsers.find(u => u.level >= 4 || u.role === 'DEPT_ADMIN' || u.role === 'SUPERVISOR') || candidateDeptUsers[0];
      if (supervisorUser) {
        requesterId = supervisorUser.id;
        requesterName = supervisorUser.name;
      } else {
        const anyDeptUser = candidateDeptUsers[0] || (state.masterUsers || []).find(u => u.department === destinationDept || (u.depts && u.depts.includes(destinationDept)));
        if (anyDeptUser) {
          requesterId = anyDeptUser.id;
          requesterName = anyDeptUser.name;
        } else {
          requesterId = isMasterCopy && destinationDept === docOwnerDept ? (relatedDar?.requesterId || 'U001') : null;
          requesterName = isMasterCopy && destinationDept === docOwnerDept ? (relatedDar?.requesterName || 'ธนาวุฒิ สมควรกิจดำรง') : `${destinationDept} Controller`;
        }
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
      requester_id: requesterId,
      requester_name: requesterName,
      dateIssued: dispatchedAt.split('T')[0]
    };

    const newCopies = copies.map(c => {
      if (String(c.id) === targetId) {
        return updatedCopy;
      }
      if (copy.is_replacement && copy.replaced_copy_id && String(c.id) === String(copy.replaced_copy_id)) {
        return {
          ...c,
          status: 'REPLACED_VOID',
          replaced_at: dispatchedAt,
          replaced_by: dispatchedBy
        };
      }
      return c;
    });

    // Create DEPT_CONFIRM_HARDCOPY_RECEIPT Task strictly targeted to destination department and assignee
    const newTaskId = `task-receipt-${targetId}-${Date.now()}`;
    const newTask = {
      id: newTaskId,
      type: 'DEPT_CONFIRM_HARDCOPY_RECEIPT',
      taskType: 'DEPT_CONFIRM_HARDCOPY_RECEIPT',
      task_type: 'CONFIRM_RECEIPT',
      title: `ตรวจรับเอกสารควบคุมฉบับพิมพ์: ${copy.doc_code || copy.docTitle || copy.title} (Copy ${copy.copy_no || copy.ccNumber || '01'})`,
      description: `กรุณาตรวจสอบเอกสารฉบับพิมพ์จริงที่จุดใช้งาน ${copy.location || copy.locationName || destinationDept} (${destinationDept}) และยืนยันการรับเอกสาร`,
      copy_id: targetId,
      copyId: targetId,
      instanceId: targetId,
      doc_id: copyDocId,
      darId: relatedDar ? String(relatedDar.id) : copyDocId,
      doc_code: copy.doc_code || copy.docTitle || copy.title || '',
      doc_version: copy.doc_version || copy.rev || '01',
      copy_no: copy.copy_no || copy.ccNumber || '01',
      location: copy.location || copy.locationName || destinationDept || '',
      location_name: copy.location || copy.locationName || destinationDept || '',
      target_department: destinationDept,
      targetDepartment: destinationDept,
      destinationDept: destinationDept,
      destination_dept: destinationDept,
      department: destinationDept,
      dept_code: destinationDept,
      currentHandlerDepartment: destinationDept,
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

    return {
      documentControlledCopies: newCopies,
      controlledCopyInstances: newCopies,
      tasks: [newTask, ...state.tasks.filter(t => t.id !== newTaskId)],
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

  // Batch dispatch helper
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
      const copies = (state.controlledCopyInstances || []).filter(c => (c.doc_id === docIdOrCopyIds || c.docId === docIdOrCopyIds) && c.status === 'PENDING_ISSUE');
      copies.forEach(c => {
        useStore.getState().dispatchControlledCopy(c.id);
      });
    }
  },

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
    const userDepts = user?.affiliated_departments || user?.depts || (user?.primary_department ? [user.primary_department] : (user?.department ? [user.department] : []));
    
    const targetDept = copy.holder_dept || copy.department || copy.target_department || copy.dept_code;
    
    // 🛡️ Strict Authorization Guard with DCC Admin / QMR Wildcard Bypass:
    if (!isWildcard && targetDept && !userDepts.includes(targetDept)) {
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
      receipt_confirmed_at: confirmedAt,
      receipt_confirmed_by: confirmedBy,
      receipt_remarks: remarks
    };

    const newCopies = copies.map(c => {
      if (String(c.id) === targetCopyId) {
        return updatedCopy;
      }
      if (copy.is_replacement && copy.replaced_copy_id && String(c.id) === String(copy.replaced_copy_id)) {
        return {
          ...c,
          status: 'REPLACED_VOID',
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
        (t.type === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || t.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT') &&
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

    return {
      documentControlledCopies: newCopies,
      controlledCopyInstances: newCopies,
      tasks: cleanupDccTasks(updatedTasks, newCopies, state.documents),
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
    const targetDocCode = dar.document_code || dar.doc_code || dar.docCode || dar.docIdInput || (dar.title?.startsWith('[') ? dar.title.replace(/^\[.*?\]\s*/, '') : dar.title);
    const obsoleteAt = new Date().toISOString();
    const darNo = dar.dar_no || dar.id;

    // 1. Cascade Obsolete: Mark EVERY Revision of this document code OBSOLETE
    const updatedDocs = state.documents.map(doc => {
      const docCode = doc.document_code || doc.code || doc.title;
      const matchCode = (targetDocId && String(doc.id) === String(targetDocId)) ||
                        (targetDocCode && (docCode === targetDocCode || doc.name === targetDocCode));
      if (matchCode) {
        return {
          ...doc,
          status: 'OBSOLETE',
          is_obsolete: true,
          obsolete_at: obsoleteAt,
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
        (copyDocCode && copyDocCode === targetDocCode) ||
        updatedDocs.some(d => (String(d.id) === String(copy.doc_id || copy.docId) || (d.document_code || d.code || d.title) === copyDocCode) && d.status === 'OBSOLETE');
      const isActive = copy.status === 'ISSUED_ACTIVE' || copy.status === 'ACTIVE' || copy.status === 'RECEIVED' || copy.status === 'DISPATCHED_PENDING_RECEIPT' || copy.status === 'PENDING_RECALL' || copy.status === 'OBSOLETE_PENDING_RECALL';
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
      newTasks.push({
        id: `task-recall-${Date.now()}`,
        type: 'RECALL_HARDCOPY',
        taskType: 'RECALL',
        target_role: 'DCC',
        department: 'QA',
        document_code: targetDocCode,
        doc_code: targetDocCode,
        revision: 'ALL',
        doc_version: 'ALL',
        title: `[เรียกคืนสำเนาขอยกเลิก] เอกสาร ${targetDocCode}`,
        description: `เอกสาร ${targetDocCode} ทุก Revision ถูกยกเลิกถาวรตาม ${darNo} กรุณาเรียกคืนสำเนาจากทุกจุด (${obsoleteCopiesToRecall.length} ชุด) และดำเนินการทำลาย/ประทับตรา OBSOLETE`,
        copies_to_recall: obsoleteCopiesToRecall,
        status: 'PENDING_RECALL',
        assigneeId: 'U001',
        assignedToRole: 'DCC_ADMIN',
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
      remarks: `เอกสาร ${targetDocCode} ทุก Revision ถูกยกเลิกถาวรตามคำร้อง ${darNo} (Cascade Obsolete) — รอ DCC เรียกคืนสำเนา ${obsoleteCopiesToRecall.length} ชุด`
    };

    const actionLogEntry = {
      id: `LOG-OBS-${Date.now()}`,
      actionType: 'DOCUMENT_OBSOLETED',
      action: 'DOCUMENT_OBSOLETED',
      actor: state.currentUser ? state.currentUser.name : 'System',
      details: `เอกสาร ${targetDocCode} ทุก Revision ถูกยกเลิกถาวรตามคำร้อง ${darNo} (Cascade Obsolete) — รอ DCC เรียกคืนสำเนา ${obsoleteCopiesToRecall.length} ชุด`,
      timestamp: obsoleteAt
    };

    return {
      documents: updatedDocs,
      dars: updatedDars,
      controlledCopyInstances: updatedCopies,
      documentControlledCopies: updatedCopies,
      tasks: newTasks,
      controlledCopyAuditTrail: [auditLog, ...(state.controlledCopyAuditTrail || [])],
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
                       (task.copies_to_recall && task.copies_to_recall.some(rc => rc.id === c.id));
      const isPending = c.status === 'PENDING_RECALL' || c.status === 'OBSOLETE_PENDING_RECALL';
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

  completeCopyRecallAndArchive: ({ documentCode, collectedCopyIds, dispositionMethod, notes, taskId }) => set((state) => {
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
          recalled_at: recalledAt,
          recalled_by: recalledBy,
          dcc_notes: notes || '',
          dateRecalled: recalledAt.split('T')[0]
        };
      }
      return copy;
    });

    // Resolve Recall Task
    let updatedTasks = (state.tasks || []).map(t => {
      const isTargetTask = (taskId && String(t.id) === String(taskId)) ||
        (documentCode && (t.doc_code === documentCode || t.docTitle === documentCode || t.title?.includes(documentCode))) ||
        (t.darId && state.dars.some(d => d.id === t.darId && (d.docIdRef === documentCode || d.title === documentCode || d.doc_code === documentCode)));

      if (isTargetTask && (t.type === 'DCC_RECALL' || t.type === 'DCC_RECALL_WITH_CHECKLIST' || t.taskType === 'DCC_RECALL_WITH_CHECKLIST' || t.type === 'RECALL' || t.type === 'OBSOLETE_RECALL')) {
        // Check if there are any remaining copies with PENDING_RECALL for this doc
        const remainingPending = updatedCopies.some(c => 
          (c.doc_code === documentCode || c.docTitle === documentCode || (c.doc_id && state.documents.some(d => String(d.id) === String(c.doc_id) && d.title === documentCode))) &&
          c.status === 'PENDING_RECALL'
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

  publishDarRevision: (darId) => set((state) => {
    const dar = state.dars.find(d => d.id === darId || d.dar_no === darId);
    if (!dar) return state;

    const targetDocId = dar.docIdRef || dar.docId || dar.doc_id;
    let targetCode = dar.document_code || dar.doc_code || dar.docCode || dar.docIdInput;
    if (!targetCode && targetDocId) {
      const found = state.documents.find(d => String(d.id) === String(targetDocId));
      if (found) targetCode = found.document_code || found.code || found.title;
    }
    if (!targetCode && dar.title && !dar.title.startsWith('[')) {
      targetCode = dar.title;
    }
    
    // Strict code matching to find previous revisions
    const isDocMatchCode = (doc) => {
      const code = doc.document_code || doc.code || doc.title;
      return (targetCode && code === targetCode) || (targetDocId && String(doc.id) === String(targetDocId));
    };

    const matchingDocs = state.documents.filter(isDocMatchCode);
    const oldDoc = matchingDocs.find(d => d.status === 'EFFECTIVE') || matchingDocs[matchingDocs.length - 1];

    const oldRev = oldDoc ? (oldDoc.revision || oldDoc.rev) : (dar.previous_revision || dar.previousRev || '00');
    const currentRevNum = parseInt(oldRev, 10) || 0;
    const newRevNum = currentRevNum + 1;
    const newRevStr = dar.revision || dar.rev || (newRevNum < 10 ? `0${newRevNum}` : `${newRevNum}`);
    const todayStr = state.simulatedDate || new Date().toISOString().split('T')[0];

    // 1. Single Effective Invariant: Update ALL previous revisions of this code to SUPERSEDED
    let updatedDocs = state.documents.map(doc => {
      if (isDocMatchCode(doc)) {
        return {
          ...doc,
          status: 'SUPERSEDED',
          is_superseded: true
        };
      }
      return doc;
    });

    const newDocId = `doc-${Date.now()}-${Math.random()}`;
    const newDoc = {
      id: newDocId,
      darId: dar.id,
      document_code: targetCode || oldDoc?.document_code || oldDoc?.title,
      code: targetCode || oldDoc?.code || oldDoc?.title,
      title: oldDoc ? oldDoc.title : targetCode,
      name: dar.title || oldDoc?.name || 'Procedure Document',
      status: 'EFFECTIVE',
      rev: newRevStr,
      revision: newRevStr,
      department: dar.department || oldDoc?.department || 'PD',
      controlledCopy: oldDoc?.controlledCopy || 0,
      effectiveDate: dar.effectiveDate || todayStr,
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
      const isRevMatch = !copy.rev || !copy.doc_version || copy.rev === oldRev || copy.doc_version === oldRev || copy.revision === oldRev;
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
          newStatus: 'PENDING_RECALL',
          remarks: `Superseded by Rev.${newRevStr} (DAR ${dar.id}). Set to PENDING_RECALL for physical recall/destruction.`
        });

        return {
          ...copy,
          status: 'PENDING_RECALL',
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
      const locName = dist.station_name || dist.locationName || dist.name || dist.location || (dist.isMaster ? `${deptName} Head Office (จุดคุมงานหลัก Master)` : `${deptName} Station ${idx + 1}`);
      const locId = dist.station_id || dist.locationId || dist.id || `${deptName}-LOC-${idx + 1}`;
      const copyNo = dist.copy_no || dist.copyNo || String(idx + 1).padStart(2, '0');
      const nextCcNum = `CC-${String(idx + 1).padStart(3, '0')}`;

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
        holder_name: `${deptName} (${locName})`,
        location: locName,
        locationName: locName,
        locationId: locId,
        station_id: locId,
        station_name: locName,
        is_master: !!dist.isMaster || !!dist.is_master,
        isMaster: !!dist.isMaster || !!dist.is_master,
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
        remarks: `Auto-generated CC for ${deptName} (${locName}) upon new revision effective`
      });
    });

    // 4. Create DCC Tasks
    let newTasks = [...state.tasks];

    // Distribution Task
    if (allTargets.length > 0) {
      newTasks.push({
        id: `task-dist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: `แจกจ่ายเอกสาร Controlled Copy (Rev.${newDoc.rev})`,
        description: `กรุณาพิมพ์และแจกจ่ายสำเนาควบคุมสำหรับเอกสาร ${newDoc.title} จำนวน ${allTargets.length} แผนก/จุดใช้งาน`,
        type: 'DCC_DISTRIBUTE',
        status: 'PENDING',
        assigneeId: 'U001',
        assignedToRole: 'DCC_ADMIN',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'HIGH',
        darId: dar.id
      });
    }

    // Universal Recall Task
    const copiesToRecall = recalledCopies.map(c => ({
      id: c.id,
      copy_no: c.copy_no || c.copyNo,
      holder_dept: c.holder_dept || c.department,
      location: c.location || c.locationName,
      status: c.status
    }));

    if (recalledCopies.length > 0 || (oldDoc && oldDoc.controlledCopy > 0)) {
      const recallTask = {
        id: `task-recall-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'RECALL_HARDCOPY',
        taskType: 'DCC_RECALL_WITH_CHECKLIST',
        target_role: 'DCC',
        assignedToRole: 'DCC_ADMIN',
        assigneeId: 'U001',
        department: 'QA',
        document_code: targetCode,
        doc_code: targetCode,
        revision: oldDoc ? (oldDoc.revision || oldDoc.rev) : oldRev,
        doc_version: oldDoc ? (oldDoc.revision || oldDoc.rev) : oldRev,
        title: `[เรียกคืนสำเนาตกรุ่น] เรียกคืนเอกสาร Controlled Copy ${targetCode} (Rev.${oldDoc ? (oldDoc.revision || oldDoc.rev) : oldRev})`,
        description: `เอกสาร ${targetCode} มีการอัปเดตเป็น Rev.${newDoc.rev} แล้ว กรุณาเรียกคืนเอกสารฉบับเดิม (Rev.${oldRev}) จากทุกสถานีใช้งาน (${recalledCopies.length} จุด)`,
        copies_to_recall: copiesToRecall,
        status: 'PENDING_RECALL',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'HIGH',
        darId: dar.id,
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
      details: `เอกสาร ${newDoc.title} ปรับปรุงเป็น Rev.${newRevStr}: สำเนาเดิม Rev.${oldRev} ทั้งหมด (${recalledCopies.length} เล่ม) ถูกตั้งสถานะเรียกคืน (PENDING_RECALL)`,
      timestamp: new Date().toISOString()
    };

    const finalCopies = [...updatedCopies, ...newCreatedCopies];

    return {
      documents: updatedDocs,
      dars: updatedDars,
      controlledCopyInstances: finalCopies,
      documentControlledCopies: finalCopies,
      tasks: cleanupDccTasks(newTasks, finalCopies, updatedDocs),
      controlledCopyAuditTrail: newAuditLogs,
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
    const dccTask = {
      id: taskId,
      type: 'DCC_DISTRIBUTE',
      taskType: 'DCC_ISSUE_CONTROLLED_COPIES',
      title: `ขอออกสำเนาควบคุมเพิ่มเติม: ${docCode} (${newLocationsList.length} จุด)`,
      description: `แผนก ${requesterDept} โดยคุณ ${requesterName} ขอรับสำเนาควบคุมเพิ่มเติมสำหรับ ${docCode} (Rev.${docVersion}) จำนวน ${newLocationsList.length} เล่ม เหตุผล: ${reason}`,
      docId: doc.id,
      darId: isInternal ? doc.id : null,
      externalDocId: isExternal ? doc.id : null,
      doc_code: docCode,
      doc_version: docVersion,
      assigneeId: 'U001',
      assignedToRole: 'DCC_ADMIN',
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
    const targetId = String(instId);
    const copies = state.documentControlledCopies || state.controlledCopyInstances || [];
    const inst = copies.find(i => String(i.id) === targetId);
    if (!inst) return state;

    // 🛡️ Security Check: RBAC Custodianship Guard
    const user = state.currentUser;
    const isDcc = Boolean(user && (user.isDcc || user.role === 'DCC_ADMIN' || user.role === 'SUPER_ADMIN' || user.id === 'U001' || user.id === 'u5'));
    const copyDept = inst.holder_dept || inst.department || inst.departmentId || inst.dept_code;
    const userDept = user?.department || user?.dept;
    const userDepts = user?.depts || (userDept ? [userDept] : []);
    const isOwnerDept = Boolean(copyDept && userDepts.some(d => d && (
      d.toUpperCase() === copyDept.toUpperCase() ||
      (d === 'QA' && copyDept === 'QA/QC') ||
      (d === 'QA/QC' && copyDept === 'QA')
    )));

    if (user && !isDcc && !isOwnerDept) {
      console.warn(`[Security Guard] Unauthorized reportCcDamagedLost: User ${user?.name} (${user?.department}) cannot manage copy for department ${copyDept}`);
      throw new Error('ปฏิเสธการทำรายการ: คุณไม่มีสิทธิ์จัดการสำเนาควบคุมของแผนกอื่น');
    }

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const reporterName = state.currentUser ? state.currentUser.name : 'Authorized User';

    const currentIssue = parseInt((inst.issue_no || inst.issueNumber || '1').replace(/\D/g, ''), 10) || 1;
    const nextIssueNo = String(currentIssue + 1).padStart(2, '0');
    const nextIssue = `I${nextIssueNo}`;

    // 1. Audit log for reporting
    const auditLog = {
      id: `audit-${Date.now()}`,
      timestamp: nowIso,
      user: reporterName,
      action: type === 'LOST' ? 'REPORT_LOST' : 'REPORT_DAMAGED',
      docTitle: inst.doc_code || inst.docTitle,
      docRev: inst.doc_version || inst.rev,
      ccNumber: inst.copy_no || inst.ccNumber,
      oldStatus: inst.status,
      newStatus: type === 'LOST' ? 'LOST_RECORDED' : 'DAMAGED_PENDING_REPLACEMENT',
      remarks: `User reported ${type === 'LOST' ? 'เอกสารสูญหาย' : 'เอกสารชำรุด'}: ${reason}`
    };

    // 2. Replacement Copy Instance (Enqueued to PENDING_ISSUE for DCC)
    const replacementCopy = {
      id: `cc-rep-${inst.id}-${Date.now()}`,
      doc_id: inst.doc_id || inst.docId,
      docId: inst.doc_id || inst.docId,
      external_doc_id: inst.external_doc_id || inst.externalDocId,
      externalDocId: inst.external_doc_id || inst.externalDocId,
      doc_code: inst.doc_code || inst.docTitle || inst.docNo,
      docCode: inst.doc_code || inst.docTitle || inst.docNo,
      doc_title: inst.doc_title || inst.docTitle || inst.docName,
      docTitle: inst.doc_title || inst.docTitle || inst.docName,
      docName: inst.docName || inst.doc_title || inst.docTitle,
      doc_type: inst.doc_type || inst.docType,
      docType: inst.doc_type || inst.docType,
      doc_version: inst.doc_version || inst.rev || '01',
      rev: inst.doc_version || inst.rev || '01',
      copy_no: inst.copy_no || inst.ccNumber,
      copyNo: inst.copy_no || inst.ccNumber,
      ccNumber: inst.ccNumber || (inst.copy_no ? (inst.copy_no.startsWith('CC-') ? inst.copy_no : `Copy ${inst.copy_no}`) : 'Copy 01'),
      issue_no: nextIssueNo,
      issueNumber: nextIssue,
      holder_dept: inst.holder_dept || inst.department,
      department: inst.holder_dept || inst.department,
      departmentId: inst.holder_dept || inst.department,
      dept_code: inst.holder_dept || inst.department,
      holder_name: inst.holder_name || `${inst.holder_dept || inst.department} (${inst.location || inst.locationName || 'Main Station'})`,
      location: inst.location || inst.locationName,
      locationName: inst.location || inst.locationName,
      locationId: inst.locationId || inst.station_id,
      station_id: inst.locationId || inst.station_id,
      station_name: inst.location || inst.locationName,
      status: 'PENDING_ISSUE', // Directly available for DCC to print & issue
      is_replacement: true,
      is_adhoc: false,
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

    // 3. Task for DCC to Issue Replacement Copy
    const dccTask = {
      id: `task-dcc-replacement-${inst.id}-${Date.now()}`,
      type: 'DCC_DISTRIBUTE',
      taskType: 'DCC_ISSUE_CONTROLLED_COPIES',
      title: `ออกสำเนาควบคุมทดแทน (Issue ${nextIssueNo}): ${inst.doc_code || inst.docTitle} (${inst.copy_no || inst.ccNumber})`,
      description: `แผนก ${inst.holder_dept || inst.department} แจ้ง${type === 'LOST' ? 'สูญหาย' : 'ชำรุด'} ประจำจุด ${inst.location || inst.locationName} เหตุผล: ${reason}`,
      docId: inst.doc_id || inst.docId,
      doc_code: inst.doc_code || inst.docTitle,
      doc_version: inst.doc_version || inst.rev || '01',
      assigneeId: 'U001',
      assignedToRole: 'DCC_ADMIN',
      status: 'PENDING',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: nowIso
    };

    // 4. Notification for DCC
    const dccNotification = {
      id: `notif-rep-${Date.now()}`,
      userId: 'U001',
      title: `มีคำขอออกสำเนาทดแทน (${type === 'LOST' ? 'สูญหาย' : 'ชำรุด'})`,
      message: `แผนก ${inst.holder_dept || inst.department} แจ้งออกสำเนาทดแทน ${inst.doc_code || inst.docTitle} (${inst.copy_no || inst.ccNumber}) จุด ${inst.location || inst.locationName}`,
      isRead: false,
      link: '/controlled-copy?tab=PENDING_ISSUE',
      timestamp: nowIso
    };

    const newInstances = [
      ...copies.map(i => 
        String(i.id) === targetId 
          ? { 
              ...i, 
              status: type === 'LOST' ? 'LOST_RECORDED' : 'DAMAGED_PENDING_REPLACEMENT', 
              reportType: type, 
              reportReason: reason, 
              reportRequesterName: reporterName, 
              reportRequesterId: state.currentUser ? state.currentUser.id : null,
              reportedAt: nowIso 
            } 
          : i
      ),
      replacementCopy
    ];

    return {
      documentControlledCopies: newInstances,
      controlledCopyInstances: newInstances,
      controlledCopyAuditTrail: [auditLog, ...state.controlledCopyAuditTrail],
      tasks: [dccTask, ...state.tasks],
      notifications: [dccNotification, ...state.notifications],
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'CC_REPORT_REPLACEMENT',
        actor: reporterName,
        details: `Reported copy ${targetId} as ${type} and auto-enqueued replacement copy ${replacementCopy.id}`,
        timestamp: nowIso
      }, ...(state.actionLog || [])]
    };
  }),

  // Backward compatibility / RBAC alias
  reportCopyDamaged: ({ copyId, reason, requestReplacement, type = 'DAMAGED' } = {}) => {
    return useStore.getState().reportCcDamagedLost(copyId, type, reason);
  },

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
    const primaryDept = userData.primary_department || userData.department || userData.dept || 'QA';
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
      hasRegisteredSignature: userData.hasRegisteredSignature ?? true,
      certificateSerial: userData.certificateSerial || `CERT-${new Date().getFullYear()}-${primaryDept}${newId.slice(-3)}`,
      ...userData,
      id: newId,
      empId,
      name: userData.name,
      department: primaryDept,
      primary_department: primaryDept,
      depts: affiliatedDepts,
      affiliated_departments: affiliatedDepts,
      level: approvalLevel,
      approval_level: approvalLevel,
      role: userData.role || 'GENERAL_USER',
      isDcc,
      isQmr,
      permissions: userPermissions,
      canCreateDar: userData.canCreateDar !== undefined ? Boolean(userData.canCreateDar) : true,
      canAccessTasks: userData.canAccessTasks !== undefined ? Boolean(userData.canAccessTasks) : true,
      canViewRegister: userData.canViewRegister !== undefined ? Boolean(userData.canViewRegister) : true,
      isWorkflowUser: userData.isWorkflowUser !== undefined ? Boolean(userData.isWorkflowUser) : true
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
        const primaryDept = userData.primary_department || userData.department || u.primary_department || u.department || 'QA';
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
  addDepartment: (deptData) => set((state) => {
    const newDept = {
      id: deptData.id.toUpperCase().trim(),
      name: deptData.name || deptData.id,
      nameTh: deptData.nameTh || deptData.name || deptData.id,
      nameEn: deptData.nameEn || deptData.name || deptData.id,
      headUserId: deptData.headUserId || '',
      headName: deptData.headName || '',
      status: deptData.status || 'ACTIVE',
      color: deptData.color || 'indigo'
    };

    const currentDepts = state.departments || state.masterDepartments || [];
    if (currentDepts.some(d => d.id === newDept.id)) {
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
  }),

  updateDepartment: (deptId, deptData) => set((state) => {
    const currentDepts = state.departments || state.masterDepartments || [];
    const updatedDepts = currentDepts.map(d => {
      if (d.id === deptId) {
        return { ...d, ...deptData };
      }
      return d;
    });

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
  }),

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
      name: locData.name,
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
          const reqAck = entryData.requireAckDefault ?? entryData.require_ack_default ?? item.requireAckDefault ?? item.require_ack_default ?? false;
          
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
      const reqAck = entryData.requireAckDefault ?? entryData.require_ack_default ?? false;
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
    return persistedState;
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
    documentControlledCopies: state.documentControlledCopies,
    controlledCopyInstances: state.controlledCopyInstances,
    controlledCopyAuditTrail: state.controlledCopyAuditTrail,
    actionLog: state.actionLog,
    periodicReviewSchedules: state.periodicReviewSchedules,
    periodicReviewTasks: state.periodicReviewTasks,
    periodicReviewRecords: state.periodicReviewRecords
  })
}));

// Auto-cleanup legacy local storage cache
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.removeItem('qms-storage-uat-v6');
  } catch (e) {
    // Ignore in non-browser or sandbox environments
  }
}

export default useStore;

