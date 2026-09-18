import React, { useState, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import useStore, { isNotificationVisibleToUser, isNotificationReadByUser } from '../../store/useStore';
import { 
  Home, 
  Inbox, 
  BookOpen, 
  FilePlus2, 
  FileText, 
  Globe, 
  FolderGit2, 
  CalendarDays, 
  Files, 
  SlidersHorizontal, 
  History, 
  Sparkles, 
  RotateCcw, 
  Trash2, 
  CheckCircle2, 
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationPopover from './NotificationPopover';
import { isActionableTask, isDccAdmin as checkDccAdmin } from '../../utils/taskFilter';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    currentUser, requestUsers, reviewUsers, approveUsers, tasks, controlledCopyInstances, documents, 
    masterUsers, setCurrentUser, switchUser, notifications,
    resetTransactionDataToCleanSlate, seedComprehensiveQaMockData, externalRequests
  } = useStore();
  
  const [isCleanSlateOpen, setIsCleanSlateOpen] = useState(false);
  
  const path = location.pathname;
  const isPortal = path === '/portal' || path === '/';
  const isDcc = !isPortal;

  const isRequester = Boolean(
    currentUser?.status !== 'INACTIVE' && (
      currentUser?.canCreateDar !== false ||
      currentUser?.permissions?.includes('DAR_CREATE') ||
      currentUser?.isWorkflowUser ||
      (requestUsers || []).some(u => u.id === currentUser?.id || u.empId === currentUser?.id || u.id === currentUser?.empId)
    )
  );

  const isReviewerOrApprover = Boolean(
    currentUser?.canAccessTasks !== false && (
      currentUser?.canAccessTasks ||
      currentUser?.permissions?.includes('TASK_ACCESS') ||
      currentUser?.isWorkflowUser ||
      Number(currentUser?.approval_level || currentUser?.level || 0) >= 1 ||
      (reviewUsers || []).some(u => u.id === currentUser?.id || u.empId === currentUser?.id || u.id === currentUser?.empId) ||
      (approveUsers || []).some(u => u.id === currentUser?.id || u.empId === currentUser?.id || u.id === currentUser?.empId)
    )
  );

  const isDccUser = Boolean(currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.role === 'DCC_STAFF');
  const isDccAdmin = checkDccAdmin(currentUser);
  const isAdmin = isDccAdmin;

  // Task Counts Calculations
  const userTasks = (tasks || []).filter(t => isActionableTask(t, currentUser));
  const myTaskCount = userTasks.filter(t => t.actionRequired !== false && !t.is_completed && t.status !== 'COMPLETED').length;

  const ccTaskCount = (controlledCopyInstances || []).filter(inst => {
    const doc = (documents || []).find(d => d.id === (inst.doc_id || inst.docId));
    const isRecall = doc && (doc.status === 'SUPERSEDED_ARCHIVED' || doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED') && (inst.status === 'ACTIVE' || inst.status === 'ISSUED_ACTIVE');
    return (inst.status === 'PENDING_RECEIPT' || inst.status === 'PENDING_ISSUE' || inst.status === 'DISPATCHED_PENDING_RECEIPT' || inst.status === 'REPLACEMENT_REQUESTED' || inst.status === 'PENDING_RECALL' || isRecall);
  }).length;

  const myExternalReviseCount = useMemo(() => {
    const reviseDocIds = new Set();
    (tasks || []).forEach(t => {
      if (
        (t.type === 'EXTERNAL_REVISE' || t.taskType === 'EXTERNAL_REVISE') &&
        (t.assigneeId === currentUser?.id || t.requesterId === currentUser?.id) &&
        t.status === 'PENDING'
      ) {
        reviseDocIds.add(t.referenceId || t.docId || t.id);
      }
    });
    (externalRequests || []).forEach(r => {
      if (r.requesterId === currentUser?.id && r.status === 'REVISE_REQUESTED') {
        reviseDocIds.add(r.docId || r.externalDocId || r.requestId || r.id);
      }
    });
    return reviseDocIds.size;
  }, [tasks, externalRequests, currentUser]);

  // Unread notifications count
  const unreadNotificationCount = useMemo(() => {
    return (notifications || [])
      .filter(n => isNotificationVisibleToUser(n, currentUser))
      .filter(n => !isNotificationReadByUser(n, currentUser?.id)).length;
  }, [notifications, currentUser]);

  const SectionHeader = ({ title }) => (
    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 pt-4 pb-1 select-none">
      {title}
    </div>
  );

  const NavItem = ({ to, icon: IconComponent, label, badgeCount, badgeColor = 'blue', isHighlight = false }) => (
    <NavLink 
      to={to} 
      className={({ isActive }) => 
        `group relative flex items-center justify-between px-3 py-2 text-xs rounded-xl font-medium gap-2.5 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 ${
          isActive 
            ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs' 
            : isHighlight
              ? 'text-blue-600 bg-blue-50/40 hover:bg-blue-50/80 hover:text-blue-700'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Subtle Active Indicator Bar */}
          {isActive && (
            <span 
              aria-hidden="true"
              className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-blue-600 transition-all" 
            />
          )}

          <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-0.5">
            <IconComponent 
              className={`w-4 h-4 shrink-0 transition-colors duration-150 ${
                isActive 
                  ? 'text-blue-600' 
                  : isHighlight
                    ? 'text-blue-500 group-hover:text-blue-600'
                    : 'text-slate-400 group-hover:text-slate-600'
              }`} 
              strokeWidth={1.5} 
            />
            <span className="truncate leading-normal tracking-tight text-[13px]">{label}</span>
          </div>

          {badgeCount > 0 && (
            <span 
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0 transition-transform group-hover:scale-105 ${
                badgeColor === 'red'
                  ? 'bg-rose-500 text-white shadow-2xs'
                  : badgeColor === 'amber'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <aside className="w-64 sm:w-[264px] h-screen flex flex-col justify-between overflow-hidden bg-white border-r border-slate-200/80 select-none shrink-0 z-30 shadow-none">
      {/* ================= TOP BRAND HEADER & NOTIFICATION WIDGET ================= */}
      <div className="p-3.5 pb-2 shrink-0 border-b border-slate-100 space-y-1">
        <div 
          onClick={() => navigate('/portal')}
          className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 transition-all duration-150 cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          title="ไปยังหน้าหลักพอร์ทัล"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 group-hover:scale-105 transition-transform">
            Q
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[15px] font-black text-slate-900 tracking-tight leading-tight truncate">
                QMS
              </h1>
              <span className="px-1.5 py-0.2 text-[9px] font-black font-mono bg-blue-50 text-blue-700 border border-blue-200 rounded shrink-0 uppercase tracking-wider">
                Portal
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 font-medium tracking-tight truncate mt-0.5">
              Enterprise Quality Suite
            </p>
          </div>
        </div>

        {/* Top Notification Trigger Widget */}
        <NotificationPopover unreadCount={unreadNotificationCount} />
      </div>

      {/* ================= CENTER SECTION: Grouped Navigation Links ================= */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-none">
        {/* GROUP 1: WORKSPACE (พื้นที่ทำงาน) */}
        <SectionHeader title="WORKSPACE" />
        <NavItem 
          to="/portal" 
          icon={Home} 
          label="ภาพรวมพอร์ทัล" 
        />
        {isReviewerOrApprover && (
          <NavItem 
            to="/dcc/tasks" 
            icon={Inbox} 
            label="กล่องงานที่ต้องทำ" 
            badgeCount={myTaskCount}
            badgeColor={myTaskCount > 0 ? 'amber' : 'blue'}
          />
        )}

        {/* GROUP 2: INTERNAL DOCS / DAR (เอกสารภายใน) */}
        <SectionHeader title="เอกสารภายใน" />
        <NavItem 
          to="/dcc/library" 
          icon={BookOpen} 
          label="คลังเอกสารแม่บท" 
        />
        {isRequester && (
          <>
            <NavItem 
              to="/dcc/dar/new" 
              icon={FilePlus2} 
              label="ยื่นคำร้อง DAR" 
              isHighlight={true}
            />
            <NavItem 
              to="/dcc/dar/list" 
              icon={FileText} 
              label="ติดตามคำร้องของฉัน" 
            />
          </>
        )}

        {/* GROUP 3: EXTERNAL DOCS / EDR (เอกสารภายนอก) */}
        <SectionHeader title="เอกสารภายนอก" />
        <NavItem 
          to="/dcc/external-docs" 
          icon={Globe} 
          label="คลังเอกสารภายนอก" 
        />
        <NavItem 
          to="/dcc/external/my-requests" 
          icon={FolderGit2} 
          label="คำร้องของฉัน" 
          badgeCount={myExternalReviseCount}
          badgeColor="amber"
        />
        <NavItem 
          to="/dcc/periodic-reviews" 
          icon={CalendarDays} 
          label="การทบทวนตามรอบ" 
        />

        {/* GROUP 4: DCC MANAGEMENT (งานกำกับดูแล DCC - แสดงเฉพาะ Role DCC / Admin) */}
        {(isDccUser || isAdmin) && (
          <>
            <SectionHeader title="งานกำกับดูแล DCC" />
            <NavItem 
              to="/dcc/controlled-copy" 
              icon={Files} 
              label="ทะเบียนสำเนาควบคุม" 
              badgeCount={ccTaskCount}
              badgeColor="blue"
            />
            {isAdmin && (
              <>
                <NavItem 
                  to="/dcc/admin/master-data" 
                  icon={SlidersHorizontal} 
                  label="จัดการข้อมูลหลัก" 
                />
                <NavItem 
                  to="/dcc/admin/action-log" 
                  icon={History} 
                  label="บันทึกประวัติการทำงาน" 
                />
              </>
            )}
          </>
        )}
      </nav>

      {/* ================= BOTTOM SECTION: Dev Tools & User Profile ================= */}
      <div className="p-3 border-t border-slate-200/80 bg-white shrink-0 space-y-2.5">
        {/* Compact Dev Action Bar (QA Seed / Clean Slate) */}
        {isAdmin && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1.5 py-1 px-2 bg-slate-50 border border-slate-200/60 rounded-lg text-[11px] text-slate-500">
              <span className="font-mono text-[10px] font-medium text-slate-400 uppercase tracking-wider pl-1">
                DEV TOOLS
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    seedComprehensiveQaMockData();
                    toast.success('โหลดชุดข้อมูลจำลอง QA Workflow เรียบร้อยแล้ว');
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors font-medium cursor-pointer"
                  title="โหลดชุดข้อมูลจำลองสำหรับ QA Testing"
                >
                  <Sparkles size={11} className="text-blue-600 shrink-0" />
                  <span>Seed</span>
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setIsCleanSlateOpen(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition-colors font-medium cursor-pointer"
                  title="ล้างข้อมูลจำลองทั้งหมดเพื่อเริ่มทดสอบใหม่"
                >
                  <RotateCcw size={11} className="text-rose-600 shrink-0" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Profile & Role Switcher */}
        <div className="p-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm border border-blue-200 shrink-0">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <p className="text-xs font-semibold text-slate-900 leading-snug truncate tracking-tight">
                  {currentUser?.name}
                </p>
                {currentUser?.isDcc && (
                  <span className="px-1.5 py-0.2 text-[9px] font-semibold font-mono bg-blue-50 text-blue-700 rounded border border-blue-200 shrink-0 uppercase tracking-wider">
                    DCC
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5 font-mono">
                {currentUser?.position || currentUser?.department || 'Staff'} • L{currentUser?.level || 1}
              </p>
            </div>
          </div>

          <div className="relative">
            <select 
              className="w-full h-8 px-2.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer leading-normal shadow-none"
              value={currentUser?.id || ''}
              onChange={(e) => {
                const fn = switchUser || setCurrentUser;
                fn(e.target.value);
              }}
              title="สลับผู้ใช้งาน / บทบาทจำลอง"
            >
              {(masterUsers || []).map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.department}) L{user.level}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ================= CLEAN SLATE RESET MODAL ================= */}
      {isCleanSlateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/80 shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base tracking-tight leading-snug">ล้างข้อมูลจำลองเพื่อเริ่มต้นใหม่</h3>
                  <p className="text-xs text-slate-500 mt-0.5">รีเซ็ตข้อมูลธุรกรรมเพื่อการทดสอบระบบใหม่</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCleanSlateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600 leading-relaxed flex-1 overflow-y-auto">
              <p className="text-sm text-slate-800 font-medium">
                การดำเนินการนี้จะ <strong>ลบข้อมูลจำลองเชิงธุรกรรมทั้งหมด</strong> เพื่อให้ระบบกลับสู่สภาพเริ่มต้นสำหรับการทดสอบตั้งแต่ต้น:
              </p>

              <div className="p-4 bg-white border border-rose-200/80 rounded-xl space-y-2 shadow-2xs">
                <div className="font-bold text-rose-700 flex items-center gap-2 text-xs">
                  <Trash2 size={14} strokeWidth={1.5} className="text-rose-600 shrink-0" />
                  <span>ข้อมูลที่จะถูกล้างเป็นค่าว่าง:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1 font-medium text-xs">
                  <li>คำร้อง DAR ทั้งหมด</li>
                  <li>เอกสารในคลังและเอกสารแม่บท</li>
                  <li>ทะเบียนสำเนาควบคุมทั้งหมด</li>
                  <li>กล่องงานและการแจ้งเตือนทั้งหมด</li>
                  <li>ประวัติการทำงานและ Audit Trail ทั้งหมด</li>
                  <li>บันทึกการทบทวนตามรอบ</li>
                </ul>
              </div>

              <div className="p-4 bg-white border border-emerald-200/80 rounded-xl space-y-2 shadow-2xs">
                <div className="font-bold text-emerald-700 flex items-center gap-2 text-xs">
                  <CheckCircle2 size={14} strokeWidth={1.5} className="text-emerald-600 shrink-0" />
                  <span>ข้อมูลหลักที่ยังคงไว้ (Master Data):</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1 font-medium text-xs">
                  <li>บัญชีผู้ใช้มาตรฐาน พร้อมรหัส PIN 123456</li>
                  <li>แผนกมาตรฐาน (PD, QA/QC, WH, EN ฯลฯ)</li>
                  <li>ประเภทเอกสาร (QM, SOP, WI, FM, SD, SPEC)</li>
                  <li>จุดใช้งานและสถานีมาตรฐานประจำโรงงาน</li>
                  <li>การตั้งค่าความปลอดภัย e-Signature และ SLAs</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsCleanSlateOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  resetTransactionDataToCleanSlate();
                  setIsCleanSlateOpen(false);
                  toast.success('ล้างข้อมูล Mock Data ทั้งหมดเรียบร้อยแล้ว ระบบพร้อมสำหรับการทดสอบ Clean Slate');
                }}
                className="px-4.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              >
                <RotateCcw size={14} />
                <span>ยืนยันล้างข้อมูล</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
