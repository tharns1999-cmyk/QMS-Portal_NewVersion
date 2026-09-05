import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import useStore from '../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  FilePlus, 
  List, 
  CheckSquare, 
  Library, 
  Copy, 
  Globe, 
  History, 
  Bell, 
  Calendar, 
  Settings,
  RotateCcw,
  Trash2,
  Sparkles,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationPopover from './NotificationPopover';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    currentUser, requestUsers, reviewUsers, approveUsers, tasks, controlledCopyInstances, documents, 
    masterUsers, setCurrentUser, notifications, markNotificationAsRead, markAllNotificationsAsRead,
    resetTransactionDataToCleanSlate, seedComprehensiveQaMockData
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
  const isDccAdmin = Boolean(currentUser?.role === 'DCC_ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.isDcc);
  const isAdmin = isDccAdmin;

  // Task Counts Calculations
  const userDepts = currentUser?.affiliated_departments || currentUser?.depts || (currentUser?.primary_department ? [currentUser.primary_department] : (currentUser?.department ? [currentUser.department] : []));
  const userTasks = (tasks || []).filter(t => {
    if (t.status === 'COMPLETED' || t.status === 'RESOLVED' || t.is_completed === true) return false;
    if (isAdmin || currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.role === 'QMR' || currentUser?.isQmr) return true;

    const isReceiptTask = 
      t.type === 'RECEIPT' || 
      t.taskType === 'RECEIPT' || 
      t.category === 'RECEIPT' ||
      t.type === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || 
      t.taskType === 'DEPT_CONFIRM_HARDCOPY_RECEIPT' || 
      t.type === 'CONFIRM_RECEIPT' || 
      t.task_type === 'CONFIRM_RECEIPT' ||
      t.id?.includes('doc-') ||
      t.id?.includes('task-receipt-') ||
      t.title?.includes('ตรวจรับเล่ม') ||
      t.title?.includes('ตรวจรับเอกสาร');

    if (isReceiptTask) {
      const taskDept = t.target_department || t.department || t.targetDept || t.destinationDept || t.assignedToDept || t.holder_dept || '';
      return userDepts.includes(taskDept);
    }

    const taskAssigneeId = t.assigneeId || t.assignee_id || t.assignedToUserId;
    const taskDept = t.target_department || t.currentHandlerDepartment || t.assignedToDept || '';
    const isMyTask = (taskAssigneeId && (taskAssigneeId === currentUser?.id || t.assigneeName === currentUser?.name)) || 
      (taskDept && userDepts.includes(taskDept) && Number(t.required_approval_level || t.currentHandlerLevel || 1) <= Number(currentUser?.approval_level || currentUser?.level || 1)) ||
      (!taskAssigneeId && taskDept && userDepts.includes(taskDept));
    
    return isMyTask;
  });
  const myTaskCount = userTasks.length;

  const ccTaskCount = (controlledCopyInstances || []).filter(inst => {
    const doc = (documents || []).find(d => d.id === (inst.doc_id || inst.docId));
    const isRecall = doc && (doc.status === 'SUPERSEDED_ARCHIVED' || doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED') && (inst.status === 'ACTIVE' || inst.status === 'ISSUED_ACTIVE');
    return (inst.status === 'PENDING_RECEIPT' || inst.status === 'PENDING_ISSUE' || inst.status === 'DISPATCHED_PENDING_RECEIPT' || inst.status === 'REPLACEMENT_REQUESTED' || inst.status === 'PENDING_RECALL' || isRecall);
  }).length;

  const NavItem = ({ to, icon: IconComponent, label, badgeCount }) => (
    <NavLink 
      to={to} 
      className={({ isActive }) => 
        `group relative flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#0D99FF] ${
          isActive 
            ? 'bg-[#E5F4FF] text-[#0D99FF] font-medium shadow-none border border-transparent' 
            : 'text-[#444444] font-medium hover:text-[#1E1E1E] hover:bg-[#F5F5F5] border border-transparent'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <IconComponent 
              className={`w-4.5 h-4.5 shrink-0 transition-colors duration-150 ${
                isActive ? 'text-[#0D99FF]' : 'text-[#666666] group-hover:text-[#444444]'
              }`} 
              strokeWidth={isActive ? 2 : 1.75} 
            />
            <span className="truncate leading-normal tracking-tight text-[13.5px]">{label}</span>
          </div>

          {badgeCount > 0 && (
            <span 
              className={`ml-2 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md shrink-0 transition-transform group-hover:scale-105 ${
                isActive 
                  ? 'bg-[#0D99FF] text-white shadow-none' 
                  : 'bg-[#E5E5E5] text-[#666666]'
              }`}
            >
              {badgeCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <aside className="w-64 sm:w-[270px] h-full bg-white border-r border-[#E5E5E5] flex flex-col justify-between p-4 sm:p-5 select-none shrink-0 z-30">
      {/* ================= TOP SECTION: Brand Header & Notifications ================= */}
      <div className="space-y-3.5 shrink-0">
        {/* Brand Header */}
        <div 
          onClick={() => navigate('/portal')}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100/80 transition-all duration-150 cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          title="ไปยังหน้าหลักพอร์ทัล"
        >
          <div className="w-9 h-9 rounded-lg bg-[#1E1E1E] text-white flex items-center justify-center font-bold text-lg shadow-none shrink-0 group-hover:scale-105 transition-transform">
            Q
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[16px] font-black text-slate-900 tracking-tight leading-tight truncate">
                QMS
              </h1>
              <span className="px-1.5 py-0.5 text-[9.5px] font-black font-mono bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] rounded shrink-0 uppercase tracking-wider">
                Enterprise
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium tracking-tight truncate mt-0.5">
              Document Control
            </p>
          </div>
        </div>

        {/* Notifications Quick Bar (Figma UI3 Floating Panel) */}
        <NotificationPopover />
      </div>

      <div className="my-3 border-b border-slate-200/80" />

      {/* ================= CENTER SECTION: Navigation Links ================= */}
      <nav className="flex-1 overflow-y-auto space-y-1 pr-1.5 -mr-1.5 custom-scrollbar">
        <NavItem to="/portal" icon={Home} label="หน้าหลักพอร์ทัล" />
        
        {isDcc && (
          <>
            <div className="pt-4 pb-2 px-3 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>ระบบควบคุมเอกสาร</span>
              <span className="text-[9.5px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">DCC</span>
            </div>
            
            <NavItem to="/dcc/dashboard" icon={Library} label="แดชบอร์ดภาพรวม" />
            
            {isRequester && (
              <>
                <NavItem to="/dcc/dar/new" icon={FilePlus} label="สร้างคำร้อง DAR" />
                <NavItem to="/dcc/dar/list" icon={List} label="คำร้อง DAR ของฉัน" />
              </>
            )}
            
            {isReviewerOrApprover && (
              <NavItem to="/dcc/tasks" icon={CheckSquare} label="กล่องงานที่ต้องทำ" badgeCount={myTaskCount} />
            )}
            
            {isAdmin && (
              <>
                <NavItem to="/dcc/admin/master-data" icon={Settings} label="จัดการข้อมูลหลัก" />
                <NavItem to="/dcc/admin/action-log" icon={History} label="ประวัติการทำงาน" />
              </>
            )}
            
            <NavItem to="/dcc/library" icon={Library} label="คลังเอกสารแม่บท" />
            
            {isDccUser && (
              <NavItem to="/dcc/controlled-copy" icon={Copy} label="ทะเบียนสำเนาควบคุม" badgeCount={ccTaskCount} />
            )}
            <NavItem to="/dcc/external-docs" icon={Globe} label="เอกสารภายนอก" />
            <NavItem to="/dcc/periodic-reviews" icon={Calendar} label="การทบทวนตามรอบ" />

            {/* Quick Reset & Seed Mock Data Buttons for DCC */}
            {isAdmin && (
              <div className="pt-3 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    seedComprehensiveQaMockData();
                    toast.success('โหลดชุดข้อมูลจำลอง QA Workflow (DAR, Tasks, สำเนาควบคุม) เรียบร้อยแล้ว');
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0D99FF] bg-[#E5F4FF]/70 hover:bg-[#D1EFFF] border border-[#B8E1FF] transition-all group shadow-2xs cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0D99FF]"
                  title="โหลดชุดข้อมูลจำลองคำร้อง QA ครบทุก Flow สำหรับ Manual Testing"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Sparkles size={15} className="text-[#0D99FF] shrink-0" />
                    <span className="truncate tracking-tight">โหลด Mock Data (QA)</span>
                  </div>
                  <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-[#0D99FF] text-white shrink-0">
                    Seed
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCleanSlateOpen(true)}
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50/50 hover:bg-rose-100/60 border border-rose-200/80 transition-all group shadow-2xs cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                  title="ล้างข้อมูลจำลองทั้งหมดเพื่อเริ่มทดสอบใหม่"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <RotateCcw size={15} className="text-rose-600 group-hover:-rotate-45 transition-transform shrink-0" />
                    <span className="truncate tracking-tight">ล้างข้อมูลจำลอง</span>
                  </div>
                  <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white shrink-0">
                    Reset
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </nav>

      {/* ================= BOTTOM SECTION: User Profile & Role Switcher ================= */}
      <div className="pt-4 border-t border-[#E5E5E5] shrink-0">
        <div className="p-3 bg-white border border-[#E5E5E5] rounded-xl space-y-3 shadow-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#F5F5F5] text-[#1E1E1E] flex items-center justify-center font-bold text-sm border border-[#E5E5E5] shrink-0">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <p className="text-xs font-semibold text-[#1E1E1E] leading-snug truncate tracking-tight">
                  {currentUser?.name}
                </p>
                {currentUser?.isDcc && (
                  <span className="px-1.5 py-0.2 text-[9px] font-medium font-mono bg-[#E5F4FF] text-[#0D99FF] rounded border border-[#B8E1FF] shrink-0 uppercase tracking-wider">
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
              className="w-full h-8 px-2.5 text-xs font-medium text-[#1E1E1E] bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D99FF]/20 focus:border-[#0D99FF] transition-all cursor-pointer leading-normal shadow-none"
              value={currentUser?.id || ''}
              onChange={(e) => setCurrentUser(e.target.value)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-[#fbfbfa] rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 pt-6 pb-4 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/80 shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg tracking-tight leading-snug">ล้างข้อมูลจำลองเพื่อเริ่มต้นใหม่</h3>
                  <p className="text-xs text-slate-500 mt-0.5">รีเซ็ตข้อมูลธุรกรรมเพื่อการทดสอบระบบใหม่</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCleanSlateOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600 leading-relaxed">
              <p className="text-sm text-slate-800 font-medium">
                การดำเนินการนี้จะ <strong>ลบข้อมูลจำลองเชิงธุรกรรมทั้งหมด</strong> เพื่อให้ระบบกลับสู่สภาพเริ่มต้นสำหรับการทดสอบตั้งแต่ต้น:
              </p>

              <div className="p-4 bg-white border border-rose-200/80 rounded-xl space-y-2 shadow-2xs">
                <div className="font-bold text-rose-700 flex items-center gap-2 text-xs">
                  <span>🗑️ ข้อมูลที่จะถูกล้างเป็นค่าว่าง:</span>
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
                  <span>✅ ข้อมูลหลักที่ยังคงไว้ (Master Data):</span>
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

            <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3">
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
