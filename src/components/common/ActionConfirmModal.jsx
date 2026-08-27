import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, FileText, ArrowRight, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * @typedef {Object} SummaryItem
 * @property {string} label
 * @property {React.ReactNode} value
 */

/**
 * ActionConfirmModal - A reusable modal to summarize and confirm actions
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {() => void} props.onConfirm
 * @param {string} props.title
 * @param {'submit' | 'approve' | 'reject' | 'obsolete' | 'acknowledge' | 'distribute'} props.actionType
 * @param {SummaryItem[]} props.summaryData
 * @param {boolean} [props.requireTypeToConfirm=false]
 * @param {boolean} [props.isLoading=false]
 * @param {string} [props.confirmText]
 */
const ActionConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  actionType = 'submit',
  summaryData = [],
  requireTypeToConfirm = false,
  isLoading = false,
  confirmText,
  cancelText
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset typed confirmation when modal opens
  useEffect(() => {
    if (isOpen) {
      setTypedConfirmation('');
      setIsSuccess(false);
    }
  }, [isOpen]);

  const handleConfirmClick = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onConfirm();
    }, 800);
  };

  const getStyles = () => {
    switch (actionType) {
      case 'approve':
        return {
          icon: <CheckCircle className="w-6 h-6" />,
          iconColor: 'text-[#4a724b]',
          btn: 'bg-[#4a724b] hover:bg-[#3d5e3e] active:scale-[0.99] text-white shadow-none focus:ring-4 focus:ring-[#4a724b]/20 outline-none',
          defaultText: 'ยืนยันการอนุมัติเอกสาร'
        };
      case 'reject':
        return {
          icon: <XCircle className="w-6 h-6" />,
          iconColor: 'text-[#a94442]',
          btn: 'bg-[#a94442] hover:bg-[#8c3836] active:scale-[0.99] text-white shadow-none focus:ring-4 focus:ring-[#a94442]/20 outline-none',
          defaultText: 'ยืนยันการไม่อนุมัติ / ส่งกลับแก้ไข'
        };
      case 'obsolete':
        return {
          icon: <AlertTriangle className="w-6 h-6" />,
          iconColor: 'text-[#b87c33]',
          btn: 'bg-[#b87c33] hover:bg-[#99672b] active:scale-[0.99] text-white shadow-none focus:ring-4 focus:ring-[#b87c33]/20 outline-none',
          defaultText: 'ยืนยันการยกเลิกเอกสาร'
        };
      case 'acknowledge':
        return {
          icon: <CheckCircle className="w-6 h-6" />,
          iconColor: 'text-[#da7756]',
          btn: 'bg-[#da7756] hover:bg-[#c96646] active:scale-[0.99] text-white shadow-none focus:ring-4 focus:ring-[#da7756]/20 outline-none',
          defaultText: 'รับทราบและยอมรับ'
        };
      case 'distribute':
        return {
          icon: <ArrowRight className="w-6 h-6" />,
          iconColor: 'text-[#da7756]',
          btn: 'bg-[#da7756] hover:bg-[#c96646] active:scale-[0.99] text-white shadow-none focus:ring-4 focus:ring-[#da7756]/20 outline-none',
          defaultText: 'ยืนยันการแจกจ่ายสำเนา'
        };
      case 'submit':
      default:
        return {
          icon: <FileText className="w-6 h-6" />,
          iconColor: 'text-[#da7756]',
          btn: 'bg-[#da7756] hover:bg-[#c96646] active:scale-[0.99] text-white shadow-none focus:ring-4 focus:ring-[#da7756]/20 outline-none',
          defaultText: 'ยืนยันการส่งคำร้องขอ'
        };
    }
  };

  const styles = getStyles();
  const isTypeConfirmed = !requireTypeToConfirm || typedConfirmation === 'CONFIRM';
  const isConfirmDisabled = isLoading || !isTypeConfirmed || isSuccess;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/20 backdrop-blur-sm p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="bg-white rounded-xl w-full max-w-2xl sm:max-w-3xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-stone-200 flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-8 pt-8 pb-5 border-b border-stone-100 flex items-center justify-between bg-white`}>
              <div className="flex items-center gap-4 min-w-0">
                <div className={`flex items-center justify-center w-12 h-12 bg-[#f9f8f6] rounded-xl border border-stone-200 shrink-0 ${styles.iconColor}`}>
                  {styles.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#2d2d2d] tracking-tight truncate">{title}</h2>
                  <p className="text-sm text-stone-500 font-medium mt-1">กรุณาตรวจสอบรายละเอียดสรุปก่อนดำเนินการยืนยัน</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="text-stone-400 hover:text-[#2d2d2d] hover:bg-stone-50 p-2 rounded-xl transition-colors shrink-0 focus:ring-2 focus:ring-[#da7756]/20 outline-none"
                disabled={isLoading}
                title="ปิดหน้าต่าง"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 overflow-y-auto max-h-[75vh] flex-1 bg-[#f9f8f6] space-y-6 scrollbar-thin">
              <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 w-full max-w-full overflow-hidden shadow-sm">
                {summaryData.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-start p-4 sm:p-5 gap-2 sm:gap-4 hover:bg-stone-50 transition-colors min-w-0">
                    <span className="text-sm font-bold text-stone-500 uppercase tracking-wider w-36 sm:w-48 shrink-0">{item.label}</span>
                    <div className="text-sm sm:text-base font-medium text-[#2d2d2d] break-all break-words min-w-0 [overflow-wrap:anywhere] flex-1 leading-relaxed">
                      {item.value !== undefined && item.value !== null && item.value !== '' ? item.value : '-'}
                    </div>
                  </div>
                ))}
              </div>

              {requireTypeToConfirm && (
                <div className="mt-4 bg-white p-5 rounded-xl border border-stone-200 space-y-3 shadow-sm">
                  <label className="block text-sm font-bold text-[#a94442]">
                    นี่เป็นการดำเนินการสำคัญ กรุณาพิมพ์ <strong className="select-all bg-[#f5e6e6] px-2 py-0.5 rounded border border-[#a94442]/30 font-mono text-sm text-[#a94442]">CONFIRM</strong> เพื่อยืนยัน:
                  </label>
                  <input
                    type="text"
                    value={typedConfirmation}
                    onChange={(e) => setTypedConfirmation(e.target.value)}
                    placeholder="พิมพ์ CONFIRM"
                    className="w-full px-4 py-3 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#a94442]/10 focus:border-[#a94442] transition-all font-mono uppercase bg-white text-[#2d2d2d]"
                    disabled={isLoading}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-stone-100 flex justify-end gap-4 bg-white shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-sm font-bold text-stone-600 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-all focus:ring-4 focus:ring-stone-200 outline-none"
                disabled={isLoading || isSuccess}
              >
                {cancelText || 'ยกเลิก / กลับไปแก้ไข'}
              </button>
              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={isConfirmDisabled}
                className={`text-sm font-bold px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 min-w-[150px] ${
                  isConfirmDisabled ? 'opacity-50 cursor-not-allowed bg-stone-100 text-stone-400 border border-stone-200' : styles.btn
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isSuccess ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CheckCircle className="w-6 h-6 text-white" />
                    </motion.div>
                  ) : isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-2 text-white"
                    >
                      <Loader2 className="animate-spin h-5 w-5 text-current" strokeWidth={2} />
                      กำลังประมวลผล...
                    </motion.div>
                  ) : (
                    <motion.span
                      key="text"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                    >
                      {confirmText || styles.defaultText}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ActionConfirmModal;
