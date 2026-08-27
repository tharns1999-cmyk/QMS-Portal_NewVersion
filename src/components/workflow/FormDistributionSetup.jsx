import React from 'react';
import { FileSpreadsheet, CheckCircle2, Globe, Building2, Check, Info } from 'lucide-react';
import { normalizeDepartmentId } from '../../services/MasterDataService';

/**
 * FormDistributionSetup
 * 
 * Component for Digital Form (FM) Distribution boundary and access scope cascading.
 * Conforms to ISO 9001 & ISO 27001 ISMS Security Boundary standards.
 * 
 * Cascading Rule: Distribution Scope ⊆ Access Scope
 * When Access Scope is 'TARGETED', 'DEPT_ONLY', or 'RESTRICTED', 'ALL_DEPTS' is locked.
 */
export const FormDistributionSetup = ({
  accessScope = 'GENERAL',
  accessControl = null,
  ownerDept = 'QA',
  distributionMode = 'ALL_DEPTS',
  selectedDepts = [],
  authorizedDepts: propAuthorizedDepts = [],
  allDepartments = [],
  onChangeMode = () => {},
  onToggleDept = () => {},
}) => {
  const resolvedScope = accessControl?.scope || accessScope || 'GENERAL';
  const isDeptOnly = resolvedScope === 'DEPT_ONLY';
  const isRestricted = resolvedScope === 'RESTRICTED';
  const isTargeted = resolvedScope === 'TARGETED';
  const isAllDeptsDisabled = isDeptOnly || isTargeted || isRestricted;

  const rawAuthDepts = (accessControl?.authorized_depts && accessControl.authorized_depts.length > 0)
    ? accessControl.authorized_depts
    : propAuthorizedDepts;

  const authorizedDepts = (rawAuthDepts || []).map(normalizeDepartmentId);
  const displayOwner = ownerDept || 'QA';
  const normOwner = normalizeDepartmentId(ownerDept) || 'QA';

  // กรองแผนกที่จะแสดงให้เลือกแจกจ่าย
  // ถ้าเป็น TARGETED: แสดงเฉพาะแผนกเจ้าของ + แผนกที่ถูกเลือกใน Authorized Departments ด้านบน
  const displayDepartments = React.useMemo(() => {
    if (isTargeted) {
      return allDepartments.filter((d) => {
        const dCode = normalizeDepartmentId(d.code || d.id || d);
        return dCode === normOwner || authorizedDepts.includes(dCode);
      });
    }
    return allDepartments;
  }, [allDepartments, isTargeted, authorizedDepts, normOwner]);

  const effectiveDistributionMode = isAllDeptsDisabled ? 'SPECIFIC_DEPTS' : distributionMode;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-2xs space-y-4 w-full">
      
      {/* Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#F0F7FF] text-[#0D99FF]">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#1E293B]">
              ระบบแจกจ่ายแบบฟอร์มบันทึกข้อมูล (Digital Form Distribution)
            </h4>
            <p className="text-xs text-[#64748B]">
              แบบฟอร์มเปล่าดิจิทัลสำหรับดาวน์โหลด (Bypass เล่มสำเนาควบคุมและคิวพิมพ์ DCC)
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9] flex items-center gap-1.5">
          <CheckCircle2 size={13} />
          <span>พร้อมใช้งานใน Library ทันทีเมื่ออนุมัติ</span>
        </span>
      </div>

      {/* Selector Options */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-[#334155]">
          รูปแบบการเข้าถึงและดาวน์โหลดแบบฟอร์ม <span className="text-[#EF4444]">*</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          {/* การ์ด 1: ทุกแผนก (All Departments) */}
          <div
            data-testid="form-dist-all-depts"
            onClick={() => {
              if (!isAllDeptsDisabled) onChangeMode('ALL_DEPTS');
            }}
            className={`p-3.5 rounded-xl border transition-all select-none flex items-start gap-3 ${
              isAllDeptsDisabled
                ? 'bg-[#F8FAFC] border-[#E2E8F0] opacity-45 cursor-not-allowed'
                : effectiveDistributionMode === 'ALL_DEPTS'
                ? 'bg-[#F0F7FF] border-[#0D99FF] ring-1 ring-[#0D99FF]/20 cursor-pointer shadow-2xs'
                : 'bg-white border-[#CBD5E1] hover:bg-[#F8FAFC] cursor-pointer'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${effectiveDistributionMode === 'ALL_DEPTS' && !isAllDeptsDisabled ? 'bg-[#0D99FF] text-white' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
              <Globe size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E293B]">ทุกแผนกในองค์กร (All Departments)</span>
                {effectiveDistributionMode === 'ALL_DEPTS' && !isAllDeptsDisabled && (
                  <Check className="text-[#0D99FF]" size={15} strokeWidth={3} />
                )}
              </div>
              <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">
                {isTargeted
                  ? '⛔ ปิดใช้งาน: ระดับความลับถูกจำกัดเฉพาะบางแผนก (Targeted)'
                  : isDeptOnly
                  ? '⛔ ปิดใช้งาน: ระดับความลับถูกจำกัดเฉพาะแผนกตนเอง (Dept Only)'
                  : isRestricted
                  ? '⛔ ปิดใช้งาน: ระดับความลับถูกจำกัดเฉพาะบุคคล (Restricted)'
                  : 'ทุกแผนกในองค์กรสามารถมองเห็นและดาวน์โหลดแบบฟอร์มได้'}
              </p>
            </div>
          </div>

          {/* การ์ด 2: เลือกเฉพาะแผนกที่เกี่ยวข้อง */}
          <div
            data-testid="form-dist-specific-depts"
            onClick={() => onChangeMode('SPECIFIC_DEPTS')}
            className={`p-3.5 rounded-xl border transition-all select-none flex items-start gap-3 ${
              effectiveDistributionMode === 'SPECIFIC_DEPTS' || isAllDeptsDisabled
                ? 'bg-[#F0F7FF] border-[#0D99FF] ring-1 ring-[#0D99FF]/20 cursor-pointer shadow-2xs'
                : 'bg-white border-[#CBD5E1] hover:bg-[#F8FAFC] cursor-pointer'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${effectiveDistributionMode === 'SPECIFIC_DEPTS' || isAllDeptsDisabled ? 'bg-[#0D99FF] text-white' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
              <Building2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E293B]">
                  {isDeptOnly ? `เฉพาะแผนก ${displayOwner} เท่านั้น (Owner Dept)` : 'เลือกเฉพาะแผนกที่เกี่ยวข้อง'}
                </span>
                {(effectiveDistributionMode === 'SPECIFIC_DEPTS' || isAllDeptsDisabled) && (
                  <Check className="text-[#0D99FF]" size={15} strokeWidth={3} />
                )}
              </div>
              <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">
                {isTargeted
                  ? 'กำหนดแผนกผู้ใช้งานจากรายชื่อที่ได้รับอนุญาตด้านบน'
                  : isDeptOnly
                  ? `🔒 ใช้งานได้เฉพาะบุคลากรในแผนก ${displayOwner}`
                  : isRestricted
                  ? `🔒 จำกัดการใช้งานเฉพาะบุคคลที่ได้รับสิทธิ์`
                  : 'กำหนดเฉพาะบางแผนกที่ต้องใช้งานแบบฟอร์มนี้'}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* รายการ Checkbox แผนก (แสดงเมื่อเลือก SPECIFIC_DEPTS และไม่ใช่ DEPT_ONLY) */}
      {effectiveDistributionMode === 'SPECIFIC_DEPTS' && !isDeptOnly && (
        <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#334155]">
              {isTargeted ? 'แผนกที่ได้รับอนุญาตให้ใช้ฟอร์ม (จากขอบเขต Targeted):' : 'เลือกแผนกที่ต้องใช้งานแบบฟอร์มนี้:'}
            </span>
            <span className="text-[11px] font-mono text-[#64748B]">
              เลือกแล้ว {selectedDepts.length} แผนก
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {displayDepartments.map((dept) => {
              const deptCode = dept.code || dept.id || dept;
              const deptName = dept.nameTh || dept.name || deptCode;
              const isOwner = normalizeDepartmentId(deptCode) === normOwner;
              const isChecked = isOwner || selectedDepts.map(normalizeDepartmentId).includes(normalizeDepartmentId(deptCode));

              return (
                <label
                  key={deptCode}
                  className={`p-2 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                    isOwner
                      ? 'bg-[#E2E8F0] border-[#CBD5E1] text-[#475569] cursor-not-allowed font-semibold'
                      : isChecked
                      ? 'bg-[#E5F4FF] border-[#0D99FF] text-[#0D99FF] font-semibold cursor-pointer'
                      : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F1F5F9] cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isOwner}
                    onChange={() => onToggleDept(deptCode)}
                    className="w-3.5 h-3.5 rounded text-[#0D99FF] focus:ring-[#0D99FF]"
                  />
                  <span className="truncate">{deptName} ({deptCode})</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Helper Guidance */}
      <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-2 text-xs text-[#64748B]">
        <Info className="text-[#0D99FF] shrink-0 mt-0.5" size={15} />
        <div className="leading-relaxed">
          {isTargeted ? (
            <span>
              💡 <strong>ต้องการแจกจ่ายแบบฟอร์มให้ทุกแผนกในองค์กรหรือไม่?</strong> หากต้องการ กรุณาเลือกระดับความลับด้านบนเป็น <span className="text-[#0D99FF] font-semibold">'ทั่วไป (General)'</span>
            </span>
          ) : isDeptOnly ? (
            <span>
              💡 <strong>ต้องการให้แผนกอื่นดาวน์โหลดแบบฟอร์มนี้ไปใช้งานด้วยหรือไม่?</strong> หากต้องการ กรุณาเลือกระดับความลับด้านบนเป็น <span className="text-[#0D99FF] font-semibold">'ทั่วไป (General)'</span> หรือ <span className="text-[#0D99FF] font-semibold">'เฉพาะบางแผนก (Targeted)'</span>
            </span>
          ) : (
            <span>
              ขอบเขตการแจกจ่าย: <strong className="text-[#1E293B]">{effectiveDistributionMode === 'ALL_DEPTS' ? 'ทุกแผนกในองค์กร' : `ระบุ ${selectedDepts.length} แผนก`}</strong> (Bypass ตรวจรับ PIN และคิวพิมพ์ DCC 100%)
            </span>
          )}
        </div>
      </div>

    </div>
  );
};

export default FormDistributionSetup;
