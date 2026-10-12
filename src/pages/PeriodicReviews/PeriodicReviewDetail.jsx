import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FileText, 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert,
  ShieldCheck,
  FileEdit,
  Ban,
  Eye,
  History,
  Send,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import useStore, { canFastTrackReview } from '../../store/useStore';
import { getPeriodicReviewForUser, canPerformPeriodicReview } from '../../services/PeriodicReviewAccessService';
import { getReviewStatusLabel, getReviewOutcomeLabel } from '../../services/PeriodicReviewService';
import { formatQmsDisplayDate } from '../../utils/dateFormatter';
import DocumentDetailModal from '../../components/workflow/DocumentDetailModal';
import ExternalDocDetailModal from '../ExternalDocs/ExternalDocDetailModal';

const PeriodicReviewDetail = () => {
  const { reviewId, docCode } = useParams();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');
  const navigate = useNavigate();
  const periodicReviewSchedules = useStore(state => state.periodicReviewSchedules);
  const tasks = useStore(state => state.tasks);
  const documents = useStore(state => state.documents);
  const externalDocuments = useStore(state => state.externalDocuments);
  const dars = useStore(state => state.dars);
  const { currentUser, submitPeriodicReview, simulatedSystemDate, getEffectiveToday } = useStore();
  
  const allDocs = [...(documents || []), ...(externalDocuments || [])];
  const effectiveToday = getEffectiveToday ? getEffectiveToday() : (simulatedSystemDate ? new Date(simulatedSystemDate) : new Date());

  const paramId = reviewId || docCode;
  const targetTask = taskId ? (tasks || []).find(t => t.id === taskId) : null;
  const matchedSchedule = periodicReviewSchedules?.find(s => 
    s.id === paramId ||
    s.documentNumber === paramId ||
    s.documentId === paramId ||
    s.externalDocumentId === paramId ||
    (targetTask && s.id === targetTask.scheduleId) ||
    (targetTask && (s.documentNumber === targetTask.docCode || s.documentNumber === targetTask.documentNumber)) ||
    (targetTask && (s.documentId === targetTask.docId || s.externalDocumentId === targetTask.docId))
  );

  const effectiveLookupId = matchedSchedule ? matchedSchedule.id : paramId;
  
  // Service-level detail security
  const accessCheck = getPeriodicReviewForUser(effectiveLookupId, currentUser, periodicReviewSchedules, allDocs, effectiveToday);
  
  const [outcome, setOutcome] = useState('');
  const [comment, setComment] = useState('');
  const [findings, setFindings] = useState('');
  const [standards, setStandards] = useState('');
  const [references, setReferences] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  if (accessCheck.status === 'NOT_FOUND') {
    return <div className="p-8 text-center text-[#666666]">ไม่พบเอกสารนี้ (Not Found)</div>;
  }
  
  if (accessCheck.status === 'ACCESS_DENIED') {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-700 mb-2">ไม่มีสิทธิ์เข้าถึงข้อมูลการทบทวนเอกสารนี้</h2>
          <p className="text-red-600">{accessCheck.message}</p>
          <button 
            onClick={() => navigate('/dcc/periodic-reviews')}
            className="mt-6 px-4 py-2 bg-white text-red-700 font-medium rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
          >
            กลับสู่หน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  const schedule = accessCheck.data;
  
  const linkedDar = schedule.linkedActionId ? dars.find(d => d.id === schedule.linkedActionId) : null;
  const linkedDarStatus = linkedDar ? useStore.getState().getLinkedActionStatus(linkedDar.status) : null;
  
  const isInternal = schedule.documentCategory === 'INTERNAL';
  const statusLabel = getReviewStatusLabel(schedule.status);
  
  const targetDoc = accessCheck.document || allDocs.find(d => 
    (schedule.documentId && d.id === schedule.documentId) || 
    (schedule.externalDocumentId && d.id === schedule.externalDocumentId) ||
    (schedule.documentNumber && (d.documentNumber === schedule.documentNumber || d.code === schedule.documentNumber))
  );

  const canPerform = canPerformPeriodicReview(currentUser, schedule, targetDoc);
  const docDept = schedule?.ownerDepartmentId || targetDoc?.department || targetDoc?.dept || 'DC';
  const isFastTrack = canFastTrackReview(currentUser, docDept);

  const handleOpenDocModal = () => {
    if (targetDoc) {
      setIsDocModalOpen(true);
    } else {
      toast.error('ไม่พบข้อมูลเอกสารต้นทาง');
    }
  };

  const handleLinkedAction = (actionType, explicitDraftId) => {
    const draftId = explicitDraftId || schedule.linkedActionId;
    if (draftId) {
       toast.success(`กำลังเปิด DAR ที่เชื่อมโยง: ${draftId}`);
       const basePath = actionType === 'REVISION' ? '/dcc/dar/new/revision' : '/dcc/dar/new/obsolete';
       navigate(`${basePath}?draftId=${draftId}`);
       return;
    }
    
    toast.success(`กำลังพาไปสร้าง DAR...`);
    const route = actionType === 'REVISION' ? '/dcc/dar/new/revision' : '/dcc/dar/new/obsolete';
    navigate(route, { state: { prefillDocId: schedule.documentId || schedule.externalDocumentId, prefillReviewId: schedule.id } });
  };

  const handleSubmit = () => {
    if (!outcome) {
      toast.error('กรุณาเลือกผลการทบทวน');
      return;
    }
    if (comment.length < 5) {
      toast.error('กรุณาระบุเหตุผล/รายละเอียดการทบทวน');
      return;
    }

    const standardizedReviewDetails = {
      outcome,
      reason: comment,
      comment,
      findings,
      standard_clause: standards,
      standards,
      evidence_reference: references,
      references,
      additional_comment: additionalComments,
      additionalComments
    };

    const postSubmitNavigation = (navOutcome, linkStatus, newDraftId) => {
      if (linkStatus === 'FAILED') {
        toast.error('การบันทึกสำเร็จ แต่การเชื่อมโยง DAR ล้มเหลว');
      } else {
        if (navOutcome === 'NO_CHANGE') {
          if (isFastTrack) {
            toast.success('อนุมัติผลการทบทวนเรียบร้อยแล้ว (Fast-Track ขยายรอบ 1 ปี)');
          } else {
            toast.success('ส่งผลการทบทวนไปยังหัวหน้าแผนก (HOD) เรียบร้อยแล้ว');
          }
        } else {
          toast.success('บันทึกผลการทบทวนเรียบร้อยแล้ว');
        }

        if (navOutcome === 'REVISION_REQUIRED') {
          handleLinkedAction('REVISION', newDraftId);
        } else if (navOutcome === 'OBSOLETE_REQUIRED') {
          handleLinkedAction('OBSOLETE', newDraftId);
        } else if (taskId) {
          toast.success('อัปเดตงานใน Task Inbox สำเร็จ');
          navigate('/tasks');
        } else {
          navigate('/dcc/periodic-reviews');
        }
      }
    };

    const idempotencyKey = outcome === 'REVISION_REQUIRED' 
      ? `PERIODIC_REVIEW_${schedule.id}_REVISION` 
      : (outcome === 'OBSOLETE_REQUIRED' ? `PERIODIC_REVIEW_${schedule.id}_OBSOLETE` : null);

    if (idempotencyKey) {
      if (schedule.linkedActionId && schedule.linkageStatus === 'SUCCESS') {
        // Already created, just re-submit core
        submitPeriodicReview({
          scheduleId: schedule.id,
          outcome,
          comment,
          linkedActionId: schedule.linkedActionId,
          linkageStatus: 'SUCCESS',
          idempotencyKey,
          taskId,
          reviewDetails: standardizedReviewDetails
        });
        postSubmitNavigation(outcome, 'SUCCESS', schedule.linkedActionId);
      } else {
        // Generate actual DAR
        const darPayload = {
          type: outcome === 'REVISION_REQUIRED' ? 'REVISION' : 'OBSOLETE',
          title: schedule.documentName || schedule.documentNumber,
          department: schedule.ownerDepartmentId,
          isDraft: true,
          status: 'DRAFT',
          refDocId: schedule.documentId || schedule.externalDocumentId
        };
        const darAdapter = (payload) => useStore.getState().createOrGetLinkedDarDraft(schedule.id, outcome, payload);
        
        useStore.getState().submitPeriodicReviewWithDarAction(
          schedule.id, 
          outcome, 
          comment, 
          darPayload, 
          darAdapter,
          { taskId, reviewDetails: standardizedReviewDetails }
        );
        
        // Check new status directly from store for accurate navigation
        const updatedSchedule = useStore.getState().periodicReviewSchedules.find(s => s.id === schedule.id);
        postSubmitNavigation(outcome, updatedSchedule?.linkageStatus, updatedSchedule?.linkedActionId);
      }
    } else {
      submitPeriodicReview({
        scheduleId: schedule.id,
        docId: schedule.documentId || schedule.externalDocumentId,
        docCode: schedule.documentNumber,
        isExternal: schedule.documentCategory === 'EXTERNAL',
        outcome,
        comment,
        taskId,
        reviewDetails: standardizedReviewDetails
      });
      postSubmitNavigation(outcome, null, null);
    }
  };

  const handleRetryDarLinkage = () => {
    const darPayload = {
      type: schedule.outcome === 'REVISION_REQUIRED' ? 'REVISION' : 'OBSOLETE',
      title: schedule.documentName || schedule.documentNumber,
      department: schedule.ownerDepartmentId,
      isDraft: true,
      status: 'DRAFT',
      refDocId: schedule.documentId || schedule.externalDocumentId
    };
    
    const darAdapter = (payload) => useStore.getState().createOrGetLinkedDarDraft(schedule.id, schedule.outcome, payload);
    
    useStore.getState().retryPeriodicReviewLinkageWithDarAction(schedule.id, darPayload, darAdapter);
    
    const updatedSchedule = useStore.getState().periodicReviewSchedules.find(s => s.id === schedule.id);
    if (updatedSchedule?.linkageStatus === 'SUCCESS') {
      toast.success('สร้างคำขอสำเร็จ');
      if (schedule.outcome === 'REVISION_REQUIRED') {
        navigate(`/dcc/dar/new/revision?draftId=${updatedSchedule.linkedActionId}`);
      } else {
        navigate(`/dcc/dar/new/obsolete?draftId=${updatedSchedule.linkedActionId}`);
      }
    } else {
      toast.error('การสร้าง DAR ล้มเหลว กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Top Navigation */}
      <div className="mb-4">
        <button 
          type="button"
          onClick={() => {
            if (taskId) {
              navigate('/tasks');
            } else {
              navigate('/dcc/periodic-reviews');
            }
          }}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium text-sm"
        >
          <ArrowLeft size={16} /> {taskId ? 'กลับสู่กล่องงาน (Task Inbox)' : 'กลับสู่ภาพรวมการทบทวน'}
        </button>
      </div>

      {/* Main Two-Column Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Document Context Card: 5 cols / ~40%) */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm sticky top-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`p-2.5 rounded-xl shrink-0 ${isInternal ? 'bg-sky-50 text-sky-600 border border-sky-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-snug truncate">
                    {schedule.documentNumber}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium mt-0.5 line-clamp-2" title={schedule.documentName}>
                    {schedule.documentName}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusLabel.color}`}>
                  {statusLabel.label}
                </span>
                {schedule.dueState === 'OVERDUE' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 animate-pulse border border-rose-200">
                    เลยกำหนด
                  </span>
                )}
              </div>
            </div>

            {/* Metadata Table / Key-Value Rows */}
            <div className="mt-4 pt-3 border-t border-slate-100 divide-y divide-slate-100 text-xs">
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">ฉบับที่ (Revision)</span>
                <span className="font-semibold text-slate-800 font-mono">{schedule.rev || targetDoc?.revision || targetDoc?.rev || '00'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">แผนกเจ้าของ</span>
                <span className="font-semibold text-slate-800">{schedule.ownerDepartmentId || targetDoc?.department || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">ผู้รับผิดชอบ / เจ้าของ</span>
                <span className="font-semibold text-slate-800">{schedule.ownerUserId || targetDoc?.owner || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">วันที่มีผลบังคับใช้</span>
                <span className="font-semibold text-slate-800">{formatQmsDisplayDate(schedule.originalReviewAnchorDate || targetDoc?.effectiveDate)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 px-3 bg-sky-50/70 rounded-lg mt-2 border border-sky-100/80">
                <span className="text-xs text-sky-900 font-medium">วันที่ครบกำหนดรอบนี้</span>
                <span className="font-bold text-sm text-sky-700 font-mono">
                  {formatQmsDisplayDate(schedule.nextReviewDate)}
                </span>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleOpenDocModal}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200/80 transition-colors"
              >
                <Eye size={14} className="text-slate-500" />
                <span>เปิดดูไฟล์เอกสาร</span>
              </button>
              <button
                type="button"
                onClick={handleOpenDocModal}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200/80 transition-colors"
              >
                <History size={14} className="text-slate-500" />
                <span>ดูประวัติย้อนหลัง</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (Review Action Form / Completed Status: 7 cols / ~60%) */}
        <div className="lg:col-span-7">
          {schedule.status === 'COMPLETED' || schedule.status === 'IN_PROGRESS' ? (
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
                <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-emerald-800 mb-1">การทบทวนเสร็จแล้ว</h2>
                <p className="text-emerald-600 mb-1 text-sm">
                  ผลการทบทวน: <span className="font-semibold">{getReviewOutcomeLabel(schedule.outcome).label}</span>
                </p>
                {linkedDarStatus && (
                  <p className="text-emerald-600 font-medium text-xs">สถานะคำขอที่เชื่อมโยง: {linkedDarStatus}</p>
                )}
                {schedule.linkageStatus === 'FAILED' ? (
                  <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl text-left">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-red-600 mt-0.5 shrink-0" size={18} />
                      <div>
                        <h3 className="text-red-800 font-bold text-sm mb-0.5">การบันทึกสำเร็จ แต่การสร้าง DAR ล้มเหลว</h3>
                        <p className="text-red-600 text-xs mb-3">กรุณาลองสร้างคำขออีกครั้ง</p>
                        <button 
                          type="button"
                          onClick={handleRetryDarLinkage}
                          className="px-3.5 py-1.5 bg-red-600 text-white font-medium text-xs rounded-lg hover:bg-red-700 transition-colors shadow-2xs"
                        >
                          ลองสร้างคำขออีกครั้ง
                        </button>
                      </div>
                    </div>
                  </div>
                ) : schedule.linkedActionId ? (
                  <button 
                    type="button"
                    onClick={() => navigate(`/dar/draft/${schedule.linkedActionId}`)}
                    className="mt-5 px-4 py-2 bg-emerald-600 text-white font-medium text-xs rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs"
                  >
                    ดู DAR ที่เชื่อมโยง
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
              <div className="border-b border-slate-100 pb-3 mb-5">
                <h2 className="text-base font-bold text-slate-900">
                  แบบฟอร์มบันทึกผลการทบทวน
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ระบุผลการพิจารณาความสอดคล้องของเอกสารและรายละเอียดประกอบ
                </p>
              </div>

              {/* หมวดที่ 1: ผลและเหตุผลหลัก */}
              <div className="space-y-4 mb-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      ผลการทบทวน <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-normal">เลือก 1 ข้อ</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { 
                        id: 'NO_CHANGE', 
                        label: 'ไม่มีการเปลี่ยนแปลง',
                        icon: CheckCircle,
                        activeStyle: 'border-2 border-emerald-500 bg-emerald-50/40 text-emerald-800 font-semibold shadow-xs',
                        inactiveStyle: 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-slate-700',
                        activeIcon: 'text-emerald-600',
                        inactiveIcon: 'text-emerald-500'
                      },
                      { 
                        id: 'REVISION_REQUIRED', 
                        label: 'ต้องแก้ไขเอกสาร',
                        icon: FileEdit,
                        activeStyle: 'border-2 border-amber-500 bg-amber-50/40 text-amber-800 font-semibold shadow-xs',
                        inactiveStyle: 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 text-slate-700',
                        activeIcon: 'text-amber-600',
                        inactiveIcon: 'text-amber-500'
                      },
                      { 
                        id: 'OBSOLETE_REQUIRED', 
                        label: 'ต้องยกเลิกเอกสาร',
                        icon: Ban,
                        activeStyle: 'border-2 border-rose-500 bg-rose-50/40 text-rose-800 font-semibold shadow-xs',
                        inactiveStyle: 'border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 text-slate-700',
                        activeIcon: 'text-rose-600',
                        inactiveIcon: 'text-rose-500'
                      }
                    ].map(opt => {
                      const IconComponent = opt.icon;
                      const isSelected = outcome === opt.id;
                      return (
                        <label 
                          key={opt.id} 
                          className={`flex flex-col items-center justify-center p-3 min-h-[72px] border rounded-xl cursor-pointer transition-all ${
                            isSelected ? opt.activeStyle : opt.inactiveStyle
                          } ${!canPerform ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <input 
                            type="radio" 
                            name="outcome" 
                            value={opt.id} 
                            checked={isSelected}
                            className="sr-only"
                            onChange={(e) => setOutcome(e.target.value)}
                            disabled={!canPerform}
                          />
                          <IconComponent className={`w-5 h-5 mb-1.5 ${isSelected ? opt.activeIcon : opt.inactiveIcon}`} />
                          <span className="text-xs font-medium leading-tight text-center">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Reason / Comment Textarea */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    เหตุผล / รายละเอียดการทบทวน <span className="text-rose-500">*</span>
                  </label>
                  <textarea 
                    rows={2} 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="ระบุเหตุผลที่เลือกผลลัพธ์ดังกล่าว..."
                    disabled={!canPerform}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-400 resize-none"
                  />
                </div>
              </div>

              {/* หมวดที่ 2: หลักฐานและรายละเอียดประกอบ (Audit Details Card) */}
              <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-100 space-y-3 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">หลักฐานและรายละเอียดประกอบ</span>
                  <span className="text-[11px] text-slate-400 font-normal">ไม่บังคับ (Optional)</span>
                </div>
                
                {/* แถวที่ 1: ประเด็นที่พบ & มาตรฐานหรือข้อกำหนด */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ประเด็นที่พบ</label>
                    <textarea 
                      rows={2} 
                      value={findings}
                      onChange={(e) => setFindings(e.target.value)}
                      placeholder="ประเด็นหรือข้อสังเกตที่พบ..."
                      disabled={!canPerform}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-400 resize-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">มาตรฐานหรือข้อกำหนดที่ใช้พิจารณา</label>
                    <textarea 
                      rows={2} 
                      value={standards}
                      onChange={(e) => setStandards(e.target.value)}
                      placeholder="เช่น ISO 9001, มอก., หรือระเบียบปฏิบัติ..."
                      disabled={!canPerform}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-400 resize-none bg-white"
                    />
                  </div>
                </div>

                {/* แถวที่ 2: ข้อมูลหรือหลักฐานอ้างอิง & ความคิดเห็นเพิ่มเติม */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ข้อมูลหรือหลักฐานอ้างอิง</label>
                    <input 
                      type="text" 
                      value={references}
                      onChange={(e) => setReferences(e.target.value)}
                      placeholder="เช่น รายงาน Internal Audit, CAR..."
                      disabled={!canPerform}
                      className="w-full h-9 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs outline-none transition-all placeholder:text-slate-400 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ความคิดเห็นเพิ่มเติม</label>
                    <input 
                      type="text" 
                      value={additionalComments}
                      onChange={(e) => setAdditionalComments(e.target.value)}
                      placeholder="ข้อเสนอแนะเพิ่มเติม..."
                      disabled={!canPerform}
                      className="w-full h-9 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs outline-none transition-all placeholder:text-slate-400 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Action Footer */}
              {canPerform ? (
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-4">
                  {/* กล่องแจ้งเตือนสายการอนุมัติ: แสดงเต็มแถบพร้อมไอคอนเรียบร้อย */}
                  {!isFastTrack ? (
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-sky-50/80 border border-sky-100 rounded-lg text-xs text-sky-800">
                      <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>
                        <strong>สายการอนุมัติ 1 ระดับ:</strong> ผลการทบทวนนี้จะถูกส่งไปยังหัวหน้าแผนก <strong>({docDept} - HOD)</strong> เพื่อพิจารณาอนุมัติก่อนขยายรอบ
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-50/80 border border-amber-100 rounded-lg text-xs text-amber-800">
                      <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>สิทธิ์ Fast-Track (HOD/DCC):</strong> ผลการทบทวนจะได้รับการอนุมัติและขยายรอบ 1 ปีทันที
                      </span>
                    </div>
                  )}

                  {/* ปุ่มกดยกเลิกและยืนยัน จัดชิดขวา Balance สวยงาม */}
                  <div className="flex items-center justify-end gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        if (taskId) {
                          navigate('/tasks');
                        } else {
                          navigate('/dcc/periodic-reviews');
                        }
                      }}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      type="button"
                      onClick={handleSubmit}
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2 h-10 text-sm font-medium text-white rounded-lg shadow-sm transition-all ${
                        outcome === 'NO_CHANGE' && isFastTrack
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-sky-600 hover:bg-sky-700'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {outcome === 'NO_CHANGE'
                          ? (isFastTrack ? 'อนุมัติผลทบทวนทันที' : 'ส่งผลการทบทวนให้หัวหน้าแผนก')
                          : 'บันทึกผลการทบทวน'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200/80 flex items-start gap-2.5 text-xs">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-bold">คุณไม่มีสิทธิ์ดำเนินการทบทวนเอกสารนี้</p>
                    <p className="mt-0.5 text-amber-700">สิทธิ์ในการบันทึกถูกจำกัดเฉพาะเจ้าของเอกสารหรือผู้บังคับบัญชาในแผนก {schedule.ownerDepartmentId || '-'} เท่านั้น</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Internal Document Detail Modal */}
      {isDocModalOpen && targetDoc && !targetDoc.isExternal && schedule.documentCategory !== 'EXTERNAL' && (
        <DocumentDetailModal
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
          document={targetDoc}
        />
      )}

      {/* External Document Detail Modal */}
      {isDocModalOpen && targetDoc && (targetDoc.isExternal || schedule.documentCategory === 'EXTERNAL') && (
        <ExternalDocDetailModal
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
          document={targetDoc}
        />
      )}
    </div>
  );
};

export default PeriodicReviewDetail;
