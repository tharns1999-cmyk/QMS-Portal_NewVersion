import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DarNewForm from '../pages/DarWorkflow/DarNewForm';
import useStore from '../store/useStore';

describe('Layout Cleanliness & Ghost Container Elimination Tests', () => {
  beforeEach(() => {
    useStore.setState({
      currentUser: { id: 'U001', name: 'Admin QA', department: 'QA', role: 'DCC_ADMIN' },
      masterUsers: [{ id: 'U001', name: 'Admin QA', department: 'QA', role: 'DCC_ADMIN', level: 1 }],
      documentTypes: [
        { id: 'SOP', code: 'SOP', name: 'Standard Operating Procedure', allowDar: true, status: 'ACTIVE' },
        { id: 'FM', code: 'FM', name: 'Form / Record Format', allowDar: true, status: 'ACTIVE', is_form_type: true }
      ],
      masterDepartments: [
        { id: 'QA', code: 'QA', name: 'ฝ่ายประกันคุณภาพ', nameTh: 'ฝ่ายประกันคุณภาพ' },
        { id: 'PD', code: 'PD', name: 'ฝ่ายผลิต', nameTh: 'ฝ่ายผลิต' }
      ],
      dars: [],
      documents: []
    });
  });

  it('renders standard Distribution Matrix (DistributionSetup) when docType is SOP and does not render FormDistributionSetup', () => {
    render(
      <MemoryRouter initialEntries={['/dar/new/create']}>
        <Routes>
          <Route path="/dar/new/create" element={<DarNewForm />} />
        </Routes>
      </MemoryRouter>
    );

    // Select docType: SOP
    const selectDocType = screen.getAllByRole('combobox')[0];
    fireEvent.change(selectDocType, { target: { value: 'SOP' } });

    // Expect Controlled Copy Matrix header (Master Copy 01 ล็อกถาวร) to be in the document
    expect(screen.getByText(/Master Copy 01 ล็อกถาวร/i)).toBeInTheDocument();
    // Expect Digital Form Distribution header to NOT be in the document
    expect(screen.queryByText(/ระบบแจกจ่ายแบบฟอร์มบันทึกข้อมูล \(Digital Form Distribution\)/i)).not.toBeInTheDocument();
  });

  it('renders FormDistributionSetup when docType is FM and does not render Controlled Copy Matrix', () => {
    render(
      <MemoryRouter initialEntries={['/dar/new/create']}>
        <Routes>
          <Route path="/dar/new/create" element={<DarNewForm />} />
        </Routes>
      </MemoryRouter>
    );

    // Select docType: FM
    const selectDocType = screen.getAllByRole('combobox')[0];
    fireEvent.change(selectDocType, { target: { value: 'FM' } });

    // Expect Digital Form Distribution header to be in the document
    expect(screen.getByText(/ระบบแจกจ่ายแบบฟอร์มบันทึกข้อมูล \(Digital Form Distribution\)/i)).toBeInTheDocument();
    // Expect Controlled Copy Matrix header to NOT be in the document
    expect(screen.queryByText(/Master Copy 01 ล็อกถาวร/i)).not.toBeInTheDocument();
  });
});
