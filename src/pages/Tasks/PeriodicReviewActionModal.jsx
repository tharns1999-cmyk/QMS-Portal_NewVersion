import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, CheckCircle2, AlertTriangle, FileText, Globe, ArrowRight,
  ShieldCheck, RefreshCw, Calendar, Building2, ExternalLink
} from 'lucide-react';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';

export default function PeriodicReviewActionModal({ isOpen, onClose, task, onSuccess }) {
  const navigate = useNavigate();
  const { currentUser, confirmPeriodicReviewNoChange, verifyExternalDocument } = useStore();

  // Internal Doc State
  const [internalAction, setInternalAction] = useState('NO_CHANGE'); // 'NO_CHANGE' | 'REVISION_REQUIRED'
  const [internalComment, setInternalComment] = useState('');

  // External Doc State
  const [verificationChannel, setVerificationChannel] = useState('');
  const [verificationResult, setVerificationResult] = useState('CURRENT_VALID'); // 'CURRENT_VALID' | 'NEW_VERSION_FOUND'
  const [externalComment, setExternalComment] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !task) return null;

  const isExternal = task.type === 'EXTERNAL_VERIFICATION' || 
                     task.origin === 'EXTERNAL' || 
                     task.documentCategory === 'EXTERNAL';

  const handleInternalSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (internalAction === 'NO_CHANGE') {
        confirmPeriodicReviewNoChange({
          scheduleId: task.scheduleId,
          comment: internalComment || 'ยืนยันคงเดิม ไม่มีการเปลี่ยนแปลง',
          reviewer: currentUser?.name,
          reviewDate: new Date().toISOString().split('T')[0]
        });
        toast.success('ยืนยันคงเดิมสำเร็จ รอบทบทวนถัดไปถูกคำนวณใหม่โดยคงเลข Revision เดิม');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        // Action B: Requires Revision -> navigate to DAR with origin PERIODIC_REVIEW
        if (!internalComment.trim()) {
          toast.error('กรุณาระบุเหตุผลหรือรายละเอียดการแก้ไข');
          setIsSubmitting(false);
          return;
        }
        toast.success('กำลังเปิดแบบฟอร์ม DAR ขอแก้ไขเอกสาร...');
        onClose();
        navigate('/dcc/dar/new', {
          state: {
            prefillDocId: task.docId || task.referenceId,
            prefillDocCode: task.docCode || task.documentNumber,
            prefillDocTitle: task.docTitle || task.documentName,
            darOrigin: 'PERIODIC_REVIEW',
            dar_origin: 'PERIODIC_REVIEW',
            reason: internalComment,
            type: 'REVISION'
          }
        });
      }
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึกผลการทบทวน');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExternalSubmit = async (e) => {
    e.preventDefault();
    if (!verificationChannel.trim()) {
      toast.error('กรุณาระบุช่องทางการตรวจสอบ / URL แหล่งอ้างอิง');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = verifyExternalDocument({
        scheduleId: task.scheduleId,
        docId: task.docId || task.referenceId,
        verificationChannel: verificationChannel.trim(),
        verificationResult,
        comment: externalComment.trim(),
        reviewer: currentUser?.name,
        verificationDate: new Date().toISOString().split('T')[0]
      });

      if (verificationResult === 'CURRENT_VALID') {
        toast.success('บันทึกผลการตรวจสอบเรียบร้อย รอบถัดไปขยับตามรอบปี');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.success('ปรับสถานะเอกสารเป็น SUPERSEDED สำเร็จ กำลังเปิดแบบฟอร์มขึ้นทะเบียนฉบับใหม่');
        if (onSuccess) onSuccess();
        onClose();
        navigate('/dcc/external-docs', {
          state: {
            action: 'register',
            supersedesId: task.docId || task.referenceId,
            supersedesCode: task.docCode || task.documentNumber,
            supersedesTitle: task.docTitle || task.documentName
          }
        });
      }
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึกการตรวจสอบ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isExternal ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
            }`}>
              {isExternal ? <Globe size={20} /> : <FileText size={20} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {isExternal ? 'ตรวจสอบความทันสมัยเอกสารภายนอก' : 'ทบทวนเอกสารตามรอบ (Periodic Review)'}
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {task.docCode || task.documentNumber} · {isExternal ? 'External Document' : 'Internal Document'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Document Context Card */}
        <div className="p-6 bg-slate-50/40 border-b border-slate-100">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-slate-900 text-sm">{task.docTitle || task.documentName}</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                task.dueState === 'OVERDUE' || task.statusFlag === 'OVERDUE' 
                  ? 'bg-rose-100 text-rose-700 animate-pulse'
                  : task.dueState === 'DUE_SOON_30' || task.statusFlag === 'UPCOMING'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
              }`}>
                {task.statusFlag === 'OVERDUE' || task.dueState === 'OVERDUE' ? 'เกินกำหนด' : 'ถึงรอบทบทวน'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <Building2 size={13} className="text-slate-400" />
                <span>แผนก: <strong className="text-slate-700">{task.department || task.assignedToDepartmentId || '-'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-400" />
                <span>วันครบกำหนด: <strong className="text-slate-700 font-mono">{task.dueDate || '-'}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Form Body */}
        {isExternal ? (
          /* ── EXTERNAL DOCUMENT VERIFICATION FLOW ── */
          <form onSubmit={handleExternalSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                ช่องทางการตรวจสอบ / URL แหล่งอ้างอิง <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input 
                  type="text"
                  required
                  placeholder="เช่น เว็บไซต์กระทรวง, เว็บไซต์ สมอ. (TISI), ISO.org, URL แหล่งข้อมูล"
                  value={verificationChannel}
                  onChange={(e) => setVerificationChannel(e.target.value)}
                  className="w-full px-3.5 py-2 pl-9 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                <ExternalLink size={14} className="absolute left-3 top-2.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                ผลการตรวจสอบความทันสมัย <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  verificationResult === 'CURRENT_VALID'
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}>
                  <input 
                    type="radio" 
                    name="extResult" 
                    value="CURRENT_VALID"
                    checked={verificationResult === 'CURRENT_VALID'}
                    onChange={() => setVerificationResult('CURRENT_VALID')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">ยังคงทันสมัย (Current Valid)</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">ใช้งานฉบับปัจจุบันต่อไปโดยขยับรอบตรวจสอบ</span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  verificationResult === 'NEW_VERSION_FOUND'
                    ? 'border-rose-500 bg-rose-50/60 ring-1 ring-rose-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}>
                  <input 
                    type="radio" 
                    name="extResult" 
                    value="NEW_VERSION_FOUND"
                    checked={verificationResult === 'NEW_VERSION_FOUND'}
                    onChange={() => setVerificationResult('NEW_VERSION_FOUND')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">พบฉบับใหม่ภายนอก</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">ปรับเป็น SUPERSEDED และขึ้นทะเบียนใหม่</span>
                  </div>
                </label>
              </div>
            </div>

            {verificationResult === 'NEW_VERSION_FOUND' && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <span>
                  <strong>แจ้งเตือน:</strong> เอกสารฉบับนี้จะถูกปรับสถานะเป็น <strong>SUPERSEDED (ตกรุ่น)</strong> ทันที และระบบจะนำทางไปยังหน้าจอขึ้นทะเบียนเอกสารภายนอกฉบับใหม่
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                บันทึก / ข้อคิดเห็นประกอบ
              </label>
              <textarea 
                rows={3}
                placeholder="ระบุรายละเอียดผลการสืบค้น หรือหมายเหตุเพิ่มเติม..."
                value={externalComment}
                onChange={(e) => setExternalComment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                  verificationResult === 'NEW_VERSION_FOUND'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isSubmitting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : verificationResult === 'NEW_VERSION_FOUND' ? (
                  <>
                    <span>ปรับเป็น SUPERSEDED และขึ้นทะเบียนใหม่</span>
                    <ArrowRight size={14} />
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>บันทึกผลการตรวจสอบ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ── INTERNAL DOCUMENT PERIODIC REVIEW FLOW ── */
          <form onSubmit={handleInternalSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                เลือกการดำเนินการทบทวน (Review Action) <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  internalAction === 'NO_CHANGE'
                    ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}>
                  <input 
                    type="radio" 
                    name="intAction" 
                    value="NO_CHANGE"
                    checked={internalAction === 'NO_CHANGE'}
                    onChange={() => setInternalAction('NO_CHANGE')}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Action A: ยืนยันคงเดิม</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      เนื้อหายังคงถูกต้องเหมาะสม ไม่แก้ไขและคงเลข Revision เดิม
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  internalAction === 'REVISION_REQUIRED'
                    ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}>
                  <input 
                    type="radio" 
                    name="intAction" 
                    value="REVISION_REQUIRED"
                    checked={internalAction === 'REVISION_REQUIRED'}
                    onChange={() => setInternalAction('REVISION_REQUIRED')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Action B: พบจุดแก้ไข</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      เปิดแบบฟอร์ม DAR ขอแก้ไขเอกสาร (ผูกต้นกำเนิดการทบทวนตามรอบ)
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                {internalAction === 'REVISION_REQUIRED' ? 'เหตุผลและจุดที่ต้องปรับปรุงแก้ไข' : 'บันทึกข้อคิดเห็นการทบทวน (ถ้ามี)'}
                {internalAction === 'REVISION_REQUIRED' && <span className="text-rose-500"> *</span>}
              </label>
              <textarea 
                rows={3}
                required={internalAction === 'REVISION_REQUIRED'}
                placeholder={
                  internalAction === 'REVISION_REQUIRED'
                    ? 'ระบุเหตุผล ข้อความ หรือขั้นตอนที่ต้องขอปรับปรุงแก้ไขในคำร้อง DAR...'
                    : 'ระบุผลการประเมิน เช่น กระบวนการยังคงสอดคล้องกับมาตรฐาน ISO 9001 และหน้างานจริง...'
                }
                value={internalComment}
                onChange={(e) => setInternalComment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>

            {internalAction === 'NO_CHANGE' && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2">
                <ShieldCheck size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>ISO 9001 Cl. 7.5.3:</strong> ระบบจะบันทึกประวัติการทบทวนลงใน Review History และคำนวณวันครบกำหนดรอบถัดไปตามประเภทเอกสาร โดยเลข Revision จะ<strong>ไม่เปลี่ยนแปลง</strong>
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                  internalAction === 'REVISION_REQUIRED'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSubmitting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : internalAction === 'REVISION_REQUIRED' ? (
                  <>
                    <span>เปิดแบบฟอร์ม DAR แก้ไขเอกสาร</span>
                    <ArrowRight size={14} />
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>ยืนยันคงเดิม (Re-affirm)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
