import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  ArrowRight, 
  X, 
  Loader2, 
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

/**
 * @typedef {Object} SummaryItem
 * @property {string} label
 * @property {React.ReactNode} value
 */

/**
 * Helper to extract raw text content from React node or string
 */
const extractTextContent = (node) => {
  if (node === undefined || node === null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextContent).join(' ');
  if (node.props) {
    if (node.props.children) return extractTextContent(node.props.children);
  }
  return '';
};

/**
 * ActionConfirmModal - Sleek Progressive Card Dialog for modern SaaS (Linear / Vercel style)
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
 * @param {string} [props.cancelText]
 */
const ActionConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  actionType = 'submit',
  summaryData = [],
  summaryItems = null, // backward compatibility
  requireTypeToConfirm = false,
  isLoading = false,
  confirmText,
  cancelText,
  confirmLabel, // backward compatibility
  dar = null
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Normalized items
  const items = useMemo(() => {
    return (summaryData && summaryData.length > 0) ? summaryData : (summaryItems || []);
  }, [summaryData, summaryItems]);

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
      setTimeout(() => {
        if (onClose) onClose();
      }, 500);
    } catch (err) {
      console.error('ActionConfirmModal onConfirm error:', err);
      toast.error(err?.message || 'เกิดข้อผิดพลาด ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActionTheme = () => {
    switch (actionType) {
      case 'review':
        return {
          icon: <CheckCircle className="w-5 h-5 text-indigo-600" />,
          btn: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 active:scale-[0.98]',
          confirmDefault: 'ยืนยันผ่านการทบทวน',
          badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
          accentBorder: 'border-indigo-200/60'
        };
      case 'approve':
        return {
          icon: <CheckCircle className="w-5 h-5 text-emerald-600" />,
          btn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20 active:scale-[0.98]',
          confirmDefault: 'ยืนยันการอนุมัติเอกสาร',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          accentBorder: 'border-emerald-200/60'
        };
      case 'reject':
        return {
          icon: <XCircle className="w-5 h-5 text-rose-600" />,
          btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/20 active:scale-[0.98]',
          confirmDefault: 'ยืนยันการไม่อนุมัติ / ส่งกลับแก้ไข',
          badgeBg: 'bg-rose-50 text-rose-700 border-rose-200/80',
          accentBorder: 'border-rose-200/60'
        };
      case 'obsolete':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
          btn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-600/20 active:scale-[0.98]',
          confirmDefault: 'ยืนยันการยกเลิกเอกสาร',
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200/80',
          accentBorder: 'border-amber-200/60'
        };
      case 'acknowledge':
        return {
          icon: <CheckCircle className="w-5 h-5 text-blue-600" />,
          btn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/20 active:scale-[0.98]',
          confirmDefault: 'รับทราบและยอมรับ',
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200/80',
          accentBorder: 'border-blue-200/60'
        };
      case 'distribute':
        return {
          icon: <Send className="w-5 h-5 text-blue-600" />,
          btn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/20 active:scale-[0.98]',
          confirmDefault: 'ยืนยันการแจกจ่ายสำเนา',
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200/80',
          accentBorder: 'border-blue-200/60'
        };
      case 'submit':
      default:
        return {
          icon: <FileText className="w-5 h-5 text-blue-600" />,
          btn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/20 active:scale-[0.98]',
          confirmDefault: 'ยืนยันการส่งคำร้องขอ',
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200/80',
          accentBorder: 'border-blue-200/60'
        };
    }
  };

  const theme = getActionTheme();
  const isTypeConfirmed = !requireTypeToConfirm || typedConfirmation.trim().toUpperCase() === 'CONFIRM';
  const isConfirmDisabled = isLoading || isSubmitting || !isTypeConfirmed || isSuccess;

  // Partition items into structured sections
  const categorized = useMemo(() => {
    let docCodeItem = null;
    let docTitleItem = null;
    let revItem = null;
    let nextStepItem = null;
    let detailItem = null;
    const metadataItems = [];

    items.forEach((item) => {
      const label = item.label || '';
      const textVal = extractTextContent(item.value);

      // Doc Code
      if (
        !docCodeItem &&
        (label.includes('รหัสเอกสาร') || label.includes('รหัสคำร้อง') || label.includes('เอกสารที่ขอยกเลิก') || label.includes('Doc No') || label.includes('Document Code'))
      ) {
        docCodeItem = item;
      }
      // Next Step / Signatory
      else if (
        !nextStepItem &&
        (label.includes('ขั้นตอนถัดไป') || label.includes('สายการอนุมัติ') || label.includes('ผู้มีอำนาจทบทวน') || label.includes('ส่งต่อไปยัง') || label.includes('Next Step'))
      ) {
        nextStepItem = item;
      }
      // Revision change
      else if (
        !revItem &&
        (label.includes('การเปลี่ยนแปลงฉบับ') || label.includes('ฉบับที่จะยกเลิก') || label.includes('ฉบับที่') || label.includes('Revision'))
      ) {
        revItem = item;
      }
      // Document Title
      else if (
        !docTitleItem &&
        (label.includes('ชื่อเอกสาร') || label.includes('ชื่อเอกสารฉบับใหม่') || label.includes('Document Name') || label.includes('Title'))
      ) {
        docTitleItem = item;
      }
      // Detail or summary textarea blocks
      else if (
        !detailItem &&
        (label.includes('รายละเอียด') || label.includes('สรุปการแก้ไข') || label.includes('ผลกระทบ') || label.includes('ความเห็นประกอบ'))
      ) {
        detailItem = item;
      }
      // Combined document field (e.g. "[SOP-QA-01] Work Instruction...")
      else if (!docCodeItem && (label.includes('เอกสาร') || label.includes('เอกสารที่ขอยกเลิก')) && textVal.startsWith('[')) {
        const match = textVal.match(/^\[(.*?)\]\s*(.*)$/);
        if (match) {
          docCodeItem = { label: 'รหัสเอกสาร', value: match[1] };
          if (!docTitleItem && match[2]) {
            docTitleItem = { label: 'ชื่อเอกสาร', value: match[2] };
          }
        } else {
          docCodeItem = item;
        }
      }
      // Standard metadata
      else {
        metadataItems.push(item);
      }
    });

    return {
      docCodeItem,
      docTitleItem,
      revItem,
      nextStepItem,
      detailItem,
      metadataItems
    };
  }, [items]);

  // หาข้อมูล Approver จาก approvalWorkflow array (Dynamic Workflow Binding)
  const nextSignatory = useMemo(() => {
    if (!dar || !dar.approvalWorkflow) return null;
    
    // หากเป็นโหมด Review -> ขั้นต่อไปคือ APPROVER
    return dar.approvalWorkflow.find(step => step.roleKey === 'APPROVER');
  }, [dar]);

  const nextActorNameFromWorkflow = nextSignatory?.name || nextSignatory?.assignedTo;
  const nextActorRoleFromWorkflow = nextSignatory?.role;

  // Helper to parse Next Step actor details
  const nextActorData = useMemo(() => {
    if (!categorized.nextStepItem && !nextSignatory) return null;
    const rawVal = categorized.nextStepItem?.value;
    const rawText = rawVal ? extractTextContent(rawVal) : '';
    
    // Extract name & role
    let title = 'ส่งต่อเพื่อพิจารณาขั้นถัดไป';
    let name = nextActorNameFromWorkflow || rawText;
    let role = nextActorRoleFromWorkflow || '';

    if (!nextSignatory) {
      if (rawText.includes('ส่งต่อไปยัง:')) {
        name = rawText.replace(/.*ส่งต่อไปยัง:\s*/, '').trim();
      } else if (rawText.includes('ส่งต่อให้:')) {
        name = rawText.replace(/.*ส่งต่อให้:\s*/, '').trim();
      } else if (rawText.includes('ส่งกลับไปยัง:')) {
        title = 'ส่งกลับเพื่อดำเนินการแก้ไข';
        name = rawText.replace(/.*ส่งกลับไปยัง:\s*/, '').trim();
      } else if (rawText.includes('สิ้นสุดคำร้อง:')) {
        title = 'สิ้นสุดกระบวนการคำร้อง';
        name = rawText.replace(/.*สิ้นสุดคำร้อง:\s*/, '').trim();
      }

      // Check if contains (Role)
      const parenMatch = name.match(/^(.*?)\s*\((.*?)\)$/);
      if (parenMatch) {
        name = parenMatch[1];
        role = parenMatch[2];
      }
    }

    const nextActorInitials = (name && name.length > 0) 
      ? name.trim().substring(0, 1) 
      : 'ผ';

    return {
      title,
      name: name || 'ผู้อนุมัติ (Approver)',
      role: role || (nextSignatory ? 'Approver' : ''),
      initials: nextActorInitials,
      originalValue: rawVal
    };
  }, [categorized.nextStepItem, nextSignatory, nextActorNameFromWorkflow, nextActorRoleFromWorkflow]);

  // Helper to render values with proper typography
  const renderItemValue = (item) => {
    if (item.value === undefined || item.value === null || item.value === '') return '-';

    // If string represents a revision transition (e.g. Rev.00 ➔ Rev.01 or 00 -> 01)
    if (typeof item.value === 'string' && (item.value.includes('➔') || item.value.includes('->') || item.value.includes('→'))) {
      const parts = item.value.split(/\s*(?:➔|->|→)\s*/);
      if (parts.length === 2) {
        const fromRev = parts[0].trim();
        const toRev = parts[1].trim();
        return (
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              {fromRev.startsWith('Rev') ? fromRev : `Rev.${fromRev}`}
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200/80 font-bold">
              {toRev.startsWith('Rev') ? toRev : `Rev.${toRev}`}
            </span>
          </div>
        );
      }
    }

    return item.value;
  };

  const hasHeroSection = !!(categorized.docCodeItem || categorized.docTitleItem || categorized.revItem);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 transition-all">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col transition-all animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Strip */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center shrink-0">
                  {theme.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold tracking-tight text-slate-900 truncate">
                    {title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 font-normal">
                    กรุณาตรวจสอบรายละเอียดสรุปก่อนดำเนินการยืนยัน
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0 ml-2 outline-none cursor-pointer"
                disabled={isLoading || isSubmitting}
                title="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body - Clean single scrollable area */}
            <div className="overflow-y-auto flex-1 p-0 custom-scrollbar divide-y divide-slate-100">
              {/* Hero Document Identity Card */}
              {hasHeroSection && (
                <div className="mx-6 mt-4 p-4 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {categorized.docCodeItem && (
                      <div className="flex items-center gap-2">
                        {React.isValidElement(categorized.docCodeItem.value) ? (
                          categorized.docCodeItem.value
                        ) : (
                          <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-200/50">
                            {renderItemValue(categorized.docCodeItem)}
                          </span>
                        )}
                      </div>
                    )}
                    {categorized.revItem && (
                      <div className="flex items-center">
                        {renderItemValue(categorized.revItem)}
                      </div>
                    )}
                  </div>

                  {categorized.docTitleItem && (
                    <div className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                      {renderItemValue(categorized.docTitleItem)}
                    </div>
                  )}
                </div>
              )}

              {/* Compact Metadata Grid (2-Column Key-Value) */}
              {categorized.metadataItems.length > 0 && (
                <div className="px-6 py-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {categorized.metadataItems.map((item, idx) => (
                    <div key={idx} className="space-y-1 min-w-0">
                      <p className="text-slate-400 font-medium text-[11px] tracking-wide">
                        {item.label}
                      </p>
                      <div className="text-slate-800 font-semibold break-all break-words min-w-0 [overflow-wrap:anywhere] leading-snug">
                        {renderItemValue(item)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Details / Comments Card (if present) */}
              {categorized.detailItem && (
                <div className="px-6 py-3">
                  <div className="p-3 rounded-xl bg-slate-50/60 border border-slate-200/60 space-y-1">
                    <p className="text-[11px] font-medium text-slate-400">
                      {categorized.detailItem.label}
                    </p>
                    <div className="text-xs text-slate-700 leading-relaxed break-all break-words [overflow-wrap:anywhere]">
                      {renderItemValue(categorized.detailItem)}
                    </div>
                  </div>
                </div>
              )}

              {/* Next Signatory Pathway Card (Gen-Z SaaS Style) */}
              {nextActorData && (
                <div className="mx-6 mb-5 p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between text-xs transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar อิงจากตัวอักษรแรกของชื่อจริง */}
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[13px] shadow-sm shrink-0">
                      {nextActorData.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-blue-600 font-medium mb-0.5">
                        {nextActorData.title}
                      </p>
                      {React.isValidElement(nextActorData.originalValue) && nextActorData.originalValue.props?.['data-testid'] ? (
                        nextActorData.originalValue
                      ) : (
                        <p className="text-slate-900 font-semibold text-[13px] truncate">
                          {nextActorData.name} 
                          {nextActorData.role && (
                            <span className="text-slate-500 font-normal ml-1.5 text-[11px]">
                              ({nextActorData.role})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white border border-blue-100 flex items-center justify-center shadow-sm shrink-0">
                    <Send className="w-4 h-4 text-blue-600 shrink-0 relative -left-px mt-px" strokeWidth={2}/>
                  </div>
                </div>
              )}

              {/* Type to Confirm Guardrail (Obsolete / Critical Actions) */}
              {requireTypeToConfirm && (
                <div className="p-5 mx-6 my-3 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2.5">
                  <label className="block text-xs font-semibold text-rose-800">
                    นี่เป็นการดำเนินการสำคัญ กรุณาพิมพ์{' '}
                    <span className="select-all bg-rose-100 px-1.5 py-0.5 rounded font-mono font-bold text-rose-900">
                      CONFIRM
                    </span>{' '}
                    เพื่อยืนยัน:
                  </label>
                  <input
                    type="text"
                    value={typedConfirmation}
                    onChange={(e) => setTypedConfirmation(e.target.value)}
                    placeholder="พิมพ์ CONFIRM"
                    className="w-full px-3 py-2 text-xs border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 transition-all font-mono uppercase bg-white text-slate-900"
                    disabled={isLoading}
                  />
                </div>
              )}
            </div>

            {/* Action Footer Buttons (Linear-Grade Polish) */}
            <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-150 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors cursor-pointer outline-none"
                disabled={isLoading || isSuccess}
              >
                {cancelText || 'ยกเลิก / กลับไปแก้ไข'}
              </button>
              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={isConfirmDisabled}
                className={`h-9 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 min-w-[130px] cursor-pointer outline-none ${
                  isConfirmDisabled
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
                    : theme.btn
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isSuccess ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <CheckCircle className="w-4 h-4 text-white" />
                    </motion.div>
                  ) : (isLoading || isSubmitting) ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      className="flex items-center gap-1.5 text-white"
                    >
                      <Loader2 className="animate-spin h-3.5 w-3.5 text-current" strokeWidth={2} />
                      กำลังประมวลผล...
                    </motion.div>
                  ) : (
                    <motion.span
                      key="text"
                      initial={{ opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 3 }}
                      className="flex items-center gap-1.5"
                    >
                      {confirmLabel || confirmText || theme.confirmDefault}
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

