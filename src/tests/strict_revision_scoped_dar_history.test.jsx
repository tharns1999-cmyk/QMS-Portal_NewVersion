import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentDetailModal from '../components/workflow/DocumentDetailModal';
import useStore from '../store/useStore';
import { ACCESS_SCOPES } from '../utils/accessControl';
import { getRevisionIndex, compareRevisions, resolveDocCode } from '../utils/documentUtils';

describe('Cumulative DAR History Lineage (Audit Trail <= Current Revision) Tests', () => {
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
    },
    {
      id: 'DAR-2026-099',
      dar_no: 'DAR-2026-099',
      doc_code: 'SOP-QA-001',
      docRev: '02',
      rev: '02',
      revision: '02',
      request_type: 'REVISION',
      type: 'REVISION',
      status: 'EFFECTIVE',
      effectiveDate: '2026-12-01',
      reason: 'ปรับปรุงขั้นตอนการทำงานสำหรับอนาคต (Future Rev.02)',
      description: 'คำร้องแก้ไขสำหรับรอบถัดไป',
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

  describe('1. Revision Index & Comparison Helpers', () => {
    it('accurately parses revision strings to numeric indices', () => {
      expect(getRevisionIndex('00')).toBe(0);
      expect(getRevisionIndex('01')).toBe(1);
      expect(getRevisionIndex('Rev.01')).toBe(1);
      expect(getRevisionIndex('Rev. 02')).toBe(2);
      expect(getRevisionIndex('A')).toBe(0);
      expect(getRevisionIndex('B')).toBe(1);
      expect(getRevisionIndex(0)).toBe(0);
      expect(getRevisionIndex(null)).toBe(0);
    });

    it('correctly compares revision orders', () => {
      expect(compareRevisions('00', '01')).toBeLessThan(0);
      expect(compareRevisions('01', '00')).toBeGreaterThan(0);
      expect(compareRevisions('Rev.01', '01')).toBe(0);
    });
  });

  describe('2. Modal Header & Cumulative Timeline Display', () => {
    it('renders genuine document code in header badge and correct document name', () => {
      render(
        <DocumentDetailModal
          isOpen={true}
          onClose={() => {}}
          document={effectiveDocRev01}
        />
      );

      // Header code badge
      const headerBadges = screen.getAllByText('SOP-QA-001');
      expect(headerBadges.length).toBeGreaterThan(0);

      // Document name
      expect(screen.getAllByText('ระเบียบการตรวจประเมินคุณภาพภายในประจำปี').length).toBeGreaterThan(0);
    });

    it('displays Cumulative Lineage for Rev.01: shows (2) items (Rev.01 + Rev.00) and suppresses future Rev.02', () => {
      render(
        <DocumentDetailModal
          isOpen={true}
          onClose={() => {}}
          document={effectiveDocRev01}
        />
      );

      // Tab badge must show exact count (2) representing Rev.01 and Rev.00
      const historyTabBtn = screen.getByRole('button', { name: /ประวัติ DAR และการแก้ไข/i });
      expect(historyTabBtn).toBeInTheDocument();
      expect(screen.getByText(/ประวัติ DAR และการแก้ไข \(2\)/i)).toBeInTheDocument();

      fireEvent.click(historyTabBtn);

      // Header counter states 2 items found
      expect(screen.getByText(/พบทั้งหมด 2 ฉบับ/i)).toBeInTheDocument();

      // Both Rev.01 and Rev.00 DARs must be displayed
      expect(screen.getByText('DAR-2026-055')).toBeInTheDocument();
      expect(screen.getByText('DAR-2025-001')).toBeInTheDocument();

      // Top item (Rev.01) has "ฉบับล่าสุด" badge in active mode
      expect(screen.getByText('ฉบับล่าสุด')).toBeInTheDocument();

      // Future Rev.02 DAR must be strictly suppressed
      expect(screen.queryByText('DAR-2026-099')).not.toBeInTheDocument();
      expect(screen.queryByText(/Future Rev\.02/i)).not.toBeInTheDocument();
    });

    it('displays ONLY Rev.00 for Rev.00 document: shows (1) item and suppresses Rev.01/Rev.02 and "ฉบับล่าสุด"', () => {
      render(
        <DocumentDetailModal
          isOpen={true}
          onClose={() => {}}
          document={supersededDocRev00}
        />
      );

      // Tab badge must show exact count (1)
      const historyTabBtn = screen.getByRole('button', { name: /ประวัติ DAR และการแก้ไข/i });
      expect(historyTabBtn).toBeInTheDocument();
      expect(screen.getByText(/ประวัติ DAR และการแก้ไข \(1\)/i)).toBeInTheDocument();

      fireEvent.click(historyTabBtn);

      // Header counter states 1 item found
      expect(screen.getByText(/พบทั้งหมด 1 ฉบับ/i)).toBeInTheDocument();

      // Only Rev.00 DAR must be displayed
      expect(screen.getByText('DAR-2025-001')).toBeInTheDocument();
      expect(screen.queryByText('DAR-2026-055')).not.toBeInTheDocument();
      expect(screen.queryByText('DAR-2026-099')).not.toBeInTheDocument();

      // Superseded document suppresses "ฉบับล่าสุด"
      expect(screen.queryByText('ฉบับล่าสุด')).not.toBeInTheDocument();
    });

    it('handles numeric revision types without breakage (e.g. rev: 1)', () => {
      const numericRevDoc = {
        ...effectiveDocRev01,
        rev: 1
      };

      render(
        <DocumentDetailModal
          isOpen={true}
          onClose={() => {}}
          document={numericRevDoc}
        />
      );

      expect(screen.getByText(/ประวัติ DAR และการแก้ไข \(2\)/i)).toBeInTheDocument();
    });

    it('constructs cumulative synthetic lineage down to 0 when no explicit DAR in store', () => {
      const unrecordedDoc = {
        id: 'doc-sop-en-002',
        title: 'SOP-EN-002',
        name: 'ระเบียบการซ่อมบำรุงเครื่องจักร',
        department: 'EN',
        rev: '01',
        effectiveDate: '2026-09-01',
        status: 'EFFECTIVE'
      };

      render(
        <DocumentDetailModal
          isOpen={true}
          onClose={() => {}}
          document={unrecordedDoc}
        />
      );

      // Should synthesize Rev.01 and Rev.00 (2 items)
      expect(screen.getByText(/ประวัติ DAR และการแก้ไข \(2\)/i)).toBeInTheDocument();
      const historyTabBtn = screen.getByRole('button', { name: /ประวัติ DAR และการแก้ไข/i });
      fireEvent.click(historyTabBtn);

      expect(screen.getAllByText(/Rev\.01/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Rev\.00/i)).toBeInTheDocument();
    });
  });
});
