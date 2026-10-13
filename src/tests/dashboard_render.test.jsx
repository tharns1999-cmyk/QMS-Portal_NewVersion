import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard/Dashboard';
import ExternalDocDetailModal from '../pages/ExternalDocs/ExternalDocDetailModal';
import PeriodicReviewDashboard from '../pages/PeriodicReviews/PeriodicReviewDashboard';
import Sidebar from '../components/layout/Sidebar';
import useStore from '../store/useStore';
import { normalizeDept, getDarStatusBadgeMeta } from '../utils/darHelper';
import { DarStatusBadge } from '../components/ui/StatusBadge';
import { hasDocumentAccess } from '../utils/accessControl';
import { extractDeptCode, standardizeDepartmentCode } from '../services/darService';
import { generateDynamicWorkflow } from '../utils/workflowEngine';
import { canPerformPeriodicReview } from '../services/PeriodicReviewAccessService';
import { normalizeCanonicalDept, isSameDepartment } from '../utils/taskFilter';
import { saveFile, resolveFileBlob } from '../utils/fileStorage';
import { getPeriodicReviewStatus, getDocumentReviewMetrics } from '../utils/documentUtils';

describe('Dashboard & Lean Refactor Verification', () => {
  it('renders Dashboard without ReferenceError (useMemo properly imported)', () => {
    useStore.setState({
      currentUser: { id: 'U001', name: 'Test User', role: 'DCC_ADMIN', isDcc: true },
      tasks: [],
      dars: [],
      documents: [],
      controlledCopyInstances: [],
      masterUsers: []
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText(/ภาพรวมระบบ/i) || screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('removes 17 deprecated store aliases while preserving all canonical store actions', () => {
    const s = useStore.getState();
    const removedAliases = [
      'withdrawExternalDoc', 'reviseExternalDoc', 'createDar', 'submitDarRequest',
      'completeTask', 'advanceWorkflowStage', 'dispatchCopy', 'dispatchAllCopies',
      'finalApproveDar', 'approveTask', 'reportCopyDamaged', 'reportDamagedCopy',
      'requestCopyReplacement', 'reportCopyIssue', 'markCopyRecalled',
      'receiveRecallCopy', 'recordCopyDestroyed'
    ];
    for (const name of removedAliases) {
      expect(s[name]).toBeUndefined();
    }

    const canonicalActions = [
      'addDar', 'submitDar', 'processWorkflow', 'approveDar',
      'dispatchControlledCopy', 'dispatchControlledCopies',
      'reportCcDamagedLost', 'recordCopyRecalled', 'destroyControlledCopy'
    ];
    for (const name of canonicalActions) {
      expect(typeof s[name]).toBe('function');
    }
  });

  it('normalizes raw department codes identically via shared normalizeDept', () => {
    expect(normalizeDept({ id: ' pd ' })).toBe('PD');
    expect(normalizeDept({ department: ' qc ' })).toBe('QC');
    expect(normalizeDept('qa')).toBe('QC');
    expect(normalizeDept(null)).toBe('');
  });

  it('renders DarStatusBadge matching getDarStatusBadgeMeta className and label', () => {
    const meta = getDarStatusBadgeMeta('APPROVED');
    const { container } = render(<DarStatusBadge status="APPROVED" />);
    const span = container.querySelector('span');
    expect(span.textContent).toBe(meta.label);
    expect(span.className).toBe(meta.className);
  });
});

describe('QA/QC Canonical Normalization, RBAC & Document Prefix Extraction', () => {
  it('Criterion 1: grants DEPT_ONLY access for QA/QC/QA-QC users on WI-QC-01 and QC-WI-01 and extracts QC prefix/code', () => {
    expect(extractDeptCode('WI-QC-01')).toBe('QC');
    expect(extractDeptCode('QC-01-01')).toBe('QC');
    expect(extractDeptCode('QC-WI-02')).toBe('QC');

    const docMiddlePrefix = { id: 'doc-1', code: 'WI-QC-01', department: '', access_control: { scope: 'DEPT_ONLY' } };
    const docLeadingPrefix = { id: 'doc-2', code: 'QC-WI-01', department: '', access_control: { scope: 'DEPT_ONLY' } };

    for (const dept of ['QA', 'QC', 'QA/QC']) {
      const user = { id: `U-${dept}`, name: `Staff ${dept}`, department: dept, role: 'GENERAL_USER', level: 2 };
      expect(hasDocumentAccess(docMiddlePrefix, user)).toBe(true);
      expect(hasDocumentAccess(docLeadingPrefix, user)).toBe(true);
    }

    const pdUser = { id: 'U-PD', name: 'Staff PD', department: 'PD', role: 'GENERAL_USER', level: 2 };
    expect(hasDocumentAccess(docMiddlePrefix, pdUser)).toBe(false);
    expect(hasDocumentAccess(docLeadingPrefix, pdUser)).toBe(false);
  });

  it('Criterion 2: matches Level 5 QA / QA/QC Manager for QC document workflow and periodic review without falling back to QMR', () => {
    const requester = { id: 'U-REQ', name: 'QC Staff', department: 'QC', level: 2, status: 'ACTIVE' };
    const qaManager = { id: 'U-QA-MGR', name: 'QA Manager', department: 'QA', level: 5, role: 'MANAGER', status: 'ACTIVE' };
    const qmrUser = { id: 'U-QMR', name: 'QMR Exec', department: 'MGMT', level: 6, role: 'QMR', isQmr: true, status: 'ACTIVE' };
    const masterUsers = [requester, qaManager, qmrUser];

    const steps = generateDynamicWorkflow(requester, 'QC', masterUsers);
    expect(steps[1].role).toBe('REVIEWER');
    expect(steps[1].userId).toBe('U-QA-MGR');
    expect(steps[2].role).toBe('APPROVER');
    expect(steps[2].userId).toBe('U-QMR');

    const qaqcManager = { id: 'U-QAQC-MGR', name: 'QA/QC Manager', department: 'QA/QC', level: 5, role: 'MANAGER', status: 'ACTIVE' };
    const qcDoc = { id: 'DOC-QC-01', code: 'SOP-QC-01', title: 'SOP-QC-01', department: 'QC' };
    const reviewForQcDoc = { id: 'PRS-QC-01', documentId: 'DOC-QC-01', documentNumber: 'SOP-QC-01', ownerDepartmentId: 'QC', status: 'ACTION_REQUIRED', documentCategory: 'INTERNAL' };

    expect(canPerformPeriodicReview(qaManager, reviewForQcDoc, qcDoc)).toBe(true);
    expect(canPerformPeriodicReview(qaqcManager, reviewForQcDoc, qcDoc)).toBe(true);

    useStore.setState({
      currentUser: qaManager,
      documents: [qcDoc],
      periodicReviewSchedules: [reviewForQcDoc],
      periodicReviewTasks: [],
      periodicReviewRecords: [],
      tasks: []
    });

    const res = useStore.getState().submitPeriodicReview({
      scheduleId: 'PRS-QC-01',
      docId: 'DOC-QC-01',
      docCode: 'SOP-QC-01',
      outcome: 'NO_CHANGE',
      currentUser: qaManager,
      reviewDetails: { reason: 'Annual QA/QC check passed' }
    });

    expect(res?.fastTrack).toBe(true);
    expect(res?.status).toBe('COMPLETED');
    const updatedSchedule = useStore.getState().periodicReviewSchedules.find(s => s.id === 'PRS-QC-01');
    expect(updatedSchedule.status).toBe('UPCOMING');

    // Also verify 2-step approval routing when QC Staff submits -> assigns to Level 5 QA Manager
    const reviewForStaff = { id: 'PRS-QC-02', documentId: 'DOC-QC-01', documentNumber: 'SOP-QC-01', ownerDepartmentId: 'QC', status: 'ACTION_REQUIRED', documentCategory: 'INTERNAL' };
    useStore.setState({
      currentUser: requester,
      users: masterUsers,
      masterUsers,
      documents: [qcDoc],
      periodicReviewSchedules: [reviewForStaff],
      periodicReviewTasks: [],
      tasks: []
    });

    useStore.getState().submitPeriodicReview({
      scheduleId: 'PRS-QC-02',
      docId: 'DOC-QC-01',
      docCode: 'SOP-QC-01',
      outcome: 'NO_CHANGE',
      currentUser: requester,
      reviewDetails: { reason: 'Staff review' }
    });

    const approvalTask = useStore.getState().tasks.find(t => t.type === 'PERIODIC_REVIEW_APPROVAL');
    expect(approvalTask?.assignee_id).toBe('U-QA-MGR');
  });

  it('Criterion 3: normalizes QA, QA/QC, and QA Super to canonical QC and treats QA <-> QC as same department', () => {
    expect(standardizeDepartmentCode('QA')).toBe('QC');
    expect(standardizeDepartmentCode('QA/QC')).toBe('QC');
    expect(normalizeCanonicalDept('QA Super')).toBe('QC');
    expect(isSameDepartment('QA', 'QC')).toBe(true);
  });

  it('Criterion 4: isolates SUPERSEDED edition files from Active Edition in resolveFileBlob and External Doc update lifecycle', async () => {
    const blobV1 = new Blob(['PDF CONTENT EDITION 1'], { type: 'application/pdf' });
    const blobV2 = new Blob(['PDF CONTENT EDITION 2'], { type: 'application/pdf' });

    await saveFile('FILE_ED-QC-01_ED_1.0', blobV1);
    await saveFile('FILE_ED-QC-01_ED_2.0', blobV2);
    await saveFile('ED-QC-01', blobV2);

    const file1 = await resolveFileBlob({ doc_code: 'ED-QC-01', edition: '1.0' });
    const file2 = await resolveFileBlob({ doc_code: 'ED-QC-01', edition: '2.0' });

    expect(await file1.text()).toBe('PDF CONTENT EDITION 1');
    expect(await file2.text()).toBe('PDF CONTENT EDITION 2');

    // End-to-end store test: Register Edition 1.0, then revise to Edition 2.0 and approve
    const fileIdV1 = 'file_test_ed1_pdf';
    const fileIdV2 = 'file_test_ed2_pdf';
    await saveFile(fileIdV1, blobV1);
    await saveFile(fileIdV2, blobV2);

    useStore.setState({
      currentUser: { id: 'U-DCC', name: 'DCC Admin', department: 'QC', role: 'DCC_ADMIN', isDcc: true },
      externalDocuments: [],
      externalRequests: [],
      tasks: [],
      notifications: []
    });

    useStore.getState().registerExternalDoc({
      id: 'ED-QC-77',
      edCode: 'ED-QC-77',
      title: 'ISO 9001 Standard',
      department: 'QC',
      edition: '1.0',
      sourceVersion: '1.0',
      fileId: fileIdV1,
      rawFileId: fileIdV1,
      attachedFile: { fileId: fileIdV1, rawFileId: fileIdV1, name: 'iso_v1.pdf' }
    });

    // Wait a tick for async saveFile promises in registerExternalDoc
    await new Promise(r => setTimeout(r, 20));

    // Revise to Edition 2.0 with a new file
    useStore.getState().updateExternalDoc('ED-QC-77', {
      edCode: 'ED-QC-77',
      title: 'ISO 9001 Standard',
      department: 'QC',
      edition: '2.0',
      sourceVersion: '2.0',
      approverId: 'U-QMR',
      fileId: fileIdV2,
      rawFileId: fileIdV2,
      attachedFile: { fileId: fileIdV2, rawFileId: fileIdV2, name: 'iso_v2.pdf' },
      reason: 'Updated to 2.0'
    });

    await new Promise(r => setTimeout(r, 20));

    const approvalTask = useStore.getState().tasks.find(t => t.docCode === 'ED-QC-77');
    expect(approvalTask).toBeTruthy();

    useStore.getState().processExternalTask(approvalTask.id, 'APPROVE', 'Approved Edition 2.0');
    await new Promise(r => setTimeout(r, 20));

    const extDocs = useStore.getState().externalDocuments.filter(d => (d.edCode || d.doc_code) === 'ED-QC-77');
    const supersededEd1 = extDocs.find(d => d.status === 'SUPERSEDED' || d.is_superseded);
    const activeEd2 = extDocs.find(d => d.status === 'ACTIVE' && !d.is_superseded);

    expect(supersededEd1).toBeTruthy();
    expect(activeEd2).toBeTruthy();
    expect(supersededEd1.edition).toBe('1.0');
    expect(activeEd2.edition).toBe('2.0');

    const resolvedSupersededBlob = await resolveFileBlob(supersededEd1, supersededEd1.id);
    const resolvedActiveBlob = await resolveFileBlob(activeEd2, activeEd2.id);

    expect(await resolvedSupersededBlob.text()).toBe('PDF CONTENT EDITION 1');
    expect(await resolvedActiveBlob.text()).toBe('PDF CONTENT EDITION 2');
  });

  it('sorts ExternalDocDetailModal version history in strict reverse chronological order without false (ล่าสุด) badge and supports collapsible toggle', () => {
    const activeDoc = {
      id: 'ED-ACT-9',
      edCode: 'ED-QC-01',
      title: 'Test Method Standard',
      department: 'QC',
      status: 'ACTIVE',
      edition: '9.0',
      sourceVersion: '9.0',
      effectiveDate: '2026-04-01',
      darId: 'EDR-2026-0006',
      previousDocId: 'ED-SUP-8'
    };
    const supDoc8 = {
      id: 'ED-SUP-8',
      edCode: 'ED-QC-01',
      title: 'Test Method Standard',
      department: 'QC',
      status: 'SUPERSEDED',
      is_superseded: true,
      edition: 'Issue8.01',
      sourceVersion: 'Issue8.01',
      effectiveDate: '2026-03-01',
      darId: 'EDR-2026-0005',
      supersededByDocId: 'ED-ACT-9'
    };
    const supDoc7 = {
      id: 'ED-SUP-7',
      edCode: 'ED-QC-01',
      title: 'Test Method Standard',
      department: 'QC',
      status: 'SUPERSEDED',
      is_superseded: true,
      edition: 'Issue7.0',
      sourceVersion: 'Issue7.0',
      effectiveDate: '2026-02-15',
      darId: 'EDR-2026-0004'
    };
    const supDoc6 = {
      id: 'ED-SUP-6',
      edCode: 'ED-QC-01',
      title: 'Test Method Standard',
      department: 'QC',
      status: 'SUPERSEDED',
      is_superseded: true,
      edition: 'Issue6.0',
      sourceVersion: 'Issue6.0',
      effectiveDate: '2026-02-01',
      darId: 'EDR-2026-0002'
    };
    // Oldest version with a high numeric string "11021" that previously hijacked index 0
    const supDocOldest = {
      id: 'ED-SUP-1',
      edCode: 'ED-QC-01',
      title: 'Test Method Standard',
      department: 'QC',
      status: 'SUPERSEDED',
      is_superseded: true,
      edition: '11021',
      sourceVersion: '11021',
      effectiveDate: '2026-01-01',
      darId: 'EDR-2026-0001'
    };

    useStore.setState({
      currentUser: { id: 'U-DCC', name: 'DCC Admin', role: 'DCC', department: 'DC', isDcc: true },
      externalDocuments: [supDocOldest, supDoc8, activeDoc, supDoc6, supDoc7]
    });

    const { container } = render(
      <ExternalDocDetailModal
        isOpen={true}
        onClose={() => {}}
        document={activeDoc}
      />
    );

    // Switch to Version History tab
    const historyTabBtn = screen.getByRole('button', { name: /ประวัติทุกเวอร์ชัน/i });
    fireEvent.click(historyTabBtn);

    // 1. No false "(ล่าสุด)" badge anywhere
    expect(screen.queryByText('(ล่าสุด)')).toBeNull();

    // 2. Active version is displayed with "ใช้งานปัจจุบัน"
    expect(screen.getByText('ใช้งานปัจจุบัน')).toBeTruthy();

    // 3. Only 3 superseded versions shown initially (Issue8.01, Issue7.0, Issue6.0); oldest "11021" is collapsed
    expect(screen.getByText('Edition Issue8.01')).toBeTruthy();
    expect(screen.getByText('Edition Issue7.0')).toBeTruthy();
    expect(screen.getByText('Edition Issue6.0')).toBeTruthy();
    expect(screen.queryByText('Edition 11021')).toBeNull();

    // 4. Expand collapsible toggle to reveal the 4th superseded version ("11021")
    const toggleBtn = screen.getByRole('button', { name: /ดูประวัติฉบับตกรุ่นเพิ่มเติม \(1 รายการ\)/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText('Edition 11021')).toBeTruthy();
    expect(screen.getByRole('button', { name: /ซ่อนประวัติเก่า/i })).toBeTruthy();

    // 5. Verify DOM order: Edition 9.0 (Active) -> Edition Issue8.01 -> Edition Issue7.0 -> Edition Issue6.0 -> Edition 11021
    const fullText = container.textContent;
    const posActive = fullText.indexOf('Edition 9.0');
    const posIssue8 = fullText.indexOf('Edition Issue8.01');
    const pos11021 = fullText.indexOf('Edition 11021');
    expect(posActive).toBeGreaterThan(-1);
    expect(posIssue8).toBeGreaterThan(posActive);
    expect(pos11021).toBeGreaterThan(posIssue8);
  });

  it('End-to-End External Document Controlled Copy workflow: renders button with 0 copies, opens RequestAdditionalCopiesModal with Edition, creates ED-QC-01-C01 + DCC task + distributionList, and renders in Circulation table', () => {
    const activeExtDoc = {
      id: 'ED-ACT-9',
      edCode: 'ED-QC-01',
      doc_code: 'ED-QC-01',
      code: 'ED-QC-01',
      title: 'ISO 17025 Lab Standard',
      department: 'QC',
      status: 'ACTIVE',
      edition: '9.0',
      sourceVersion: '9.0',
      effectiveDate: '2026-04-01',
      distributionList: [],
      controlledCopies: []
    };

    useStore.setState({
      currentUser: { id: 'U-QC-STAFF', name: 'QC Staff', role: 'GENERAL_USER', department: 'QC', level: 2 },
      externalDocuments: [activeExtDoc],
      controlledCopyInstances: [],
      documentControlledCopies: [],
      tasks: [],
      notifications: []
    });

    const { rerender } = render(
      <ExternalDocDetailModal
        isOpen={true}
        onClose={() => {}}
        document={activeExtDoc}
      />
    );

    // 1. Renders "+ ขอสำเนาควบคุมเพิ่มเติม" button even with 0 initial copies
    const requestBtn = screen.getByRole('button', { name: /ขอสำเนาควบคุมเพิ่มเติม/i });
    expect(requestBtn).toBeTruthy();

    // 2. Clicking button opens RequestAdditionalCopiesModal showing ED-QC-01 and Edition 9.0 (not Rev.)
    fireEvent.click(requestBtn);
    expect(screen.getAllByText('ED-QC-01').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Edition 9.0').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Rev.9.0')).toBeNull();

    // 3. Submit ad-hoc copy request via store action
    useStore.getState().requestAdditionalControlledCopies(
      'ED-ACT-9',
      [
        {
          departmentId: 'QC',
          department: 'QC',
          target_department: 'QC',
          locationId: 'QC-LAB-01',
          locationName: 'ห้องปฏิบัติการทดสอบเคมี (QC Lab 1)',
          is_external: true,
          doc_type: 'EXTERNAL'
        }
      ],
      'ใช้ประจำจุดตรวจวิเคราะห์ QC Lab 1',
      {
        documentId: 'ED-ACT-9',
        docCode: 'ED-QC-01',
        docTitle: 'ISO 17025 Lab Standard',
        edition: '9.0',
        is_external: true,
        doc_type: 'EXTERNAL'
      }
    );

    const stateAfter = useStore.getState();
    const createdCopy = stateAfter.controlledCopyInstances.find(c => c.copyCode === 'ED-QC-01-C01');
    expect(createdCopy).toBeTruthy();
    expect(createdCopy.is_external).toBe(true);
    expect(createdCopy.doc_type).toBe('EXTERNAL');
    expect(createdCopy.edition).toBe('9.0');

    // Verify DCC task created
    const dccTask = stateAfter.tasks.find(t => t.taskType === 'DCC_ISSUE_CONTROLLED_COPIES' && t.docCode === 'ED-QC-01');
    expect(dccTask).toBeTruthy();
    expect(dccTask.is_external).toBe(true);
    expect(dccTask.copyCodes).toContain('ED-QC-01-C01');

    // Verify externalDocuments[].distributionList updated
    const updatedExtDoc = stateAfter.externalDocuments.find(d => d.id === 'ED-ACT-9');
    expect(updatedExtDoc.distributionList.some(d => d.copyCode === 'ED-QC-01-C01')).toBe(true);

    // 4. Re-render ExternalDocDetailModal and verify ED-QC-01-C01 appears in Controlled Copies in Circulation table
    rerender(
      <ExternalDocDetailModal
        isOpen={true}
        onClose={() => {}}
        document={updatedExtDoc}
      />
    );

    expect(screen.getByText('ED-QC-01-C01')).toBeTruthy();
    expect(screen.getAllByText(/ห้องปฏิบัติการทดสอบเคมี \(QC Lab 1\)/i).length).toBeGreaterThanOrEqual(1);
  });

  it('Criterion 7: Periodic Review fixes false DUE_SOON for 2027-10-13, Sidebar badge overcounting, and Rev.Rev/Edition formatting', () => {
    const refToday = new Date('2026-10-13T00:00:00.000Z');
    const status2027 = getPeriodicReviewStatus('2027-10-13', refToday);
    expect(status2027.status).toBe('NORMAL');
    expect(status2027.label).toBe('ยังไม่ถึงกำหนด');
    expect(status2027.days).toBe(365);

    const qcUser = {
      id: 'U-QC-01',
      name: 'สมศรี (ผู้ขอแก้ไข)',
      department: 'QC',
      level: 1,
      role: 'STAFF',
      managedDepartments: ['*']
    };

    const supersededExtDoc = {
      id: 'ED-QC-01-SUPERSEDED-1',
      edCode: 'ED-QC-01',
      doc_code: 'ED-QC-01',
      title: 'Test-ED-01.02',
      department: 'QC',
      status: 'SUPERSEDED',
      is_superseded: true,
      is_external: true,
      edition: 'Issue8.01',
      sourceVersion: 'Issue8.01',
      revision: 'Rev.01',
      nextReviewDate: '2026-10-13',
      next_review_date: '2026-10-13',
      review_status: 'DUE_SOON'
    };

    const activeExtDoc = {
      id: 'ED-QC-01-ACTIVE-2',
      edCode: 'ED-QC-01',
      doc_code: 'ED-QC-01',
      title: 'Test-ED-01.02',
      department: 'QC',
      status: 'ACTIVE',
      is_superseded: false,
      is_obsolete: false,
      is_external: true,
      edition: 'Issue8.02',
      sourceVersion: 'Issue8.02',
      revision: 'Rev.02',
      nextReviewDate: '2027-10-13',
      next_review_date: '2026-10-13' // Even if stale snake_case existed, active nextReviewDate wins
    };

    const activeInternalDoc = {
      id: 'INT-QC-01',
      code: 'SOP-QC-01',
      doc_code: 'SOP-QC-01',
      title: 'SOP-QC-01',
      name: 'การตรวจสอบคุณภาพ',
      department: 'QC',
      status: 'EFFECTIVE',
      revision: 'Rev.02',
      next_review_date: '2027-10-13'
    };

    useStore.setState({
      currentUser: qcUser,
      simulatedSystemDate: '2026-10-13T00:00:00.000Z',
      documents: [activeInternalDoc],
      externalDocuments: [supersededExtDoc, activeExtDoc],
      periodicReviewSchedules: [],
      tasks: [
        {
          id: 'T-STALE-PR',
          type: 'PERIODIC_REVIEW',
          taskType: 'PERIODIC_REVIEW',
          docCode: 'ED-QC-01',
          target_department: 'QC',
          status: 'PENDING'
        }
      ]
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={['/dcc/periodic-reviews']}>
        <Sidebar />
      </MemoryRouter>
    );

    const reviewLink = screen.getByText('การทบทวนตามรอบ').closest('a');
    expect(reviewLink.textContent).toBe('การทบทวนตามรอบ');
    unmount();

    render(
      <MemoryRouter initialEntries={['/dcc/periodic-reviews']}>
        <PeriodicReviewDashboard />
      </MemoryRouter>
    );

    // Internal tab: Rev.02 is rendered cleanly without Rev.Rev.02
    expect(screen.getByText('Rev.02')).toBeTruthy();
    expect(screen.queryByText('Rev.Rev.02')).toBeNull();

    // Switch to External Docs tab
    const extTabBtn = screen.getByRole('button', { name: /เอกสารภายนอก/i });
    fireEvent.click(extTabBtn);

    // Verify ED-QC-01 displays Edition Issue8.02 and ✅ ยังไม่ถึงกำหนด, and never ⚠️ ใกล้ครบกำหนด or Rev.Rev.02
    expect(screen.getByText('Edition Issue8.02')).toBeTruthy();
    expect(screen.queryByText('Rev.Rev.02')).toBeNull();
    expect(screen.getByText('✅ ยังไม่ถึงกำหนด')).toBeTruthy();
    expect(screen.queryByText('⚠️ ใกล้ครบกำหนด')).toBeNull();

    const metrics = getDocumentReviewMetrics([
      {
        ...activeExtDoc,
        isExternal: true,
        nextReviewDate: '2027-10-13',
        next_review_date: '2027-10-13'
      }
    ], refToday);
    expect(metrics.dueSoon).toBe(0);
    expect(metrics.upToDate).toBe(1);
  });
});

