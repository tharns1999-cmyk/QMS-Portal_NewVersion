/**
 * QA Comprehensive Workflow Mock Data Engine & State Seeding
 * 
 * Sets up a realistic, fully-populated, enterprise-grade test dataset
 * with Requester from QA (Level 4 Supervisor: U005 - บีม),
 * Reviewer (Level 5: U003 - กัลยาณี), and Approver (Level 6 GM: U004 - คุณเรย์).
 */

export const getMockQaSeedData = () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const dueSoonDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // ==========================================
  // 1. Active Documents (Existing in Library)
  // ==========================================
  const documents = [
    {
      id: 'DOC-QA-ACTIVE-01',
      title: 'SOP-QA-003',
      name: 'ระเบียบปฏิบัติการควบคุมการดาวน์โหลดและการแจกจ่ายเอกสาร',
      doc_code: 'SOP-QA-003',
      docCode: 'SOP-QA-003',
      docName: 'ระเบียบปฏิบัติการควบคุมการดาวน์โหลดและการแจกจ่ายเอกสาร',
      docTitle: 'SOP-QA-003',
      status: 'EFFECTIVE',
      department: 'QA',
      dept: 'QA',
      ownerId: 'U005',
      ownerName: 'บีม',
      rev: '00',
      doc_version: '00',
      effectiveDate: '2025-08-15',
      reviewCycleMonths: 12,
      access_control: {
        scope: 'GENERAL',
        authorized_depts: [],
        authorized_users: [],
        min_access_level: 1
      },
      accessScope: 'General',
      is_physical_copy: true,
      isPhysicalCopy: true,
      distributions: [
        { copy_number: '01', copy_no: '01', department: 'QA', location: 'QA Head Office', station_name: 'QA Head Office' }
      ],
      related_standards: ['ISO 9001:2015', '21 CFR Part 11 (Electronic Records & Signatures)'],
      relatedStandards: ['ISO 9001:2015', '21 CFR Part 11 (Electronic Records & Signatures)']
    },
    {
      id: 'DOC-QA-ACTIVE-02',
      title: 'FM-QA-001',
      name: 'แบบฟอร์มบันทึกการตรวจรับวัตถุดิบและบรรจุภัณฑ์',
      doc_code: 'FM-QA-001',
      docCode: 'FM-QA-001',
      docName: 'แบบฟอร์มบันทึกการตรวจรับวัตถุดิบและบรรจุภัณฑ์',
      docTitle: 'FM-QA-001',
      status: 'EFFECTIVE',
      department: 'QA',
      dept: 'QA',
      ownerId: 'U005',
      ownerName: 'บีม',
      rev: '01',
      doc_version: '01',
      effectiveDate: '2025-01-10',
      reviewCycleMonths: 24,
      access_control: {
        scope: 'TARGETED',
        authorized_depts: ['QA', 'WH', 'PD'],
        authorized_users: [],
        min_access_level: 1
      },
      accessScope: 'Department',
      is_physical_copy: true,
      isPhysicalCopy: true,
      distributions: [
        { copy_number: '01', copy_no: '01', department: 'QA', location: 'QA Head Office', station_name: 'QA Head Office' },
        { copy_number: '02', copy_no: '02', department: 'WH', location: 'คลังสินค้าวัตถุดิบ RM Store', station_name: 'คลังสินค้าวัตถุดิบ RM Store' }
      ],
      related_standards: ['ISO 9001:2015', 'FSSC 22000'],
      relatedStandards: ['ISO 9001:2015', 'FSSC 22000']
    }
  ];

  // ==========================================
  // 2. Controlled Copy Instances
  // ==========================================
  const controlledCopyInstances = [
    {
      id: 'CC-QA-003-01',
      doc_id: 'DOC-QA-ACTIVE-01',
      docId: 'DOC-QA-ACTIVE-01',
      doc_code: 'SOP-QA-003',
      docTitle: 'SOP-QA-003',
      docName: 'ระเบียบปฏิบัติการควบคุมการดาวน์โหลดและการแจกจ่ายเอกสาร',
      doc_version: '00',
      rev: '00',
      copy_no: '01',
      ccNumber: '01',
      issue_no: '01',
      holder_dept: 'QA',
      department: 'QA',
      location: 'QA Head Office',
      locationName: 'QA Head Office',
      status: 'ISSUED_ACTIVE',
      is_replacement: false,
      dispatched_at: '2025-08-16T08:00:00Z',
      receipt_confirmed_at: '2025-08-16T09:00:00Z',
      receipt_confirmed_by: 'บีม',
      receipt_remarks: 'ตรวจสอบเล่มเอกสารและประทับตราสำเนาควบคุมเรียบร้อย'
    },
    {
      id: 'CC-QA-FM001-01',
      doc_id: 'DOC-QA-ACTIVE-02',
      docId: 'DOC-QA-ACTIVE-02',
      doc_code: 'FM-QA-001',
      docTitle: 'FM-QA-001',
      docName: 'แบบฟอร์มบันทึกการตรวจรับวัตถุดิบและบรรจุภัณฑ์',
      doc_version: '01',
      rev: '01',
      copy_no: '01',
      ccNumber: '01',
      issue_no: '01',
      holder_dept: 'QA',
      department: 'QA',
      location: 'QA Head Office',
      locationName: 'QA Head Office',
      status: 'ISSUED_ACTIVE',
      is_replacement: false,
      dispatched_at: '2025-01-11T08:00:00Z',
      receipt_confirmed_at: '2025-01-11T09:00:00Z',
      receipt_confirmed_by: 'บีม',
      receipt_remarks: 'รับมอบเล่มทะเบียนแบบฟอร์มประจำจุด QA'
    },
    {
      id: 'CC-QA-FM001-02',
      doc_id: 'DOC-QA-ACTIVE-02',
      docId: 'DOC-QA-ACTIVE-02',
      doc_code: 'FM-QA-001',
      docTitle: 'FM-QA-001',
      docName: 'แบบฟอร์มบันทึกการตรวจรับวัตถุดิบและบรรจุภัณฑ์',
      doc_version: '01',
      rev: '01',
      copy_no: '02',
      ccNumber: '02',
      issue_no: '01',
      holder_dept: 'WH',
      department: 'WH',
      location: 'คลังสินค้าวัตถุดิบ RM Store',
      locationName: 'คลังสินค้าวัตถุดิบ RM Store',
      status: 'ISSUED_ACTIVE',
      is_replacement: false,
      dispatched_at: '2025-01-11T08:30:00Z',
      receipt_confirmed_at: '2025-01-11T10:00:00Z',
      receipt_confirmed_by: 'สุรชัย (WH)',
      receipt_remarks: 'รับมอบเล่มแบบฟอร์มประจำคลังสินค้า'
    }
  ];

  // ==========================================
  // 3. DAR Requests (Internal Workflow)
  // ==========================================
  const dars = [
    // Case 1: General Scope + Multi-Copy (Pending Review)
    {
      id: 'DAR-2608-001',
      darNo: 'DAR-2608-001',
      dar_no: 'DAR-2608-001',
      type: 'NEW',
      doc_type: 'SOP',
      docType: 'SOP',
      doc_code: 'SOP-QA-001',
      title: 'SOP-QA-001',
      docTitle: 'SOP-QA-001',
      doc_name: 'ระเบียบปฏิบัติงานระบบตรวจประเมินคุณภาพภายใน (Internal Quality Audit)',
      name: 'ระเบียบปฏิบัติงานระบบตรวจประเมินคุณภาพภายใน (Internal Quality Audit)',
      status: 'PENDING_REVIEW',
      department: 'QA',
      dept: 'QA',
      requesterId: 'U005',
      requester_id: 'U005',
      requester_name: 'บีม',
      requesterName: 'บีม',
      requester_dept: 'QA',
      requesterDept: 'QA',
      requester_level: 4,
      reviewerId: 'U003',
      reviewer_id: 'U003',
      reviewer_name: 'กัลยาณี พลไกร',
      reviewerName: 'กัลยาณี พลไกร',
      approverId: 'U004',
      approver_id: 'U004',
      approver_name: 'คุณเรย์',
      approverName: 'คุณเรย์',
      requestDate: '2026-08-20T08:30:00.000Z',
      request_date: '2026-08-20T08:30:00.000Z',
      effectiveDate: '2026-09-01',
      effective_date: '2026-09-01',
      doc_version: '01',
      rev: '01',
      reason: 'จัดทำระเบียบปฏิบัติการตรวจประเมินคุณภาพภายในตามข้อกำหนด ISO 9001:2015 ข้อ 9.2 เพื่อรองรับรอบการตรวจประเมินประจำปี',
      change_details: 'กำหนดหลักเกณฑ์การแต่งตั้งผู้ตรวจประเมินอิสระ (Lead Auditor), แผนผังการตรวจประเมิน Audit Plan, การเปิด CAR/PAR และการรายงานผลต่อฝ่ายบริหาร',
      changeDetails: 'กำหนดหลักเกณฑ์การแต่งตั้งผู้ตรวจประเมินอิสระ (Lead Auditor), แผนผังการตรวจประเมิน Audit Plan, การเปิด CAR/PAR และการรายงานผลต่อฝ่ายบริหาร',
      access_control: {
        scope: 'GENERAL',
        authorized_depts: [],
        authorized_users: [],
        min_access_level: 1
      },
      accessScope: 'General',
      is_physical_copy: true,
      isPhysicalCopy: true,
      distributions: [
        { copy_number: '01', copy_no: '01', department: 'QA', location: 'QA Head Office', station_name: 'QA Head Office' },
        { copy_number: '02', copy_no: '02', department: 'PD', location: 'Line 1 - Mixing (ห้องผสม)', station_name: 'Line 1 - Mixing (ห้องผสม)' },
        { copy_number: '03', copy_no: '03', department: 'WH', location: 'คลังสินค้าวัตถุดิบ RM Store', station_name: 'คลังสินค้าวัตถุดิบ RM Store' }
      ],
      distribution_locations: [
        { copy_number: '01', copy_no: '01', department: 'QA', location: 'QA Head Office', station_name: 'QA Head Office' },
        { copy_number: '02', copy_no: '02', department: 'PD', location: 'Line 1 - Mixing (ห้องผสม)', station_name: 'Line 1 - Mixing (ห้องผสม)' },
        { copy_number: '03', copy_no: '03', department: 'WH', location: 'คลังสินค้าวัตถุดิบ RM Store', station_name: 'คลังสินค้าวัตถุดิบ RM Store' }
      ],
      related_standards: ['ISO 9001:2015', 'FSSC 22000'],
      relatedStandards: ['ISO 9001:2015', 'FSSC 22000']
    },

    // Case 2: Department Only Scope + Paperless WI (Pending Approval)
    {
      id: 'DAR-2608-002',
      darNo: 'DAR-2608-002',
      dar_no: 'DAR-2608-002',
      type: 'NEW',
      doc_type: 'WI',
      docType: 'WI',
      doc_code: 'WI-QA-001',
      title: 'WI-QA-001',
      docTitle: 'WI-QA-001',
      doc_name: 'วิธีปฏิบัติงานการทดสอบและวิเคราะห์ความปลอดภัยแล็บเคมี (Chemical Lab Safety Analysis)',
      name: 'วิธีปฏิบัติงานการทดสอบและวิเคราะห์ความปลอดภัยแล็บเคมี (Chemical Lab Safety Analysis)',
      status: 'PENDING_APPROVAL',
      department: 'QA',
      dept: 'QA',
      requesterId: 'U005',
      requester_id: 'U005',
      requester_name: 'บีม',
      requesterName: 'บีม',
      requester_dept: 'QA',
      requesterDept: 'QA',
      requester_level: 4,
      reviewerId: 'U003',
      reviewer_id: 'U003',
      reviewer_name: 'กัลยาณี พลไกร',
      reviewerName: 'กัลยาณี พลไกร',
      approverId: 'U004',
      approver_id: 'U004',
      approver_name: 'คุณเรย์',
      approverName: 'คุณเรย์',
      requestDate: '2026-08-18T09:00:00.000Z',
      request_date: '2026-08-18T09:00:00.000Z',
      effectiveDate: '2026-08-28',
      effective_date: '2026-08-28',
      doc_version: '01',
      rev: '01',
      reason: 'กำหนดแนวปฏิบัติเพื่อความปลอดภัยในการเตรียมสารเคมีและการใช้งานตู้ดูดควัน (Fume Hood) ในห้องแล็บ QA',
      change_details: 'ขั้นตอนการสวมใส่อุปกรณ์ PPE, การจัดเก็บสารเคมีตามเกณฑ์ SDS และแนวทางจัดการสารเคมีรั่วไหลฉุกเฉิน',
      changeDetails: 'ขั้นตอนการสวมใส่อุปกรณ์ PPE, การจัดเก็บสารเคมีตามเกณฑ์ SDS และแนวทางจัดการสารเคมีรั่วไหลฉุกเฉิน',
      access_control: {
        scope: 'DEPT_ONLY',
        authorized_depts: ['QA'],
        authorized_users: [],
        min_access_level: 1
      },
      accessScope: 'Department',
      is_physical_copy: false,
      isPhysicalCopy: false,
      distributions: [],
      distribution_locations: [],
      related_standards: ['ISO 9001:2015', 'ISO 45001:2018 (Occupational Health & Safety)'],
      relatedStandards: ['ISO 9001:2015', 'ISO 45001:2018 (Occupational Health & Safety)']
    },

    // Case 3: Targeted Scope + Master Only SD/Spec (Pending Review)
    {
      id: 'DAR-2608-003',
      darNo: 'DAR-2608-003',
      dar_no: 'DAR-2608-003',
      type: 'NEW',
      doc_type: 'SD',
      docType: 'SD',
      doc_code: 'SD-QA-001',
      title: 'SD-QA-001',
      docTitle: 'SD-QA-001',
      doc_name: 'ข้อกำหนดมาตรฐานสเปกบรรจุภัณฑ์และเกณฑ์การตรวจรับ (Packaging Specification & Acceptance Criteria)',
      name: 'ข้อกำหนดมาตรฐานสเปกบรรจุภัณฑ์และเกณฑ์การตรวจรับ (Packaging Specification & Acceptance Criteria)',
      status: 'PENDING_REVIEW',
      department: 'QA',
      dept: 'QA',
      requesterId: 'U005',
      requester_id: 'U005',
      requester_name: 'บีม',
      requesterName: 'บีม',
      requester_dept: 'QA',
      requesterDept: 'QA',
      requester_level: 4,
      reviewerId: 'U003',
      reviewer_id: 'U003',
      reviewer_name: 'กัลยาณี พลไกร',
      reviewerName: 'กัลยาณี พลไกร',
      approverId: 'U004',
      approver_id: 'U004',
      approver_name: 'คุณเรย์',
      approverName: 'คุณเรย์',
      requestDate: '2026-08-21T10:00:00.000Z',
      request_date: '2026-08-21T10:00:00.000Z',
      effectiveDate: '2026-09-05',
      effective_date: '2026-09-05',
      doc_version: '01',
      rev: '01',
      reason: 'ปรับปรุงและรวบรวมเกณฑ์สเปกบรรจุภัณฑ์ Food-Grade และค่า Tolerance สำหรับตรวจรับหน้างาน',
      change_details: 'กำหนดสเปกความหนาของฟิล์ม, การทดสอบ Leakage Test และเอกสาร Certificate of Analysis (CoA) จากซัพพลายเออร์',
      changeDetails: 'กำหนดสเปกความหนาของฟิล์ม, การทดสอบ Leakage Test และเอกสาร Certificate of Analysis (CoA) จากซัพพลายเออร์',
      access_control: {
        scope: 'TARGETED',
        authorized_depts: ['QA', 'PD', 'WH'],
        authorized_users: [],
        min_access_level: 1
      },
      accessScope: 'Department',
      is_physical_copy: true,
      isPhysicalCopy: true,
      distributions: [
        { copy_number: '01', copy_no: '01', department: 'QA', location: 'QA Head Office', station_name: 'QA Head Office' }
      ],
      distribution_locations: [
        { copy_number: '01', copy_no: '01', department: 'QA', location: 'QA Head Office', station_name: 'QA Head Office' }
      ],
      related_standards: ['ISO 9001:2015', 'FSSC 22000', 'Codex Alimentarius'],
      relatedStandards: ['ISO 9001:2015', 'FSSC 22000', 'Codex Alimentarius']
    },

    // Case 4: Restricted Scope + Paperless Crisis SOP (Pending Approval)
    {
      id: 'DAR-2608-004',
      darNo: 'DAR-2608-004',
      dar_no: 'DAR-2608-004',
      type: 'NEW',
      doc_type: 'SOP',
      docType: 'SOP',
      doc_code: 'SOP-QA-002',
      title: 'SOP-QA-002',
      docTitle: 'SOP-QA-002',
      doc_name: 'ระเบียบปฏิบัติการบริหารภาวะวิกฤตและเหตุฉุกเฉินคุณภาพ (Crisis Management & Business Continuity)',
      name: 'ระเบียบปฏิบัติการบริหารภาวะวิกฤตและเหตุฉุกเฉินคุณภาพ (Crisis Management & Business Continuity)',
      status: 'PENDING_APPROVAL',
      department: 'QA',
      dept: 'QA',
      requesterId: 'U005',
      requester_id: 'U005',
      requester_name: 'บีม',
      requesterName: 'บีม',
      requester_dept: 'QA',
      requesterDept: 'QA',
      requester_level: 4,
      reviewerId: 'U003',
      reviewer_id: 'U003',
      reviewer_name: 'กัลยาณี พลไกร',
      reviewerName: 'กัลยาณี พลไกร',
      approverId: 'U004',
      approver_id: 'U004',
      approver_name: 'คุณเรย์',
      approverName: 'คุณเรย์',
      requestDate: '2026-08-19T14:00:00.000Z',
      request_date: '2026-08-19T14:00:00.000Z',
      effectiveDate: '2026-09-01',
      effective_date: '2026-09-01',
      doc_version: '01',
      rev: '01',
      reason: 'จัดทำแผนการบริหารความต่อเนื่องทางธุรกิจ (BCP) และการรับมือเหตุการณ์วิกฤตที่อาจส่งผลกระทบต่อคุณภาพผลิตภัณฑ์',
      change_details: 'กำหนดโครงสร้างคณะกรรมการบริหารภาวะฉุกเฉิน (Incident Command Team), ขั้นตอนการสื่อสารภายนอก และการเรียกคืนผลิตภัณฑ์ขั้นวิกฤต',
      changeDetails: 'กำหนดโครงสร้างคณะกรรมการบริหารภาวะฉุกเฉิน (Incident Command Team), ขั้นตอนการสื่อสารภายนอก และการเรียกคืนผลิตภัณฑ์ขั้นวิกฤต',
      access_control: {
        scope: 'RESTRICTED',
        authorized_depts: ['QA'],
        authorized_users: ['U001', 'U003', 'U004', 'U005'],
        min_access_level: 4
      },
      accessScope: 'Restricted',
      is_physical_copy: false,
      isPhysicalCopy: false,
      distributions: [],
      distribution_locations: [],
      related_standards: ['ISO 9001:2015', 'ISO 22301 (Business Continuity)'],
      relatedStandards: ['ISO 9001:2015', 'ISO 22301 (Business Continuity)']
    },

    // Case 5: Revision Workflow on SOP-QA-003 (Pending Review)
    {
      id: 'DAR-2608-005',
      darNo: 'DAR-2608-005',
      dar_no: 'DAR-2608-005',
      type: 'REVISION',
      doc_type: 'SOP',
      docType: 'SOP',
      docId: 'DOC-QA-ACTIVE-01',
      doc_id: 'DOC-QA-ACTIVE-01',
      doc_code: 'SOP-QA-003',
      title: 'SOP-QA-003',
      docTitle: 'SOP-QA-003',
      doc_name: 'ระเบียบปฏิบัติการควบคุมการดาวน์โหลดและการแจกจ่ายเอกสาร',
      name: 'ระเบียบปฏิบัติการควบคุมการดาวน์โหลดและการแจกจ่ายเอกสาร',
      status: 'PENDING_REVIEW',
      department: 'QA',
      dept: 'QA',
      requesterId: 'U005',
      requester_id: 'U005',
      requester_name: 'บีม',
      requesterName: 'บีม',
      requester_dept: 'QA',
      requesterDept: 'QA',
      requester_level: 4,
      reviewerId: 'U003',
      reviewer_id: 'U003',
      reviewer_name: 'กัลยาณี พลไกร',
      reviewerName: 'กัลยาณี พลไกร',
      approverId: 'U004',
      approver_id: 'U004',
      approver_name: 'คุณเรย์',
      approverName: 'คุณเรย์',
      requestDate: '2026-08-22T08:00:00.000Z',
      request_date: '2026-08-22T08:00:00.000Z',
      effectiveDate: '2026-09-01',
      effective_date: '2026-09-01',
      doc_version: '01',
      rev: '01',
      revisesRev: '00',
      reason: 'ปรับปรุงขั้นตอนการขอดาวน์โหลดสำเนาไม่ควบคุม (Uncontrolled Copy) และกำหนดสิทธิ์การเข้าถึงผ่านระบบ QMS Portal',
      change_details: 'เพิ่มเงื่อนไขการประทับลายน้ำอิเล็กทรอนิกส์ (Digital Watermark 45°), วันที่และเวลาดาวน์โหลดตามเวลาประเทศไทย และการบันทึก Audit Trail อัตโนมัติ',
      changeDetails: 'เพิ่มเงื่อนไขการประทับลายน้ำอิเล็กทรอนิกส์ (Digital Watermark 45°), วันที่และเวลาดาวน์โหลดตามเวลาประเทศไทย และการบันทึก Audit Trail อัตโนมัติ',
      access_control: {
        scope: 'GENERAL',
        authorized_depts: [],
        authorized_users: [],
        min_access_level: 1
      },
      accessScope: 'General',
      is_physical_copy: true,
      isPhysicalCopy: true,
      distributions: [
        { copy_number: '01', copy_no: '01', department: 'QA', location: 'QA Head Office', station_name: 'QA Head Office' }
      ],
      distribution_locations: [
        { copy_number: '01', copy_no: '01', department: 'QA', location: 'QA Head Office', station_name: 'QA Head Office' }
      ],
      related_standards: ['ISO 9001:2015', '21 CFR Part 11 (Electronic Records & Signatures)'],
      relatedStandards: ['ISO 9001:2015', '21 CFR Part 11 (Electronic Records & Signatures)']
    },

    // Case 6: Obsolete Workflow on FM-QA-001 (Pending Approval)
    {
      id: 'DAR-2608-006',
      darNo: 'DAR-2608-006',
      dar_no: 'DAR-2608-006',
      type: 'OBSOLETE',
      doc_type: 'FM',
      docType: 'FM',
      docId: 'DOC-QA-ACTIVE-02',
      doc_id: 'DOC-QA-ACTIVE-02',
      doc_code: 'FM-QA-001',
      title: 'FM-QA-001',
      docTitle: 'FM-QA-001',
      doc_name: 'แบบฟอร์มบันทึกการตรวจรับวัตถุดิบและบรรจุภัณฑ์',
      name: 'แบบฟอร์มบันทึกการตรวจรับวัตถุดิบและบรรจุภัณฑ์',
      status: 'PENDING_APPROVAL',
      department: 'QA',
      dept: 'QA',
      requesterId: 'U005',
      requester_id: 'U005',
      requester_name: 'บีม',
      requesterName: 'บีม',
      requester_dept: 'QA',
      requesterDept: 'QA',
      requester_level: 4,
      reviewerId: 'U003',
      reviewer_id: 'U003',
      reviewer_name: 'กัลยาณี พลไกร',
      reviewerName: 'กัลยาณี พลไกร',
      approverId: 'U004',
      approver_id: 'U004',
      approver_name: 'คุณเรย์',
      approverName: 'คุณเรย์',
      requestDate: '2026-08-23T11:00:00.000Z',
      request_date: '2026-08-23T11:00:00.000Z',
      effectiveDate: '2026-09-01',
      effective_date: '2026-09-01',
      doc_version: '01',
      rev: '01',
      reason: 'ยกเลิกการใช้ฟอร์มกระดาษเนื่องจากเปลี่ยนผ่านไปสู่ระบบตรวจรับบันทึกดิจิทัล 100% (Digital Warehouse Inbound Inspection)',
      change_details: 'ยกเลิกการใช้งานเล่มฟอร์ม FM-QA-001 ทุกจุดใช้งาน และให้เจ้าหน้าที่ DCC ดำเนินการเก็บคืนสำเนาเดิมจาก QA และ WH เพื่อทำลายตามข้อกำหนด 7.5.3.2',
      changeDetails: 'ยกเลิกการใช้งานเล่มฟอร์ม FM-QA-001 ทุกจุดใช้งาน และให้เจ้าหน้าที่ DCC ดำเนินการเก็บคืนสำเนาเดิมจาก QA และ WH เพื่อทำลายตามข้อกำหนด 7.5.3.2',
      access_control: {
        scope: 'TARGETED',
        authorized_depts: ['QA', 'WH', 'PD'],
        authorized_users: [],
        min_access_level: 1
      },
      accessScope: 'Department',
      is_physical_copy: true,
      isPhysicalCopy: true,
      distributions: [
        { copy_number: '01', copy_no: '01', department: 'QA', location: 'QA Head Office', station_name: 'QA Head Office' },
        { copy_number: '02', copy_no: '02', department: 'WH', location: 'คลังสินค้าวัตถุดิบ RM Store', station_name: 'คลังสินค้าวัตถุดิบ RM Store' }
      ],
      distribution_locations: [
        { copy_number: '01', copy_no: '01', department: 'QA', location: 'QA Head Office', station_name: 'QA Head Office' },
        { copy_number: '02', copy_no: '02', department: 'WH', location: 'คลังสินค้าวัตถุดิบ RM Store', station_name: 'คลังสินค้าวัตถุดิบ RM Store' }
      ],
      related_standards: ['ISO 9001:2015', 'FSSC 22000'],
      relatedStandards: ['ISO 9001:2015', 'FSSC 22000']
    }
  ];

  // ==========================================
  // 4. External Documents (ED-QA-XX)
  // ==========================================
  const externalDocuments = [
    {
      id: 'ED-QA-01',
      edCode: 'ED-QA-01',
      doc_code: 'ED-QA-01',
      docNo: 'ED-QA-01',
      title: 'ISO 9001:2015 Quality Management Systems - Requirements',
      docTitle: 'ISO 9001:2015 Quality Management Systems - Requirements',
      source: 'International Organization for Standardization (ISO)',
      sourceVersion: '5th Edition (2015)',
      department: 'QA',
      dept: 'QA',
      status: 'PENDING_EXT_REVIEW',
      accessScope: 'General',
      accessDepartments: [],
      accessUsers: [],
      effectiveDate: '2026-01-01',
      reviewCycleMonths: 12,
      reviewerId: 'U003',
      approverId: 'U004',
      createdAt: '2026-08-20T08:30:00.000Z'
    },
    {
      id: 'ED-QA-02',
      edCode: 'ED-QA-02',
      doc_code: 'ED-QA-02',
      docNo: 'ED-QA-02',
      title: 'General Principles of Food Hygiene (CXC 1-1969 Rev. 2020) GHPs and HACCP System',
      docTitle: 'General Principles of Food Hygiene (CXC 1-1969 Rev. 2020) GHPs and HACCP System',
      source: 'Codex Alimentarius Commission (FAO/WHO)',
      sourceVersion: 'Rev. 2020',
      department: 'QA',
      dept: 'QA',
      status: 'PENDING_EXT_APPROVAL',
      accessScope: 'Department',
      accessDepartments: ['QA', 'PD', 'WH'],
      accessUsers: [],
      effectiveDate: '2026-02-01',
      reviewCycleMonths: 12,
      reviewerId: 'U003',
      approverId: 'U004',
      createdAt: '2026-08-18T09:00:00.000Z'
    },
    {
      id: 'ED-QA-03',
      edCode: 'ED-QA-03',
      doc_code: 'ED-QA-03',
      docNo: 'ED-QA-03',
      title: 'Compendium of Methods for the Microbiological Examination of Foods',
      docTitle: 'Compendium of Methods for the Microbiological Examination of Foods',
      source: 'American Public Health Association (APHA)',
      sourceVersion: '5th Edition',
      department: 'QA',
      dept: 'QA',
      status: 'ACTIVE',
      accessScope: 'Restricted',
      accessDepartments: ['QA'],
      accessUsers: ['U001', 'U003', 'U005'],
      effectiveDate: '2025-09-10',
      reviewCycleMonths: 12,
      nextReviewDate: dueSoonDate,
      reviewerId: 'U003',
      approverId: 'U004',
      createdAt: '2025-09-10T08:00:00.000Z'
    }
  ];

  // ==========================================
  // 5. Tasks (Synchronized Inbox)
  // ==========================================
  const tasks = [
    // Reviewer Tasks (U003 - กัลยาณี)
    {
      id: 'TASK-QA-REV-001',
      type: 'REVIEW',
      taskType: 'REVIEW',
      darId: 'DAR-2608-001',
      title: 'ทบทวนคำร้องขอออกเอกสารใหม่: SOP-QA-001 (Internal Quality Audit)',
      assigneeId: 'U003',
      status: 'PENDING',
      createdAt: '2026-08-20T08:30:00.000Z',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        darNo: 'DAR-2608-001',
        docCode: 'SOP-QA-001',
        docTitle: 'ระเบียบปฏิบัติงานระบบตรวจประเมินคุณภาพภายใน (Internal Quality Audit)',
        requesterName: 'บีม',
        requesterDept: 'QA',
        priority: 'HIGH'
      }
    },
    {
      id: 'TASK-QA-REV-002',
      type: 'REVIEW',
      taskType: 'REVIEW',
      darId: 'DAR-2608-003',
      title: 'ทบทวนคำร้องขอออกเอกสารใหม่: SD-QA-001 (Packaging Specification)',
      assigneeId: 'U003',
      status: 'PENDING',
      createdAt: '2026-08-21T10:00:00.000Z',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        darNo: 'DAR-2608-003',
        docCode: 'SD-QA-001',
        docTitle: 'ข้อกำหนดมาตรฐานสเปกบรรจุภัณฑ์และเกณฑ์การตรวจรับ',
        requesterName: 'บีม',
        requesterDept: 'QA',
        priority: 'NORMAL'
      }
    },
    {
      id: 'TASK-QA-REV-003',
      type: 'REVIEW',
      taskType: 'REVIEW',
      darId: 'DAR-2608-005',
      title: 'ทบทวนคำร้องขอแก้ไขเอกสาร: SOP-QA-003 Rev.01 (Document Control)',
      assigneeId: 'U003',
      status: 'PENDING',
      createdAt: '2026-08-22T08:00:00.000Z',
      dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        darNo: 'DAR-2608-005',
        docCode: 'SOP-QA-003',
        docTitle: 'ระเบียบปฏิบัติการควบคุมการดาวน์โหลดและการแจกจ่ายเอกสาร',
        requesterName: 'บีม',
        requesterDept: 'QA',
        priority: 'HIGH'
      }
    },
    {
      id: 'TASK-QA-REV-EXT-001',
      type: 'EXT_REVIEW',
      taskType: 'EXT_REVIEW',
      docId: 'ED-QA-01',
      edCode: 'ED-QA-01',
      title: 'ทบทวนการลงทะเบียนเอกสารภายนอก: ED-QA-01 (ISO 9001:2015)',
      assigneeId: 'U003',
      status: 'PENDING',
      createdAt: '2026-08-20T08:30:00.000Z',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        docCode: 'ED-QA-01',
        docTitle: 'ISO 9001:2015 Quality Management Systems - Requirements',
        requesterName: 'บีม',
        requesterDept: 'QA',
        priority: 'NORMAL'
      }
    },

    // Approver Tasks (U004 - คุณเรย์)
    {
      id: 'TASK-QA-APP-001',
      type: 'APPROVE',
      taskType: 'APPROVE',
      darId: 'DAR-2608-002',
      title: 'อนุมัติคำร้องขอออกเอกสารใหม่: WI-QA-001 (Chemical Lab Safety)',
      assigneeId: 'U004',
      status: 'PENDING',
      createdAt: '2026-08-18T09:00:00.000Z',
      dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        darNo: 'DAR-2608-002',
        docCode: 'WI-QA-001',
        docTitle: 'วิธีปฏิบัติงานการทดสอบและวิเคราะห์ความปลอดภัยแล็บเคมี',
        requesterName: 'บีม',
        requesterDept: 'QA',
        priority: 'HIGH'
      }
    },
    {
      id: 'TASK-QA-APP-002',
      type: 'APPROVE',
      taskType: 'APPROVE',
      darId: 'DAR-2608-004',
      title: 'อนุมัติคำร้องขอออกเอกสารใหม่: SOP-QA-002 (Crisis Management)',
      assigneeId: 'U004',
      status: 'PENDING',
      createdAt: '2026-08-19T14:00:00.000Z',
      dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        darNo: 'DAR-2608-004',
        docCode: 'SOP-QA-002',
        docTitle: 'ระเบียบปฏิบัติการบริหารภาวะวิกฤตและเหตุฉุกเฉินคุณภาพ',
        requesterName: 'บีม',
        requesterDept: 'QA',
        priority: 'URGENT'
      }
    },
    {
      id: 'TASK-QA-APP-003',
      type: 'APPROVE',
      taskType: 'APPROVE',
      darId: 'DAR-2608-006',
      title: 'อนุมัติคำร้องขอยกเลิกเอกสาร: FM-QA-001 (Inbound Inspection Form)',
      assigneeId: 'U004',
      status: 'PENDING',
      createdAt: '2026-08-23T11:00:00.000Z',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        darNo: 'DAR-2608-006',
        docCode: 'FM-QA-001',
        docTitle: 'แบบฟอร์มบันทึกการตรวจรับวัตถุดิบและบรรจุภัณฑ์',
        requesterName: 'บีม',
        requesterDept: 'QA',
        priority: 'NORMAL'
      }
    },
    {
      id: 'TASK-QA-APP-EXT-001',
      type: 'EXT_APPROVAL',
      taskType: 'EXT_APPROVAL',
      docId: 'ED-QA-02',
      edCode: 'ED-QA-02',
      title: 'อนุมัติการลงทะเบียนเอกสารภายนอก: ED-QA-02 (Codex GHPs)',
      assigneeId: 'U004',
      status: 'PENDING',
      createdAt: '2026-08-18T09:00:00.000Z',
      dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        docCode: 'ED-QA-02',
        docTitle: 'General Principles of Food Hygiene (CXC 1-1969 Rev. 2020) GHPs',
        requesterName: 'บีม',
        requesterDept: 'QA',
        priority: 'NORMAL'
      }
    }
  ];

  // ==========================================
  // 6. Action Logs & Audit Trail
  // ==========================================
  const actionLog = [
    {
      id: 'LOG-QA-001',
      actionType: 'DAR_SUBMITTED',
      action: 'ยื่นคำร้อง DAR ใหม่',
      actor: 'บีม (QAQC Supervisor)',
      performed_by: 'บีม',
      user: 'บีม',
      document_code: 'SOP-QA-001',
      docTitle: 'SOP-QA-001',
      details: 'ยื่นคำร้องขอออกระเบียบปฏิบัติงานระบบตรวจประเมินคุณภาพภายใน',
      timestamp: '2026-08-20T08:30:00.000Z',
      date: '2026-08-20T08:30:00.000Z',
      created_at: '2026-08-20T08:30:00.000Z',
      createdAt: '2026-08-20T08:30:00.000Z',
      category: 'DAR'
    },
    {
      id: 'LOG-QA-002',
      actionType: 'DAR_REVIEWED',
      action: 'ทบทวนคำร้อง DAR ผ่าน',
      actor: 'กัลยาณี พลไกร',
      performed_by: 'กัลยาณี พลไกร',
      user: 'กัลยาณี พลไกร',
      document_code: 'WI-QA-001',
      docTitle: 'WI-QA-001',
      details: 'ตรวจสอบความถูกต้องและข้อกำหนดความปลอดภัยแล็บเคมีเรียบร้อย ส่งต่อผู้อนุมัติ',
      timestamp: '2026-08-19T10:00:00.000Z',
      date: '2026-08-19T10:00:00.000Z',
      created_at: '2026-08-19T10:00:00.000Z',
      createdAt: '2026-08-19T10:00:00.000Z',
      category: 'DAR'
    },
    {
      id: 'LOG-QA-003',
      actionType: 'CC_DISPATCHED',
      action: 'ส่งมอบสำเนาควบคุม',
      actor: 'Admin QA (DCC)',
      performed_by: 'Admin QA (DCC)',
      user: 'Admin QA (DCC)',
      document_code: 'SOP-QA-003',
      copy_number: '01',
      details: 'ส่งมอบเล่มสำเนาควบคุม Copy 01 ประจำ QA Head Office เรียบร้อย',
      timestamp: '2025-08-16T08:00:00.000Z',
      date: '2025-08-16T08:00:00.000Z',
      created_at: '2025-08-16T08:00:00.000Z',
      createdAt: '2025-08-16T08:00:00.000Z',
      category: 'CONTROLLED_COPY'
    }
  ];

  return {
    dars,
    darRequests: dars,
    documents,
    externalDocuments,
    controlledCopyInstances,
    documentControlledCopies: controlledCopyInstances,
    tasks,
    actionLog,
    timeline: [
      {
        id: 'TL-QA-001',
        darId: 'DAR-2608-001',
        action: 'SUBMIT',
        actor: 'U005',
        timestamp: '2026-08-20T08:30:00.000Z',
        comment: 'ยื่นคำร้องขอออกระเบียบปฏิบัติการตรวจประเมินคุณภาพภายใน'
      },
      {
        id: 'TL-QA-002',
        darId: 'DAR-2608-002',
        action: 'REVIEW',
        actor: 'U003',
        timestamp: '2026-08-19T10:00:00.000Z',
        comment: 'ทบทวนเนื้อหาและมาตรการความปลอดภัยสารเคมีเรียบร้อย สมบูรณ์ครบถ้วน'
      }
    ]
  };
};
