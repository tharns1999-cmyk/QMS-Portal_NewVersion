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

  // Active department selected in split-view sidebar
  const [activeDeptId, setActiveDeptId] = useState(normOwnerDept || 'PD');

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
  // RENDER: ULTRA-MODERN DUAL-PANE MATRIX (NON-FM)
  // ==========================================
  const activeNormDept = normalizeDepartmentId(activeDeptId);
  const activeDeptObj = availableDeptsList.find(d => normalizeDepartmentId(d.id) === activeNormDept) || availableDeptsList[0];
  const isOwnerActive = activeNormDept === normOwnerDept;

  return (
    <div className="bg-slate-50/50 border border-slate-200/80 rounded-3xl p-5 sm:p-6 space-y-5 w-full h-auto shadow-sm transition-all">
      
      {/* 1. Header Bar (Modern Metric Strip) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
        {/* Left: Master Location Badge */}
        <div className="flex items-center gap-2.5 bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-2xl px-4 py-2.5 shadow-sm self-start sm:self-auto">
          <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
            <Crown size={14} />
          </div>
          <span className="text-xs font-bold text-white tracking-tight">
            {normOwnerDept} — {ownerMasterStation.name}
          </span>
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30">
            Master Copy 01 ล็อกถาวร
          </span>
        </div>

        {/* Right: Modern Metric Counter Strip */}
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-mono text-slate-600 shadow-2xs self-start sm:self-auto">
          <span>จัดสรรแล้ว: <strong className="text-indigo-600 font-bold">{copyCalculation.totalCopies}</strong> ชุด</span>
          <span className="text-slate-300">•</span>
          <span>Master: <strong className="text-slate-900 font-bold">1</strong></span>
          <span className="text-slate-300">•</span>
          <span>Controlled: <strong className="text-indigo-600 font-bold">{copyCalculation.distributedCopies.length}</strong></span>
        </div>
      </div>

      {/* 2. Split-View Canvas (Dual-Pane) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start w-full">
        
        {/* Left Sidebar: Department Target List (4 Cols) */}
        <div className="lg:col-span-4 border border-slate-200/80 rounded-2xl bg-white divide-y divide-slate-100 overflow-hidden shadow-xs">
          <div className="p-3.5 px-4 bg-slate-50/70 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-slate-800">
              แผนกในระบบ ({availableDeptsList.length})
            </span>
            <button
              type="button"
              onClick={handleGlobalAllToggle}
              className="text-indigo-600 hover:text-indigo-700 text-[11px] font-bold cursor-pointer transition-colors"
            >
              {isAllGlobalSelected ? 'ล้างทุกแผนก' : 'เลือกทุกแผนก'}
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {availableDeptsList.map((dept) => {
              const normDept = normalizeDepartmentId(dept.id);
              const isSelected = activeNormDept === normDept;
              const isOwner = normDept === normOwnerDept;
              const deptCount = getDeptAllocatedCount(normDept);

              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setActiveDeptId(dept.id)}
                  className={`w-full p-3 px-4 text-left text-xs flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/70 text-indigo-950 font-bold border-l-4 border-l-indigo-600'
                      : 'hover:bg-slate-50/80 text-slate-700'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <span className="truncate block font-semibold">{dept.name}</span>
                    {isOwner && <span className="text-[10px] font-bold text-indigo-600 block mt-0.5">Owner Dept</span>}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono shrink-0 font-bold transition-colors ${
                    deptCount > 0 
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200/80 shadow-2xs' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {deptCount} จุด
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Workspace: Point-of-Use Interactive Grid (8 Cols) */}
        <div className="lg:col-span-8 border border-slate-200/80 rounded-2xl bg-white p-4 sm:p-5 space-y-4 shadow-xs">
          {availableDeptsList.map((dept) => {
            const normDept = normalizeDepartmentId(dept.id);
            const isCurrentActive = normDept === activeNormDept;
            const isOwner = normDept === normOwnerDept;
            const standardStations = getDepartmentStations(normDept, distributionLocations);
            const customForDept = customLocations.filter(c => c.departmentId === normDept);
            const allDeptStations = [...standardStations, ...customForDept];
            const deptAllocatedCount = getDeptAllocatedCount(normDept);
            const nonMasterStations = allDeptStations.filter(s => !isMasterStation({ ...s, departmentId: normDept }, normOwnerDept));
            const isAllDeptSelected = nonMasterStations.length > 0 && nonMasterStations.every(s => selectedLocationMap.has(`${normDept}::${getStationKey(s)}`));

            return (
              <div key={dept.id} className={isCurrentActive ? 'space-y-4' : 'hidden'}>
                {/* Department Header & Controls */}
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{dept.name}</span>
                    {isOwner && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono border border-indigo-200 shadow-2xs">
                        [ OWNER ]
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500 font-normal text-[11px]">
                      เลือกแล้ว <strong className="text-slate-900 font-bold">{deptAllocatedCount}</strong> / {allDeptStations.length} จุด
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllInDept(normDept)}
                      className="text-indigo-600 hover:text-indigo-700 text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      {isAllDeptSelected ? 'ล้างค่า' : 'เลือกทั้งหมด'}
                    </button>
                  </div>
                </div>

                {/* Interactive Location Action Cards (2 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allDeptStations.map((station) => {
                    const stationKey = getStationKey(station);
                    const isMaster = isOwner && isMasterStation({ ...station, departmentId: normDept }, normOwnerDept);
                    const isSelected = selectedLocationMap.has(`${normDept}::${stationKey}`) || isMaster;
                    const copyLabel = copyNumberByLocationKey.get(`${normDept}::${stationKey}`);

                    if (isMaster) {
                      return (
                        <div
                          key={stationKey}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-white shadow-xs cursor-not-allowed select-none text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-1">
                            <input
                              type="checkbox"
                              checked={true}
                              disabled={true}
                              readOnly
                              tabIndex={-1}
                              className="w-4 h-4 rounded border-zinc-700 text-amber-400 bg-zinc-800 cursor-not-allowed shrink-0 pointer-events-none opacity-80"
                            />
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MapPin size={13} className="text-amber-400 shrink-0" />
                              <span className="truncate font-bold text-white text-xs">
                                {station.name || station.station_name}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg shadow-2xs">
                              Master
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-black bg-amber-400 text-zinc-950 shrink-0 shadow-xs">
                              Copy 01
                            </span>
                          </div>
                        </div>
                      );
                    }

                    if (isSelected) {
                      return (
                        <div
                          key={stationKey}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleToggleStation(normDept, station)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleToggleStation(normDept, station);
                            }
                          }}
                          className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-indigo-600 bg-indigo-50/40 text-indigo-950 font-semibold shadow-xs cursor-pointer text-xs select-none transition-all duration-150 ring-1 ring-indigo-500/20 hover:scale-[1.01]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-1">
                            <input
                              type="checkbox"
                              checked={true}
                              readOnly
                              tabIndex={-1}
                              className="w-4 h-4 rounded border-indigo-600 text-indigo-600 focus:ring-indigo-500 pointer-events-none shrink-0"
                            />
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MapPin size={13} className="text-indigo-600 shrink-0" />
                              <span className="truncate font-bold text-xs text-indigo-950">
                                {station.name || station.station_name}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {station.isCustom && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCustomLocation(normDept, stationKey, e)}
                                className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                                title="ลบจุดใช้งานนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-indigo-600 text-white shrink-0 shadow-xs">
                              Copy {copyLabel}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={stationKey}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleToggleStation(normDept, station)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggleStation(normDept, station);
                          }
                        }}
                        className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/90 bg-white text-slate-800 hover:bg-slate-50/80 hover:border-indigo-300 cursor-pointer text-xs select-none transition-all duration-150 group shadow-2xs hover:scale-[1.01]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-1">
                          <input
                            type="checkbox"
                            checked={false}
                            readOnly
                            tabIndex={-1}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 pointer-events-none shrink-0 group-hover:border-indigo-500"
                          />
                          <div className="flex items-center gap-1.5 min-w-0">
                            <MapPin size={13} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                            <span className="font-semibold text-xs text-slate-700 group-hover:text-slate-900 truncate transition-colors">
                              {station.name || station.station_name}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {station.isCustom && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCustomLocation(normDept, stationKey, e)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                              title="ลบจุดใช้งานนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-[11px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                            + เลือก
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Seamless Quick Add Input Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5">
                  <input
                    type="text"
                    placeholder={`เพิ่มจุดติดตั้งพิเศษใน ${dept.shortName || normDept}...`}
                    value={customInputs[normDept] || ''}
                    onChange={(e) => setCustomInputs(prev => ({ ...prev, [normDept]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomLocation(normDept);
                      }
                    }}
                    className="flex-1 h-10 px-4 text-xs bg-slate-50/80 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCustomLocation(normDept)}
                    className="h-10 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มจุด</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* 3. แถบสรุปสำเนาที่จะจัดพิมพ์ */}
      <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#1E293B]">
          <Printer className="text-[#0D99FF] shrink-0" size={15} />
          <span>สำเนาที่จะพิมพ์ ({copyCalculation.totalCopies} ชุด):</span>
        </div>
        
        <div className="flex flex-wrap gap-1.5">
          {copyCalculation.allAllocations.map((alloc) => (
            <span
              key={`${alloc.departmentId}::${alloc.locationId}`}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border ${
                alloc.isMaster
                  ? 'bg-[#1E293B] text-white border-[#1E293B]'
                  : 'bg-[#F8FAFC] text-[#1E293B] border-[#CBD5E1] shadow-2xs'
              }`}
            >
              <span className={`font-bold uppercase ${alloc.isMaster ? 'text-slate-300' : 'text-[#0D99FF]'}`}>{alloc.departmentId}</span>
              <span>Copy {alloc.copyNo}</span>
              <span className={`font-sans font-normal truncate max-w-[140px] ${alloc.isMaster ? 'text-slate-300' : 'text-[#475569]'}`}>
                {alloc.locationName}
              </span>
              {!alloc.isMaster && (
                <button
                  type="button"
                  onClick={() => handleToggleStation(alloc.departmentId, { id: alloc.locationId, name: alloc.locationName })}
                  className="text-[#94A3B8] hover:text-[#EF4444] transition-colors p-0.5 cursor-pointer ml-0.5"
                  title="ลบจุดนี้ออก"
                >
                  <X className="w-3 h-3 stroke-[3]" />
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      {showConfirmButton && (
        <div className="flex justify-end pt-2 border-t border-slate-200">
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
