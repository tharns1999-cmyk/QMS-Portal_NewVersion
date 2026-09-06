import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
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
  Zap
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import ExternalDocActionModal from './ExternalDocActionModal';
import TaskConfirmHardcopyReceiptModal from '../../components/workflow/TaskConfirmHardcopyReceiptModal';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';
import { isActionableTask, isDccUser, isSameDepartment } from '../../utils/taskFilter';

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
// Helper 2: Extract/clean the real document title
// ─────────────────────────────────────────────────────────────────────────────
const TITLE_PREFIX_PATTERNS = [
  /^\[.*?\]\s*/,                                            // [Any bracket prefix]
  /^ตรวจรับเอกสารควบคุมฉบับพิมพ์:\s*/,
  /^แจกจ่ายเอกสาร Controlled Copy \(NEW\):\s*/,
  /^แจกจ่ายสำเนาควบคุม:\s*/,
  /^จัดพิมพ์และส่งมอบสำเนาควบคุมเอกสาร(?:ภายนอก)?:\s*/,
  /^เรียกคืนและทำลายเอกสาร(?:ภายนอก)?(?:ที่ถูกยกเลิก)?:\s*/,
  /^เรียกคืนสำเนาเอกสารที่ถูกยกเลิก:\s*/,
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

const getDocumentTitle = (task) => {
  // 1. Explicit name fields
  const explicit =
    task.docName ||
    task.doc_name ||
    task.documentName ||
    task.doc_title;
  if (explicit) return explicit;

  // 2. Strip prefixes from task.title
  const stripped = stripTitlePrefixes(task.title || '');
  if (stripped) return stripped;

  return task.title || '';
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
  if (normType.startsWith('DCC_')) return 'งาน DCC';
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
// Task Inbox Component
// ─────────────────────────────────────────────────────────────────────────────
const TaskInbox = () => {
  const navigate = useNavigate();
  const { currentUser, tasks, dars, externalDocuments, mockDateOffset, checkSLA } = useStore();
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExtTask, setSelectedExtTask] = useState(null);
  const [selectedReceiptTask, setSelectedReceiptTask] = useState(null);

  useEffect(() => {
    if (checkSLA) checkSLA();
  }, [mockDateOffset, checkSLA]);

  const isDccAdmin = isDccUser(currentUser);
  const userDepts = currentUser?.affiliated_departments || currentUser?.depts || (currentUser?.primary_department ? [currentUser.primary_department] : (currentUser?.department ? [currentUser.department] : []));
  const primaryDept = currentUser?.primary_department || currentUser?.department || '';

  const [deptFilter, setDeptFilter] = useState(() => {
    if (isDccAdmin) return 'ALL';
    return primaryDept || 'ALL';
  });

  useEffect(() => {
    if (!isDccAdmin && primaryDept) {
      setDeptFilter(primaryDept);
    } else if (isDccAdmin) {
      setDeptFilter('ALL');
    }
  }, [currentUser?.id, currentUser?.department, currentUser?.primary_department, isDccAdmin, primaryDept]);

  const userTasks = (tasks || []).filter(t => isActionableTask(t, currentUser));

  const availableDepts = useMemo(() => {
    if (isDccAdmin) {
      const deptsFromTasks = (userTasks || []).map(t => t.target_department || t.targetDepartment || t.destinationDept || t.assignedToDept || t.currentHandlerDepartment || t.department || t.holder_dept).filter(Boolean);
      const combined = Array.from(new Set([...userDepts, ...deptsFromTasks]));
      return combined.filter(Boolean);
    }
    return userDepts;
  }, [isDccAdmin, userTasks, userDepts]);

  const normalizeTaskCategory = (task) => {
    const rawType = (task.type || task.taskType || task.task_type || task.category || '').toUpperCase();
    if (rawType === 'REVIEW' || rawType === 'EXT_REVIEW') return 'REVIEW';
    if (rawType === 'APPROVE' || rawType === 'APPROVAL' || rawType === 'EXT_APPROVAL' || rawType === 'CC_REPLACEMENT_APPROVAL') return 'APPROVE';
    if (rawType === 'ACK' || rawType === 'ACKNOWLEDGE') return 'ACK';
    if (rawType === 'REVISE') return 'REVISE';
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
  };

  const getFilteredTasks = () => {
    let filtered = userTasks;
    if (deptFilter !== 'ALL') {
      filtered = filtered.filter(t => {
        const tDept = t.target_department || t.targetDepartment || t.destinationDept || t.assignedToDept || t.currentHandlerDepartment || t.department || t.holder_dept || '';
        const taskAssigneeId = t.assigneeId || t.assignee_id || t.assignedToUserId || t.target_user_id;
        if (taskAssigneeId && (taskAssigneeId === currentUser?.id || t.assigneeName === currentUser?.name)) {
          if (tDept && !isSameDepartment(tDept, deptFilter)) return false;
          return true;
        }
        return isSameDepartment(tDept, deptFilter);
      });
    }
    if (activeTab !== 'ALL') {
      filtered = filtered.filter(t => normalizeTaskCategory(t) === activeTab);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => {
        const docId = getDocumentIdentifier(t) || '';
        const title = getDocumentTitle(t) || '';
        return docId.toLowerCase().includes(term) ||
          title.toLowerCase().includes(term) ||
          (t.title || '').toLowerCase().includes(term) ||
          (t.description || '').toLowerCase().includes(term);
      });
    }
    return filtered;
  };

  const filteredTasks = useMemo(() => getFilteredTasks(), [userTasks, deptFilter, activeTab, searchTerm]);
  const pagination = useTablePagination(filteredTasks, 10);

  const getTaskCount = (tabId) => {
    const isActionRequired = (t) => t.actionRequired !== false && !t.is_completed && t.status !== 'COMPLETED';
    if (tabId === 'ALL') return userTasks.filter(isActionRequired).length;
    return userTasks.filter(t => normalizeTaskCategory(t) === tabId && isActionRequired(t)).length;
  };

  const tabs = isDccAdmin ? [
    { id: 'ALL', thaiLabel: 'ทั้งหมด', engLabel: 'All DCC Tasks', count: getTaskCount('ALL') },
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

  const handleTaskClick = (task) => {
    const normType = (task.type || task.taskType || '').toUpperCase();
    if (task.referenceType === 'EXTERNAL_DOC') {
      setSelectedExtTask(task);
      return;
    }
    const isReceipt =
      normType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
      task.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' ||
      normType === 'CONFIRM_RECEIPT' ||
      normType === 'RECEIPT' ||
      task.category === 'RECEIPT' ||
      task.id?.includes('task-receipt-') ||
      task.title?.includes('ตรวจรับเล่ม') ||
      task.title?.includes('ตรวจรับเอกสาร');
    if (isReceipt) {
      navigate(`/tasks/confirm-receipt/${task.id}`);
      return;
    }
    if (normType === 'CC_REPLACEMENT_APPROVAL') {
      navigate(`/tasks/approve-replacement/${task.id}`);
      return;
    }
    if (normType === 'REVIEW' || normType === 'EXT_REVIEW') navigate(`/tasks/review/${task.id}`);
    else if (normType === 'APPROVE' || normType === 'APPROVAL' || normType === 'EXT_APPROVAL') navigate(`/tasks/approve/${task.id}`);
    else if (normType === 'ACK' || normType === 'ACKNOWLEDGE') navigate(`/tasks/ack/${task.id}`);
    else if (normType === 'REVISE') navigate(`/tasks/revise/${task.darId || task.referenceId || task.id}`);
    else if (normType === 'DCC_DISTRIBUTE' || normType === 'DCC_ISSUE') {
      const targetTab = (task.delivery_status === 'DISPATCHED_TRACKING' || task.status === 'COMPLETED') ? 'DISPATCHED_TRACKING' : 'PENDING_ISSUE';
      navigate(`/controlled-copy?tab=${targetTab}`);
    }
    else if (normType === 'DCC_RECALL' || normType === 'DCC_RECALL_WITH_CHECKLIST' || normType === 'RECALL_HARDCOPY' || task.taskType === 'RECALL' || task.taskType === 'DCC_RECALL_WITH_CHECKLIST') navigate(`/controlled-copy?tab=RECALL_CHECKLIST`);
    else if (normType.startsWith('DCC_')) navigate(`/controlled-copy`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5 tracking-tight">
            <CheckSquare className="text-indigo-600" size={26} /> กล่องงานที่ต้องจัดการ
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">รายการคำขอและงานที่รอการตรวจทาน อนุมัติ หรือเซ็นรับเอกสาร</p>
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
            {(isDccAdmin || availableDepts.length > 1) && (
              <button
                onClick={() => setDeptFilter('ALL')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap shrink-0 border cursor-pointer ${
                  deptFilter === 'ALL'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                {isDccAdmin ? `🏢 งานทั้งหมดทุกแผนก (${userTasks.length})` : `📁 ทุกแผนกที่สังกัด (${userTasks.length})`}
              </button>
            )}
            {availableDepts.map(dept => {
              // Mirror getFilteredTasks() logic exactly so pill counts match actual filtered list
              const deptCount = userTasks.filter(t => {
                const tDept = t.target_department || t.targetDepartment || t.destinationDept || t.assignedToDept || t.currentHandlerDepartment || t.department || t.holder_dept || '';
                const taskAssigneeId = t.assigneeId || t.assignee_id || t.assignedToUserId || t.target_user_id;
                if (taskAssigneeId && (taskAssigneeId === currentUser?.id || t.assigneeName === currentUser?.name)) {
                  // Directly-assigned tasks: only count if dept also matches (or task has no dept)
                  if (tDept && !isSameDepartment(tDept, dept)) return false;
                  return true;
                }
                return isSameDepartment(tDept, dept);
              }).length;
              const isPrimary = (currentUser?.primary_department || currentUser?.department) === dept;
              const isSelected = deptFilter === dept;
              return (
                <button
                  key={dept}
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

        {/* ─── Task List ─── */}
        <div className="divide-y divide-slate-100 overflow-y-auto max-h-[600px] scrollbar-thin">
          {pagination.paginatedData.length > 0 ? (
            pagination.paginatedData.map(task => {
              const isExternal = task.referenceType === 'EXTERNAL_DOC';
              const extDoc = isExternal ? (externalDocuments || []).find(d => d.id === task.referenceId) : null;
              const normType = (task.type || task.taskType || '').toUpperCase();

              // ── Data extraction (all helpers null-safe) ──
              const docId = getDocumentIdentifier(task);
              const docTitle = getDocumentTitle(task);
              const copyNo = getCopyChip(task);
              const taskTypeShortLabel = getTaskTypeShortLabel(normType, task);
              const iconConfig = getTaskIconConfig(task);
              const slaBadge = getSLABadge(task, mockDateOffset);

              // ── Metadata chips ──
              const dept = task.holder_dept || task.department || task.target_department || task.targetDepartment || task.destinationDept || task.assignedToDept || '';
              const location = task.location || task.locationName || task.station_name || task.point_of_use || '';
              const dueDate = task.dueDate || null;
              const isReplacement = Boolean(task.is_replacement || task.isReplacement || task.replacementReason === 'DAMAGED');
              const isUrgentFastTrack = task.isUrgent || task.priority === 'URGENT' || task.slaType === 'FAST_TRACK';

              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="px-4 sm:px-5 py-4 sm:py-4.5 hover:bg-slate-50/80 cursor-pointer transition-all duration-150 group flex items-start gap-3.5"
                >
                  {/* ── Leading Icon (Level 1 anchor) ── */}
                  <div className={`flex-none flex items-center justify-center w-10 h-10 rounded-xl mt-0.5 transition-transform duration-150 group-hover:scale-105 ${iconConfig.iconBg}`}>
                    {iconConfig.icon}
                  </div>

                  {/* ── Card Content ── */}
                  <div className="flex-1 min-w-0 space-y-1.5">

                    {/* ── Level 1: Header Chips Row ── */}
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      {/* Left group: context chips */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Doc ID chip — only shown if a real code exists */}
                        {docId && (
                          <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-700 group-hover:border-indigo-200 transition-colors whitespace-nowrap">
                            {docId}
                          </span>
                        )}
                        {/* Copy chip */}
                        {copyNo && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                            {copyNo}
                          </span>
                        )}
                        {/* Task type chip */}
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${iconConfig.chipClass}`}>
                          {taskTypeShortLabel}
                        </span>
                        {/* External badge */}
                        {isExternal && (
                          <span className="bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1">
                            <ExternalLink size={10} /> External
                          </span>
                        )}
                        {/* Fast-track badge */}
                        {(isUrgentFastTrack && task.actionRequired !== false && task.delivery_status !== 'DISPATCHED_TRACKING') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                            <Zap size={9} className="fill-amber-500" /> Fast-Track
                          </span>
                        )}
                      </div>

                      {/* Right: SLA / Priority badge */}
                      <div className="shrink-0">
                        {slaBadge}
                      </div>
                    </div>

                    {/* ── Level 2: Document Title (primary content) ── */}
                    <h3 className="text-sm sm:text-[15px] font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors leading-snug [overflow-wrap:anywhere]">
                      {isExternal ? (extDoc?.title || docTitle) : docTitle}
                      {isReplacement && (
                        <span className="ml-2 inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 align-middle">
                          ฉบับทดแทน
                        </span>
                      )}
                    </h3>

                    {/* ── Level 3: Metadata Footer Chips ── */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      {isExternal && extDoc?.status && (
                        <span>สถานะ: <span className="font-semibold text-indigo-600">{extDoc.status}</span></span>
                      )}
                      {dept && (
                        <span className="flex items-center gap-1">
                          <Building2 size={11} className="text-slate-400" />
                          <span className="font-mono font-semibold text-slate-600">{dept}</span>
                        </span>
                      )}
                      {location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} className="text-slate-400" />
                          <span className="text-slate-600">{location}</span>
                        </span>
                      )}
                      {dueDate && (
                        <span className={`flex items-center gap-1 ${isUrgentFastTrack ? 'text-amber-700 font-semibold' : ''}`}>
                          <Clock size={11} className={isUrgentFastTrack ? 'text-amber-500' : 'text-slate-400'} />
                          <span>กำหนด: <strong className="font-mono">{formatThaiDateTime(dueDate)}</strong></span>
                        </span>
                      )}
                      {isDccAdmin && task.description && !dept && !location && (
                        <span className="text-slate-500 line-clamp-1">{task.description}</span>
                      )}
                      {!dueDate && !dept && !location && !isExternal && (
                        <span className="text-slate-400 text-[10px]">ไม่มีข้อมูลเพิ่มเติม</span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="flex-none text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all mt-1.5" size={17} />
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-slate-400">
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
