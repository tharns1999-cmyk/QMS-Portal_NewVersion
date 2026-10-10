import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Search,
  Filter,
  RotateCw,
  CheckCircle2,
  FileEdit,
  XCircle,
  FileText,
  Eye,
  Calendar,
  Building2,
  ExternalLink,
  Save,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../../store/useStore';
import { evaluateDocumentReviewStatus } from '../../utils/documentUtils';
import DocumentDetailModal from '../../components/workflow/DocumentDetailModal';
import ExternalDocDetailModal from '../ExternalDocs/ExternalDocDetailModal';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'OVERDUE':
      return {
        label: '🚨 เกินกำหนด',
        cls: 'bg-red-50 text-red-700 border-red-200'
      };
    case 'DUE_SOON':
    case 'UPCOMING':
    case 'DUE':
      return {
        label: '⚠️ ใกล้ครบกำหนด',
        cls: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    case 'UP_TO_DATE':
    case 'ON_SCHEDULE':
    case 'NORMAL':
    default:
      return {
        label: '✅ ยังไม่ถึงกำหนด',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
  }
};

export default function PeriodicReviewManageModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const {
    currentUser,
    documents,
    externalDocuments,
    periodicReviewSchedules,
    recordPeriodicReview,
    confirmPeriodicReviewNoChange,
    simulatedSystemDate,
    getEffectiveToday
  } = useStore();

  const [activeTab, setActiveTab] = useState('INTERNAL'); // 'INTERNAL' | 'EXTERNAL'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Review Record Sub-modal state
  const [reviewTargetDoc, setReviewTargetDoc] = useState(null);
  const [reviewOutcome, setReviewOutcome] = useState('CONFIRM_CONTINUE');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Detail Modal state
  const [detailDoc, setDetailDoc] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const effectiveRefDate = useMemo(() => {
    return getEffectiveToday
      ? getEffectiveToday()
      : (simulatedSystemDate ? new Date(simulatedSystemDate) : new Date());
  }, [simulatedSystemDate, getEffectiveToday]);

  // Compute processed internal docs
  const internalDocs = useMemo(() => {
    return (documents || [])
      .filter(d => {
        const st = (d.status || '').toUpperCase();
        return st !== 'SUPERSEDED' && st !== 'OBSOLETE' && !d.is_superseded && !d.is_obsolete;
      })
      .map(doc => {
        const nextDate = doc.next_review_date || doc.nextReviewDate;
        const matchingSchedule = (periodicReviewSchedules || []).find(
          s => s.documentId === doc.id || s.documentNumber === (doc.doc_code || doc.title)
        );
        const resolvedNextDate = matchingSchedule?.nextReviewDate || nextDate || doc.effectiveDate;
        const status = doc.review_status ||
          (resolvedNextDate ? evaluateDocumentReviewStatus(resolvedNextDate, effectiveRefDate) : 'UP_TO_DATE');

        return {
          ...doc,
          isExternal: false,
          code: doc.doc_code || doc.docNo || doc.title || doc.id,
          title: doc.name || doc.title || '-',
          dept: doc.department || doc.dept || doc.owner_dept || 'QA',
          rev: doc.revision || doc.rev || doc.revNo || '00',
          nextReviewDate: resolvedNextDate,
          reviewStatus: status,
          scheduleId: matchingSchedule?.id
        };
      });
  }, [documents, periodicReviewSchedules, effectiveRefDate]);

  // Compute processed external docs
  const externalDocs = useMemo(() => {
    return (externalDocuments || [])
      .filter(d => {
        const st = (d.status || '').toUpperCase();
        return st !== 'SUPERSEDED' && st !== 'OBSOLETE' && !d.is_superseded && !d.is_obsolete;
      })
      .map(doc => {
        const nextDate = doc.next_review_date || doc.nextReviewDate;
        const matchingSchedule = (periodicReviewSchedules || []).find(
          s => s.externalDocumentId === doc.id || s.documentId === doc.id || s.documentNumber === (doc.doc_code || doc.document_number || doc.title)
        );
        const resolvedNextDate = matchingSchedule?.nextReviewDate || nextDate || doc.effectiveDate;
        const status = doc.review_status ||
          (resolvedNextDate ? evaluateDocumentReviewStatus(resolvedNextDate, effectiveRefDate) : 'UP_TO_DATE');

        return {
          ...doc,
          isExternal: true,
          code: doc.document_number || doc.doc_code || doc.code || doc.id,
          title: doc.name || doc.title || '-',
          dept: doc.department || doc.dept || doc.owner_dept || 'DC',
          rev: doc.edition || doc.rev || doc.revision || 'Current',
          nextReviewDate: resolvedNextDate,
          reviewStatus: status,
          scheduleId: matchingSchedule?.id
        };
      });
  }, [externalDocuments, periodicReviewSchedules, effectiveRefDate]);

  // Available departments based on loaded items
  const availableDepts = useMemo(() => {
    const list = activeTab === 'INTERNAL' ? internalDocs : externalDocs;
    const set = new Set();
    list.forEach(d => {
      if (d.dept) set.add(d.dept);
    });
    return Array.from(set).sort();
  }, [activeTab, internalDocs, externalDocs]);

  // Filtered active list
  const displayedDocs = useMemo(() => {
    const baseList = activeTab === 'INTERNAL' ? internalDocs : externalDocs;
    return baseList.filter(doc => {
      if (selectedDept !== 'ALL' && doc.dept !== selectedDept) return false;

      if (statusFilter !== 'ALL') {
        if (statusFilter === 'OVERDUE' && doc.reviewStatus !== 'OVERDUE') return false;
        if (statusFilter === 'DUE_SOON' && !['DUE_SOON', 'UPCOMING', 'DUE'].includes(doc.reviewStatus)) return false;
        if (statusFilter === 'UP_TO_DATE' && !['UP_TO_DATE', 'ON_SCHEDULE', 'NORMAL'].includes(doc.reviewStatus)) return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const codeMatch = (doc.code || '').toLowerCase().includes(term);
        const titleMatch = (doc.title || '').toLowerCase().includes(term);
        const deptMatch = (doc.dept || '').toLowerCase().includes(term);
        if (!codeMatch && !titleMatch && !deptMatch) return false;
      }

      return true;
    });
  }, [activeTab, internalDocs, externalDocs, selectedDept, statusFilter, searchTerm]);

  // Submission handler for recording a review outcome
  const handleSaveReview = async () => {
    if (!reviewTargetDoc) return;
    if (reviewOutcome !== 'CONFIRM_CONTINUE' && !reviewComment.trim()) {
      toast.error('กรุณาระบุเหตุผลหรือรายละเอียดการขอแก้ไข/ขอยกเลิก');
      return;
    }

    setSubmitting(true);
    try {
      const scheduleId = reviewTargetDoc.scheduleId || `PRS-GEN-${reviewTargetDoc.id}`;

      if (reviewOutcome === 'CONFIRM_CONTINUE') {
        if (confirmPeriodicReviewNoChange) {
          confirmPeriodicReviewNoChange({
            scheduleId,
            documentId: reviewTargetDoc.id,
            isExternal: reviewTargetDoc.isExternal,
            comment: reviewComment || 'ทบทวนเนื้อหายังคงถูกต้องตามปัจจุบัน',
            reviewer: currentUser?.name || 'Reviewer',
            reviewDate: reviewDate
          });
        } else if (recordPeriodicReview) {
          recordPeriodicReview({
            scheduleId,
            outcome: 'CONFIRM_CONTINUE',
            documentId: reviewTargetDoc.id,
            isExternal: reviewTargetDoc.isExternal,
            comment: reviewComment || 'ทบทวนเนื้อหายังคงถูกต้องตามปัจจุบัน',
            reviewer: currentUser?.name || 'Reviewer',
            reviewDate: reviewDate
          });
        }
        toast.success(`บันทึกผลการทบทวน ${reviewTargetDoc.code} สำเร็จ (เลื่อนรอบทบทวนถัดไปเรียบร้อย)`);
        setReviewTargetDoc(null);
        setReviewComment('');
      } else {
        // REVISION_REQUIRED or OBSOLETE_REQUIRED: record then offer DAR transition
        if (recordPeriodicReview) {
          recordPeriodicReview({
            scheduleId,
            outcome: reviewOutcome,
            documentId: reviewTargetDoc.id,
            isExternal: reviewTargetDoc.isExternal,
            comment: reviewComment,
            reviewer: currentUser?.name || 'Reviewer',
            reviewDate: reviewDate
          });
        }

        const isObsolete = reviewOutcome === 'OBSOLETE_REQUIRED';
        toast.success(`บันทึกผลการทบทวน ${reviewTargetDoc.code} แล้ว กำลังนำทางไปยังระบบ DAR...`);
        const targetDocCopy = { ...reviewTargetDoc };
        setReviewTargetDoc(null);
        setReviewComment('');
        onClose();

        navigate('/dcc/dar/new', {
          state: {
            prefillDocId: targetDocCopy.id,
            prefillDocCode: targetDocCopy.code,
            prefillDocTitle: targetDocCopy.title,
            darOrigin: 'PERIODIC_REVIEW',
            dar_origin: 'PERIODIC_REVIEW',
            reason: reviewComment,
            type: isObsolete ? 'OBSOLETE' : 'REVISION'
          }
        });
      }
    } catch (err) {
      console.error('Error saving review:', err);
      toast.error('เกิดข้อผิดพลาดในการบันทึกผลการทบทวน');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetail = (doc) => {
    setDetailDoc(doc);
    setIsDetailModalOpen(true);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !reviewTargetDoc && !isDetailModalOpen) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-[#E5E5E5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#E5F4FF] text-[#0D99FF] rounded-xl">
              <RotateCw size={20} className="animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] tracking-tight">
                  จัดการทบทวนเอกสารตามรอบ (Internal / External)
                </h2>
                <span className="text-xs bg-[#E5F4FF] text-[#0D99FF] font-bold px-2.5 py-0.5 rounded-full border border-[#B8E1FF]">
                  {internalDocs.length + externalDocs.length} ฉบับ
                </span>
              </div>
              <p className="text-xs text-[#666666] mt-0.5">
                เลือกเอกสารเพื่อบันทึกผลการทบทวนความทันสมัย หรือตรวจสอบสถานะครบกำหนด
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                navigate('/dcc/periodic-reviews/manage');
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0D99FF] bg-[#E5F4FF] hover:bg-[#D4EDFF] rounded-lg border border-[#B8E1FF] transition-colors cursor-pointer"
              title="เปิดหน้าจัดการแบบเต็มหน้าจอ"
            >
              <ExternalLink size={13} /> หน้าจัดการเต็มรูปแบบ
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#888888] hover:text-[#1E1E1E] hover:bg-[#F5F5F5] rounded-xl transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-6 bg-[#FAFAFA] border-b border-[#E5E5E5] flex items-center justify-between shrink-0">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab('INTERNAL');
                setSelectedDept('ALL');
              }}
              className={`flex items-center gap-2 py-3.5 font-semibold text-xs sm:text-sm transition-all border-b-2 cursor-pointer ${
                activeTab === 'INTERNAL'
                  ? 'text-[#0D99FF] border-[#0D99FF]'
                  : 'text-[#666666] hover:text-[#1E1E1E] border-transparent'
              }`}
            >
              <FileText size={15} />
              <span>เอกสารภายใน (Internal)</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-[#E5F4FF] text-[#0D99FF]">
                {internalDocs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('EXTERNAL');
                setSelectedDept('ALL');
              }}
              className={`flex items-center gap-2 py-3.5 font-semibold text-xs sm:text-sm transition-all border-b-2 cursor-pointer ${
                activeTab === 'EXTERNAL'
                  ? 'text-[#0D99FF] border-[#0D99FF]'
                  : 'text-[#666666] hover:text-[#1E1E1E] border-transparent'
              }`}
            >
              <ExternalLink size={15} />
              <span>เอกสารภายนอก (External)</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-[#E5F4FF] text-[#0D99FF]">
                {externalDocs.length}
              </span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-white border-b border-[#E5E5E5] flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="ค้นหารหัส หรือชื่อเอกสาร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#E5E5E5] rounded-xl text-xs focus:outline-none focus:border-[#0D99FF] bg-[#F5F5F5] focus:bg-white transition-all font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Filter size={14} className="text-slate-400" />
              <span>แผนก:</span>
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="border border-[#E5E5E5] rounded-xl text-xs px-3 py-2 bg-[#F5F5F5] focus:bg-white focus:outline-none focus:border-[#0D99FF] font-medium"
            >
              <option value="ALL">ทุกแผนก ({activeTab === 'INTERNAL' ? internalDocs.length : externalDocs.length})</option>
              {availableDepts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <div className="flex items-center gap-1 text-xs text-slate-500 ml-1">
              <span>สถานะ:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-[#E5E5E5] rounded-xl text-xs px-3 py-2 bg-[#F5F5F5] focus:bg-white focus:outline-none focus:border-[#0D99FF] font-medium"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="OVERDUE">🚨 เกินกำหนด</option>
              <option value="DUE_SOON">⚠️ ใกล้ครบกำหนด</option>
              <option value="UP_TO_DATE">✅ ยังไม่ถึงกำหนด</option>
            </select>
          </div>
        </div>

        {/* Documents Table */}
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-[300px] max-h-[500px] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E2E8F0] shadow-2xs whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 font-mono font-bold text-slate-700 w-36">รหัสเอกสาร</th>
                <th className="px-4 py-3 font-bold text-slate-700">ชื่อเอกสาร</th>
                <th className="px-4 py-3 font-bold text-slate-700 w-24">แผนก</th>
                <th className="px-4 py-3 font-bold text-slate-700 w-20 text-center">ฉบับ</th>
                <th className="px-4 py-3 font-mono font-bold text-slate-700 w-32">ครบกำหนด</th>
                <th className="px-4 py-3 font-bold text-slate-700 w-32 text-center">สถานะรอบ</th>
                <th className="px-4 py-3 font-bold text-slate-700 w-44 text-center">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {displayedDocs.map(doc => {
                const badge = getStatusBadge(doc.reviewStatus);
                return (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0D99FF] whitespace-nowrap">
                      {doc.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 leading-snug break-all break-words max-w-xs">
                      {doc.title}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        <Building2 size={12} className="text-slate-400" />
                        {doc.dept}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-600">
                      Rev.{doc.rev}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                      {formatDate(doc.nextReviewDate)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setReviewTargetDoc(doc);
                            setReviewOutcome('CONFIRM_CONTINUE');
                            setReviewComment('');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0D99FF] hover:bg-blue-600 rounded-lg shadow-2xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="บันทึกผลการทบทวนเอกสารนี้"
                        >
                          <RotateCw size={12} />
                          <span>บันทึกผล</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(doc)}
                          className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="ดูรายละเอียดเอกสาร"
                        >
                          <Eye size={12} />
                          <span>รายละเอียด</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayedDocs.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-xs text-slate-600">
                      ไม่พบเอกสารที่ตรงกับเงื่อนไขการค้นหา
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#FAFAFA] border-t border-[#E5E5E5] flex items-center justify-between text-xs text-[#666666] shrink-0">
          <span>
            แสดงทั้งหมด {displayedDocs.length} จาก {activeTab === 'INTERNAL' ? internalDocs.length : externalDocs.length} รายการ
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#E5E5E5] text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* Record Review Sub-Modal */}
      {reviewTargetDoc && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setReviewTargetDoc(null);
            }
          }}
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-white border-b border-[#E5E5E5] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#E5F4FF] text-[#0D99FF] rounded-xl">
                  <RotateCw size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1E1E1E]">บันทึกผลการทบทวนตามรอบ</h3>
                  <p className="text-xs text-[#666666] font-mono mt-0.5">
                    {reviewTargetDoc.code} — {reviewTargetDoc.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewTargetDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  ผลการพิจารณาการทบทวน <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {[
                    {
                      id: 'CONFIRM_CONTINUE',
                      label: 'ยืนยันใช้งานต่อ (No Change)',
                      desc: 'เนื้อหาถูกต้องตามปัจจุบัน ระบบจะต่ออายุรอบทบทวนถัดไป',
                      color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900'
                    },
                    {
                      id: 'REVISION_REQUIRED',
                      label: 'ขอแก้ไข (Revision Required)',
                      desc: 'เนื้อหาไม่ทันสมัย จะนำทางไปเปิดคำร้อง DAR ขอแก้ไขเอกสาร',
                      color: 'border-amber-300 bg-amber-50/50 text-amber-900'
                    },
                    {
                      id: 'OBSOLETE_REQUIRED',
                      label: 'ขอยกเลิก (Obsolete Required)',
                      desc: 'เอกสารไม่มีการใช้งานแล้ว จะนำทางไปเปิดคำร้อง DAR ขอยกเลิก',
                      color: 'border-red-300 bg-red-50/50 text-red-900'
                    }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReviewOutcome(opt.id)}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        reviewOutcome === opt.id
                          ? `ring-2 ring-[#0D99FF] border-[#0D99FF] bg-blue-50/40`
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            reviewOutcome === opt.id
                              ? 'border-[#0D99FF] bg-[#0D99FF] text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {reviewOutcome === opt.id && <Check size={11} strokeWidth={3} />}
                        </div>
                        <span className="font-bold text-xs text-slate-900">{opt.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 ml-6">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  วันที่ทำการทบทวน
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-[#0D99FF] bg-[#F5F5F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ความเห็นประกอบการพิจารณา {reviewOutcome !== 'CONFIRM_CONTINUE' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={
                    reviewOutcome === 'CONFIRM_CONTINUE'
                      ? 'บันทึกความเห็นเพิ่มเติม (ไม่บังคับ)...'
                      : 'ระบุเหตุผลที่ต้องดำเนินการแก้ไขหรือยกเลิก...'
                  }
                  rows={3}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#0D99FF] bg-[#F5F5F5] focus:bg-white resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReviewTargetDoc(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSaveReview}
                className="px-4 py-2 bg-[#0D99FF] text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <Save size={14} />
                <span>
                  {reviewOutcome === 'CONFIRM_CONTINUE' ? 'ยืนยันใช้ต่อ' : 'บันทึก & เปิด DAR'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Document Detail Modal */}
      {detailDoc && !detailDoc.isExternal && (
        <DocumentDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setDetailDoc(null);
          }}
          document={detailDoc}
        />
      )}

      {/* External Document Detail Modal */}
      {detailDoc && detailDoc.isExternal && (
        <ExternalDocDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setDetailDoc(null);
          }}
          document={detailDoc}
        />
      )}
    </div>
  );
}
