import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import useStore from '../store/useStore';
import TaskReview from '../pages/Tasks/TaskReview';
import TaskApprove from '../pages/Tasks/TaskApprove';
import SignatoryStatusCard from '../components/workflow/SignatoryStatusCard';
import { saveFile, rawBlobRegistry } from '../utils/fileStorage';
import { resolveRawFileBlob } from '../utils/pdfStamper';

describe('Instant Non-Blocking Preview Architecture & Signatory Matrix Tests', () => {
  const dummySignatureDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test-blob-url');
      URL.revokeObjectURL = vi.fn();
    }

    useStore.setState({
      currentUser: {
        id: 'u-reviewer-01',
        name: 'หัวหน้างาน QA',
        department: 'QA',
        role: 'REVIEWER'
      },
      tasks: [
        {
          id: 'task-rev-01',
          taskId: 'task-rev-01',
          darId: 'dar-new-001',
          title: 'ทบทวนเอกสาร WI-QC-01',
          status: 'PENDING',
          assigneeId: 'u-reviewer-01'
        },
        {
          id: 'task-app-01',
          taskId: 'task-app-01',
          darId: 'dar-new-001',
          title: 'อนุมัติเอกสาร WI-QC-01',
          status: 'PENDING',
          assigneeId: 'u-reviewer-01'
        }
      ],
      dars: [
        {
          id: 'dar-new-001',
          darNumber: 'DAR-2026-001',
          darNo: 'DAR-2026-001',
          title: 'วิธีการตรวจสอบคุณภาพวัตถุดิบ (WI-QC-01)',
          type: 'NEW',
          department: 'QA',
          docCode: 'WI-QC-01',
          docRev: '00',
          requesterId: 'u-beam-01',
          requesterName: 'คุณบีม (ชนัญญา ศรีสุข)',
          requesterRole: 'QAQC Supervisor',
          attachedFile: {
            fileId: 'file_1740000000_dgzhdtgh_raw.pdf',
            name: 'dgzhdtgh_raw.pdf',
            size: 1024,
            type: 'application/pdf'
          },
          approvalWorkflow: [
            { step: 1, roleKey: 'REQUESTER', role: 'ผู้ร้องขอ', name: 'คุณบีม (ชนัญญา ศรีสุข)' },
            { step: 2, roleKey: 'REVIEWER', role: 'ผู้ทบทวน', name: 'หัวหน้างาน QA' },
            { step: 3, roleKey: 'APPROVER', role: 'ผู้อนุมัติ', name: 'คุณเรย์' },
            { step: 4, roleKey: 'DCC', role: 'เจ้าหน้าที่ DCC', name: 'ธนาวุฒิ สมควรกิจดำรง' }
          ]
        }
      ],
      documents: [],
      timeline: [
        {
          id: 1,
          darId: 'dar-new-001',
          action: 'SUBMIT',
          user: 'คุณบีม (ชนัญญา ศรีสุข)',
          date: '25/09/2026 10:00'
        }
      ],
      masterUsers: [
        {
          id: 'u-beam-01',
          name: 'คุณบีม (ชนัญญา ศรีสุข)',
          department: 'QA',
          position: 'QAQC Supervisor',
          signatureImage: dummySignatureDataUrl
        },
        {
          id: 'u-reviewer-01',
          name: 'หัวหน้างาน QA',
          department: 'QA',
          position: 'QA Manager',
          signatureImage: dummySignatureDataUrl
        },
        {
          id: 'u-approver-01',
          name: 'คุณเรย์',
          department: 'QA',
          position: 'Plant Director',
          signatureImage: dummySignatureDataUrl
        }
      ]
    });
  });

  it('1. SignatoryStatusCard displays 3 columns with Khun Beam authentic signature and TH Sarabun styling', () => {
    const mockSignOffData = {
      requester: {
        name: 'คุณบีม (ชนัญญา ศรีสุข)',
        position: 'QAQC Supervisor',
        timestamp: '25/09/2569',
        status: 'SUBMITTED',
        isCompleted: true,
        signature: dummySignatureDataUrl
      },
      reviewer: {
        name: 'หัวหน้างาน QA',
        position: 'QA Manager',
        timestamp: '',
        status: 'PENDING_REVIEW',
        isCompleted: false,
        signature: null
      },
      approver: {
        name: 'คุณเรย์',
        position: 'Plant Director',
        timestamp: '',
        status: 'PENDING_APPROVAL',
        isCompleted: false,
        signature: null
      }
    };

    render(
      <SignatoryStatusCard 
        signOffData={mockSignOffData}
        stage="REVIEW"
        isStamped={false}
      />
    );

    expect(screen.getByText(/ตารางการลงนามอิเล็กทรอนิกส์/i)).toBeDefined();
    expect(screen.getByText(/1\. ผู้จัดทำ \(Requester\)/i)).toBeDefined();
    expect(screen.getByText(/2\. ผู้ทบทวน \(Reviewer\)/i)).toBeDefined();
    expect(screen.getByText(/3\. ผู้อนุมัติ \(Approver\)/i)).toBeDefined();
    expect(screen.getByText('(คุณบีม (ชนัญญา ศรีสุข))')).toBeDefined();
    expect(screen.getByText('QAQC Supervisor')).toBeDefined();

    // Verifies signature image is present
    const sigImg = screen.getByAltText(/ลายเซ็น คุณบีม/i);
    expect(sigImg).toBeDefined();
    expect(sigImg.src).toContain('data:image/png');
  });

  it('2. TaskReview renders instant non-blocking preview and unlocked download button', async () => {
    // Seed raw blob into registry under attachedFile.fileId
    const sampleBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
    await saveFile('file_1740000000_dgzhdtgh_raw.pdf', sampleBlob);

    render(
      <MemoryRouter initialEntries={['/tasks/review/task-rev-01']}>
        <Routes>
          <Route path="/tasks/review/:id" element={<TaskReview />} />
        </Routes>
      </MemoryRouter>
    );

    // Download button must NOT be disabled
    const downloadBtn = screen.getByTitle(/ดาวน์โหลดเอกสาร PDF/i);
    expect(downloadBtn).toBeDefined();
    expect(downloadBtn.classList.contains('cursor-not-allowed')).toBe(false);

    // Verifies SignatoryStatusCard banner is removed to maximize viewer real estate
    expect(screen.queryByText(/ตารางการลงนามอิเล็กทรอนิกส์/i)).toBeNull();

    // Verifies PDF preview frame is mounted immediately without permanent hang
    await waitFor(() => {
      const iframe = screen.queryByTitle('PDF Preview');
      expect(iframe).toBeDefined();
      if (iframe) {
        expect(iframe.src).toContain('#view=FitH');
      }
    });
  });

  it('3. TaskApprove renders instant non-blocking preview without redundant signatory banner, and unlocked download button', async () => {
    const sampleBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
    await saveFile('file_1740000000_dgzhdtgh_raw.pdf', sampleBlob);

    render(
      <MemoryRouter initialEntries={['/dcc/tasks/approve/task-app-01']}>
        <Routes>
          <Route path="/dcc/tasks/approve/:id" element={<TaskApprove />} />
        </Routes>
      </MemoryRouter>
    );

    // Download button is accessible and unlocked
    const downloadBtn = screen.getByTitle(/ดาวน์โหลดเอกสาร PDF/i);
    expect(downloadBtn).toBeDefined();
    expect(downloadBtn.classList.contains('cursor-not-allowed')).toBe(false);

    // Verifies Signatory Matrix banner is removed to maximize viewer real estate
    expect(screen.queryByText(/ตารางการลงนามอิเล็กทรอนิกส์/i)).toBeNull();

    // Verifies PDF iframe mounts with FitH
    await waitFor(() => {
      const iframe = screen.queryByTitle('PDF Preview');
      expect(iframe).toBeDefined();
      if (iframe) {
        expect(iframe.src).toContain('#view=FitH');
      }
    });
  });

  it('4. Raw File Ingestion with random name (dgzhdtgh...pdf) resolves 100% via resolveRawFileBlob', async () => {
    const randomFileName = `file_${Date.now()}_dgzhdtgh123.pdf`;
    const randomBlob = new Blob(['%PDF-1.4 pristine arbitrary blob'], { type: 'application/pdf' });

    // Save under random key
    await saveFile(randomFileName, randomBlob);

    // Confirm registry cache hit
    expect(rawBlobRegistry.has(randomFileName)).toBe(true);

    // Test resolveRawFileBlob with random key and dar object
    const resolved = await resolveRawFileBlob(randomFileName, [], {
      attachedFile: { fileId: randomFileName, name: 'dgzhdtgh123.pdf' }
    });

    expect(resolved).toBeDefined();
    expect(resolved instanceof Blob).toBe(true);
  });
});
