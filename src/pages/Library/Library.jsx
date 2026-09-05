import React, { useState, useEffect, useMemo } from 'react';
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
  Edit3
} from 'lucide-react';
import { getRequesterName, getReviewerName, getApproverName, getAckNames } from '../../utils/darHelper';
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

  const userDepts = currentUser?.depts || (currentUser?.department ? [currentUser.department] : []);

  // Helper for QA vs QA/QC match, supporting array of user departments
  const isSameDept = (userDeptsArr, d) => {
    if (!d) return false;
    return (userDeptsArr || []).some(u => u === d || (u === 'QA' && d === 'QA/QC') || (u === 'QA/QC' && d === 'QA'));
  };

  const isOwnerDept = (doc) => {
    return isSameDept(userDepts, doc.owner_dept || doc.department);
  };

  const isDistributedToUser = (doc) => {
    // If own department owns it, it belongs in "เอกสารในแผนกฉัน"
    if (isOwnerDept(doc)) return false;

    const scope = doc.access_control?.scope || doc.access_scope || 'GENERAL';

    // 1. Has physical controlled copy assigned to user's department
    const hasPhysicalCopy = 
      (doc.distributions || []).some(d => isSameDept(userDepts, d.departmentId || d.department || d.dept)) ||
      (doc.target_depts || []).some(d => isSameDept(userDepts, d)) ||
      (controlledCopyInstances || documentControlledCopies || []).some(c => 
        (String(c.docId || c.doc_id) === String(doc.id) || c.doc_code === doc.title || c.docTitle === doc.title) &&
        isSameDept(userDepts, c.holder_dept || c.department) &&
        ['ISSUED_ACTIVE', 'ACTIVE'].includes(c.status)
      );

    // 2. Targeted scope with user's dept in authorized_depts
    const isSharedTarget = scope === 'TARGETED' && (
      (doc.access_control?.authorized_depts || []).some(d => isSameDept(userDepts, d)) ||
      (doc.target_depts || []).some(d => isSameDept(userDepts, d))
    );

    // 3. Restricted scope with user explicitly authorized or qualifying level
    const isSharedRestricted = scope === 'RESTRICTED' && (
      (doc.access_control?.authorized_users || []).includes(currentUser?.id) ||
      (doc.access_control?.min_access_level && currentUser?.level >= doc.access_control.min_access_level)
    );

    return Boolean(hasPhysicalCopy || isSharedTarget || isSharedRestricted);
  };

  // Status Normalization Helper for Universal Tab Filtering
  const matchesStatusTab = (docStatus, selectedTab, doc = null) => {
    const st = (docStatus || (doc && doc.status) || '').toUpperCase();
    if (!selectedTab || selectedTab === 'ALL' || selectedTab === '') return true;
    
    if (selectedTab === 'EFFECTIVE') {
      const isSuperseded = st === 'SUPERSEDED' || st === 'SUPERSEDED_ARCHIVED' || st === 'OUTDATED' || Boolean(doc?.is_superseded);
      const isObsolete = st === 'OBSOLETE' || st === 'OBSOLETE_ARCHIVED' || st === 'ARCHIVED_OBSOLETE' || st === 'OBSOLETE_PENDING_RECALL' || st.startsWith('OBSOLETE') || Boolean(doc?.is_obsolete);
      if (isSuperseded || isObsolete) return false;
      return st === 'EFFECTIVE' || st === 'ACTIVE' || st === 'APPROVED' || st === 'PUBLISHED';
    }
    if (selectedTab === 'SUPERSEDED') {
      return st === 'SUPERSEDED' || st === 'SUPERSEDED_ARCHIVED' || st === 'OUTDATED' || Boolean(doc?.is_superseded);
    }
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

  // ดึงรหัสแผนกของผู้ใช้งานปัจจุบัน (Normalize ป้องกัน Bug)
  const userDept = (currentUser?.department || currentUser?.dept_code || currentUser?.dept || '').toUpperCase();
  const isDcc = Boolean(currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.role === 'DCC');

  // ขั้นตอนที่ 1: กรองตาม Scope แท็บหลัก (ห้ามดักกรอง status ตรงนี้เด็ดขาด!)
  const baseDocs = useMemo(() => {
    return (documents || []).filter((doc) => {
      const docDept = (doc.department || doc.owner_dept || doc.dept_code || '').toUpperCase();
      const docScope = (doc.access_control?.scope || doc.access_scope || doc.scope || 'GENERAL').toUpperCase();

      const activeScopeTab = activeTab; // Map to the tab currently selected in the UI

      if (activeScopeTab === TAB_GENERAL || activeScopeTab === 'general') {
        return docScope === 'GENERAL' || isDcc;
      }
      if (activeScopeTab === TAB_MY_DEPT || activeScopeTab === 'dept') {
        // แสดงเอกสารของแผนกตนเองทุกฉบับ (หรือทุกเอกสารหากเป็น DCC)
        return isDcc || docDept === userDept;
      }
      if (activeScopeTab === TAB_DISTRIBUTED || activeScopeTab === 'dist') {
        const distList = (doc.distributed_depts || []).map((d) => String(d).toUpperCase());
        return isDcc || distList.includes(userDept) || isDistributedToUser(doc);
      }
      return true;
    });
  }, [documents, activeTab, userDept, isDcc]);

  // Compute Counts for All Tabs
  // We can just use the fast filtering logic to get raw counts for badges
  const accessibleDocs = (documents || []).filter(d => hasDocumentAccess(d, currentUser));
  const generalDocsCount = accessibleDocs.filter(d => (d.access_control?.scope || d.access_scope || 'GENERAL') === 'GENERAL').length;
  const myDeptDocsCount = accessibleDocs.filter(d => isOwnerDept(d)).length;
  const distributedDocsCount = accessibleDocs.filter(d => isDistributedToUser(d)).length;
  const tabFilteredDocs = baseDocs;

  const filteredDocs = useMemo(() => {
    return baseDocs.filter((doc) => {
      // 1. กรองตามสถานะ (มีผลบังคับใช้ / ตกรุ่น / ยกเลิก / ทั้งหมด)
      if (!matchesStatusTab(doc.status, filterStatus, doc)) return false;

      // 2. กรองตามประเภทเอกสาร
      if (filterType && filterType !== 'ALL') {
        const docType = (doc.doc_type || doc.type || '').toUpperCase();
        if (docType !== filterType.toUpperCase()) return false;
      }

      // 3. กรองตามแผนก
      if (filterDept && filterDept !== 'ALL') {
        const docDept = (doc.department || doc.dept_code || '').toUpperCase();
        if (docDept !== filterDept.toUpperCase()) return false;
      }

      // 4. กรองตามคำค้นหา
      if (searchTerm && searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const code = (doc.document_code || doc.doc_code || doc.id || '').toLowerCase();
        const title = (doc.title || doc.document_title || '').toLowerCase();
        if (!code.includes(q) && !title.includes(q)) return false;
      }

      // 5. กรองตามระดับความลับและวันที่และมาตรฐาน
      if (filterAccessScope) {
        const scope = doc.access_control?.scope || doc.access_scope || 'GENERAL';
        if (scope !== filterAccessScope) return false;
      }
      if (filterStandard) {
        const stds = doc.relatedStandards || doc.related_standards || [];
        if (!stds.includes(filterStandard)) return false;
      }
      if (filterDate) {
        if (doc.effectiveDate !== filterDate && doc.effective_date !== filterDate) return false;
      }

      return true;
    });
  }, [baseDocs, filterStatus, filterType, filterDept, searchTerm, filterAccessScope, filterStandard, filterDate]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalItems
  } = useTablePagination(filteredDocs, 10);

  const availableTypes = [...new Set([
    ...accessibleDocs.map(doc => (doc.title || '').split('-')[0]),
    ...(documentTypes || []).filter(t => t.status === 'ACTIVE' || t.status === 'Active' || t.isActive !== false).map(t => t.code || t.id)
  ])].filter(Boolean).sort();

  const availableStandards = [...new Set(accessibleDocs.flatMap(doc => doc.relatedStandards || doc.related_standards || []))].filter(Boolean).sort();

  const availableDepts = [...new Set([
    ...accessibleDocs.map(doc => doc.department),
    ...(masterDepartments || storeDepts || []).filter(d => typeof d === 'string' || d.status !== 'INACTIVE').map(d => typeof d === 'string' ? d : d.id)
  ])].filter(Boolean).sort();

  const handleExport = () => {
    const docsToExport = isDccUser ? filteredDocs : (documents || []).filter(d => isOwnerDept(d) && (d.status === 'EFFECTIVE' || d.status === 'ACTIVE'));
    if (docsToExport.length === 0) return alert('ไม่มีข้อมูลสำหรับส่งออก');
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "No.,Doc No.,Title,Type,Owner Dept,Rev.,Effective Date,Requester,Reviewer,Approver,Ack,Distribution,Status\n";

    docsToExport.forEach((doc, index) => {
      const dar = (dars || []).find(d => d.id === doc.darId);
      const req = dar ? getRequesterName(dar, masterUsers) : '-';
      const rev = dar ? getReviewerName(dar, timeline) : '-';
      const app = dar ? getApproverName(dar, timeline) : '-';
      const ack = dar ? getAckNames(dar, timeline) : '-';
      const dist = (doc.distributions || []).map(d => d.departmentId || d.department).join('; ') || '-';
      
      const row = [
        index + 1,
        `"${doc.title || ''}"`,
        `"${doc.name || ''}"`,
        `"${(doc.title || '').split('-')[0] || ''}"`,
        `"${doc.department || ''}"`,
        `"${doc.rev || '00'}"`,
        `"${doc.effectiveDate || ''}"`,
        `"${req}"`,
        `"${rev}"`,
        `"${app}"`,
        `"${ack}"`,
        `"${dist}"`,
        `"${doc.status || 'EFFECTIVE'}"`
      ].join(',');
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `qms_document_library_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadUncontrolled = async (doc, e, openInTab = false) => {
    e.stopPropagation();
    const toastId = toast.loading(openInTab ? 'กำลังสร้างไฟล์ PDF และเตรียมเปิดพรีวิว...' : 'กำลังสร้างไฟล์ PDF และประทับลายน้ำ...');
    try {
      const watermarkConfig = resolveWatermarkConfig(doc, { currentUser });
      const watermarkType = watermarkConfig.watermarkType || watermarkConfig.type || WATERMARK_TYPES.UNCONTROLLED_COPY;
      
      await UniversalWatermarkService.downloadWatermarkedPdf(
        doc,
        watermarkType,
        {
          userName: currentUser?.name,
          userDept: currentUser?.department || currentUser?.dept || 'User Station',
          reason: 'General Download / Print',
          location: currentUser?.department || currentUser?.dept || 'User Station',
          ...watermarkConfig.metadata
        },
        openInTab
      );

      toast.dismiss(toastId);
      if (openInTab) {
        toast.success(`เปิดเอกสาร ${doc.title} ในแท็บใหม่เรียบร้อยแล้ว`);
      } else {
        toast.success(`ดาวน์โหลดเอกสาร ${doc.title} เรียบร้อยแล้ว`);
      }

      if (logAction) {
        logAction({
          action: 'DOWNLOAD_WATERMARK_PDF',
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
      toast.error('เกิดข้อผิดพลาดในการสร้าง PDF');
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

  const handleOpenFullViewer = (doc) => {
    if (doc.file_url || doc.fileUrl) {
      window.open(doc.file_url || doc.fileUrl, '_blank', 'noopener,noreferrer');
    } else {
      navigate(`/viewer/${doc.document_code || doc.doc_code || doc.id}`);
    }
  };

  const handleOpenDetailModal = (doc) => {
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

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterType('ALL');
    setFilterStandard('ALL');
    setFilterAccessScope('ALL');
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

  const renderFlatTable = () => (
    <div className="w-full max-w-full flex-1 flex flex-col min-h-0 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden h-auto">
      <div className="w-full flex-1 overflow-y-auto overflow-x-auto min-h-0 scrollbar-thin">
        <table className="w-full text-left text-sm table-auto min-w-[1280px] border-collapse">
          <thead className="bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] sticky top-0 z-20 whitespace-nowrap backdrop-blur-xs shadow-xs">
            <tr>
              <th className="w-[100px] min-w-[100px] py-3 px-3.5 text-center text-xs font-bold text-[#374151] uppercase tracking-wider select-none whitespace-nowrap bg-[#F8FAFC]">การจัดการ</th>
              <th className="py-3 px-3.5 w-12 text-center font-mono select-none whitespace-nowrap bg-[#F8FAFC]">ลำดับ</th>
              <th className="py-3 px-3.5 w-36 font-mono select-none whitespace-nowrap bg-[#F8FAFC]">รหัสเอกสาร</th>
              <th className="py-3 px-3.5 min-w-[280px] max-w-[420px] select-none whitespace-nowrap bg-[#F8FAFC]">ชื่อเอกสาร</th>
              <th className="py-3 px-3.5 w-32 text-center select-none whitespace-nowrap bg-[#F8FAFC]">ระดับความลับ</th>
              <th className="py-3 px-3.5 w-20 text-center select-none whitespace-nowrap bg-[#F8FAFC]">ประเภท</th>
              <th className="py-3 px-3.5 w-28 select-none whitespace-nowrap bg-[#F8FAFC]">แผนกเจ้าของ</th>
              <th className="py-3 px-3.5 w-16 text-center select-none whitespace-nowrap bg-[#F8FAFC]">ฉบับที่</th>
              <th className="py-3 px-3.5 w-28 font-mono select-none whitespace-nowrap bg-[#F8FAFC]">วันบังคับใช้</th>
              <th className="py-3 px-3.5 w-36 select-none whitespace-nowrap bg-[#F8FAFC]">ผู้ร้องขอ</th>
              <th className="py-3 px-3.5 w-36 select-none whitespace-nowrap bg-[#F8FAFC]">ผู้ทบทวน</th>
              <th className="py-3 px-3.5 w-36 select-none whitespace-nowrap bg-[#F8FAFC]">ผู้อนุมัติ</th>
              <th className="py-3 px-3.5 w-36 select-none whitespace-nowrap bg-[#F8FAFC]">การแจกจ่าย</th>
              <th className="py-3 px-3.5 w-28 text-center select-none whitespace-nowrap bg-[#F8FAFC]">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {paginatedData.map((doc, idx) => {
              const dar = (dars || []).find(d => d.id === doc.darId);
              const isOwner = isDccUser || isOwnerDept(doc);
              const isEffective = doc.status === 'EFFECTIVE' || doc.status === 'ACTIVE';

              const myDeptActiveCopies = (controlledCopyInstances || documentControlledCopies || []).filter(copy => 
                (String(copy.docId || copy.doc_id) === String(doc.id) || copy.doc_code === doc.title || copy.docTitle === doc.title) &&
                isSameDept(userDepts, copy.holder_dept || copy.department) &&
                ['ISSUED_ACTIVE', 'ACTIVE'].includes(copy.status)
              );
              const hasActiveCopiesToReport = isDccUser || myDeptActiveCopies.length > 0;
              const isMenuOpen = openMenuDocId === doc.id;

              return (
              <tr 
                key={doc.id} 
                className={`hover:bg-[#FAFAFA] transition-colors duration-150 cursor-pointer group ${isMenuOpen ? 'relative z-10 bg-[#FAFAFA]' : ''}`}
                onClick={() => setPreviewDoc(doc)}
              >
                <td className={`px-4 py-3 whitespace-nowrap text-xs ${openMenuDocId === doc.id ? 'relative z-50' : 'relative z-1'}`} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 dropdown-action-dock">
                    
                    {/* ปุ่มเปิดดูด่วน (Quick View) */}
                    <button
                      type="button"
                      title="เปิดดูตัวอย่างเอกสาร"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetailModal(doc);
                      }}
                      className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:text-[#0D99FF] hover:border-[#0D99FF] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                    >
                      <Eye size={14} />
                    </button>

                    {/* ปุ่มดาวน์โหลด PDF (Quick Download) */}
                    <button
                      type="button"
                      title={isDccUser ? 'ดาวน์โหลด Master Document (DCC)' : 'ดาวน์โหลดสำเนาไม่ควบคุม (Uncontrolled Copy)'}
                      onClick={(e) => {
                        e.stopPropagation();
                        isDccUser ? handleDownloadMaster(doc, e) : handleDownloadUncontrolled(doc, e, false);
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
                          setOpenMenuDocId(openMenuDocId === doc.id ? null : doc.id);
                        }}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          openMenuDocId === doc.id
                            ? 'bg-[#0D99FF] text-white border-[#0D99FF] shadow-xs'
                            : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <MoreHorizontal size={14} />
                      </button>

                      {/* เมนูลอย (Dropdown Menu): ใช้ z-50, min-w-[240px], shadow-2xl และ Stop Propagation ทุกปุ่ม */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`overflow-dropdown-menu absolute left-0 top-full mt-1.5 w-60 bg-white border border-[#CBD5E1] rounded-xl shadow-2xl z-50 py-1.5 divide-y divide-[#F1F5F9] animate-in fade-in-50 zoom-in-95 duration-100 ${
                          openMenuDocId === doc.id ? 'block' : 'hidden'
                        }`}
                      >
                        {/* กลุ่มที่ 1: การดูเอกสาร */}
                        <div className="py-1">
                          <button
                            type="button"
                            title="เปิดดู PDF ตัวจริงในแท็บใหม่ (Open in New Tab)"
                            onClick={(e) => {
                              setOpenMenuDocId(null);
                              handleDownloadUncontrolled(doc, e, true);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs text-[#1E293B] hover:bg-[#F0F7FF] hover:text-[#0D99FF] flex items-center gap-2.5 transition-colors font-medium group cursor-pointer"
                          >
                            <ExternalLink className="text-[#0D99FF] shrink-0" size={14} />
                            <span>เปิดดูในแท็บใหม่ (Full Viewer)</span>
                          </button>

                          <button
                            type="button"
                            title="ดูรายละเอียดและประวัติ DAR"
                            onClick={() => {
                              setOpenMenuDocId(null);
                              handleOpenDetailModal(doc);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs text-[#1E293B] hover:bg-[#F0F7FF] hover:text-[#0D99FF] flex items-center gap-2.5 transition-colors font-medium group cursor-pointer"
                          >
                            <FileText className="text-[#64748B] group-hover:text-[#0D99FF] shrink-0" size={14} />
                            <span>ดูรายละเอียดและประวัติ DAR</span>
                          </button>
                        </div>

                        {/* กลุ่มที่ 2: ฟังก์ชัน DCC (External Release & Watermark Studio) */}
                        {isDccUser && (
                          <div className="py-1">
                            <button
                              type="button"
                              title="ดาวน์โหลดสำหรับแจกจ่ายภายนอก (External Release)"
                              onClick={(e) => {
                                setOpenMenuDocId(null);
                                handleDownloadExternal(doc, e);
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
                                setStudioDoc(doc);
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
                                handleRequestAdditionalCopy(doc);
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
                                handleInitiateRevision(doc);
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
                                handleInitiateObsolete(doc);
                              }}
                              className="w-full px-3.5 py-2 text-left text-xs text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2.5 transition-colors font-medium group cursor-pointer"
                            >
                              <GitFork className="text-[#DC2626] shrink-0" size={14} />
                              <span>ขอยกเลิกเอกสารฉบับนี้</span>
                            </button>
                          </div>
                        )}

                        {/* กลุ่มที่ 5: แจ้งชำรุด/สูญหาย */}
                        {hasActiveCopiesToReport && (
                          <div className="py-1">
                            <button
                              type="button"
                              title="แจ้งเอกสารชำรุด หรือสูญหาย เพื่อขอออกเล่มทดแทน"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuDocId(null);
                                const targetCopy = myDeptActiveCopies[0] || (controlledCopyInstances || []).find(c => 
                                  (String(c.docId || c.doc_id) === String(doc.id) || c.doc_code === doc.title) &&
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
                <td className="py-3.5 px-3.5 text-center text-slate-400 font-mono text-sm whitespace-nowrap">{(currentPage - 1) * pageSize + idx + 1}</td>
                <td className="py-3.5 px-3.5 whitespace-nowrap align-middle">
                  <span className="font-mono font-bold text-sm text-[#0D99FF] bg-[#E5F4FF] border border-[#B8E1FF] px-2.5 py-0.5 rounded-md inline-block">{doc.title}</span>
                </td>
                <td className="py-3.5 px-3.5 min-w-[280px] max-w-[420px] align-middle">
                  <div className="font-medium text-[#1E293B] text-sm leading-relaxed group-hover:text-[#0D99FF] transition-colors line-clamp-2" title={doc.name}>
                    {doc.name}
                  </div>
                </td>
                <td className="py-3.5 px-3.5 text-center whitespace-nowrap align-middle">
                  {(() => {
                    const scope = doc.access_control?.scope || doc.access_scope || 'GENERAL';
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
                      const minLvl = doc.access_control?.min_access_level;
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
                  })()}
                </td>
                <td className="py-3.5 px-3.5 text-center whitespace-nowrap align-middle">
                  <span className="bg-[#F5F5F5] text-[#333333] px-2.5 py-1 rounded-md text-xs font-mono font-bold border border-[#E5E5E5]">
                    {(doc.title || '').split('-')[0]}
                  </span>
                </td>
                <td className="py-3.5 px-3.5 font-mono font-bold text-slate-700 text-sm whitespace-nowrap align-middle">
                  <span className="bg-[#F5F5F5] px-2.5 py-0.5 rounded border border-[#E5E5E5]">{doc.department}</span>
                </td>
                <td className="py-3.5 px-3.5 text-center font-mono font-bold text-slate-700 text-sm whitespace-nowrap align-middle">Rev.{doc.rev || '00'}</td>
                <td className="py-3.5 px-3.5 font-mono text-slate-600 text-sm whitespace-nowrap align-middle">{doc.effectiveDate}</td>
                <td className="py-3.5 px-3.5 text-slate-700 text-sm truncate max-w-[150px] whitespace-nowrap align-middle" title={dar ? getRequesterName(dar, masterUsers) : '-'}>
                  {dar ? getRequesterName(dar, masterUsers) : '-'}
                </td>
                <td className="py-3.5 px-3.5 text-slate-700 text-sm truncate max-w-[150px] whitespace-nowrap align-middle" title={dar ? getReviewerName(dar, timeline) : '-'}>
                  {dar ? getReviewerName(dar, timeline) : '-'}
                </td>
                <td className="py-3.5 px-3.5 text-slate-700 text-sm truncate max-w-[150px] whitespace-nowrap align-middle" title={dar ? getApproverName(dar, timeline) : '-'}>
                  {dar ? getApproverName(dar, timeline) : '-'}
                </td>
                <td className="py-3.5 px-3.5 text-slate-700 text-sm truncate max-w-[150px] whitespace-nowrap align-middle" title={(doc.distributions || []).map(d => d.departmentId || d.department).join(', ')}>
                  {(doc.distributions || []).map(d => d.departmentId || d.department).join(', ') || '-'}
                </td>
                <td className="py-3.5 px-3.5 text-center whitespace-nowrap align-middle">
                  {(() => {
                    const st = (doc.status || '').toUpperCase();
                    if (st === 'EFFECTIVE' || st === 'ACTIVE' || st === 'APPROVED' || st === 'PUBLISHED') {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]">
                          <CheckCircle2 size={13} strokeWidth={2} />
                          <span>มีผลบังคับใช้</span>
                        </span>
                      );
                    }
                    if (st === 'SUPERSEDED' || st === 'SUPERSEDED_ARCHIVED' || st === 'OUTDATED') {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                          <CheckCircle2 size={13} strokeWidth={2} />
                          <span>ฉบับตกรุ่น (Rev.{doc.rev || doc.revision || '00'})</span>
                        </span>
                      );
                    }
                    if (st === 'OBSOLETE' || st === 'ARCHIVED_OBSOLETE') {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]">
                          <CheckCircle2 size={13} strokeWidth={2} />
                          <span>ยกเลิกถาวร</span>
                        </span>
                      );
                    }
                    if (st === 'OBSOLETE_PENDING_RECALL') {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]">
                          <CheckCircle2 size={13} strokeWidth={2} />
                          <span>รอเรียกคืนสำเนา</span>
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1]">
                        <span>{doc.status}</span>
                      </span>
                    );
                  })()}
                </td>
              </tr>
            )})}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan="14" className="px-6 py-14 text-center text-[#888888]">
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
          onClick={() => setActiveTab(TAB_GENERAL)}
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
          onClick={() => setActiveTab(TAB_MY_DEPT)}
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
          onClick={() => setActiveTab(TAB_DISTRIBUTED)}
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
        
        {/* แถวที่ 1: ค้นหา + 3 Dropdowns + ปุ่มส่งออก (เรียงแถวเดียวสมบูรณ์) */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          
          {/* ช่องค้นหาเอกสาร (ขยายตามพื้นที่ว่างที่เหลือ) */}
          <div className="relative flex-1 min-w-[240px]">
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

          {/* Dropdown 1: ประเภทเอกสาร */}
          <div className="w-full lg:w-44 shrink-0">
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
          <div className="w-full lg:w-40 shrink-0">
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
          <div className="w-full lg:w-40 shrink-0">
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

        {/* แถวที่ 2: Universal Status Tabs + Summary Counter */}
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
            {(filterType !== 'ALL' && filterType !== '') || (filterStandard !== 'ALL' && filterStandard !== '') || searchTerm || filterAccessScope !== '' || (filterStatus !== 'EFFECTIVE' && filterStatus !== '') ? (
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
              แสดงผล <strong className="text-[#1E293B] font-bold">{filteredDocs.length}</strong> จากทั้งหมด {tabFilteredDocs.length} รายการ
            </span>
          </div>
        </div>
      </div>

      {renderFlatTable()}

      {/* Document Detail Modal */}
      {previewDoc && (
        <DocumentDetailModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          document={previewDoc}
          onOpenViewer={(d) => navigate(`/viewer/${d.id}/${d.rev}`)}
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
              toast.success(`บันทึกรายงานและส่งคำขอออกเล่มทดแทน (${type === 'LOST' ? 'สูญหาย' : 'ชำรุด'}) เข้าคิว DCC สำเร็จ`);
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
