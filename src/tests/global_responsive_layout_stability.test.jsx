import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import DarNewForm from '../pages/DarWorkflow/DarNewForm';
import DarRevisionForm from '../pages/DarWorkflow/DarRevisionForm';
import DarObsoleteForm from '../pages/DarWorkflow/DarObsoleteForm';
import useStore from '../store/useStore';

describe('Enterprise Responsive Layout & Viewport Height Stability Tests', () => {
  beforeEach(() => {
    useStore.setState({
      currentUser: {
        id: 'U002',
        name: 'ธนาวุฒิ สมควรกิจดำรง',
        department: 'PD',
        level: 4,
        role: 'STAFF'
      },
      masterDepartments: [
        { id: 'PD', name: 'ฝ่ายผลิต (PD)', status: 'ACTIVE' },
        { id: 'QA', name: 'ฝ่ายประกันคุณภาพ (QA)', status: 'ACTIVE' },
        { id: 'WH', name: 'คลังสินค้า (WH)', status: 'ACTIVE' },
        { id: 'EN', name: 'วิศวกรรม (EN)', status: 'ACTIVE' }
      ]
    });
  });

  it('1. Root Layout provides full viewport height without ghost scrolling container and has min-h-0', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dcc/dar/new']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/dcc/dar/new" element={<DarNewForm />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const mainElement = container.querySelector('main');
    expect(mainElement).not.toBeNull();
    expect(mainElement.className).toContain('min-h-0');
    expect(mainElement.className).toContain('overflow-y-auto');
    expect(mainElement.className).not.toContain('justify-between');
  });

  it('2. DarNewForm, DarRevisionForm, and DarObsoleteForm containers use h-auto and min-h-0', () => {
    const { container: newContainer } = render(
      <MemoryRouter>
        <DarNewForm />
      </MemoryRouter>
    );
    const newFormRoot = newContainer.firstChild;
    expect(newFormRoot.className).toContain('min-h-0');
    expect(newFormRoot.className).toContain('h-auto');

    const { container: revContainer } = render(
      <MemoryRouter>
        <DarRevisionForm />
      </MemoryRouter>
    );
    const revFormRoot = revContainer.firstChild;
    expect(revFormRoot.className).toContain('min-h-0');
    expect(revFormRoot.className).toContain('h-auto');

    const { container: obsContainer } = render(
      <MemoryRouter>
        <DarObsoleteForm />
      </MemoryRouter>
    );
    const obsFormRoot = obsContainer.firstChild;
    expect(obsFormRoot.className).toContain('min-h-0');
    expect(obsFormRoot.className).toContain('h-auto');
  });

  it('3. Dynamic Scope Selection Reflow (TARGETED -> WH toggle) expands cleanly without viewport jump', () => {
    render(
      <MemoryRouter>
        <DarNewForm />
      </MemoryRouter>
    );

    // Switch to TARGETED scope
    const targetedBtn = screen.getByText(/เฉพาะบางแผนก \(Targeted\)/i);
    expect(targetedBtn).toBeDefined();
    fireEvent.click(targetedBtn);

    // Check that Authorized Departments panel appears
    expect(screen.getByText(/เลือกแผนกที่อนุญาตให้เข้าถึงเอกสารนี้/i)).toBeDefined();

    // Toggle WH department
    const whCheckbox = screen.getByLabelText(/WH/i);
    if (whCheckbox) {
      fireEvent.click(whCheckbox);
    }

    // Ensure no broken layout or container collapse
    expect(screen.getByText(/ส่งคำขอ \(Submit DAR\)/i)).toBeDefined();
  });
});
