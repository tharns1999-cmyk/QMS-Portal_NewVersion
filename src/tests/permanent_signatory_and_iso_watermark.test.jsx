import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { 
  drawIsoDiagonalWatermark, 
  applyProgressiveSignatoryStamp,
  applyUncontrolledWatermarkToPdf 
} from '../utils/pdfStamper';
import { UniversalWatermarkService, WATERMARK_TYPES } from '../services/UniversalWatermarkService';
import useStore from '../store/useStore';

describe('Permanent Signatory Stamping & Responsive ISO Watermark Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Responsive ISO Watermark Engine (drawIsoDiagonalWatermark)', () => {
    it('should scale main font size to ~50pt and sub font to ~21pt on A4 with 45 degree rotation and Warning Red', async () => {
      const pdfDoc = await PDFDocument.create();
      // Standard A4 dimensions: 595.28 x 841.89
      const page = pdfDoc.addPage([595.28, 841.89]);
      
      const drawTextSpy = vi.spyOn(page, 'drawText');

      drawIsoDiagonalWatermark(page, 'UNCONTROLLED COPY', '(สำเนาไม่ควบคุม)');

      expect(drawTextSpy).toHaveBeenCalled();
      
      // Main text call (first call)
      const mainCallArgs = drawTextSpy.mock.calls[0];
      expect(mainCallArgs[0]).toBe('UNCONTROLLED COPY');
      const mainOptions = mainCallArgs[1];
      
      // Check font size ~50pt (min(w,h) * 0.085 = 595.28 * 0.085 ≈ 50.6)
      expect(mainOptions.size).toBeGreaterThanOrEqual(48);
      expect(mainOptions.size).toBeLessThanOrEqual(52);
      
      // Check rotation 45 degrees
      expect(mainOptions.rotate).toEqual({ type: 'degrees', angle: 45 });
      
      // Check opacity 0.22
      expect(mainOptions.opacity).toBeCloseTo(0.22, 2);
      
      // Check color Warning Red (red ~0.9, green ~0.25, blue ~0.25)
      expect(mainOptions.color.red).toBeCloseTo(0.9, 1);
      expect(mainOptions.color.green).toBeCloseTo(0.25, 1);
      expect(mainOptions.color.blue).toBeCloseTo(0.25, 1);
      
      // Check sub text call (second call)
      expect(drawTextSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      const subCallArgs = drawTextSpy.mock.calls[1];
      const subOptions = subCallArgs[1];
      
      // Check sub font size ~21pt (mainFontSize * 0.42 ≈ 21.25)
      expect(subOptions.size).toBeGreaterThanOrEqual(20);
      expect(subOptions.size).toBeLessThanOrEqual(22);
      expect(subOptions.rotate).toEqual({ type: 'degrees', angle: 45 });
    });

    it('should be exposed both as named export and static class method on UniversalWatermarkService', () => {
      expect(typeof drawIsoDiagonalWatermark).toBe('function');
      expect(typeof UniversalWatermarkService.drawIsoDiagonalWatermark).toBe('function');
      expect(typeof UniversalWatermarkService.applyProgressiveSignatoryStamp).toBe('function');
    });

    it('applyUncontrolledWatermarkToPdf should stamp all pages using drawIsoDiagonalWatermark', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([595.28, 841.89]);
      pdfDoc.addPage([595.28, 841.89]);
      const pdfBytes = await pdfDoc.save();

      const watermarkedBytes = await applyUncontrolledWatermarkToPdf(pdfBytes);
      expect(watermarkedBytes).toBeInstanceOf(Uint8Array);
      expect(watermarkedBytes.length).toBeGreaterThan(0);

      const loadedDoc = await PDFDocument.load(watermarkedBytes);
      expect(loadedDoc.getPageCount()).toBe(2);
    });
  });

  describe('2. Permanent Signatory Stamping (applyProgressiveSignatoryStamp)', () => {
    it('should draw a white background mask rectangle and stamp 3x3 table onto page 1', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 800]);
      const pdfBytes = await pdfDoc.save();

      const signatories = {
        requester: { name: 'นายจัดทำ เอกสาร', position: 'QA Officer', isCompleted: true },
        reviewer: { name: 'นางสาวทบทวน ตรวจสอบ', position: 'QA Manager', isCompleted: true },
        approver: { name: 'ดร.อนุมัติ สูงสุด', position: 'Managing Director', isCompleted: true }
      };

      const stampedBytes = await applyProgressiveSignatoryStamp(pdfBytes, signatories);
      expect(stampedBytes).toBeInstanceOf(Uint8Array);
      expect(stampedBytes.length).toBeGreaterThan(0);

      const reloadedDoc = await PDFDocument.load(stampedBytes);
      expect(reloadedDoc.getPageCount()).toBe(1);
    });
  });

  describe('3. Permanent Signatory Stamping on Final Approval (finalizeAndPublishMaster)', () => {
    it('should burn 3x3 signatory table and update masterDocument with fileData and isSignatoryStamped', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([600, 800]);
      const samplePdfBytes = await pdfDoc.save();
      const sampleBlob = new Blob([samplePdfBytes], { type: 'application/pdf' });

      const testDar = {
        id: 'DAR-TEST-001',
        darNumber: 'DAR-TEST-001',
        darNo: 'DAR-TEST-001',
        docNo: 'SOP-QC-999',
        document_code: 'SOP-QC-999',
        title: 'SOP การควบคุมเอกสารทดสอบ',
        status: 'COMPLETED',
        type: 'NEW',
        fileBlob: sampleBlob,
        attachedFile: { fileId: 'file-dar-001', name: 'sample.pdf' },
        requesterName: 'นายผู้จัดทำ',
        reviewerName: 'นายผู้ทบทวน',
        approverName: 'นายผู้อนุมัติ'
      };

      const testDoc = {
        id: 'doc-qc-999',
        code: 'SOP-QC-999',
        document_code: 'SOP-QC-999',
        title: 'SOP-QC-999',
        status: 'ACTIVE',
        darId: 'DAR-TEST-001'
      };

      useStore.setState({
        dars: [testDar],
        documents: [testDoc],
        masterDocuments: [testDoc]
      });

      await useStore.getState().finalizeAndPublishMaster('DAR-TEST-001');

      const state = useStore.getState();
      const updatedDoc = state.documents.find(d => d.id === 'doc-qc-999');
      const updatedMaster = state.masterDocuments.find(d => d.id === 'doc-qc-999');

      expect(updatedDoc).toBeDefined();
      expect(updatedDoc.isSignatoryStamped).toBe(true);
      expect(updatedDoc.fileData).toBeInstanceOf(Uint8Array);
      expect(updatedDoc.stampedAt).toBeDefined();

      expect(updatedMaster).toBeDefined();
      expect(updatedMaster.isSignatoryStamped).toBe(true);
    });
  });

  describe('4. Fallback Stamping on Download', () => {
    it('UniversalWatermarkService.downloadWatermarkedPdf should process active master doc and generate stamped URL', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([600, 800]);
      const samplePdfBytes = await pdfDoc.save();

      const testDoc = {
        id: 'doc-download-001',
        title: 'SOP-QA-001',
        document_code: 'SOP-QA-001',
        docCode: 'SOP-QA-001',
        status: 'ACTIVE',
        isSignatoryStamped: false,
        fileBlob: new Blob([samplePdfBytes], { type: 'application/pdf' })
      };

      const originalCreateObjectURL = global.URL.createObjectURL;
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-download-url');

      try {
        await UniversalWatermarkService.downloadWatermarkedPdf(
          testDoc,
          WATERMARK_TYPES.UNCONTROLLED_COPY,
          { userName: 'Test User', userDept: 'QC' },
          false
        );

        expect(global.URL.createObjectURL).toHaveBeenCalled();
      } finally {
        global.URL.createObjectURL = originalCreateObjectURL;
      }
    });
  });
});

