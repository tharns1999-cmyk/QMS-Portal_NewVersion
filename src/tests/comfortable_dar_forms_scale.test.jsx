import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DarNewForm from '../pages/DarWorkflow/DarNewForm';
import DarRevisionForm from '../pages/DarWorkflow/DarRevisionForm';
import DarObsoleteForm from '../pages/DarWorkflow/DarObsoleteForm';
import RelatedStandardsSelector from '../components/workflow/RelatedStandardsSelector';
import DocumentAccessControlSelector from '../components/workflow/DocumentAccessControlSelector';
import DistributionSetup from '../components/workflow/DistributionSetup';
import useStore from '../store/useStore';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Enterprise Comfortable DAR Forms Scale & Typography Tests', () => {
  beforeEach(() => {
    useStore.setState({
      currentUser: {
        id: 'u1',
        name: 'ธนาวุฒิ สมควรกิจดำรง',
        department: 'PD',
        role: 'STAFF',
        position_level: 4,
        isDcc: false
      }
    });
  });

  describe('1. DarNewForm (New Document DAR)', () => {
    it('renders comfortable section headers with text-sm font-bold', () => {
      renderWithRouter(<DarNewForm />);
      
      const sec1 = screen.getByText(/ส่วนที่ 1: ข้อมูลผู้ร้องขอ/i);
      expect(sec1.className).toContain('text-sm');
      expect(sec1.className).toContain('font-bold');

      const sec2 = screen.getByText(/ส่วนที่ 2: กำหนดรหัสและประเภทเอกสาร/i);
      expect(sec2.className).toContain('text-sm');
      expect(sec2.className).toContain('font-bold');

      const sec3 = screen.getByText(/ส่วนที่ 3: รายละเอียดคำร้องและเอกสารแนบ/i);
      expect(sec3.className).toContain('text-sm');
      expect(sec3.className).toContain('font-bold');
    });

    it('renders comfortable form labels with text-sm font-semibold', () => {
      const { container } = renderWithRouter(<DarNewForm />);
      
      const labels = Array.from(container.querySelectorAll('label'));
      const reqLabel = labels.find(l => l.textContent.includes('ชื่อผู้ร้องขอ'));
      expect(reqLabel.className).toContain('text-sm');
      expect(reqLabel.className).toContain('font-semibold');

      const docTypeLabel = labels.find(l => l.textContent.includes('ชนิดเอกสาร'));
      expect(docTypeLabel.className).toContain('text-sm');
      expect(docTypeLabel.className).toContain('font-semibold');

      const titleLabel = labels.find(l => l.textContent.includes('ชื่อเอกสาร'));
      expect(titleLabel.className).toContain('text-sm');
      expect(titleLabel.className).toContain('font-semibold');
    });

    it('renders comfortable textareas with min-h-[100px] and text-sm', () => {
      renderWithRouter(<DarNewForm />);
      
      const textareas = screen.getAllByRole('textbox').filter(el => el.tagName === 'TEXTAREA');
      expect(textareas.length).toBeGreaterThanOrEqual(2);
      textareas.forEach(ta => {
        expect(ta.className).toContain('min-h-[100px]');
        expect(ta.className).toContain('text-sm');
      });
    });
  });

  describe('2. DarRevisionForm (Revision DAR)', () => {
    it('renders comfortable section headers and 14px scale form controls', () => {
      renderWithRouter(<DarRevisionForm />);
      
      const sec1 = screen.getByText(/ส่วนที่ 1: ข้อมูลผู้ร้องขอ/i);
      expect(sec1.className).toContain('text-sm');
      expect(sec1.className).toContain('font-bold');

      const sec2 = screen.getByText(/ส่วนที่ 2: เลือกเอกสารและกำหนดวันบังคับใช้/i);
      expect(sec2.className).toContain('text-sm');
      expect(sec2.className).toContain('font-bold');

      const sec3 = screen.getByText(/ส่วนที่ 3: รายละเอียดการขอแก้ไขเอกสาร/i);
      expect(sec3.className).toContain('text-sm');
      expect(sec3.className).toContain('font-bold');

      const changeSummaryTa = screen.getByPlaceholderText(/ระบุข้อความ หัวข้อ หรือขั้นตอนที่ทำการแก้ไข/i);
      expect(changeSummaryTa.className).toContain('min-h-[100px]');
      expect(changeSummaryTa.className).toContain('text-sm');
    });
  });

  describe('3. DarObsoleteForm (Obsolete DAR)', () => {
    it('renders comfortable section headers and 14px scale controls', () => {
      renderWithRouter(<DarObsoleteForm />);
      
      const sec1 = screen.getByText(/ส่วนที่ 1: ข้อมูลผู้ร้องขอ/i);
      expect(sec1.className).toContain('text-sm');
      expect(sec1.className).toContain('font-bold');

      const sec2 = screen.getByText(/ส่วนที่ 2: เอกสารเป้าหมายและวันที่มีผลยกเลิก/i);
      expect(sec2.className).toContain('text-sm');
      expect(sec2.className).toContain('font-bold');

      const sec3 = screen.getByText(/ส่วนที่ 3: เหตุผลและความจำเป็นในการยกเลิก/i);
      expect(sec3.className).toContain('text-sm');
      expect(sec3.className).toContain('font-bold');

      const obsDetailTa = screen.getByPlaceholderText(/อธิบายเหตุผลและผลกระทบของการยกเลิกเอกสารนี้/i);
      expect(obsDetailTa.className).toContain('min-h-[100px]');
      expect(obsDetailTa.className).toContain('text-sm');
    });
  });

  describe('4. RelatedStandardsSelector', () => {
    it('renders comfortable checkboxes with w-4.5 h-4.5 and text-sm labels', () => {
      render(
        <RelatedStandardsSelector
          value={{ relatedStandards: ['ISO 9001'], otherStandardDetail: '' }}
          onChange={() => {}}
        />
      );

      const title = screen.getByText(/ระบบมาตรฐานที่เกี่ยวข้อง/i);
      expect(title.className).toContain('text-sm');
      expect(title.className).toContain('font-bold');

      const iso9001 = screen.getByText('ISO 9001');
      expect(iso9001.className).toContain('text-sm');
    });
  });

  describe('5. DocumentAccessControlSelector', () => {
    it('renders comfortable confidentiality header and scope cards', () => {
      render(
        <DocumentAccessControlSelector
          value={{ scope: 'GENERAL', authorized_depts: [], authorized_users: [], min_access_level: 4 }}
          onChange={() => {}}
          ownerDept="PD"
        />
      );

      const header = screen.getByText(/ระดับการเข้าถึงและความลับของเอกสาร/i);
      expect(header.className).toContain('text-sm');
      expect(header.className).toContain('font-bold');

      const generalTitle = screen.getByText(/ทั่วไป \(General\)/i);
      expect(generalTitle.className).toContain('text-sm');
      expect(generalTitle.className).toContain('font-bold');
    });

    it('enforces locked and read-only owner department in TARGETED mode', () => {
      const handleChange = vi.fn();
      render(
        <DocumentAccessControlSelector
          value={{ scope: 'TARGETED', authorized_depts: ['PD'], authorized_users: [], min_access_level: 4 }}
          onChange={handleChange}
          ownerDept="PD"
          masterDepartments={[{ id: 'PD' }, { id: 'QA' }, { id: 'WH' }]}
        />
      );

      // Verify owner department label with locked badge
      expect(screen.getByText(/เจ้าของ \(ล็อก\)/i)).toBeInTheDocument();
      expect(screen.getByText(/แผนกเจ้าของเอกสาร/i)).toBeInTheDocument();

      // Find all checkboxes
      const checkboxes = screen.getAllByRole('checkbox', { hidden: true });
      const pdCheckbox = checkboxes.find(cb => cb.closest('label').textContent.includes('PD'));
      const qaCheckbox = checkboxes.find(cb => cb.closest('label').textContent.includes('QA'));

      expect(pdCheckbox).toBeDisabled();
      expect(pdCheckbox).toBeChecked();
      expect(qaCheckbox).not.toBeDisabled();

      // Toggling QA works and keeps PD
      fireEvent.click(qaCheckbox.closest('label'));
      expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({
        authorized_depts: expect.arrayContaining(['PD', 'QA'])
      }));
    });
  });

  describe('6. DistributionSetup', () => {
    it('renders comfortable master strip and department buttons', () => {
      render(
        <DistributionSetup
          ownerDept="PD"
          distributions={[]}
          onChange={() => {}}
          documentType="WI"
        />
      );

      const masterText = screen.getByText(/Master Copy 01 ล็อกถาวร/i);
      expect(masterText.className).toContain('text-xs');
      expect(masterText.className).toContain('font-mono');
    });
  });
});
