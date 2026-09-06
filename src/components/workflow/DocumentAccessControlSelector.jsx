import React, { useMemo, useState } from 'react';
import { Globe, Lock, Building2, ShieldAlert, Check, ShieldCheck, Shield, Info, Users, ListFilter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCESS_SCOPES } from '../../utils/accessControl';
import AuthorizedUsersSelector from './AuthorizedUsersSelector';
import useStore from '../../store/useStore';
import { resolveReviewer, resolveApprover } from '../../utils/workflowResolver';

/**
 * DocumentAccessControlSelector component
 * 
 * @param {Object} props
 * @param {Object} props.value - { scope: 'GENERAL' | 'DEPT_ONLY' | 'TARGETED' | 'RESTRICTED', authorized_depts: [], authorized_users: [], min_access_level: number, restricted_mode: 'MIN_LEVEL' | 'WHITELIST' }
 * @param {Function} props.onChange - Callback with updated access_control object
 * @param {string} props.ownerDept - The document owner's department
 * @param {Array} props.masterDepartments - List of available departments
 * @param {Array} props.masterUsers - List of available users
 * @param {Array} props.workflowParticipants - Optional explicit list of workflow participants
 */
const DocumentAccessControlSelector = ({
  value = { scope: 'GENERAL', authorized_depts: [], authorized_users: [], min_access_level: 4 },
  onChange,
  ownerDept = 'QA',
  masterDepartments = [],
  masterUsers = [],
  workflowParticipants = []
}) => {
  const currentScope = value?.scope || ACCESS_SCOPES.GENERAL;
  const currentOwnerDept = ownerDept || 'QA';

  // Restricted sub-mode: persisted in value.restricted_mode or local state
  // 'MIN_LEVEL' = gating by minimum position level, 'WHITELIST' = explicit person list
  const restrictedMode = value?.restricted_mode || 'WHITELIST';

  const setRestrictedMode = (mode) => {
    onChange({
      ...value,
      restricted_mode: mode
    });
  };

  // Normalize authorized departments: Ensure owner department is always included
  const authorizedDepts = useMemo(() => {
    const rawList = value?.authorized_depts || [];
    if (currentScope === ACCESS_SCOPES.TARGETED) {
      if (!rawList.includes(currentOwnerDept)) {
        return [currentOwnerDept, ...rawList];
      }
    }
    return rawList;
  }, [value?.authorized_depts, currentScope, currentOwnerDept]);

  const authorizedUsers = value?.authorized_users || [];
  const minAccessLevel = value?.min_access_level ?? 4;

  // Auto-resolve workflow participants (Requester, Reviewer, Approver) if not provided explicitly
  const resolvedWorkflowParticipants = useMemo(() => {
    if (workflowParticipants && workflowParticipants.length > 0) {
      return workflowParticipants;
    }
    try {
      const storeState = typeof window !== 'undefined' ? useStore?.getState?.() : null;
      if (storeState) {
        const list = [];
        const currentU = storeState.currentUser;
        if (currentU) {
          list.push({
            id: currentU.id,
            empId: currentU.empId,
            name: currentU.name,
            department: currentU.department || currentU.dept || currentOwnerDept,
            role: 'REQUESTER',
            roleTitle: 'ผู้จัดทำ (Requester)'
          });
          const allMasters = masterUsers && masterUsers.length > 0 ? masterUsers : (storeState.masterUsers || []);
          const allReviewers = storeState.reviewUsers || allMasters;
          const allApprovers = storeState.approveUsers || allMasters;
          const revObj = resolveReviewer(currentU.id, currentOwnerDept, allMasters, allReviewers);
          if (revObj && revObj.id !== currentU.id) {
            const revU = allMasters.find(u => u.id === revObj.id);
            if (revU) {
              list.push({
                id: revU.id,
                empId: revU.empId,
                name: revU.name,
                department: revU.primary_department || revU.department || revObj.dept,
                role: 'REVIEWER',
                roleTitle: 'ผู้ทบทวน (Reviewer)'
              });
            }
          }
          const appObj = resolveApprover(currentU.id, revObj?.id, currentOwnerDept, allMasters, allApprovers);
          if (appObj && appObj.id !== currentU.id && appObj.id !== revObj?.id) {
            const appU = allMasters.find(u => u.id === appObj.id);
            if (appU) {
              list.push({
                id: appU.id,
                empId: appU.empId,
                name: appU.name,
                department: appU.primary_department || appU.department || appObj.dept,
                role: 'APPROVER',
                roleTitle: 'ผู้อนุมัติ (Approver)'
              });
            }
          }
        }
        return list;
      }
    } catch {
      // Gracefully handle any lookup exceptions
    }
    return [];
  }, [workflowParticipants, masterUsers, currentOwnerDept]);

  const handleScopeChange = (newScope) => {
    let nextDepts = value?.authorized_depts || [];
    if (newScope === ACCESS_SCOPES.TARGETED) {
      if (!nextDepts.includes(currentOwnerDept)) {
        nextDepts = [currentOwnerDept, ...nextDepts];
      }
    }

    onChange({
      ...value,
      scope: newScope,
      authorized_depts: nextDepts,
      authorized_users: authorizedUsers,
      min_access_level: minAccessLevel
    });
  };

  const toggleDept = (deptId) => {
    // Guard Lock: Owner department is immutable and cannot be toggled
    if (deptId === currentOwnerDept) return;

    let nextDepts = [];
    if (authorizedDepts.includes(deptId)) {
      // Remove department while guaranteeing owner department remains
      nextDepts = authorizedDepts.filter((d) => d !== deptId);
    } else {
      // Add department
      nextDepts = [...authorizedDepts, deptId];
    }

    // Safety guarantee: owner department must always be present
    if (!nextDepts.includes(currentOwnerDept)) {
      nextDepts.unshift(currentOwnerDept);
    }

    onChange({
      ...value,
      authorized_depts: nextDepts
    });
  };

  const handleAuthorizedUsersChange = (nextUsers) => {
    onChange({
      ...value,
      authorized_users: nextUsers
    });
  };

  const handleMinLevelChange = (level) => {
    onChange({
      ...value,
      min_access_level: Number(level)
    });
  };

  const scopeCards = [
    {
      id: ACCESS_SCOPES.GENERAL,
      label: 'ทั่วไป (General)',
      desc: 'เปิดให้ทุกคนในองค์กรเข้าถึงได้',
      icon: Globe
    },
    {
      id: ACCESS_SCOPES.DEPT_ONLY,
      label: 'เฉพาะแผนกฉัน (Department Only)',
      desc: `ล็อกเฉพาะคนในแผนก ${currentOwnerDept}`,
      icon: Lock
    },
    {
      id: ACCESS_SCOPES.TARGETED,
      label: 'เฉพาะบางแผนก (Targeted)',
      desc: 'เลือกแผนกที่อนุญาตให้เปิดดูร่วมกัน',
      icon: Building2
    },
    {
      id: ACCESS_SCOPES.RESTRICTED,
      label: 'ลับเฉพาะบุคคล/ตำแหน่ง (Restricted)',
      desc: 'ระบุบุคคล หรือ Min Level',
      icon: ShieldAlert
    }
  ];

  // Level label lookup
  const levelLabel = (lvl) => {
    const map = {
      1: 'Level 1 — ทุกคนในองค์กร (All Staff)',
      3: 'Level 3 — เจ้าหน้าที่อาวุโสขึ้นไป (Senior Staff L3+)',
      4: 'Level 4 — หัวหน้างานขึ้นไป (Supervisor L4+)',
      5: 'Level 5 — ผู้ช่วยผู้จัดการขึ้นไป (Asst. Manager L5+)',
      6: 'Level 6 — ผู้จัดการฝ่ายขึ้นไป (Dept. Manager L6+)',
      7: 'Level 7 — ผู้บริหารระดับสูง (Directors & Executives)'
    };
    return map[lvl] || `Level ${lvl}+`;
  };

  return (
    <div className="bg-white/95 border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 transition-all">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              ระดับการเข้าถึงและความลับของเอกสาร (Document Confidentiality & Access Scope)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              กำหนดขอบเขตและนโยบายความปลอดภัยการเปิดดูเอกสารดิจิทัลตามมาตรฐาน ISO 9001
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Scope: {currentScope}
          </span>
        </div>
      </div>

      {/* Section 1: Modern Bento Grid Radio Cards (4 Columns) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {scopeCards.map((card) => {
          const isSelected = currentScope === card.id;
          const Icon = card.icon;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleScopeChange(card.id)}
              className={`relative p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer select-none flex flex-col justify-between min-h-[120px] outline-none group hover:scale-[1.01] ${
                isSelected
                  ? 'ring-2 ring-indigo-500 bg-indigo-50/40 border-transparent shadow-sm'
                  : 'bg-white border-slate-200/80 hover:bg-slate-50/70 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between w-full mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  isSelected 
                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-300' 
                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-700'
                }`}>
                  <Icon size={18} strokeWidth={2.2} />
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </div>
              <div className="space-y-1 min-w-0">
                <div className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800 group-hover:text-slate-950'}`}>
                  {card.label}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                  {card.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sub-config Panels */}
      <AnimatePresence mode="wait">
        {/* Section 2: Authorized Departments (TARGETED) */}
        {currentScope === ACCESS_SCOPES.TARGETED && (
          <motion.div
            key="targeted-panel"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="overflow-hidden border border-slate-200/90 bg-slate-50/60 rounded-2xl p-5 space-y-4 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Building2 size={16} className="text-indigo-600" />
                  <span>เลือกแผนกที่อนุญาตให้เข้าถึงเอกสารนี้ (Authorized Departments)</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <Lock size={12} className="text-slate-400 shrink-0" />
                  <span>แผนกเจ้าของเอกสาร (<strong className="text-slate-800 font-bold">{currentOwnerDept}</strong>) จะได้รับสิทธิ์เข้าถึงโดยอัตโนมัติและล็อกถาวร</span>
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-white text-indigo-700 border border-indigo-100 shadow-2xs shrink-0 self-start sm:self-auto">
                เลือกแล้ว: {authorizedDepts.length} แผนก
              </span>
            </div>

            {/* Interactive Department Chips / Pills */}
            <div className="flex flex-wrap gap-2.5">
              {(masterDepartments || []).map((dept) => {
                const deptId = typeof dept === 'string' ? dept : dept.id;
                const isOwner = deptId === currentOwnerDept;
                const isChecked = isOwner || authorizedDepts.includes(deptId);

                if (isOwner) {
                  return (
                    <label
                      key={deptId}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white border border-zinc-900 shadow-xs cursor-not-allowed select-none opacity-95 transition-all"
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={true}
                        disabled={true}
                        readOnly
                      />
                      <Lock size={12} className="text-amber-400 shrink-0" />
                      <span className="font-mono text-xs tracking-wider">{deptId}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-800 text-amber-300 font-mono inline-flex items-center gap-1 border border-zinc-700 shadow-2xs">
                        <span>Owner</span>
                        <span>•</span>
                        <span>เจ้าของ (ล็อก)</span>
                      </span>
                    </label>
                  );
                }

                return (
                  <label
                    key={deptId}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs select-none cursor-pointer transition-all duration-150 active:scale-95 ${
                      isChecked
                        ? 'bg-indigo-600 text-white font-bold border border-indigo-600 shadow-md shadow-indigo-200 hover:bg-indigo-700'
                        : 'bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-100 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isChecked}
                      disabled={isOwner}
                      onChange={() => toggleDept(deptId)}
                    />
                    {isChecked ? (
                      <Check size={13} strokeWidth={3} className="text-white shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 bg-slate-50 shrink-0" />
                    )}
                    <span className="font-mono font-semibold">{deptId}</span>
                  </label>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Restricted Sub-panel — Clean Segmented Radio Mode Controller */}
        {currentScope === ACCESS_SCOPES.RESTRICTED && (
          <motion.div
            key="restricted-panel"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="overflow-hidden border border-rose-200/70 bg-rose-50/30 rounded-3xl p-5 shadow-2xs space-y-4"
          >
            {/* Panel Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                <ShieldAlert size={17} strokeWidth={2.2} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">โหมดลับเฉพาะ (Restricted Access)</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  เลือกวิธีควบคุมสิทธิ์เข้าถึงสำหรับโหมดลับเฉพาะนี้ — เลือกได้เพียงหนึ่งโหมด
                </p>
              </div>
            </div>

            {/* ======================================================== */}
            {/* Segmented Radio Controller: 2 Mutually-Exclusive Modes    */}
            {/* ======================================================== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mode A: Min Level */}
              <button
                type="button"
                onClick={() => setRestrictedMode('MIN_LEVEL')}
                className={`relative p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer select-none outline-none group ${
                  restrictedMode === 'MIN_LEVEL'
                    ? 'ring-2 ring-amber-500 bg-amber-50/60 border-transparent shadow-sm'
                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between mb-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    restrictedMode === 'MIN_LEVEL'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-amber-50 group-hover:text-amber-600'
                  }`}>
                    <ListFilter size={16} strokeWidth={2.2} />
                  </div>
                  {restrictedMode === 'MIN_LEVEL' && (
                    <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className={`text-xs font-bold ${restrictedMode === 'MIN_LEVEL' ? 'text-amber-900' : 'text-slate-800'}`}>
                    🔐 โหมด 1: ตามระดับตำแหน่งขั้นต่ำ
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    กำหนดระดับขั้นต่ำ (L3–L7) — ทุกคนที่ระดับนั้นขึ้นไปจะเข้าถึงได้อัตโนมัติ ไม่ต้องระบุรายชื่อ
                  </p>
                </div>
              </button>

              {/* Mode B: Custom Whitelist */}
              <button
                type="button"
                onClick={() => setRestrictedMode('WHITELIST')}
                className={`relative p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer select-none outline-none group ${
                  restrictedMode === 'WHITELIST'
                    ? 'ring-2 ring-indigo-500 bg-indigo-50/60 border-transparent shadow-sm'
                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between mb-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    restrictedMode === 'WHITELIST'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                  }`}>
                    <Users size={16} strokeWidth={2.2} />
                  </div>
                  {restrictedMode === 'WHITELIST' && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className={`text-xs font-bold ${restrictedMode === 'WHITELIST' ? 'text-indigo-900' : 'text-slate-800'}`}>
                    👤 โหมด 2: ระบุรายชื่อเฉพาะบุคคล
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    ค้นหาและเลือกพนักงานที่ได้รับสิทธิ์เฉพาะเจาะจง — ไม่มีชื่อในรายการ ไม่มีสิทธิ์เข้าถึง
                  </p>
                </div>
              </button>
            </div>

            {/* ======================================================== */}
            {/* Conditional Panel A: Min Level Mode                       */}
            {/* ======================================================== */}
            <AnimatePresence mode="wait">
              {restrictedMode === 'MIN_LEVEL' && (
                <motion.div
                  key="min-level-content"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="space-y-3"
                >
                  {/* Level Selector Card */}
                  <div className="border border-amber-200/80 bg-white rounded-2xl p-4 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center shrink-0 shadow-2xs">
                        <Shield size={16} strokeWidth={2.2} />
                      </div>
                      <div>
                        <label htmlFor="min-access-level-select" className="text-xs font-bold text-slate-900 block cursor-pointer">
                          ระดับตำแหน่งขั้นต่ำที่อนุญาต (Minimum Position Level)
                        </label>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          เลือกระดับขั้นต่ำ — พนักงานที่มีระดับตั้งแต่นี้ขึ้นไปในแผนกที่ได้รับอนุญาตจะเข้าถึงได้อัตโนมัติ
                        </p>
                      </div>
                    </div>

                    <select
                      id="min-access-level-select"
                      aria-label="ระดับสิทธิ์ขั้นต่ำ"
                      value={minAccessLevel}
                      onChange={(e) => handleMinLevelChange(e.target.value)}
                      className="w-full h-10 px-3.5 bg-amber-50/60 hover:bg-amber-50 text-xs font-bold text-slate-800 border border-amber-200 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
                    >
                      <option value={3}>L3+ — เจ้าหน้าที่อาวุโสขึ้นไป (Senior Staff)</option>
                      <option value={4}>L4+ — หัวหน้างานขึ้นไป (Supervisor)</option>
                      <option value={5}>L5+ — ผู้ช่วยผู้จัดการขึ้นไป (Asst. Manager)</option>
                      <option value={6}>L6+ — ผู้จัดการฝ่ายขึ้นไป (Dept. Manager)</option>
                      <option value={7}>L7+ — ผู้บริหารระดับสูง (Directors & Executives)</option>
                    </select>
                  </div>

                  {/* Auto-Authorized Workflow Participants */}
                  {resolvedWorkflowParticipants.length > 0 && (
                    <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-2xl p-3.5 shadow-2xs space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Lock size={11} strokeWidth={2.4} />
                        </div>
                        <span className="text-xs font-bold text-slate-900">สิทธิ์เข้าถึงอัตโนมัติตามสายอนุมัติ (Auto-Authorized)</span>
                      </div>
                      <p className="text-[11px] text-emerald-800/80 leading-relaxed font-medium">
                        ผู้จัดทำ ผู้ทบทวน และผู้อนุมัติในสายงานได้รับสิทธิ์เข้าถึงโดยอัตโนมัติ (ไม่ขึ้นกับระดับขั้นต่ำ)
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {resolvedWorkflowParticipants.map((p) => (
                          <div
                            key={p.id}
                            className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-xl bg-white border border-emerald-200/90 text-xs shadow-2xs select-none"
                          >
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                              {(p.name || '?').slice(0, 1)}
                            </span>
                            <span className="font-bold text-slate-800 text-[12px] truncate max-w-[120px]">{p.name}</span>
                            <span className="text-[10px] font-mono font-semibold px-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {p.roleTitle}
                            </span>
                            <Lock size={10} className="text-emerald-600 shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Info Banner */}
                  <motion.div
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3 shadow-2xs"
                  >
                    <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h5 className="text-xs font-bold text-amber-900">
                        นโยบายการเข้าถึงอัตโนมัติตามระดับตำแหน่ง
                      </h5>
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        พนักงานทุกคนที่มีระดับตำแหน่งตั้งแต่ <strong>{levelLabel(minAccessLevel)}</strong> จะได้รับสิทธิ์เข้าถึงเอกสารนี้โดยอัตโนมัติ ไม่ต้องระบุรายชื่อเพิ่มเติม
                      </p>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* ======================================================== */}
              {/* Conditional Panel B: Custom Whitelist Mode               */}
              {/* ======================================================== */}
              {restrictedMode === 'WHITELIST' && (
                <motion.div
                  key="whitelist-content"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  <AuthorizedUsersSelector
                    selectedUserIds={authorizedUsers}
                    onChange={handleAuthorizedUsersChange}
                    users={masterUsers}
                    minLevel={null}
                    onMinLevelChange={null}
                    workflowParticipants={resolvedWorkflowParticipants}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DocumentAccessControlSelector;
