import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentDetailModal from '../components/workflow/DocumentDetailModal';
import useStore from '../store/useStore';
import { ACCESS_SCOPES } from '../utils/accessControl';

describe('DocumentDetailModal Figma UI3 Master Overhaul Tests', () => {
  const currentUser = {
    id: 'U005',
    name: 'บีม (QA)',
    department: 'QA',
    depts: ['QA'],
    role: 'DCC_ADMIN',
    level: 4,
    isDcc: true
  };

  const sampleDoc = {
    id: 'doc-sop-qa-01',
    title: 'SOP-QA-01',
    name: 'ระเบียบการตรวจประเมินคุณภาพภายในประจำปี',
    department: 'QA',
    owner_dept: 'QA',
    rev: '02',
    effectiveDate: '2026-08-01',
    status: 'EFFECTIVE',
    access_control: { scope: ACCESS_SCOPES.GENERAL }
  };

  const sampleCopies = [
    {
      id: 'cc-qa-01',
      doc_id: 'doc-sop-qa-01',
      doc_code: 'SOP-QA-01',
      copy_no: '01',
      issue_no: '01',
      holder_dept: 'QA',
      location: 'QA Central Lab (ห้องปฏิบัติการกลาง)',
      status: 'ISSUED_ACTIVE',
      receipt_confirmed_at: '2026-08-02T08:30:00Z'
    },
    {
      id: 'cc-qa-02',
      doc_id: 'doc-sop-qa-01',
      doc_code: 'SOP-QA-01',
      copy_no: '02',
      issue_no: '02',
      is_replacement: true,
      holder_dept: 'QA',
      location: 'QA In-Process Station (จุดตรวจหน้าไลน์)',
      status: 'ISSUED_ACTIVE',
      receipt_confirmed_at: '2026-08-03T09:15:00Z'
    }
  ];

  const sampleDars = [
    {
      id: 'DAR-2026-088',
      dar_no: 'DAR-2026-088',
      doc_code: 'SOP-QA-01',
      docRev: '02',
      rev: '02',
      request_type: 'REVISION',
      type: 'REVISION',
      status: 'EFFECTIVE',
      effectiveDate: '2026-08-01',
      reason: 'ปรับปรุงเกณฑ์การสุ่มตรวจตัวอย่างให้สอดคล้องกับมาตรฐาน FSSC 22000 Version 6',
      description: 'เพิ่มความถี่ในการตรวจ Swab Test และกำหนดจุดวิกฤต CCP ใหม่',
      requester_name: 'บีม (QA Lv.4 Supervisor)',
      reviewer_name: 'กัลยาณี พลไกร (QA Lv.5 Lead)',
      approver_name: 'คุณเรย์ (MGMT Lv.6 General Manager)',
      require_ack: true
    }
  ];

  beforeEach(() => {
    useStore.setState({
      currentUser,
      documents: [sampleDoc],
      controlledCopyInstances: sampleCopies,
      documentControlledCopies: sampleCopies,
      dars: sampleDars,
      masterUsers: [
        { id: 'U005', name: 'บีม (QA Lv.4 Supervisor)' },
        { id: 'U003', name: 'กัลยาณี พลไกร (QA Lv.5 Lead)' },
        { id: 'U004', name: 'คุณเรย์ (MGMT Lv.6 General Manager)' }
      ],
      canDownloadDocument: () => true
    });
  });

  it('1. Renders Figma UI3 header with Electric Blue doc code and sharp surfaces', () => {
    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    expect(screen.getByText('SOP-QA-01')).toBeInTheDocument();
    expect(screen.getByText('Rev.02')).toBeInTheDocument();
    expect(screen.getByText('ระเบียบการตรวจประเมินคุณภาพภายในประจำปี')).toBeInTheDocument();
  });

  it('2. Top 4 Inspector Property Cards render accurate metadata and badges', () => {
    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    expect(screen.getByText('แผนกเจ้าของเอกสาร')).toBeInTheDocument();
    expect(screen.getByText('วันที่มีผลบังคับใช้')).toBeInTheDocument();
    expect(screen.getByText('2026-08-01')).toBeInTheDocument();
    expect(screen.getAllByText('มีผลบังคับใช้').length).toBeGreaterThan(0);
    expect(screen.getByText(/ทั่วไป \(General\)/i)).toBeInTheDocument();
  });

  it('3. Action Toolbar Grid renders standardized action buttons', () => {
    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    expect(screen.getByRole('button', { name: /เปิดดูเอกสาร/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ดาวน์โหลด PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Watermark Studio/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ขอสำเนาควบคุมเพิ่มเติม/i })).toBeInTheDocument();
  });

  it('4. Controlled copies table renders with Issue 02 (ทดแทน) badge and warning micro-buttons', () => {
    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    expect(screen.getByText(/สำเนาควบคุมที่แจกจ่ายประจำจุดใช้งาน \(2 เล่ม\)/i)).toBeInTheDocument();
    expect(screen.getByText(/QA Central Lab/i)).toBeInTheDocument();
    expect(screen.getByText(/Issue 02 \(ทดแทน\)/i)).toBeInTheDocument();

    const reportBtns = screen.getAllByRole('button', { name: /แจ้งชำรุด\/เล่มใหม่/i });
    expect(reportBtns.length).toBe(2);
  });

  it('5. Tab 2 "ประวัติ DAR และการแก้ไข" displays rich audit trail and 4-step sign-off matrix without empty dashes', () => {
    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    const historyTab = screen.getByRole('button', { name: /ประวัติ DAR และการแก้ไข/i });
    fireEvent.click(historyTab);

    // Verify DAR Header
    expect(screen.getByText('DAR-2026-088')).toBeInTheDocument();
    expect(screen.getByText('ขอแก้ไข')).toBeInTheDocument();

    // Verify Reason & Description
    expect(screen.getByText(/ปรับปรุงเกณฑ์การสุ่มตรวจตัวอย่างให้สอดคล้องกับมาตรฐาน FSSC 22000/i)).toBeInTheDocument();
    expect(screen.getByText(/เพิ่มความถี่ในการตรวจ Swab Test และกำหนดจุดวิกฤต CCP ใหม่/i)).toBeInTheDocument();

    // Verify 4-step sign-off matrix
    expect(screen.getByText('บีม (QA Lv.4 Supervisor)')).toBeInTheDocument();
    expect(screen.getByText('กัลยาณี พลไกร (QA Lv.5 Lead)')).toBeInTheDocument();
    expect(screen.getByText('คุณเรย์ (MGMT Lv.6 General Manager)')).toBeInTheDocument();
    expect(screen.getByText('ต้องรับทราบ')).toBeInTheDocument();
  });

  it('6. Tab 2 renders "ส่งออกประวัติ (CSV)" button and exports valid CSV data with UTF-8 BOM', () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-csv-url');
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    const historyTab = screen.getByRole('button', { name: /ประวัติ DAR และการแก้ไข/i });
    fireEvent.click(historyTab);

    const exportBtn = screen.getByRole('button', { name: /ส่งออกประวัติ \(CSV\)/i });
    expect(exportBtn).toBeInTheDocument();
    expect(exportBtn).not.toBeDisabled();

    fireEvent.click(exportBtn);
    expect(createObjectURLMock).toHaveBeenCalled();
  });
});
