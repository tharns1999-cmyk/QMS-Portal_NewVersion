import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';
import { FileText, CheckCircle, XCircle, Ban, ChevronLeft, Download, MessageSquare, ShieldAlert, Layers, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { getDarReason, getDarDetail, getDarDocInfo, getRequesterName } from '../../utils/darHelper';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';
import DarReviewModal from '../../components/workflow/DarReviewModal';
import { ACCESS_SCOPE_METADATA } from '../../utils/accessControl';

const TaskApprove = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tasks, dars, documents, timeline, processWorkflow, currentUser, canDownloadDocument, masterUsers } = useStore();
  
  const [comment, setComment] = useState('');
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const scrollRef = useRef(null);

  const task = tasks.find(t => t.id === id);
  const dar = task ? dars.find(d => d.id === task.darId) : null;
  const darTimeline = dar ? timeline.filter(t => t.darId === dar.id) : [];

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

  if (!task || !dar) {
    return <div className="p-6 text-[#666666] font-medium">ไม่พบรายการงานที่ระบุ</div>;
  }

  if (task.assigneeId !== currentUser.id) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="card-surface p-8 text-center max-w-md shadow-none border-rose-200">
          <XCircle className="mx-auto mb-4 text-rose-500" size={56} strokeWidth={1.5}/>
          <h2 className="text-xl font-bold mb-2 text-[#1E1E1E]">ไม่มีสิทธิ์เข้าถึงงานนี้</h2>
          <p className="text-xs text-[#666666] leading-relaxed">คุณไม่มีสิทธิ์เข้าถึงงานนี้ หรือเป็นงานที่ถูกมอบหมายให้เจ้าหน้าที่ท่านอื่น</p>
          <button onClick={() => navigate('/tasks')} className="mt-6 btn-primary w-full justify-center">กลับหน้า Inbox</button>
        </div>
      </div>
    );
  }

  // Use a pseudo-document for access rules since DAR is not in documents array yet
  const pseudoDoc = { department: dar.department, distributedTo: dar.distributedDepts || [] };
  const canDownload = canDownloadDocument(pseudoDoc, currentUser);
  const docInfo = getDarDocInfo(dar, documents);
  const requesterName = getRequesterName(dar, masterUsers);
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

  const executeAction = () => {
    processWorkflow(task.id, pendingAction, comment);
    toast.success(`ดำเนินการ ${pendingAction === 'APPROVE' ? 'อนุมัติเอกสาร' : pendingAction === 'REJECT' ? 'ไม่อนุมัติเอกสาร' : 'ส่งกลับแก้ไข'} สำเร็จ`);
    setShowConfirm(false);
    navigate('/tasks');
  };

  return (
    <motion.div 
      initial={{ x: 20, opacity: 0 }} 
      animate={{ x: 0, opacity: 1 }} 
      transition={{ duration: 0.2 }} 
      className="h-[calc(100vh-100px)] flex gap-4 overflow-hidden -mx-4 -mb-8 px-4 pb-4"
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
               className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-all cursor-pointer"
               title="เปิดหน้าต่างตรวจสอบข้อมูลคำร้องครบถ้วน 6 มิติ"
             >
               <Sparkles size={13} /> ตรวจสอบ 6 มิติ
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
                  <p className="text-xl font-bold text-[#1E1E1E] font-mono mt-0.5">{dar.id}</p>
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
               <p><span className="text-slate-400 w-24 inline-block font-medium">แผนกเจ้าของ:</span> <span className="font-bold font-mono">{dar.department}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">ผู้ร้องขอ:</span> <span className="font-bold text-[#1E1E1E]">{requesterName}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">วันบังคับใช้:</span> <span className="font-mono font-bold text-emerald-700">{dar.effectiveDate || '-'}</span></p>
               
               {/* Confidentiality Pill */}
               <div className="flex items-center gap-2 pt-1">
                 <span className="text-slate-400 w-24 inline-block font-medium">ระดับความลับ:</span>
                 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${scopeMeta.badgeClass}`}>
                   {accessScope === 'GENERAL' && '🌐 ทั่วไป'}
                   {accessScope === 'DEPT_ONLY' && '🔒 เฉพาะแผนก'}
                   {accessScope === 'TARGETED' && '🏢 เฉพาะบางแผนก'}
                   {accessScope === 'RESTRICTED' && `🛡️ ลับเฉพาะ (Lv.${dar.access_control?.min_access_level || 4}+)`}
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
               <div key={tl.id} className={`flex flex-col ${tl.userId === currentUser.id ? 'items-end' : 'items-start'}`}>
                 <div className="flex items-baseline gap-1.5 mb-1 px-1">
                   <span className="text-xs font-bold text-slate-700">{tl.user}</span>
                   <span className="text-xs text-slate-400 font-mono">{tl.date}</span>
                 </div>
                 <div className={`p-3.5 rounded-xl max-w-[90%] text-sm shadow-xs leading-relaxed ${tl.userId === currentUser.id ? 'bg-[#0D99FF] text-white rounded-tr-sm' : 'bg-white border border-[#E5E5E5] text-slate-800 rounded-tl-sm'}`}>
                    {tl.isChat ? (
                      <p>{tl.comment}</p>
                    ) : (
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold mb-1 ${tl.userId === currentUser.id ? 'bg-white/20 text-white' : 'bg-[#F5F5F5] text-slate-700'}`}>
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
            rows="2"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full input-primary text-sm py-2.5 mb-3 bg-[#F5F5F5] focus:bg-white resize-none"
            placeholder="พิมพ์ความคิดเห็น หรือเหตุผลประกอบการพิจารณาอนุมัติ..."
          />
          <div className="flex gap-2">
            <button
              disabled={!hasReadToBottom}
              onClick={() => handleAction('REJECT')}
              className="flex-1 btn-secondary border-rose-200 text-rose-700 hover:bg-rose-50 justify-center disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold h-11"
              title="ไม่อนุมัติและยกเลิกคำขอนี้ทันที"
            >
              <Ban size={16} /> ไม่อนุมัติ (Reject)
            </button>
            <button
              disabled={!hasReadToBottom}
              onClick={() => handleAction('RETURN')}
              className="flex-1 btn-secondary border-amber-200 text-amber-700 hover:bg-amber-50 justify-center disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold h-11"
              title="ส่งกลับไปให้ Requester แก้ไข"
            >
              <XCircle size={16} /> ส่งกลับแก้ไข (Return)
            </button>
            <button
              disabled={!hasReadToBottom}
              onClick={() => handleAction('APPROVE')}
              className="flex-[1.5] btn-primary bg-emerald-600 hover:bg-emerald-700 justify-center disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold h-11"
              title="อนุมัติคำขอ"
            >
              <CheckCircle size={16} /> อนุมัติ (Approve)
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
                 เอกสารฉบับนี้กำหนดมาตรฐานการปฏิบัติงานสำหรับแผนก {dar.department} เพื่อใช้เป็นแนวทางปฏิบัติงานตามข้อกำหนดระบบบริหารคุณภาพ ISO 9001 / FSSC 22000
                 {dar.requestDetail}
               </p>
               <h2 className="text-base font-bold text-slate-800 mb-2">2. ขอบเขต (Scope)</h2>
               <p className="text-xs text-slate-700 leading-relaxed">
                 ครอบคลุมบุคลากรและกระบวนการทำงานที่เกี่ยวข้องทั้งหมดในสังกัด {dar.department}
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
        summaryData={[
          { label: 'ผู้อนุมัติ', value: `${currentUser.name} (${currentUser.department})` },
          { label: 'เอกสาร', value: dar ? `[${getDarDocInfo(dar, documents).docCode}] ${dar.title}` : '-' },
          { label: 'ผลการพิจารณา', value: pendingAction === 'APPROVE' ? 'อนุมัติประกาศใช้ (Approved)' : pendingAction === 'REJECT' ? 'ไม่อนุมัติคำร้อง (Rejected)' : 'ส่งกลับแก้ไข (Revision Required)' },
          { label: 'ความเห็นประกอบ', value: comment || '-' },
          { label: 'สายการอนุมัติถัดไป', value: pendingAction === 'APPROVE' ? 'ส่งต่อไปยัง: เจ้าหน้าที่ DCC (ตรวจสอบและประกาศใช้)' : pendingAction === 'REJECT' ? 'สิ้นสุดคำร้อง: ส่งเข้าคลังประวัติ (ไม่อนุมัติ)' : 'ส่งกลับไปยัง: ผู้ร้องขอ (แก้ไขคำร้อง)' }
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
    </motion.div>
  );
};

export default TaskApprove;
