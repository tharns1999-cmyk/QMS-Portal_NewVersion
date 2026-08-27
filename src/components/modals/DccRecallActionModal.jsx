import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, MapPin, Building, Archive, Flame, FileCheck } from 'lucide-react';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';

/**
 * DccRecallActionModal
 * Multi-Step Sequential Recall & Physical Disposition Modal for DCC Officers
 *
 * Props:
 *   isOpen     {boolean}  Whether the modal is visible
 *   onClose    {function} Close callback
 *   group      {object}   Recall group { docId, docCode, docTitle, docVersion, taskId, copies[] }
 *   onComplete {function} Called after successful confirmation
 */
const DccRecallActionModal = ({ isOpen, onClose, group, onComplete }) => {
  const { completeCopyRecallAndArchive } = useStore();

  const [collectedCopyIds, setCollectedCopyIds] = useState([]);
  const [dispositionMethod, setDispositionMethod] = useState('');
  const [dccNotes, setDccNotes] = useState('');

  const copies = group?.copies || [];
  const allCollected = collectedCopyIds.length === copies.length && copies.length > 0;

  const uniqueDeptsCount = useMemo(() => {
    if (!copies.length) return 0;
    return new Set(copies.map(c => c.holder_dept || c.department || '-')).size;
  }, [copies]);

  if (!isOpen || !group) return null;

  const handleToggleCollect = (copyId) => {
    setCollectedCopyIds(prev =>
      prev.includes(copyId) ? prev.filter(id => id !== copyId) : [...prev, copyId]
    );
  };

  const handleSelectAll = () => {
    setCollectedCopyIds(
      collectedCopyIds.length === copies.length ? [] : copies.map(c => c.id)
    );
  };

  const handleConfirmDisposition = () => {
    if (collectedCopyIds.length === 0) {
      toast.error('กรุณาเลือกสำเนาที่รับเล่มมาแล้วอย่างน้อย 1 ชุด');
      return;
    }
    if (!dispositionMethod) {
      toast.error('กรุณาเลือกวิธีการจัดการสำเนาจริง (ขั้นตอนที่ 2)');
      return;
    }

    completeCopyRecallAndArchive({
      documentCode: group.docCode,
      collectedCopyIds,
      dispositionMethod,
      notes: dccNotes,
      taskId: group.taskId,
    });

    const label = dispositionMethod === 'STAMP_AND_ARCHIVE'
      ? 'ประทับตรา OBSOLETE และเก็บเข้าคลังประวัติ'
      : 'ทำลาย (Shred / Destroy)';

    toast.success(`บันทึกการเรียกคืน ${collectedCopyIds.length}/${copies.length} ชุด — ${label} สำเร็จ`);
    if (onComplete) onComplete({ collectedCopyIds, dispositionMethod, notes: dccNotes });
    onClose();
  };

  const progress = copies.length > 0 ? (collectedCopyIds.length / copies.length) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[#1E293B]">
              จัดการเรียกคืนสำเนาควบคุม (Recall &amp; Disposition)
            </h3>
            <p className="text-xs text-[#64748B] font-mono mt-0.5 truncate">
              {group.docCode} Rev.{group.docVersion} — {group.docTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9] rounded-lg transition-colors shrink-0 ml-3 cursor-pointer"
            title="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1 scrollbar-thin">

          {/* Impact summary strip */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#92400E]">
              <AlertTriangle className="text-[#D97706] shrink-0" size={15} />
              <span>
                สำเนาทั้งหมด <strong className="font-mono">{copies.length}</strong> ชุด
                {' '}กระจายใน <strong className="font-mono">{uniqueDeptsCount}</strong> แผนก
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-full border border-[#FCD34D] whitespace-nowrap shrink-0">
              {group.docCode} Rev.{group.docVersion}
            </span>
          </div>

          {/* Step 1: Check-in Physical Copies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#334155]">
                ขั้นตอนที่ 1: ตรวจรับเล่มสำเนาจริงจากสถานีใช้งาน
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-semibold text-[#0D99FF] hover:underline cursor-pointer"
              >
                {collectedCopyIds.length === copies.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
            </div>

            <div className="border border-[#E2E8F0] rounded-xl overflow-hidden divide-y divide-[#F1F5F9]">
              {copies.map((copy) => {
                const isChecked = collectedCopyIds.includes(copy.id);
                return (
                  <label
                    key={copy.id}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isChecked ? 'bg-[#F0FDF4]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCollect(copy.id)}
                        className="w-4 h-4 rounded border-slate-300 text-[#0D99FF] focus:ring-[#0D99FF] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-[#0D99FF] text-[11px] bg-[#E5F4FF] px-2 py-0.5 rounded border border-[#B8E1FF]">
                            Copy {copy.copy_no || copy.ccNumber || '01'}
                          </span>
                          <span className="font-semibold text-[#1E293B] text-xs flex items-center gap-1">
                            <Building size={11} className="text-slate-400" />
                            {copy.holder_dept || copy.department}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#64748B] mt-0.5">
                          <MapPin size={11} className="text-[#14AE5C] shrink-0" />
                          <span className="truncate">
                            {copy.location || copy.locationName || copy.station_name ||
                              `${copy.holder_dept || copy.department} Head Office`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ml-2 whitespace-nowrap ${
                      isChecked
                        ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                        : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                    }`}>
                      {isChecked ? '✓ รับเล่มแล้ว' : 'รอรับเล่ม'}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${allCollected ? 'bg-[#14AE5C]' : 'bg-[#0D99FF]'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-[#64748B] shrink-0">
                {collectedCopyIds.length}/{copies.length} ชุด
              </span>
            </div>
          </div>

          {/* Step 2: Physical Disposition Method */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-2">
              ขั้นตอนที่ 2: วิธีการจัดการสำเนาจริง (Physical Disposition)
              <span className="text-[#EF4444] ml-1">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              <label className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1.5 transition-all ${
                dispositionMethod === 'STAMP_AND_ARCHIVE'
                  ? 'bg-[#F0F7FF] border-[#0D99FF] ring-2 ring-[#0D99FF]/20 shadow-xs'
                  : 'bg-white border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-[#94A3B8]'
              }`}>
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="dispositionMethod"
                    value="STAMP_AND_ARCHIVE"
                    checked={dispositionMethod === 'STAMP_AND_ARCHIVE'}
                    onChange={() => setDispositionMethod('STAMP_AND_ARCHIVE')}
                    className="text-[#0D99FF] w-3.5 h-3.5 shrink-0"
                  />
                  <div className="flex items-center gap-1.5">
                    <Archive size={14} className="text-[#0D99FF] shrink-0" />
                    <span className="font-bold text-[#1E293B] text-xs">
                      ประทับตรา OBSOLETE &amp; เก็บเข้าคลังประวัติ
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed pl-5">
                  ประทับตรายกเลิกสีแดงบนเล่มจริง และจัดเก็บเข้าแฟ้มประวัติ Master Archive
                </p>
              </label>

              <label className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1.5 transition-all ${
                dispositionMethod === 'DESTROY_SCRAP'
                  ? 'bg-[#FEF2F2] border-[#DC2626] ring-2 ring-[#DC2626]/20 shadow-xs'
                  : 'bg-white border-[#CBD5E1] hover:bg-[#FFF5F5] hover:border-[#FCA5A5]'
              }`}>
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="dispositionMethod"
                    value="DESTROY_SCRAP"
                    checked={dispositionMethod === 'DESTROY_SCRAP'}
                    onChange={() => setDispositionMethod('DESTROY_SCRAP')}
                    className="text-[#DC2626] w-3.5 h-3.5 shrink-0"
                  />
                  <div className="flex items-center gap-1.5">
                    <Flame size={14} className="text-[#DC2626] shrink-0" />
                    <span className="font-bold text-[#1E293B] text-xs">
                      ทำลายทิ้ง (Shred / Destroy)
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed pl-5">
                  ย่อยทำลายเล่มจริงทั้งหมด และบันทึกประวัติใบรับรองการทำลายสำเนา
                </p>
              </label>

            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1.5">
              บันทึกข้อความ DCC (DCC Notes &amp; Audit Reference)
            </label>
            <textarea
              rows={2}
              value={dccNotes}
              onChange={(e) => setDccNotes(e.target.value)}
              placeholder="ระบุหมายเลขกล่องจัดเก็บ หรือเลขอ้างอิงใบทำลายเอกสาร (ไม่บังคับ)..."
              className="w-full p-2.5 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all resize-none"
            />
          </div>

          {/* Validation hint */}
          {collectedCopyIds.length > 0 && !dispositionMethod && (
            <div className="flex items-center gap-2 text-xs text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-2.5">
              <AlertTriangle size={13} className="shrink-0" />
              <span>กรุณาเลือกวิธีการจัดการสำเนาจริง (ขั้นตอนที่ 2) ก่อนยืนยัน</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between shrink-0">
          <div className="text-xs text-[#64748B]">
            ตรวจรับแล้ว{' '}
            <strong className={`font-mono ${allCollected ? 'text-[#14AE5C]' : 'text-[#1E293B]'}`}>
              {collectedCopyIds.length}
            </strong>
            {' '}/ {copies.length} ชุด
            {allCollected && (
              <span className="ml-2 text-[#14AE5C] font-semibold">✓ ครบ 100%</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#475569] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmDisposition}
              disabled={collectedCopyIds.length === 0 || !dispositionMethod}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#0D99FF] hover:bg-[#007BE5] text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-colors cursor-pointer"
            >
              <FileCheck size={14} />
              บันทึกการเรียกคืนและปิดงาน Archive
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DccRecallActionModal;
