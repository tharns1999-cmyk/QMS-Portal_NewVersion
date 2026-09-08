import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  FileText, 
  Download, 
  Building2, 
  Globe, 
  Lock, 
  ShieldAlert, 
  Layers, 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  RotateCw, 
  Archive, 
  PlusCircle, 
  ArrowRight,
  MapPin,
  Flame
} from 'lucide-react';
import useStore from '../../store/useStore';
import StatusBadge from '../../components/ui/StatusBadge';
import RequestAdditionalCopiesModal from '../../components/workflow/RequestAdditionalCopiesModal';
import ExternalCopyDispositionModal from './ExternalCopyDispositionModal';
import UniversalWatermarkService, { WATERMARK_TYPES } from '../../services/UniversalWatermarkService';
import toast from 'react-hot-toast';

const ExternalDocDetailModal = ({ 
  isOpen, 
  onClose, 
  document: initialDoc, 
  onOpenViewer: _onOpenViewer,
  onOpenRevise,
  onOpenObsolete
}) => {
  const { 
    externalDocuments, 
    currentUser, 
    controlledCopyInstances, 
    documentControlledCopies,
    externalAuditTrail,
    logExternalDownload
  } = useStore();

  const [currentDoc, setCurrentDoc] = useState(initialDoc);
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'history'
  const [isRequestCopiesOpen, setIsRequestCopiesOpen] = useState(false);
  const [isDispositionModalOpen, setIsDispositionModalOpen] = useState(false);
  const [selectedCopiesForDisposition, setSelectedCopiesForDisposition] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);

  // Sync internal document state when initialDoc changes
  useEffect(() => {
    if (initialDoc) {
      // Look up freshest record from store if possible
      const freshDoc = (externalDocuments || []).find(d => d.id === initialDoc.id) || initialDoc;
      setCurrentDoc(freshDoc);
    }
  }, [initialDoc, externalDocuments]);

  // Reset tab to general on new open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('general');
    }
  }, [isOpen, initialDoc?.id]);

  // Synchronized controlled copies list
  const allCopies = useMemo(() => {
    return (controlledCopyInstances && controlledCopyInstances.length > 0)
      ? controlledCopyInstances
      : (documentControlledCopies || []);
  }, [controlledCopyInstances, documentControlledCopies]);

  const edCode = currentDoc?.edCode || currentDoc?.doc_code || currentDoc?.docNo || currentDoc?.id || 'ED-DOC-001';
  const sourceEdition = currentDoc?.sourceVersion || currentDoc?.edition || '-';
  const docTitle = currentDoc?.title || currentDoc?.name || 'เอกสารภายนอก';
  const getUserDepartments = (user) => {
    if (!user) return [];
    const depts = [];
    if (user.department) depts.push(user.department);
    if (user.primary_department) depts.push(user.primary_department);
    if (user.dept) depts.push(user.dept);
    if (user.dept_code) depts.push(user.dept_code);
    if (Array.isArray(user.departments)) depts.push(...user.departments);
    if (Array.isArray(user.secondaryDepartments)) depts.push(...user.secondaryDepartments);
    if (Array.isArray(user.depts)) depts.push(...user.depts);
    if (Array.isArray(user.affiliated_departments)) depts.push(...user.affiliated_departments);
    return [...new Set(depts.filter(Boolean))];
  };

  const userDepts = getUserDepartments(currentUser);
  const uDept = userDepts[0] || currentUser?.department || 'QA';

  const deptMatches = (d1, d2) => {
    if (!d1 || !d2) return false;
    const s1 = String(typeof d1 === 'object' ? (d1.id || d1.code || d1.dept || d1.department || '') : d1).trim().toUpperCase();
    const s2 = String(typeof d2 === 'object' ? (d2.id || d2.code || d2.dept || d2.department || '') : d2).trim().toUpperCase();
    if (!s1 || !s2) return false;
    if (s1 === s2) return true;
    if ((s1 === 'QA' || s1 === 'QA/QC' || s1 === 'QAQC') && (s2 === 'QA' || s2 === 'QA/QC' || s2 === 'QAQC')) return true;
    return false;
  };

  const isOwnerDept = userDepts.includes(currentDoc?.department) || userDepts.some(ud => deptMatches(ud, currentDoc?.department || currentDoc?.dept));
  const isDccAdmin = Boolean(
    currentUser?.role === 'DCC' || 
    currentUser?.role === 'DCC_ADMIN' || 
    currentUser?.isDccAdmin || 
    currentUser?.isDcc || 
    currentUser?.role === 'ADMIN' ||
    currentUser?.id === 'U001'
  );

  // Status flags
  const isObsolete = Boolean(
    currentDoc?.status === 'OBSOLETE' || 
    currentDoc?.status === 'OBSOLETE_ARCHIVED' || 
    currentDoc?.is_obsolete
  );

  const isSuperseded = Boolean(
    !isObsolete && (
      currentDoc?.status === 'SUPERSEDED' || 
      currentDoc?.status === 'SUPERSEDED_ARCHIVED' || 
      currentDoc?.is_superseded
    )
  );

  const isActive = Boolean(
    !isObsolete && !isSuperseded && (
      currentDoc?.status === 'ACTIVE' || 
      currentDoc?.status === 'EFFECTIVE'
    )
  );

  const canManageDoc = (isOwnerDept || isDccAdmin) && isActive;
  const canRequestCopy = (isOwnerDept || isDccAdmin) && (currentDoc?.status === 'ACTIVE' || currentDoc?.status === 'EFFECTIVE');

  // Find all related editions in external documents lineage
  const allEditions = useMemo(() => {
    if (!currentDoc) return [];
    const targetCode = String(edCode).trim().toUpperCase();
    const targetTitle = String(docTitle).trim().toLowerCase();
    const targetId = String(currentDoc.id);

    const matched = (externalDocuments || []).filter(d => {
      const dCode = String(d.edCode || d.doc_code || d.docNo || '').trim().toUpperCase();
      if (targetCode && dCode === targetCode) return true;
      if (d.previousDocId && (String(d.previousDocId) === targetId || String(currentDoc.previousDocId) === String(d.id))) return true;
      if (d.title && targetTitle && String(d.title).trim().toLowerCase() === targetTitle) return true;
      return false;
    });

    const uniqueMap = new Map();
    matched.forEach(d => uniqueMap.set(d.id, d));
    // Always include current doc
    uniqueMap.set(currentDoc.id, currentDoc);

    const list = Array.from(uniqueMap.values());

    return list.sort((a, b) => {
      const revA = parseInt(String(a.rev || '0').replace(/\D/g, ''), 10) || 0;
      const revB = parseInt(String(b.rev || '0').replace(/\D/g, ''), 10) || 0;
      if (revB !== revA) return revB - revA;
      return new Date(b.effectiveDate || 0) - new Date(a.effectiveDate || 0);
    });
  }, [edCode, docTitle, currentDoc, externalDocuments]);

  // Find latest active/effective edition if current document is superseded
  const latestActiveEdition = useMemo(() => {
    if (!currentDoc) return null;
    return allEditions.find(d => d.status === 'ACTIVE' || d.status === 'EFFECTIVE') || allEditions[0];
  }, [allEditions, currentDoc]);

  // Physical controlled copies matched to this external document
  const ccInstances = useMemo(() => {
    if (!currentDoc) return [];
    const targetId = String(currentDoc.id);
    const targetCode = String(edCode).trim().toUpperCase();

    return allCopies.filter(c => {
      const matchId = String(c.externalDocId || c.external_doc_id || c.docId || c.doc_id) === targetId;
      const copyDocCode = String(c.doc_code || c.docCode || c.docTitle || '').trim().toUpperCase();
      const matchCode = Boolean(targetCode && copyDocCode === targetCode);
      return matchId || matchCode;
    });
  }, [currentDoc, edCode, allCopies]);

  // Copies requiring recall / disposition
  const pendingRecallCopies = useMemo(() => {
    return ccInstances.filter(c => 
      c.status === 'PENDING_RECALL' || 
      c.status === 'SUPERSEDED_PENDING_RECALL' || 
      c.status === 'OBSOLETE_PENDING_RECALL'
    );
  }, [ccInstances]);

  // Audit trail logs for this external document
  const auditLogs = useMemo(() => {
    if (!currentDoc) return [];
    const targetId = String(currentDoc.id);
    const targetCode = String(edCode).trim().toUpperCase();

    return (externalAuditTrail || []).filter(log => {
      const logId = String(log.docId || log.documentId || '');
      const logCode = String(log.docCode || log.document_code || '').trim().toUpperCase();
      return logId === targetId || (targetCode && logCode === targetCode);
    }).sort((a, b) => new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp));
  }, [currentDoc, edCode, externalAuditTrail]);

  // Watermarked PDF Download Action
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    const watermarkPreset = isObsolete ? WATERMARK_TYPES.OBSOLETE : WATERMARK_TYPES.UNCONTROLLED_COPY;

    const toastId = toast.loading(`กำลังประทับลายน้ำเอกสาร ${edCode}...`);
    try {
      await UniversalWatermarkService.downloadWatermarkedPdf(
        {
          id: currentDoc.id,
          title: edCode,
          name: currentDoc.title,
          docTitle: currentDoc.title,
          rev: currentDoc.rev || currentDoc.sourceVersion || '01',
          department: currentDoc.department || uDept,
          effectiveDate: currentDoc.effectiveDate,
          status: currentDoc.status || 'ACTIVE',
          sourceVersion: currentDoc.sourceVersion || currentDoc.edition,
          source: currentDoc.source,
          isExternal: true,
          is_external: true,
          doc_type: 'ED',
          docType: 'ED'
        },
        watermarkPreset,
        {
          docCode: edCode,
          docTitle: currentDoc.title,
          title: currentDoc.title,
          docVersion: currentDoc.rev || '01',
          sourceVersion: currentDoc.sourceVersion || currentDoc.edition,
          source: currentDoc.source,
          userName: currentUser?.name || 'Authorized User',
          userDept: currentUser?.department || uDept,
          authorizedScope: currentDoc.accessScope === 'Restricted' ? 'Restricted External Release' : 'Standard External Reference',
          dccName: currentUser?.name || 'DCC Admin',
          isExternal: true,
          is_external: true,
          doc_type: 'ED',
          docType: 'ED',
          isRestricted: currentDoc.accessScope === 'Restricted' || currentDoc.accessScope === 'RESTRICTED',
          accessScope: currentDoc.accessScope
        }
      );

      if (logExternalDownload) {
        logExternalDownload(currentDoc.id);
      }
      toast.success(`ดาวน์โหลดเอกสาร ${edCode} สำเร็จ`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการสร้างเอกสาร PDF', { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen || !currentDoc) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0"
        />

        {/* Modal Container */}
        <motion.div 
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden z-10 my-auto animate-in fade-in zoom-in-95 duration-150"
        >
          {/* 1. Modal Header */}
          <div className="px-6 py-4.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3.5 min-w-0 pr-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shrink-0 shadow-xs">
                <FileText size={22} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {/* System ED Code Badge */}
                  <span className="px-2.5 py-0.5 rounded-md bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] text-xs font-bold font-mono tracking-wide shadow-2xs">
                    {edCode}
                  </span>

                  {/* Source Edition Badge */}
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold font-mono">
                    {sourceEdition !== '-' ? `Source: ${sourceEdition}` : `Rev.${currentDoc.rev || '01'}`}
                  </span>

                  {/* Status Badge */}
                  <StatusBadge status={currentDoc.status} />
                </div>

                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight break-words line-clamp-1 leading-snug">
                  {docTitle}
                </h2>
              </div>
            </div>

            <button 
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0 ml-2 outline-none cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X size={20} />
            </button>
          </div>

          {/* 4. ISO Lifecycle Alert Banners (Superseded / Obsolete) */}
          {isSuperseded && (
            <div className="px-6 py-3 bg-amber-50/90 border-b border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-start sm:items-center gap-2.5 text-xs">
                <div className="p-1 rounded-md bg-amber-200/60 text-amber-800 shrink-0 mt-0.5 sm:mt-0">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <span className="font-bold text-amber-800 uppercase tracking-wide">
                    เอกสารตกรุ่น (SUPERSEDED):
                  </span>{' '}
                  <span className="text-amber-700">
                    เอกสารฉบับนี้ถูกแทนที่แล้ว ห้ามนำไปใช้อ้างอิงการปฏิบัติงานหน้างาน
                  </span>
                </div>
              </div>

              {latestActiveEdition && latestActiveEdition.id !== currentDoc.id && (
                <button
                  type="button"
                  onClick={() => setCurrentDoc(latestActiveEdition)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  <span>ดูฉบับล่าสุด ({latestActiveEdition.sourceVersion || `Rev.${latestActiveEdition.rev}`})</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          )}

          {isObsolete && (
            <div className="px-6 py-3 bg-rose-50/90 border-b border-rose-200 text-rose-900 flex items-start gap-3 shrink-0">
              <div className="p-1 rounded-md bg-rose-200/60 text-rose-700 shrink-0 mt-0.5">
                <AlertCircle size={16} />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-rose-800 uppercase tracking-wide flex items-center gap-2">
                  <span>เอกสารยกเลิกการใช้งานแล้ว (OBSOLETE)</span>
                  {currentDoc.obsoleteDate && (
                    <span className="font-mono text-[11px] font-medium text-rose-600">
                      • มีผลวันที่ {currentDoc.obsoleteDate}
                    </span>
                  )}
                </div>
                <p className="text-rose-700">
                  {currentDoc.reason || currentDoc.obsoleteReason || 'เอกสารฉบับนี้ถูกยกเลิกถาวรและปลดออกจากการใช้งานตามระบบบริหารคุณภาพ'}
                </p>
              </div>
            </div>
          )}

          {/* 2. Navigation Tabs */}
          <div className="px-6 bg-slate-50/80 border-b border-slate-200 flex gap-6 shrink-0 text-xs sm:text-sm font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 py-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'text-[#0D99FF] border-[#0D99FF]'
                  : 'text-slate-500 hover:text-slate-800 border-transparent'
              }`}
            >
              <Layers size={16} />
              <span>ข้อมูลทั่วไปและการแจกจ่าย (General Info & Controlled Copies)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 py-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'text-[#0D99FF] border-[#0D99FF]'
                  : 'text-slate-500 hover:text-slate-800 border-transparent'
              }`}
            >
              <Clock size={16} />
              <span>บันทึกประวัติการดำเนินการ (Audit Trail Log)</span>
            </button>
          </div>

          {/* Modal Body Container */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#FAFAFA] custom-scrollbar">
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* 3. Bento Grid Layout 2 Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left Card: Master Data (7 cols) */}
                  <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText size={15} className="text-[#0D99FF]" /> ข้อมูลแม่บทเอกสารภายนอก (Master Info)
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          ID: {currentDoc.id}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px] mb-0.5">รหัสเอกสารภายนอก (ED Code)</span>
                          <span className="font-mono font-bold text-[#0D99FF] text-sm">{edCode}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px] mb-0.5">ฉบับที่ (Rev. / Edition)</span>
                          <span className="font-mono font-bold text-slate-800">
                            Rev.{currentDoc.rev || '01'} {sourceEdition !== '-' && `(${sourceEdition})`}
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-400 block text-[11px] mb-0.5">ชื่อเอกสารทางการ (Title)</span>
                          <span className="font-semibold text-slate-800 text-sm leading-snug">{docTitle}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px] mb-0.5">แผนกผู้รับผิดชอบ (Responsible Dept)</span>
                          <span className="font-bold text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block">
                            {currentDoc.department || 'QA'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px] mb-0.5">หน่วยงานผู้ออกเอกสาร (Issuing Org)</span>
                          <span className="font-bold text-slate-800">{currentDoc.source || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px] mb-0.5">วันที่มีผลบังคับใช้ (Effective Date)</span>
                          <span className="font-mono text-slate-800 font-semibold">{currentDoc.effectiveDate || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px] mb-0.5">รอบกำหนดทบทวนความทันสมัย</span>
                          <span className="text-slate-800 font-semibold">
                            {currentDoc.reviewCycleMonths || 12} เดือน {currentDoc.nextReviewDate && `(กำหนด: ${currentDoc.nextReviewDate})`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Card: Access Scope (5 cols) */}
                  <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Lock size={15} className="text-amber-600" /> ขอบเขตสิทธิ์การเข้าถึง (Access Control)
                        </span>
                      </div>

                      <div className="space-y-4 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px] mb-1.5">ประเภทสิทธิ์การเข้าถึง</span>
                          {currentDoc.accessScope === 'Restricted' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                              <ShieldAlert size={14} /> ลับเฉพาะ (Restricted Access)
                            </span>
                          ) : currentDoc.accessScope === 'Department' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                              <Building2 size={14} /> เฉพาะแผนก (Department Access)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                              <Globe size={14} /> สิทธิ์ทั่วไป (General Access)
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[11px] mb-1.5">ขอบเขตผู้ได้รับสิทธิ์เข้าถึง</span>
                          {currentDoc.accessScope === 'Restricted' ? (
                            <div className="space-y-2">
                              <p className="text-slate-600 text-[11px] leading-relaxed">
                                จำกัดสิทธิ์เฉพาะผู้ได้รับมอบหมายเป็นลายลักษณ์อักษร หรือระดับสิทธิ์ที่ระบุ:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {(currentDoc.accessUsers && currentDoc.accessUsers.length > 0) ? (
                                  currentDoc.accessUsers.map((u, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px]">
                                      {u}
                                    </span>
                                  ))
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px]">
                                    Lv.4+ Supervisor & DCC Admin
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : currentDoc.accessScope === 'Department' ? (
                            <div className="space-y-2">
                              <p className="text-slate-600 text-[11px]">
                                สิทธิ์การเข้าถึงสำหรับแผนกที่กำหนด:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {((currentDoc.accessDepartments && currentDoc.accessDepartments.length > 0) ? currentDoc.accessDepartments : [currentDoc.department || 'QA']).map((dept, i) => (
                                  <span key={i} className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold font-mono text-xs">
                                    {dept}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/70 text-emerald-800 text-[11px] leading-relaxed">
                              เปิดให้ทุกแผนกและพนักงานทุกคนในระบบสามารถเปิดอ่านและอ้างอิงเอกสารนี้ได้ตามข้อกำหนด ISO 9001
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Bar (ปุ่มแถบการทำงาน) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      การดำเนินการ:
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Request Additional Copies (if permitted for owner department/DCC and active) */}
                    {canRequestCopy && (
                      <button
                        type="button"
                        onClick={() => setIsRequestCopiesOpen(true)}
                        className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 active:scale-[0.98] text-xs font-bold transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
                      >
                        <PlusCircle size={15} />
                        <span>ขอสำเนาควบคุมเพิ่มเติม</span>
                      </button>
                    )}

                    {/* Update Revision Button (Authorized Owner Dept or DCC Only) */}
                    {onOpenRevise && canManageDoc && (
                      <button
                        type="button"
                        onClick={() => onOpenRevise(currentDoc)}
                        className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 active:scale-[0.98] text-xs font-bold transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
                        title="อัปเดตฉบับใหม่"
                      >
                        <RotateCw size={15} />
                        <span>อัปเดตฉบับใหม่</span>
                      </button>
                    )}

                    {/* Request Obsolete Button (Authorized Owner Dept or DCC Only) */}
                    {isActive && onOpenObsolete && canManageDoc && (
                      <button
                        type="button"
                        onClick={() => onOpenObsolete(currentDoc)}
                        className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 active:scale-[0.98] text-xs font-bold transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
                        title="ยื่นขอยกเลิกใช้งาน"
                      >
                        <Archive size={15} />
                        <span>ขอยกเลิกใช้งาน</span>
                      </button>
                    )}

                    {/* Download Watermarked PDF */}
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={handleDownloadPdf}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      <Download size={15} />
                      <span>ดาวน์โหลด PDF (มีลายน้ำ)</span>
                    </button>
                  </div>
                </div>

                {/* Controlled Copies Circulation Table */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Layers size={16} className="text-indigo-600" />
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        สำเนาควบคุมที่แจกจ่ายประจำจุดใช้งาน (Controlled Copies in Circulation)
                      </h3>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono text-slate-500 font-semibold">
                        ทั้งหมด {ccInstances.length} เล่ม
                      </span>
                      {isDccAdmin && pendingRecallCopies.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCopiesForDisposition(pendingRecallCopies);
                            setIsDispositionModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                          title="เปิดหน้าต่างบันทึกการเรียกคืน/ทำลายสำเนาควบคุม"
                        >
                          <Flame size={13} />
                          <span>บันทึกการเรียกคืน/ทำลายสำเนา ({pendingRecallCopies.length})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-28">หมายเลขสำเนา (Copy No.)</th>
                          <th className="py-2.5 px-3 w-32">แผนกผู้รับ</th>
                          <th className="py-2.5 px-3">จุดติดตั้ง / จุดใช้งาน</th>
                          <th className="py-2.5 px-3 text-center w-36">สถานะเล่ม (Status)</th>
                          <th className="py-2.5 px-3 text-center w-48">วันที่และผู้ดำเนินการ</th>
                          {isDccAdmin && <th className="py-2.5 px-3 text-center w-20">จัดการ</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ccInstances.length > 0 ? (
                          ccInstances.map((inst, index) => {
                            const copyNoStr = inst.copy_no || inst.ccNumber || `Copy ${String(index + 1).padStart(2, '0')}`;
                            const deptName = inst.department || inst.target_department || inst.holder_dept || '-';
                            const locationName = inst.location || inst.locationName || inst.station_name || 'จุดใช้งานหลัก';
                            const receiptDate = inst.receipt_confirmed_at || inst.received_at || inst.dateIssued || '-';
                            const isPending = inst.status === 'PENDING_RECALL' || inst.status === 'SUPERSEDED_PENDING_RECALL' || inst.status === 'OBSOLETE_PENDING_RECALL';
                            const isDestroyed = inst.status === 'DESTROYED' || inst.status === 'RECALLED_DESTROYED';
                            const isRecalled = inst.status === 'RECALLED' || inst.status === 'ARCHIVED_OBSOLETE';

                            return (
                              <tr key={inst.id || index} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-3 text-center font-mono font-bold text-[#0D99FF]">
                                  {copyNoStr}
                                </td>
                                <td className="py-3 px-3 font-bold text-slate-700">
                                  {deptName}
                                </td>
                                <td className="py-3 px-3 text-slate-600 flex items-center gap-1.5">
                                  <MapPin size={13} className="text-slate-400 shrink-0" />
                                  <span>{locationName}</span>
                                </td>
                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                  {isPending ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 shadow-2xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      รอเรียกคืน (PENDING_RECALL)
                                    </span>
                                  ) : isDestroyed ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300 shadow-2xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                      ทำลายแล้ว (DESTROYED)
                                    </span>
                                  ) : isRecalled ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                      เรียกคืนแล้ว (RECALLED)
                                    </span>
                                  ) : (
                                    <StatusBadge status={inst.status} />
                                  )}
                                </td>
                                <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                  {(isDestroyed || isRecalled) ? (
                                    <div>
                                      <div className="font-bold text-slate-800">
                                        {inst.dateDestroyed || inst.dateRecalled || (inst.recalled_at ? inst.recalled_at.split('T')[0] : '-')}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-sans">
                                        โดย {inst.recalled_by || inst.recalledBy || inst.disposed_by_name || 'DCC'}
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div>{receiptDate ? receiptDate.split('T')[0] : '-'}</div>
                                      <div className="text-[10px] text-slate-400 font-sans">ตรวจรับเข้าจุดใช้งาน</div>
                                    </div>
                                  )}
                                </td>
                                {isDccAdmin && (
                                  <td className="py-3 px-3 text-center">
                                    {isPending ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedCopiesForDisposition([inst]);
                                          setIsDispositionModalOpen(true);
                                        }}
                                        className="px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                                        title="บันทึกการเรียกคืน/ทำลายสำเนานี้"
                                      >
                                        <Flame size={12} />
                                        <span>จัดการ</span>
                                      </button>
                                    ) : (
                                      <span className="text-slate-300 font-mono text-xs">-</span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={isDccAdmin ? 6 : 5} className="py-8 text-center text-slate-400">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Layers size={24} className="text-slate-300" />
                                <p className="text-xs">ยังไม่มีการแจกจ่ายสำเนาควบคุมสำหรับเอกสารฉบับนี้</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Audit Trail Log */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                {/* Audit Trail Log */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-[#0D99FF]" />
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        บันทึกประวัติการดำเนินการ (Audit Trail Log)
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {auditLogs.length} Records
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-40 whitespace-nowrap">วันและเวลา (Date/Time)</th>
                          <th className="py-2.5 px-3 w-44 whitespace-nowrap">การกระทำ (Action)</th>
                          <th className="py-2.5 px-3 w-40 whitespace-nowrap">ผู้ดำเนินการ (Actor)</th>
                          <th className="py-2.5 px-3">รายละเอียด (Details)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogs.length > 0 ? (
                          auditLogs.map((log, i) => (
                            <tr key={log.id || i} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                                {log.date || log.timestamp || '-'}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[11px]">
                                  {log.action || 'UPDATE'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                                {log.actor || 'System'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {log.details || log.remarks || '-'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="py-8 text-center text-slate-400">
                              ยังไม่มีประวัติการดำเนินการในระบบสำหรับเอกสารฉบับนี้
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Embedded Request Additional Copies Modal */}
      {isRequestCopiesOpen && (
        <RequestAdditionalCopiesModal
          isOpen={isRequestCopiesOpen}
          onClose={() => setIsRequestCopiesOpen(false)}
          document={{
            ...currentDoc,
            id: currentDoc.id,
            title: edCode,
            name: currentDoc.title,
            rev: currentDoc.rev || currentDoc.sourceVersion || '01',
            department: currentDoc.department || uDept
          }}
        />
      )}

      {/* Embedded External Copy Disposition Modal */}
      {isDispositionModalOpen && (
        <ExternalCopyDispositionModal
          isOpen={isDispositionModalOpen}
          onClose={() => {
            setIsDispositionModalOpen(false);
            setSelectedCopiesForDisposition([]);
          }}
          document={currentDoc}
          copies={selectedCopiesForDisposition.length > 0 ? selectedCopiesForDisposition : ccInstances}
        />
      )}
    </AnimatePresence>
  );
};

export default ExternalDocDetailModal;
