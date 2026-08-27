import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ShieldCheck, MapPin, Building, KeyRound, AlertTriangle } from 'lucide-react';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';

const TaskConfirmHardcopyReceiptModal = ({ isOpen, onClose, task }) => {
  const { currentUser, confirmHardcopyReceipt, documentControlledCopies, controlledCopyInstances } = useStore();
  const [pin, setPin] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !task) return null;

  const copies = documentControlledCopies || controlledCopyInstances || [];
  const copyId = String(task.copy_id || task.copyId || task.instanceId || '');
  const copy = copies.find(c => String(c.id) === copyId);

  const docCode = task.doc_code || copy?.doc_code || copy?.docTitle || task.title;
  const docRev = task.doc_version || copy?.doc_version || copy?.rev || '01';
  const copyNo = task.copy_no || copy?.copy_no || copy?.ccNumber || '01';
  const location = task.location || copy?.location || copy?.locationName || '-';
  const dept = task.target_department || task.targetDepartment || task.assignedToDept || copy?.holder_dept || copy?.department || currentUser.department;

  const isDccUser = currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.id === 'u5';
  const userDepts = currentUser?.depts || (currentUser?.department ? [currentUser.department] : []);
  const isAuthorized = isDccUser || !dept || userDepts.includes(dept);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAuthorized) {
      toast.error(`คุณไม่มีสิทธิ์ตรวจรับเอกสารของแผนก ${dept}`);
      return;
    }
    setIsSubmitting(true);
    try {
      confirmHardcopyReceipt(copyId, task.id, {
        name: currentUser.name,
        pin: pin || 'CONFIRMED',
        remarks: remarks || 'Confirmed receipt and physical placement at point of use'
      });
      toast.success(`ตรวจรับเอกสาร ${docCode} (Copy ${copyNo}) สำเร็จ`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการยืนยัน');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/20 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-stone-200/50 w-full max-w-lg overflow-hidden flex flex-col z-10 my-auto"
        >
          {/* Header: Claude Aesthetic (White/Flat) */}
          <div className="bg-white px-8 pt-8 pb-4 border-b border-stone-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#f9f8f6] text-[#4a724b] border border-stone-200 flex items-center justify-center shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-[#2d2d2d] font-bold text-xl sm:text-2xl tracking-tight leading-tight">
                  ตรวจรับเอกสารควบคุมฉบับพิมพ์
                </h3>
                <p className="text-stone-500 text-sm sm:text-base font-medium mt-1">
                  Department Hardcopy Receipt Confirmation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-[#2d2d2d] hover:bg-stone-50 p-2 rounded-xl transition-colors focus:ring-2 focus:ring-[#da7756]/20 outline-none"
              title="ปิดหน้าต่าง"
            >
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-[#f9f8f6]">
            <div className="p-5 bg-white border border-stone-200 rounded-xl space-y-3.5 text-sm shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b border-stone-100">
                <span className="text-stone-400 font-bold uppercase tracking-widest text-xs">รหัสเอกสาร:</span>
                <span className="font-bold text-[#da7756] font-mono text-base bg-[#f9f8f6] px-2.5 py-0.5 rounded-md border border-stone-200">{docCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-bold">ฉบับที่ (Rev.):</span>
                <span className="font-bold text-[#2d2d2d] font-mono text-sm">Rev.{docRev}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-bold">หมายเลขสำเนา (Copy No.):</span>
                <span className="font-bold text-[#4a724b] font-mono bg-[#f9f8f6] px-2.5 py-0.5 rounded-md border border-stone-200 text-sm">
                  Copy {copyNo}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-bold flex items-center gap-2">
                  <Building size={16} className="text-stone-400" /> แผนกผู้รับ:
                </span>
                <span className="font-bold text-[#2d2d2d] font-mono text-sm">{dept}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-bold flex items-center gap-2">
                  <MapPin size={16} className="text-stone-400" /> จุดใช้งาน:
                </span>
                <span className="font-bold text-[#2d2d2d] text-sm">{location}</span>
              </div>
            </div>

            {!isAuthorized ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-sm text-rose-700 shadow-sm leading-relaxed">
                <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">ไม่มีสิทธิ์ตรวจรับเอกสารของแผนกอื่น</p>
                  <p className="text-xs text-rose-600 mt-0.5">
                    เอกสารนี้จัดส่งสำหรับแผนก <strong>{dept}</strong> เท่านั้น (แผนกปัจจุบันของคุณ: {currentUser?.department || '-'})
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white border border-stone-200 rounded-xl flex items-start gap-3 text-sm text-stone-600 shadow-sm leading-relaxed">
                <AlertTriangle size={20} className="text-[#b87c33] shrink-0 mt-0.5" />
                <span>
                  เมื่อกดยืนยัน ระบบจะปรับปรุงสถานะสำเนาเป็น <strong>ISSUED_ACTIVE</strong> และบันทึกประวัติการตรวจรับเข้าสู่ DCS Audit Trail ทันที
                </span>
              </div>
            )}

            {/* Input PIN / Notes */}
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-[#2d2d2d] flex items-center gap-2">
                  <KeyRound size={16} className="text-stone-400" /> PIN ยืนยันตัวตน (ถ้ามี):
                </label>
                <input
                  type="password"
                  disabled={!isAuthorized}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="กรอกรหัส PIN หรือเว้นว่างเพื่อใช้ชื่อบัญชีผู้ใช้"
                  className="w-full px-4 py-3 text-sm bg-white border border-stone-200 rounded-xl focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/10 outline-none transition-all font-medium text-[#2d2d2d] placeholder:text-stone-400 shadow-sm disabled:bg-stone-100 disabled:text-stone-400"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-[#2d2d2d]">
                  บันทึกเพิ่มเติม / หมายเหตุการตรวจรับ:
                </label>
                <textarea
                  disabled={!isAuthorized}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="เช่น ตรวจสอบตราประทับควบคุมและใส่แฟ้มประจำจุดใช้งานเรียบร้อยแล้ว"
                  rows={2}
                  className="w-full px-4 py-3 text-sm bg-white border border-stone-200 rounded-xl focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/10 outline-none transition-all resize-none font-medium text-[#2d2d2d] placeholder:text-stone-400 leading-relaxed shadow-sm disabled:bg-stone-100 disabled:text-stone-400"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex gap-4 justify-end border-t border-stone-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="bg-white hover:bg-stone-50 text-stone-600 font-bold text-base px-6 py-3 rounded-xl border border-stone-200 transition-colors focus:ring-4 focus:ring-stone-200 outline-none"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isAuthorized}
                className="bg-[#da7756] hover:bg-[#c96646] active:scale-[0.99] text-white font-bold text-base px-6 py-3 rounded-xl shadow-none transition-all flex items-center gap-2 disabled:opacity-50 focus:ring-4 focus:ring-[#da7756]/20 outline-none"
              >
                <CheckCircle2 size={20} />
                {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการตรวจรับเอกสาร'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TaskConfirmHardcopyReceiptModal;
