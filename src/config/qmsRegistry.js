/**
 * qmsRegistry.js
 * ─────────────────────────────────────────────────────────────────────────────
 * QMS Configuration Registry (Single Source of Truth)
 * ISO 9001:2015 Domain Policies & Master Metadata Registry
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ==========================================
// 1. Raw Constant Arrays (ต้องอยู่บนสุดเสมอ)
// ==========================================
export const MASTER_DEPARTMENTS = [
  { id: 'DC', code: 'DC', name: 'DC (Document Control)', nameTh: 'ศูนย์ควบคุมเอกสาร / Document Control', nameEn: 'Document Control Center', headUserId: 'EMP-001', headName: 'ธนาวุฒิ สมควรกิจดำรง', status: 'ACTIVE', color: 'sky', allowDarSubmit: true },
  { id: 'PD', code: 'PD', name: 'PD (Production)', nameTh: 'ฝ่ายผลิต', nameEn: 'Production Department', headUserId: 'U003', headName: 'กัลยาณี พลไกร', status: 'ACTIVE', color: 'indigo', allowDarSubmit: true },
  { id: 'QC', code: 'QC', name: 'QC (Quality Control)', shortName: 'QC', nameTh: 'ฝ่ายประกันและควบคุมคุณภาพ', nameEn: 'Quality Assurance & Control', headUserId: 'U005', headName: 'บีม', status: 'ACTIVE', color: 'emerald', allowDarSubmit: true },
  { id: 'WH', code: 'WH', name: 'WH (Warehouse)', nameTh: 'ฝ่ายคลังสินค้าและโลจิสติกส์', nameEn: 'Warehouse & Logistics', headUserId: 'U005', headName: 'บีม', status: 'ACTIVE', color: 'amber', allowDarSubmit: true },
  { id: 'EN', code: 'EN', name: 'EN (Engineering)', nameTh: 'ฝ่ายวิศวกรรมและซ่อมบำรุง', nameEn: 'Engineering & Maintenance', headUserId: 'U006', headName: 'รัตนพล', status: 'ACTIVE', color: 'blue', allowDarSubmit: true },
  { id: 'PC', code: 'PC', name: 'PC (Purchasing)', nameTh: 'ฝ่ายจัดซื้อ', nameEn: 'Purchasing Department', headUserId: 'U004', headName: 'คุณเรย์', status: 'ACTIVE', color: 'purple', allowDarSubmit: true },
  { id: 'HR&GA', code: 'HR&GA', name: 'HR&GA', nameTh: 'ฝ่ายทรัพยากรบุคคลและธุรการ', nameEn: 'Human Resources & General Affairs', headUserId: 'U004', headName: 'คุณเรย์', status: 'ACTIVE', color: 'rose', allowDarSubmit: true },
  { id: 'HSE', code: 'HSE', name: 'HSE (Safety)', nameTh: 'ฝ่ายความปลอดภัยและสิ่งแวดล้อม', nameEn: 'Health, Safety & Environment', headUserId: 'U004', headName: 'คุณเรย์', status: 'ACTIVE', color: 'teal', allowDarSubmit: true },
  { id: 'MKT', code: 'MKT', name: 'MKT (Marketing)', nameTh: 'ฝ่ายการตลาดและการขาย', nameEn: 'Marketing & Sales', headUserId: 'U010', headName: 'สมชาย การตลาด', status: 'ACTIVE', color: 'cyan', allowDarSubmit: true },
  { id: 'ST', code: 'ST', name: 'ST (Store)', nameTh: 'ฝ่ายจัดเก็บวัตถุดิบ', nameEn: 'Store & Inventory', headUserId: 'U005', headName: 'บีม', status: 'ACTIVE', color: 'slate', allowDarSubmit: true },
  { id: 'FIN', code: 'FIN', name: 'FIN (Finance)', nameTh: 'ฝ่ายการเงินและบัญชี', nameEn: 'Finance Department', status: 'ACTIVE', color: 'purple', allowDarSubmit: true },
  { id: 'MGMT', code: 'MGMT', name: 'ตัวแทนฝ่ายบริหาร/คุณภาพ (MGMT)', nameTh: 'ตัวแทนฝ่ายบริหาร/คุณภาพ', nameEn: 'Management / QMR', isCentral: true, allowDarSubmit: true, status: 'ACTIVE', color: 'rose' },
  { id: 'EXEC', code: 'EXEC', name: 'ผู้บริหารสูงสุด (EXEC)', nameTh: 'ผู้บริหารสูงสุด', nameEn: 'Executive Management', isCentral: true, allowDarSubmit: true, status: 'ACTIVE', color: 'indigo' }
];

export const MASTER_DOC_TYPES = [
  { id: 'QM', code: 'QM', name: 'Quality Manual', nameTh: 'คู่มือคุณภาพ (Quality Manual)', prefix: 'QM', namingPattern: 'QM-{Dept}-{##}', is_form_type: false, reviewCycleMonths: 12, retentionPeriodYears: 5, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'คู่มือระบบการบริหารคุณภาพตามมาตรฐานสากล' },
  { id: 'SOP', code: 'SOP', name: 'Standard Operating Procedure', nameTh: 'ระเบียบปฏิบัติงาน (Standard Operating Procedure)', prefix: 'SOP', namingPattern: 'SOP-{Dept}-{##}', is_form_type: false, reviewCycleMonths: 12, retentionPeriodYears: 3, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'ขั้นตอนและระเบียบการดำเนินงานข้ามสายงาน' },
  { id: 'WI', code: 'WI', name: 'Work Instruction', nameTh: 'วิธีการปฏิบัติงาน (Work Instruction)', prefix: 'WI', namingPattern: 'WI-{Dept}-{##}', is_form_type: false, reviewCycleMonths: 12, retentionPeriodYears: 3, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'คำแนะนำขั้นตอนการทำงานเฉพาะจุดปฏิบัติงาน' },
  { id: 'FM', code: 'FM', name: 'Form / Record Format', nameTh: 'แบบฟอร์ม (Form)', prefix: 'FM', namingPattern: 'FM-{Dept}-{##}', is_form_type: true, reviewCycleMonths: 24, retentionPeriodYears: 2, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'แบบฟอร์มเปล่าสำหรับบันทึกผลการปฏิบัติงาน' },
  { id: 'SD', code: 'SD', name: 'Supporting Document', nameTh: 'เอกสารสนับสนุน (Supporting Document)', prefix: 'SD', namingPattern: 'SD-{Dept}-{##}', is_form_type: false, reviewCycleMonths: 24, retentionPeriodYears: 3, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'เอกสารอ้างอิงและข้อมูลทางวิชาการสนับสนุน' },
  { id: 'SPEC', code: 'SPEC', name: 'Standard Specification', nameTh: 'ข้อกำหนดทางเทคนิค (Specification)', prefix: 'SPEC', namingPattern: 'SPEC-{Dept}-{##}', is_form_type: false, reviewCycleMonths: 12, retentionPeriodYears: 5, status: 'ACTIVE', category: 'INTERNAL', allowDar: true, description: 'เกณฑ์มาตรฐานคุณลักษณะวัตถุดิบและผลิตภัณฑ์' },
  { id: 'ED', code: 'ED', name: 'External Document & Regulation', nameTh: 'เอกสารภายนอกและกฎหมาย (External Document)', prefix: 'ED', namingPattern: 'ED-{Dept}-{##}', is_form_type: false, isFormBypass: true, reviewCycleMonths: 12, retentionPeriodYears: 5, status: 'ACTIVE', category: 'EXTERNAL', allowDar: false, description: 'เอกสาร กฎหมาย มาตรฐาน และคู่มือจากหน่วยงานภายนอก' }
];

export const MASTER_DOCUMENT_TYPES = MASTER_DOC_TYPES;

export const MASTER_DATA_DEPT = MASTER_DEPARTMENTS;

export const SYSTEM_CORE_DEPTS = ['DC', 'QA', 'QC', 'QA/QC'];

export const CROSS_ORG_DEPTS = ['MGMT', 'EXEC', 'QMR'];

export const DEFAULT_APPROVAL_MATRIX = [
  { docType: 'QM', doc_type: 'QM', nameTh: 'คู่มือคุณภาพ (Quality Manual)', minRequesterLevel: 4, min_requester_level: 4, requiredReviewerLevel: 6, required_reviewer_level: 6, requiredApproverLevel: 8, required_approver_level: 8, requireAckDefault: true, require_ack_default: true, description: 'คู่มือระบบการบริหารคุณภาพตามมาตรฐานสากล' },
  { docType: 'SOP', doc_type: 'SOP', nameTh: 'ระเบียบปฏิบัติงาน (Standard Operating Procedure)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 6, required_approver_level: 6, requireAckDefault: true, require_ack_default: true, description: 'ขั้นตอนและระเบียบการดำเนินงานข้ามสายงาน' },
  { docType: 'WI', doc_type: 'WI', nameTh: 'คู่มือการปฏิบัติงาน (Work Instruction)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 5, required_approver_level: 5, requireAckDefault: false, require_ack_default: false, description: 'คำแนะนำขั้นตอนการทำงานเฉพาะจุดปฏิบัติงาน' },
  { docType: 'FM', doc_type: 'FM', nameTh: 'แบบฟอร์มบันทึกข้อมูล (Form / Record Format)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 5, required_approver_level: 5, requireAckDefault: false, require_ack_default: false, description: 'แบบฟอร์มเปล่าสำหรับบันทึกผลการปฏิบัติงาน' },
  { docType: 'SD', doc_type: 'SD', nameTh: 'เอกสารสนับสนุน (Supporting Document)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 5, required_approver_level: 5, requireAckDefault: true, require_ack_default: true, description: 'เอกสารอ้างอิงและข้อมูลทางวิชาการสนับสนุน' },
  { docType: 'SPEC', doc_type: 'SPEC', nameTh: 'ข้อกำหนดและสเปกมาตรฐาน (Standard Specification)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 5, required_approver_level: 5, requireAckDefault: true, require_ack_default: true, description: 'เกณฑ์มาตรฐานคุณลักษณะวัตถุดิบและผลิตภัณฑ์' },
  { docType: 'ED', doc_type: 'ED', nameTh: 'เอกสารภายนอกและกฎหมาย (External Document)', minRequesterLevel: 1, min_requester_level: 1, requiredReviewerLevel: 4, required_reviewer_level: 4, requiredApproverLevel: 6, required_approver_level: 6, requireAckDefault: false, require_ack_default: false, description: 'เอกสาร กฎหมาย มาตรฐาน และคู่มือจากหน่วยงานภายนอก' }
];

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
  signatureStampFormat: 'STANDARD_WITH_METADATA',
  allowDrawnSignature: true,
  allowUploadedSignature: true,
  allowTypographicSignature: true
};

export const DEFAULT_SLA_SETTINGS = {
  reviewSlaDays: 3,
  approvalSlaDays: 3,
  hardcopyReceiptSlaDays: 5,
  recallSlaDays: 7,
  darCreationSlaDays: 3
};

// ==========================================
// 2. Main Config & Policies Objects
// ==========================================
export const QMS_CONFIG = Object.freeze({
  /** All active departments in the organisation */
  departments: MASTER_DEPARTMENTS,

  /** All document types managed by the QMS */
  documentTypes: MASTER_DOCUMENT_TYPES,

  /** Level-threshold matrix per document type */
  approvalMatrix: DEFAULT_APPROVAL_MATRIX,

  /** 21 CFR Part 11 e-signature settings */
  signatureSettings: DEFAULT_SIGNATURE_SETTINGS,

  /** SLA durations (in working days) */
  slaSettings: DEFAULT_SLA_SETTINGS,

  /** Dept codes that hold system/DCC core functions */
  systemCoreDepts: SYSTEM_CORE_DEPTS,

  /** Dept codes with cross-organisational review/approve authority */
  crossOrgDepts: CROSS_ORG_DEPTS,

  /** Seed user list (used as fallback when DB/IndexedDB is empty) */
  seedUsers: []
});

export const QMS_POLICIES = Object.freeze({
  // 1. นโยบายเหตุผลการทำ DAR
  CHANGE_REASONS: [
    { id: 'NEW_PROCESS', labelTh: 'จัดทำใหม่สำหรับกระบวนการใหม่', applicableTo: ['NEW'] },
    { id: 'PERIODIC_REVIEW', labelTh: 'ทบทวนประจำปี', applicableTo: ['REVISE'] },
    { id: 'CAR_PAR', labelTh: 'แก้ไขตามข้อบกพร่องจากการตรวจติดตาม (CAR/PAR)', applicableTo: ['REVISE'] },
    { id: 'PROCESS_IMPROVEMENT', labelTh: 'ปรับปรุงประสิทธิภาพการทำงาน', applicableTo: ['REVISE'] },
    { id: 'OBSOLETE_PROCESS', labelTh: 'ยกเลิกเนื่องจากยุบเลิกกระบวนการ/ไม่มีการใช้งาน', applicableTo: ['OBSOLETE'] }
  ],

  // 2. นโยบาย SLA และการคำนวณวันครบกำหนด (Due Date)
  SLA_POLICIES: {
    FAST_TRACK: { id: 'FAST_TRACK', label: 'งานด่วน (Fast-Track)', targetDays: 0, badgeColor: 'amber' },
    URGENT:     { id: 'URGENT',     label: 'ด่วนพิเศษ',          targetDays: 3, badgeColor: 'orange' },
    NORMAL:     { id: 'NORMAL',     label: 'งานทั่วไป',           targetDays: 7, badgeColor: 'blue' }
  },

  // 3. ระดับชั้นความลับของเอกสาร
  CONFIDENTIALITY_LEVELS: [
    { code: 'PUBLIC',       nameTh: 'ทั่วไป',   badgeColor: 'emerald' },
    { code: 'INTERNAL',     nameTh: 'ภายใน',   badgeColor: 'sky' },
    { code: 'CONFIDENTIAL', nameTh: 'ลับเฉพาะ', badgeColor: 'rose' }
  ],

  // 4. ข้อจำกัดและนโยบายความปลอดภัยของไฟล์
  FILE_POLICIES: {
    MAX_DOCUMENT_SIZE_MB: 25,
    MAX_SIGNATURE_SIZE_MB: 2,
    ALLOWED_DOCUMENT_EXTENSIONS: ['.pdf'],
    ALLOWED_SIGNATURE_EXTENSIONS: ['.png', '.jpg', '.jpeg']
  },

  // 5. พจนานุกรมกิจกรรม Audit Trail
  AUDIT_EVENTS: {
    DAR_SUBMITTED:       { code: 'DAR_SUBMITTED',       actionTh: 'ยื่นคำร้องขอเอกสาร',      severity: 'INFO' },
    DAR_REVIEW_APPROVED: { code: 'DAR_REVIEW_APPROVED', actionTh: 'ผ่านการทบทวนเอกสาร',     severity: 'SUCCESS' },
    DAR_REJECTED:        { code: 'DAR_REJECTED',        actionTh: 'ส่งกลับเพื่อแก้ไข',         severity: 'WARNING' },
    DAR_FINAL_APPROVED:  { code: 'DAR_FINAL_APPROVED',  actionTh: 'อนุมัติและประกาศใช้สมบูรณ์', severity: 'SUCCESS' },
    CONTROLLED_DOWNLOAD: { code: 'CONTROLLED_DOWNLOAD', actionTh: 'ดาวน์โหลดสำเนาควบคุม',     severity: 'AUDIT' }
  },

  // 6. UI Themes (Badge & Status Color Schemes)
  THEMES: {
    DEPARTMENTS: {
      QC: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
      PD: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
      EN: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
      FIN: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
      DC: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700' },
      MGMT: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
      EXEC: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' }
    }
  }
});

// ==========================================
// 3. Pure Lookup Helpers (อยู่ล่างสุด)
// ==========================================

/**
 * Resolve a department object by its id/code string (case-insensitive).
 * @param {string} deptId
 * @returns {Object|undefined}
 */
export const getDeptById = (deptId) => {
  if (!deptId) return undefined;
  const key = String(deptId).toUpperCase().trim();
  return MASTER_DEPARTMENTS.find(
    (d) => String(d.id || d.code || '').toUpperCase().trim() === key
  );
};

/**
 * Resolve a document type object by its code string (case-insensitive).
 * @param {string} docTypeCode
 * @returns {Object|undefined}
 */
export const getDocTypeById = (docTypeCode) => {
  if (!docTypeCode) return undefined;
  const key = String(docTypeCode).toUpperCase().trim();
  return MASTER_DOCUMENT_TYPES.find(
    (t) => String(t.id || t.code || '').toUpperCase().trim() === key
  );
};

/**
 * Get all active departments as { value, label } option pairs for dropdowns.
 * @returns {{ value: string, label: string }[]}
 */
export const getDeptOptions = () =>
  MASTER_DEPARTMENTS
    .filter((d) => !d.status || d.status === 'ACTIVE')
    .map((d) => ({
      value: d.id || d.code,
      label: d.name || d.nameTh || d.id,
      nameTh: d.nameTh || d.name,
      nameEn: d.nameEn || d.name,
      color: d.color,
    }));

/**
 * Get all active internal document types as { value, label } option pairs.
 * @param {{ includeExternal?: boolean }} opts
 * @returns {{ value: string, label: string }[]}
 */
export const getDocTypeOptions = ({ includeExternal = false } = {}) =>
  MASTER_DOCUMENT_TYPES
    .filter((t) => {
      if (!t.status || t.status !== 'ACTIVE') return false;
      if (!includeExternal && t.category === 'EXTERNAL') return false;
      return true;
    })
    .map((t) => ({
      value: t.id || t.code,
      label: `${t.code || t.id} – ${t.nameTh || t.name}`,
      nameTh: t.nameTh || t.name,
      nameEn: t.name,
      isFormType: t.is_form_type || false,
      namingPattern: t.namingPattern,
      reviewCycleMonths: t.reviewCycleMonths,
    }));

/**
 * Resolve approval level thresholds for a given document type code.
 * Falls back to { minRequesterLevel: 1, minReviewerLevel: 4, minApproverLevel: 5 }.
 *
 * @param {string} docTypeCode
 * @returns {{ minRequesterLevel: number, minReviewerLevel: number, minApproverLevel: number }}
 */
export const getApprovalThresholdsFromRegistry = (docTypeCode) => {
  const key = String(docTypeCode || '').toUpperCase().trim();
  const entry = DEFAULT_APPROVAL_MATRIX.find(
    (m) => String(m.docType || m.doc_type || '').toUpperCase().trim() === key
  );
  return {
    minRequesterLevel: entry?.minRequesterLevel ?? entry?.min_requester_level ?? 1,
    minReviewerLevel:
      entry?.requiredReviewerLevel ?? entry?.required_reviewer_level ?? 4,
    minApproverLevel:
      entry?.requiredApproverLevel ?? entry?.required_approver_level ?? 5,
  };
};

/**
 * Resolve whether a department id represents a cross-org authority.
 * @param {string} deptId
 * @returns {boolean}
 */
export const isCrossOrgDept = (deptId) => {
  if (!deptId) return false;
  const key = String(deptId).toUpperCase().trim();
  return CROSS_ORG_DEPTS.some(
    (d) => String(d).toUpperCase().trim() === key
  );
};

/**
 * Resolve the review cycle (months) for a given document type.
 * @param {string} docTypeCode
 * @returns {number}
 */
export const getReviewCycleMonths = (docTypeCode) => {
  const dt = getDocTypeById(docTypeCode);
  return dt?.reviewCycleMonths ?? 12;
};

/**
 * Resolve the naming pattern string for a given document type code.
 * e.g. 'SOP' → 'SOP-{Dept}-{##}'
 * @param {string} docTypeCode
 * @returns {string}
 */
export const getNamingPattern = (docTypeCode) => {
  const dt = getDocTypeById(docTypeCode);
  return dt?.namingPattern ?? `${String(docTypeCode || '').toUpperCase()}-{Dept}-{##}`;
};

/**
 * Resolve the Thai display name for a department id.
 * @param {string} deptId
 * @returns {string}
 */
export const getDeptNameTh = (deptId) => {
  const dept = getDeptById(deptId);
  return dept?.nameTh || dept?.name || deptId || '';
};

/**
 * Resolve the Thai display name for a document type code.
 * @param {string} docTypeCode
 * @returns {string}
 */
export const getDocTypeNameTh = (docTypeCode) => {
  const dt = getDocTypeById(docTypeCode);
  return dt?.nameTh || dt?.name || docTypeCode || '';
};

/**
 * Check whether a document type code is an external document type.
 * External documents (ED) bypass the standard DAR workflow.
 * @param {string} docTypeCode
 * @returns {boolean}
 */
export const isExternalDocType = (docTypeCode) => {
  const dt = getDocTypeById(docTypeCode);
  return dt?.category === 'EXTERNAL' || dt?.isFormBypass === true;
};

/**
 * Check whether a document type is a form/record type.
 * Form types (FM) may have different distribution requirements.
 * @param {string} docTypeCode
 * @returns {boolean}
 */
export const isFormDocType = (docTypeCode) => {
  const dt = getDocTypeById(docTypeCode);
  return dt?.is_form_type === true;
};

/**
 * Get Change Reasons filtered by DAR action type (NEW, REVISE, OBSOLETE)
 * @param {'NEW'|'REVISE'|'OBSOLETE'} darType
 * @returns {Array<{ id: string, labelTh: string, applicableTo: string[] }>}
 */
export const getChangeReasonsByDarType = (darType = 'NEW') => {
  const normType = String(darType).toUpperCase();
  return QMS_POLICIES.CHANGE_REASONS.filter(r => r.applicableTo.includes(normType));
};

/**
 * Get UI theme configuration for a given department id.
 * @param {string} deptId
 * @returns {{ bg: string, text: string, border: string, avatar: string }}
 */
export const getDepartmentTheme = (deptId) => {
  const defaultTheme = {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    avatar: 'bg-slate-700 text-white'
  };
  if (!deptId) return defaultTheme;

  const key = String(deptId).toUpperCase().trim();
  const cleanKey = (key === 'QA' || key === 'QA/QC' || key === 'QAQC') ? 'QC' : (key === 'DCC' ? 'DC' : key);
  const theme = QMS_POLICIES.THEMES.DEPARTMENTS[cleanKey];
  if (!theme) return defaultTheme;

  const avatarMap = {
    QC: 'bg-emerald-600 text-white',
    PD: 'bg-blue-600 text-white',
    EN: 'bg-amber-600 text-white',
    FIN: 'bg-purple-600 text-white',
    DC: 'bg-sky-600 text-white',
    MGMT: 'bg-rose-600 text-white',
    EXEC: 'bg-indigo-600 text-white'
  };

  return {
    ...theme,
    avatar: avatarMap[cleanKey] || defaultTheme.avatar
  };
};

/**
 * Get unified CSS class string for department badge.
 * @param {string} deptId
 * @returns {string}
 */
export const getDepartmentBadgeClasses = (deptId) => {
  const theme = getDepartmentTheme(deptId);
  return `${theme.bg} ${theme.text} ${theme.border}`;
};

/**
 * Calculate due date based on SLA policies.
 * @param {'FAST_TRACK'|'URGENT'|'NORMAL'|boolean} slaPolicyOrFastTrack
 * @param {Date|string|number} [baseDate=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export const calculateDueDateBySla = (slaPolicyOrFastTrack, baseDate = new Date()) => {
  const start = baseDate instanceof Date ? new Date(baseDate) : new Date(baseDate || Date.now());
  const d = isNaN(start.getTime()) ? new Date() : start;

  let policyKey = 'NORMAL';
  if (slaPolicyOrFastTrack === true || slaPolicyOrFastTrack === 'FAST_TRACK') {
    policyKey = 'FAST_TRACK';
  } else if (slaPolicyOrFastTrack === 'URGENT') {
    policyKey = 'URGENT';
  } else if (slaPolicyOrFastTrack === 'NORMAL' || slaPolicyOrFastTrack === false) {
    policyKey = 'NORMAL';
  }

  const policy = QMS_POLICIES.SLA_POLICIES[policyKey] || QMS_POLICIES.SLA_POLICIES.NORMAL;
  const targetDays = policy.targetDays;

  // Advance by targetDays (handling calendar days)
  d.setDate(d.getDate() + targetDays);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default QMS_CONFIG;
