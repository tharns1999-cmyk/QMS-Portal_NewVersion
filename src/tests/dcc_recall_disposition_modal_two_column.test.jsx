import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DccRecallActionModal from '../components/modals/DccRecallActionModal';
import useStore from '../store/useStore';

describe('DccRecallActionModal High-Efficiency Two-Column Layout Verification', () => {
  const mockGroup = {
    docId: 'DOC-PD-001',
    docCode: 'SOP-PD-01',
    docTitle: 'คู่มือการผลิตและการควบคุมกระบวนการ',
    docVersion: '00',
    taskId: 'TASK-RECALL-001',
    copies: [
      { id: 'cp-01', copy_no: '01', ccNumber: 'CC-01', holder_dept: 'PD', department: 'PD', location: 'สายการผลิต 1' },
      { id: 'cp-02', copy_no: '02', ccNumber: 'CC-02', holder_dept: 'QC', department: 'QC', location: 'ห้องปฏิบัติการ QC' }
    ]
  };

  const mockClose = vi.fn();
  const mockComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Header: renders compact title, monospace badges, and eliminates yellow warning banner', () => {
    render(
      <DccRecallActionModal
        isOpen={true}
        onClose={mockClose}
        group={mockGroup}
        onComplete={mockComplete}
      />
    );

    // Compact title
    expect(screen.getByText(/บันทึกการเรียกคืนและทำลายสำเนา \(Recall & Disposition\)/i)).toBeInTheDocument();

    // Monospace doc code and revision badges
    expect(screen.getByText(/\[ SOP-PD-01 \]/i)).toBeInTheDocument();
    expect(screen.getByText(/Rev\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/คู่มือการผลิตและการควบคุมกระบวนการ/i)).toBeInTheDocument();

    // Yellow banner must be permanently removed
    expect(screen.queryByText(/ประจำจุดใน/i)).not.toBeInTheDocument();
  });

  it('2. Left Column: renders Step 1 with copy cards, eliminates "ได้รับเล่มแล้ว" badge, and shows progress bar', () => {
    render(
      <DccRecallActionModal
        isOpen={true}
        onClose={mockClose}
        group={mockGroup}
        onComplete={mockComplete}
      />
    );

    // Step 1 Header
    expect(screen.getByText(/1\. ตรวจรับเล่มสำเนาจริง/i)).toBeInTheDocument();

    // Copy cards
    expect(screen.getByText(/Copy 01/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy 02/i)).toBeInTheDocument();
    expect(screen.getByText(/สายการผลิต 1/i)).toBeInTheDocument();
    expect(screen.getByText(/ห้องปฏิบัติการ QC/i)).toBeInTheDocument();

    // Old "ได้รับเล่มแล้ว" and "รอเก็บเล่ม" badges must NOT be rendered
    expect(screen.queryByText('ได้รับเล่มแล้ว')).not.toBeInTheDocument();
    expect(screen.queryByText('รอเก็บเล่ม')).not.toBeInTheDocument();

    // Progress bar
    expect(screen.getByText(/ความคืบหน้าการตรวจรับ/i)).toBeInTheDocument();
  });

  it('3. Right Column: renders Step 2 (radio cards) and Step 3 (audit evidence fields)', () => {
    render(
      <DccRecallActionModal
        isOpen={true}
        onClose={mockClose}
        group={mockGroup}
        onComplete={mockComplete}
      />
    );

    // Step 2
    expect(screen.getByText(/2\. วิธีการจัดการทางกายภาพ \(Disposition Method\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ทำลายทิ้ง \(Shred \/ Destroy\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ประทับตรา OBSOLETE & เข้าคลัง/i)).toBeInTheDocument();

    // Step 3
    expect(screen.getByText(/3\. บันทึกหลักฐาน \(Audit Evidence\)/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/REF-DISP-2026-001/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/คุณบีม \(QC\)/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ระบุข้อความบันทึกเพิ่มเติมสำหรับการตรวจประเมิน/i)).toBeInTheDocument();
  });

  it('4. Footer & Validation: disables submit when disposition method missing and enables when ready', () => {
    render(
      <DccRecallActionModal
        isOpen={true}
        onClose={mockClose}
        group={mockGroup}
        onComplete={mockComplete}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /บันทึกการจัดการสำเนาและลงทะเบียน/i });

    // Initial state (both preselected, but no disposition method yet)
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/ยังไม่เลือกวิธีทำลาย/i)).toBeInTheDocument();

    // Select disposition method
    const shredOption = screen.getByRole('radio', { name: /ทำลายทิ้ง \(Shred \/ Destroy\)/i });
    fireEvent.click(shredOption);

    // Now ready
    expect(screen.getByText(/✓ พร้อมลงทะเบียน \(2 ชุด\)/i)).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();

    // Submit triggers complete callback and close
    fireEvent.click(submitBtn);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        collectedCopyIds: ['cp-01', 'cp-02'],
        dispositionMethod: 'DESTROY_SCRAP'
      })
    );
  });
});
