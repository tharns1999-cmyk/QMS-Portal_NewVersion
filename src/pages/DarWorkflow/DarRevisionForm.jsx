import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';
import { FileText, Calendar, Settings, FileEdit, Search, X, ShieldAlert, ChevronLeft, ShieldCheck, UploadCloud, User, AlertTriangle, Building, Layers, RotateCcw, Printer } from 'lucide-react';
import UserSelector from '../../components/UserSelector';
import DistributionSetup from '../../components/workflow/DistributionSetup';
import RelatedStandardsSelector from '../../components/workflow/RelatedStandardsSelector';
import DocumentAccessControlSelector from '../../components/workflow/DocumentAccessControlSelector';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';
import Button from '../../components/ui/Button';
import { resolveReviewer, resolveApprover } from '../../utils/workflowResolver';
import { normalizeDraftToFormState } from '../../utils/draftNormalizer';
import { 
  normalizeDeptCode, 
  isUserAuthorizedForDocDept, 
  isDocumentEligibleForRevision 
} from '../../utils/darHelper';

const DarRevisionForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();
  const rawDraftId = searchParams.get('draftId') || params?.draftId || params?.id || location.state?.draftId;
  const targetDraftId = rawDraftId ? decodeURIComponent(String(rawDraftId)).trim() : null;
  const prefillDocId = location.state?.prefillDocId;
  const deepLinkDocCode = searchParams.get('docCode') || searchParams.get('code') || location.state?.targetDocCode || location.state?.docCode;
  const deepLinkDocId = searchParams.get('docId') || location.state?.selectedDocId || location.state?.docId || prefillDocId;
  const { currentUser, addDar, saveDarDraft, deleteDar, masterUsers, reviewUsers, approveUsers, documents, dars, darRequests, documentTypes, simulatedDate, controlledCopyInstances, documentControlledCopies } = useStore();
  const activeDocumentTypes = (documentTypes || []).filter(t => (t.status === 'ACTIVE' || t.status === 'Active' || t.isActive !== false) && t.allowDar !== false && t.category !== 'EXTERNAL' && t.code !== 'ED' && t.id !== 'ED');
  
  const initialFormState = {
    docId: '',
    title: '', // new title, default to old
    changeSummary: '',
    changeReason: '',
    otherReason: '',
    ackRequirement: 'NOT_REQUIRED',
    ackUserId: '',
    distributions: [],
    effectiveDate: '',
    file: null,
    relatedStandards: [],
    otherStandardDetail: '',
    access_control: {
      scope: 'GENERAL',
      authorized_depts: [],
      authorized_users: [],
      min_access_level: 4
    }
  };

  const [formData, setFormData] = useState(initialFormState);
  
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef(null);
  
  const [lockedSource, setLockedSource] = useState(null);
  const [lockedSourceError, setLockedSourceError] = useState(null);

  useEffect(() => {
    if (targetDraftId || location.state?.draftData) {
      const allDarsList = dars || darRequests || [];
      const draft = location.state?.draftData || allDarsList.find(d => {
        if (!targetDraftId) return false;
        return (
          String(d.id) === targetDraftId || 
          String(d.dar_no) === targetDraftId || 
          String(d.darNo) === targetDraftId
        );
      });
      if (draft) {
        if (draft.sourceType === 'PERIODIC_REVIEW') {
          try {
            useStore.getState().validateLinkedDarSource(draft);
            const source = useStore.getState().resolveLockedSourceDocument(draft);
            setLockedSource(source);
            setLockedSourceError(null);
            
            const hydrated = normalizeDraftToFormState(draft, initialFormState);
            setFormData(prev => ({
              ...prev,
              ...hydrated,
              docId: draft.targetDocumentId || hydrated.docId,
              title: source.documentTitle || hydrated.title
            }));
          } catch (err) {
            setLockedSourceError(err.message);
          }
        } else {
          setLockedSource(null);
          setLockedSourceError(null);
          const hydrated = normalizeDraftToFormState(draft, initialFormState);
          setFormData(hydrated);
        }
      }
    }
  }, [targetDraftId, dars, darRequests, currentUser?.department, location.state]);

  // Handle Prefill from Periodic Review
  useEffect(() => {
    if (prefillDocId) {
      const doc = documents.find(d => d.id === prefillDocId);
      if (doc) {
        setFormData(prev => ({
          ...prev,
          docId: doc.id,
          title: doc.title || doc.name,
          changeSummary: 'ทบทวนและแก้ไขเนื้อหาตามรอบการทบทวนประจำปี',
          changeReason: 'PERIODIC_REVIEW'
        }));
      }
    }
  }, [prefillDocId, documents]);

  const allDars = useMemo(() => [...(dars || []), ...(darRequests || [])], [dars, darRequests]);

  // Filter effective documents based on currentUser's department (Canonical Scoping & In-Flight Lock Prevention)
  const effectiveDocs = useMemo(() => {
    return (documents || []).filter(d => isDocumentEligibleForRevision(d, currentUser, allDars, targetDraftId));
  }, [documents, currentUser, allDars, targetDraftId]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Security Handling: Clear selected doc if user switches and the doc is no longer in the filtered list
  useEffect(() => {
    if (formData.docId) {
      const isStillValid = (effectiveDocs || []).some(d => d && d.id === formData.docId);
      if (!isStillValid) {
        setFormData(prev => ({ ...prev, docId: '', title: '' }));
      }
    }
  }, [currentUser?.id, currentUser?.department, currentUser?.dept, formData.docId, effectiveDocs]);

  const filteredDocs = effectiveDocs.filter(d => {
    const docCode = d.document_code || d.doc_code || d.code || d.docCode || d.title || '';
    const docTitle = d.title || '';
    const docName = d.name || d.docName || '';
    const docType = d.type || d.docType || d.category || '';

    const matchesType = !docTypeFilter || 
      docType.toUpperCase() === docTypeFilter.toUpperCase() || 
      docCode.toUpperCase().startsWith(docTypeFilter.toUpperCase()) ||
      docTitle.toUpperCase().startsWith(docTypeFilter.toUpperCase());

    const matchesSearch = !searchQuery || 
      docTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
      docName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      docCode.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesSearch;
  });

  const selectedDoc = (effectiveDocs || []).find(d => d.id === formData.docId) || (documents || []).find(d => d.id === formData.docId);

  // Active Controlled Copies in Circulation for the selected document
  const activeCopiesInCirculation = useMemo(() => {
    if (!selectedDoc) return [];
    const allCopies = (controlledCopyInstances && controlledCopyInstances.length > 0)
      ? controlledCopyInstances
      : (documentControlledCopies || []);
    return allCopies.filter(c => {
      const isDocMatch = 
        (c.docCode && (c.docCode === selectedDoc.code || c.docCode === selectedDoc.title)) ||
        (c.documentId && String(c.documentId) === String(selectedDoc.id)) ||
        (c.doc_code && (c.doc_code === selectedDoc.code || c.doc_code === selectedDoc.title)) ||
        (c.docTitle && (c.docTitle === selectedDoc.code || c.docTitle === selectedDoc.title)) ||
        (c.document_code && (c.document_code === selectedDoc.code || c.document_code === selectedDoc.title)) ||
        (c.docId && String(c.docId) === String(selectedDoc.id)) ||
        (c.doc_id && String(c.doc_id) === String(selectedDoc.id));
      const isActive = c.status === 'ACTIVE' || c.status === 'ISSUED_ACTIVE' || c.status === 'RECEIVED' || c.status === 'DISPATCHED_PENDING_RECEIPT';
      return isDocMatch && isActive;
    });
  }, [selectedDoc, controlledCopyInstances, documentControlledCopies]);

  const calculateNextRev = (currentRev) => {
    const revNum = parseInt(currentRev, 10);
    if (isNaN(revNum)) return '01';
    return String(revNum + 1).padStart(2, '0');
  };

  const handleDocSelect = (doc) => {
    const initialAc = doc.access_control || {
      scope: 'GENERAL',
      authorized_depts: [],
      authorized_users: [],
      min_access_level: 4
    };

    // Distribution Matrix Mutation: Pull existing active copies as default
    let initialDistributions = doc.distributions && doc.distributions.length > 0
      ? JSON.parse(JSON.stringify(doc.distributions))
      : [];

    if (initialDistributions.length === 0) {
      const allCopies = (controlledCopyInstances && controlledCopyInstances.length > 0)
        ? controlledCopyInstances
        : (documentControlledCopies || []);
      const docCopies = allCopies.filter(c => {
        const isDocMatch = 
          (c.docCode && (c.docCode === doc.code || c.docCode === doc.title)) ||
          (c.documentId && String(c.documentId) === String(doc.id)) ||
          (c.doc_code && (c.doc_code === doc.code || c.doc_code === doc.title)) ||
          (c.docTitle && (c.docTitle === doc.code || c.docTitle === doc.title)) ||
          (c.document_code && (c.document_code === doc.code || c.document_code === doc.title)) ||
          (c.docId && String(c.docId) === String(doc.id)) ||
          (c.doc_id && String(c.doc_id) === String(doc.id));
        return isDocMatch && (c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE' || c.status === 'RECEIVED' || c.status === 'DISPATCHED_PENDING_RECEIPT');
      });
      if (docCopies.length > 0) {
        initialDistributions = docCopies.map((c, idx) => ({
          id: c.locationId || c.station_id || `loc-${idx}`,
          locationId: c.locationId || c.station_id || `${c.holder_dept || c.department}-LOC-${idx + 1}`,
          locationName: c.location || c.locationName || c.station_name || `${c.holder_dept || c.department} Station`,
          station_id: c.locationId || c.station_id || `${c.holder_dept || c.department}-LOC-${idx + 1}`,
          station_name: c.location || c.locationName || c.station_name || `${c.holder_dept || c.department} Station`,
          departmentId: c.holder_dept || c.department || 'PD',
          department: c.holder_dept || c.department || 'PD',
          dept: c.holder_dept || c.department || 'PD',
          dept_code: c.holder_dept || c.department || 'PD',
          copyNo: c.copy_no || c.copyNo || String(idx + 1).padStart(2, '0'),
          isMaster: !!c.is_master || !!c.isMaster
        }));
      }
    }

    setFormData(prev => ({
      ...prev,
      docId: doc.id,
      title: doc.name,
      distributions: initialDistributions,
      relatedStandards: doc.relatedStandards ? [...doc.relatedStandards] : [],
      otherStandardDetail: doc.otherStandardDetail || '',
      access_control: initialAc,
      ...(doc.title && doc.title.startsWith('FM') ? { ackRequirement: 'NOT_REQUIRED', ackUserId: '' } : {})
    }));
    setSearchQuery('');
    setIsDropdownOpen(false);
  };
  
  const handleClearDoc = () => {
    setFormData(prev => ({
      ...prev,
      docId: '',
      title: '',
      distributions: [],
      relatedStandards: [],
      otherStandardDetail: '',
      access_control: {
        scope: 'GENERAL',
        authorized_depts: [],
        authorized_users: [],
        min_access_level: 4
      }
    }));
    setSearchQuery('');
  };

  // Handle Prefill / Deep-link from Document Library or URL parameters
  useEffect(() => {
    if (targetDraftId || location.state?.draftData) return;
    if (formData.docId) return;

    if (deepLinkDocId || deepLinkDocCode) {
      const candidateList = (effectiveDocs && effectiveDocs.length > 0) ? effectiveDocs : (documents || []);
      const matched = candidateList.find(d => {
        if (!d) return false;
        if (deepLinkDocId && String(d.id) === String(deepLinkDocId)) return true;
        const code = (d.document_code || d.doc_code || d.code || d.docCode || d.title || '').trim().toUpperCase();
        if (deepLinkDocCode && code === String(deepLinkDocCode).trim().toUpperCase()) return true;
        return false;
      });

      if (matched) {
        handleDocSelect(matched);
      }
    }
  }, [deepLinkDocId, deepLinkDocCode, effectiveDocs, documents, targetDraftId, location.state?.draftData, formData.docId]);


  /**
   * Reactive Pruning Pipeline & Dynamic Copy Re-indexing
   * When Access Scope or Authorized Departments change:
   * - Prune distributions for departments that are no longer authorized
   * - Never prune owner department's Master Copy 01
   * - Re-index remaining copy numbers sequentially in real-time
   */
  const handleAccessControlChange = (newAc) => {
    const ownerDepartment = selectedDoc?.department || currentUser?.department || 'PD';
    const normOwner = (ownerDepartment || 'PD').trim();
    const scope = newAc?.scope || 'GENERAL';
    const authorizedDepts = (newAc?.authorized_depts || []).map(d => String(d).trim());

    setFormData(prev => {
      let currentDists = prev.distributions || [];

      // Check if pruning is required based on scope
      let prunedDists = currentDists;
      if (scope === 'DEPT_ONLY' || scope === 'RESTRICTED') {
        // Only keep distributions belonging to the Owner Department
        prunedDists = currentDists.filter(dist => {
          const distDept = (dist.departmentId || dist.dept || dist.dept_code || dist.department || normOwner).trim();
          return distDept === normOwner || dist.isMaster || dist.is_master;
        });
      } else if (scope === 'TARGETED' && authorizedDepts.length > 0) {
        // Only keep distributions belonging to Owner Department or explicitly Authorized Departments
        prunedDists = currentDists.filter(dist => {
          const distDept = (dist.departmentId || dist.dept || dist.dept_code || dist.department || normOwner).trim();
          return distDept === normOwner || authorizedDepts.includes(distDept) || dist.isMaster || dist.is_master;
        });
      }

      // Dynamic Copy Number Re-indexing
      // Separate master copy vs non-master copies and re-index sequentially starting from Copy 02
      let masterItem = prunedDists.find(d => d.isMaster || d.is_master || d.copyNo === '01');
      const nonMasterItems = prunedDists.filter(d => !(d.isMaster || d.is_master || d.copyNo === '01'));

      const reindexedNonMasters = nonMasterItems.map((item, idx) => {
        const copyNum = String(idx + 2).padStart(2, '0');
        return {
          ...item,
          copyNo: copyNum,
          copy_no: copyNum,
          copyLabel: `Copy ${copyNum}`
        };
      });

      const finalDists = masterItem 
        ? [{ ...masterItem, copyNo: '01', copy_no: '01', copyLabel: 'Copy 01', isMaster: true }, ...reindexedNonMasters]
        : reindexedNonMasters;

      return {
        ...prev,
        access_control: newAc,
        distributions: finalDists
      };
    });
  };

  /**
   * Helper to remove a single distribution chip and dynamically re-index remaining copies
   * Unchecking chip triggers Two-Way Binding with DistributionSetup
   */
  const handleRemoveDistributionChip = (distToRemove) => {
    if (distToRemove.isMaster || distToRemove.is_master || distToRemove.copyNo === '01') {
      toast.error('ไม่สามารถลบ Master Copy 01 ของแผนกเจ้าของเอกสารได้');
      return;
    }

    setFormData(prev => {
      const remaining = (prev.distributions || []).filter(d => {
        const dLocId = d.locationId || d.station_id || d.id;
        const targetLocId = distToRemove.locationId || distToRemove.station_id || distToRemove.id;
        const dDept = d.departmentId || d.dept || d.dept_code || d.department;
        const targetDept = distToRemove.departmentId || distToRemove.dept || distToRemove.dept_code || distToRemove.department;
        return !(dLocId === targetLocId && dDept === targetDept);
      });

      // Dynamic Re-indexing
      const masterItem = remaining.find(d => d.isMaster || d.is_master || d.copyNo === '01');
      const nonMasterItems = remaining.filter(d => !(d.isMaster || d.is_master || d.copyNo === '01'));

      const reindexed = nonMasterItems.map((item, idx) => {
        const copyNum = String(idx + 2).padStart(2, '0');
        return {
          ...item,
          copyNo: copyNum,
          copy_no: copyNum,
          copyLabel: `Copy ${copyNum}`
        };
      });

      const finalDists = masterItem 
        ? [{ ...masterItem, copyNo: '01', copy_no: '01', isMaster: true }, ...reindexed]
        : reindexed;

      return {
        ...prev,
        distributions: finalDists
      };
    });
  };

  // Auto-calculated Workflow Participants for Auto-Whitelisting
  const workflowParticipants = useMemo(() => {
    const list = [];
    if (currentUser) {
      list.push({
        id: currentUser.id,
        empId: currentUser.empId,
        name: currentUser.name,
        department: currentUser.department || currentUser.dept || 'QMS',
        role: 'REQUESTER',
        roleTitle: 'ผู้จัดทำ (Requester)'
      });
    }
    const resolvedRevId = formData.manualReviewerId
      ? formData.manualReviewerId
      : (resolveReviewer(currentUser?.id, currentUser?.department, masterUsers, reviewUsers || masterUsers, formData.docType)?.id);
    if (resolvedRevId && resolvedRevId !== currentUser?.id) {
      const revUser = (masterUsers || []).find(u => u.id === resolvedRevId);
      if (revUser) {
        list.push({
          id: revUser.id,
          empId: revUser.empId,
          name: revUser.name,
          department: revUser.primary_department || revUser.department || revUser.dept,
          role: 'REVIEWER',
          roleTitle: 'ผู้ทบทวน (Reviewer)'
        });
      }
    }
    const resolvedAppId = formData.manualApproverId
      ? formData.manualApproverId
      : (resolveApprover(currentUser?.id, resolvedRevId, currentUser?.department, masterUsers, approveUsers || masterUsers, formData.docType)?.id);
    if (resolvedAppId && resolvedAppId !== currentUser?.id && resolvedAppId !== resolvedRevId) {
      const appUser = (masterUsers || []).find(u => u.id === resolvedAppId);
      if (appUser) {
        list.push({
          id: appUser.id,
          empId: appUser.empId,
          name: appUser.name,
          department: appUser.primary_department || appUser.department || appUser.dept,
          role: 'APPROVER',
          roleTitle: 'ผู้อนุมัติ (Approver)'
        });
      }
    }
    return list;
  }, [currentUser, formData.manualReviewerId, formData.manualApproverId, masterUsers, reviewUsers, approveUsers]);
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type !== 'application/pdf') {
      toast.error('รองรับเฉพาะไฟล์ PDF เท่านั้น');
      e.target.value = '';
      return;
    }
    setFormData(prev => ({ ...prev, file }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.docId) newErrors.docId = 'กรุณาเลือกเอกสารที่ต้องการแก้ไข';
    if (!formData.title) newErrors.title = 'กรุณาระบุชื่อเอกสารใหม่ (หรือใช้ชื่อเดิม)';
    if (!formData.changeSummary) newErrors.changeSummary = 'กรุณาสรุปการเปลี่ยนแปลง';
    if (!formData.changeReason) newErrors.changeReason = 'กรุณาเลือกเหตุผลที่แก้ไข';
    if (formData.changeReason === 'OTHER' && !formData.otherReason) newErrors.otherReason = 'กรุณาระบุเหตุผลอื่นๆ';

    if (formData.relatedStandards?.includes('อื่น ๆ (Others)') && !formData.otherStandardDetail?.trim()) {
      newErrors.otherStandardDetail = 'กรุณาระบุมาตรฐานอื่นๆ';
    }

    if (formData.ackRequirement === 'REQUIRED' && !formData.ackUserId) {
      newErrors.ackUserId = 'กรุณาเลือกผู้รับ Acknowledgement 1 คน';
    }
    
    if (!formData.effectiveDate) {
      newErrors.effectiveDate = 'กรุณาระบุวันที่มีผลบังคับใช้';
    } else {
      const today = new Date(simulatedDate || Date.now());
      today.setHours(0,0,0,0);
      const selected = new Date(formData.effectiveDate);
      if (selected < today) newErrors.effectiveDate = 'ห้ามเลือกวันย้อนหลัง (นับจาก Simulated Date)';
    }
    
    if (!formData.file) newErrors.file = 'กรุณาแนบไฟล์ PDF ฉบับแก้ไข';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDraft = () => {
    const draftPayload = {
      id: targetDraftId || formData.id,
      dar_no: formData.darNo || formData.id,
      type: 'REVISION',
      status: 'DRAFT',
      title: formData.title || (selectedDoc ? selectedDoc.name : 'Untitled Draft'),
      requesterId: currentUser?.id,
      requester_id: currentUser?.id,
      requester_name: currentUser?.name,
      department: currentUser?.department || formData.department,
      date: formData.date || new Date().toISOString().split('T')[0],
      docIdRef: formData.docId,
      doc_id: formData.docId,
      targetDocumentId: formData.docId,
      document_code: selectedDoc?.title || formData.docCode || formData.docId,
      changeSummary: formData.changeSummary,
      change_summary: formData.changeSummary,
      reasonDetails: formData.changeSummary,
      changeReason: formData.changeReason,
      change_reason: formData.changeReason,
      reasonCategory: formData.changeReason,
      otherReason: formData.changeReason === 'OTHER' ? formData.otherReason : undefined,
      ackRequirement: formData.ackRequirement,
      requireAck: formData.ackRequirement === 'REQUIRED',
      ackUserIds: formData.ackRequirement === 'REQUIRED' ? (formData.ackUserId ? [formData.ackUserId] : []) : [],
      ackUserId: formData.ackUserId,
      distributions: formData.distributions || [],
      effectiveDate: formData.effectiveDate,
      effective_date: formData.effectiveDate,
      relatedStandards: formData.relatedStandards || [],
      otherStandardDetail: formData.otherStandardDetail,
      access_control: formData.access_control,
      accessScope: formData.access_control?.scope || formData.accessScope || 'GENERAL',
      isDraft: true
    };

    if (saveDarDraft) {
      saveDarDraft(draftPayload);
    } else {
      if (targetDraftId && deleteDar) deleteDar(targetDraftId);
      addDar(draftPayload);
    }

    toast.success('บันทึกแบบร่างสำเร็จ');
    navigate('/dashboard');
  };

  const handleFormSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const isValid = validate();
    if (isValid) {
      setShowConfirm(true);
    } else {
      console.error('DAR REVISION FORM VALIDATION FAILED:', formData);
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง');
    }
  };

  const executeSubmit = async () => {
    setIsSubmitting(true);
    try {
      const docTypeCode = selectedDoc?.docType || selectedDoc?.type || (selectedDoc?.title ? selectedDoc.title.split('-')[0] : (formData.docType || 'WI'));
      const docCodeStr = selectedDoc?.code || selectedDoc?.title || formData.docId;
      const docTitleStr = formData.title || selectedDoc?.name || 'Untitled Document';
      const nextRevStr = calculateNextRev(selectedDoc?.rev);

      const newDar = {
        type: 'REVISION',
        title: docTitleStr,
        name: docTitleStr,
        docTitle: docTitleStr,
        docCode: docCodeStr,
        document_code: docCodeStr,
        docIdRef: formData.docId,
        doc_id: formData.docId,
        targetDocumentId: formData.docId,
        docType: docTypeCode,
        currentRev: selectedDoc?.rev || '00',
        newRev: nextRevStr,
        rev: nextRevStr,
        requesterId: currentUser?.id || 'EMP-001',
        requester_id: currentUser?.id || 'EMP-001',
        requester_name: currentUser?.name || 'ธนาวุฒิ สมควรกิจดำรง',
        department: currentUser?.department || formData.department || 'PD',
        date: new Date().toISOString().split('T')[0],
        changeSummary: formData.changeSummary || '',
        change_summary: formData.changeSummary || '',
        changeReason: formData.changeReason || '',
        change_reason: formData.changeReason || '',
        otherReason: formData.changeReason === 'OTHER' ? formData.otherReason : undefined,
        ackRequirement: formData.ackRequirement || 'NOT_REQUIRED',
        requireAck: formData.ackRequirement === 'REQUIRED',
        ackUserIds: formData.ackRequirement === 'REQUIRED' ? (formData.ackUserId ? [formData.ackUserId] : []) : [],
        ackUserId: formData.ackUserId,
        distributions: formData.distributions || [],
        effectiveDate: formData.effectiveDate || '',
        effective_date: formData.effectiveDate || '',
        relatedStandards: formData.relatedStandards || [],
        otherStandardDetail: formData.otherStandardDetail || '',
        access_control: formData.access_control,
        accessScope: formData.access_control?.scope || 'GENERAL',
        manualReviewerId: formData.manualReviewerId,
        isDraft: false,
        status: 'UNDER_REVIEW'
      };

      if (targetDraftId && deleteDar) {
        deleteDar(targetDraftId);
      }

      addDar(newDar);
      setShowConfirm(false);
      toast.success('สร้างคำร้อง Revision สำเร็จ และส่งต่อให้ผู้ทบทวนแล้ว');
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to submit DAR Revision:', err);
      toast.error(`เกิดข้อผิดพลาดในการส่งคำร้อง: ${err?.message || 'Unknown Error'}`);
      setShowConfirm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-2 w-full max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
            <FileEdit size={22} strokeWidth={1.75}/>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1E1E1E] tracking-tight">ยื่นคำขอแก้ไขเอกสาร (Revision DAR)</h2>
            <p className="text-xs text-[#666666] mt-0.5">ปรับปรุงเอกสารที่มีผลบังคับใช้ พร้อมรัน Revision Number อัตโนมัติ</p>
          </div>
        </div>
        <button onClick={() => navigate('/dar/new')} className="flex items-center text-xs font-bold text-slate-600 hover:text-[#0D99FF] transition-colors cursor-pointer">
          <ChevronLeft size={16} /> เปลี่ยนประเภท DAR
        </button>
      </div>
      
      <form onSubmit={handleFormSubmit} className="space-y-4">
        
        {/* ================= UNIFIED HIGH-DENSITY MASTER FORM CANVAS ================= */}
        <div className="card-surface overflow-hidden divide-y divide-[#F1F5F9] shadow-2xs">
          
          {/* Section 1: ข้อมูลผู้ร้องขอ (Compact Metadata Strip) */}
          <div className="bg-[#F8FAFC] px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <User className="text-[#0D99FF] shrink-0" size={15} />
                <span className="text-sm font-bold text-[#1E293B] hidden sm:inline">ส่วนที่ 1: ข้อมูลผู้ร้องขอ (Requester Information)</span>
                <span className="text-[#CBD5E1] hidden sm:inline">•</span>
                <label className="text-sm font-semibold text-[#64748B] flex items-center gap-1.5 cursor-default">
                  <span>ชื่อผู้ร้องขอ (Requester):</span>
                  <strong className="text-[#1E293B] font-bold text-sm">{currentUser?.name || 'ธนาวุฒิ สมควรกิจดำรง'}</strong>
                </label>
              </div>

              <div className="flex items-center gap-1.5 text-[#64748B] text-sm">
                <span>แผนก:</span>
                <span className="font-mono font-bold text-[#0D99FF] bg-[#E5F4FF] px-2 py-0.5 rounded text-xs">
                  {currentUser?.department || currentUser?.dept || 'PD'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[#64748B] text-sm">
                <Calendar size={14} className="text-[#94A3B8]" />
                <label className="flex items-center gap-1 cursor-default">
                  <span>วันที่ยื่นคำขอ:</span>
                  <span className="font-mono font-medium text-[#1E293B] text-xs">
                    {new Date().toLocaleDateString('th-TH')}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                [ ฉบับร่าง (รอออกเลข DAR หลังส่งคำร้อง) ]
              </span>
              <div className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                ขอแก้ไข (REVISION)
              </div>
            </div>
          </div>

          {/* Section 2: เลือกเอกสารและกำหนดวันบังคับใช้ (4-Column Grid) */}
          <div className="p-5 space-y-3 bg-white">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-bold text-sm text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <Settings className="text-[#0D99FF]" size={16} />
                <span className="font-bold text-sm text-[#1E293B]">ส่วนที่ 2: เลือกเอกสารและกำหนดวันบังคับใช้</span>
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-start pt-1">
              
              {/* 1. เลือกเอกสารเดิม (4 Cols) */}
              <div className="lg:col-span-4">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  เลือกเอกสารเดิม (จากคลัง Active) <span className="text-[#EF4444]">*</span>
                </label>

                {lockedSourceError ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-700">
                    <p className="font-bold">{lockedSourceError}</p>
                  </div>
                ) : lockedSource ? (
                  <div className="h-10.5 px-3 bg-[#E5F4FF]/70 border border-indigo-200 rounded-lg text-xs font-mono font-bold text-[#007BE5] flex items-center justify-between truncate">
                    <span className="truncate">[{lockedSource.documentCode}] {lockedSource.documentTitle}</span>
                  </div>
                ) : selectedDoc ? (
                  <div className="h-10.5 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold text-[#0D99FF] text-xs bg-[#E5F4FF] px-2 py-0.5 rounded shrink-0">{selectedDoc.title}</span>
                      <span className="text-xs text-[#334155] truncate font-medium">{selectedDoc.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearDoc}
                      className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded cursor-pointer shrink-0"
                      title="เปลี่ยนเอกสาร"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={searchContainerRef}>
                    <div className="flex gap-2">
                      <select
                        value={docTypeFilter}
                        onChange={(e) => setDocTypeFilter(e.target.value)}
                        className="select-primary text-xs w-28 sm:w-44 h-10.5 px-2 bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] focus:outline-none focus:border-[#0D99FF]"
                      >
                        <option value="">ทุกประเภท</option>
                        {activeDocumentTypes.map(t => {
                          const code = t.code || t.id;
                          const name = t.nameTh || t.name;
                          return <option key={code} value={code}>{name} ({code})</option>;
                        })}
                      </select>
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={15} />
                        <input
                          type="text"
                          placeholder="ค้นหารหัส หรือชื่อ..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsDropdownOpen(true);
                          }}
                          onFocus={() => setIsDropdownOpen(true)}
                          className={`w-full pl-9 pr-7 h-10.5 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all ${errors.docId ? 'border-rose-400 bg-rose-50/50' : ''}`}
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 border border-[#E2E8F0] rounded-xl max-h-52 overflow-y-auto divide-y divide-slate-100 shadow-xl bg-white z-30">
                        {filteredDocs.length > 0 ? (
                          filteredDocs.map(doc => (
                            <div
                              key={doc.id}
                              onClick={() => handleDocSelect(doc)}
                              className="p-3 hover:bg-[#E5F4FF]/50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-[#0D99FF]">{doc.title}</span>
                                  <span className="text-slate-400 font-mono text-[10px]">Rev.{doc.rev}</span>
                                </div>
                                <p className="text-[#334155] font-medium truncate mt-0.5">{doc.name}</p>
                              </div>
                              <span className="text-[10px] font-bold text-[#64748B] font-mono shrink-0">{doc.department}</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-slate-400 text-xs">
                            ไม่พบเอกสารที่มีผลบังคับใช้
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {errors.docId && <p className="text-rose-500 text-xs mt-1">{errors.docId}</p>}
              </div>

              {/* 2. ชื่อเอกสาร (แก้ไข) (4 Cols) */}
              <div className="lg:col-span-4">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  ชื่อเอกสาร (แก้ไข) <span className="text-[#EF4444]">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="ระบุชื่อเอกสาร (สามารถใช้ชื่อเดิมได้)..."
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))}
                  className={`w-full h-10.5 px-3.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all ${errors.title ? 'border-rose-400 bg-rose-50/50' : ''}`}
                />
                {errors.title && <p className="text-rose-500 text-xs mt-1">{errors.title}</p>}
              </div>

              {/* 3. วันที่มีผลบังคับใช้ใหม่ (2 Cols) */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  วันที่มีผลบังคับใช้ <span className="text-[#EF4444]">*</span>
                </label>
                <input 
                  type="date"
                  value={formData.effectiveDate}
                  min={new Date(simulatedDate || Date.now()).toISOString().split('T')[0]}
                  onChange={(e) => setFormData(prev => ({...prev, effectiveDate: e.target.value}))}
                  className={`w-full h-10.5 px-3 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all font-mono ${errors.effectiveDate ? 'border-rose-400 bg-rose-50/50' : ''}`}
                />
                {errors.effectiveDate && <p className="text-rose-500 text-xs mt-1">{errors.effectiveDate}</p>}
              </div>

              {/* 4. ฉบับที่ปรับปรุง (Revision) (2 Cols) */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  ฉบับปรับปรุง (Revision)
                </label>
                <div className="h-10.5 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-mono font-bold text-[#0D99FF] flex items-center justify-between select-none">
                  <span className="text-slate-500">Rev.{selectedDoc?.rev || '00'}</span>
                  <span className="text-slate-400 font-sans">➔</span>
                  <span className="text-emerald-600 font-bold">Rev.{calculateNextRev(selectedDoc?.rev || '00')}</span>
                </div>
              </div>

            </div>

            {/* Active Controlled Copies Matrix */}
            {selectedDoc && (
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-[#0D99FF]" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#1E293B]">
                      สำเนาควบคุมปัจจุบันที่ใช้งานอยู่ในสายงาน (Current Active Copies in Circulation)
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    พบ {activeCopiesInCirculation.length} สำเนา
                  </span>
                </div>

                {/* ISO 9001 Recall Warning Banner */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold">ข้อกำหนด ISO 9001 (Control of Documented Information): </span>
                    <span>เมื่อคำร้องนี้ได้รับการอนุมัติ สำเนาทั้งหมดในรายการนี้จะถูกเรียกคืนกลับสู่ฝ่าย DC</span>
                  </div>
                </div>

                {/* Table */}
                {activeCopiesInCirculation.length > 0 ? (
                  <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F8FAFC] text-[#475569] font-bold border-b border-[#E2E8F0] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">หมายเลขสำเนา (Copy No.)</th>
                          <th className="py-2.5 px-3">แผนกผู้ถือครอง (Department)</th>
                          <th className="py-2.5 px-3">จุดใช้งานจริง (Location)</th>
                          <th className="py-2.5 px-3 text-center">Rev ปัจจุบัน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] bg-white">
                        {activeCopiesInCirculation.map((c, idx) => (
                          <tr key={c.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#0D99FF]">
                              Copy {c.copy_no || c.copyNo || c.ccNumber || String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#1E293B]">
                              <span className="inline-flex items-center gap-1">
                                <Building size={12} className="text-slate-400" />
                                {c.holder_dept || c.department || c.dept || '-'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[#334155]">
                              {c.location || c.locationName || c.station_name || c.holder_name || `${c.holder_dept || c.department || 'PD'} Station`}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                              Rev.{c.rev || c.doc_version || c.revision || selectedDoc?.rev || '00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    ไม่พบสำเนาควบคุมที่ใช้งานอยู่ในสายงานสำหรับเอกสารนี้ (ไม่มีภาระงานเรียกคืนเล่มจริง)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: รายละเอียดการขอแก้ไขและเอกสารแนบ (50/50 Symmetrical Equal-Height Grid) */}
          <div className="p-5 space-y-4 bg-white">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-bold text-sm text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <FileText className="text-[#0D99FF]" size={16} />
                <span className="font-bold text-sm text-[#1E293B]">ส่วนที่ 3: รายละเอียดการขอแก้ไขเอกสารและเอกสารแนบ</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              
              {/* ================= ฝั่งซ้าย (50%): เหตุผล & สรุปการเปลี่ยนแปลง ================= */}
              <div className="flex flex-col justify-between space-y-4 h-full">
                
                {/* 1. เหตุผลการขอแก้ไข */}
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    เหตุผลการขอแก้ไข (Reason for Change) <span className="text-[#EF4444]">*</span>
                  </label>
                  <select
                    value={formData.changeReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, changeReason: e.target.value }))}
                    className={`w-full h-10.5 px-3.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all ${errors.changeReason ? 'border-rose-400 bg-rose-50/50' : ''}`}
                  >
                    <option value="">-- เลือกเหตุผลการแก้ไข --</option>
                    <option value="PROCESS_CHANGE">การปรับเปลี่ยนกระบวนการปฏิบัติงาน (Process Change)</option>
                    <option value="EQUIPMENT_CHANGE">การเปลี่ยนแปลงเครื่องจักรหรืออุปกรณ์ (Equipment Change)</option>
                    <option value="AUDIT_FINDING">ข้อเสนอแนะจากการตรวจประเมิน / CAPA (Audit Finding)</option>
                    <option value="PERIODIC_REVIEW">การทบทวนตามรอบระยะเวลา (Periodic Review)</option>
                    <option value="OTHER">อื่น ๆ (Other)</option>
                  </select>
                  {errors.changeReason && <p className="text-rose-500 text-xs mt-1">{errors.changeReason}</p>}

                  {formData.changeReason === 'OTHER' && (
                    <div className="mt-2.5">
                      <input
                        type="text"
                        value={formData.otherReason}
                        onChange={(e) => setFormData(prev => ({ ...prev, otherReason: e.target.value }))}
                        className={`w-full h-10 px-3.5 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] ${errors.otherReason ? 'border-rose-400 bg-rose-50/50' : ''}`}
                        placeholder="ระบุเหตุผลความจำเป็น..."
                      />
                      {errors.otherReason && <p className="text-rose-500 text-xs mt-1">{errors.otherReason}</p>}
                    </div>
                  )}
                </div>

                {/* 2. สรุปรายละเอียดการเปลี่ยนแปลง */}
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    สรุปรายละเอียดการเปลี่ยนแปลง (Change Summary) <span className="text-[#EF4444]">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={formData.changeSummary}
                    onChange={(e) => setFormData(prev => ({ ...prev, changeSummary: e.target.value }))}
                    className={`w-full flex-1 min-h-[100px] lg:min-h-[125px] p-3.5 text-sm bg-white border border-[#CBD5E1] rounded-xl text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D99FF] focus:ring-2 focus:ring-[#0D99FF]/15 transition-all leading-relaxed resize-none ${errors.changeSummary ? 'border-rose-400 bg-rose-50/50' : ''}`}
                    placeholder="ระบุข้อความ หัวข้อ หรือขั้นตอนที่ทำการแก้ไข..."
                  />
                  {errors.changeSummary && <p className="text-rose-500 text-xs mt-1">{errors.changeSummary}</p>}
                </div>

              </div>

              {/* ================= ฝั่งขวา (50%): Standards, Upload & Ack Protocol ================= */}
              <div className="flex flex-col justify-between space-y-4 bg-[#F8FAFC] border border-[#E2E8F0] p-4.5 rounded-xl h-full">
                
                {/* 1. ระบบมาตรฐานที่เกี่ยวข้อง */}
                <div>
                  <RelatedStandardsSelector
                    value={{
                      relatedStandards: formData.relatedStandards,
                      otherStandardDetail: formData.otherStandardDetail
                    }}
                    onChange={(newVals) => setFormData(prev => ({ ...prev, ...newVals }))}
                    error={errors.otherStandardDetail}
                  />
                </div>

                {/* 2. อัปโหลดไฟล์เอกสารฉบับแก้ไข (Compact Dropzone) */}
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    อัปโหลดไฟล์เอกสารฉบับแก้ไข (PDF เท่านั้น) <span className="text-[#EF4444]">*</span>
                  </label>
                  <div 
                    onClick={() => {
                      const fileInput = document.getElementById('dar-revision-pdf-input');
                      if (fileInput) fileInput.click();
                    }}
                    className="h-20 border-2 border-dashed border-[#CBD5E1] hover:border-[#0D99FF] rounded-xl p-3 flex items-center justify-center gap-3 bg-white hover:bg-[#F0F7FF]/40 transition-all cursor-pointer group"
                  >
                    <div className="p-2 bg-[#F1F5F9] group-hover:bg-[#E5F4FF] rounded-lg text-[#0D99FF] transition-colors shrink-0">
                      <UploadCloud size={20} />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#1E293B] truncate">
                        {formData.file ? formData.file.name : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง'}
                      </p>
                      <p className="text-[10px] text-[#94A3B8]">รองรับไฟล์ PDF สูงสุด 25 MB</p>
                    </div>
                    <input 
                      id="dar-revision-pdf-input"
                      type="file" 
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </div>
                  {errors.file && <p className="text-rose-500 text-xs mt-1.5">{errors.file}</p>}
                </div>

                {/* 3. การรับทราบเอกสาร */}
                <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-[#334155]">
                      การรับทราบเอกสาร <span className="text-[#EF4444]">*</span>
                    </label>
                    {selectedDoc && selectedDoc.title && selectedDoc.title.startsWith('FM') ? (
                      <div className="flex items-center gap-1.5 text-indigo-900 bg-[#E5F4FF]/70 px-2.5 py-1 rounded-md text-xs font-medium border border-indigo-100">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-[#0D99FF]" />
                        <span>แบบฟอร์ม (FM): ไม่ต้องรับทราบ</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 text-xs sm:text-sm">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-[#475569]">
                          <input 
                            type="radio" 
                            name="ack"
                            value="NOT_REQUIRED"
                            checked={formData.ackRequirement === 'NOT_REQUIRED'}
                            onChange={(e) => setFormData(prev => ({...prev, ackRequirement: e.target.value, ackUserId: ''}))}
                            className="w-4 h-4 text-[#0D99FF] focus:ring-[#0D99FF]"
                          />
                          <span>ไม่ต้องรับทราบ</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-[#475569]">
                          <input 
                            type="radio" 
                            name="ack"
                            value="REQUIRED"
                            checked={formData.ackRequirement === 'REQUIRED'}
                            onChange={(e) => setFormData(prev => ({...prev, ackRequirement: e.target.value}))}
                            className="w-4 h-4 text-[#0D99FF] focus:ring-[#0D99FF]"
                          />
                          <span>ต้องรับทราบ</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {formData.ackRequirement === 'REQUIRED' && !(selectedDoc && selectedDoc.title && selectedDoc.title.startsWith('FM')) && (
                    <div className={`p-3 rounded-lg border ${errors.ackUserId ? 'border-rose-300 bg-rose-50' : 'border-indigo-100 bg-white'}`}>
                      <p className="text-xs font-semibold text-[#334155] mb-1.5">เลือกผู้ที่ต้องรับทราบเอกสารนี้ (1 คน)</p>
                      <UserSelector 
                        value={formData.ackUserId} 
                        onChange={(id) => setFormData(prev => ({...prev, ackUserId: id}))} 
                        error={errors.ackUserId} 
                        users={(masterUsers || []).filter(u => u && u.id !== currentUser?.id && !u.isDcc && u.role !== 'DCC_ADMIN')} 
                      />
                      {errors.ackUserId && <p className="text-rose-500 text-xs mt-1">{errors.ackUserId}</p>}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>

        </div>

        {/* Document Access Scope & Confidentiality with Reactive Distribution Pruning */}
        <DocumentAccessControlSelector
          value={formData.access_control}
          onChange={handleAccessControlChange}
          ownerDept={selectedDoc?.department || currentUser?.department || 'PD'}
          masterDepartments={useStore.getState().masterDepartments || useStore.getState().departments || []}
          masterUsers={masterUsers || []}
          workflowParticipants={workflowParticipants || []}
        />

        {/* Distribution Setup with Two-Way Binding */}
        <DistributionSetup 
          ownerDept={currentUser?.department || 'PD'}
          distributions={formData.distributions || []}
          oldDistributions={selectedDoc?.distributions || []}
          onChange={(distributions) => setFormData(prev => ({ ...prev, distributions }))}
          documentType={selectedDoc?.title ? selectedDoc.title.split('-')[0] : 'WI'}
          accessControl={formData.access_control}
          accessScope={formData.access_control?.scope}
        />

        {/* ========================================================================= */}
        {/* WIDGET: CIRCULATION & LIFECYCLE IMPACT SUMMARY (BENTO COMPARATIVE CARD)  */}
        {/* ISO 9001: 7.5 Control of Documented Information Compliance Evidence       */}
        {/* ========================================================================= */}
        {selectedDoc && (
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5.5 space-y-4 shadow-xs">
            {/* Header Title */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <Layers size={16} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                    สรุปผลกระทบการหมุนเวียนสำเนา (Circulation & Lifecycle Impact Summary)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    เปรียบเทียบภาระงานเรียกคืนเล่มเดิม vs. การจัดพิมพ์ส่งมอบเล่มใหม่เมื่อคำร้องได้รับการอนุมัติ (ISO 9001: 7.5)
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-white text-slate-600 border border-slate-200 shadow-2xs">
                {selectedDoc.title} Rev.{selectedDoc.rev || '00'} ➔ Rev.{calculateNextRev(selectedDoc.rev)}
              </span>
            </div>

            {/* Split Comparative Columns (Bento Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              
              {/* 1. ฝั่งซ้าย: สำเนาเดิมที่จะถูกเรียกคืน (Copies to Recall) */}
              <div className="border border-amber-200/90 bg-amber-50/40 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 shadow-2xs">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center">
                        <RotateCcw size={14} strokeWidth={2.2} />
                      </div>
                      <span className="text-xs font-bold text-amber-950">
                        เรียกคืนสำเนาฉบับเดิม (Rev.{selectedDoc.rev || '00'})
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-100/90 text-amber-800 border border-amber-200">
                      ทั้งหมด {activeCopiesInCirculation.length} เล่ม
                    </span>
                  </div>

                  <p className="text-[11px] text-amber-800/85 leading-relaxed">
                    สำเนาควบคุมปัจจุบันที่ใช้งานอยู่ในสายงาน จะถูกเรียกคืนกลับสู่ฝ่าย DC เพื่อดำเนินการทำลายหรือประทับตราตกรุ่น
                  </p>

                  {/* List of Copies to Recall */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {activeCopiesInCirculation.length > 0 ? (
                      activeCopiesInCirculation.map((c, idx) => {
                        const copyNum = c.copy_no || c.copyNo || c.ccNumber || String(idx + 1).padStart(2, '0');
                        const dept = c.holder_dept || c.department || c.dept || '-';
                        const loc = c.location || c.locationName || c.station_name || `${dept} Station`;
                        return (
                          <div 
                            key={c.id || idx}
                            className="flex items-center justify-between px-3 py-2 bg-white/90 border border-amber-200/70 rounded-xl text-xs shadow-2xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                                Copy {copyNum}
                              </span>
                              <span className="font-semibold text-slate-800 shrink-0">({dept})</span>
                              <span className="text-slate-600 truncate text-[11px]" title={loc}>
                                {loc}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-amber-700 font-semibold shrink-0">
                              Rev.{c.rev || c.doc_version || selectedDoc.rev || '00'}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 bg-white/80 border border-amber-200/60 rounded-xl text-center text-xs text-amber-800/70">
                        ไม่พบสำเนาควบคุมเดิมในระบบ (ไม่มีภาระการเรียกคืนเล่มจริง)
                      </div>
                    )}
                  </div>
                </div>

                {/* Compliance Tag Footer */}
                <div className="pt-2.5 border-t border-amber-200/70 flex items-center gap-2 text-[11px] font-semibold text-amber-900">
                  <ShieldCheck size={14} className="text-amber-600 shrink-0" />
                  <span>ระบบจะสร้าง Task เรียกคืนส่งให้ฝ่าย DC ดำเนินการโดยอัตโนมัติ</span>
                </div>
              </div>

              {/* 2. ฝั่งขวา: สำเนาใหม่ที่จะจัดพิมพ์และแจกจ่าย (New Copies to Issue) */}
              <div className="border border-emerald-200/90 bg-emerald-50/40 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 shadow-2xs">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center">
                        <Printer size={14} strokeWidth={2.2} />
                      </div>
                      <span className="text-xs font-bold text-emerald-950">
                        จัดพิมพ์และแจกจ่ายฉบับใหม่ (Rev.{calculateNextRev(selectedDoc.rev)})
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-100/90 text-emerald-800 border border-emerald-200">
                      รวม {(formData.distributions || []).length} เล่ม
                    </span>
                  </div>

                  <p className="text-[11px] text-emerald-800/85 leading-relaxed">
                    สำเนาควบคุมฉบับปรับปรุงใหม่ที่จะส่งมอบให้ผู้ถือครองประจำจุดใช้งานที่กำหนด
                  </p>

                  {/* List of New Copies to Distribute with Interactive Tag Removal */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {(formData.distributions || []).length > 0 ? (
                      (formData.distributions || []).map((dist, idx) => {
                        const copyNum = dist.copyNo || dist.copy_no || String(idx + 1).padStart(2, '0');
                        const isMaster = dist.isMaster || dist.is_master || copyNum === '01';
                        const dept = dist.departmentId || dist.dept || dist.dept_code || dist.department || selectedDoc.department || 'PD';
                        const loc = dist.locationName || dist.station_name || dist.location || `${dept} Station`;
                        return (
                          <div 
                            key={dist.id || `${dept}-${idx}`}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border shadow-2xs transition-all ${
                              isMaster 
                                ? 'bg-zinc-900 text-white border-zinc-800' 
                                : 'bg-white/90 border-emerald-200/70 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] shrink-0 ${
                                isMaster 
                                  ? 'bg-amber-400 text-zinc-950' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                Copy {copyNum}
                              </span>
                              <span className={`font-semibold shrink-0 ${isMaster ? 'text-zinc-200' : 'text-slate-800'}`}>
                                ({dept})
                              </span>
                              <span className={`truncate text-[11px] ${isMaster ? 'text-zinc-300' : 'text-slate-600'}`} title={loc}>
                                {loc}
                              </span>
                              {isMaster && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-amber-300 border border-zinc-700 font-bold shrink-0">
                                  Master
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[10px] font-mono font-semibold ${isMaster ? 'text-zinc-400' : 'text-emerald-700'}`}>
                                Rev.{calculateNextRev(selectedDoc.rev)}
                              </span>
                              {!isMaster && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDistributionChip(dist)}
                                  className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                                  title="ปลดจุดนี้ออกจากรายการสำเนาใหม่"
                                >
                                  <X size={13} strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 bg-white/80 border border-emerald-200/60 rounded-xl text-center text-xs text-emerald-800/70">
                        ยังไม่ได้เลือกสำเนาควบคุมสำหรับฉบับใหม่
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Tag Footer */}
                <div className="pt-2.5 border-t border-emerald-200/70 flex items-center gap-2 text-[11px] font-semibold text-emerald-900">
                  <Printer size={14} className="text-emerald-600 shrink-0" />
                  <span>ระบบจะสร้าง Task พิมพ์ส่งมอบให้ฝ่าย DC ดำเนินการตามรายการนี้</span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="card-surface p-4 flex justify-end gap-2.5 shadow-2xs mb-2">
          <Button 
            variant="ghost"
            type="button" 
            onClick={() => navigate('/dashboard')}
          >
            <X size={15} className="mr-1"/> ยกเลิก (Cancel)
          </Button>
          <Button 
            variant="secondary"
            type="button" 
            onClick={handleDraft}
          >
            บันทึกแบบร่าง (Draft)
          </Button>
          <Button 
            variant="primary"
            type="submit" 
            onClick={handleFormSubmit}
          >
            ส่งคำขอ Revision (Submit DAR)
          </Button>
        </div>
      </form>

      {(() => {
        const docTypeCode = selectedDoc?.docType || selectedDoc?.type || (selectedDoc?.title ? selectedDoc.title.split('-')[0] : (formData.docType || 'WI'));
        const resolvedRevId = formData.manualReviewerId
          ? formData.manualReviewerId
          : (resolveReviewer(currentUser?.id, currentUser?.department || 'PD', masterUsers || [], reviewUsers || masterUsers || [], docTypeCode)?.id);
        const resolvedReviewerObj = (masterUsers || []).find(u => u && u.id === resolvedRevId);

        return (
          <ActionConfirmModal
            isOpen={showConfirm}
            onClose={() => setShowConfirm(false)}
            onConfirm={executeSubmit}
            isLoading={isSubmitting}
            title="ยืนยันการส่งคำร้องขอแก้ไขเอกสาร (Revision DAR)"
            actionType="submit"
            confirmText="ยืนยันการส่งคำร้องขอแก้ไข"
            cancelText="ยกเลิก / กลับไปแก้ไข"
            summaryData={[
              {
                label: 'ผู้ร้องขอ / แผนก',
                value: (
                  <span className="font-medium text-slate-800">
                    {currentUser?.name || 'ธนาวุฒิ สมควรกิจดำรง'} ({currentUser?.department || 'PD'})
                  </span>
                )
              },
              {
                label: 'รหัสเอกสาร',
                value: (
                  <span className="font-mono font-bold text-[#0D99FF] bg-[#E5F4FF] px-2.5 py-0.5 rounded-md border border-indigo-100">
                    {selectedDoc?.title || formData.docId}
                  </span>
                )
              },
              {
                label: 'การเปลี่ยนแปลงฉบับ',
                value: (
                  <div className="flex items-center gap-2 font-mono text-sm font-bold">
                    <span className="bg-[#F5F5F5] text-slate-600 px-2 py-0.5 rounded border border-[#E5E5E5]">
                      Rev. {selectedDoc?.rev || '00'}
                    </span>
                    <span className="text-slate-400">➔</span>
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                      Rev. {calculateNextRev(selectedDoc?.rev)}
                    </span>
                  </div>
                )
              },
              {
                label: 'ชื่อเอกสารฉบับใหม่',
                value: (
                  <span className="text-sm sm:text-[15px] font-bold text-[#1E1E1E] leading-relaxed">
                    {formData.title || selectedDoc?.name}
                  </span>
                )
              },
              {
                label: 'รายละเอียดและสรุปการแก้ไข',
                value: (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-[#F5F5F5] p-3 rounded-xl border border-[#E5E5E5]/70">
                    {formData.changeSummary}
                  </div>
                )
              },
              {
                label: 'เหตุผลการร้องขอแก้ไข',
                value: (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-[#F5F5F5] p-3 rounded-xl border border-[#E5E5E5]/70">
                    {formData.changeReason === 'OTHER' ? `อื่นๆ: ${formData.otherReason || '-'}` : (formData.changeReason || '-')}
                  </div>
                )
              },
              {
                label: 'มาตรฐานที่เกี่ยวข้อง',
                value: (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {(formData.relatedStandards || []).length > 0 ? (
                      formData.relatedStandards.map((std, idx) => (
                        <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F5F5F5] text-slate-700 border border-[#E5E5E5]">
                          {std === 'อื่น ๆ (Others)' ? `อื่นๆ: ${formData.otherStandardDetail || '-'}` : std}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">ไม่ได้ระบุ</span>
                    )}
                  </div>
                )
              },
              {
                label: 'วันที่มีผลบังคับใช้ฉบับใหม่',
                value: (
                  <span className="font-mono font-bold text-slate-800 bg-[#F5F5F5] px-2.5 py-0.5 rounded-md">
                    {formData.effectiveDate || '-'}
                  </span>
                )
              },
              {
                label: 'ขั้นตอนถัดไป / ผู้มีอำนาจทบทวน',
                value: (
                  <div className="text-xs sm:text-sm font-medium text-indigo-800 bg-[#E5F4FF]/80 p-2.5 rounded-xl border border-indigo-100 flex items-center gap-1.5">
                    <span>ส่งต่อให้:</span>
                    <strong className="font-bold">
                      {resolvedReviewerObj ? `${resolvedReviewerObj.name} (${resolvedReviewerObj.position || resolvedReviewerObj.department})` : 'ผู้ทบทวนตามสายงาน (Reviewer Level 2)'}
                    </strong>
                  </div>
                )
              }
            ]}
          />
        );
      })()}
    </div>
  );
};

export default DarRevisionForm;
