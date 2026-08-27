import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertTriangle, Archive, FileText } from 'lucide-react';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';
import UserSelector from '../../components/UserSelector';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';

const ExternalDocObsoleteModal = ({ isOpen, onClose, documentToObsolete }) => {
  const { masterUsers, obsoleteExternalDoc } = useStore();
  const [formData, setFormData] = useState({
    reason: '',
    reviewerId: '',
    approverId: ''
  });
  const [showConfirm, setShowConfirm] = useState(false);

  const eligibleReviewers = useMemo(() => {
    return (masterUsers || []).filter(u => u.role !== 'DCC_ADMIN' && !u.isDcc && u.id !== 'U001');
  }, [masterUsers]);

  if (!isOpen || !documentToObsolete) return null;

  const docCode = documentToObsolete.edCode || documentToObsolete.doc_code || documentToObsolete.docNo || documentToObsolete.id;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.reason?.trim() || !formData.reviewerId || !formData.approverId) {
      toast.error('กรุณาระบุเหตุผลการยกเลิก และเลือก Reviewer และ Approver ให้ครบถ้วน');
      return;
    }
    setShowConfirm(true);
  };

  const executeSubmit = () => {
    obsoleteExternalDoc(documentToObsolete.id, {
      reason: formData.reason,
      reviewerId: formData.reviewerId,
      approverId: formData.approverId
    });
    
    toast.success(`ส่งคำขอยกเลิกเอกสาร ${docCode} เรียบร้อยแล้ว`);
    setShowConfirm(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative w-full max-w-xl bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-stone-200/50 overflow-hidden z-10 my-auto"
          >
            {/* Header: Claude Aesthetic (White/Flat) */}
            <div className="bg-white px-8 pt-8 pb-4 border-b border-stone-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#f5e6e6] text-[#a94442] border border-[#e5cdcd] flex items-center justify-center shrink-0">
                  <Archive size={24} />
                </div>
                <div>
                  <h2 className="text-[#2d2d2d] font-bold text-xl sm:text-2xl tracking-tight flex items-center gap-2">
                    ขอยกเลิกเอกสารภายนอก (Obsolete Request)
                  </h2>
                  <p className="text-stone-500 text-sm sm:text-base mt-1 font-medium">
                    {docCode} - {documentToObsolete.title}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="text-stone-400 hover:text-[#2d2d2d] hover:bg-stone-50 rounded-xl p-2 transition-colors focus:ring-2 focus:ring-[#a94442]/20 outline-none"
                title="ปิดหน้าต่าง"
              >
                <X size={24} />
              </button>
            </div>

            {/* Body */}
            <div className="px-8 py-8 overflow-y-auto max-h-[70vh] space-y-6 bg-[#f9f8f6]">
              <div className="bg-[#f5e6e6] border border-[#e5cdcd] rounded-xl p-5 flex gap-4 text-[#a94442] shadow-sm">
                <AlertTriangle className="shrink-0 text-[#a94442] mt-0.5" size={24} />
                <div className="text-sm space-y-1.5">
                  <p className="font-bold text-[#8a3331] text-base">คำเตือนการยกเลิกเอกสาร (Obsolete Warning)</p>
                  <p className="text-[#a94442] leading-relaxed">
                    คุณกำลังทำเรื่องขอยกเลิกเอกสาร <strong className="font-mono">{docCode}</strong> ({documentToObsolete.title}) เมื่อผ่านการอนุมัติ เอกสารจะถูกเปลี่ยนสถานะเป็น <strong>OBSOLETE</strong> ทันที
                  </p>
                </div>
              </div>

              <form id="obsolete-doc-form" onSubmit={handleFormSubmit} className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-3">
                  <label className="block text-sm font-bold text-[#2d2d2d]">
                    เหตุผลในการยกเลิกเอกสาร (Obsolete Reason) <span className="text-[#da7756]">*</span>
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => handleChange('reason', e.target.value)}
                    className="w-full px-4 py-3 bg-[#f9f8f6] border border-stone-200 rounded-xl text-sm font-medium focus:bg-white focus:border-[#a94442] focus:ring-4 focus:ring-[#a94442]/10 transition-all outline-none resize-none placeholder:text-stone-400 leading-relaxed"
                    rows={3}
                    placeholder="ระบุเหตุผล เช่น มีกฎหมาย/มาตรฐานฉบับใหม่ออกมาแทนที่, ยกเลิกการใช้งานเครื่องจักร..."
                  />
                </div>

                <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-5">
                  <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest border-b border-stone-100 pb-3">
                    ผู้รับผิดชอบการทบทวนและอนุมัติการยกเลิก (Sign-Off)
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-[#2d2d2d] mb-2">
                        ผู้ทบทวนการยกเลิก (External Reviewer) <span className="text-[#da7756]">*</span>
                      </label>
                      <UserSelector 
                        value={formData.reviewerId}
                        onChange={val => handleChange('reviewerId', val)}
                        users={eligibleReviewers}
                        placeholder="เลือกผู้ทบทวน (ที่ไม่ใช่ DCC Admin)..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-[#2d2d2d] mb-2">
                        ผู้อนุมัติการยกเลิก (External Approver) <span className="text-[#da7756]">*</span>
                      </label>
                      <UserSelector 
                        value={formData.approverId}
                        onChange={val => handleChange('approverId', val)}
                        users={masterUsers}
                        placeholder="เลือกผู้อนุมัติ (Manager / Director)..."
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-stone-100 px-8 py-5 flex items-center justify-end gap-4 rounded-b-2xl shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="bg-white hover:bg-stone-50 text-stone-600 font-bold text-base px-6 py-3 rounded-xl border border-stone-200 transition-colors focus:ring-4 focus:ring-stone-200 outline-none"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                type="submit"
                form="obsolete-doc-form"
                className="bg-[#a94442] hover:bg-[#8a3331] active:scale-[0.99] text-white font-bold text-base px-6 py-3 rounded-xl shadow-none transition-all flex items-center gap-2 focus:ring-4 focus:ring-[#a94442]/20 outline-none"
              >
                <Archive size={20} />
                <span>ส่งคำขอยกเลิก (Submit Obsolete)</span>
              </button>
            </div>
          </motion.div>

          {showConfirm && (
            <ActionConfirmModal
              isOpen={showConfirm}
              onClose={() => setShowConfirm(false)}
              onConfirm={executeSubmit}
              title="ยืนยันการส่งคำขอยกเลิกเอกสารภายนอก"
              message={`คุณต้องการส่งคำขอยกเลิกเอกสาร ${docCode} หรือไม่?`}
              confirmLabel="ยืนยันการส่งคำขอ (Confirm)"
              summaryItems={[
                { label: 'รหัสเอกสาร (Code)', value: docCode },
                { label: 'ชื่อเอกสาร (Title)', value: documentToObsolete.title },
                { label: 'เหตุผล (Reason)', value: formData.reason }
              ]}
            />
          )}
        </div>
      )}
    </AnimatePresence>
  );
};

export default ExternalDocObsoleteModal;
