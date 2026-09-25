import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import { normalizeDepartmentId } from '../../services/MasterDataService';
import toast from 'react-hot-toast';
import { getDarReason, getDarDetail, getDarDocInfo, getRequesterName } from '../../utils/darHelper';
import { FileText, XCircle, ChevronLeft, Download, MessageSquare, ShieldAlert, Zap, Globe, Lock, Building2, RotateCcw, Check } from 'lucide-react';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';
import DarReviewModal from '../../components/workflow/DarReviewModal';
import { ACCESS_SCOPE_METADATA } from '../../utils/accessControl';
import { resolveApprover } from '../../utils/workflowResolver';
import { getFile, resolveFileBlob } from '../../utils/fileStorage';

const TaskReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { masterDepartments = [], tasks = [], dars = [], timeline = [], processWorkflow, currentUser, canDownloadDocument, documents = [], masterUsers = [] } = useStore();
  
  const [comment, setComment] = useState('');
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const scrollRef = useRef(null);

  const task = (tasks || []).find(t => String(t.id) === String(id) || String(t.taskId) === String(id));
  const dar = task ? (dars || []).find(d => String(d.id) === String(task.darId) || d.darNo === task.darId || d.darNumber === task.darId) : null;
  const darTimeline = dar ? timeline.filter(t => t.darId === dar.id) : [];

  useEffect(() => {
    let url = null;
    let isCancelled = false;
    if (dar) {
      setLoadingPdf(true);
      resolveFileBlob(dar, dar.attachedFile?.fileId).then((fileBlob) => {
        if (!isCancelled) {
          if (fileBlob) {
            url = URL.createObjectURL(fileBlob);
            setPdfBlobUrl(url);
          } else {
            setPdfBlobUrl(null);
          }
          setLoadingPdf(false);
        }
      }).catch(err => {
        console.error('Error loading PDF blob:', err);
        if (!isCancelled) {
          setPdfBlobUrl(null);
          setLoadingPdf(false);
        }
      });
    } else {
      setPdfBlobUrl(null);
    }
    return () => {
      isCancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [dar]);

  // Dynamic extraction and assembly of approvalWorkflow for DAR
  const darWithWorkflow = useMemo(() => {
    if (!dar) return null;
    if (dar.approvalWorkflow && Array.isArray(dar.approvalWorkflow)) return dar;

    // Resolve approver dynamically (strictly no hardcoding)
    let approverName = dar.approverName || dar.approver_name || (typeof dar.approver === 'string' ? dar.approver : dar.approver?.name);
    let approverRole = dar.approverRole || 'Approver';
    
    if (!approverName && (dar.approverId || dar.approver_id || dar.manualApproverId)) {
      const aId = dar.approverId || dar.approver_id || dar.manualApproverId;
      const user = (masterUsers || []).find(u => u && u.id === aId);
      if (user) {
        approverName = user.name || user.fullName;
        approverRole = user.position || approverRole;
      }
    }

    if (!approverName) {
      try {
        const resolved = typeof resolveApprover === 'function' ? resolveApprover(
          dar.requesterId || dar.requester_id,
          task?.assigneeId || currentUser?.id,
          dar.department || 'PD',
          masterUsers || [],
          masterUsers || [],
          dar.docType || dar.doc_type,
          null
        ) : null;
        if (resolved) {
          const user = (masterUsers || []).find(u => u && u.id === (resolved.id || resolved));
          approverName = user ? (user.name || user.fullName) : (resolved.name || 'ผู้อนุมัติ (Approver)');
          approverRole = user?.position || approverRole;
        }
      } catch (err) {
        console.warn('Could not auto-resolve approver in TaskReview:', err);
      }
    }

    const finalApproverName = approverName || 'ผู้อนุมัติ (Approver)';

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
          name: dar.reviewerName || dar.reviewer_name || currentUser?.name || 'ผู้ทบทวน',
          assignedTo: dar.reviewerName || dar.reviewer_name || currentUser?.name || 'ผู้ทบทวน'
        },
        {
          step: 3,
          roleKey: 'APPROVER',
          role: approverRole,
          name: finalApproverName,
          assignedTo: finalApproverName
        },
        {
          step: 4,
          roleKey: 'DCC',
          role: 'DCC Admin',
          name: 'ธนาวุฒิ สมควรกิจดำรง (เจ้าหน้าที่ DCC)',
          assignedTo: 'ธนาวุฒิ สมควรกิจดำรง'
        }
      ]
    };
  }, [dar, task, currentUser, masterUsers]);

  // หาข้อมูล Approver จาก approvalWorkflow array (STRICT DYNAMIC BINDING)
  const nextSignatory = useMemo(() => {
    const currentDar = darWithWorkflow || dar;
    if (!currentDar || !currentDar.approvalWorkflow) return null;
    
    // หากเป็นโหมด Review -> ขั้นต่อไปคือ APPROVER
    return currentDar.approvalWorkflow.find(step => step.roleKey === 'APPROVER');
  }, [darWithWorkflow, dar]);

  // ดึงค่ามาเตรียมแสดงผล
  const nextActorName = nextSignatory?.name || nextSignatory?.assignedTo || 'ผู้อนุมัติ (Approver)';
  const nextActorRole = nextSignatory?.role || 'Approver';

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
    // Add 10px threshold for easier triggering
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setHasReadToBottom(true);
    }
  };

  if (!task || !dar) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
        <div className="card-surface p-8 text-center max-w-md shadow-xs border border-slate-200 rounded-2xl bg-white">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mx-auto mb-4 text-amber-600">
            <ShieldAlert size={28} />
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
            onClick={() => navigate('/tasks')} 
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-all cursor-pointer shadow-xs"
          >
            <ChevronLeft size={14} /> กลับสู่หน้ารายการงาน (Task Inbox)
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
            คุณไม่มีสิทธิ์เข้าถึงงานนี้ หรือเป็นงานที่ถูกมอบหมายให้เจ้าหน้าที่ท่านอื่น
          </p>
          <button 
            type="button"
            onClick={() => navigate('/tasks')} 
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-all cursor-pointer shadow-xs"
          >
            <ChevronLeft size={14} /> กลับสู่หน้ารายการงาน (Task Inbox)
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
    if (action === 'RETURN' && !comment) {
      toast.error('กรุณาระบุเหตุผลการส่งคืน (Comment)');
      return;
    }
    setPendingAction(action);
    setShowConfirm(true);
  };

  const executeAction = () => {
    try {
      processWorkflow(task.id, pendingAction, comment);
      toast.success(`ดำเนินการ ${pendingAction === 'APPROVE' ? 'ผ่านการทบทวน' : 'ส่งกลับแก้ไข'} สำเร็จ`);
      setShowConfirm(false);
      navigate('/tasks');
    } catch (error) {
      console.error('Review Action Crash:', error);
      toast.error(`เกิดข้อผิดพลาด: ${error.message || 'ระบบขัดข้อง'}`);
      setShowConfirm(false);
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
           <button onClick={() => navigate('/tasks')} className="flex items-center text-xs font-bold text-slate-600 hover:text-[#0D99FF] transition-colors">
             <ChevronLeft className="mr-1" size={16} /> ย้อนกลับ
           </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsInspectorOpen(true)}
                className="flex items-center px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#007BE5] border border-blue-200 text-xs font-bold transition-all cursor-pointer"
                title="เปิดหน้าต่างเอกสารฉบับเต็ม"
              >
                เอกสารฉบับเต็ม
              </button>
              <h2 className="font-bold text-[#1E1E1E] text-sm flex items-center gap-2">
               <FileText className="text-[#0D99FF]" size={16} /> ทบทวนเอกสาร
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
          <div className="flex items-center justify-end gap-2.5 pt-3 mt-2 border-t border-slate-100">
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
              title="ผ่านการทบทวน"
            >
              <Check size={15} /> ผ่านการทบทวน (Approve Review)
            </button>
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
            {dar.title}.pdf
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
           {/* Native PDF Viewer */}
           <div className="w-full h-full min-h-[800px] relative rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center border border-slate-700">
             {loadingPdf ? (
               <div className="text-slate-400 font-medium animate-pulse flex flex-col items-center gap-3">
                 <FileText size={32} className="text-slate-500" />
                 <span>กำลังโหลดไฟล์เอกสารฉบับจริง...</span>
               </div>
             ) : pdfBlobUrl ? (
               <iframe
                 src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                 className="w-full h-full border-0 absolute inset-0"
                 title="PDF Preview"
               />
             ) : (
               <div className="text-slate-500 font-medium flex flex-col items-center gap-3">
                 <ShieldAlert size={40} className="text-slate-600" />
                 <span>ไม่พบไฟล์เอกสารอ้างอิงจริง (No attached file)</span>
               </div>
             )}
           </div>
        </div>

      </div>

      <ActionConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executeAction}
        title={pendingAction === 'APPROVE' ? 'ยืนยันการผ่านการทบทวนเอกสาร (Review DAR)' : 'ยืนยันการส่งกลับแก้ไข (Request Revision)'}
        actionType={pendingAction === 'APPROVE' ? 'review' : 'reject'}
        confirmText={pendingAction === 'APPROVE' ? 'ยืนยันผ่านการทบทวน' : 'ยืนยันส่งกลับแก้ไข'}
        cancelText="ยกเลิก / กลับไปตรวจสอบ"
        dar={darWithWorkflow}
        currentActor={currentUser}
        currentStep="REVIEWER"
        workflowSignatories={darWithWorkflow?.approvalWorkflow || dar?.approvalWorkflow || []}
        summaryData={[
          { label: 'ผู้ดำเนินการ', value: `${currentUser?.name || 'ผู้ทบทวน'} (${currentUser?.department || '-'})` },
          { label: 'เอกสาร', value: dar ? `[${getDarDocInfo(dar, documents).docCode}] ${dar.title}` : '-' },
          { label: 'ผลการทบทวน', value: pendingAction === 'APPROVE' ? 'ผ่านการทบทวน (Review Passed)' : 'ส่งกลับแก้ไข (Revision Required)' },
          { label: 'ความเห็นประกอบ', value: comment || '-' },
          { 
            label: 'สายการอนุมัติถัดไป', 
            value: pendingAction === 'APPROVE' 
              ? `ส่งต่อไปยัง: ${nextActorName} (${nextActorRole})` 
              : 'ส่งกลับไปยัง: ผู้ร้องขอ (แก้ไขคำร้อง)' 
          }
        ]}
      />

      <DarReviewModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        dar={dar}
        role="REVIEWER"
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
      />
    </div>
  );
};

export default TaskReview;
