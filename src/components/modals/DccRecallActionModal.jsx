import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle, MapPin, Building, Archive, Flame, FileCheck, UserCheck, Tag, CheckCircle2 } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Archive className="text-indigo-600" size={18} />
              จัดการเรียกคืนและบันทึกผลการทำลาย (Recall &amp; Disposition)
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
              {group.docCode} Rev.{group.docVersion} — {group.docTitle}
            </p>
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1 scrollbar-thin">

          {/* Impact summary strip */}
          <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <AlertTriangle className="text-amber-600 shrink-0" size={15} />
              <span>
                สำเนาทั้งหมด <strong className="font-mono font-bold text-amber-950">{copies.length}</strong> ชุด
                {' '}ประจำจุดใน <strong className="font-mono font-bold text-amber-950">{uniqueDeptsCount}</strong> แผนก
              </span>
            </div>
            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-300/60 whitespace-nowrap shrink-0 font-mono">
              {group.docCode} Rev.{group.docVersion}
            </span>
          </div>

          {/* Step 1: Check-in Physical Copies */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-mono">1</span>
                ตรวจรับเล่มสำเนาจริงจากสถานีใช้งาน
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
              >
                {collectedCopyIds.length === copies.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
              {copies.map((copy) => {
                const isChecked = collectedCopyIds.includes(copy.id);
                const isReceivedAtDcc = copy.status === 'RECALLED' || copy.status === 'RECEIVED_AT_DCC' || Boolean(copy.recalled_at);
                const isDamaged = copy.isDamaged || copy.status === 'DAMAGED_PENDING_RECALL';

                return (
                  <label
                    key={copy.id}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isChecked ? 'bg-indigo-50/25' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCollect(copy.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 text-[11px] bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                            Copy {copy.copy_no || copy.ccNumber || '01'}
                          </span>
                          {isDamaged && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              ชำรุด
                            </span>
                          )}
                          <span className="font-semibold text-slate-800 text-xs flex items-center gap-1">
                            <Building size={12} className="text-slate-400" />
                            {copy.holder_dept || copy.department}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <MapPin size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate">
                            {copy.location || copy.locationName || copy.station_name ||
                              `${copy.holder_dept || copy.department} Head Office`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ml-2 whitespace-nowrap flex items-center gap-1 ${
                      isReceivedAtDcc
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {isReceivedAtDcc ? (
                        <>
                          <CheckCircle2 size={11} className="text-sky-600" /> ได้รับเล่มแล้ว
                        </>
                      ) : (
                        'รอเก็บเล่ม'
                      )}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${allCollected ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-600 shrink-0">
                เลือกแล้ว {collectedCopyIds.length}/{copies.length} ชุด ({Math.round(progress)}%)
              </span>
            </div>
          </div>

          {/* Step 2: Physical Disposition Method */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-mono">2</span>
              วิธีการจัดการสำเนาจริง (Physical Disposition Method)
              <span className="text-rose-500 ml-0.5">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              <label className={`p-4 rounded-2xl border cursor-pointer flex flex-col gap-1.5 transition-all ${
                dispositionMethod === 'DESTROY_SCRAP'
                  ? 'bg-rose-50/50 border-rose-400 ring-2 ring-rose-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}>
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="dispositionMethod"
                    value="DESTROY_SCRAP"
                    checked={dispositionMethod === 'DESTROY_SCRAP'}
                    onChange={() => setDispositionMethod('DESTROY_SCRAP')}
                    className="text-rose-600 w-4 h-4 shrink-0 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5">
                    <Flame size={15} className="text-rose-600 shrink-0" />
                    <span className="font-bold text-slate-900 text-xs">
                      ทำลายทิ้ง (Shred / Destroy)
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed pl-6">
                  ย่อยทำลายเล่มจริงทั้งหมด และบันทึกลงทะเบียนประวัติการทำลายสำเนา
                </p>
              </label>

              <label className={`p-4 rounded-2xl border cursor-pointer flex flex-col gap-1.5 transition-all ${
                dispositionMethod === 'STAMP_AND_ARCHIVE'
                  ? 'bg-indigo-50/50 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}>
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="dispositionMethod"
                    value="STAMP_AND_ARCHIVE"
                    checked={dispositionMethod === 'STAMP_AND_ARCHIVE'}
                    onChange={() => setDispositionMethod('STAMP_AND_ARCHIVE')}
                    className="text-indigo-600 w-4 h-4 shrink-0 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5">
                    <Archive size={15} className="text-indigo-600 shrink-0" />
                    <span className="font-bold text-slate-900 text-xs">
                      ประทับตรา OBSOLETE &amp; เก็บเข้าคลัง
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
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-mono">3</span>
              บันทึกอ้างอิงและพยานตรวจรับรอง (ISO 9001 Audit Evidence)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Tag size={12} className="text-slate-400" /> เลขที่เอกสารอ้างอิง / กล่องจัดเก็บ
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="เช่น REF-DISP-2026-001 หรือ BOX-QA-01"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
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
                  placeholder="เช่น นางสาว สมศรี (QMR) หรือ หัวหน้าแผนก"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                บันทึกข้อความ DCC (DCC Notes)
              </label>
              <textarea
                rows={2}
                value={dccNotes}
                onChange={(e) => setDccNotes(e.target.value)}
                placeholder="ระบุข้อความบันทึกเพิ่มเติมสำหรับการตรวจประเมิน..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none"
              />
            </div>
          </div>

          {/* Validation hint */}
          {collectedCopyIds.length > 0 && !dispositionMethod && (
            <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={14} className="shrink-0 text-amber-600" />
              <span>กรุณาเลือกวิธีการจัดการสำเนาจริง (ขั้นตอนที่ 2) ก่อนกดยืนยัน</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            ตรวจรับแล้ว{' '}
            <strong className={`font-mono font-bold ${allCollected ? 'text-emerald-600' : 'text-slate-900'}`}>
              {collectedCopyIds.length}
            </strong>
            {' '}/ {copies.length} ชุด
            {allCollected && (
              <span className="ml-2 text-emerald-600 font-semibold inline-flex items-center gap-1">
                <CheckCircle2 size={12} /> ครบ 100%
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
              disabled={collectedCopyIds.length === 0 || !dispositionMethod}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-slate-900/10 transition-colors cursor-pointer"
            >
              <FileCheck size={14} />
              บันทึกการจัดการสำเนาและลงทะเบียน
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DccRecallActionModal;

