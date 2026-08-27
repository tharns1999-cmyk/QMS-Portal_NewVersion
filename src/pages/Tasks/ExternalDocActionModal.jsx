import React, { useState } from 'react';
import { X, Check, XCircle, FileText, ShieldCheck, Eye, Bell } from 'lucide-react';
import useStore from '../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import ExternalDocPreviewModal from '../ExternalDocs/ExternalDocPreviewModal';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';

const ExternalDocActionModal = ({ task, onClose, layoutId }) => {
  const { externalDocuments, processExternalTask } = useStore();
  const [comment, setComment] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  
  // Find the external document for this task
  const doc = externalDocuments.find(d => d.id === task.referenceId);
  
  if (!doc) {
    return null;
  }

  const handleAction = (action) => {
    setPendingAction(action);
    setShowConfirm(true);
  };

  const executeAction = () => {
    processExternalTask(task.id, pendingAction, comment);
    setShowConfirm(false);
    onClose();
  };

  const getActionTitle = () => {
    if (task.type === 'EXT_REVIEW') return 'ตรวจสอบเอกสารภายนอก (Review External Document)';
    if (task.type === 'EXT_APPROVAL') return 'อนุมัติเอกสารภายนอก (Approve External Document)';
    if (task.type === 'Ack') return 'รับทราบเอกสารภายนอก (Acknowledge External Document)';
    return 'จัดการเอกสารภายนอก (External Document Task)';
  };

  const extActionMapping = {
    'UPDATE': 'อัปเดตเอกสาร',
    'OBSOLETE': 'ยกเลิกเอกสาร',
    'REGISTER': 'ขึ้นทะเบียนใหม่'
  };
  const actionLabel = task.extAction ? extActionMapping[task.extAction] || task.extAction : 'ขึ้นทะเบียนใหม่';

  const docCode = doc.edCode || doc.doc_code || doc.docNo || doc.id;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm"
      />

      {/* Modal Content */}
      <motion.div 
        layoutId={layoutId}
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 12 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="relative w-full max-w-2xl bg-white border border-stone-200/50 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col max-h-[88vh] z-10 my-auto"
      >
        {/* Header: Claude Aesthetic (White/Flat) */}
        <div className="bg-white px-8 pt-8 pb-4 border-b border-stone-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 min-w-0 pr-2">
            <div className="w-12 h-12 rounded-xl bg-[#f9f8f6] text-[#4a724b] border border-stone-200 flex items-center justify-center shrink-0">
              {task.type === 'EXT_REVIEW' ? <Eye size={24} /> : task.type === 'Ack' ? <Bell size={24} /> : <ShieldCheck size={24} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-[#2d2d2d] font-bold text-xl sm:text-2xl tracking-tight truncate">{getActionTitle()}</h2>
              <p className="text-stone-500 text-sm sm:text-base font-medium mt-1">
                Ref No: <span className="font-mono font-bold text-[#da7756]">{docCode}</span>
                <span className="text-[#4a724b] bg-[#f9f8f6] border border-stone-200 px-2.5 py-0.5 rounded-md text-sm font-bold ml-2">{actionLabel}</span>
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-[#2d2d2d] hover:bg-stone-50 p-2 rounded-xl transition-colors shrink-0 focus:ring-2 focus:ring-[#da7756]/20 outline-none"
            title="ปิดหน้าต่าง"
          >
            <X size={24} />
          </button>
        </div>

        {/* Document Info Body */}
        <div className="px-8 py-6 overflow-y-auto space-y-6 bg-[#f9f8f6] flex-1 scrollbar-thin">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200 space-y-5 text-sm">
            <div>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1">ชื่อเอกสาร / Document Name</span>
              <p className="text-[#2d2d2d] font-bold text-base mt-1 leading-snug">{doc.title}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1">ผู้ออกเอกสาร / Source</span>
                <p className="text-[#2d2d2d] font-bold text-sm mt-0.5">{doc.source || '-'}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1">ระดับความลับ / Access Scope</span>
                <span className={`inline-block mt-1 font-bold px-3 py-1 rounded-md text-sm border ${
                  doc.accessScope === 'Restricted' 
                    ? 'bg-[#f5e6e6] text-[#a94442] border-[#a94442]/20' 
                    : 'bg-[#f9f8f6] text-[#4a724b] border-stone-200'
                }`}>
                  {doc.accessScope || 'General'}
                </span>
              </div>
            </div>
            
            {doc.link && (
              <div className="pt-2">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1">ลิงก์แนบ / Attachment Link</span>
                <a href={doc.link} target="_blank" rel="noreferrer" className="block mt-1 text-[#da7756] font-medium hover:underline truncate">
                  {doc.link}
                </a>
              </div>
            )}

            {doc.obsoleteReason && task.extAction === 'OBSOLETE' && (
              <div className="bg-[#f9f8f6] p-4 rounded-xl border border-stone-200 shadow-sm mt-2">
                <span className="text-xs font-bold text-[#b87c33] uppercase tracking-wider block">เหตุผลที่ขอยกเลิก (Obsolete Reason)</span>
                <p className="text-[#2d2d2d] mt-2 text-sm leading-relaxed">{doc.obsoleteReason}</p>
              </div>
            )}
            
            <div className="pt-3">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-stone-50 border border-stone-200 text-[#2d2d2d] rounded-xl font-bold text-sm transition-all w-full justify-center shadow-sm focus:ring-4 focus:ring-stone-200 outline-none"
              >
                <FileText size={18} /> ดูพรีวิวเอกสารพร้อมลายน้ำ (Preview PDF)
              </button>
            </div>
          </div>

          {/* Comment Field (not required for Ack) */}
          {task.type !== 'Ack' && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-[#2d2d2d]">ความคิดเห็น / Comment (Optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="ระบุความคิดเห็นหรือข้อเสนอแนะในการดำเนินการ..."
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/10 transition-all outline-none resize-none text-sm text-[#2d2d2d] placeholder:text-stone-400 font-medium leading-relaxed shadow-sm"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="bg-white border-t border-stone-100 px-8 py-5 flex items-center justify-end gap-4 rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-stone-50 text-stone-600 font-bold text-base px-6 py-3 rounded-xl border border-stone-200 transition-colors focus:ring-4 focus:ring-stone-200 outline-none"
          >
            ยกเลิก (Cancel)
          </button>
          
          {task.type === 'Ack' ? (
            <button
              type="button"
              onClick={() => handleAction('APPROVE')}
              className="bg-[#da7756] hover:bg-[#c96646] active:scale-[0.99] text-white font-bold text-base px-6 py-3 rounded-xl shadow-none transition-all flex items-center gap-2 focus:ring-4 focus:ring-[#da7756]/20 outline-none"
            >
              <Check size={20} /> รับทราบ (Acknowledge)
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleAction('REJECT')}
                className="bg-white border border-[#a94442] text-[#a94442] hover:bg-[#f5e6e6] active:scale-[0.99] font-bold text-base px-6 py-3 rounded-xl shadow-sm transition-all flex items-center gap-2 focus:ring-4 focus:ring-[#a94442]/20 outline-none"
              >
                <XCircle size={20} /> ส่งกลับแก้ไข (Reject)
              </button>
              <button
                type="button"
                onClick={() => handleAction('APPROVE')}
                className="bg-[#da7756] hover:bg-[#c96646] active:scale-[0.99] text-white font-bold text-base px-6 py-3 rounded-xl shadow-none transition-all flex items-center gap-2 focus:ring-4 focus:ring-[#da7756]/20 outline-none"
              >
                <Check size={20} /> อนุมัติ (Approve)
              </button>
            </>
          )}
        </div>
      </motion.div>

      <ExternalDocPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        document={doc}
      />

      <ActionConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executeAction}
        title={pendingAction === 'APPROVE' ? (task.type === 'Ack' ? 'ยืนยันการรับทราบเอกสารภายนอก' : 'ยืนยันการอนุมัติเอกสารภายนอก') : 'ยืนยันการส่งกลับ / ไม่อนุมัติ'}
        actionType={pendingAction === 'APPROVE' ? 'approve' : 'reject'}
        confirmText={pendingAction === 'APPROVE' ? (task.type === 'Ack' ? 'รับทราบและยอมรับ' : 'ยืนยันการอนุมัติ') : 'ยืนยันไม่อนุมัติ'}
        cancelText="ยกเลิก / กลับไปตรวจสอบ"
        summaryData={[
          { label: 'ชื่อเอกสาร', value: doc.title },
          { label: 'แหล่งที่มา', value: doc.source || '-' },
          { label: 'ความเห็นประกอบ', value: comment || '-' },
          { label: 'การดำเนินการ', value: pendingAction === 'APPROVE' ? (task.type === 'Ack' ? 'รับทราบเอกสาร (Acknowledged)' : 'อนุมัติเอกสาร (Approved)') : 'ไม่อนุมัติ / ส่งกลับแก้ไข (Rejected)' }
        ]}
      />
    </div>
  );
};

export default ExternalDocActionModal;
