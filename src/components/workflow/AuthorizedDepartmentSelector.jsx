import React, { useMemo } from 'react';
import { 
  Building2, 
  Crown, 
  Check, 
  Lock, 
  Factory, 
  Warehouse, 
  Wrench, 
  ShieldCheck, 
  Users, 
  TrendingUp, 
  ShoppingCart, 
  FileCheck2,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { normalizeDepartmentId } from '../../services/MasterDataService';

// รายการแผนกพร้อมชื่อเต็ม ไอคอน และหมวดหมู่สายงาน
export const DEPARTMENT_REGISTRY = [
  { code: 'QA', name: 'ประกันคุณภาพ', group: 'QUALITY', icon: ShieldCheck },
  { code: 'QC', name: 'ควบคุมคุณภาพ', group: 'QUALITY', icon: FileCheck2 },
  { code: 'PD', name: 'ฝ่ายผลิต', group: 'OPERATION', icon: Factory },
  { code: 'WH', name: 'คลังสินค้าและโลจิสติกส์', group: 'OPERATION', icon: Warehouse },
  { code: 'ST', name: 'คลังจัดเก็บวัตถุดิบ', group: 'OPERATION', icon: Warehouse },
  { code: 'EN', name: 'วิศวกรรมและซ่อมบำรุง', group: 'OPERATION', icon: Wrench },
  { code: 'PC', name: 'วางแผนการผลิตและจัดซื้อ', group: 'OPERATION', icon: ShoppingCart },
  { code: 'HR&GA', name: 'ทรัพยากรบุคคลและธุรการ', group: 'SUPPORT', icon: Users },
  { code: 'HSE', name: 'ความปลอดภัยและสิ่งแวดล้อม', group: 'SUPPORT', icon: ShieldCheck },
  { code: 'MKT', name: 'การตลาดและการขาย', group: 'SUPPORT', icon: TrendingUp },
];

export const AuthorizedDepartmentSelector = ({
  ownerDept = 'QA',
  selectedDepts = [],
  onToggleDept = () => {},
  onBatchSelect = () => {},
  masterDepartments = []
}) => {
  const normOwnerDept = normalizeDepartmentId(ownerDept);

  // Normalize list of departments dynamically from masterDepartments or fallback to DEPARTMENT_REGISTRY
  const fullDeptList = useMemo(() => {
    if (masterDepartments && masterDepartments.length > 0) {
      return masterDepartments.map(d => {
        const code = typeof d === 'string' ? d : (d.code || d.id);
        const known = DEPARTMENT_REGISTRY.find(reg => reg.code === code || normalizeDepartmentId(reg.code) === normalizeDepartmentId(code));
        return {
          code: code,
          name: typeof d === 'string' ? (known?.name || `${code} Department`) : (d.nameTh || d.name || known?.name || `${code} Department`),
          group: known?.group || 'OPERATION',
          icon: known?.icon || Building2
        };
      });
    }
    return DEPARTMENT_REGISTRY;
  }, [masterDepartments]);

  // คัดกรองแผนกที่ไม่ใช่เจ้าของเอกสาร
  const selectableDepts = useMemo(
    () => fullDeptList.filter((d) => normalizeDepartmentId(d.code) !== normOwnerDept),
    [fullDeptList, normOwnerDept]
  );

  const ownerDeptObj = useMemo(
    () => fullDeptList.find((d) => normalizeDepartmentId(d.code) === normOwnerDept) || { 
      code: normOwnerDept, 
      name: 'ฝ่ายเจ้าของเอกสาร', 
      icon: ShieldCheck 
    },
    [fullDeptList, normOwnerDept]
  );

  // Preset Handlers
  const handleSelectAll = () => {
    const allCodes = selectableDepts.map((d) => d.code);
    onBatchSelect(allCodes);
  };

  const handleClearAll = () => {
    onBatchSelect([]);
  };

  const handleSelectGroup = (groupName) => {
    const groupCodes = selectableDepts.filter((d) => d.group === groupName).map((d) => d.code);
    const newSelection = Array.from(new Set([...selectedDepts, ...groupCodes]));
    onBatchSelect(newSelection);
  };

  const totalSelectedCount = selectedDepts.length + 1; // รวมแผนกเจ้าของเสมอ

  return (
    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs w-full min-h-0 h-auto">
      
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="text-[#0D99FF]" size={18} />
            <h4 className="text-xs font-bold text-[#1E293B]">
              เลือกแผนกที่อนุญาตให้เข้าถึงเอกสารนี้ (Authorized Departments)
            </h4>
          </div>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            คลิกที่การ์ดเพื่อเปิดหรือปิดสิทธิ์การเข้าถึงเอกสารสำหรับแผนกนั้น ๆ
          </p>
        </div>

        {/* Counter HUD */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 bg-white border border-[#CBD5E1] rounded-xl text-xs font-bold text-[#1E293B] shadow-2xs font-mono">
            อนุญาตแล้ว: <strong className="text-[#0D99FF]">{totalSelectedCount}</strong> / {fullDeptList.length} แผนก
          </span>
        </div>
      </div>

      {/* Preset Quick Filters (ปุ่มลัดช่วยเลือก) */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[11px] font-bold text-[#64748B] mr-1 flex items-center gap-1">
          <Sparkles className="text-[#D97706]" size={12} /> ตัวช่วยเลือก:
        </span>
        
        <button
          type="button"
          onClick={() => handleSelectGroup('OPERATION')}
          className="px-2.5 py-1 bg-white hover:bg-[#F0F7FF] hover:border-[#0D99FF] border border-[#CBD5E1] rounded-lg text-[11px] font-semibold text-[#334155] transition-all cursor-pointer shadow-2xs"
        >
          🏭 สายงานผลิต/หน้างาน (PD, WH, EN, PC, ST)
        </button>

        <button
          type="button"
          onClick={() => handleSelectGroup('SUPPORT')}
          className="px-2.5 py-1 bg-white hover:bg-[#F0F7FF] hover:border-[#0D99FF] border border-[#CBD5E1] rounded-lg text-[11px] font-semibold text-[#334155] transition-all cursor-pointer shadow-2xs"
        >
          🏢 สายงานสนับสนุน (HR, HSE, MKT)
        </button>

        <button
          type="button"
          onClick={handleSelectAll}
          className="px-2.5 py-1 bg-[#E5F4FF] hover:bg-[#D0EBFF] border border-[#BAE6FD] rounded-lg text-[11px] font-bold text-[#0D99FF] transition-all cursor-pointer shadow-2xs"
        >
          ⚡ เลือกทั้งหมด
        </button>

        {selectedDepts.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="px-2.5 py-1 bg-white hover:bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[11px] font-bold text-[#DC2626] transition-all flex items-center gap-1 ml-auto cursor-pointer shadow-2xs"
          >
            <RotateCcw size={11} />
            <span>ล้างค่า</span>
          </button>
        )}
      </div>

      {/* Modern Department Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
        
        {/* 👑 1. การ์ดแผนกเจ้าของ (Owner Department - ล็อกถาวร) */}
        <div 
          data-testid={`dept-card-${ownerDeptObj.code}`}
          className="relative p-3 rounded-xl border border-[#FCD34D] bg-[#FFFDF5] shadow-2xs flex items-center justify-between select-none ring-1 ring-[#FCD34D]/40"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-1">
            <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
              <Crown size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#1E293B] font-mono">{ownerDeptObj.code}</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                  เจ้าของ
                </span>
              </div>
              <p className="text-[10px] text-[#78350F] truncate">{ownerDeptObj.name}</p>
            </div>
          </div>
          <Lock className="text-[#D97706] shrink-0" size={13} />
        </div>

        {/* 🏢 2. การ์ดแผนกอื่นๆ ทั้งหมด (Interactive Toggle Cards) */}
        {selectableDepts.map((dept) => {
          const isSelected = selectedDepts.includes(dept.code) || selectedDepts.some(d => normalizeDepartmentId(d) === normalizeDepartmentId(dept.code));
          const IconComponent = dept.icon || Building2;

          return (
            <label
              key={dept.code}
              data-testid={`dept-card-${dept.code}`}
              onClick={(e) => {
                // If label clicks input automatically, avoid double triggers
                e.preventDefault();
                onToggleDept(dept.code);
              }}
              className={`relative p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between group ${
                isSelected
                  ? 'bg-white border-[#0D99FF] ring-2 ring-[#0D99FF]/20 shadow-xs'
                  : 'bg-white border-[#CBD5E1] hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                className="sr-only"
                aria-label={dept.code}
              />
              <div className="flex items-center gap-2.5 min-w-0 pr-1">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-[#0D99FF] text-white'
                      : 'bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#E2E8F0] group-hover:text-[#334155]'
                  }`}
                >
                  <IconComponent size={15} />
                </div>

                <div className="min-w-0">
                  <span className={`text-xs font-bold font-mono block ${isSelected ? 'text-[#0D99FF]' : 'text-[#1E293B]'}`}>
                    {dept.code}
                  </span>
                  <p className="text-[10px] text-[#64748B] truncate group-hover:text-[#475569]">
                    {dept.name}
                  </p>
                </div>
              </div>

              {/* Status Pill Checkmark */}
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  isSelected
                    ? 'bg-[#0D99FF] text-white scale-100'
                    : 'border border-[#CBD5E1] bg-white group-hover:border-[#94A3B8]'
                }`}
              >
                {isSelected && <Check size={12} strokeWidth={3} />}
              </div>
            </label>
          );
        })}

      </div>

    </div>
  );
};

export default AuthorizedDepartmentSelector;
