import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';
import { Calendar, X, Settings, Trash2, FileText, ChevronLeft, User, AlertTriangle, Building, Layers } from 'lucide-react';
import UserSelector from '../../components/UserSelector';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';
import Button from '../../components/ui/Button';
import { resolveReviewer } from '../../utils/workflowResolver';
import { normalizeDraftToFormState } from '../../utils/draftNormalizer';
import { isUserAuthorizedForDocDept } from '../../utils/darHelper';

const DarObsoleteForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();
  const rawDraftId = searchParams.get('draftId') || params?.draftId || params?.id || location.state?.draftId;
  const targetDraftId = rawDraftId ? decodeURIComponent(String(rawDraftId)).trim() : null;
  const prefillDocId = location.state?.prefillDocId;
  const deepLinkDocCode = searchParams.get('docCode') || searchParams.get('code') || location.state?.targetDocCode || location.state?.docCode;
  const deepLinkDocId = searchParams.get('docId') || location.state?.selectedDocId || location.state?.docId || prefillDocId;
  const { currentUser, addDar, saveDarDraft, deleteDar, masterUsers, reviewUsers, documents, dars, darRequests, simulatedDate, controlledCopyInstances, documentControlledCopies } = useStore();
  
  const initialFormState = {
    docId: '',
    obsoleteReason: '',
    otherReason: '',
    obsoleteDetail: '',
    recallPlan: '',
    ackRequirement: 'NOT_REQUIRED',
    ackUserId: '',
    effectiveDate: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [lockedSource, setLockedSource] = useState(null);
  const [lockedSourceError, setLockedSourceError] = useState(null);

  // Filter only ACTIVE / EFFECTIVE documents for the current user's authorized departments
  const effectiveDocs = useMemo(() => {
    return (documents || []).filter(d => {
      if (!d) return false;
      const status = String(d.status || (d.is_active ? 'ACTIVE' : '')).trim().toUpperCase();
      if (status !== 'EFFECTIVE' && status !== 'ACTIVE') return false;
      if (d.is_obsolete || d.is_superseded || status === 'OBSOLETE' || status === 'SUPERSEDED') return false;
      const docDept = d.department || d.dept || d.owner_dept;
      return isUserAuthorizedForDocDept(docDept, currentUser);
    });
  }, [documents, currentUser]);

  // Active Controlled Copy distribution breakdown for the selected document
  const activeCopiesList = useMemo(() => {
    const selectedDoc = (documents || []).find(d => d && d.id === formData.docId);
    if (!selectedDoc) return [];
    const allCopies = (controlledCopyInstances && controlledCopyInstances.length > 0)
      ? controlledCopyInstances
      : (documentControlledCopies || []);
    return allCopies.filter(c => {
      const docMatch =
        (c.docCode && (c.docCode === selectedDoc.code || c.docCode === selectedDoc.title)) ||
        (c.documentId && String(c.documentId) === String(selectedDoc.id)) ||
        String(c.doc_id || c.docId) === String(selectedDoc.id) ||
        (c.doc_code && (c.doc_code === selectedDoc.code || c.doc_code === selectedDoc.title)) ||
        (c.docTitle && (c.docTitle === selectedDoc.code || c.docTitle === selectedDoc.title)) ||
        (c.document_code && (c.document_code === selectedDoc.code || c.document_code === selectedDoc.title));
      return docMatch && (c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE' || c.status === 'RECEIVED' || c.status === 'DISPATCHED_PENDING_RECEIPT');
    });
  }, [formData.docId, documents, controlledCopyInstances, documentControlledCopies]);

  const activeCopyGroups = useMemo(() => {
    // Group by dept
    const groups = {};
    activeCopiesList.forEach(c => {
      const dept = c.holder_dept || c.department || '?';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(c);
    });
    return Object.entries(groups).map(([dept, copies]) => ({ dept, copies }));
  }, [activeCopiesList]);

  // Security Handling: Clear selected doc if user switches and the doc is no longer in the filtered list
  useEffect(() => {
    if (formData.docId) {
      const isStillValid = (effectiveDocs || []).some(d => d && d.id === formData.docId);
      if (!isStillValid && !lockedSource && !targetDraftId) {
        setFormData(prev => ({ ...prev, docId: '' }));
      }
    }
  }, [currentUser?.id, currentUser?.department, currentUser?.dept, formData.docId, effectiveDocs, lockedSource, targetDraftId]);

  // Handle Prefill / Deep-link from Document Library or Periodic Review
  useEffect(() => {
    if (targetDraftId || location.state?.draftData) return;
    if (formData.docId) return;

    if (deepLinkDocId || deepLinkDocCode) {
      const candidateList = (effectiveDocs && effectiveDocs.length > 0) ? effectiveDocs : (documents || []);
      const matched = candidateList.find(d => {
        if (!d) return false;
        if (deepLinkDocId && String(d.id) === String(deepLinkDocId)) return true;
        const code = (d.document_code || d.doc_code || d.code || d.docCode || d.title || '').trim().toUpperCase();
        if (deepLinkDocCode && code === String(deepLinkDocCode).trim().toUpperCase()) return true;
        return false;
      });

      if (matched) {
        setFormData(prev => ({ ...prev, docId: matched.id }));
      }
    }
  }, [deepLinkDocId, deepLinkDocCode, effectiveDocs, documents, targetDraftId, location.state?.draftData, formData.docId]);

  useEffect(() => {
    if (targetDraftId || location.state?.draftData) {
      const allDarsList = dars || darRequests || [];
      const draft = location.state?.draftData || allDarsList.find(d => {
        if (!targetDraftId) return false;
        return (
          String(d.id) === targetDraftId || 
          String(d.dar_no) === targetDraftId || 
          String(d.darNo) === targetDraftId
        );
      });
      if (draft) {
        if (draft.sourceType === 'PERIODIC_REVIEW') {
          try {
            useStore.getState().validateLinkedDarSource(draft);
            const source = useStore.getState().resolveLockedSourceDocument(draft);
            setLockedSource(source);
            setLockedSourceError(null);
            
            const hydrated = normalizeDraftToFormState(draft, initialFormState);
            setFormData(prev => ({
              ...prev,
              ...hydrated,
              docId: draft.targetDocumentId || hydrated.docId
            }));
          } catch (err) {
            setLockedSourceError(err.message);
          }
        } else {
          setLockedSource(null);
          setLockedSourceError(null);
          const hydrated = normalizeDraftToFormState(draft, initialFormState);
          setFormData(hydrated);
        }
      }
    }
  }, [targetDraftId, dars, darRequests, location.state]);

  const selectedDoc = effectiveDocs.find(d => d.id === formData.docId);

  const totalControlledCopies = useMemo(() => {
    if (!selectedDoc) return 0;
    const fromInstances = activeCopyGroups.reduce((sum, g) => sum + g.copies.length, 0);
    return fromInstances > 0 ? fromInstances : (selectedDoc.controlledCopy || 0);
  }, [selectedDoc, activeCopyGroups]);

  const handleDocChange = (e) => {
    const docId = e.target.value;
    setFormData(prev => ({
      ...prev,
      docId,
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.docId) newErrors.docId = 'กรุณาเลือกเอกสารที่ต้องการยกเลิก';
    if (!formData.obsoleteReason) newErrors.obsoleteReason = 'กรุณาเลือกเหตุผลการยกเลิก';
    if (formData.obsoleteReason === 'OTHER' && !formData.otherReason) newErrors.otherReason = 'กรุณาระบุเหตุผลอื่นๆ';
    if (!formData.obsoleteDetail) newErrors.obsoleteDetail = 'กรุณาระบุรายละเอียดการยกเลิก';

    if (selectedDoc && totalControlledCopies > 0 && !formData.recallPlan) {
      newErrors.recallPlan = 'จำเป็นต้องระบุแผนการเรียกคืน เนื่องจากมีสำเนาควบคุมในระบบ';
    }

    if (formData.ackRequirement === 'REQUIRED' && !formData.ackUserId) {
      newErrors.ackUserId = 'กรุณาเลือกผู้รับ Acknowledgement 1 คน';
    }
    
    if (!formData.effectiveDate) {
      newErrors.effectiveDate = 'กรุณาระบุวันที่ต้องการให้เอกสารมีผลยกเลิก';
    } else {
      const today = new Date(simulatedDate || Date.now());
      today.setHours(0,0,0,0);
      const selected = new Date(formData.effectiveDate);
      if (selected < today) newErrors.effectiveDate = 'ห้ามเลือกวันย้อนหลัง (นับจาก Simulated Date)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildPayload = (isDraft) => {
    return {
      id: targetDraftId || formData.id,
      dar_no: formData.darNo || formData.id,
      type: 'OBSOLETE',
      status: isDraft ? 'DRAFT' : 'UNDER_REVIEW',
      title: selectedDoc ? `[OBSOLETE] ${selectedDoc.title}` : (formData.title || 'Untitled Draft'),
      requesterId: currentUser?.id,
      requester_id: currentUser?.id,
      requester_name: currentUser?.name,
      department: currentUser?.department || formData.department,
      date: formData.date || new Date().toISOString().split('T')[0],
      docIdRef: formData.docId,
      doc_id: formData.docId,
      targetDocumentId: formData.docId,
      document_code: selectedDoc?.title || formData.docCode || formData.docId,
      obsoleteReason: formData.obsoleteReason,
      obsolete_reason: formData.obsoleteReason,
      reasonCategory: formData.obsoleteReason,
      otherReason: formData.obsoleteReason === 'OTHER' ? formData.otherReason : undefined,
      obsoleteDetail: formData.obsoleteDetail,
      obsolete_detail: formData.obsoleteDetail,
      reasonDetails: formData.obsoleteDetail,
      recallPlan: formData.recallPlan,
      recall_plan: formData.recallPlan,
      ackRequirement: formData.ackRequirement,
      requireAck: formData.ackRequirement === 'REQUIRED',
      ackUserIds: formData.ackRequirement === 'REQUIRED' ? (formData.ackUserId ? [formData.ackUserId] : []) : [],
      ackUserId: formData.ackUserId,
      distributions: [],
      effectiveDate: formData.effectiveDate,
      effective_date: formData.effectiveDate,
      isDraft: isDraft
    };
  };

  const handleDraft = () => {
    const draftPayload = buildPayload(true);
    if (saveDarDraft) {
      saveDarDraft(draftPayload);
    } else {
      if (targetDraftId && deleteDar) deleteDar(targetDraftId);
      addDar(draftPayload);
    }
    toast.success('บันทึกแบบร่างสำเร็จ');
    navigate('/dashboard');
  };

  const handleFormSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (validate()) {
      setShowConfirm(true);
    } else {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง');
    }
  };

  const executeSubmit = () => {
    const newDar = buildPayload(false);
    if (targetDraftId && deleteDar) deleteDar(targetDraftId);
    addDar(newDar);
    setShowConfirm(false);
    toast.success('สร้างคำร้องขอยกเลิกเอกสารสำเร็จ และส่งต่อให้ผู้ทบทวนแล้ว');
    navigate('/dashboard');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-2 w-full max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
            <Trash2 size={22} strokeWidth={1.75}/>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1E1E1E] tracking-tight">ยื่นคำขอยกเลิกเอกสาร (Obsolete DAR)</h2>
            <p className="text-xs text-[#666666] mt-0.5">ขอยกเลิกการบังคับใช้เอกสารถาวรและดำเนินการเรียกคืนสำเนาควบคุม</p>
          </div>
        </div>
        <button onClick={() => navigate('/dar/new')} className="flex items-center text-xs font-bold text-slate-600 hover:text-[#0D99FF] transition-colors cursor-pointer">
          <ChevronLeft size={16} /> เปลี่ยนประเภท DAR
        </button>
      </div>
      
      <form onSubmit={handleFormSubmit} className="space-y-4">
        
        {/* ================= UNIFIED HIGH-DENSITY MASTER FORM CANVAS ================= */}
        <div className="card-surface overflow-hidden divide-y divide-[#F1F5F9] shadow-2xs">
          
          {/* Section 1: ข้อมูลผู้ร้องขอ (Compact Metadata Strip) */}
          <div className="bg-[#F8FAFC] px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <User className="text-[#0D99FF] shrink-0" size={15} />
                <span className="text-sm font-bold text-[#1E293B] hidden sm:inline">ส่วนที่ 1: ข้อมูลผู้ร้องขอ (Requester Information)</span>
                <span className="text-[#CBD5E1] hidden sm:inline">•</span>
                <label className="text-sm font-semibold text-[#64748B] flex items-center gap-1.5 cursor-default">
                  <span>ผู้ร้องขอ:</span>
                  <strong className="text-[#1E293B] font-bold text-sm">{currentUser?.name || 'ธนาวุฒิ สมควรกิจดำรง'}</strong>
                </label>
              </div>

              <div className="flex items-center gap-1.5 text-[#64748B] text-sm">
                <span>แผนก:</span>
                <span className="font-mono font-bold text-[#0D99FF] bg-[#E5F4FF] px-2 py-0.5 rounded text-xs">
                  {currentUser?.department || currentUser?.dept || 'PD'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[#64748B] text-sm">
                <Calendar size={14} className="text-[#94A3B8]" />
                <label className="flex items-center gap-1 cursor-default">
                  <span>วันที่ยื่นคำขอ:</span>
                  <span className="font-mono font-medium text-[#1E293B] text-xs">
                    {new Date().toLocaleDateString('th-TH')}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                [ ฉบับร่าง (รอออกเลข DAR หลังส่งคำร้อง) ]
              </span>
              <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                ขอยกเลิก (OBSOLETE)
              </div>
            </div>
          </div>

          {/* Section 2: เอกสารเป้าหมายและวันที่มีผลยกเลิก (Unified Grid) */}
          <div className="p-5 space-y-3 bg-white">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-bold text-sm text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <Settings className="text-[#0D99FF]" size={16} />
                <span className="font-bold text-sm text-[#1E293B]">ส่วนที่ 2: เอกสารเป้าหมายและวันที่มีผลยกเลิก</span>
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start pt-1">
              
              {/* 1. เลือกเอกสารที่ต้องการยกเลิก (8 Cols) */}
              <div className="md:col-span-8">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  เลือกเอกสารที่ต้องการยกเลิก (จากคลัง Active) <span className="text-[#EF4444]">*</span>
                </label>

                {lockedSourceError ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-700">
                    <p className="font-bold">{lockedSourceError}</p>
                  </div>
                ) : lockedSource ? (
                  <div className="h-10.5 px-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-mono font-bold text-amber-900 flex items-center justify-between truncate">
                    <span className="truncate">[{lockedSource.documentCode}] {lockedSource.documentTitle}</span>
                  </div>
                ) : (
                  <div>
                    <select 
                      value={formData.docId}
                      onChange={handleDocChange}
                      className={`w-full h-10.5 px-3.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all ${errors.docId ? 'border-rose-400 bg-rose-50/50' : ''}`}
                    >
                      <option value="">-- เลือกเอกสารที่ต้องการยกเลิก --</option>
                      {effectiveDocs.map(d => (
                        <option key={d.id} value={d.id}>[{d.title}] {d.name} (Rev. {d.rev})</option>
                      ))}
                    </select>
                    {errors.docId && <p className="text-rose-500 text-xs mt-1">{errors.docId}</p>}
                  </div>
                )}

                {!lockedSource && selectedDoc && (
                  <div className="mt-2.5 bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px]">{selectedDoc.title}</span>
                      <span className="font-medium text-[#1E293B] truncate max-w-[280px]">{selectedDoc.name}</span>
                      <span className="text-slate-500 font-mono text-[11px]">Rev. {selectedDoc.rev}</span>
                    </div>
                    <div className="flex items-center gap-1 font-medium text-slate-600">
                      <span>สำเนาควบคุม:</span>
                      <strong className={`font-mono ${totalControlledCopies > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {totalControlledCopies} ฉบับ
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. วันที่ต้องการให้มีผลยกเลิก (4 Cols) */}
              <div className="md:col-span-4">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  วันที่มีผลยกเลิก (Requested Date) <span className="text-[#EF4444]">*</span>
                </label>
                <input 
                  type="date" 
                  value={formData.effectiveDate}
                  min={new Date(simulatedDate || Date.now()).toISOString().split('T')[0]}
                  onChange={(e) => setFormData(prev => ({...prev, effectiveDate: e.target.value}))}
                  className={`w-full h-10.5 px-3.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all font-mono ${errors.effectiveDate ? 'border-rose-400 bg-rose-50/50' : ''}`}
                />
                {errors.effectiveDate && <p className="text-rose-500 text-xs mt-1">{errors.effectiveDate}</p>}
                <p className="text-[11px] text-[#64748B] mt-1">
                  หมายเหตุ: เอกสารจะยังคงสถานะ EFFECTIVE จนกว่าจะถึงกำหนดและผ่านการอนุมัติ
                </p>
              </div>

            </div>

            {/* Active Controlled Copies Matrix */}
            {selectedDoc && (
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-[#0D99FF]" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#1E293B]">
                      สำเนาควบคุมปัจจุบันที่ใช้งานอยู่ในสายงาน (Current Active Copies in Circulation)
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    พบ {activeCopiesList.length} สำเนา
                  </span>
                </div>

                {/* ISO 9001 Recall Warning Banner */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold">ข้อกำหนด ISO 9001 (Control of Documented Information): </span>
                    <span>เมื่อคำร้องนี้ได้รับการอนุมัติ สำเนาทั้งหมดในรายการนี้จะถูกเรียกคืนกลับสู่ฝ่าย DC</span>
                  </div>
                </div>

                {/* Table */}
                {activeCopiesList.length > 0 ? (
                  <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F8FAFC] text-[#475569] font-bold border-b border-[#E2E8F0] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">หมายเลขสำเนา (Copy No.)</th>
                          <th className="py-2.5 px-3">แผนกผู้ถือครอง (Department)</th>
                          <th className="py-2.5 px-3">จุดใช้งานจริง (Location)</th>
                          <th className="py-2.5 px-3 text-center">Rev ปัจจุบัน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] bg-white">
                        {activeCopiesList.map((c, idx) => (
                          <tr key={c.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#0D99FF]">
                              Copy {c.copy_no || c.copyNo || c.ccNumber || String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#1E293B]">
                              <span className="inline-flex items-center gap-1">
                                <Building size={12} className="text-slate-400" />
                                {c.holder_dept || c.department || c.dept || '-'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[#334155]">
                              {c.location || c.locationName || c.station_name || c.holder_name || `${c.holder_dept || c.department || 'PD'} Station`}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                              Rev.{c.rev || c.doc_version || c.revision || selectedDoc?.rev || '00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    ไม่พบสำเนาควบคุมที่ใช้งานอยู่ในสายงานสำหรับเอกสารนี้ (ไม่มีภาระงานเรียกคืนเล่มจริง)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: เหตุผลและแผนการจัดการสำเนาเดิม (Clean Modern SaaS Layout) */}
          <div className="p-5 sm:p-6 space-y-5 bg-white">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <h3 className="font-bold text-sm text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <FileText className="text-[#0D99FF]" size={16} />
                <span>ส่วนที่ 3: เหตุผลและความจำเป็นในการยกเลิกและแผนการจัดการ</span>
              </h3>
              {selectedDoc && totalControlledCopies > 0 && (
                <span className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full font-medium">
                  มีภาระเรียกคืนสำเนากระดาษ {totalControlledCopies} เล่ม
                </span>
              )}
            </div>

            <div className="space-y-4.5">
              {/* 1. เหตุผลการยกเลิก (Obsolete Reason) */}
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  เหตุผลการยกเลิก (Obsolete Reason) <span className="text-[#EF4444]">*</span>
                </label>
                <select 
                  value={formData.obsoleteReason}
                  onChange={(e) => setFormData(prev => ({...prev, obsoleteReason: e.target.value}))}
                  className={`w-full h-10.5 px-3.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all ${errors.obsoleteReason ? 'border-rose-400 bg-rose-50/50' : ''}`}
                >
                  <option value="">-- เลือกเหตุผลการยกเลิก --</option>
                  <option value="PROCESS_CHANGE">ปรับปรุงกระบวนการและควบรวมกับเอกสารอื่น (Process Merge)</option>
                  <option value="PROCESS_REMOVED">ยกเลิกกระบวนการทำงานดังกล่าวแล้ว (Process Discontinued)</option>
                  <option value="AUDIT_FINDING">ยกเลิกตามข้อเสนอแนะจากการตรวจติดตาม (Audit Finding)</option>
                  <option value="DUPLICATED">เอกสารซ้ำซ้อน (Duplicate Document)</option>
                  <option value="OTHER">อื่น ๆ (Other)</option>
                </select>
                {errors.obsoleteReason && <p className="text-rose-500 text-xs mt-1">{errors.obsoleteReason}</p>}
                
                {formData.obsoleteReason === 'OTHER' && (
                  <div className="mt-2.5">
                    <input 
                      type="text"
                      value={formData.otherReason}
                      onChange={(e) => setFormData(prev => ({...prev, otherReason: e.target.value}))}
                      className={`w-full h-10 px-3.5 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] ${errors.otherReason ? 'border-rose-400 bg-rose-50/50' : ''}`}
                      placeholder="ระบุเหตุผลความจำเป็น..."
                    />
                    {errors.otherReason && <p className="text-rose-500 text-xs mt-1">{errors.otherReason}</p>}
                  </div>
                )}
              </div>

              {/* 2. รายละเอียดเพิ่มเติมและผลกระทบ (Details & Impact) */}
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  รายละเอียดเพิ่มเติมและผลกระทบ (Details & Impact) <span className="text-[#EF4444]">*</span>
                </label>
                <textarea 
                  rows={3}
                  value={formData.obsoleteDetail}
                  onChange={(e) => setFormData(prev => ({...prev, obsoleteDetail: e.target.value}))}
                  className={`w-full p-3.5 text-sm bg-white border border-[#CBD5E1] rounded-xl text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all leading-relaxed resize-y min-h-[90px] ${errors.obsoleteDetail ? 'border-rose-400 bg-rose-50/50' : ''}`}
                  placeholder="อธิบายเหตุผลและผลกระทบของการยกเลิกเอกสารนี้..."
                />
                {errors.obsoleteDetail && <p className="text-rose-500 text-xs mt-1">{errors.obsoleteDetail}</p>}
              </div>

              {/* 3. แผนการสื่อสารและระยะเวลาเรียกคืนสำเนากลับสู่ DC (Recall Plan) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-[#334155]">
                    แผนการสื่อสารและระยะเวลาเรียกคืนสำเนากลับสู่ DC (Recall Plan)
                    {selectedDoc && totalControlledCopies > 0 && <span className="text-[#EF4444] ml-1">*</span>}
                  </label>
                  <span className="text-[11px] text-[#64748B]">
                    {selectedDoc && totalControlledCopies > 0 
                      ? 'อ้างอิงตามรายการสำเนาควบคุมในตารางส่วนที่ 2' 
                      : 'เอกสารไม่มีสำเนากระดาษ'}
                  </span>
                </div>
                <textarea 
                  rows={2}
                  value={formData.recallPlan}
                  onChange={(e) => setFormData(prev => ({...prev, recallPlan: e.target.value}))}
                  className={`w-full p-3 text-sm bg-white border border-[#CBD5E1] rounded-xl text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all leading-relaxed resize-y min-h-[70px] ${errors.recallPlan ? 'border-rose-400 bg-rose-50/50' : ''}`}
                  placeholder="แผนการสื่อสารหน้างานและกรอบเวลาในการส่งคืนสำเนาทั้งหมดแก่ฝ่าย DC (เช่น ส่งคืนเล่มจริงภายใน 3 วันทำการหลังได้รับการอนุมัติ)..."
                />
                {errors.recallPlan ? (
                  <p className="text-rose-500 text-xs mt-1">{errors.recallPlan}</p>
                ) : (
                  <p className="text-[11px] text-[#64748B] mt-1">
                    เมื่อคำร้องได้รับอนุมัติ ระบบจะส่ง Task เรียกคืนสำเนาทั้งหมดกลับสู่ฝ่าย DC ตามรายการในตารางด้านบนโดยอัตโนมัติ
                  </p>
                )}
              </div>

              {/* 4. การรับทราบการยกเลิก (Acknowledgement Requirement) */}
              <div className="pt-3 border-t border-[#F1F5F9] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-sm font-semibold text-[#334155]">
                      การรับทราบการยกเลิก (Acknowledgement) <span className="text-[#EF4444]">*</span>
                    </label>
                    <p className="text-[11px] text-[#64748B]">กำหนดให้ผู้เกี่ยวข้องลงนามรับทราบการยกเลิกเอกสารนี้หรือไม่</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs sm:text-sm">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-[#475569]">
                      <input 
                        type="radio" 
                        name="ack"
                        value="NOT_REQUIRED"
                        checked={formData.ackRequirement === 'NOT_REQUIRED'}
                        onChange={(e) => setFormData(prev => ({...prev, ackRequirement: e.target.value, ackUserId: ''}))}
                        className="w-4 h-4 text-[#0D99FF] focus:ring-[#0D99FF]"
                      />
                      <span>ไม่ต้องรับทราบ</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-[#475569]">
                      <input 
                        type="radio" 
                        name="ack"
                        value="REQUIRED"
                        checked={formData.ackRequirement === 'REQUIRED'}
                        onChange={(e) => setFormData(prev => ({...prev, ackRequirement: e.target.value}))}
                        className="w-4 h-4 text-[#0D99FF] focus:ring-[#0D99FF]"
                      />
                      <span>ต้องรับทราบ</span>
                    </label>
                  </div>
                </div>

                {formData.ackRequirement === 'REQUIRED' && (
                  <div className={`p-3.5 rounded-xl border ${errors.ackUserId ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50/50'}`}>
                    <p className="text-xs font-semibold text-[#334155] mb-1.5">เลือกผู้ที่ต้องรับทราบ (1 คน) <span className="text-[#EF4444]">*</span></p>
                    <UserSelector 
                      value={formData.ackUserId} 
                      onChange={(id) => setFormData(prev => ({...prev, ackUserId: id}))} 
                      error={errors.ackUserId} 
                      users={(masterUsers || []).filter(u => u && u.id !== currentUser?.id && !u.isDcc && u.role !== 'DCC_ADMIN')} 
                    />
                    {errors.ackUserId && <p className="text-rose-500 text-xs mt-1">{errors.ackUserId}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="card-surface p-4 flex justify-end gap-2.5 shadow-2xs mb-2">
          <Button 
            variant="ghost"
            type="button" 
            onClick={() => navigate('/dashboard')}
          >
            <X size={15} className="mr-1"/> ยกเลิก (Cancel)
          </Button>
          <Button 
            variant="secondary"
            type="button" 
            onClick={handleDraft}
          >
            บันทึกแบบร่าง (Draft)
          </Button>
          <Button 
            variant="danger"
            type="submit" 
            onClick={handleFormSubmit}
          >
            <Trash2 size={15} className="mr-1"/> ส่งคำขอยกเลิก (Submit Obsolete)
          </Button>
        </div>
      </form>

      {(() => {
        const resolvedRevId = resolveReviewer(
          currentUser?.id, 
          currentUser?.department || 'PD', 
          masterUsers || [], 
          reviewUsers || masterUsers || [], 
          formData.docType || formData.targetDocType
        )?.id;
        const resolvedReviewerObj = (masterUsers || []).find(u => u && u.id === resolvedRevId);

        return (
          <ActionConfirmModal
            isOpen={showConfirm}
            onClose={() => setShowConfirm(false)}
            onConfirm={executeSubmit}
            title="ยืนยันการส่งคำร้องขอยกเลิกเอกสาร (Obsolete DAR)"
            actionType="obsolete"
            requireTypeToConfirm={true}
            confirmText="ยืนยันการขอยกเลิกเอกสาร"
            cancelText="ยกเลิก / กลับไปแก้ไข"
            summaryData={[
              {
                label: 'ผู้ร้องขอ / แผนก',
                value: (
                  <span className="font-medium text-slate-800">
                    {currentUser?.name || 'ธนาวุฒิ สมควรกิจดำรง'} ({currentUser?.department || 'PD'})
                  </span>
                )
              },
              {
                label: 'เอกสารที่ขอยกเลิก',
                value: (
                  <div className="space-y-1">
                    <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100 mr-2">
                      {selectedDoc?.title || formData.docId}
                    </span>
                    <span className="text-sm font-bold text-[#1E1E1E]">
                      {selectedDoc?.name}
                    </span>
                  </div>
                )
              },
              {
                label: 'ฉบับที่จะยกเลิก',
                value: (
                  <span className="font-mono font-bold text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                    Rev. {selectedDoc?.rev || '00'} (Obsolete Archive)
                  </span>
                )
              },
              {
                label: 'เหตุผลการยกเลิก',
                value: (
                  <div className="text-sm text-slate-800 font-medium bg-[#F5F5F5] p-2.5 rounded-xl border border-[#E5E5E5]/70">
                    {formData.obsoleteReason === 'OTHER' ? `อื่นๆ: ${formData.otherReason || '-'}` : (formData.obsoleteReason || '-')}
                  </div>
                )
              },
              {
                label: 'รายละเอียดและผลกระทบ',
                value: (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-[#F5F5F5] p-3 rounded-xl border border-[#E5E5E5]/70">
                    {formData.obsoleteDetail || 'ไม่มีรายละเอียดเพิ่มเติม'}
                  </div>
                )
              },
              {
                label: 'แผนการเรียกคืนสำเนา',
                value: (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-[#F5F5F5] p-3 rounded-xl border border-[#E5E5E5]/70">
                    {formData.recallPlan || 'เรียกคืนสำเนาควบคุมจากทุกจุดใช้งานตามขั้นตอนมาตรฐานของฝ่าย DC'}
                  </div>
                )
              },
              {
                label: 'วันที่มีผลยกเลิก',
                value: (
                  <span className="font-mono font-bold text-slate-800 bg-[#F5F5F5] px-2.5 py-0.5 rounded-md">
                    {formData.effectiveDate || '-'}
                  </span>
                )
              },
              {
                label: 'ขั้นตอนถัดไป / ผู้มีอำนาจทบทวน',
                value: (
                  <div className="text-xs sm:text-sm font-medium text-indigo-800 bg-[#E5F4FF]/80 p-2.5 rounded-xl border border-indigo-100 flex items-center gap-1.5">
                    <span>ส่งต่อให้:</span>
                    <strong className="font-bold">
                      {resolvedReviewerObj ? `${resolvedReviewerObj.name} (${resolvedReviewerObj.position || resolvedReviewerObj.department})` : 'ผู้ทบทวนตามสายงาน (Reviewer Level 2)'}
                    </strong>
                  </div>
                )
              }
            ]}
          />
        );
      })()}
    </div>
  );
};

export default DarObsoleteForm;
