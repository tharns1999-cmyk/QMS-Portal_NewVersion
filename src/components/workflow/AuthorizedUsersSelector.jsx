import React, { useState, useMemo } from 'react';
import { 
  Search, 
  X, 
  Check, 
  Plus, 
  Users, 
  UserPlus,
  UserCheck, 
  UserX, 
  RotateCcw,
  Shield,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Department color mapping for consistent avatars & badges
 */
const DEPT_COLORS = {
  QA: { bg: 'bg-blue-50 text-blue-700 border-blue-200', avatar: 'bg-blue-600 text-white' },
  'QA/QC': { bg: 'bg-blue-50 text-blue-700 border-blue-200', avatar: 'bg-blue-600 text-white' },
  PD: { bg: 'bg-amber-50 text-amber-800 border-amber-200', avatar: 'bg-amber-600 text-white' },
  EN: { bg: 'bg-purple-50 text-purple-700 border-purple-200', avatar: 'bg-purple-600 text-white' },
  WH: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', avatar: 'bg-emerald-600 text-white' },
  DC: { bg: 'bg-sky-50 text-sky-700 border-sky-200', avatar: 'bg-sky-600 text-white' },
  FIN: { bg: 'bg-teal-50 text-teal-700 border-teal-200', avatar: 'bg-teal-600 text-white' },
  EXEC: { bg: 'bg-zinc-100 text-zinc-800 border-zinc-300', avatar: 'bg-zinc-900 text-white' },
  MGMT: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', avatar: 'bg-indigo-600 text-white' },
  MKT: { bg: 'bg-rose-50 text-rose-700 border-rose-200', avatar: 'bg-rose-600 text-white' },
  HR: { bg: 'bg-cyan-50 text-cyan-700 border-cyan-200', avatar: 'bg-cyan-600 text-white' },
  'HR&GA': { bg: 'bg-cyan-50 text-cyan-700 border-cyan-200', avatar: 'bg-cyan-600 text-white' },
  HSE: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', avatar: 'bg-emerald-600 text-white' },
  PC: { bg: 'bg-purple-50 text-purple-700 border-purple-200', avatar: 'bg-purple-600 text-white' },
  ST: { bg: 'bg-slate-100 text-slate-700 border-slate-200', avatar: 'bg-slate-600 text-white' },
  DEFAULT: { bg: 'bg-slate-50 text-slate-700 border-slate-200', avatar: 'bg-slate-700 text-white' }
};

const getDeptTheme = (dept) => DEPT_COLORS[dept] || DEPT_COLORS.DEFAULT;

const getInitials = (name = '') => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

/**
 * AuthorizedUsersSelector Component (Linear / Modern B2B SaaS 2-Column Split View)
 * 
 * Layout:
 * - Left Column (lg:col-span-5):
 *   1. Minimum Position Level Card (Shield icon, dropdown)
 *   2. Auto-Authorized Workflow Strip (Requester, Reviewer, Approver with locked chips)
 *   3. Selected Whitelist Panel (Scrollable vertical chips, remove button, clear all)
 * - Right Column (lg:col-span-7):
 *   1. Search Input Bar + Horizontal Scrollable Department Filter Pills
 *   2. Scrollable User Cards Grid (max-h-[440px]) with 3 states: Auto-Authorized, Selected, Available
 */
const AuthorizedUsersSelector = ({
  selectedUserIds = [],
  onChange,
  users = [],
  minLevel = null,
  onMinLevelChange = null,
  onToggleUser = null,
  onRemoveUser = null,
  workflowParticipants = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDeptFilter, setActiveDeptFilter] = useState('ALL');

  // Ensure selectedUserIds is always an array
  const safeSelectedIds = useMemo(() => {
    return Array.isArray(selectedUserIds) ? selectedUserIds : [];
  }, [selectedUserIds]);

  // List of active users
  const activeUsers = useMemo(() => {
    return (users || []).filter(u => u && (u.status === 'ACTIVE' || u.status === 'Active' || !u.status));
  }, [users]);

  // Normalize workflow participants (Requester, Reviewer, Approver)
  const normalizedParticipants = useMemo(() => {
    if (!Array.isArray(workflowParticipants)) return [];
    return workflowParticipants.map(item => {
      if (!item) return null;
      if (typeof item === 'string') {
        const found = (users || []).find(u => u && (u.id === item || u.empId === item));
        return {
          id: item,
          empId: found?.empId,
          name: found ? found.name : item,
          department: found?.primary_department || found?.department || found?.dept || 'QMS',
          roleTitle: 'ผู้ร่วมสายงาน (Auto)'
        };
      }
      const found = (users || []).find(u => u && (u.id === item.id || (item.empId && u.empId === item.empId)));
      let roleTitle = item.roleTitle;
      if (!roleTitle) {
        if (item.role === 'REQUESTER') roleTitle = 'ผู้จัดทำ (Requester)';
        else if (item.role === 'REVIEWER') roleTitle = 'ผู้ทบทวน (Reviewer)';
        else if (item.role === 'APPROVER') roleTitle = 'ผู้อนุมัติ (Approver)';
        else roleTitle = 'ผู้ร่วมสายงาน (Auto)';
      }
      return {
        id: item.id,
        empId: item.empId || found?.empId,
        name: item.name || found?.name || item.id,
        department: item.department || found?.primary_department || found?.department || found?.dept || 'QMS',
        role: item.role,
        roleTitle
      };
    }).filter(Boolean);
  }, [workflowParticipants, users]);

  // Set of participant IDs for fast lookup in grid
  const participantIdsSet = useMemo(() => {
    const set = new Set();
    (normalizedParticipants || []).forEach(p => {
      if (p?.id) set.add(p.id);
      if (p?.empId) set.add(p.empId);
    });
    return set;
  }, [normalizedParticipants]);

  // Selected user objects
  const selectedUsers = useMemo(() => {
    return (safeSelectedIds || [])
      .map(id => (activeUsers || []).find(u => u && (u.id === id || u.empId === id)))
      .filter(Boolean);
  }, [safeSelectedIds, activeUsers]);

  // Unique departments for filter chips
  const departmentsList = useMemo(() => {
    const depts = new Set();
    (activeUsers || []).forEach(u => {
      if (!u) return;
      if (u.department) depts.add(u.department);
      if (u.dept) depts.add(u.dept);
      if (u.primary_department) depts.add(u.primary_department);
      if (Array.isArray(u.depts)) u.depts.forEach(d => d && depts.add(d));
      if (Array.isArray(u.affiliated_departments)) u.affiliated_departments.forEach(d => d && depts.add(d));
    });
    return Array.from(depts).filter(Boolean).sort();
  }, [activeUsers]);

  // Filtered candidate users list
  const filteredUsers = useMemo(() => {
    const query = (searchTerm || '').trim().toLowerCase();

    return (activeUsers || []).filter(user => {
      if (!user) return false;
      // 1. Department Filter
      if (activeDeptFilter !== 'ALL') {
        const userDepts = user.affiliated_departments || user.depts || (user.primary_department ? [user.primary_department] : (user.department ? [user.department] : [user.dept]));
        const matchDept = (userDepts || []).some(d => d === activeDeptFilter);
        if (!matchDept) return false;
      }

      // 2. Search Query Matching (Name, EmpId, ID, Dept, Position)
      if (!query) return true;

      const nameMatch = (user.name || '').toLowerCase().includes(query);
      const idMatch = (user.id || '').toLowerCase().includes(query);
      const empIdMatch = (user.empId || '').toLowerCase().includes(query);
      const posMatch = (user.position || '').toLowerCase().includes(query);
      const deptMatch = (user.primary_department || user.department || user.dept || '').toLowerCase().includes(query);

      return nameMatch || idMatch || empIdMatch || posMatch || deptMatch;
    });
  }, [activeUsers, activeDeptFilter, searchTerm]);

  // Handle single user toggle
  const handleToggle = (userId) => {
    if (onToggleUser) {
      onToggleUser(userId);
      return;
    }
    const next = safeSelectedIds.includes(userId)
      ? safeSelectedIds.filter(id => id !== userId)
      : [...safeSelectedIds, userId];
    if (onChange) onChange(next);
  };

  // Handle single user remove
  const handleRemove = (userId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (onRemoveUser) {
      onRemoveUser(userId);
    }
    const next = safeSelectedIds.filter(id => id !== userId);
    if (onChange) onChange(next);
  };

  // Clear all selected users
  const handleClearAll = () => {
    if (onChange) onChange([]);
  };

  // Select all in current filter
  const handleSelectAllInView = () => {
    const filteredIds = (filteredUsers || []).map(u => u?.id).filter(Boolean);
    const newSelection = Array.from(new Set([...safeSelectedIds, ...filteredIds]));
    if (onChange) onChange(newSelection);
  };

  // Deselect all in current filter
  const handleDeselectAllInView = () => {
    const filteredIdsSet = new Set((filteredUsers || []).map(u => u?.id).filter(Boolean));
    const newSelection = safeSelectedIds.filter(id => !filteredIdsSet.has(id));
    if (onChange) onChange(newSelection);
  };

  const isAllInViewSelected = (filteredUsers || []).length > 0 && (filteredUsers || []).every(u => u && safeSelectedIds.includes(u.id));

  return (
    <div className="select-none">
      {/* 2-Column Split View Layout (Mobile: 1 Col, Desktop: 12 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ========================================================================= */}
        {/* คอลัมน์ซ้าย (lg:col-span-5) — Configuration & Selected Summary            */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* 1. Minimum Position Level Card */}
          {minLevel !== null && minLevel !== undefined && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-slate-300 transition-all space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center shrink-0 shadow-2xs">
                  <Shield size={16} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <label htmlFor="min-access-level-select" className="text-xs font-bold text-slate-900 block cursor-pointer">
                    ระดับตำแหน่งขั้นต่ำที่อนุญาต (Minimum Position Level)
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    พนักงานที่มีตำแหน่งตั้งแต่ระดับนี้ขึ้นไปจะเข้าถึงเอกสารลับนี้ได้โดยอัตโนมัติ
                  </p>
                </div>
              </div>
              <div>
                <select
                  id="min-access-level-select"
                  aria-label="ระดับสิทธิ์ขั้นต่ำ"
                  value={minLevel}
                  onChange={(e) => onMinLevelChange && onMinLevelChange(Number(e.target.value))}
                  disabled={!onMinLevelChange}
                  className="w-full h-9 px-3 bg-slate-50/70 hover:bg-white text-xs font-bold text-slate-800 border border-slate-200 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value={4}>Level 4: หัวหน้างานขึ้นไป (Supervisor L4+)</option>
                  <option value={1}>Level 1: ทุกคนในองค์กร (All Staff)</option>
                  <option value={3}>Level 3: เจ้าหน้าที่อาวุโสขึ้นไป (Senior Staff L3+)</option>
                  <option value={5}>Level 5: ผู้ช่วยผู้จัดการขึ้นไป (Asst. Manager L5+)</option>
                  <option value={6}>Level 6: ผู้จัดการฝ่ายขึ้นไป (Dept. Manager L6+)</option>
                  <option value={7}>Level 7: ผู้บริหารระดับสูง (Directors & Executives)</option>
                  <option value={99}>🔒 เฉพาะบุคคลที่กำหนดเท่านั้น (Custom Whitelist Only)</option>
                </select>
              </div>
            </div>
          )}

          {/* 2. Auto-Authorized Workflow Strip (สิทธิ์ตามสายอนุมัติ) */}
          {normalizedParticipants.length > 0 && (
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3.5 shadow-2xs space-y-2.5 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
                    <Lock size={12} strokeWidth={2.4} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    สิทธิ์เข้าถึงอัตโนมัติตามสายอนุมัติ (Auto-Authorized):
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-emerald-800/80 leading-relaxed font-medium">
                ได้รับสิทธิ์เปิดดูอัตโนมัติตามสายงาน (บุคคลในสายการจัดทำ ทบทวน และอนุมัติจะได้รับสิทธิ์เข้าถึงเอกสารนี้โดยอัตโนมัติ)
              </p>

              {/* Locked Chips List */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {normalizedParticipants.map((participant) => {
                  const theme = getDeptTheme(participant.department);
                  return (
                    <div
                      key={participant.id}
                      className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-xl bg-white border border-emerald-200/90 text-xs shadow-2xs select-none"
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${theme.avatar}`}>
                        {getInitials(participant.name)}
                      </span>
                      <span className="font-bold text-slate-800 text-[12px] truncate max-w-[120px]">
                        {participant.name}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {participant.roleTitle}
                      </span>
                      <Lock size={11} className="text-emerald-600 shrink-0" title="ได้รับสิทธิ์อัตโนมัติตามสายงาน (ล็อก)" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Selected Whitelist Panel (รายชื่อที่เลือกเพิ่ม) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs space-y-3 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserCheck size={14} strokeWidth={2.2} />
                </div>
                <span className="text-xs font-bold text-slate-900">
                  ผู้ได้รับสิทธิ์พิเศษ ({selectedUsers.length})
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  {selectedUsers.length} คน
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
                  เลือกแล้ว {selectedUsers.length} ท่าน
                </span>
                {selectedUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={11} />
                    <span>ล้างทั้งหมด</span>
                    <span className="text-slate-400 font-normal hidden sm:inline">(Clear all)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Selected Whitelist Chips: Scrollable Vertical Stack */}
            {selectedUsers.length > 0 ? (
              <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                <AnimatePresence>
                  {selectedUsers.map((user) => {
                    const theme = getDeptTheme(user.primary_department || user.department || user.dept);
                    return (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:bg-white transition-all group"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${theme.avatar}`}>
                            {getInitials(user.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 text-xs truncate max-w-[130px]">
                                {user.name}
                              </span>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${theme.bg}`}>
                                {user.primary_department || user.department || user.dept}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">
                              {user.position || 'พนักงาน'} {user.empId ? `• ${user.empId}` : `• ${user.id}`}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleRemove(user.id, e)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-100/80 p-1 rounded-lg transition-colors ml-1 cursor-pointer shrink-0"
                          title={`นำ ${user.name} ออก`}
                        >
                          <X size={13} strokeWidth={2.5} />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="py-7 px-3 rounded-xl bg-slate-50/60 border border-dashed border-slate-200 flex flex-col items-center justify-center gap-1.5 text-center">
                <UserPlus size={18} className="text-slate-400 mb-0.5" />
                <p className="text-xs text-slate-500 font-medium">ยังไม่มีการเลือกรายชื่อเฉพาะบุคคล</p>
                <p className="text-[11px] text-slate-400">ค้นหาและคลิกเลือกพนักงานจากแผงรายชื่อทางขวาเพื่อเพิ่มสิทธิ์พิเศษ</p>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* คอลัมน์ขวา (lg:col-span-7) — Interactive Member Directory & Picker        */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 space-y-3">
          
          {/* Header Label */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Users size={15} className="text-indigo-600" />
              <span>ระบุบุคคลที่ได้รับอนุญาตเพิ่มเติมเฉพาะบุคคล (Authorized Individual Whitelist)</span>
            </label>
          </div>

          {/* 1. Search & Filter Header */}
          <div className="space-y-2.5">
            {/* Search Input Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="ค้นหาด้วยชื่อ, รหัสพนักงาน (EMP-001), User ID (U001), แผนก หรือตำแหน่ง..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-9 py-2 h-9 text-xs bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400 font-medium shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Department Filter Pills (Horizontal Scrollable) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <button
                type="button"
                onClick={() => setActiveDeptFilter('ALL')}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeDeptFilter === 'ALL'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 shadow-2xs'
                }`}
              >
                ทั้งหมด ({activeUsers.length})
              </button>

              {departmentsList.map(dept => {
                const count = activeUsers.filter(u => {
                  const uDepts = u.affiliated_departments || u.depts || (u.primary_department ? [u.primary_department] : (u.department ? [u.department] : [u.dept]));
                  return (uDepts || []).includes(dept);
                }).length;

                const isSelected = activeDeptFilter === dept;

                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setActiveDeptFilter(dept)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 shadow-2xs'
                    }`}
                  >
                    <span>{dept}</span>
                    <span className={`text-[10px] font-mono px-1 rounded ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Scrollable User Cards Grid */}
          <div className="border border-slate-200/90 bg-slate-50/50 rounded-2xl overflow-hidden shadow-2xs p-3 space-y-2.5">
            {/* Toolbar Header */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-[11px] font-medium text-slate-500">
                พบ <strong className="text-slate-800 font-bold">{filteredUsers.length}</strong> รายชื่อ {activeDeptFilter !== 'ALL' ? `(แผนก ${activeDeptFilter})` : ''}
              </span>

              {filteredUsers.length > 0 && (
                <button
                  type="button"
                  onClick={isAllInViewSelected ? handleDeselectAllInView : handleSelectAllInView}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                >
                  {isAllInViewSelected ? 'ยกเลิกทั้งหมดในกลุ่มนี้' : 'เลือกทั้งหมดในกลุ่มนี้'}
                </button>
              )}
            </div>

            {/* User Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => {
                  const isWorkflowParticipant = participantIdsSet.has(user.id) || (user.empId && participantIdsSet.has(user.empId));
                  const isSelected = isWorkflowParticipant || safeSelectedIds.includes(user.id) || (user.empId && safeSelectedIds.includes(user.empId));
                  const theme = getDeptTheme(user.primary_department || user.department || user.dept);

                  return (
                    <div
                      key={user.id}
                      onClick={isWorkflowParticipant ? undefined : () => handleToggle(user.id)}
                      className={`p-2.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-2.5 outline-none ${
                        isWorkflowParticipant
                          ? 'bg-emerald-50/30 border-emerald-200/80 ring-1 ring-emerald-400/40 shadow-xs cursor-default select-none'
                          : isSelected
                            ? 'ring-2 ring-indigo-500 bg-indigo-50/40 border-indigo-200 shadow-xs cursor-pointer hover:scale-[1.01]'
                            : 'bg-white border-slate-200/80 hover:bg-slate-50/80 hover:border-slate-300 shadow-2xs cursor-pointer hover:scale-[1.01]'
                      }`}
                    >
                      {/* Left: Avatar & Identity Details */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${theme.avatar}`}>
                          {getInitials(user.name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {user.name}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold border ${theme.bg}`}>
                              {user.primary_department || user.department || user.dept}
                            </span>
                            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Lv.{user.approval_level || user.level || 1}
                            </span>
                            {isWorkflowParticipant && (
                              <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-emerald-100/80 text-emerald-700 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                                <Lock size={9} strokeWidth={2.5} />
                                <span>ผู้ร่วมสายงาน (Auto)</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {user.position || 'พนักงาน'} {user.empId ? `• ${user.empId}` : `• ${user.id}`}
                          </p>
                        </div>
                      </div>

                      {/* Right: Action Button */}
                      <div className="shrink-0">
                        {isWorkflowParticipant ? (
                          <button
                            type="button"
                            disabled
                            aria-label={`ผู้ร่วมสายงาน (Auto) - ${user.name}`}
                            className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs cursor-not-allowed opacity-95"
                            title="ผู้ร่วมสายงาน (Auto) - ได้รับสิทธิ์อัตโนมัติตามสายงาน ไม่สามารถปลดออกได้"
                          >
                            <Lock size={11} strokeWidth={2.4} />
                          </button>
                        ) : isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                            <Check size={13} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors">
                            <Plus size={13} strokeWidth={2.5} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-8 px-4 text-center space-y-2 bg-white rounded-xl border border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <UserX size={20} />
                  </div>
                  <p className="text-xs font-bold text-slate-700">ไม่พบรายชื่อผู้ใช้ที่ตรงกับเงื่อนไข</p>
                  <p className="text-[11px] text-slate-400">
                    ลองค้นหาด้วยคำอื่น หรือเลือกตัวกรองแผนกเป็น "ทั้งหมด"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthorizedUsersSelector;
