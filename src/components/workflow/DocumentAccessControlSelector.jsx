import React, { useMemo } from 'react';
import { Globe, Lock, Building2, ShieldAlert, Check, Users, Award, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCESS_SCOPES } from '../../utils/accessControl';
import AuthorizedUsersSelector from './AuthorizedUsersSelector';

/**
 * DocumentAccessControlSelector component
 * 
 * @param {Object} props
 * @param {Object} props.value - { scope: 'GENERAL' | 'DEPT_ONLY' | 'TARGETED' | 'RESTRICTED', authorized_depts: [], authorized_users: [], min_access_level: number }
 * @param {Function} props.onChange - Callback with updated access_control object
 * @param {string} props.ownerDept - The document owner's department
 * @param {Array} props.masterDepartments - List of available departments
 * @param {Array} props.masterUsers - List of available users
 */
const DocumentAccessControlSelector = ({
  value = { scope: 'GENERAL', authorized_depts: [], authorized_users: [], min_access_level: 4 },
  onChange,
  ownerDept = 'QA',
  masterDepartments = [],
  masterUsers = []
}) => {
  const currentScope = value?.scope || ACCESS_SCOPES.GENERAL;
  const currentOwnerDept = ownerDept || 'QA';

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

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-2xs space-y-3.5">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-[#0D99FF]" size={16} />
          <h3 className="font-bold text-sm text-[#1E293B] uppercase tracking-wider">
            ระดับการเข้าถึงและความลับของเอกสาร (Document Confidentiality & Access Scope)
          </h3>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] self-start sm:self-auto">
          Scope: {currentScope}
        </span>
      </div>

      {/* Compact Horizontal 4-Card Segmented Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {scopeCards.map((card) => {
          const isSelected = currentScope === card.id;
          const Icon = card.icon;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleScopeChange(card.id)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer select-none flex items-start gap-2.5 outline-none ${
                isSelected
                  ? 'bg-[#F0F7FF] border-2 border-[#0D99FF] shadow-xs'
                  : 'bg-white border-[#E2E8F0] hover:bg-[#F8FAFC] hover:border-[#CBD5E1]'
              }`}
            >
              <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-[#0D99FF] text-white' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                <Icon size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-sm font-bold truncate ${isSelected ? 'text-[#0D99FF]' : 'text-[#1E293B]'}`}>
                    {card.label}
                  </span>
                  {isSelected && <Check className="text-[#0D99FF] shrink-0" size={14} strokeWidth={3} />}
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug line-clamp-2">
                  {card.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sub-config Panels */}
      <AnimatePresence mode="wait">
        {currentScope === ACCESS_SCOPES.TARGETED && (
          <motion.div
            key="targeted-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border border-[#CBD5E1] bg-[#F8FAFC] rounded-xl p-4 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div>
                <label className="text-xs font-bold text-[#1E293B] flex items-center gap-2">
                  <Building2 size={15} className="text-[#0D99FF]" /> เลือกแผนกที่อนุญาตให้เข้าถึงเอกสารนี้ (Authorized Departments)
                </label>
                <p className="text-[11px] text-[#64748B] mt-0.5 flex items-center gap-1.5">
                  <Lock size={11} className="text-slate-400 shrink-0" />
                  <span>แผนกเจ้าของเอกสาร (<strong className="text-slate-700 font-bold">{currentOwnerDept}</strong>) จะได้รับสิทธิ์เข้าถึงโดยอัตโนมัติและล็อกถาวร</span>
                </p>
              </div>
              <span className="text-xs text-[#64748B] font-mono font-bold shrink-0">
                เลือกแล้ว: {authorizedDepts.length} แผนก
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {(masterDepartments || []).map((dept) => {
                const deptId = typeof dept === 'string' ? dept : dept.id;
                const isOwner = deptId === currentOwnerDept;
                const isChecked = isOwner || authorizedDepts.includes(deptId);

                return (
                  <label
                    key={deptId}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs select-none transition-all ${
                      isOwner
                        ? 'bg-[#F1F5F9] border-[#CBD5E1] text-[#475569] cursor-not-allowed opacity-95 shadow-none pointer-events-none'
                        : isChecked
                          ? 'bg-[#E5F4FF] border-[#0D99FF] text-[#007BE5] font-bold shadow-2xs cursor-pointer hover:bg-[#D9EFFF]'
                          : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isChecked}
                      disabled={isOwner}
                      onChange={() => toggleDept(deptId)}
                    />
                    {isOwner ? (
                      <span className="w-3.5 h-3.5 rounded flex items-center justify-center bg-slate-400 text-white shrink-0">
                        <Lock size={9} strokeWidth={2.5} />
                      </span>
                    ) : (
                      <span
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                          isChecked ? 'bg-[#0D99FF] border-[#0D99FF] text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check size={10} strokeWidth={3} />}
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-1 min-w-0 flex-1">
                      <span className="truncate font-medium">{deptId}</span>
                      {isOwner && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono inline-flex items-center gap-0.5 shrink-0"
                          title="แผนกเจ้าของเอกสารมีสิทธิ์เข้าถึงถาวร"
                        >
                          <Lock size={8} />
                          <span>เจ้าของ (ล็อก)</span>
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </motion.div>
        )}

        {currentScope === ACCESS_SCOPES.RESTRICTED && (
          <motion.div
            key="restricted-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border border-rose-200 bg-rose-50/20 rounded-xl p-4 space-y-4"
          >
            {/* Top Row: Min Access Level Policy */}
            <div className="bg-white border border-rose-200 rounded-xl p-3.5 shadow-2xs space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1E293B] flex items-center gap-2">
                    <Award size={15} className="text-rose-600" /> ระดับตำแหน่งขั้นต่ำที่อนุญาต (Minimum Position Level)
                  </label>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    พนักงานที่มีตำแหน่งตั้งแต่ระดับนี้ขึ้นไปจะสามารถเข้าถึงและค้นหาเอกสารลับนี้ได้โดยอัตโนมัติ
                  </p>
                </div>
                <div className="w-full sm:w-72 shrink-0">
                  <select
                    value={minAccessLevel}
                    onChange={(e) => handleMinLevelChange(e.target.value)}
                    className="w-full h-9 px-3 select-primary bg-[#F9F9F9] text-xs font-semibold text-[#1E293B] border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value={1}>Level 1: พนักงานทั่วไปขึ้นไป (All Staff)</option>
                    <option value={3}>Level 3: Senior Staff ขึ้นไป</option>
                    <option value={4}>Level 4: หัวหน้างาน / Supervisor ขึ้นไป</option>
                    <option value={5}>Level 5: ผู้ช่วยผู้จัดการ / Asst. Manager ขึ้นไป</option>
                    <option value={6}>Level 6: ผู้จัดการฝ่าย / Department Manager ขึ้นไป</option>
                    <option value={7}>Level 7: ผู้บริหารระดับสูง / Directors & Executives</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bottom Section: Enterprise Searchable Multi-Select User Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1E293B] flex items-center gap-2">
                <Users size={15} className="text-rose-600" /> ระบุบุคคลที่ได้รับอนุญาตเพิ่มเติมเฉพาะบุคคล (Authorized Users)
              </label>
              <AuthorizedUsersSelector
                selectedUserIds={authorizedUsers}
                onChange={handleAuthorizedUsersChange}
                users={masterUsers}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DocumentAccessControlSelector;

