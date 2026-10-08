import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCw, Search, Filter, CheckCircle2, FileEdit, XCircle,
  AlertTriangle, Clock, Calendar, Building2, X, FileText,
  ChevronRight, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../../store/useStore';
import { getReviewStatus } from '../../utils/documentUtils';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
};

const reviewStatusConfig = {
  OVERDUE:     { label: '🚨 เกินกำหนด',           cls: 'bg-red-50 text-red-700 border-red-200' },
  UPCOMING:    { label: '⚠️ ใกล้ครบกำหนด',         cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ON_SCHEDULE: { label: '✅ ยังไม่ถึงกำหนด',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Record Review Modal — 3 Outcomes: CONFIRM_CONTINUE | REVISION_REQUIRED | OBSOLETE_REQUIRED
// ─────────────────────────────────────────────────────────────────────────────
const RecordReviewModal = ({ schedule, doc, onClose, onSubmit }) => {
  const [outcome, setOutcome] = useState('');
  const [comment, setComment] = useState('');
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const outcomes = [
    {
      key: 'CONFIRM_CONTINUE',
      icon: CheckCircle2,
      label: 'ยืนยันใช้ต่อ (ไม่ต้องแก้ไข)',
      desc: 'เอกสารยังคงถูกต้องและสามารถใช้งานต่อได้ ระบบจะเลื่อนวันทบทวนถัดไป +1 ปี',
      color: 'border-emerald-400 bg-emerald-50',
      selectedColor: 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50',
      badge: 'bg-emerald-100 text-emerald-700',
    },
    {
      key: 'REVISION_REQUIRED',
      icon: FileEdit,
      label: 'ขอแก้ไข (เปิด DAR แก้ไขเอกสาร)',
      desc: 'เอกสารต้องปรับปรุง ระบบจะส่งต่อไปยังระบบ DAR เพื่อดำเนินการแก้ไข',
      color: 'border-amber-400 bg-amber-50',
      selectedColor: 'ring-2 ring-amber-500 border-amber-500 bg-amber-50',
      badge: 'bg-amber-100 text-amber-700',
    },
    {
      key: 'OBSOLETE_REQUIRED',
      icon: XCircle,
      label: 'ขอยกเลิก (เปิด DAR ยกเลิกเอกสาร)',
      desc: 'เอกสารล้าสมัยหรือไม่จำเป็น ระบบจะส่งต่อไปยัง DAR เพื่อดำเนินการยกเลิก',
      color: 'border-red-400 bg-red-50',
      selectedColor: 'ring-2 ring-red-500 border-red-500 bg-red-50',
      badge: 'bg-red-100 text-red-700',
    },
  ];

  const handleSubmit = async () => {
    if (!outcome) { toast.error('กรุณาเลือกผลการทบทวนก่อนบันทึก'); return; }
    setSubmitting(true);
    try {
      await onSubmit({ scheduleId: schedule.id, outcome, comment, reviewDate });
      toast.success(
        outcome === 'CONFIRM_CONTINUE'
          ? 'บันทึกผลการทบทวนเรียบร้อย — วันทบทวนถัดไปถูกอัปเดตแล้ว'
          : 'บันทึกผลและส่งต่อระบบ DAR เรียบร้อย'
      );
      onClose();
    } catch (_err) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#E5F4FF] text-[#0D99FF] rounded-xl">
              <RotateCw size={18} />
            </div>
            <div>
              <h2 className="font-bold text-[#1E1E1E] text-sm">บันทึกผลการทบทวนตามรอบ</h2>
              <p className="text-xs text-[#666666] mt-0.5 font-mono">{doc?.title || doc?.docNo || schedule?.documentNumber || '-'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#888888] hover:text-[#1E1E1E] hover:bg-[#F5F5F5] rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Doc info */}
          <div className="bg-[#F8FAFC] border border-[#E5E5E5] rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[#888888] mb-0.5">เลขที่เอกสาร</p>
              <p className="font-bold text-[#1E1E1E] font-mono">{doc?.title || schedule?.documentNumber || '-'}</p>
            </div>
            <div>
              <p className="text-[#888888] mb-0.5">ครบกำหนดทบทวน</p>
              <p className="font-bold text-[#1E1E1E]">{formatDate(schedule?.nextReviewDate || schedule?.currentScheduledReviewDate)}</p>
            </div>
            <div>
              <p className="text-[#888888] mb-0.5">ชื่อเอกสาร</p>
              <p className="font-semibold text-slate-700 break-words [overflow-wrap:anywhere]">{doc?.name || doc?.documentName || schedule?.documentName || '-'}</p>
            </div>
            <div>
              <p className="text-[#888888] mb-0.5">ฉบับที่</p>
              <p className="font-bold text-[#0D99FF] font-mono">Rev.{doc?.rev || doc?.revision || schedule?.rev || '00'}</p>
            </div>
          </div>

          {/* Review Date */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">วันที่ทบทวน</label>
            <input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full border border-[#E5E5E5] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D99FF] focus:border-transparent transition-all bg-white"
            />
          </div>

          {/* Outcome Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">ผลการทบทวน <span className="text-red-500">*</span></label>
            <div className="space-y-2.5">
              {outcomes.map(({ key, icon: Icon, label, desc, color, selectedColor, badge }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOutcome(key)}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                    outcome === key ? selectedColor : `${color} hover:border-opacity-70`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-lg ${badge}`}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-[#1E1E1E] text-sm">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                    {outcome === key && (
                      <div className="ml-auto shrink-0">
                        <CheckCircle2 size={18} className="text-emerald-600" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">ความเห็นผู้ทบทวน (ไม่บังคับ)</label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="ระบุเหตุผลหรือข้อสังเกตจากการทบทวนเอกสาร..."
              className="w-full border border-[#E5E5E5] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D99FF] focus:border-transparent transition-all resize-none bg-white"
            />
          </div>

          {/* Info banner for non-CONFIRM outcomes */}
          {(outcome === 'REVISION_REQUIRED' || outcome === 'OBSOLETE_REQUIRED') && (
            <div className="flex items-start gap-2.5 bg-[#FFFBEB] border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800">
              <Info size={14} className="shrink-0 mt-0.5 text-amber-600" />
              <p>
                ระบบจะบันทึกผลการทบทวนและ<strong> เปิด DAR โดยอัตโนมัติ</strong> ไปยังกระบวนการ{' '}
                {outcome === 'REVISION_REQUIRED' ? 'แก้ไขเอกสาร (Revision)' : 'ยกเลิกเอกสาร (Obsolete)'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E5E5] flex items-center justify-end gap-3 bg-[#FAFAFA]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!outcome || submitting}
            className={`px-5 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              !outcome || submitting
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-[#0D99FF] text-white hover:bg-[#007BE5] shadow-sm hover:shadow-md'
            }`}
          >
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> กำลังบันทึก...</>
            ) : (
              <><CheckCircle2 size={15} /> บันทึกผลการทบทวน</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Document Row
// ─────────────────────────────────────────────────────────────────────────────
const DocRow = ({ schedule, doc, onRecord }) => {
  const dueDate = schedule.nextReviewDate || schedule.currentScheduledReviewDate;
  const status = getReviewStatus(dueDate);
  const cfg = reviewStatusConfig[status] || reviewStatusConfig.ON_SCHEDULE;

  return (
    <tr className="hover:bg-[#F8FAFC] transition-colors group">
      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className="font-bold text-[#0D99FF] font-mono text-sm">{schedule.documentNumber || doc?.title || '-'}</span>
      </td>
      <td className="px-4 py-3.5">
        <p className="font-medium text-slate-800 text-xs leading-relaxed break-words [overflow-wrap:anywhere]">
          {schedule.documentName || doc?.name || '-'}
        </p>
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
          <Building2 size={11} /> {schedule.ownerDepartmentId || '-'}
        </span>
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className="font-mono text-xs text-[#666666]">{formatDate(dueDate)}</span>
      </td>
      <td className="px-4 py-3.5 text-center whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>
          {cfg.label}
        </span>
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className="font-mono text-xs text-slate-500">{formatDate(schedule.lastReviewedDate) || '-'}</span>
      </td>
      <td className="px-4 py-3.5 text-center">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
          {(schedule.reviewLogs || []).length}
        </span>
      </td>
      <td className="px-4 py-3.5 text-right">
        <button
          onClick={() => onRecord(schedule, doc)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#0D99FF] hover:bg-[#007BE5] rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="บันทึกผลการทบทวน"
        >
          <RotateCw size={12} /> ทบทวน
        </button>
      </td>
    </tr>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
const PeriodicReviewPage = () => {
  const navigate = useNavigate();
  const {
    periodicReviewSchedules,
    documents,
    externalDocuments,
    currentUser,
    recordPeriodicReview,
    submitPeriodicReview,
  } = useStore();

  // Segmented tab: INTERNAL | EXTERNAL
  const [docType, setDocType] = useState('INTERNAL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | OVERDUE | UPCOMING | ON_SCHEDULE
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [recordTarget, setRecordTarget] = useState(null); // { schedule, doc }

  // Build combined lookup
  const allDocs = useMemo(
    () => [...(documents || []), ...(externalDocuments || [])],
    [documents, externalDocuments]
  );

  // Filter schedules by category
  const filteredSchedules = useMemo(() => {
    const isInternal = docType === 'INTERNAL';
    let records = (periodicReviewSchedules || []).filter(s => {
      const cat = (s.documentCategory || '').toUpperCase();
      return isInternal ? cat === 'INTERNAL' || cat === '' : cat === 'EXTERNAL';
    });

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      records = records.filter(s =>
        (s.documentNumber || '').toLowerCase().includes(term) ||
        (s.documentName || '').toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      records = records.filter(s => {
        const dueDate = s.nextReviewDate || s.currentScheduledReviewDate;
        return getReviewStatus(dueDate) === statusFilter;
      });
    }

    // Department filter
    if (deptFilter !== 'ALL') {
      records = records.filter(s => (s.ownerDepartmentId || '') === deptFilter);
    }

    // Sort: OVERDUE → UPCOMING → ON_SCHEDULE
    return [...records].sort((a, b) => {
      const order = { OVERDUE: 0, UPCOMING: 1, ON_SCHEDULE: 2 };
      const dA = a.nextReviewDate || a.currentScheduledReviewDate;
      const dB = b.nextReviewDate || b.currentScheduledReviewDate;
      const sA = order[getReviewStatus(dA)] ?? 2;
      const sB = order[getReviewStatus(dB)] ?? 2;
      if (sA !== sB) return sA - sB;
      return new Date(dA || 0) - new Date(dB || 0);
    });
  }, [periodicReviewSchedules, docType, searchTerm, statusFilter, deptFilter]);

  // Available departments
  const availableDepts = useMemo(() => {
    const depts = new Set(
      (periodicReviewSchedules || [])
        .map(s => s.ownerDepartmentId)
        .filter(Boolean)
    );
    return Array.from(depts).sort();
  }, [periodicReviewSchedules]);

  // Stats
  const stats = useMemo(() => {
    const all = (periodicReviewSchedules || []);
    const getCount = (category, status) => all.filter(s => {
      const cat = (s.documentCategory || '').toUpperCase();
      const isMatch = category === 'INTERNAL' ? (cat === 'INTERNAL' || cat === '') : cat === 'EXTERNAL';
      if (!isMatch) return false;
      const dueDate = s.nextReviewDate || s.currentScheduledReviewDate;
      return status === 'ALL' || getReviewStatus(dueDate) === status;
    }).length;
    return {
      internalTotal: getCount('INTERNAL', 'ALL'),
      internalOverdue: getCount('INTERNAL', 'OVERDUE'),
      externalTotal: getCount('EXTERNAL', 'ALL'),
      externalOverdue: getCount('EXTERNAL', 'OVERDUE'),
    };
  }, [periodicReviewSchedules]);

  const pagination = useTablePagination(filteredSchedules, 15);

  const handleRecord = useCallback((schedule, doc) => {
    setRecordTarget({ schedule, doc });
  }, []);

  const handleSubmitReview = useCallback(async ({ scheduleId, outcome, comment, reviewDate }) => {
    if (outcome === 'CONFIRM_CONTINUE') {
      recordPeriodicReview({ scheduleId, outcome, comment, reviewDate });
    } else {
      // For REVISION/OBSOLETE: stamp log then delegate to submitPeriodicReview which opens DAR
      recordPeriodicReview({ scheduleId, outcome, comment, reviewDate });
      // Navigate to DAR creation
      const type = outcome === 'REVISION_REQUIRED' ? 'revision' : 'obsolete';
      const schedule = (periodicReviewSchedules || []).find(s => s.id === scheduleId);
      navigate(`/dcc/dar/new/${type}`, {
        state: {
          prefillDocId: schedule?.documentId || schedule?.externalDocumentId,
          prefillReviewId: scheduleId,
        }
      });
    }
  }, [recordPeriodicReview, periodicReviewSchedules, navigate]);

  const recordTargetDoc = useMemo(() => {
    if (!recordTarget) return null;
    const s = recordTarget.schedule;
    return allDocs.find(d => d.id === s.documentId || d.id === s.externalDocumentId) || null;
  }, [recordTarget, allDocs]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 w-full overflow-hidden">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1E1E1E] tracking-tight flex items-center gap-2.5">
            <RotateCw className="text-[#0D99FF]" size={22} />
            การทบทวนเอกสารตามรอบ
          </h1>
          <p className="text-xs text-[#666666] mt-1">
            ISO 9001 Clause 7.5.3 — ตรวจสอบความเหมาะสมของเอกสารคุณภาพทุก 1 ปี
          </p>
        </div>
        <button
          onClick={() => navigate('/dcc/periodic-reviews')}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#0D99FF] bg-[#E5F4FF] hover:bg-[#C8E9FF] rounded-xl transition-colors cursor-pointer self-start md:self-auto"
        >
          <ChevronRight size={14} className="rotate-180" /> กลับแดชบอร์ด
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'เอกสารภายใน (ทั้งหมด)', value: stats.internalTotal, icon: FileText, color: 'from-indigo-500 to-indigo-600', tab: 'INTERNAL' },
          { label: 'เกินกำหนด (ภายใน)', value: stats.internalOverdue, icon: AlertTriangle, color: 'from-rose-500 to-red-600', tab: 'INTERNAL' },
          { label: 'เอกสารภายนอก (ทั้งหมด)', value: stats.externalTotal, icon: FileText, color: 'from-sky-500 to-sky-600', tab: 'EXTERNAL' },
          { label: 'เกินกำหนด (ภายนอก)', value: stats.externalOverdue, icon: AlertTriangle, color: 'from-orange-500 to-orange-600', tab: 'EXTERNAL' },
        ].map(({ label, value, icon: Icon, color, tab }) => (
          <button
            key={label}
            onClick={() => setDocType(tab)}
            className={`bg-white rounded-xl p-4 border transition-all text-left shadow-xs hover:shadow-md cursor-pointer ${
              docType === tab ? 'border-[#0D99FF] ring-2 ring-[#0D99FF]/20' : 'border-[#E5E5E5]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[#666666] leading-snug">{label}</p>
                <p className="text-3xl font-bold text-[#1E1E1E] mt-1 font-mono">{value}</p>
              </div>
              <div className={`p-2 rounded-xl bg-gradient-to-br ${color} text-white`}>
                <Icon size={16} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Segmented Tabs — Internal / External */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-xs overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center border-b border-[#E5E5E5] bg-[#FAFAFA] px-6">
          {[
            { key: 'INTERNAL', label: 'เอกสารภายใน (Internal)', count: stats.internalTotal },
            { key: 'EXTERNAL', label: 'เอกสารภายนอก (External)', count: stats.externalTotal },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setDocType(key)}
              className={`relative flex items-center gap-2 py-4 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                docType === key
                  ? 'text-[#0D99FF] border-[#0D99FF]'
                  : 'text-[#666666] border-transparent hover:text-[#1E1E1E]'
              }`}
            >
              {label}
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                docType === key ? 'bg-[#E5F4FF] text-[#0D99FF]' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-[#E5E5E5] flex flex-col sm:flex-row gap-3 items-center justify-between bg-white">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="ค้นหาเลขที่/ชื่อเอกสาร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#E5E5E5] rounded-xl text-xs focus:outline-none focus:border-[#0D99FF] bg-[#F5F5F5] focus:bg-white transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto items-center">
            <Filter size={14} className="text-slate-400 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-[#E5E5E5] rounded-xl text-xs px-3 py-2 bg-[#F5F5F5] focus:bg-white focus:outline-none focus:border-[#0D99FF] font-medium"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="OVERDUE">🚨 เกินกำหนด</option>
              <option value="UPCOMING">⚠️ ใกล้ครบกำหนด</option>
              <option value="ON_SCHEDULE">✅ ยังไม่ถึงกำหนด</option>
            </select>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="border border-[#E5E5E5] rounded-xl text-xs px-3 py-2 bg-[#F5F5F5] focus:bg-white focus:outline-none focus:border-[#0D99FF] font-medium"
            >
              <option value="ALL">ทุกแผนก</option>
              {availableDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="px-4 py-3.5 font-bold text-slate-600 bg-[#F8FAFC] whitespace-nowrap">เลขที่เอกสาร</th>
                <th className="px-4 py-3.5 font-bold text-slate-600 bg-[#F8FAFC]">ชื่อเอกสาร</th>
                <th className="px-4 py-3.5 font-bold text-slate-600 bg-[#F8FAFC] whitespace-nowrap">แผนก</th>
                <th className="px-4 py-3.5 font-bold text-slate-600 bg-[#F8FAFC] whitespace-nowrap">
                  <span className="flex items-center gap-1"><Calendar size={12} /> ครบกำหนด</span>
                </th>
                <th className="px-4 py-3.5 font-bold text-slate-600 text-center bg-[#F8FAFC] whitespace-nowrap">สถานะ</th>
                <th className="px-4 py-3.5 font-bold text-slate-600 bg-[#F8FAFC] whitespace-nowrap">
                  <span className="flex items-center gap-1"><Clock size={12} /> ทบทวนล่าสุด</span>
                </th>
                <th className="px-4 py-3.5 font-bold text-slate-600 text-center bg-[#F8FAFC] whitespace-nowrap">ครั้งที่</th>
                <th className="px-4 py-3.5 font-bold text-slate-600 text-right bg-[#F8FAFC] whitespace-nowrap">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pagination.paginatedData.map(schedule => {
                const doc = allDocs.find(d => d.id === schedule.documentId || d.id === schedule.externalDocumentId);
                return (
                  <DocRow
                    key={schedule.id}
                    schedule={schedule}
                    doc={doc}
                    onRecord={handleRecord}
                  />
                );
              })}
              {pagination.paginatedData.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <RotateCw size={36} className="text-slate-200 mx-auto mb-3" />
                    <p className="font-bold text-sm text-slate-500">ไม่พบเอกสารที่ตรงกับเงื่อนไขที่เลือก</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {docType === 'INTERNAL' ? 'ไม่มีเอกสารภายใน' : 'ไม่มีเอกสารภายนอก'}ในแผนการทบทวนตามรอบ
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          currentPage={pagination.currentPage}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {/* Record Review Modal */}
      {recordTarget && (
        <RecordReviewModal
          schedule={recordTarget.schedule}
          doc={recordTargetDoc}
          onClose={() => setRecordTarget(null)}
          onSubmit={handleSubmitReview}
        />
      )}
    </div>
  );
};

export default PeriodicReviewPage;
