import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  ChevronLeft, 
  Building, 
  MapPin, 
  Calendar, 
  UserCheck, 
  FileText, 
  KeyRound, 
  CheckCircle2, 
  AlertTriangle,
  Lock
} from 'lucide-react';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';

const TaskConfirmHardcopyReceipt = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tasks, controlledCopyInstances, documentControlledCopies, currentUser, confirmHardcopyReceipt } = useStore();

  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAcknowledgedTerms, setHasAcknowledgedTerms] = useState(false);
  const inputRefs = useRef([]);

  const task = (tasks || []).find(t => String(t.id) === String(id));
  const copies = controlledCopyInstances && controlledCopyInstances.length > 0
    ? controlledCopyInstances
    : (documentControlledCopies || []);
    
  const copyId = task ? String(task.copy_id || task.copyId || task.instanceId || '') : '';
  const copy = copies.find(c => String(c.id) === copyId);

  useEffect(() => {
    // Auto-focus first PIN input box on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  if (!task) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-xl border border-[#E5E5E5] text-center shadow-sm">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่พบงานตรวจรับเอกสารนี้</h2>
        <p className="text-[#666666] text-sm mb-6">
          งานนี้อาจได้รับการตรวจรับเสร็จสิ้นแล้ว หรือถูกยกเลิกออกจากระบบ
        </p>
        <button
          onClick={() => navigate('/tasks')}
          className="px-5 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-900 transition-colors inline-flex items-center gap-2"
        >
          <ChevronLeft size={18} /> กลับหน้า Task Inbox
        </button>
      </div>
    );
  }

  const docCode = task.doc_code || copy?.doc_code || copy?.docTitle || task.title;
  const docVersion = task.doc_version || copy?.doc_version || copy?.rev || '01';
  const copyNo = task.copy_no || copy?.copy_no || copy?.ccNumber || '01';
  const issueNo = copy?.issue_no || copy?.issueNumber || '01';
  const location = task.location || copy?.location || copy?.locationName || copy?.station_name || 'จุดใช้งานหลัก';
  const dept = task.target_department || task.targetDepartment || task.assignedToDept || copy?.holder_dept || copy?.department || currentUser?.department;
  const dispatchedAt = copy?.dispatched_at || task.createdAt;
  const dispatchedBy = copy?.dispatched_by || 'เจ้าหน้าที่ DCC';

  const isDccUser = currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.id === 'u5';
  const userDepts = currentUser?.depts || (currentUser?.department ? [currentUser.department] : []);
  const isAuthorized = isDccUser || !dept || userDepts.includes(dept);

  const handlePinChange = (index, value) => {
    // Only accept numeric characters
    if (value && !/^\d+$/.test(value)) return;

    const newPin = [...pin];
    // Take the last character entered
    newPin[index] = value.slice(-1);
    setPin(newPin);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{1,6}$/.test(pastedData)) {
      const digits = pastedData.slice(0, 6).split('');
      const newPin = [...pin];
      digits.forEach((digit, i) => {
        newPin[i] = digit;
      });
      setPin(newPin);
      const nextIndex = Math.min(digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const fullPinString = pin.join('');
  const isPinComplete = fullPinString.length === 6;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAuthorized) {
      toast.error(`คุณไม่มีสิทธิ์ตรวจรับเอกสารของแผนก ${dept}`);
      return;
    }
    if (!isPinComplete) {
      toast.error('กรุณากรอกรหัส Signing PIN ให้ครบทั้ง 6 หลัก');
      return;
    }
    if (!hasAcknowledgedTerms) {
      toast.error('กรุณากดยืนยันข้อความรับรองการตรวจรับเอกสาร');
      return;
    }

    setIsSubmitting(true);
    try {
      confirmHardcopyReceipt(copyId, task.id, {
        name: currentUser.name,
        pin: fullPinString,
        remarks: remarks || 'Confirmed hardcopy receipt and physical placement'
      });

      toast.success(`ตรวจรับเอกสาร ${docCode} (Copy ${copyNo}) ด้วย E-Signature สำเร็จ`);
      navigate('/tasks');
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกการตรวจรับ');
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6 pb-12"
    >
      {/* Top Breadcrumb */}
      <button
        onClick={() => navigate('/tasks')}
        className="flex items-center gap-1.5 text-sm font-bold text-[#666666] hover:text-[#0D99FF] transition-colors"
      >
        <ChevronLeft size={18} /> กลับไปยัง Task Inbox
      </button>

      {/* Main Container Card */}
      <div className="bg-white rounded-3xl border border-[#E5E5E5]/90 shadow-none shadow-slate-200/40 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-xl backdrop-blur-md text-emerald-400">
                <ShieldCheck size={32} strokeWidth={1.75} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-bold font-mono">
                    21 CFR Part 11
                  </span>
                  <span className="text-xs text-slate-300 font-medium">E-Signature Verification</span>
                </div>
                <h1 className="text-2xl font-bold mt-1 text-white tracking-tight">
                  ตรวจรับเอกสารควบคุมฉบับจริง
                </h1>
                <p className="text-sm text-slate-300 mt-0.5">
                  ยืนยันการรับเอกสารฉบับพิมพ์เข้าสู่จุดใช้งานประจำแผนก
                </p>
              </div>
            </div>

            <div className="text-right shrink-0 bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-sm self-start sm:self-auto">
              <div className="text-xs text-slate-400 uppercase font-bold">Copy Identifier</div>
              <div className="text-lg font-bold font-mono text-emerald-400">
                Copy {copyNo} <span className="text-xs text-slate-300 font-normal">({issueNo})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="p-7 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Document Info Card */}
            <div className="p-5 bg-[#F5F5F5] border border-[#E5E5E5]/80 rounded-xl space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <FileText size={16} className="text-[#0D99FF]" /> ข้อมูลเอกสารควบคุม
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-start gap-2 min-w-0">
                  <span className="text-[#666666] shrink-0">รหัสเอกสาร:</span>
                  <span className="font-bold text-[#1E1E1E] font-mono text-base break-all break-words min-w-0 [overflow-wrap:anywhere] text-right">{docCode}</span>
                </div>
                <div className="flex justify-between items-center gap-2 min-w-0">
                  <span className="text-[#666666] shrink-0">ฉบับที่ (Revision):</span>
                  <span className="font-bold text-[#007BE5] font-mono bg-[#E5F4FF] px-2 py-0.5 rounded border border-[#E5F4FF] shrink-0">
                    Rev.{docVersion}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2 min-w-0">
                  <span className="text-[#666666] shrink-0">สถานะการนำส่ง:</span>
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-xs shrink-0">
                    🟡 รอยืนยันรับเล่ม
                  </span>
                </div>
              </div>
            </div>

            {/* Deployment & Dispatch Info */}
            <div className="p-5 bg-[#F5F5F5] border border-[#E5E5E5]/80 rounded-xl space-y-3.5 min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <MapPin size={16} className="text-emerald-600" /> ข้อมูลจุดใช้งานและการนำส่ง
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center gap-2 min-w-0">
                  <span className="text-[#666666] flex items-center gap-1.5 shrink-0">
                    <Building size={14} className="text-slate-400" /> แผนกผู้รับ:
                  </span>
                  <span className="font-bold text-[#1E1E1E] break-all break-words min-w-0 [overflow-wrap:anywhere] text-right">{dept}</span>
                </div>
                <div className="flex justify-between items-start gap-2 min-w-0">
                  <span className="text-[#666666] shrink-0">จุดติดตั้งจริง:</span>
                  <span className="font-bold text-[#1E1E1E] text-right break-all break-words min-w-0 [overflow-wrap:anywhere]">
                    {location}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2 min-w-0">
                  <span className="text-[#666666] flex items-center gap-1.5 shrink-0">
                    <UserCheck size={14} className="text-slate-400" /> ผู้นำส่ง (DCC):
                  </span>
                  <span className="font-medium text-slate-800 break-all break-words min-w-0 [overflow-wrap:anywhere] text-right">{dispatchedBy}</span>
                </div>
                {dispatchedAt && (
                  <div className="flex justify-between items-center text-xs text-[#666666] pt-1 border-t border-[#E5E5E5] gap-2 min-w-0">
                    <span className="flex items-center gap-1 shrink-0">
                      <Calendar size={13} /> วันที่นำส่ง:
                    </span>
                    <span className="shrink-0">{new Date(dispatchedAt).toLocaleString('th-TH')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Verification Form */}
          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            {!isAuthorized && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-sm text-rose-700 shadow-sm leading-relaxed">
                <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">ไม่มีสิทธิ์ตรวจรับเอกสารของแผนกอื่น</p>
                  <p className="text-xs text-rose-600 mt-0.5">
                    เอกสารนี้จัดส่งสำหรับแผนก <strong>{dept}</strong> เท่านั้น (แผนกปัจจุบันของคุณ: {currentUser?.department || '-'})
                  </p>
                </div>
              </div>
            )}

            {/* Notes Section */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1.5">
                บันทึกสภาพเอกสารและจุดติดตั้ง (Optional Remarks):
              </label>
              <textarea
                disabled={!isAuthorized}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="เช่น ตรวจสอบตราประทับสีแดงเรียบร้อย เอกสารครบถ้วนสมบูรณ์ นำเข้าแฟ้มประจำจุดผสม Line 1 เรียบร้อยแล้ว"
                rows={2}
                className="w-full px-4 py-2.5 text-sm bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#0D99FF] focus:ring-4 focus:ring-[#0D99FF]/10 outline-none transition-all resize-none disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            {/* E-Signature Box */}
            <div className="p-6 bg-gradient-to-b from-indigo-50/70 to-slate-50 border border-[#E5F4FF] rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-900 font-bold">
                  <Lock size={18} className="text-[#0D99FF]" /> ลายมือชื่ออิเล็กทรอนิกส์ (Signing PIN 6 หลัก)
                </div>
                <span className="text-xs text-[#666666] font-medium">21 CFR Part 11 Compliant</span>
              </div>

              {/* 6 Digit PIN Inputs */}
              <div className="flex justify-center gap-2 sm:gap-3 my-3" onPaste={handlePaste}>
                {pin.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    disabled={isSubmitting || !isAuthorized}
                    className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold font-mono rounded-xl border-2 transition-all outline-none ${
                      digit
                        ? 'bg-white border-[#0D99FF] text-[#007BE5] shadow-sm shadow-indigo-600/10'
                        : 'bg-white/80 border-[#E5E5E5] text-slate-800 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-[#0D99FF]/10'
                    } disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400`}
                  />
                ))}
              </div>

              {/* Signer Identity Confirmation */}
              <div className="p-3.5 bg-white border border-[#E5F4FF]/80 rounded-xl flex items-center justify-between text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">ผู้ลงนามตรวจรับ:</span>{' '}
                  <strong className="text-slate-800 font-bold">{currentUser?.name}</strong>{' '}
                  <span className="text-slate-400">({currentUser?.department || 'PD'})</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 size={14} /> Active Session
                </div>
              </div>

              {/* Legal Acknowledgment Checkbox */}
              <label className="flex items-start gap-3 p-3 bg-white/70 border border-[#E5E5E5]/80 rounded-xl cursor-pointer select-none hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  disabled={!isAuthorized}
                  checked={hasAcknowledgedTerms}
                  onChange={(e) => setHasAcknowledgedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#0D99FF] focus:ring-[#0D99FF] border-[#E5E5E5] disabled:opacity-50"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  ข้าพเจ้าขอยืนยันว่าได้ตรวจสอบและรับเอกสารฉบับพิมพ์จริงที่มีตราประทับควบคุม และได้ติดตั้งจัดเก็บไว้ ณ จุดใช้งานจริง ({location}) อย่างถูกต้องครบถ้วนตามข้อกำหนดระบบคุณภาพ
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/tasks')}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-[#F5F5F5] rounded-xl transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isPinComplete || !hasAcknowledgedTerms || !isAuthorized}
                className="px-6 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-none shadow-emerald-600/25 transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังบันทึกลายมือชื่อ...
                  </>
                ) : (
                  <>
                    <KeyRound size={18} />
                    ยืนยันรับเอกสารฉบับจริง (Confirm Receipt)
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default TaskConfirmHardcopyReceipt;
