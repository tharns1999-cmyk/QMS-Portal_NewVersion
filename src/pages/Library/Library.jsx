import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import { 
  Search, 
  BookOpen, 
  Share2, 
  Globe, 
  FilterX, 
  Download, 
  FileText, 
  Eye, 
  ExternalLink, 
  Sparkles, 
  AlertTriangle, 
  PlusCircle, 
  ShieldAlert, 
  Lock, 
  Building2, 
  MoreHorizontal, 
  FileEdit, 
  GitFork,
  CheckCircle2,
  RotateCcw,
  Edit3,
  Layers,
  ShieldCheck,
  Clock,
  XCircle
} from 'lucide-react';
import { getRequesterName, getReviewerName, getApproverName, getAckNames, normalizeDeptCode } from '../../utils/darHelper';
import ReplacementModal from './ReplacementModal';
import RequestAdditionalCopiesModal from '../../components/workflow/RequestAdditionalCopiesModal';
import WatermarkStudioModal from '../../components/workflow/WatermarkStudioModal';
import DocumentDetailModal from '../../components/workflow/DocumentDetailModal';
import toast from 'react-hot-toast';
import { UniversalWatermarkService, WATERMARK_TYPES, resolveWatermarkConfig } from '../../services/UniversalWatermarkService';
import { hasDocumentAccess, ACCESS_SCOPE_METADATA, ACCESS_SCOPES } from '../../utils/accessControl';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';

// Tab Constants
const TAB_GENERAL = 'GENERAL';
const TAB_MY_DEPT = 'MY_DEPT';
const TAB_DISTRIBUTED = 'DISTRIBUTED';

const Library = () => {
  const navigate = useNavigate();
  const { 
    documents, 
    currentUser, 
    canDownloadDocument, 
    dars, 
    timeline, 
    masterUsers, 
    controlledCopyInstances, 
    documentControlledCopies,
    reportCcDamagedLost, 
    logAction,
    documentTypes,
    masterDepartments,
    departments: storeDepts
  } = useStore();
  
  const isDccUser = Boolean(
    currentUser?.isDcc || 
    currentUser?.role === 'DCC_ADMIN' || 
    currentUser?.role === 'DCC_STAFF'
  );

  const [activeTab, setActiveTab] = useState(TAB_GENERAL);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStandard, setFilterStandard] = useState('');
  const [filterStatus, setFilterStatus] = useState('EFFECTIVE');
  const [filterDate, setFilterDate] = useState('');
  const [filterAccessScope, setFilterAccessScope] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [studioDoc, setStudioDoc] = useState(null);
  const [openMenuDocId, setOpenMenuDocId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  
  // For Replacement & Ad-Hoc Copy Requests
  const [replacementInstance, setReplacementInstance] = useState(null);
  const [adHocDoc, setAdHocDoc] = useState(null);

  // Close overflow menu on outside click, window resize, or Escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.dropdown-action-dock') && !e.target.closest('.overflow-dropdown-menu')) {
        setOpenMenuDocId(null);
        setMenuAnchor(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpenMenuDocId(null);
        setMenuAnchor(null);
      }
    };
    const handleScrollOrResize = () => {
      if (openMenuDocId) {
        setOpenMenuDocId(null);
        setMenuAnchor(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openMenuDocId]);

  // Department normalization & multi-department resolver
  const normalizeDept = (d) => {
    if (!d) return '';
    const val = typeof d === 'object' ? (d.id || d.code || d.dept || d.department) : d;
    return typeof val === 'string' ? val.trim().toUpperCase() : '';
  };

  const deptMatches = (d1, d2) => {
    const s1 = normalizeDept(d1);
    const s2 = normalizeDept(d2);
    if (!s1 || !s2) return false;
    if (s1 === s2) return true;
    if ((s1 === 'QA' || s1 === 'QA/QC' || s1 === 'QAQC') && (s2 === 'QA' || s2 === 'QA/QC' || s2 === 'QAQC')) return true;
    return false;
  };

  const primaryDept = useMemo(() => {
    return normalizeDept(
      currentUser?.primary_department || 
      currentUser?.department || 
      currentUser?.dept || 
      currentUser?.dept_code || 
      'PD'
    );
  }, [currentUser]);

  const userDistinctDepts = useMemo(() => {
    if (!currentUser) return [];
    const rawList = [
      currentUser.primary_department,
      currentUser.department,
      currentUser.dept,
      currentUser.dept_code,
      ...(Array.isArray(currentUser.departments) ? currentUser.departments : []),
      ...(Array.isArray(currentUser.secondaryDepartments) ? currentUser.secondaryDepartments : []),
      ...(Array.isArray(currentUser.affiliated_departments) ? currentUser.affiliated_departments : []),
      ...(Array.isArray(currentUser.depts) ? currentUser.depts : [])
    ];
    const unique = [];
    rawList.forEach(item => {
      const code = normalizeDept(item);
      if (code && !unique.includes(code)) {
        unique.push(code);
      }
    });
    if (primaryDept && unique.includes(primaryDept)) {
      return [primaryDept, ...unique.filter(d => d !== primaryDept)];
    }
    return unique.length > 0 ? unique : [primaryDept];
  }, [currentUser, primaryDept]);

  const [myDeptSubFilter, setMyDeptSubFilter] = useState(primaryDept);

  useEffect(() => {
    if (primaryDept) {
      setMyDeptSubFilter(primaryDept);
    }
  }, [primaryDept]);

  const availableDepts = useMemo(() => {
    const list = [];
    const seen = new Set();
    const storeDeptList = masterDepartments || storeDepts || [];
    storeDeptList.forEach((dept) => {
      const id = (dept.id || dept.code || dept.dept_code || '').toUpperCase();
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push({
          id,
          name: dept.name || dept.nameTh || dept.nameEn || id
        });
      }
    });
    (documents || []).forEach((doc) => {
      const d = (doc.department || doc.owner_dept || doc.dept_code || '').toUpperCase();
      if (d && !seen.has(d)) {
        seen.add(d);
        list.push({
          id: d,
          name: d
        });
      }
    });
    return list;
  }, [masterDepartments, storeDepts, documents]);

  const userDepts = userDistinctDepts;

  // Helper for QA vs QA/QC match, supporting array of user departments
  const isSameDept = (userDeptsArr, d) => {
    if (!d) return false;
    return (userDeptsArr || []).some(u => deptMatches(u, d));
  };

  const isOwnerDept = useCallback((doc) => {
    const docDept = doc.owner_dept || doc.department || doc.dept_code || doc.dept;
    return isSameDept(userDistinctDepts, docDept);
  }, [userDistinctDepts]);

  const hasDistributedCopyToUserDept = useCallback((doc) => {
    // 🛡️ Strict Cross-Department Distribution Rule: Exclude own department documents
    if (isOwnerDept(doc)) return false;
    const docDept = doc.owner_dept || doc.department || doc.dept_code || doc.dept;
    if (currentUser?.department && docDept === currentUser.department) return false;

    // กรองแสดงเอกสาร (จากแผนกอื่น) ที่มีการจัดสรรสำเนาควบคุมมาตั้งไว้ที่แผนกของผู้ใช้งาน
    const hasDistDept = (doc.distributed_depts || []).some(d => isSameDept(userDistinctDepts, d));
    const hasDistObj = (doc.distributions || []).some(d => isSameDept(userDistinctDepts, d.departmentId || d.department || d.dept));
    const hasControlledCopy = (controlledCopyInstances || documentControlledCopies || []).some(c => {
      const matchDoc = String(c.docId || c.doc_id) === String(doc.id) || 
                       c.doc_code === doc.title || 
                       c.docTitle === doc.title ||
                       c.doc_code === doc.document_code;
      return matchDoc && isSameDept(userDistinctDepts, c.holder_dept || c.department) && ['ISSUED_ACTIVE', 'ACTIVE'].includes(c.status);
    });
    return Boolean(hasDistDept || hasDistObj || hasControlledCopy);
  }, [isOwnerDept, userDistinctDepts, currentUser?.department, controlledCopyInstances, documentControlledCopies]);

  // Status Normalization Helper for Universal Tab Filtering
  const matchesStatusTab = (docStatus, selectedTab, doc = null) => {
    const st = (docStatus || (doc && doc.status) || '').toUpperCase();
    if (!selectedTab || selectedTab === 'ALL' || selectedTab === '') return true;
    
    // 1. แท็บ "มีผลบังคับใช้ (Active)": กรองเฉพาะ: doc.status === 'ACTIVE' && !doc.is_superseded && !doc.is_obsolete
    if (selectedTab === 'EFFECTIVE') {
      const isSuperseded = st === 'SUPERSEDED' || st === 'SUPERSEDED_ARCHIVED' || st === 'OUTDATED' || Boolean(doc?.is_superseded);
      const isObsolete = st === 'OBSOLETE' || st === 'OBSOLETE_ARCHIVED' || st === 'ARCHIVED_OBSOLETE' || st === 'OBSOLETE_PENDING_RECALL' || st.startsWith('OBSOLETE') || Boolean(doc?.is_obsolete);
      if (isSuperseded || isObsolete) return false;
      return (st === 'EFFECTIVE' || st === 'ACTIVE' || st === 'APPROVED' || st === 'PUBLISHED' || Boolean(doc?.is_active));
    }
    // 2. แท็บ "ฉบับเดิมตกรุ่น (Superseded)": กรองเฉพาะ: (doc.status === 'SUPERSEDED' || doc.is_superseded) && !doc.is_obsolete && doc.status !== 'OBSOLETE'
    if (selectedTab === 'SUPERSEDED') {
      const isObsolete = st === 'OBSOLETE' || st === 'OBSOLETE_ARCHIVED' || st === 'ARCHIVED_OBSOLETE' || st === 'OBSOLETE_PENDING_RECALL' || st.startsWith('OBSOLETE') || Boolean(doc?.is_obsolete);
      if (isObsolete) return false;
      return (st === 'SUPERSEDED' || st === 'SUPERSEDED_ARCHIVED' || st === 'OUTDATED' || Boolean(doc?.is_superseded));
    }
    // 3. แท็บ "ยกเลิกการใช้งาน (Obsolete)": กรองเฉพาะ: doc.status === 'OBSOLETE' || doc.is_obsolete === true
    if (selectedTab === 'OBSOLETE') {
      return (
        st === 'OBSOLETE' ||
        st === 'OBSOLETE_ARCHIVED' ||
        st === 'ARCHIVED_OBSOLETE' ||
        st === 'OBSOLETE_PENDING_RECALL' ||
        st.startsWith('OBSOLETE') ||
        Boolean(doc?.is_obsolete)
      );
    }
    return st === selectedTab;
  };

  // ดึงสิทธิ์ DCC
  const isDcc = isDccUser;

  // ขั้นตอนที่ 1: กรองตาม Scope แท็บหลัก (Data Segregation เด็ดขาด)
  const baseDocs = useMemo(() => {
    return (documents || []).filter((doc) => {
      if (activeTab === TAB_GENERAL || activeTab === 'general') {
        // แท็บ 1: เอกสารทั่วไป
        // แสดงเฉพาะเอกสารจากแผนกอื่นที่ผู้ใช้มีสิทธิ์เข้าถึง (General, Targeted Dept, ระบุตัวบุคคล)
        // Condition: doc.department !== currentUser.department AND userHasAccess(doc, currentUser)
        return !isOwnerDept(doc) && hasDocumentAccess(doc, currentUser);
      }
      if (activeTab === TAB_MY_DEPT || activeTab === 'dept') {
        // แท็บ 2: เอกสารในแผนกฉัน
        // แสดงเฉพาะเอกสารที่แผนกเจ้าของคือแผนกเดียวกับผู้ใช้งาน
        return isOwnerDept(doc);
      }
      if (activeTab === TAB_DISTRIBUTED || activeTab === 'dist') {
        // แท็บ 3: เอกสารที่ได้รับการแจกจ่าย
        // แสดงเฉพาะเอกสารจากแผนกอื่นที่มีการจัดสรรสำเนาควบคุมมาตั้งไว้ที่แผนกของผู้ใช้งาน (ไม่รวมเอกสารที่แผนกตัวเองเป็นเจ้าของเด็ดขาด)
        return !isOwnerDept(doc) && hasDistributedCopyToUserDept(doc) && hasDocumentAccess(doc, currentUser);
      }
      return true;
    });
  }, [documents, activeTab, userDistinctDepts, isOwnerDept, hasDistributedCopyToUserDept, currentUser]);

  // Compute Counts for All Tabs
  const accessibleDocs = useMemo(() => {
    return (documents || []).filter(d => hasDocumentAccess(d, currentUser));
  }, [documents, currentUser]);

  // Tab 1: เอกสารทั่วไป (Active docs จากแผนกอื่น)
  const generalDocsCount = accessibleDocs.filter(d => 
    !isOwnerDept(d) && matchesStatusTab(d.status, 'EFFECTIVE', d)
  ).length;

  // Tab 2: เอกสารในแผนกฉัน (Strict Requirement: นับเฉพาะเอกสารที่มีสถานะ ACTIVE เท่านั้น ห้ามนับรวมเอกสารตกรุ่นหรือยกเลิก)
  const myDeptDocsCount = accessibleDocs.filter(d => 
    isOwnerDept(d) && matchesStatusTab(d.status, 'EFFECTIVE', d)
  ).length;

  // Tab 3: เอกสารที่ได้รับการแจกจ่าย (Active docs จากแผนกอื่น ที่แจกจ่ายมายังแผนกผู้ใช้)
  const distributedDocsCount = accessibleDocs.filter(d => 
    !isOwnerDept(d) && hasDistributedCopyToUserDept(d) && matchesStatusTab(d.status, 'EFFECTIVE', d)
  ).length;

  const tabFilteredDocs = baseDocs;

  // Compute counts per department for Quick-Pill badges in "เอกสารในแผนกฉัน" (นับเฉพาะ ACTIVE เช่นกัน)
  const deptCounts = useMemo(() => {
    const counts = {};
    userDistinctDepts.forEach(dept => {
      counts[dept] = accessibleDocs.filter(d => {
        const docDept = d.owner_dept || d.department || d.dept_code || d.dept;
        return isOwnerDept(d) && deptMatches(docDept, dept) && matchesStatusTab(d.status, 'EFFECTIVE', d);
      }).length;
    });
    return counts;
  }, [accessibleDocs, userDistinctDepts, isOwnerDept]);

  const filteredDocs = useMemo(() => {
    const rawList = baseDocs.filter((doc) => {
      // 1. กรองตามสถานะ:
      // - ในแท็บ "เอกสารในแผนกฉัน" กรองตาม Sub-tabs (EFFECTIVE, SUPERSEDED, OBSOLETE, ALL)
      // - ในแท็บ "เอกสารทั่วไป" และ "เอกสารที่ได้รับการแจกจ่าย" ห้ามแสดง Sub-tabs และล็อกแสดงเฉพาะเอกสารที่มีผลบังคับใช้ (EFFECTIVE / ACTIVE)
      const effectiveStatusFilter = (activeTab === TAB_MY_DEPT || activeTab === 'dept') ? filterStatus : 'EFFECTIVE';
      if (!matchesStatusTab(doc.status, effectiveStatusFilter, doc)) return false;

      // 2. กรองตามประเภทเอกสาร
      if (filterType && filterType !== 'ALL') {
        const docType = (doc.doc_type || doc.type || (doc.title || '').split('-')[0] || '').toUpperCase();
        if (docType !== filterType.toUpperCase()) return false;
      }

      // 2.5 กรองตาม Department Sub-Filter (เฉพาะในแท็บ "เอกสารในแผนกฉัน" เมื่อผู้ใช้สังกัดมากกว่า 1 แผนก)
      if ((activeTab === TAB_MY_DEPT || activeTab === 'dept') && userDistinctDepts.length > 1) {
        if (myDeptSubFilter && myDeptSubFilter !== 'ALL') {
          const docDept = doc.owner_dept || doc.department || doc.dept_code || doc.dept;
          if (!deptMatches(docDept, myDeptSubFilter)) return false;
        }
      }

      // 3. กรองตามแผนก (Global Department Dropdown Filter)
      if (filterDept && filterDept !== 'ALL') {
        const docDept = (doc.department || doc.owner_dept || doc.dept_code || doc.dept || '').toUpperCase();
        if (!deptMatches(docDept, filterDept)) return false;
      }

      // 4. กรองตามคำค้นหา
      if (searchTerm && searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const code = (doc.document_code || doc.doc_code || doc.id || doc.title || '').toLowerCase();
        const title = (doc.title || doc.name || doc.document_title || '').toLowerCase();
        if (!code.includes(q) && !title.includes(q)) return false;
      }

      // 5. กรองตามระดับความลับและวันที่และมาตรฐาน
      if (filterAccessScope && filterAccessScope !== 'ALL') {
        const scope = doc.access_control?.scope || doc.access_scope || 'GENERAL';
        if (scope !== filterAccessScope) return false;
      }
      if (filterStandard && filterStandard !== 'ALL') {
        const stds = doc.relatedStandards || doc.related_standards || [];
        if (!stds.includes(filterStandard)) return false;
      }
      if (filterDate) {
        if (doc.effectiveDate !== filterDate && doc.effective_date !== filterDate) return false;
      }

      return true;
    });

    // การันตี 100%: ในแท็บ "มีผลบังคับใช้ (Active)" 1 รหัสเอกสาร ต้องปรากฏเพียง 1 แถวเท่านั้น (เลือก Revision ล่าสุด)
    const currentStatusScope = (activeTab === TAB_MY_DEPT || activeTab === 'dept') ? filterStatus : 'EFFECTIVE';
    if (currentStatusScope === 'EFFECTIVE') {
      const activeByCode = new Map();
      rawList.forEach(doc => {
        const code = (doc.document_code || doc.doc_code || doc.code || doc.docCode || doc.title || String(doc.id)).trim().toUpperCase();
        const existing = activeByCode.get(code);
        if (!existing) {
          activeByCode.set(code, doc);
        } else {
          const existingRev = parseInt(existing.rev || existing.revision || '0', 10) || 0;
          const currentRev = parseInt(doc.rev || doc.revision || '0', 10) || 0;
          if (currentRev > existingRev) {
            activeByCode.set(code, doc);
          }
        }
      });
      return Array.from(activeByCode.values());
    }

    return rawList;
  }, [baseDocs, filterStatus, filterType, filterDept, myDeptSubFilter, activeTab, userDistinctDepts, searchTerm, filterAccessScope, filterStandard, filterDate]);

  // Grouped Stacking for Superseded & Obsolete tabs
  const isGroupedView = filterStatus === 'SUPERSEDED' || filterStatus === 'OBSOLETE';

  const groupedDocs = useMemo(() => {
    if (!isGroupedView) return [];

    const map = new Map();
    filteredDocs.forEach(doc => {
      const code = (doc.document_code || doc.doc_code || doc.code || doc.docCode || doc.title || String(doc.id)).trim();
      const upperCode = code.toUpperCase();
      if (!map.has(upperCode)) {
        map.set(upperCode, {
          code,
          docs: []
        });
      }
      map.get(upperCode).docs.push(doc);
    });

    const groups = [];
    map.forEach(({ code, docs }) => {
      // Sort docs by revision descending (e.g. Rev.02, Rev.01, Rev.00)
      docs.sort((a, b) => {
        const revA = parseInt(a.rev || a.revision || '0', 10) || 0;
        const revB = parseInt(b.rev || b.revision || '0', 10) || 0;
        return revB - revA;
      });

      const latestDoc = docs[0];
      const revNums = docs.map(d => parseInt(d.rev || d.revision || '0', 10) || 0).sort((a, b) => a - b);
      const minRevStr = String(revNums[0]).padStart(2, '0');
      const maxRevStr = String(revNums[revNums.length - 1]).padStart(2, '0');
      const revRange = docs.length > 1 ? `R${minRevStr} - R${maxRevStr}` : `R${minRevStr}`;

      groups.push({
        id: `grp-${code}`,
        code,
        displayCode: latestDoc.document_code || latestDoc.doc_code || latestDoc.code || latestDoc.title || code,
        latestDoc,
        docs,
        totalRevisions: docs.length,
        revRange,
        department: latestDoc.department || latestDoc.owner_dept || 'PD',
        docType: latestDoc.docType || (code ? code.split('-')[0] : 'SOP'),
        title: latestDoc.name || latestDoc.docName || latestDoc.title || 'Procedure Document'
      });
    });

    return groups;
  }, [filteredDocs, isGroupedView]);

  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const toggleGroupExpand = (groupCode) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      const code = String(groupCode || '').trim().toUpperCase();
      if (next.has(code) || next.has(groupCode)) {
        next.delete(code);
        next.delete(groupCode);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  useEffect(() => {
    setExpandedGroups(new Set());
  }, [filterStatus, activeTab]);

  const tableData = isGroupedView ? groupedDocs : filteredDocs;

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalItems
  } = useTablePagination(tableData, 10);

  const availableTypes = [...new Set([
    ...accessibleDocs.map(doc => (doc.title || '').split('-')[0]),
    ...(documentTypes || []).filter(t => t.status === 'ACTIVE' || t.status === 'Active' || t.isActive !== false).map(t => t.code || t.id)
  ])].filter(Boolean).sort();

  const availableStandards = [...new Set(accessibleDocs.flatMap(doc => doc.relatedStandards || doc.related_standards || []))].filter(Boolean).sort();

  const handleExport = () => {
    const docsToExport = filteredDocs;
    if (!docsToExport || docsToExport.length === 0) {
      toast.error('ไม่มีข้อมูลเอกสารสำหรับส่งออก');
      return;
    }

    const formatDt = (dateInput) => {
      if (!dateInput || dateInput === '-') return '-';
      try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) {
          const match = String(dateInput).match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) return `${match[3]}/${match[2]}/${match[1]} 09:00`;
          return String(dateInput);
        }
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}`;
      } catch {
        return String(dateInput);
      }
    };

    const headers = [
      'ลำดับ (No.)',
      'รหัสเอกสาร (Doc Code)',
      'ชื่อเอกสาร (Document Title)',
      'ประเภทเอกสาร (Type)',
      'แผนกเจ้าของ (Owner Dept)',
      'ฉบับที่ (Rev.)',
      'วันที่มีผลบังคับใช้ (Effective Date)',
      'สถานะ (Status)',
      'ระดับความลับ (Access Scope)',
      'เลขที่คำร้อง (DAR Reference)',
      'ประเภทคำร้อง (DAR Type)',
      'ผู้ร้องขอ (Requester Name)',
      'วันเวลาที่ร้องขอ (Requester Timestamp)',
      'ผู้ทบทวน (Reviewer Name)',
      'วันเวลาที่ทบทวน (Reviewer Timestamp)',
      'ผู้อนุมัติ (Approver Name)',
      'วันเวลาที่อนุมัติ (Approver Timestamp)',
      'ผู้รับทราบ (Acknowledger Names)',
      'วันเวลาที่รับทราบ (Acknowledger Timestamp)',
      'จำนวนจุดแจกจ่ายสำเนา (Copies Count)',
      'รายการจุดแจกจ่ายสำเนา (Distribution Points)',
      'เหตุผลในการร้องขอ/แก้ไข (DAR Reason)',
      'รายละเอียดการเปลี่ยนแปลง (DAR Change Details)'
    ];

    const rows = docsToExport.map((doc, index) => {
      const docCode = (doc.document_code || doc.doc_code || doc.code || doc.docCode || doc.title || String(doc.id)).trim();
      const docTitle = doc.name || doc.docName || doc.title || 'Document';
      const docType = doc.docType || doc.doc_type || (docCode ? docCode.split('-')[0] : 'SOP');
      const dept = normalizeDeptCode(doc.department || doc.dept || doc.owner_dept) || '-';
      const rev = String(doc.rev || doc.revision || '00').padStart(2, '0');
      const effDate = doc.effectiveDate || doc.effective_date || '-';
      const status = doc.status || 'EFFECTIVE';
      const scope = doc.access_control?.scope || doc.access_scope || 'GENERAL';

      // Find matching DAR & workflow
      const workflow = resolveDocWorkflow(doc);
      const dar = workflow.dar || (dars || []).find(d => 
        String(d.id) === String(doc.darId) ||
        (d.doc_code && d.doc_code === docCode) ||
        (d.docId && String(d.docId) === String(doc.id))
      );

      // Extract workflow timestamps from timeline
      const darId = dar?.id;
      const darTimeline = darId ? (timeline || []).filter(t => t.darId === darId) : [];

      const reqTl = darTimeline.find(t => t.action === 'Created' || t.action === 'SUBMIT' || t.action === 'Resubmitted');
      const reqName = workflow.req !== '-' ? workflow.req : (dar ? getRequesterName(dar, masterUsers) : '-');
      const reqTime = formatDt(reqTl?.date || reqTl?.timestamp || dar?.createdAt || dar?.requestDate || dar?.request_date);

      const revTl = darTimeline.slice().reverse().find(t => t.action === 'Reviewed' || t.action === 'REVIEW');
      const revName = workflow.rev !== '-' ? workflow.rev : (dar ? getReviewerName(dar, timeline) : '-');
      const revTime = formatDt(revTl?.date || revTl?.timestamp || dar?.reviewedAt || dar?.reviewDate);

      const appTl = darTimeline.slice().reverse().find(t => t.action === 'Approved' || t.action === 'APPROVE');
      const appName = workflow.app !== '-' ? workflow.app : (dar ? getApproverName(dar, timeline) : '-');
      const appTime = formatDt(appTl?.date || appTl?.timestamp || dar?.approvedAt || dar?.approveDate);

      const ackTls = darTimeline.filter(t => t.action === 'Acknowledged' || t.action === 'ACKNOWLEDGE' || t.action === 'Ack');
      const ackNames = dar ? getAckNames(dar, timeline) : '-';
      const ackTime = ackTls.length > 0 ? formatDt(ackTls[ackTls.length - 1]?.date || ackTls[ackTls.length - 1]?.timestamp) : '-';

      // Physical controlled copies and distribution points
      const docDistList = (doc.distributions || []);
      const physicalCopies = (controlledCopyInstances || documentControlledCopies || []).filter(c => 
        (String(c.docId || c.doc_id) === String(doc.id) || c.doc_code === docCode || c.docTitle === doc.title) &&
        ['ISSUED_ACTIVE', 'ACTIVE'].includes(c.status)
      );
      const totalCopiesCount = Math.max(docDistList.length, physicalCopies.length);
      const distDetails = physicalCopies.length > 0 
        ? physicalCopies.map(c => `[Copy ${c.copy_no || c.ccNumber || '01'}] ${c.holder_dept || c.department} - ${c.location || c.locationName || c.station_name || 'Station'}`).join('; ')
        : (docDistList.map(d => `${d.departmentId || d.department} (${d.location || 'Station'})`).join('; ') || '-');

      const darReason = dar ? (dar.requestReason || dar.changeReason || dar.reason || '-') : '-';
      const darDetail = dar ? (dar.changeSummary || dar.description || dar.changeDetails || dar.requestDetail || '-') : '-';
      const darNo = dar ? (dar.dar_no || dar.id || '-') : '-';
      const darType = dar ? (dar.type || dar.request_type || '-') : '-';

      const escapeCell = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

      return [
        index + 1,
        escapeCell(docCode),
        escapeCell(docTitle),
        escapeCell(docType),
        escapeCell(dept),
        escapeCell(rev),
        escapeCell(effDate),
        escapeCell(status),
        escapeCell(scope),
        escapeCell(darNo),
        escapeCell(darType),
        escapeCell(reqName),
        escapeCell(reqTime),
        escapeCell(revName),
        escapeCell(revTime),
        escapeCell(appName),
        escapeCell(appTime),
        escapeCell(ackNames),
        escapeCell(ackTime),
        totalCopiesCount,
        escapeCell(distDetails),
        escapeCell(darReason),
        escapeCell(darDetail)
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `QMS_Deep_Export_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('ส่งออกข้อมูลเอกสารเชิงลึก (Deep Export CSV) เรียบร้อยแล้ว');
  };

  const handleDownloadUncontrolled = async (doc, e, openInTab = false) => {
    if (e) e.stopPropagation();
    const docCode = doc.document_code || doc.doc_code || doc.code || doc.docCode || doc.title || 'Document';
    const docType = (doc.docType || doc.doc_type || doc.type || docCode.split('-')[0] || '').toUpperCase();
    const isForm = docType === 'FM' || docType === 'FORM';

    if (isForm) {
      // ยกเว้นประเภทเอกสาร FM (แบบฟอร์ม): ห้ามประทับลายน้ำใดๆ เพื่อให้ผู้ใช้นำไปปรินต์ใช้งานได้
      const toastId = toast.loading(openInTab ? 'กำลังเตรียมเปิดแบบฟอร์ม...' : 'กำลังดาวน์โหลดแบบฟอร์ม (ไม่มีลายน้ำ)...');
      try {
        if (doc.file_url || doc.fileUrl) {
          const fileUrl = doc.file_url || doc.fileUrl;
          const link = document.createElement('a');
          link.href = fileUrl;
          link.target = openInTab ? '_blank' : '_self';
          link.download = `${docCode}_BLANK_FORM.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          await UniversalWatermarkService.downloadCleanPdf(
            doc,
            {
              userName: currentUser?.name || 'User',
              userDept: currentUser?.department || currentUser?.dept || 'User Station',
              reason: 'Blank Form Template / Direct Use',
              location: currentUser?.department || currentUser?.dept || 'User Station',
              docCode
            },
            openInTab
          );
        }

        toast.dismiss(toastId);
        toast.success(openInTab ? `เปิดแบบฟอร์ม ${docCode} เรียบร้อยแล้ว` : `ดาวน์โหลดแบบฟอร์ม ${docCode} (ไม่มีลายน้ำ) สำเร็จ`);

        if (logAction) {
          logAction({
            action: 'DOWNLOAD_BLANK_FORM_PDF',
            docId: doc.id,
            docTitle: doc.title,
            watermarkType: 'NONE_BLANK_FORM',
            user: currentUser?.name,
            dept: currentUser?.department
          });
        }
      } catch (error) {
        console.error('Download form error:', error);
        toast.dismiss(toastId);
        toast.error('เกิดข้อผิดพลาดในการดาวน์โหลดแบบฟอร์ม');
      }
      return;
    }

    // เอกสารทั่วไป (เช่น WI, SOP, MN): ส่ง Payload/Flag ระบุว่าเป็นการโหลดแบบ UNCONTROLLED COPY
    const toastId = toast.loading(openInTab ? 'กำลังสร้างไฟล์ PDF และเตรียมเปิดพรีวิว...' : 'กำลังสร้างไฟล์ PDF และประทับลายน้ำ (UNCONTROLLED COPY)...');
    try {
      const watermarkConfig = resolveWatermarkConfig(doc, { currentUser });
      const watermarkType = WATERMARK_TYPES.UNCONTROLLED_COPY;
      
      await UniversalWatermarkService.downloadWatermarkedPdf(
        doc,
        watermarkType,
        {
          userName: currentUser?.name,
          userDept: currentUser?.department || currentUser?.dept || 'User Station',
          reason: 'General Download / Print',
          location: currentUser?.department || currentUser?.dept || 'User Station',
          ...watermarkConfig.metadata,
          watermarkType: 'UNCONTROLLED_COPY',
          downloadMode: 'UNCONTROLLED_COPY',
          isUncontrolledCopy: true
        },
        openInTab
      );

      toast.dismiss(toastId);
      if (openInTab) {
        toast.success(`เปิดเอกสาร ${doc.title || docCode} ในแท็บใหม่เรียบร้อยแล้ว`);
      } else {
        toast.success(`ดาวน์โหลดเอกสาร ${doc.title || docCode} (UNCONTROLLED COPY) สำเร็จ`);
      }

      if (logAction) {
        logAction({
          action: 'DOWNLOAD_WATERMARK_PDF',
          docId: doc.id,
          docTitle: doc.title,
          watermarkType: 'UNCONTROLLED_COPY',
          downloadMode: 'UNCONTROLLED_COPY',
          user: currentUser?.name,
          dept: currentUser?.department
        });
      }
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast.dismiss(toastId);
      toast.error('เกิดข้อผิดพลาดในการสร้าง PDF');
    }
  };

  const handleDownloadCleanMaster = async (doc, e) => {
    e.stopPropagation();
    if (!isDccUser) {
      toast.error('สงวนสิทธิ์เฉพาะ DCC Admin เท่านั้น');
      return;
    }
    const docTitle = doc.title || doc.document_title || doc.document_code || doc.doc_code || 'Document';
    const toastId = toast.loading('กำลังจัดเตรียมไฟล์ต้นฉบับ (ไม่ติดลายน้ำ)...');
    try {
      if (doc.file_url || doc.fileUrl) {
        const fileUrl = doc.file_url || doc.fileUrl;
        const link = document.createElement('a');
        link.href = fileUrl;
        link.target = '_blank';
        link.download = `${doc.document_code || doc.doc_code || docTitle}_CLEAN_MASTER.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        await UniversalWatermarkService.downloadCleanPdf(
          doc,
          {
            userName: currentUser?.name || 'DCC Admin',
            userDept: currentUser?.department || 'DC',
            reason: 'Clean Master Custodian Export (ISO 9001)',
            location: 'DCC Central Archive'
          },
          false
        );
      }

      toast.dismiss(toastId);
      toast.success(`ดาวน์โหลดต้นฉบับ (ไม่ติดลายน้ำ) ${docTitle} สำเร็จ`);

      if (logAction) {
        logAction({
          action: 'DOWNLOAD_CLEAN_MASTER_PDF',
          docId: doc.id,
          docTitle,
          user: currentUser?.name,
          dept: currentUser?.department
        });
      }
    } catch (error) {
      console.error('Clean Master Download Error:', error);
      toast.dismiss(toastId);
      toast.error('เกิดข้อผิดพลาดในการดาวน์โหลดต้นฉบับ');
    }
  };

  const handleDownloadMaster = async (doc, e) => {
    e.stopPropagation();
    const toastId = toast.loading('กำลังสร้าง Master Archive PDF...');
    try {
      const watermarkType = WATERMARK_TYPES.OFFICIAL_MASTER_COPY;

      await UniversalWatermarkService.downloadWatermarkedPdf(
        doc,
        watermarkType,
        {
          userName: currentUser?.name || 'DCC Officer',
          userDept: currentUser?.department || 'DCC Central',
          reason: 'Official Master Archive',
          location: 'DCC Central Archive'
        },
        false
      );

      toast.dismiss(toastId);
      toast.success(`ดาวน์โหลด Master Copy ${doc.title} สำเร็จ`);

      if (logAction) {
        logAction({
          action: 'DOWNLOAD_MASTER_PDF',
          docId: doc.id,
          docTitle: doc.title,
          watermarkType,
          user: currentUser?.name,
          dept: currentUser?.department
        });
      }
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast.dismiss(toastId);
      toast.error('เกิดข้อผิดพลาดในการสร้าง Master PDF');
    }
  };

  const handleDownloadExternal = async (doc, e) => {
    e.stopPropagation();
    const toastId = toast.loading('กำลังสร้าง External Release PDF...');
    try {
      const watermarkType = WATERMARK_TYPES.STRICTLY_CONFIDENTIAL;

      await UniversalWatermarkService.downloadWatermarkedPdf(
        doc,
        watermarkType,
        {
          userName: currentUser?.name || 'DCC Officer',
          userDept: currentUser?.department || 'DCC Central',
          reason: 'External Audit / Vendor Release',
          location: 'External Entity'
        },
        false
      );

      toast.dismiss(toastId);
      toast.success(`ดาวน์โหลด External Release ${doc.title} สำเร็จ`);

      if (logAction) {
        logAction({
          action: 'DOWNLOAD_EXTERNAL_PDF',
          docId: doc.id,
          docTitle: doc.title,
          watermarkType,
          user: currentUser?.name,
          dept: currentUser?.department
        });
      }
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast.dismiss(toastId);
      toast.error('เกิดข้อผิดพลาดในการสร้าง External PDF');
    }
  };

  const handleOpenDetailModal = (doc, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setPreviewDoc(doc);
  };

  const handleRequestAdditionalCopy = (doc) => {
    navigate('/controlled-copies/request', {
      state: {
        targetDocCode: doc.document_code || doc.doc_code,
        targetDocTitle: doc.title || doc.document_title,
        currentRevision: doc.revision || '00',
      },
    });
  };

  const handleInitiateRevision = (doc) => {
    navigate('/dar/new', {
      state: {
        darType: 'REVISION',
        selectedDocId: doc.id,
        targetDocCode: doc.document_code || doc.doc_code,
        targetDocTitle: doc.title || doc.document_title,
        currentRevision: doc.revision || '00',
      },
    });
  };

  const handleInitiateObsolete = (doc) => {
    navigate('/dar/obsolete', {
      state: {
        selectedDocId: doc.id,
        targetDocCode: doc.document_code || doc.doc_code,
        targetDocTitle: doc.title || doc.document_title,
        currentRevision: doc.revision || '00',
      },
    });
  };

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    if (tab === TAB_MY_DEPT || tab === 'dept') {
      setMyDeptSubFilter(primaryDept);
    } else {
      setFilterStatus('EFFECTIVE');
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterType('ALL');
    setFilterDept('ALL');
    setFilterStandard('ALL');
    setFilterAccessScope('ALL');
    setFilterStatus('EFFECTIVE');
    if (activeTab === TAB_MY_DEPT || activeTab === 'dept') {
      setMyDeptSubFilter(primaryDept);
    }
  };

  const handleToggleMenu = (doc, e) => {
    e.stopPropagation();
    if (openMenuDocId === doc.id) {
      setOpenMenuDocId(null);
      setMenuAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const spaceBelow = (typeof window !== 'undefined' ? window.innerHeight : 800) - rect.bottom;
      const openUpward = spaceBelow < 340 && rect.top > 340;
      
      const menuWidth = 240;
      let left = rect.left;
      if (typeof window !== 'undefined' && left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 16;
      }
      if (left < 16) left = 16;

      const top = openUpward ? Math.max(10, rect.top - 8) : (rect.bottom + 6);

      setOpenMenuDocId(doc.id);
      setMenuAnchor({
        docId: doc.id,
        top,
        left,
        openUpward
      });
    }
  };

  const renderSecurityBadge = (doc) => {
    const scope = doc?.access_control?.scope || doc?.access_scope || 'GENERAL';
    if (scope === 'GENERAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]">
          <Globe size={13} /> ทั่วไป
        </span>
      );
    }
    if (scope === 'DEPT_ONLY') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF8E6] text-[#B87C33] border border-[#FDE6B0]">
          <Lock size={13} /> เฉพาะแผนก
        </span>
      );
    }
    if (scope === 'TARGETED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF]">
          <Building2 size={13} /> ระบุแผนก
        </span>
      );
    }
    if (scope === 'RESTRICTED') {
      const minLvl = doc?.access_control?.min_access_level;
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF2F0] text-[#F24822] border border-[#FDC4B8]">
          <ShieldAlert size={13} /> ลับเฉพาะ{minLvl ? ` (Lv.${minLvl}+)` : ''}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]">
        <Globe size={13} /> ทั่วไป
      </span>
    );
  };
  const resolveDocWorkflow = (doc) => {
    if (!doc) return { req: '-', rev: '-', app: '-', dar: null };

    const docCode = (doc.document_code || doc.doc_code || doc.code || doc.docCode || doc.title || String(doc.id)).trim().toUpperCase();

    // 1. Find associated DAR by darId or document code/id
    let dar = (dars || []).find(d => d.id === doc.darId);
    if (!dar) {
      const matchingDars = (dars || []).filter(d => {
        const darCode = (d.doc_code || d.docCode || d.title || d.docIdInput || d.targetDocCode || '').trim().toUpperCase();
        const darDocId = String(d.docId || d.doc_id || d.docIdRef || '');
        return (darCode && darCode === docCode) || (darDocId && darDocId === String(doc.id));
      });
      dar = matchingDars.find(d => d.status === 'COMPLETED') ||
            matchingDars.find(d => d.status === 'APPROVED' || d.status === 'EFFECTIVE') ||
            matchingDars[0];
    }

    // 2. Requester Resolution
    let req = doc.requesterName || doc.createdByName || doc.ownerName;
    if (!req && dar) {
      req = dar.requesterName || dar.requester_name || getRequesterName(dar, masterUsers);
    }
    if (!req || req === '-') req = '-';

    // 3. Reviewer Resolution
    let rev = doc.reviewerName;
    if (!rev && dar) {
      rev = dar.reviewerName || dar.reviewer_name || getReviewerName(dar, timeline);
    }
    if (!rev) rev = '-';

    // 4. Approver Resolution (Requirement: from finished DAR if available, never '-')
    let app = doc.approverName || doc.approvedBy || doc.approver;
    if (!app && dar) {
      app = dar.approverName || dar.approver_name || dar.approvedBy || dar.approver || getApproverName(dar, timeline);
    }
    if (!app || app === '-') {
      const completedDar = (dars || []).find(d => {
        const darCode = (d.doc_code || d.docCode || d.title || d.docIdInput || d.targetDocCode || '').trim().toUpperCase();
        const darDocId = String(d.docId || d.doc_id || d.docIdRef || '');
        return (d.status === 'COMPLETED' || d.status === 'APPROVED') && 
               ((darCode && darCode === docCode) || (darDocId && darDocId === String(doc.id)));
      });
      if (completedDar) {
        app = completedDar.approverName || completedDar.approver_name || completedDar.approvedBy || completedDar.approver || getApproverName(completedDar, timeline);
      }
    }
    if (!app) app = '-';

    return { req, rev, app, dar };
  };

  const getDistributionSummary = (doc) => {
    const distList = doc?.distributions || [];
    const rawDepts = distList.map(d => d.departmentId || d.department || d.holder_dept || d.dept).filter(Boolean);
    const normalizedDepts = rawDepts.map(normalizeDeptCode).filter(Boolean);
    const uniqueDepts = Array.from(new Set(normalizedDepts));
    const count = distList.length;
    const deptStr = uniqueDepts.join(', ') || '-';
    const tooltip = uniqueDepts.length > 0 
      ? `จุดแจกจ่าย: ${count} สำเนา (${deptStr})`
      : 'ไม่มีสำเนาแจกจ่ายภายนอก';

    return { count, uniqueDepts, deptStr, tooltip };
  };

  const renderLifecycleBadge = (primaryDoc, revisionsList, isObsoleteTab, isSupersededTab) => {
    const docCode = (primaryDoc.document_code || primaryDoc.doc_code || primaryDoc.code || primaryDoc.docCode || primaryDoc.title || String(primaryDoc.id)).trim().toUpperCase();

    // Check if any revision of this document is currently active/effective in the system
    // SKIP this check if we are explicitly inside the SUPERSEDED or OBSOLETE tab context
    const activeRev = (!isObsoleteTab && !isSupersededTab) ? (documents || []).find(d => {
      const c = (d.document_code || d.doc_code || d.code || d.docCode || d.title || String(d.id)).trim().toUpperCase();
      return c === docCode && (d.status === 'EFFECTIVE' || d.status === 'ACTIVE');
    }) : null;

    const isPrimaryActive = primaryDoc.status === 'EFFECTIVE' || primaryDoc.status === 'ACTIVE';
    const hasActiveVersion = Boolean(isPrimaryActive || activeRev);

    const isObsolete = (primaryDoc.status === 'OBSOLETE' || primaryDoc.is_obsolete || isObsoleteTab) && !hasActiveVersion;
    const isSuperseded = (primaryDoc.status === 'SUPERSEDED' || primaryDoc.status === 'SUPERSEDED_ARCHIVED' || primaryDoc.is_superseded || isSupersededTab) && !hasActiveVersion;

    if (hasActiveVersion) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9] whitespace-nowrap">
          <CheckCircle2 size={13} strokeWidth={2} />
          <span>มีผลบังคับใช้ (Active)</span>
        </span>
      );
    }

    if (isObsolete) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5] whitespace-nowrap">
          <XCircle size={13} strokeWidth={2} />
          <span>ยกเลิกถาวร</span>
        </span>
      );
    }

    if (isSuperseded) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] whitespace-nowrap">
          <Clock size={13} strokeWidth={2} />
          <span>ฉบับตกรุ่น</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1] whitespace-nowrap">
        <span>{primaryDoc.status || 'EFFECTIVE'}</span>
      </span>
    );
  };

  const renderFlatTable = () => (
    <div className="w-full max-w-full flex-1 flex flex-col min-h-0 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden h-auto">
      <div className="w-full flex-1 overflow-y-auto overflow-x-auto min-h-0 scrollbar-thin">
        <table className="w-full text-left text-sm table-auto min-w-full border-collapse">
          <thead className="bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] sticky top-0 z-20 whitespace-nowrap backdrop-blur-xs shadow-xs">
            <tr>
              <th className="w-[80px] min-w-[80px] py-3 px-3 text-center select-none bg-[#F8FAFC]">การจัดการ</th>
              <th className="w-[30%] min-w-[220px] py-3 px-3.5 select-none bg-[#F8FAFC]">รหัสและชื่อเอกสาร</th>
              <th className="w-[15%] min-w-[130px] py-3 px-3.5 select-none bg-[#F8FAFC]">แผนกและสิทธิ์</th>
              <th className="w-[15%] min-w-[130px] py-3 px-3.5 select-none bg-[#F8FAFC]">
                {filterStatus === 'SUPERSEDED' ? 'จำนวนฉบับตกรุ่น' : 'ฉบับและวันบังคับใช้'}
              </th>
              <th className="w-[20%] min-w-[160px] py-3 px-3.5 select-none bg-[#F8FAFC]">
                {filterStatus === 'SUPERSEDED' ? 'สายอนุมัติและสถานะเรียกคืน' : 'สายอนุมัติและสำเนา'}
              </th>
              <th className="w-[15%] min-w-[140px] py-3 px-3.5 select-none bg-[#F8FAFC]">สถานะเอกสาร</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {paginatedData.map((item, idx) => {
              const isGroup = Boolean(item.docs && item.latestDoc);
              const primaryDoc = isGroup ? item.latestDoc : item;
              const docCode = (primaryDoc.document_code || primaryDoc.doc_code || primaryDoc.code || primaryDoc.docCode || primaryDoc.title || String(primaryDoc.id)).trim();
              const docCodeUpper = docCode.toUpperCase();
              const docType = primaryDoc.docType || primaryDoc.doc_type || (docCode ? docCode.split('-')[0] : 'SOP');
              const docTitleName = primaryDoc.name || primaryDoc.docName || primaryDoc.title || 'Document';
              const canonicalDept = normalizeDeptCode(primaryDoc.department || primaryDoc.dept || primaryDoc.owner_dept) || '-';
              const revFormatted = String(primaryDoc.rev || primaryDoc.revision || '00').padStart(2, '0');
              const effDateDisplay = primaryDoc.effectiveDate || primaryDoc.effective_date || '-';

              // Revision list for expand panel
              const revisionsList = isGroup && item.docs ? item.docs : (documents || []).filter(d => {
                const c = (d.document_code || d.doc_code || d.code || d.docCode || d.title || String(d.id)).trim().toUpperCase();
                return c === docCodeUpper;
              }).sort((a, b) => {
                const revA = parseInt(a.rev || a.revision || '0', 10) || 0;
                const revB = parseInt(b.rev || b.revision || '0', 10) || 0;
                return revB - revA;
              });

              const activeRevisionsList = revisionsList.length > 0 ? revisionsList : [primaryDoc];
              const isExpanded = expandedGroups.has(docCodeUpper) || expandedGroups.has(docCode);
              const isObsoleteTab = filterStatus === 'OBSOLETE';
              const isSupersededTab = filterStatus === 'SUPERSEDED';

              // Cumulative superseded revisions list for metric transformation
              const supersededDocsList = (documents || []).filter(d => {
                const c = (d.document_code || d.doc_code || d.code || d.docCode || d.title || String(d.id)).trim().toUpperCase();
                if (c !== docCodeUpper) return false;
                const st = (d.status || '').toUpperCase();
                return st === 'SUPERSEDED' || st === 'SUPERSEDED_ARCHIVED' || st === 'OUTDATED' || Boolean(d.is_superseded);
              }).sort((a, b) => {
                const revA = parseInt(String(a.rev || a.revision || '0').replace(/\D/g, ''), 10) || 0;
                const revB = parseInt(String(b.rev || b.revision || '0').replace(/\D/g, ''), 10) || 0;
                return revA - revB;
              });

              const effectiveSupersededDocs = supersededDocsList.length > 0 
                ? supersededDocsList 
                : (isGroup && item.docs ? item.docs : [primaryDoc]);

              const supersededCount = effectiveSupersededDocs.length;
              const supersededRevTags = effectiveSupersededDocs.map(d => {
                const r = String(d.rev || d.revision || '00').padStart(2, '0');
                return `R${r}`;
              });

              // Workflow and Distribution
              const workflow = resolveDocWorkflow(primaryDoc);
              const distSummary = getDistributionSummary(primaryDoc);

              // Permissions & Action Dock
              const isOwner = isDccUser || isOwnerDept(primaryDoc);
              const isEffective = primaryDoc.status === 'EFFECTIVE' || primaryDoc.status === 'ACTIVE';
              const myDeptActiveCopies = (controlledCopyInstances || documentControlledCopies || []).filter(copy => 
                (String(copy.docId || copy.doc_id) === String(primaryDoc.id) || copy.doc_code === docCode || copy.docTitle === primaryDoc.title) &&
                isSameDept(userDepts, copy.holder_dept || copy.department) &&
                ['ISSUED_ACTIVE', 'ACTIVE'].includes(copy.status)
              );
              const hasActiveCopiesToReport = isDccUser || myDeptActiveCopies.length > 0;
              const isMenuOpen = openMenuDocId === primaryDoc.id;

              return (
                <React.Fragment key={primaryDoc.id || `${docCode}-${idx}`}>
                  <tr 
                    className={`hover:bg-[#F8FAFC] transition-colors duration-150 cursor-pointer group ${
                      isExpanded ? 'bg-blue-50/20 border-l-4 border-l-[#0D99FF]' : ''
                    } ${isMenuOpen ? 'relative z-10 bg-[#F8FAFC]' : ''}`}
                    onClick={() => setPreviewDoc(primaryDoc)}
                  >
                    {/* 1. เครื่องมือและการจัดการ (Actions - 80px) */}
                    <td className={`px-2.5 py-3 whitespace-nowrap text-xs text-center ${isMenuOpen ? 'relative z-50' : 'relative z-1'}`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5 dropdown-action-dock">
                        {/* ปุ่มดาวน์โหลดด่วน (Quick Download) */}
                        <button
                          type="button"
                          title={(() => {
                            const docCode = primaryDoc.document_code || primaryDoc.doc_code || primaryDoc.title || '';
                            const dt = (primaryDoc.docType || primaryDoc.doc_type || primaryDoc.type || docCode.split('-')[0] || '').toUpperCase();
                            if (dt === 'FM' || dt === 'FORM') return 'ดาวน์โหลดแบบฟอร์ม (ไม่มีลายน้ำ)';
                            if (isDccUser) return 'ดาวน์โหลด Master Document (DCC)';
                            return 'ดาวน์โหลดสำเนาไม่ควบคุม (UNCONTROLLED COPY)';
                          })()}
                          onClick={(e) => {
                            e.stopPropagation();
                            const docCode = primaryDoc.document_code || primaryDoc.doc_code || primaryDoc.title || '';
                            const dt = (primaryDoc.docType || primaryDoc.doc_type || primaryDoc.type || docCode.split('-')[0] || '').toUpperCase();
                            if (dt === 'FM' || dt === 'FORM') {
                              handleDownloadUncontrolled(primaryDoc, e, false);
                            } else if (isDccUser) {
                              handleDownloadMaster(primaryDoc, e);
                            } else {
                              handleDownloadUncontrolled(primaryDoc, e, false);
                            }
                          }}
                          className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:text-[#0D99FF] hover:border-[#0D99FF] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                        >
                          <Download size={14} />
                        </button>

                        {/* ปุ่มเปิดเมนูเพิ่มเติม (...) */}
                        <div className="relative">
                          <button
                            type="button"
                            title="เมนูการจัดการเพิ่มเติม"
                            aria-label="เมนูเพิ่มเติม"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuDocId(isMenuOpen ? null : primaryDoc.id);
                            }}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isMenuOpen
                                ? 'bg-[#0D99FF] text-white border-[#0D99FF] shadow-xs'
                                : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <MoreHorizontal size={14} />
                          </button>

                          {/* Overflow Dropdown Menu */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`overflow-dropdown-menu absolute left-0 top-full mt-1.5 w-60 bg-white border border-[#CBD5E1] rounded-xl shadow-2xl z-50 py-1.5 divide-y divide-[#F1F5F9] animate-in fade-in-50 zoom-in-95 duration-100 ${
                              isMenuOpen ? 'block' : 'hidden'
                            }`}
                          >

                            {/* กลุ่มที่ 2: ฟังก์ชัน DCC */}
                            {isDccUser && (
                              <div className="py-1">
                                <button
                                  type="button"
                                  title="ดาวน์โหลดไฟล์ต้นฉบับแท้โดยไม่มีการประทับลายน้ำ (Clean Master ISO 9001)"
                                  onClick={(e) => {
                                    setOpenMenuDocId(null);
                                    handleDownloadCleanMaster(primaryDoc, e);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs text-[#065F46] hover:bg-[#ECFDF5] flex items-center gap-2.5 transition-colors font-semibold group cursor-pointer"
                                >
                                  <ShieldCheck className="text-[#059669] shrink-0" size={14} />
                                  <span>ดาวน์โหลดต้นฉบับ (ไม่ติดลายน้ำ)</span>
                                </button>

                                <button
                                  type="button"
                                  title="ดาวน์โหลดสำหรับแจกจ่ายภายนอก (External Release)"
                                  onClick={(e) => {
                                    setOpenMenuDocId(null);
                                    handleDownloadExternal(primaryDoc, e);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs text-[#1E293B] hover:bg-[#F0FDF4] hover:text-[#059669] flex items-center gap-2.5 transition-colors font-medium group cursor-pointer"
                                >
                                  <Globe className="text-[#059669] shrink-0" size={14} />
                                  <span>ดาวน์โหลด External Release</span>
                                </button>

                                <button
                                  type="button"
                                  title="Watermark Studio (ทดสอบและดาวน์โหลดลายน้ำ 7 รูปแบบ)"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuDocId(null);
                                    setStudioDoc(primaryDoc);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs text-[#1E293B] hover:bg-[#F5F3FF] hover:text-[#7C3AED] flex items-center gap-2.5 transition-colors font-medium group cursor-pointer"
                                >
                                  <Sparkles className="text-[#7C3AED] shrink-0" size={14} />
                                  <span>Watermark Studio (ทดสอบลายน้ำ)</span>
                                </button>
                              </div>
                            )}

                            {/* กลุ่มที่ 3: การขอสำเนาควบคุม */}
                            {isOwner && isEffective && (
                              <div className="py-1">
                                <button
                                  type="button"
                                  title="ขอสำเนาควบคุมเพิ่มเติม"
                                  onClick={() => {
                                    setOpenMenuDocId(null);
                                    handleRequestAdditionalCopy(primaryDoc);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs text-[#1E293B] hover:bg-[#F0FDF4] hover:text-[#14AE5C] flex items-center gap-2.5 transition-colors font-medium group cursor-pointer"
                                >
                                  <PlusCircle className="text-[#14AE5C] shrink-0" size={14} />
                                  <span>ขอสำเนาควบคุมเพิ่มเติม</span>
                                </button>
                              </div>
                            )}

                            {/* กลุ่มที่ 4: DAR Workflow Actions */}
                            {isOwner && isEffective && (
                              <div className="py-1">
                                <button
                                  type="button"
                                  title="ยื่นคำร้องขอแก้ไขฉบับใหม่"
                                  onClick={() => {
                                    setOpenMenuDocId(null);
                                    handleInitiateRevision(primaryDoc);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs text-[#1E293B] hover:bg-[#FFFBEB] hover:text-[#D97706] flex items-center gap-2.5 transition-colors font-medium group cursor-pointer"
                                >
                                  <Edit3 className="text-[#D97706] shrink-0" size={14} />
                                  <span>ยื่นคำร้องขอแก้ไขฉบับใหม่</span>
                                </button>

                                <button
                                  type="button"
                                  title="ขอยกเลิกเอกสารฉบับนี้"
                                  onClick={() => {
                                    setOpenMenuDocId(null);
                                    handleInitiateObsolete(primaryDoc);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2.5 transition-colors font-medium group cursor-pointer"
                                >
                                  <GitFork className="text-[#DC2626] shrink-0" size={14} />
                                  <span>ขอยกเลิกเอกสารฉบับนี้</span>
                                </button>
                              </div>
                            )}

                            {hasActiveCopiesToReport && (
                              <div className="py-1">
                                <button
                                  type="button"
                                  title="แจ้งเอกสารชำรุด หรือสูญหาย เพื่อขอออกเล่มทดแทน"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuDocId(null);
                                    const targetCopy = myDeptActiveCopies[0] || (controlledCopyInstances || []).find(c => 
                                      (String(c.docId || c.doc_id) === String(primaryDoc.id) || c.doc_code === docCode) &&
                                      ['ISSUED_ACTIVE', 'ACTIVE'].includes(c.status)
                                    );
                                    if (targetCopy) {
                                      setReplacementInstance(targetCopy);
                                    } else {
                                      toast.error('ไม่พบสำเนาควบคุมที่ใช้งานอยู่สำหรับเอกสารนี้');
                                    }
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs text-[#F24822] hover:bg-[#FFF2F0] flex items-center gap-2.5 transition-colors font-medium group cursor-pointer"
                                >
                                  <AlertTriangle className="text-[#F24822] shrink-0" size={14} />
                                  <span>แจ้งชำรุด หรือสูญหาย</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. รหัสและชื่อเอกสาร (Document Identity - 30%) */}
                    <td className="py-3 px-3.5 align-middle">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-[#0D99FF] bg-[#E5F4FF] border border-[#B8E1FF] px-2.5 py-0.5 rounded-md inline-block">
                            {docCode}
                          </span>
                          <span className="bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded text-xs font-mono font-bold border border-[#E2E8F0]">
                            {docType}
                          </span>
                        </div>
                        <div 
                          className="font-medium text-[#1E293B] text-sm leading-relaxed truncate max-w-md group-hover:text-[#0D99FF] transition-colors" 
                          title={docTitleName}
                        >
                          {docTitleName}
                        </div>
                      </div>
                    </td>

                    {/* 3. แผนกและสิทธิ์การเข้าถึง (Dept & Access - 15%) */}
                    <td className="py-3 px-3.5 align-middle">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Building2 size={12} className="text-slate-500" />
                          <span>{canonicalDept}</span>
                        </span>
                        <div>
                          {renderSecurityBadge(primaryDoc)}
                        </div>
                      </div>
                    </td>

                    {/* 4. ฉบับและวันบังคับใช้ หรือ จำนวนฉบับตกรุ่น (15%) */}
                    <td className="py-3 px-3.5 align-middle">
                      {isSupersededTab ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] whitespace-nowrap shadow-2xs">
                            <Clock size={12} className="text-[#D97706] shrink-0" />
                            <span className="font-bold">{supersededCount} ฉบับตกรุ่น</span>
                            <span className="font-mono text-[11px] text-[#B45309] bg-[#FEF3C7] px-1.5 py-0.5 rounded border border-[#FDE68A]">
                              ({supersededRevTags.join(', ')})
                            </span>
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            ประวัติตกรุ่นสะสม
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="font-mono font-bold text-sm text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            Rev.{revFormatted}
                          </span>
                          <span className="font-mono text-xs text-slate-500 mt-1" title="วันที่มีผลบังคับใช้">
                            {effDateDisplay}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* 5. สายอนุมัติและสำเนา หรือ สรุปสถานะการเรียกคืน (20%) */}
                    <td className="py-3 px-3.5 align-middle">
                      <div className="flex flex-col items-start gap-1">
                        {isSupersededTab ? (
                          (() => {
                            const allSupersededRevNums = new Set(
                              effectiveSupersededDocs.map(d => parseInt(String(d.rev || d.revision || '0').replace(/\D/g, ''), 10))
                            );
                            const relatedCopies = (controlledCopyInstances || documentControlledCopies || []).filter(copy => {
                              const matchDoc = String(copy.docId || copy.doc_id) === String(primaryDoc.id) ||
                                               copy.doc_code === docCode ||
                                               copy.docTitle === primaryDoc.title;
                              const cRev = parseInt(String(copy.rev || copy.doc_version || copy.revision || '0').replace(/\D/g, ''), 10);
                              return matchDoc && allSupersededRevNums.has(cRev);
                            });

                            const pendingRecall = relatedCopies.filter(c => 
                              ['SUPERSEDED_PENDING_RECALL', 'PENDING_RECALL', 'DAMAGED_PENDING_RECALL', 'OBSOLETE_PENDING_RECALL', 'RECALLED'].includes(c.status)
                            );
                            const completedRecall = relatedCopies.filter(c => 
                              ['DESTROYED', 'RECALLED_DESTROYED', 'ARCHIVED_OBSOLETE', 'RECALLED_OBSOLETE', 'DISPOSED'].includes(c.status)
                            );

                            if (relatedCopies.length === 0) {
                              return (
                                <span 
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200"
                                  title="เอกสารฉบับนี้ไม่มีสำเนาควบคุมทางกายภาพค้างเรียกคืน"
                                >
                                  <ShieldCheck size={12} className="text-slate-400 shrink-0" />
                                  <span>ไม่มีสำเนาค้างเรียกคืน</span>
                                </span>
                              );
                            }

                            if (pendingRecall.length > 0) {
                              return (
                                <span 
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs"
                                  title={`มีสำเนาควบคุมรอเรียกคืน/ทำลาย ${pendingRecall.length} จาก ${relatedCopies.length} เล่ม`}
                                >
                                  <RotateCcw size={12} className="text-amber-500 shrink-0" />
                                  <span>รอเรียกคืน {pendingRecall.length}/{relatedCopies.length} เล่ม</span>
                                </span>
                              );
                            }

                            return (
                              <span 
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                                title={`เรียกคืนและทำลายสำเนาครบถ้วนแล้ว (${completedRecall.length} เล่ม)`}
                              >
                                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                                <span>เรียกคืน/ทำลายครบ ({completedRecall.length} เล่ม)</span>
                              </span>
                            );
                          })()
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                            title={distSummary.tooltip}
                          >
                            <Share2 size={12} className="text-blue-500 shrink-0" />
                            <span>{distSummary.count > 0 ? `${distSummary.count} จุดแจกจ่าย` : 'สำเนาดิจิทัล'}</span>
                          </span>
                        )}

                        <div 
                          className="text-xs text-slate-600 truncate max-w-[190px]"
                          title={`ผู้ขอ: ${workflow.req} | ผู้ทบทวน: ${workflow.rev} | ผู้อนุมัติ: ${workflow.app}`}
                        >
                          <span className="text-slate-500">ผู้ขอ:</span> <span className="font-medium text-slate-700">{workflow.req}</span> · <span className="text-slate-500">อนุมัติ:</span> <span className="font-medium text-slate-700">{workflow.app}</span>
                        </div>
                      </div>
                    </td>

                    {/* 6. สถานะเอกสาร (Master Lifecycle Status - 15%) */}
                    <td className="py-3 px-3.5 align-middle">
                      <div className="flex flex-col items-start gap-1.5">
                        {renderLifecycleBadge(primaryDoc, activeRevisionsList, isObsoleteTab, isSupersededTab)}
                      </div>
                    </td>
                  </tr>

                  {/* Accordion Inset Panel for Sub-table */}
                  {isExpanded && (
                    <tr className="bg-[#F8FAFC]/80 border-b border-[#E2E8F0]">
                      <td colSpan={6} className="p-3 pl-8 pr-4">
                        <div className="max-w-5xl bg-white rounded-xl border border-[#CBD5E1] border-l-4 border-l-[#0D99FF] shadow-xs overflow-hidden">
                          {/* Inset Sub-table Header */}
                          <div className="px-4 py-2.5 bg-[#F1F5F9] border-b border-[#E2E8F0] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Layers size={14} className="text-[#0D99FF]" />
                              <span className="text-xs font-bold text-[#1E293B]">
                                ประวัติฉบับย่อยของ {docCode} ({activeRevisionsList.length} ฉบับ)
                              </span>
                            </div>
                            <span className="text-[11px] text-[#64748B] font-mono bg-white px-2 py-0.5 rounded border border-[#CBD5E1]">
                              {activeRevisionsList.length > 1 
                                ? `Rev.${String(activeRevisionsList[activeRevisionsList.length - 1]?.rev || '00').padStart(2, '0')} - Rev.${String(activeRevisionsList[0]?.rev || '00').padStart(2, '0')}` 
                                : `Rev.${revFormatted}`}
                            </span>
                          </div>

                          {/* Compact High-Density Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-[#F8FAFC] text-[#475569] font-semibold border-b border-[#E2E8F0]">
                                  <th className="py-2.5 px-3.5 w-24">Revision</th>
                                  <th className="py-2.5 px-3.5 w-48 font-mono">ช่วงเวลาบังคับใช้ (เริ่ม - สิ้นสุด)</th>
                                  <th className="py-2.5 px-3.5 min-w-[220px]">เหตุผลการปรับปรุง</th>
                                  <th className="py-2.5 px-3.5 w-28 text-center">สถานะฉบับย่อย</th>
                                  <th className="py-2.5 px-3.5 w-36 text-center">การจัดการ / ดาวน์โหลด</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#F1F5F9]">
                                {activeRevisionsList.map((subDoc) => {
                                  const subDar = (dars || []).find(d => d.id === subDoc.darId) ||
                                    (dars || []).find(d => String(d.docId || d.doc_id) === String(subDoc.id) || (d.title || d.doc_code) === (subDoc.title || subDoc.doc_code));
                                  const subRevNum = String(subDoc.rev || subDoc.revision || '00').padStart(2, '0');
                                  const effDate = subDoc.effectiveDate || subDoc.effective_date || '-';
                                  const endDate = subDoc.superseded_at 
                                    ? subDoc.superseded_at.split('T')[0]
                                    : (subDoc.obsoleted_at 
                                        ? subDoc.obsoleted_at.split('T')[0] 
                                        : (subDoc.outdatedDate || '-'));
                                  const dateRange = (effDate !== '-' || endDate !== '-') ? `${effDate} ~ ${endDate}` : '-';
                                  const revNote = subDoc.revisionNote || subDoc.revision_note || subDoc.changeDetail || subDar?.changeDetails || subDar?.reason || subDoc.reason || 'จัดทำเอกสารฉบับเริ่มต้น (Genesis)';
                                  const isSubActive = subDoc.status === 'EFFECTIVE' || subDoc.status === 'ACTIVE';
                                  const isSubObsolete = subDoc.status === 'OBSOLETE' || subDoc.is_obsolete;

                                  return (
                                    <tr 
                                      key={subDoc.id || `${docCode}-${subRevNum}`} 
                                      className="hover:bg-[#F0F7FF]/60 transition-colors cursor-pointer"
                                      onClick={() => setPreviewDoc(subDoc)}
                                    >
                                      <td className="py-2.5 px-3.5 font-mono font-bold text-[#1E293B]">
                                        <span className="bg-[#F1F5F9] text-[#334155] px-2 py-0.5 rounded border border-[#CBD5E1]">
                                          Rev.{subRevNum}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3.5 font-mono text-[#64748B] whitespace-nowrap">
                                        {dateRange}
                                      </td>
                                      <td className="py-2.5 px-3.5 text-[#334155] leading-relaxed">
                                        <span className="line-clamp-2" title={revNote}>{revNote}</span>
                                      </td>
                                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                                        {isSubActive ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]">
                                            บังคับใช้
                                          </span>
                                        ) : isSubObsolete ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]">
                                            ยกเลิก
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                                            ตกรุ่น
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            type="button"
                                            title="เปิดดูในแท็บใหม่ (Full Viewer)"
                                            onClick={(e) => handleDownloadUncontrolled(subDoc, e, true)}
                                            className="p-1.5 rounded border border-[#CBD5E1] bg-white text-[#475569] hover:text-[#0D99FF] hover:border-[#0D99FF] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                                          >
                                            <ExternalLink size={13} />
                                          </button>
                                          <button
                                            type="button"
                                            title={(() => {
                                              const subCode = subDoc.document_code || subDoc.doc_code || subDoc.title || '';
                                              const dt = (subDoc.docType || subDoc.doc_type || subDoc.type || subCode.split('-')[0] || '').toUpperCase();
                                              if (dt === 'FM' || dt === 'FORM') return 'ดาวน์โหลดแบบฟอร์ม (ไม่มีลายน้ำ)';
                                              if (isDccUser) return 'ดาวน์โหลด Master PDF';
                                              return 'ดาวน์โหลดสำเนาไม่ควบคุม (UNCONTROLLED COPY)';
                                            })()}
                                            onClick={(e) => {
                                              const subCode = subDoc.document_code || subDoc.doc_code || subDoc.title || '';
                                              const dt = (subDoc.docType || subDoc.doc_type || subDoc.type || subCode.split('-')[0] || '').toUpperCase();
                                              if (dt === 'FM' || dt === 'FORM') {
                                                handleDownloadUncontrolled(subDoc, e, false);
                                              } else if (isDccUser) {
                                                handleDownloadMaster(subDoc, e);
                                              } else {
                                                handleDownloadUncontrolled(subDoc, e, false);
                                              }
                                            }}
                                            className="p-1.5 rounded border border-[#CBD5E1] bg-white text-[#475569] hover:text-[#0D99FF] hover:border-[#0D99FF] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                                          >
                                            <Download size={13} />
                                          </button>
                                          {isDccUser && (
                                            <button
                                              type="button"
                                              title="ดาวน์โหลดต้นฉบับ Clean Master"
                                              onClick={(e) => handleDownloadCleanMaster(subDoc, e)}
                                              className="p-1.5 rounded border border-[#B3E7C9] bg-[#E6F7ED] text-[#14AE5C] hover:bg-[#C9F0D9] transition-colors cursor-pointer"
                                            >
                                              <ShieldCheck size={13} />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-14 text-center text-[#888888]">
                  <BookOpen size={36} className="mx-auto mb-2 text-[#CCCCCC]" strokeWidth={1.5} />
                  <p className="font-medium text-xs text-[#888888]">ไม่พบเอกสารในหมวดหมู่นี้</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );

  return (
    <div className="w-full h-full flex-1 flex flex-col min-h-0 space-y-3 pb-4">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-2xs shrink-0">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-[#E5F4FF] text-[#0D99FF] shrink-0">
            <BookOpen className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1E1E1E] tracking-tight">
              คลังเอกสารแม่บท (Document Library)
            </h1>
            <p className="text-xs text-[#666666] mt-0.5">
              ศูนย์รวมเอกสารคุณภาพ เอกสารทั่วไป เอกสารภายในแผนก และเอกสารที่ได้รับการแจกจ่ายตามมาตรฐาน ISO 9001
            </p>
          </div>
        </div>
      </div>

      {/* 3-Tier Segmented Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl w-fit overflow-x-auto shadow-2xs shrink-0">
        {/* Tab 1: เอกสารทั่วไป */}
        <button
          type="button"
          onClick={() => handleSelectTab(TAB_GENERAL)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === TAB_GENERAL || activeTab === 'general'
              ? 'bg-white text-[#0D99FF] border border-[#B8E1FF] shadow-2xs'
              : 'text-[#555555] hover:text-[#1E1E1E] hover:bg-[#F0F0F0] border border-transparent'
          }`}
        >
          <Globe size={16} strokeWidth={activeTab === TAB_GENERAL || activeTab === 'general' ? 2 : 1.75} />
          <span>เอกสารทั่วไป</span>
          <span className="px-2 py-0.5 rounded bg-[#EEEEEE] text-xs font-mono font-bold text-[#1E1E1E]">
            {generalDocsCount}
          </span>
        </button>

        {/* Tab 2: เอกสารในแผนกฉัน */}
        <button
          type="button"
          onClick={() => handleSelectTab(TAB_MY_DEPT)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === TAB_MY_DEPT || activeTab === 'dept'
              ? 'bg-white text-[#0D99FF] border border-[#B8E1FF] shadow-2xs'
              : 'text-[#555555] hover:text-[#1E1E1E] hover:bg-[#F0F0F0] border border-transparent'
          }`}
        >
          <Building2 size={16} strokeWidth={activeTab === TAB_MY_DEPT || activeTab === 'dept' ? 2 : 1.75} />
          <span>เอกสารในแผนกฉัน</span>
          <span className="px-2 py-0.5 rounded bg-[#EEEEEE] text-xs font-mono font-bold text-[#1E1E1E]">
            {myDeptDocsCount}
          </span>
        </button>

        {/* Tab 3: เอกสารที่ได้รับการแจกจ่าย */}
        <button
          type="button"
          onClick={() => handleSelectTab(TAB_DISTRIBUTED)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === TAB_DISTRIBUTED || activeTab === 'dist'
              ? 'bg-white text-[#0D99FF] border border-[#B8E1FF] shadow-2xs'
              : 'text-[#555555] hover:text-[#1E1E1E] hover:bg-[#F0F0F0] border border-transparent'
          }`}
        >
          <Share2 size={16} strokeWidth={activeTab === TAB_DISTRIBUTED || activeTab === 'dist' ? 2 : 1.75} />
          <span>เอกสารที่ได้รับการแจกจ่าย</span>
          <span className="px-2 py-0.5 rounded bg-[#EEEEEE] text-xs font-mono font-bold text-[#1E1E1E]">
            {distributedDocsCount}
          </span>
        </button>
      </div>

      {/* Control Toolbar: 2-Row Clean Enterprise Layout */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-2xs space-y-3.5 shrink-0">
        
        {/* แถวที่ 1: ค้นหา + 4 Dropdowns + ปุ่มส่งออก (เรียงแถวเดียวสมบูรณ์) */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          
          {/* ช่องค้นหาเอกสาร (ขยายตามพื้นที่ว่างที่เหลือ) */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="ค้นหาตามรหัสเอกสาร หรือ ชื่อเอกสาร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 text-sm placeholder:text-[#999999] pl-9 pr-10 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#1E293B] focus:bg-white focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Dropdown 0: แผนก (Department Filter พร้อมตัวเลือก ทุกแผนก All) */}
          <div className="w-full lg:w-48 shrink-0">
            <select
              value={filterDept || 'ALL'}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#1E293B] focus:bg-white focus:outline-none focus:border-[#0D99FF] cursor-pointer"
            >
              <option value="ALL">ทุกแผนก (All)</option>
              {availableDepts.map(d => (
                <option key={d.id} value={d.id}>{d.name || d.id}</option>
              ))}
            </select>
          </div>

          {/* Dropdown 1: ประเภทเอกสาร */}
          <div className="w-full lg:w-40 shrink-0">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#1E293B] focus:bg-white focus:outline-none focus:border-[#0D99FF] cursor-pointer"
            >
              <option value="ALL">ทุกประเภท (Types)</option>
              {availableTypes.map(t => {
                const matchedType = (documentTypes || []).find(dt => (dt.code || dt.id) === t);
                const label = matchedType ? `${matchedType.nameTh || matchedType.name} (${t})` : t;
                return <option key={t} value={t}>{label}</option>;
              })}
            </select>
          </div>

          {/* Dropdown 2: มาตรฐานที่เกี่ยวข้อง */}
          <div className="w-full lg:w-36 shrink-0">
            <select
              value={filterStandard || 'ALL'}
              onChange={(e) => setFilterStandard(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#1E293B] focus:bg-white focus:outline-none focus:border-[#0D99FF] cursor-pointer"
            >
              <option value="ALL">ทุกมาตรฐาน</option>
              {availableStandards.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Dropdown 3: ระดับความลับ */}
          <div className="w-full lg:w-36 shrink-0">
            <select
              value={filterAccessScope || 'ALL'}
              onChange={(e) => setFilterAccessScope(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#1E293B] focus:bg-white focus:outline-none focus:border-[#0D99FF] cursor-pointer"
            >
              <option value="ALL">ทุกระดับความลับ</option>
              <option value="GENERAL">ทั่วไป (General)</option>
              <option value="DEPT_ONLY">เฉพาะแผนก (Dept Only)</option>
              <option value="TARGETED">ระบุแผนก (Targeted)</option>
              <option value="RESTRICTED">ลับเฉพาะ (Restricted)</option>
            </select>
          </div>

          {/* ปุ่มส่งออกเอกสารแผนก */}
          {(activeTab === TAB_MY_DEPT || activeTab === 'dept' || isDccUser) && (
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleExport}
                className="w-full lg:w-auto h-10 px-4 inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold bg-white border border-[#CBD5E1] text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#94A3B8] rounded-xl shadow-2xs transition-all whitespace-nowrap cursor-pointer"
              >
                <Download className="text-[#0D99FF] shrink-0" size={15} />
                <span>{isDccUser ? 'ส่งออกเอกสารแม่บท' : 'ส่งออกเอกสารแผนก'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick-Pills สำหรับผู้ใช้ Multi-Department / Executive ในแท็บ 'เอกสารในแผนกฉัน' */}
        {(activeTab === TAB_MY_DEPT || activeTab === 'dept') && userDistinctDepts.length > 1 && (
          <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-[#F1F5F9]">
            <span className="text-xs font-semibold text-[#64748B] flex items-center gap-1.5 mr-1">
              <Building2 size={14} className="text-[#0D99FF]" />
              <span>สายงาน / แผนก:</span>
            </span>

            {/* ปุ่ม: ทั้งหมดในสายงาน (จำนวนรวม) */}
            <button
              type="button"
              onClick={() => setMyDeptSubFilter('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                myDeptSubFilter === 'ALL'
                  ? 'bg-[#0D99FF] text-white shadow-xs font-semibold'
                  : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
              }`}
            >
              <span>ทั้งหมดในสายงาน</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                myDeptSubFilter === 'ALL' ? 'bg-white/25 text-white' : 'bg-[#CBD5E1] text-[#1E293B]'
              }`}>
                {myDeptDocsCount}
              </span>
            </button>

            {/* ปุ่มแยกรายแผนก */}
            {userDistinctDepts.map((dept) => {
              const isPrimary = deptMatches(dept, primaryDept);
              const count = deptCounts[dept] || 0;
              const isSelected = myDeptSubFilter === dept;

              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setMyDeptSubFilter(dept)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#0D99FF] text-white shadow-xs font-semibold'
                      : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                  }`}
                >
                  <span>{isPrimary ? `⭐️ [${dept}]` : `[${dept}]`}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-[#CBD5E1] text-[#1E293B]'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* แถวที่ 2: Universal Status Tabs (เฉพาะในเมนู "เอกสารในแผนกฉัน" เท่านั้น) */}
        {(activeTab === TAB_MY_DEPT || activeTab === 'dept') ? (
          <div className="pt-2 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-[#F1F5F9] p-1 rounded-xl">
              {[
                { id: 'EFFECTIVE', label: '✓ มีผลบังคับใช้ (Active)' },
                { id: 'SUPERSEDED', label: '⏳ ฉบับเดิมตกรุ่น (Superseded)' },
                { id: 'OBSOLETE', label: '🚫 ยกเลิกการใช้งาน (Obsolete)' },
                { id: 'ALL', label: 'ทั้งหมด (All Records)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id === 'ALL' ? '' : tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    (filterStatus === tab.id) || (tab.id === 'ALL' && filterStatus === '')
                      ? 'bg-white text-[#1E293B] shadow-xs font-bold'
                      : 'text-[#64748B] hover:text-[#1E293B]'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs text-[#64748B]">
              {(filterType !== 'ALL' && filterType !== '') || (filterDept !== 'ALL' && filterDept !== '') || (filterStandard !== 'ALL' && filterStandard !== '') || searchTerm || filterAccessScope !== '' || (filterStatus !== 'EFFECTIVE' && filterStatus !== '') || ((activeTab === TAB_MY_DEPT || activeTab === 'dept') && userDistinctDepts.length > 1 && myDeptSubFilter !== primaryDept) ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[#EF4444] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>ล้างตัวกรองทั้งหมด</span>
                </button>
              ) : null}
              <span className="font-mono">
                แสดงผล <strong className="text-[#1E293B] font-bold">{isGroupedView ? `${groupedDocs.length} รหัสเอกสาร (${filteredDocs.length} ฉบับ)` : `${filteredDocs.length} รายการ`}</strong> จากทั้งหมด {tabFilteredDocs.length} รายการ
              </span>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between gap-3 text-xs text-[#64748B]">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]">
                <CheckCircle2 size={13} />
                <span>เฉพาะเอกสารที่มีผลบังคับใช้ (Active Documents Only)</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              {(filterType !== 'ALL' && filterType !== '') || (filterDept !== 'ALL' && filterDept !== '') || (filterStandard !== 'ALL' && filterStandard !== '') || searchTerm || (filterAccessScope !== '' && filterAccessScope !== 'ALL') ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[#EF4444] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>ล้างตัวกรองทั้งหมด</span>
                </button>
              ) : null}
              <span className="font-mono">
                แสดงผล <strong className="text-[#1E293B] font-bold">{filteredDocs.length} รายการ</strong> จากทั้งหมด {tabFilteredDocs.length} รายการ
              </span>
            </div>
          </div>
        )}
      </div>

      {renderFlatTable()}

      {/* Document Detail Modal */}
      {previewDoc && (
        <DocumentDetailModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          document={previewDoc}
          filterStatus={filterStatus}
          activeTab={activeTab}
          onOpenViewer={(d) => navigate(`/viewer/${d.id}/${d.rev || d.revision || '01'}`)}
        />
      )}

      {/* Watermark Studio Modal */}
      {studioDoc && (
        <WatermarkStudioModal
          isOpen={!!studioDoc}
          onClose={() => setStudioDoc(null)}
          document={studioDoc}
        />
      )}

      {/* Replacement Modal */}
      {replacementInstance && (
        <ReplacementModal
          isOpen={!!replacementInstance}
          onClose={(success, type, reason) => {
            if (success && type && reason) {
              reportCcDamagedLost(replacementInstance.id, type, reason);
              toast.success('ยื่นคำร้องขอสำเนาทดแทนเรียบร้อยแล้ว กรุณารอเจ้าหน้าที่ DCC จัดพิมพ์และส่งมอบ');
            }
            setReplacementInstance(null);
          }}
          instance={replacementInstance}
        />
      )}

      {/* Ad-Hoc Additional Copies Modal */}
      {adHocDoc && (
        <RequestAdditionalCopiesModal
          isOpen={!!adHocDoc}
          onClose={() => setAdHocDoc(null)}
          document={adHocDoc}
        />
      )}
    </div>
  );
};

export default Library;
