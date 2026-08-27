import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import DocumentDetailModal from '../components/workflow/DocumentDetailModal';
import { canManageControlledCopy } from '../utils/accessControl';
import useStore from '../store/useStore';

describe('Enterprise Security & RBAC Guard: Controlled Copy Custodianship Isolation & Action Authorization', () => {
  const sampleDoc = {
    id: 'DOC-PD-001',
    title: 'SOP-PD-01',
    name: 'ขั้นตอนการควบคุมกระบวนการผลิต',
    rev: '01',
    department: 'PD',
    owner_dept: 'PD',
    status: 'EFFECTIVE',
    access_scope: 'GENERAL'
  };

  const copyPD1 = {
    id: 'inst-pd-01',
    doc_id: 'DOC-PD-001',
    doc_code: 'SOP-PD-01',
    docTitle: 'SOP-PD-01',
    copy_no: '01',
    issue_no: '01',
    holder_dept: 'PD',
    department: 'PD',
    location: 'Line 1 Mixing',
    status: 'ISSUED_ACTIVE'
  };

  const copyPD2 = {
    id: 'inst-pd-02',
    doc_id: 'DOC-PD-001',
    doc_code: 'SOP-PD-01',
    docTitle: 'SOP-PD-01',
    copy_no: '02',
    issue_no: '01',
    holder_dept: 'PD',
    department: 'PD',
    location: 'Line 2 Packaging',
    status: 'ISSUED_ACTIVE'
  };

  const copyQA1 = {
    id: 'inst-qa-01',
    doc_id: 'DOC-PD-001',
    doc_code: 'SOP-PD-01',
    docTitle: 'SOP-PD-01',
    copy_no: '03',
    issue_no: '01',
    holder_dept: 'QA',
    department: 'QA',
    location: 'QA In-Process Lab',
    status: 'ISSUED_ACTIVE'
  };

  beforeEach(() => {
    useStore.setState({
      documents: [sampleDoc],
      controlledCopyInstances: [copyPD1, copyPD2, copyQA1],
      documentControlledCopies: [copyPD1, copyPD2, copyQA1],
      canDownloadDocument: () => true
    });
  });

  it('1. canManageControlledCopy helper correctly authorizes copy custodianship', () => {
    const dccUser = { id: 'U001', name: 'Admin QA', department: 'QA', isDcc: true, role: 'DCC_ADMIN' };
    const pdUser = { id: 'U002', name: 'ธนาวุฒิ', department: 'PD', isDcc: false, role: 'GENERAL_USER' };
    const qaUser = { id: 'U005', name: 'บีม', department: 'QA', isDcc: false, role: 'GENERAL_USER' };

    // DCC Admin can manage any copy
    expect(canManageControlledCopy(copyPD1, dccUser)).toBe(true);
    expect(canManageControlledCopy(copyQA1, dccUser)).toBe(true);

    // PD User can ONLY manage PD copies
    expect(canManageControlledCopy(copyPD1, pdUser)).toBe(true);
    expect(canManageControlledCopy(copyPD2, pdUser)).toBe(true);
    expect(canManageControlledCopy(copyQA1, pdUser)).toBe(false);

    // QA User can ONLY manage QA copies
    expect(canManageControlledCopy(copyPD1, qaUser)).toBe(false);
    expect(canManageControlledCopy(copyQA1, qaUser)).toBe(true);
  });

  it('2. QA User viewing PD document sees "เฉพาะผู้ถือสำเนา" on PD copies and action button ONLY on QA copy', () => {
    const qaUser = { id: 'U005', name: 'บีม QA', department: 'QA', isDcc: false, role: 'GENERAL_USER' };
    useStore.setState({ currentUser: qaUser });

    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    // Should render "เฉพาะผู้ถือสำเนา" for the 2 PD copies
    const readOnlyTags = screen.getAllByText(/เฉพาะผู้ถือสำเนา/i);
    expect(readOnlyTags.length).toBe(2);

    // Should render only 1 "แจ้งชำรุด/เล่มใหม่" button (for Copy 03 QA)
    const actionButtons = screen.getAllByRole('button', { name: /แจ้งชำรุด\/เล่มใหม่/i });
    expect(actionButtons.length).toBe(1);

    // QA User should NOT see Watermark Studio button
    expect(screen.queryByRole('button', { name: /Watermark Studio/i })).not.toBeInTheDocument();
  });

  it('3. PD User viewing PD document sees action buttons on PD copies and "เฉพาะผู้ถือสำเนา" on QA copy', () => {
    const pdUser = { id: 'U002', name: 'ธนาวุฒิ PD', department: 'PD', isDcc: false, role: 'GENERAL_USER' };
    useStore.setState({ currentUser: pdUser });

    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    // Should render 2 "แจ้งชำรุด/เล่มใหม่" buttons (for Copy 01 and Copy 02 PD)
    const actionButtons = screen.getAllByRole('button', { name: /แจ้งชำรุด\/เล่มใหม่/i });
    expect(actionButtons.length).toBe(2);

    // Should render 1 "เฉพาะผู้ถือสำเนา" tag for Copy 03 QA
    const readOnlyTags = screen.getAllByText(/เฉพาะผู้ถือสำเนา/i);
    expect(readOnlyTags.length).toBe(1);

    // Non-DCC user does NOT see Watermark Studio
    expect(screen.queryByRole('button', { name: /Watermark Studio/i })).not.toBeInTheDocument();
  });

  it('4. DCC Admin sees action buttons on ALL copies and has access to Watermark Studio', () => {
    const dccUser = { id: 'U001', name: 'Admin QA (DCC)', department: 'QA', isDcc: true, role: 'DCC_ADMIN' };
    useStore.setState({ currentUser: dccUser });

    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    // Should render "แจ้งชำรุด/เล่มใหม่" buttons on all 3 copies
    const actionButtons = screen.getAllByRole('button', { name: /แจ้งชำรุด\/เล่มใหม่/i });
    expect(actionButtons.length).toBe(3);

    // Zero "เฉพาะผู้ถือสำเนา" tags
    expect(screen.queryByText(/เฉพาะผู้ถือสำเนา/i)).not.toBeInTheDocument();

    // DCC Admin sees Watermark Studio button
    expect(screen.getByRole('button', { name: /Watermark Studio/i })).toBeInTheDocument();
  });

  it('5. Store-Level Security Guard: blocks unauthorized cross-department replacement reporting', () => {
    const qaUser = { id: 'U005', name: 'บีม QA', department: 'QA', isDcc: false, role: 'GENERAL_USER' };
    useStore.setState({ currentUser: qaUser });

    const { reportCcDamagedLost, reportCopyDamaged } = useStore.getState();

    // Attempting to report damage on PD Copy by QA user throws error
    expect(() => {
      reportCcDamagedLost('inst-pd-01', 'DAMAGED', 'ชำรุด');
    }).toThrow(/ปฏิเสธการทำรายการ: คุณไม่มีสิทธิ์จัดการสำเนาควบคุมของแผนกอื่น/i);

    expect(() => {
      reportCopyDamaged({ copyId: 'inst-pd-02', reason: 'สูญหาย', type: 'LOST' });
    }).toThrow(/ปฏิเสธการทำรายการ: คุณไม่มีสิทธิ์จัดการสำเนาควบคุมของแผนกอื่น/i);

    // QA user reporting on QA copy succeeds
    expect(() => {
      reportCcDamagedLost('inst-qa-01', 'DAMAGED', 'เปียกน้ำ');
    }).not.toThrow();

    const state = useStore.getState();
    const replaced = state.controlledCopyInstances.find(c => c.is_replacement);
    expect(replaced).toBeDefined();
    expect(replaced.holder_dept).toBe('QA');
  });

  it('6. Store-Level Security Guard: DCC Admin can report damage/loss on copies of any department', () => {
    const dccUser = { id: 'U001', name: 'Admin QA (DCC)', department: 'QA', isDcc: true, role: 'DCC_ADMIN' };
    useStore.setState({ currentUser: dccUser });

    const { reportCcDamagedLost } = useStore.getState();

    // DCC Admin reporting on PD Copy succeeds
    expect(() => {
      reportCcDamagedLost('inst-pd-01', 'DAMAGED', 'DCC physical inspection damaged');
    }).not.toThrow();

    const state = useStore.getState();
    const repPd = state.controlledCopyInstances.find(c => c.is_replacement && c.replaced_copy_id === 'inst-pd-01');
    expect(repPd).toBeDefined();
    expect(repPd.department).toBe('PD');
  });
});
