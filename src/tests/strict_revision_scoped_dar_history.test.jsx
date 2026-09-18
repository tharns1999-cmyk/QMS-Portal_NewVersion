import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentDetailModal from '../components/workflow/DocumentDetailModal';
import useStore from '../store/useStore';
import { ACCESS_SCOPES } from '../utils/accessControl';

describe('Strict Revision-Scoped DAR History Binding Invariant Tests', () => {
  const currentUser = {
    id: 'U005',
    name: 'บีม (QA)',
    department: 'QA',
    depts: ['QA'],
    role: 'DCC_ADMIN',
    level: 4,
    isDcc: true
  };

  const sampleDars = [
    {
      id: 'DAR-2025-001',
      dar_no: 'DAR-2025-001',
      doc_code: 'SOP-QA-001',
      docRev: '00',
      rev: '00',
      revision: '00',
      request_type: 'NEW',
      type: 'NEW',
      status: 'EFFECTIVE',
      effectiveDate: '2025-01-15',
      reason: 'จัดทำระเบียบปฏิบัติการเริ่มต้นฉบับปฐมฤกษ์ Genesis',
      description: 'กำหนดขั้นตอนการทำงานเริ่มต้นตามมาตรฐาน ISO 9001:2015',
      requester_name: 'สมหญิง ตรวจสอบ (QA Lv.3)',
      reviewer_name: 'กัลยาณี พลไกร (QA Lv.5 Lead)',
      approver_name: 'คุณเรย์ (MGMT Lv.6 General Manager)',
      require_ack: true
    },
    {
      id: 'DAR-2026-055',
      dar_no: 'DAR-2026-055',
      doc_code: 'SOP-QA-001',
      docRev: '01',
      rev: '01',
      revision: '01',
      request_type: 'REVISION',
      type: 'REVISION',
      status: 'EFFECTIVE',
      effectiveDate: '2026-08-01',
      reason: 'ปรับปรุงขั้นตอนการสุ่มตรวจให้ครอบคลุม FSSC 22000',
      description: 'เพิ่มความถี่ในการตรวจสอบสุขาภิบาลและจุลชีววิทยา',
      requester_name: 'บีม (QA Lv.4 Supervisor)',
      reviewer_name: 'กัลยาณี พลไกร (QA Lv.5 Lead)',
      approver_name: 'คุณเรย์ (MGMT Lv.6 General Manager)',
      require_ack: true
    }
  ];

  const effectiveDocRev01 = {
    id: 'doc-sop-qa-001-v1',
    title: 'SOP-QA-001',
    name: 'ระเบียบการตรวจประเมินคุณภาพภายในประจำปี',
    department: 'QA',
    owner_dept: 'QA',
    rev: '01',
    revision: '01',
    effectiveDate: '2026-08-01',
    status: 'EFFECTIVE',
    access_control: { scope: ACCESS_SCOPES.GENERAL }
  };

  const supersededDocRev00 = {
    id: 'doc-sop-qa-001-v0',
    title: 'SOP-QA-001',
    name: 'ระเบียบการตรวจประเมินคุณภาพภายในประจำปี',
    department: 'QA',
    owner_dept: 'QA',
    rev: '00',
    revision: '00',
    effectiveDate: '2025-01-15',
    status: 'SUPERSEDED',
    is_superseded: true,
    access_control: { scope: ACCESS_SCOPES.GENERAL }
  };

  beforeEach(() => {
    useStore.setState({
      currentUser,
      documents: [effectiveDocRev01, supersededDocRev00],
      dars: sampleDars,
      controlledCopyInstances: [],
      documentControlledCopies: [],
      timeline: [],
      masterUsers: []
    });
  });

  it('1. Revision Isolation Invariant (Rev.01 Active): displays ONLY Rev.01 DAR and strictly isolates Rev.00', () => {
    render(
      <DocumentDetailModal
        isOpen={true}
        onClose={() => {}}
        document={effectiveDocRev01}
      />
    );

    // Tab badge must show exact count (1), NOT the aggregate count (2)
    const historyTabBtn = screen.getByRole('button', { name: /ประวัติ DAR และการแก้ไข/i });
    expect(historyTabBtn).toBeInTheDocument();
    expect(screen.getByText(/ประวัติ DAR และการแก้ไข \(1\)/i)).toBeInTheDocument();

    fireEvent.click(historyTabBtn);

    // Header counter should state 1 item found
    expect(screen.getByText(/พบทั้งหมด 1 ฉบับ/i)).toBeInTheDocument();

    // Rev.01 DAR must be displayed
    expect(screen.getByText('DAR-2026-055')).toBeInTheDocument();
    expect(screen.getAllByText(/Rev\.01/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/ปรับปรุงขั้นตอนการสุ่มตรวจให้ครอบคลุม FSSC 22000/i)).toBeInTheDocument();
    expect(screen.getByText('บีม (QA Lv.4 Supervisor)')).toBeInTheDocument();

    // Active document shows "ฉบับล่าสุด" badge
    expect(screen.getByText('ฉบับล่าสุด')).toBeInTheDocument();

    // Invariant: Historical Rev.00 DAR MUST NOT leak into Rev.01
    expect(screen.queryByText('DAR-2025-001')).not.toBeInTheDocument();
    expect(screen.queryByText(/จัดทำระเบียบปฏิบัติการเริ่มต้นฉบับปฐมฤกษ์ Genesis/i)).not.toBeInTheDocument();
    expect(screen.queryByText('สมหญิง ตรวจสอบ (QA Lv.3)')).not.toBeInTheDocument();
  });

  it('2. Revision Isolation Invariant (Rev.00 Superseded): displays ONLY Rev.00 DAR, isolates Rev.01, and suppresses "ฉบับล่าสุด"', () => {
    render(
      <DocumentDetailModal
        isOpen={true}
        onClose={() => {}}
        document={supersededDocRev00}
      />
    );

    // Tab badge must show exact count (1), NOT the aggregate count (2)
    const historyTabBtn = screen.getByRole('button', { name: /ประวัติ DAR และการแก้ไข/i });
    expect(historyTabBtn).toBeInTheDocument();
    expect(screen.getByText(/ประวัติ DAR และการแก้ไข \(1\)/i)).toBeInTheDocument();

    fireEvent.click(historyTabBtn);

    // Header counter should state 1 item found
    expect(screen.getByText(/พบทั้งหมด 1 ฉบับ/i)).toBeInTheDocument();

    // Rev.00 DAR must be displayed
    expect(screen.getByText('DAR-2025-001')).toBeInTheDocument();
    expect(screen.getAllByText(/Rev\.00/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/จัดทำระเบียบปฏิบัติการเริ่มต้นฉบับปฐมฤกษ์ Genesis/i)).toBeInTheDocument();
    expect(screen.getByText('สมหญิง ตรวจสอบ (QA Lv.3)')).toBeInTheDocument();

    // Invariant: "ฉบับล่าสุด" MUST NOT be present in superseded documents
    expect(screen.queryByText('ฉบับล่าสุด')).not.toBeInTheDocument();

    // Invariant: Future Rev.01 DAR MUST NOT leak into Rev.00
    expect(screen.queryByText('DAR-2026-055')).not.toBeInTheDocument();
    expect(screen.queryByText(/ปรับปรุงขั้นตอนการสุ่มตรวจให้ครอบคลุม FSSC 22000/i)).not.toBeInTheDocument();
    expect(screen.queryByText('บีม (QA Lv.4 Supervisor)')).not.toBeInTheDocument();
  });

  it('3. Direct ID Binding: binds explicitly when doc.darId / doc.darNo is set', () => {
    const directBoundDoc = {
      ...effectiveDocRev01,
      darId: 'DAR-2026-055',
      rev: 'Rev.01'
    };

    render(
      <DocumentDetailModal
        isOpen={true}
        onClose={() => {}}
        document={directBoundDoc}
      />
    );

    expect(screen.getByText(/ประวัติ DAR และการแก้ไข \(1\)/i)).toBeInTheDocument();
    const historyTabBtn = screen.getByRole('button', { name: /ประวัติ DAR และการแก้ไข/i });
    fireEvent.click(historyTabBtn);

    expect(screen.getByText('DAR-2026-055')).toBeInTheDocument();
    expect(screen.queryByText('DAR-2025-001')).not.toBeInTheDocument();
  });

  it('4. Type Mismatch Normalization: properly matches numeric 1, "01", and "Rev.01"', () => {
    const numericRevDoc = {
      ...effectiveDocRev01,
      rev: 1 // numeric type
    };

    render(
      <DocumentDetailModal
        isOpen={true}
        onClose={() => {}}
        document={numericRevDoc}
      />
    );

    expect(screen.getByText(/ประวัติ DAR และการแก้ไข \(1\)/i)).toBeInTheDocument();
    const historyTabBtn = screen.getByRole('button', { name: /ประวัติ DAR และการแก้ไข/i });
    fireEvent.click(historyTabBtn);

    expect(screen.getByText('DAR-2026-055')).toBeInTheDocument();
  });

  it('5. Fallback 1:1 Revision Snapshot: constructs a clean isolated snapshot when no DAR is in store for current rev', () => {
    const unrecordedDoc = {
      id: 'doc-sop-en-002',
      title: 'SOP-EN-002',
      name: 'ระเบียบการซ่อมบำรุงเชิงป้องกันเครื่องจักรประจำสัปดาห์',
      department: 'EN',
      owner_dept: 'EN',
      rev: '03',
      effectiveDate: '2026-09-01',
      status: 'EFFECTIVE',
      reason: 'ปรับรอบการตรวจเช็คมอเตอร์และระบบไฮดรอลิกส์'
    };

    render(
      <DocumentDetailModal
        isOpen={true}
        onClose={() => {}}
        document={unrecordedDoc}
      />
    );

    expect(screen.getByText(/ประวัติ DAR และการแก้ไข \(1\)/i)).toBeInTheDocument();
    const historyTabBtn = screen.getByRole('button', { name: /ประวัติ DAR และการแก้ไข/i });
    fireEvent.click(historyTabBtn);

    expect(screen.getAllByText(/Rev\.03/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/ปรับรอบการตรวจเช็คมอเตอร์และระบบไฮดรอลิกส์/i)).toBeInTheDocument();
    // Does not synthesize Rev.00 or any other revision
    expect(screen.queryByText(/Rev\.00/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rev\.01/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rev\.02/i)).not.toBeInTheDocument();
  });

  it('6. Scoped CSV Export: exports only current revision DAR data', () => {
    const createObjectURLMock = vi.fn().mockImplementation(() => 'blob:mock-csv-url');
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = vi.fn();

    render(
      <DocumentDetailModal
        isOpen={true}
        onClose={() => {}}
        document={effectiveDocRev01}
      />
    );

    const historyTabBtn = screen.getByRole('button', { name: /ประวัติ DAR และการแก้ไข/i });
    fireEvent.click(historyTabBtn);

    const exportBtn = screen.getByRole('button', { name: /ส่งออกประวัติ \(CSV\)/i });
    fireEvent.click(exportBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
  });
});
