import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Clock, User, Info, CheckCircle, ShieldAlert, History } from 'lucide-react';
import useStore from '../../store/useStore';
import dayjs from 'dayjs';

const ExternalDocHistoryModal = ({ isOpen, onClose, document: doc }) => {
  const { externalAuditTrail } = useStore();

  if (!isOpen || !doc) return null;

  const docCode = doc.edCode || doc.doc_code || doc.docNo || doc.id;

  const docHistory = (externalAuditTrail || [])
    .filter(log => log.docId === doc.id || log.docCode === docCode || log.docTitle === doc.title)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

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
            className="relative w-full max-w-3xl bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-stone-200/50 overflow-hidden flex flex-col max-h-[88vh] z-10 my-auto"
          >
            {/* Header: Claude Aesthetic (White/Flat) */}
            <div className="bg-white px-8 pt-8 pb-4 border-b border-stone-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#f9f8f6] text-[#da7756] border border-stone-200 flex items-center justify-center shrink-0">
                  <History size={24} />
                </div>
                <div>
                  <h2 className="text-[#2d2d2d] font-bold text-xl sm:text-2xl tracking-tight flex items-center gap-2">
                    ประวัติเอกสารภายนอก (External Document History)
                  </h2>
                  <p className="text-stone-500 text-sm sm:text-base mt-1 font-medium">
                    {docCode} - {doc.title}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="text-stone-400 hover:text-[#2d2d2d] hover:bg-stone-50 rounded-xl p-2 transition-colors focus:ring-2 focus:ring-[#da7756]/20 outline-none"
                title="ปิดหน้าต่าง"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 bg-[#f9f8f6] scrollbar-thin">
              {/* Document Info Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">รหัสเอกสาร</div>
                  <div className="text-sm font-mono font-bold text-[#da7756]">{docCode}</div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">ฉบับปัจจุบัน</div>
                  <div className="text-sm font-bold text-[#2d2d2d] font-mono">Rev.{doc.rev || '01'}</div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">สถานะเอกสาร</div>
                  <div className="text-sm font-bold text-[#4a724b]">{doc.status}</div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">ระดับสิทธิ์</div>
                  <div className="text-sm font-bold text-[#b87c33]">{doc.accessScope || 'General'}</div>
                </div>
              </div>

              {/* History Timeline */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-[#2d2d2d] flex items-center gap-2">
                  <Clock className="text-stone-400" size={18} /> ประวัติการดำเนินการ (Audit Trail Log)
                </h4>
                
                <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-[#2d2d2d]">
                      <thead className="bg-[#f9f8f6] text-stone-500 uppercase font-bold text-[11px] tracking-widest border-b border-stone-200">
                        <tr>
                          <th className="px-5 py-4 whitespace-nowrap">วันและเวลา (Date/Time)</th>
                          <th className="px-5 py-4 whitespace-nowrap">การกระทำ (Action)</th>
                          <th className="px-5 py-4 whitespace-nowrap">ผู้ดำเนินการ (Actor)</th>
                          <th className="px-5 py-4">รายละเอียด (Details)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {docHistory.length > 0 ? (
                          docHistory.map((log) => (
                            <tr key={log.id} className="hover:bg-[#fdfcfb] transition-colors border-b border-stone-100 last:border-b-0">
                              <td className="px-5 py-4 whitespace-nowrap font-mono text-stone-500 text-sm">
                                {dayjs(log.date).format('YYYY-MM-DD HH:mm')}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <span className="px-3 py-1 rounded-md bg-[#f3f2ef] border border-stone-200 text-stone-700 font-bold font-mono text-xs">
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap font-medium text-[#2d2d2d] text-sm">
                                {log.actor || 'System'}
                              </td>
                              <td className="px-5 py-4 text-stone-600 text-sm leading-relaxed">
                                {log.details}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-stone-400">
                              ยังไม่มีประวัติการดำเนินการบันทึกไว้
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#f9f8f6] border-t border-stone-200 px-8 py-5 flex items-center justify-end rounded-b-2xl shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="bg-white hover:bg-stone-50 text-stone-600 font-bold text-base px-6 py-3 rounded-xl border border-stone-200 transition-colors focus:ring-4 focus:ring-stone-200 outline-none"
              >
                ปิดหน้าต่าง (Close)
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ExternalDocHistoryModal;
