import React, { useState, useMemo } from 'react';
import { 
  Search, 
  X, 
  Check, 
  User, 
  Users, 
  Building2, 
  Award, 
  UserCheck, 
  UserX, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Department color mapping for consistent avatars & badges
 */
const DEPT_COLORS = {
  QA: { bg: 'bg-blue-100 text-blue-800 border-blue-200', avatar: 'bg-blue-600 text-white' },
  PD: { bg: 'bg-amber-100 text-amber-800 border-amber-200', avatar: 'bg-amber-600 text-white' },
  EN: { bg: 'bg-purple-100 text-purple-800 border-purple-200', avatar: 'bg-purple-600 text-white' },
  WH: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', avatar: 'bg-emerald-600 text-white' },
  FIN: { bg: 'bg-teal-100 text-teal-800 border-teal-200', avatar: 'bg-teal-600 text-white' },
  EXEC: { bg: 'bg-slate-100 text-slate-800 border-slate-300', avatar: 'bg-slate-800 text-white' },
  MGMT: { bg: 'bg-indigo-100 text-indigo-800 border-indigo-200', avatar: 'bg-indigo-600 text-white' },
  MKT: { bg: 'bg-rose-100 text-rose-800 border-rose-200', avatar: 'bg-rose-600 text-white' },
  HR: { bg: 'bg-cyan-100 text-cyan-800 border-cyan-200', avatar: 'bg-cyan-600 text-white' },
  IT: { bg: 'bg-violet-100 text-violet-800 border-violet-200', avatar: 'bg-violet-600 text-white' },
  DEFAULT: { bg: 'bg-slate-100 text-slate-700 border-slate-200', avatar: 'bg-slate-600 text-white' }
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
 * AuthorizedUsersSelector Component
 * 
 * Enterprise Multi-Select User Picker with Instant Search, Department Chips, and Selected Tags Tray.
 * 
 * @param {Object} props
 * @param {string[]} props.selectedUserIds - Array of user IDs (e.g. ['U001', 'U002'])
 * @param {Function} props.onChange - Callback with new array of user IDs
 * @param {Array} props.users - List of available masterUsers
 */
const AuthorizedUsersSelector = ({
  selectedUserIds = [],
  onChange,
  users = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDeptFilter, setActiveDeptFilter] = useState('ALL');

  // List of active users
  const activeUsers = useMemo(() => {
    return (users || []).filter(u => u.status === 'ACTIVE' || u.status === 'Active' || !u.status);
  }, [users]);

  // Selected user objects
  const selectedUsers = useMemo(() => {
    return selectedUserIds
      .map(id => activeUsers.find(u => u.id === id))
      .filter(Boolean);
  }, [selectedUserIds, activeUsers]);

  // Unique departments for filter chips
  const departmentsList = useMemo(() => {
    const depts = new Set();
    activeUsers.forEach(u => {
      if (u.department) depts.add(u.department);
      if (u.dept) depts.add(u.dept);
      if (Array.isArray(u.depts)) u.depts.forEach(d => depts.add(d));
    });
    return Array.from(depts).filter(Boolean).sort();
  }, [activeUsers]);

  // Filtered candidate users list
  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return activeUsers.filter(user => {
      // 1. Department Filter
      if (activeDeptFilter !== 'ALL') {
        const userDepts = user.depts || (user.department ? [user.department] : [user.dept]);
        const matchDept = userDepts.some(d => d === activeDeptFilter);
        if (!matchDept) return false;
      }

      // 2. Search Query Matching (Name, EmpId, ID, Dept, Position)
      if (!query) return true;

      const nameMatch = (user.name || '').toLowerCase().includes(query);
      const idMatch = (user.id || '').toLowerCase().includes(query);
      const empIdMatch = (user.empId || '').toLowerCase().includes(query);
      const posMatch = (user.position || '').toLowerCase().includes(query);
      const deptMatch = (user.department || user.dept || '').toLowerCase().includes(query);

      return nameMatch || idMatch || empIdMatch || posMatch || deptMatch;
    });
  }, [activeUsers, activeDeptFilter, searchTerm]);

  // Toggle single user
  const handleToggleUser = (userId) => {
    const next = selectedUserIds.includes(userId)
      ? selectedUserIds.filter(id => id !== userId)
      : [...selectedUserIds, userId];
    onChange(next);
  };

  // Remove single user
  const handleRemoveUser = (userId, e) => {
    if (e) e.stopPropagation();
    onChange(selectedUserIds.filter(id => id !== userId));
  };

  // Clear all selected users
  const handleClearAll = () => {
    onChange([]);
  };

  // Select all in current filter
  const handleSelectAllInView = () => {
    const filteredIds = filteredUsers.map(u => u.id);
    const newSelection = Array.from(new Set([...selectedUserIds, ...filteredIds]));
    onChange(newSelection);
  };

  // Deselect all in current filter
  const handleDeselectAllInView = () => {
    const filteredIdsSet = new Set(filteredUsers.map(u => u.id));
    const newSelection = selectedUserIds.filter(id => !filteredIdsSet.has(id));
    onChange(newSelection);
  };

  const isAllInViewSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u.id));

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. Selected Tags Tray (สรุปรายชื่อผู้ได้รับอนุญาตพิเศษที่เลือกไว้) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-3.5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-[#0D99FF]" />
            <span className="text-xs font-bold text-[#1E1E1E]">
              ผู้ได้รับอนุญาตพิเศษที่เลือกไว้
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E5F4FF] text-[#007BE5] border border-[#B8E1FF]">
              {selectedUsers.length} คน
            </span>
          </div>

          {selectedUsers.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              ล้างทั้งหมด
            </button>
          )}
        </div>

        {/* Tag Pills Container */}
        {selectedUsers.length > 0 ? (
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar">
            <AnimatePresence>
              {selectedUsers.map(user => {
                const theme = getDeptTheme(user.department || user.dept);
                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="inline-flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg bg-[#F5F5F5] border border-[#E5E5E5] hover:border-slate-300 text-xs transition-all shadow-2xs group"
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${theme.avatar}`}>
                      {getInitials(user.name)}
                    </span>
                    <span className="font-bold text-[#1E1E1E] max-w-[140px] truncate">
                      {user.name}
                    </span>
                    <span className="text-[10px] font-mono text-[#666666] px-1 py-0.2 rounded bg-white border border-[#E5E5E5]">
                      {user.department || user.dept}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveUser(user.id, e)}
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-100 p-0.5 rounded transition-colors ml-0.5 cursor-pointer"
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
          <div className="py-2.5 px-3 rounded-lg bg-[#F9F9F9] border border-dashed border-[#E5E5E5] text-center">
            <p className="text-xs text-[#888888] flex items-center justify-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              ยังไม่ได้ระบุบุคคลเฉพาะ (ค้นหาและคลิกเลือกพนักงานจากรายการด้านล่าง)
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. Search Bar & Department Filter Chips */}
      {/* ========================================================================= */}
      <div className="space-y-2.5">
        {/* Instant Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="ค้นหาด้วยชื่อ, รหัสพนักงาน (EMP-001), User ID (U001), แผนก หรือตำแหน่ง..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-9 py-2 h-9 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:border-[#0D99FF] focus:ring-1 focus:ring-[#0D99FF] outline-none transition-all placeholder:text-slate-400 font-medium"
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

        {/* Department Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveDeptFilter('ALL')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeDeptFilter === 'ALL'
                ? 'bg-[#1E1E1E] text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-[#E5E5E5] hover:bg-slate-100'
            }`}
          >
            ทั้งหมด ({activeUsers.length})
          </button>

          {departmentsList.map(dept => {
            const count = activeUsers.filter(u => {
              const uDepts = u.depts || (u.department ? [u.department] : [u.dept]);
              return uDepts.includes(dept);
            }).length;

            const isSelected = activeDeptFilter === dept;

            return (
              <button
                key={dept}
                type="button"
                onClick={() => setActiveDeptFilter(dept)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                  isSelected
                    ? 'bg-[#0D99FF] text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-[#E5E5E5] hover:bg-slate-100'
                }`}
              >
                <span>{dept}</span>
                <span className={`text-[10px] font-mono px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Candidate Users List with High-Density Precision Cards */}
      {/* ========================================================================= */}
      <div className="border border-[#E5E5E5] bg-white rounded-xl overflow-hidden shadow-2xs">
        {/* List Header Toolbar */}
        <div className="px-3.5 py-2 bg-[#F5F5F5]/80 border-b border-[#E5E5E5] flex items-center justify-between text-xs">
          <span className="text-[11px] font-medium text-slate-600">
            พบ <strong className="text-[#1E1E1E]">{filteredUsers.length}</strong> รายชื่อ {activeDeptFilter !== 'ALL' ? `(แผนก ${activeDeptFilter})` : ''}
          </span>

          <div className="flex items-center gap-2">
            {filteredUsers.length > 0 && (
              <button
                type="button"
                onClick={isAllInViewSelected ? handleDeselectAllInView : handleSelectAllInView}
                className="text-[11px] font-bold text-[#0D99FF] hover:text-[#007BE5] hover:underline cursor-pointer"
              >
                {isAllInViewSelected ? 'ยกเลิกทั้งหมดในกลุ่มนี้' : 'เลือกทั้งหมดในกลุ่มนี้'}
              </button>
            )}
          </div>
        </div>

        {/* Users Rows Container */}
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
          {filteredUsers.length > 0 ? (
            filteredUsers.map(user => {
              const isSelected = selectedUserIds.includes(user.id);
              const theme = getDeptTheme(user.department || user.dept);

              return (
                <div
                  key={user.id}
                  onClick={() => handleToggleUser(user.id)}
                  className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50/50 hover:bg-blue-50'
                      : 'hover:bg-[#F9F9F9]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-[#0D99FF] border-[#0D99FF] text-white'
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} />}
                    </div>

                    {/* Avatar Initials */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${theme.avatar}`}>
                      {getInitials(user.name)}
                    </div>

                    {/* User Identity Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#1E1E1E] truncate">
                          {user.name}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${theme.bg}`}>
                          {user.department || user.dept}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Lv.{user.level}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#666666] truncate mt-0.5">
                        {user.position || 'พนักงาน'} {user.empId ? `• ${user.empId}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right User ID Tag */}
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-[11px] font-mono font-bold text-slate-400 group-hover:text-slate-600">
                      {user.id}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 px-4 text-center space-y-2">
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
  );
};

export default AuthorizedUsersSelector;
