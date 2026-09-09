import React, { useState, useMemo } from "react";
import {
  X, Check, XCircle, FileText, ShieldCheck, Eye, Bell,
  Clock, CheckCircle2, AlertCircle, AlertTriangle,
  Building2, Globe, Lock, Calendar, MapPin,
  Printer, UserCheck, RotateCcw, FileCheck, ChevronRight,
  MessageSquare, Activity
} from "lucide-react";
import useStore from "../../store/useStore";
import { motion } from "framer-motion";
import ExternalDocPreviewModal from "../ExternalDocs/ExternalDocPreviewModal";
import ActionConfirmModal from "../../components/common/ActionConfirmModal";
import { toast } from "react-hot-toast";


const fmtDate = (d) => {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
  } catch { return String(d); }
};

const fmtDateTime = (d) => {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return String(d); }
};

const StatusBadge = ({ status }) => {
  const map = {
    PENDING_EXT_REVIEW:   { label: "รอทบทวน",    cls: "bg-amber-50 text-amber-700 border-amber-300" },
    PENDING_EXT_APPROVAL: { label: "รออนุมัติ",   cls: "bg-indigo-50 text-indigo-700 border-indigo-300" },
    REVISE_REQUESTED:     { label: "รอแก้ไข",     cls: "bg-orange-50 text-orange-700 border-orange-400" },
    ACTIVE:               { label: "ใช้งาน",      cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
    EFFECTIVE:            { label: "ใช้งาน",      cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
    APPROVED:             { label: "อนุมัติแล้ว", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
    REJECTED:             { label: "ไม่อนุมัติ",  cls: "bg-rose-50 text-rose-700 border-rose-300" },
    OBSOLETE:             { label: "ยกเลิกแล้ว",  cls: "bg-slate-100 text-slate-500 border-slate-300" },
  };
  const { label, cls } = map[status] || { label: status || "กำลังดำเนินการ", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${cls}`}>{label}</span>;
};

const TypeBadge = ({ type }) => {
  const map = {
    REVISION: { label: "ปรับปรุงฉบับ", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: RotateCcw },
    UPDATE:   { label: "ปรับปรุงฉบับ", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: RotateCcw },
    OBSOLETE: { label: "ขอยกเลิก",    cls: "bg-rose-50 text-rose-700 border-rose-200",     Icon: XCircle },
    NEW:      { label: "ขอขึ้นทะเบียน",cls: "bg-blue-50 text-blue-700 border-blue-200",    Icon: FileCheck },
  };
  const { label, cls, Icon } = map[type] || map["NEW"];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${cls}`}>
      <Icon size={11} /> {label}
    </span>
  );
};

const TimelineNode = ({ item, isLast }) => {
  const isDone    = item.status === "COMPLETED";
  const isCurrent = item.status === "PENDING";
  const isRet     = item.status === "RETURNED" || item.status === "REJECTED";
  return (
    <div className="relative flex items-start gap-2.5 text-xs">
      {!isLast && <div className="absolute left-3 top-7 bottom-0 w-0.5 bg-slate-200 z-0" />}
      <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 mt-0.5 ${isDone ? "bg-emerald-500 border-emerald-600 text-white" : isRet ? "bg-rose-500 border-rose-600 text-white" : isCurrent ? "bg-amber-400 border-amber-500 text-slate-900 animate-pulse" : "bg-white border-slate-300 text-slate-300"}`}>
        {isDone ? <CheckCircle2 size={12} /> : isRet ? <XCircle size={12} /> : isCurrent ? <Clock size={12} /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
      </div>
      <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200/80 p-2.5 space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-800 text-[11px]">{item.stepName || item.step}</span>
          <span className="text-[10px] font-mono text-slate-400 shrink-0">{item.date ? fmtDateTime(item.date) : "รอดำเนินการ"}</span>
        </div>
        <p className="text-[11px] text-slate-600">โดย: <span className="font-bold text-slate-700">{item.userName || "-"}</span>{item.userRole ? <span className="text-slate-400"> ({item.userRole})</span> : null}</p>
        {item.comment && <p className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200/60 mt-1 leading-relaxed italic">&ldquo;{item.comment}&rdquo;</p>}
      </div>
    </div>
  );
};

const SignatoryCard = ({ no, label, name, role, status, date }) => {
  const dot = { COMPLETED: "bg-emerald-500", RETURNED: "bg-orange-400", REJECTED: "bg-rose-500", PENDING: "bg-amber-400 animate-pulse" }[status] || "bg-slate-300";
  const sl = {
    COMPLETED: <span className="text-emerald-700 flex items-center gap-1"><CheckCircle2 size={11} /> เสร็จสิ้น</span>,
    RETURNED:  <span className="text-orange-700 flex items-center gap-1"><AlertCircle size={11} /> ส่งกลับ</span>,
    REJECTED:  <span className="text-rose-700 flex items-center gap-1"><XCircle size={11} /> ปฏิเสธ</span>,
    PENDING:   <span className="text-amber-700 flex items-center gap-1 animate-pulse"><Clock size={11} /> รอดำเนินการ</span>,
  }[status] || <span className="text-slate-400">รอขั้นตอนก่อนหน้า</span>;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{no}. {label}</span><span className={`w-2 h-2 rounded-full ${dot}`} /></div>
      <p className="font-bold text-slate-900 text-sm leading-tight truncate">{name || "-"}</p>
      {role && <p className="text-[11px] text-slate-500">{role}</p>}
      <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-200/60 text-[11px]"><span className="font-medium">{sl}</span><span className="font-mono text-slate-400">{fmtDate(date) || "-"}</span></div>
    </div>
  );
};

const InfoRow = ({ label, children }) => (
  <div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
    <div className="text-sm font-semibold text-slate-800">{children}</div>
  </div>
);

const SectionCard = ({ icon: Icon, iconCls, title, badge, children }) => (
  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Icon size={14} className={iconCls} />{title}</h3>
      {badge && <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{badge}</span>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const ExternalDocActionModal = ({ task, onClose, layoutId }) => {
  const { externalDocuments, externalRequests, processExternalTask } = useStore();
  const [comment, setComment] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [returnReasonError, setReturnReasonError] = useState("");

  const isReview   = task.type === "EXT_REVIEW"    || task.type === "EXTERNAL_REVIEW";
  const isApproval = task.type === "EXT_APPROVAL"  || task.type === "EXTERNAL_APPROVAL";
  const isAck      = task.type === "Ack";

  const doc = useMemo(() => {
    const allDocs = externalDocuments || [];
    const allReqs = externalRequests  || [];
    let found = allDocs.find(d =>
      d.id === task.referenceId || d.edCode === task.docCode || d.doc_code === task.docCode ||
      d.edCode === task.referenceId || d.doc_code === task.referenceId
    );
    if (found) return found;
    const req = allReqs.find(r =>
      r.id === task.referenceId || r.requestId === task.referenceId || r.docId === task.referenceId ||
      r.externalDocId === task.referenceId || r.edCode === task.docCode || r.edCode === task.referenceId
    );
    if (req) {
      const linked = allDocs.find(d =>
        d.id === req.docId || d.id === req.externalDocId ||
        (req.edCode && (d.edCode === req.edCode || d.doc_code === req.edCode))
      );
      return {
        ...(linked || {}), ...req,
        id: req.externalDocId || req.docId || req.id,
        edCode: req.edCode || req.doc_code || linked?.edCode,
        doc_code: req.doc_code || req.edCode || linked?.doc_code,
        title: req.title || req.docTitle || linked?.title || "เอกสารภายนอก",
        department: req.department || req.requesterDepartment || linked?.department || "QA",
        status: req.status || linked?.status || "PENDING_EXT_REVIEW",
        reviewerId: req.reviewerId || linked?.reviewerId,
        reviewerName: req.reviewerName || linked?.reviewerName,
        approverId: req.approverId || linked?.approverId,
        approverName: req.approverName || linked?.approverName,
        requesterId: req.requesterId || linked?.ownerId,
        requesterName: req.requesterName || linked?.ownerName,
        signoffs: req.signoffs || linked?.signoffs || [],
      };
    }
    return task.metadata || task;
  }, [externalDocuments, externalRequests, task]);

  const request = useMemo(() => {
    const allReqs = externalRequests || [];
    return allReqs.find(r =>
      r.id === task.referenceId || r.requestId === task.referenceId ||
      r.docId === task.referenceId || r.externalDocId === task.referenceId ||
      (doc?.id && (r.docId === doc.id || r.externalDocId === doc.id)) ||
      (doc?.edCode && r.edCode === doc.edCode)
    ) || null;
  }, [externalRequests, task, doc]);

  const edCode    = doc?.edCode || doc?.doc_code || doc?.docNo || task.docCode || "ED-???";
  const reqCode   = request?.requestId || request?.requestNo || request?.id || `EDR-${edCode}`;
  const docTitle  = doc?.title || doc?.docTitle || task.docTitle || "เอกสารภายนอก";
  // Resilient source/issuer fallback — covers every field name used across externalDocuments, externalRequests, and task metadata
  const docSource =
    request?.issuer || request?.officialIssuer || request?.source ||
    doc?.issuer     || doc?.officialIssuer     || doc?.source ||
    doc?.sourceOrg  || doc?.externalSource     || doc?.origin ||
    request?.sourceOrg || request?.externalSource || request?.origin ||
    task?.issuer    || task?.officialIssuer    || task?.source || task?.sourceOrg ||
    "-";
  // Resilient effectiveDate fallback — externalRequests now stores this but legacy records may use alternate keys
  const docEffectiveDate =
    doc?.effectiveDate      || doc?.targetEffectiveDate || doc?.enforceDate     || doc?.effective_date ||
    request?.effectiveDate  || request?.targetEffectiveDate || request?.enforceDate ||
    task?.effectiveDate     || task?.metadata?.effectiveDate || null;
  const extActionMap = { UPDATE: "ปรับปรุงฉบับ (Revision)", OBSOLETE: "ขอยกเลิก (Obsolete)", REGISTER: "ขึ้นทะเบียนใหม่ (New)" };
  const actionLabel = extActionMap[task.extAction] || "ขึ้นทะเบียนใหม่ (New)";
  const controlledCopies = doc?.distributions || doc?.physical_distribution || [];

  const isRevision = ['REVISION', 'UPDATE'].includes(
    request?.type || request?.actionType || request?.extAction || task?.extAction || ''
  );
  const currentRevNum = parseInt(
    String(request?.originalRevision || doc?.originalRevision || doc?.rev || '0').replace(/\D/g, '') || '0',
    10
  );
  const originalRevStr = String(currentRevNum).padStart(2, '0');
  const targetRevNum = request?.targetRevision
    ? parseInt(String(request.targetRevision).replace(/\D/g, '') || '1', 10)
    : (isRevision ? currentRevNum + 1 : (doc?.rev ? parseInt(String(doc.rev).replace(/\D/g, '') || '0', 10) : 0));
  const targetRevStr = String(targetRevNum).padStart(2, '0');

  const signoffs = useMemo(() => {
    const raw = request?.signoffs || doc?.signoffs;
    if (raw && raw.length > 0) return raw;
    const nowIso = doc?.createdAt || new Date().toISOString();
    const docStatus = doc?.status || request?.status || "PENDING_EXT_REVIEW";
    return [
      { step: "REQUEST", stepName: "ยื่นคำร้อง", role: "ผู้ยื่นคำร้อง", userName: doc?.requesterName || doc?.ownerName || request?.requesterName || "ผู้ยื่นคำร้อง", userRole: "Requester", status: "COMPLETED", date: nowIso, comment: "ยื่นคำร้องขอขึ้นทะเบียนเอกสารภายนอก" },
      { step: "REVIEW",  stepName: "ทบทวนเอกสาร", role: "ผู้ทบทวน", userName: doc?.reviewerName || request?.reviewerName || "-", userRole: "Reviewer", status: docStatus === "PENDING_EXT_REVIEW" ? "PENDING" : docStatus === "REVISE_REQUESTED" ? "RETURNED" : "COMPLETED", date: doc?.reviewedAt || request?.reviewedAt || null, comment: doc?.revisionComment || request?.revisionComment || null },
      { step: "APPROVE", stepName: "อนุมัติเอกสาร", role: "ผู้อนุมัติ", userName: doc?.approverName || request?.approverName || "-", userRole: "Approver", status: docStatus === "PENDING_EXT_APPROVAL" ? "PENDING" : ["ACTIVE","EFFECTIVE","APPROVED"].includes(docStatus) ? "COMPLETED" : docStatus === "REJECTED" ? "REJECTED" : "WAITING", date: doc?.approvedAt || request?.approvedAt || null, comment: doc?.returnReason || request?.returnReason || null },
    ];
  }, [request, doc]);

  const reqStep = signoffs.find(s => s.step === "REQUEST");
  const revStep = signoffs.find(s => s.step === "REVIEW");
  const appStep = signoffs.find(s => s.step === "APPROVE");
  const returnFeedback = request?.returnReason || request?.revisionComment || doc?.returnReason || doc?.revisionComment || null;

  const handleAction = (action) => {
    if (action === "REJECT" && comment.trim().length < 5) {
      setReturnReasonError("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
      return;
    }
    setReturnReasonError("");
    setPendingAction(action);
    setShowConfirm(true);
  };

  const executeAction = async () => {
    try {
      await processExternalTask(task.id, pendingAction, comment);
      const successMsg = pendingAction === 'APPROVE'
        ? (isReview
            ? 'ทบทวนเอกสารและส่งต่อให้ผู้อนุมัติเรียบร้อยแล้ว'
            : 'อนุมัติเอกสารภายนอกเรียบร้อยแล้ว')
        : 'ส่งกลับแก้ไขเรียบร้อยแล้ว';
      toast.success(successMsg);
      onClose();
    } catch (err) {
      console.error('executeAction error:', err);
      throw err; // re-throw so ActionConfirmModal catch block shows error toast
    } finally {
      setShowConfirm(false);
    }
  };



  const hp = isReview
    ? { bg: "from-indigo-600 to-indigo-700", badge: "bg-indigo-500/30 text-indigo-100", label: "การทบทวนเอกสารภายนอก", sub: "Review Document", Icon: Eye }
    : isApproval
    ? { bg: "from-emerald-600 to-emerald-700", badge: "bg-emerald-500/30 text-emerald-100", label: "การอนุมัติเอกสารภายนอก", sub: "Approve Document", Icon: ShieldCheck }
    : { bg: "from-sky-600 to-sky-700", badge: "bg-sky-500/30 text-sky-100", label: "รับทราบเอกสารภายนอก", sub: "Acknowledge Document", Icon: Bell };

  if (!doc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0" />

      <motion.div
        layoutId={layoutId}
        initial={{ scale: 0.97, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="relative w-full max-w-5xl bg-slate-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 my-4"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
      >
        {/* HEADER */}
        <div className={`bg-gradient-to-r ${hp.bg} px-6 py-4 shrink-0`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><hp.Icon size={22} className="text-white" /></div>
              <div className="min-w-0">
                <h2 className="text-white font-bold text-lg leading-tight tracking-tight">{hp.label}</h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${hp.badge}`}>{hp.sub}</span>
                  <span className="text-xs font-mono text-white/70">{reqCode}</span>
                  <span className="text-white/40">·</span>
                  <TypeBadge type={task.extAction === "UPDATE" ? "REVISION" : task.extAction || "NEW"} />
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/15 p-2 rounded-xl transition-colors shrink-0 cursor-pointer" title="ปิดหน้าต่าง"><X size={20} /></button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
          {returnFeedback && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><AlertTriangle size={18} /></div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-orange-900 mb-0.5">บันทึกจากผู้ตรวจสอบก่อนหน้า</p>
                <p className="text-xs text-orange-800 leading-relaxed">&ldquo;{returnFeedback}&rdquo;</p>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT COL */}
            <div className="lg:col-span-7 space-y-4">
              <SectionCard icon={FileText} iconCls="text-blue-600" title="ข้อมูลเอกสาร (External Master Record)" badge={edCode}>
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ชื่อเอกสาร / Document Name</p>
                    <p className="text-[15px] font-bold text-slate-900 leading-snug">{docTitle}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <InfoRow label="รหัสเอกสาร (ED Code)"><span className="font-mono font-bold text-blue-600">{edCode}</span></InfoRow>
                    <InfoRow label="ฉบับที่ / Version">
                      {isRevision ? (
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                            Rev.{originalRevStr}
                          </span>
                          <span className="text-slate-400 font-sans">➔</span>
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold">
                            Rev.{targetRevStr}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-700">
                          {doc?.sourceVersion ? `${doc.sourceVersion} (Rev.${originalRevStr})` : `Rev.${originalRevStr}`}
                        </span>
                      )}
                    </InfoRow>
                    <InfoRow label="แผนกเจ้าของ (Dept)"><span className="flex items-center gap-1"><Building2 size={12} className="text-slate-400" />{doc?.department || "QA"}</span></InfoRow>
                    <InfoRow label="แหล่งที่มา / Source"><span className="flex items-center gap-1"><Globe size={12} className="text-slate-400" />{docSource}</span></InfoRow>
                    <InfoRow label="สถานะ (Status)"><StatusBadge status={doc?.status || request?.status} /></InfoRow>
                    <InfoRow label="วันที่มีผลบังคับ"><span className="flex items-center gap-1"><Calendar size={12} className="text-slate-400" />{fmtDate(docEffectiveDate) || "-"}</span></InfoRow>
                    <InfoRow label="รอบทบทวน (Cycle)"><span className="flex items-center gap-1"><Clock size={12} className="text-slate-400" />{doc?.reviewCycleMonths || 12} เดือน</span></InfoRow>
                    <InfoRow label="ระดับความลับ"><span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${doc?.accessScope === "Restricted" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}>{doc?.accessScope || "General"}</span></InfoRow>
                    <InfoRow label="ประเภทคำร้อง"><TypeBadge type={task.extAction === "UPDATE" ? "REVISION" : task.extAction || "NEW"} /></InfoRow>
                  </div>
                  {doc?.obsoleteReason && task.extAction === "OBSOLETE" && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                      <p className="font-bold text-rose-700 mb-1 flex items-center gap-1.5"><AlertTriangle size={13} /> เหตุผลที่ขอยกเลิก</p>
                      <p className="text-rose-800 leading-relaxed">{doc.obsoleteReason}</p>
                    </div>
                  )}
                  {doc?.link && (
                    <div className="text-xs">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ลิงก์เอกสารแนบ</p>
                      <a href={doc.link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium truncate flex items-center gap-1.5"><ChevronRight size={13} /> {doc.link}</a>
                    </div>
                  )}
                  <button type="button" onClick={() => setIsPreviewOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer">
                    <Eye size={16} /> ดูพรีวิวเอกสาร PDF
                  </button>
                </div>
              </SectionCard>

              <SectionCard icon={UserCheck} iconCls="text-emerald-600" title="ผู้รับผิดชอบตามขั้นตอน (Workflow Signatories)" badge="ISO 9001 Cl. 7.5.3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SignatoryCard no="1" label="ผู้ยื่นคำร้อง (Requester)" name={reqStep?.userName || doc?.requesterName || doc?.ownerName || "ผู้ยื่นคำร้อง"} role={reqStep?.userRole || "Requester"} status="COMPLETED" date={reqStep?.date || doc?.createdAt || request?.createdAt} />
                  <SignatoryCard no="2" label="ผู้ทบทวน (Reviewer)" name={revStep?.userName || doc?.reviewerName || request?.reviewerName || "-"} role={revStep?.userRole || "Reviewer"} status={revStep?.status || (doc?.status === "PENDING_EXT_REVIEW" ? "PENDING" : "WAITING")} date={revStep?.date || doc?.reviewedAt || null} />
                  <SignatoryCard no="3" label="ผู้อนุมัติ (Approver)" name={appStep?.userName || doc?.approverName || request?.approverName || "-"} role={appStep?.userRole || "Approver"} status={appStep?.status || "WAITING"} date={appStep?.date || doc?.approvedAt || null} />
                  <SignatoryCard no="4" label="ผู้ควบคุมเอกสาร (DCC)" name="Document Control Center (DCC)" role="งานขึ้นทะเบียนและควบคุม" status={["ACTIVE","EFFECTIVE","APPROVED"].includes(doc?.status || request?.status) ? "COMPLETED" : "WAITING"} date={["ACTIVE","EFFECTIVE","APPROVED"].includes(doc?.status || request?.status) ? (doc?.updatedAt || request?.updatedAt) : null} />
                </div>
              </SectionCard>

              <SectionCard icon={Lock} iconCls="text-blue-600" title="ขอบเขตสิทธิ์และสำเนาควบคุม" badge={doc?.accessScope || "General"}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1 text-xs">
                    <p className="font-bold text-slate-600 flex items-center gap-1.5"><Globe size={13} className="text-blue-600" /> ระดับสิทธิ์เข้าถึง</p>
                    <p className="text-slate-700 font-semibold">{doc?.accessScope === "Restricted" ? "จำกัดสิทธิ์เฉพาะผู้ได้รับอนุญาต" : doc?.accessScope === "Department" ? `เฉพาะแผนก ${doc?.department || "QA"} เท่านั้น` : "ทั่วไป ทุกแผนกเข้าถึงได้ (General)"}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1 text-xs">
                    <p className="font-bold text-slate-600 flex items-center gap-1.5"><Printer size={13} className="text-blue-600" /> สำเนาควบคุมฉบับพิมพ์</p>
                    <p className="text-slate-700 font-semibold">{controlledCopies.length > 0 ? `ขอพิมพ์แจกจ่าย ${controlledCopies.length} จุด` : "ไม่มีการขอสำเนาควบคุม"}</p>
                  </div>
                </div>
                {controlledCopies.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {controlledCopies.map((st, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-white border border-slate-200 font-mono text-slate-700 shadow-sm">
                        <MapPin size={11} className="text-blue-600" />{st.locationName || st.station_name || st.name || `จุดที่ ${idx + 1}`} ({st.departmentId || st.dept || "QA"})
                      </span>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* RIGHT COL */}
            <div className="lg:col-span-5 space-y-4">
              <SectionCard icon={Activity} iconCls="text-blue-600" title="บันทึกกิจกรรม (Activity Log)" badge={`${signoffs.length} รายการ`}>
                <div className="space-y-3">
                  {signoffs.map((item, idx) => <TimelineNode key={idx} item={item} isLast={idx === signoffs.length - 1} />)}
                </div>
              </SectionCard>

              <SectionCard icon={MessageSquare} iconCls="text-orange-600" title="ข้อเสนอแนะและความเห็น">
                {returnFeedback ? (
                  <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-orange-800"><AlertTriangle size={14} className="text-orange-600 shrink-0" />บันทึกเหตุผลจากผู้ตรวจสอบ:</div>
                    <p className="text-slate-700 leading-relaxed pl-4 italic">&ldquo;{returnFeedback}&rdquo;</p>
                    <p className="text-slate-400 pl-4">บันทึกโดย: {doc?.reviewerName || doc?.approverName || request?.reviewerName || request?.approverName || "ผู้มีอำนาจลงนาม"}</p>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">ไม่มีข้อเสนอแนะหรือบันทึกแก้ไขเพิ่มเติม</div>
                )}
              </SectionCard>

              {!isAck && (
                <SectionCard icon={MessageSquare} iconCls="text-slate-500" title="ความเห็นของคุณ (Decision Comment)">
                  <div className="space-y-2">
                    <textarea
                      id="ext-action-comment"
                      value={comment}
                      onChange={(e) => { setComment(e.target.value); if (returnReasonError) setReturnReasonError(""); }}
                      placeholder={isReview ? "ระบุความเห็นหรือข้อสังเกตจากการทบทวน…" : "ระบุความเห็นประกอบการพิจารณาอนุมัติ…"}
                      rows={4}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all outline-none resize-none text-sm text-slate-800 placeholder:text-slate-400 font-medium leading-relaxed shadow-sm"
                    />
                    {returnReasonError && <p className="text-xs text-rose-600 font-semibold flex items-center gap-1"><AlertCircle size={13} /> {returnReasonError}</p>}
                    <p className="text-[11px] text-slate-400">* หากต้องการส่งกลับแก้ไข กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร</p>
                  </div>
                </SectionCard>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer">ยกเลิก (Cancel)</button>
          <div className="flex items-center gap-3">
            {isAck ? (
              <button type="button" onClick={() => handleAction("APPROVE")} className="px-6 py-2.5 text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"><Bell size={16} /> รับทราบ (Acknowledge)</button>
            ) : (
              <>
                <button type="button" onClick={() => handleAction("REJECT")} className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"><XCircle size={16} /> ส่งกลับแก้ไข</button>
                <button type="button" onClick={() => handleAction("APPROVE")} className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer ${isReview ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"}`}><Check size={16} />{isReview ? "ยืนยันผลการทบทวน (Submit Review)" : "อนุมัติ (Approve)"}</button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <ExternalDocPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} document={doc} />

      <ActionConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executeAction}
        title={pendingAction === "APPROVE" ? (isAck ? "ยืนยันการรับทราบเอกสารภายนอก" : isReview ? "ยืนยันผลการทบทวนเอกสารภายนอก" : "ยืนยันการอนุมัติเอกสารภายนอก") : "ยืนยันการส่งกลับแก้ไข (Return for Revision)"}
        actionType={pendingAction === "APPROVE" ? "approve" : "reject"}
        confirmText={pendingAction === "APPROVE" ? (isAck ? "รับทราบและยอมรับ" : isReview ? "ยืนยันผลการทบทวน (Submit Review)" : "ยืนยันการอนุมัติ (Approve)") : "ส่งกลับแก้ไข (Return for Revision)"}
        cancelText="ยกเลิก / กลับไปตรวจสอบ"
        summaryData={[
          { label: "รหัสคำร้อง",         value: reqCode },
          { label: "ชื่อเอกสาร",         value: docTitle },
          {
            label: "ฉบับที่",
            value: isRevision ? (
              <div className="flex items-center gap-2 font-mono text-sm font-bold">
                <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md border border-slate-200">
                  Rev.{originalRevStr}
                </span>
                <span className="text-slate-400 font-sans">➔</span>
                <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md border border-blue-200 font-bold">
                  Rev.{targetRevStr}
                </span>
              </div>
            ) : (
              <span className="font-mono font-bold text-slate-800">
                Rev.{originalRevStr}
              </span>
            )
          },
          { label: "แหล่งที่มา",         value: docSource },
          { label: "วันที่มีผลบังคับ", value: fmtDate(docEffectiveDate) || "-" },
          { label: "ประเภทคำร้อง",      value: actionLabel },
          { label: "ความเห็นประกอบ",    value: comment || "-" },
          { label: "การดำเนินการ",      value: pendingAction === "APPROVE" ? (isAck ? "รับทราบเอกสาร (Acknowledged)" : isReview ? "ผ่านการทบทวน (Reviewed & Verified)" : "อนุมัติเอกสาร (Approved)") : "ส่งกลับแก้ไข (Return for Revision)" }
        ]}
      />
    </div>
  );
};

export default ExternalDocActionModal;
