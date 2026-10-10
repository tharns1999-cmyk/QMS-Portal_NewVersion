import { describe, it, expect, beforeEach, vi } from 'vitest';
import useStore, { canFastTrackReview } from '../store/useStore';
import { isActionableTask } from '../utils/taskFilter';

describe('Hybrid 2-Step Periodic Review Workflow (Staff -> HOD Approval with 1-Click Fast-Track)', () => {
  const MOCK_DATE = '2026-10-09';
  const INITIAL_NEXT_DATE = '2026-10-15';

  const mockStaffUser = {
    id: 'U-STAFF-01',
    name: 'Somchai Staff',
    role: 'STAFF',
    level: 2,
    approval_level: 2,
    department: 'PRD',
    primary_department: 'PRD',
    is_manager: false,
    isDeptHead: false
  };

  const mockHodUser = {
    id: 'U-HOD-01',
    name: 'Somkiat Manager',
    role: 'HOD',
    level: 4,
    approval_level: 4,
    department: 'PRD',
    primary_department: 'PRD',
    is_manager: true,
    isDeptHead: true
  };

  const mockDccUser = {
    id: 'U-DCC-01',
    name: 'Wipha DCC',
    role: 'DCC',
    level: 3,
    approval_level: 3,
    department: 'DC',
    primary_department: 'DC',
    isDcc: true,
    managedDepartments: ['*']
  };

  const initialDoc = {
    id: 'DOC-PRD-001',
    code: 'SOP-PRD-001',
    title: 'Standard Operating Procedure for Production Line A',
    rev: '01',
    revision: '01',
    department: 'PRD',
    dept: 'PRD',
    next_review_date: INITIAL_NEXT_DATE,
    review_status: 'UPCOMING',
    periodic_reviews: [],
    review_history: []
  };

  const initialSchedule = {
    id: 'SCH-PRD-001',
    documentId: 'DOC-PRD-001',
    documentNumber: 'SOP-PRD-001',
    documentName: 'Standard Operating Procedure for Production Line A',
    documentCategory: 'INTERNAL',
    ownerDepartmentId: 'PRD',
    status: 'ACTION_REQUIRED',
    dueState: 'DUE',
    cycleYears: 1,
    nextReviewDate: INITIAL_NEXT_DATE,
    currentScheduledReviewDate: INITIAL_NEXT_DATE,
    isActive: true
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${MOCK_DATE}T09:00:00Z`));

    useStore.setState({
      documents: [JSON.parse(JSON.stringify(initialDoc))],
      externalDocuments: [],
      periodicReviewSchedules: [JSON.parse(JSON.stringify(initialSchedule))],
      periodicReviewTasks: [],
      tasks: [],
      periodicReviewRecords: [],
      actionLog: [],
      currentUser: mockStaffUser
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Fast-Track Eligibility Evaluation', () => {
    it('evaluates Staff as NOT eligible for Fast-Track', () => {
      expect(canFastTrackReview(mockStaffUser, 'PRD')).toBe(false);
    });

    it('evaluates HOD/Manager of that department as eligible for Fast-Track', () => {
      expect(canFastTrackReview(mockHodUser, 'PRD')).toBe(true);
    });

    it('evaluates HOD of PRD as NOT eligible for Fast-Track in another department (e.g. QC)', () => {
      expect(canFastTrackReview(mockHodUser, 'QC')).toBe(false);
    });

    it('evaluates DCC Admin with wildcard scope as eligible for Fast-Track across departments', () => {
      expect(canFastTrackReview(mockDccUser, 'PRD')).toBe(true);
      expect(canFastTrackReview(mockDccUser, 'QC')).toBe(true);
    });
  });

  describe('2. Flow A: Staff Submits Periodic Review (2-Step Workflow)', () => {
    it('does NOT advance expiration date, creates PERIODIC_REVIEW_APPROVAL task for HOD, and sets status to PENDING_APPROVAL', () => {
      useStore.setState({ currentUser: mockStaffUser });

      const result = useStore.getState().submitPeriodicReview({
        scheduleId: 'SCH-PRD-001',
        outcome: 'NO_CHANGE',
        comment: 'เนื้อหาเอกสารยังคงสอดคล้องกับหน้างานจริง ไม่มีการเปลี่ยนแปลง',
        reviewDetails: {
          findings: 'ไม่มีข้อบกพร่อง',
          standards: 'ISO 9001:2015 Clause 7.5.3'
        }
      });

      expect(result.status).toBe('PENDING_APPROVAL');
      expect(result.fastTrack).toBe(false);
      expect(result.task).toBeDefined();

      const store = useStore.getState();
      const doc = store.documents.find(d => d.id === 'DOC-PRD-001');
      const sch = store.periodicReviewSchedules.find(s => s.id === 'SCH-PRD-001');
      const approvalTask = store.tasks.find(t => t.type === 'PERIODIC_REVIEW_APPROVAL');

      // Date must NOT be extended yet
      expect(doc.next_review_date).toBe(INITIAL_NEXT_DATE);
      expect(sch.nextReviewDate).toBe(INITIAL_NEXT_DATE);

      // Status must reflect pending approval
      expect(doc.review_status).toBe('PENDING_APPROVAL');
      expect(sch.status).toBe('PENDING_APPROVAL');
      expect(doc.pending_periodic_review).toBeDefined();
      expect(doc.pending_periodic_review.reviewer_id).toBe(mockStaffUser.id);
      expect(doc.pending_periodic_review.reviewer_name).toBe(mockStaffUser.name);

      // Task created for HOD
      expect(approvalTask).toBeDefined();
      expect(approvalTask.target_role).toBe('HOD');
      expect(approvalTask.department).toBe('PRD');
      expect(approvalTask.status).toBe('PENDING');
      expect(approvalTask.payload.doc_code).toBe('SOP-PRD-001');
    });

    it('enforces Separation of Duties: Staff who submitted cannot approve their own task in TaskInbox', () => {
      useStore.setState({ currentUser: mockStaffUser });

      useStore.getState().submitPeriodicReview({
        scheduleId: 'SCH-PRD-001',
        outcome: 'NO_CHANGE',
        comment: 'Staff reviewed'
      });

      const store = useStore.getState();
      const approvalTask = store.tasks.find(t => t.type === 'PERIODIC_REVIEW_APPROVAL');

      // Staff user should NOT find this task actionable
      expect(isActionableTask(approvalTask, mockStaffUser)).toBe(false);

      // HOD user of PRD MUST find this task actionable
      expect(isActionableTask(approvalTask, mockHodUser)).toBe(true);

      // User from another department (e.g. QC Staff) must NOT find this task actionable
      const otherUser = { id: 'U-QC-01', name: 'QC Staff', role: 'STAFF', level: 2, department: 'QC' };
      expect(isActionableTask(approvalTask, otherUser)).toBe(false);
    });
  });

  describe('3. Flow B: HOD Approves / Rejects Pending Periodic Review', () => {
    let approvalTaskId;

    beforeEach(() => {
      // Staff submits first
      useStore.setState({ currentUser: mockStaffUser });
      useStore.getState().submitPeriodicReview({
        scheduleId: 'SCH-PRD-001',
        outcome: 'NO_CHANGE',
        comment: 'ทบทวนแล้วถูกต้อง',
        reviewDetails: {
          findings: 'ไม่มีประเด็น',
          standards: 'ISO 9001:2015'
        }
      });

      const task = useStore.getState().tasks.find(t => t.type === 'PERIODIC_REVIEW_APPROVAL');
      approvalTaskId = task.id;
    });

    it('HOD Approves: advances next_review_date by +1 year and stamps audit trail with both reviewer and approver', () => {
      // HOD logs in and approves
      useStore.setState({ currentUser: mockHodUser });

      useStore.getState().approvePeriodicReview({
        taskId: approvalTaskId,
        approverUser: mockHodUser,
        remarks: 'อนุมัติเรียบร้อยตามมาตรฐาน'
      });

      const store = useStore.getState();
      const doc = store.documents.find(d => d.id === 'DOC-PRD-001');
      const sch = store.periodicReviewSchedules.find(s => s.id === 'SCH-PRD-001');
      const task = store.tasks.find(t => t.id === approvalTaskId);

      // 1. Next review date extended by +1 year from mock date (2026-10-09 -> 2027-10-09)
      expect(doc.next_review_date).toBe('2027-10-09');
      expect(sch.nextReviewDate).toBe('2027-10-09');
      expect(doc.review_status).toBe('UP_TO_DATE');
      expect(sch.status).toBe('UPCOMING');
      expect(doc.pending_periodic_review).toBeUndefined();

      // 2. Task completed
      expect(task.status).toBe('COMPLETED');
      expect(task.approvedBy).toBe(mockHodUser.name);

      // 3. Audit Trail Logging: Both reviewer and approver recorded
      expect(doc.periodic_reviews).toHaveLength(1);
      const auditEntry = doc.periodic_reviews[0];
      expect(auditEntry.reviewer_name).toBe(mockStaffUser.name);
      expect(auditEntry.reviewer_role).toBe(mockStaffUser.role);
      expect(auditEntry.approver_name).toBe(mockHodUser.name);
      expect(auditEntry.approver_role).toBe(mockHodUser.role);
      expect(auditEntry.result).toBe('NO_CHANGE');
      expect(auditEntry.next_review_due).toBe('2027-10-09');

      // 4. review_history entry
      expect(doc.review_history).toHaveLength(1);
      const historyEntry = doc.review_history[0];
      expect(historyEntry.reviewer).toBe(mockStaffUser.name);
      expect(historyEntry.approver).toBe(mockHodUser.name);
      expect(historyEntry.outcome).toBe('NO_CHANGE');
      expect(historyEntry.nextReviewDate).toBe('2027-10-09');
    });

    it('HOD Rejects: resets status to ACTION_REQUIRED, stores rejectReason, and clears pending state', () => {
      // HOD logs in and rejects
      useStore.setState({ currentUser: mockHodUser });

      useStore.getState().rejectPeriodicReview({
        taskId: approvalTaskId,
        approverUser: mockHodUser,
        remarks: 'เอกสารมีกระบวนการเปลี่ยน ให้ส่งขอจัดทำ DAR แก้ไขแทน'
      });

      const store = useStore.getState();
      const doc = store.documents.find(d => d.id === 'DOC-PRD-001');
      const sch = store.periodicReviewSchedules.find(s => s.id === 'SCH-PRD-001');
      const task = store.tasks.find(t => t.id === approvalTaskId);

      // Date NOT changed
      expect(doc.next_review_date).toBe(INITIAL_NEXT_DATE);

      // Status reset
      expect(sch.status).toBe('ACTION_REQUIRED');
      expect(sch.rejectionRemarks).toBe('เอกสารมีกระบวนการเปลี่ยน ให้ส่งขอจัดทำ DAR แก้ไขแทน');
      expect(doc.review_status).toBe('ACTION_REQUIRED');
      expect(doc.pending_periodic_review).toBeUndefined();

      // Task marked rejected
      expect(task.status).toBe('REJECTED');
      expect(task.rejectReason).toBe('เอกสารมีกระบวนการเปลี่ยน ให้ส่งขอจัดทำ DAR แก้ไขแทน');
    });
  });

  describe('4. Flow C: Fast-Track 1-Click Direct Approval by HOD/Manager', () => {
    it('immediately extends next_review_date +1 year and stamps audit trail without creating approval task', () => {
      useStore.setState({ currentUser: mockHodUser });

      const result = useStore.getState().submitPeriodicReview({
        scheduleId: 'SCH-PRD-001',
        outcome: 'NO_CHANGE',
        comment: 'HOD Fast-Track review direct submission'
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.fastTrack).toBe(true);

      const store = useStore.getState();
      const doc = store.documents.find(d => d.id === 'DOC-PRD-001');
      const sch = store.periodicReviewSchedules.find(s => s.id === 'SCH-PRD-001');
      const approvalTask = store.tasks.find(t => t.type === 'PERIODIC_REVIEW_APPROVAL');

      // Date extended immediately by 1 year
      expect(doc.next_review_date).toBe('2027-10-09');
      expect(sch.nextReviewDate).toBe('2027-10-09');
      expect(doc.review_status).toBe('UP_TO_DATE');
      expect(sch.status).toBe('UPCOMING');

      // NO approval task should be created
      expect(approvalTask).toBeUndefined();

      // Audit trail logged with HOD as both reviewer and approver
      expect(doc.periodic_reviews).toHaveLength(1);
      expect(doc.periodic_reviews[0].reviewer_name).toBe(mockHodUser.name);
      expect(doc.periodic_reviews[0].approver_name).toBe(mockHodUser.name);
    });
  });

  describe('5. TaskInbox UI Integration: Periodic Review Approval Card & Modal Interaction', () => {
    it('renders task card for HOD with action buttons, opens approval modal, and allows approving', async () => {
      const { render, screen, fireEvent } = await import('@testing-library/react');
      const { MemoryRouter } = await import('react-router-dom');
      const TaskInbox = (await import('../pages/Tasks/TaskInbox')).default;

      // Staff submits first
      useStore.setState({ currentUser: mockStaffUser });
      useStore.getState().submitPeriodicReview({
        scheduleId: 'SCH-PRD-001',
        outcome: 'NO_CHANGE',
        comment: 'Staff confirmed no change',
        reviewDetails: {
          findings: 'กระบวนการปัจจุบันตรงตามคู่มือ',
          standards: 'ISO 9001:2015'
        }
      });

      // HOD views TaskInbox
      useStore.setState({ currentUser: mockHodUser });

      const { container } = render(
        <MemoryRouter>
          <TaskInbox />
        </MemoryRouter>
      );

      // Verify task card appears
      expect(screen.getByText(/อนุมัติผลทบทวนตามรอบ/i)).toBeDefined();
      expect(screen.getByText('SOP-PRD-001')).toBeDefined();

      // Verify action buttons exist on the card
      const approveBtn = screen.getByRole('button', { name: /พิจารณาอนุมัติ/i });
      const rejectBtn = screen.getByRole('button', { name: /ตีกลับ/i });
      expect(approveBtn).toBeDefined();
      expect(rejectBtn).toBeDefined();

      // Click "พิจารณาอนุมัติ" button to open modal
      fireEvent.click(approveBtn);

      // Verify Modal opens and displays review details
      expect(screen.getByText(/พิจารณาอนุมัติผลการทบทวนเอกสารตามรอบ/i)).toBeDefined();
      expect(screen.getByText(/ไม่มีการเปลี่ยนแปลง \(No Change\)/i)).toBeDefined();
      expect(screen.getByText(/กระบวนการปัจจุบันตรงตามคู่มือ/i)).toBeDefined();

      // In modal: click "อนุมัติผลทบทวน (Approve)" button
      const modalApproveBtn = screen.getByRole('button', { name: /อนุมัติผลทบทวน \(Approve\)/i });
      fireEvent.click(modalApproveBtn);

      // Verify task completed in store and next review date rolled
      const store = useStore.getState();
      const doc = store.documents.find(d => d.id === 'DOC-PRD-001');
      expect(doc.next_review_date).toBe('2027-10-09');
      expect(doc.review_status).toBe('UP_TO_DATE');
      expect(doc.periodic_reviews[0].approver_name).toBe(mockHodUser.name);
    });
  });
});

