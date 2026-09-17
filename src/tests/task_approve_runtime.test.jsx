import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import useStore from '../store/useStore';
import TaskApprove from '../pages/Tasks/TaskApprove';
import TaskReview from '../pages/Tasks/TaskReview';

describe('TaskApprove & TaskReview Runtime Verification (Zero WSOD & No motion errors)', () => {
  beforeEach(() => {
    useStore.setState({
      currentUser: {
        id: 'U002',
        name: 'Manager QA',
        department: 'QA',
        role: 'APPROVER'
      },
      tasks: [
        {
          id: 't-1789627537871',
          taskId: 't-1789627537871',
          darId: 'dar-001',
          title: 'อนุมัติเอกสาร SOP-QA-001',
          status: 'PENDING',
          dueDate: '2026-09-20'
        }
      ],
      dars: [
        {
          id: 'dar-001',
          darNumber: 'DAR-2026-001',
          title: 'ขั้นตอนการปฏิบัติงานการสอบเทียบ',
          type: 'REVISION',
          department: 'QA',
          docCode: 'SOP-QA-001',
          docRev: '00',
          effectiveDate: '2026-10-01',
          approvalWorkflow: [
            { step: 1, roleKey: 'REQUESTER', role: 'ผู้ร้องขอ', name: 'พนักงาน QA' },
            { step: 2, roleKey: 'REVIEWER', role: 'ผู้ทบทวน', name: 'หัวหน้างาน QA' },
            { step: 3, roleKey: 'APPROVER', role: 'ผู้อนุมัติ', name: 'Manager QA' }
          ]
        }
      ],
      documents: [],
      timeline: [],
      masterDepartments: [{ id: 'QA', nameTh: 'แผนกควบคุมคุณภาพ', name: 'Quality Assurance' }],
      masterUsers: []
    });
  });

  it('renders TaskApprove without motion ReferenceError when task is found', () => {
    render(
      <MemoryRouter initialEntries={['/dcc/tasks/approve/t-1789627537871']}>
        <Routes>
          <Route path="/dcc/tasks/approve/:id" element={<TaskApprove />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('อนุมัติเอกสาร')).toBeDefined();
    expect(screen.getByText('DAR-2026-001')).toBeDefined();
    expect(screen.getByText('เอกสารฉบับเต็ม')).toBeDefined();
  });

  it('renders TaskApprove fallback safely without ReferenceError when task is not found', () => {
    render(
      <MemoryRouter initialEntries={['/dcc/tasks/approve/non-existent-task']}>
        <Routes>
          <Route path="/dcc/tasks/approve/:id" element={<TaskApprove />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('ไม่พบข้อมูลคำร้องหรือภารกิจนี้')).toBeDefined();
    expect(screen.getByText('กลับสู่หน้ารายการงาน (Task Inbox)')).toBeDefined();
  });

  it('renders TaskReview without motion ReferenceError', () => {
    render(
      <MemoryRouter initialEntries={['/dcc/tasks/review/t-1789627537871']}>
        <Routes>
          <Route path="/dcc/tasks/review/:id" element={<TaskReview />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('ทบทวนเอกสาร')).toBeDefined();
    expect(screen.getByText('DAR-2026-001')).toBeDefined();
  });
});
