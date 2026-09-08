import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore, { resolveReceiptTaskDepartment } from '../../store/useStore';
import {
  Clock,
  CheckCircle,
  Search,
  ChevronRight,
  FileEdit,
  Eye,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  FilterX,
  Layers,
  CheckSquare,
  Bell,
  ShieldCheck,
  Send,
  Calendar,
  Building2,
  MapPin,
  Zap,
  User,
  ArrowRight,
  FileText,
  Globe
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import ExternalDocActionModal from './ExternalDocActionModal';
import ExternalDocFormModal from '../ExternalDocs/ExternalDocFormModal';
import TaskConfirmHardcopyReceiptModal from '../../components/workflow/TaskConfirmHardcopyReceiptModal';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';
import { isActionableTask, isDccUser, isSameDepartment, isDccAdmin, isDccExclusiveTask, isLevel6Plus, isReceiptTask, userMatchesDepartment } from '../../utils/taskFilter';

// ─────────────────────────────────────────────────────────────────────────────
// Date Formatter (null-safe)
// ─────────────────────────────────────────────────────────────────────────────
const formatThaiDateTime = (dateInput) => {
  if (!dateInput) return null;
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const day = d.getDate();
    const month = thaiMonths[d.getMonth()];
    const year = d.getFullYear();
    const dateStr = String(dateInput);
    const hasTime = dateStr.includes('T') || dateStr.match(/\d{2}:\d{2}/);
    if (hasTime) {
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day} ${month} ${year}, ${hours}:${minutes} น.`;
    }
    return `${day} ${month} ${year}`;
  } catch {
    return String(dateInput);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper 1: Extract official document code — returns null if none found
// NEVER returns raw task.id / UUIDs / timestamps
// ─────────────────────────────────────────────────────────────────────────────
const getDocumentIdentifier = (task) => {
  // 1. Explicit code fields
  const explicit =
    task.docCode ||
    task.doc_code ||
    task.doc_number ||
    task.docNumber ||
    task.darNumber ||
    task.document_code ||
    task.edCode;
  if (explicit) return String(explicit).trim();

  // 2. Extract standard doc code pattern from title (e.g. SOP-PD-01, WI-WH-002)
  const titleMatch = String(task.title || '').match(
    /\b([A-Z]{1,5}-[A-Z]{1,5}-\d{2,4}(?:-\d{1,3})?)\b/
  );
  if (titleMatch) return titleMatch[1];

  // 3. darId that looks like a formal number (DAR-YYYY-XXX)
  if (task.darId && /^DAR-\d{4}-\d+/.test(task.darId)) return task.darId;

  // 4. Nothing — caller decides to hide the chip
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper 2: Extract/clean the real document title with Multi-Source Fallback Resolver
// ─────────────────────────────────────────────────────────────────────────────
const TITLE_PREFIX_PATTERNS = [
  /^\[.*?\]\s*/,                                            // [Any bracket prefix]
  /^ตรวจรับเอกสารควบคุมฉบับพิมพ์:\s*/,
  /^แจกจ่ายเอกสาร Controlled Copy \(NEW\):\s*/,
  /^แจกจ่ายสำเนาควบคุม:\s*/,
  /^จัดพิมพ์และส่งมอบสำเนาควบคุมเอกสาร(?:ภายนอก)?:\s*/,
  /^เรียกคืนและทำลายเอกสาร(?:ภายนอก)?(?:ที่ถูกยกเลิก)?:\s*/,
  /^เรียกคืนสำเนาเอกสาร(?:ที่ถูก)?ยกเลิก:\s*/,
  /^เรียกคืนสำเนาตกรุ่น:\s*/,
  /^เรียกคืนสำเนาชำรุด:\s*/,
  /^ออกสำเนาควบคุมทดแทน\s*\(.*?\):\s*/,
  /^ขอออกสำเนาควบคุมเพิ่มเติม:\s*/,
  /^ส่งคืนสำเนาควบคุม:\s*/,
];

const stripTitlePrefixes = (raw) => {
  if (!raw) return '';
  let result = raw.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of TITLE_PREFIX_PATTERNS) {
      const next = result.replace(pattern, '');
      if (next !== result) { result = next.trim(); changed = true; }
    }
  }
  return result;
};

const getDocumentTitle = (task, storeContext = {}) => {
  if (!task) return '';
  const { documents = [], externalDocuments = [], dars = [], controlledCopyInstances = [] } = storeContext;

  const docCode = getDocumentIdentifier(task);

  // 1. Explicit name fields on task if present and distinct from the code
  const explicit =
    task.docName ||
    task.doc_name ||
    task.documentName ||
    task.document_name ||
    task.doc_title;
  if (explicit && explicit !== docCode && !explicit.startsWith('Copy ')) {
    return explicit;
  }

  // 2. Query documents store by id or code
  const docId = task.docId || task.doc_id;
  if (docId || docCode) {
    const matchedDoc = (documents || []).find(d => 
      (docId && String(d.id) === String(docId)) ||
      (docCode && (d.title === docCode || d.document_code === docCode || d.code === docCode || d.doc_number === docCode))
    );
    if (matchedDoc && (matchedDoc.name || matchedDoc.document_name || matchedDoc.docName)) {
      return matchedDoc.name || matchedDoc.document_name || matchedDoc.docName;
    }
  }

  // 3. Query externalDocuments store
  const extId = task.externalDocId || task.referenceId || docId;
  if (extId || docCode) {
    const matchedExt = (externalDocuments || []).find(d => 
      (extId && String(d.id) === String(extId)) ||
      (docCode && (d.edCode === docCode || d.doc_code === docCode || d.docNo === docCode))
    );
    if (matchedExt && (matchedExt.title || matchedExt.name || matchedExt.documentName)) {
      return matchedExt.title || matchedExt.name || matchedExt.documentName;
    }
  }

  // 4. Query dars store
  const darId = task.darId || (task.referenceType === 'INTERNAL_DAR' ? task.referenceId : null);
  if (darId) {
    const matchedDar = (dars || []).find(d => String(d.id) === String(darId) || d.darNo === darId || d.dar_no === darId);
    if (matchedDar && (matchedDar.name || matchedDar.document_name || matchedDar.docName)) {
      return matchedDar.name || matchedDar.document_name || matchedDar.docName;
    }
  }

  // 5. Query controlledCopyInstances store
  const copyId = task.copyId || task.copy_id || task.instanceId;
  if (copyId) {
    const matchedCopy = (controlledCopyInstances || []).find(c => String(c.id) === String(copyId));
    if (matchedCopy && (matchedCopy.docName || matchedCopy.name || matchedCopy.documentName)) {
      return matchedCopy.docName || matchedCopy.name || matchedCopy.documentName;
    }
  }

  // 6. Check task.docTitle if distinct from docCode
  if (task.docTitle && task.docTitle !== docCode && !task.docTitle.startsWith('Copy ')) {
    return task.docTitle;
  }

  // 7. Extract cleaned title from task.title
  const stripped = stripTitlePrefixes(task.title || '');
  if (stripped) {
    return stripped;
  }

  // 8. Safe fallback — never return empty or undefined
  return task.title || docCode || 'เอกสารควบคุม';
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper 2.5: Extract Revision chip label
// ─────────────────────────────────────────────────────────────────────────────
const getRevisionChip = (task) => {
  const raw = task.doc_version || task.revision || task.rev || task.targetRevision;
  if (!raw || raw === 'ALL') return null;
  const clean = String(raw).trim();
  if (clean.toLowerCase().startsWith('rev')) return clean;
  return `Rev.${clean}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper 3: Extract copy number chip label
// ─────────────────────────────────────────────────────────────────────────────
const getCopyChip = (task) => {
  const raw =
    task.copy_no ||
    task.copyNo ||
    task.copyNumber ||
    task.copy_number;
  if (raw) return `Copy ${String(raw).padStart(2, '0')}`;

  // Try to pull "Copy 03" from title
  const m = String(task.title || '').match(/\bCopy\s+(\d+)\b/i);
  if (m) return `Copy ${m[1].padStart(2, '0')}`;

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Resolve effective task department strictly bound to document / DAR owner
// For RECEIPT tasks, strictly binds to recipient department (e.g. EN Office -> EN)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveTaskDepartment = (task, storeContext) => {
  if (!task) return '';

  if (isReceiptTask(task)) {
    const safeCopies = storeContext?.controlledCopyInstances || storeContext?.documentControlledCopies || [];
    const targetCopyId = String(task.copy_id || task.copyId || task.instanceId || '');
    const matchedCopy = safeCopies.find(c => String(c.id) === targetCopyId);
    return resolveReceiptTaskDepartment(task, matchedCopy);
  }

  const safeDars = storeContext?.dars || [];
  const safeDocs = storeContext?.documents || [];
  const safeExtDocs = storeContext?.externalDocuments || [];

  const matchedDar = safeDars.find(d => String(d.id) === String(task.darId));
  const docCode = task.doc_code || task.docCode || task.document_code || task.title || '';
  const docId = task.docId || task.doc_id;
  const extId = task.externalDocId || task.referenceId || docId;

  const matchedDoc = safeDocs.find(d => 
    (docId && String(d.id) === String(docId)) ||
    (docCode && (d.title === docCode || d.document_code === docCode || d.code === docCode))
  );

  const matchedExtDoc = safeExtDocs.find(d => 
    (extId && String(d.id) === String(extId)) ||
    (docCode && (d.title === docCode || d.edCode === docCode || d.doc_code === docCode || d.docNo === docCode))
  );

  let dept = matchedDar?.department || matchedDoc?.department || matchedExtDoc?.department;
  if (!dept) {
    if (task.department && task.department !== 'DCC') {
      dept = task.department;
    } else if (task.dept && task.dept !== 'DCC') {
      dept = task.dept;
    } else {
      dept = task.target_department || task.targetDepartment || task.destinationDept || task.assignedToDept || task.holder_dept || '';
    }

    if (!dept) {
      // Dynamic pattern extraction from document/DAR code e.g. "SOP-QA-001", "DAR-PD-2026", "FM-QC-002"
      const codeStr = String(docCode || task.darId || task.title || '');
      const match = codeStr.match(/(?:^|[A-Za-z]+-)([A-Za-z0-9]{2,10})-(?:\d|[A-Za-z0-9]+)/);
      if (match && match[1]) {
        dept = match[1].toUpperCase();
      }
    }
  }
  return dept === 'DCC' ? 'DC' : dept;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Resolve Document Origin (INTERNAL vs EXTERNAL)
// ─────────────────────────────────────────────────────────────────────────────
export const getTaskOrigin = (task) => {
  if (!task) return 'INTERNAL';
  if (task.origin === 'EXTERNAL') return 'EXTERNAL';
  if (task.origin === 'INTERNAL') return 'INTERNAL';
  if (
    task.referenceType === 'EXTERNAL_DOC' ||
    (task.type && String(task.type).startsWith('EXT_')) ||
    (task.taskType && String(task.taskType).startsWith('EXT_')) ||
    task.extAction ||
    task.is_external ||
    task.isExternal ||
    String(task.doc_code || task.docCode || '').startsWith('ED-') ||
    (task.title && (task.title.includes('เอกสารภายนอก') || task.title.includes('External Doc')))
  ) {
    return 'EXTERNAL';
  }
  return 'INTERNAL';
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Visual Revision Transition (e.g. Rev.00 ➔ 01)
// ─────────────────────────────────────────────────────────────────────────────
export const getRevisionTransition = (task, matchedDar, matchedDoc) => {
  if (!task) return null;

  // 1. Identify source (previous) and target (new) revisions with robust fallbacks
  const prevRev = 
    task.sourceRevision ||
    task.source_revision ||
    matchedDar?.sourceRevision ||
    matchedDar?.source_revision ||
    matchedDar?.revisesRev || 
    matchedDar?.previousRev || 
    (matchedDar?.type === 'REVISION' ? (matchedDoc?.rev || '00') : null);

  const newRev = 
    task.targetRevision ||
    task.target_revision ||
    task.doc_version || 
    task.revision || 
    task.rev ||
    matchedDar?.targetRevision ||
    matchedDar?.target_revision ||
    matchedDar?.rev || 
    matchedDar?.targetRev || 
    matchedDar?.proposedRev || 
    matchedDoc?.rev;

  const cleanPrev = prevRev && prevRev !== 'ALL' ? String(prevRev).replace(/^rev\.?/i, '').trim() : null;
  const cleanNew = newRev && newRev !== 'ALL' ? String(newRev).replace(/^rev\.?/i, '').trim() : null;

  const normType = (task.type || task.taskType || task.task_type || '').toUpperCase();

  // 2. Action-Specific Revision Scoping (ISO 9001 Clause 7.5.3)

  // 2.1 งานเรียกคืนสำเนา (RECALL / DCC_RECALL / OBSOLETE_RECALL)
  // บริบท: เจ้าหน้าที่ DCC ต้องไปตามเก็บ "ฉบับเดิมที่ตกรุ่น" เท่านั้น
  const isRecall = 
    normType === 'RECALL' || 
    normType === 'DCC_RECALL' || 
    normType === 'DCC_RECALL_WITH_CHECKLIST' ||
    normType === 'RECALL_HARDCOPY' ||
    normType === 'OBSOLETE_RECALL' ||
    task.category === 'RECALL';

  if (isRecall) {
    // ฉบับเดิมที่สิ้นสภาพ / ถูกเรียกคืน (ถ้าเป็นเอกสารยกเลิก ALL หรือหา cleanPrev ให้ใช้ prevRev หรือ targetRevision)
    const effectiveOldRev = cleanPrev || (cleanNew && cleanNew !== 'ALL' ? cleanNew : null);
    const displayRev = effectiveOldRev ? `Rev.${effectiveOldRev.padStart(2, '0')}` : (task.targetRevision === 'ALL' || task.doc_version === 'ALL' ? 'ทุกฉบับ' : 'ฉบับเดิม');
    return {
      type: 'RECALL',
      rev: effectiveOldRev ? effectiveOldRev.padStart(2, '0') : null,
      label: `${displayRev} (ฉบับเดิม/เรียกคืน)`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300/40 font-semibold'
    };
  }

  // 2.2 งานแจกจ่ายสำเนา (DISTRIBUTION / DCC_DISTRIBUTE / ISSUE)
  // บริบท: นำ "ฉบับใหม่ที่บังคับใช้" ไปแจกจ่าย
  const isDistribute = 
    normType === 'DISTRIBUTION' || 
    normType === 'DCC_DISTRIBUTE' || 
    normType === 'DCC_ISSUE' || 
    normType === 'ISSUE' || 
    normType === 'DISTRIBUTE' ||
    task.category === 'DISTRIBUTION';

  if (isDistribute) {
    const effectiveNewRev = cleanNew || (matchedDoc?.rev ? String(matchedDoc.rev).replace(/^rev\.?/i, '').trim() : '00');
    const displayRev = effectiveNewRev ? `Rev.${effectiveNewRev.padStart(2, '0')}` : 'Rev.01';
    return {
      type: 'DISTRIBUTION',
      rev: effectiveNewRev ? effectiveNewRev.padStart(2, '0') : '01',
      label: `${displayRev} (ฉบับใหม่)`,
      badgeClass: 'bg-sky-50 text-sky-800 border-sky-300 ring-1 ring-sky-300/40 font-semibold'
    };
  }

  // 2.3 งานรับทราบเอกสาร (ACKNOWLEDGE / ACK)
  // บริบท: ผู้ถือครองรับทราบฉบับใหม่ที่มีผลบังคับใช้
  const isAck = 
    normType === 'ACK' || 
    normType === 'ACKNOWLEDGE' || 
    normType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
    normType === 'CONFIRM_RECEIPT' ||
    normType === 'RECEIPT';

  if (isAck) {
    const effectiveNewRev = cleanNew || (matchedDoc?.rev ? String(matchedDoc.rev).replace(/^rev\.?/i, '').trim() : '00');
    const displayRev = effectiveNewRev ? `Rev.${effectiveNewRev.padStart(2, '0')}` : 'Rev.01';
    return {
      type: 'ACKNOWLEDGE',
      rev: effectiveNewRev ? effectiveNewRev.padStart(2, '0') : '01',
      label: `${displayRev} (ฉบับใหม่)`,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300/40 font-semibold'
    };
  }

  // 2.4 งานทบทวนและอนุมัติคำร้อง (REVIEW / APPROVE / DAR_REVIEW / DAR_APPROVE)
  // บริบท: พิจารณาการเปลี่ยนผ่าน จึงแสดง Transition: Rev.00 ➔ 01
  if (cleanPrev && cleanNew && cleanPrev !== cleanNew) {
    return {
      type: 'TRANSITION',
      prev: cleanPrev.padStart(2, '0'),
      next: cleanNew.padStart(2, '0'),
      label: `Rev.${cleanPrev.padStart(2, '0')} ➔ ${cleanNew.padStart(2, '0')}`,
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold'
    };
  }

  // 2.5 Fallback ทั่วไป (Single Rev)
  if (cleanNew && cleanNew !== 'ALL') {
    return {
      type: 'SINGLE',
      rev: cleanNew.padStart(2, '0'),
      label: `Rev.${cleanNew.padStart(2, '0')}`,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
    };
  }
  if (cleanPrev && cleanPrev !== 'ALL') {
    return {
      type: 'SINGLE',
      rev: cleanPrev.padStart(2, '0'),
      label: `Rev.${cleanPrev.padStart(2, '0')}`,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
    };
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Format Department Badge (e.g. 🏢 PD - ฝ่ายผลิต)
// ─────────────────────────────────────────────────────────────────────────────
export const formatDepartmentBadge = (deptCode, masterDepartments) => {
  if (!deptCode) return '';
  const clean = deptCode === 'DCC' ? 'DC' : deptCode;
  const deptObj = (masterDepartments || []).find(d => isSameDepartment(d.id, clean));
  if (deptObj) {
    const rawTh = deptObj.nameTh || deptObj.name || '';
    const thaiName = rawTh.replace(/^.*?\((.*?)\)/, '$1').replace(new RegExp(`^${clean}\\s*[-:]*\\s*`, 'i'), '').trim();
    return `🏢 ${clean} - ${thaiName || deptObj.name || clean}`;
  }
  return `🏢 ${clean}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Resolve Requester Full Name
// ─────────────────────────────────────────────────────────────────────────────
export const resolveRequesterName = (task, matchedDar, matchedDoc, masterUsers) => {
  if (matchedDar?.requesterName) return matchedDar.requesterName;
  if (task?.requesterName) return task.requesterName;
  if (task?.metadata?.requesterName) return task.metadata.requesterName;
  const reqId = matchedDar?.requesterId || task?.requesterId;
  if (reqId) {
    const u = (masterUsers || []).find(user => user.id === reqId || user.empId === reqId);
    if (u) return u.fullName || u.name;
  }
  if (matchedDoc?.ownerName) return matchedDoc.ownerName;
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Resolve Reason Snippet
// ─────────────────────────────────────────────────────────────────────────────
export const resolveReasonSnippet = (task, matchedDar) => {
  const reason = matchedDar?.reason || matchedDar?.changeReason || task?.reason || task?.description || task?.metadata?.reason || '';
  return reason ? reason.trim() : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Resolve Monospace DAR ID
// ─────────────────────────────────────────────────────────────────────────────
export const resolveDarIdentifier = (task, matchedDar) => {
  if (matchedDar?.darNo) return matchedDar.darNo;
  if (matchedDar?.darNumber) return matchedDar.darNumber;
  if (task?.darNo) return task.darNo;
  if (task?.darId && String(task.darId).startsWith('DAR-')) return task.darId;
  if (task?.referenceType === 'INTERNAL_DAR' && task.referenceId && String(task.referenceId).startsWith('DAR-')) return task.referenceId;
  if (task?.metadata?.darNo) return task.metadata.darNo;
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Task Type Badge & Action Configuration
// ─────────────────────────────────────────────────────────────────────────────
export const getTaskTypeBadgeConfig = (normType, task) => {
  if (normType === 'REVIEW' || normType === 'EXT_REVIEW' || normType === 'EXTERNAL_REVIEW') {
    return {
      label: 'ทบทวนคำร้อง (Review)',
      actionLabel: 'พิจารณาตรวจทาน',
      icon: <Eye size={13} className="text-indigo-600" />,
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    };
  }
  if (normType === 'APPROVE' || normType === 'APPROVAL' || normType === 'EXT_APPROVAL' || normType === 'EXTERNAL_APPROVAL' || normType === 'CC_REPLACEMENT_APPROVAL') {
    return {
      label: 'อนุมัติคำร้อง (Approve)',
      actionLabel: 'พิจารณาอนุมัติ',
      icon: <ShieldCheck size={13} className="text-emerald-600" />,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    };
  }
  if (normType === 'ACK' || normType === 'ACKNOWLEDGE') {
    return {
      label: 'รับทราบเอกสาร (Acknowledge)',
      actionLabel: 'รับทราบเอกสาร',
      icon: <Bell size={13} className="text-sky-600" />,
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200'
    };
  }
  if (normType === 'EXTERNAL_REVISE') {
    return {
      label: 'แก้ไขคำร้องเอกสารภายนอก (Revise)',
      actionLabel: 'แก้ไขและส่งคำร้องอีกครั้ง',
      icon: <FileEdit size={13} className="text-rose-600" />,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
    };
  }
  if (normType === 'REVISE') {
    return {
      label: 'ส่งกลับแก้ไข (Revise)',
      actionLabel: 'แก้ไขคำร้อง',
      icon: <FileEdit size={13} className="text-rose-600" />,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
    };
  }
  if (
    normType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
    normType === 'CONFIRM_RECEIPT' ||
    normType === 'RECEIPT' ||
    task?.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
    task?.category === 'RECEIPT'
  ) {
    return {
      label: 'ตรวจรับสำเนา (Receipt)',
      actionLabel: 'ตรวจรับสำเนา',
      icon: <Layers size={13} className="text-violet-600" />,
      badgeClass: 'bg-violet-50 text-violet-700 border-violet-200'
    };
  }
  if (normType === 'DCC_DISTRIBUTE' || normType === 'DCC_ISSUE') {
    if (task?.delivery_status === 'DISPATCHED_TRACKING' || task?.status === 'COMPLETED') {
      return {
        label: 'ติดตามการส่งมอบ (Tracking)',
        actionLabel: 'ติดตามการส่งมอบ',
        icon: <Clock size={13} className="text-amber-600" />,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    }
    return {
      label: 'แจกจ่ายสำเนา (Distribute)',
      actionLabel: 'ดำเนินการแจกจ่าย',
      icon: <Send size={13} className="text-sky-600" />,
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200'
    };
  }
  if (
    normType === 'DCC_RECALL' ||
    normType === 'DCC_RECALL_WITH_CHECKLIST' ||
    normType === 'RECALL_HARDCOPY' ||
    normType === 'RECALL' ||
    normType === 'OBSOLETE_RECALL' ||
    task?.taskType === 'RECALL' ||
    task?.taskType === 'DCC_RECALL_WITH_CHECKLIST'
  ) {
    const isDamaged = task?.isDamaged || task?.reason === 'DAMAGED' || task?.title?.includes('ชำรุด') || task?.description?.includes('ชำรุด');
    if (isDamaged) {
      return {
        label: 'เรียกคืนชำรุด (Damaged Recall)',
        actionLabel: 'ดำเนินการเรียกคืน',
        icon: <AlertTriangle size={13} className="text-rose-600" />,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    }
    return {
      label: 'เรียกคืนสำเนา (Recall)',
      actionLabel: 'ดำเนินการเรียกคืน',
      icon: <AlertTriangle size={13} className="text-orange-600" />,
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-200'
    };
  }
  return {
    label: 'งานในระบบ (Task)',
    actionLabel: 'จัดการงาน',
    icon: <CheckSquare size={13} className="text-slate-600" />,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper 4: Short Thai task type label
// ─────────────────────────────────────────────────────────────────────────────
const getTaskTypeShortLabel = (normType, task) => {
  if (normType === 'REVIEW' || normType === 'EXT_REVIEW') return 'ทบทวนเอกสาร';
  if (normType === 'APPROVE' || normType === 'APPROVAL' || normType === 'EXT_APPROVAL') return 'อนุมัติคำร้อง';
  if (normType === 'CC_REPLACEMENT_APPROVAL') return 'อนุมัติสำเนาทดแทน';
  if (normType === 'ACK' || normType === 'ACKNOWLEDGE') return 'รับทราบเอกสาร';
  if (normType === 'REVISE') return 'แก้ไขคำร้อง';
  if (
    normType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
    normType === 'CONFIRM_RECEIPT' ||
    normType === 'RECEIPT'
  ) return 'ตรวจรับสำเนา';
  if (normType === 'DCC_DISTRIBUTE' || normType === 'DCC_ISSUE') {
    if (task?.delivery_status === 'DISPATCHED_TRACKING' || task?.status === 'COMPLETED') {
      return 'ติดตามการส่งมอบ';
    }
    return 'แจกจ่ายสำเนา';
  }
  if (
    normType === 'DCC_RECALL' ||
    normType === 'DCC_RECALL_WITH_CHECKLIST' ||
    normType === 'RECALL_HARDCOPY' ||
    normType === 'RECALL' ||
    normType === 'OBSOLETE_RECALL'
  ) {
    if (task?.isDamaged || task?.reason === 'DAMAGED' || task?.title?.includes('ชำรุด') || task?.description?.includes('ชำรุด')) {
      return 'เรียกคืน (ชำรุด)';
    }
    return 'เรียกคืนสำเนา';
  }
  if (normType.startsWith('DCC_')) return 'งานฝ่ายควบคุมเอกสาร (DC)';
  return 'งาน';
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper 5: Icon + color config per task type
// ─────────────────────────────────────────────────────────────────────────────
const getTaskIconConfig = (task) => {
  const normType = (task.type || task.taskType || '').toUpperCase();

  if (normType === 'REVIEW' || normType === 'EXT_REVIEW') {
    return {
      icon: <Eye size={17} strokeWidth={2} />,
      iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
      chipClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    };
  }
  if (normType === 'APPROVE' || normType === 'APPROVAL' || normType === 'EXT_APPROVAL' || normType === 'CC_REPLACEMENT_APPROVAL') {
    return {
      icon: <ShieldCheck size={17} strokeWidth={2} />,
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      chipClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    };
  }
  if (normType === 'ACK' || normType === 'ACKNOWLEDGE') {
    return {
      icon: <Bell size={17} strokeWidth={2} />,
      iconBg: 'bg-sky-50 text-sky-600 border border-sky-100',
      chipClass: 'bg-sky-50 text-sky-700 border border-sky-200',
    };
  }
  if (normType === 'REVISE') {
    return {
      icon: <FileEdit size={17} strokeWidth={2} />,
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
      chipClass: 'bg-rose-50 text-rose-700 border border-rose-200',
    };
  }
  if (
    normType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
    task.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
    normType === 'CONFIRM_RECEIPT' ||
    normType === 'RECEIPT'
  ) {
    return {
      icon: <Layers size={17} strokeWidth={2} />,
      iconBg: 'bg-violet-50 text-violet-600 border border-violet-100',
      chipClass: 'bg-violet-50 text-violet-700 border border-violet-200',
    };
  }
  if (normType === 'DCC_DISTRIBUTE' || normType === 'DCC_ISSUE') {
    if (task.delivery_status === 'DISPATCHED_TRACKING' || task.status === 'COMPLETED') {
      return {
        icon: <Clock size={17} strokeWidth={2} />,
        iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
        chipClass: 'bg-amber-50 text-amber-700 border border-amber-200',
      };
    }
    return {
      icon: <Send size={17} strokeWidth={2} />,
      iconBg: 'bg-sky-50 text-sky-600 border border-sky-100',
      chipClass: 'bg-sky-50 text-sky-700 border border-sky-200',
    };
  }
  if (
    normType === 'DCC_RECALL' ||
    normType === 'DCC_RECALL_WITH_CHECKLIST' ||
    normType === 'RECALL_HARDCOPY' ||
    normType === 'RECALL' ||
    normType === 'OBSOLETE_RECALL' ||
    task.taskType === 'RECALL' ||
    task.taskType === 'DCC_RECALL_WITH_CHECKLIST'
  ) {
    const isDamaged = task.isDamaged || task.reason === 'DAMAGED' || task.title?.includes('ชำรุด') || task.description?.includes('ชำรุด');
    if (isDamaged) {
      return {
        icon: <AlertTriangle size={17} strokeWidth={2} />,
        iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
        chipClass: 'bg-rose-50 text-rose-700 border border-rose-200',
      };
    }
    return {
      icon: <AlertTriangle size={17} strokeWidth={2} />,
      iconBg: 'bg-orange-50 text-orange-600 border border-orange-100',
      chipClass: 'bg-orange-50 text-orange-700 border border-orange-200',
    };
  }
  if (normType.startsWith('DCC_')) {
    return {
      icon: <AlertCircle size={17} strokeWidth={2} />,
      iconBg: 'bg-sky-50 text-sky-600 border border-sky-100',
      chipClass: 'bg-sky-50 text-sky-700 border border-sky-200',
    };
  }
  return {
    icon: <CheckSquare size={17} strokeWidth={2} />,
    iconBg: 'bg-slate-100 text-slate-500 border border-slate-200',
    chipClass: 'bg-slate-100 text-slate-600 border border-slate-200',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper 6: SLA / Priority badge
// ─────────────────────────────────────────────────────────────────────────────
const getSLABadge = (task, mockDateOffset) => {
  // Damaged recall — highest priority visual
  if (task.isDamaged || task.reason === 'DAMAGED' || task.title?.includes('ชำรุด') || task.description?.includes('ชำรุด')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertTriangle size={10} /> เล่มชำรุด
      </span>
    );
  }

  // Delivery tracking
  if (task.delivery_status === 'DISPATCHED_TRACKING' || task.tracking_status === 'WAITING_RECEIPT') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={10} /> รอปลายทางรับ
      </span>
    );
  }

  if (!task.dueDate) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
        <CheckCircle size={10} /> ปกติ
      </span>
    );
  }

  const today = new Date();
  today.setDate(today.getDate() + (mockDateOffset || 0));
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  const isUrgent = task.isUrgent || task.priority === 'URGENT' || task.slaType === 'FAST_TRACK';

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle size={10} /> เกินกำหนด {Math.abs(diffDays)} วัน
      </span>
    );
  }
  if (diffDays === 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${isUrgent ? 'bg-amber-100 text-amber-900 border-amber-400 animate-pulse' : 'bg-amber-50 text-amber-800 border-amber-300'}`}>
        <Clock size={10} /> ครบกำหนดวันนี้{isUrgent ? ' ⚡' : ''}
      </span>
    );
  }
  if (diffDays <= 2) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${isUrgent ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
        <Clock size={10} /> {isUrgent ? '⚡ งานด่วน' : 'ใกล้ครบกำหนด'} (อีก {diffDays} วัน)
      </span>
    );
  }
  if (isUrgent) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        <Zap size={10} className="fill-amber-500" /> งานด่วน (อีก {diffDays} วัน)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
      <CheckCircle size={10} /> ปกติ
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper 7: Normalize Task Category for Filtering and Tabs (Pure Utility Function)
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeTaskCategory(task) {
  if (!task) return '';
  const rawType = (task.type || task.taskType || task.task_type || task.category || '').toUpperCase();
  if (rawType === 'REVIEW' || rawType === 'EXT_REVIEW' || rawType === 'EXTERNAL_REVIEW') return 'REVIEW';
  if (rawType === 'APPROVE' || rawType === 'APPROVAL' || rawType === 'EXT_APPROVAL' || rawType === 'EXTERNAL_APPROVAL' || rawType === 'CC_REPLACEMENT_APPROVAL') return 'APPROVE';
  if (rawType === 'ACK' || rawType === 'ACKNOWLEDGE') return 'ACK';
  if (rawType === 'REVISE' || rawType === 'EXTERNAL_REVISE' || rawType === 'EXT_REVISE') return 'REVISE';
  if (
    rawType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
    task.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
    rawType === 'CONFIRM_RECEIPT' ||
    rawType === 'RECEIPT' ||
    task.category === 'RECEIPT' ||
    task.id?.includes('doc-') ||
    task.id?.includes('task-receipt-') ||
    task.title?.includes('ตรวจรับเล่ม') ||
    task.title?.includes('ตรวจรับเอกสาร')
  ) return 'RECEIPT';
  if (rawType === 'DCC_DISTRIBUTE' || rawType === 'DCC_ISSUE') return 'DCC_DISTRIBUTE';
  if (rawType === 'DCC_RECALL' || rawType === 'DCC_RECALL_WITH_CHECKLIST' || rawType === 'RECALL' || rawType === 'RECALL_HARDCOPY' || rawType === 'OBSOLETE_RECALL' || task.taskType === 'RECALL' || task.taskType === 'DCC_RECALL_WITH_CHECKLIST') return 'DCC_RECALL';
  if (rawType.startsWith('DCC_')) return 'DCC_ACTION';
  return rawType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Inbox Component
// ─────────────────────────────────────────────────────────────────────────────
const TaskInbox = () => {
  const navigate = useNavigate();
  const { currentUser, tasks, dars, documents, externalDocuments, externalRequests, controlledCopyInstances, documentControlledCopies, mockDateOffset, checkSLA, masterDepartments, masterUsers } = useStore();
  const [activeTab, setActiveTab] = useState('ALL');
  const [originFilter, setOriginFilter] = useState('ALL'); // 'ALL' | 'INTERNAL' | 'EXTERNAL'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExtTask, setSelectedExtTask] = useState(null);
  const [selectedReceiptTask, setSelectedReceiptTask] = useState(null);
  const [editingExternalDoc, setEditingExternalDoc] = useState(null);
  const [resubmitTaskId, setResubmitTaskId] = useState(null);
  const [isExternalDocModalOpen, setIsExternalDocModalOpen] = useState(false);

  useEffect(() => {
    if (checkSLA) checkSLA();
  }, [mockDateOffset, checkSLA]);

  const storeContext = useMemo(() => ({
    documents: documents || [],
    externalDocuments: externalDocuments || [],
    dars: dars || [],
    controlledCopyInstances: controlledCopyInstances || documentControlledCopies || []
  }), [documents, externalDocuments, dars, controlledCopyInstances, documentControlledCopies]);

  const dccAdmin = isDccAdmin(currentUser);

  const isLevel6Executive = useMemo(() => isLevel6Plus(currentUser), [currentUser]);

  // Auto-reset active tab if non-DCC Admin user had previously selected DCC exclusive tabs
  // or if Level 6+ executive user had selected RECEIPT tab
  useEffect(() => {
    if (!dccAdmin && (activeTab === 'DCC_DISTRIBUTE' || activeTab === 'DCC_RECALL')) {
      setActiveTab('ALL');
    }
    if (isLevel6Executive && activeTab === 'RECEIPT') {
      setActiveTab('ALL');
    }
  }, [dccAdmin, isLevel6Executive, activeTab]);

  const userDepts = useMemo(() => {
    const raw = currentUser?.affiliated_departments || currentUser?.depts || (currentUser?.primary_department ? [currentUser.primary_department] : (currentUser?.department ? [currentUser.department] : []));
    return Array.from(new Set(raw.map(d => (d === 'DCC' ? 'DC' : d)).filter(Boolean)));
  }, [currentUser]);

  const primaryDept = useMemo(() => {
    const raw = currentUser?.primary_department || currentUser?.department || '';
    return raw === 'DCC' ? 'DC' : raw;
  }, [currentUser]);

  const [deptFilter, setDeptFilter] = useState('ALL');

  useEffect(() => {
    setDeptFilter('ALL');
  }, [currentUser?.id]);

  const resolveTaskDept = useCallback((task) => {
    if (!task) return '';
    const isReceipt = isReceiptTask(task) || normalizeTaskCategory(task) === 'RECEIPT';
    if (isReceipt) {
      return resolveReceiptTaskDepartment(task, null) || resolveTaskDepartment(task, storeContext) || task.target_department || task.targetDepartment || task.destinationDept || task.destination_dept || task.department || '';
    }
    return resolveTaskDepartment(task, storeContext) || task.department || task.dept || task.target_department || task.targetDepartment || task.destinationDept || '';
  }, [storeContext]);

  const isTaskMatchingDept = useCallback((task, targetDept) => {
    if (!targetDept || targetDept === 'ALL') {
      return true;
    }
    const tDept = resolveTaskDept(task);
    return isSameDepartment(tDept, targetDept);
  }, [resolveTaskDept]);

  // Master Task Filtering: Distribution & Recall tasks are strictly exclusive to DCC Admin.
  // Receipt tasks are strictly hidden for Level 6+ executives and pooled for all Level < 6 department members.
  // Strict Department Isolation: Non-DCC users see ONLY tasks matching their department or directly assigned to them.
  const userTasks = useMemo(() => {
    return (tasks || [])
      .filter(t => isActionableTask(t, currentUser))
      .filter(t => dccAdmin || !isDccExclusiveTask(t))
      .filter(t => !((isLevel6Executive || isLevel6Plus(currentUser)) && (normalizeTaskCategory(t) === 'RECEIPT' || isReceiptTask(t))))
      .filter(t => {
        if (dccAdmin) return true;

        // 🛡️ Phase 1 & 3: Department Pool / Shared Task for Physical Controlled Copy Receipt
        // All staff in the destination department with Level < 6 can view and act on receipt tasks
        const isReceipt = isReceiptTask(t) || normalizeTaskCategory(t) === 'RECEIPT';
        if (isReceipt) {
          if (isLevel6Executive || isLevel6Plus(currentUser)) return false;
          const tDept = resolveTaskDept(t);
          return userDepts.some(uDept => isSameDepartment(uDept, tDept)) || 
            isSameDepartment(currentUser?.department, tDept) || 
            isSameDepartment(currentUser?.primary_department, tDept) ||
            userMatchesDepartment(currentUser, tDept);
        }

        const taskAssigneeId = t.assigneeId || t.assignee_id || t.assignedToUserId || t.target_user_id;
        const isAssignee = Boolean(taskAssigneeId && (taskAssigneeId === currentUser?.id || taskAssigneeId === currentUser?.empId || t.assigneeName === currentUser?.name));
        if (taskAssigneeId) {
          return isAssignee;
        }
        const tDept = resolveTaskDept(t);
        const isDeptMatch = userDepts.some(uDept => isSameDepartment(uDept, tDept)) || 
          isSameDepartment(currentUser?.department, tDept) || 
          isSameDepartment(currentUser?.primary_department, tDept);
        return isDeptMatch;
      });
  }, [tasks, currentUser, dccAdmin, isLevel6Executive, userDepts, resolveTaskDept]);

  const availableDepts = useMemo(() => {
    if (!dccAdmin) {
      // 🛡️ Phase 2: Strict Department Isolation - Non-DCC users see affiliated departments plus any directly assigned task's department
      const deptsFromAssignedTasks = (userTasks || [])
        .filter(t => {
          const taskAssigneeId = t.assigneeId || t.assignee_id || t.assignedToUserId || t.target_user_id;
          return Boolean(taskAssigneeId && (taskAssigneeId === currentUser?.id || taskAssigneeId === currentUser?.empId || t.assigneeName === currentUser?.name));
        })
        .map(t => resolveTaskDept(t))
        .filter(Boolean);
      return Array.from(new Set([...userDepts, ...deptsFromAssignedTasks])).filter(Boolean);
    }
    const deptsFromTasks = (userTasks || []).map(t => resolveTaskDept(t)).filter(Boolean);
    const combined = Array.from(new Set([...userDepts, ...deptsFromTasks]));
    return combined.filter(Boolean);
  }, [dccAdmin, userDepts, userTasks, resolveTaskDept, currentUser]);

  const filteredTasks = useMemo(() => {
    let filtered = userTasks;
    if (originFilter !== 'ALL') {
      filtered = filtered.filter(t => getTaskOrigin(t) === originFilter);
    }
    if (deptFilter !== 'ALL') {
      filtered = filtered.filter(t => isTaskMatchingDept(t, deptFilter));
    }
    if (activeTab !== 'ALL') {
      filtered = filtered.filter(t => normalizeTaskCategory(t) === activeTab);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => {
        const docId = getDocumentIdentifier(t) || '';
        const title = getDocumentTitle(t, storeContext) || '';
        return docId.toLowerCase().includes(term) ||
          title.toLowerCase().includes(term) ||
          (t.title || '').toLowerCase().includes(term) ||
          (t.description || '').toLowerCase().includes(term);
      });
    }
    return filtered;
  }, [userTasks, originFilter, deptFilter, activeTab, searchTerm, storeContext, isTaskMatchingDept]);

  const originCounts = useMemo(() => {
    const isActionRequired = (t) => t.actionRequired !== false && !t.is_completed && t.status !== 'COMPLETED';
    let actionable = userTasks.filter(isActionRequired);
    if (deptFilter !== 'ALL') {
      actionable = actionable.filter(t => isTaskMatchingDept(t, deptFilter));
    }
    return {
      ALL: actionable.length,
      INTERNAL: actionable.filter(t => getTaskOrigin(t) === 'INTERNAL').length,
      EXTERNAL: actionable.filter(t => getTaskOrigin(t) === 'EXTERNAL').length,
    };
  }, [userTasks, deptFilter, isTaskMatchingDept]);

  const pagination = useTablePagination(filteredTasks, 10);

  const getTaskCount = useCallback((tabId) => {
    const isActionRequired = (t) => t.actionRequired !== false && !t.is_completed && t.status !== 'COMPLETED';
    let base = userTasks.filter(isActionRequired);
    if (originFilter !== 'ALL') {
      base = base.filter(t => getTaskOrigin(t) === originFilter);
    }
    if (deptFilter !== 'ALL') {
      base = base.filter(t => isTaskMatchingDept(t, deptFilter));
    }
    if (tabId === 'ALL') return base.length;
    return base.filter(t => normalizeTaskCategory(t) === tabId).length;
  }, [userTasks, originFilter, deptFilter, isTaskMatchingDept]);

  const tabs = useMemo(() => {
    const baseTabs = dccAdmin ? [
      { id: 'ALL', thaiLabel: 'ทั้งหมด', engLabel: 'All Tasks', count: getTaskCount('ALL') },
      { id: 'DCC_DISTRIBUTE', thaiLabel: 'งานแจกจ่าย', engLabel: 'Distribution', count: getTaskCount('DCC_DISTRIBUTE') },
      { id: 'DCC_RECALL', thaiLabel: 'งานเรียกคืน', engLabel: 'Recall', count: getTaskCount('DCC_RECALL') },
      { id: 'REVIEW', thaiLabel: 'ทบทวน', engLabel: 'Review', count: getTaskCount('REVIEW') },
      { id: 'APPROVE', thaiLabel: 'อนุมัติ', engLabel: 'Approve', count: getTaskCount('APPROVE') },
      { id: 'RECEIPT', thaiLabel: 'ตรวจรับเล่ม', engLabel: 'Receipt', count: getTaskCount('RECEIPT') },
      { id: 'REVISE', thaiLabel: 'ส่งกลับแก้ไข', engLabel: 'Returned', count: getTaskCount('REVISE') },
    ] : [
      { id: 'ALL', thaiLabel: 'ทั้งหมด', engLabel: 'All Tasks', count: getTaskCount('ALL') },
      { id: 'REVIEW', thaiLabel: 'ทบทวน', engLabel: 'Review', count: getTaskCount('REVIEW') },
      { id: 'APPROVE', thaiLabel: 'อนุมัติ', engLabel: 'Approve', count: getTaskCount('APPROVE') },
      { id: 'RECEIPT', thaiLabel: 'ตรวจรับเล่ม', engLabel: 'Receipt', count: getTaskCount('RECEIPT') },
      { id: 'ACK', thaiLabel: 'รับทราบ', engLabel: 'Acknowledge', count: getTaskCount('ACK') },
      { id: 'REVISE', thaiLabel: 'ส่งกลับแก้ไข', engLabel: 'Returned', count: getTaskCount('REVISE') },
    ];
    if (isLevel6Executive) {
      return baseTabs.filter(tab => tab.id !== 'RECEIPT');
    }
    return baseTabs;
  }, [dccAdmin, isLevel6Executive, getTaskCount]);

  const handleTaskClick = (task) => {
    const normType = (task.type || task.taskType || '').toUpperCase();
    const isReceipt =
      normType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
      task.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
      normType === 'CONFIRM_RECEIPT' ||
      normType === 'RECEIPT' ||
      task.category === 'RECEIPT' ||
      task.actionType === 'RECEIPT' ||
      task.id?.includes('task-receipt-') ||
      task.title?.includes('ตรวจรับเล่ม') ||
      task.title?.includes('ตรวจรับสำเนา') ||
      task.title?.includes('ตรวจรับเอกสาร');

    if (isReceipt) {
      setSelectedReceiptTask(task);
      return;
    }

    if (task.referenceType === 'EXTERNAL_DOC' || task.origin === 'EXTERNAL') {
      // 🛡️ Phase 2: If task is EXTERNAL_REVISE, open ExternalDocFormModal in Resubmit mode
      if (normType === 'EXTERNAL_REVISE' || normType === 'REVISE') {
        const extDoc = (externalDocuments || []).find(d => d.id === task.referenceId || d.id === task.docId || (task.docCode && d.edCode === task.docCode)) ||
                       (externalRequests || []).find(r => r.id === task.referenceId || r.requestId === task.referenceId || r.docId === task.referenceId || r.externalDocId === task.referenceId || (task.docCode && r.edCode === task.docCode));
        if (extDoc) {
          setEditingExternalDoc({
            ...extDoc,
            returnReason: task.returnReason || task.rejectReason || extDoc.returnReason
          });
          setResubmitTaskId(task.id);
          setIsExternalDocModalOpen(true);
          return;
        }
      }
      setSelectedExtTask(task);
      return;
    }
    if (normType === 'CC_REPLACEMENT_APPROVAL') {
      navigate(`/tasks/approve-replacement/${task.id}`);
      return;
    }
    if (normType === 'REVIEW' || normType === 'EXT_REVIEW') navigate(`/tasks/review/${task.id}`);
    else if (normType === 'APPROVE' || normType === 'APPROVAL' || normType === 'EXT_APPROVAL') navigate(`/tasks/approve/${task.id}`);
    else if (normType === 'ACK' || normType === 'ACKNOWLEDGE') navigate(`/tasks/ack/${task.id}`);
    else if (normType === 'REVISE' || normType === 'DAR_REVISE' || normType === 'RETURNED_FOR_REVISION') navigate(`/tasks/revise/${task.id || task.darId || task.referenceId}`);
    else if (normType === 'DCC_DISTRIBUTE' || normType === 'DCC_ISSUE') {
      const targetTab = (task.delivery_status === 'DISPATCHED_TRACKING' || task.status === 'COMPLETED') ? 'DISPATCHED_TRACKING' : 'PENDING_ISSUE';
      navigate(`/controlled-copy?tab=${targetTab}`);
    }
    else if (normType === 'DCC_RECALL' || normType === 'DCC_RECALL_WITH_CHECKLIST' || normType === 'RECALL_HARDCOPY' || task.taskType === 'RECALL' || task.taskType === 'DCC_RECALL_WITH_CHECKLIST') navigate(`/controlled-copy?tab=RECALL_CHECKLIST`);
    else if (normType.startsWith('DCC_')) navigate(`/controlled-copy`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 w-full max-w-full overflow-hidden">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5 tracking-tight">
            <CheckSquare className="text-indigo-600" size={26} /> กล่องงานที่ต้องจัดการ
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">รายการคำขอและงานที่รอการตรวจทาน อนุมัติ หรือเซ็นรับเอกสาร</p>
        </div>

        {/* 🏷️ Document Origin Filter (Segmented Control / Pill Filter) */}
        <div className="flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 w-full sm:w-fit shadow-2xs overflow-x-auto">
          {[
            { id: 'ALL', label: 'ทั้งหมด', subLabel: 'All Tasks', count: originCounts.ALL, icon: Layers },
            { id: 'INTERNAL', label: 'เอกสารภายใน', subLabel: 'Internal QMS', count: originCounts.INTERNAL, icon: FileText },
            { id: 'EXTERNAL', label: 'เอกสารภายนอก', subLabel: 'External Docs', count: originCounts.EXTERNAL, icon: Globe },
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = originFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOriginFilter(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-2xs font-bold border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 border border-transparent'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-[#0D99FF]' : 'text-slate-400'} />
                <span>{tab.label}</span>
                <span className={`hidden sm:inline text-[11px] font-normal ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>
                  ({tab.subLabel})
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[11px] font-mono ${
                  isSelected ? 'bg-[#0D99FF]/10 text-[#0D99FF] font-bold' : 'bg-slate-200/70 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden shadow-none">
        {/* Filter & Tabs Bar */}
        <div className="p-4 border-b border-[#E5E5E5] bg-white flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="flex items-center overflow-x-auto custom-scrollbar gap-1.5 w-full md:w-auto py-0.5">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-2.5 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 border cursor-pointer ${
                    isActive
                      ? 'bg-[#1E1E1E] border-[#1E1E1E] text-white shadow-none'
                      : 'bg-white border-[#E5E5E5] text-[#666666] hover:text-[#1E1E1E] hover:bg-[#FAFAFA] hover:border-[#CCCCCC]'
                  }`}
                >
                  <span className="text-sm font-semibold">{tab.thaiLabel}</span>
                  <span className={`text-xs font-normal ${isActive ? 'text-[#CCCCCC]' : 'text-[#999999]'}`}>(<span>{tab.engLabel}</span>)</span>
                  {tab.count > 0 && (
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#F5F5F5] text-[#1E1E1E] border border-[#E5E5E5]'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999999]" size={16} />
              <input
                type="text"
                placeholder="ค้นหา รหัส, ชื่อเอกสาร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 h-10 bg-white border border-[#E5E5E5] rounded-lg text-sm font-medium focus:outline-none focus:border-[#0D99FF] focus:ring-1 focus:ring-[#0D99FF] transition-all placeholder:text-[#999999] shadow-none"
              />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                title="ล้างตัวกรอง"
                className="p-2 h-10 w-10 rounded-lg border border-[#E5E5E5] bg-white hover:bg-[#FFF0F0] text-[#999999] hover:text-[#E02424] transition-all cursor-pointer shadow-none flex items-center justify-center"
              >
                <FilterX size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 🏢 Department Filter Pill Bar */}
        {availableDepts.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50 border-b border-[#E5E5E5] flex items-center gap-2 overflow-x-auto custom-scrollbar text-xs">
            <span className="text-slate-500 font-bold shrink-0 flex items-center gap-1.5 mr-1">
              <Building2 size={14} className="text-indigo-600" /> แผนก:
            </span>
            <button
              type="button"
              onClick={() => setDeptFilter('ALL')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap shrink-0 border cursor-pointer ${
                deptFilter === 'ALL'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              {dccAdmin ? `🏢 งานทั้งหมดทุกแผนก (${userTasks.length})` : `📁 ทุกแผนกที่สังกัด (${userTasks.length})`}
            </button>
            {availableDepts.map(dept => {
              const deptCount = userTasks.filter(t => isTaskMatchingDept(t, dept)).length;
              const isPrimary = isSameDepartment(primaryDept, dept);
              const isSelected = deptFilter === dept;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setDeptFilter(dept)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap shrink-0 border cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>เฉพาะงาน {dept}</span>
                  {isPrimary && <span className="text-amber-400 text-xs" title="แผนกหลัก">⭐</span>}
                  <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {deptCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Task List (High-Density Contextual Bento Cards) ─── */}
        <div className="p-3 sm:p-4 bg-slate-50/50 space-y-2.5 overflow-y-auto max-h-[640px] scrollbar-thin">
          {pagination.paginatedData.length > 0 ? (
            pagination.paginatedData.map(task => {
              const isExternal = getTaskOrigin(task) === 'EXTERNAL';
              const extDoc = isExternal ? (externalDocuments || []).find(d => d.id === task.referenceId || d.id === task.docId) : null;
              const normType = (task.type || task.taskType || '').toUpperCase();

              // ── Data extraction with full null-safety ──
              const docCode = getDocumentIdentifier(task);
              const matchedDar = (dars || []).find(d => String(d.id) === String(task.darId) || d.darNo === task.darId || d.darNumber === task.darId);
              const matchedDoc = (documents || []).find(d => 
                (task.docId && String(d.id) === String(task.docId)) || 
                (docCode && (d.title === docCode || d.document_code === docCode || d.code === docCode))
              );

              const darNo = resolveDarIdentifier(task, matchedDar);
              const docTitle = getDocumentTitle(task, storeContext);
              const copyNo = getCopyChip(task);
              const revTransition = getRevisionTransition(task, matchedDar, matchedDoc);
              const badgeConfig = getTaskTypeBadgeConfig(normType, task);
              const slaBadge = getSLABadge(task, mockDateOffset);

              // ── Contextual Metadata ──
              const ownerDept = resolveTaskDepartment(task, storeContext);
              const requesterName = resolveRequesterName(task, matchedDar, matchedDoc, masterUsers);
              const reasonSnippet = resolveReasonSnippet(task, matchedDar);
              const location = task.location || task.locationName || task.station_name || task.point_of_use || '';
              const dueDate = task.dueDate || null;
              const isReplacement = Boolean(task.is_replacement || task.isReplacement || task.replacementReason === 'DAMAGED');
              const isUrgentFastTrack = task.isUrgent || task.priority === 'URGENT' || task.slaType === 'FAST_TRACK';

              const finalDocTitle = isExternal ? (extDoc?.title || docTitle) : docTitle;

              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-md hover:bg-slate-50/[0.2] rounded-xl p-4 sm:p-4.5 transition-all duration-150 group cursor-pointer relative flex flex-col gap-2.5"
                >
                  {/* ── 1. Header Row (ประเภทงาน, หมายเลข และ SLA) ── */}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                    {/* ฝั่งซ้าย: Badge ประเภทงานเด่นชัด + Badge เลขที่คำร้องแบบโมโนสเปซ */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold border whitespace-nowrap ${badgeConfig.badgeClass}`}>
                        {badgeConfig.icon}
                        <span>{badgeConfig.label}</span>
                      </span>

                      {darNo && (
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-700 group-hover:border-indigo-200 transition-colors whitespace-nowrap">
                          {darNo}
                        </span>
                      )}

                      {copyNo && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                          {copyNo}
                        </span>
                      )}

                      {/* 🛡️ Soft Muted Origin Badge to preserve Visual Hierarchy */}
                      {isExternal && (
                        <span className="bg-slate-100 text-slate-600 border border-slate-200/80 px-2 py-0.5 rounded text-[11px] font-medium inline-flex items-center gap-1 shadow-2xs whitespace-nowrap">
                          <Globe size={11} className="text-slate-400 shrink-0" />
                          <span>เอกสารภายนอก</span>
                        </span>
                      )}
                    </div>

                    {/* ฝั่งขวา: Badge เตือนกำหนดเวลาและ SLA */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isUrgentFastTrack && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          <Zap size={10} className="fill-amber-500" /> Fast-Track
                        </span>
                      )}
                      {slaBadge}
                      {dueDate && (
                        <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          <Clock size={11} className="text-slate-400" />
                          <span>กำหนด: <strong className="font-mono text-slate-700">{formatThaiDateTime(dueDate)}</strong></span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── 2. Primary Identity Line (อัตลักษณ์เอกสาร) ── */}
                  <div className="flex items-start sm:items-center justify-between gap-3 pt-0.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
                      {/* รหัสเอกสารตัวหนา (Mono Font) */}
                      {docCode && (
                        <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight whitespace-nowrap">
                          {docCode}
                        </span>
                      )}

                      {/* ชิปแสดงฉบับเอกสารตามบริบทงาน (Context-Aware Revision Badge) */}
                      {revTransition && (
                        revTransition.type === 'TRANSITION' ? (
                          <span className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded-md whitespace-nowrap ${revTransition.badgeClass || 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'}`}>
                            Rev.{revTransition.prev} <span className="text-indigo-400">➔</span> {revTransition.next}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center font-mono text-xs px-2 py-0.5 rounded-md whitespace-nowrap border ${revTransition.badgeClass || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {revTransition.label}
                          </span>
                        )
                      )}

                      {/* ชื่อเอกสารทางการภาษาไทย */}
                      <h3 
                        className="text-sm sm:text-base font-bold text-slate-800 group-hover:text-indigo-950 transition-colors leading-snug line-clamp-1"
                        title={typeof finalDocTitle === 'string' ? finalDocTitle : undefined}
                      >
                        {finalDocTitle}
                      </h3>

                      {isReplacement && (
                        <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          ฉบับทดแทน
                        </span>
                      )}
                    </div>

                    {/* 4. Card Action & Affordance (ปุ่ม Action ลัด) */}
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 shadow-xs group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 group-hover:shadow transition-all whitespace-nowrap shrink-0">
                      <span>{badgeConfig.actionLabel}</span>
                      <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* ── 3. Contextual Metadata Row (ข้อมูลประกอบการพิจารณา) ── */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 pt-0.5 border-t border-slate-100">
                    {/* Badge แผนกเจ้าของเอกสาร */}
                    {ownerDept && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold whitespace-nowrap">
                        <span>{formatDepartmentBadge(ownerDept, masterDepartments)}</span>
                      </span>
                    )}

                    {/* ข้อมูลผู้ยื่นคำร้อง */}
                    {requesterName && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium whitespace-nowrap">
                        <User size={12} className="text-slate-400" />
                        <span>ผู้ร้องขอ: <strong className="text-slate-800 font-semibold">{requesterName}</strong></span>
                      </span>
                    )}

                    {/* ตัวอย่างเหตุผลการแก้ไข (Reason Snippet) Truncated */}
                    {reasonSnippet && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 min-w-0 max-w-lg truncate" title={reasonSnippet}>
                        <FileText size={12} className="text-slate-400 shrink-0" />
                        <span className="shrink-0 text-slate-600 font-medium">เหตุผล:</span>
                        <span className="truncate text-slate-700">{reasonSnippet}</span>
                      </span>
                    )}

                    {/* Location if hardcopy receipt task */}
                    {location && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap">
                        <MapPin size={12} className="text-slate-400" />
                        <span>{location}</span>
                      </span>
                    )}

                    {/* 🛡️ Return Reason Alert Banner for EXTERNAL_REVISE / REVISE */}
                    {(task.returnReason || task.rejectReason) && (
                      <div className="w-full flex items-start gap-2 text-xs bg-rose-50 text-rose-800 border border-rose-200/80 px-3 py-2 rounded-lg font-medium mt-1">
                        <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">เหตุผลที่ส่งกลับแก้ไข:</span> {task.returnReason || task.rejectReason}
                        </div>
                      </div>
                    )}

                    {/* Mobile Action indicator */}
                    <div className="sm:hidden ml-auto flex items-center text-indigo-600 font-bold text-[11px] gap-0.5">
                      <span>{badgeConfig.actionLabel}</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
              <CheckCircle className="mx-auto text-emerald-500 mb-2" size={36} />
              <p className="text-sm font-bold text-slate-700">ไม่มีงานค้างในกล่องข้อความ</p>
              <p className="text-xs text-slate-400 mt-0.5">คุณจัดการงานทั้งหมดเรียบร้อยแล้ว</p>
            </div>
          )}
        </div>
        <TablePagination
          currentPage={pagination.currentPage}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

      <AnimatePresence>
        {selectedExtTask && (
          <ExternalDocActionModal
            isOpen={!!selectedExtTask}
            onClose={() => setSelectedExtTask(null)}
            task={selectedExtTask}
          />
        )}
        {selectedReceiptTask && (
          <TaskConfirmHardcopyReceiptModal
            isOpen={!!selectedReceiptTask}
            onClose={() => setSelectedReceiptTask(null)}
            task={selectedReceiptTask}
          />
        )}
        {isExternalDocModalOpen && (
          <ExternalDocFormModal
            isOpen={isExternalDocModalOpen}
            onClose={() => {
              setIsExternalDocModalOpen(false);
              setEditingExternalDoc(null);
              setResubmitTaskId(null);
            }}
            documentToEdit={editingExternalDoc}
            resubmitTaskId={resubmitTaskId}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default function TaskInboxWrapper(props) {
  return (
    <ErrorBoundary>
      <TaskInbox {...props} />
    </ErrorBoundary>
  );
}
