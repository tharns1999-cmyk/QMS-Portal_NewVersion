import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, Check, ChevronRight, 
  Globe, Plus, Trash2, MapPin, Sparkles, Layers,
  FileSpreadsheet, CheckCircle2, ShieldCheck, X, Crown, Printer, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import { 
  DEPARTMENT_METADATA, 
  normalizeDepartmentId, 
  getDepartmentStations, 
  getMasterStationForDept,
  calculateCopyAllocations 
} from '../../services/MasterDataService';

// Helper Functions for ID Normalization and Master Lock Resolution
export const getStationKey = (station) => {
  if (!station) return '';
  if (typeof station === 'string') return station.trim();
  return String(station.id || station.location_id || station.station_id || station.locationId || station.code || '').trim();
};

export const isMasterStation = (station, ownerDept) => {
  if (!station) return false;
  const normOwner = normalizeDepartmentId(ownerDept);
  const stationDept = normalizeDepartmentId(station.departmentId || station.dept || station.dept_code || station.department || normOwner);
  const key = getStationKey(station);
  
  if (stationDept !== normOwner) {
    return false;
  }
  
  return Boolean(
    station.isMaster ||
    station.is_master ||
    station.isMasterOffice ||
    key.includes('MASTER') ||
    key === `${normOwner}-MASTER` ||
    key === `${normOwner}-OFFICE`
  );
};

const DistributionSetup = ({
  ownerDept = 'PD',
  distributions = [],
  _oldDistributions = null,
  onChange = () => {},
  showConfirmButton = false,
  onConfirm = () => {},
  _document = { docNo: 'NEW-DOCUMENT', title: 'New Document' },
  documentType = 'WI',
  accessControl = null,
  accessScope = 'GENERAL'
}) => {
  const { distributionLocations, masterDepartments, departments: storeDepts } = useStore();
  const normOwnerDept = normalizeDepartmentId(ownerDept);
  const isForm = String(documentType).startsWith('FM') || 
                 String(_document?.docNo || _document?.title || '').startsWith('FM-') || 
                 documentType === 'FM' || 
                 documentType === 'FORM';

  const resolvedScope = accessControl?.scope || accessScope || 'GENERAL';
  const isDeptOnly = resolvedScope === 'DEPT_ONLY';
  const isRestricted = resolvedScope === 'RESTRICTED';
  const isTargeted = resolvedScope === 'TARGETED';
  const isAllDeptsDisabled = isDeptOnly || isTargeted || isRestricted;
  const authorizedDepts = (accessControl?.authorized_depts || []).map(normalizeDepartmentId);

  // Dynamic departments list
  const availableDeptsList = useMemo(() => {
    let list = [];
    if (masterDepartments && masterDepartments.length > 0) {
      list = masterDepartments.filter(d => d.status !== 'INACTIVE').map(d => ({
        id: d.id,
        code: d.id,
        name: `${d.nameTh || d.name} (${d.id})`,
        shortName: d.id,
        badgeColor: d.color || 'blue'
      }));
    } else if (storeDepts && storeDepts.length > 0) {
      list = storeDepts.map(d => ({
        id: typeof d === 'string' ? d : d.id,
        code: typeof d === 'string' ? d : d.id,
        name: typeof d === 'string' ? d : `${d.nameTh || d.name} (${d.id})`,
        shortName: typeof d === 'string' ? d : d.id,
        badgeColor: 'blue'
      }));
    } else {
      list = DEPARTMENT_METADATA.map(d => ({ ...d, code: d.id }));
    }

    if (isTargeted && authorizedDepts.length > 0) {
      return list.filter(d => 
        normalizeDepartmentId(d.id) === normOwnerDept || 
        authorizedDepts.includes(normalizeDepartmentId(d.id))
      );
    }
    return list;
  }, [masterDepartments, storeDepts, isTargeted, authorizedDepts, normOwnerDept]);

  // Matrix table search & filter state (must be top-level, before any early return)
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedCustomInputDept, setExpandedCustomInputDept] = useState(null);

  // --- FORM SPECIFIC STATE (Tier 1 Department Level & Global) ---
  const [formMode, setFormMode] = useState(() => {
    if (isAllDeptsDisabled) return 'TARGETED';
    if (!distributions || distributions.length === 0) return 'GLOBAL';
    const isGlobal = distributions.some(d => d.departmentId === 'ALL' || d.isGlobal);
    if (isGlobal) return 'GLOBAL';
    if (availableDeptsList.length > 0 && distributions.length >= availableDeptsList.length) return 'GLOBAL';
    return 'TARGETED';
  });

  const [selectedFormDepts, setSelectedFormDepts] = useState(() => {
    if (isDeptOnly || isRestricted) return [normOwnerDept];
    if (isTargeted) {
      const allowed = availableDeptsList.map(d => d.id);
      if (!distributions || distributions.length === 0) return allowed;
      const existing = distributions.map(d => normalizeDepartmentId(d.departmentId || d.dept || d.dept_code)).filter(Boolean);
      const valid = existing.filter(d => allowed.map(normalizeDepartmentId).includes(normalizeDepartmentId(d)));
      return valid.length > 0 ? Array.from(new Set(valid)) : allowed;
    }
    if (!distributions || distributions.length === 0) return availableDeptsList.map(d => d.id);
    const hasGlobal = distributions.some(d => d.departmentId === 'ALL' || d.isGlobal);
    if (hasGlobal) return availableDeptsList.map(d => d.id);
    const existing = distributions.map(d => normalizeDepartmentId(d.departmentId || d.dept || d.dept_code)).filter(Boolean);
    return existing.length > 0 ? Array.from(new Set(existing)) : [normOwnerDept];
  });

  // Auto-sync formMode and selectedFormDepts when scope changes
  useEffect(() => {
    if (!isForm) return;
    if (isAllDeptsDisabled) {
      setFormMode('TARGETED');
      if (isDeptOnly || isRestricted) {
        setSelectedFormDepts([normOwnerDept]);
      } else if (isTargeted) {
        const allowed = availableDeptsList.map(d => d.id);
        setSelectedFormDepts(prev => {
          const valid = prev.filter(d => allowed.map(normalizeDepartmentId).includes(normalizeDepartmentId(d)));
          return valid.length > 0 ? valid : allowed;
        });
      }
    }
  }, [isForm, isAllDeptsDisabled, isDeptOnly, isRestricted, isTargeted, normOwnerDept, availableDeptsList]);

  // Handle Form Mode Toggle
  const handleFormModeChange = (mode) => {
    if (isAllDeptsDisabled && mode === 'GLOBAL') return;
    setFormMode(mode);
    if (mode === 'GLOBAL') {
      const payload = availableDeptsList.map(d => ({
        departmentId: d.id,
        department: d.id,
        dept: d.id,
        dept_code: d.id,
        target_department: d.id,
        targetDepartment: d.id,
        locationId: d.id,
        locationName: d.name,
        copyNo: '00',
        isForm: true,
        isGlobal: true
      }));
      onChange(payload);
    } else {
      const deptsToUse = (isDeptOnly || isRestricted) ? [normOwnerDept] : (selectedFormDepts.length > 0 ? selectedFormDepts : [normOwnerDept]);
      const payload = deptsToUse.map(deptId => {
        const deptObj = availableDeptsList.find(d => d.id === deptId);
        return {
          departmentId: deptId,
          department: deptId,
          dept: deptId,
          dept_code: deptId,
          target_department: deptId,
          targetDepartment: deptId,
          locationId: deptId,
          locationName: deptObj?.name || `${deptId} Department`,
          copyNo: '00',
          isForm: true
        };
      });
      onChange(payload);
    }
  };

  // Handle Targeted Form Department Toggle
  const handleToggleFormDept = (deptId) => {
    const normDept = normalizeDepartmentId(deptId);
    let newDepts = [...selectedFormDepts];
    if (newDepts.includes(normDept)) {
      newDepts = newDepts.filter(d => d !== normDept);
    } else {
      newDepts.push(normDept);
    }
    setSelectedFormDepts(newDepts);

    const payload = newDepts.map(dId => {
      const deptObj = availableDeptsList.find(d => d.id === dId);
      return {
        departmentId: dId,
        department: dId,
        dept: dId,
        dept_code: dId,
        target_department: dId,
        targetDepartment: dId,
        locationId: dId,
        locationName: deptObj?.name || `${dId} Department`,
        copyNo: '00',
        isForm: true
      };
    });
    onChange(payload);
  };

  const handleSelectAllFormDepts = () => {
    const all = availableDeptsList.map(d => d.id);
    setSelectedFormDepts(all);
    const payload = all.map(dId => {
      const deptObj = availableDeptsList.find(d => d.id === dId);
      return {
        departmentId: dId,
        department: dId,
        dept: dId,
        dept_code: dId,
        target_department: dId,
        targetDepartment: dId,
        locationId: dId,
        locationName: deptObj?.name || `${dId} Department`,
        copyNo: '00',
        isForm: true
      };
    });
    onChange(payload);
  };

  const handleClearAllFormDepts = () => {
    setSelectedFormDepts([normOwnerDept]);
    onChange([{
      departmentId: normOwnerDept,
      department: normOwnerDept,
      dept: normOwnerDept,
      dept_code: normOwnerDept,
      target_department: normOwnerDept,
      targetDepartment: normOwnerDept,
      locationId: normOwnerDept,
      locationName: `${normOwnerDept} Department`,
      copyNo: '00',
      isForm: true
    }]);
  };

  const handleToggleAllFormDepts = () => {
    if (selectedFormDepts.length === availableDeptsList.length) {
      handleClearAllFormDepts();
    } else {
      handleSelectAllFormDepts();
    }
  };

  // --- NON-FORM STATE (Standard Controlled Copies with Tier-2 Stations) ---
  const [customLocations, setCustomLocations] = useState(() => {
    return (distributions || [])
      .filter(d => d.isCustom || d.is_custom)
      .map(d => ({
        id: getStationKey(d),
        departmentId: normalizeDepartmentId(d.departmentId || d.dept || d.dept_code || d.department),
        name: d.locationName || d.station_name || d.name || d.location || getStationKey(d),
        isCustom: true
      }));
  });

  const [customInputs, setCustomInputs] = useState({});

  const selectedLocationMap = useMemo(() => {
    const map = new Map();
    (distributions || []).forEach(d => {
      if (!d) return;
      const deptId = normalizeDepartmentId(d.departmentId || d.dept || d.dept_code || d.department || normOwnerDept);
      const locId = getStationKey(d);
      if (!locId) return;

      const locName = d.locationName || d.station_name || d.name || d.location || locId;
      const key = `${deptId}::${locId}`;
      map.set(key, {
        departmentId: deptId,
        department: deptId,
        dept: deptId,
        dept_code: deptId,
        target_department: deptId,
        targetDepartment: deptId,
        locationId: locId,
        station_id: locId,
        id: locId,
        locationName: locName,
        station_name: locName,
        location: locName,
        name: locName,
        isCustom: !!(d.isCustom || d.is_custom),
        is_custom: !!(d.isCustom || d.is_custom)
      });
    });
    return map;
  }, [distributions, normOwnerDept]);

  const copyCalculation = useMemo(() => {
    const rawList = Array.from(selectedLocationMap.values());
    return calculateCopyAllocations(normOwnerDept, rawList);
  }, [normOwnerDept, selectedLocationMap]);

  const copyNumberByLocationKey = useMemo(() => {
    const map = new Map();
    copyCalculation.allAllocations.forEach(alloc => {
      const locKey = getStationKey(alloc);
      const key = `${alloc.departmentId}::${locKey}`;
      map.set(key, alloc.copyNo);
    });
    return map;
  }, [copyCalculation]);

  const emitChange = (newSelectedList) => {
    const calculated = calculateCopyAllocations(normOwnerDept, newSelectedList);
    onChange(calculated.distributedCopies);
  };

  const handleToggleStation = (deptId, station) => {
    const normDept = normalizeDepartmentId(deptId);
    const stationKey = getStationKey(station);
    if (!stationKey) return;
    
    // Guard: Master Station of Owner Dept cannot be toggled
    if (isMasterStation({ ...station, departmentId: normDept }, normOwnerDept)) {
      return;
    }

    const key = `${normDept}::${stationKey}`;
    const newMap = new Map(selectedLocationMap);

    if (newMap.has(key)) {
      newMap.delete(key);
    } else {
      const stationName = station.name || station.station_name || station.locationName || station.location || stationKey;
      newMap.set(key, {
        departmentId: normDept,
        department: normDept,
        dept: normDept,
        dept_code: normDept,
        target_department: normDept,
        targetDepartment: normDept,
        locationId: stationKey,
        station_id: stationKey,
        id: stationKey,
        locationName: stationName,
        station_name: stationName,
        location: stationName,
        name: stationName,
        isCustom: !!(station.isCustom || station.is_custom),
        is_custom: !!(station.isCustom || station.is_custom)
      });
    }

    emitChange(Array.from(newMap.values()));
  };

  const handleSelectAllInDept = (deptId) => {
    const normDept = normalizeDepartmentId(deptId);
    const stations = getDepartmentStations(normDept, distributionLocations);
    const customForDept = customLocations.filter(c => c.departmentId === normDept);
    const allStations = [...stations, ...customForDept];

    const newMap = new Map(selectedLocationMap);
    const nonMasterStations = allStations.filter(s => !isMasterStation({ ...s, departmentId: normDept }, normOwnerDept));
    const allNonMasterSelected = nonMasterStations.length > 0 && nonMasterStations.every(s => newMap.has(`${normDept}::${getStationKey(s)}`));

    if (allNonMasterSelected) {
      nonMasterStations.forEach(s => newMap.delete(`${normDept}::${getStationKey(s)}`));
    } else {
      nonMasterStations.forEach(s => {
        const sKey = getStationKey(s);
        const sName = s.name || s.station_name || s.locationName || sKey;
        newMap.set(`${normDept}::${sKey}`, {
          departmentId: normDept,
          department: normDept,
          dept: normDept,
          dept_code: normDept,
          target_department: normDept,
          targetDepartment: normDept,
          locationId: sKey,
          station_id: sKey,
          id: sKey,
          locationName: sName,
          station_name: sName,
          location: sName,
          name: sName,
          isCustom: !!(s.isCustom || s.is_custom),
          is_custom: !!(s.isCustom || s.is_custom)
        });
      });
    }

    emitChange(Array.from(newMap.values()));
  };

  const handleAddCustomLocation = (deptId) => {
    const normDept = normalizeDepartmentId(deptId);
    const text = (customInputs[normDept] || '').trim();
    if (!text) return;

    const customId = `CUSTOM-${normDept}-${Date.now()}`;
    const newCustom = {
      id: customId,
      departmentId: normDept,
      department: normDept,
      dept: normDept,
      dept_code: normDept,
      target_department: normDept,
      targetDepartment: normDept,
      name: `${text} (พิเศษ)`,
      isCustom: true
    };

    setCustomLocations(prev => [...prev, newCustom]);
    
    const newMap = new Map(selectedLocationMap);
    newMap.set(`${normDept}::${customId}`, {
      departmentId: normDept,
      department: normDept,
      dept: normDept,
      dept_code: normDept,
      target_department: normDept,
      targetDepartment: normDept,
      locationId: customId,
      station_id: customId,
      id: customId,
      locationName: newCustom.name,
      station_name: newCustom.name,
      location: newCustom.name,
      name: newCustom.name,
      isCustom: true
    });

    setCustomInputs(prev => ({ ...prev, [normDept]: '' }));
    emitChange(Array.from(newMap.values()));
  };

  const handleDeleteCustomLocation = (deptId, customId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const normDept = normalizeDepartmentId(deptId);
    setCustomLocations(prev => prev.filter(c => getStationKey(c) !== customId));

    const newMap = new Map(selectedLocationMap);
    newMap.delete(`${normDept}::${customId}`);
    emitChange(Array.from(newMap.values()));
  };

  const allSelectableStations = useMemo(() => {
    const list = [];
    availableDeptsList.forEach(dept => {
      const normDept = normalizeDepartmentId(dept.id);
      const std = getDepartmentStations(normDept, distributionLocations);
      std.forEach(s => {
        if (!isMasterStation({ ...s, departmentId: normDept }, normOwnerDept)) {
          list.push({ ...s, departmentId: normDept });
        }
      });
    });
    return list;
  }, [normOwnerDept, availableDeptsList, distributionLocations]);

  const isAllGlobalSelected = useMemo(() => {
    return allSelectableStations.length > 0 && 
      allSelectableStations.every(s => selectedLocationMap.has(`${s.departmentId}::${getStationKey(s)}`));
  }, [allSelectableStations, selectedLocationMap]);

  const handleGlobalAllToggle = () => {
    let newList = [];
    if (!isAllGlobalSelected) {
      newList = allSelectableStations.map(s => ({
        departmentId: s.departmentId,
        dept: s.departmentId,
        dept_code: s.departmentId,
        locationId: getStationKey(s),
        station_id: getStationKey(s),
        id: getStationKey(s),
        locationName: s.name,
        station_name: s.name,
        location: s.name,
        name: s.name,
        isCustom: false
      }));
    }
    emitChange(newList);
  };

  const ownerMasterStation = getMasterStationForDept(normOwnerDept, distributionLocations);

  const getDeptAllocatedCount = (deptId) => {
    const normDept = normalizeDepartmentId(deptId);
    return copyCalculation.allAllocations.filter(alloc => 
      normalizeDepartmentId(alloc.departmentId || alloc.dept || alloc.dept_code || alloc.department) === normDept
    ).length;
  };

  // ==========================================
  // RENDER: FORM DISTRIBUTION VIEW (FM TYPE)
  // ==========================================
  if (isForm) {
    return (
      <div className="bg-white/95 border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 w-full transition-all">
        {/* Form Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shrink-0 shadow-2xs">
              <FileSpreadsheet size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                ระบบแจกจ่ายแบบฟอร์มบันทึกข้อมูล (Digital Form Distribution)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                แบบฟอร์มเปล่าดิจิทัลสำหรับดาวน์โหลดไปพิมพ์ใช้งาน (Bypass เล่มกระดาษสำเนาควบคุมและคิวพิมพ์ DCC)
              </p>
            </div>
          </div>

          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>พร้อมใช้งานใน Library ทันทีเมื่ออนุมัติ</span>
          </span>
        </div>

        {/* Form Distribution Modes */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-800">
            รูปแบบการเข้าถึงและดาวน์โหลดแบบฟอร์ม <span className="text-rose-500">*</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Option 1: All Departments */}
            <div
              data-testid="form-dist-all-depts"
              onClick={() => {
                if (!isAllDeptsDisabled) handleFormModeChange('GLOBAL');
              }}
              className={`p-4 rounded-2xl border transition-all duration-200 select-none flex items-start gap-3.5 outline-none hover:scale-[1.01] ${
                isAllDeptsDisabled
                  ? 'bg-slate-50 border-slate-200 opacity-45 cursor-not-allowed'
                  : formMode === 'GLOBAL'
                  ? 'bg-indigo-50/40 border-indigo-200 ring-2 ring-indigo-500 cursor-pointer shadow-sm'
                  : 'bg-white border-slate-200/80 hover:bg-slate-50/70 hover:border-slate-300 cursor-pointer shadow-2xs'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                formMode === 'GLOBAL' && !isAllDeptsDisabled ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-300' : 'bg-slate-100 text-slate-500'
              }`}>
                <Globe size={18} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    ทุกแผนก <span className="font-medium text-slate-500 text-[11px]">(All Departments)</span>
                  </span>
                  {formMode === 'GLOBAL' && !isAllDeptsDisabled && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {isTargeted
                    ? '⛔ ปิดใช้งาน: ระดับความลับถูกจำกัดเฉพาะบางแผนก (Targeted)'
                    : isDeptOnly
                    ? '⛔ ปิดใช้งาน: ระดับความลับถูกจำกัดเฉพาะแผนกตนเอง (Dept Only)'
                    : isRestricted
                    ? '⛔ ปิดใช้งาน: ระดับความลับถูกจำกัดเฉพาะบุคคล (Restricted)'
                    : 'ทุกแผนกในองค์กรสามารถมองเห็นและดาวน์โหลดแบบฟอร์มต้นฉบับได้'}
                </p>
              </div>
            </div>

            {/* Option 2: Specific / Owner Departments */}
            <div
              data-testid="form-dist-specific-depts"
              onClick={() => handleFormModeChange('TARGETED')}
              className={`p-4 rounded-2xl border transition-all duration-200 select-none flex items-start gap-3.5 outline-none hover:scale-[1.01] ${
                formMode === 'TARGETED' || isAllDeptsDisabled
                  ? 'bg-indigo-50/40 border-indigo-200 ring-2 ring-indigo-500 cursor-pointer shadow-sm'
                  : 'bg-white border-slate-200/80 hover:bg-slate-50/70 hover:border-slate-300 cursor-pointer shadow-2xs'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                formMode === 'TARGETED' || isAllDeptsDisabled ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-300' : 'bg-slate-100 text-slate-500'
              }`}>
                <Building2 size={18} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    {isDeptOnly ? `เฉพาะแผนก ${ownerDept || 'PD'} เท่านั้น (Owner Dept)` : 'เลือกเฉพาะแผนกที่เกี่ยวข้อง'}
                  </span>
                  {(formMode === 'TARGETED' || isAllDeptsDisabled) && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {isTargeted
                    ? 'กำหนดแผนกผู้ใช้งานจากรายชื่อที่ได้รับอนุญาตด้านบน'
                    : isDeptOnly
                    ? `🔒 ใช้งานได้เฉพาะบุคลากรในแผนก ${ownerDept || 'PD'}`
                    : isRestricted
                    ? `🔒 จำกัดการใช้งานเฉพาะบุคคลที่ได้รับสิทธิ์`
                    : 'กำหนดเฉพาะบางแผนกที่ต้องใช้แบบฟอร์มนี้ในการบันทึกงาน'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Form Departments Pill Chips */}
        {formMode === 'TARGETED' && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                เลือกแผนกที่ได้รับสิทธิ์ใช้งานแบบฟอร์ม ({selectedFormDepts.length}/{availableDeptsList.length})
              </span>
              <button
                type="button"
                onClick={handleToggleAllFormDepts}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer transition-colors"
              >
                {selectedFormDepts.length === availableDeptsList.length ? 'ล้างค่า' : 'เลือกทั้งหมด'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {availableDeptsList.map((dept) => {
                const isSelected = selectedFormDepts.includes(dept.id);
                return (
                  <label
                    key={dept.id}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs select-none cursor-pointer transition-all duration-150 active:scale-95 ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-bold border border-indigo-600 shadow-sm shadow-indigo-200'
                        : 'bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-100 shadow-2xs'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => handleToggleFormDept(dept.id)}
                    />
                    {isSelected ? (
                      <Check size={13} strokeWidth={3} className="text-white shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 bg-slate-50 shrink-0" />
                    )}
                    <span className="truncate">{dept.name}</span>
                  </label>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Helper Guidance Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
          <Info className="text-indigo-600 shrink-0 mt-0.5" size={16} />
          <div className="leading-relaxed">
            {isTargeted ? (
              <span>
                💡 <strong>ต้องการแจกจ่ายแบบฟอร์มให้ทุกแผนกในองค์กรหรือไม่?</strong> หากต้องการ กรุณาเลือกระดับความลับด้านบนเป็น <span className="text-indigo-600 font-semibold">'ทั่วไป (General)'</span>
              </span>
            ) : isDeptOnly ? (
              <span>
                💡 <strong>ต้องการให้แผนกอื่นดาวน์โหลดแบบฟอร์มนี้ไปใช้งานด้วยหรือไม่?</strong> หากต้องการ กรุณาเลือกระดับความลับด้านบนเป็น <span className="text-indigo-600 font-semibold">'ทั่วไป (General)'</span> หรือ <span className="text-indigo-600 font-semibold">'เฉพาะบางแผนก (Targeted)'</span>
              </span>
            ) : (
              <span>
                ขอบเขตการแจกจ่ายปัจจุบัน: <strong className="text-slate-900">{formMode === 'GLOBAL' ? 'ทุกแผนกในองค์กร' : `ระบุ ${selectedFormDepts.length} แผนก`}</strong> (Bypass การตรวจรับ PIN และคิวพิมพ์ DCC)
              </span>
            )}
          </div>
        </div>

        {showConfirmButton && (
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onConfirm}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-sm shadow-indigo-200 cursor-pointer"
            >
              Confirm & Distribute Form
            </button>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: HIGH-DENSITY INLINE MATRIX TABLE (NON-FM)
  // ==========================================

  // Filtered rows (computed here, after early return guard, using state set above)
  const filteredDeptList = useMemo(() => {
    let list = availableDeptsList;
    if (showActiveOnly) {
      list = list.filter(dept => getDeptAllocatedCount(dept.id) > 0);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(dept => {
        const normDept = normalizeDepartmentId(dept.id);
        if ((dept.name || '').toLowerCase().includes(q) || normDept.toLowerCase().includes(q)) return true;
        const stations = getDepartmentStations(normDept, distributionLocations);
        return stations.some(s => (s.name || s.station_name || '').toLowerCase().includes(q));
      });
    }
    return list;
  }, [availableDeptsList, showActiveOnly, searchQuery, distributionLocations]);

  const activeDeptCount = useMemo(() =>
    availableDeptsList.filter(dept => getDeptAllocatedCount(dept.id) > 0).length,
  [availableDeptsList]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 space-y-3 w-full shadow-sm transition-all">

      {/* ══════════════════════════════════════════════════════════
          1. Header & Master Summary Strip (≤40px)
      ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2 bg-slate-50/80 border border-slate-200/60 rounded-xl">
        {/* Master Badge */}
        <span className="inline-flex items-center gap-2 text-xs select-none">
          <Crown size={12} className="text-amber-600 shrink-0" />
          <span className="font-mono font-bold text-amber-900">Master Copy 01</span>
          <span className="text-amber-700/60 font-normal">({normOwnerDept} — {ownerMasterStation.name})</span>
          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200/60">ล็อกถาวร</span>
        </span>
        {/* Inline Metrics */}
        <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
          <span>รวม <strong className="text-slate-800">{copyCalculation.totalCopies}</strong> ชุด</span>
          <span className="text-slate-200">|</span>
          <span>Controlled <strong className="text-indigo-600">{copyCalculation.distributedCopies.length}</strong></span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          2. Search & Quick Actions Bar
      ══════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2">
        {/* Omni-Search Slim */}
        <div className="relative flex-1 flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all shadow-2xs">
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="ค้นหาแผนกหรือจุดติดตั้ง…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-transparent border-0 text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="ml-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Quick Filter: All / Active */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowActiveOnly(false)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              !showActiveOnly
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ทั้งหมด ({availableDeptsList.length})
          </button>
          <button
            type="button"
            onClick={() => setShowActiveOnly(true)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              showActiveOnly
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            มีการจัดสรร ({activeDeptCount})
          </button>
        </div>

        {/* Global Select All */}
        <button
          type="button"
          onClick={handleGlobalAllToggle}
          className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-2xs shrink-0"
        >
          {isAllGlobalSelected ? 'ล้างทุกแผนก' : 'เลือกทุกแผนก'}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════
          3. Inline Matrix Table Body (max-h-[340px] scrollable)
      ══════════════════════════════════════════════════════════ */}
      <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
        {/* Table Header Row */}
        <div className="grid bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wide" style={{ gridTemplateColumns: '130px 1fr 72px' }}>
          <div className="px-3.5 py-2 border-r border-slate-100">แผนก</div>
          <div className="px-3.5 py-2 border-r border-slate-100">จุดติดตั้ง (Point-of-Use Stations)</div>
          <div className="px-3.5 py-2 text-right">จัดสรร</div>
        </div>

        {/* Scrollable table body */}
        <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100/80">
          {filteredDeptList.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              ไม่พบแผนกที่ตรงกับคำค้นหา
            </div>
          ) : (
            filteredDeptList.map((dept) => {
              const normDept = normalizeDepartmentId(dept.id);
              const isOwner = normDept === normOwnerDept;
              const standardStations = getDepartmentStations(normDept, distributionLocations);
              const customForDept = customLocations.filter(c => c.departmentId === normDept);
              const allDeptStations = [...standardStations, ...customForDept];
              const deptAllocatedCount = getDeptAllocatedCount(normDept);
              const nonMasterStations = allDeptStations.filter(s => !isMasterStation({ ...s, departmentId: normDept }, normOwnerDept));
              const isAllDeptSelected = nonMasterStations.length > 0 && nonMasterStations.every(s => selectedLocationMap.has(`${normDept}::${getStationKey(s)}`));
              const isExpanded = expandedCustomInputDept === normDept;

              // Highlight matching station names
              const q = searchQuery.trim().toLowerCase();

              return (
                <div
                  key={dept.id}
                  className={`grid transition-colors ${isOwner ? 'bg-amber-50/20' : 'bg-white hover:bg-slate-50/40'}`}
                  style={{ gridTemplateColumns: '130px 1fr 72px' }}
                >
                  {/* ── Col 1: Department Tag ── */}
                  <div className="px-3 py-2.5 border-r border-slate-100 flex flex-col justify-center gap-0.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {isOwner && <Crown size={10} className="text-amber-500 shrink-0" />}
                      <span className={`font-mono font-bold text-xs ${isOwner ? 'text-amber-900' : 'text-slate-800'}`}>
                        {dept.shortName || dept.id}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectAllInDept(normDept)}
                      className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer text-left"
                    >
                      {isAllDeptSelected ? 'ล้างค่า' : 'เลือกทั้งหมด'}
                    </button>
                  </div>

                  {/* ── Col 2: Inline Station Chips ── */}
                  <div className="px-2.5 py-2 border-r border-slate-100 flex flex-wrap gap-1.5 items-start min-h-[48px]">
                    {allDeptStations.map((station) => {
                      const stationKey = getStationKey(station);
                      const isMaster = isOwner && isMasterStation({ ...station, departmentId: normDept }, normOwnerDept);
                      const isSelected = selectedLocationMap.has(`${normDept}::${stationKey}`) || isMaster;
                      const copyLabel = copyNumberByLocationKey.get(`${normDept}::${stationKey}`);
                      const stationName = station.name || station.station_name || stationKey;
                      const matchesSearch = q && stationName.toLowerCase().includes(q);

                      /* ── Master Chip (amber, locked) ── */
                      if (isMaster) {
                        return (
                          <span
                            key={stationKey}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border select-none cursor-not-allowed
                              bg-amber-50 border-amber-300/80 text-amber-800 font-medium
                              ${matchesSearch ? 'ring-1 ring-amber-400' : ''}`}
                          >
                            <Crown size={10} className="text-amber-500 shrink-0" />
                            <span>{stationName}</span>
                            <span className="text-[10px] font-mono font-bold text-amber-600 ml-0.5">01</span>
                          </span>
                        );
                      }

                      /* ── Checked Chip (indigo) ── */
                      if (isSelected) {
                        return (
                          <button
                            key={stationKey}
                            type="button"
                            onClick={() => handleToggleStation(normDept, station)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all cursor-pointer select-none
                              bg-indigo-50 border-indigo-400 text-indigo-950 font-medium hover:bg-indigo-100 active:scale-95
                              ${matchesSearch ? 'ring-1 ring-indigo-500' : ''}`}
                          >
                            <Check size={11} strokeWidth={3} className="text-indigo-600 shrink-0" />
                            <span>{stationName}</span>
                            <span className="text-[10px] font-mono font-bold text-indigo-500 bg-indigo-100 px-1 rounded ml-0.5">
                              {copyLabel}
                            </span>
                            {station.isCustom && (
                              <span
                                role="button"
                                onClick={(e) => handleDeleteCustomLocation(normDept, stationKey, e)}
                                className="text-indigo-300 hover:text-rose-500 transition-colors ml-0.5 cursor-pointer"
                                title="ลบจุดนี้"
                              >
                                <X size={11} />
                              </span>
                            )}
                          </button>
                        );
                      }

                      /* ── Unchecked Chip (slate) ── */
                      return (
                        <button
                          key={stationKey}
                          type="button"
                          onClick={() => handleToggleStation(normDept, station)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-all cursor-pointer select-none
                            bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 active:scale-95
                            ${matchesSearch ? 'ring-1 ring-indigo-400 border-indigo-300' : ''}`}
                        >
                          <span>{stationName}</span>
                          {station.isCustom && (
                            <span
                              role="button"
                              onClick={(e) => handleDeleteCustomLocation(normDept, stationKey, e)}
                              className="text-slate-300 hover:text-rose-500 transition-colors ml-0.5 cursor-pointer"
                              title="ลบจุดนี้"
                            >
                              <X size={11} />
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* + Add Custom Station Chip (dashed pill) */}
                    {!isExpanded ? (
                      <button
                        type="button"
                        onClick={() => setExpandedCustomInputDept(normDept)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all cursor-pointer select-none"
                        title="เพิ่มจุดพิเศษ"
                      >
                        <Plus size={11} />
                        <span>เพิ่มจุด</span>
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-1 bg-white border border-indigo-300 rounded-lg p-0.5 shadow-xs focus-within:ring-1 focus-within:ring-indigo-400 transition-all">
                        <input
                          type="text"
                          autoFocus
                          placeholder="ชื่อจุด…"
                          value={customInputs[normDept] || ''}
                          onChange={(e) => setCustomInputs(prev => ({ ...prev, [normDept]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomLocation(normDept);
                              setExpandedCustomInputDept(null);
                            }
                            if (e.key === 'Escape') {
                              setExpandedCustomInputDept(null);
                            }
                          }}
                          className="w-28 text-[11px] bg-transparent border-0 px-2 py-0.5 text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            handleAddCustomLocation(normDept);
                            setExpandedCustomInputDept(null);
                          }}
                          className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-bold transition-colors cursor-pointer shrink-0"
                        >
                          ยืนยัน
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedCustomInputDept(null)}
                          className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Col 3: Allocated Count Badge ── */}
                  <div className="px-3 py-2.5 flex items-center justify-end">
                    {deptAllocatedCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-100 text-indigo-700 border border-indigo-200/80">
                        {deptAllocatedCount} จุด
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs font-mono">–</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          4. Bottom Summary Tray — Print Allocation Ribbon
      ══════════════════════════════════════════════════════════ */}
      {copyCalculation.allAllocations.length > 0 && (
        <div className="border border-slate-200/70 bg-slate-50/60 rounded-2xl p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Printer size={12} className="text-slate-400" />
              <span>สำเนาที่จะพิมพ์ ({copyCalculation.totalCopies} ชุด)</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {copyCalculation.allAllocations.map((alloc) => (
              <span
                key={`${alloc.departmentId}::${alloc.locationId}`}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono border transition-all ${
                  alloc.isMaster
                    ? 'bg-amber-50 text-amber-900 border-amber-200/80'
                    : 'bg-white text-slate-700 border-slate-200 shadow-2xs'
                }`}
              >
                <span className={`font-bold ${alloc.isMaster ? 'text-amber-600' : 'text-indigo-600'}`}>
                  {alloc.departmentId}
                </span>
                <span>·</span>
                <span>Copy {alloc.copyNo}</span>
                <span className="text-slate-400 font-sans font-normal truncate max-w-[100px]">{alloc.locationName}</span>
                {!alloc.isMaster && (
                  <button
                    type="button"
                    onClick={() => handleToggleStation(alloc.departmentId, { id: alloc.locationId, name: alloc.locationName })}
                    className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer ml-0.5"
                    title="ยกเลิกจุดนี้"
                  >
                    <X size={11} className="stroke-[2.5]" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Button */}
      {showConfirmButton && (
        <div className="flex justify-end pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
          >
            Confirm & Distribute
          </button>
        </div>
      )}
    </div>
  );
};

export default DistributionSetup;
