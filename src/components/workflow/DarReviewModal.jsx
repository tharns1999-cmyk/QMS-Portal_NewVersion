import React, { useState } from 'react';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Ban, 
  X, 
  Globe, 
  Lock, 
  Building2, 
  ShieldAlert, 
  Eye, 
  Calendar, 
  Layers, 
  Award, 
  Users, 
  Bell, 
  Download, 
  Sparkles, 
  FileCheck2, 
  MessageSquare,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import { ACCESS_SCOPES, ACCESS_SCOPE_METADATA } from '../../utils/accessControl';
import { getDarReason, getDarDetail, getDarDocInfo, getRequesterName } from '../../utils/darHelper';
import { UniversalWatermarkService, WATERMARK_TYPES } from '../../services/UniversalWatermarkService';
import toast from 'react-hot-toast';

/**
 * Format ISO string or date string to readable Thai date
 */
const formatThaiDate = (dateInput) => {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    const day = d.getDate();
    const month = thaiMonths[d.getMonth()];
    const year = d.getFullYear() + 543; // Buddhist Era
    return `${day} ${month} ${year}`;
  } catch {
    return String(dateInput);
  }
};

/**
 * DarReviewModal Component
 * 
 * Enterprise Comprehensive Inspector & Review/Approval Modal
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Function} props.onClose - Modal close handler
 * @param {Object} props.dar - DAR object or null
 * @param {string} props.role - 'REVIEWER' | 'APPROVER' | 'VIEWER' | 'DCC'
 * @param {Function} props.onApprove - (comment) => void
 * @param {Function} props.onReject - (comment) => void
 * @param {Function} props.onReturn - (comment) => void
 * @param {boolean} props.readOnly - If true, hide review action buttons
 */
const DarReviewModal = ({
  isOpen,
  onClose,
  dar,
  role = 'VIEWER',
  onApprove,
  onReject,
  onReturn,
  readOnly = false
}) => {
  const { documents, masterUsers, masterDepartments, currentUser } = useStore();
  const [comment, setComment] = useState('');
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  if (!isOpen || !dar) return null;

  const docInfo = getDarDocInfo(dar, documents);
  const requesterName = getRequesterName(dar, masterUsers);
  const requester = masterUsers?.find(u => u.id === dar.requesterId);
  const ownerDept = dar.department || requester?.department || 'QA';

  // Access Control Null Safety
  const accessControl = dar.access_control || {
    scope: dar.access_scope || ACCESS_SCOPES.GENERAL,
    authorized_depts: dar.authorized_depts || [],
    authorized_users: dar.authorized_users || [],
    min_access_level: dar.min_access_level ?? 4
  };

  const scopeMeta = ACCESS_SCOPE_METADATA[accessControl.scope] || ACCESS_SCOPE_METADATA.GENERAL;

  // Controlled Copies & Distributions
  const distributions = dar.distributions || dar.distribution_locations || [];
  const totalPhysicalCopies = distributions.filter(d => d.copyType === 'CONTROLLED' || d.type === 'CONTROLLED').length;
  const isDigitalOnly = distributions.length === 0;

  // Standards Badges
  const relatedStandards = dar.relatedStandards || dar.standards || [];

  // Handlers
  const handleApproveClick = () => {
    if (onApprove) onApprove(comment);
  };

  const handleReturnClick = () => {
    if (!comment.trim()) {
      toast.error('กรุณาระบุความคิดเห็นหรือข้อเสนอแนะในการส่งกลับแก้ไข');
      return;
    }
    if (onReturn) onReturn(comment);
  };

  const handleRejectClick = () => {
    if (!comment.trim()) {
      toast.error('กรุณาระบุเหตุผลการไม่อนุมัติคำร้อง');
      return;
    }
    if (onReject) onReject(comment);
  };

  const handleOpenPdfDraft = async () => {
    try {
      const mockDocForPreview = {
        id: dar.id,
        title: docInfo.docCode || dar.title,
        name: dar.title,
        rev: docInfo.docRev || '00',
        department: ownerDept,
        effectiveDate: dar.effectiveDate || 'DRAFT'
      };

      await UniversalWatermarkService.downloadWatermarkedPdf(
        mockDocForPreview,
        WATERMARK_TYPES.DRAFT_WATERMARK,
        {
          userName: currentUser.name,
          userDept: currentUser.department || 'QA',
          effectiveDate: dar.effectiveDate || 'DRAFT'
        },
        true // Open in new tab
      );
      toast.success('เปิดตัวอย่างเอกสารฉบับร่าง (Draft Watermark) สำเร็จ');
    } catch (err) {
      console.error(err);
      setIsPdfPreviewOpen(true);
    }
  };

  // Status mapping
  const getStatusBadge = () => {
    switch (dar.status) {
      case 'UNDER_REVIEW':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF8E6] text-[#B87C33] border border-[#FDE6B0]">🟡 รอทบทวน (Pending Review)</span>;
      case 'PENDING_APPROVAL':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F5EEFE] text-[#7C3AED] border border-[#E9D5FF]">🟣 รออนุมัติ (Pending Approval)</span>;
      case 'WAITING_EFFECTIVE':
      case 'APPROVED_WAITING_EFFECTIVE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EBFBF0] text-[#14AE5C] border border-[#C3F4D2]">🟢 อนุมัติแล้ว (Approved)</span>;
      case 'RETURNED_FOR_REVISION':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF0F0] text-[#E02424] border border-[#FDE8E8]">🔴 ส่งกลับแก้ไข (Revision Required)</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF0F0] text-[#E02424] border border-[#FDE8E8]">❌ ไม่อนุมัติ (Rejected)</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">{dar.status || 'SUBMITTED'}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white border border-[#E5E5E5] rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.1)] w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[92vh]"
      >
        {/* ========================================================================= */}
        {/* Header & Status Strip */}
        {/* ========================================================================= */}
        <div className="bg-[#FAFAFA] border-b border-[#E5E5E5] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0D99FF] flex items-center justify-center border border-blue-100 shrink-0">
              <FileCheck2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#0D99FF] bg-[#E5F4FF] px-2.5 py-1 rounded-md border border-[#B8E1FF]">
                  📄 คำร้อง DAR: {dar.id} • Rev.{docInfo.docRev || '00'}
                </span>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-[#666666] mt-1">
                ยื่นคำร้องโดย: <strong className="text-[#1E1E1E]">{requesterName}</strong> • ฝ่าย{ownerDept} | วันที่ยื่น: {formatThaiDate(dar.createdAt || dar.date || new Date())}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X size={18} />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* Scrollable 6 Grouped Data Cards */}
        {/* ========================================================================= */}
        <div className="p-6 overflow-y-auto space-y-4 bg-[#F9F9F9]/60 custom-scrollbar flex-1">
          
          {/* ┌─ [1] ข้อมูลเอกสารและมาตรฐาน ──────────────────────────────────────────────┐ */}
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#444444] flex items-center gap-1.5">
                <FileText size={15} className="text-[#0D99FF]" /> 1. ข้อมูลเอกสารและมาตรฐาน (Document & Standards Information)
              </h4>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#007BE5] border border-blue-100">
                {dar.type === 'NEW' ? '✨ ฉบับใหม่ (New Document)' : dar.type === 'REVISION' ? '🔄 ขอแก้ไข (Revision)' : '⚠️ ขอยกเลิก (Obsolete)'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#777777] block text-[11px]">รหัสเอกสาร (Document Code)</span>
                <span className="font-mono font-bold text-sm text-[#007BE5] mt-0.5 block">
                  {docInfo.docCode} {dar.type === 'NEW' ? '(ฉบับใหม่)' : `(Rev.${docInfo.docRev})`}
                </span>
              </div>
              <div>
                <span className="text-[#777777] block text-[11px]">ประเภทเอกสาร (Document Type)</span>
                <span className="font-semibold text-[#1E1E1E] mt-0.5 block">
                  {docInfo.docType} ({dar.docType || 'ระเบียบปฏิบัติงาน'})
                </span>
              </div>
              <div className="md:col-span-2">
                <span className="text-[#777777] block text-[11px]">ชื่อเอกสาร (Document Title)</span>
                <span className="font-bold text-sm text-[#1E1E1E] mt-0.5 block">
                  {dar.title}
                </span>
              </div>
              <div className="md:col-span-2">
                <span className="text-[#777777] block text-[11px] mb-1">ระบบมาตรฐานที่เกี่ยวข้อง (Related Standards)</span>
                <div className="flex flex-wrap gap-1.5">
                  {relatedStandards.length > 0 ? (
                    relatedStandards.map(std => (
                      <span key={std} className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#F5F5F5] text-[#333333] border border-[#E5E5E5] text-xs font-semibold">
                        🏷️ {std}
                      </span>
                    ))
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200 text-xs">
                      มาตรฐานทั่วไป (General QMS)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ┌─ [2] วัตถุประสงค์และเหตุผล ──────────────────────────────────────────────┐ */}
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-3 shadow-2xs">
            <div className="border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#444444] flex items-center gap-1.5">
                <MessageSquare size={15} className="text-amber-500" /> 2. วัตถุประสงค์และเหตุผล (Purpose & Justification)
              </h4>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] min-w-0 space-y-1">
                <span className="font-bold text-slate-700 block">
                  {getDarReason(dar).title}:
                </span>
                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap font-normal min-w-0 break-words break-all [overflow-wrap:anywhere]">
                  {getDarReason(dar).value || 'ไม่มีข้อมูลเหตุผล'}
                </p>
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] min-w-0 space-y-1">
                <span className="font-bold text-slate-700 block">
                  {getDarDetail(dar).title}:
                </span>
                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap font-normal min-w-0 break-words break-all [overflow-wrap:anywhere]">
                  {getDarDetail(dar).value || 'ไม่มีข้อมูลรายละเอียดเพิ่มเติม'}
                </p>
              </div>
            </div>
          </div>

          {/* ┌─ [3] ความลับและสิทธิ์การเข้าถึง + [4] การจัดสรรสำเนาและจุดใช้งาน ──────┐ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* ┌─ [3] ความลับและสิทธิ์การเข้าถึง ─────────────────────────┐ */}
            <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-3 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#444444] flex items-center gap-1.5">
                    <ShieldAlert size={15} className="text-rose-500" /> 3. ความลับและสิทธิ์การเข้าถึง (Confidentiality & Access)
                  </h4>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-[#777777] block text-[11px] mb-1">ระดับชั้นความลับ (Access Scope)</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${scopeMeta.badgeClass}`}>
                      {accessControl.scope === 'GENERAL' && '🌐 เปิดเผยทั่วไป — ทุกคนเข้าถึงได้'}
                      {accessControl.scope === 'DEPT_ONLY' && `🔒 เฉพาะแผนก — ล็อกเฉพาะคนในแผนก ${ownerDept}`}
                      {accessControl.scope === 'TARGETED' && '🏢 เฉพาะบางแผนก — อนุญาตเฉพาะกลุ่ม'}
                      {accessControl.scope === 'RESTRICTED' && '🛡️ ลับเฉพาะบุคคล/ตำแหน่ง'}
                    </span>
                  </div>

                  {accessControl.scope === 'TARGETED' && (
                    <div>
                      <span className="text-[#777777] block text-[11px] mb-1">แผนกที่ได้รับอนุญาตเพิ่มเติม:</span>
                      <div className="flex flex-wrap gap-1">
                        {(accessControl.authorized_depts || []).map(dept => (
                          <span key={dept} className="px-2 py-0.5 bg-blue-50 text-[#007BE5] border border-blue-100 rounded text-[11px] font-bold font-mono">
                            {dept}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {accessControl.scope === 'RESTRICTED' && (
                    <div className="space-y-2 bg-rose-50/40 p-2.5 rounded-lg border border-rose-100">
                      <div>
                        <span className="text-slate-500 text-[11px]">ระดับตำแหน่งขั้นต่ำ: </span>
                        <strong className="text-rose-700 font-mono">Level {accessControl.min_access_level || 4}+ ขึ้นไป</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px] block mb-1">บุคคลที่ระบุเฉพาะ ({accessControl.authorized_users?.length || 0} คน):</span>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {(accessControl.authorized_users || []).map(uId => {
                            const u = masterUsers?.find(user => user.id === uId);
                            return (
                              <span key={uId} className="px-2 py-0.5 bg-white border border-rose-200 rounded text-[10px] font-bold text-slate-800">
                                {u ? `${u.name} (${u.department || u.dept})` : uId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ┌─ [4] การจัดสรรสำเนาและจุดใช้งาน ────────────────────────┐ */}
            <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-3 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="border-b border-slate-100 pb-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#444444] flex items-center gap-1.5">
                    <Layers size={15} className="text-purple-600" /> 4. การจัดสรรสำเนาและจุดใช้งาน (Distribution Matrix)
                  </h4>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[#666666]">ยอดจัดสรรสำเนา:</span>
                    <span className="font-bold font-mono text-[#1E1E1E]">
                      Master: 1 ชุด | เล่มควบคุม: {totalPhysicalCopies} ชุด
                    </span>
                  </div>

                  <div>
                    <span className="text-[#777777] block text-[11px] mb-1">รายการสำเนาและจุดประจำหน้างาน:</span>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      <div className="flex items-center justify-between p-1.5 bg-indigo-50/60 rounded border border-indigo-100 text-[11px]">
                        <span className="font-bold text-indigo-900">Master 01 (ต้นฉบับ)</span>
                        <span className="text-indigo-700 font-medium">{ownerDept} Head Office (ล็อกถาวร)</span>
                      </div>

                      {distributions.length > 0 ? (
                        distributions.map((d, i) => (
                          <div key={i} className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-200 text-[11px]">
                            <span className="font-bold text-slate-800">Copy {String(i + 1).padStart(2, '0')}</span>
                            <span className="text-slate-600 truncate max-w-[180px]">{d.location || d.stationName || d.departmentId || 'จุดหน้างาน'}</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-center text-slate-400 text-[11px] italic bg-slate-50 rounded">
                          📱 ดิจิทัล 100% (ไม่มีการพิมพ์เล่มควบคุมกระดาษ)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ┌─ [5] เอกสารแนบและวันบังคับใช้ ────────────────────────────────────────────┐ */}
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#444444] flex items-center gap-1.5">
                <Calendar size={15} className="text-emerald-600" /> 5. เอกสารแนบและวันบังคับใช้ (Attachments & Effective Date)
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#777777]">การรับทราบ:</span>
                <span className="font-bold text-xs text-[#0D99FF] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {dar.ackRequirement === 'REQUIRED' || dar.ackRequired ? '🔔 ต้องรับทราบ (Acknowledge Required)' : 'ไม่ต้องรับทราบ (No Ack Required)'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs items-center">
              <div>
                <span className="text-[#777777] block text-[11px]">วันที่ขอให้มีผลบังคับใช้ (Target Effective Date)</span>
                <span className="font-mono font-bold text-sm text-emerald-700 mt-0.5 block">
                  🗓️ {formatThaiDate(dar.effectiveDate) || 'รอประกาศ'}
                </span>
              </div>

              {/* Attachment Preview Box */}
              <div className="md:col-span-2 flex items-center justify-between p-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] hover:border-[#0D99FF] transition-all">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-[#1E1E1E] truncate block text-xs">
                      {docInfo.docCode ? `${docInfo.docCode}_Draft.pdf` : `${dar.title}_Draft.pdf`}
                    </span>
                    <span className="text-[10px] text-[#777777]">
                      PDF Document • พร้อมระบบลายน้ำควบคุม (Draft Watermark)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenPdfDraft}
                  className="bg-white border border-[#E5E5E5] hover:border-[#0D99FF] hover:text-[#007BE5] text-[#1E1E1E] text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
                >
                  <Eye size={14} /> เปิดดูตัวอย่าง PDF
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* Action Toolbar & Comments (Footer) */}
        {/* ========================================================================= */}
        <div className="bg-[#FAFAFA] border-t border-[#E5E5E5] px-6 py-4 space-y-3 shrink-0">
          {!readOnly && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#444444] flex items-center gap-1.5">
                <MessageSquare size={14} className="text-[#0D99FF]" /> ความเห็นประกอบการพิจารณา (Approval / Rejection Comments)
              </label>
              <textarea
                rows="2"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="ระบุความเห็นหรือข้อเสนอแนะในการแก้ไข (ถ้ามี)..."
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg text-[#1E1E1E] placeholder:text-[#999999] focus:border-[#0D99FF] focus:ring-1 focus:ring-[#0D99FF] outline-none resize-none"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-600 hover:text-[#1E1E1E] px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors w-full sm:w-auto cursor-pointer"
            >
              ปิดหน้าต่าง (Close)
            </button>

            {!readOnly && (
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {onReturn && (
                  <button
                    type="button"
                    onClick={handleReturnClick}
                    className="bg-white border border-[#FFCD29] text-[#946C00] hover:bg-[#FFFBEA] text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={14} /> ส่งกลับแก้ไข (Request Changes)
                  </button>
                )}

                {onReject && (
                  <button
                    type="button"
                    onClick={handleRejectClick}
                    className="bg-white border border-[#F24822] text-[#F24822] hover:bg-[#FFF2F0] text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Ban size={14} /> ไม่อนุมัติ (Reject)
                  </button>
                )}

                {onApprove && (
                  <button
                    type="button"
                    onClick={handleApproveClick}
                    className="bg-[#14AE5C] hover:bg-[#0F8A49] text-white text-xs font-bold px-5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle size={15} /> {role === 'REVIEWER' ? 'ผ่านการทบทวน (Approve Review)' : 'อนุมัติคำร้อง (Approve)'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
};

export default DarReviewModal;
