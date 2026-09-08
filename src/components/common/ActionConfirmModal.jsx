import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, FileText, ArrowRight, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTypedConfirmation('');
      setIsSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleConfirmClick = async () => {
    if (isSubmitting || isSuccess) return;
    setIsSubmitting(true);
    try {
      if (onConfirm) {
        await onConfirm();
      }
      setIsSuccess(true);
      // Brief success flash then close
      setTimeout(() => {
        if (onClose) onClose();
      }, 600);
    } catch (err) {
      console.error('ActionConfirmModal onConfirm error:', err);
      toast.error(err?.message || 'เกิดข้อผิดพลาด ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
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
  const isConfirmDisabled = isLoading || isSubmitting || !isTypeConfirmed || isSuccess;

  const renderItemValue = (item) => {
    if (item.value === undefined || item.value === null || item.value === '') return '-';

    // If string represents a revision transition (e.g. Rev.00 ➔ Rev.01 or 00 -> 01)
    if (typeof item.value === 'string' && (item.value.includes('➔') || item.value.includes('->') || item.value.includes('→'))) {
      const parts = item.value.split(/\s*(?:➔|->|→)\s*/);
      if (parts.length === 2) {
        const fromRev = parts[0].trim();
        const toRev = parts[1].trim();
        return (
          <div className="flex items-center gap-2 font-mono text-sm font-bold">
            <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md border border-slate-200">
              {fromRev.startsWith('Rev') ? fromRev : `Rev.${fromRev}`}
            </span>
            <span className="text-slate-400 font-sans">➔</span>
            <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md border border-blue-200 font-bold">
              {toRev.startsWith('Rev') ? toRev : `Rev.${toRev}`}
            </span>
          </div>
        );
      }
    }

    return item.value;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="relative w-full max-w-xl sm:max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={`flex items-center justify-center w-11 h-11 bg-slate-100 rounded-xl border border-slate-200 shrink-0 ${styles.iconColor}`}>
                  {styles.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">{title}</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">กรุณาตรวจสอบรายละเอียดสรุปก่อนดำเนินการยืนยัน</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-all shrink-0 focus:ring-2 focus:ring-blue-100 outline-none"
                disabled={isLoading}
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6 custom-scrollbar">
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200 w-full max-w-full overflow-hidden shadow-xs">
                {summaryData.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-start p-4 sm:p-5 gap-2 sm:gap-4 hover:bg-slate-50/80 transition-colors min-w-0">
                    <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider w-36 sm:w-48 shrink-0">{item.label}</span>
                    <div className="text-sm sm:text-base font-medium text-slate-900 break-all break-words min-w-0 [overflow-wrap:anywhere] flex-1 leading-relaxed">
                      {renderItemValue(item)}
                    </div>
                  </div>
                ))}
              </div>

              {requireTypeToConfirm && (
                <div className="mt-4 bg-white p-5 rounded-xl border border-rose-200/80 bg-rose-50/20 space-y-3 shadow-xs">
                  <label className="block text-sm font-bold text-rose-700">
                    นี่เป็นการดำเนินการสำคัญ กรุณาพิมพ์ <strong className="select-all bg-rose-100/70 px-2 py-0.5 rounded-md border border-rose-200 font-mono text-sm text-rose-800">CONFIRM</strong> เพื่อยืนยัน:
                  </label>
                  <input
                    type="text"
                    value={typedConfirmation}
                    onChange={(e) => setTypedConfirmation(e.target.value)}
                    placeholder="พิมพ์ CONFIRM"
                    className="w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-mono uppercase bg-white text-slate-900"
                    disabled={isLoading}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-all focus:ring-2 focus:ring-blue-100 outline-none"
                disabled={isLoading || isSuccess}
              >
                {cancelText || 'ยกเลิก / กลับไปแก้ไข'}
              </button>
              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={isConfirmDisabled}
                className={`text-sm font-semibold px-6 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 min-w-[150px] shadow-xs active:scale-[0.99] ${
                  isConfirmDisabled ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200 shadow-none' : styles.btn
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
                      <CheckCircle className="w-5 h-5 text-white" />
                    </motion.div>
                  ) : (isLoading || isSubmitting) ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-2 text-white"
                    >
                      <Loader2 className="animate-spin h-4 w-4 text-current" strokeWidth={2} />
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
