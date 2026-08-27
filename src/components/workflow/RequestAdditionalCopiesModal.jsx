import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  PlusCircle, 
  Layers, 
  MapPin, 
  Check, 
  Plus, 
  Trash2, 
  Send, 
  Sparkles,
  Info
} from 'lucide-react';
import useStore from '../../store/useStore';
import { 
  DEPARTMENT_METADATA, 
  STANDARD_STATIONS, 
  normalizeDepartmentId 
} from '../../services/MasterDataService';
import toast from 'react-hot-toast';

const RequestAdditionalCopiesModal = ({ isOpen, onClose, document: doc }) => {
  const { 
    controlledCopyInstances, 
    documentControlledCopies, 
    requestAdditionalControlledCopies,
    distributionLocations,
    masterDepartments
  } = useStore();

  const [selectedDept, setSelectedDept] = useState('PD');
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [customLocationName, setCustomLocationName] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic department list
  const deptList = useMemo(() => {
    if (masterDepartments && masterDepartments.length > 0) {
      return masterDepartments.filter(d => d.status !== 'INACTIVE').map(d => ({
        id: d.id,
        name: d.nameTh || d.name,
        code: d.id
      }));
    }
    return Array.isArray(DEPARTMENT_METADATA) 
      ? DEPARTMENT_METADATA.map(d => ({ id: d.id, name: d.name, code: d.id }))
      : Object.entries(DEPARTMENT_METADATA).map(([k, v]) => ({ id: k, name: v.name || k, code: k }));
  }, [masterDepartments]);

  // Synchronized Copies
  const allCopies = useMemo(() => {
    return (controlledCopyInstances && controlledCopyInstances.length > 0)
      ? controlledCopyInstances
      : (documentControlledCopies || []);
  }, [controlledCopyInstances, documentControlledCopies]);

  // Existing deployed copies of this document
  const existingCopies = useMemo(() => {
    if (!doc) return [];
    return allCopies.filter(c => 
      String(c.doc_id || c.docId) === String(doc.id) ||
      (c.doc_code && c.doc_code === doc.title) ||
      (c.docTitle && c.docTitle === doc.title)
    ).sort((a, b) => {
      const numA = parseInt(a.copy_no || a.ccNumber?.replace(/\D/g, '') || '0', 10);
      const numB = parseInt(b.copy_no || b.ccNumber?.replace(/\D/g, '') || '0', 10);
      return numA - numB;
    });
  }, [allCopies, doc]);

  // Calculate highest existing copy number
  const maxExistingCopyNo = useMemo(() => {
    let max = 0;
    existingCopies.forEach(c => {
      const raw = c.copy_no || c.ccNumber?.replace(/\D/g, '');
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > max) {
        max = parsed;
      }
    });
    return max;
  }, [existingCopies]);

  // Set of locations already holding a copy
  const existingLocationKeys = useMemo(() => {
    const set = new Set();
    existingCopies.forEach(c => {
      const loc = c.location || c.locationName || '';
      const dept = c.holder_dept || c.department || '';
      if (loc) set.add(`${dept}::${loc}`.toLowerCase());
      if (c.locationId) set.add(c.locationId.toLowerCase());
    });
    return set;
  }, [existingCopies]);

  // Available standard stations for the selected department (excluding already deployed)
  const availableStations = useMemo(() => {
    const normDept = normalizeDepartmentId(selectedDept);
    const stationSource = (distributionLocations && distributionLocations.length > 0)
      ? distributionLocations
      : STANDARD_STATIONS;
    const stations = stationSource.filter(s => s.status !== 'INACTIVE' && normalizeDepartmentId(s.departmentId) === normDept);

    return stations.map(station => {
      const key = `${selectedDept}::${station.name}`.toLowerCase();
      const isAlreadyDeployed = existingLocationKeys.has(key) || existingLocationKeys.has(station.id.toLowerCase());
      const isSelectedInDraft = selectedLocations.some(l => l.locationId === station.id || (l.locationName === station.name && l.departmentId === selectedDept));

      return {
        ...station,
        isAlreadyDeployed,
        isSelectedInDraft
      };
    });
  }, [selectedDept, existingLocationKeys, selectedLocations, distributionLocations]);

  // Live Sequential Preview
  const numberingPreview = useMemo(() => {
    let currentMax = maxExistingCopyNo;
    return selectedLocations.map((loc) => {
      currentMax += 1;
      return {
        ...loc,
        previewCopyNo: String(currentMax).padStart(2, '0'),
        previewCcNumber: `CC-${String(currentMax).padStart(3, '0')}`
      };
    });
  }, [selectedLocations, maxExistingCopyNo]);

  if (!isOpen || !doc) return null;

  // Toggle Standard Station
  const handleToggleStation = (station) => {
    if (station.isAlreadyDeployed) return;

    const exists = selectedLocations.find(l => l.locationId === station.id && l.departmentId === selectedDept);
    if (exists) {
      setSelectedLocations(prev => prev.filter(l => !(l.locationId === station.id && l.departmentId === selectedDept)));
    } else {
      setSelectedLocations(prev => [
        ...prev,
        {
          departmentId: selectedDept,
          locationId: station.id,
          locationName: station.name,
          isCustom: false
        }
      ]);
    }
  };

  // Add Custom Location
  const handleAddCustomLocation = (e) => {
    e.preventDefault();
    const trimmed = customLocationName.trim();
    if (!trimmed) return;

    const key = `${selectedDept}::${trimmed}`.toLowerCase();
    if (existingLocationKeys.has(key)) {
      toast.error(`จุดใช้งาน "${trimmed}" มีเอกสารนี้ติดตั้งอยู่แล้ว`);
      return;
    }

    if (selectedLocations.some(l => l.locationName.toLowerCase() === trimmed.toLowerCase() && l.departmentId === selectedDept)) {
      toast.error('จุดใช้งานนี้อยู่ในรายการที่เลือกแล้ว');
      return;
    }

    setSelectedLocations(prev => [
      ...prev,
      {
        departmentId: selectedDept,
        locationId: `CUSTOM-${Date.now()}`,
        locationName: trimmed,
        isCustom: true
      }
    ]);
    setCustomLocationName('');
  };

  const handleRemoveSelectedLocation = (index) => {
    setSelectedLocations(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedLocations.length === 0) {
      toast.error('กรุณาเลือกจุดใช้งานใหม่อย่างน้อย 1 จุด');
      return;
    }
    if (!reason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการขอสำเนาเพิ่มเติม');
      return;
    }

    setIsSubmitting(true);
    try {
      requestAdditionalControlledCopies(doc.id, selectedLocations, reason.trim());
      toast.success(`ส่งคำขอออกสำเนาเพิ่มเติม ${selectedLocations.length} เล่ม สำเร็จ! ส่งต่อให้ DCC ดำเนินการ`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการส่งคำขอ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/20 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-stone-200 w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-5 bg-white border-b border-stone-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#f9f8f6] text-[#da7756] border border-stone-200 flex items-center justify-center shrink-0">
                <PlusCircle size={24} />
              </div>
              <div>
                <h3 className="font-bold text-xl sm:text-2xl text-[#2d2d2d] tracking-tight">
                  ขอสำเนาควบคุมเพิ่มเติม
                </h3>
                <p className="text-sm text-stone-500 mt-1">
                  ขอเพิ่มสำเนาสำหรับเอกสารที่บังคับใช้แล้ว โดยไม่ต้องเปิด DAR แก้ไข Revision
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-[#2d2d2d] hover:bg-stone-50 rounded-xl transition-colors focus:ring-2 focus:ring-[#da7756]/20 outline-none"
              title="ปิดหน้าต่าง"
            >
              <X size={24} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-8 overflow-y-auto space-y-8 flex-1 text-sm bg-[#f9f8f6]">
            {/* Document Header Card */}
            <div className="p-5 bg-white border border-stone-200 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-sm min-w-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-1.5">
                  <span className="font-mono font-bold text-base text-[#da7756] bg-[#f9f8f6] px-3 py-1 rounded-lg border border-stone-200">{doc.title}</span>
                  <span className="px-2 py-1 rounded bg-stone-100 text-stone-600 font-bold font-mono text-xs border border-stone-200">
                    Rev.{doc.rev}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#f9f8f6] text-[#4a724b] font-bold text-xs border border-stone-200">
                    {doc.status}
                  </span>
                </div>
                <div className="text-sm font-bold text-[#2d2d2d] break-all break-words min-w-0 [overflow-wrap:anywhere]">{doc.name}</div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs text-stone-400 font-bold uppercase tracking-widest mb-1">แผนกเจ้าของเอกสาร</div>
                <div className="text-base font-bold text-[#2d2d2d] font-mono">{doc.department}</div>
              </div>
            </div>

            {/* Section A: สรุปประวัติการแจกจ่ายเดิม */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[#2d2d2d] flex items-center gap-2">
                  <Layers size={18} className="text-[#b87c33]" /> A. ประวัติการแจกจ่ายเดิม ({existingCopies.length} เล่ม)
                </label>
                <span className="text-xs text-stone-500 font-mono bg-white px-2 py-1 rounded border border-stone-200">
                  Current Max: Copy {String(maxExistingCopyNo).padStart(2, '0')}
                </span>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-4 max-h-48 overflow-y-auto w-full max-w-full shadow-sm">
                {existingCopies.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {existingCopies.map(copy => (
                      <div 
                        key={copy.id}
                        className="p-3 bg-[#f9f8f6] border border-stone-200 rounded-xl flex items-center justify-between text-sm min-w-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="px-2 py-1 bg-white font-mono font-bold text-[#da7756] rounded-md text-xs shrink-0 border border-stone-200">
                            Copy {copy.copy_no || copy.ccNumber}
                          </span>
                          <span className="text-[#2d2d2d] break-all break-words min-w-0 [overflow-wrap:anywhere] font-bold" title={copy.location || copy.locationName}>
                            {copy.location || copy.locationName}
                          </span>
                        </div>
                        <span className="text-xs text-stone-500 font-medium shrink-0 ml-2">
                          {copy.holder_dept || copy.department}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-stone-400 text-center py-4">
                    ยังไม่มีข้อมูลประวัติสำเนาที่แจกจ่าย
                  </div>
                )}
              </div>
            </div>

            {/* Section B: ตัวเลือกจุดแจกจ่ายใหม่ (Hierarchical Location Selector) */}
            <div className="space-y-4 pt-2">
              <label className="text-sm font-bold text-[#2d2d2d] flex items-center gap-2">
                <MapPin size={18} className="text-[#4a724b]" /> B. เลือกจุดแจกจ่ายใหม่ (กรองจุดที่เคยได้รับแล้วออก)
              </label>

              {/* Department Tabs */}
              <div className="flex flex-wrap gap-2">
                {deptList.map(deptItem => {
                  const isSelected = normalizeDepartmentId(selectedDept) === normalizeDepartmentId(deptItem.id);
                  return (
                    <button
                      key={deptItem.id}
                      type="button"
                      onClick={() => setSelectedDept(deptItem.id)}
                      className={`px-4 py-2 text-sm font-bold rounded-xl transition-all outline-none focus:ring-4 focus:ring-[#da7756]/20 ${
                        isSelected
                          ? 'bg-[#da7756] text-white shadow-none'
                          : 'bg-white border border-stone-200 hover:bg-stone-50 text-stone-600'
                      }`}
                    >
                      {deptItem.name} ({deptItem.id})
                    </button>
                  );
                })}
              </div>

              {/* Standard Stations Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-4 border border-stone-200 rounded-xl bg-white shadow-sm">
                {availableStations.map(station => {
                  if (station.isAlreadyDeployed) {
                    return (
                      <div
                        key={station.id}
                        className="p-3 bg-stone-50 border border-stone-200 text-stone-400 rounded-xl flex items-center justify-between text-sm cursor-not-allowed opacity-60"
                        title="จุดนี้มีเอกสารควบคุมติดตั้งอยู่แล้ว"
                      >
                        <div className="flex items-center gap-3 truncate">
                          <Check size={16} className="text-[#4a724b] shrink-0" />
                          <span className="truncate">{station.name}</span>
                        </div>
                        <span className="text-xs bg-stone-200 px-2.5 py-1 rounded-md text-stone-600 font-bold shrink-0">
                          ติดตั้งแล้ว
                        </span>
                      </div>
                    );
                  }

                  const isSelected = station.isSelectedInDraft;
                  return (
                    <div
                      key={station.id}
                      onClick={() => handleToggleStation(station)}
                      className={`p-3 rounded-xl border flex items-center justify-between text-sm cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#f9f8f6] border-[#da7756] text-[#2d2d2d] shadow-sm ring-2 ring-[#da7756]'
                          : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#da7756] text-white' : 'border border-stone-300'
                        }`}>
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </div>
                        <span className={`truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>{station.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Location Input */}
              <div className="flex gap-3 pt-2">
                <input
                  type="text"
                  value={customLocationName}
                  onChange={(e) => setCustomLocationName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomLocation(e); }}}
                  placeholder={`ระบุจุดติดตั้งพิเศษเฉพาะกิจสำหรับแผนก ${selectedDept}...`}
                  className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm text-[#2d2d2d] placeholder:text-stone-400 focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/10 transition-all outline-none font-medium shadow-sm"
                />
                <button
                  type="button"
                  onClick={handleAddCustomLocation}
                  disabled={!customLocationName.trim()}
                  className="px-5 py-3 bg-white hover:bg-stone-50 text-[#2d2d2d] font-bold rounded-xl text-sm border border-stone-200 disabled:opacity-40 transition-colors flex items-center gap-2 shrink-0 shadow-sm focus:ring-4 focus:ring-stone-200 outline-none"
                >
                  <Plus size={16} /> เพิ่มจุดพิเศษ
                </button>
              </div>
            </div>

            {/* Section C: Live Sequential Numbering Preview */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[#2d2d2d] flex items-center gap-2">
                  <Sparkles size={18} className="text-[#da7756]" /> C. รายการสำเนาใหม่ที่จะได้รับ (Sequential Numbering Preview)
                </label>
                <span className="text-sm font-bold text-[#da7756] bg-[#f9f8f6] px-3 py-1 rounded-full border border-stone-200">
                  +{selectedLocations.length} เล่ม
                </span>
              </div>

              {numberingPreview.length > 0 ? (
                <div className="space-y-3 bg-white border border-stone-200 rounded-xl p-4 w-full max-w-full shadow-sm">
                  {numberingPreview.map((loc, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-[#f9f8f6] border border-stone-200 rounded-xl flex items-center justify-between text-sm shadow-sm min-w-0"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="px-3 py-1 bg-[#da7756] text-white font-mono font-bold rounded-lg text-sm shrink-0">
                          Copy {loc.previewCopyNo}
                        </span>
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <span className="font-bold text-[#2d2d2d] break-all break-words min-w-0 [overflow-wrap:anywhere] text-sm sm:text-base">{loc.locationName}</span>
                          <span className="text-sm text-stone-500 font-mono shrink-0">({loc.departmentId})</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedLocation(idx)}
                        className="p-2 text-stone-400 hover:text-[#a94442] hover:bg-[#f5e6e6] rounded-xl transition-colors ml-3 shrink-0 focus:ring-2 focus:ring-[#a94442]/20 outline-none"
                        title="ลบจุดนี้"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 border-2 border-dashed border-stone-200 rounded-xl text-center text-sm text-stone-400 bg-white">
                  ยังไม่ได้เลือกจุดใช้งานใหม่ (กรุณาคลิกเลือกจุดใช้งานจาก Section B ด้านบน)
                </div>
              )}
            </div>

            {/* Section D: ข้อมูลประกอบคำขอ (Reason - Mandatory) */}
            <div className="space-y-3 pt-2">
              <label className="block text-sm font-bold text-[#2d2d2d]">
                D. เหตุผลและความจำเป็นในการขอสำเนาเพิ่มเติม <span className="text-[#a94442]">*</span>:
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder="ระบุเหตุผลความจำเป็น เช่น ขยายไลน์การผลิต Line 3, เพิ่มเครื่องจักรใหม่ Metal Detector 3, หรือปรับผังโรงงาน..."
                rows={3}
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm text-[#2d2d2d] placeholder:text-stone-400 focus:border-[#da7756] focus:ring-4 focus:ring-[#da7756]/10 transition-all outline-none resize-none font-medium break-all break-words min-w-0 [overflow-wrap:anywhere] shadow-sm"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-8 py-5 bg-white border-t border-stone-100 flex items-center justify-between shrink-0">
            <div className="text-sm text-stone-500 flex items-center gap-2">
              <Info size={16} className="text-stone-400" />
              <span>ระบบจะสร้าง Task ส่งไปยัง DCC เพื่อพิมพ์และส่งมอบทันที</span>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="bg-white hover:bg-stone-50 text-stone-600 font-bold text-sm px-6 py-3 rounded-xl border border-stone-200 transition-colors focus:ring-4 focus:ring-stone-200 outline-none"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || selectedLocations.length === 0 || !reason.trim()}
                className="bg-[#da7756] hover:bg-[#c96646] active:scale-[0.99] text-white font-bold text-sm px-6 py-3 rounded-xl shadow-none transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-4 focus:ring-[#da7756]/20 outline-none"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังบันทึกคำขอ...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    ยืนยันขอสำเนาเพิ่มเติม ({selectedLocations.length} เล่ม)
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RequestAdditionalCopiesModal;
