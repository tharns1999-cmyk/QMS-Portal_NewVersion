import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Archive, 
  Flame, 
  FileCheck, 
  UserCheck, 
  Tag, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';

/**
 * DccRecallActionModal
 * High-Efficiency Two-Column Sequential Recall & Physical Disposition Modal for DCC Officers
 * ISO 9001:2015 Clause 7.5.3 Compliant
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
  const [witnessName, setWitnessName] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [dccNotes, setDccNotes] = useState('');

  const copies = group?.copies || [];

  // Synchronize initial selection based on physical receipt state in store
  useEffect(() => {
    if (isOpen && group && copies.length > 0) {
      const alreadyReceived = copies
        .filter(c => c.status === 'RECALLED' || c.status === 'RECEIVED_AT_DCC' || c.recalled_at)
        .map(c => c.id);

      // Pre-select copies already received at DCC; if none yet, default to all
      if (alreadyReceived.length > 0) {
        setCollectedCopyIds(alreadyReceived);
      } else {
        setCollectedCopyIds(copies.map(c => c.id));
      }
    }
  }, [isOpen, group]);

  const allCollected = collectedCopyIds.length === copies.length && copies.length > 0;
  const isReadyToSubmit = collectedCopyIds.length > 0 && Boolean(dispositionMethod);

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
      witnessName: witnessName.trim(),
      referenceNo: referenceNo.trim(),
      notes: dccNotes.trim(),
      taskId: group.taskId,
    });

    const label = dispositionMethod === 'STAMP_AND_ARCHIVE'
      ? 'ประทับตรา OBSOLETE และเก็บเข้าคลังประวัติ'
      : 'ทำลาย (Shred / Destroy)';

    toast.success(`บันทึกการเรียกคืน ${collectedCopyIds.length}/${copies.length} ชุด — ${label} สำเร็จ`);
    if (onComplete) {
      onComplete({ 
        collectedCopyIds, 
        dispositionMethod, 
        witnessName, 
        referenceNo, 
        notes: dccNotes 
      });
    }
    onClose();
  };

  const progress = copies.length > 0 ? (collectedCopyIds.length / copies.length) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* ================= HEADER ================= */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Archive className="text-indigo-600 shrink-0" size={18} />
              <span>บันทึกการเรียกคืนและทำลายสำเนา (Recall &amp; Disposition)</span>
              <span className="sr-only">จัดการเรียกคืนสำเนาควบคุม</span>
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-600">
              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                [ {group.docCode} ]
              </span>
              <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                Rev.{group.docVersion || '00'}
              </span>
              <span className="text-slate-600 truncate max-w-md" title={group.docTitle}>
                {group.docTitle}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0 ml-3 cursor-pointer"
            title="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        {/* ================= BODY (Two-Column Split Layout) ================= */}
        <div className="flex-1 overflow-y-auto p-6 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

            {/* ---------- LEFT COLUMN (5/12): Physical Copy Check-in ---------- */}
            <div className="md:col-span-5 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-mono">1</span>
                  <span>1. ตรวจรับเล่มสำเนาจริง</span>
                  <span className="sr-only">ขั้นตอนที่ 1</span>
                  <span className="font-mono font-normal text-slate-500">
                    ({collectedCopyIds.length}/{copies.length})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
                >
                  {collectedCopyIds.length === copies.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                </button>
              </div>

              {/* Scrollable Copy List */}
              <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                {copies.map((copy) => {
                  const isChecked = collectedCopyIds.includes(copy.id);
                  const isDamaged = copy.isDamaged || copy.status === 'DAMAGED_PENDING_RECALL';

                  return (
                    <label
                      key={copy.id}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                        isChecked 
                          ? 'border-sky-300 bg-sky-50/40 shadow-2xs' 
                          : 'border-slate-200 bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCollect(copy.id)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 shrink-0 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            Copy {copy.copy_no || copy.ccNumber || '01'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {copy.holder_dept || copy.department}
                          </span>
                          {isDamaged && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              ชำรุด
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                          <MapPin size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate">
                            {copy.location || copy.locationName || copy.station_name ||
                              `${copy.holder_dept || copy.department} Head Office`}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Minimal Progress Bar */}
              <div className="pt-1 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>ความคืบหน้าการตรวจรับ</span>
                  <span className="font-bold text-slate-700">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${allCollected ? 'bg-emerald-500' : 'bg-sky-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ---------- RIGHT COLUMN (7/12): Disposition Method & Audit Evidence ---------- */}
            <div className="md:col-span-7 space-y-4">
              {/* Step 2: Physical Disposition Method */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-mono">2</span>
                  <span>2. วิธีการจัดการทางกายภาพ (Disposition Method)</span>
                  <span className="text-rose-500 ml-0.5">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Shred / Destroy */}
                  <label className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1.5 transition-all ${
                    dispositionMethod === 'DESTROY_SCRAP'
                      ? 'ring-2 ring-sky-500 border-transparent bg-sky-50/30 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="dispositionMethod"
                        value="DESTROY_SCRAP"
                        checked={dispositionMethod === 'DESTROY_SCRAP'}
                        onChange={() => setDispositionMethod('DESTROY_SCRAP')}
                        className="text-sky-600 w-4 h-4 shrink-0 cursor-pointer"
                      />
                      <div className="flex items-center gap-1.5">
                        <Flame size={15} className="text-rose-500 shrink-0" />
                        <span className="font-bold text-slate-900 text-xs">
                          ทำลายทิ้ง (Shred / Destroy)
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed pl-6">
                      ย่อยทำลายเล่มจริงทั้งหมด และบันทึกลงทะเบียนประวัติการทำลายสำเนา
                    </p>
                  </label>

                  {/* Option 2: Stamp OBSOLETE & Archive */}
                  <label className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1.5 transition-all ${
                    dispositionMethod === 'STAMP_AND_ARCHIVE'
                      ? 'ring-2 ring-sky-500 border-transparent bg-sky-50/30 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="dispositionMethod"
                        value="STAMP_AND_ARCHIVE"
                        checked={dispositionMethod === 'STAMP_AND_ARCHIVE'}
                        onChange={() => setDispositionMethod('STAMP_AND_ARCHIVE')}
                        className="text-sky-600 w-4 h-4 shrink-0 cursor-pointer"
                      />
                      <div className="flex items-center gap-1.5">
                        <Archive size={15} className="text-indigo-500 shrink-0" />
                        <span className="font-bold text-slate-900 text-xs">
                          ประทับตรา OBSOLETE &amp; เข้าคลัง
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed pl-6">
                      ประทับตรายกเลิกสีแดงบนเล่มจริง และจัดเก็บเข้าแฟ้มประวัติ Master Archive
                    </p>
                  </label>
                </div>
              </div>

              {/* Step 3: Reference, Witness & Notes */}
              <div className="space-y-3 pt-1">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-mono">3</span>
                  <span>3. บันทึกหลักฐาน (Audit Evidence)</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <Tag size={12} className="text-slate-400" /> เลขที่เอกสารอ้างอิง / กล่อง
                    </label>
                    <input
                      type="text"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      placeholder="เช่น REF-DISP-2026-001"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <UserCheck size={12} className="text-slate-400" /> ชื่อพยาน / ผู้ร่วมตรวจสอบ
                    </label>
                    <input
                      type="text"
                      value={witnessName}
                      onChange={(e) => setWitnessName(e.target.value)}
                      placeholder="เช่น คุณบีม (QC)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    บันทึกข้อความ DCC
                  </label>
                  <textarea
                    rows={2}
                    value={dccNotes}
                    onChange={(e) => setDccNotes(e.target.value)}
                    placeholder="ระบุข้อความบันทึกเพิ่มเติมสำหรับการตรวจประเมิน..."
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all resize-none"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ================= FOOTER ================= */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs">
            {isReadyToSubmit ? (
              <span className="text-emerald-600 font-semibold inline-flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                <span>✓ พร้อมลงทะเบียน ({collectedCopyIds.length} ชุด)</span>
              </span>
            ) : (
              <span className="text-amber-700 font-medium inline-flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                <span>
                  {collectedCopyIds.length === 0
                    ? 'ยังไม่ได้ตรวจรับเล่มสำเนา'
                    : !dispositionMethod
                    ? `⚠️ ตรวจรับแล้ว ${collectedCopyIds.length}/${copies.length} ชุด (ยังไม่เลือกวิธีทำลาย)`
                    : `ตรวจรับแล้ว ${collectedCopyIds.length}/${copies.length} ชุด`}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmDisposition}
              disabled={!isReadyToSubmit}
              className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                isReadyToSubmit
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <FileCheck size={14} />
              <span>บันทึกการจัดการสำเนาและลงทะเบียน</span>
              <span className="sr-only">บันทึกการเรียกคืน</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DccRecallActionModal;
