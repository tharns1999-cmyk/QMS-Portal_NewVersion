import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExternalDocsList from '../pages/ExternalDocs/ExternalDocsList';
import useStore from '../store/useStore';

describe('ExternalDocsList Full-Width Layout & Component Structure Tests', () => {
  const dccUser = {
    id: 'U001',
    name: 'Admin QA (DCC)',
    department: 'QA',
    role: 'DCC_ADMIN',
    level: 1,
    isDcc: true
  };

  const sampleDocs = [
    {
      id: 'ed-001',
      edCode: 'ED-QA-01',
      title: 'ISO 9001:2015 Quality Management Systems',
      source: 'ISO Standard Org',
      sourceVersion: '5th Edition',
      department: 'QA',
      status: 'ACTIVE',
      accessScope: 'General',
      effectiveDate: '2026-01-01',
      reviewCycleMonths: 12
    },
    {
      id: 'ed-002',
      edCode: 'ED-PD-01',
      title: 'FDA Food Safety Modernization Act Guidelines',
      source: 'US FDA',
      sourceVersion: 'Ver 2.0',
      department: 'PD',
      status: 'PENDING_EXT_REVIEW',
      accessScope: 'Department',
      effectiveDate: '2026-02-01',
      reviewCycleMonths: 12
    }
  ];

  beforeEach(() => {
    useStore.getState().resetStore();
    useStore.setState({
      currentUser: dccUser,
      externalDocuments: sampleDocs,
      masterDepartments: [
        { id: 'QA', nameTh: 'ฝ่ายประกันคุณภาพ' },
        { id: 'PD', nameTh: 'ฝ่ายผลิต' }
      ]
    });
  });

  it('1. Renders full-width layout container without max-width constraints', () => {
    const { container } = render(
      <MemoryRouter>
        <ExternalDocsList />
      </MemoryRouter>
    );

    const outerWrapper = container.firstChild;
    expect(outerWrapper).toHaveClass('w-full');
    expect(outerWrapper).not.toHaveClass('max-w-7xl');
    expect(outerWrapper).not.toHaveClass('max-w-6xl');
    expect(outerWrapper).not.toHaveClass('max-w-5xl');
  });

  it('2. Renders all 4 metric stats cards with correct numbers', () => {
    render(
      <MemoryRouter>
        <ExternalDocsList />
      </MemoryRouter>
    );

    expect(screen.getByText('เอกสารทั้งหมด')).toBeInTheDocument();
    expect(screen.getAllByText('ใช้งานอยู่').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('รอทบทวน/อนุมัติ')).toBeInTheDocument();
    expect(screen.getByText('ใกล้/เกินกำหนดทบทวน')).toBeInTheDocument();

    // Total count is 2, active is 1, pending is 1
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
  });

  it('3. Renders full-width data table with search and filters', () => {
    render(
      <MemoryRouter>
        <ExternalDocsList />
      </MemoryRouter>
    );

    // Verify document code rendered
    expect(screen.getByText('ED-QA-01')).toBeInTheDocument();
    expect(screen.getByText('ISO 9001:2015 Quality Management Systems')).toBeInTheDocument();

    // Filter by search
    const searchInput = screen.getByPlaceholderText(/ค้นหารหัส ED, ชื่อ, แหล่งที่มา/i);
    fireEvent.change(searchInput, { target: { value: 'FDA' } });

    expect(screen.getByText('ED-PD-01')).toBeInTheDocument();
    expect(screen.queryByText('ED-QA-01')).not.toBeInTheDocument();
  });

  it('4. Header button "ลงทะเบียนเอกสารภายนอก" opens registration modal', () => {
    render(
      <MemoryRouter>
        <ExternalDocsList />
      </MemoryRouter>
    );

    const regBtn = screen.getByRole('button', { name: /ลงทะเบียนเอกสารภายนอก/i });
    fireEvent.click(regBtn);

    // Modal title should appear
    expect(screen.getByText(/ลงทะเบียนเอกสารภายนอก \(Register External Document\)/i)).toBeInTheDocument();
  });
});
