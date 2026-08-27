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
  Calendar
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import ExternalDocActionModal from './ExternalDocActionModal';
import TaskConfirmHardcopyReceiptModal from '../../components/workflow/TaskConfirmHardcopyReceiptModal';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';

/**
 * Format ISO string or date string to readable localized Thai format
 */
const formatThaiDateTime = (dateInput) => {
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
    const year = d.getFullYear();

    const dateStr = String(dateInput);
    const hasTime = dateStr.includes('T') || dateStr.includes(':');

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

/**
 * Get task icon and theme configuration based on task type
 */
const getTaskIconConfig = (task) => {
  const normType = (task.type || task.taskType || '').toUpperCase();
  
  if (normType === 'REVIEW' || normType === 'EXT_REVIEW') {
    return {
      icon: <Eye size={18} strokeWidth={2} />,
      bg: 'bg-[#FFF9EB] text-[#F59E0B] border border-[#FDE68A] group-hover:bg-[#FEF3C7] group-hover:border-[#FCD34D]',
      label: 'Review Task',
      badgeClass: 'bg-[#FFF9EB] text-[#B45309] border border-[#FDE68A]'
    };
  }
  if (normType === 'APPROVE' || normType === 'APPROVAL' || normType === 'EXT_APPROVAL' || normType === 'CC_REPLACEMENT_APPROVAL') {
    return {
      icon: <ShieldCheck size={18} strokeWidth={2} />,
      bg: 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0] group-hover:bg-[#D1FAE5] group-hover:border-[#6EE7B7]',
      label: 'Approve Task',
      badgeClass: 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
    };
  }
  if (normType === 'ACK' || normType === 'ACKNOWLEDGE') {
    return {
      icon: <Bell size={18} strokeWidth={2} />,
      bg: 'bg-[#EFF6FF] text-[#3B82F6] border border-[#BFDBFE] group-hover:bg-[#DBEAFE] group-hover:border-[#93C5FD]',
      label: 'Acknowledge Task',
      badgeClass: 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
    };
  }
  if (normType === 'REVISE') {
    return {
      icon: <FileEdit size={18} strokeWidth={2} />,
      bg: 'bg-[#FFF1F2] text-[#F43F5E] border border-[#FECDD3] group-hover:bg-[#FFE4E6] group-hover:border-[#FDA4AF]',
      label: 'Returned Task',
      badgeClass: 'bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3]'
    };
  }
  if (normType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || task.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT') {
    return {
      icon: <Layers size={18} strokeWidth={2} />,
      bg: 'bg-[#F5F3FF] text-[#8B5CF6] border border-[#DDD6FE] group-hover:bg-[#EDE9FE] group-hover:border-[#C4B5FD]',
      label: 'Receipt Task',
      badgeClass: 'bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE]'
    };
  }
  if (normType === 'DCC_DISTRIBUTE' || normType === 'DCC_ISSUE') {
    return {
      icon: <Send size={18} strokeWidth={2} />,
      bg: 'bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] group-hover:bg-[#D1EFFF] group-hover:border-[#80CFFF]',
      label: 'Distribution Task',
      badgeClass: 'bg-[#E5F4FF] text-[#007BE5] border border-[#B8E1FF]'
    };
  }
  if (normType === 'DCC_RECALL' || normType === 'DCC_RECALL_WITH_CHECKLIST' || task.taskType === 'DCC_RECALL_WITH_CHECKLIST') {
    return {
      icon: <AlertTriangle size={18} strokeWidth={2} />,
      bg: 'bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] group-hover:bg-[#FFEDD5] group-hover:border-[#FDBA74]',
      label: 'Recall Task',
      badgeClass: 'bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]'
    };
  }
  if (normType.startsWith('DCC_')) {
    return {
      icon: <AlertCircle size={18} strokeWidth={2} />,
      bg: 'bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] group-hover:bg-[#D1EFFF] group-hover:border-[#80CFFF]',
      label: 'DCC Action Task',
      badgeClass: 'bg-[#E5F4FF] text-[#007BE5] border border-[#B8E1FF]'
    };
  }
  return {
    icon: <CheckSquare size={18} strokeWidth={2} />,
    bg: 'bg-[#F5F5F5] text-[#666666] border border-[#E5E5E5] group-hover:bg-[#EAEAEA] group-hover:border-[#CCCCCC]',
    label: 'Task',
    badgeClass: 'bg-[#F5F5F5] text-[#333333] border border-[#E5E5E5]'
  };
};

const TaskInbox = () => {
  const navigate = useNavigate();
  const { currentUser, tasks, dars, externalDocuments, mockDateOffset, checkSLA } = useStore();
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExtTask, setSelectedExtTask] = useState(null);
  const [selectedReceiptTask, setSelectedReceiptTask] = useState(null);

  // Run SLA Check on load (simulated)
  useEffect(() => {
    if (checkSLA) checkSLA();
  }, [mockDateOffset, checkSLA]);

  const isDccAdmin = currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.id === 'u5';
  const userDepts = currentUser?.depts || (currentUser?.department ? [currentUser.department] : []);

  const userTasks = (tasks || []).filter(t => {
    // 🛡️ Reactive Completion Filter: Immediately drop tasks that are completed/resolved
    if (t.status === 'COMPLETED' || t.status === 'RESOLVED' || t.is_completed === true) {
      return false;
    }

    const taskAssigneeId = t.assigneeId || t.assignee_id || t.assignedToUserId;
    const isHardcopyReceipt = (t.type === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || t.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || t.type === 'CONFIRM_RECEIPT' || t.task_type === 'CONFIRM_RECEIPT');

    if (isHardcopyReceipt) {
      if (isDccAdmin) {
        return true;
      }
      const taskDept = t.target_department || t.targetDepartment || t.destinationDept || t.assignedToDept || t.assignee_dept;
      const isTargetDeptMatch = taskDept && userDepts.includes(taskDept);

      // 🛡️ Strict Departmental Isolation: If the task is targeted to another department, NEVER show it!
      if (taskDept && !isTargetDeptMatch) {
        return false;
      }

      if (taskAssigneeId) {
        return taskAssigneeId === currentUser?.id || (t.assigneeName && t.assigneeName === currentUser?.name);
      }
      return !!isTargetDeptMatch;
    }

    const isMyTask = (taskAssigneeId && (taskAssigneeId === currentUser?.id || t.assigneeName === currentUser?.name)) ||
      (t.currentHandlerDepartment && userDepts.includes(t.currentHandlerDepartment) && Number(t.currentHandlerLevel) === Number(currentUser?.level)) ||
      (!taskAssigneeId && t.assignedToDept && userDepts.includes(t.assignedToDept));

    if (isDccAdmin) {
      return (t.type || '').startsWith('DCC_') || t.assignedToRole === 'DCC_ADMIN' || isMyTask;
    }
    return isMyTask;
  });

  const normalizeTaskCategory = (task) => {
    const rawType = (task.type || task.taskType || '').toUpperCase();
    if (rawType === 'REVIEW' || rawType === 'EXT_REVIEW') return 'REVIEW';
    if (rawType === 'APPROVE' || rawType === 'APPROVAL' || rawType === 'EXT_APPROVAL' || rawType === 'CC_REPLACEMENT_APPROVAL') return 'APPROVE';
    if (rawType === 'ACK' || rawType === 'ACKNOWLEDGE') return 'ACK';
    if (rawType === 'REVISE') return 'REVISE';
    if (rawType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || task.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || rawType === 'CONFIRM_RECEIPT') return 'RECEIPT';
    if (rawType === 'DCC_DISTRIBUTE' || rawType === 'DCC_ISSUE') return 'DCC_DISTRIBUTE';
    if (rawType === 'DCC_RECALL' || rawType === 'DCC_RECALL_WITH_CHECKLIST' || rawType === 'RECALL' || rawType === 'OBSOLETE_RECALL' || task.taskType === 'DCC_RECALL_WITH_CHECKLIST') return 'DCC_RECALL';
    if (rawType.startsWith('DCC_')) return 'DCC_ACTION';
    return rawType;
  };

  const getFilteredTasks = () => {
    let filtered = userTasks;
    if (activeTab !== 'ALL') {
      filtered = filtered.filter(t => {
        const cat = normalizeTaskCategory(t);
        return cat === activeTab;
      });
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => {
        const refId = t.referenceId || t.darId || t.doc_code || t.docId || t.id || '';
        return refId.toLowerCase().includes(term) ||
          (t.title || '').toLowerCase().includes(term) ||
          (t.description || '').toLowerCase().includes(term);
      });
    }
    return filtered;
  };

  const filteredTasks = useMemo(() => getFilteredTasks(), [userTasks, activeTab, searchTerm]);
  const pagination = useTablePagination(filteredTasks, 10);

  const getRiskBadge = (task) => {
    if (!task.dueDate) return <span className="badge-active flex items-center gap-1"><CheckCircle size={11} /> ปกติ (Normal)</span>;
    
    const today = new Date();
    today.setDate(today.getDate() + (mockDateOffset || 0));
    today.setHours(0, 0, 0, 0);

    const dueDateObj = new Date(task.dueDate);
    dueDateObj.setHours(0, 0, 0, 0);

    const diffTime = dueDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="badge-rejected flex items-center gap-1 font-semibold">
          <AlertCircle size={11} /> เกินกำหนด ({Math.abs(diffDays)} วัน)
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="badge-pending flex items-center gap-1 font-semibold">
          <Clock size={11} /> ครบกำหนดวันนี้
        </span>
      );
    } else if (diffDays <= 2) {
      return (
        <span className="badge-pending flex items-center gap-1">
          <Clock size={11} /> ใกล้ครบกำหนด (อีก {diffDays} วัน)
        </span>
      );
    } else {
      return (
        <span className="badge-active flex items-center gap-1">
          <CheckCircle size={11} /> ปกติ (Normal)
        </span>
      );
    }
  };

  const getTaskCount = (tabId) => {
    if (tabId === 'ALL') return userTasks.length;
    return userTasks.filter(t => {
      const cat = normalizeTaskCategory(t);
      return cat === tabId;
    }).length;
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
    if (normType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || task.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT') {
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
    else if (normType === 'DCC_DISTRIBUTE' || normType === 'DCC_ISSUE') navigate(`/controlled-copy?tab=PENDING_ISSUE`);
    else if (normType === 'DCC_RECALL' || normType === 'DCC_RECALL_WITH_CHECKLIST' || task.taskType === 'DCC_RECALL_WITH_CHECKLIST') navigate(`/controlled-copy?tab=RECALL_CHECKLIST`);
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
                placeholder="ค้นหา DAR No, ชื่อเอกสาร..."
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

        {/* Task List */}
        <div className="divide-y divide-[#E5E5E5] overflow-y-auto max-h-[580px] scrollbar-thin">
          {pagination.paginatedData.length > 0 ? (
            pagination.paginatedData.map(task => {
              const isExternal = task.referenceType === 'EXTERNAL_DOC';
              const dar = (!isExternal) ? (dars || []).find(d => d.id === task.darId) : null;
              const extDoc = isExternal ? (externalDocuments || []).find(d => d.id === task.referenceId) : null;
              const displayId = task.referenceId || task.darId || task.id;
              
              const iconConfig = getTaskIconConfig(task);

              // Title sanitization: strip empty brackets or undefined strings
              const sanitizeTitle = (rawTitle) => {
                if (!rawTitle) return displayId;
                let clean = String(rawTitle).replace(/^\[\s*\]\s*/, '').replace(/^\[undefined\]\s*/i, '').trim();
                return clean || displayId;
              };

              // Clean Type Badge text
              const getTypeBadgeText = () => {
                if (isExternal) return 'External Document';
                if (dar?.type) {
                  if (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') return 'DAR จัดทำใหม่ (NEW)';
                  if (dar.type === 'REVISION') return 'DAR ขอแก้ไข (REVISION)';
                  if (dar.type === 'OBSOLETE') return 'DAR ขอยกเลิก (OBSOLETE)';
                  return `DAR ${dar.type}`;
                }
                const norm = (task.type || task.taskType || '').toUpperCase();
                if (norm === 'ACK' || norm === 'ACKNOWLEDGE') return 'รับทราบเอกสาร (ACK)';
                if (norm === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || task.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT') return 'ตรวจรับเล่มสำเนา (Receipt)';
                return null;
              };

              const typeBadge = getTypeBadgeText();

              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="p-4 sm:p-5 hover:bg-[#FAFAFA] cursor-pointer transition-all duration-150 group flex items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {/* Leading Icon Box */}
                    <div className={`hidden sm:flex items-center justify-center w-10 h-10 rounded-lg shadow-none transition-transform group-hover:scale-105 shrink-0 ${iconConfig.bg}`}>
                      {iconConfig.icon}
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      {/* Header Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs sm:text-sm text-[#1E1E1E] bg-white px-2 py-0.5 rounded border border-[#E5E5E5] group-hover:border-[#0D99FF] group-hover:text-[#0D99FF] transition-colors">
                          {displayId}
                        </span>
                        {isExternal && (
                          <span className="bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1">
                            <ExternalLink size={12} /> External
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${iconConfig.badgeClass}`}>
                          {iconConfig.label}
                        </span>
                        {getRiskBadge(task)}
                      </div>

                      {/* Clean Sanitized Title */}
                      <h3 className="text-sm sm:text-base font-bold text-[#1E1E1E] break-all break-words min-w-0 [overflow-wrap:anywhere] flex items-center gap-1.5 flex-wrap leading-snug group-hover:text-[#0D99FF] transition-colors">
                        {typeBadge && (
                          <span className="text-[#666666] font-semibold">
                            [{typeBadge}]
                          </span>
                        )}
                        <span>{sanitizeTitle(task.title)}</span>
                      </h3>

                      {/* Footer Metadata with Localized DateTime */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#666666] pt-0.5">
                        {isExternal ? (
                          <span>สถานะ: <span className="font-semibold text-[#0D99FF]">{extDoc?.status}</span></span>
                        ) : isDccAdmin && task.description ? (
                          <span className="text-[#666666]">{task.description}</span>
                        ) : null}
                        
                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-[#666666]">
                            <Clock size={12} className="text-[#999999]" />
                            <span>กำหนดส่ง: <strong className="font-mono text-[#1E1E1E]">{formatThaiDateTime(task.dueDate)}</strong></span>
                          </span>
                        )}
                        
                        {task.cancelDate && (
                          <span className="flex items-center gap-1 text-[#E02424]">
                            <Calendar size={12} className="text-[#F98080]" />
                            <span>วันตัดสิทธิ์: <strong className="font-mono text-[#E02424]">{formatThaiDateTime(task.cancelDate)}</strong></span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="text-[#CCCCCC] group-hover:text-[#0D99FF] group-hover:translate-x-0.5 transition-all shrink-0" size={18} />
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
