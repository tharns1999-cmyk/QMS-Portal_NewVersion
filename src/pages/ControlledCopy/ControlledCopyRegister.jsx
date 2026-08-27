import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Printer, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Building, 
  MapPin, 
  FileDown, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Layers, 
  ShieldCheck, 
  PlusCircle, 
  Check,
  History,
  FolderOpen
} from 'lucide-react';
import useStore from '../../store/useStore';
import { UniversalWatermarkService, WATERMARK_TYPES } from '../../services/UniversalWatermarkService';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';
import DccRecallActionModal from '../../components/modals/DccRecallActionModal';

const ControlledCopyRegister = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'PENDING_ISSUE';

  const { 
    currentUser, 
    controlledCopyInstances, 
    documentControlledCopies,
    issueControlledCopy, 
    dispatchControlledCopy,
    reportCcDamagedLost, 
    completeRecallChecklist,
    documents,
    externalDocuments,
    tasks,
    controlledCopyAuditTrail,
    actionLog,
    masterDepartments,
    departments: storeDepts,
    distributionLocations
  } = useStore();

  const navigate = useNavigate();
  const isDccUser = Boolean(currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.role === 'DCC_STAFF');
  const isAdmin = isDccUser;

  React.useEffect(() => {
    if (!isDccUser) {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงศูนย์ควบคุมงาน DCC', { id: 'dcc-access-denied' });
      navigate('/dashboard');
    }
  }, [isDccUser, navigate]);

  // Merge & synchronize copies collection
  const allCopies = useMemo(() => {
    const list = (controlledCopyInstances && controlledCopyInstances.length > 0)
      ? controlledCopyInstances
      : (documentControlledCopies || []);
    return list;
  }, [controlledCopyInstances, documentControlledCopies]);

  // Tab State
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab === 'ACTION_REQUIRED' || initialTab === 'PENDING_PRINT') return 'PENDING_ISSUE';
    if (initialTab === 'DISPATCHED') return 'DISPATCHED_TRACKING';
    if (initialTab === 'RECALL') return 'RECALL_CHECKLIST';
    if (initialTab === 'ACTIVE') return 'ACTIVE_REGISTER';
    if (initialTab === 'HISTORY') return 'AUDIT_TRAIL';
    return initialTab;
  });

  const handleTabChange = (tabId) => {
    let normalized = tabId;
    if (tabId === 'PENDING_PRINT') normalized = 'PENDING_ISSUE';
    if (tabId === 'DISPATCHED') normalized = 'DISPATCHED_TRACKING';
    if (tabId === 'RECALL') normalized = 'RECALL_CHECKLIST';
    if (tabId === 'ACTIVE') normalized = 'ACTIVE_REGISTER';
    if (tabId === 'HISTORY') normalized = 'AUDIT_TRAIL';
    setActiveTab(normalized);
    setSearchParams({ tab: normalized });
  };

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');

  // Multi-selection state for batch actions
  const [selectedCopyIds, setSelectedCopyIds] = useState([]);

  // Recall Checklist State: { [taskIdOrDocId]: Set of checked copy IDs }
  const [recallCheckedState, setRecallCheckedState] = useState({});

  // Loading States
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);
  const [isBatchDispatching, setIsBatchDispatching] = useState(false);
  const [processingCopyId, setProcessingCopyId] = useState(null);

  // Modals state
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueDoc, setIssueDoc] = useState('');
  const [issueDept, setIssueDept] = useState('');
  const [issueLocation, setIssueLocation] = useState('');

  // DCC Recall Action Modal state
  const [recallModalGroup, setRecallModalGroup] = useState(null);

  // Available Stations for Issue Modal based on selected issueDept
  const availableIssueStations = useMemo(() => {
    if (!issueDept) return [];
    const norm = issueDept.trim().toUpperCase();
    return (distributionLocations || []).filter(s => 
      s.status !== 'INACTIVE' && (
        (s.departmentId || '').toUpperCase() === norm ||
        (norm === 'QA' && s.departmentId === 'QA/QC') ||
        (norm === 'QA/QC' && s.departmentId === 'QA')
      )
    );
  }, [issueDept, distributionLocations]);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [reportType, setReportType] = useState('DAMAGED');
  const [reportReason, setReportReason] = useState('');

  // Audit Trail states
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const auditItemsPerPage = 15;

  // Active copies pagination
  const [activePage, setActivePage] = useState(1);
  const activeItemsPerPage = 15;

  // Department List for Filter
  const departmentList = useMemo(() => {
    const depts = new Set();
    allCopies.forEach(c => {
      const d = c.holder_dept || c.department;
      if (d) depts.add(d);
    });
    return Array.from(depts);
  }, [allCopies]);

  // Categorized Copies Counts
  const counts = useMemo(() => {
    const pendingIssue = allCopies.filter(c => c.status === 'PENDING_ISSUE' || c.status === 'PENDING_RECEIPT').length;
    const dispatched = allCopies.filter(c => c.status === 'DISPATCHED_PENDING_RECEIPT').length;
    
    // Recall count: Copies with PENDING_RECALL, DAMAGED_PENDING_REPLACEMENT or active copies of superseded/obsolete docs
    const recallCopies = allCopies.filter(c => {
      if (c.status === 'PENDING_RECALL' || c.status === 'DAMAGED_PENDING_REPLACEMENT') return true;
      const doc = documents.find(d => String(d.id) === String(c.doc_id || c.docId));
      const isDocSupersededOrObsolete = doc && (doc.status === 'SUPERSEDED_ARCHIVED' || doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED');
      return isDocSupersededOrObsolete && (c.status === 'ACTIVE' || c.status === 'ISSUED_ACTIVE');
    });

    const active = allCopies.filter(c => c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE').length;

    return {
      pendingIssue,
      dispatched,
      recall: recallCopies.length,
      active
    };
  }, [allCopies, documents]);

  // Combined and Safe Audit / History Logs
  const dccHistoryLogs = useMemo(() => {
    const list = [
      ...(controlledCopyAuditTrail || []).map(l => ({
        id: l.id || `cc-audit-${Math.random()}`,
        timestamp: l.timestamp || l.createdAt || new Date().toISOString(),
        action: l.action || l.actionType || 'กิจกรรมสำเนา',
        document_code: l.docTitle || l.doc_code || l.document_code || l.title || '-',
        copy_number: l.ccNumber || l.copy_no || l.copy_number || '',
        performed_by: l.user || l.actor || l.performed_by || 'DCC Officer',
        details: l.remarks || l.details || l.remark || '-'
      })),
      ...(actionLog || []).filter(l => (l.actionType || '').startsWith('CC_') || (l.action || '').startsWith('CC_') || (l.actionType || '').startsWith('DAR_') || (l.action || '').startsWith('DAR_')).map(l => ({
        id: l.id || `action-log-${Math.random()}`,
        timestamp: l.timestamp || new Date().toISOString(),
        action: l.actionType || l.action || 'บันทึกการทำงาน',
        document_code: l.docTitle || l.doc_code || l.document_code || l.darNo || '-',
        copy_number: l.ccNumber || l.copy_no || l.copy_number || '',
        performed_by: l.actor || l.user || 'DCC Officer',
        details: l.details || l.remark || '-'
      }))
    ];

    const seen = new Set();
    return list.filter(item => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }, [controlledCopyAuditTrail, actionLog]);

  // Tab definitions
  const tabs = [
    { 
      id: 'PENDING_ISSUE', 
      aliases: ['PENDING_PRINT', 'PENDING_ISSUE'],
      label: '1. รายการรอออกสำเนา', 
      sublabel: 'รอพิมพ์และส่งมอบ', 
      count: counts.pendingIssue,
      icon: Printer
    },
    { 
      id: 'DISPATCHED_TRACKING', 
      aliases: ['DISPATCHED', 'DISPATCHED_TRACKING'],
      label: '2. ติดตามการส่งมอบ', 
      sublabel: 'อยู่ระหว่างส่งมอบ', 
      count: counts.dispatched,
      icon: Clock
    },
    { 
      id: 'RECALL_CHECKLIST', 
      aliases: ['RECALL', 'RECALL_CHECKLIST'],
      label: '3. เช็กลิสต์เรียกคืนเอกสาร', 
      sublabel: 'เรียกคืนเอกสารเดิม', 
      count: counts.recall,
      icon: AlertTriangle
    },
    { 
      id: 'ACTIVE_REGISTER', 
      aliases: ['ACTIVE', 'ACTIVE_REGISTER'],
      label: '4. สำเนาใช้งานจริง', 
      sublabel: 'ทะเบียนสำเนาที่ใช้งาน', 
      count: counts.active,
      icon: Layers
    },
    { 
      id: 'AUDIT_TRAIL', 
      aliases: ['HISTORY', 'AUDIT_TRAIL'],
      label: '5. ประวัติการทำงาน', 
      sublabel: 'บันทึกประวัติการทำงาน', 
      count: dccHistoryLogs.length,
      icon: History
    }
  ];

  // Filtered List for Tab 1: PENDING_ISSUE
  const pendingIssueCopies = useMemo(() => {
    return allCopies.filter(c => {
      const isPending = c.status === 'PENDING_ISSUE' || c.status === 'PENDING_RECEIPT';
      if (!isPending) return false;

      const docCode = (c.doc_code || c.docTitle || '').toLowerCase();
      const dept = (c.holder_dept || c.department || '').toLowerCase();
      const loc = (c.location || c.locationName || '').toLowerCase();
      const copyNo = (c.copy_no || c.ccNumber || '').toLowerCase();
      const query = searchTerm.toLowerCase();

      if (searchTerm && !docCode.includes(query) && !dept.includes(query) && !loc.includes(query) && !copyNo.includes(query)) {
        return false;
      }
      if (selectedDeptFilter !== 'ALL' && (c.holder_dept || c.department) !== selectedDeptFilter) {
        return false;
      }
      return true;
    });
  }, [allCopies, searchTerm, selectedDeptFilter]);

  // Filtered List for Tab 2: DISPATCHED_TRACKING
  const dispatchedCopies = useMemo(() => {
    return allCopies.filter(c => {
      if (c.status !== 'DISPATCHED_PENDING_RECEIPT') return false;

      const docCode = (c.doc_code || c.docTitle || '').toLowerCase();
      const dept = (c.holder_dept || c.department || '').toLowerCase();
      const loc = (c.location || c.locationName || '').toLowerCase();
      const copyNo = (c.copy_no || c.ccNumber || '').toLowerCase();
      const query = searchTerm.toLowerCase();

      if (searchTerm && !docCode.includes(query) && !dept.includes(query) && !loc.includes(query) && !copyNo.includes(query)) {
        return false;
      }
      if (selectedDeptFilter !== 'ALL' && (c.holder_dept || c.department) !== selectedDeptFilter) {
        return false;
      }
      return true;
    }).sort((a, b) => new Date(b.dispatched_at || 0) - new Date(a.dispatched_at || 0));
  }, [allCopies, searchTerm, selectedDeptFilter]);

  // Grouped Recall Documents for Tab 3: RECALL_CHECKLIST
  const recallGroups = useMemo(() => {
    // Group copies needing recall by document
    const groups = {};

    allCopies.forEach(copy => {
      const doc = documents.find(d => String(d.id) === String(copy.doc_id || copy.docId))
        || (externalDocuments || []).find(d => String(d.id) === String(copy.doc_id || copy.docId || copy.external_doc_id));
      const isDocSupersededOrObsolete = doc && (doc.status === 'SUPERSEDED_ARCHIVED' || doc.status === 'OBSOLETE' || doc.status === 'OBSOLETE_ARCHIVED');
      const isNeedingRecall = copy.status === 'PENDING_RECALL' || copy.status === 'DAMAGED_PENDING_REPLACEMENT' || (isDocSupersededOrObsolete && (copy.status === 'ACTIVE' || copy.status === 'ISSUED_ACTIVE'));

      if (isNeedingRecall) {
        const docId = String(copy.doc_id || copy.docId || copy.doc_code || copy.docTitle);
        if (!groups[docId]) {
          // Find associated recall task if exists
          const recallTask = (tasks || []).find(t => 
            (t.type === 'DCC_RECALL' || t.type === 'DCC_RECALL_WITH_CHECKLIST' || t.taskType === 'DCC_RECALL_WITH_CHECKLIST') &&
            (String(t.doc_id) === docId || String(t.externalDocId) === docId || String(t.darId) === String(doc?.darIdRef) || (doc && t.title?.includes(doc.title)))
          );

          groups[docId] = {
            docId,
            docCode: copy.doc_code || copy.docTitle || doc?.edCode || doc?.title || 'Unknown Doc',
            docTitle: copy.docName || doc?.title || doc?.name || copy.docTitle || 'Procedure Document',
            docVersion: copy.doc_version || copy.rev || doc?.rev || '01',
            docStatus: doc?.status || 'SUPERSEDED',
            taskId: recallTask?.id || `task-recall-${docId}`,
            copies: []
          };
        }
        groups[docId].copies.push(copy);
      }
    });

    return Object.values(groups);
  }, [allCopies, documents, externalDocuments, tasks]);

  // Filtered List for Tab 4: ACTIVE_REGISTER
  const activeCopies = useMemo(() => {
    return allCopies.filter(c => {
      const isActive = c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE';
      if (!isActive) return false;

      const docCode = (c.doc_code || c.docTitle || '').toLowerCase();
      const dept = (c.holder_dept || c.department || '').toLowerCase();
      const loc = (c.location || c.locationName || '').toLowerCase();
      const copyNo = (c.copy_no || c.ccNumber || '').toLowerCase();
      const query = searchTerm.toLowerCase();

      if (searchTerm && !docCode.includes(query) && !dept.includes(query) && !loc.includes(query) && !copyNo.includes(query)) {
        return false;
      }
      if (selectedDeptFilter !== 'ALL' && (c.holder_dept || c.department) !== selectedDeptFilter) {
        return false;
      }
      return true;
    }).sort((a, b) => new Date(b.dateIssued || 0) - new Date(a.dateIssued || 0));
  }, [allCopies, searchTerm, selectedDeptFilter]);

  // Tab 5: Audit Trail filter
  const filteredAuditLogs = useMemo(() => {
    return (dccHistoryLogs || []).filter(log => {
      if (!auditSearchTerm) return true;
      const q = auditSearchTerm.toLowerCase();
      const userStr = String(typeof log.performed_by === 'object' ? JSON.stringify(log.performed_by) : (log.performed_by || '')).toLowerCase();
      const actionStr = String(typeof log.action === 'object' ? JSON.stringify(log.action) : (log.action || '')).toLowerCase();
      const docStr = String(typeof log.document_code === 'object' ? JSON.stringify(log.document_code) : (log.document_code || '')).toLowerCase();
      const ccStr = String(log.copy_number || '').toLowerCase();
      const detailsStr = String(typeof log.details === 'object' ? JSON.stringify(log.details) : (log.details || '')).toLowerCase();

      return (
        userStr.includes(q) ||
        actionStr.includes(q) ||
        docStr.includes(q) ||
        ccStr.includes(q) ||
        detailsStr.includes(q)
      );
    });
  }, [dccHistoryLogs, auditSearchTerm]);

  // Universal Pagination Hook Instances for all tabs
  const pendingIssuePagination = useTablePagination(pendingIssueCopies, 10);
  const dispatchedPagination = useTablePagination(dispatchedCopies, 10);
  const activePagination = useTablePagination(activeCopies, 10);
  const auditPagination = useTablePagination(filteredAuditLogs, 10);

  // Export to CSV
  const handleExportAuditCsv = () => {
    if (filteredAuditLogs.length === 0) {
      toast.error('ไม่มีข้อมูล Audit Trail ที่ตรงกับเงื่อนไขในการ Export');
      return;
    }
    const headers = ['Timestamp,User,Action,Document,CC Number,Details'];
    const rows = filteredAuditLogs.map(log => {
      const timeStr = log?.timestamp ? (() => {
        try {
          const d = new Date(log.timestamp);
          return isNaN(d.getTime()) ? String(log.timestamp) : d.toLocaleString('th-TH');
        } catch {
          return String(log.timestamp || '-');
        }
      })() : '-';
      const actorStr = typeof log?.performed_by === 'object' ? JSON.stringify(log?.performed_by) : (log?.performed_by || '-');
      const actionStr = typeof log?.action === 'object' ? JSON.stringify(log?.action) : (log?.action || '-');
      const docStr = typeof log?.document_code === 'object' ? JSON.stringify(log?.document_code) : (log?.document_code || '-');
      const ccStr = log?.copy_number ? `Copy ${log.copy_number}` : '-';
      const detailsStr = typeof log?.details === 'object' ? JSON.stringify(log?.details) : (log?.details || '-');
      return `"${timeStr}","${actorStr}","${actionStr}","${docStr}","${ccStr}","${detailsStr.replace(/"/g, '""')}"`;
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.concat(rows).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Controlled_Copy_Audit_Trail_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export Audit Trail สำเร็จ');
  };

  // --- ACTIONS ---

  // 1. Single Print with Location-Specific Watermark
  const handlePrintSingle = async (copy) => {
    setProcessingCopyId(copy.id);
    const toastId = toast.loading(`กำลังประทับลายน้ำ 45° สำหรับ ${copy.doc_code || copy.docTitle} (Copy ${copy.copy_no || copy.ccNumber})...`);
    try {
      const doc = documents.find(d => String(d.id) === String(copy.doc_id || copy.docId))
        || (externalDocuments || []).find(d => String(d.id) === String(copy.doc_id || copy.docId || copy.external_doc_id))
        || {
          id: copy.doc_id || copy.id,
          title: copy.doc_code || copy.docTitle || 'ED-QA-01',
          name: copy.docName || copy.docTitle || 'Controlled Procedure Document',
          rev: copy.doc_version || copy.rev || '01',
          department: copy.holder_dept || copy.department || 'QA',
          effectiveDate: copy.dateIssued || new Date().toISOString().split('T')[0]
        };

      const preset = copy.is_replacement 
        ? WATERMARK_TYPES.CONTROLLED_COPY_REPLACEMENT 
        : WATERMARK_TYPES.CONTROLLED_COPY;

      const isExternal = Boolean(copy.is_external || copy.isExternal || copy.doc_type === 'ED' || (copy.doc_code || copy.docTitle || '').startsWith('ED-'));

      await UniversalWatermarkService.downloadWatermarkedPdf(doc, preset, {
        docCode: copy.doc_code || copy.docTitle || doc.title,
        docTitle: doc.title || doc.docTitle || doc.name || copy.docName,
        sourceVersion: doc.sourceVersion || doc.edition,
        source: doc.source,
        isExternal,
        is_external: isExternal,
        doc_type: isExternal ? 'ED' : (doc.type || 'SOP'),
        copyNo: copy.copy_no || copy.ccNumber || '01',
        location: copy.location || copy.locationName || copy.station_name || `${copy.holder_dept || copy.department || 'PD'} Head Office`,
        issueNo: copy.issue_no || copy.issueNumber || '01',
        holderDept: copy.holder_dept || copy.department,
        userName: currentUser?.name || 'DCC Officer'
      });

      toast.success(`ดาวน์โหลดเอกสารพร้อมลายน้ำ Copy ${copy.copy_no || copy.ccNumber} สำเร็จ`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการพิมพ์เอกสาร', { id: toastId });
    } finally {
      setProcessingCopyId(null);
    }
  };

  // 2. Batch Print All Pending Copies
  const handleBatchPrint = async () => {
    const targets = selectedCopyIds.length > 0
      ? pendingIssueCopies.filter(c => selectedCopyIds.includes(c.id))
      : pendingIssueCopies;

    if (targets.length === 0) {
      toast.error('ไม่พบรายการสำเนาที่ต้องการพิมพ์');
      return;
    }

    setIsBatchPrinting(true);
    const toastId = toast.loading(`กำลังประมวลผลการพิมพ์ทั้งหมด ${targets.length} ฉบับพร้อมลายน้ำตามจุดใช้งาน...`);

    try {
      for (let i = 0; i < targets.length; i++) {
        const copy = targets[i];
        const doc = documents.find(d => String(d.id) === String(copy.doc_id || copy.docId)) || {
          id: copy.doc_id || copy.id,
          title: copy.doc_code || copy.docTitle || 'SOP-QMS-001',
          name: copy.docName || 'Controlled Standard Procedure',
          rev: copy.doc_version || copy.rev || '01',
          department: copy.holder_dept || copy.department || 'PD',
          effectiveDate: copy.dateIssued || new Date().toISOString().split('T')[0]
        };

        const preset = copy.is_replacement 
          ? WATERMARK_TYPES.CONTROLLED_COPY_REPLACEMENT 
          : WATERMARK_TYPES.CONTROLLED_COPY;

        await UniversalWatermarkService.downloadWatermarkedPdf(doc, preset, {
          copyNo: copy.copy_no || copy.ccNumber || '01',
          location: copy.location || copy.locationName || copy.station_name || `${copy.holder_dept || copy.department || 'PD'} Head Office`,
          issueNo: copy.issue_no || copy.issueNumber || '01',
          holderDept: copy.holder_dept || copy.department,
          userName: currentUser?.name || 'DCC Officer'
        });

        // Small pause between downloads to prevent browser pop-up blocking
        if (i < targets.length - 1) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
      toast.success(`พิมพ์สำเนาควบคุมครบทั้ง ${targets.length} ฉบับเรียบร้อยแล้ว`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการพิมพ์แบบกลุ่ม', { id: toastId });
    } finally {
      setIsBatchPrinting(false);
    }
  };

  // 3. Single Dispatch Action
  const handleDispatchSingle = (copy) => {
    dispatchControlledCopy(copy.id);
    toast.success(`บันทึกส่งมอบสำเนา Copy ${copy.copy_no || copy.ccNumber} (${copy.holder_dept || copy.department}) สำเร็จ พร้อมสร้าง Task ตรวจรับ`);
  };

  // 4. Batch Dispatch All Pending Copies
  const handleBatchDispatch = () => {
    const targets = selectedCopyIds.length > 0
      ? pendingIssueCopies.filter(c => selectedCopyIds.includes(c.id))
      : pendingIssueCopies;

    if (targets.length === 0) {
      toast.error('ไม่พบรายการสำเนาที่ต้องการส่งมอบ');
      return;
    }

    setIsBatchDispatching(true);
    try {
      targets.forEach(copy => {
        dispatchControlledCopy(copy.id);
      });
      setSelectedCopyIds([]);
      toast.success(`บันทึกส่งมอบเอกสารครบทั้ง ${targets.length} ฉบับแล้ว (ส่ง Task ไปยังแผนกผู้รับเรียบร้อย)`);
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการส่งมอบแบบกลุ่ม');
    } finally {
      setIsBatchDispatching(false);
    }
  };

  // 5. Recall Checklist Toggle
  const toggleRecallCopy = (groupId, copyId) => {
    setRecallCheckedState(prev => {
      const groupSet = new Set(prev[groupId] || []);
      if (groupSet.has(copyId)) {
        groupSet.delete(copyId);
      } else {
        groupSet.add(copyId);
      }
      return {
        ...prev,
        [groupId]: groupSet
      };
    });
  };

  // 6. Complete Recall Checklist for a Document Group
  const handleCompleteRecallGroup = (group, outcome = 'RECALLED_DESTROYED') => {
    const checkedSet = recallCheckedState[group.docId] || new Set();
    const checkedArray = Array.from(checkedSet);

    if (checkedArray.length !== group.copies.length) {
      toast.error(`ยังเรียกเก็บไม่ครบ 100% (เก็บแล้ว ${checkedArray.length}/${group.copies.length} จุด)`);
      return;
    }

    completeRecallChecklist(group.taskId, checkedArray, outcome);
    const actionLabel = (outcome === 'RECALLED_OBSOLETE' || outcome === 'ARCHIVED_OBSOLETE')
      ? 'ประทับตรายกเลิกและเก็บเข้าประวัติ (Archived Obsolete)'
      : 'ทำลาย (Destroyed)';
    toast.success(`ยืนยันการเรียกคืนและ${actionLabel}เอกสาร ${group.docCode} (Rev.${group.docVersion}) ครบถ้วน ${group.copies.length} จุดเรียบร้อย`);
  };

  // 7. Manual Issue Extra Copy
  const handleIssueSubmit = (e) => {
    e.preventDefault();
    if (!issueDoc) {
      toast.error('กรุณาเลือกรหัสเอกสาร');
      return;
    }
    issueControlledCopy(issueDoc, issueDept || 'PD', issueLocation || undefined);
    setIssueModalOpen(false);
    setIssueDoc('');
    setIssueDept('');
    setIssueLocation('');
    toast.success(`ออกสำเนาใหม่สำหรับ ${issueDoc} สำเร็จ`);
  };

  // 8. Report Damaged / Lost
  const handleReportSubmit = (e) => {
    e.preventDefault();
    if (!reportReason) {
      toast.error('กรุณาระบุเหตุผล');
      return;
    }
    reportCcDamagedLost(selectedInstance.id, reportType, reportReason);
    setReportModalOpen(false);
    setSelectedInstance(null);
    setReportReason('');
    toast.success(`แจ้งเอกสาร ${reportType === 'LOST' ? 'สูญหาย' : 'ชำรุด'} สำเร็จ (ส่งเรื่องรออนุมัติออกเล่มทดแทน)`);
  };

  // Selection Toggles
  const handleSelectAllPending = () => {
    if (selectedCopyIds.length === pendingIssueCopies.length) {
      setSelectedCopyIds([]);
    } else {
      setSelectedCopyIds(pendingIssueCopies.map(c => c.id));
    }
  };

  const handleToggleSelectCopy = (id) => {
    setSelectedCopyIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto w-full max-w-full overflow-hidden">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-[#E5E5E5] shadow-none">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#E5F4FF] text-[#0D99FF] rounded-lg">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1E1E1E] tracking-tight">
                ศูนย์ควบคุมสำเนาและวงจรเอกสาร
              </h1>
              <p className="text-xs text-[#666666] font-medium mt-0.5">
                บริหารจัดการสำเนาควบคุม พิมพ์ลายน้ำ 45° ส่งมอบเล่มจริง และเช็กลิสต์เรียกคืนเอกสาร (ISO 9001 / FSSC 22000)
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => setIssueModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-white bg-[#0D99FF] hover:bg-[#007BE5] rounded-lg shadow-none transition-all flex items-center justify-center gap-1.5"
          >
            <PlusCircle size={16} /> ออกสำเนาใหม่
          </button>
        </div>
      </div>

      {/* Figma UI3 Unified 5-Stage Interactive Workflow Navigator */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 bg-[#FAFAFA] p-1.5 border border-[#E5E5E5] rounded-xl mb-4">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id || (tab.aliases && tab.aliases.includes(activeTab));
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center justify-between px-3.5 py-3 rounded-lg transition-all cursor-pointer ${
                isActive
                  ? 'bg-white border-2 border-[#0D99FF] text-[#0D99FF] font-semibold shadow-xs'
                  : 'bg-white border border-[#E5E5E5] text-[#555555] hover:border-[#CCCCCC] hover:text-[#1E1E1E] shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <TabIcon size={16} strokeWidth={isActive ? 2 : 1.75} className={isActive ? 'text-[#0D99FF]' : 'text-[#666666]'} />
                <span className="text-sm truncate font-medium">{tab.label}</span>
              </div>
              <span className={`px-2 py-0.5 rounded font-mono text-xs shrink-0 ${
                isActive 
                  ? 'bg-[#E5F4FF] text-[#0D99FF] font-bold' 
                  : 'bg-[#F0F0F0] text-[#666666] font-semibold'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Global Filter Bar (for tabs 1, 2, 4) */}
      {activeTab !== 'AUDIT_TRAIL' && activeTab !== 'HISTORY' && (
        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] flex flex-col sm:flex-row gap-3 items-center justify-between shadow-none">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999999]" size={18} />
            <input
              type="text"
              placeholder="ค้นหารหัส, ชื่อเอกสาร, หมายเลขสำเนา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 h-10 text-sm bg-white border border-[#E5E5E5] rounded-lg focus:border-[#0D99FF] focus:ring-1 focus:ring-[#0D99FF] outline-none transition-all font-medium placeholder:text-[#999999]"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 h-10 text-sm bg-white border border-[#E5E5E5] rounded-lg font-medium text-[#333333] focus:outline-none focus:border-[#0D99FF]"
            >
              <option value="ALL">ทุกแผนก (All Departments)</option>
              {departmentList.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: รายการรอออกสำเนา (PENDING_ISSUE) */}
      {/* ========================================================================= */}
      {(activeTab === 'PENDING_ISSUE' || activeTab === 'PENDING_PRINT') && (
        <div className="w-full bg-white rounded-xl border border-[#E5E5E5] shadow-2xs overflow-hidden space-y-4 h-auto">
          {/* Tab Actions Header */}
          <div className="p-6 border-b border-[#E5E5E5] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
            <div>
              <h2 className="text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
                <Printer size={20} className="text-[#0D99FF]" /> รายการสำเนาที่รอพิมพ์และส่งมอบ ({pendingIssueCopies.length} รายการ)
              </h2>
              <p className="text-xs text-[#666666] mt-0.5">
                สำเนาที่อนุมัติจาก DAR แยกตาม Copy No. และจุดใช้งานจริง พร้อมประทับลายน้ำ 45°
              </p>
            </div>

            {/* Batch Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleBatchPrint}
                disabled={isBatchPrinting || pendingIssueCopies.length === 0}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isBatchPrinting ? (
                  <div className="w-3.5 h-3.5 border-2 border-indigo-700 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Printer size={15} />
                )}
                {selectedCopyIds.length > 0 ? `พิมพ์ที่เลือก (${selectedCopyIds.length})` : '📑 Batch Print All'}
              </button>

              <button
                onClick={handleBatchDispatch}
                disabled={isBatchDispatching || pendingIssueCopies.length === 0}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isBatchDispatching ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                {selectedCopyIds.length > 0 ? `ส่งมอบที่เลือก (${selectedCopyIds.length})` : '📤 บันทึกส่งมอบทั้งหมด (Dispatch All)'}
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="w-full bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden flex flex-col min-h-0 h-auto">
            <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full scrollbar-thin">
              <table className="w-full text-left text-sm text-[#1E293B] border-collapse">
                <thead className="bg-[#F8FAFC] text-[#374151] uppercase font-bold text-xs tracking-wider border-b border-[#E2E8F0] sticky top-0 z-10 shadow-xs backdrop-blur-sm whitespace-nowrap">
                  <tr>
                    <th className="py-3 px-3.5 w-12 text-center select-none bg-[#F8FAFC]">
                      <input
                        type="checkbox"
                        checked={pendingIssueCopies.length > 0 && selectedCopyIds.length === pendingIssueCopies.length}
                        onChange={handleSelectAllPending}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                    </th>
                    <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">รหัสเอกสาร / ชื่อเอกสาร</th>
                    <th className="py-3 px-3.5 text-center select-none whitespace-nowrap bg-[#F8FAFC]">ฉบับ (Rev.)</th>
                    <th className="py-3 px-3.5 text-center select-none whitespace-nowrap bg-[#F8FAFC]">หมายเลขสำเนา</th>
                    <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">แผนกผู้รับ</th>
                    <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">จุดใช้งาน (Location)</th>
                    <th className="py-3 px-3.5 text-center select-none whitespace-nowrap bg-[#F8FAFC]">การดำเนินการ (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  <AnimatePresence>
                    {pendingIssuePagination.paginatedData.map((copy) => {
                      const isSelected = selectedCopyIds.includes(copy.id);
                      const isProcessing = processingCopyId === copy.id;
                      return (
                        <motion.tr
                          key={copy.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={`hover:bg-[#F8FAFC] transition-colors ${isSelected ? 'bg-[#F1F5F9]' : ''}`}
                        >
                          <td className="py-3.5 px-3.5 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectCopy(copy.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                          </td>
                          <td className="py-3.5 px-3.5 align-middle">
                            <div className="font-bold text-sm font-mono text-[#0D99FF] bg-[#E5F4FF] px-2.5 py-0.5 rounded-md border border-[#B8E1FF] inline-block mb-1">
                              {copy.doc_code || copy.docTitle}
                            </div>
                            <div className="text-sm font-medium text-[#1E293B] truncate max-w-xs leading-snug">
                              {copy.docName || copy.docTitle}
                            </div>
                          </td>
                          <td className="py-3.5 px-3.5 text-center font-mono font-bold text-slate-700 text-sm align-middle">
                            Rev.{copy.doc_version || copy.rev || '01'}
                          </td>
                          <td className="py-3.5 px-3.5 text-center align-middle">
                            <div className="flex flex-col items-center gap-1">
                              <span className="px-2.5 py-1 bg-[#E6F7ED] text-[#14AE5C] font-semibold font-mono text-xs rounded-md border border-[#B3E7C9] whitespace-nowrap">
                                Copy {copy.copy_no || copy.ccNumber || '01'}
                              </span>
                              {(copy.is_replacement || (copy.issue_no && copy.issue_no !== '01')) && (
                                <span className="px-2 py-0.5 rounded-md bg-[#FFF8E6] text-[#B87C33] font-semibold border border-[#FDE6B0] text-xs whitespace-nowrap font-sans">
                                  Issue {copy.issue_no || '02'} (ทดแทน)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3.5 align-middle">
                            <span className="font-semibold text-[#1E293B] flex items-center gap-1.5 text-sm">
                              <Building size={14} className="text-slate-400" />
                              {copy.holder_dept || copy.department}
                            </span>
                          </td>
                          <td className="py-3.5 px-3.5 align-middle">
                            <span className="font-medium text-slate-700 flex items-center gap-1.5 text-sm">
                              <MapPin size={14} className="text-[#14AE5C]" />
                              {copy.location || copy.locationName || copy.station_name || `${copy.holder_dept || copy.department || 'PD'} Head Office`}
                            </span>
                          </td>
                          <td className="py-3.5 px-3.5 text-center align-middle">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handlePrintSingle(copy)}
                                disabled={isProcessing}
                                className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                title="พิมพ์สำเนาพร้อมลายน้ำระบุจุดใช้งาน"
                              >
                                {isProcessing ? (
                                  <div className="w-3 h-3 border-2 border-indigo-700 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Printer size={14} />
                                )}
                                พิมพ์สำเนาเดี่ยว
                              </button>

                              <button
                                onClick={() => handleDispatchSingle(copy)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0D99FF] hover:bg-[#007BE5] active:bg-[#0066BE] rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                                title="บันทึกส่งมอบเล่มจริงให้แผนกผู้รับ"
                              >
                                <Send size={14} />
                                บันทึกส่งมอบ (Dispatch)
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  {pendingIssuePagination.paginatedData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={36} />
                        <div className="font-bold text-slate-700 text-base">ไม่มีรายการค้างออกสำเนา</div>
                        <p className="text-xs text-slate-400 mt-1">สำเนาที่อนุมัติได้รับการพิมพ์และบันทึกส่งมอบครบถ้วนแล้ว</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              currentPage={pendingIssuePagination.currentPage}
              totalItems={pendingIssuePagination.totalItems}
              pageSize={pendingIssuePagination.pageSize}
              onPageChange={pendingIssuePagination.setCurrentPage}
              onPageSizeChange={pendingIssuePagination.setPageSize}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ติดตามการส่งมอบ (DISPATCHED_TRACKING) */}
      {/* ========================================================================= */}
      {(activeTab === 'DISPATCHED_TRACKING' || activeTab === 'DISPATCHED') && (
        <div className="w-full bg-white rounded-xl border border-[#E5E5E5] shadow-2xs overflow-hidden space-y-4 h-auto">
          <div className="p-6 border-b border-[#E5E5E5] flex justify-between items-center bg-white">
            <div>
              <h2 className="text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
                <Clock size={20} className="text-[#F59E0B]" /> ติดตามการส่งมอบและรอตรวจรับ ({dispatchedCopies.length} รายการ)
              </h2>
              <p className="text-xs text-[#666666] mt-0.5">
                สำเนาที่ DCC นำส่งแล้ว อยู่ระหว่างรอแผนกปลายทางตรวจรับด้วย E-Signature PIN 6 หลัก
              </p>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full scrollbar-thin">
            <table className="w-full text-left text-sm text-[#1E293B] border-collapse">
              <thead className="bg-[#F8FAFC] text-[#374151] uppercase font-bold text-xs tracking-wider border-b border-[#E2E8F0] sticky top-0 z-10 shadow-xs backdrop-blur-sm whitespace-nowrap">
                <tr>
                  <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">รหัสเอกสาร / ชื่อเอกสาร</th>
                  <th className="py-3 px-3.5 text-center select-none whitespace-nowrap bg-[#F8FAFC]">ฉบับ (Rev.)</th>
                  <th className="py-3 px-3.5 text-center select-none whitespace-nowrap bg-[#F8FAFC]">หมายเลขสำเนา</th>
                  <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">แผนกผู้รับ</th>
                  <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">จุดใช้งาน (Location)</th>
                  <th className="py-3 px-3.5 text-center select-none whitespace-nowrap bg-[#F8FAFC]">สถานะ</th>
                  <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">วันเวลาที่นำส่ง</th>
                  <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">ผู้นำส่ง (DCC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {dispatchedPagination.paginatedData.map((copy) => (
                  <tr key={copy.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3.5 px-3.5 align-middle">
                      <div className="font-bold text-sm font-mono text-[#0D99FF] bg-[#E5F4FF] px-2.5 py-0.5 rounded-md border border-[#B8E1FF] inline-block mb-1">{copy.doc_code || copy.docTitle}</div>
                      <div className="text-sm font-medium text-[#1E293B] truncate max-w-xs leading-snug">{copy.docName || copy.docTitle}</div>
                    </td>
                    <td className="py-3.5 px-3.5 text-center font-mono font-bold text-slate-700 text-sm align-middle">
                      Rev.{copy.doc_version || copy.rev || '01'}
                    </td>
                    <td className="py-3.5 px-3.5 text-center align-middle">
                      <div className="flex flex-col items-center gap-1">
                        <span className="px-2.5 py-1 bg-[#FFF8E6] text-[#B87C33] font-semibold font-mono text-xs rounded-md border border-[#FDE6B0] whitespace-nowrap">
                          Copy {copy.copy_no || copy.ccNumber || '01'}
                        </span>
                        {(copy.is_replacement || (copy.issue_no && copy.issue_no !== '01')) && (
                          <span className="px-2 py-0.5 rounded-md bg-[#FFF8E6] text-[#B87C33] font-semibold border border-[#FDE6B0] text-xs whitespace-nowrap font-sans">
                            Issue {copy.issue_no || '02'} (ทดแทน)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 align-middle">
                      <span className="font-semibold text-[#1E293B] text-sm">{copy.holder_dept || copy.department}</span>
                    </td>
                    <td className="py-3.5 px-3.5 align-middle">
                      <span className="font-medium text-slate-700 flex items-center gap-1.5 text-sm">
                        <MapPin size={14} className="text-slate-400" />
                        {copy.location || copy.locationName || copy.station_name || `${copy.holder_dept || copy.department || 'PD'} Head Office`}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-center align-middle">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF8E6] text-[#B87C33] border border-[#FDE6B0]">
                        <span className="w-2 h-2 rounded-full bg-[#D49800] animate-pulse" />
                        รอยืนยันรับเล่ม
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-xs text-slate-600 font-mono align-middle">
                      {copy.dispatched_at ? new Date(copy.dispatched_at).toLocaleString('th-TH') : '-'}
                    </td>
                    <td className="py-3.5 px-3.5 text-sm font-medium text-slate-700 align-middle">
                      {copy.dispatched_by || 'DCC Officer'}
                    </td>
                  </tr>
                ))}
                {dispatchedPagination.paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <CheckCircle2 className="mx-auto text-[#14AE5C] mb-2" size={36} />
                      <div className="font-bold text-[#1E293B] text-base">ไม่มีสำเนาที่อยู่ระหว่างรอยืนยันรับเล่ม</div>
                      <p className="text-xs text-slate-400 mt-1">ทุกแผนกได้ทำการตรวจรับเอกสารฉบับพิมพ์เข้าสู่ระบบเรียบร้อยแล้ว</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={dispatchedPagination.currentPage}
            totalItems={dispatchedPagination.totalItems}
            pageSize={dispatchedPagination.pageSize}
            onPageChange={dispatchedPagination.setCurrentPage}
            onPageSizeChange={dispatchedPagination.setPageSize}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: เช็กลิสต์เรียกคืนเอกสาร (RECALL_CHECKLIST) */}
      {/* ========================================================================= */}
      {(activeTab === 'RECALL_CHECKLIST' || activeTab === 'RECALL') && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-rose-600 to-red-700 text-white p-6 rounded-3xl shadow-lg shadow-rose-600/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-white/20 text-white text-xs font-bold font-mono">
                  ISO 9001: 7.5.3.2
                </span>
                <span className="text-xs text-rose-100 font-medium">Control of Obsolete Documents</span>
              </div>
              <h2 className="text-xl font-bold mt-1">
                เช็กลิสต์การเรียกคืนเอกสารฉบับเดิม (Recall Checklist)
              </h2>
              <p className="text-xs text-rose-100 mt-0.5">
                ติดตามการเก็บคืนสำเนาฉบับเก่าจากทุกจุดใช้งานเมื่อเอกสารมีการ Revise หรือประกาศยกเลิก (Obsolete)
              </p>
            </div>
            <div className="text-right bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 backdrop-blur-sm self-start sm:self-auto">
              <div className="text-xs text-rose-200">เอกสารที่ต้องเรียกคืน</div>
              <div className="text-xl font-black font-mono">{recallGroups.length} เอกสาร</div>
            </div>
          </div>

          {/* Grouped Document Recall Cards */}
          {recallGroups.map(group => {
            const checkedSet = recallCheckedState[group.docId] || new Set();
            const checkedCount = checkedSet.size;
            const totalCount = group.copies.length;
            const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 100;
            const is100Percent = checkedCount === totalCount && totalCount > 0;

            return (
              <div 
                key={group.docId}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Header of Document Group */}
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/70">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-900 font-mono">{group.docCode}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold font-mono text-xs">
                        Rev.{group.docVersion} (ฉบับเดิม)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{group.docTitle}</p>
                  </div>

                  {/* Progress Bar & Status */}
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="w-36 sm:w-48">
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-600">เก็บแล้ว {checkedCount}/{totalCount} จุด</span>
                        <span className={`font-mono ${is100Percent ? 'text-emerald-600 font-bold' : 'text-slate-700'}`}>
                          {percentage}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full transition-all duration-300 ${
                            is100Percent ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* ── Replaced bare action buttons with the 3-Step Recall Modal ── */}
                      <button
                        type="button"
                        onClick={() => setRecallModalGroup(group)}
                        title="เปิดหน้าต่างจัดการเรียกคืนสำเนาแบบ Multi-Step (ตรวจรับ → เลือกวิธีจัดการ → ยืนยัน)"
                        className="px-3.5 py-2.5 text-xs font-bold rounded-xl bg-[#0D99FF] hover:bg-[#007BE5] text-white shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <FolderOpen size={15} />
                        จัดการเรียกคืนสำเนา (Recall &amp; Disposition)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Locations Checklist Table (outer readonly reference — checked via modal) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/50 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3 w-14 text-center">เก็บคืน</th>
                        <th className="px-6 py-3">หมายเลขสำเนา</th>
                        <th className="px-6 py-3">แผนกผู้ครอบครอง</th>
                        <th className="px-6 py-3">จุดติดตั้ง (Location Point of Use)</th>
                        <th className="px-6 py-3 text-center">สถานะการเก็บ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.copies.map(copy => {
                        const isChecked = checkedSet.has(copy.id);
                        return (
                          <tr 
                            key={copy.id}
                            onClick={() => toggleRecallCopy(group.docId, copy.id)}
                            className={`cursor-pointer transition-colors ${
                              isChecked ? 'bg-emerald-50/30' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-6 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleRecallCopy(group.docId, copy.id)}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                                  isChecked 
                                    ? 'bg-emerald-600 text-white' 
                                    : 'border-2 border-slate-300 hover:border-indigo-600 text-transparent'
                                }`}
                              >
                                <Check size={14} strokeWidth={3} />
                              </button>
                            </td>
                            <td className="px-6 py-3.5 font-mono font-bold text-slate-800">
                              Copy {copy.copy_no || copy.ccNumber || '01'}
                            </td>
                            <td className="px-6 py-3.5 font-semibold text-slate-800">
                              {copy.holder_dept || copy.department}
                            </td>
                            <td className="px-6 py-3.5 text-slate-700">
                              <span className="flex items-center gap-1.5">
                                <MapPin size={14} className="text-slate-400" />
                                {copy.location || copy.locationName || copy.station_name || `${copy.holder_dept || copy.department || 'PD'} Head Office`}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-center">
                              {isChecked ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Check size={12} strokeWidth={2.5} /> เก็บเล่มคืนแล้ว
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                  รอนำเล่มคืน
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {recallGroups.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
              <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={40} />
              <div className="font-bold text-slate-800 text-lg">ไม่มีเอกสารฉบับเก่าค้างเรียกคืน</div>
              <p className="text-xs text-slate-400 mt-1">สำเนาฉบับก่อนหน้าทั้งหมดได้รับการเก็บคืนและทำลายอย่างสมบูรณ์</p>
            </div>
          )}
        </div>
      )}

      {/* DCC Recall Action Modal (Multi-Step: Check-in → Disposition → Confirm) */}
      {recallModalGroup && (
        <DccRecallActionModal
          isOpen={!!recallModalGroup}
          onClose={() => setRecallModalGroup(null)}
          group={recallModalGroup}
          onComplete={() => setRecallModalGroup(null)}
        />
      )}

      {/* ========================================================================= */}

      {/* TAB 4: สำเนาใช้งานทั้งหมด (ACTIVE_REGISTER) */}
      {/* ========================================================================= */}
      {(activeTab === 'ACTIVE_REGISTER' || activeTab === 'ACTIVE') && (
        <div className="w-full bg-white rounded-xl border border-[#E5E5E5] shadow-2xs overflow-hidden space-y-4 h-auto">
          <div className="p-6 border-b border-[#E5E5E5] flex justify-between items-center bg-white">
            <div>
              <h2 className="text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
                <Layers size={20} className="text-[#10B981]" /> ทะเบียนสำเนาควบคุมที่ใช้งานอยู่จริง ({activeCopies.length} เล่ม)
              </h2>
              <p className="text-xs text-[#666666] mt-0.5">
                ทะเบียนเอกสารควบคุมฉบับจริงที่ติดตั้งประจำจุดปฏิบัติงานในโรงงาน
              </p>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full scrollbar-thin">
            <table className="w-full text-left text-sm text-[#1E293B] border-collapse">
              <thead className="bg-[#F8FAFC] text-[#374151] uppercase font-bold text-xs tracking-wider border-b border-[#E2E8F0] sticky top-0 z-10 shadow-xs backdrop-blur-sm whitespace-nowrap">
                <tr>
                  <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">รหัสเอกสาร</th>
                  <th className="py-3 px-3.5 text-center select-none whitespace-nowrap bg-[#F8FAFC]">ฉบับ (Rev.)</th>
                  <th className="py-3 px-3.5 text-center select-none whitespace-nowrap bg-[#F8FAFC]">หมายเลขสำเนา</th>
                  <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">แผนกผู้ครอบครอง</th>
                  <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">จุดติดตั้ง (Location)</th>
                  <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">วันที่ตรวจรับ</th>
                  <th className="py-3 px-3.5 text-left select-none whitespace-nowrap bg-[#F8FAFC]">ผู้ตรวจรับ</th>
                  <th className="py-3 px-3.5 text-center select-none whitespace-nowrap bg-[#F8FAFC]">รายงานปัญหา</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {activePagination.paginatedData.map(copy => (
                  <tr key={copy.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3.5 px-3.5 align-middle">
                      <div className="font-bold text-sm font-mono text-[#0D99FF] bg-[#E5F4FF] px-2.5 py-0.5 rounded-md border border-[#B8E1FF] inline-block mb-1">{copy.doc_code || copy.docTitle}</div>
                      <div className="text-sm font-medium text-[#1E293B] truncate max-w-xs leading-snug">{copy.docName || copy.docTitle}</div>
                    </td>
                    <td className="py-3.5 px-3.5 text-center font-mono font-bold text-slate-700 text-sm align-middle">
                      Rev.{copy.doc_version || copy.rev || '01'}
                    </td>
                    <td className="py-3.5 px-3.5 text-center align-middle">
                      <div className="flex flex-col items-center gap-1">
                        <span className="px-2.5 py-1 bg-[#E6F7ED] text-[#14AE5C] font-semibold font-mono text-xs rounded-md border border-[#B3E7C9] whitespace-nowrap">
                          Copy {copy.copy_no || copy.ccNumber || '01'}
                        </span>
                        {(copy.is_replacement || (copy.issue_no && copy.issue_no !== '01')) && (
                          <span className="px-2 py-0.5 rounded-md bg-[#FFF8E6] text-[#B87C33] font-semibold border border-[#FDE6B0] text-xs whitespace-nowrap font-sans">
                            Issue {copy.issue_no || '02'} (ทดแทน)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 font-semibold text-[#1E293B] text-sm align-middle">
                      {copy.holder_dept || copy.department}
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-700 text-sm align-middle">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-[#14AE5C]" />
                        {copy.location || copy.locationName || copy.station_name || `${copy.holder_dept || copy.department || 'PD'} Head Office`}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-xs font-mono text-slate-600 align-middle">
                      {copy.receipt_confirmed_at ? new Date(copy.receipt_confirmed_at).toLocaleDateString('th-TH') : '-'}
                    </td>
                    <td className="py-3.5 px-3.5 text-sm font-medium text-slate-800 align-middle">
                      {copy.receipt_confirmed_by || '-'}
                    </td>
                    <td className="py-3.5 px-3.5 text-center align-middle">
                      <button
                        onClick={() => { setSelectedInstance(copy); setReportModalOpen(true); }}
                        className="px-3 py-1.5 text-xs font-semibold text-[#F24822] bg-[#FEECE8] hover:bg-[#FFE5E0] rounded-lg border border-[#FAD3CC] transition-colors flex items-center gap-1.5 mx-auto cursor-pointer"
                        title="แจ้งชำรุด หรือสูญหาย"
                      >
                        <AlertTriangle size={13} /> แจ้งชำรุด/หาย
                      </button>
                    </td>
                  </tr>
                ))}
                {activePagination.paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <div className="font-bold text-slate-700">ไม่พบข้อมูลสำเนาควบคุมที่ใช้งาน</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={activePagination.currentPage}
            totalItems={activePagination.totalItems}
            pageSize={activePagination.pageSize}
            onPageChange={activePagination.setCurrentPage}
            onPageSizeChange={activePagination.setPageSize}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ประวัติและบันทึกการทำงาน (AUDIT_TRAIL / HISTORY) */}
      {/* ========================================================================= */}
      {(activeTab === 'AUDIT_TRAIL' || activeTab === 'HISTORY') && (
        <div className="w-full bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-2xs space-y-0 h-auto">
          {/* Header */}
          <div className="px-4 py-3.5 bg-[#FAFAFA] border-b border-[#E5E5E5] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0D99FF]" size={16} />
              <span className="text-sm font-bold text-[#1E1E1E]">บันทึกประวัติการจัดการสำเนาและวงจรเอกสาร (DCC Activity Logs)</span>
            </div>
            
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" size={15} />
                <input
                  type="text"
                  placeholder="ค้นหา Log / เอกสาร / ผู้ดำเนินการ..."
                  value={auditSearchTerm}
                  onChange={(e) => setAuditSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 h-9 text-xs sm:text-sm bg-white border border-[#E5E5E5] rounded-lg outline-none focus:border-[#0D99FF] focus:ring-1 focus:ring-[#0D99FF] placeholder:text-[#999999]"
                />
              </div>

              <button
                onClick={handleExportAuditCsv}
                className="px-3.5 py-1.5 h-9 bg-[#1E1E1E] hover:bg-[#333333] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                title="Export CSV"
              >
                <FileDown size={14} /> <span>Export CSV</span>
              </button>

              <span className="text-xs font-mono text-[#666666] hidden sm:inline whitespace-nowrap">
                ทั้งหมด {(filteredAuditLogs || []).length} รายการ
              </span>
            </div>
          </div>

          {/* Table / List */}
          {(!auditPagination.paginatedData || auditPagination.paginatedData.length === 0) ? (
            <div className="p-8 text-center text-xs text-[#888888]">
              ยังไม่มีประวัติการทำรายการในระบบ
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full scrollbar-thin">
              <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[700px]">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#374151] font-bold text-xs uppercase tracking-wider sticky top-0 z-10 shadow-xs backdrop-blur-sm whitespace-nowrap">
                  <tr>
                    <th className="py-3 px-3.5 whitespace-nowrap bg-[#F8FAFC]">วัน-เวลา</th>
                    <th className="py-3 px-3.5 whitespace-nowrap bg-[#F8FAFC]">กิจกรรม (Action)</th>
                    <th className="py-3 px-3.5 whitespace-nowrap bg-[#F8FAFC]">รหัส / หมายเลขสำเนา</th>
                    <th className="py-3 px-3.5 whitespace-nowrap bg-[#F8FAFC]">ผู้ดำเนินการ</th>
                    <th className="py-3 px-3.5 bg-[#F8FAFC]">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0] text-[#333333]">
                  {auditPagination.paginatedData.map((log, index) => {
                    const timeStr = log?.timestamp ? (() => {
                      try {
                        const d = new Date(log.timestamp);
                        return isNaN(d.getTime()) ? String(log.timestamp) : d.toLocaleString('th-TH');
                      } catch {
                        return String(log.timestamp || '-');
                      }
                    })() : '-';

                    const actorStr = typeof log?.performed_by === 'object' 
                      ? (log?.performed_by?.name || log?.performed_by?.user || JSON.stringify(log.performed_by))
                      : (log?.performed_by || log?.user || log?.actor || '-');

                    const actionStr = typeof log?.action === 'object'
                      ? JSON.stringify(log.action)
                      : (log?.action || 'บันทึกการทำงาน');

                    const docStr = typeof log?.document_code === 'object'
                      ? JSON.stringify(log.document_code)
                      : (log?.document_code || log?.docTitle || '-');

                    const copyStr = log?.copy_number || log?.ccNumber ? ` (Copy ${log.copy_number || log.ccNumber})` : '';

                    const detailsStr = typeof log?.details === 'object'
                      ? JSON.stringify(log.details)
                      : (log?.details || log?.remarks || log?.remark || '-');

                    return (
                      <tr key={log?.id || index} className="hover:bg-[#F9FBFD] transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#666666] whitespace-nowrap">
                          {timeStr}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF]">
                            {actionStr}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-[#1E1E1E] whitespace-nowrap">
                          {docStr}{copyStr}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {actorStr}
                        </td>
                        <td className="py-2.5 px-3 text-[#555555] max-w-md break-words">
                          {detailsStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <TablePagination
            currentPage={auditPagination.currentPage}
            totalItems={auditPagination.totalItems}
            pageSize={auditPagination.pageSize}
            onPageChange={auditPagination.setCurrentPage}
            onPageSizeChange={auditPagination.setPageSize}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ออกสำเนาใหม่ (Manual Issue Copy Modal) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {issueModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl ring-1 ring-slate-900/10 border border-slate-200 w-full max-w-lg sm:max-w-xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center border-b border-indigo-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                    <PlusCircle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base sm:text-lg text-white">
                      ออกสำเนาควบคุมใหม่ (Issue Controlled Copy)
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      เลือกเอกสาร แผนก และจุดใช้งานที่ต้องการพิมพ์สำเนา
                    </p>
                  </div>
                </div>
                <button onClick={() => setIssueModalOpen(false)} className="text-slate-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors" title="ปิดหน้าต่าง">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleIssueSubmit} className="p-6 space-y-4 text-sm bg-slate-50/40">
                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    เลือกรหัสเอกสาร (เฉพาะเอกสารที่มีผลบังคับใช้) <span className="text-rose-500">*</span>:
                  </label>
                  <select
                    value={issueDoc}
                    onChange={(e) => setIssueDoc(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium"
                  >
                    <option value="">-- กรุณาเลือกเอกสาร --</option>
                    {documents.filter(d => d.status === 'EFFECTIVE').map(d => (
                      <option key={d.id} value={d.title}>
                        {d.title} : {d.name} (Rev.{d.rev})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    แผนกผู้รับสำเนา <span className="text-rose-500">*</span>:
                  </label>
                  <select
                    value={issueDept}
                    onChange={(e) => {
                      setIssueDept(e.target.value);
                      setIssueLocation('');
                    }}
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium"
                  >
                    <option value="">-- เลือกแผนกผู้รับ --</option>
                    {(masterDepartments || storeDepts || []).filter(d => typeof d === 'string' || d.status !== 'INACTIVE').map(d => {
                      const code = typeof d === 'string' ? d : d.id;
                      const name = typeof d === 'string' ? d : (d.nameTh || d.name);
                      return <option key={code} value={code}>{code} - {name}</option>;
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    จุดใช้งานปลายทาง (Location / Line) <span className="text-rose-500">*</span>:
                  </label>
                  {availableIssueStations.length > 0 ? (
                    <select
                      value={issueLocation}
                      onChange={(e) => setIssueLocation(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium"
                    >
                      <option value="">-- เลือกจุดใช้งาน --</option>
                      {availableIssueStations.map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.code || s.id})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={issueLocation}
                      onChange={(e) => setIssueLocation(e.target.value)}
                      placeholder="เช่น Line 1 Mixing, QA Lab Binder"
                      required
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium"
                    />
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200/80 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIssueModalOpen(false)}
                    className="bg-white hover:bg-slate-100 text-slate-700 font-medium text-sm px-4 py-2.5 rounded-xl border border-slate-300 shadow-xs transition-colors"
                  >
                    ยกเลิก / ปิดหน้าต่าง
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-sm shadow-indigo-200 transition-all flex items-center gap-2"
                  >
                    <PlusCircle size={16} /> ยืนยันการออกสำเนาควบคุม
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: รายงานชำรุด / สูญหาย (Report Damaged/Lost) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {reportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl ring-1 ring-slate-900/10 border border-slate-200 w-full max-w-lg sm:max-w-xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white flex justify-between items-center border-b border-rose-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base sm:text-lg text-white">
                      รายงานเอกสารชำรุด / สูญหาย (Report Damaged/Lost)
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      บันทึกเหตุผลความจำเป็นเพื่อขออนุมัติออกเล่มทดแทน
                    </p>
                  </div>
                </div>
                <button onClick={() => setReportModalOpen(false)} className="text-slate-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors" title="ปิดหน้าต่าง">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleReportSubmit} className="p-6 space-y-4 text-sm bg-slate-50/40">
                <div className="bg-slate-50/80 border border-slate-200/70 p-4 rounded-xl space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-semibold">รหัสเอกสาร:</span>
                    <strong className="font-mono text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100/80">{selectedInstance?.doc_code || selectedInstance?.docTitle}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-semibold">หมายเลขสำเนา:</span>
                    <strong className="font-mono text-slate-900">Copy {selectedInstance?.copy_no || selectedInstance?.ccNumber}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-semibold">จุดใช้งาน:</span>
                    <strong className="text-slate-900">{selectedInstance?.location || selectedInstance?.locationName}</strong>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    ประเภทรายงาน <span className="text-rose-500">*</span>:
                  </label>
                  <div className="flex gap-3">
                    <label className={`flex items-center gap-2 cursor-pointer text-sm font-medium p-3 rounded-xl border transition-all flex-1 ${
                      reportType === 'DAMAGED' ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 text-rose-950 font-bold' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        value="DAMAGED"
                        checked={reportType === 'DAMAGED'}
                        onChange={(e) => setReportType(e.target.value)}
                        className="text-rose-600 focus:ring-rose-500 w-4 h-4"
                      />
                      <span>เอกสารชำรุด (Damaged)</span>
                    </label>
                    <label className={`flex items-center gap-2 cursor-pointer text-sm font-medium p-3 rounded-xl border transition-all flex-1 ${
                      reportType === 'LOST' ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 text-rose-950 font-bold' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        value="LOST"
                        checked={reportType === 'LOST'}
                        onChange={(e) => setReportType(e.target.value)}
                        className="text-rose-600 focus:ring-rose-500 w-4 h-4"
                      />
                      <span>เอกสารสูญหาย (Lost)</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    สาเหตุและความจำเป็น <span className="text-rose-500">*</span>:
                  </label>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    required
                    placeholder="ระบุสาเหตุที่ชำรุดหรือสูญหาย พร้อมความจำเป็นในการขอออกเล่มทดแทน..."
                    rows={3}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-600 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none resize-none font-medium"
                  />
                </div>

                <div className="pt-4 border-t border-slate-200/80 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="bg-white hover:bg-slate-100 text-slate-700 font-medium text-sm px-4 py-2.5 rounded-xl border border-slate-300 shadow-xs transition-colors"
                  >
                    ยกเลิก / ปิดหน้าต่าง
                  </button>
                  <button
                    type="submit"
                    className="bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-sm shadow-rose-200 transition-all flex items-center gap-2"
                  >
                    <AlertTriangle size={16} /> บันทึกรายงาน
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ControlledCopyRegister;
