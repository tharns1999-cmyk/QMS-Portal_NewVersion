import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import useStore from '../../store/useStore';
import { 
  FileText, 
  Search, 
  Plus, 
  Download, 
  Eye, 
  History, 
  Archive, 
  Globe, 
  Share2,
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  FilterX, 
  RotateCw,
  Building2,
  Lock,
  Layers,
  AlertCircle,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  X,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ExternalDocFormModal from './ExternalDocFormModal';
import ExternalDocPreviewModal from './ExternalDocPreviewModal';
import ExternalDocDetailModal from './ExternalDocDetailModal';
import ExternalDocHistoryModal from './ExternalDocHistoryModal';
import ExternalDocObsoleteModal from './ExternalDocObsoleteModal';
import RequestAdditionalCopiesModal from '../../components/workflow/RequestAdditionalCopiesModal';
import UniversalWatermarkService, { WATERMARK_TYPES } from '../../services/UniversalWatermarkService';
import toast from 'react-hot-toast';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Main Category Tab Constants (Level 1)
const TAB_GENERAL = 'GENERAL';
const TAB_MY_DEPT = 'MY_DEPT';
const TAB_DISTRIBUTED = 'DISTRIBUTED';

// Official Lifecycle Statuses for Master External Document Library (ISO 9001:2015 Clause 7.5.3.2)
export const OFFICIAL_LIFECYCLE_STATUSES = [
  'ACTIVE',
  'EFFECTIVE',
  'SUPERSEDED',
  'SUPERSEDED_ARCHIVED',
  'OBSOLETE',
  'OBSOLETE_ARCHIVED'
];

export const isOfficialLifecycleDoc = (doc) => {
  if (!doc) return false;
  const status = String(doc.status || '').toUpperCase();
  if (
    status.includes('REJECT') ||
    status.startsWith('PENDING') ||
    status.includes('REVISE') ||
    status === 'DRAFT'
  ) {
    return false;
  }
  if (doc.is_obsolete || doc.is_superseded) return true;
  return OFFICIAL_LIFECYCLE_STATUSES.includes(status);
};

const ExternalDocsList = () => {
  const navigate = useNavigate();
  const { 
    externalDocuments, 
    externalRequests,
    currentUser, 
    tasks,
    logExternalDownload, 
    masterDepartments, 
    departments: storeDepts,
    controlledCopyInstances,
    documentControlledCopies
  } = useStore();
  
  // Level 1: Main Category Tabs (GENERAL, MY_DEPT, DISTRIBUTED)
  const [activeMainTab, setActiveMainTab] = useState(TAB_MY_DEPT);
  
  const [searchTerm, setSearchTerm] = useState('');
  // Level 2: 4 Status Filter Pills: ACTIVE, SUPERSEDED, OBSOLETE, ALL (default: ACTIVE)
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState('ALL');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [docToEdit, setDocToEdit] = useState(null);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [docToPreview, setDocToPreview] = useState(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [docToDetail, setDocToDetail] = useState(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [docToHistory, setDocToHistory] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryDocCode, setSelectedHistoryDocCode] = useState(null);
  
  const [isObsoleteModalOpen, setIsObsoleteModalOpen] = useState(false);
  const [docToObsolete, setDocToObsolete] = useState(null);

  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [selectedDocForCopy, setSelectedDocForCopy] = useState(null);

  // Header Document Selector Modal (for Update Revision or Obsolete when triggered from Header)
  const [selectModalMode, setSelectModalMode] = useState(null); // 'UPDATE' | 'OBSOLETE' | null
  const [selectorSearch, setSelectorSearch] = useState('');

  // Row-level 3-dot action menu
  const [openMenuDocId, setOpenMenuDocId] = useState(null);

  // Deep-linking from notifications or external triggers
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const deepLinkDocCode = searchParams.get('docCode') || searchParams.get('code') || location.state?.openDocCode;
  const deepLinkDocId = searchParams.get('docId') || searchParams.get('id') || location.state?.openDocId;

  useEffect(() => {
    if ((deepLinkDocCode || deepLinkDocId) && (externalDocuments || []).length > 0) {
      const found = externalDocuments.find(d => 
        (deepLinkDocId && String(d.id) === String(deepLinkDocId)) ||
        (deepLinkDocCode && (d.doc_code === deepLinkDocCode || d.document_code === deepLinkDocCode || d.code === deepLinkDocCode || d.docCode === deepLinkDocCode))
      );
      if (found) {
        setDocToDetail(found);
        setIsDetailOpen(true);
      }
    }
  }, [deepLinkDocCode, deepLinkDocId, externalDocuments]);

  const isDccAdmin = Boolean(
    currentUser?.role === 'DCC' || 
    currentUser?.role === 'DCC_ADMIN' || 
    currentUser?.isDccAdmin || 
    currentUser?.isDcc || 
    currentUser?.role === 'ADMIN' ||
    currentUser?.id === 'U001'
  );
  const isAdmin = isDccAdmin;
  const uDept = currentUser?.department || currentUser?.dept || 'QA';

  const availableDepts = useMemo(() => {
    return (masterDepartments || storeDepts || []).filter(d => typeof d === 'string' || d.status !== 'INACTIVE');
  }, [masterDepartments, storeDepts]);

  const myReviseCount = useMemo(() => {
    const reviseDocIds = new Set();
    (tasks || []).forEach(t => {
      if (
        (t.type === 'EXTERNAL_REVISE' || t.taskType === 'EXTERNAL_REVISE') &&
        (t.assigneeId === currentUser?.id || t.requesterId === currentUser?.id) &&
        t.status === 'PENDING'
      ) {
        reviseDocIds.add(t.referenceId || t.docId || t.id);
      }
    });
    (externalRequests || []).forEach(r => {
      if (r.requesterId === currentUser?.id && r.status === 'REVISE_REQUESTED') {
        reviseDocIds.add(r.docId || r.externalDocId || r.requestId || r.id);
      }
    });
    return reviseDocIds.size;
  }, [tasks, externalRequests, currentUser]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.ed-action-dock') && !e.target.closest('.ed-dropdown-menu')) {
        setOpenMenuDocId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpenMenuDocId(null);
        setSelectModalMode(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Helper: Calculate Validity Status
  const getValidityInfo = (doc) => {
    if (doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED' || doc.is_obsolete) {
      return { status: 'OBSOLETE', label: 'ยกเลิกแล้ว', colorClass: 'badge-inactive' };
    }
    if (doc.status === 'SUPERSEDED' || doc.status === 'SUPERSEDED_ARCHIVED' || doc.is_superseded) {
      return { status: 'SUPERSEDED', label: 'ตกรุ่น', colorClass: 'badge-pending' };
    }
    
    if (!doc.nextReviewDate && !doc.effectiveDate) {
      return { status: 'NORMAL', label: 'ปกติ', colorClass: 'badge-active' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let reviewDateObj;
    if (doc.nextReviewDate) {
      reviewDateObj = new Date(doc.nextReviewDate);
    } else {
      reviewDateObj = new Date(doc.effectiveDate);
      reviewDateObj.setMonth(reviewDateObj.getMonth() + (Number(doc.reviewCycleMonths) || 12));
    }
    reviewDateObj.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((reviewDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { 
        status: 'OVERDUE', 
        label: `เกินกำหนด (${Math.abs(diffDays)} วัน)`, 
        colorClass: 'badge-rejected',
        diffDays,
        formattedDate: reviewDateObj.toISOString().split('T')[0]
      };
    } else if (diffDays <= 30) {
      return { 
        status: 'DUE_SOON', 
        label: `ใกล้ครบกำหนด (${diffDays} วัน)`, 
        colorClass: 'badge-pending',
        diffDays,
        formattedDate: reviewDateObj.toISOString().split('T')[0]
      };
    }

    return { 
      status: 'NORMAL', 
      label: 'ปกติ', 
      colorClass: 'badge-active',
      diffDays,
      formattedDate: reviewDateObj.toISOString().split('T')[0]
    };
  };

  // Department normalization & matching helpers
  const normalizeDept = (d) => {
    if (!d) return '';
    const val = typeof d === 'object' ? (d.id || d.code || d.dept || d.department) : d;
    return typeof val === 'string' ? val.trim().toUpperCase() : '';
  };

  const getUserDepartments = (user) => {
    if (!user) return [];
    const depts = [];
    if (user.department) depts.push(user.department);
    if (user.primary_department) depts.push(user.primary_department);
    if (user.dept) depts.push(user.dept);
    if (user.dept_code) depts.push(user.dept_code);
    if (Array.isArray(user.departments)) depts.push(...user.departments);
    if (Array.isArray(user.secondaryDepartments)) depts.push(...user.secondaryDepartments);
    if (Array.isArray(user.depts)) depts.push(...user.depts);
    if (Array.isArray(user.affiliated_departments)) depts.push(...user.affiliated_departments);
    return [...new Set(depts.filter(Boolean))];
  };

  const userDepts = useMemo(() => getUserDepartments(currentUser), [currentUser]);
  const userDept = userDepts[0] || normalizeDept(currentUser?.department) || 'QA';

  const deptMatches = (d1, d2) => {
    const s1 = normalizeDept(d1);
    const s2 = normalizeDept(d2);
    if (!s1 || !s2) return false;
    if (s1 === s2) return true;
    if ((s1 === 'QA' || s1 === 'QA/QC' || s1 === 'QAQC') && (s2 === 'QA' || s2 === 'QA/QC' || s2 === 'QAQC')) return true;
    return false;
  };

  const getDocCode = (doc) => {
    if (!doc) return '';
    return (
      doc.documentCode ||
      doc.edCode ||
      doc.doc_code ||
      doc.docCode ||
      doc.docNo ||
      doc.id ||
      ''
    );
  };

  const isOwnerDept = (doc) => {
    if (!doc) return false;
    const docDept = doc.department || doc.dept || doc.owner_dept;
    return userDepts.includes(docDept) || userDepts.some(ud => deptMatches(ud, docDept));
  };

  const canManageDoc = (doc) => {
    if (!doc) return false;
    const isOwner = isOwnerDept(doc);
    const isActive = doc.status === 'ACTIVE' || doc.status === 'EFFECTIVE';
    return (isOwner || isDccAdmin) && isActive;
  };

  const isGeneralDoc = (doc) => {
    const scope = (
      doc.accessScope ||
      doc.access_scope ||
      doc.distributionScope ||
      doc.distribution_scope ||
      doc.scope ||
      ''
    ).toString().trim().toUpperCase();

    return (
      scope === 'GENERAL' ||
      scope === 'ALL' ||
      doc.accessScope === 'ทั่วไป' ||
      doc.distributionScope === 'ทั่วไป'
    );
  };

  const hasDistributedCopyToUserDept = (doc) => {
    if (isOwnerDept(doc)) return false; // Strict: exclude own department
    
    // 1. Array of distributed dept codes / allowedDepartments
    const allowedDepts = doc.allowedDepartments || doc.allowed_departments || doc.distributed_depts || [];
    const inDistDepts = (allowedDepts || []).some(d => userDepts.some(ud => deptMatches(d, ud)));

    // 2. Array of distribution objects
    const inDistObjs = (doc.distributions || []).some(d => userDepts.some(ud => deptMatches(d.departmentId || d.department || d.dept, ud)));

    // 3. Access departments
    const inAccessDepts = (doc.accessDepartments || []).some(d => userDepts.some(ud => deptMatches(d, ud)));

    // 4. Restricted user check (currentUser.id in allowedUsers or accessUsers)
    const allowedUsersList = doc.allowedUsers || doc.allowed_users || doc.accessUsers || [];
    const isUserAllowed = Boolean(currentUser?.id && allowedUsersList.includes(currentUser.id));

    // 5. Physical controlled copies in store
    const hasControlledCopy = (controlledCopyInstances || documentControlledCopies || []).some(c => {
      const matchDoc = String(c.externalDocId || c.external_doc_id || c.docId || c.doc_id) === String(doc.id) ||
                       c.doc_code === doc.edCode ||
                       c.doc_code === doc.id ||
                       c.docTitle === doc.title;
      return matchDoc && userDepts.some(ud => deptMatches(c.holder_dept || c.department, ud)) && ['ISSUED_ACTIVE', 'ACTIVE'].includes(c.status);
    });

    return Boolean(inDistDepts || inDistObjs || inAccessDepts || isUserAllowed || hasControlledCopy);
  };

  // Master Document Source (Official Lifecycle Records: ACTIVE, SUPERSEDED, OBSOLETE)
  const allExternalDocs = useMemo(() => {
    return (externalDocuments || []).filter(doc => isOfficialLifecycleDoc(doc));
  }, [externalDocuments]);

  // Accessibility & Confidentiality Filter for General User Access Check
  const accessibleDocs = useMemo(() => {
    return allExternalDocs.filter(doc => {
      if (isAdmin || isDccAdmin) return true;

      const isOwner = Boolean(currentUser?.id && doc?.ownerId === currentUser.id);
      const isReviewer = Boolean(currentUser?.id && doc?.reviewerId === currentUser.id);
      const isApprover = Boolean(currentUser?.id && doc?.approverId === currentUser.id);
      const isAck = Boolean(currentUser?.id && Array.isArray(doc?.acknowledgees) && doc.acknowledgees.includes(currentUser.id));
      const isInvolved = isOwner || isReviewer || isApprover || isAck;

      const scope = (doc?.accessScope || doc?.access_scope || doc?.distributionScope || doc?.distribution_scope || doc?.scope || '').toString().trim().toUpperCase();
      if (scope === 'GENERAL' || scope === 'ALL' || doc?.accessScope === 'ทั่วไป' || !doc?.accessScope) return true;

      if (scope === 'DEPARTMENT' || doc?.accessScope === 'Department') {
        const allowedDepts = doc?.allowedDepartments || doc?.allowed_departments || doc?.accessDepartments || [];
        const inAllowedDept = (allowedDepts || []).some(d => userDepts.some(ud => deptMatches(d, ud)));
        return isInvolved || inAllowedDept || isOwnerDept(doc);
      }
      if (scope === 'RESTRICTED' || doc?.accessScope === 'Restricted') {
        const allowedUsers = Array.isArray(doc?.allowedUsers) ? doc.allowedUsers : (Array.isArray(doc?.allowed_users) ? doc.allowed_users : (Array.isArray(doc?.accessUsers) ? doc.accessUsers : []));
        return isInvolved || Boolean(currentUser?.id && allowedUsers.includes(currentUser.id));
      }
      return false;
    });
  }, [allExternalDocs, isAdmin, isDccAdmin, currentUser, userDepts]);

  // ─────────────────────────────────────────────────────────────
  // Master Document Status Resolution (ISO 9001 Clause 7.5.3.2)
  // Maps every unique documentCode to its document-level Master Status:
  // - OBSOLETE: if latest revision is OBSOLETE, or if document code is obsoleted
  // - ACTIVE: if it has an active/effective revision (and not obsolete)
  // - SUPERSEDED: if it has superseded revisions and is neither active nor obsolete
  // ─────────────────────────────────────────────────────────────
  const docMasterMap = useMemo(() => {
    const map = new Map();
    (allExternalDocs || []).forEach(doc => {
      const code = getDocCode(doc);
      if (!code) return;
      if (!map.has(code)) {
        map.set(code, []);
      }
      map.get(code).push(doc);
    });

    const statusMap = new Map();

    map.forEach((docs, code) => {
      // Sort revisions descending
      const sorted = [...docs].sort((a, b) => {
        const revA = parseInt(String(a.rev || a.sourceVersion || a.edition || '0').replace(/\D/g, ''), 10) || 0;
        const revB = parseInt(String(b.rev || b.sourceVersion || b.edition || '0').replace(/\D/g, ''), 10) || 0;
        if (revB !== revA) return revB - revA;
        const dateA = new Date(a.effectiveDate || a.supersededAt || a.supersededDate || a.obsoleteDate || a.createdAt || 0);
        const dateB = new Date(b.effectiveDate || b.supersededAt || b.supersededDate || b.obsoleteDate || b.createdAt || 0);
        return dateB - dateA;
      });

      const topDoc = sorted[0];
      const hasActive = sorted.some(d => 
        (d.status === 'ACTIVE' || d.status === 'EFFECTIVE') && 
        !d.is_superseded && 
        !d.is_obsolete && 
        d.status !== 'SUPERSEDED' && 
        d.status !== 'OBSOLETE'
      );
      const isTopObsolete = topDoc.status === 'OBSOLETE' || topDoc.status === 'OBSOLETE_ARCHIVED' || topDoc.is_obsolete;
      const hasAnyObsolete = sorted.some(d => d.status === 'OBSOLETE' || d.status === 'OBSOLETE_ARCHIVED' || d.is_obsolete);

      let masterStatus = 'ACTIVE';
      if (isTopObsolete || (hasAnyObsolete && !hasActive)) {
        masterStatus = 'OBSOLETE';
      } else if (hasActive) {
        masterStatus = 'ACTIVE';
      } else if (sorted.some(d => d.status === 'SUPERSEDED' || d.status === 'SUPERSEDED_ARCHIVED' || d.is_superseded)) {
        masterStatus = 'SUPERSEDED';
      } else {
        masterStatus = topDoc.status || 'ACTIVE';
      }

      // Representative doc for display: active doc if active, obsolete doc if obsolete, else topDoc
      let representativeDoc = topDoc;
      if (masterStatus === 'ACTIVE') {
        representativeDoc = sorted.find(d => (d.status === 'ACTIVE' || d.status === 'EFFECTIVE') && !d.is_superseded && !d.is_obsolete && d.status !== 'SUPERSEDED' && d.status !== 'OBSOLETE') || topDoc;
      } else if (masterStatus === 'OBSOLETE') {
        representativeDoc = sorted.find(d => d.status === 'OBSOLETE' || d.status === 'OBSOLETE_ARCHIVED' || d.is_obsolete) || topDoc;
      }

      statusMap.set(code, {
        code,
        masterStatus,
        docs: sorted,
        topDoc,
        representativeDoc,
        groupCount: sorted.length
      });
    });

    return statusMap;
  }, [allExternalDocs]);

  // Phase 1, 2 & 3: Level 1 Main Category Data Routing & Tab Partitioning Rules
  const categoryDocs = useMemo(() => {
    return allExternalDocs.filter(doc => {
      const docCode = getDocCode(doc);
      const masterInfo = docMasterMap.get(docCode);
      const masterStatus = masterInfo?.masterStatus || doc.status || 'ACTIVE';
      const isActive = masterStatus === 'ACTIVE';
      const isGeneral = isGeneralDoc(doc);
      const isMyDept = isOwnerDept(doc);

      if (activeMainTab === TAB_MY_DEPT) {
        // แท็บ 1: "เอกสารในแผนกฉัน (My Department Docs)"
        // เงื่อนไข: userDepts.includes(doc.department)
        return isMyDept;
      }
      if (activeMainTab === TAB_GENERAL) {
        // แท็บ 2: "เอกสารทั่วไป (General Docs)"
        // เงื่อนไข: !userDepts.includes(doc.department) && (doc.accessScope || '').toUpperCase() === 'GENERAL' && masterStatus === 'ACTIVE'
        return !isMyDept && isGeneral && isActive;
      }
      if (activeMainTab === TAB_DISTRIBUTED) {
        // แท็บ 3: "เอกสารที่ได้รับการแจกจ่าย (Distributed Docs)"
        // เงื่อนไข: !userDepts.includes(doc.department) && (doc.accessScope || '').toUpperCase() !== 'GENERAL' && masterStatus === 'ACTIVE' && (isDeptAllowed || isUserAllowed || hasCopyInDept)
        return !isMyDept && !isGeneral && isActive && hasDistributedCopyToUserDept(doc);
      }
      return true;
    });
  }, [allExternalDocs, docMasterMap, activeMainTab, userDepts, controlledCopyInstances, documentControlledCopies]);

  // Phase 2 & 3: Synchronized Scope Tab Counters (Effective-Only Unique Document Code Counts)
  const countMyDept = useMemo(() => {
    let count = 0;
    docMasterMap.forEach(info => {
      if (info.masterStatus === 'ACTIVE' && isOwnerDept(info.representativeDoc)) {
        count++;
      }
    });
    return count;
  }, [docMasterMap, userDepts]);

  const countGeneral = useMemo(() => {
    let count = 0;
    docMasterMap.forEach(info => {
      if (info.masterStatus === 'ACTIVE' && !isOwnerDept(info.representativeDoc) && isGeneralDoc(info.representativeDoc)) {
        count++;
      }
    });
    return count;
  }, [docMasterMap, userDepts]);

  const countDistributed = useMemo(() => {
    let count = 0;
    docMasterMap.forEach(info => {
      if (info.masterStatus === 'ACTIVE' && !isOwnerDept(info.representativeDoc) && !isGeneralDoc(info.representativeDoc) && hasDistributedCopyToUserDept(info.representativeDoc)) {
        count++;
      }
    });
    return count;
  }, [docMasterMap, userDepts, controlledCopyInstances, documentControlledCopies]);

  const myDeptDocsCount = countMyDept;
  const generalDocsCount = countGeneral;
  const distributedDocsCount = countDistributed;

  // Phase 3: Level 2 Compact Status Pill Badge Counts (Scoped to selected Main Tab by Unique Document Code)
  const statusCounts = useMemo(() => {
    const categoryDocCodes = new Set();
    categoryDocs.forEach(d => {
      const code = getDocCode(d);
      if (code) categoryDocCodes.add(code);
    });

    let active = 0;
    let superseded = 0;
    let obsolete = 0;

    categoryDocCodes.forEach(code => {
      const info = docMasterMap.get(code);
      const status = info?.masterStatus || 'ACTIVE';
      if (status === 'ACTIVE') {
        active++;
      } else if (status === 'SUPERSEDED') {
        superseded++;
      } else if (status === 'OBSOLETE') {
        obsolete++;
      }
    });

    const total = active + superseded + obsolete;
    return { active, superseded, obsolete, total };
  }, [categoryDocs, docMasterMap]);

  // Global metrics stats for notifications & test compatibility
  const stats = useMemo(() => {
    let active = 0;
    let superseded = 0;
    let obsolete = 0;

    docMasterMap.forEach(info => {
      if (info.masterStatus === 'ACTIVE') active++;
      else if (info.masterStatus === 'SUPERSEDED') superseded++;
      else if (info.masterStatus === 'OBSOLETE') obsolete++;
    });

    const total = active + superseded + obsolete;
    const pending = 0; // External document library never contains pending/in-flight requests
    const dueSoon = accessibleDocs.filter(d => {
      const v = getValidityInfo(d);
      return v.status === 'DUE_SOON' || v.status === 'OVERDUE';
    }).length;

    return { total, active, superseded, obsolete, pending, dueSoon };
  }, [docMasterMap, accessibleDocs]);

  // Filtered Docs for Data Grid (Scoped to Category + Status + Toolbar Filters)
  const filteredDocs = useMemo(() => {
    return categoryDocs.filter(doc => {
      // Golden Rule: Filter out any non-lifecycle documents
      if (!isOfficialLifecycleDoc(doc)) return false;

      const docCode = getDocCode(doc);
      const masterInfo = docMasterMap.get(docCode);
      const docMasterStatus = masterInfo?.masterStatus || doc.status || 'ACTIVE';

      // Part 3 ISO Enforcement: Lock background filter to ACTIVE when on GENERAL or DISTRIBUTED tabs
      if (activeMainTab !== TAB_MY_DEPT) {
        if (docMasterStatus !== 'ACTIVE') return false;
      } else {
        // 4-Status Segmented Pill Filter for MY_DEPT based on Master Document Status
        if (statusFilter === 'ACTIVE') {
          if (docMasterStatus !== 'ACTIVE') return false;
        } else if (statusFilter === 'SUPERSEDED') {
          // Rule: Never include obsolete documents in Superseded
          if (docMasterStatus !== 'SUPERSEDED') return false;
        } else if (statusFilter === 'OBSOLETE') {
          if (docMasterStatus !== 'OBSOLETE') return false;
        } else if (statusFilter === 'ALL') {
          if (!isOfficialLifecycleDoc(doc)) return false;
        }
      }

      // Dept Filter
      if (deptFilter !== 'ALL' && !deptMatches(doc.department || doc.dept, deptFilter)) return false;

      // Scope Filter
      if (scopeFilter !== 'ALL' && doc.accessScope !== scopeFilter) return false;

      // Search Term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const code = (doc.edCode || doc.doc_code || doc.docNo || doc.id || '').toLowerCase();
        const title = (doc.title || '').toLowerCase();
        const titleTh = (doc.titleTh || '').toLowerCase();
        const source = (doc.issuer || doc.officialIssuer || doc.source || '').toLowerCase();
        const ver = (doc.sourceVersion || doc.edition || '').toLowerCase();
        return code.includes(term) || title.includes(term) || titleTh.includes(term) || source.includes(term) || ver.includes(term);
      }

      return true;
    });
  }, [categoryDocs, docMasterMap, activeMainTab, statusFilter, deptFilter, scopeFilter, searchTerm]);

  // Phase 1 Table Grouping by Document Code (Enforce unique document-level grouping across all views)
  const isGroupedView = statusFilter === 'SUPERSEDED' || statusFilter === 'OBSOLETE';

  const displayDocs = useMemo(() => {
    // Group filteredDocs by documentCode
    const groups = new Map();
    filteredDocs.forEach(doc => {
      const code = getDocCode(doc) || doc.id;
      if (!groups.has(code)) {
        groups.set(code, []);
      }
      groups.get(code).push(doc);
    });

    const groupedList = [];
    groups.forEach((docsInGroup, code) => {
      const masterInfo = docMasterMap.get(code);
      const masterStatus = masterInfo?.masterStatus || docsInGroup[0]?.status || 'ACTIVE';

      // Sort docs in this group descending by revision or date
      const sorted = [...docsInGroup].sort((a, b) => {
        const revA = parseInt(String(a.rev || a.sourceVersion || a.edition || '0').replace(/\D/g, ''), 10) || 0;
        const revB = parseInt(String(b.rev || b.sourceVersion || b.edition || '0').replace(/\D/g, ''), 10) || 0;
        if (revB !== revA) return revB - revA;
        const dateA = new Date(a.supersededAt || a.supersededDate || a.obsoleteDate || a.effectiveDate || 0);
        const dateB = new Date(b.supersededAt || b.supersededDate || b.obsoleteDate || b.effectiveDate || 0);
        return dateB - dateA;
      });

      // For ACTIVE, representative is the active doc (or top sorted)
      // For OBSOLETE, representative is the obsolete doc (or top sorted)
      let repDoc = sorted[0];
      if (masterStatus === 'ACTIVE') {
        repDoc = sorted.find(d => (d.status === 'ACTIVE' || d.status === 'EFFECTIVE') && !d.is_superseded && !d.is_obsolete && d.status !== 'SUPERSEDED' && d.status !== 'OBSOLETE') || sorted[0];
      } else if (masterStatus === 'OBSOLETE') {
        repDoc = sorted.find(d => d.status === 'OBSOLETE' || d.status === 'OBSOLETE_ARCHIVED' || d.is_obsolete) || sorted[0];
      }

      const latestDate = repDoc.supersededAt || repDoc.supersededDate || repDoc.obsoleteDate || repDoc.effectiveDate || repDoc.createdAt;

      groupedList.push({
        ...repDoc,
        _isGrouped: isGroupedView,
        _docCode: code,
        _groupCount: sorted.length,
        _groupedDocs: sorted,
        _latestDate: latestDate,
        status: repDoc.status || masterStatus
      });
    });

    return groupedList;
  }, [filteredDocs, docMasterMap, isGroupedView]);

  // Universal Pagination Engine
  const pagination = useTablePagination(displayDocs, 10);

  // Active documents pool for Header Action Selectors (Strictly My Department documents or DCC)
  const selectableActiveDocs = useMemo(() => {
    return accessibleDocs.filter(d => (d.status === 'ACTIVE' || d.status === 'EFFECTIVE') && (isOwnerDept(d) || isDccAdmin));
  }, [accessibleDocs, userDepts, isDccAdmin]);

  const filteredSelectableDocs = useMemo(() => {
    if (!selectorSearch.trim()) return selectableActiveDocs;
    const q = selectorSearch.toLowerCase();
    return selectableActiveDocs.filter(d => {
      const code = (d.edCode || d.doc_code || d.id || '').toLowerCase();
      const title = (d.title || '').toLowerCase();
      const titleTh = (d.titleTh || '').toLowerCase();
      return code.includes(q) || title.includes(q) || titleTh.includes(q);
    });
  }, [selectableActiveDocs, selectorSearch]);

  // Action Handlers
  const handleRegisterNew = () => {
    setOpenMenuDocId(null);
    setSelectModalMode(null);
    setIsDetailOpen(false);
    setIsPreviewOpen(false);
    setIsHistoryOpen(false);
    setIsHistoryModalOpen(false);
    setIsObsoleteModalOpen(false);
    setDocToEdit(null);
    setIsModalOpen(true);
  };

  const handleRevise = (doc) => {
    if (!doc) return;
    setOpenMenuDocId(null);
    setSelectModalMode(null);
    setIsDetailOpen(false);
    setIsPreviewOpen(false);
    setIsHistoryOpen(false);
    setIsHistoryModalOpen(false);
    setIsObsoleteModalOpen(false);
    setDocToEdit({ ...doc });
    setIsModalOpen(true);
  };

  const handleOpenDetail = (doc) => {
    setOpenMenuDocId(null);
    setDocToDetail(doc ? { ...doc } : null);
    setIsDetailOpen(true);
  };

  const handlePreview = (doc) => {
    setOpenMenuDocId(null);
    setDocToPreview(doc ? { ...doc } : null);
    setIsPreviewOpen(true);
  };

  const handleObsolete = (doc) => {
    if (!doc) return;
    setOpenMenuDocId(null);
    setSelectModalMode(null);
    setIsDetailOpen(false);
    setIsPreviewOpen(false);
    setIsHistoryOpen(false);
    setIsHistoryModalOpen(false);
    setIsModalOpen(false);
    setDocToObsolete({ ...doc });
    setIsObsoleteModalOpen(true);
  };

  const handleHistory = (doc) => {
    setOpenMenuDocId(null);
    const code = getDocCode(doc);
    setSelectedHistoryDocCode(code);
    setDocToHistory(doc);
    setIsHistoryModalOpen(true);
    setIsHistoryOpen(true);
  };

  const handleRequestPhysicalCopy = (doc) => {
    setOpenMenuDocId(null);
    setSelectedDocForCopy({
      ...doc,
      id: doc.id,
      title: doc.edCode || doc.doc_code || doc.title,
      name: doc.title,
      rev: doc.rev || doc.sourceVersion || '01',
      department: doc.department || uDept
    });
    setIsCopyModalOpen(true);
  };

  const handleOpenSelectDoc = (mode) => {
    setSelectorSearch('');
    setSelectModalMode(mode);
  };

  // Watermarked PDF Download Integration
  const handleDownload = async (doc, e) => {
    if (e) e.stopPropagation();
    setOpenMenuDocId(null);

    const isObsolete = doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED' || doc.is_obsolete;
    const isSuperseded = doc.status === 'SUPERSEDED' || doc.status === 'SUPERSEDED_ARCHIVED' || doc.is_superseded;
    const watermarkPreset = isObsolete 
      ? WATERMARK_TYPES.OBSOLETE 
      : isSuperseded 
        ? WATERMARK_TYPES.SUPERSEDED 
        : WATERMARK_TYPES.UNCONTROLLED_COPY;

    const docCode = doc.edCode || doc.doc_code || doc.docNo || doc.id || 'ED-DOC-001';
    const toastId = toast.loading(`กำลังประทับลายน้ำเอกสารภายนอก ${docCode}...`);

    try {
      await UniversalWatermarkService.downloadWatermarkedPdf(
        {
          id: doc.id,
          title: docCode,
          name: doc.title,
          docTitle: doc.title,
          status: isObsolete ? 'OBSOLETE' : (isSuperseded ? 'SUPERSEDED' : (doc.status || 'ACTIVE')),
          isExternal: true,
          ...doc
        },
        watermarkPreset,
        {
          userName: currentUser?.name || 'User',
          userDept: uDept,
          reason: isObsolete ? 'Historical Download (OBSOLETE)' : (isSuperseded ? 'Historical Download (SUPERSEDED)' : 'External Document Download / Print'),
          location: uDept,
          watermarkType: watermarkPreset,
          isRestricted: doc.accessScope === 'Restricted' || doc.accessScope === 'RESTRICTED',
          accessScope: doc.accessScope,
          supersededByRev: doc.supersededByRev || 'Latest',
          obsoleteDate: doc.obsoleteDate || doc.supersededAt || '-'
        },
        false
      );

      toast.dismiss(toastId);
      toast.success(`ดาวน์โหลดเอกสารภายนอก ${docCode} สำเร็จ`);

      if (logExternalDownload) {
        logExternalDownload(doc.id);
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.dismiss(toastId);
      toast.error('เกิดข้อผิดพลาดในการดาวน์โหลดเอกสาร');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['ลำดับ', 'รหัสเอกสาร', 'ชื่อเอกสาร', 'ชื่อภาษาไทย', 'แหล่งที่มา', 'ฉบับ (Revision)', 'แผนก', 'ระดับสิทธิ์', 'วันมีผลบังคับใช้', 'สถานะ'];
    const rows = filteredDocs.map((doc, idx) => {
      const code = doc.edCode || doc.doc_code || doc.id || '-';
      const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
      return [
        idx + 1,
        escape(code),
        escape(doc.title),
        escape(doc.titleTh || '-'),
        escape(doc.issuer || doc.officialIssuer || doc.source || '-'),
        escape(doc.rev || doc.sourceVersion || '01'),
        escape(doc.department || '-'),
        escape(doc.accessScope || 'General'),
        escape(doc.effectiveDate || '-'),
        escape(doc.status || '-')
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `External_Docs_${statusFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('ส่งออกรายการเอกสารภายนอก (CSV) เรียบร้อยแล้ว');
  };

  // Render Status Badge
  const getStatusBadge = (doc) => {
    const status = doc.status;
    const isObsolete = status === 'OBSOLETE' || status === 'OBSOLETE_ARCHIVED' || doc.is_obsolete;
    const isSuperseded = status === 'SUPERSEDED' || status === 'SUPERSEDED_ARCHIVED' || doc.is_superseded;
    const isActive = status === 'ACTIVE' || status === 'EFFECTIVE';

    if (isActive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9] whitespace-nowrap shadow-2xs">
          <CheckCircle2 size={13} strokeWidth={1.5} />
          <span>มีผลบังคับใช้</span>
        </span>
      );
    }
    if (isSuperseded) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] whitespace-nowrap shadow-2xs">
          <Clock size={13} strokeWidth={1.5} />
          <span>ฉบับตกรุ่น</span>
        </span>
      );
    }
    if (isObsolete) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5] whitespace-nowrap shadow-2xs">
          <XCircle size={13} strokeWidth={1.5} />
          <span>ยกเลิกถาวร</span>
        </span>
      );
    }
    if (status === 'PENDING_EXT_REVIEW') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFF8E6] text-[#D49800] border border-[#FFE785] whitespace-nowrap shadow-2xs">
          <Clock size={13} strokeWidth={1.5} />
          <span>รอทบทวน</span>
        </span>
      );
    }
    if (status === 'PENDING_EXT_APPROVAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFF8E6] text-[#D49800] border border-[#FFE785] whitespace-nowrap shadow-2xs">
          <Clock size={13} strokeWidth={1.5} />
          <span>รออนุมัติ</span>
        </span>
      );
    }
    if (status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FEECE8] text-[#F24822] border border-[#FAD3CC] whitespace-nowrap shadow-2xs">
          <X size={13} strokeWidth={1.5} />
          <span>ไม่อนุมัติ</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1] whitespace-nowrap">
        <span>{status || 'Draft'}</span>
      </span>
    );
  };

  const getScopeBadge = (scope) => {
    switch (scope) {
      case 'Restricted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF2F0] text-[#F24822] border border-[#FDC4B8]">
            <Lock size={13} strokeWidth={1.5} /> ลับเฉพาะ
          </span>
        );
      case 'Department':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF8E6] text-[#B87C33] border border-[#FDE6B0]">
            <Building2 size={13} strokeWidth={1.5} /> เฉพาะแผนก
          </span>
        );
      case 'General':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]">
            <Globe size={13} strokeWidth={1.5} /> ทั่วไป
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-4 pb-12">
      {/* 1. Page Header Card with 3 ED Action Controls (Standardized Page Header) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-xl px-6 py-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-slate-700 shrink-0" strokeWidth={1.75} />
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              คลังเอกสารภายนอก (External Document Library)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              ทะเบียนควบคุมมาตรฐานสากล กฎหมาย และคู่มือผู้ผลิตภายนอกตามข้อกำหนด ISO 9001:2015 Clause 7.5.3.2
            </p>
          </div>
        </div>

        {/* 3 Main Action Controls (Separated strictly from Internal DAR) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Action 1: ลงทะเบียนเอกสารใหม่ */}
          <button
            type="button"
            aria-label="ลงทะเบียนเอกสารภายนอก"
            onClick={handleRegisterNew}
            className="h-10 px-4 text-xs sm:text-sm font-semibold text-white bg-[#0D99FF] hover:bg-[#007BE5] active:bg-[#0066BE] rounded-xl shadow-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.2} />
            <span>ลงทะเบียนเอกสารใหม่</span>
          </button>

          {/* Action 2: อัปเดตฉบับใหม่ */}
          <button
            type="button"
            onClick={() => handleOpenSelectDoc('UPDATE')}
            className="h-10 px-3.5 text-xs sm:text-sm font-semibold bg-white text-[#1E293B] border border-[#CBD5E1] hover:border-[#F59E0B] hover:text-[#D97706] hover:bg-[#FFFBEB]/40 rounded-xl shadow-2xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
            title="เลือกเอกสารภายนอกเพื่อขอปรับปรุงเวอร์ชันใหม่"
          >
            <RotateCw size={15} className="text-[#D97706]" />
            <span>อัปเดตฉบับใหม่</span>
          </button>

          {/* Action 3: ยกเลิกการใช้งาน */}
          <button
            type="button"
            onClick={() => handleOpenSelectDoc('OBSOLETE')}
            className="h-10 px-3.5 text-xs sm:text-sm font-semibold bg-white text-[#1E293B] border border-[#CBD5E1] hover:border-[#FCA5A5] hover:text-[#DC2626] hover:bg-[#FEF2F2]/40 rounded-xl shadow-2xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
            title="เลือกเอกสารภายนอกเพื่อขอยกเลิกการใช้งานถาวร"
          >
            <Archive size={15} className="text-[#DC2626]" />
            <span>ยกเลิกการใช้งาน</span>
          </button>

          <div className="h-6 w-px bg-slate-200 mx-0.5 hidden sm:block" />

          {/* Action 4: คำร้องเอกสารภายนอกของฉัน */}
          <button
            type="button"
            onClick={() => navigate('/dcc/external/my-requests')}
            className="h-10 px-3.5 text-xs sm:text-sm font-semibold bg-white text-[#0D99FF] border border-[#B8E1FF] hover:bg-[#E5F4FF] rounded-xl shadow-2xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
            title="ติดตามสถานะคำร้องเอกสารภายนอกของฉัน"
          >
            <FileText size={15} className="text-[#0D99FF]" />
            <span>คำร้องของฉัน</span>
            {myReviseCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#EF4444] text-white rounded-full">
                {myReviseCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. 3-Tier Main Category Tabs Navigation (Mirrored from Library.jsx) */}
      <div className="flex items-center gap-1.5 p-1 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl w-fit max-w-full overflow-x-auto scrollbar-hide shadow-2xs shrink-0">
        {/* Tab 1: เอกสารทั่วไป */}
        <button
          type="button"
          onClick={() => {
            setActiveMainTab(TAB_GENERAL);
            setStatusFilter('ACTIVE');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeMainTab === TAB_GENERAL
              ? 'bg-white text-[#0D99FF] border border-[#B8E1FF] shadow-2xs'
              : 'text-[#555555] hover:text-[#1E1E1E] hover:bg-[#F0F0F0] border border-transparent'
          }`}
        >
          <Globe size={16} strokeWidth={1.5} />
          <span>เอกสารทั่วไป</span>
          <span className="px-2 py-0.5 rounded bg-[#EEEEEE] text-xs font-mono font-bold text-[#1E1E1E]">
            {generalDocsCount}
          </span>
        </button>

        {/* Tab 2: เอกสารในแผนกฉัน */}
        <button
          type="button"
          onClick={() => {
            setActiveMainTab(TAB_MY_DEPT);
            setStatusFilter('ACTIVE');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeMainTab === TAB_MY_DEPT
              ? 'bg-white text-[#0D99FF] border border-[#B8E1FF] shadow-2xs'
              : 'text-[#555555] hover:text-[#1E1E1E] hover:bg-[#F0F0F0] border border-transparent'
          }`}
        >
          <Building2 size={16} strokeWidth={1.5} />
          <span>เอกสารในแผนกฉัน</span>
          <span className="px-2 py-0.5 rounded bg-[#EEEEEE] text-xs font-mono font-bold text-[#1E1E1E]">
            {myDeptDocsCount}
          </span>
        </button>

        {/* Tab 3: เอกสารที่ได้รับการแจกจ่าย */}
        <button
          type="button"
          onClick={() => {
            setActiveMainTab(TAB_DISTRIBUTED);
            setStatusFilter('ACTIVE');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeMainTab === TAB_DISTRIBUTED
              ? 'bg-white text-[#0D99FF] border border-[#B8E1FF] shadow-2xs'
              : 'text-[#555555] hover:text-[#1E1E1E] hover:bg-[#F0F0F0] border border-transparent'
          }`}
        >
          <Share2 size={16} strokeWidth={1.5} />
          <span>เอกสารที่ได้รับการแจกจ่าย</span>
          <span className="px-2 py-0.5 rounded bg-[#EEEEEE] text-xs font-mono font-bold text-[#1E1E1E]">
            {distributedDocsCount}
          </span>
        </button>
      </div>

      {/* Sub-Metric Awareness Indicator (สำหรับแสดงงานที่รอพิจารณา และใกล้ครบกำหนด) */}
      {(stats.pending > 0 || stats.dueSoon > 0) && (
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-2 bg-amber-50/60 border border-amber-200/70 rounded-xl text-xs text-amber-800">
          <span className="font-bold flex items-center gap-1">
            <AlertTriangle size={14} className="text-amber-600" />
            <span>การแจ้งเตือนงานเอกสาร:</span>
          </span>
          {stats.pending > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-semibold font-mono text-[11px]">
              รอทบทวน/อนุมัติ: {stats.pending} ฉบับ
            </span>
          )}
          {stats.dueSoon > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 font-semibold font-mono text-[11px]">
              ใกล้/เกินกำหนดทบทวน: {stats.dueSoon} ฉบับ
            </span>
          )}
        </div>
      )}

      {/* 3. Main Data Card with Filter Toolbar & Bento Data Grid (Full Width) */}
      <div className="w-full bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-2xs h-auto space-y-0">
        {/* Enterprise Control Toolbar: 2-Row Clean Layout */}
        <div className="p-4 border-b border-[#E2E8F0] bg-white space-y-3.5">
          {/* แถวที่ 1: ค้นหา + แผนก + ระดับสิทธิ์ + ปุ่มส่งออก CSV */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
            {/* ช่องค้นหาเอกสาร (ขยายตามพื้นที่ว่างที่เหลือ) */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" size={16} />
              <input
                type="text"
                placeholder="ค้นหารหัส ED, ชื่อ, แหล่งที่มา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 text-sm placeholder:text-[#94A3B8] pl-9 pr-10 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#1E293B] focus:bg-white focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] cursor-pointer"
                >
                  <FilterX size={15} />
                </button>
              )}
            </div>

            {/* Dropdown 1: แผนก (Department Filter) */}
            <div className="w-full lg:w-48 shrink-0">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full h-10 px-3 text-xs sm:text-sm bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#1E293B] focus:bg-white focus:outline-none focus:border-[#0D99FF] cursor-pointer"
              >
                <option value="ALL">ทุกแผนก (All Depts)</option>
                {availableDepts.map(deptObj => {
                  const deptCode = typeof deptObj === 'string' ? deptObj : deptObj.id;
                  const deptName = typeof deptObj === 'string' ? deptObj : (deptObj.nameTh || deptObj.name);
                  return (
                    <option key={deptCode} value={deptCode}>{deptCode} - {deptName}</option>
                  );
                })}
              </select>
            </div>

            {/* Dropdown 2: ระดับสิทธิ์การเข้าถึง */}
            <div className="w-full lg:w-40 shrink-0">
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className="w-full h-10 px-3 text-xs sm:text-sm bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#1E293B] focus:bg-white focus:outline-none focus:border-[#0D99FF] cursor-pointer"
              >
                <option value="ALL">ทุกระดับสิทธิ์</option>
                <option value="General">ทั่วไป (General)</option>
                <option value="Department">เฉพาะแผนก (Dept Only)</option>
                <option value="Restricted">จำกัดสิทธิ์ (Restricted)</option>
              </select>
            </div>

            {/* ปุ่มส่งออกรายงาน CSV */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleExportCsv}
                className="w-full lg:w-auto h-10 px-4 inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold bg-white border border-[#CBD5E1] text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#94A3B8] rounded-xl shadow-2xs transition-all whitespace-nowrap cursor-pointer"
              >
                <Download className="text-[#0D99FF] shrink-0" size={15} />
                <span>ส่งออกรายการ</span>
              </button>
            </div>
          </div>

          {/* แถวที่ 2: Compact Segmented Pill Control (แสดงเฉพาะเมื่อเลือกแท็บ 'เอกสารในแผนกฉัน' ตามมาตรฐาน ISO) */}
          {activeMainTab === TAB_MY_DEPT ? (
            <div className="pt-2.5 border-t border-[#F1F5F9] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Responsive Scrollable & Wrap Capsule Pill Container */}
              <div className="w-full sm:w-auto overflow-x-auto scrollbar-hide py-0.5">
                <div className="inline-flex items-center gap-1 p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl shadow-2xs shrink-0 whitespace-nowrap">
                  {[
                    { id: 'ACTIVE', label: 'มีผลบังคับใช้ (Active)', count: statusCounts.active },
                    { id: 'SUPERSEDED', label: 'ฉบับตกรุ่น (Superseded)', count: statusCounts.superseded },
                    { id: 'OBSOLETE', label: 'ยกเลิกถาวร (Obsolete)', count: statusCounts.obsolete },
                    { id: 'ALL', label: 'ทั้งหมด (All Records)', count: statusCounts.total },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        statusFilter === tab.id
                          ? 'bg-white text-[#0D99FF] shadow-2xs font-bold border border-slate-200/70'
                          : 'text-[#64748B] hover:text-[#1E293B] hover:bg-white/60 border border-transparent'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                        statusFilter === tab.id
                          ? 'bg-[#E5F4FF] text-[#0D99FF]'
                          : 'bg-[#CBD5E1]/60 text-[#475569]'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[#64748B] shrink-0">
                {(deptFilter !== 'ALL' || scopeFilter !== 'ALL' || searchTerm || statusFilter !== 'ACTIVE') && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('ACTIVE');
                      setDeptFilter('ALL');
                      setScopeFilter('ALL');
                      setSearchTerm('');
                    }}
                    className="text-[#EF4444] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <FilterX size={13} />
                    <span>ล้างตัวกรองทั้งหมด</span>
                  </button>
                )}
                <span className="font-mono">
                  แสดงผล <strong className="text-[#1E293B] font-bold">{pagination.totalItems}</strong> จาก {statusCounts.total} รายการ {isGroupedView && `(รวม ${filteredDocs.length} ฉบับย้อนหลัง)`}
                </span>
              </div>
            </div>
          ) : (
            /* สำหรับแท็บ 'เอกสารทั่วไป' และ 'เอกสารที่ได้รับการแจกจ่าย' - ซ่อนแถบแท็บย่อยวงจรชีวิตออกไปโดยสิ้นเชิง */
            (deptFilter !== 'ALL' || scopeFilter !== 'ALL' || searchTerm) ? (
              <div className="pt-2.5 border-t border-[#F1F5F9] flex items-center justify-between text-xs text-[#64748B]">
                <button
                  type="button"
                  onClick={() => {
                    setDeptFilter('ALL');
                    setScopeFilter('ALL');
                    setSearchTerm('');
                  }}
                  className="text-[#EF4444] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <FilterX size={13} />
                  <span>ล้างตัวกรองทั้งหมด</span>
                </button>
                <span className="font-mono">
                  แสดงผล <strong className="text-[#1E293B] font-bold">{filteredDocs.length}</strong> จาก {categoryDocs.length} รายการ (เฉพาะฉบับมีผลบังคับใช้)
                </span>
              </div>
            ) : null
          )}
        </div>

        {/* Bento Data Grid Table */}
        <div className="w-full flex-1 overflow-y-auto overflow-x-auto min-h-[320px] pb-6 scrollbar-thin">
          <table className="w-full text-left text-sm table-auto min-w-full border-collapse">
            <thead className="bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] sticky top-0 z-20 whitespace-nowrap backdrop-blur-xs shadow-xs">
              <tr>
                {statusFilter !== 'OBSOLETE' && (
                  <th className="w-[85px] min-w-[85px] py-3 px-3 text-center select-none bg-[#F8FAFC]">การจัดการ</th>
                )}
                <th className={`${statusFilter === 'OBSOLETE' ? 'w-[36%]' : 'w-[32%]'} min-w-[240px] py-3 px-3.5 select-none bg-[#F8FAFC]`}>รหัสและชื่อเอกสาร</th>
                <th className="w-[16%] min-w-[130px] py-3 px-3.5 select-none bg-[#F8FAFC]">แผนกและสิทธิ์</th>
                <th className="w-[16%] min-w-[130px] py-3 px-3.5 select-none bg-[#F8FAFC]">ฉบับและวันบังคับใช้</th>
                <th className="w-[18%] min-w-[150px] py-3 px-3.5 select-none bg-[#F8FAFC]">รอบทบทวนและความถูกต้อง</th>
                <th className="w-[14%] min-w-[130px] py-3 px-3.5 text-center select-none bg-[#F8FAFC]">สถานะเอกสาร</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {pagination.paginatedData.length > 0 ? (
                pagination.paginatedData.map((doc, idx) => {
                  const edCode = doc.edCode || doc.doc_code || doc.docNo || doc.id;
                  const validity = getValidityInfo(doc);
                  const isActive = doc.status === 'ACTIVE' || doc.status === 'EFFECTIVE';
                  const isMenuOpen = openMenuDocId === doc.id;

                  const totalRows = pagination.paginatedData.length;
                  const isLastRow = idx === totalRows - 1;
                  const isFewRows = totalRows < 3;
                  const isNearBottom = idx >= Math.max(0, totalRows - 2);
                  const isDropup = isLastRow || isFewRows || isNearBottom;

                  return (
                    <tr 
                      key={doc.id || `${edCode}-${idx}`}
                      className={`hover:bg-[#F8FAFC] transition-colors duration-150 cursor-pointer group ${
                        isMenuOpen ? 'relative z-50 bg-[#F8FAFC]' : 'relative'
                      } ${doc._isGrouped ? (statusFilter === 'SUPERSEDED' ? 'border-l-4 border-l-amber-400 bg-amber-50/15 hover:bg-amber-50/30' : 'border-l-4 border-l-slate-400 bg-slate-50/30 hover:bg-slate-100/40') : ''}`}
                      onClick={() => {
                        if (doc._isGrouped || isGroupedView) {
                          handleHistory(doc);
                        } else {
                          handleOpenDetail(doc);
                        }
                      }}
                    >
                      {/* 1. เครื่องมือและการจัดการ (Action Dock with direct buttons + 3-dot dropdown) */}
                      {statusFilter !== 'OBSOLETE' && (
                        <td className={`px-2.5 py-3 whitespace-nowrap text-xs text-center ${isMenuOpen ? 'relative z-50' : 'relative z-1'}`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1 ed-action-dock">
                            {/* Quick View Details / History Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (doc._isGrouped || isGroupedView) {
                                  handleHistory(doc);
                                } else {
                                  handleOpenDetail(doc);
                                }
                              }}
                              className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              title={doc._isGrouped ? "ดูประวัติเอกสารย้อนหลัง (View Revision History)" : "ดูข้อมูลเอกสาร (View Details)"}
                            >
                              <Eye size={14} strokeWidth={1.5} />
                            </button>

                            {/* Quick Watermarked Download Button */}
                            <button
                              type="button"
                              onClick={(e) => handleDownload(doc, e)}
                              className="p-1.5 rounded text-slate-500 hover:text-emerald-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="ดาวน์โหลด PDF พร้อมลายน้ำ (Watermarked PDF)"
                            >
                              <Download size={14} strokeWidth={1.5} />
                            </button>

                            {/* 3-Dot More Options Dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                aria-label="เมนูเพิ่มเติม"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuDocId(isMenuOpen ? null : doc.id);
                                }}
                                className={`p-1.5 rounded transition-colors cursor-pointer ${
                                  isMenuOpen
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                                title="เมนูการจัดการเพิ่มเติม (Row-Level Actions)"
                              >
                                <MoreHorizontal size={14} strokeWidth={1.5} />
                              </button>

                              {/* Dropdown Menu Popup (Dropup / Smart Placement Support) */}
                              {isMenuOpen && (
                                <div 
                                  className={`absolute left-0 ${
                                    isDropup ? 'bottom-full mb-2' : 'top-full mt-2'
                                  } w-60 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 py-1.5 text-left ed-dropdown-menu divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Group 1: Core View Actions */}
                                  <div className="py-1">
                                    {/* 1. ดูข้อมูลเอกสาร (View Details) */}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDetail(doc)}
                                      className="w-full px-3.5 py-2 text-xs text-slate-700 hover:text-[#0D99FF] hover:bg-[#F0F7FF] flex items-center gap-2.5 transition-all duration-150 font-medium cursor-pointer group/item"
                                    >
                                      <FileText size={15} strokeWidth={1.5} className="text-[#0D99FF] group-hover/item:scale-110 transition-transform" />
                                      <span>ดูข้อมูลเอกสาร (View Details)</span>
                                    </button>

                                    {/* 2. เปิดอ่านไฟล์ PDF (View PDF) */}
                                    <button
                                      type="button"
                                      onClick={() => handlePreview(doc)}
                                      className="w-full px-3.5 py-2 text-xs text-slate-700 hover:text-emerald-600 hover:bg-emerald-50/70 flex items-center gap-2.5 transition-all duration-150 font-medium cursor-pointer group/item"
                                    >
                                      <Eye size={15} strokeWidth={1.5} className="text-emerald-600 group-hover/item:scale-110 transition-transform" />
                                      <span>เปิดอ่านไฟล์ PDF (View PDF)</span>
                                    </button>
                                  </div>

                                  {/* Group 2: Lifecycle Actions (Revise & Obsolete) - เฉพาะเอกสารในแผนกตนเอง หรือ DCC เท่านั้น */}
                                  {canManageDoc(doc) && (
                                    <div className="py-1">
                                      {/* 3. อัปเดตฉบับใหม่ (Create Revision) */}
                                      <button
                                        type="button"
                                        onClick={() => handleRevise(doc)}
                                        className="w-full px-3.5 py-2 text-xs text-slate-700 hover:text-amber-600 hover:bg-amber-50/70 flex items-center gap-2.5 transition-all duration-150 font-medium cursor-pointer group/item"
                                        title="แก้ไขหรือทบทวนเวอร์ชันใหม่"
                                      >
                                        <RotateCw size={15} strokeWidth={1.5} className="text-amber-600 group-hover/item:rotate-45 transition-transform" />
                                        <span>อัปเดตฉบับใหม่ (Create Revision)</span>
                                      </button>

                                      {/* 4. ยื่นขอยกเลิกใช้งาน (Request Obsolete) */}
                                      {isActive && (
                                        <button
                                          type="button"
                                          onClick={() => handleObsolete(doc)}
                                          className="w-full px-3.5 py-2 text-xs text-slate-700 hover:text-rose-600 hover:bg-rose-50/70 flex items-center gap-2.5 transition-all duration-150 font-medium cursor-pointer group/item"
                                          title="ยื่นขอยกเลิกเอกสาร"
                                        >
                                          <Archive size={15} strokeWidth={1.5} className="text-rose-600 group-hover/item:scale-110 transition-transform" />
                                          <span>ยื่นขอยกเลิกใช้งาน (Request Obsolete)</span>
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Group 3: Controlled Copies & Download Actions */}
                                  <div className="py-1">
                                    {isActive && (
                                      <button
                                        type="button"
                                        onClick={() => handleRequestPhysicalCopy(doc)}
                                        className="w-full px-3.5 py-2 text-xs text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/70 flex items-center gap-2.5 transition-all duration-150 font-medium cursor-pointer group/item"
                                        title="ขอสำเนาควบคุมหน้างาน (Request Physical Copy)"
                                      >
                                        <Layers size={15} strokeWidth={1.5} className="text-indigo-600 group-hover/item:scale-110 transition-transform" />
                                        <span>ขอสำเนาควบคุมหน้างาน</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={(e) => handleDownload(doc, e)}
                                      className="w-full px-3.5 py-2 text-xs text-slate-700 hover:text-emerald-600 hover:bg-emerald-50/70 flex items-center gap-2.5 transition-all duration-150 font-medium cursor-pointer group/item"
                                    >
                                      <Download size={15} strokeWidth={1.5} className="text-emerald-600 group-hover/item:scale-110 transition-transform" />
                                      <span>ดาวน์โหลด PDF (มีลายน้ำ)</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleHistory(doc)}
                                      className="w-full px-3.5 py-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition-all duration-150 font-medium cursor-pointer group/item"
                                    >
                                      <History size={15} strokeWidth={1.5} className="text-slate-400 group-hover/item:scale-110 transition-transform" />
                                      <span>ประวัติเอกสารและการแก้ไข</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      )}

                      {/* 2. รหัสและชื่อเอกสาร (Document Identity) */}
                      <td className="py-3 px-3.5 align-middle">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-[#0D99FF] bg-[#E5F4FF] border border-[#B8E1FF] px-2.5 py-0.5 rounded-md inline-block shadow-2xs">
                              {edCode}
                            </span>
                            <span className="bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded text-xs font-mono font-bold border border-[#E2E8F0]">
                              ED
                            </span>
                            {doc._isGrouped ? (
                              statusFilter === 'SUPERSEDED' ? (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300/80 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs">
                                  <Clock size={11} strokeWidth={1.5} className="text-amber-600" />
                                  <span>{doc._groupCount} ฉบับตกรุ่น</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs">
                                  <Archive size={11} strokeWidth={1.5} className="text-slate-500" />
                                  <span>{doc._groupCount} ฉบับยกเลิก</span>
                                </span>
                              )
                            ) : (
                              <span className="text-[11px] text-[#64748B] font-mono font-medium">
                                Rev.{doc.rev || doc.sourceVersion || '01'}
                              </span>
                            )}
                          </div>
                          <div 
                            className="font-medium text-[#1E293B] text-sm leading-relaxed truncate max-w-md group-hover:text-[#0D99FF] transition-colors" 
                            title={doc.title}
                          >
                            {doc.title}
                          </div>
                          {doc.titleTh && doc.titleTh !== doc.title && (
                            <div className="text-xs text-[#64748B] font-normal truncate max-w-md">
                              {doc.titleTh}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#64748B] font-medium flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Building2 size={12} className="text-slate-400" />
                              {doc.issuer || doc.officialIssuer || doc.source || 'หน่วยงานภายนอก'}
                            </span>
                            {doc.category && (
                              <>
                                <span>•</span>
                                <span className="px-1.5 py-0.2 bg-slate-100 rounded text-[11px] font-medium text-slate-600">
                                  {doc.category}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. แผนกและสิทธิ์ (Department & Access Scope) */}
                      <td className="py-3 px-3.5 align-middle">
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <Building2 size={12} className="text-slate-500" />
                            <span>{doc.department || 'QA'}</span>
                          </span>
                          <div>
                            {getScopeBadge(doc.accessScope)}
                          </div>
                        </div>
                      </td>

                      {/* 4. ฉบับและวันบังคับใช้ */}
                      <td className="py-3 px-3.5 align-middle">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            Rev.{doc.rev || doc.sourceVersion || '01'}
                          </span>
                          <span className="font-mono text-xs text-slate-500 mt-1" title={doc._isGrouped ? "วันที่ปลดระวาง/ยกเลิกล่าสุด" : "วันที่มีผลบังคับใช้"}>
                            {doc._isGrouped 
                              ? `${statusFilter === 'SUPERSEDED' ? 'ปลดระวางล่าสุด: ' : 'ยกเลิกล่าสุด: '}${doc._latestDate ? String(doc._latestDate).split('T')[0] : (doc.effectiveDate || '-')}`
                              : (doc.effectiveDate || '-')}
                          </span>
                        </div>
                      </td>

                      {/* 5. รอบทบทวนและความถูกต้อง */}
                      <td className="py-3 px-3.5 align-middle">
                        {doc._isGrouped ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-xs text-slate-700 font-medium">
                              คลังประวัติเอกสาร
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              <Archive size={11} strokeWidth={1.5} className="text-slate-500" />
                              <span>เก็บถาวรในคลังประวัติ</span>
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-xs text-slate-700 font-medium">
                              ทุก {doc.reviewCycleMonths || 12} เดือน
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${validity.colorClass}`}>
                              {validity.status === 'OVERDUE' && <AlertTriangle size={11} strokeWidth={1.5} />}
                              {validity.status === 'DUE_SOON' && <Clock size={11} strokeWidth={1.5} />}
                              {validity.status === 'NORMAL' && <CheckCircle size={11} strokeWidth={1.5} />}
                              {validity.label}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 6. สถานะเอกสาร */}
                      <td className="py-3 px-3.5 align-middle text-center whitespace-nowrap">
                        {doc._isGrouped ? (
                          statusFilter === 'SUPERSEDED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                              <Clock size={12} strokeWidth={1.5} />
                              <span>ฉบับตกรุ่น</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                              <Archive size={12} strokeWidth={1.5} />
                              <span>ยกเลิกถาวร</span>
                            </span>
                          )
                        ) : (
                          getStatusBadge(doc)
                        )}
                      </td>
                    </tr>
                  );
                }).concat(
                  <tr key="table-safety-spacer" aria-hidden="true" className="h-4 border-none pointer-events-none select-none">
                    <td colSpan={statusFilter === 'OBSOLETE' ? 5 : 6} className="p-0 h-4 border-none" />
                  </tr>
                )
              ) : (
                <tr>
                  <td colSpan={statusFilter === 'OBSOLETE' ? 5 : 6} className="px-6 py-14 text-center text-[#888888]">
                    <AlertCircle size={36} className="mx-auto mb-2 text-[#CCCCCC]" strokeWidth={1.5} />
                    <p className="font-bold text-xs text-[#1E293B]">ไม่พบเอกสารในหมวดหมู่นี้</p>
                    <p className="text-xs text-[#888888] mt-0.5">
                      {searchTerm ? 'ลองค้นหาด้วยคำค้นอื่น หรือกด "ล้างตัวกรองทั้งหมด"' : 'กดปุ่ม "+ ลงทะเบียนเอกสารใหม่" เพื่อเริ่มสร้างเอกสารฉบับแรก'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        <TablePagination
          currentPage={pagination.currentPage}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 4. Document Selection Modal (When clicking Update Revision or Obsolete from Header) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectModalMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectModalMode(null)}
              className="fixed inset-0"
            />
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="relative bg-white border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] rounded-2xl shadow-2xl z-10 my-auto animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    selectModalMode === 'UPDATE' ? 'bg-amber-100 text-[#D97706]' : 'bg-rose-100 text-[#DC2626]'
                  }`}>
                    {selectModalMode === 'UPDATE' ? <RotateCw size={18} /> : <Archive size={18} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#1E293B]">
                      {selectModalMode === 'UPDATE' ? 'เลือกเอกสารเพื่ออัปเดตฉบับใหม่' : 'เลือกเอกสารเพื่อขอยกเลิกการใช้งาน'}
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      {selectModalMode === 'UPDATE'
                        ? 'เลือกเอกสารภายนอกที่มีผลบังคับใช้ เพื่อจัดทำ Revision ถัดไป'
                        : 'เลือกเอกสารภายนอกที่มีผลบังคับใช้ เพื่อส่งคำขอยกเลิกถาวร'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectModalMode(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search in Selector */}
              <div className="p-4 border-b border-[#E2E8F0] bg-white">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="พิมพ์รหัส ED หรือ ชื่อเอกสารเพื่อค้นหา..."
                    value={selectorSearch}
                    onChange={(e) => setSelectorSearch(e.target.value)}
                    className="w-full h-10 pl-9 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#0D99FF]"
                    autoFocus
                  />
                </div>
              </div>

              {/* Documents List */}
              <div className="p-4 overflow-y-auto flex-1 space-y-2 divide-y divide-slate-100 custom-scrollbar">
                {filteredSelectableDocs.length > 0 ? (
                  filteredSelectableDocs.map(doc => {
                    const code = doc.edCode || doc.doc_code || doc.id;
                    return (
                      <div
                        key={doc.id}
                        className="pt-2 pb-2 first:pt-0 flex items-center justify-between gap-3 hover:bg-slate-50 p-2.5 rounded-xl transition-all"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-[#0D99FF] bg-[#E5F4FF] px-2 py-0.5 rounded border border-[#B8E1FF]">
                              {code}
                            </span>
                            <span className="font-mono text-xs text-slate-500 font-semibold">
                              Rev.{doc.rev || doc.sourceVersion || '01'}
                            </span>
                            <span className="text-xs px-2 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                              {doc.department || 'QA'}
                            </span>
                          </div>
                          <p className="font-medium text-xs sm:text-sm text-[#1E293B] mt-1 truncate">
                            {doc.title}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectModalMode(null);
                            if (selectModalMode === 'UPDATE') {
                              handleRevise(doc);
                            } else {
                              handleObsolete(doc);
                            }
                          }}
                          className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                            selectModalMode === 'UPDATE'
                              ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] hover:bg-[#FEF3C7]'
                              : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5] hover:bg-[#FEE2E2]'
                          }`}
                        >
                          <span>เลือกฉบับนี้</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-10 text-center text-slate-400">
                    <AlertCircle size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">ไม่พบเอกสารที่มีผลบังคับใช้ตรงกับคำค้นหา</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectModalMode(null)}
                  className="btn-secondary text-sm font-semibold px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  ปิด (Close)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 5. Connected Workflows & Operations Modals */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <ErrorBoundary
        fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-200 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-3">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">เกิดข้อผิดพลาดในการแสดงแบบฟอร์มเอกสาร</h3>
              <p className="text-xs text-slate-500 mb-4">ระบบป้องกันหน้าจอขาวอัตโนมัติ กรุณาลองใหม่อีกครั้ง</p>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setDocToEdit(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        }
      >
        <ExternalDocFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setDocToEdit(null);
          }}
          documentToEdit={docToEdit}
        />
      </ErrorBoundary>

      <ExternalDocPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setDocToPreview(null);
        }}
        document={docToPreview}
      />

      <ExternalDocDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDocToDetail(null);
        }}
        document={docToDetail}
        onOpenViewer={(d) => {
          setIsDetailOpen(false);
          handlePreview(d || docToDetail);
        }}
        onOpenRevise={(d) => {
          setIsDetailOpen(false);
          handleRevise(d || docToDetail);
        }}
        onOpenObsolete={(d) => {
          setIsDetailOpen(false);
          handleObsolete(d || docToDetail);
        }}
      />

      <ExternalDocHistoryModal
        isOpen={isHistoryModalOpen || isHistoryOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setIsHistoryOpen(false);
          setSelectedHistoryDocCode(null);
          setDocToHistory(null);
        }}
        docCode={selectedHistoryDocCode}
        document={docToHistory}
        onViewActiveDoc={(activeDoc) => {
          setIsHistoryModalOpen(false);
          setIsHistoryOpen(false);
          setSelectedHistoryDocCode(null);
          setDocToHistory(null);
          handleOpenDetail(activeDoc);
        }}
      />

      <ExternalDocObsoleteModal
        isOpen={isObsoleteModalOpen}
        onClose={() => {
          setIsObsoleteModalOpen(false);
          setDocToObsolete(null);
        }}
        documentToObsolete={docToObsolete}
      />

      {isCopyModalOpen && selectedDocForCopy && (
        <RequestAdditionalCopiesModal
          isOpen={isCopyModalOpen}
          onClose={() => {
            setIsCopyModalOpen(false);
            setSelectedDocForCopy(null);
          }}
          document={selectedDocForCopy}
        />
      )}
    </div>
  );
};

export default ExternalDocsList;
