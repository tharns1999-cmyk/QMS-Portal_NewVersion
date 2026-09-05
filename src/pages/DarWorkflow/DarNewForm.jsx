import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';
import { 
  Upload, 
  FileText, 
  User, 
  Calendar, 
  Settings, 
  X, 
  ShieldAlert, 
  ChevronLeft, 
  ShieldCheck, 
  Building2, 
  UploadCloud, 
  CheckCircle2 
} from 'lucide-react';
import UserSelector from '../../components/UserSelector';
import DistributionSetup from '../../components/workflow/DistributionSetup';
import FormDistributionSetup from '../../components/workflow/FormDistributionSetup';
import RelatedStandardsSelector from '../../components/workflow/RelatedStandardsSelector';
import DocumentAccessControlSelector from '../../components/workflow/DocumentAccessControlSelector';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';
import Button from '../../components/ui/Button';
import { resolveReviewer, resolveApprover } from '../../utils/workflowResolver';
import { 
  calculateCopyAllocations, 
  formatDocumentRunningNumber, 
  calculateNextDocumentSequence 
} from '../../services/MasterDataService';
import { ACCESS_SCOPE_METADATA } from '../../utils/accessControl';
import { normalizeDraftToFormState } from '../../utils/draftNormalizer';

const DarNewForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();

  const targetDraftId = searchParams.get('draftId') || params?.draftId || params?.id || location.state?.draftId;
  const { currentUser, addDar, saveDarDraft, deleteDar, dars, darRequests, documents, masterUsers, reviewUsers, approveUsers, documentTypes, simulatedDate } = useStore();
  
  const activeDocumentTypes = (documentTypes || []).filter(t => (t.status === 'ACTIVE' || t.status === 'Active' || t.isActive !== false) && t.allowDar !== false && t.category !== 'EXTERNAL' && t.code !== 'ED' && t.id !== 'ED');

  const initialFormState = {
    docType: '',
    docIdInput: '',
    title: '',
    requestDetail: '',
    requestReason: '',
    ackRequirement: 'NOT_REQUIRED',
    ackUserId: '',
    distributions: [],
    effectiveDate: '',
    file: null,
    manualReviewerId: '',
    manualApproverId: '',
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

  // Universal Hydration Lifecycle: ดึงข้อมูลแบบร่างกลับมาหยอดลงฟอร์มทันทีที่เปิดหน้า
  useEffect(() => {
    if (targetDraftId || location.state?.draftData) {
      const allDarsList = dars || darRequests || [];
      const draft = location.state?.draftData || allDarsList.find(d => (d.id === targetDraftId || d.dar_no === targetDraftId || d.darNo === targetDraftId) && (d.status === 'DRAFT' || d.isDraft));
      if (draft) {
        const hydrated = normalizeDraftToFormState(draft, initialFormState);
        setFormData(hydrated);
      }
    }
  }, [targetDraftId, dars, darRequests, currentUser?.department, location.state]);

  const prevScopeRef = React.useRef(formData.access_control?.scope || 'GENERAL');

  // ตรวจสอบว่าเป็นเอกสารประเภท FM หรือไม่
  const isFormDocument = formData.docType === 'FM' || formData.doc_type === 'FM';

  // อัปเดตขอบเขตการแจกจ่ายแบบฟอร์มเมื่อ Access Scope และ Authorized Departments เปลี่ยนแปลง (Cascading Security)
  useEffect(() => {
    if (!isFormDocument) return;

    const currentScope = formData.access_control?.scope || formData.accessScope || 'GENERAL';
    const ownerDept = currentUser?.department || 'PD';
    const rawAuthDepts = formData.access_control?.authorized_depts || formData.authorizedDepartments || [];
    const authorizedDepts = Array.from(new Set([ownerDept, ...rawAuthDepts]));

    if (currentScope === 'TARGETED') {
      setFormData((prev) => {
        // กรองเอาเฉพาะแผนกที่ยังคงอยู่ใน Authorized List ด้านบน
        const currentDistDepts = prev.distributedDepartments || [];
        const validDistributedDepts = currentDistDepts.filter(
          (deptCode) => deptCode === ownerDept || rawAuthDepts.includes(deptCode)
        );
        const nextDistDepts = validDistributedDepts.length > 0 
          ? validDistributedDepts 
          : authorizedDepts;

        const nextPayload = nextDistDepts.map(dId => ({
          departmentId: dId,
          department: dId,
          dept: dId,
          dept_code: dId,
          target_department: dId,
          targetDepartment: dId,
          locationId: dId,
          locationName: `${dId} Department`,
          copyNo: '00',
          isForm: true
        }));

        return {
          ...prev,
          formDistributionMode: 'SPECIFIC_DEPTS',
          distributedDepartments: nextDistDepts,
          distributions: nextPayload
        };
      });
    } else if (currentScope === 'DEPT_ONLY') {
      const ownerPayload = [{
        departmentId: ownerDept,
        department: ownerDept,
        dept: ownerDept,
        dept_code: ownerDept,
        target_department: ownerDept,
        targetDepartment: ownerDept,
        locationId: ownerDept,
        locationName: `${ownerDept} Department`,
        copyNo: '00',
        isForm: true
      }];
      setFormData((prev) => ({
        ...prev,
        formDistributionMode: 'SPECIFIC_DEPTS',
        distributedDepartments: [ownerDept],
        distributions: ownerPayload
      }));
    } else if (currentScope === 'RESTRICTED') {
      const ownerPayload = [{
        departmentId: ownerDept,
        department: ownerDept,
        dept: ownerDept,
        dept_code: ownerDept,
        target_department: ownerDept,
        targetDepartment: ownerDept,
        locationId: ownerDept,
        locationName: `${ownerDept} Department`,
        copyNo: '00',
        isForm: true
      }];
      setFormData((prev) => ({
        ...prev,
        formDistributionMode: 'RESTRICTED_USERS',
        distributedDepartments: [ownerDept],
        distributions: ownerPayload
      }));
    } else if (currentScope === 'GENERAL' && prevScopeRef.current !== 'GENERAL') {
      // เมื่อสลับกลับเป็น GENERAL ให้คืนค่าเริ่มต้นเป็นทุกแผนก
      setFormData((prev) => ({
        ...prev,
        formDistributionMode: 'ALL_DEPTS',
        distributedDepartments: [],
        distributions: []
      }));
    }
    prevScopeRef.current = currentScope;
  }, [
    formData.access_control?.scope, 
    JSON.stringify(formData.access_control?.authorized_depts), 
    formData.accessScope, 
    JSON.stringify(formData.authorizedDepartments), 
    formData.docType, 
    currentUser?.department
  ]);

  // Auto-calculated Workflow Participants for Auto-Whitelisting
  const workflowParticipants = useMemo(() => {
    const list = [];
    if (currentUser) {
      list.push({
        id: currentUser.id,
        empId: currentUser.empId,
        name: currentUser.name,
        department: currentUser.department || currentUser.dept || 'QMS',
        role: 'REQUESTER',
        roleTitle: 'ผู้จัดทำ (Requester)'
      });
    }
    const resolvedRevId = formData.manualReviewerId
      ? formData.manualReviewerId
      : (resolveReviewer(currentUser?.id, currentUser?.department || 'PD', masterUsers || [], reviewUsers || masterUsers || [])?.id);
    if (resolvedRevId && resolvedRevId !== currentUser?.id) {
      const revUser = (masterUsers || []).find(u => u && u.id === resolvedRevId);
      if (revUser) {
        list.push({
          id: revUser.id,
          empId: revUser.empId,
          name: revUser.name,
          department: revUser.primary_department || revUser.department || revUser.dept,
          role: 'REVIEWER',
          roleTitle: 'ผู้ทบทวน (Reviewer)'
        });
      }
    }
    const resolvedAppId = formData.manualApproverId
      ? formData.manualApproverId
      : (resolveApprover(currentUser?.id, resolvedRevId, currentUser?.department || 'PD', masterUsers || [], approveUsers || masterUsers || [])?.id);
    if (resolvedAppId && resolvedAppId !== currentUser?.id && resolvedAppId !== resolvedRevId) {
      const appUser = (masterUsers || []).find(u => u && u.id === resolvedAppId);
      if (appUser) {
        list.push({
          id: appUser.id,
          empId: appUser.empId,
          name: appUser.name,
          department: appUser.primary_department || appUser.department || appUser.dept,
          role: 'APPROVER',
          roleTitle: 'ผู้อนุมัติ (Approver)'
        });
      }
    }
    return list;
  }, [currentUser, formData.manualReviewerId, formData.manualApproverId, masterUsers, reviewUsers, approveUsers]);

  const getPreviewCode = () => {
    if (!formData.docType) return '[กรุณาเลือกชนิดเอกสารเพื่อสร้างรหัส]';
    const dept = currentUser.department || 'PD';
    const selectedTypeObj = (documentTypes || []).find(t => (t.code || t.id) === formData.docType);
    const pattern = selectedTypeObj?.namingPattern || `${formData.docType}-{Dept}-{###}`;
    const nextSeq = calculateNextDocumentSequence(formData.docType, dept, documents, dars);
    const seqFormatted = formatDocumentRunningNumber(nextSeq);
    
    if (pattern.includes('{Type}') || pattern.includes('{Dept}') || pattern.includes('{###}') || pattern.includes('{##}')) {
      return pattern
        .replace('{Type}', formData.docType)
        .replace('{Dept}', dept)
        .replace('{###}', seqFormatted)
        .replace('{##}', seqFormatted);
    }
    return `${formData.docType}-${dept}-${seqFormatted}`;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type !== 'application/pdf') {
      toast.error('รองรับเฉพาะไฟล์ PDF เท่านั้น');
      e.target.value = '';
      return;
    }
    setFormData({ ...formData, file });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.docType) newErrors.docType = 'กรุณาเลือกชนิดเอกสาร';
    if (!formData.title) newErrors.title = 'กรุณาระบุชื่อเอกสาร';
    if (!formData.requestDetail) newErrors.requestDetail = 'กรุณาระบุรายละเอียดคำร้องขอ';
    if (!formData.requestReason) newErrors.requestReason = 'กรุณาระบุเหตุผลที่ร้องขอ';
    
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
    
    if (!formData.file) newErrors.file = 'กรุณาแนบไฟล์ PDF';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDraft = () => {
    const draftPayload = {
      id: targetDraftId || formData.id,
      dar_no: formData.darNo || formData.id,
      type: 'NEW',
      status: 'DRAFT',
      title: formData.title || 'Untitled Draft',
      requesterId: currentUser?.id,
      requester_id: currentUser?.id,
      requester_name: currentUser?.name,
      department: currentUser?.department || formData.department,
      date: formData.date || new Date().toISOString().split('T')[0],
      docType: formData.docType,
      docIdInput: formData.docIdInput || getPreviewCode(),
      document_code: formData.docCode || formData.docIdInput,
      requestDetail: formData.requestDetail,
      request_detail: formData.requestDetail,
      reasonDetails: formData.requestDetail,
      requestReason: formData.requestReason,
      request_reason: formData.requestReason,
      reasonCategory: formData.requestReason,
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
    e.preventDefault();
    if (validate()) {
      setShowConfirm(true);
    } else {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง');
    }
  };

  const executeSubmit = () => {
    const newDar = {
      type: 'NEW',
      title: formData.title,
      requesterId: currentUser?.id,
      department: currentUser?.department || formData.department,
      date: new Date().toISOString().split('T')[0],
      docType: formData.docType,
      docIdInput: getPreviewCode(),
      document_code: formData.docCode || getPreviewCode(),
      requestDetail: formData.requestDetail,
      requestReason: formData.requestReason,
      ackRequirement: formData.ackRequirement,
      ackUserIds: formData.ackRequirement === 'REQUIRED' ? (formData.ackUserId ? [formData.ackUserId] : []) : [],
      distributions: formData.distributions || [],
      effectiveDate: formData.effectiveDate,
      isDraft: false,
      manualReviewerId: formData.manualReviewerId,
      manualApproverId: formData.manualApproverId,
      relatedStandards: formData.relatedStandards || [],
      otherStandardDetail: formData.otherStandardDetail,
      access_control: formData.access_control
    };
    if (targetDraftId && deleteDar) deleteDar(targetDraftId);
    addDar(newDar);
    setShowConfirm(false);
    toast.success('สร้างคำร้องสำเร็จ และส่งต่อให้ผู้ทบทวนแล้ว');
    navigate('/dashboard');
  };

  // Get available candidates for Dev Test UI
  const availableReviewers = (useStore.getState().reviewUsers || masterUsers || []).filter(u => u && (!u.depts || u.depts.length === 0 || u.depts.includes(currentUser?.department)) && u.id !== currentUser?.id);
  const availableApprovers = (useStore.getState().approveUsers || masterUsers || []).filter(u => u && (!u.depts || u.depts.length === 0 || u.depts.includes(currentUser?.department)) && u.id !== currentUser?.id && u.id !== formData.manualReviewerId);

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-2 w-full max-w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E5F4FF] text-[#0D99FF] flex items-center justify-center shadow-xs">
            <FileText size={22} strokeWidth={1.75}/>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1E1E1E] tracking-tight">ยื่นคำร้องสร้างเอกสารใหม่ (New Document DAR)</h2>
            <p className="text-xs text-[#666666] mt-0.5">ออกรหัสเอกสารฉบับใหม่และกำหนดสายการอนุมัติตามมาตรฐาน ISO 9001</p>
          </div>
        </div>
        <button onClick={() => navigate('/dar/new')} className="flex items-center text-xs font-bold text-slate-600 hover:text-[#0D99FF] transition-colors cursor-pointer">
          <ChevronLeft size={16} /> เปลี่ยนประเภท DAR
        </button>
      </div>
      
      <form onSubmit={handleFormSubmit} className="space-y-4">
        
        {/* ================= UNIFIED HIGH-DENSITY FORM CANVAS ================= */}
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

              <div className="flex items-center gap-1.5">
                <label className="text-sm font-semibold text-[#64748B] flex items-center gap-1.5 cursor-default">
                  <span>แผนกต้นทาง (Department):</span>
                  <span className="px-2 py-0.5 rounded bg-white border border-[#CBD5E1] font-mono font-bold text-[#0D99FF] text-xs">
                    {currentUser?.department || 'PD'}
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-sm font-semibold text-[#64748B] flex items-center gap-1.5 cursor-default">
                  <span>วันที่เปิดคำขอ (Request Date):</span>
                  <span className="font-mono text-[#334155] font-semibold text-xs">
                    {new Date().toLocaleDateString('th-TH')}
                  </span>
                </label>
              </div>
            </div>

            <div className="text-[11px] font-semibold text-[#0D99FF] bg-[#E5F4FF] px-2.5 py-0.5 rounded-full border border-[#B8E1FF] shrink-0">
              ร่างคำร้อง DAR ใหม่
            </div>
          </div>

          {/* Section 2: กำหนดรหัสและประเภทเอกสาร และวันที่มีผลบังคับใช้ (4-Column Grid) */}
          <div className="p-5 space-y-3 bg-white">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-bold text-sm text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <Settings className="text-[#0D99FF]" size={16} />
                <span className="font-bold text-sm text-[#1E293B]">ส่วนที่ 2: กำหนดรหัสและประเภทเอกสาร และวันที่มีผลบังคับใช้</span>
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-start pt-1">
              {/* 1. ชนิดเอกสาร (3 Cols) */}
              <div className="lg:col-span-3">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  ชนิดเอกสาร <span className="text-[#EF4444]">*</span>
                </label>
                <select 
                  value={formData.docType}
                  onChange={(e) => {
                    const val = e.target.value;
                    const typeObj = (documentTypes || []).find(t => (t.code || t.id) === val);
                    setFormData({
                      ...formData, 
                      docType: val,
                      ...(typeObj?.is_form_type || val === 'FM' ? { ackRequirement: 'NOT_REQUIRED', ackUserId: '' } : {})
                    });
                  }}
                  className={`w-full h-10.5 px-3.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all cursor-pointer ${errors.docType ? 'border-rose-400 bg-rose-50/50' : ''}`}
                >
                  <option value="">-- เลือกชนิดเอกสาร --</option>
                  {activeDocumentTypes.length > 0 ? (
                    activeDocumentTypes.map(t => {
                      const code = t.code || t.id;
                      const name = t.nameTh || t.name;
                      return <option key={code} value={code}>{name} ({code})</option>;
                    })
                  ) : (
                    <option value="" disabled>-- ไม่พบข้อมูลประเภทเอกสาร (กรุณาตั้งค่าใน Master Data) --</option>
                  )}
                </select>
                {errors.docType && <p className="text-rose-500 text-xs mt-1">{errors.docType}</p>}
              </div>

              {/* 2. ชื่อเอกสาร (4 Cols) */}
              <div className="lg:col-span-4">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  ชื่อเอกสาร (ไทย / อังกฤษ) <span className="text-[#EF4444]">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="ระบุชื่อเอกสารภาษาไทย หรืออังกฤษ..."
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className={`w-full h-10.5 px-3.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all ${errors.title ? 'border-rose-400 bg-rose-50/50' : ''}`}
                />
                {errors.title && <p className="text-rose-500 text-xs mt-1">{errors.title}</p>}
              </div>

              {/* 3. วันที่มีผลบังคับใช้ (3 Cols) */}
              <div className="lg:col-span-3">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  วันที่มีผลบังคับใช้ (Effective Date) <span className="text-[#EF4444]">*</span>
                </label>
                <input 
                  type="date"
                  value={formData.effectiveDate}
                  min={new Date(simulatedDate || Date.now()).toISOString().split('T')[0]}
                  onChange={(e) => setFormData({...formData, effectiveDate: e.target.value})}
                  className={`w-full h-10.5 px-3.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all font-mono ${errors.effectiveDate ? 'border-rose-400 bg-rose-50/50' : ''}`}
                />
                {errors.effectiveDate && <p className="text-rose-500 text-xs mt-1">{errors.effectiveDate}</p>}
              </div>

              {/* 4. รหัสเอกสารอัตโนมัติ (2 Cols) */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  รหัสเอกสารอัตโนมัติ
                </label>
                <div className="h-10.5 px-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm font-mono font-bold text-[#0D99FF] flex items-center justify-between select-none">
                  <span className="truncate">{getPreviewCode()}</span>
                  <span className="text-[10px] text-[#64748B] font-sans font-normal shrink-0">Rev. 00</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: รายละเอียดคำร้องและข้อกำหนด (50/50 Symmetrical Equal-Height Grid) */}
          <div className="p-5 space-y-4 bg-white">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-bold text-sm text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <FileText className="text-[#0D99FF]" size={16} />
                <span className="font-bold text-sm text-[#1E293B]">ส่วนที่ 3: รายละเอียดคำร้องและเอกสารแนบ</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              
              {/* ================= ฝั่งซ้าย (50%): Textareas ================= */}
              <div className="flex flex-col justify-between space-y-4 h-full">
                {/* 1. วัตถุประสงค์และขอบเขตคำร้องขอ */}
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    วัตถุประสงค์และขอบเขตคำร้องขอ (รายละเอียดคำร้องขอ) <span className="text-[#EF4444]">*</span>
                  </label>
                  <textarea 
                    rows={5}
                    value={formData.requestDetail}
                    onChange={(e) => setFormData({...formData, requestDetail: e.target.value})}
                    className={`w-full flex-1 min-h-[100px] lg:min-h-[125px] p-3.5 text-sm bg-white border border-[#CBD5E1] rounded-xl text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all leading-relaxed resize-none ${errors.requestDetail ? 'border-rose-400 bg-rose-50/50' : ''}`}
                    placeholder="ระบุขอบเขตและเนื้อหาสำคัญของเอกสารฉบับนี้..."
                  />
                  {errors.requestDetail && <p className="text-rose-500 text-xs mt-1">{errors.requestDetail}</p>}
                </div>

                {/* 2. เหตุผลความจำเป็นในการร้องขอ */}
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    เหตุผลความจำเป็นในการร้องขอ <span className="text-[#EF4444]">*</span>
                  </label>
                  <textarea 
                    rows={5}
                    value={formData.requestReason}
                    onChange={(e) => setFormData({...formData, requestReason: e.target.value})}
                    className={`w-full flex-1 min-h-[100px] lg:min-h-[125px] p-3.5 text-sm bg-white border border-[#CBD5E1] rounded-xl text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all leading-relaxed resize-none ${errors.requestReason ? 'border-rose-400 bg-rose-50/50' : ''}`}
                    placeholder="ระบุเหตุผลความจำเป็นในการจัดทำ หรือการอ้างอิงข้อกำหนด ISO..."
                  />
                  {errors.requestReason && <p className="text-rose-500 text-xs mt-1">{errors.requestReason}</p>}
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
                    onChange={(newVals) => setFormData({ ...formData, ...newVals })}
                    error={errors.otherStandardDetail}
                  />
                </div>

                {/* 2. อัปโหลดไฟล์เอกสาร (Compact Dropzone) */}
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    อัปโหลดไฟล์เอกสาร (PDF เท่านั้น) <span className="text-[#EF4444]">*</span>
                  </label>
                  <div 
                    onClick={() => {
                      const fileInput = document.getElementById('dar-pdf-file-input');
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
                      id="dar-pdf-file-input"
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
                    {formData.docType === 'FM' ? (
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
                            onChange={(e) => setFormData({...formData, ackRequirement: e.target.value, ackUserId: ''})} 
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
                            onChange={(e) => setFormData({...formData, ackRequirement: e.target.value})} 
                            className="w-4 h-4 text-[#0D99FF] focus:ring-[#0D99FF]" 
                          />
                          <span>ต้องรับทราบ</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {formData.ackRequirement === 'REQUIRED' && formData.docType !== 'FM' && (
                    <div className={`p-3 rounded-lg border ${errors.ackUserId ? 'border-rose-300 bg-rose-50' : 'border-indigo-100 bg-white'}`}>
                      <p className="text-xs font-semibold text-[#334155] mb-1.5">เลือกผู้ที่ต้องรับทราบเอกสารนี้ (1 คน)</p>
                      <UserSelector 
                        value={formData.ackUserId} 
                        onChange={(id) => setFormData({...formData, ackUserId: id})} 
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

        </div>

        {/* Section: ระดับการเข้าถึงและความลับของเอกสาร */}
        <DocumentAccessControlSelector
          value={formData.access_control}
          onChange={(access_control) => setFormData({ ...formData, access_control })}
          ownerDept={currentUser?.department || 'PD'}
          masterDepartments={useStore.getState().masterDepartments || useStore.getState().departments || []}
          masterUsers={masterUsers || []}
          workflowParticipants={workflowParticipants || []}
        />

        {/* Section: การแจกจ่ายเอกสาร */}
        {isFormDocument ? (
          <FormDistributionSetup
            accessScope={formData.access_control?.scope || formData.accessScope}
            accessControl={formData.access_control}
            ownerDept={currentUser?.department || 'PD'}
            distributionMode={formData.formDistributionMode || 'SPECIFIC_DEPTS'}
            selectedDepts={formData.distributedDepartments || []}
            authorizedDepts={formData.access_control?.authorized_depts || []}
            allDepartments={useStore.getState().masterDepartments || useStore.getState().departments || []}
            onChangeMode={(mode) => {
              setFormData(prev => ({ ...prev, formDistributionMode: mode }));
            }}
            onToggleDept={(deptCode) => {
              setFormData(prev => {
                const cur = prev.distributedDepartments || [];
                const next = cur.includes(deptCode) ? cur.filter(d => d !== deptCode) : [...cur, deptCode];
                return { ...prev, distributedDepartments: next };
              });
            }}
          />
        ) : (
          <DistributionSetup 
            ownerDept={currentUser?.department || 'PD'}
            distributions={formData.distributions || []}
            onChange={(distributions) => setFormData({ ...formData, distributions })}
            documentType={formData.docType}
            accessControl={formData.access_control}
            accessScope={formData.access_control?.scope}
          />
        )}

        {/* Developer Testing Section */}
        <div className="card-surface bg-amber-50/40 border-amber-200 overflow-hidden">
          <div className="px-6 py-3.5 border-b border-amber-200 bg-amber-100/50 flex items-center gap-2">
            <Settings className="text-amber-700" size={16} />
            <h3 className="font-bold text-sm text-amber-900 uppercase tracking-wider">ส่วนทดสอบระบบ: ตรวจสอบการแบ่งแยกหน้าที่ (SoD Validation)</h3>
          </div>
          <div className="p-6">
             <p className="text-sm text-amber-900 mb-3 leading-relaxed">
               (เฉพาะโหมดทดสอบ) ปกติระบบจะคำนวณ Reviewer และ Approver ให้คุณอัตโนมัติตาม Position Level แต่คุณสามารถใช้ช่องนี้เพื่อทดสอบหลักการ Segregation of Duties (SoD) ได้ว่ารายชื่อจะหายไปจากตัวเลือก
             </p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block font-semibold text-amber-950 mb-1.5">เลือก Reviewer ทดสอบ (ห้ามเป็น Requester)</label>
                  <select 
                    value={formData.manualReviewerId}
                    onChange={(e) => setFormData({...formData, manualReviewerId: e.target.value, manualApproverId: ''})}
                    className="w-full h-10.5 px-3.5 text-sm bg-white text-slate-800 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">-- ให้ระบบคำนวณอัตโนมัติ --</option>
                    {availableReviewers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} (ID: {u.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-amber-950 mb-1.5">เลือก Approver ทดสอบ (ห้ามซ้ำ Reviewer/Requester)</label>
                  <select 
                    value={formData.manualApproverId}
                    onChange={(e) => setFormData({...formData, manualApproverId: e.target.value})}
                    className="w-full h-10.5 px-3.5 text-sm bg-white text-slate-800 border border-amber-300 rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    disabled={!formData.manualReviewerId}
                  >
                    <option value="">-- ให้ระบบคำนวณอัตโนมัติ --</option>
                    {availableApprovers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} (ID: {u.id})</option>
                    ))}
                  </select>
                </div>
             </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="card-surface p-4 flex justify-end gap-2.5">
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
          >
            ส่งคำขอ (Submit DAR)
          </Button>
        </div>
      </form>

      {(() => {
        const selectedDocTypeObj = (documentTypes || []).find(t => (t.code || t.id) === formData.docType);
        const resolvedRevId = formData.manualReviewerId
          ? formData.manualReviewerId
          : (resolveReviewer(currentUser?.id, currentUser?.department || 'PD', masterUsers || [], reviewUsers || masterUsers || [])?.id);
        const resolvedReviewerObj = (masterUsers || []).find(u => u && u.id === resolvedRevId);

        return (
          <ActionConfirmModal
            isOpen={showConfirm}
            onClose={() => setShowConfirm(false)}
            onConfirm={executeSubmit}
            title="ยืนยันการส่งคำร้องขอขึ้นทะเบียนเอกสารใหม่ (New Document DAR)"
            actionType="submit"
            confirmText="ยืนยันการส่งคำร้องขอ"
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
                label: 'รหัสเอกสาร',
                value: (
                  <span className="font-mono font-bold text-[#0D99FF] bg-[#E5F4FF] px-2.5 py-0.5 rounded-md border border-indigo-100">
                    {getPreviewCode()}
                  </span>
                )
              },
              {
                label: 'ชนิดและประเภทเอกสาร',
                value: (
                  <span className="font-medium text-slate-700">
                    {selectedDocTypeObj?.nameTh || formData.docType} ({formData.docType})
                  </span>
                )
              },
              {
                label: 'ชื่อเอกสาร',
                value: (
                  <span className="text-sm sm:text-[15px] font-bold text-[#1E1E1E] leading-relaxed">
                    {formData.title}
                  </span>
                )
              },
              {
                label: 'รายละเอียดคำร้องขอ',
                value: (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-[#F5F5F5] p-3 rounded-xl border border-[#E5E5E5]/70">
                    {formData.requestDetail}
                  </div>
                )
              },
              {
                label: 'เหตุผลการร้องขอ',
                value: (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-[#F5F5F5] p-3 rounded-xl border border-[#E5E5E5]/70">
                    {formData.requestReason}
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
                      <span className="text-slate-400 text-xs">ระเบียบปฏิบัติการทั่วไป (General Operation)</span>
                    )}
                  </div>
                )
              },
              {
                label: 'ระดับชั้นความลับและการเข้าถึง',
                value: (() => {
                  const scopeMeta = ACCESS_SCOPE_METADATA[formData.access_control?.scope || 'GENERAL'];
                  return (
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${scopeMeta.badgeClass}`}>
                        {scopeMeta.label}
                      </span>
                      {formData.access_control?.scope === 'TARGETED' && (
                        <span className="text-xs text-[#666666] font-mono">
                          ({(formData.access_control?.authorized_depts || []).join(', ')})
                        </span>
                      )}
                      {formData.access_control?.scope === 'RESTRICTED' && (
                        <span className="text-xs text-[#666666] font-mono">
                          (Min Level: {formData.access_control?.min_access_level || 4})
                        </span>
                      )}
                    </div>
                  );
                })()
              },
              {
                label: 'ไฟล์เอกสารแนบ',
                value: formData.file ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F5F5F5] border border-[#E5E5E5] text-slate-700 text-xs font-medium">
                    <FileText size={15} className="text-rose-500 shrink-0" />
                    <span className="font-medium truncate">{formData.file.name}</span>
                    <span className="text-slate-400">({(formData.file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs">ไม่มีไฟล์แนบ</span>
                )
              },
              {
                label: 'จุดใช้งานและแผนกแจกจ่าย',
                value: (() => {
                  const allocs = calculateCopyAllocations(currentUser?.department || 'PD', formData.distributions || []);
                  return (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                          Copy 01 (Master): {allocs?.masterCopy?.station_name || allocs?.masterCopy?.locationName || 'PD Head Office'}
                        </span>
                        {(allocs?.distributedCopies || []).map((d, idx) => (
                          <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-[#E5F4FF] text-[#007BE5] border border-indigo-100">
                            {d.copyLabel || `Copy ${d.copyNo}`}: {d.station_name || d.locationName || d.name || d.location}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()
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

export default DarNewForm;
