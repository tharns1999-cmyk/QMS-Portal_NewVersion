import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useStore from '../../store/useStore';
import { normalizeDepartmentId } from '../../services/MasterDataService';
import { FileText, XCircle, ChevronLeft, Download, MessageSquare, ShieldAlert, Zap, Globe, Lock, Building2, X, RotateCcw, Check, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { getDarReason, getDarDetail, getDarDocInfo, getRequesterName } from '../../utils/darHelper';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';
import DarReviewModal from '../../components/workflow/DarReviewModal';
import { ACCESS_SCOPE_METADATA } from '../../utils/accessControl';

const TaskApprove = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { masterDepartments = [], tasks = [], completedTasks = [], dars = [], documents = [], timeline = [], processWorkflow, currentUser, canDownloadDocument, masterUsers = [] } = useStore();
  
  const [comment, setComment] = useState('');
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const scrollRef = useRef(null);

  const allTasks = useMemo(() => {
    return [...(tasks || []), ...(completedTasks || [])];
  }, [tasks, completedTasks]);

  const task = allTasks.find(t => String(t.id) === String(id) || String(t.taskId) === String(id));
  const dar = task 
    ? (dars || []).find(d => String(d.id) === String(task.darId) || d.darNo === task.darId || d.darNumber === task.darId) 
    : (dars || []).find(d => String(d.id) === String(id) || d.darNo === id || d.darNumber === id);
  const darTimeline = dar ? (timeline || []).filter(t => String(t.darId) === String(dar.id)) : [];

  // Dynamic extraction and assembly of approvalWorkflow for DAR
  const darWithWorkflow = useMemo(() => {
    if (!dar) return null;
    if (dar.approvalWorkflow && Array.isArray(dar.approvalWorkflow)) return dar;

    const dccUser = (masterUsers || []).find(u => u && (u.isDcc || u.role === 'DCC_ADMIN'));
    const dccName = dccUser ? (dccUser.fullName || dccUser.name) : 'เจ้าหน้าที่ DCC';

    return {
      ...dar,
      approvalWorkflow: [
        {
          step: 1,
          roleKey: 'REQUESTER',
          role: 'ผู้ร้องขอ',
          name: dar.requesterName || dar.requester_name || 'ผู้ร้องขอ',
          assignedTo: dar.requesterName || dar.requester_name || 'ผู้ร้องขอ'
        },
        {
          step: 2,
          roleKey: 'REVIEWER',
          role: 'ผู้ทบทวน',
          name: dar.reviewerName || dar.reviewer_name || 'ผู้ทบทวน',
          assignedTo: dar.reviewerName || dar.reviewer_name || 'ผู้ทบทวน'
        },
        {
          step: 3,
          roleKey: 'APPROVER',
          role: dar.approverRole || 'Approver',
          name: dar.approverName || currentUser?.name || 'ผู้อนุมัติ',
          assignedTo: dar.approverName || currentUser?.name || 'ผู้อนุมัติ'
        },
        {
          step: 4,
          roleKey: 'DCC',
          role: 'เจ้าหน้าที่ DCC (ตรวจสอบและประกาศใช้)',
          name: dccName,
          assignedTo: dccName
        }
      ]
    };
  }, [dar, currentUser, masterUsers]);

  // Harmonized workflow signatories list
  const workflowSignatories = useMemo(() => {
    const list = darWithWorkflow?.approvalWorkflow || dar?.approvalWorkflow;
    return (list && Array.isArray(list)) ? list : [];
  }, [darWithWorkflow, dar]);

  // Find index of current step / Approver
  const approverStepIndex = useMemo(() => {
    return workflowSignatories.findIndex(s => 
      s.roleKey === 'APPROVER' || 
      (currentUser && (s.id === currentUser.id || s.name === currentUser.name || s.assignedTo === currentUser.name))
    );
  }, [workflowSignatories, currentUser]);

  const subsequentSteps = useMemo(() => {
    return approverStepIndex >= 0 
      ? workflowSignatories.slice(approverStepIndex + 1)
      : workflowSignatories.filter(s => s.roleKey !== 'REQUESTER' && s.roleKey !== 'REVIEWER' && s.roleKey !== 'APPROVER');
  }, [workflowSignatories, approverStepIndex]);

  // Check if DCC step is configured
  const dccStep = useMemo(() => {
    return subsequentSteps.find(s => 
      s.roleKey === 'DCC' || 
      s.roleKey === 'DCC_ADMIN' || 
      s.role === 'DCC' || 
      (typeof s.role === 'string' && s.role.toUpperCase().includes('DCC'))
    );
  }, [subsequentSteps]);

  const isFinalStep = subsequentSteps.length === 0 || (!dccStep && subsequentSteps.every(s => s.roleKey === 'COMPLETED' || !s.roleKey));

  // Determine next destination details preventing self-targeting
  const nextDestination = useMemo(() => {
    if (pendingAction !== 'APPROVE') return null;

    if (dccStep) {
      return {
        type: 'DCC',
        label: 'ส่งมอบงานต่อให้ Document Control Center (DCC)',
        title: 'ส่งมอบงานต่อให้ Document Control Center (DCC)',
        subtitle: 'เพื่อดำเนินการขึ้นทะเบียน ประทับตรา และแจกจ่ายสำเนาควบคุมตามระเบียบ',
        name: dccStep.name || dccStep.assignedTo || 'Document Control Center (DCC)',
        role: dccStep.role || 'DCC'
      };
    }

    if (isFinalStep) {
      return {
        type: 'COMPLETED',
        label: 'สิ้นสุดขั้นตอนการอนุมัติ (Approval Completed)',
        title: 'สิ้นสุดขั้นตอนการอนุมัติ (Approval Completed)',
        subtitle: 'เอกสารจะถูกปรับสถานะเป็น "มีผลบังคับใช้ (Active)" ทันที',
        name: 'Approval Completed',
        role: 'มีผลบังคับใช้ (Active)'
      };
    }

    // Safety check: ensure next signatory is NOT the current actor
    const nextValid = subsequentSteps.find(s => 
      (!currentUser?.id || s.id !== currentUser.id) &&
      (!currentUser?.name || (s.name !== currentUser.name && s.assignedTo !== currentUser.name))
    );

    if (nextValid) {
      return {
        type: 'SIGNATORY',
        label: `ส่งต่อไปยัง: ${nextValid.name} (${nextValid.role})`,
        title: 'ส่งต่อเพื่อพิจารณาขั้นถัดไป',
        name: nextValid.name || nextValid.assignedTo,
        role: nextValid.role
      };
    }

    return {
      type: 'COMPLETED',
      label: 'สิ้นสุดขั้นตอนการอนุมัติ (Approval Completed)',
      title: 'สิ้นสุดขั้นตอนการอนุมัติ (Approval Completed)',
      subtitle: 'เอกสารจะถูกปรับสถานะเป็น "มีผลบังคับใช้ (Active)" ทันที',
      name: 'Approval Completed',
      role: 'มีผลบังคับใช้ (Active)'
    };
  }, [pendingAction, dccStep, isFinalStep, subsequentSteps, currentUser]);

  useEffect(() => {
    // If PDF container is small enough that it doesn't scroll, unlock immediately
    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollHeight, clientHeight } = scrollRef.current;
        if (scrollHeight <= clientHeight) {
          setHasReadToBottom(true);
        }
      }
    };
    checkScroll();
  }, []);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setHasReadToBottom(true);
    }
  };

  const isCompletedTask = Boolean(
    task && (
      task.status === 'COMPLETED' || 
      task.status === 'RESOLVED' || 
      task.status === 'APPROVED' || 
      task.is_completed === true
    )
  );

  if (isCompletedTask) {
    const completedActor = task?.completedBy || task?.assigneeName || currentUser?.name || 'ผู้อนุมัติ';
    const completedTime = task?.completedAt || task?.updatedAt || task?.timestamp;

    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
        <div className="card-surface p-8 text-center max-w-md shadow-xs border border-emerald-200/80 rounded-2xl bg-white animate-in fade-in zoom-in-95 duration-150">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-2xs">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            คำร้องนี้ได้รับการอนุมัติเสร็จสิ้นแล้ว
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1 leading-snug">
            {dar?.title || task?.title || 'งานอนุมัติเอกสารเสร็จสมบูรณ์'}
          </h2>
          <p className="text-xs text-slate-500 font-mono mb-2">
            รหัสงาน: <span className="font-bold text-slate-700">{task?.id || id}</span>
            {dar?.darNumber && <span> • DAR: <span className="font-bold text-slate-700">{dar.darNumber}</span></span>}
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            อนุมัติเสร็จสิ้นโดย <span className="font-semibold text-slate-700">{completedActor}</span>
            {completedTime && (
              <span className="block mt-0.5 text-[11px] text-slate-400">
                เมื่อ {new Date(completedTime).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.
              </span>
            )}
          </p>
          <button 
            type="button"
            onClick={() => navigate('/dcc/tasks', { replace: true })} 
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft size={14} /> กลับสู่หน้ารายการงาน (Task Inbox)
          </button>
        </div>
      </div>
    );
  }

  if (!task || !dar) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
        <div className="card-surface p-8 text-center max-w-md shadow-xs border border-slate-200 rounded-2xl bg-white">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mx-auto mb-4 text-amber-600">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1.5">ไม่พบข้อมูลคำร้องหรือภารกิจนี้</h2>
          <p className="text-xs text-slate-500 leading-relaxed mb-1">
            รหัสงาน: <span className="font-mono font-bold text-slate-700">{id || '-'}</span>
          </p>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            คำร้องนี้อาจถูกประมวลผลเสร็จสิ้นแล้ว หรือไม่มีอยู่ในระบบฐานข้อมูลปัจจุบัน
          </p>
          <button 
            type="button"
            onClick={() => navigate('/dcc/tasks', { replace: true })} 
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft size={14} /> กลับสู่หน้ารายการงาน (Task Inbox)
          </button>
        </div>
      </div>
    );
  }

  const isAssignee = !currentUser || !task.assigneeId || 
    task.assigneeId === currentUser?.id || 
    task.assigneeId === currentUser?.empId || 
    task.assigneeName === currentUser?.name ||
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'DCC_ADMIN' ||
    currentUser?.isDcc;

  if (!isAssignee) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
        <div className="card-surface p-8 text-center max-w-md shadow-xs border border-rose-200 rounded-2xl bg-white">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center mx-auto mb-4 text-rose-500">
            <XCircle size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1.5">ไม่มีสิทธิ์เข้าถึงงานนี้</h2>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            งานนี้ถูกมอบหมายให้ผู้อนุมัติท่านอื่น หรือคุณไม่มีสิทธิ์เข้าถึงงานในขั้นตอนนี้
          </p>
          <button 
            type="button"
            onClick={() => navigate('/dcc/tasks', { replace: true })} 
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft size={14} /> กลับสู่หน้ารายการงาน (Task Inbox)
          </button>
        </div>
      </div>
    );
  }

  // Use a pseudo-document for access rules since DAR is not in documents array yet
  const pseudoDoc = { department: dar.department, distributedTo: dar.distributedDepts || [] };
  const canDownload = canDownloadDocument ? canDownloadDocument(pseudoDoc, currentUser) : false;
  const docInfo = getDarDocInfo(dar, documents) || { docCode: '-', docType: '-', docRev: '-' };
  const requesterName = getRequesterName(dar, masterUsers) || 'ผู้ร้องขอ';
  const accessScope = dar.access_control?.scope || dar.access_scope || 'GENERAL';
  const scopeMeta = ACCESS_SCOPE_METADATA[accessScope] || ACCESS_SCOPE_METADATA.GENERAL;

  const handleAction = (action) => {
    if (!hasReadToBottom) {
      toast.error('กรุณาเลื่อนอ่านเอกสารให้ครบทุกหน้าก่อนตัดสินใจ');
      return;
    }
    if ((action === 'RETURN' || action === 'REJECT') && !comment) {
      toast.error('กรุณาระบุเหตุผล (Comment) สำหรับการตีกลับหรือไม่อนุมัติ');
      return;
    }
    setPendingAction(action);
    setShowConfirm(true);
  };

  const executeAction = async () => {
    setShowConfirm(false);
    try {
      await processWorkflow(task.id, pendingAction, comment);
      const actionText = pendingAction === 'APPROVE' 
        ? 'อนุมัติเอกสารสำเร็จแล้ว' 
        : pendingAction === 'REJECT' 
          ? 'ไม่อนุมัติคำร้องเรียบร้อยแล้ว' 
          : 'ส่งกลับแก้ไขเรียบร้อยแล้ว';
      toast.success(actionText);
      navigate('/dcc/tasks', { replace: true });
    } catch (error) {
      console.error('Approval Crash:', error);
      toast.error(`เกิดข้อผิดพลาด: ${error.message || 'ระบบขัดข้อง'}`);
    }
  };

  return (
    <div 
      className="h-[calc(100vh-100px)] flex gap-4 overflow-hidden -mx-4 -mb-8 px-4 pb-4 transition-all duration-200 ease-out"
    >
      {/* LEFT COLUMN: Details & Chat (40%) */}
      <div className="w-[40%] flex flex-col card-surface overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-[#F5F5F5]/80 flex items-center justify-between shadow-xs z-10">
           <button onClick={() => navigate('/dcc/tasks')} className="flex items-center text-xs font-bold text-slate-600 hover:text-[#0D99FF] transition-colors">
             <ChevronLeft className="mr-1" size={16} /> ย้อนกลับ
           </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsInspectorOpen(true)}
                className="flex items-center px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-all cursor-pointer"
                title="เปิดหน้าต่างเอกสารฉบับเต็ม"
              >
                เอกสารฉบับเต็ม
              </button>
              <h2 className="font-bold text-[#1E1E1E] text-sm flex items-center gap-2">
               <FileText className="text-purple-600" size={16} /> อนุมัติเอกสาร
             </h2>
           </div>
        </div>

        {/* Scrollable Details & Timeline */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F5F5F5]/40 hide-scrollbar">
          
          {/* DAR Summary Card */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]/80 shadow-xs space-y-3">
            <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-xs text-slate-400 uppercase tracking-wider font-bold">คำร้องขอเอกสาร (DAR)</h3>
                  <p className="text-xl font-bold text-[#1E1E1E] font-mono mt-0.5">
                    {dar.darNumber || (dar.isDraft || dar.status === 'DRAFT' || String(dar.id).startsWith('draft_') ? 'ยังไม่ได้ระบุ (Draft)' : dar.id)}
                  </p>
               </div>
               <span className="badge-system">{dar.type}</span>
            </div>
            
            <div className="space-y-2 text-xs text-slate-700">
               <p><span className="text-slate-400 w-24 inline-block font-medium">ชื่อเอกสาร:</span> <span className="font-bold text-[#1E1E1E]">{dar.title}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">รหัสเอกสาร:</span> <span className="font-mono font-bold text-[#007BE5]">{docInfo.docCode}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">ประเภท:</span> <span className="font-medium">{docInfo.docType}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">ฉบับที่:</span> <span className="font-mono font-bold">
                 {dar.type === 'REVISION' ? `${docInfo.docRev} ➡️ ${String(parseInt(docInfo.docRev || 0, 10) + 1).padStart(2, '0')}` : docInfo.docRev}
               </span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">แผนกเจ้าของ:</span> <span className="font-bold font-mono">{(() => { const d = normalizeDepartmentId(dar.department); const dObj = masterDepartments.find(md => normalizeDepartmentId(md.id) === d); return dObj ? `${d} - ${dObj.nameTh || dObj.name}` : (d || '-'); })()}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">ผู้ร้องขอ:</span> <span className="font-bold text-[#1E1E1E]">{requesterName}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">วันบังคับใช้:</span> <span className="font-mono font-bold text-emerald-700">{dar.effectiveDate || '-'}</span></p>
               {task?.dueDate && (
                 <p className="flex items-center gap-1.5 flex-wrap pt-0.5">
                   <span className="text-slate-400 w-24 inline-block font-medium">วันครบกำหนด:</span>
                   <span className={`font-mono font-bold ${task.isUrgent || task.slaType === 'FAST_TRACK' ? 'text-amber-700' : 'text-slate-700'}`}>
                     {task.dueDate}
                   </span>
                   {(task.isUrgent || task.slaType === 'FAST_TRACK') && (
                     <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                       <Zap size={10} className="fill-amber-500 text-amber-600" />
                       <span>งานด่วน (Fast-Track)</span>
                     </span>
                   )}
                 </p>
               )}
               
               {/* Confidentiality Pill */}
               <div className="flex items-center gap-2 pt-1">
                 <span className="text-slate-400 w-24 inline-block font-medium">ระดับความลับ:</span>
                 <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${scopeMeta.badgeClass}`}>
                   {accessScope === 'GENERAL' && <><Globe size={13} strokeWidth={1.5} /><span>ทั่วไป</span></>}
                   {accessScope === 'DEPT_ONLY' && <><Lock size={13} strokeWidth={1.5} /><span>เฉพาะแผนก</span></>}
                   {accessScope === 'TARGETED' && <><Building2 size={13} strokeWidth={1.5} /><span>เฉพาะบางแผนก</span></>}
                   {accessScope === 'RESTRICTED' && <><ShieldAlert size={13} strokeWidth={1.5} /><span>ลับเฉพาะ (Lv.{dar.access_control?.min_access_level || 4}+)</span></>}
                 </span>
               </div>

               {/* Related Standards */}
               {(dar.relatedStandards || dar.standards)?.length > 0 && (
                 <div className="flex items-center gap-1.5 pt-1">
                   <span className="text-slate-400 w-24 inline-block font-medium">มาตรฐาน:</span>
                   <div className="flex flex-wrap gap-1">
                     {(dar.relatedStandards || dar.standards).map(s => (
                       <span key={s} className="px-1.5 py-0.2 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] font-medium">
                         {s}
                       </span>
                     ))}
                   </div>
                 </div>
               )}

                <div className="pt-2.5 mt-2.5 border-t border-slate-100 space-y-2 text-xs">
                  <div className="grid grid-cols-[100px_1fr] gap-2 items-start min-w-0">
                    <span className="text-slate-500 font-bold shrink-0">
                      {getDarReason(dar).title}:
                    </span>
                    <div className="min-w-0 text-slate-800 font-normal leading-relaxed break-words break-all whitespace-pre-wrap [overflow-wrap:anywhere] bg-slate-50 border border-slate-200/70 rounded-lg p-2">
                      {getDarReason(dar).value}
                    </div>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-2 items-start min-w-0">
                    <span className="text-slate-500 font-bold shrink-0">
                      {getDarDetail(dar).title}:
                    </span>
                    <div className="min-w-0 text-slate-800 font-normal leading-relaxed break-words break-all whitespace-pre-wrap [overflow-wrap:anywhere] bg-slate-50 border border-slate-200/70 rounded-lg p-2">
                      {getDarDetail(dar).value}
                    </div>
                  </div>
                </div>
            </div>
          </div>

          {/* Timeline / Chat */}
          <div className="flex flex-col gap-3">
             <h4 className="text-xs font-bold text-[#666666] uppercase tracking-wider flex items-center gap-1.5">
               <MessageSquare size={16} /> ประวัติและข้อคิดเห็น (Workflow History)
             </h4>
             {darTimeline.map(tl => (
               <div key={tl.id} className={`flex flex-col ${tl.userId === currentUser?.id ? 'items-end' : 'items-start'}`}>
                 <div className="flex items-baseline gap-1.5 mb-1 px-1">
                   <span className="text-xs font-bold text-slate-700">{tl.user}</span>
                   <span className="text-xs text-slate-400 font-mono">{tl.date}</span>
                 </div>
                 <div className={`p-3.5 rounded-xl max-w-[90%] text-sm shadow-xs leading-relaxed ${tl.userId === currentUser?.id ? 'bg-[#0D99FF] text-white rounded-tr-sm' : 'bg-white border border-[#E5E5E5] text-slate-800 rounded-tl-sm'}`}>
                    {tl.isChat ? (
                      <p>{tl.comment}</p>
                    ) : (
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold mb-1 ${tl.userId === currentUser?.id ? 'bg-white/20 text-white' : 'bg-[#F5F5F5] text-slate-700'}`}>
                           {tl.action}
                        </span>
                        <p>{tl.comment}</p>
                      </div>
                    )}
                 </div>
               </div>
             ))}
          </div>
        </div>

        {/* Action Panel (Fixed Bottom) */}
        <div className="p-4 bg-white border-t border-slate-100 shadow-xs z-10">
          <textarea
            rows="3"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-hidden resize-none min-h-[88px]"
            placeholder="ระบุเหตุผล ข้อเสนอแนะ หรือสิ่งที่ต้องปรับปรุงเพิ่มเติม..."
          />
          <div className="flex items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-100">
            {/* Left: Destructive Action */}
            <button
              disabled={!hasReadToBottom}
              onClick={() => handleAction('REJECT')}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="ไม่อนุมัติและยกเลิกคำขอนี้ทันที"
            >
              <X size={15} /> ไม่อนุมัติ (Reject)
            </button>

            {/* Right: Primary & Revision Actions */}
            <div className="flex items-center gap-2.5">
              <button
                disabled={!hasReadToBottom}
                onClick={() => handleAction('RETURN')}
                className="inline-flex items-center gap-1.5 h-9 px-4 py-2 rounded-xl text-xs font-medium text-amber-700 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/80 transition-all whitespace-nowrap shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="ส่งกลับไปให้ Requester แก้ไข"
              >
                <RotateCcw size={14} /> ส่งกลับแก้ไข (Return)
              </button>
              <button
                disabled={!hasReadToBottom}
                onClick={() => handleAction('APPROVE')}
                className="inline-flex items-center gap-1.5 h-9 px-5 py-2 rounded-xl text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-xs shadow-emerald-600/20 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="อนุมัติคำขอ"
              >
                <Check size={15} /> อนุมัติ (Approve)
              </button>
            </div>
          </div>
          {!hasReadToBottom && (
            <p className="text-xs text-rose-500 text-center mt-2 font-medium">⚠️ กรุณาเลื่อนอ่านเอกสารทางขวาให้จบเพื่อปลดล็อคปุ่ม</p>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: PDF Viewer (60%) */}
      <div className="w-[60%] flex flex-col bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-800">
        
        {/* PDF Toolbar */}
        <div className="bg-slate-800 text-slate-200 px-4 py-3 flex items-center justify-between shadow-xs z-10">
          <div className="font-mono text-xs truncate pr-4 text-slate-300 font-bold">
            {dar.title}.pdf (โหมดการพิจารณาอนุมัติขั้นสุดท้าย)
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
            {canDownload ? (
              <button className="action-icon-btn text-[#0D99FF] hover:text-[#0D99FF] hover:bg-slate-700" title="ดาวน์โหลดเอกสาร">
                <Download size={16} />
              </button>
            ) : (
              <button className="action-icon-btn opacity-40 cursor-not-allowed text-[#666666]" title="ดูตัวอย่างเท่านั้น">
                <Download size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable PDF Canvas */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 bg-slate-700/80 custom-scrollbar"
        >
           {/* Mock PDF Pages */}
           <div className="max-w-3xl mx-auto space-y-6">
             <div className="bg-white w-full h-[800px] shadow-none p-10 relative rounded-lg">
               <h1 className="text-2xl font-bold text-center mb-6 border-b pb-3 text-[#1E1E1E]">{dar.title}</h1>
               <h2 className="text-base font-bold text-slate-800 mb-2">1. วัตถุประสงค์ (Purpose)</h2>
               <p className="text-xs text-slate-700 leading-relaxed mb-6">
                 เอกสารฉบับนี้กำหนดมาตรฐานการปฏิบัติงานสำหรับแผนก {(() => { const d = normalizeDepartmentId(dar.department); const dObj = masterDepartments.find(md => normalizeDepartmentId(md.id) === d); return dObj ? `${d} - ${dObj.nameTh || dObj.name}` : (d || '-'); })()} เพื่อใช้เป็นแนวทางปฏิบัติงานตามข้อกำหนดระบบบริหารคุณภาพ ISO 9001 / FSSC 22000
                 {dar.requestDetail}
               </p>
               <h2 className="text-base font-bold text-slate-800 mb-2">2. ขอบเขต (Scope)</h2>
               <p className="text-xs text-slate-700 leading-relaxed">
                 ครอบคลุมบุคลากรและกระบวนการทำงานที่เกี่ยวข้องทั้งหมดในสังกัด {(() => { const d = normalizeDepartmentId(dar.department); const dObj = masterDepartments.find(md => normalizeDepartmentId(md.id) === d); return dObj ? `${d} - ${dObj.nameTh || dObj.name}` : (d || '-'); })()}
               </p>
               <div className="absolute bottom-8 left-0 right-0 text-center text-slate-400 text-xs font-mono">หน้า 1 จาก 2</div>
             </div>

             <div className="bg-white w-full h-[800px] shadow-none p-10 relative flex flex-col rounded-lg">
               <h2 className="text-base font-bold text-slate-800 mb-3">3. ขั้นตอนการปฏิบัติงาน (Procedures)</h2>
               <ul className="list-disc pl-5 space-y-2 text-xs text-slate-700 flex-1 leading-relaxed">
                 <li>ตรวจสอบความพร้อมของวัตถุดิบและอุปกรณ์ก่อนเริ่มกระบวนการ</li>
                 <li>ทำการตรวจวัดค่าควบคุมคุณภาพ ณ จุดตรวจสอบมาตรฐาน</li>
                 <li>บันทึกผลการปฏิบัติงานลงในแบบฟอร์มบันทึกควบคุม</li>
                 <li>หากพบข้อบกพร่อง ให้รายงานผู้บังคับบัญชาทันทีตามขั้นตอน CAPA</li>
               </ul>
               <div className="mt-auto p-3 bg-[#F5F5F5] rounded-lg text-center font-bold text-[#666666] border border-[#E5E5E5] text-xs">
                 --- จบเอกสาร (END OF DOCUMENT) ---
               </div>
               <div className="absolute bottom-8 left-0 right-0 text-center text-slate-400 text-xs font-mono">หน้า 2 จาก 2</div>
             </div>
           </div>
        </div>

      </div>

      <ActionConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executeAction}
        title={pendingAction === 'APPROVE' ? 'ยืนยันการอนุมัติเอกสาร (Approve DAR)' : pendingAction === 'REJECT' ? 'ยืนยันการไม่อนุมัติ (Reject DAR)' : 'ยืนยันการส่งกลับแก้ไข (Request Revision)'}
        actionType={pendingAction === 'APPROVE' ? 'approve' : 'reject'}
        confirmText={pendingAction === 'APPROVE' ? 'ยืนยันการอนุมัติเอกสาร' : pendingAction === 'REJECT' ? 'ยืนยันไม่อนุมัติคำร้อง' : 'ยืนยันส่งกลับแก้ไข'}
        cancelText="ยกเลิก / กลับไปตรวจสอบ"
        dar={darWithWorkflow}
        currentActor={currentUser}
        currentStep="APPROVER"
        workflowSignatories={workflowSignatories}
        summaryData={[
          { label: 'ผู้อนุมัติ', value: `${currentUser?.name || 'ผู้อนุมัติ'} (${currentUser?.department || '-'})` },
          { label: 'เอกสาร', value: dar ? `[${getDarDocInfo(dar, documents).docCode}] ${dar.title}` : '-' },
          { label: 'ผลการพิจารณา', value: pendingAction === 'APPROVE' ? 'อนุมัติประกาศใช้ (Approved)' : pendingAction === 'REJECT' ? 'ไม่อนุมัติคำร้อง (Rejected)' : 'ส่งกลับแก้ไข (Revision Required)' },
          { label: 'ความเห็นประกอบ', value: comment || '-' },
          { 
            label: 'สายการอนุมัติถัดไป', 
            value: pendingAction === 'APPROVE' 
              ? (nextDestination?.label || (dccStep ? 'ส่งมอบงานต่อให้ Document Control Center (DCC)' : 'สิ้นสุดขั้นตอนการอนุมัติ (Approval Completed)'))
              : pendingAction === 'REJECT' 
                ? 'สิ้นสุดคำร้อง: ส่งเข้าคลังประวัติ (ไม่อนุมัติ)' 
                : 'ส่งกลับไปยัง: ผู้ร้องขอ (แก้ไขคำร้อง)' 
          }
        ]}
      />

      <DarReviewModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        dar={dar}
        role="APPROVER"
        onApprove={(modalComment) => {
          setComment(modalComment || comment);
          setIsInspectorOpen(false);
          setPendingAction('APPROVE');
          setShowConfirm(true);
        }}
        onReturn={(modalComment) => {
          setComment(modalComment || comment);
          setIsInspectorOpen(false);
          setPendingAction('RETURN');
          setShowConfirm(true);
        }}
        onReject={(modalComment) => {
          setComment(modalComment || comment);
          setIsInspectorOpen(false);
          setPendingAction('REJECT');
          setShowConfirm(true);
        }}
      />
    </div>
  );
};

export default TaskApprove;
