import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import useStore from '../store/useStore';
import PeriodicReviewDetail from '../pages/PeriodicReviews/PeriodicReviewDetail';
import { renderWithRouter, setTestUser } from './test_utils';
import { TEST_PERSONAS } from './fixtures/dccTestUsers';

describe('PeriodicReviewDetail - Two-Column Layout & Compact UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTestUser(TEST_PERSONAS.DEPT_SUPERVISOR); // Supervisor for PD department
    
    useStore.setState({
      documents: [
        {
          id: 'DOC-PD-001',
          code: 'WI-PD-001',
          title: 'คู่มือการปฏิบัติงานฝ่ายผลิต',
          department: 'PD',
          status: 'EFFECTIVE',
          revision: '02',
          owner: 'U005',
          effectiveDate: '2025-01-15'
        }
      ],
      periodicReviewSchedules: [
        {
          id: 'SCH-PD-001',
          documentId: 'DOC-PD-001',
          documentNumber: 'WI-PD-001',
          documentName: 'คู่มือการปฏิบัติงานฝ่ายผลิต',
          ownerDepartmentId: 'PD',
          ownerUserId: 'U005',
          status: 'DUE_SOON',
          dueState: 'DUE_SOON',
          rev: '02',
          originalReviewAnchorDate: '2025-01-15',
          nextReviewDate: '2027-01-15'
        }
      ]
    });
  });

  const renderComponent = (reviewId = 'SCH-PD-001') => {
    return renderWithRouter(
      <Routes>
        <Route path="/dcc/periodic-reviews/:reviewId" element={<PeriodicReviewDetail />} />
      </Routes>,
      { route: `/dcc/periodic-reviews/${reviewId}` }
    );
  };

  it('renders two-column layout with left document context card and right action form', () => {
    const { container } = renderComponent();

    // Verify main two-column grid
    const grid = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-12');
    expect(grid).toBeInTheDocument();

    const leftCol = container.querySelector('.lg\\:col-span-5');
    const rightCol = container.querySelector('.lg\\:col-span-7');
    expect(leftCol).toBeInTheDocument();
    expect(rightCol).toBeInTheDocument();
  });

  it('displays complete document metadata and quick action buttons in left column', () => {
    renderComponent();

    // Header info
    expect(screen.getByText('WI-PD-001')).toBeInTheDocument();
    expect(screen.getByText('คู่มือการปฏิบัติงานฝ่ายผลิต')).toBeInTheDocument();

    // Metadata grid
    expect(screen.getByText('ฉบับที่ (Revision)')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('แผนกเจ้าของ')).toBeInTheDocument();
    expect(screen.getByText('PD')).toBeInTheDocument();
    expect(screen.getByText('ผู้รับผิดชอบ / เจ้าของ')).toBeInTheDocument();
    expect(screen.getByText('U005')).toBeInTheDocument();
    expect(screen.getByText('วันที่มีผลบังคับใช้')).toBeInTheDocument();
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    expect(screen.getByText('วันที่ครบกำหนดรอบนี้')).toBeInTheDocument();
    expect(screen.getByText('2027-01-15')).toBeInTheDocument();

    // Quick Action Bar
    expect(screen.getByRole('button', { name: /เปิดดูไฟล์เอกสาร/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ดูประวัติย้อนหลัง/i })).toBeInTheDocument();
  });

  it('renders 3 outcome cards with icons and active styles on selection', async () => {
    renderComponent();

    // Form title
    expect(screen.getByText('แบบฟอร์มบันทึกผลการทบทวน')).toBeInTheDocument();

    // 3 Outcome radio options
    const noChangeOption = screen.getByText('ไม่มีการเปลี่ยนแปลง');
    const revisionOption = screen.getByText('ต้องแก้ไขเอกสาร');
    const obsoleteOption = screen.getByText('ต้องยกเลิกเอกสาร');

    expect(noChangeOption).toBeInTheDocument();
    expect(revisionOption).toBeInTheDocument();
    expect(obsoleteOption).toBeInTheDocument();

    // Click "ไม่มีการเปลี่ยนแปลง"
    await userEvent.click(noChangeOption);
    const noChangeRadio = screen.getByRole('radio', { name: /ไม่มีการเปลี่ยนแปลง/i });
    expect(noChangeRadio.checked).toBe(true);

    // Switch to "ต้องแก้ไขเอกสาร"
    await userEvent.click(revisionOption);
    const revisionRadio = screen.getByRole('radio', { name: /ต้องแก้ไขเอกสาร/i });
    expect(revisionRadio.checked).toBe(true);
    expect(noChangeRadio.checked).toBe(false);
  });

  it('renders compact 2-column input fields and action buttons', () => {
    renderComponent();

    // Reason textarea
    expect(screen.getByText(/เหตุผล \/ รายละเอียดการทบทวน/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ระบุเหตุผลที่เลือกผลลัพธ์ดังกล่าว...')).toBeInTheDocument();

    // 4 compact inputs
    expect(screen.getByText('ประเด็นที่พบ')).toBeInTheDocument();
    expect(screen.getByText('มาตรฐานหรือข้อกำหนดที่ใช้พิจารณา')).toBeInTheDocument();
    expect(screen.getByText('ข้อมูลหรือหลักฐานอ้างอิง')).toBeInTheDocument();
    expect(screen.getByText('ความคิดเห็นเพิ่มเติม')).toBeInTheDocument();

    // Action buttons
    expect(screen.getByRole('button', { name: 'ยกเลิก' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'บันทึกผลการทบทวน' })).toBeInTheDocument();
  });

  it('opens document modal when clicking quick action button', async () => {
    renderComponent();

    const openDocBtn = screen.getByRole('button', { name: /เปิดดูไฟล์เอกสาร/i });
    await userEvent.click(openDocBtn);

    // Document detail modal should be opened
    await waitFor(() => {
      expect(screen.getAllByText('WI-PD-001').length).toBeGreaterThan(1);
    });
  });
});
