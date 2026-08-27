/**
 * MasterDataService.js
 * 
 * Standard Points of Use / Stations Master Data & Distribution Engine (Client-Side 100%)
 * Conforms to ISO 9001 / FSSC 22000 industrial standard document distribution requirements.
 */

export const STANDARD_STATIONS = [
  // ฝ่ายผลิต (PD - Production)
  {
    id: 'PD-MASTER',
    departmentId: 'PD',
    name: 'PD Head Office (จุดคุมงานหลัก Master)',
    code: 'PD-OFFICE',
    isMasterOffice: true,
    description: 'จุดควบคุมงานหลักฝ่ายผลิตและแฟ้มเอกสารหลัก'
  },
  {
    id: 'PD-L1',
    departmentId: 'PD',
    name: 'Line 1 - Mixing (ห้องผสม)',
    code: 'PD-L1',
    description: 'ห้องผสมและเตรียมวัตถุดิบไลน์ 1'
  },
  {
    id: 'PD-L2',
    departmentId: 'PD',
    name: 'Line 2 - Baking (เตาอบ)',
    code: 'PD-L2',
    description: 'พื้นที่เตาอบและควบคุมอุณหภูมิไลน์ 2'
  },
  {
    id: 'PD-L3',
    departmentId: 'PD',
    name: 'Line 3 - Fruit Line (ไลน์แต่งหน้า)',
    code: 'PD-L3',
    description: 'ไลน์แต่งหน้าผลไม้และเตรียมท็อปปิ้งไลน์ 3'
  },
  {
    id: 'PD-L4',
    departmentId: 'PD',
    name: 'Line 4 - Packing & Sealing (ไลน์บรรจุและซีล)',
    code: 'PD-L4',
    description: 'ไลน์บรรจุภัณฑ์ ปิดผนึก และตรวจสอบขั้นสุดท้าย'
  },
  {
    id: 'PD-MD12',
    departmentId: 'PD',
    name: 'Metal Detector 1-2 (เครื่องตรวจจับโลหะ 1-2)',
    code: 'PD-MD12',
    description: 'จุดตรวจจับสิ่งแปลกปลอมและโลหะ เครื่อง 1-2 (CCP)'
  },
  {
    id: 'PD-MD34',
    departmentId: 'PD',
    name: 'Metal Detector 3-4 (เครื่องตรวจจับโลหะ 3-4)',
    code: 'PD-MD34',
    description: 'จุดตรวจจับสิ่งแปลกปลอมและโลหะ เครื่อง 3-4 (CCP)'
  },
  {
    id: 'PD-RM',
    departmentId: 'PD',
    name: 'RM Prep Area (จุดเตรียมวัตถุดิบ)',
    code: 'PD-RM',
    description: 'พื้นที่ชั่งตวงและเตรียมวัตถุดิบก่อนเข้าสู่กระบวนการ'
  },
  {
    id: 'PD-CR',
    departmentId: 'PD',
    name: 'Control Room (ห้องควบคุมกลาง)',
    code: 'PD-CR',
    description: 'ห้องควบคุมระบบปฏิบัติการและมอนิเตอร์ไลน์ผลิต'
  },

  // ฝ่ายประกันคุณภาพ (QA/QC)
  {
    id: 'QA-MASTER',
    departmentId: 'QA/QC',
    name: 'QA Head Office (Master)',
    code: 'QA-OFFICE',
    isMasterOffice: true,
    description: 'สำนักงานหลักฝ่ายประกันคุณภาพและงานควบคุมระบบ'
  },
  {
    id: 'QA-CHEM',
    departmentId: 'QA/QC',
    name: 'QC Chemistry Lab (ห้องปฏิบัติการเคมี)',
    code: 'QC-CHEM',
    description: 'ห้องตรวจวิเคราะห์คุณสมบัติทางเคมีและกายภาพ'
  },
  {
    id: 'QA-MICRO',
    departmentId: 'QA/QC',
    name: 'QC Micro Lab (ห้องปฏิบัติการจุลชีววิทยา)',
    code: 'QC-MICRO',
    description: 'ห้องตรวจวิเคราะห์เชื้อจุลินทรีย์และสุขาภิบาล'
  },
  {
    id: 'QA-RETAIN',
    departmentId: 'QA/QC',
    name: 'Retain Sample Room (ห้องเก็บตัวอย่าง)',
    code: 'QC-RETAIN',
    description: 'ห้องควบคุมอุณหภูมิสำหรับเก็บตัวอย่างอ้างอิงสินค้า'
  },
  {
    id: 'QA-INSPECT',
    departmentId: 'QA/QC',
    name: 'Incoming Inspection (จุดตรวจรับวัตถุดิบ)',
    code: 'QC-INSPECT',
    description: 'จุดตรวจสอบคุณภาพวัตถุดิบและบรรจุภัณฑ์ขาเข้า'
  },

  // ฝ่ายคลังสินค้า (WH - Warehouse)
  {
    id: 'WH-MASTER',
    departmentId: 'WH',
    name: 'WH Office (Master)',
    code: 'WH-OFFICE',
    isMasterOffice: true,
    description: 'สำนักงานหลักฝ่ายคลังสินค้าและธุรการคลัง'
  },
  {
    id: 'WH-RM',
    departmentId: 'WH',
    name: 'Raw Material Warehouse (คลังวัตถุดิบ)',
    code: 'WH-RM',
    description: 'พื้นที่จัดเก็บวัตถุดิบหลักและสารปรุงแต่ง'
  },
  {
    id: 'WH-FG',
    departmentId: 'WH',
    name: 'Finished Goods Warehouse (คลังสินค้าสำเร็จรูป)',
    code: 'WH-FG',
    description: 'พื้นที่จัดเก็บสินค้าสำเร็จรูปรอการกระจายสินค้า'
  },
  {
    id: 'WH-COLD',
    departmentId: 'WH',
    name: 'Cold Storage (ห้องเย็น)',
    code: 'WH-COLD',
    description: 'คลังจัดเก็บสินค้าควบคุมอุณหภูมิแช่เย็น/แช่แข็ง'
  },
  {
    id: 'WH-PKG',
    departmentId: 'WH',
    name: 'Packaging Storage (คลังบรรจุภัณฑ์)',
    code: 'WH-PKG',
    description: 'พื้นที่จัดเก็บกล่อง ฟิล์ม ซอง และอุปกรณ์บรรจุภัณฑ์'
  },

  // ฝ่ายวิศวกรรม (EN - Engineering)
  {
    id: 'EN-MASTER',
    departmentId: 'EN',
    name: 'EN Office (Master)',
    code: 'EN-OFFICE',
    isMasterOffice: true,
    description: 'สำนักงานหลักฝ่ายวิศวกรรมและการวางแผนซ่อมบำรุง'
  },
  {
    id: 'EN-WORK',
    departmentId: 'EN',
    name: 'Maintenance Workshop (ช่างซ่อมบำรุง)',
    code: 'EN-WORK',
    description: 'โรงซ่อมและพื้นที่ปฏิบัติงานช่างเทคนิค'
  },
  {
    id: 'EN-UTIL',
    departmentId: 'EN',
    name: 'Utility & Boiler Room (ห้องหม้อไอน้ำและระบบน้ำ-ไฟ)',
    code: 'EN-UTIL',
    description: 'ระบบผลิตไอน้ำ ระบบบำบัดน้ำดี-น้ำเสีย และห้องควบคุมไฟฟ้า'
  },
  {
    id: 'EN-SPARE',
    departmentId: 'EN',
    name: 'Spare Parts Store (ห้องเก็บอะไหล่)',
    code: 'EN-SPARE',
    description: 'คลังจัดเก็บอะไหล่เครื่องจักรและเครื่องมือช่าง'
  },

  // ฝ่ายจัดซื้อ (PC - Purchasing)
  {
    id: 'PC-MASTER',
    departmentId: 'PC',
    name: 'PC Head Office (จุดคุมงานหลัก Master)',
    code: 'PC-OFFICE',
    isMasterOffice: true,
    description: 'สำนักงานหลักฝ่ายจัดซื้อและประเมินคู่ค้า'
  },

  // ฝ่ายทรัพยากรบุคคลและธุรการ (HR/HR&GA)
  {
    id: 'HR-MASTER',
    departmentId: 'HR&GA',
    name: 'HR&GA Head Office (จุดคุมงานหลัก Master)',
    code: 'HR-OFFICE',
    isMasterOffice: true,
    description: 'สำนักงานฝ่ายบริหารทรัพยากรบุคคลและธุรการทั่วไป'
  },

  // ฝ่ายความปลอดภัยและสิ่งแวดล้อม (HSE)
  {
    id: 'HSE-MASTER',
    departmentId: 'HSE',
    name: 'HSE Head Office (จุดคุมงานหลัก Master)',
    code: 'HSE-OFFICE',
    isMasterOffice: true,
    description: 'สำนักงานความปลอดภัย อาชีวอนามัย และสิ่งแวดล้อม'
  },

  // ฝ่ายจัดเก็บ/สโตร์ (ST)
  {
    id: 'ST-MASTER',
    departmentId: 'ST',
    name: 'ST Office (จุดคุมงานหลัก Master)',
    code: 'ST-OFFICE',
    isMasterOffice: true,
    description: 'สำนักงานบริหารสต็อกและอุปกรณ์สำนักงาน'
  },

  // ฝ่ายการตลาด (MKT)
  {
    id: 'MKT-MASTER',
    departmentId: 'MKT',
    name: 'MKT Office (จุดคุมงานหลัก Master)',
    code: 'MKT-OFFICE',
    isMasterOffice: true,
    description: 'สำนักงานฝ่ายการตลาดและการขาย'
  }
];

export const DEPARTMENT_METADATA = [
  { id: 'PD', name: 'ฝ่ายผลิต (Production)', shortName: 'PD', badgeColor: 'blue' },
  { id: 'QA/QC', name: 'ฝ่ายประกันคุณภาพ (QA/QC)', shortName: 'QA/QC', badgeColor: 'emerald' },
  { id: 'WH', name: 'ฝ่ายคลังสินค้า (Warehouse)', shortName: 'WH', badgeColor: 'amber' },
  { id: 'EN', name: 'ฝ่ายวิศวกรรม (Engineering)', shortName: 'EN', badgeColor: 'purple' },
  { id: 'PC', name: 'ฝ่ายจัดซื้อ (Purchasing)', shortName: 'PC', badgeColor: 'teal' },
  { id: 'HR&GA', name: 'ฝ่ายบุคคลและธุรการ (HR&GA)', shortName: 'HR&GA', badgeColor: 'rose' },
  { id: 'HSE', name: 'ความปลอดภัยและสิ่งแวดล้อม (HSE)', shortName: 'HSE', badgeColor: 'orange' },
  { id: 'ST', name: 'ฝ่ายคลังอุปกรณ์ (ST)', shortName: 'ST', badgeColor: 'slate' },
  { id: 'MKT', name: 'ฝ่ายการตลาด (Marketing)', shortName: 'MKT', badgeColor: 'indigo' }
];

/**
 * Normalize department IDs for backward compatibility (e.g., 'QA' -> 'QA/QC', 'HR' -> 'HR&GA')
 */
export const normalizeDepartmentId = (deptId) => {
  if (!deptId) return 'PD';
  const clean = String(deptId).trim();
  if (clean === 'QA' || clean === 'QA Super' || clean === 'QC') return 'QA/QC';
  if (clean === 'HR' || clean === 'GA') return 'HR&GA';
  return clean;
};

/**
 * Get all standard stations belonging to a specific department
 */
export const getDepartmentStations = (deptId, customStationList = null) => {
  const normDept = normalizeDepartmentId(deptId);
  const stations = customStationList || STANDARD_STATIONS;
  return stations.filter(s => s.status !== 'INACTIVE' && normalizeDepartmentId(s.departmentId) === normDept);
};

/**
 * Get the Office Master station for a department (used as fallback or Master lock)
 */
export const getMasterStationForDept = (deptId, customStationList = null) => {
  const normDept = normalizeDepartmentId(deptId);
  const stations = getDepartmentStations(normDept, customStationList);
  const master = stations.find(s => s.isMasterOffice);
  if (master) return master;
  
  return {
    id: `${normDept}-MASTER`,
    departmentId: normDept,
    name: `${normDept} Office (Master)`,
    code: `${normDept}-OFFICE`,
    isMasterOffice: true,
    description: `สำนักงานหลักฝ่าย ${normDept}`
  };
};

/**
 * Pure calculation engine for allocating sequential copy numbers.
 * Rule:
 * - Copy 01 (Strict Lock): Always assigned to Owner Department Master station.
 * - Copy 02..N: Sequentially numbered for all selected locations without gaps.
 * - Validation Fallback: If a department is selected with 0 sub-stations, fallback to Office Master.
 *
 * @param {string} ownerDept
 * @param {Array<{ departmentId: string, locationId: string, locationName?: string, isCustom?: boolean }>} selectedLocations
 * @returns {{ masterCopy: Object, distributedCopies: Array<Object>, allAllocations: Array<Object> }}
 */
export const calculateCopyAllocations = (ownerDept = 'PD', selectedLocations = []) => {
  const normOwner = normalizeDepartmentId(ownerDept);
  const ownerMasterStation = getMasterStationForDept(normOwner);
  const ownerDeptMeta = DEPARTMENT_METADATA.find(d => normalizeDepartmentId(d.id) === normOwner);
  const ownerDeptName = ownerDeptMeta?.name || normOwner;

  const masterCopy = {
    copyNo: '01',
    copy_no: '01',
    copyLabel: 'Copy 01 (Master)',
    departmentId: normOwner,
    dept: normOwner,
    dept_code: normOwner,
    department: normOwner,
    target_department: normOwner,
    targetDepartment: normOwner,
    dept_name: ownerDeptName,
    locationId: ownerMasterStation.id,
    station_id: ownerMasterStation.id,
    locationName: ownerMasterStation.name,
    station_name: ownerMasterStation.name,
    location: ownerMasterStation.name,
    name: ownerMasterStation.name,
    isMaster: true,
    is_master: true,
    isOwner: true,
    is_owner: true,
    isCustom: false,
    is_custom: false
  };

  // Filter out any duplicates and ensure no collision with masterCopy
  const nonMasterSelections = [];
  const seenIds = new Set();

  (selectedLocations || []).forEach(item => {
    if (!item) return;
    const dept = normalizeDepartmentId(item.departmentId || item.dept || item.dept_code || item.department || item.target_department);
    const locId = item.locationId || item.station_id || item.id || `${dept}-DEFAULT`;
    
    // Skip if it is the owner's master station itself (already locked at Copy 01)
    if (dept === normOwner && locId === ownerMasterStation.id) {
      return;
    }

    const uniqueKey = `${dept}::${locId}`;
    if (!seenIds.has(uniqueKey)) {
      seenIds.add(uniqueKey);
      
      // Lookup station name if missing
      let locName = item.locationName || item.station_name || item.name || item.location;
      if (!locName) {
        const stdStation = STANDARD_STATIONS.find(s => s.id === locId);
        locName = stdStation ? stdStation.name : locId;
      }

      const deptMeta = DEPARTMENT_METADATA.find(d => normalizeDepartmentId(d.id) === dept);
      const deptName = deptMeta?.name || dept;

      nonMasterSelections.push({
        departmentId: dept,
        dept: dept,
        dept_code: dept,
        department: dept,
        target_department: dept,
        targetDepartment: dept,
        dept_name: deptName,
        locationId: locId,
        station_id: locId,
        locationName: locName,
        station_name: locName,
        location: locName,
        name: locName,
        isCustom: !!(item.isCustom || item.is_custom),
        is_custom: !!(item.isCustom || item.is_custom),
        isMaster: false,
        is_master: false,
        isOwner: false,
        is_owner: false
      });
    }
  });

  // Assign sequential copy numbers starting from Copy 02
  const distributedCopies = nonMasterSelections.map((item, index) => {
    const copyIndex = index + 2;
    const copyNo = String(copyIndex).padStart(2, '0');
    return {
      ...item,
      copyNo,
      copy_no: copyNo,
      copyLabel: `Copy ${copyNo}`
    };
  });

  const allAllocations = [masterCopy, ...distributedCopies];

  return {
    masterCopy,
    distributedCopies,
    allAllocations,
    totalCopies: allAllocations.length
  };
};

/**
 * จัดรูปแบบเลขรหัสเอกสารตามมาตรฐาน 2 หลักขั้นต่ำ (01-99 ➔ 100+):
 * 1-99   => "01", "02", ..., "99" (2 หลัก)
 * 100+   => "100", "101", ... (3 หลักขึ้นไป)
 */
export const formatDocumentRunningNumber = (num) => {
  const parsed = parseInt(num, 10) || 1;
  return parsed < 100 ? String(parsed).padStart(2, '0') : String(parsed);
};

/**
 * สร้างรหัสเอกสารตาม Pattern ของ Master Data:
 * แทนที่ {Type}, {Dept}, {###}, {##} ด้วยค่าจริง
 */
export const generateDocumentCode = (pattern, typeCode, deptCode, seqNumber) => {
  const pat = pattern || `${typeCode}-{Dept}-{##}`;
  const seqFormatted = formatDocumentRunningNumber(seqNumber);
  return pat
    .replace('{Type}', typeCode)
    .replace('{Dept}', deptCode)
    .replace('{###}', seqFormatted)
    .replace('{##}', seqFormatted);
};

/**
 * คำนวณลำดับหมายเลขเอกสารถัดไป (Max Historical Sequence + 1)
 * ตามมาตรฐาน ISO 9001:2015 Clause 7.5.3:
 * - สแกนหาตัวเลขลำดับสูงสุดตลอดกาลจากเอกสารทุกสถานะ (ACTIVE, EFFECTIVE, OBSOLETE, SUPERSEDED, ARCHIVED)
 * - รวมทั้งคำร้อง DAR ที่อยู่ระหว่างดำเนินการหรือแบบร่าง (DRAFT, PENDING_REVIEW, PENDING_APPROVAL)
 * - ป้องกันการ Recycle เลขเอกสารที่เคยยกเลิก (OBSOLETE) ไปแล้วกลับมาใช้ซ้ำ 100%
 */
export const calculateNextDocumentSequence = (docType, deptCode, documents = [], dars = []) => {
  if (!docType || !deptCode) return 1;
  const docPrefix = `${docType}-${deptCode}-`;
  let maxSeq = 0;

  // 1. Scan all historical internal documents across all statuses
  (documents || []).forEach(doc => {
    if (!doc) return;
    const codeCandidates = [doc.docCode, doc.doc_code, doc.docNo, doc.code, doc.title, doc.id];
    for (const code of codeCandidates) {
      if (typeof code === 'string' && code.startsWith(docPrefix)) {
        const seqStr = code.replace(docPrefix, '').split(/[^0-9]/)[0];
        const seq = parseInt(seqStr, 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
        break;
      }
    }
  });

  // 2. Scan all DAR requests (Drafts, In-Progress, Pending Approval)
  (dars || []).forEach(dar => {
    if (!dar) return;
    if (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT' || dar.docType === docType) {
      const codeCandidates = [dar.docIdInput, dar.docCode, dar.doc_code, dar.docNo];
      for (const code of codeCandidates) {
        if (typeof code === 'string' && code.startsWith(docPrefix)) {
          const seqStr = code.replace(docPrefix, '').split(/[^0-9]/)[0];
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
          break;
        }
      }
    }
  });

  return maxSeq + 1;
};

/**
 * คำนวณลำดับหมายเลขเอกสารภายนอกถัดไป (Max Historical Sequence + 1 สำหรับ ED)
 */
export const calculateNextExternalDocSequence = (deptCode, externalDocuments = []) => {
  if (!deptCode) return 1;
  const docPrefix = `ED-${deptCode}-`;
  let maxSeq = 0;

  (externalDocuments || []).forEach(doc => {
    if (!doc) return;
    const codeCandidates = [doc.edCode, doc.doc_code, doc.docNo, doc.id, doc.title];
    for (const code of codeCandidates) {
      if (typeof code === 'string' && code.startsWith(docPrefix)) {
        const seqStr = code.replace(docPrefix, '').split(/[^0-9]/)[0];
        const seq = parseInt(seqStr, 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
        break;
      }
    }
  });

  return maxSeq + 1;
};

export default {
  STANDARD_STATIONS,
  DEPARTMENT_METADATA,
  normalizeDepartmentId,
  getDepartmentStations,
  getMasterStationForDept,
  calculateCopyAllocations,
  formatDocumentRunningNumber,
  generateDocumentCode,
  calculateNextDocumentSequence,
  calculateNextExternalDocSequence
};
