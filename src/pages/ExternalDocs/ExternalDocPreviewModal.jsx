import React, { useState, useEffect, useRef } from 'react';
import useStore from '../../store/useStore';
import { X, ShieldAlert, FileText, Download, Building2, Calendar, Globe, Tag, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UniversalWatermarkService, { WATERMARK_TYPES } from '../../services/UniversalWatermarkService';
import toast from 'react-hot-toast';
import { getFile, resolveFileBlob } from '../../utils/fileStorage';

const ExternalDocPreviewModal = ({ isOpen, onClose, document: doc }) => {
  const { currentUser, logExternalDownload } = useStore();

  const docCode = doc?.edCode || doc?.doc_code || doc?.docNo || doc?.id || 'ED-DOC-001';
  const uDept = currentUser?.department || 'QA';

  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    if (isOpen && doc) {
      setLoadingPdf(true);
      const fallbackKey = doc.edCode || doc.doc_code || doc.docNo || doc.id;
      resolveFileBlob(doc, fallbackKey).then((fileBlob) => {
        if (isCancelled) return;
        if (fileBlob) {
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          const url = URL.createObjectURL(fileBlob);
          blobUrlRef.current = url;
          setPdfBlobUrl(url);
        } else {
          setPdfBlobUrl(null);
        }
        setLoadingPdf(false);
      }).catch(err => {
        console.error('Error loading PDF blob:', err);
        if (!isCancelled) {
          setPdfBlobUrl(null);
          setLoadingPdf(false);
        }
      });
    } else {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setPdfBlobUrl(null);
      setLoadingPdf(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [isOpen, doc]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  if (!isOpen || !doc) return null;

  const isObsolete = Boolean(
    doc.status === 'OBSOLETE' || 
    doc.status === 'OBSOLETE_ARCHIVED' || 
    doc.is_obsolete
  );
  const isSuperseded = Boolean(
    !isObsolete && (
      doc.status === 'SUPERSEDED' || 
      doc.status === 'SUPERSEDED_ARCHIVED' || 
      doc.is_superseded
    )
  );

  const watermarkPreset = isObsolete 
    ? WATERMARK_TYPES.OBSOLETE 
    : isSuperseded 
      ? WATERMARK_TYPES.SUPERSEDED 
      : WATERMARK_TYPES.UNCONTROLLED_COPY;

  const handleDownload = async () => {
    const toastId = toast.loading(`กำลังประทับลายน้ำเอกสาร ${docCode}...`);

    try {
      await UniversalWatermarkService.downloadWatermarkedPdf(
        {
          ...doc,
          id: doc.id,
          title: docCode,
          name: doc.title,
          docTitle: doc.title,
          rev: doc.rev || doc.sourceVersion || '01',
          department: doc.department || uDept,
          effectiveDate: doc.effectiveDate,
          status: isObsolete ? 'OBSOLETE' : (isSuperseded ? 'SUPERSEDED' : (doc.status || 'ACTIVE')),
          sourceVersion: doc.sourceVersion || doc.edition,
          source: doc.source,
          isExternal: true,
          is_external: true,
          doc_type: 'ED',
          docType: 'ED',
          attachedFile: doc.attachedFile,
          fileId: doc.fileId || doc.attachedFile?.fileId
        },
        watermarkPreset,
        {
          ...doc,
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
          docType: 'ED',
          isRestricted: doc.accessScope === 'Restricted' || doc.accessScope === 'RESTRICTED',
          accessScope: doc.accessScope,
          watermarkType: watermarkPreset,
          reason: isObsolete ? 'Historical Download (OBSOLETE)' : (isSuperseded ? 'Historical Download (SUPERSEDED)' : 'External Document Download / Print'),
          attachedFile: doc.attachedFile,
          fileId: doc.fileId || doc.attachedFile?.fileId
        }
      );

      if (logExternalDownload) {
        logExternalDownload(doc.id);
      }
      toast.success(`ดาวน์โหลดเอกสาร ${docCode} สำเร็จ`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'เกิดข้อผิดพลาดในการสร้างเอกสาร PDF', { id: toastId });
    }
  };

  const timestamp = UniversalWatermarkService.getBangkokTimestamp ? UniversalWatermarkService.getBangkokTimestamp() : new Date().toLocaleString('th-TH');
  const watermarkText = isObsolete
    ? `OBSOLETE / ยกเลิกการใช้งานแล้ว • ${currentUser?.name || 'User'} • ${timestamp}`
    : isSuperseded
      ? `SUPERSEDED / ตกรุ่น ห้ามใช้อ้างอิง • ${currentUser?.name || 'User'} • ${timestamp}`
      : `UNCONTROLLED COPY (EXTERNAL REF) • ${currentUser?.name || 'User'} • ${timestamp}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0"
        />
        
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-10 my-auto"
        >
          {/* Header */}
          <div className="bg-white px-6 py-4 flex justify-between items-center shrink-0 border-b border-slate-200">
            <div className="flex items-center gap-3.5 min-w-0 pr-2">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                <FileText size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-slate-900 text-lg sm:text-xl font-bold tracking-tight">{docCode}</h2>
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-md text-xs font-mono font-bold">
                    {doc.sourceVersion ? `Ver/Ed: ${doc.sourceVersion}` : 'EXTERNAL DOC'}
                  </span>
                  {isObsolete ? (
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-md text-xs font-bold">
                      OBSOLETE (ยกเลิกแล้ว)
                    </span>
                  ) : isSuperseded ? (
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-md text-xs font-bold">
                      SUPERSEDED (ตกรุ่น)
                    </span>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-md text-xs font-bold">
                      ACTIVE (มีผลบังคับใช้)
                    </span>
                  )}
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
                className="px-5 py-2.5 rounded-xl bg-[#da7756] hover:bg-[#c96646] active:scale-[0.99] text-white font-bold text-sm transition-all flex items-center gap-2 focus:ring-4 focus:ring-[#da7756]/20 outline-none shadow-none cursor-pointer"
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

          {/* PDF Native Viewer */}
          <div className="flex-1 bg-stone-100/80 relative overflow-hidden flex justify-center items-center min-h-[500px]">
            {loadingPdf ? (
              <div className="text-stone-500 font-medium animate-pulse flex flex-col items-center gap-3">
                <FileText size={32} className="text-stone-400" />
                <span>กำลังโหลดไฟล์ PDF...</span>
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="w-full h-full border-0 absolute inset-0"
                title="PDF Preview"
              />
            ) : (
              <div className="text-stone-500 font-medium flex flex-col items-center gap-3">
                <ShieldAlert size={40} className="text-stone-300" />
                <span>ไม่พบไฟล์ต้นฉบับจริง (No original file attached)</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ExternalDocPreviewModal;
