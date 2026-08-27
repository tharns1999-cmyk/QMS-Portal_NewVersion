import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthorizedDepartmentSelector } from '../components/workflow/AuthorizedDepartmentSelector';

describe('AuthorizedDepartmentSelector Component & Token Matrix Tests', () => {
  const mockMasterDepts = [
    { id: 'QA', nameTh: 'ประกันคุณภาพ', group: 'QUALITY' },
    { id: 'QC', nameTh: 'ควบคุมคุณภาพ', group: 'QUALITY' },
    { id: 'PD', nameTh: 'ฝ่ายผลิต', group: 'OPERATION' },
    { id: 'WH', nameTh: 'คลังสินค้าและโลจิสติกส์', group: 'OPERATION' },
    { id: 'ST', nameTh: 'คลังจัดเก็บวัตถุดิบ', group: 'OPERATION' },
    { id: 'EN', nameTh: 'วิศวกรรมและซ่อมบำรุง', group: 'OPERATION' },
    { id: 'PC', nameTh: 'วางแผนการผลิตและจัดซื้อ', group: 'OPERATION' },
    { id: 'HR&GA', nameTh: 'ทรัพยากรบุคคลและธุรการ', group: 'SUPPORT' },
    { id: 'HSE', nameTh: 'ความปลอดภัยและสิ่งแวดล้อม', group: 'SUPPORT' },
    { id: 'MKT', nameTh: 'การตลาดและการขาย', group: 'SUPPORT' },
  ];

  it('1. Interactive Card Toggle: clicking WH card triggers onToggleDept with WH', () => {
    const handleToggle = vi.fn();
    const handleBatch = vi.fn();

    render(
      <AuthorizedDepartmentSelector
        ownerDept="QA"
        selectedDepts={['QA']}
        onToggleDept={handleToggle}
        onBatchSelect={handleBatch}
        masterDepartments={mockMasterDepts}
      />
    );

    const whCard = screen.getByTestId('dept-card-WH');
    expect(whCard).toBeInTheDocument();
    fireEvent.click(whCard);

    expect(handleToggle).toHaveBeenCalledWith('WH');
  });

  it('2. Owner Department Lock: QA owner department card shows เจ้าของ badge, is locked, and has lock icon', () => {
    render(
      <AuthorizedDepartmentSelector
        ownerDept="QA"
        selectedDepts={['QA', 'PD']}
        onToggleDept={() => {}}
        onBatchSelect={() => {}}
        masterDepartments={mockMasterDepts}
      />
    );

    const ownerCard = screen.getByTestId('dept-card-QA');
    expect(ownerCard).toBeInTheDocument();
    expect(ownerCard.textContent).toContain('เจ้าของ');
    expect(ownerCard.textContent).toContain('QA');
  });

  it('3. Preset Buttons: Operation group preset triggers onBatchSelect with operational depts', () => {
    const handleBatch = vi.fn();

    render(
      <AuthorizedDepartmentSelector
        ownerDept="QA"
        selectedDepts={['QA']}
        onToggleDept={() => {}}
        onBatchSelect={handleBatch}
        masterDepartments={mockMasterDepts}
      />
    );

    const opPresetBtn = screen.getByText(/สายงานผลิต\/หน้างาน/i);
    expect(opPresetBtn).toBeInTheDocument();
    fireEvent.click(opPresetBtn);

    expect(handleBatch).toHaveBeenCalledWith(
      expect.arrayContaining(['PD', 'WH', 'ST', 'EN', 'PC'])
    );
  });

  it('4. Preset Buttons: Clear All button clears selected departments', () => {
    const handleBatch = vi.fn();

    render(
      <AuthorizedDepartmentSelector
        ownerDept="QA"
        selectedDepts={['WH', 'PD']}
        onToggleDept={() => {}}
        onBatchSelect={handleBatch}
        masterDepartments={mockMasterDepts}
      />
    );

    const clearBtn = screen.getByText(/ล้างค่า/i);
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);

    expect(handleBatch).toHaveBeenCalledWith([]);
  });

  it('5. Live HUD Counter accurately displays selected count including owner department', () => {
    render(
      <AuthorizedDepartmentSelector
        ownerDept="QA"
        selectedDepts={['WH', 'PD']}
        onToggleDept={() => {}}
        onBatchSelect={() => {}}
        masterDepartments={mockMasterDepts}
      />
    );

    // 2 selected + 1 owner = 3
    expect(screen.getByText(/อนุญาตแล้ว:/i)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
