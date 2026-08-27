import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';
import { Upload, FileText, Calendar, Settings, FileEdit, Search, X, ShieldAlert, ChevronLeft, Check, ShieldCheck, UploadCloud, User } from 'lucide-react';
import UserSelector from '../../components/UserSelector';
import DistributionSetup from '../../components/workflow/DistributionSetup';
import RelatedStandardsSelector from '../../components/workflow/RelatedStandardsSelector';
import DocumentAccessControlSelector from '../../components/workflow/DocumentAccessControlSelector';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';
import Button from '../../components/ui/Button';
import { resolveReviewer } from '../../utils/workflowResolver';
import { calculateCopyAllocations } from '../../services/MasterDataService';
import { ACCESS_SCOPE_METADATA } from '../../utils/accessControl';
import { normalizeDraftToFormState } from '../../utils/draftNormalizer';

const DarRevisionForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();
  const targetDraftId = searchParams.get('draftId') || params?.draftId || params?.id || location.state?.draftId;
  const prefillDocId = location.state?.prefillDocId;
  const { currentUser, addDar, saveDarDraft, deleteDar, masterUsers, reviewUsers, documents, dars, darRequests, documentTypes, simulatedDate } = useStore();
  const activeDocumentTypes = (documentTypes || []).filter(t => (t.status === 'ACTIVE' || t.status === 'Active' || t.isActive !== false) && t.allowDar !== false && t.category !== 'EXTERNAL' && t.code !== 'ED' && t.id !== 'ED');
  
  const initialFormState = {
    docId: '',
    title: '', // new title, default to old
    changeSummary: '',
    changeReason: '',
    otherReason: '',
    ackRequirement: 'NOT_REQUIRED',
    ackUserId: '',
    distributions: [],
    effectiveDate: '',
    file: null,
    relatedStandards: [],
    otherStandardDetail: '',
    access_control: {
      scope: 'GENERAL',
      authorized_depts: [],
      authorized_users: [],
      min_access_level: 4
    }
  };

  const [formData, setFormData] = useState(initialFormState);
  
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef(null);
  
  const [lockedSource, setLockedSource] = useState(null);
  const [lockedSourceError, setLockedSourceError] = useState(null);

  useEffect(() => {
    if (targetDraftId || location.state?.draftData) {
      const allDarsList = dars || darRequests || [];
      const draft = location.state?.draftData || allDarsList.find(d => (d.id === targetDraftId || d.dar_no === targetDraftId || d.darNo === targetDraftId) && (d.status === 'DRAFT' || d.isDraft));
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
              docId: draft.targetDocumentId || hydrated.docId,
              title: source.documentTitle || hydrated.title
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
  }, [targetDraftId, dars, darRequests, currentUser.department, location.state]);

  // Handle Prefill from Periodic Review
  useEffect(() => {
    if (prefillDocId) {
      setFormData(prev => ({ ...prev, docId: prefillDocId }));
    }
  }, [prefillDocId]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter only EFFECTIVE documents for the current user's department
  const userDept = currentUser.department || currentUser.dept;
  const effectiveDocs = useMemo(() => {
    return documents.filter(d => d.status === 'EFFECTIVE' && d.department === userDept);
  }, [documents, userDept]);

  // Security Handling: Clear selected doc if user switches and the doc is no longer in the filtered list
  useEffect(() => {
    if (formData.docId) {
      const isStillValid = effectiveDocs.some(d => d.id === formData.docId);
      if (!isStillValid) {
        setFormData(prev => ({ ...prev, docId: '', title: '' }));
      }
    }
  }, [currentUser.id, currentUser.department, currentUser.dept, formData.docId, effectiveDocs]);

  const filteredDocs = effectiveDocs.filter(d => {
    const matchesType = docTypeFilter ? d.title.startsWith(docTypeFilter) : true;
    const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          d.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const selectedDoc = effectiveDocs.find(d => d.id === formData.docId);

  const calculateNextRev = (currentRev) => {
    const revNum = parseInt(currentRev, 10);
    if (isNaN(revNum)) return '01';
    return String(revNum + 1).padStart(2, '0');
  };

  const handleDocSelect = (doc) => {
    const initialAc = doc.access_control || {
      scope: 'GENERAL',
      authorized_depts: [],
      authorized_users: [],
      min_access_level: 4
    };
    setFormData(prev => ({
      ...prev,
      docId: doc.id,
      title: doc.name,
      distributions: doc.distributions ? JSON.parse(JSON.stringify(doc.distributions)) : [],
      relatedStandards: doc.relatedStandards ? [...doc.relatedStandards] : [],
      otherStandardDetail: doc.otherStandardDetail || '',
      access_control: initialAc,
      ...(doc.title && doc.title.startsWith('FM') ? { ackRequirement: 'NOT_REQUIRED', ackUserId: '' } : {})
    }));
    setSearchQuery('');
    setIsDropdownOpen(false);
  };
  
  const handleClearDoc = () => {
    setFormData(prev => ({
      ...prev,
      docId: '',
      title: '',
      relatedStandards: [],
      otherStandardDetail: ''
    }));
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type !== 'application/pdf') {
      toast.error('รองรับเฉพาะไฟล์ PDF เท่านั้น');
      e.target.value = '';
      return;
    }
    setFormData(prev => ({ ...prev, file }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.docId) newErrors.docId = 'กรุณาเลือกเอกสารที่ต้องการแก้ไข';
    if (!formData.title) newErrors.title = 'กรุณาระบุชื่อเอกสารใหม่ (หรือใช้ชื่อเดิม)';
    if (!formData.changeSummary) newErrors.changeSummary = 'กรุณาสรุปการเปลี่ยนแปลง';
    if (!formData.changeReason) newErrors.changeReason = 'กรุณาเลือกเหตุผลที่แก้ไข';
    if (formData.changeReason === 'OTHER' && !formData.otherReason) newErrors.otherReason = 'กรุณาระบุเหตุผลอื่นๆ';

    if (formData.relatedStandards?.includes('อื่น ๆ (Others)') && !formData.otherStandardDetail?.trim()) {
      newErrors.otherStandardDetail = 'กรุณาระบุมาตรฐานอื่นๆ';
    }

    if (formData.ackRequirement === 'REQUIRED' && !formData.ackUserId) {
      newErrors.ackUserId = 'กรุณาเลือกผู้รับ Acknowledgement 1 คน';
    }
    
    if (!formData.effectiveDate) {
      newErrors.effectiveDate = 'กรุณาระบุวันที่มีผลบังคับใช้';
    } else {
      const today = new Date(simulatedDate || Date.now());
      today.setHours(0,0,0,0);
      const selected = new Date(formData.effectiveDate);
      if (selected < today) newErrors.effectiveDate = 'ห้ามเลือกวันย้อนหลัง (นับจาก Simulated Date)';
    }
    
    if (!formData.file) newErrors.file = 'กรุณาแนบไฟล์ PDF ฉบับแก้ไข';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDraft = () => {
    const draftPayload = {
      id: targetDraftId || formData.id,
      dar_no: formData.darNo || formData.id,
      type: 'REVISION',
      status: 'DRAFT',
      title: formData.title || (selectedDoc ? selectedDoc.name : 'Untitled Draft'),
      requesterId: currentUser?.id,
      requester_id: currentUser?.id,
      requester_name: currentUser?.name,
      department: currentUser?.department || formData.department,
      date: formData.date || new Date().toISOString().split('T')[0],
      docIdRef: formData.docId,
      doc_id: formData.docId,
      targetDocumentId: formData.docId,
      document_code: selectedDoc?.title || formData.docCode || formData.docId,
      changeSummary: formData.changeSummary,
      change_summary: formData.changeSummary,
      reasonDetails: formData.changeSummary,
      changeReason: formData.changeReason,
      change_reason: formData.changeReason,
      reasonCategory: formData.changeReason,
      otherReason: formData.changeReason === 'OTHER' ? formData.otherReason : undefined,
      ackRequirement: formData.ackRequirement,
      requireAck: formData.ackRequirement === 'REQUIRED',
      ackUserIds: formData.ackRequirement === 'REQUIRED' ? (formData.ackUserId ? [formData.ackUserId] : []) : [],
      ackUserId: formData.ackUserId,
      distributions: formData.distributions || [],
      effectiveDate: formData.effectiveDate,
      effective_date: formData.effectiveDate,
      relatedStandards: formData.relatedStandards || [],
      otherStandardDetail: formData.otherStandardDetail,
      access_control: formData.access_control,
      accessScope: formData.access_control?.scope || formData.accessScope || 'GENERAL',
      isDraft: true
    };

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
    const isValid = validate();
    if (isValid) {
      setShowConfirm(true);
    } else {
      console.error('DAR REVISION FORM VALIDATION FAILED:', formData);
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง');
    }
  };

  const executeSubmit = () => {
    const newDar = {
      type: 'REVISION',
      title: formData.title,
      requesterId: currentUser?.id,
      department: currentUser?.department || formData.department,
      date: new Date().toISOString().split('T')[0],
      docIdRef: formData.docId,
      targetDocumentId: formData.docId,
      changeSummary: formData.changeSummary,
      changeReason: formData.changeReason,
      otherReason: formData.changeReason === 'OTHER' ? formData.otherReason : undefined,
      ackRequirement: formData.ackRequirement,
      ackUserIds: formData.ackRequirement === 'REQUIRED' ? (formData.ackUserId ? [formData.ackUserId] : []) : [],
      distributions: formData.distributions || [],
      effectiveDate: formData.effectiveDate,
      relatedStandards: formData.relatedStandards || [],
      otherStandardDetail: formData.otherStandardDetail,
      access_control: formData.access_control,
      isDraft: false
    };
    if (targetDraftId && deleteDar) deleteDar(targetDraftId);
    addDar(newDar);
    setShowConfirm(false);
    toast.success('สร้างคำร้อง Revision สำเร็จ และส่งต่อให้ผู้ทบทวนแล้ว');
    navigate('/dashboard');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-2 w-full max-w-full h-auto min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
            <FileEdit size={22} strokeWidth={1.75}/>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1E1E1E] tracking-tight">ยื่นคำขอแก้ไขเอกสาร (Revision DAR)</h2>
            <p className="text-xs text-[#666666] mt-0.5">ปรับปรุงเอกสารที่มีผลบังคับใช้ พร้อมรัน Revision Number อัตโนมัติ</p>
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
                  <span>ชื่อผู้ร้องขอ (Requester):</span>
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

            <div className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 shrink-0">
              ขอแก้ไข (REVISION)
            </div>
          </div>

          {/* Section 2: เลือกเอกสารและกำหนดวันบังคับใช้ (4-Column Grid) */}
          <div className="p-5 space-y-3 bg-white">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-bold text-sm text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <Settings className="text-[#0D99FF]" size={16} />
                <span className="font-bold text-sm text-[#1E293B]">ส่วนที่ 2: เลือกเอกสารและกำหนดวันบังคับใช้</span>
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-start pt-1">
              
              {/* 1. เลือกเอกสารเดิม (4 Cols) */}
              <div className="lg:col-span-4">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  เลือกเอกสารเดิม (จากคลัง Active) <span className="text-[#EF4444]">*</span>
                </label>

                {lockedSourceError ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-700">
                    <p className="font-bold">{lockedSourceError}</p>
                  </div>
                ) : lockedSource ? (
                  <div className="h-10.5 px-3 bg-[#E5F4FF]/70 border border-indigo-200 rounded-lg text-xs font-mono font-bold text-[#007BE5] flex items-center justify-between truncate">
                    <span className="truncate">[{lockedSource.documentCode}] {lockedSource.documentTitle}</span>
                  </div>
                ) : selectedDoc ? (
                  <div className="h-10.5 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold text-[#0D99FF] text-xs bg-[#E5F4FF] px-2 py-0.5 rounded shrink-0">{selectedDoc.title}</span>
                      <span className="text-xs text-[#334155] truncate font-medium">{selectedDoc.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearDoc}
                      className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded cursor-pointer shrink-0"
                      title="เปลี่ยนเอกสาร"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={searchContainerRef}>
                    <div className="flex gap-2">
                      <select
                        value={docTypeFilter}
                        onChange={(e) => setDocTypeFilter(e.target.value)}
                        className="select-primary text-xs w-28 sm:w-44 h-10.5 px-2 bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] focus:outline-none focus:border-[#0D99FF]"
                      >
                        <option value="">ทุกประเภท</option>
                        {activeDocumentTypes.map(t => {
                          const code = t.code || t.id;
                          const name = t.nameTh || t.name;
                          return <option key={code} value={code}>{name} ({code})</option>;
                        })}
                      </select>
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={15} />
                        <input
                          type="text"
                          placeholder="ค้นหารหัส หรือชื่อ..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsDropdownOpen(true);
                          }}
                          onFocus={() => setIsDropdownOpen(true)}
                          className={`w-full pl-9 pr-7 h-10.5 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all ${errors.docId ? 'border-rose-400 bg-rose-50/50' : ''}`}
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 border border-[#E2E8F0] rounded-xl max-h-52 overflow-y-auto divide-y divide-slate-100 shadow-xl bg-white z-30">
                        {filteredDocs.length > 0 ? (
                          filteredDocs.map(doc => (
                            <div
                              key={doc.id}
                              onClick={() => handleDocSelect(doc)}
                              className="p-3 hover:bg-[#E5F4FF]/50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-[#0D99FF]">{doc.title}</span>
                                  <span className="text-slate-400 font-mono text-[10px]">Rev.{doc.rev}</span>
                                </div>
                                <p className="text-[#334155] font-medium truncate mt-0.5">{doc.name}</p>
                              </div>
                              <span className="text-[10px] font-bold text-[#64748B] font-mono shrink-0">{doc.department}</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-slate-400 text-xs">
                            ไม่พบเอกสารที่มีผลบังคับใช้
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {errors.docId && <p className="text-rose-500 text-xs mt-1">{errors.docId}</p>}
              </div>

              {/* 2. ชื่อเอกสาร (แก้ไข) (4 Cols) */}
              <div className="lg:col-span-4">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  ชื่อเอกสาร (แก้ไข) <span className="text-[#EF4444]">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="ระบุชื่อเอกสาร (สามารถใช้ชื่อเดิมได้)..."
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))}
                  className={`w-full h-10.5 px-3.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all ${errors.title ? 'border-rose-400 bg-rose-50/50' : ''}`}
                />
                {errors.title && <p className="text-rose-500 text-xs mt-1">{errors.title}</p>}
              </div>

              {/* 3. วันที่มีผลบังคับใช้ใหม่ (2 Cols) */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  วันที่มีผลบังคับใช้ <span className="text-[#EF4444]">*</span>
                </label>
                <input 
                  type="date"
                  value={formData.effectiveDate}
                  min={new Date(simulatedDate || Date.now()).toISOString().split('T')[0]}
                  onChange={(e) => setFormData(prev => ({...prev, effectiveDate: e.target.value}))}
                  className={`w-full h-10.5 px-3 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all font-mono ${errors.effectiveDate ? 'border-rose-400 bg-rose-50/50' : ''}`}
                />
                {errors.effectiveDate && <p className="text-rose-500 text-xs mt-1">{errors.effectiveDate}</p>}
              </div>

              {/* 4. ฉบับที่ปรับปรุง (Revision) (2 Cols) */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  ฉบับปรับปรุง (Revision)
                </label>
                <div className="h-10.5 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-mono font-bold text-[#0D99FF] flex items-center justify-between select-none">
                  <span className="text-slate-500">Rev.{selectedDoc?.rev || '00'}</span>
                  <span className="text-slate-400 font-sans">➔</span>
                  <span className="text-emerald-600 font-bold">Rev.{calculateNextRev(selectedDoc?.rev || '00')}</span>
                </div>
              </div>

            </div>
          </div>

          {/* Section 3: รายละเอียดการขอแก้ไขและเอกสารแนบ (50/50 Symmetrical Equal-Height Grid) */}
          <div className="p-5 space-y-4 bg-white">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-bold text-sm text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <FileText className="text-[#0D99FF]" size={16} />
                <span className="font-bold text-sm text-[#1E293B]">ส่วนที่ 3: รายละเอียดการขอแก้ไขเอกสารและเอกสารแนบ</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              
              {/* ================= ฝั่งซ้าย (50%): เหตุผล & สรุปการเปลี่ยนแปลง ================= */}
              <div className="flex flex-col justify-between space-y-4 h-full">
                
                {/* 1. เหตุผลการขอแก้ไข */}
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    เหตุผลการขอแก้ไข (Reason for Change) <span className="text-[#EF4444]">*</span>
                  </label>
                  <select
                    value={formData.changeReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, changeReason: e.target.value }))}
                    className={`w-full h-10.5 px-3.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all ${errors.changeReason ? 'border-rose-400 bg-rose-50/50' : ''}`}
                  >
                    <option value="">-- เลือกเหตุผลการแก้ไข --</option>
                    <option value="PROCESS_CHANGE">การปรับเปลี่ยนกระบวนการปฏิบัติงาน (Process Change)</option>
                    <option value="EQUIPMENT_CHANGE">การเปลี่ยนแปลงเครื่องจักรหรืออุปกรณ์ (Equipment Change)</option>
                    <option value="AUDIT_FINDING">ข้อเสนอแนะจากการตรวจประเมิน / CAPA (Audit Finding)</option>
                    <option value="PERIODIC_REVIEW">การทบทวนตามรอบระยะเวลา (Periodic Review)</option>
                    <option value="OTHER">อื่น ๆ (Other)</option>
                  </select>
                  {errors.changeReason && <p className="text-rose-500 text-xs mt-1">{errors.changeReason}</p>}

                  {formData.changeReason === 'OTHER' && (
                    <div className="mt-2.5">
                      <input
                        type="text"
                        value={formData.otherReason}
                        onChange={(e) => setFormData(prev => ({ ...prev, otherReason: e.target.value }))}
                        className={`w-full h-10 px-3.5 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] ${errors.otherReason ? 'border-rose-400 bg-rose-50/50' : ''}`}
                        placeholder="ระบุเหตุผลความจำเป็น..."
                      />
                      {errors.otherReason && <p className="text-rose-500 text-xs mt-1">{errors.otherReason}</p>}
                    </div>
                  )}
                </div>

                {/* 2. สรุปรายละเอียดการเปลี่ยนแปลง */}
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    สรุปรายละเอียดการเปลี่ยนแปลง (Change Summary) <span className="text-[#EF4444]">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={formData.changeSummary}
                    onChange={(e) => setFormData(prev => ({ ...prev, changeSummary: e.target.value }))}
                    className={`w-full flex-1 min-h-[100px] lg:min-h-[125px] p-3.5 text-sm bg-white border border-[#CBD5E1] rounded-xl text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all leading-relaxed resize-none ${errors.changeSummary ? 'border-rose-400 bg-rose-50/50' : ''}`}
                    placeholder="ระบุข้อความ หัวข้อ หรือขั้นตอนที่ทำการแก้ไข..."
                  />
                  {errors.changeSummary && <p className="text-rose-500 text-xs mt-1">{errors.changeSummary}</p>}
                </div>

              </div>

              {/* ================= ฝั่งขวา (50%): Standards, Upload & Ack Protocol ================= */}
              <div className="flex flex-col justify-between space-y-4 bg-[#F8FAFC] border border-[#E2E8F0] p-4.5 rounded-xl h-full">
                
                {/* 1. ระบบมาตรฐานที่เกี่ยวข้อง */}
                <div>
                  <RelatedStandardsSelector
                    value={{
                      relatedStandards: formData.relatedStandards,
                      otherStandardDetail: formData.otherStandardDetail
                    }}
                    onChange={(newVals) => setFormData(prev => ({ ...prev, ...newVals }))}
                    error={errors.otherStandardDetail}
                  />
                </div>

                {/* 2. อัปโหลดไฟล์เอกสารฉบับแก้ไข (Compact Dropzone) */}
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    อัปโหลดไฟล์เอกสารฉบับแก้ไข (PDF เท่านั้น) <span className="text-[#EF4444]">*</span>
                  </label>
                  <div 
                    onClick={() => {
                      const fileInput = document.getElementById('dar-revision-pdf-input');
                      if (fileInput) fileInput.click();
                    }}
                    className="h-20 border-2 border-dashed border-[#CBD5E1] hover:border-[#0D99FF] rounded-xl p-3 flex items-center justify-center gap-3 bg-white hover:bg-[#F0F7FF]/40 transition-all cursor-pointer group"
                  >
                    <div className="p-2 bg-[#F1F5F9] group-hover:bg-[#E5F4FF] rounded-lg text-[#0D99FF] transition-colors shrink-0">
                      <UploadCloud size={20} />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#1E293B] truncate">
                        {formData.file ? formData.file.name : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง'}
                      </p>
                      <p className="text-[10px] text-[#94A3B8]">รองรับไฟล์ PDF สูงสุด 25 MB</p>
                    </div>
                    <input 
                      id="dar-revision-pdf-input"
                      type="file" 
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </div>
                  {errors.file && <p className="text-rose-500 text-xs mt-1.5">{errors.file}</p>}
                </div>

                {/* 3. การรับทราบเอกสาร */}
                <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-[#334155]">
                      การรับทราบเอกสาร <span className="text-[#EF4444]">*</span>
                    </label>
                    {selectedDoc && selectedDoc.title && selectedDoc.title.startsWith('FM') ? (
                      <div className="flex items-center gap-1.5 text-indigo-900 bg-[#E5F4FF]/70 px-2.5 py-1 rounded-md text-xs font-medium border border-indigo-100">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-[#0D99FF]" />
                        <span>แบบฟอร์ม (FM): ไม่ต้องรับทราบ</span>
                      </div>
                    ) : (
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
                    )}
                  </div>

                  {formData.ackRequirement === 'REQUIRED' && !(selectedDoc && selectedDoc.title && selectedDoc.title.startsWith('FM')) && (
                    <div className={`p-3 rounded-lg border ${errors.ackUserId ? 'border-rose-300 bg-rose-50' : 'border-indigo-100 bg-white'}`}>
                      <p className="text-xs font-semibold text-[#334155] mb-1.5">เลือกผู้ที่ต้องรับทราบเอกสารนี้ (1 คน)</p>
                      <UserSelector 
                        value={formData.ackUserId} 
                        onChange={(id) => setFormData(prev => ({...prev, ackUserId: id}))} 
                        error={errors.ackUserId} 
                        users={masterUsers.filter(u => u.id !== currentUser.id && !u.isDcc && u.role !== 'DCC_ADMIN')} 
                      />
                      {errors.ackUserId && <p className="text-rose-500 text-xs mt-1">{errors.ackUserId}</p>}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>

        </div>

        {/* Document Access Scope & Confidentiality */}
        <DocumentAccessControlSelector
          value={formData.access_control}
          onChange={(access_control) => setFormData(prev => ({ ...prev, access_control }))}
          ownerDept={selectedDoc?.department || currentUser.department}
          masterDepartments={useStore.getState().masterDepartments || useStore.getState().departments}
          masterUsers={masterUsers}
        />

        {/* Distribution Setup */}
        <DistributionSetup 
          ownerDept={currentUser.department}
          distributions={formData.distributions}
          oldDistributions={selectedDoc?.distributions || []}
          onChange={(distributions) => setFormData(prev => ({ ...prev, distributions }))}
          documentType={selectedDoc?.title ? selectedDoc.title.split('-')[0] : 'WI'}
          accessControl={formData.access_control}
          accessScope={formData.access_control?.scope}
        />

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
            variant="primary"
            type="submit" 
            onClick={handleFormSubmit}
          >
            ส่งคำขอ Revision (Submit DAR)
          </Button>
        </div>
      </form>

      {(() => {
        const resolvedRevId = formData.manualReviewerId
          ? formData.manualReviewerId
          : (resolveReviewer(currentUser.id, currentUser.department, masterUsers, reviewUsers || masterUsers)?.id);
        const resolvedReviewerObj = (masterUsers || []).find(u => u.id === resolvedRevId);

        return (
          <ActionConfirmModal
            isOpen={showConfirm}
            onClose={() => setShowConfirm(false)}
            onConfirm={executeSubmit}
            title="ยืนยันการส่งคำร้องขอแก้ไขเอกสาร (Revision DAR)"
            actionType="submit"
            confirmText="ยืนยันการส่งคำร้องขอแก้ไข"
            cancelText="ยกเลิก / กลับไปแก้ไข"
            summaryData={[
              {
                label: 'ผู้ร้องขอ / แผนก',
                value: (
                  <span className="font-medium text-slate-800">
                    {currentUser.name} ({currentUser.department})
                  </span>
                )
              },
              {
                label: 'รหัสเอกสาร',
                value: (
                  <span className="font-mono font-bold text-[#0D99FF] bg-[#E5F4FF] px-2.5 py-0.5 rounded-md border border-indigo-100">
                    {selectedDoc?.title || formData.docId}
                  </span>
                )
              },
              {
                label: 'การเปลี่ยนแปลงฉบับ',
                value: (
                  <div className="flex items-center gap-2 font-mono text-sm font-bold">
                    <span className="bg-[#F5F5F5] text-slate-600 px-2 py-0.5 rounded border border-[#E5E5E5]">
                      Rev. {selectedDoc?.rev || '00'}
                    </span>
                    <span className="text-slate-400">➔</span>
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                      Rev. {calculateNextRev(selectedDoc?.rev)}
                    </span>
                  </div>
                )
              },
              {
                label: 'ชื่อเอกสารฉบับใหม่',
                value: (
                  <span className="text-sm sm:text-[15px] font-bold text-[#1E1E1E] leading-relaxed">
                    {formData.title || selectedDoc?.name}
                  </span>
                )
              },
              {
                label: 'รายละเอียดและสรุปการแก้ไข',
                value: (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-[#F5F5F5] p-3 rounded-xl border border-[#E5E5E5]/70">
                    {formData.changeSummary}
                  </div>
                )
              },
              {
                label: 'เหตุผลการร้องขอแก้ไข',
                value: (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-[#F5F5F5] p-3 rounded-xl border border-[#E5E5E5]/70">
                    {formData.changeReason === 'OTHER' ? `อื่นๆ: ${formData.otherReason || '-'}` : (formData.changeReason || '-')}
                  </div>
                )
              },
              {
                label: 'มาตรฐานที่เกี่ยวข้อง',
                value: (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {(formData.relatedStandards || []).length > 0 ? (
                      formData.relatedStandards.map((std, idx) => (
                        <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F5F5F5] text-slate-700 border border-[#E5E5E5]">
                          {std === 'อื่น ๆ (Others)' ? `อื่นๆ: ${formData.otherStandardDetail || '-'}` : std}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">ไม่ได้ระบุ</span>
                    )}
                  </div>
                )
              },
              {
                label: 'วันที่มีผลบังคับใช้ฉบับใหม่',
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

export default DarRevisionForm;
