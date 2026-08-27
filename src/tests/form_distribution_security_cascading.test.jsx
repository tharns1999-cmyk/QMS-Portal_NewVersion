import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DistributionSetup from '../components/workflow/DistributionSetup';
import FormDistributionSetup from '../components/workflow/FormDistributionSetup';
import useStore from '../store/useStore';

describe('Enterprise Security: Strict Access Scope Cascading & Form Distribution Boundary Tests', () => {
  const mockMasterDepts = [
    { id: 'QA', name: 'ฝ่ายประกันคุณภาพ', nameTh: 'ฝ่ายประกันคุณภาพ', code: 'QA', status: 'ACTIVE' },
    { id: 'PD', name: 'ฝ่ายผลิต', nameTh: 'ฝ่ายผลิต', code: 'PD', status: 'ACTIVE' },
    { id: 'WH', name: 'ฝ่ายคลังสินค้า', nameTh: 'ฝ่ายคลังสินค้า', code: 'WH', status: 'ACTIVE' },
    { id: 'EN', name: 'ฝ่ายวิศวกรรม', nameTh: 'ฝ่ายวิศวกรรม', code: 'EN', status: 'ACTIVE' }
  ];

  beforeEach(() => {
    useStore.setState({
      masterDepartments: mockMasterDepts,
      currentUser: {
        id: 'U002',
        name: 'กัลยาณี พลไกร',
        department: 'QA',
        role: 'DEPT_ADMIN'
      }
    });
  });

  describe('1. FormDistributionSetup Component Direct Unit Tests', () => {
    it('locks to Owner Department and disables ALL_DEPTS when accessScope is DEPT_ONLY', () => {
      let currentMode = 'SPECIFIC_DEPTS';
      const onChangeMode = vi.fn((m) => { currentMode = m; });

      render(
        <FormDistributionSetup
          accessScope="DEPT_ONLY"
          ownerDept="QA"
          distributionMode={currentMode}
          selectedDepts={['QA']}
          onChangeMode={onChangeMode}
          allDepartments={mockMasterDepts}
        />
      );

      // Verify Option 1 (All Departments) is disabled
      const allDeptsCard = screen.getByTestId('form-dist-all-depts');
      expect(allDeptsCard).toHaveClass('cursor-not-allowed');
      expect(screen.getByText(/ปิดใช้งานอัตโนมัติ: เนื่องจากระดับความลับถูกจำกัดสิทธิ์เฉพาะแผนก/i)).toBeInTheDocument();

      // Click All Departments card -> must NOT trigger onChangeMode
      fireEvent.click(allDeptsCard);
      expect(onChangeMode).not.toHaveBeenCalled();

      // Verify Option 2 (Owner Dept Only) is active
      expect(screen.getByText(/เฉพาะแผนก QA เท่านั้น \(Owner Dept\)/i)).toBeInTheDocument();
      expect(screen.getByText(/ล็อกตามระดับความลับ: ใช้งานได้เฉพาะบุคลากรในแผนก QA/i)).toBeInTheDocument();

      // Verify Smart Helper Guidance Banner
      expect(screen.getByText(/ต้องการให้แผนกอื่นดาวน์โหลดแบบฟอร์มนี้ไปใช้งานด้วยหรือไม่\?/i)).toBeInTheDocument();
    });

    it('allows full freedom to toggle between ALL_DEPTS and SPECIFIC_DEPTS when accessScope is GENERAL', () => {
      const onChangeMode = vi.fn();
      const onToggleDept = vi.fn();

      render(
        <FormDistributionSetup
          accessScope="GENERAL"
          ownerDept="QA"
          distributionMode="SPECIFIC_DEPTS"
          selectedDepts={['QA', 'PD']}
          onChangeMode={onChangeMode}
          onToggleDept={onToggleDept}
          allDepartments={mockMasterDepts}
        />
      );

      // Verify Option 1 is clickable
      const allDeptsCard = screen.getByTestId('form-dist-all-depts');
      expect(allDeptsCard).not.toHaveClass('cursor-not-allowed');

      fireEvent.click(allDeptsCard);
      expect(onChangeMode).toHaveBeenCalledWith('ALL_DEPTS');

      // Verify department list is visible for SPECIFIC_DEPTS
      expect(screen.getByText(/เลือกแผนกที่ต้องใช้งานแบบฟอร์มนี้/i)).toBeInTheDocument();
      expect(screen.getByText(/ฝ่ายผลิต \(PD\)/i)).toBeInTheDocument();
      expect(screen.getByText(/ฝ่ายคลังสินค้า \(WH\)/i)).toBeInTheDocument();
    });

    it('filters selectable departments in TARGETED access scope to authorized departments only', () => {
      const accessControl = {
        scope: 'TARGETED',
        authorized_depts: ['PD', 'WH']
      };

      render(
        <FormDistributionSetup
          accessControl={accessControl}
          ownerDept="QA"
          distributionMode="SPECIFIC_DEPTS"
          selectedDepts={['QA', 'PD']}
          allDepartments={mockMasterDepts}
        />
      );

      // Target scope notice
      expect(screen.getByText(/กรองเฉพาะแผนกที่ได้รับอนุญาตตามระดับความลับ \(Targeted\)/i)).toBeInTheDocument();

      // QA (owner), PD, WH are visible, EN is excluded
      expect(screen.getByText(/ฝ่ายผลิต \(PD\)/i)).toBeInTheDocument();
      expect(screen.getByText(/ฝ่ายคลังสินค้า \(WH\)/i)).toBeInTheDocument();
      expect(screen.queryByText(/ฝ่ายวิศวกรรม \(EN\)/i)).not.toBeInTheDocument();
    });
  });

  describe('2. DistributionSetup Integrated FM Cascading Guard Tests', () => {
    it('FM Document with DEPT_ONLY scope locks distribution to Owner Dept in DistributionSetup', () => {
      let emittedDistributions = [];
      const onChange = vi.fn((d) => { emittedDistributions = d; });

      render(
        <DistributionSetup
          ownerDept="QA"
          distributions={[]}
          onChange={onChange}
          documentType="FM"
          accessScope="DEPT_ONLY"
          accessControl={{ scope: 'DEPT_ONLY', authorized_depts: [] }}
        />
      );

      // Header and badge for digital form
      expect(screen.getByText(/ระบบแจกจ่ายแบบฟอร์มบันทึกข้อมูล/i)).toBeInTheDocument();
      expect(screen.getByText(/Bypass.*สำเนาควบคุม/i)).toBeInTheDocument();

      // ALL_DEPTS is disabled
      const allDeptsBtn = screen.getByTestId('form-dist-all-depts');
      expect(allDeptsBtn).toHaveClass('cursor-not-allowed');

      // Helper guidance for Dept Only is rendered
      expect(screen.getByText(/ต้องการให้แผนกอื่นดาวน์โหลดแบบฟอร์มนี้ไปใช้งานด้วยหรือไม่/i)).toBeInTheDocument();
    });

    it('Non-FM Document (e.g. SOP/WI) continues to render standard physical controlled copy station matrix', () => {
      render(
        <DistributionSetup
          ownerDept="QA"
          distributions={[]}
          onChange={() => {}}
          documentType="SOP"
          accessScope="DEPT_ONLY"
        />
      );

      // Renders Master Copy 01 lock badge
      expect(screen.getByText(/Master Copy 01 ล็อกถาวร/i)).toBeInTheDocument();
      // Does NOT render FM Digital Form header
      expect(screen.queryByText(/ระบบแจกจ่ายแบบฟอร์มบันทึกข้อมูล/i)).not.toBeInTheDocument();
    });
  });
});
