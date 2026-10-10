import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert,
  FileEdit,
  Ban,
  Eye,
  History
} from 'lucide-react';
import toast from 'react-hot-toast';
import useStore, { canFastTrackReview } from '../../store/useStore';
import { getPeriodicReviewForUser, canPerformPeriodicReview } from '../../services/PeriodicReviewAccessService';
import { getReviewStatusLabel, getReviewOutcomeLabel } from '../../services/PeriodicReviewService';
import DocumentDetailModal from '../../components/workflow/DocumentDetailModal';
import ExternalDocDetailModal from '../ExternalDocs/ExternalDocDetailModal';

const PeriodicReviewDetail = () => {
  const { reviewId } = useParams();
  const navigate = useNavigate();
  const periodicReviewSchedules = useStore(state => state.periodicReviewSchedules);
  const documents = useStore(state => state.documents);
  const externalDocuments = useStore(state => state.externalDocuments);
  const dars = useStore(state => state.dars);
  const { currentUser, submitPeriodicReview, simulatedSystemDate, getEffectiveToday } = useStore();
  
  const allDocs = [...(documents || []), ...(externalDocuments || [])];
  const effectiveToday = getEffectiveToday ? getEffectiveToday() : (simulatedSystemDate ? new Date(simulatedSystemDate) : new Date());
  
  // Service-level detail security
  const accessCheck = getPeriodicReviewForUser(reviewId, currentUser, periodicReviewSchedules, allDocs, effectiveToday);
  
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

    const postSubmitNavigation = (navOutcome, linkStatus, newDraftId) => {
      if (linkStatus === 'FAILED') {
        toast.error('การบันทึกสำเร็จ แต่การเชื่อมโยง DAR ล้มเหลว');
      } else {
        if (navOutcome === 'NO_CHANGE') {
          if (isFastTrack) {
            toast.success('อนุมัติผลการทบทวนเรียบร้อยแล้ว (Fast-Track ขยายรอบ 1 ปี)');
          } else {
            toast.success('ส่งผลการทบทวนให้หัวหน้าแผนก (HOD) พิจารณาอนุมัติเรียบร้อยแล้ว');
          }
        } else {
          toast.success('บันทึกผลการทบทวนเรียบร้อยแล้ว');
        }

        if (navOutcome === 'REVISION_REQUIRED') {
          handleLinkedAction('REVISION', newDraftId);
        } else if (navOutcome === 'OBSOLETE_REQUIRED') {
          handleLinkedAction('OBSOLETE', newDraftId);
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
        submitPeriodicReview(schedule.id, outcome, comment, schedule.linkedActionId, 'SUCCESS', idempotencyKey);
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
        
        useStore.getState().submitPeriodicReviewWithDarAction(schedule.id, outcome, comment, darPayload, darAdapter);
        
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
        reviewDetails: {
          comment,
          findings,
          standards,
          references,
          additionalComments
        }
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
          onClick={() => navigate('/dcc/periodic-reviews')}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium text-sm"
        >
          <ArrowLeft size={16} /> กลับสู่ภาพรวมการทบทวน
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

            {/* Metadata Table / Grid */}
            <div className="border-t border-slate-100 pt-3 mt-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] mb-0.5">ฉบับที่ (Revision)</span>
                  <span className="font-semibold text-slate-800">{schedule.rev || targetDoc?.revision || targetDoc?.rev || '00'}</span>
                </div>
                <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] mb-0.5">แผนกเจ้าของ</span>
                  <span className="font-semibold text-slate-800">{schedule.ownerDepartmentId || targetDoc?.department || '-'}</span>
                </div>
                <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] mb-0.5">ผู้รับผิดชอบ / เจ้าของ</span>
                  <span className="font-semibold text-slate-800">{schedule.ownerUserId || targetDoc?.owner || '-'}</span>
                </div>
                <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] mb-0.5">วันที่มีผลบังคับใช้</span>
                  <span className="font-semibold text-slate-800">{schedule.originalReviewAnchorDate || targetDoc?.effectiveDate || '-'}</span>
                </div>
              </div>

              <div className="mt-2.5 p-2.5 bg-sky-50/60 rounded-lg border border-sky-100 flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">วันที่ครบกำหนดรอบนี้</span>
                <span className="font-bold text-sm text-sky-600">
                  {schedule.nextReviewDate || '-'}
                </span>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="border-t border-slate-100 pt-3 mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenDocModal}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs"
              >
                <Eye size={14} className="text-slate-500" />
                เปิดดูไฟล์เอกสาร
              </button>
              <button
                type="button"
                onClick={handleOpenDocModal}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs"
              >
                <History size={14} className="text-slate-500" />
                ดูประวัติย้อนหลัง
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
              <h2 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-100 pb-3">
                แบบฟอร์มบันทึกผลการทบทวน
              </h2>
              
              {/* 1. Outcome Radio Cards */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  ผลการทบทวน <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { 
                      id: 'NO_CHANGE', 
                      label: 'ไม่มีการเปลี่ยนแปลง',
                      icon: CheckCircle,
                      activeStyle: 'border-emerald-500 bg-emerald-50/70 text-emerald-800 ring-2 ring-emerald-200 font-semibold shadow-2xs',
                      inactiveStyle: 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-slate-700',
                      activeIcon: 'text-emerald-600',
                      inactiveIcon: 'text-emerald-500'
                    },
                    { 
                      id: 'REVISION_REQUIRED', 
                      label: 'ต้องแก้ไขเอกสาร',
                      icon: FileEdit,
                      activeStyle: 'border-amber-500 bg-amber-50/70 text-amber-800 ring-2 ring-amber-200 font-semibold shadow-2xs',
                      inactiveStyle: 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 text-slate-700',
                      activeIcon: 'text-amber-600',
                      inactiveIcon: 'text-amber-500'
                    },
                    { 
                      id: 'OBSOLETE_REQUIRED', 
                      label: 'ต้องยกเลิกเอกสาร',
                      icon: Ban,
                      activeStyle: 'border-rose-500 bg-rose-50/70 text-rose-800 ring-2 ring-rose-200 font-semibold shadow-2xs',
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
                        className={`flex flex-col items-center justify-center p-3 border rounded-xl cursor-pointer transition-all ${
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
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  เหตุผล / รายละเอียดการทบทวน <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  rows={2} 
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="ระบุเหตุผลที่เลือกผลลัพธ์ดังกล่าว..."
                  disabled={!canPerform}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* 3. Compact 2-Column Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ประเด็นที่พบ</label>
                  <textarea 
                    rows={2} 
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    placeholder="ประเด็นหรือข้อสังเกตที่พบ..."
                    disabled={!canPerform}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-400 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">มาตรฐานหรือข้อกำหนดที่ใช้พิจารณา</label>
                  <textarea 
                    rows={2} 
                    value={standards}
                    onChange={(e) => setStandards(e.target.value)}
                    placeholder="เช่น ISO 9001:2015 ข้อ 7.5.3..."
                    disabled={!canPerform}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-400 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ข้อมูลหรือหลักฐานอ้างอิง</label>
                  <input 
                    type="text" 
                    value={references}
                    onChange={(e) => setReferences(e.target.value)}
                    placeholder="เช่น รายงาน Internal Audit, CAR..."
                    disabled={!canPerform}
                    className="w-full h-9 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ความคิดเห็นเพิ่มเติม</label>
                  <input 
                    type="text" 
                    value={additionalComments}
                    onChange={(e) => setAdditionalComments(e.target.value)}
                    placeholder="ข้อเสนอแนะเพิ่มเติม..."
                    disabled={!canPerform}
                    className="w-full h-9 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* 4. Action Footer */}
              {canPerform ? (
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="text-xs">
                    {outcome === 'NO_CHANGE' && (
                      isFastTrack ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          ⚡ สิทธิ์ Fast-Track (Manager/HOD/DCC): ขยายรอบทบทวน 1 ปีทันทีโดยไม่ต้องส่งต่อ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                          📋 สิทธิ์ Staff: ผลทบทวนจะถูกส่งต่อไปยังหัวหน้าแผนก (HOD) เพื่อพิจารณาอนุมัติ
                        </span>
                      )
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button 
                      type="button"
                      onClick={() => navigate('/dcc/periodic-reviews')}
                      className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      type="button"
                      onClick={handleSubmit}
                      className={`px-5 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors text-white ${
                        outcome === 'NO_CHANGE' && !isFastTrack
                          ? 'bg-indigo-600 hover:bg-indigo-700'
                          : 'bg-sky-500 hover:bg-sky-600'
                      }`}
                    >
                      {outcome === 'NO_CHANGE'
                        ? (isFastTrack ? 'อนุมัติผลทบทวนทันที (Fast-Track)' : 'ส่งขออนุมัติผลทบทวน (ส่งต่อ HOD)')
                        : 'บันทึกผลการทบทวน'}
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
