import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../../store/useStore';
import { getPeriodicReviewForUser, canPerformPeriodicReview } from '../../services/PeriodicReviewAccessService';
import { getReviewStatusLabel, getReviewOutcomeLabel } from '../../services/PeriodicReviewService';

const PeriodicReviewDetail = () => {
  const { reviewId } = useParams();
  const navigate = useNavigate();
  const periodicReviewSchedules = useStore(state => state.periodicReviewSchedules);
  const documents = useStore(state => state.documents);
  const externalDocuments = useStore(state => state.externalDocuments);
  const dars = useStore(state => state.dars);
  const { currentUser, submitPeriodicReview } = useStore();
  
  const allDocs = [...(documents || []), ...(externalDocuments || [])];
  
  // Service-level detail security
  const accessCheck = getPeriodicReviewForUser(reviewId, currentUser, periodicReviewSchedules, allDocs);
  
  const [outcome, setOutcome] = useState('');
  const [comment, setComment] = useState('');
  const [findings, setFindings] = useState('');
  const [standards, setStandards] = useState('');
  const [references, setReferences] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');

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
  
  const canPerform = canPerformPeriodicReview(currentUser, schedule, accessCheck.document);

  const handleLinkedAction = (actionType, explicitDraftId) => {
    // Navigate to create DAR if draft doesn't exist yet
    // Pass prefill values. For idempotency, the destination handles preventing multiple DARs
    // (We also track linkedActionId on the schedule if it exists)
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
        toast.success('บันทึกผลการทบทวนเรียบร้อยแล้ว');
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
      submitPeriodicReview(schedule.id, outcome, comment, null, null, null);
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
    
    // In production, we'll orchestrate the store using the new DarLinkService logic
    // We update this via useStore since useStore will handle the delegation
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
    <div className="p-8 max-w-4xl mx-auto">
      <button 
        onClick={() => navigate('/dcc/periodic-reviews')}
        className="flex items-center gap-2 text-[#666666] hover:text-slate-800 transition-colors mb-6 font-medium text-sm"
      >
        <ArrowLeft size={16} /> กลับ
      </button>

      {/* Header Info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E5E5] mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 flex flex-col items-end gap-2">
           <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusLabel.color}`}>
             {statusLabel.label}
           </span>
           {schedule.dueState === 'OVERDUE' && (
             <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse">
               เกินกำหนด
             </span>
           )}
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className={`p-4 rounded-xl ${isInternal ? 'bg-indigo-100 text-[#0D99FF]' : 'bg-emerald-100 text-emerald-600'}`}>
            <FileText size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{schedule.documentNumber}</h1>
            <p className="text-[#666666] mt-1">{schedule.documentName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs font-medium text-[#666666] mb-1">Revision ปัจจุบัน</p>
            <p className="text-sm font-bold text-slate-800">{schedule.rev || '00'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#666666] mb-1">แผนกเจ้าของเอกสาร</p>
            <p className="text-sm font-bold text-slate-800">{schedule.ownerDepartmentId}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#666666] mb-1">เจ้าของเอกสาร</p>
            <p className="text-sm font-bold text-slate-800">{schedule.ownerUserId}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#666666] mb-1">วันที่มีผลบังคับใช้</p>
            <p className="text-sm font-bold text-slate-800">{schedule.originalReviewAnchorDate}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#666666] mb-1">วันที่ครบกำหนดรอบนี้</p>
            <p className="text-sm font-bold text-[#007BE5]">{schedule.nextReviewDate}</p>
          </div>
        </div>
      </div>

      {schedule.status === 'COMPLETED' || schedule.status === 'IN_PROGRESS' ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">การทบทวนเสร็จแล้ว</h2>
          <p className="text-emerald-600 mb-1">ผลการทบทวน: {getReviewOutcomeLabel(schedule.outcome).label}</p>
          {linkedDarStatus && (
            <p className="text-emerald-600 font-medium">สถานะคำขอที่เชื่อมโยง: {linkedDarStatus}</p>
          )}
          {schedule.linkageStatus === 'FAILED' ? (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-left">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-600 mt-1" size={20} />
                <div>
                  <h3 className="text-red-800 font-bold mb-1">การบันทึกสำเร็จ แต่การสร้าง DAR ล้มเหลว</h3>
                  <p className="text-red-600 text-sm mb-3">กรุณาลองสร้างคำขออีกครั้ง</p>
                  <button 
                    onClick={handleRetryDarLinkage}
                    className="px-4 py-2 bg-red-600 text-white font-medium text-sm rounded-lg hover:bg-red-700 transition-colors"
                  >
                    ลองสร้างคำขออีกครั้ง
                  </button>
                </div>
              </div>
            </div>
          ) : schedule.linkedActionId ? (
            <button 
              onClick={() => navigate(`/dar/draft/${schedule.linkedActionId}`)}
              className="mt-6 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              ดู DAR ที่เชื่อมโยง
            </button>
          ) : null}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E5E5]">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">แบบฟอร์มบันทึกผลการทบทวน</h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">ผลการทบทวน <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'NO_CHANGE', label: 'ไม่มีการเปลี่ยนแปลง' },
                  { id: 'REVISION_REQUIRED', label: 'ต้องแก้ไขเอกสาร' },
                  { id: 'OBSOLETE_REQUIRED', label: 'ต้องยกเลิกเอกสาร' }
                ].map(opt => (
                  <label 
                    key={opt.id} 
                    className={`flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-all ${
                      outcome === opt.id ? 'border-indigo-500 bg-[#E5F4FF] text-[#007BE5] font-bold shadow-inner ring-2 ring-indigo-200' : 'border-[#E5E5E5] text-slate-600 hover:bg-[#F5F5F5]'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="outcome" 
                      value={opt.id} 
                      className="sr-only"
                      onChange={(e) => setOutcome(e.target.value)}
                      disabled={!canPerform}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">เหตุผล / รายละเอียดการทบทวน <span className="text-red-500">*</span></label>
              <textarea 
                rows="3" 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="ระบุเหตุผลที่เลือกผลลัพธ์ดังกล่าว..."
                disabled={!canPerform}
                className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl focus:ring-2 focus:ring-[#0D99FF] focus:border-indigo-500 text-sm"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">ประเด็นที่พบ</label>
                <textarea 
                  rows="2" 
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  disabled={!canPerform}
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">มาตรฐานหรือข้อกำหนดที่ใช้พิจารณา</label>
                <textarea 
                  rows="2" 
                  value={standards}
                  onChange={(e) => setStandards(e.target.value)}
                  disabled={!canPerform}
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">ข้อมูลหรือหลักฐานอ้างอิง</label>
                <input 
                  type="text" 
                  value={references}
                  onChange={(e) => setReferences(e.target.value)}
                  disabled={!canPerform}
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">ความคิดเห็นเพิ่มเติม</label>
                <input 
                  type="text" 
                  value={additionalComments}
                  onChange={(e) => setAdditionalComments(e.target.value)}
                  disabled={!canPerform}
                  className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl text-sm"
                />
              </div>
            </div>

            {canPerform ? (
              <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => navigate('/dcc/periodic-reviews')}
                  className="px-6 py-2.5 rounded-xl font-medium text-slate-600 bg-[#F5F5F5] hover:bg-slate-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleSubmit}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#0D99FF] hover:bg-[#007BE5] transition-colors shadow-sm"
                >
                  บันทึกผลการทบทวน
                </button>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-yellow-50 text-yellow-800 rounded-xl flex items-start gap-3">
                <AlertTriangle size={20} className="shrink-0 mt-0.5 text-yellow-600" />
                <div>
                  <p className="font-bold text-sm">คุณไม่มีสิทธิ์ดำเนินการทบทวนเอกสารนี้</p>
                  <p className="text-xs mt-1">สิทธิ์ในการบันทึกถูกจำกัดเฉพาะเจ้าของเอกสารหรือผู้บังคับบัญชาในแผนก {schedule.ownerDepartmentId} เท่านั้น</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodicReviewDetail;
