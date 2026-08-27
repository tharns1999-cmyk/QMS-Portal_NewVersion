import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const ReplacementModal = ({ isOpen, onClose, instance }) => {
  const [reasonType, setReasonType] = useState('DAMAGED');
  const [reasonText, setReasonText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !instance) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (reasonType === 'LOST' && !reasonText) {
      toast.error('กรุณาระบุรายละเอียดการสูญหาย');
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      onClose(true, reasonType, reasonText); // pass to parent to call store
    } catch {
      toast.error('เกิดข้อผิดพลาดในการทำรายการ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isSubmitting && onClose()}
            className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative bg-white w-full max-w-xl overflow-hidden flex flex-col border border-stone-200/50 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] z-10 my-auto"
          >
            {/* Header: Claude Aesthetic (White/Flat) */}
            <div className="bg-white px-8 pt-8 pb-4 border-b border-stone-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#f9f8f6] text-[#b87c33] border border-stone-200 flex items-center justify-center shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h2 className="text-[#2d2d2d] font-bold text-xl sm:text-2xl tracking-tight">แจ้งเอกสารชำรุด/สูญหาย</h2>
                  <p className="text-stone-500 text-sm sm:text-base mt-1 font-medium">
                    ขอออกสำเนาควบคุมทดแทน (Issue 02) ประจำจุดใช้งาน
                  </p>
                </div>
              </div>
              <button 
                onClick={() => !isSubmitting && onClose()}
                className="text-stone-400 hover:text-[#2d2d2d] hover:bg-stone-50 p-2 rounded-xl transition-colors focus:ring-2 focus:ring-[#da7756]/20 outline-none"
                disabled={isSubmitting}
                title="ปิดหน้าต่าง"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6 bg-[#f9f8f6] overflow-y-auto max-h-[75vh]">
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm text-sm space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-stone-100">
                  <span className="text-stone-400 font-bold uppercase tracking-widest text-xs">เอกสารควบคุม (Controlled Copy)</span>
                  <span className="font-mono font-bold text-[#da7756] bg-[#f9f8f6] px-2 py-0.5 rounded-md border border-stone-200">
                    {instance.doc_code || instance.docTitle || instance.title || 'เอกสารควบคุม'}
                  </span>
                </div>
                <div className="text-[#2d2d2d] font-bold text-base leading-snug">
                  {instance.docName || instance.docTitle || instance.name || instance.doc_code}
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="bg-[#f9f8f6] p-3 rounded-xl border border-stone-200">
                    <span className="text-stone-400 text-[10px] block font-bold uppercase tracking-wider mb-0.5">หมายเลขสำเนา</span>
                    <span className="font-bold text-[#4a724b] font-mono text-sm">Copy {instance.copy_no || instance.ccNumber || '01'}</span>
                  </div>
                  <div className="bg-[#f9f8f6] p-3 rounded-xl border border-stone-200">
                    <span className="text-stone-400 text-[10px] block font-bold uppercase tracking-wider mb-0.5">จุดติดตั้ง</span>
                    <span className="font-bold text-[#2d2d2d] truncate block text-sm" title={instance.location || instance.locationName || instance.station_name}>
                      {instance.location || instance.locationName || instance.station_name || `${instance.holder_dept || instance.department} Station`}
                    </span>
                  </div>
                  <div className="bg-[#f9f8f6] p-3 rounded-xl border border-stone-200">
                    <span className="text-stone-400 text-[10px] block font-bold uppercase tracking-wider mb-0.5">แผนก</span>
                    <span className="font-bold text-[#2d2d2d] text-sm font-mono">{instance.holder_dept || instance.department}</span>
                  </div>
                </div>
              </div>

              <form id="replacement-form" onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-[#2d2d2d] mb-3">
                    ประเภทการแจ้ง <span className="text-[#da7756]">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`border rounded-xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                      reasonType === 'DAMAGED' 
                        ? 'border-[#b87c33] bg-[#f9f8f6] text-[#b87c33] shadow-sm' 
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-500'
                    }`}>
                      <input 
                        type="radio" 
                        name="reasonType" 
                        value="DAMAGED" 
                        className="sr-only" 
                        checked={reasonType === 'DAMAGED'} 
                        onChange={() => setReasonType('DAMAGED')} 
                      />
                      <FileText size={24} className={reasonType === 'DAMAGED' ? 'text-[#b87c33]' : 'text-stone-400'} />
                      <span className="font-bold text-sm">เอกสารชำรุด (Damaged)</span>
                    </label>
                    
                    <label className={`border rounded-xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                      reasonType === 'LOST' 
                        ? 'border-[#a94442] bg-[#f5e6e6] text-[#a94442] shadow-sm' 
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-500'
                    }`}>
                      <input 
                        type="radio" 
                        name="reasonType" 
                        value="LOST" 
                        className="sr-only" 
                        checked={reasonType === 'LOST'} 
                        onChange={() => setReasonType('LOST')} 
                      />
                      <AlertTriangle size={24} className={reasonType === 'LOST' ? 'text-[#a94442]' : 'text-stone-400'} />
                      <span className="font-bold text-sm">เอกสารสูญหาย (Lost)</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-[#2d2d2d]">
                    สาเหตุ / รายละเอียดเพิ่มเติม {reasonType === 'LOST' && <span className="text-[#da7756]">*</span>}
                  </label>
                  <textarea 
                    rows="3"
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm text-[#2d2d2d] placeholder:text-stone-400 focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/10 transition-all outline-none font-medium resize-none leading-relaxed shadow-sm"
                    placeholder={reasonType === 'LOST' ? 'ระบุสาเหตุการสูญหาย...' : 'ระบุส่วนที่ชำรุด (ถ้ามี)...'}
                    required={reasonType === 'LOST'}
                  />
                </div>
                
                <div className="bg-[#f9f8f6] text-stone-600 p-4 rounded-xl text-sm flex gap-3 border border-stone-200 leading-relaxed shadow-sm">
                  <CheckCircle2 className="shrink-0 mt-0.5 text-[#4a724b]" size={20} />
                  <p>เมื่อยืนยัน ระบบจะส่งคำขอไปยังผู้จัดการเพื่ออนุมัติ หลังจากนั้น DCC จะทำการเตรียมเอกสารควบคุมใหม่ภายใต้รหัสเดิม (โดยปรับเพิ่ม Issue No.) ให้ท่านต่อไป</p>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-stone-100 px-8 py-5 flex items-center justify-end gap-4 rounded-b-2xl shrink-0">
              <button 
                type="button"
                onClick={() => onClose()}
                disabled={isSubmitting}
                className="bg-white hover:bg-stone-50 text-stone-600 font-bold text-base px-6 py-3 rounded-xl border border-stone-200 transition-colors focus:ring-4 focus:ring-stone-200 outline-none"
              >
                ยกเลิก (Cancel)
              </button>
              <button 
                type="submit"
                form="replacement-form"
                disabled={isSubmitting}
                className="bg-[#da7756] hover:bg-[#c96646] active:scale-[0.99] text-white font-bold text-base px-6 py-3 rounded-xl shadow-none transition-all flex items-center gap-2 disabled:opacity-50 focus:ring-4 focus:ring-[#da7756]/20 outline-none"
              >
                {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันการแจ้ง & ขอฉบับทดแทน'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReplacementModal;
