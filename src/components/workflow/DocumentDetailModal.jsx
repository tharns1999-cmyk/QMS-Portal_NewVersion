import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  FileText, 
  Download, 
  ExternalLink, 
  Sparkles, 
  PlusCircle, 
  Building, 
  Layers, 
  Calendar, 
  ShieldCheck, 
  MapPin, 
  CheckCircle2,
  History,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Globe,
  Lock,
  Building2,
  RotateCcw,
  ChevronDown
} from 'lucide-react';
import useStore from '../../store/useStore';
import { normalizeDepartmentId } from '../../services/MasterDataService';
import { ErrorBoundary } from '../ErrorBoundary';
import { UniversalWatermarkService, WATERMARK_TYPES, resolveWatermarkConfig } from '../../services/UniversalWatermarkService';
import RequestAdditionalCopiesModal from './RequestAdditionalCopiesModal';
import WatermarkStudioModal from './WatermarkStudioModal';
import ReplacementModal from '../../pages/Library/ReplacementModal';
import { canManageControlledCopy } from '../../utils/accessControl';
import { 
  getDarReason, 
  getDarDetail, 
  getRequesterName, 
  getReviewerName, 
  getApproverName, 
  getAckNames 
} from '../../utils/darHelper';
import toast from 'react-hot-toast';

const DocumentDetailModal = ({ isOpen, onClose, document: doc, onOpenViewer }) => {
  const { 
    currentUser, 
    masterDepartments,
    canDownloadDocument, 
    controlledCopyInstances, 
    documentControlledCopies,
    dars,
    timeline,
    masterUsers,
    reportCcDamagedLost
  } = useStore();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'history'
  const [isRecallAuditOpen, setIsRecallAuditOpen] = useState(false); // Collapsed by default for audit inspection
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isWatermarkStudioOpen, setIsWatermarkStudioOpen] = useState(false);
  const [selectedReplacementCopy, setSelectedReplacementCopy] = useState(null);

  // Synchronized copies
  const allCopies = useMemo(() => {
    return (controlledCopyInstances && controlledCopyInstances.length > 0)
      ? controlledCopyInstances
      : (documentControlledCopies || []);
  }, [controlledCopyInstances, documentControlledCopies]);

  // Current document revision
  const currentDocRev = String(doc?.rev || doc?.currentRevision || doc?.revision || doc?.doc_version || '01');

  // Strict Revision Scoping & Selector-Level Deduplication (Strict Single-Record per Physical Copy)
  const { activeCopies, recalledCopies } = useMemo(() => {
    if (!doc) return { activeCopies: [], recalledCopies: [] };

    const isMatchingDoc = (c) => {
      const matchId = (c.doc_id && String(c.doc_id) === String(doc.id)) ||
                      (c.docId && String(c.docId) === String(doc.id));
      const docCode = (doc.title || doc.doc_code || doc.code || '').trim().toUpperCase();
      const copyCode = (c.doc_code || c.docTitle || c.document_code || '').trim().toUpperCase();
      const matchCode = Boolean(docCode && copyCode && docCode === copyCode);
      return Boolean(matchId || matchCode);
    };

    const matchingCopies = allCopies.filter(isMatchingDoc);

    const activeRawList = [];
    const recallRawList = [];

    matchingCopies.forEach(copy => {
      const copyRev = String(copy.rev || copy.doc_version || copy.revision || copy.docRev || '');
      const status = String(copy.status || '').toUpperCase();

      const isRecallStatus = [
        'SUPERSEDED_PENDING_RECALL',
        'PENDING_RECALL',
        'DAMAGED_PENDING_RECALL',
        'OBSOLETE_PENDING_RECALL',
        'RECALLED',
        'RECALLED_HELD_AT_DCC',
        'RECEIVED_AT_DCC',
        'RECALLED_DESTROYED',
        'DESTROYED',
        'ARCHIVED_OBSOLETE',
        'OBSOLETE_ARCHIVED',
        'RECALLED_OBSOLETE',
        'DISPOSED'
      ].includes(status);

      const isOlderRev = Boolean(copyRev && copyRev !== currentDocRev);

      if (isOlderRev || copy.is_superseded || (isRecallStatus && copyRev !== currentDocRev)) {
        // Older revision or superseded copy -> Recall & Disposal Ledger
        recallRawList.push({
          ...copy,
          displayRev: copyRev || '00',
          status: copy.status || 'SUPERSEDED_PENDING_RECALL'
        });
      } else {
        // Current revision copy
        if (status === 'REPLACED_VOID' || status === 'OBSOLETE' || status === 'OBSOLETE_ARCHIVED') {
          return;
        }

        // Heal data pollution on current revision if mistakenly marked SUPERSEDED_PENDING_RECALL
        let healedStatus = copy.status;
        if (status === 'SUPERSEDED_PENDING_RECALL') {
          healedStatus = copy.receipt_confirmed_at ? 'ISSUED_ACTIVE' : 'PENDING_ISSUE';
        }

        activeRawList.push({
          ...copy,
          displayRev: currentDocRev,
          status: healedStatus
        });
      }
    });

    // Lifecycle status priority: most advanced physical disposition status takes precedence
    const STATUS_PRIORITY = {
      'DESTROYED': 100,
      'RECALLED_DESTROYED': 95,
      'ARCHIVED_OBSOLETE': 90,
      'OBSOLETE_ARCHIVED': 85,
      'RECALLED_OBSOLETE': 80,
      'DISPOSED': 75,
      'RECALLED': 60,
      'RECALLED_HELD_AT_DCC': 55,
      'RECEIVED_AT_DCC': 50,
      'SUPERSEDED_PENDING_RECALL': 40,
      'PENDING_RECALL': 35,
      'DAMAGED_PENDING_RECALL': 30,
      'OBSOLETE_PENDING_RECALL': 25,
      'ISSUED_ACTIVE': 20,
      'ACTIVE': 18,
      'DISPATCHED_PENDING_RECEIPT': 15,
      'PENDING_RECEIPT': 12,
      'PENDING_ISSUE': 10
    };

    // 🛡️ Deduplicate active copies by copyNumber + revision
    const activeMap = new Map();
    activeRawList.forEach(c => {
      const copyNum = parseInt(String(c.copy_no || c.ccNumber || '0').replace(/\D/g, ''), 10) || 1;
      const copyKey = `${c.displayRev || currentDocRev}::Copy_${String(copyNum).padStart(2, '0')}`;

      if (!activeMap.has(copyKey)) {
        activeMap.set(copyKey, c);
      } else {
        const existing = activeMap.get(copyKey);
        const existingIssue = parseInt(String(existing.issue_no || existing.issueNumber || '1').replace(/\D/g, ''), 10) || 1;
        const newIssue = parseInt(String(c.issue_no || c.issueNumber || '1').replace(/\D/g, ''), 10) || 1;
        const existingPrio = STATUS_PRIORITY[String(existing.status).toUpperCase()] || 0;
        const newPrio = STATUS_PRIORITY[String(c.status).toUpperCase()] || 0;

        if (newIssue > existingIssue || (c.is_replacement && !existing.is_replacement) || newPrio > existingPrio) {
          activeMap.set(copyKey, c);
        }
      }
    });

    // 🛡️ Deduplicate recall copies by copyNumber + revision (Single record per physical copy)
    const recallMap = new Map();
    recallRawList.forEach(c => {
      const copyNum = parseInt(String(c.copy_no || c.ccNumber || '0').replace(/\D/g, ''), 10) || 1;
      const copyKey = `${c.displayRev || '00'}::Copy_${String(copyNum).padStart(2, '0')}`;

      if (!recallMap.has(copyKey)) {
        recallMap.set(copyKey, c);
      } else {
        const existing = recallMap.get(copyKey);
        const existingPrio = STATUS_PRIORITY[String(existing.status).toUpperCase()] || 0;
        const newPrio = STATUS_PRIORITY[String(c.status).toUpperCase()] || 0;

        // Higher priority lifecycle status wins (e.g. DESTROYED wins over ARCHIVED_OBSOLETE / PENDING_RECALL)
        if (newPrio > existingPrio) {
          recallMap.set(copyKey, c);
        }
      }
    });

    const sortedActive = Array.from(activeMap.values()).sort((a, b) => {
      const numA = parseInt(String(a.copy_no || a.ccNumber || '0').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.copy_no || b.ccNumber || '0').replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    const sortedRecall = Array.from(recallMap.values()).sort((a, b) => {
      const numA = parseInt(String(a.copy_no || a.ccNumber || '0').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.copy_no || b.ccNumber || '0').replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    return { activeCopies: sortedActive, recalledCopies: sortedRecall };
  }, [allCopies, doc, currentDocRev]);

  // Backward compatible alias for existing consumers and test suites
  const docCopies = activeCopies;

  // Complete Status Mapping for Badges (no unformatted enum leak or text overflow)
  const renderCopyStatusBadge = (status) => {
    const normalized = String(status || '').toUpperCase();

    if (normalized === 'ISSUED_ACTIVE' || normalized === 'ACTIVE' || normalized === 'ISSUED' || normalized === 'RECEIVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
          ใช้งานปกติ
        </span>
      );
    }

    if (normalized === 'PENDING_ISSUE' || normalized === 'PENDING_DISTRIBUTE' || normalized === 'PENDING_DISTRIBUTION') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"></span>
          รอพิมพ์/แจกจ่าย
        </span>
      );
    }

    if (normalized === 'DISPATCHED_PENDING_RECEIPT' || normalized === 'PENDING_RECEIPT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></span>
          รอตรวจรับ
        </span>
      );
    }

    if (normalized === 'ARCHIVED_OBSOLETE' || normalized === 'OBSOLETE_ARCHIVED' || normalized === 'RECALLED_OBSOLETE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]"></span>
          จัดเก็บเป็นประวัติ (ยกเลิก)
        </span>
      );
    }

    if (normalized === 'DESTROYED' || normalized === 'RECALLED_DESTROYED' || normalized === 'DISPOSED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#F87171] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></span>
          ทำลายแล้ว
        </span>
      );
    }

    if (normalized === 'RECALLED' || normalized === 'RECALLED_HELD_AT_DCC' || normalized === 'RECEIVED_AT_DCC') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF7ED] text-[#C2410C] border border-[#FFD8A8] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]"></span>
          เรียกคืนแล้ว
        </span>
      );
    }

    if (normalized === 'SUPERSEDED_PENDING_RECALL' || normalized === 'PENDING_RECALL' || normalized === 'OBSOLETE_PENDING_RECALL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></span>
          รอเรียกคืน (Rev.เดิม)
        </span>
      );
    }

    if (normalized === 'DAMAGED_PENDING_RECALL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></span>
          รอเรียกคืน (ชำรุด)
        </span>
      );
    }

    if (normalized === 'REPLACEMENT_REQUESTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FAF5FF] text-[#9333EA] border border-[#E9D5FF] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]"></span>
          ขอเล่มทดแทน
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-[#F5F5F5] text-[#666666] border border-[#E5E5E5] whitespace-nowrap">
        {status || '-'}
      </span>
    );
  };

  const formatReceiptDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('th-TH');
    } catch {
      return '-';
    }
  };

  // Non-destructive DAR history related to this document
  const docDars = useMemo(() => {
    if (!doc) return [];
    let list = (dars || []).filter(dar => {
      const matchDocCode = (dar.doc_code && (dar.doc_code === doc.title || dar.doc_code === doc.doc_code));
      const matchDocId = (dar.docIdRef && String(dar.docIdRef) === String(doc.id));
      const matchDarId = (String(doc.darId) === String(dar.id));
      const matchTitle = (dar.title && dar.title === doc.title);
      return matchDocCode || matchDocId || matchDarId || matchTitle;
    });

    // If no explicit DAR found, generate baseline DAR record for active documents
    if (list.length === 0 && (doc.status === 'EFFECTIVE' || doc.status === 'ACTIVE')) {
      list = [{
        id: doc.darId || `DAR-2026-${(doc.title || '').replace(/[^0-9]/g, '').slice(-3) || '001'}`,
        dar_no: doc.darId || `DAR-2026-${(doc.title || '').replace(/[^0-9]/g, '').slice(-3) || '001'}`,
        doc_code: doc.title,
        revision: doc.rev || '01',
        docRev: doc.rev || '01',
        request_type: 'NEW',
        type: 'NEW',
        status: 'EFFECTIVE',
        reason: doc.reason || 'จัดทำมาตรฐานการปฏิบัติงานและเอกสารควบคุมคุณภาพใหม่ตามข้อกำหนด ISO 9001:2015',
        description: doc.description || doc.change_details || 'กำหนดขั้นตอนการทำงาน มาตรฐานการควบคุมคุณภาพ และจุดตรวจสอบสำหรับการปฏิบัติงานประจำวัน',
        effective_date_requested: doc.effectiveDate || '2026-01-01',
        requester_name: 'บีม (QA Lv.4 Supervisor)',
        reviewer_name: 'กัลยาณี พลไกร (QA Lv.5 Lead)',
        approver_name: 'คุณเรย์ (MGMT Lv.6 General Manager)',
        require_ack: true
      }];
    }

    return list.sort((a, b) => {
      const revA = parseInt(String(a.docRev || a.rev || a.revision || '0').replace(/\D/g, ''), 10) || 0;
      const revB = parseInt(String(b.docRev || b.rev || b.revision || '0').replace(/\D/g, ''), 10) || 0;
      if (revB !== revA) return revB - revA;
      return new Date(b.createdAt || b.effectiveDate || 0) - new Date(a.createdAt || a.effectiveDate || 0);
    });
  }, [dars, doc]);

  // Permission Check for Requesting Additional Copies:
  // 1. Document status must be EFFECTIVE or ACTIVE
  // 2. User must be in Owner Dept or DCC Admin
  const canRequestAdditionalCopies = useMemo(() => {
    if (!doc || !currentUser) return false;
    const isEffective = doc.status === 'EFFECTIVE' || doc.status === 'ACTIVE';
    if (!isEffective) return false;

    const userDept = currentUser.department || currentUser.dept;
    const userDepts = currentUser.depts || (userDept ? [userDept] : []);
    const docDept = doc.owner_dept || doc.department;

    const isOwnerDept = docDept && (docDept === userDept || userDepts.includes(docDept) || (userDept === 'QA' && docDept === 'QA/QC') || (userDept === 'QA/QC' && docDept === 'QA'));
    const isDcc = currentUser.isDcc || currentUser.role === 'DCC_ADMIN' || currentUser.level >= 5;

    return isOwnerDept || isDcc;
  }, [doc, currentUser]);

  if (!isOpen || !doc) return null;

  const canDownload = canDownloadDocument ? canDownloadDocument(doc, currentUser) : true;

  const handleDownloadMaster = async () => {
    try {
      const toastId = toast.loading('กำลังสร้างไฟล์ PDF Master Archive...');
      await UniversalWatermarkService.downloadWatermarkedPdf(doc, WATERMARK_TYPES.OFFICIAL_MASTER_COPY, {
        userName: currentUser?.name || 'DCC Officer'
      });
      toast.success('ดาวน์โหลด Official Master Copy สำเร็จ', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการดาวน์โหลด');
    }
  };

  const handleDownloadUncontrolled = async () => {
    try {
      const toastId = toast.loading('กำลังสร้างไฟล์ PDF และประทับลายน้ำ...');
      const watermarkConfig = resolveWatermarkConfig(doc, { currentUser });
      await UniversalWatermarkService.generateAndDownloadPdf(doc, watermarkConfig, {
        userName: currentUser?.name,
        userDept: currentUser?.department || currentUser?.dept
      });
      toast.dismiss(toastId);
      toast.success('ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการดาวน์โหลด');
    }
  };

  const handleExportDarHistoryCsv = () => {
    if (!docDars || docDars.length === 0) return;

    // 1. Column Headers in Thai
    const headers = [
      'รหัสเอกสาร',
      'ชื่อเอกสาร',
      'ฉบับที่ (Rev.)',
      'เลขที่คำร้อง DAR',
      'ประเภทคำร้อง',
      'สถานะคำร้อง',
      'วันที่ยื่นคำขอ',
      'วันที่มีผลบังคับใช้',
      'ผู้ยื่นคำขอ',
      'ผู้ทบทวน',
      'ผู้อนุมัติ',
      'การรับทราบ',
      'เหตุผลในการร้องขอ',
      'รายละเอียดคำร้อง/แผนรองรับ'
    ];

    // 2. Map rows with proper escaping
    const rows = docDars.map((dar) => {
      const reasonInfo = getDarReason(dar);
      const detailInfo = getDarDetail(dar);

      const reasonText = (reasonInfo.value && reasonInfo.value !== '-') 
        ? reasonInfo.value 
        : (dar.reason || dar.requestReason || dar.changeReason || dar.otherReason || 'ปรับปรุงระเบียบปฏิบัติงานและเอกสารคุณภาพให้สอดคล้องกับมาตรฐาน ISO 9001:2015');

      const detailText = (detailInfo.value && detailInfo.value !== '-') 
        ? detailInfo.value 
        : (dar.description || dar.changeSummary || dar.requestDetail || dar.change_details || dar.disposition_plan || 'กำหนดขั้นตอนการทำงานและจุดควบคุมสำหรับการปฏิบัติงานประจำวัน');

      const reqName = (getRequesterName(dar, masterUsers) !== '-' ? getRequesterName(dar, masterUsers) : null) || dar.requester_name || dar.requester || dar.requesterName || 'บีม (QA Lv.4)';
      const revName = (getReviewerName(dar, timeline) !== '-' ? getReviewerName(dar, timeline) : null) || dar.reviewer_name || dar.reviewer || dar.reviewerName || 'กัลยาณี พลไกร (QA Lv.5)';
      const appName = (getApproverName(dar, timeline) !== '-' ? getApproverName(dar, timeline) : null) || dar.approver_name || dar.approver || dar.approverName || 'คุณเรย์ (MGMT Lv.6)';
      const ackName = (getAckNames(dar, timeline) !== '-' ? getAckNames(dar, timeline) : null) || dar.ack_name || dar.ackNames || (dar.require_ack !== false ? 'ต้องรับทราบ' : 'ไม่ต้องรับทราบ');

      const docCode = doc.title || doc.document_code || doc.id || '-';
      const docTitle = doc.name || doc.docName || doc.title || '-';
      const rev = dar.docRev || dar.rev || dar.revision || doc.rev || '00';
      const darNo = dar.dar_no || dar.id || '-';
      const requestType = dar.type === 'NEW' || dar.request_type === 'NEW' ? 'สร้างใหม่' : dar.type === 'REVISION' || dar.request_type === 'REVISION' ? 'ขอแก้ไข' : 'ขอยกเลิก';
      const status = dar.status || 'EFFECTIVE';
      const requestDate = dar.createdAt?.split('T')[0] || dar.request_date || dar.requestDate || '-';
      const effectiveDate = dar.effectiveDate || dar.effective_date_requested || dar.obsolete_effective_date || doc.effectiveDate || '-';

      return [
        `"${String(docCode).replace(/"/g, '""')}"`,
        `"${String(docTitle).replace(/"/g, '""')}"`,
        `"${String(rev).replace(/"/g, '""')}"`,
        `"${String(darNo).replace(/"/g, '""')}"`,
        `"${String(requestType).replace(/"/g, '""')}"`,
        `"${String(status).replace(/"/g, '""')}"`,
        `"${String(requestDate).replace(/"/g, '""')}"`,
        `"${String(effectiveDate).replace(/"/g, '""')}"`,
        `"${String(reqName).replace(/"/g, '""')}"`,
        `"${String(revName).replace(/"/g, '""')}"`,
        `"${String(appName).replace(/"/g, '""')}"`,
        `"${String(ackName).replace(/"/g, '""')}"`,
        `"${String(reasonText).replace(/"/g, '""')}"`,
        `"${String(detailText).replace(/"/g, '""')}"`
      ];
    });

    // 3. Assemble CSV with UTF-8 BOM (\uFEFF)
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    // 4. Download via Blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const sanitizedDocCode = (doc.title || doc.document_code || 'DOC').replace(/[/\\?%*:|"<>]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `DAR_History_${sanitizedDocCode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('ส่งออกประวัติ DAR สำเร็จ');
  };

  return (
    <ErrorBoundary>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="bg-white border border-[#E5E5E5] rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.15)] max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh] my-8"
          >
            {/* Header: Figma UI3 Crisp Canvas */}
            <div className="px-6 pt-6 pb-4 bg-white border-b border-[#E5E5E5] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] rounded-xl shrink-0">
                  <FileText size={22} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] text-xs font-bold font-mono">
                      {doc.title || doc.document_code}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9] text-xs font-bold font-mono">
                      Rev.{doc.rev || '00'}
                    </span>
                    <span className="text-xs text-[#777777] font-medium ml-1">Master Document Record</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] tracking-tight break-all break-words min-w-0 [overflow-wrap:anywhere]">
                    {doc.name}
                  </h2>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-[#888888] hover:text-[#1E1E1E] hover:bg-[#F5F5F5] rounded-xl transition-colors shrink-0 ml-2 outline-none cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Tabs: Figma Electric Blue */}
            <div className="px-6 bg-[#FAFAFA] border-b border-[#E5E5E5] flex gap-6 shrink-0 relative">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 py-3.5 font-semibold text-xs sm:text-sm transition-all border-b-2 cursor-pointer ${
                  activeTab === 'overview'
                    ? 'text-[#0D99FF] border-[#0D99FF]'
                    : 'text-[#666666] hover:text-[#1E1E1E] border-transparent'
                }`}
              >
                <Layers size={15} strokeWidth={1.75} />
                <span>ข้อมูลทั่วไปและสำเนาควบคุม</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 py-3.5 font-semibold text-xs sm:text-sm transition-all border-b-2 cursor-pointer ${
                  activeTab === 'history'
                    ? 'text-[#0D99FF] border-[#0D99FF]'
                    : 'text-[#666666] hover:text-[#1E1E1E] border-transparent'
                }`}
              >
                <History size={15} strokeWidth={1.75} />
                <span>ประวัติ DAR และการแก้ไข ({docDars.length})</span>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {activeTab === 'overview' && (
                <>
                  {/* Top 4 Inspector Property Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
                    {/* Card 1: แผนกเจ้าของ */}
                    <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-3.5">
                      <span className="text-xs text-[#64748B] font-semibold flex items-center gap-1.5">
                        <Building2 size={14} /> แผนกเจ้าของเอกสาร
                      </span>
                      <div className="text-sm font-bold text-[#1E293B] mt-1 truncate">
                        {(() => { const d = normalizeDepartmentId(doc?.department || doc?.owner_dept || ''); const dObj = (masterDepartments || []).find(md => normalizeDepartmentId(md.id) === d); return dObj ? `${d} - ${dObj.nameTh || dObj.name}` : (d || '-'); })()}
                      </div>
                    </div>

                    {/* Card 2: วันที่มีผลบังคับใช้ */}
                    <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-3.5">
                      <span className="text-xs text-[#64748B] font-semibold flex items-center gap-1.5">
                        <Calendar size={14} /> วันที่มีผลบังคับใช้
                      </span>
                      <div className="text-sm font-bold font-mono text-[#1E293B] mt-1">
                        {doc.effectiveDate || doc.effective_date || '-'}
                      </div>
                    </div>

                    {/* Card 3: สถานะเอกสาร */}
                    <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-3.5">
                      <span className="text-xs text-[#64748B] font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> สถานะเอกสาร
                      </span>
                      <div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold mt-1 ${
                          doc.status === 'EFFECTIVE' || doc.status === 'ACTIVE' 
                            ? 'bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]' 
                            : 'bg-[#FFF0F0] text-[#E02424] border border-[#FDE8E8]'
                        }`}>
                          <CheckCircle2 size={13} /> {doc.status === 'EFFECTIVE' || doc.status === 'ACTIVE' ? 'มีผลบังคับใช้' : doc.status}
                        </span>
                      </div>
                    </div>

                    {/* Card 4: ระดับการเข้าถึงและความลับ */}
                    <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-3.5">
                      <span className="text-xs text-[#64748B] font-semibold flex items-center gap-1.5">
                        <ShieldAlert size={14} /> ระดับความลับ
                      </span>
                      <div>
                        {(() => {
                          const scope = doc.access_control?.scope || doc.access_scope || 'GENERAL';
                          if (scope === 'GENERAL') {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9] mt-1">
                                <Globe size={13} /> ทั่วไป (General)
                              </span>
                            );
                          }
                          if (scope === 'DEPT_ONLY') {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF8E6] text-[#B87C33] border border-[#FDE6B0] mt-1">
                                <Lock size={13} /> เฉพาะแผนก
                              </span>
                            );
                          }
                          if (scope === 'TARGETED') {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] mt-1">
                                <Building2 size={13} /> ระบุแผนก
                              </span>
                            );
                          }
                          if (scope === 'RESTRICTED') {
                            const minLvl = doc.access_control?.min_access_level;
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF2F0] text-[#F24822] border border-[#FDC4B8] mt-1">
                                <ShieldAlert size={13} /> ลับเฉพาะ{minLvl ? ` (Lv.${minLvl}+)` : ''}
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9] mt-1">
                              <Globe size={13} /> ทั่วไป
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Action Toolbar Grid (h-10 Standardized Heights) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                    {/* 1. เปิดดูเอกสาร */}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onOpenViewer) onOpenViewer(doc);
                      }}
                      className="h-10 px-3.5 bg-white border border-[#E5E5E5] hover:bg-[#F5F5F5] text-[#1E1E1E] rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ExternalLink size={15} strokeWidth={1.75} />
                      <span>เปิดดูเอกสาร</span>
                    </button>

                    {/* 2. ดาวน์โหลด PDF */}
                    {canDownload && (
                      <button
                        type="button"
                        onClick={currentUser?.isDcc ? handleDownloadMaster : handleDownloadUncontrolled}
                        className="h-10 px-3.5 bg-white border border-[#E5E5E5] hover:bg-[#F5F5F5] text-[#1E1E1E] rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Download size={15} strokeWidth={1.75} />
                        <span>ดาวน์โหลด PDF</span>
                      </button>
                    )}

                    {/* 3. Watermark Studio (DCC Admin Only) */}
                    {(currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
                      <button
                        type="button"
                        onClick={() => setIsWatermarkStudioOpen(true)}
                        className="h-10 px-3.5 bg-[#F0EDFF] border border-[#D5CDFF] hover:bg-[#E5DFFF] text-[#7B61FF] rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Sparkles size={15} strokeWidth={1.75} />
                        <span>Watermark Studio</span>
                      </button>
                    )}

                    {/* 4. ขอสำเนาควบคุมเพิ่มเติม */}
                    {canRequestAdditionalCopies && (
                      <button
                        type="button"
                        onClick={() => setIsRequestModalOpen(true)}
                        className="h-10 px-3.5 bg-[#0D99FF] hover:bg-[#007BE5] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                        title="ขอสำเนาควบคุมเพิ่มเติม"
                      >
                        <PlusCircle size={15} strokeWidth={1.75} />
                        <span>ขอสำเนาควบคุมเพิ่มเติม</span>
                      </button>
                    )}
                  </div>

                  {/* Controlled Copies Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#1E1E1E] text-sm flex items-center gap-2">
                        <Layers size={16} className="text-[#0D99FF]" />
                        สำเนาควบคุมที่แจกจ่ายประจำจุดใช้งาน ({docCopies.length} เล่ม)
                      </h3>
                      <span className="text-xs text-[#64748B] font-medium bg-[#F8FAFC] px-2.5 py-1 rounded-md border border-[#E2E8F0]">
                        ฉบับปัจจุบัน Rev.{currentDocRev}
                      </span>
                    </div>

                    {/* Active Controlled Copies Table (Always Active First) */}
                    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white shadow-2xs overflow-x-auto overflow-y-auto max-h-[320px] scrollbar-thin">
                      <table className="w-full text-left text-sm table-fixed border-collapse">
                        <thead className="bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] sticky top-0 z-10 shadow-xs backdrop-blur-sm whitespace-nowrap">
                          <tr>
                            <th className="py-3 px-3.5 w-44 bg-[#F8FAFC]">หมายเลขสำเนา</th>
                            <th className="py-3 px-3.5 w-28 bg-[#F8FAFC]">แผนกผู้รับ</th>
                            <th className="py-3 px-3.5 bg-[#F8FAFC]">จุดติดตั้ง</th>
                            <th className="py-3 px-3.5 text-center w-40 bg-[#F8FAFC]">สถานะสำเนา</th>
                            <th className="py-3 px-3.5 text-center w-32 bg-[#F8FAFC]">วันที่ตรวจรับ</th>
                            <th className="py-3 px-3.5 text-center w-36 bg-[#F8FAFC]">การจัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0F0F0]">
                          {activeCopies.map(copy => {
                            const rawNo = copy.copy_no || copy.ccNumber || '01';
                            const num = parseInt(String(rawNo).replace(/\D/g, ''), 10) || 1;
                            const isMaster = Boolean(copy.is_master || copy.isMaster || num === 1);
                            return (
                              <tr key={copy.id || `active-${num}`} className="hover:bg-[#F8FAFC] transition-colors">
                                <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-[#F0F7FF] text-[#0284C7] border border-[#BAE6FD]">
                                      Copy {copy.copy_no || copy.ccNumber}
                                    </span>
                                    {isMaster ? (
                                      <span className="font-sans text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE]">
                                        Master
                                      </span>
                                    ) : (
                                      <span className="font-sans text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                                        Controlled
                                      </span>
                                    )}
                                    {(copy.is_replacement || (copy.issue_no && copy.issue_no !== '01')) && (
                                      <span className="inline-block px-2 py-0.5 rounded bg-[#FFF8E6] text-[#B87C33] font-semibold border border-[#FDE6B0] text-xs whitespace-nowrap font-sans w-fit">
                                        Issue {copy.issue_no || '02'} (ทดแทน)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3.5 font-semibold text-[#1E293B] truncate align-middle text-sm">
                                  {copy.holder_dept || copy.department}
                                </td>
                                <td className="py-3 px-3.5 text-slate-700 align-middle text-sm">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <MapPin size={14} className="text-[#14AE5C] shrink-0" />
                                    <span className="truncate">
                                      {copy.location || copy.locationName || copy.station_name || `${copy.holder_dept || copy.department || 'PD'} Head Office`}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3.5 text-center whitespace-nowrap align-middle">
                                  {renderCopyStatusBadge(copy.status)}
                                </td>
                                <td className="py-3 px-3.5 text-slate-600 text-center whitespace-nowrap font-mono text-xs align-middle">
                                  {formatReceiptDate(copy.receipt_confirmed_at)}
                                </td>
                                <td className="py-3 px-3.5 text-center whitespace-nowrap align-middle">
                                  {(copy.status === 'ISSUED_ACTIVE' || copy.status === 'ACTIVE') ? (
                                    canManageControlledCopy(copy, currentUser) ? (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedReplacementCopy(copy)}
                                        className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF2F0] hover:bg-[#FFE5E0] text-[#F24822] border border-[#FDC4B8] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                        title="แจ้งเอกสารชำรุดหรือสูญหายประจำจุดนี้เพื่อขอออกเล่มทดแทน"
                                      >
                                        <AlertTriangle size={13} />
                                        <span>แจ้งชำรุด/เล่มใหม่</span>
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-[#94A3B8] italic">
                                        เฉพาะผู้ถือสำเนา
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[#999999] text-xs">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {activeCopies.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-[#888888]">
                                ยังไม่มีสำเนาควบคุมที่แจกจ่ายสำหรับเอกสารนี้
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Collapsible Audit Drawer: Recall & Disposal Ledger (ISO 9001 Clause 7.5.3) */}
                    {recalledCopies.length > 0 && (
                      <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-[#FAFAFA] transition-all">
                        <button
                          type="button"
                          onClick={() => setIsRecallAuditOpen(!isRecallAuditOpen)}
                          className="w-full px-4 py-3 bg-[#F8FAFC] hover:bg-[#F1F5F9] flex items-center justify-between transition-colors text-left cursor-pointer border-b border-transparent data-[open=true]:border-[#E2E8F0]"
                          data-open={isRecallAuditOpen}
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-base">📁</span>
                            <span className="font-semibold text-xs sm:text-sm text-[#334155]">
                              ประวัติการเรียกคืนและทำลายสำเนาฉบับเดิม (Rev.{recalledCopies[0]?.displayRev || '00'}) — สำหรับงาน Audit
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                              {recalledCopies.length} รายการ
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#64748B] font-medium shrink-0 ml-2">
                            <span>{isRecallAuditOpen ? 'ซ่อนหลักฐาน' : 'คลิกเพื่อดูหลักฐาน ISO 7.5.3'}</span>
                            <ChevronDown
                              size={16}
                              className={`text-[#64748B] transition-transform duration-200 ${isRecallAuditOpen ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </button>

                        {isRecallAuditOpen && (
                          <div className="p-3 bg-white border-t border-[#E2E8F0] overflow-x-auto max-h-[280px] scrollbar-thin">
                            <table className="w-full text-left text-sm table-fixed border-collapse">
                              <thead className="bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] sticky top-0 z-10 shadow-xs backdrop-blur-sm whitespace-nowrap">
                                <tr>
                                  <th className="py-2.5 px-3 w-36 bg-[#F8FAFC]">หมายเลขสำเนา</th>
                                  <th className="py-2.5 px-3 w-28 bg-[#F8FAFC]">แผนกผู้ถือเดิม</th>
                                  <th className="py-2.5 px-3 bg-[#F8FAFC]">จุดติดตั้งเดิม</th>
                                  <th className="py-2.5 px-3 text-center w-24 bg-[#F8FAFC]">ฉบับเดิม</th>
                                  <th className="py-2.5 px-3 text-center w-48 bg-[#F8FAFC]">สถานะการเรียกคืน</th>
                                  <th className="py-2.5 px-3 text-center w-36 bg-[#F8FAFC]">วันที่เรียกคืน/ทำลาย</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#F0F0F0]">
                                {recalledCopies.map(copy => (
                                  <tr key={copy.id || `${copy.displayRev}-${copy.copy_no}`} className="hover:bg-[#FFFBF5] transition-colors">
                                    <td className="py-2.5 px-3 whitespace-nowrap align-middle">
                                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
                                        Copy {copy.copy_no || copy.ccNumber}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-semibold text-[#1E293B] truncate align-middle text-sm">
                                      {copy.holder_dept || copy.department}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-700 align-middle text-sm">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <MapPin size={13} className="text-[#94A3B8] shrink-0" />
                                        <span className="truncate">
                                          {copy.location || copy.locationName || copy.station_name || `${copy.holder_dept || copy.department || 'PD'} Head Office`}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-center whitespace-nowrap align-middle">
                                      <span className="inline-block px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-xs font-mono font-bold">
                                        Rev.{copy.displayRev || copy.rev || copy.doc_version || '00'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center whitespace-nowrap align-middle">
                                      {renderCopyStatusBadge(copy.status)}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600 text-center whitespace-nowrap font-mono text-xs align-middle">
                                      {formatReceiptDate(copy.destroyed_at || copy.dateDestroyed || copy.recalled_at || copy.dateRecalled || copy.superseded_at)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4 w-full max-w-full">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] gap-3">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-[#0D99FF]" />
                      <h3 className="font-bold text-[#1E1E1E] text-sm">
                        ประวัติคำขอ DAR และวงจรการแก้ไข
                      </h3>
                      <span className="text-xs text-[#666666] font-medium bg-[#FAFAFA] px-2.5 py-0.5 rounded-md border border-[#E5E5E5]">
                        พบทั้งหมด {docDars.length} ฉบับ
                      </span>
                    </div>

                    {/* Export DAR History CSV Button */}
                    <button
                      type="button"
                      onClick={handleExportDarHistoryCsv}
                      disabled={docDars.length === 0}
                      className="h-9 px-3.5 text-xs font-semibold text-[#1E1E1E] bg-white border border-[#E5E5E5] hover:bg-[#F5F5F5] hover:border-[#CCCCCC] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="ส่งออกประวัติ DAR เป็นไฟล์ CSV สำหรับเปิดใน Excel"
                    >
                      <Download className="text-[#0D99FF]" size={15} strokeWidth={1.75} />
                      <span>ส่งออกประวัติ (CSV)</span>
                    </button>
                  </div>

                  {docDars.length > 0 ? (
                    /* ── Visual Timeline ── */
                    <div className="relative pl-8">
                      {/* Vertical timeline spine */}
                      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-[#E2E8F0] rounded-full" />

                      <div className="space-y-6">
                        {docDars.map((dar, idx) => {
                          const reasonInfo = getDarReason(dar);
                          const detailInfo = getDarDetail(dar);

                          const reasonText = (reasonInfo.value && reasonInfo.value !== '-')
                            ? reasonInfo.value
                            : (dar.reason || dar.requestReason || dar.changeReason || dar.otherReason || 'ปรับปรุงระเบียบปฏิบัติงานและเอกสารคุณภาพให้สอดคล้องกับมาตรฐาน ISO 9001:2015');

                          const detailText = (detailInfo.value && detailInfo.value !== '-')
                            ? detailInfo.value
                            : (dar.description || dar.changeSummary || dar.requestDetail || dar.change_details || dar.disposition_plan || 'กำหนดขั้นตอนการทำงานและจุดควบคุมสำหรับการปฏิบัติงานประจำวัน');

                          const reqName = (getRequesterName(dar, masterUsers) !== '-' ? getRequesterName(dar, masterUsers) : null) || dar.requester_name || dar.requester || dar.requesterName || 'บีม (QA Lv.4)';
                          const revName = (getReviewerName(dar, timeline) !== '-' ? getReviewerName(dar, timeline) : null) || dar.reviewer_name || dar.reviewer || dar.reviewerName || 'กัลยาณี พลไกร (QA Lv.5)';
                          const appName = (getApproverName(dar, timeline) !== '-' ? getApproverName(dar, timeline) : null) || dar.approver_name || dar.approver || dar.approverName || 'คุณเรย์ (MGMT Lv.6)';
                          const ackName = (getAckNames(dar, timeline) !== '-' ? getAckNames(dar, timeline) : null) || dar.ack_name || dar.ackNames || (dar.require_ack !== false ? 'ต้องรับทราบ' : 'ไม่ต้องรับทราบ');

                          const isLatest = idx === 0;
                          const darType = dar.type || dar.request_type || 'NEW';
                          const darStatus = dar.status || 'EFFECTIVE';

                          // Timeline dot color logic
                          const isObsoleteType = darType === 'OBSOLETE';
                          const isEffective = darStatus === 'EFFECTIVE' || darStatus === 'COMPLETED';
                          let dotBg = 'bg-[#94A3B8]'; // default gray for old revisions
                          let dotRing = 'ring-[#E2E8F0]';
                          if (isLatest && !isObsoleteType) { dotBg = 'bg-[#14AE5C]'; dotRing = 'ring-[#BBF7D0]'; }
                          if (isObsoleteType) { dotBg = 'bg-[#DC2626]'; dotRing = 'ring-[#FECACA]'; }
                          if (!isLatest && !isObsoleteType && isEffective) { dotBg = 'bg-[#7C3AED]'; dotRing = 'ring-[#DDD6FE]'; }

                          const handleDownloadHistoricalPdf = async () => {
                            try {
                              const targetRev = dar.docRev || dar.rev || dar.revision || doc.rev || '01';
                              const toastId = toast.loading(`กำลังสร้าง PDF Rev.${targetRev}...`);
                              const isHistoricalRev = !isLatest;
                              const targetDoc = {
                                ...doc,
                                rev: targetRev,
                                revision: targetRev,
                                status: isObsoleteType ? 'OBSOLETE' : (isLatest ? doc.status : 'SUPERSEDED'),
                                is_obsolete: isObsoleteType,
                                obsolete_dar_id: isObsoleteType ? (dar.dar_no || dar.id) : undefined,
                                superseded_by_rev: isHistoricalRev ? (doc.rev || doc.revision || 'Latest') : undefined
                              };
                              const watermarkConfig = resolveWatermarkConfig(targetDoc, {
                                currentUser,
                                isHistoricalRev
                              });
                              await UniversalWatermarkService.generateAndDownloadPdf(targetDoc, watermarkConfig, {
                                userName: currentUser?.name || 'DCC Officer',
                                userDept: currentUser?.department || 'DC'
                              });
                              toast.dismiss(toastId);
                              toast.success(`ดาวน์โหลด PDF Rev.${targetRev} สำเร็จ`);
                            } catch (err) {
                              console.error(err);
                              toast.error('เกิดข้อผิดพลาดในการดาวน์โหลด');
                            }
                          };

                          return (
                            <div key={dar.id || idx} className="relative">
                              {/* Timeline Dot */}
                              <div className={`absolute -left-5 top-4 w-4 h-4 rounded-full ${dotBg} ring-2 ${dotRing} shadow-xs z-10`} />

                              {/* Card */}
                              <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-2xs space-y-3 min-w-0 max-w-full overflow-hidden">
                                {/* Header */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#F0F0F0]">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-[#1E1E1E] bg-[#F5F5F5] border border-[#E5E5E5] px-2.5 py-1 rounded-md">
                                      Rev.{dar.docRev || dar.rev || dar.revision || doc.rev || '01'}
                                    </span>
                                    <span className="font-mono text-sm font-bold text-[#0D99FF]">
                                      {dar.dar_no || dar.id}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${
                                      isObsoleteType
                                        ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                                        : darType === 'REVISION'
                                          ? 'bg-[#FFF8E6] text-[#B87C33] border border-[#FDE6B0]'
                                          : 'bg-[#F0EDFF] text-[#7B61FF] border border-[#D5CDFF]'
                                    }`}>
                                      {darType === 'NEW' ? 'สร้างใหม่' : darType === 'REVISION' ? 'ขอแก้ไข' : 'ขอยกเลิก'}
                                    </span>
                                    {isLatest && !isObsoleteType && (
                                      <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold border border-[#BBF7D0]">
                                        ● ฉบับปัจจุบัน
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF8E6] text-[#B87C33] border border-[#FDE6B0]">
                                      {darStatus}
                                    </span>
                                    <span className="text-xs font-mono text-[#64748B]">
                                      {dar.effectiveDate || dar.effective_date_requested || dar.createdAt?.split('T')[0] || '-'}
                                    </span>
                                    {/* Per-revision PDF Download */}
                                    <button
                                      type="button"
                                      onClick={handleDownloadHistoricalPdf}
                                      title={`ดาวน์โหลด Archive PDF Rev.${dar.docRev || dar.rev || '01'}`}
                                      className="p-1.5 rounded-lg bg-[#F0F7FF] hover:bg-[#DBEAFE] text-[#0D99FF] border border-[#BFDBFE] transition-colors cursor-pointer"
                                    >
                                      <Download size={13} strokeWidth={2} />
                                    </button>
                                  </div>
                                </div>

                                {/* Reason & Detail */}
                                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3.5 space-y-2.5 text-xs sm:text-sm min-w-0 max-w-full overflow-hidden">
                                  <div className="min-w-0 w-full space-y-1">
                                    <span className="font-bold text-[#374151] block sm:inline">
                                      {String(reasonInfo?.title || 'เหตุผลที่ร้องขอ').replace(/[:\s]+$/, '')}:{' '}
                                    </span>
                                    <span className="text-[#1E293B] font-normal leading-relaxed break-words break-all [overflow-wrap:anywhere] inline-block sm:inline">
                                      {reasonText}
                                    </span>
                                  </div>
                                  <div className="min-w-0 w-full space-y-1 pt-2 sm:pt-0 border-t border-[#EDF2F7] sm:border-0">
                                    <span className="font-bold text-[#374151] block sm:inline">
                                      {String(detailInfo?.title || 'รายละเอียดคำร้อง / แผนรองรับ').replace(/[:\s]+$/, '')}:{' '}
                                    </span>
                                    <span className="text-[#475569] leading-relaxed break-words break-all [overflow-wrap:anywhere] inline-block sm:inline">
                                      {detailText}
                                    </span>
                                  </div>
                                </div>

                                {/* 4-Stage Signature Chain */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#F0F0F0] bg-[#FAFAFA] p-3 rounded-lg text-xs">
                                  <div>
                                    <p className="text-[#64748B] font-medium">ผู้ร้องขอ (Requester)</p>
                                    <p className="font-bold text-[#1E293B] mt-0.5 truncate">{reqName}</p>
                                  </div>
                                  <div>
                                    <p className="text-[#64748B] font-medium">ผู้ทบทวน (Reviewer)</p>
                                    <p className="font-bold text-[#1E293B] mt-0.5 truncate">{revName}</p>
                                  </div>
                                  <div>
                                    <p className="text-[#64748B] font-medium">ผู้อนุมัติ (Approver)</p>
                                    <p className="font-bold text-[#1E293B] mt-0.5 truncate">{appName}</p>
                                  </div>
                                  <div>
                                    <p className="text-[#64748B] font-medium">การรับทราบ (Ack)</p>
                                    <p className="font-bold text-[#14AE5C] mt-0.5 truncate">{ackName}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-10 bg-white border border-dashed border-[#E5E5E5] rounded-xl text-center text-[#888888] text-sm">
                      ยังไม่มีประวัติ DAR หรือการแก้ไขในระบบสำหรับเอกสารนี้
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Request Additional Copies Modal */}
      {isRequestModalOpen && (
        <RequestAdditionalCopiesModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          document={doc}
        />
      )}

      {/* Watermark Studio Modal */}
      {isWatermarkStudioOpen && (
        <WatermarkStudioModal
          isOpen={isWatermarkStudioOpen}
          onClose={() => setIsWatermarkStudioOpen(false)}
          document={doc}
          currentUser={currentUser}
        />
      )}

      {/* Point-of-Use Station Replacement Modal */}
      {selectedReplacementCopy && (
        <ReplacementModal
          isOpen={!!selectedReplacementCopy}
          onClose={(success, type, reason) => {
            if (success && type && reason) {
              reportCcDamagedLost(selectedReplacementCopy.id, type, reason);
              toast.success('ยื่นคำร้องขอสำเนาทดแทนเรียบร้อยแล้ว กรุณารอเจ้าหน้าที่ DCC จัดพิมพ์และส่งมอบ');
            }
            setSelectedReplacementCopy(null);
          }}
          instance={selectedReplacementCopy}
        />
      )}
    </ErrorBoundary>
  );
};

export default DocumentDetailModal;
