import React, { useState, useMemo, useEffect } from 'react';
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
import ExternalDocHistoryModal from './ExternalDocHistoryModal';
import ExternalDocObsoleteModal from './ExternalDocObsoleteModal';
import RequestAdditionalCopiesModal from '../../components/workflow/RequestAdditionalCopiesModal';
import UniversalWatermarkService, { WATERMARK_TYPES } from '../../services/UniversalWatermarkService';
import toast from 'react-hot-toast';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';

// Main Category Tab Constants (Level 1)
const TAB_GENERAL = 'GENERAL';
const TAB_MY_DEPT = 'MY_DEPT';
const TAB_DISTRIBUTED = 'DISTRIBUTED';

const ExternalDocsList = () => {
  const { 
    externalDocuments, 
    currentUser, 
    logExternalDownload, 
    masterDepartments, 
    departments: storeDepts,
    controlledCopyInstances,
    documentControlledCopies
  } = useStore();
  
  // Level 1: Main Category Tabs (GENERAL, MY_DEPT, DISTRIBUTED)
  const [activeMainTab, setActiveMainTab] = useState(TAB_GENERAL);
  
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

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [docToHistory, setDocToHistory] = useState(null);
  
  const [isObsoleteModalOpen, setIsObsoleteModalOpen] = useState(false);
  const [docToObsolete, setDocToObsolete] = useState(null);

  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [selectedDocForCopy, setSelectedDocForCopy] = useState(null);

  // Header Document Selector Modal (for Update Revision or Obsolete when triggered from Header)
  const [selectModalMode, setSelectModalMode] = useState(null); // 'UPDATE' | 'OBSOLETE' | null
  const [selectorSearch, setSelectorSearch] = useState('');

  // Row-level 3-dot action menu
  const [openMenuDocId, setOpenMenuDocId] = useState(null);

  const isAdmin = Boolean(currentUser?.role === 'DCC_ADMIN' || currentUser?.isDcc || currentUser?.id === 'U001');
  const uDept = currentUser?.department || currentUser?.dept || 'QA';

  const availableDepts = useMemo(() => {
    return (masterDepartments || storeDepts || []).filter(d => typeof d === 'string' || d.status !== 'INACTIVE');
  }, [masterDepartments, storeDepts]);

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

  // 1. Accessibility & Confidentiality Filter
  const accessibleDocs = useMemo(() => {
    return (externalDocuments || []).filter(doc => {
      if (isAdmin) return true;

      const isOwner = doc.ownerId === currentUser?.id;
      const isReviewer = doc.reviewerId === currentUser?.id;
      const isApprover = doc.approverId === currentUser?.id;
      const isAck = doc.acknowledgees?.includes(currentUser?.id);
      const isInvolved = isOwner || isReviewer || isApprover || isAck;

      if (doc.accessScope === 'General' || !doc.accessScope) return true;
      if (doc.accessScope === 'Department') {
        return isInvolved || (doc.accessDepartments && doc.accessDepartments.includes(uDept)) || doc.department === uDept;
      }
      if (doc.accessScope === 'Restricted') {
        return isInvolved || (doc.accessUsers && doc.accessUsers.includes(currentUser?.id));
      }
      return false;
    });
  }, [externalDocuments, isAdmin, currentUser, uDept]);

  // Department normalization & matching helpers
  const normalizeDept = (d) => {
    if (!d) return '';
    const val = typeof d === 'object' ? (d.id || d.code || d.dept || d.department) : d;
    return typeof val === 'string' ? val.trim().toUpperCase() : '';
  };

  const userDept = normalizeDept(
    currentUser?.primary_department ||
    currentUser?.department ||
    currentUser?.dept ||
    currentUser?.dept_code ||
    'QA'
  );

  const deptMatches = (d1, d2) => {
    const s1 = normalizeDept(d1);
    const s2 = normalizeDept(d2);
    if (!s1 || !s2) return false;
    if (s1 === s2) return true;
    if ((s1 === 'QA' || s1 === 'QA/QC' || s1 === 'QAQC') && (s2 === 'QA' || s2 === 'QA/QC' || s2 === 'QAQC')) return true;
    return false;
  };

  const isOwnerDept = (doc) => {
    const docDept = doc.department || doc.dept || doc.owner_dept;
    return deptMatches(docDept, userDept);
  };

  const isGeneralDoc = (doc) => {
    return (
      doc.distributionScope === 'ALL' ||
      doc.distribution_scope === 'ALL' ||
      doc.scope === 'ALL' ||
      doc.accessScope === 'General' ||
      doc.accessScope === 'GENERAL' ||
      doc.access_scope === 'GENERAL'
    );
  };

  const hasDistributedCopyToUserDept = (doc) => {
    if (isOwnerDept(doc)) return false; // Strict: exclude own department
    
    // 1. Array of distributed dept codes
    const inDistDepts = (doc.distributed_depts || []).some(d => deptMatches(d, userDept));
    // 2. Array of distribution objects
    const inDistObjs = (doc.distributions || []).some(d => deptMatches(d.departmentId || d.department || d.dept, userDept));
    // 3. Access departments
    const inAccessDepts = (doc.accessDepartments || []).some(d => deptMatches(d, userDept));
    // 4. Physical controlled copies in store
    const hasControlledCopy = (controlledCopyInstances || documentControlledCopies || []).some(c => {
      const matchDoc = String(c.externalDocId || c.external_doc_id || c.docId || c.doc_id) === String(doc.id) ||
                       c.doc_code === doc.edCode ||
                       c.doc_code === doc.id ||
                       c.docTitle === doc.title;
      return matchDoc && deptMatches(c.holder_dept || c.department, userDept) && ['ISSUED_ACTIVE', 'ACTIVE'].includes(c.status);
    });

    return Boolean(inDistDepts || inDistObjs || inAccessDepts || hasControlledCopy);
  };

  // Phase 2: Level 1 Main Category Data Routing
  const categoryDocs = useMemo(() => {
    return accessibleDocs.filter(doc => {
      if (activeMainTab === TAB_GENERAL) {
        // 1. เอกสารทั่วไป: doc.distributionScope === 'ALL'
        return isGeneralDoc(doc);
      }
      if (activeMainTab === TAB_MY_DEPT) {
        // 2. เอกสารในแผนกฉัน: doc.department === currentUser.department
        return isOwnerDept(doc);
      }
      if (activeMainTab === TAB_DISTRIBUTED) {
        // 3. เอกสารที่ได้รับการแจกจ่าย: doc.department !== currentUser.department และมีการแจกจ่ายสำเนามาที่แผนกผู้ใช้
        return !isOwnerDept(doc) && hasDistributedCopyToUserDept(doc);
      }
      return true;
    });
  }, [accessibleDocs, activeMainTab, userDept, controlledCopyInstances, documentControlledCopies]);

  // Main Category Tab Badge Counters (Active documents per tab)
  const generalDocsCount = useMemo(() => {
    return accessibleDocs.filter(d => isGeneralDoc(d) && (d.status === 'ACTIVE' || d.status === 'EFFECTIVE')).length;
  }, [accessibleDocs]);

  const myDeptDocsCount = useMemo(() => {
    return accessibleDocs.filter(d => isOwnerDept(d) && (d.status === 'ACTIVE' || d.status === 'EFFECTIVE')).length;
  }, [accessibleDocs, userDept]);

  const distributedDocsCount = useMemo(() => {
    return accessibleDocs.filter(d => !isOwnerDept(d) && hasDistributedCopyToUserDept(d) && (d.status === 'ACTIVE' || d.status === 'EFFECTIVE')).length;
  }, [accessibleDocs, userDept, controlledCopyInstances, documentControlledCopies]);

  // Phase 3: Level 2 Compact Status Pill Badge Counts (Scoped to selected Main Tab)
  const statusCounts = useMemo(() => {
    const active = categoryDocs.filter(d => d.status === 'ACTIVE' || d.status === 'EFFECTIVE').length;
    const superseded = categoryDocs.filter(d => d.status === 'SUPERSEDED' || d.status === 'SUPERSEDED_ARCHIVED' || d.is_superseded).length;
    const obsolete = categoryDocs.filter(d => d.status === 'OBSOLETE' || d.status === 'OBSOLETE_ARCHIVED' || d.is_obsolete).length;
    const total = categoryDocs.length;
    return { active, superseded, obsolete, total };
  }, [categoryDocs]);

  // Global metrics stats for notifications & test compatibility
  const stats = useMemo(() => {
    const total = accessibleDocs.length;
    const active = accessibleDocs.filter(d => d.status === 'ACTIVE' || d.status === 'EFFECTIVE').length;
    const superseded = accessibleDocs.filter(d => d.status === 'SUPERSEDED' || d.status === 'SUPERSEDED_ARCHIVED' || d.is_superseded).length;
    const obsolete = accessibleDocs.filter(d => d.status === 'OBSOLETE' || d.status === 'OBSOLETE_ARCHIVED' || d.is_obsolete).length;
    const pending = accessibleDocs.filter(d => (d.status || '').startsWith('PENDING_')).length;
    const dueSoon = accessibleDocs.filter(d => {
      const v = getValidityInfo(d);
      return v.status === 'DUE_SOON' || v.status === 'OVERDUE';
    }).length;

    return { total, active, superseded, obsolete, pending, dueSoon };
  }, [accessibleDocs]);

  // Filtered Docs for Data Grid (Scoped to Category + Status + Toolbar Filters)
  const filteredDocs = useMemo(() => {
    return categoryDocs.filter(doc => {
      // 4-Status Segmented Pill Filter
      if (statusFilter === 'ACTIVE') {
        const isActive = doc.status === 'ACTIVE' || doc.status === 'EFFECTIVE';
        if (!isActive) return false;
      } else if (statusFilter === 'SUPERSEDED') {
        const isSuperseded = doc.status === 'SUPERSEDED' || doc.status === 'SUPERSEDED_ARCHIVED' || doc.is_superseded;
        if (!isSuperseded) return false;
      } else if (statusFilter === 'OBSOLETE') {
        const isObsolete = doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED' || doc.is_obsolete;
        if (!isObsolete) return false;
      }
      // 'ALL' shows all records in category

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
        const source = (doc.source || '').toLowerCase();
        const ver = (doc.sourceVersion || doc.edition || '').toLowerCase();
        return code.includes(term) || title.includes(term) || titleTh.includes(term) || source.includes(term) || ver.includes(term);
      }

      return true;
    });
  }, [categoryDocs, statusFilter, deptFilter, scopeFilter, searchTerm]);

  // Universal Pagination Engine
  const pagination = useTablePagination(filteredDocs, 10);

  // Active documents pool for Header Action Selectors
  const selectableActiveDocs = useMemo(() => {
    return accessibleDocs.filter(d => d.status === 'ACTIVE' || d.status === 'EFFECTIVE');
  }, [accessibleDocs]);

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
    setDocToEdit(null);
    setIsModalOpen(true);
  };

  const handleRevise = (doc) => {
    setOpenMenuDocId(null);
    setDocToEdit(doc);
    setIsModalOpen(true);
  };

  const handlePreview = (doc) => {
    setOpenMenuDocId(null);
    setDocToPreview(doc);
    setIsPreviewOpen(true);
  };

  const handleObsolete = (doc) => {
    setOpenMenuDocId(null);
    setDocToObsolete(doc);
    setIsObsoleteModalOpen(true);
  };

  const handleHistory = (doc) => {
    setOpenMenuDocId(null);
    setDocToHistory(doc);
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
    let watermarkPreset = WATERMARK_TYPES.UNCONTROLLED_COPY;

    if (isObsolete) {
      watermarkPreset = WATERMARK_TYPES.OBSOLETE;
    } else if (doc.accessScope === 'Restricted') {
      watermarkPreset = WATERMARK_TYPES.STRICTLY_CONFIDENTIAL;
    }

    const docCode = doc.edCode || doc.doc_code || doc.docNo || doc.id || 'ED-DOC-001';
    const toastId = toast.loading(`กำลังประทับลายน้ำเอกสารภายนอก ${docCode}...`);

    try {
      await UniversalWatermarkService.downloadWatermarkedPdf(
        {
          id: doc.id,
          title: docCode,
          name: doc.title,
          docTitle: doc.title,
          ...doc
        },
        watermarkPreset,
        {
          userName: currentUser?.name || 'User',
          userDept: uDept,
          reason: 'External Document Download / Print',
          location: uDept,
          watermarkType: watermarkPreset
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
        escape(doc.source || '-'),
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
          <CheckCircle2 size={13} strokeWidth={2} />
          <span>มีผลบังคับใช้</span>
        </span>
      );
    }
    if (isSuperseded) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] whitespace-nowrap shadow-2xs">
          <Clock size={13} />
          <span>ฉบับตกรุ่น</span>
        </span>
      );
    }
    if (isObsolete) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5] whitespace-nowrap shadow-2xs">
          <XCircle size={13} strokeWidth={2} />
          <span>ยกเลิกถาวร</span>
        </span>
      );
    }
    if (status === 'PENDING_EXT_REVIEW') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFF8E6] text-[#D49800] border border-[#FFE785] whitespace-nowrap shadow-2xs">
          <Clock size={13} />
          <span>รอทบทวน</span>
        </span>
      );
    }
    if (status === 'PENDING_EXT_APPROVAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFF8E6] text-[#D49800] border border-[#FFE785] whitespace-nowrap shadow-2xs">
          <Clock size={13} />
          <span>รออนุมัติ</span>
        </span>
      );
    }
    if (status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FEECE8] text-[#F24822] border border-[#FAD3CC] whitespace-nowrap shadow-2xs">
          <X size={13} />
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
            <Lock size={13} /> ลับเฉพาะ
          </span>
        );
      case 'Department':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF8E6] text-[#B87C33] border border-[#FDE6B0]">
            <Building2 size={13} /> เฉพาะแผนก
          </span>
        );
      case 'General':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]">
            <Globe size={13} /> ทั่วไป
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-4 pb-12">
      {/* 1. Page Header Card with 3 ED Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-[#E2E8F0] rounded-2xl p-4.5 shadow-2xs">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-xl bg-[#E5F4FF] text-[#0D99FF] shrink-0 shadow-2xs">
            <Globe className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#1E293B] tracking-tight">
              คลังเอกสารภายนอก (External Document Library)
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
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
          <Globe size={16} strokeWidth={activeMainTab === TAB_GENERAL ? 2 : 1.75} />
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
          <Building2 size={16} strokeWidth={activeMainTab === TAB_MY_DEPT ? 2 : 1.75} />
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
          <Share2 size={16} strokeWidth={activeMainTab === TAB_DISTRIBUTED ? 2 : 1.75} />
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

          {/* แถวที่ 2: Compact Segmented Pill Control (ครอบ Container รองรับจอเล็ก / iPad ด้วย overflow-x-auto & flex-wrap) */}
          <div className="pt-2.5 border-t border-[#F1F5F9] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Responsive Scrollable & Wrap Capsule Pill Container */}
            <div className="w-full sm:w-auto overflow-x-auto scrollbar-hide py-0.5">
              <div className="inline-flex items-center gap-1 p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl shadow-2xs shrink-0 whitespace-nowrap">
                {[
                  { id: 'ACTIVE', label: '✓ มีผลบังคับใช้ (Active)', count: statusCounts.active },
                  { id: 'SUPERSEDED', label: '⏳ ฉบับตกรุ่น (Superseded)', count: statusCounts.superseded },
                  { id: 'OBSOLETE', label: '🚫 ยกเลิกถาวร (Obsolete)', count: statusCounts.obsolete },
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
                แสดงผล <strong className="text-[#1E293B] font-bold">{filteredDocs.length}</strong> จาก {categoryDocs.length} รายการ
              </span>
            </div>
          </div>
        </div>

        {/* Bento Data Grid Table */}
        <div className="w-full flex-1 overflow-y-auto overflow-x-auto min-h-0 scrollbar-thin">
          <table className="w-full text-left text-sm table-auto min-w-full border-collapse">
            <thead className="bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] sticky top-0 z-20 whitespace-nowrap backdrop-blur-xs shadow-xs">
              <tr>
                <th className="w-[85px] min-w-[85px] py-3 px-3 text-center select-none bg-[#F8FAFC]">การจัดการ</th>
                <th className="w-[32%] min-w-[240px] py-3 px-3.5 select-none bg-[#F8FAFC]">รหัสและชื่อเอกสาร</th>
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

                  return (
                    <tr 
                      key={doc.id || `${edCode}-${idx}`}
                      className={`hover:bg-[#F8FAFC] transition-colors duration-150 cursor-pointer group ${
                        isMenuOpen ? 'relative z-10 bg-[#F8FAFC]' : ''
                      }`}
                      onClick={() => handlePreview(doc)}
                    >
                      {/* 1. เครื่องมือและการจัดการ (Action Dock with direct buttons + 3-dot dropdown) */}
                      <td className="px-2.5 py-3 whitespace-nowrap text-xs text-center relative z-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1 ed-action-dock">
                          {/* Quick Preview Button */}
                          <button
                            type="button"
                            onClick={() => handlePreview(doc)}
                            className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:text-[#0D99FF] hover:border-[#0D99FF] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                            title="ดูตัวอย่างเอกสาร"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Quick Watermarked Download Button */}
                          <button
                            type="button"
                            onClick={(e) => handleDownload(doc, e)}
                            className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:text-[#10B981] hover:border-[#10B981] hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="ดาวน์โหลด PDF พร้อมลายน้ำ (Watermarked PDF)"
                          >
                            <Download size={14} />
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
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isMenuOpen
                                  ? 'bg-[#0D99FF] text-white border-[#0D99FF] shadow-xs'
                                  : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                              }`}
                              title="เมนูการจัดการเพิ่มเติม (Row-Level Actions)"
                            >
                              <MoreHorizontal size={14} />
                            </button>

                            {/* Dropdown Menu Popup */}
                            {isMenuOpen && (
                              <div 
                                className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-56 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-50 py-1.5 text-left ed-dropdown-menu divide-y divide-slate-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => handlePreview(doc)}
                                    className="w-full px-3.5 py-2 text-xs text-[#1E293B] hover:bg-[#F8FAFC] flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                                  >
                                    <Eye size={14} className="text-[#0D99FF]" />
                                    <span>ดูตัวอย่างเอกสาร</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDownload(doc, e)}
                                    className="w-full px-3.5 py-2 text-xs text-[#1E293B] hover:bg-[#F8FAFC] flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                                  >
                                    <Download size={14} className="text-[#10B981]" />
                                    <span>ดาวน์โหลด PDF (มีลายน้ำ)</span>
                                  </button>
                                </div>

                                {isActive && (
                                  <div className="py-1">
                                    <button
                                      type="button"
                                      onClick={() => handleRequestPhysicalCopy(doc)}
                                      className="w-full px-3.5 py-2 text-xs text-[#1E293B] hover:bg-[#F8FAFC] flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                                      title="ขอสำเนาควบคุมหน้างาน (Request Physical Copy)"
                                    >
                                      <Layers size={14} className="text-indigo-600" />
                                      <span>ขอสำเนาควบคุมหน้างาน</span>
                                    </button>
                                  </div>
                                )}

                                {/* Row-Level Core Actions: อัปเดตฉบับใหม่ / ขอยกเลิกเอกสาร */}
                                {isAdmin && (
                                  <div className="py-1">
                                    <button
                                      type="button"
                                      onClick={() => handleRevise(doc)}
                                      className="w-full px-3.5 py-2 text-xs text-[#D97706] hover:bg-[#FFFBEB] flex items-center gap-2.5 transition-colors font-semibold cursor-pointer"
                                      title="แก้ไขหรือทบทวนเวอร์ชันใหม่"
                                    >
                                      <RotateCw size={14} className="text-[#D97706]" />
                                      <span>อัปเดตฉบับใหม่ (Next Rev)</span>
                                    </button>

                                    {isActive && (
                                      <button
                                        type="button"
                                        onClick={() => handleObsolete(doc)}
                                        className="w-full px-3.5 py-2 text-xs text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2.5 transition-colors font-semibold cursor-pointer"
                                        title="ขอยกเลิกเอกสาร"
                                      >
                                        <Archive size={14} className="text-[#DC2626]" />
                                        <span>ขอยกเลิกการใช้งาน (Obsolete)</span>
                                      </button>
                                    )}
                                  </div>
                                )}

                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => handleHistory(doc)}
                                    className="w-full px-3.5 py-2 text-xs text-[#64748B] hover:bg-[#F8FAFC] flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                                  >
                                    <History size={14} />
                                    <span>ประวัติเอกสารและการแก้ไข</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

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
                            <span className="text-[11px] text-[#64748B] font-mono font-medium">
                              Rev.{doc.rev || doc.sourceVersion || '01'}
                            </span>
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
                              {doc.source || 'หน่วยงานภายนอก'}
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
                          <span className="font-mono text-xs text-slate-500 mt-1" title="วันที่มีผลบังคับใช้">
                            {doc.effectiveDate || '-'}
                          </span>
                        </div>
                      </td>

                      {/* 5. รอบทบทวนและความถูกต้อง */}
                      <td className="py-3 px-3.5 align-middle">
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-xs text-slate-700 font-medium">
                            ทุก {doc.reviewCycleMonths || 12} เดือน
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${validity.colorClass}`}>
                            {validity.status === 'OVERDUE' && <AlertTriangle size={11} />}
                            {validity.status === 'DUE_SOON' && <Clock size={11} />}
                            {validity.status === 'NORMAL' && <CheckCircle size={11} />}
                            {validity.label}
                          </span>
                        </div>
                      </td>

                      {/* 6. สถานะเอกสาร */}
                      <td className="py-3 px-3.5 align-middle text-center whitespace-nowrap">
                        {getStatusBadge(doc)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center text-[#888888]">
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectModalMode(null)}
              className="fixed inset-0 bg-stone-900/30 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="relative bg-white border border-[#E2E8F0] w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] rounded-2xl shadow-xl z-10 my-auto"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
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
              <div className="p-4 overflow-y-auto max-h-[50vh] space-y-2 divide-y divide-slate-100">
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
              <div className="px-6 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectModalMode(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  ปิด
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 5. Connected Workflows & Operations Modals */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <ExternalDocFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setDocToEdit(null);
        }}
        documentToEdit={docToEdit}
      />

      <ExternalDocPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setDocToPreview(null);
        }}
        document={docToPreview}
      />

      <ExternalDocHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          setDocToHistory(null);
        }}
        document={docToHistory}
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
