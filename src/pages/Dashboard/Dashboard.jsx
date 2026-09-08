import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import { 
  AlertCircle, Clock, CheckCircle, FileText, Activity, 
  Search, Plus, FileEdit, Library, Briefcase, Copy,
  FilterX, Trash2, Edit, ClipboardCheck, Eye, AlertTriangle, ChevronRight,
  Sparkles, Printer
} from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { isActionableTask, isLevel6Plus, isReceiptTask } from '../../utils/taskFilter';
import { isDarDraft, isDarRequester } from '../../utils/darHelper';

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
    if (!t) return false;
    if (isLevel6Plus(currentUser) && isReceiptTask(t)) return false;
    return isActionableTask(t, currentUser) || t.assigneeId === currentUser?.id;
  };

  const myTasks = (tasks || []).filter(t => isMyTask(t));

  // Tab 1: Group 1: My Requests (คำขอของฉัน - Strict Personal Scoping)
  const userDars = (dars || []).filter(d => isDarRequester(d, currentUser));
  const myDraftCount = userDars.filter(d => isDarDraft(d)).length;
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
    return (i.status === 'PENDING_RECALL' || i.status === 'DAMAGED_PENDING_RECALL' || i.status === 'SUPERSEDED_PENDING_RECALL' || i.status === 'OBSOLETE_PENDING_RECALL') || (doc && (doc.status === 'SUPERSEDED_ARCHIVED' || doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED') && (i.status === 'ACTIVE' || i.status === 'ISSUED_ACTIVE'));
  }).length;
  const replacementRequestCount = (controlledCopyInstances || []).filter(i => i.status === 'REPLACEMENT_REQUESTED').length;

  // 2. Recent DARs Filtering Logic (Enforcing Universal Draft Privacy)
  let recentDars = (dars || []).filter(d => {
    // Universal Draft Privacy: drafts are visible ONLY to their creator
    if (isDarDraft(d)) {
      return isDarRequester(d, currentUser);
    }
    return true;
  });

  if (!isAdmin) {
    if (currentUser?.level <= 3) {
      recentDars = recentDars.filter(d => isDarRequester(d, currentUser));
    } else {
      const myTaskDarIds = myTasks.map(t => t.darId).filter(Boolean);
      recentDars = recentDars.filter(d => isDarRequester(d, currentUser) || myTaskDarIds.includes(d.id));
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
      recentDars = recentDars.filter(d => isDarDraft(d) && isDarRequester(d, currentUser));
    } else if (activeCardFilter === 'MY_IN_PROGRESS') {
      recentDars = recentDars.filter(d => ['UNDER_REVIEW', 'PENDING_APPROVAL', 'WAITING_ACKNOWLEDGEMENT'].includes(d.status) && isDarRequester(d, currentUser));
    } else if (activeCardFilter === 'MY_RETURNED') {
      recentDars = recentDars.filter(d => d.status === 'RETURNED_FOR_REVISION' && isDarRequester(d, currentUser));
    } else if (activeCardFilter === 'MY_WAITING') {
      recentDars = recentDars.filter(d => ['WAITING_EFFECTIVE', 'APPROVED_WAITING_EFFECTIVE', 'WAITING_ACKNOWLEDGEMENT'].includes(d.status) && isDarRequester(d, currentUser));
    } else if (activeCardFilter === 'MY_CANCELLED') {
      recentDars = recentDars.filter(d => d.status === 'CANCELLED_OVERDUE' && isDarRequester(d, currentUser));
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
    if (!dar) return '-';
    if (dar.status === 'DRAFT') {
      const user = (masterUsers || []).find(u => u && u.id === dar.requesterId);
      return <span className="text-slate-600 font-semibold">{user ? user.name : (dar.requesterId || '-')} (ผู้ร้องขอ)</span>;
    } else if (dar.status === 'APPROVED_WAITING_EFFECTIVE' || dar.status === 'WAITING_EFFECTIVE') {
      return <span className="text-slate-400 font-medium">-</span>;
    } else if (dar.status === 'UNDER_REVIEW' || dar.status === 'PENDING_APPROVAL' || dar.status === 'WAITING_ACKNOWLEDGEMENT') {
      const activeTasks = (tasks || []).filter(t => t && t.darId === dar.id);
      if (activeTasks.length > 0) {
        const handlerNames = activeTasks.map(t => {
           const user = (masterUsers || []).find(u => u && u.id === t.assigneeId);
           const role = t.type === 'Review' ? 'ผู้ทบทวน' : t.type === 'Approve' ? 'ผู้อนุมัติ' : 'ผู้รับทราบ';
           return user ? `${user.name} (${role})` : (t.assigneeId || 'ผู้รับผิดชอบ');
        });
        return <span className="text-slate-900 font-bold">{handlerNames.join(', ')}</span>;
      }
      return '-';
    } else if (dar.status === 'RETURNED_FOR_REVISION') {
      const user = (masterUsers || []).find(u => u && u.id === dar.requesterId);
      return <span className="text-rose-600 font-bold">{user ? user.name : (dar.requesterId || '-')} (ผู้ร้องขอ - แก้ไข)</span>;
    }
    return '-';
  };

  const isDraftDar = (dar) => isDarDraft(dar);

  const renderActionButtons = (dar) => {
    if (!dar) return null;
    if (dar.isTask) {
      return (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/tasks/approve-replacement/${dar.taskId}`);
          }}
          className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all active:scale-90 cursor-pointer"
          title="ดำเนินการอนุมัติ"
        >
          <ClipboardCheck size={18} />
        </button>
      );
    }
    
    const canManageDraft = isDarRequester(dar, currentUser);
    const activeTask = (tasks || []).find(t => t && t.darId === dar.id && isMyTask(t));
    
    if (isDraftDar(dar) && canManageDraft) {
      return (
        <div className="flex items-center gap-1 justify-center">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const basePath = (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') ? '/dcc/dar/new/document' : 
                              (dar.type === 'REVISION' || dar.type === 'REVISE') ? '/dcc/dar/new/revision' : 
                              '/dcc/dar/new/obsolete';
              navigate(`${basePath}?draftId=${encodeURIComponent(dar.id)}`, {
                state: { draftId: dar.id, draftData: dar }
              });
            }}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90 cursor-pointer"
            title="แก้ไขต่อ (Resume Draft)"
          >
            <Edit size={16} />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (typeof window !== 'undefined' && window.confirm('คุณต้องการลบแบบร่างนี้ทิ้งใช่หรือไม่?')) {
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

    if (dar.status === 'RETURNED_FOR_REVISION' && isDarRequester(dar, currentUser)) {
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
    if (!status) return <span className="badge-draft">-</span>;
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
      default: return <span className="badge-active">{String(status).replace(/_/g, ' ')}</span>;
    }
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-12 w-full max-w-full overflow-hidden">
      
      {/* ========================================================================= */}
      {/* SECTION 1: FIGMA PROPERTY PANEL HERO BANNER                              */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden card-surface p-7 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* Left: Welcome info & status badges */}
          <div className="space-y-3">
            {/* Top Badges */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ศูนย์ควบคุมระบบคุณภาพ (QMS Command)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ระบบพร้อมใช้งาน</span>
              </span>
            </div>

            {/* Heading & User Name */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
                สวัสดีคุณ, {currentUser?.name || 'ผู้ใช้งาน'}
              </h1>
              <p className="text-sm text-slate-600 mt-1.5 font-medium flex flex-wrap items-center gap-2">
                <span>{currentUser?.position || 'เจ้าหน้าที่'}</span>
                <span className="text-slate-300">•</span>
                <span className="text-blue-600 font-semibold">สังกัดฝ่าย/แผนก {currentUser?.department || 'PD'}</span>
                {isAdmin && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-amber-600 font-medium">วันจำลอง SLA: {simulatedDate}</span>
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
                  onClick={() => navigate('/dcc/library')}
                  className="btn-primary"
                >
                  <Library className="w-4 h-4" />
                  <span>คลังเอกสารแม่บท</span>
                </button>
                <button
                  onClick={simulateNextDay}
                  className="btn-secondary"
                  title="จำลองวันเพื่อทดสอบระบบ SLA"
                >
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>จำลองข้ามวัน</span>
                </button>
                <button
                  onClick={() => navigate('/controlled-copy?tab=ACTION_REQUIRED')}
                  className="btn-secondary"
                >
                  <span>ประวัติแจกจ่าย</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
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
                  <FileEdit className="w-4 h-4 text-blue-600" />
                  <span>ขอแก้ไขเอกสาร</span>
                </button>
                <button
                  onClick={() => navigate('/library')}
                  className="btn-secondary"
                >
                  <Library className="w-4 h-4 text-slate-400" />
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
                  <Library className="w-4 h-4 text-slate-400" />
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
            {isAdmin ? (
              <>
                <button
                  onClick={() => { setActiveOverviewTab('ALL_REQUESTS'); setActiveCardFilter(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                    activeOverviewTab === 'ALL_REQUESTS' 
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 border border-transparent'
                  }`}
                >
                  <Briefcase size={16} className={activeOverviewTab === 'ALL_REQUESTS' ? 'text-blue-600' : 'text-slate-400'} />
                  <span>ภาพรวมระบบ</span>
                </button>
                <button
                  onClick={() => { setActiveOverviewTab('DOC_CONTROL'); setActiveCardFilter(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                    activeOverviewTab === 'DOC_CONTROL' 
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 border border-transparent'
                  }`}
                >
                  <Copy size={16} className={activeOverviewTab === 'DOC_CONTROL' ? 'text-blue-600' : 'text-slate-400'} />
                  <span>งานควบคุมเอกสาร</span>
                  {(pendingPrintCount + pendingRecallCount + replacementRequestCount) > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono">
                      {pendingPrintCount + pendingRecallCount + replacementRequestCount}
                    </span>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setActiveOverviewTab('ALL_REQUESTS'); setActiveCardFilter(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                    activeOverviewTab === 'ALL_REQUESTS' 
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 border border-transparent'
                  }`}
                >
                  <Briefcase size={16} className={activeOverviewTab === 'ALL_REQUESTS' ? 'text-blue-600' : 'text-slate-400'} />
                  <span>คำขอของฉัน</span>
                </button>
                <button
                  onClick={() => { setActiveOverviewTab('ACTION_REQUIRED'); setActiveCardFilter(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${currentUser?.level <= 3 ? 'opacity-50 cursor-not-allowed' : ''} ${
                    activeOverviewTab === 'ACTION_REQUIRED' 
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 border border-transparent'
                  }`}
                  disabled={currentUser?.level <= 3}
                >
                  <Activity size={16} className={activeOverviewTab === 'ACTION_REQUIRED' ? 'text-blue-600' : 'text-slate-400'} />
                  <span>งานที่ต้องจัดการ</span>
                  {myTasks.length > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono">
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
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
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
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 group cursor-pointer flex flex-col justify-between h-34 card-surface-hover ${
                activeCardFilter === 'MY_DRAFT' 
                  ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/40 shadow-xs' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">ฉบับร่าง</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Edit size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-slate-900 font-mono tracking-tight">
                  {myDraftCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">ฉบับ</span>
              </div>
            </div>

            {/* Tile 2: In Progress */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'MY_IN_PROGRESS' ? '' : 'MY_IN_PROGRESS')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 group cursor-pointer flex flex-col justify-between h-34 card-surface-hover ${
                activeCardFilter === 'MY_IN_PROGRESS' 
                  ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/40 shadow-xs' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">กำลังดำเนินการ</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Clock size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-slate-900 font-mono tracking-tight">
                  {myInProgressCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">ฉบับ</span>
              </div>
            </div>

            {/* Tile 3: Returned for Revision */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'MY_RETURNED' ? '' : 'MY_RETURNED')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 group cursor-pointer flex flex-col justify-between h-34 card-surface-hover ${
                activeCardFilter === 'MY_RETURNED' 
                  ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/40 shadow-xs' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">ส่งกลับแก้ไข</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <AlertCircle size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-slate-900 font-mono tracking-tight">
                  {myReturnedCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">ฉบับ</span>
              </div>
            </div>

            {/* Tile 4: Waiting Effective */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'MY_WAITING' ? '' : 'MY_WAITING')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 group cursor-pointer flex flex-col justify-between h-34 card-surface-hover ${
                activeCardFilter === 'MY_WAITING' 
                  ? 'border-amber-400 ring-2 ring-amber-100 bg-amber-50/40 shadow-xs' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">รอประกาศใช้</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CheckCircle size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-slate-900 font-mono tracking-tight">
                  {myWaitingCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">ฉบับ</span>
              </div>
            </div>

            {/* Tile 5: Cancelled / Overdue */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'MY_CANCELLED' ? '' : 'MY_CANCELLED')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 group cursor-pointer flex flex-col justify-between h-34 card-surface-hover ${
                activeCardFilter === 'MY_CANCELLED' 
                  ? 'border-slate-400 ring-2 ring-slate-100 bg-slate-50/60 shadow-xs' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">ยกเลิก/หมดอายุ</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Trash2 size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-slate-900 font-mono tracking-tight">
                  {myCancelledCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">ฉบับ</span>
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
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 card-surface-hover group cursor-pointer flex flex-col justify-between h-34 ${
                activeCardFilter === 'ACTION_REVIEW' 
                  ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/40 shadow-xs' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">รอการทบทวน</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Clock size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-blue-700 font-mono tracking-tight">
                  {actionReviewCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">รายการ</span>
              </div>
            </div>

            {/* Tile 2: Approve */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'ACTION_APPROVE' ? '' : 'ACTION_APPROVE')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 card-surface-hover group cursor-pointer flex flex-col justify-between h-34 ${
                activeCardFilter === 'ACTION_APPROVE' 
                  ? 'border-violet-400 ring-2 ring-violet-100 bg-violet-50/40 shadow-xs' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">รอการอนุมัติ</span>
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-700 border border-violet-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CheckCircle size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-violet-700 font-mono tracking-tight">
                  {actionApproveCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">รายการ</span>
              </div>
            </div>

            {/* Tile 3: Due Soon */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'ACTION_DUE_SOON' ? '' : 'ACTION_DUE_SOON')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 card-surface-hover group cursor-pointer flex flex-col justify-between h-34 ${
                activeCardFilter === 'ACTION_DUE_SOON' 
                  ? 'border-amber-400 ring-2 ring-amber-100 bg-amber-50/40 shadow-xs' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">ใกล้ครบกำหนด</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Clock size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-amber-700 font-mono tracking-tight">
                  {actionDueSoonCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">รายการ</span>
              </div>
            </div>

            {/* Tile 4: Overdue */}
            <div 
              onClick={() => setActiveCardFilter(activeCardFilter === 'ACTION_OVERDUE' ? '' : 'ACTION_OVERDUE')} 
              className={`relative overflow-hidden rounded-xl p-5 border transition-all duration-200 card-surface-hover group cursor-pointer flex flex-col justify-between h-34 ${
                activeCardFilter === 'ACTION_OVERDUE' 
                  ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/40 shadow-xs' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">เกินกำหนด</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <AlertTriangle size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-rose-700 font-mono tracking-tight">
                  {actionOverdueCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">รายการ</span>
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: DCC Doc Control 3-Tile Bento Grid */}
        {isAdmin && activeOverviewTab === 'DOC_CONTROL' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Tile 1: Pending Print */}
            <div 
              onClick={() => navigate('/controlled-copy?tab=PENDING_ISSUE')}
              className="relative overflow-hidden rounded-xl p-5 border border-slate-200 bg-white card-surface-hover transition-all duration-200 group cursor-pointer flex flex-col justify-between h-34"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">รอพิมพ์แจกจ่าย</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Printer size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-slate-900 font-mono tracking-tight">
                  {pendingPrintCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">เล่ม</span>
              </div>
            </div>

            {/* Tile 2: Pending Recall */}
            <div 
              onClick={() => navigate('/controlled-copy?tab=RECALL_CHECKLIST')}
              className="relative overflow-hidden rounded-xl p-5 border border-slate-200 bg-white card-surface-hover transition-all duration-200 group cursor-pointer flex flex-col justify-between h-34"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">รอเรียกคืน</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Clock size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-slate-900 font-mono tracking-tight">
                  {pendingRecallCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">เล่ม</span>
              </div>
            </div>

            {/* Tile 3: Replacement Requests */}
            <div 
              onClick={() => navigate('/tasks')}
              className="relative overflow-hidden rounded-xl p-5 border border-slate-200 bg-white card-surface-hover transition-all duration-200 group cursor-pointer flex flex-col justify-between h-34"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight">คำขอทดแทน</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <AlertTriangle size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl sm:text-4xl font-bold text-rose-700 font-mono tracking-tight">
                  {replacementRequestCount}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">คำขอ</span>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: ACTIVITY STREAM LEDGER (RECENT DARS TABLE)                     */}
      {/* ========================================================================= */}
      <div className="card-surface overflow-hidden">
        
        {/* Modern Toolbar */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <FileText className="text-blue-600" size={20} />
              <span>{activeOverviewTab === 'DOC_CONTROL' ? 'รายการงานควบคุมสำเนาและแจกจ่าย' : 'รายการคำร้อง DAR และงานล่าสุด'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeOverviewTab === 'DOC_CONTROL' 
                ? 'ติดตามสำเนาควบคุมและเอกสารที่ต้องดำเนินการ' 
                : 'ติดตามสถานะคำร้อง DAR ทั้งหมดในความรับผิดชอบของคุณ'}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
              >
                <FilterX size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto w-full max-w-full">
          {recentDars.length > 0 ? (
            <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[960px]">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3.5 w-20 min-w-[80px] text-center select-none">จัดการ</th>
                  <th className="px-4 py-3.5 w-40 min-w-[140px] font-mono select-none">เลขที่ DAR</th>
                  <th className="px-4 py-3.5 min-w-[220px] select-none">ชื่อเอกสาร / หัวข้อ</th>
                  <th className="px-4 py-3.5 w-28 min-w-[100px] select-none">ประเภท</th>
                  {isAdmin && <th className="px-4 py-3.5 w-24 min-w-[80px] select-none">แผนก</th>}
                  <th className="px-4 py-3.5 w-36 min-w-[130px] select-none">สถานะ</th>
                  <th className="px-4 py-3.5 w-48 min-w-[160px] select-none">ผู้รับผิดชอบปัจจุบัน</th>
                  <th className="px-4 py-3.5 w-32 min-w-[110px] text-right font-mono select-none">วันที่ยื่น</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {recentDars.map((dar) => (
                  <tr 
                    key={dar.id} 
                    className="hover:bg-slate-50/80 border-b border-slate-100 transition-colors cursor-pointer group"
                    onClick={() => {
                      if (dar.isTask) {
                        navigate(`/tasks/approve-replacement/${dar.taskId}`);
                      } else if (isDraftDar(dar)) {
                        const basePath = (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') ? '/dcc/dar/new/document' : 
                                        (dar.type === 'REVISION' || dar.type === 'REVISE') ? '/dcc/dar/new/revision' : 
                                        '/dcc/dar/new/obsolete';
                        navigate(`${basePath}?draftId=${encodeURIComponent(dar.id)}`, {
                          state: { draftId: dar.id, draftData: dar }
                        });
                      } else {
                        navigate(`/dar/${dar.id}`);
                      }
                    }}
                  >
                    <td className="px-4 py-3.5 text-center">
                      {renderActionButtons(dar)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {isDraftDar(dar) ? (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            const basePath = (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') ? '/dcc/dar/new/document' : 
                                            (dar.type === 'REVISION' || dar.type === 'REVISE') ? '/dcc/dar/new/revision' : 
                                            '/dcc/dar/new/obsolete';
                            navigate(`${basePath}?draftId=${encodeURIComponent(dar.id)}`, {
                              state: { draftId: dar.id, draftData: dar }
                            });
                          }}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer transition-colors"
                          title="คลิกเพื่อแก้ไขแบบร่างต่อ"
                        >
                          ฉบับร่าง (Draft)
                        </span>
                      ) : (
                        <span 
                          className="text-[#0D99FF] bg-[#E5F4FF] px-2 py-1 rounded-md border border-[#B8E1FF] inline-block font-mono font-bold text-xs sm:text-sm hover:underline cursor-pointer transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            dar.isTask ? navigate(`/tasks/approve-replacement/${dar.taskId}`) : navigate(`/dar/${dar.id}`);
                          }}
                        >
                          {dar.darNumber || dar.dar_no || dar.darNo || (isDarDraft(dar) ? 'ฉบับร่าง (Draft)' : (dar.id || '-'))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[#1E1E1E] break-all break-words min-w-0 [overflow-wrap:anywhere] group-hover:text-[#0D99FF] transition-colors" title={dar.title}>
                      {dar.title || '-'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-[#F5F5F5] text-[#666666] rounded-md font-mono text-[10px] font-medium uppercase tracking-wider border border-[#E5E5E5]">
                          {({'NEW': 'จัดทำใหม่', 'NEW_DOCUMENT': 'จัดทำใหม่', 'REVISION': 'ขอแก้ไข', 'REVISE': 'ขอแก้ไข', 'OBSOLETE': 'ขอยกเลิก', 'REPLACEMENT': 'ขอสำเนาทดแทน'})[dar.type] || dar.type || '-'}
                        </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5 text-[#444444] font-medium font-mono text-xs whitespace-nowrap">
                        {dar.department || '-'}
                      </td>
                    )}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getStatusBadge(dar.status)}
                    </td>
                    <td className="px-4 py-3.5 text-[#666666] whitespace-nowrap min-w-0 truncate text-xs sm:text-sm font-medium">
                      {dar.isTask ? 'ผู้จัดการแผนก' : getCurrentHandler(dar)}
                    </td>
                    <td className="px-4 py-3.5 text-[#999999] text-right font-mono text-xs sm:text-sm whitespace-nowrap font-medium">
                      {dar.date || '-'}
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
