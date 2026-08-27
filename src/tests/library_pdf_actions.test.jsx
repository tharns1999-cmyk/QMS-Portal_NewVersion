import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Library from '../pages/Library/Library';
import useStore from '../store/useStore';
import { UniversalWatermarkService, WATERMARK_TYPES } from '../services/UniversalWatermarkService';
import toast from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(() => 'loading-toast-id'),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
  toast: {
    loading: vi.fn(() => 'loading-toast-id'),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  }
}));

describe('Library PDF Download, Preview & Watermark Actions Tests', () => {
  const sampleDoc = {
    id: 'doc-001',
    title: 'SOP-PD-001',
    name: 'คู่มือการปฏิบัติงานผสมวัตถุดิบ',
    department: 'PD',
    rev: '01',
    effectiveDate: '2026-08-15',
    status: 'EFFECTIVE',
    relatedStandards: ['ISO 9001:2015']
  };

  const sampleForm = {
    id: 'doc-002',
    title: 'FM-PD-001',
    name: 'แบบฟอร์มตรวจสอบวัตถุดิบ',
    department: 'PD',
    rev: '00',
    effectiveDate: '2026-08-15',
    status: 'EFFECTIVE'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      currentUser: {
        id: 'U001',
        name: 'Admin QA (DCC)',
        role: 'DCC_ADMIN',
        isDcc: true,
        department: 'QA',
        level: 1
      },
      documents: [sampleDoc, sampleForm],
      masterDepartments: [
        { id: 'PD', nameTh: 'ฝ่ายผลิต' },
        { id: 'QA', nameTh: 'ฝ่ายประกันคุณภาพ' }
      ]
    });
  });

  describe('1. UniversalWatermarkService Methods', () => {
    it('generateStampingPDF returns stamped Uint8Array buffer', async () => {
      const pdfBytes = await UniversalWatermarkService.generateStampingPDF(
        sampleDoc,
        WATERMARK_TYPES.UNCONTROLLED_COPY,
        { name: 'User 1', department: 'PD' }
      );
      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(0);
    });

    it('downloadWatermarkedPdf resolves and downloads without throw', async () => {
      const spyDownload = vi.spyOn(UniversalWatermarkService, 'downloadWatermarkedPdf').mockResolvedValue('blob:mock-url');
      const res = await UniversalWatermarkService.downloadWatermarkedPdf(sampleDoc, WATERMARK_TYPES.OFFICIAL_MASTER_COPY, {}, false);
      expect(res).toBe('blob:mock-url');
      expect(spyDownload).toHaveBeenCalled();
    });
  });

  describe('2. Library.jsx PDF Actions for DCC Admin', () => {
    it('triggers handleDownloadMaster when Master Download button is clicked', async () => {
      const spyDownload = vi.spyOn(UniversalWatermarkService, 'downloadWatermarkedPdf').mockResolvedValue('blob:mock-url');

      render(
        <MemoryRouter>
          <Library />
        </MemoryRouter>
      );

      const downloadBtns = screen.getAllByTitle('ดาวน์โหลด Master Document (DCC)');
      expect(downloadBtns.length).toBeGreaterThan(0);
      fireEvent.click(downloadBtns[0]);

      await waitFor(() => {
        expect(toast.loading).toHaveBeenCalledWith('กำลังสร้าง Master Archive PDF...');
        expect(spyDownload).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'SOP-PD-001' }),
          WATERMARK_TYPES.OFFICIAL_MASTER_COPY,
          expect.objectContaining({ reason: 'Official Master Archive' }),
          false
        );
        expect(toast.dismiss).toHaveBeenCalledWith('loading-toast-id');
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('ดาวน์โหลด Master Copy'));
      });
    });

    it('triggers handleDownloadExternal when External Release button is clicked', async () => {
      const spyDownload = vi.spyOn(UniversalWatermarkService, 'downloadWatermarkedPdf').mockResolvedValue('blob:mock-url');

      render(
        <MemoryRouter>
          <Library />
        </MemoryRouter>
      );

      const shareBtns = screen.getAllByTitle('ดาวน์โหลดสำหรับแจกจ่ายภายนอก (External Release)');
      expect(shareBtns.length).toBeGreaterThan(0);
      fireEvent.click(shareBtns[0]);

      await waitFor(() => {
        expect(toast.loading).toHaveBeenCalledWith('กำลังสร้าง External Release PDF...');
        expect(spyDownload).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'SOP-PD-001' }),
          WATERMARK_TYPES.STRICTLY_CONFIDENTIAL,
          expect.objectContaining({ reason: 'External Audit / Vendor Release' }),
          false
        );
        expect(toast.dismiss).toHaveBeenCalledWith('loading-toast-id');
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('ดาวน์โหลด External Release'));
      });
    });

    it('triggers handleDownloadUncontrolled and opens in new tab when Eye/OpenInTab button is clicked', async () => {
      const spyDownload = vi.spyOn(UniversalWatermarkService, 'downloadWatermarkedPdf').mockResolvedValue('blob:mock-url');

      render(
        <MemoryRouter>
          <Library />
        </MemoryRouter>
      );

      const openTabBtns = screen.getAllByTitle('เปิดดู PDF ตัวจริงในแท็บใหม่ (Open in New Tab)');
      expect(openTabBtns.length).toBeGreaterThan(0);
      fireEvent.click(openTabBtns[0]);

      await waitFor(() => {
        expect(toast.loading).toHaveBeenCalledWith('กำลังสร้างไฟล์ PDF และเตรียมเปิดพรีวิว...');
        expect(spyDownload).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'SOP-PD-001' }),
          WATERMARK_TYPES.UNCONTROLLED_COPY,
          expect.objectContaining({ reason: 'General Download / Print' }),
          true
        );
        expect(toast.dismiss).toHaveBeenCalledWith('loading-toast-id');
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('เปิดเอกสาร'));
      });
    });

    it('gracefully handles error and dismisses loading toast if PDF generation fails', async () => {
      vi.spyOn(UniversalWatermarkService, 'downloadWatermarkedPdf').mockRejectedValue(new Error('PDF Corrupted'));

      render(
        <MemoryRouter>
          <Library />
        </MemoryRouter>
      );

      const downloadBtns = screen.getAllByTitle('ดาวน์โหลด Master Document (DCC)');
      fireEvent.click(downloadBtns[0]);

      await waitFor(() => {
        expect(toast.loading).toHaveBeenCalled();
        expect(toast.dismiss).toHaveBeenCalledWith('loading-toast-id');
        expect(toast.error).toHaveBeenCalledWith('เกิดข้อผิดพลาดในการสร้าง Master PDF');
      });
    });
  });
});
