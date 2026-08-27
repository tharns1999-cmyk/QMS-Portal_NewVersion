import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormDistributionSetup from '../components/workflow/FormDistributionSetup';
import DistributionSetup from '../components/workflow/DistributionSetup';
import useStore from '../store/useStore';

describe('Enterprise Security & UX Alignment: Strict Cascading Constraint for TARGETED Access Scope', () => {
  const mockAllDepartments = [
    { id: 'QA', code: 'QA', name: 'ฝ่ายประกันคุณภาพ', nameTh: 'ฝ่ายประกันคุณภาพ' },
    { id: 'PD', code: 'PD', name: 'ฝ่ายผลิต', nameTh: 'ฝ่ายผลิต' },
    { id: 'WH', code: 'WH', name: 'ฝ่ายคลังสินค้า', nameTh: 'ฝ่ายคลังสินค้า' },
    { id: 'EN', code: 'EN', name: 'ฝ่ายวิศวกรรม', nameTh: 'ฝ่ายวิศวกรรม' },
    { id: 'PC', code: 'PC', name: 'ฝ่ายจัดซื้อ', nameTh: 'ฝ่ายจัดซื้อ' },
    { id: 'HR&GA', code: 'HR&GA', name: 'ฝ่ายบุคคล', nameTh: 'ฝ่ายบุคคล' }
  ];

  beforeEach(() => {
    useStore.setState({
      masterDepartments: mockAllDepartments,
      departments: mockAllDepartments,
      currentUser: { id: 'U001', name: 'QA Admin', department: 'QA', role: 'DCC_ADMIN' }
    });
  });

  describe('1. FormDistributionSetup: Strict Targeted Cascade Lock & Filtering', () => {
    it('disables All Departments option when accessScope is TARGETED and blocks click', () => {
      const onChangeMode = vi.fn();

      render(
        <FormDistributionSetup
          accessScope="TARGETED"
          accessControl={{
            scope: 'TARGETED',
            authorized_depts: ['PD', 'WH']
          }}
          ownerDept="QA"
          distributionMode="SPECIFIC_DEPTS"
          selectedDepts={['QA', 'PD', 'WH']}
          allDepartments={mockAllDepartments}
          onChangeMode={onChangeMode}
        />
      );

      const allDeptsCard = screen.getByTestId('form-dist-all-depts');
      expect(allDeptsCard).toHaveClass('cursor-not-allowed');
      expect(screen.getByText(/ปิดใช้งาน: ระดับความลับถูกจำกัดเฉพาะบางแผนก/i)).toBeInTheDocument();

      // Click should be blocked
      fireEvent.click(allDeptsCard);
      expect(onChangeMode).not.toHaveBeenCalled();
    });

    it('filters selectable departments to only Owner Dept and Authorized Departments (QA + PD + WH)', () => {
      render(
        <FormDistributionSetup
          accessScope="TARGETED"
          accessControl={{
            scope: 'TARGETED',
            authorized_depts: ['PD', 'WH']
          }}
          ownerDept="QA"
          distributionMode="SPECIFIC_DEPTS"
          selectedDepts={['QA', 'PD', 'WH']}
          allDepartments={mockAllDepartments}
        />
      );

      // QA, PD, WH should be visible
      expect(screen.getByText(/ฝ่ายประกันคุณภาพ \(QA\)/i)).toBeInTheDocument();
      expect(screen.getByText(/ฝ่ายผลิต \(PD\)/i)).toBeInTheDocument();
      expect(screen.getByText(/ฝ่ายคลังสินค้า \(WH\)/i)).toBeInTheDocument();

      // EN, PC, HR&GA should NOT be in the rendered list
      expect(screen.queryByText(/ฝ่ายวิศวกรรม \(EN\)/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/ฝ่ายจัดซื้อ \(PC\)/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/ฝ่ายบุคคล \(HR&GA\)/i)).not.toBeInTheDocument();
    });

    it('renders guidance explaining that General scope is required to distribute to all departments', () => {
      render(
        <FormDistributionSetup
          accessScope="TARGETED"
          accessControl={{
            scope: 'TARGETED',
            authorized_depts: ['PD']
          }}
          ownerDept="QA"
          distributionMode="SPECIFIC_DEPTS"
          selectedDepts={['QA', 'PD']}
          allDepartments={mockAllDepartments}
        />
      );

      expect(screen.getByText(/ต้องการแจกจ่ายแบบฟอร์มให้ทุกแผนกในองค์กรหรือไม่\?/i)).toBeInTheDocument();
      expect(screen.getByText(/'ทั่วไป \(General\)'/i)).toBeInTheDocument();
    });
  });

  describe('2. DistributionSetup in FM Mode: Strict Targeted Cascading', () => {
    it('disables All Departments card in DistributionSetup when documentType is FM and scope is TARGETED', () => {
      const onChange = vi.fn();

      render(
        <DistributionSetup
          documentType="FM"
          ownerDept="QA"
          accessControl={{
            scope: 'TARGETED',
            authorized_depts: ['PD', 'WH']
          }}
          accessScope="TARGETED"
          distributions={[{ departmentId: 'QA' }, { departmentId: 'PD' }]}
          onChange={onChange}
        />
      );

      const allDeptsCard = screen.getByTestId('form-dist-all-depts');
      expect(allDeptsCard).toHaveClass('cursor-not-allowed');
      expect(screen.getByText(/ปิดใช้งาน: ระดับความลับถูกจำกัดเฉพาะบางแผนก/i)).toBeInTheDocument();

      fireEvent.click(allDeptsCard);
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
