import React from 'react';
import useStore from '../../store/useStore';
import { X, ShieldAlert, FileText, Download, Building2, Calendar, Globe, Tag, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UniversalWatermarkService, { WATERMARK_TYPES } from '../../services/UniversalWatermarkService';
import toast from 'react-hot-toast';

const ExternalDocPreviewModal = ({ isOpen, onClose, document: doc }) => {
  const { currentUser, logExternalDownload } = useStore();

  if (!isOpen || !doc) return null;

  const docCode = doc.edCode || doc.doc_code || doc.docNo || doc.id || 'ED-DOC-001';
  const uDept = currentUser?.department || 'QA';

  const handleDownload = async () => {
    const isObsolete = doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED';
    let watermarkPreset = WATERMARK_TYPES.UNCONTROLLED_COPY;

    if (isObsolete) {
      watermarkPreset = WATERMARK_TYPES.OBSOLETE;
    } else if (doc.accessScope === 'Restricted') {
      watermarkPreset = WATERMARK_TYPES.STRICTLY_CONFIDENTIAL;
    }

    const toastId = toast.loading(`กำลังประทับลายน้ำเอกสาร ${docCode}...`);

    try {
      await UniversalWatermarkService.downloadWatermarkedPdf(
        {
          id: doc.id,
          title: docCode,
          name: doc.title,
          docTitle: doc.title,
          rev: doc.rev || doc.sourceVersion || '01',
          department: doc.department || uDept,
          effectiveDate: doc.effectiveDate,
          status: doc.status || 'ACTIVE',
          sourceVersion: doc.sourceVersion || doc.edition,
          source: doc.source,
          isExternal: true,
          is_external: true,
          doc_type: 'ED',
          docType: 'ED'
        },
        watermarkPreset,
        {
          docCode,
          docTitle: doc.title,
          title: doc.title,
          docVersion: doc.rev || '01',
          sourceVersion: doc.sourceVersion || doc.edition,
          source: doc.source,
          userName: currentUser?.name || 'Authorized User',
          userDept: currentUser?.department || uDept,
          authorizedScope: doc.accessScope === 'Restricted' ? 'Restricted External Release' : 'Standard External Reference',
          dccName: currentUser?.name || 'DCC Admin',
          isExternal: true,
          is_external: true,
          doc_type: 'ED',
          docType: 'ED'
        }
      );

      if (logExternalDownload) {
        logExternalDownload(doc.id);
      }
      toast.success(`ดาวน์โหลดเอกสาร ${docCode} สำเร็จ`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการสร้างเอกสาร PDF', { id: toastId });
    }
  };

  const timestamp = UniversalWatermarkService.getBangkokTimestamp ? UniversalWatermarkService.getBangkokTimestamp() : new Date().toLocaleString('th-TH');
  const watermarkText = `UNCONTROLLED COPY (EXTERNAL REF) • ${currentUser?.name || 'User'} • ${timestamp}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="relative bg-white border border-stone-200/50 w-full max-w-4xl overflow-hidden flex flex-col h-[88vh] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] z-10 my-auto"
        >
          {/* Header: Claude Aesthetic (White/Flat) */}
          <div className="bg-white px-8 pt-8 pb-4 flex justify-between items-center shrink-0 border-b border-stone-100">
            <div className="flex items-center gap-4 min-w-0 pr-2">
              <div className="w-12 h-12 rounded-xl bg-[#f9f8f6] text-[#da7756] border border-stone-200 flex items-center justify-center shrink-0">
                <FileText size={24} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[#2d2d2d] text-xl sm:text-2xl font-bold tracking-tight">{docCode}</h2>
                  <span className="bg-[#f9f8f6] text-[#da7756] border border-stone-200 px-2 py-0.5 rounded-md text-xs font-mono font-bold">
                    Rev.{doc.rev || '01'}
                  </span>
                  {doc.accessScope === 'Restricted' && (
                    <span className="bg-[#f5e6e6] text-[#a94442] border border-[#e5cdcd] px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">
                      <ShieldAlert size={12} /> RESTRICTED
                    </span>
                  )}
                </div>
                <p className="text-stone-500 text-sm sm:text-base font-medium truncate max-w-md mt-1">
                  {doc.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleDownload}
                className="px-5 py-2.5 rounded-xl bg-[#da7756] hover:bg-[#c96646] active:scale-[0.99] text-white font-bold text-sm transition-all flex items-center gap-2 focus:ring-4 focus:ring-[#da7756]/20 outline-none shadow-none"
              >
                <Download size={16} />
                <span>ดาวน์โหลด PDF</span>
              </button>
              <button 
                type="button"
                onClick={onClose}
                className="text-stone-400 hover:text-[#2d2d2d] hover:bg-stone-50 p-2 rounded-xl transition-colors focus:ring-2 focus:ring-[#da7756]/20 outline-none"
                title="ปิดหน้าต่าง"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Metadata Quick Ribbon */}
          <div className="px-8 py-4 bg-[#f9f8f6] border-b border-stone-100 flex flex-wrap items-center justify-between gap-4 text-sm text-stone-500 shrink-0">
            <div className="flex flex-wrap items-center gap-5">
              <span>ผู้ออก: <strong className="text-[#2d2d2d]">{doc.source || '-'}</strong></span>
              {doc.sourceVersion && <span>รุ่น/Edition: <strong className="text-[#2d2d2d] font-mono">{doc.sourceVersion}</strong></span>}
              <span>แผนก: <strong className="text-[#2d2d2d] font-mono">{doc.department || doc.dept || 'QA'}</strong></span>
              <span>วันบังคับใช้: <strong className="text-[#2d2d2d] font-mono">{doc.effectiveDate}</strong></span>
            </div>
            <div>
              สิทธิ์การเข้าถึง: <span className="font-bold text-[#b87c33] bg-[#f9f1e6] border border-[#e8d6c1] px-2.5 py-1 rounded-md text-xs">{doc.accessScope || 'General'}</span>
            </div>
          </div>

          {/* PDF Mock Viewer with Watermark Overlay */}
          <div className="flex-1 bg-stone-100/80 relative overflow-hidden flex justify-center items-center p-4 sm:p-8">
            {/* Watermark Overlay (Repeated 45 degrees) */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center overflow-hidden opacity-10 select-none z-10">
              {Array.from({ length: 10 }).map((_, i) => (
                <div 
                  key={i} 
                  className="whitespace-nowrap font-bold text-stone-800 transform -rotate-45 my-10 text-xl tracking-widest font-mono"
                >
                  {watermarkText}
                </div>
              ))}
            </div>

            {/* Mock PDF Document Page */}
            <div className="bg-white w-full max-w-2xl h-full shadow-sm rounded-xl p-8 sm:p-10 overflow-y-auto relative z-0 border border-stone-200 flex flex-col justify-between">
              <div>
                {/* PDF Header Section */}
                <div className="border-b-2 border-[#2d2d2d] pb-4 mb-6 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400 block font-bold">External Controlled Document</span>
                    <h3 className="text-xl font-bold text-[#2d2d2d] mt-1">{docCode}</h3>
                    <p className="text-xs text-stone-500 font-medium">{doc.title}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold bg-[#f9f8f6] border border-stone-200 text-stone-600 px-2 py-0.5 rounded">
                      Rev.{doc.rev || '01'}
                    </span>
                    <p className="text-[11px] text-stone-400 mt-1 font-mono">{doc.effectiveDate}</p>
                  </div>
                </div>

                {/* PDF Content Placeholder */}
                <div className="space-y-5 text-xs text-stone-600 leading-relaxed">
                  <div className="bg-[#f9f8f6] p-5 rounded-xl border border-stone-200">
                    <h4 className="font-bold text-[#2d2d2d] mb-3 text-sm">ข้อมูลรายละเอียดเอกสารภายนอก (Document Specification)</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-stone-400">หน่วยงานผู้ออก:</span> <strong className="text-[#2d2d2d]">{doc.source || '-'}</strong></div>
                      <div><span className="text-stone-400">เวอร์ชันต้นฉบับ:</span> <strong className="text-[#2d2d2d] font-mono">{doc.sourceVersion || '-'}</strong></div>
                      <div><span className="text-stone-400">รอบการทบทวน:</span> <strong className="text-[#2d2d2d]">{doc.reviewCycleMonths || 12} เดือน</strong></div>
                      <div><span className="text-stone-400">กำหนดทบทวนถัดไป:</span> <strong className="text-[#2d2d2d] font-mono">{doc.nextReviewDate || '-'}</strong></div>
                    </div>
                  </div>

                  <p className="text-stone-500 text-sm">
                    เอกสารฉบับนี้เป็นเอกสารภายนอกที่ได้รับการขึ้นทะเบียนและควบคุมตามมาตรฐานระบบบริหารคุณภาพ ISO 9001 / FSSC 22000 ห้ามทำซ้ำ ดัดแปลง หรือแจกจ่ายโดยไม่ได้รับอนุญาต
                  </p>

                  <div className="space-y-3 pt-4">
                    <div className="h-3 bg-stone-100 rounded w-full"></div>
                    <div className="h-3 bg-stone-100 rounded w-5/6"></div>
                    <div className="h-3 bg-stone-100 rounded w-4/6"></div>
                    <div className="h-3 bg-stone-100 rounded w-full"></div>
                    <div className="h-3 bg-stone-100 rounded w-3/4"></div>
                  </div>
                </div>
              </div>

              {/* PDF Footer Security Notice */}
              <div className="border-t border-stone-200 pt-3 text-center text-[10px] text-stone-400 font-medium">
                Official External Document Record • QMS Quality Portal • Confidential & Controlled
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ExternalDocPreviewModal;
