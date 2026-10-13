import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard/Dashboard';
import useStore from '../store/useStore';
import { normalizeDept, getDarStatusBadgeMeta } from '../utils/darHelper';
import { DarStatusBadge } from '../components/ui/StatusBadge';
import { hasDocumentAccess } from '../utils/accessControl';
import { extractDeptCode, standardizeDepartmentCode } from '../services/darService';
import { generateDynamicWorkflow } from '../utils/workflowEngine';
import { canPerformPeriodicReview } from '../services/PeriodicReviewAccessService';
import { normalizeCanonicalDept, isSameDepartment } from '../utils/taskFilter';

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
    expect(normalizeDept('qa')).toBe('QA');
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
});

