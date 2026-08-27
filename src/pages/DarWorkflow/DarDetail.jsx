import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import { FileText, ChevronLeft, CheckCircle, AlertCircle, Activity, Sparkles } from 'lucide-react';
import DARComments from '../../components/workflow/DARComments';
import { resolveReviewer, resolveApprover } from '../../utils/workflowResolver';
import { getDarReason, getDarDetail, getDarDocInfo } from '../../utils/darHelper';
import DarReviewModal from '../../components/workflow/DarReviewModal';

const DarDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dars, documents, timeline, currentUser, masterUsers, reviewUsers, approveUsers } = useStore();
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  
  const dar = dars.find(d => d.id === id);
  const myTimeline = timeline.filter(t => t.darId === id).sort((a, b) => b.id - a.id);
  
  const darHistory = timeline.filter(t => t.darId === id);
  const getActor = (action) => darHistory.find(t => t.action === action)?.user || '-';
  
  const docInfo = getDarDocInfo(dar, documents);

  if (!dar) return <div className="p-6 text-[#666666] font-medium">ไม่พบข้อมูลคำร้อง DAR</div>;

  const isAdmin = currentUser.isDcc || currentUser.role === 'DCC_ADMIN' || currentUser.id === 'u5' || currentUser.id === 'U001';

  let workflow = null;
  if (isAdmin && dar) {
    const requester = masterUsers.find(u => u.id === dar.requesterId);
    const revId = resolveReviewer(dar.requesterId, dar.department, masterUsers, reviewUsers);
    const reviewer = masterUsers.find(u => u.id === revId);
    
    const appId = revId ? resolveApprover(dar.requesterId, revId, dar.department, masterUsers, approveUsers) : null;
    const approver = masterUsers.find(u => u.id === appId);

    workflow = { requester, reviewer, approver };
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-4 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="action-icon-btn text-slate-600 hover:text-[#0D99FF]">
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[#0D99FF] text-lg">{dar.id}</span>
              <span className="badge-system">{dar.type}</span>
            </div>
            <h2 className="text-xl font-bold text-[#1E1E1E] tracking-tight">{dar.title}</h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsInspectorOpen(true)}
          className="btn-primary flex items-center gap-2 text-xs font-bold self-start sm:self-auto"
        >
          <Sparkles size={15} /> ตรวจสอบคำร้องครบ 6 มิติ (Inspector)
        </button>
      </div>

      {isAdmin && workflow && (
        <div className="card-surface p-6">
          <h3 className="font-bold text-xs text-indigo-900 border-b border-indigo-50 pb-2 mb-4 flex items-center gap-2 uppercase tracking-wider">
            <Activity className="text-[#0D99FF]" size={16} /> ติดตามสายการอนุมัติ (Workflow Integrity Tracker)
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative">
             <div className="hidden md:block absolute top-1/2 left-8 right-8 h-0.5 bg-slate-200 -z-10 -translate-y-1/2"></div>
             
             {/* Requester Node */}
             <div className="flex flex-col items-center bg-white px-5 py-3.5 rounded-xl border border-[#E5E5E5] shadow-xs z-10 w-full md:w-1/3 max-w-[240px]">
               <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-xs font-bold text-[#666666] uppercase tracking-wider">ผู้ร้องขอ (Requester)</span>
               </div>
               <p className="font-bold text-[#1E1E1E] text-sm text-center">{workflow.requester?.name || dar.requesterId}</p>
               <p className="text-xs text-slate-400 mt-0.5">ระดับตำแหน่ง: {workflow.requester?.level || '?'}</p>
             </div>

             {/* Reviewer Node */}
             <div className="flex flex-col items-center bg-white px-5 py-3.5 rounded-xl border border-[#E5E5E5] shadow-xs z-10 w-full md:w-1/3 max-w-[240px]">
               <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${dar.status === 'DRAFT' || dar.status === 'RETURNED_FOR_REVISION' || dar.status === 'CANCELLED' ? 'bg-slate-300' : dar.status === 'UNDER_REVIEW' ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
                  <span className="text-xs font-bold text-[#666666] uppercase tracking-wider">ผู้ทบทวน (Reviewer)</span>
               </div>
               <p className="font-bold text-[#1E1E1E] text-sm text-center">{workflow.reviewer?.name || 'รอคำนวณ'}</p>
               <p className="text-xs text-slate-400 mt-0.5">ระดับตำแหน่ง: {workflow.reviewer?.level || '?'}</p>
             </div>

             {/* Approver Node */}
             <div className="flex flex-col items-center bg-white px-5 py-3.5 rounded-xl border border-[#E5E5E5] shadow-xs z-10 w-full md:w-1/3 max-w-[240px]">
               <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${dar.status === 'PENDING_APPROVAL' ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]' : dar.status === 'WAITING_EFFECTIVE' || dar.status === 'APPROVED_WAITING_EFFECTIVE' || dar.status === 'WAITING_ACKNOWLEDGEMENT' || dar.status === 'EFFECTIVE' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                  <span className="text-xs font-bold text-[#666666] uppercase tracking-wider">ผู้อนุมัติ (Approver)</span>
               </div>
               <p className="font-bold text-[#1E1E1E] text-sm text-center">{workflow.approver?.name || 'รอคำนวณ'}</p>
               <p className="text-xs text-slate-400 mt-0.5">ระดับตำแหน่ง: {workflow.approver?.level || '?'}</p>
             </div>
          </div>
        </div>
      )}

      {dar.status === 'CANCELLED' && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-rose-500 shrink-0" size={24} />
          <div>
            <p className="font-bold text-xs">คำร้องถูกยกเลิก (CANCELLED)</p>
            <p className="text-xs text-rose-700 mt-0.5">ระบบได้ยกเลิกคำร้องนี้โดยอัตโนมัติเนื่องจากเกินกำหนดเวลา SLA (Overdue Day 4) ข้อมูลทั้งหมดอยู่ในสถานะ Read-only</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Data & PDF */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-surface p-6">
            <h3 className="font-bold text-sm text-[#1E293B] uppercase tracking-wider border-b border-[#F1F5F9] pb-3 mb-4">ข้อมูลคำขอดำเนินการเอกสาร (DAR Details)</h3>
            <div className="grid grid-cols-2 gap-y-3.5 gap-x-6 text-sm min-w-0">
              <div className="col-span-2 min-w-0"><span className="text-[#64748B] font-medium w-36 inline-block shrink-0">ชื่อเอกสาร:</span> <span className="font-bold text-[#1E293B] break-all break-words min-w-0 [overflow-wrap:anywhere]">{dar.title}</span></div>
              <div className="min-w-0"><span className="text-[#64748B] font-medium w-36 inline-block shrink-0">รหัสเอกสาร:</span> <span className="font-mono font-bold text-[#007BE5] break-all break-words min-w-0 [overflow-wrap:anywhere]">{docInfo.docCode}</span></div>
              <div className="min-w-0"><span className="text-[#64748B] font-medium w-36 inline-block shrink-0">Revision:</span> <span className="font-mono font-bold text-[#1E293B]">
                {dar.type === 'REVISION' ? `${docInfo.docRev} ➡️ ${String(parseInt(docInfo.docRev || 0, 10) + 1).padStart(2, '0')}` : docInfo.docRev}
              </span></div>
              <div className="min-w-0"><span className="text-[#64748B] font-medium w-36 inline-block shrink-0">หมวดหมู่เอกสาร:</span> <span className="font-medium text-[#1E293B]">{docInfo.docType}</span></div>
              <div className="min-w-0"><span className="text-[#64748B] font-medium w-36 inline-block shrink-0">ประเภทคำร้อง:</span> <span className="font-bold text-[#1E293B]">{dar.type}</span></div>
              <div className="min-w-0"><span className="text-[#64748B] font-medium w-36 inline-block shrink-0">แผนก (Dept):</span> <span className="font-bold text-[#1E293B] font-mono">{dar.department}</span></div>
              <div className="min-w-0"><span className="text-[#64748B] font-medium w-36 inline-block shrink-0">สถานะ:</span> <span className={`font-bold ${dar.status === 'CANCELLED' ? 'text-rose-600' : 'text-[#0D99FF]'}`}>{dar.status}</span></div>
              <div className="min-w-0"><span className="text-[#64748B] font-medium w-36 inline-block shrink-0">วันที่ยื่นคำขอ:</span> <span className="font-mono text-[#1E293B]">{dar.date}</span></div>
              <div className="min-w-0"><span className="text-[#64748B] font-medium w-36 inline-block shrink-0">วันที่มีผลบังคับใช้:</span> <span className="font-mono text-[#1E293B]">{dar.effectiveDate || '-'}</span></div>
              <div className="col-span-2 min-w-0"><span className="text-[#64748B] font-medium w-36 inline-block shrink-0">การแจกจ่าย (Dist.):</span> <span className="font-medium text-[#1E293B] break-all break-words min-w-0 [overflow-wrap:anywhere]">
                {dar.distributions?.length > 0 
                  ? dar.distributions.map(d => d.locationName ? `${d.departmentId} (${d.copyNo ? `Copy ${d.copyNo}: ` : ''}${d.locationName})` : (d.departmentId || d.dept)).join(', ') 
                  : (dar.distributionMode === 'ALL' ? 'ทุกแผนก (All Departments)' : (dar.distributedDepts?.join(', ') || '-'))}
              </span></div>
              <div className="col-span-2 min-w-0"><span className="text-[#64748B] font-medium w-36 inline-block shrink-0">การรับทราบ (Ack):</span> <span className="font-bold text-[#1E293B]">{dar.ackRequirement === 'REQUIRED' ? 'ต้องกดรับทราบ' : 'ไม่ต้องรับทราบ'}</span></div>
              
              <div className="col-span-2 mt-3 pt-3 border-t border-[#F1F5F9] min-w-0">
                <h4 className="text-xs font-bold text-[#64748B] mb-2.5 uppercase tracking-wider">ผู้รับผิดชอบตามขั้นตอน (Workflow Actors)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
                  <div className="min-w-0"><span className="text-[#64748B] font-medium w-32 inline-block shrink-0">ผู้ร้องขอ (Request):</span> <span className="font-medium text-[#1E293B] break-all break-words min-w-0 [overflow-wrap:anywhere]">{dar.requesterName || getActor('Created') || '-'}</span></div>
                  <div className="min-w-0"><span className="text-[#64748B] font-medium w-32 inline-block shrink-0">ผู้ทบทวน (Review):</span> <span className="font-medium text-[#1E293B] break-all break-words min-w-0 [overflow-wrap:anywhere]">{getActor('Reviewed')}</span></div>
                  <div className="min-w-0"><span className="text-[#64748B] font-medium w-32 inline-block shrink-0">ผู้อนุมัติ (Approve):</span> <span className="font-medium text-[#1E293B] break-all break-words min-w-0 [overflow-wrap:anywhere]">{getActor('Approved')}</span></div>
                  {dar.ackRequirement === 'REQUIRED' && (
                    <div className="min-w-0"><span className="text-[#64748B] font-medium w-32 inline-block shrink-0">รับทราบ (Ack):</span> <span className="font-medium text-[#1E293B] break-all break-words min-w-0 [overflow-wrap:anywhere]">{getActor('Acknowledged')}</span></div>
                  )}
                </div>
              </div>
              
              <div className="col-span-2 mt-3 pt-3 border-t border-[#F1F5F9] min-w-0">
                <span className="text-[#64748B] block mb-1.5 font-bold text-xs uppercase">{getDarReason(dar).title}</span> 
                <p className="font-medium text-[#1E293B] bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] break-all break-words min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] leading-relaxed">{getDarReason(dar).value}</p>
              </div>
              <div className="col-span-2 min-w-0">
                <span className="text-[#64748B] block mb-1.5 font-bold text-xs uppercase">{getDarDetail(dar).title}</span> 
                <p className="font-medium text-[#1E293B] bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] break-all break-words min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] leading-relaxed">{getDarDetail(dar).value}</p>
              </div>
            </div>
          </div>
          
          <div className="card-surface p-6 h-96 flex flex-col">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2.5 mb-4">เอกสารแนบ (PDF Preview)</h3>
            <div className="flex-1 bg-[#F5F5F5] flex items-center justify-center rounded-xl border border-[#E5E5E5]">
              <div className="text-center text-slate-400">
                <FileText className="mx-auto mb-2 opacity-50" size={40} strokeWidth={1.5}/>
                <p className="text-xs font-mono">{dar.file || `${dar.title}.pdf`}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Timeline & Comments */}
        <div className="space-y-6">
          <div className="card-surface p-6 max-h-[400px] overflow-y-auto">
            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2.5 mb-4">ประวัติการดำเนินการ (Workflow Timeline)</h3>
            <div className="space-y-4">
              {myTimeline.map((item) => (
                <div key={item.id} className="relative pl-6 border-l-2 border-[#E5F4FF] last:border-0 pb-2">
                  <div className="absolute -left-[9px] top-0 bg-white p-0.5 rounded-full">
                    <CheckCircle className="text-[#0D99FF]" size={16} />
                  </div>
                  <div>
                    <div className="flex justify-between items-start mb-0.5">
                      <p className="font-bold text-[#1E1E1E] text-sm">{item.action}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.date}</p>
                    </div>
                    <p className="text-xs text-[#666666]">โดย: {item.user}</p>
                    {item.comment && !item.isChat && <p className="text-sm text-slate-700 mt-1.5 bg-[#F5F5F5] p-2.5 rounded-xl border border-slate-100 leading-relaxed">{item.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Comments */}
          <DARComments darId={dar.id} requesterId={dar.requesterId} />
        </div>
      </div>

      <DarReviewModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        dar={dar}
        role="VIEWER"
        readOnly={true}
      />
    </div>
  );
};

export default DarDetail;
