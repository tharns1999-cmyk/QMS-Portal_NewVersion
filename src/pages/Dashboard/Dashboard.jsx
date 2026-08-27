import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import { 
  AlertCircle, Clock, CheckCircle, FileText, Activity, 
  Search, Plus, FileEdit, Library, Briefcase, Copy,
  FilterX, Trash2, Edit, ClipboardCheck, Eye, AlertTriangle, ChevronRight,
  Sparkles, ArrowRight, Printer
} from 'lucide-react';
import EmptyState from '../../components/EmptyState';

const Dashboard = () => {
  const navigate = useNavigate();
  const { 
    currentUser, 
    tasks, 
    dars, 
    documents,
    controlledCopyInstances,
    masterUsers, 
    simulatedDate, 
    simulateNextDay,
    deleteDar
  } = useStore();
  
  // States for Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [activeCardFilter, setActiveCardFilter] = useState('');
  const [activeOverviewTab, setActiveOverviewTab] = useState('ALL_REQUESTS'); // Tabs for System Overview

  const isAdmin = currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.id === 'u5' || currentUser?.id === 'U001';

  // 1. Calculate Stats (Split into Group 1 and Group 2)
  const isMyTask = (t) => {
    if (isAdmin) return true;
    const userDepts = currentUser?.depts || (currentUser?.department ? [currentUser.department] : []);
    const taskAssigneeId = t.assigneeId || t.assignee_id || t.assignedToUserId;
    const isHardcopyReceipt = (t.type === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || t.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || t.type === 'CONFIRM_RECEIPT' || t.task_type === 'CONFIRM_RECEIPT');

    if (isHardcopyReceipt) {
      if (taskAssigneeId) {
        return taskAssigneeId === currentUser?.id || (t.assigneeName && t.assigneeName === currentUser?.name);
      }
      return t.assignedToDept && userDepts.includes(t.assignedToDept);
    }

    const isDeptMatched = t.currentHandlerDepartment && userDepts.includes(t.currentHandlerDepartment);
    const isLevelMatched = Number(t.currentHandlerLevel) === Number(currentUser?.level);
    return (taskAssigneeId && (taskAssigneeId === currentUser?.id || t.assigneeName === currentUser?.name)) || 
      (isDeptMatched && isLevelMatched) || 
      (!taskAssigneeId && t.assignedToDept && userDepts.includes(t.assignedToDept));
  };

  const myTasks = (tasks || []).filter(t => isMyTask(t));

  // Tab 1: Group 1: My Requests (คำขอของฉัน)
  const userDars = (dars || []).filter(d => isAdmin || d.requesterId === currentUser?.id);
  const myDraftCount = userDars.filter(d => d.status === 'DRAFT').length;
  const myInProgressCount = userDars.filter(d => ['UNDER_REVIEW', 'PENDING_APPROVAL', 'WAITING_ACKNOWLEDGEMENT'].includes(d.status)).length;
  const myReturnedCount = userDars.filter(d => d.status === 'RETURNED_FOR_REVISION').length;
  const myWaitingCount = userDars.filter(d => ['WAITING_EFFECTIVE', 'APPROVED_WAITING_EFFECTIVE'].includes(d.status)).length;
  const myCancelledCount = userDars.filter(d => d.status === 'CANCELLED_OVERDUE').length;

  // Tab 2: Group 2: Action Required (งานที่ต้องจัดการ)
  const actionReviewTasks = myTasks.filter(t => t.type === 'Review');
  const actionApproveTasks = myTasks.filter(t => t.type === 'Approve' || t.type === 'CC_REPLACEMENT_APPROVAL');
  
  const actionReviewCount = isAdmin 
    ? (dars || []).filter(d => d.status === 'UNDER_REVIEW').length 
    : actionReviewTasks.length;
    
  const actionApproveCount = isAdmin 
    ? (dars || []).filter(d => d.status === 'PENDING_APPROVAL').length + (tasks || []).filter(t => t.type === 'CC_REPLACEMENT_APPROVAL').length
    : actionApproveTasks.length;
    
  const actionDueSoonCount = myTasks.filter(t => t.status === 'DUE_SOON').length;
  const actionOverdueCount = myTasks.filter(t => t.status === 'OVERDUE').length;

  // Tab 3: DCC Document Control Counts
  const pendingPrintCount = (controlledCopyInstances || []).filter(i => i.status === 'PENDING_ISSUE' || i.status === 'PENDING_RECEIPT').length;
  const pendingRecallCount = (controlledCopyInstances || []).filter(i => {
    const doc = (documents || []).find(d => d.id === (i.doc_id || i.docId));
    return (i.status === 'PENDING_RECALL') || (doc && (doc.status === 'SUPERSEDED_ARCHIVED' || doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED') && (i.status === 'ACTIVE' || i.status === 'ISSUED_ACTIVE'));
  }).length;
  const replacementRequestCount = (controlledCopyInstances || []).filter(i => i.status === 'REPLACEMENT_REQUESTED').length;

  // 2. Recent DARs Filtering Logic
  let recentDars = [...(dars || [])];

  if (!isAdmin) {
    if (currentUser?.level <= 3) {
      recentDars = recentDars.filter(d => d.requesterId === currentUser?.id);
    } else {
      const myTaskDarIds = myTasks.map(t => t.darId).filter(Boolean);
      recentDars = recentDars.filter(d => d.requesterId === currentUser?.id || myTaskDarIds.includes(d.id));
    }
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    recentDars = recentDars.filter(d => 
      (d.id || '').toLowerCase().includes(term) ||
      (d.title || '').toLowerCase().includes(term) ||
      (d.department || '').toLowerCase().includes(term)
    );
  }

  if (activeCardFilter) {
    if (activeCardFilter === 'MY_DRAFT') {
      recentDars = recentDars.filter(d => d.status === 'DRAFT' && (isAdmin || d.requesterId === currentUser?.id));
    } else if (activeCardFilter === 'MY_IN_PROGRESS') {
      recentDars = recentDars.filter(d => ['UNDER_REVIEW', 'PENDING_APPROVAL', 'WAITING_ACKNOWLEDGEMENT'].includes(d.status) && (isAdmin || d.requesterId === currentUser?.id));
    } else if (activeCardFilter === 'MY_RETURNED') {
      recentDars = recentDars.filter(d => d.status === 'RETURNED_FOR_REVISION' && (isAdmin || d.requesterId === currentUser?.id));
    } else if (activeCardFilter === 'MY_WAITING') {
      recentDars = recentDars.filter(d => ['WAITING_EFFECTIVE', 'APPROVED_WAITING_EFFECTIVE', 'WAITING_ACKNOWLEDGEMENT'].includes(d.status) && (isAdmin || d.requesterId === currentUser?.id));
    } else if (activeCardFilter === 'MY_CANCELLED') {
      recentDars = recentDars.filter(d => d.status === 'CANCELLED_OVERDUE' && (isAdmin || d.requesterId === currentUser?.id));
    } else if (activeCardFilter === 'ACTION_REVIEW') {
      const matchingDarIds = isAdmin ? (dars || []).filter(d => d.status === 'UNDER_REVIEW').map(d => d.id) : actionReviewTasks.map(t => t.darId);
      recentDars = recentDars.filter(d => matchingDarIds.includes(d.id));
    } else if (activeCardFilter === 'ACTION_APPROVE') {
      const matchingDarIds = isAdmin ? (dars || []).filter(d => d.status === 'PENDING_APPROVAL').map(d => d.id) : actionApproveTasks.map(t => t.darId);
      recentDars = recentDars.filter(d => matchingDarIds.includes(d.id));
    } else if (activeCardFilter === 'ACTION_DUE_SOON') {
      const matchingDarIds = isAdmin ? (tasks || []).filter(t => t.status === 'DUE_SOON').map(t => t.darId) : myTasks.filter(t => t.status === 'DUE_SOON').map(t => t.darId);
      recentDars = recentDars.filter(d => matchingDarIds.includes(d.id));
    } else if (activeCardFilter === 'ACTION_OVERDUE') {
      const matchingDarIds = isAdmin ? (tasks || []).filter(t => t.status === 'OVERDUE').map(t => t.darId) : myTasks.filter(t => t.status === 'OVERDUE').map(t => t.darId);
      recentDars = recentDars.filter(d => matchingDarIds.includes(d.id));
    } else if (activeCardFilter === 'DCC_PENDING') {
      recentDars = recentDars.filter(d => d.status === 'APPROVED_WAITING_EFFECTIVE');
    }
  }

  // Inject CC_REPLACEMENT_APPROVAL tasks into the table if viewing ALL or ACTION_APPROVE
  if (!activeCardFilter || activeCardFilter === 'ACTION_APPROVE') {
    const replacementTasks = (tasks || []).filter(t => t.type === 'CC_REPLACEMENT_APPROVAL' && isMyTask(t));
    const formattedReplacements = replacementTasks.map(t => {
      const inst = (controlledCopyInstances || []).find(i => i.id === t.instanceId);
      return {
        isTask: true,
        id: inst ? inst.ccNumber : t.id,
        taskId: t.id,
        title: t.title,
        type: 'REPLACEMENT',
        department: inst ? inst.department : '',
        status: t.status,
        date: t.dueDate,
        requesterId: inst ? inst.reportRequesterId : ''
      };
    });
    
    let validMocks = formattedReplacements;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      validMocks = validMocks.filter(d => (d.id || '').toLowerCase().includes(term) || (d.title || '').toLowerCase().includes(term));
    }
    recentDars = [...recentDars, ...validMocks];
  }

  const availableDarTypes = [...new Set(recentDars.map(d => d.type))].filter(Boolean).sort();

  if (filterType) {
    recentDars = recentDars.filter(d => d.type === filterType);
  }
  
  recentDars.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  recentDars = recentDars.slice(0, 10);

  const getCurrentHandler = (dar) => {
    if (dar.status === 'DRAFT') {
      const user = (masterUsers || []).find(u => u.id === dar.requesterId);
      return <span className="text-slate-600 font-semibold">{user ? user.name : dar.requesterId} (ผู้ร้องขอ)</span>;
    } else if (dar.status === 'APPROVED_WAITING_EFFECTIVE' || dar.status === 'WAITING_EFFECTIVE') {
      return <span className="text-slate-400 font-medium">-</span>;
    } else if (dar.status === 'UNDER_REVIEW' || dar.status === 'PENDING_APPROVAL' || dar.status === 'WAITING_ACKNOWLEDGEMENT') {
      const activeTasks = (tasks || []).filter(t => t.darId === dar.id);
      if (activeTasks.length > 0) {
        const handlerNames = activeTasks.map(t => {
           const user = (masterUsers || []).find(u => u.id === t.assigneeId);
           const role = t.type === 'Review' ? 'ผู้ทบทวน' : t.type === 'Approve' ? 'ผู้อนุมัติ' : 'ผู้รับทราบ';
           return user ? `${user.name} (${role})` : t.assigneeId;
        });
        return <span className="text-slate-900 font-bold">{handlerNames.join(', ')}</span>;
      }
      return '-';
    } else if (dar.status === 'RETURNED_FOR_REVISION') {
      const user = (masterUsers || []).find(u => u.id === dar.requesterId);
      return <span className="text-rose-600 font-bold">{user ? user.name : dar.requesterId} (ผู้ร้องขอ - แก้ไข)</span>;
    }
    return '-';
  };

  const renderActionButtons = (dar) => {
    if (dar.isTask) {
      return (
        <button 
          onClick={() => navigate(`/tasks/approve-replacement/${dar.taskId}`)}
          className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all active:scale-90 cursor-pointer"
          title="ดำเนินการอนุมัติ"
        >
          <ClipboardCheck size={18} />
        </button>
      );
    }
    
    const isRequesterOfDar = dar.requesterId === currentUser?.id;
    const activeTask = (tasks || []).find(t => t.darId === dar.id && isMyTask(t));
    
    if (dar.status === 'DRAFT' && isRequesterOfDar) {
      return (
        <div className="flex items-center gap-1 justify-center">
          <button 
            onClick={() => {
              const basePath = dar.type === 'NEW' ? '/dar/new/document' : 
                              dar.type === 'REVISION' ? '/dar/new/revision' : '/dar/new/obsolete';
              navigate(`${basePath}?draftId=${dar.id}`);
            }}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90 cursor-pointer"
            title="แก้ไขต่อ"
          >
            <Edit size={16} />
          </button>
          <button 
            onClick={() => {
              if (window.confirm('คุณต้องการลบแบบร่างนี้ทิ้งใช่หรือไม่?')) {
                deleteDar(dar.id);
              }
            }}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-90 cursor-pointer"
            title="ลบทิ้ง"
          >
            <Trash2 size={16} />
          </button>
        </div>
      );
    }
    
    if (activeTask) {
      const taskRoute = activeTask.type === 'Review' ? `/tasks/review/${activeTask.id}` : 
                        activeTask.type === 'Approve' ? `/tasks/approve/${activeTask.id}` : `/tasks/ack/${activeTask.id}`;
      return (
        <button 
          onClick={() => navigate(taskRoute)}
          className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all active:scale-90 cursor-pointer"
          title="ดำเนินการ"
        >
          <ClipboardCheck size={18} />
        </button>
      );
    }

    if (isAdmin && (dar.status === 'APPROVED_WAITING_EFFECTIVE' || dar.status === 'WAITING_EFFECTIVE')) {
      return (
        <button 
          onClick={() => navigate(`/tasks`)}
          className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all active:scale-90 cursor-pointer"
          title="ดำเนินการ DCC"
        >
          <ClipboardCheck size={18} />
        </button>
      );
    }

    if (dar.status === 'RETURNED_FOR_REVISION' && isRequesterOfDar) {
      return (
        <button 
          onClick={() => navigate(`/tasks/revise/${dar.id}`)}
          className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all active:scale-90 cursor-pointer"
          title="แก้ไขคำขอ"
        >
          <Edit size={16} />
        </button>
      );
    }

    return (
      <button 
        onClick={() => navigate(`/dar/${dar.id}`)}
        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90 cursor-pointer"
        title="ดูรายละเอียด"
      >
        <Eye size={18} />
      </button>
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT': return <span className="badge-draft">ฉบับร่าง</span>;
      case 'UNDER_REVIEW': return <span className="badge-pending">รอการทบทวน</span>;
      case 'PENDING_APPROVAL': return <span className="badge-pending">รอการอนุมัติ</span>;
      case 'CANCELLED': return <span className="badge-rejected">ยกเลิก</span>;
      case 'CANCELLED_OVERDUE': return <span className="badge-rejected">ยกเลิก (เกินกำหนด)</span>;
      case 'RETURNED_FOR_REVISION': return <span className="badge-rejected">ส่งกลับแก้ไข</span>;
      case 'APPROVED_WAITING_EFFECTIVE':
      case 'WAITING_EFFECTIVE': return <span className="badge-pending">รอประกาศใช้</span>;
      case 'EFFECTIVE': return <span className="badge-active">มีผลบังคับใช้</span>;
      case 'OBSOLETE': return <span className="badge-draft">ยกเลิก / ตกรุ่น</span>;
      default: return <span className="badge-active">{status.replace(/_/g, ' ')}</span>;
    }
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-12 w-full max-w-full overflow-hidden">
      
      {/* ========================================================================= */}
      {/* SECTION 1: FIGMA PROPERTY PANEL HERO BANNER                              */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-xl bg-white border border-[#E5E5E5] p-7 sm:p-8 shadow-none">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* Left: Welcome info & status badges */}
          <div className="space-y-3">
            {/* Top Badges */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ศูนย์ควบคุมระบบคุณภาพ (QMS Command)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#14AE5C] animate-pulse" />
                <span>ระบบพร้อมใช้งาน</span>
              </span>
            </div>

            {/* Heading & User Name (Crisp Figma Contrast) */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight leading-tight">
                สวัสดีคุณ, {currentUser?.name || 'ผู้ใช้งาน'}
              </h1>
              <p className="text-sm text-[#666666] mt-1.5 font-medium flex flex-wrap items-center gap-2">
                <span>{currentUser?.position || 'เจ้าหน้าที่'}</span>
                <span className="text-[#CCCCCC]">•</span>
                <span className="text-[#0D99FF] font-semibold">สังกัดฝ่าย/แผนก {currentUser?.department || 'PD'}</span>
                {isAdmin && (
                  <>
                    <span className="text-[#CCCCCC]">•</span>
                    <span className="text-[#D49800] font-medium">วันจำลอง SLA: {simulatedDate}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Right: Modern Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isAdmin ? (
              <>
                <button
                  onClick={() => navigate('/master-list')}
                  className="btn-primary"
                >
                  <Library className="w-4 h-4" />
                  <span>ทะเบียนเอกสารแม่บท</span>
                </button>
                <button
                  onClick={simulateNextDay}
                  className="btn-secondary"
                  title="จำลองวันเพื่อทดสอบระบบ SLA"
                >
                  <Clock className="w-4 h-4 text-[#D49800]" />
                  <span>จำลองข้ามวัน</span>
                </button>
                <button
                  onClick={() => navigate('/controlled-copy?tab=ACTION_REQUIRED')}
                  className="btn-secondary"
                >
                  <span>ประวัติแจกจ่าย</span>
                  <ChevronRight className="w-4 h-4 text-[#666666]" />
                </button>
              </>
            ) : currentUser?.level <= 3 ? (
              <>
                <button
                  onClick={() => navigate('/dar/new')}
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span>สร้างเอกสารใหม่</span>
                </button>
                <button
                  onClick={() => navigate('/dar/new/revision')}
                  className="btn-secondary"
                >
                  <FileEdit className="w-4 h-4 text-[#0D99FF]" />
                  <span>ขอแก้ไขเอกสาร</span>
                </button>
                <button
                  onClick={() => navigate('/library')}
                  className="btn-secondary"
                >
                  <Library className="w-4 h-4 text-[#666666]" />
                  <span>คลังเอกสาร</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/tasks')}
                  className="btn-primary"
                >
                  <Activity className="w-4 h-4" />
                  <span>ตรวจสอบคิวงาน</span>
                </button>
                <button
                  onClick={() => navigate('/library')}
                  className="btn-secondary"
                >
                  <Library className="w-4 h-4 text-[#666666]" />
                  <span>คลังเอกสารแผนก</span>
                </button>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: SYSTEM OVERVIEW & METRIC BENTO TILES                           */}
      {/* ========================================================================= */}
      <div className="space-y-5">
        
        {/* Modern Segmented Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-3">
          <div className="inline-flex p-1 bg-[#F5F5F5] rounded-xl border border-[#EEEEEE] shadow-none gap-1">
            {isAdmin ? (
              <>
                <button
                  onClick={() => { setActiveOverviewTab('ALL_REQUESTS'); setActiveCardFilter(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                    activeOverviewTab === 'ALL_REQUESTS' 
                      ? 'bg-white text-[#1E1E1E] shadow-sm border border-[#E5E5E5]' 
                      : 'text-[#666666] hover:text-[#1E1E1E] hover:bg-[#EBEBEB] border border-transparent'
                  }`}
                >
                  <Briefcase size={16} className={activeOverviewTab === 'ALL_REQUESTS' ? 'text-[#0D99FF]' : 'text-[#999999]'} />
                  <span>ภาพรวมระบบ</span>
                </button>
                <button
                  onClick={() => { setActiveOverviewTab('DOC_CONTROL'); setActiveCardFilter(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                    activeOverviewTab === 'DOC_CONTROL' 
                      ? 'bg-white text-[#1E1E1E] shadow-sm border border-[#E5E5E5]' 
                      : 'text-[#666666] hover:text-[#1E1E1E] hover:bg-[#EBEBEB] border border-transparent'
                  }`}
                >
                  <Copy size={16} className={activeOverviewTab === 'DOC_CONTROL' ? 'text-[#0D99FF]' : 'text-[#999999]'} />
                  <span>งานควบคุมเอกสาร</span>
                  {(pendingPrintCount + pendingRecallCount + replacementRequestCount) > 0 && (
                    <span className="bg-[#F24822] text-white text-[10px] font-medium px-2 py-0.5 rounded-full font-mono shadow-none">
                      {pendingPrintCount + pendingRecallCount + replacementRequestCount}
                    </span>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setActiveOverviewTab('ALL_REQUESTS'); setActiveCardFilter(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                    activeOverviewTab === 'ALL_REQUESTS' 
                      ? 'bg-white text-[#1E1E1E] shadow-sm border border-[#E5E5E5]' 
                      : 'text-[#666666] hover:text-[#1E1E1E] hover:bg-[#EBEBEB] border border-transparent'
                  }`}
                >
                  <Briefcase size={16} className={activeOverviewTab === 'ALL_REQUESTS' ? 'text-[#0D99FF]' : 'text-[#999999]'} />
                  <span>คำขอของฉัน</span>
                </button>
                <button
                  onClick={() => { setActiveOverviewTab('ACTION_REQUIRED'); setActiveCardFilter(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${currentUser?.level <= 3 ? 'opacity-50 cursor-not-allowed' : ''} ${
                    activeOverviewTab === 'ACTION_REQUIRED' 
                      ? 'bg-white text-[#1E1E1E] shadow-sm border border-[#E5E5E5]' 
                      : 'text-[#666666] hover:text-[#1E1E1E] hover:bg-[#EBEBEB] border border-transparent'
                  }`}
                  disabled={currentUser?.level <= 3}
                >
                  <Activity size={16} className={activeOverviewTab === 'ACTION_REQUIRED' ? 'text-[#0D99FF]' : 'text-[#999999]'} />
                  <span>งานที่ต้องจัดการ</span>
                  {myTasks.length > 0 && (
                    <span className="bg-[#F24822] text-white text-[10px] font-medium px-2 py-0.5 rounded-full font-mono shadow-none">
                      {myTasks.length}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>

          {activeCardFilter && (
            <button
              onClick={() => setActiveCardFilter('')}
              className="text-xs font-medium text-[#0D99FF] hover:text-[#007BE5] flex items-center gap-1.5 self-start sm:self-auto cursor-pointer bg-[#E5F4FF] px-3 py-1.5 rounded-lg border border-[#B8E1FF]"
            >
              <FilterX size={14} />
              <span>ล้างตัวกรองสถานะ</span>
            </button>
          )}
        </div>

        {/* Tab 1: 5-Tile Bento Grid (My Requests / System Overview) */}
        {activeOverviewTab === 'ALL_REQUESTS' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            
            {/* Tile 1: Draft */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'MY_DRAFT' ? '' : 'MY_DRAFT')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 group cursor-pointer flex flex-col justify-between h-32 ${
                activeCardFilter === 'MY_DRAFT' 
                  ? 'border-[#0D99FF] bg-[#F5F5F5] shadow-none' 
                  : 'border-[#E5E5E5] bg-white hover:border-[#0D99FF] shadow-none'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#666666] uppercase tracking-tight">ฉบับร่าง</span>
                <div className="w-8 h-8 rounded-lg bg-[#F0F0F0] text-[#666666] flex items-center justify-center">
                  <Edit size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-black text-[#1E1E1E] font-mono tracking-normal">
                  {myDraftCount}
                </span>
                <span className="text-xs text-[#999999] ml-1.5 font-medium">ฉบับ</span>
              </div>
            </div>

            {/* Tile 2: In Progress */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'MY_IN_PROGRESS' ? '' : 'MY_IN_PROGRESS')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 group cursor-pointer flex flex-col justify-between h-32 ${
                activeCardFilter === 'MY_IN_PROGRESS' 
                  ? 'border-[#0D99FF] bg-[#E5F4FF] shadow-none' 
                  : 'border-[#E5E5E5] bg-white hover:border-[#0D99FF] shadow-none'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#666666] uppercase tracking-tight">กำลังดำเนินการ</span>
                <div className="w-8 h-8 rounded-lg bg-[#E5F4FF] text-[#0D99FF] flex items-center justify-center">
                  <Clock size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-black text-[#1E1E1E] font-mono tracking-normal">
                  {myInProgressCount}
                </span>
                <span className="text-xs text-[#999999] ml-1.5 font-medium">ฉบับ</span>
              </div>
            </div>

            {/* Tile 3: Returned for Revision */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'MY_RETURNED' ? '' : 'MY_RETURNED')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 group cursor-pointer flex flex-col justify-between h-32 ${
                activeCardFilter === 'MY_RETURNED' 
                  ? 'border-[#F24822] bg-[#FEECE8] shadow-none' 
                  : 'border-[#E5E5E5] bg-white hover:border-[#0D99FF] shadow-none'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#666666] uppercase tracking-tight">ส่งกลับแก้ไข</span>
                <div className="w-8 h-8 rounded-lg bg-[#FEECE8] text-[#F24822] flex items-center justify-center">
                  <AlertCircle size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-black text-[#1E1E1E] font-mono tracking-normal">
                  {myReturnedCount}
                </span>
                <span className="text-xs text-[#999999] ml-1.5 font-medium">ฉบับ</span>
              </div>
            </div>

            {/* Tile 4: Waiting Effective */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'MY_WAITING' ? '' : 'MY_WAITING')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 group cursor-pointer flex flex-col justify-between h-32 ${
                activeCardFilter === 'MY_WAITING' 
                  ? 'border-[#FFCD29] bg-[#FFF7D4] shadow-none' 
                  : 'border-[#E5E5E5] bg-white hover:border-[#0D99FF] shadow-none'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#666666] uppercase tracking-tight">รอประกาศใช้</span>
                <div className="w-8 h-8 rounded-lg bg-[#FFF7D4] text-[#D49800] flex items-center justify-center">
                  <CheckCircle size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-black text-[#1E1E1E] font-mono tracking-normal">
                  {myWaitingCount}
                </span>
                <span className="text-xs text-[#999999] ml-1.5 font-medium">ฉบับ</span>
              </div>
            </div>

            {/* Tile 5: Cancelled / Overdue */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'MY_CANCELLED' ? '' : 'MY_CANCELLED')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 group cursor-pointer flex flex-col justify-between h-32 ${
                activeCardFilter === 'MY_CANCELLED' 
                  ? 'border-[#7B61FF] bg-[#F2EFFF] shadow-none' 
                  : 'border-[#E5E5E5] bg-white hover:border-[#0D99FF] shadow-none'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#666666] uppercase tracking-tight">ยกเลิก/หมดอายุ</span>
                <div className="w-8 h-8 rounded-lg bg-[#F2EFFF] text-[#7B61FF] flex items-center justify-center">
                  <Trash2 size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-black text-[#1E1E1E] font-mono tracking-normal">
                  {myCancelledCount}
                </span>
                <span className="text-xs text-[#999999] ml-1.5 font-medium">ฉบับ</span>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: 4-Tile Bento Grid (Action Required) */}
        {(!isAdmin && activeOverviewTab === 'ACTION_REQUIRED') && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Tile 1: Review */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'ACTION_REVIEW' ? '' : 'ACTION_REVIEW')} 
              className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group cursor-pointer flex flex-col justify-between h-34 ${
                activeCardFilter === 'ACTION_REVIEW' 
                  ? 'border-indigo-600 ring-2 ring-indigo-600 bg-indigo-50/40 shadow-xs' 
                  : 'border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">รอการทบทวน</span>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Clock size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-black text-indigo-600 font-mono tracking-tight">
                  {actionReviewCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">รายการ</span>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 transition-opacity ${activeCardFilter === 'ACTION_REVIEW' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            </div>

            {/* Tile 2: Approve */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'ACTION_APPROVE' ? '' : 'ACTION_APPROVE')} 
              className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group cursor-pointer flex flex-col justify-between h-34 ${
                activeCardFilter === 'ACTION_APPROVE' 
                  ? 'border-violet-600 ring-2 ring-violet-600 bg-violet-50/40 shadow-xs' 
                  : 'border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">รอการอนุมัติ</span>
                <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CheckCircle size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-black text-violet-600 font-mono tracking-tight">
                  {actionApproveCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">รายการ</span>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-violet-600 transition-opacity ${activeCardFilter === 'ACTION_APPROVE' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            </div>

            {/* Tile 3: Due Soon */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'ACTION_DUE_SOON' ? '' : 'ACTION_DUE_SOON')} 
              className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group cursor-pointer flex flex-col justify-between h-34 ${
                activeCardFilter === 'ACTION_DUE_SOON' 
                  ? 'border-amber-500 ring-2 ring-amber-500 bg-amber-50/40 shadow-xs' 
                  : 'border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ใกล้ครบกำหนด</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Clock size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-black text-amber-600 font-mono tracking-tight">
                  {actionDueSoonCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">รายการ</span>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-amber-500 transition-opacity ${activeCardFilter === 'ACTION_DUE_SOON' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            </div>

            {/* Tile 4: Overdue */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'ACTION_OVERDUE' ? '' : 'ACTION_OVERDUE')} 
              className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group cursor-pointer flex flex-col justify-between h-34 ${
                activeCardFilter === 'ACTION_OVERDUE' 
                  ? 'border-rose-500 ring-2 ring-rose-500 bg-rose-50/40 shadow-xs' 
                  : 'border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">เกินกำหนด</span>
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <AlertTriangle size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-black text-rose-600 font-mono tracking-tight">
                  {actionOverdueCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">รายการ</span>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-rose-500 transition-opacity ${activeCardFilter === 'ACTION_OVERDUE' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            </div>

          </div>
        )}

        {/* Tab 3: DCC Doc Control 3-Tile Bento Grid */}
        {isAdmin && activeOverviewTab === 'DOC_CONTROL' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Tile 1: Pending Print */}
            <div 
              onClick={() => navigate('/controlled-copy?tab=PENDING_ISSUE')}
              className="relative overflow-hidden rounded-xl p-5 border border-[#E5E5E5] bg-white hover:border-[#0D99FF] shadow-none transition-all duration-200 group cursor-pointer flex flex-col justify-between h-32"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#666666] uppercase tracking-tight">รอพิมพ์แจกจ่าย</span>
                <div className="w-8 h-8 rounded-lg bg-[#E5F4FF] text-[#0D99FF] flex items-center justify-center">
                  <Printer size={18} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-black text-[#1E1E1E] font-mono tracking-normal">
                  {pendingPrintCount}
                </span>
                <span className="text-xs text-[#999999] ml-1.5 font-medium">เล่ม</span>
              </div>
            </div>

            {/* Tile 2: Pending Recall */}
            <div 
              onClick={() => navigate('/controlled-copy?tab=RECALL_CHECKLIST')}
              className="relative overflow-hidden rounded-xl p-5 border border-[#E5E5E5] bg-white hover:border-[#0D99FF] shadow-none transition-all duration-200 group cursor-pointer flex flex-col justify-between h-32"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#666666] uppercase tracking-tight">รอเรียกคืน</span>
                <div className="w-8 h-8 rounded-lg bg-[#FFF7D4] text-[#D49800] flex items-center justify-center">
                  <Clock size={18} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-black text-[#1E1E1E] font-mono tracking-normal">
                  {pendingRecallCount}
                </span>
                <span className="text-xs text-[#999999] ml-1.5 font-medium">เล่ม</span>
              </div>
            </div>

            {/* Tile 3: Replacement Requests */}
            <div 
              onClick={() => navigate('/tasks')}
              className="relative overflow-hidden rounded-xl p-5 border border-[#E5E5E5] bg-white hover:border-[#0D99FF] shadow-none transition-all duration-200 group cursor-pointer flex flex-col justify-between h-32"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#666666] uppercase tracking-tight">คำขอทดแทน</span>
                <div className="w-8 h-8 rounded-lg bg-[#FEECE8] text-[#F24822] flex items-center justify-center">
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div>
                <span className="text-4xl font-black text-slate-900 font-mono tracking-tight group-hover:text-rose-600 transition-colors">
                  {replacementRequestCount}
                </span>
                <span className="text-xs text-slate-400 ml-2 font-medium">คำขอ</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: ACTIVITY STREAM LEDGER (RECENT DARS TABLE)                     */}
      {/* ========================================================================= */}
      <div className="rounded-xl border border-[#E5E5E5] bg-white overflow-hidden shadow-none">
        
        {/* Glassmorphism Toolbar */}
        <div className="p-5 sm:p-6 border-b border-[#E5E5E5] bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2.5 tracking-tight">
              <FileText className="text-[#0D99FF]" size={20} />
              <span>{activeOverviewTab === 'DOC_CONTROL' ? 'รายการงานควบคุมสำเนาและแจกจ่าย' : 'รายการคำร้อง DAR และงานล่าสุด'}</span>
            </h3>
            <p className="text-xs text-[#666666] mt-0.5">
              {activeOverviewTab === 'DOC_CONTROL' 
                ? 'ติดตามสำเนาควบคุมและเอกสารที่ต้องดำเนินการ' 
                : 'ติดตามสถานะคำร้อง DAR ทั้งหมดในความรับผิดชอบของคุณ'}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" size={16} />
              <input 
                type="text"
                placeholder="ค้นหา DAR No, ชื่อเอกสาร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-primary pl-9"
              />
            </div>

            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              disabled={availableDarTypes.length === 0}
              className="select-primary w-auto pr-8"
            >
              <option value="">ทุกประเภท</option>
              {availableDarTypes.map(t => (
                <option key={t} value={t}>
                  {t === 'NEW' ? 'จัดทำใหม่' : t === 'REVISION' ? 'ขอแก้ไข' : t === 'OBSOLETE' ? 'ขอยกเลิก' : t}
                </option>
              ))}
            </select>

            {(searchTerm || filterType || activeCardFilter) && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('');
                  setActiveCardFilter('');
                }}
                title="ล้างตัวกรอง"
                className="p-2 text-[#999999] hover:text-[#F24822] hover:bg-[#FEECE8] rounded-lg transition-all shadow-none cursor-pointer"
              >
                <FilterX size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto w-full max-w-full">
          {recentDars.length > 0 ? (
            <table className="w-full text-left text-xs sm:text-sm table-fixed border-collapse">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3.5 w-20 text-center select-none">จัดการ</th>
                  <th className="px-4 py-3.5 w-36 font-mono select-none">เลขที่ DAR</th>
                  <th className="px-4 py-3.5 select-none">ชื่อเอกสาร / หัวข้อ</th>
                  <th className="px-4 py-3.5 w-28 select-none">ประเภท</th>
                  {isAdmin && <th className="px-4 py-3.5 w-24 select-none">แผนก</th>}
                  <th className="px-4 py-3.5 w-36 select-none">สถานะ</th>
                  <th className="px-4 py-3.5 w-52 select-none">ผู้รับผิดชอบปัจจุบัน</th>
                  <th className="px-4 py-3.5 w-32 text-right font-mono select-none">วันที่ยื่น</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {recentDars.map((dar) => (
                  <tr key={dar.id} className="table-row group">
                    <td className="px-4 py-3.5 text-center">
                      {renderActionButtons(dar)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono font-medium text-sm">
                      <span 
                        className="text-[#0D99FF] bg-[#E5F4FF] px-2 py-1 rounded-md border border-[#B8E1FF] inline-block hover:underline cursor-pointer transition-all"
                        onClick={() => dar.isTask ? navigate(`/tasks/approve-replacement/${dar.taskId}`) : navigate(`/dar/${dar.id}`)}
                      >
                        {dar.id}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[#1E1E1E] break-all break-words min-w-0 [overflow-wrap:anywhere] group-hover:text-[#0D99FF] transition-colors" title={dar.title}>
                      {dar.title}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-[#F5F5F5] text-[#666666] rounded-md font-mono text-[10px] font-medium uppercase tracking-wider border border-[#E5E5E5]">
                        {dar.type}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5 text-[#444444] font-medium font-mono text-xs whitespace-nowrap">
                        {dar.department}
                      </td>
                    )}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getStatusBadge(dar.status)}
                    </td>
                    <td className="px-4 py-3.5 text-[#666666] whitespace-nowrap min-w-0 truncate text-xs sm:text-sm font-medium">
                      {dar.isTask ? 'ผู้จัดการแผนก' : getCurrentHandler(dar)}
                    </td>
                    <td className="px-4 py-3.5 text-[#999999] text-right font-mono text-xs sm:text-sm whitespace-nowrap font-medium">
                      {dar.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 flex items-center justify-center">
              <EmptyState />
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
