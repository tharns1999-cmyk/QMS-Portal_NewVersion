import React, { useState, useMemo } from 'react';
import useStore from '../../store/useStore';
import { 
  FileText, 
  Search, 
  Plus, 
  Download, 
  Eye, 
  History, 
  Archive, 
  ShieldAlert, 
  Globe, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  FilterX, 
  RotateCw,
  Building2,
  Lock,
  ExternalLink,
  Shield,
  Layers,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import ExternalDocFormModal from './ExternalDocFormModal';
import ExternalDocPreviewModal from './ExternalDocPreviewModal';
import ExternalDocHistoryModal from './ExternalDocHistoryModal';
import ExternalDocObsoleteModal from './ExternalDocObsoleteModal';
import RequestAdditionalCopiesModal from '../../components/workflow/RequestAdditionalCopiesModal';
import UniversalWatermarkService, { WATERMARK_TYPES } from '../../services/UniversalWatermarkService';
import toast from 'react-hot-toast';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';

const ExternalDocsList = () => {
  const { externalDocuments, currentUser, logExternalDownload, masterDepartments, departments: storeDepts } = useStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, PENDING, DUE_SOON, OBSOLETE
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState('ALL');

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

  const isAdmin = Boolean(currentUser?.role === 'DCC_ADMIN' || currentUser?.isDcc || currentUser?.id === 'U001');
  const uDept = currentUser?.department || currentUser?.dept || 'QA';

  const availableDepts = useMemo(() => {
    return (masterDepartments || storeDepts || []).filter(d => typeof d === 'string' || d.status !== 'INACTIVE');
  }, [masterDepartments, storeDepts]);

  // Helper: Calculate Validity Status
  const getValidityInfo = (doc) => {
    if (doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED') {
      return { status: 'OBSOLETE', label: 'ยกเลิกแล้ว', colorClass: 'badge-inactive' };
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

  // 2. Metrics Statistics
  const stats = useMemo(() => {
    const total = accessibleDocs.length;
    const active = accessibleDocs.filter(d => d.status === 'ACTIVE' || d.status === 'EFFECTIVE').length;
    const pending = accessibleDocs.filter(d => (d.status || '').startsWith('PENDING_')).length;
    const dueSoon = accessibleDocs.filter(d => {
      const v = getValidityInfo(d);
      return v.status === 'DUE_SOON' || v.status === 'OVERDUE';
    }).length;
    const obsolete = accessibleDocs.filter(d => d.status === 'OBSOLETE' || d.status === 'OBSOLETE_ARCHIVED').length;

    return { total, active, pending, dueSoon, obsolete };
  }, [accessibleDocs]);

  // 3. Filtered Docs
  const filteredDocs = useMemo(() => {
    return accessibleDocs.filter(doc => {
      // Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ACTIVE' && (doc.status !== 'ACTIVE' && doc.status !== 'EFFECTIVE')) return false;
        if (statusFilter === 'PENDING' && !(doc.status || '').startsWith('PENDING_')) return false;
        if (statusFilter === 'OBSOLETE' && (doc.status !== 'OBSOLETE' && doc.status !== 'OBSOLETE_ARCHIVED')) return false;
        if (statusFilter === 'DUE_SOON') {
          const v = getValidityInfo(doc);
          if (v.status !== 'DUE_SOON' && v.status !== 'OVERDUE') return false;
        }
      }

      // Dept Filter
      if (deptFilter !== 'ALL' && doc.department !== deptFilter && doc.dept !== deptFilter) return false;

      // Scope Filter
      if (scopeFilter !== 'ALL' && doc.accessScope !== scopeFilter) return false;

      // Search Term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const code = (doc.edCode || doc.doc_code || doc.docNo || doc.id || '').toLowerCase();
        const title = (doc.title || '').toLowerCase();
        const source = (doc.source || '').toLowerCase();
        const ver = (doc.sourceVersion || doc.edition || '').toLowerCase();
        return code.includes(term) || title.includes(term) || source.includes(term) || ver.includes(term);
      }

      return true;
    });
  }, [accessibleDocs, statusFilter, deptFilter, scopeFilter, searchTerm]);

  // Universal Pagination Engine
  const pagination = useTablePagination(filteredDocs, 10);

  // Action Handlers
  const handleRegisterNew = () => {
    setDocToEdit(null);
    setIsModalOpen(true);
  };

  const handleRevise = (doc) => {
    setDocToEdit(doc);
    setIsModalOpen(true);
  };

  const handlePreview = (doc) => {
    setDocToPreview(doc);
    setIsPreviewOpen(true);
  };

  const handleObsolete = (doc) => {
    setDocToObsolete(doc);
    setIsObsoleteModalOpen(true);
  };

  const handleHistory = (doc) => {
    setDocToHistory(doc);
    setIsHistoryOpen(true);
  };

  const handleRequestPhysicalCopy = (doc) => {
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

  // Watermarked PDF Download Integration
  const handleDownload = async (doc, e) => {
    if (e) e.stopPropagation();

    const isObsolete = doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED';
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
          rev: doc.rev || doc.sourceVersion || '01',
          department: doc.department || uDept,
          effectiveDate: doc.effectiveDate,
          status: doc.status || 'ACTIVE',
          sourceVersion: doc.sourceVersion || doc.edition,
          source: doc.source,
          isExternal: true,
          is_external: true,
          doc_type: 'ED',
          docType: 'ED'
        },
        watermarkPreset,
        {
          docCode,
          docTitle: doc.title,
          title: doc.title,
          docVersion: doc.rev || '01',
          sourceVersion: doc.sourceVersion || doc.edition,
          source: doc.source,
          userName: currentUser?.name || 'Authorized User',
          userDept: currentUser?.department || uDept,
          authorizedScope: doc.accessScope === 'Restricted' ? 'Restricted External Release' : 'Standard External Reference',
          dccName: currentUser?.name || 'DCC Admin',
          isExternal: true,
          is_external: true,
          doc_type: 'ED',
          docType: 'ED'
        }
      );

      if (logExternalDownload) {
        logExternalDownload(doc.id);
      }
      toast.success(`ดาวน์โหลดเอกสาร ${docCode} สำเร็จ พร้อมลายน้ำตามสิทธิ์`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการสร้างเอกสาร PDF', { id: toastId });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
      case 'EFFECTIVE':
        return (
          <span className="bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9] px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 leading-snug">
            <CheckCircle size={13} /> ใช้งานอยู่
          </span>
        );
      case 'PENDING_EXT_REVIEW':
        return (
          <span className="bg-[#FFF8E6] text-[#D49800] border border-[#FFE785] px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 leading-snug">
            <Clock size={13} /> รอทบทวน
          </span>
        );
      case 'PENDING_EXT_APPROVAL':
        return (
          <span className="bg-[#FFF8E6] text-[#D49800] border border-[#FFE785] px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 leading-snug">
            <Clock size={13} /> รออนุมัติ
          </span>
        );
      case 'OBSOLETE':
      case 'OBSOLETE_ARCHIVED':
        return (
          <span className="bg-[#FEECE8] text-[#F24822] border border-[#FAD3CC] px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 leading-snug">
            <Archive size={13} /> ยกเลิก
          </span>
        );
      case 'REJECTED':
        return (
          <span className="bg-[#FEECE8] text-[#F24822] border border-[#FAD3CC] px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 leading-snug">
            <X size={13} /> ไม่อนุมัติ
          </span>
        );
      default:
        return (
          <span className="bg-[#F0F0F0] text-[#666666] border border-[#E5E5E5] px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center leading-snug">
            {status || 'Draft'}
          </span>
        );
    }
  };

  const getScopeBadge = (scope) => {
    switch (scope) {
      case 'Restricted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF2F0] text-[#F24822] border border-[#FDC4B8]">
            <Lock size={13} /> Restricted
          </span>
        );
      case 'Department':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF8E6] text-[#B87C33] border border-[#FDE6B0]">
            <Building2 size={13} /> Department
          </span>
        );
      case 'General':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]">
            <Globe size={13} /> General
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-4 pb-12">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-[#E5F4FF] text-[#0D99FF] shrink-0">
            <FileText className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1E1E1E] tracking-tight">
              ระบบควบคุมเอกสารภายนอกและกฎหมาย
            </h1>
            <p className="text-xs text-[#666666] mt-0.5">
              ทะเบียนควบคุมมาตรฐานสากล กฎหมาย และคู่มือผู้ผลิตภายนอกตามข้อกำหนด ISO 9001:2015 Clause 7.5.3.2
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRegisterNew}
          className="h-9 px-4 text-xs font-semibold text-white bg-[#0D99FF] hover:bg-[#007BE5] active:bg-[#0066BE] rounded-lg shadow-xs inline-flex items-center justify-center gap-2 shrink-0 transition-colors cursor-pointer"
        >
          <Plus size={15} strokeWidth={2} />
          <span>ลงทะเบียนเอกสารภายนอก</span>
        </button>
      </div>

      {/* 2. 4-Column Responsive Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
        {/* การ์ด 1: เอกสารทั้งหมด */}
        <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-sm font-semibold text-[#4B5563]">เอกสารทั้งหมด</p>
            <p className="text-3xl font-bold font-mono text-[#1E293B] mt-1">{stats.total}</p>
            <p className="text-xs text-[#6B7280] mt-0.5 font-mono">Total External Docs</p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#E5F4FF] text-[#0D99FF]">
            <Layers size={20} strokeWidth={1.75} />
          </div>
        </div>

        {/* การ์ด 2: ใช้งานอยู่ */}
        <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-sm font-semibold text-[#4B5563]">ใช้งานอยู่</p>
            <p className="text-3xl font-bold font-mono text-[#14AE5C] mt-1">{stats.active}</p>
            <p className="text-xs text-[#6B7280] mt-0.5 font-mono">Active / Effective</p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#E6F7ED] text-[#14AE5C]">
            <CheckCircle size={20} strokeWidth={1.75} />
          </div>
        </div>

        {/* การ์ด 3: รอทบทวน/อนุมัติ */}
        <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-sm font-semibold text-[#4B5563]">รอทบทวน/อนุมัติ</p>
            <p className="text-3xl font-bold font-mono text-[#B87C33] mt-1">{stats.pending}</p>
            <p className="text-xs text-[#6B7280] mt-0.5 font-mono">Pending Workflow</p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#FFF8E6] text-[#D49800]">
            <Clock size={20} strokeWidth={1.75} />
          </div>
        </div>

        {/* การ์ด 4: ใกล้/เกินกำหนดทบทวน */}
        <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-sm font-semibold text-[#4B5563]">ใกล้/เกินกำหนดทบทวน</p>
            <p className="text-3xl font-bold font-mono text-[#F24822] mt-1">{stats.dueSoon}</p>
            <p className="text-xs text-[#6B7280] mt-0.5 font-mono">Validity Review Due</p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#FFF2F0] text-[#F24822]">
            <AlertTriangle size={20} strokeWidth={1.75} />
          </div>
        </div>
      </div>

      {/* 3. Main Data Card with Filter Bar & Table (Full Width) */}
      <div className="w-full bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-2xs h-auto">
        {/* Filter Toolbar */}
        <div className="p-4 border-b border-[#E5E5E5] bg-white space-y-3">
          {/* Top Row: Tabs & Search */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            {/* Status Tabs */}
            <div className="flex items-center overflow-x-auto scrollbar-none gap-1.5 p-1 bg-[#F5F5F5] rounded-xl border border-[#E5E5E5]">
              {[
                { id: 'ALL', label: 'ทั้งหมด', count: stats.total },
                { id: 'ACTIVE', label: 'ใช้งานอยู่', count: stats.active },
                { id: 'PENDING', label: 'รอพิจารณา', count: stats.pending },
                { id: 'DUE_SOON', label: 'ใกล้ครบกำหนด', count: stats.dueSoon },
                { id: 'OBSOLETE', label: 'ยกเลิก/ตกรุ่น', count: stats.obsolete }
              ].map(tab => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`flex items-center gap-2 py-2 px-3.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap shrink-0 border cursor-pointer ${
                      isActive
                        ? 'bg-white border-[#E5E5E5] text-[#1E1E1E] shadow-xs'
                        : 'bg-transparent border-transparent text-[#666666] hover:bg-[#EAEAEA] hover:text-[#1E1E1E]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      isActive ? 'bg-[#F5F5F5] text-[#1E1E1E] border border-[#E5E5E5]' : 'bg-[#EAEAEA] text-[#999999]'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999999]" size={16} />
              <input 
                type="text" 
                placeholder="ค้นหารหัส ED, ชื่อ, แหล่งที่มา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 h-10 bg-white border border-[#E5E5E5] rounded-lg text-sm font-medium focus:outline-none focus:border-[#0D99FF] focus:ring-1 focus:ring-[#0D99FF] transition-all placeholder:text-[#999999]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#666666]"
                >
                  <FilterX size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#4B5563]">แผนก:</span>
              <select 
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="px-3 py-2 h-10 bg-white border border-[#E5E5E5] rounded-lg font-medium text-sm text-[#333333] outline-none focus:border-[#0D99FF] focus:ring-1 focus:ring-[#0D99FF] cursor-pointer"
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

            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#4B5563]">ระดับสิทธิ์:</span>
              <select 
                value={scopeFilter}
                onChange={e => setScopeFilter(e.target.value)}
                className="px-3 py-2 h-10 bg-white border border-[#E5E5E5] rounded-lg font-medium text-sm text-[#333333] outline-none focus:border-[#0D99FF] focus:ring-1 focus:ring-[#0D99FF] cursor-pointer"
              >
                <option value="ALL">ทุกระดับสิทธิ์</option>
                <option value="General">ทั่วไป</option>
                <option value="Department">เฉพาะแผนก</option>
                <option value="Restricted">จำกัดสิทธิ์</option>
              </select>
            </div>

            {(statusFilter !== 'ALL' || deptFilter !== 'ALL' || scopeFilter !== 'ALL' || searchTerm) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setDeptFilter('ALL');
                  setScopeFilter('ALL');
                  setSearchTerm('');
                }}
                className="text-xs text-[#0D99FF] hover:text-[#007BE5] font-semibold flex items-center gap-1 ml-auto cursor-pointer"
              >
                <FilterX size={14} /> ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full scrollbar-thin">
          <table className="w-full text-left text-sm text-[#1E293B] border-collapse">
            <thead className="bg-[#F8FAFC] text-[#374151] uppercase font-bold text-xs tracking-wider border-b border-[#E2E8F0] sticky top-0 z-10 shadow-xs backdrop-blur-sm whitespace-nowrap">
              <tr>
                <th className="py-3 px-3.5 text-left font-bold uppercase tracking-wider select-none whitespace-nowrap bg-[#F8FAFC]">รหัสเอกสาร</th>
                <th className="py-3 px-3.5 text-left font-bold uppercase tracking-wider select-none whitespace-nowrap bg-[#F8FAFC]">ชื่อเอกสาร & แหล่งที่มา</th>
                <th className="py-3 px-3.5 text-left font-bold uppercase tracking-wider select-none whitespace-nowrap bg-[#F8FAFC]">แผนกผู้ดูแล</th>
                <th className="py-3 px-3.5 text-left font-bold uppercase tracking-wider select-none whitespace-nowrap bg-[#F8FAFC]">ระดับสิทธิ์</th>
                <th className="py-3 px-3.5 text-left font-bold uppercase tracking-wider select-none whitespace-nowrap bg-[#F8FAFC]">รอบทบทวน</th>
                <th className="py-3 px-3.5 text-center font-bold uppercase tracking-wider select-none whitespace-nowrap bg-[#F8FAFC]">สถานะ</th>
                <th className="py-3 px-3.5 text-center font-bold uppercase tracking-wider select-none whitespace-nowrap bg-[#F8FAFC]">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {pagination.paginatedData.length > 0 ? (
                pagination.paginatedData.map((doc) => {
                  const edCode = doc.edCode || doc.doc_code || doc.docNo || doc.id;
                  const validity = getValidityInfo(doc);
                  const isActive = doc.status === 'ACTIVE' || doc.status === 'EFFECTIVE';
                  const isObsolete = doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED';

                  return (
                    <tr 
                      key={doc.id}
                      className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                      onClick={() => handlePreview(doc)}
                    >
                      {/* 1. Document Code & Badge */}
                      <td className="py-3.5 px-3.5 align-middle">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#0D99FF] bg-[#E5F4FF] px-2.5 py-0.5 rounded-md border border-[#B8E1FF] shadow-2xs">
                            {edCode}
                          </span>
                          {doc.is_external && (
                            <span className="p-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200" title="เอกสารจากหน่วยงานภายนอก">
                              <Globe size={13} />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#64748B] font-mono mt-1">
                          Rev.{doc.rev || doc.sourceVersion || '01'}
                          {doc.sourceVersion && doc.sourceVersion !== doc.rev && ` (${doc.sourceVersion})`}
                        </div>
                      </td>

                      {/* 2. Title & Source */}
                      <td className="py-3.5 px-3.5 align-middle">
                        <div className="font-medium text-[#1E293B] text-sm leading-relaxed group-hover:text-[#0D99FF] transition-colors">
                          {doc.title}
                        </div>
                        {doc.titleTh && doc.titleTh !== doc.title && (
                          <div className="text-xs text-[#64748B] mt-0.5 font-normal">
                            {doc.titleTh}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-[#64748B] font-medium flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Building2 size={12} className="text-slate-400" />
                            {doc.source || 'หน่วยงานภายนอก'}
                          </span>
                          {doc.category && (
                            <>
                              <span>•</span>
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-600">
                                {doc.category}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* 3. Department */}
                      <td className="py-3.5 px-3.5 align-middle whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-[#F5F5F5] rounded-lg text-slate-700 font-mono text-xs font-bold border border-slate-200/80">
                          {doc.department || 'QA'}
                        </span>
                      </td>

                      {/* 4. Access Scope */}
                      <td className="py-3.5 px-3.5 align-middle whitespace-nowrap">
                        {getScopeBadge(doc.accessScope)}
                      </td>

                      {/* 5. Review Cycle & Validity */}
                      <td className="py-3.5 px-3.5 align-middle whitespace-nowrap">
                        <div className="text-xs font-medium text-[#1E1E1E]">
                          ทุก {doc.reviewCycleMonths || 12} เดือน
                        </div>
                        <div className="mt-1">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${validity.colorClass}`}>
                            {validity.status === 'OVERDUE' && <AlertTriangle size={11} />}
                            {validity.status === 'DUE_SOON' && <Clock size={11} />}
                            {validity.status === 'NORMAL' && <CheckCircle size={11} />}
                            {validity.label}
                          </span>
                        </div>
                      </td>

                      {/* 6. Status Badge */}
                      <td className="py-3.5 px-3.5 align-middle text-center whitespace-nowrap">
                        {getStatusBadge(doc.status)}
                      </td>

                      {/* 7. Actions */}
                      <td className="py-3.5 px-3.5 align-middle text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {/* 1. Preview Button */}
                          <button
                            type="button"
                            onClick={() => handlePreview(doc)}
                            className="action-icon-btn text-[#666666] hover:text-[#0D99FF] hover:bg-[#E5F4FF] cursor-pointer"
                            title="ดูตัวอย่างเอกสาร"
                          >
                            <Eye size={16} />
                          </button>

                          {/* 2. Watermark Download Button */}
                          <button
                            type="button"
                            onClick={(e) => handleDownload(doc, e)}
                            className="action-icon-btn text-[#666666] hover:text-[#10B981] hover:bg-emerald-50 cursor-pointer"
                            title="ดาวน์โหลด PDF พร้อมลายน้ำ (Watermarked PDF)"
                          >
                            <Download size={16} />
                          </button>

                          {/* 3. Physical Controlled Copy on Demand */}
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => handleRequestPhysicalCopy(doc)}
                              className="action-icon-btn text-[#666666] hover:text-[#0D99FF] hover:bg-[#E5F4FF] cursor-pointer"
                              title="ขอสำเนาควบคุมหน้างาน (Request Physical Copy)"
                            >
                              <Layers size={16} />
                            </button>
                          )}

                          {/* 4. Revise/Update Button (for Admin) */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleRevise(doc)}
                              className="action-icon-btn text-[#666666] hover:text-[#F59E0B] hover:bg-amber-50 cursor-pointer"
                              title="แก้ไขหรือทบทวนเวอร์ชันใหม่"
                            >
                              <RotateCw size={16} />
                            </button>
                          )}

                          {isAdmin && isActive && (
                            <button
                              type="button"
                              onClick={() => handleObsolete(doc)}
                              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-white hover:shadow-xs border border-transparent hover:border-slate-200 transition-all"
                              title="ขอยกเลิกเอกสาร"
                            >
                              <Archive size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-14 px-4 text-center text-[#888888]">
                    <AlertCircle className="mx-auto text-[#CCCCCC] mb-2" size={36} strokeWidth={1.5} />
                    <p className="text-xs font-bold text-[#1E1E1E]">ไม่พบรายการเอกสารภายนอก</p>
                    <p className="text-xs text-[#888888] mt-0.5">
                      {searchTerm ? 'ลองค้นหาด้วยคำค้นอื่น หรือล้างตัวกรอง' : 'กดปุ่ม "ลงทะเบียนเอกสารภายนอก" เพื่อเพิ่มรายการแรก'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={pagination.currentPage}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {/* Modals */}
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
