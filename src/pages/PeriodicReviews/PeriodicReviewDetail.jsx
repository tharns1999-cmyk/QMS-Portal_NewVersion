import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { 
  FileText, 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert,
  ShieldCheck,
  FileEdit,
  Ban,
  Eye,
  History,
  Send,
  Zap,
  Clock,
  RotateCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import useStore, { canFastTrackReview } from '../../store/useStore';
import { getPeriodicReviewForUser, canPerformPeriodicReview, getPositionLevelForDepartment } from '../../services/PeriodicReviewAccessService';
import { getReviewStatusLabel, getReviewOutcomeLabel } from '../../services/PeriodicReviewService';
import { formatQmsDisplayDate } from '../../utils/dateFormatter';
import DocumentDetailModal from '../../components/workflow/DocumentDetailModal';
import ExternalDocDetailModal from '../ExternalDocs/ExternalDocDetailModal';

const stripAutoSchedulePrefix = (val) => {
  if (!val) return '';
  return String(val).replace(/^PRS-(?:AUTO-(?:EXT-)?|GEN-)/i, '');
};

const extractDeptFromDocCode = (code) => {
  const match = String(code || '').toUpperCase().match(/^(?:ED|FM|WI|QP|QM|SD)-([A-Z0-9]+)-/);
  return match ? match[1] : null;
};

const matchesDocKey = (doc, key) => {
  if (!doc || !key) return false;
  const k = String(key).trim();
  const stripped = stripAutoSchedulePrefix(k);
  const candidates = [doc.id, doc.docCode, doc.code, doc.documentNumber, doc.edCode, doc.doc_code]
    .filter(Boolean)
    .map(v => String(v).trim());
  return candidates.includes(k) || (stripped && candidates.includes(stripped));
};

const isDocActive = (doc) =>
  !['SUPERSEDED', 'OBSOLETE', 'CANCELLED', 'ARCHIVED'].includes(String(doc?.status || '').toUpperCase());

const PeriodicReviewDetail = () => {
  const { reviewId, docCode, id: routeParamId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const taskId = searchParams.get('taskId');
  const navigate = useNavigate();
  const periodicReviewSchedules = useStore(state => state.periodicReviewSchedules);
  const tasks = useStore(state => state.tasks);
  const documents = useStore(state => state.documents);
  const externalDocuments = useStore(state => state.externalDocuments);
  const dars = useStore(state => state.dars);
  const { currentUser, submitPeriodicReview, simulatedSystemDate, getEffectiveToday } = useStore();
  
  const effectiveToday = getEffectiveToday ? getEffectiveToday() : (simulatedSystemDate ? new Date(simulatedSystemDate) : new Date());

  const paramId = reviewId || docCode || routeParamId;
  const targetTask = taskId ? (tasks || []).find(t => t.id === taskId) : null;
  const stateRecord = location.state?.record || location.state?.schedule || null;
  const stateDoc = location.state?.document || location.state?.doc || null;

  const rawKeys = [
    paramId,
    reviewId,
    docCode,
    routeParamId,
    searchParams.get('docCode'),
    searchParams.get('docId'),
    searchParams.get('scheduleId'),
    location.state?.docCode,
    location.state?.docId,
    location.state?.scheduleId,
    stateRecord?.id,
    stateRecord?.documentNumber,
    stateRecord?.docCode,
    stateRecord?.documentId,
    stateRecord?.externalDocumentId,
    targetTask?.scheduleId,
    targetTask?.docCode,
    targetTask?.documentNumber,
    targetTask?.docId
  ].filter(Boolean).map(v => String(v).trim());

  const candidateKeys = Array.from(
    new Set([
      ...rawKeys,
      ...rawKeys.map(stripAutoSchedulePrefix).filter(Boolean)
    ])
  );

  // 1. Match existing schedule in periodicReviewSchedules
  const matchedSchedule = (periodicReviewSchedules || []).find(s =>
    candidateKeys.some(k =>
      s.id === k ||
      s.documentNumber === k ||
      s.docCode === k ||
      s.documentId === k ||
      s.externalDocumentId === k
    )
  );

  if (matchedSchedule) {
    [
      matchedSchedule.id,
      matchedSchedule.documentNumber,
      matchedSchedule.docCode,
      matchedSchedule.documentId,
      matchedSchedule.externalDocumentId
    ]
      .filter(Boolean)
      .forEach(v => {
        const s = String(v).trim();
        if (!candidateKeys.includes(s)) candidateKeys.push(s);
      });
  }

  // 2. Match internal & external documents (prefer active over superseded/obsolete)
  const internalMatches = (documents || []).filter(d => candidateKeys.some(k => matchesDocKey(d, k)));
  const matchedInternalDoc = internalMatches.find(isDocActive) || internalMatches[0] || null;

  const externalMatches = (externalDocuments || []).filter(d => candidateKeys.some(k => matchesDocKey(d, k)));
  const matchedExternalDoc = externalMatches.find(isDocActive) || externalMatches[0] || null;

  const resolvedExternalFlag = Boolean(
    matchedExternalDoc ||
    stateDoc?.is_external ||
    stateDoc?.external ||
    stateDoc?.isExternal ||
    stateDoc?.doc_type === 'EXTERNAL' ||
    stateDoc?.edCode ||
    stateRecord?.isExternal ||
    stateRecord?.documentCategory === 'EXTERNAL' ||
    matchedSchedule?.documentCategory === 'EXTERNAL' ||
    matchedSchedule?.isExternal ||
    matchedSchedule?.externalDocumentId ||
    location.state?.isExternal ||
    searchParams.get('isExternal') === 'true' ||
    candidateKeys.some(k => String(k).toUpperCase().startsWith('ED-'))
  );

  const resolvedDoc = (resolvedExternalFlag
    ? (matchedExternalDoc || matchedInternalDoc)
    : (matchedInternalDoc || matchedExternalDoc)) || stateDoc || null;

  const resolvedDocCode =
    resolvedDoc?.docCode ||
    resolvedDoc?.code ||
    resolvedDoc?.documentNumber ||
    resolvedDoc?.edCode ||
    matchedSchedule?.documentNumber ||
    matchedSchedule?.docCode ||
    stateRecord?.documentNumber ||
    stateRecord?.docCode ||
    docCode ||
    stripAutoSchedulePrefix(paramId) ||
    '';

  const resolvedDept =
    resolvedDoc?.department ||
    resolvedDoc?.owner_dept ||
    resolvedDoc?.dept ||
    (matchedSchedule?.ownerDepartmentId && matchedSchedule.ownerDepartmentId !== 'DC' ? matchedSchedule.ownerDepartmentId : null) ||
    stateRecord?.ownerDepartmentId ||
    stateRecord?.department ||
    extractDeptFromDocCode(resolvedDocCode) ||
    matchedSchedule?.ownerDepartmentId ||
    'DC';

  // Synthesize or enrich schedule when a schedule or document is found
  const synthesizedSchedule = (matchedSchedule || resolvedDoc || stateRecord) ? {
    ...(stateRecord || {}),
    ...(matchedSchedule || {}),
    id: matchedSchedule?.id || stateRecord?.id || (resolvedDoc?.id ? `PRS-AUTO-${resolvedDoc.id}` : (paramId || `PRS-AUTO-${resolvedDocCode}`)),
    documentCategory: resolvedExternalFlag ? 'EXTERNAL' : (matchedSchedule?.documentCategory || stateRecord?.documentCategory || 'INTERNAL'),
    isExternal: resolvedExternalFlag,
    documentId: resolvedExternalFlag ? (matchedSchedule?.documentId || null) : (resolvedDoc?.id || matchedSchedule?.documentId || stateRecord?.documentId || null),
    externalDocumentId: resolvedExternalFlag ? (resolvedDoc?.id || matchedSchedule?.externalDocumentId || stateRecord?.externalDocumentId || null) : (matchedSchedule?.externalDocumentId || null),
    documentNumber: resolvedDocCode || matchedSchedule?.documentNumber || '',
    docCode: resolvedDocCode || matchedSchedule?.docCode || '',
    documentName: matchedSchedule?.documentName || resolvedDoc?.title || resolvedDoc?.name || stateRecord?.documentName || stateRecord?.title || resolvedDocCode,
    rev: matchedSchedule?.rev || resolvedDoc?.sourceVersion || resolvedDoc?.edition || resolvedDoc?.revision || resolvedDoc?.rev || stateRecord?.rev || (resolvedExternalFlag ? '-' : '00'),
    edition: resolvedDoc?.sourceVersion || resolvedDoc?.edition || matchedSchedule?.edition || stateRecord?.edition || null,
    sourceVersion: resolvedDoc?.sourceVersion || resolvedDoc?.edition || matchedSchedule?.sourceVersion || null,
    issuer: resolvedDoc?.issuer || resolvedDoc?.officialIssuer || resolvedDoc?.source || resolvedDoc?.issuing_agency || matchedSchedule?.issuer || stateRecord?.issuer || null,
    ownerDepartmentId: resolvedDept,
    ownerUserId: matchedSchedule?.ownerUserId || resolvedDoc?.owner || resolvedDoc?.owner_name || stateRecord?.ownerUserId || stateRecord?.owner || 'ไม่ระบุ',
    originalReviewAnchorDate: matchedSchedule?.originalReviewAnchorDate || resolvedDoc?.effectiveDate || resolvedDoc?.effective_date || resolvedDoc?.issueDate || resolvedDoc?.createdAt || stateRecord?.originalReviewAnchorDate || null,
    nextReviewDate: matchedSchedule?.nextReviewDate || resolvedDoc?.nextReviewDate || resolvedDoc?.next_review_date || stateRecord?.nextReviewDate || null,
    lastReviewedDate: matchedSchedule?.lastReviewedDate || resolvedDoc?.lastReviewDate || resolvedDoc?.last_reviewed_at || stateRecord?.lastReviewedDate || null,
    status: matchedSchedule?.status || resolvedDoc?.review_status || stateRecord?.status || 'SCHEDULED',
    review_status: matchedSchedule?.review_status || resolvedDoc?.review_status || matchedSchedule?.status || 'SCHEDULED',
    reviewCycleMonths: matchedSchedule?.reviewCycleMonths || resolvedDoc?.reviewCycleMonths || 12
  } : null;

  const schedulesForLookup = synthesizedSchedule
    ? [
        synthesizedSchedule,
        ...(periodicReviewSchedules || []).filter(s => s.id !== synthesizedSchedule.id)
      ]
    : (periodicReviewSchedules || []);

  const allDocs = [
    ...(documents || []),
    ...(externalDocuments || []),
    ...(resolvedDoc ? [resolvedDoc] : [])
  ];

  // Normalize string departmentMemberships (e.g., ['QC']) so PeriodicReviewAccessService recognizes active department membership
  const normalizedUser = currentUser ? {
    ...currentUser,
    departmentMemberships: Array.isArray(currentUser.departmentMemberships)
      ? currentUser.departmentMemberships.map(m =>
          typeof m === 'string'
            ? { departmentId: m, positionLevel: currentUser.level || currentUser.approval_level || 4, isActive: true }
            : m
        )
      : currentUser.departmentMemberships
  } : currentUser;

  const effectiveLookupId = synthesizedSchedule ? synthesizedSchedule.id : paramId;
  
  // Service-level detail security
  const accessCheck = getPeriodicReviewForUser(effectiveLookupId, normalizedUser, schedulesForLookup, allDocs, effectiveToday);
  
  const [outcome, setOutcome] = useState('');
  const [comment, setComment] = useState('');
  const [findings, setFindings] = useState('');
  const [standards, setStandards] = useState('');
  const [references, setReferences] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isReEvaluating, setIsReEvaluating] = useState(false);

  if (accessCheck.status === 'NOT_FOUND') {
    return <div className="p-8 text-center text-[#666666]">ไม่พบเอกสารนี้ (Not Found)</div>;
  }
  
  if (accessCheck.status === 'ACCESS_DENIED') {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-700 mb-2">ไม่มีสิทธิ์เข้าถึงข้อมูลการทบทวนเอกสารนี้</h2>
          <p className="text-red-600">{accessCheck.message}</p>
          <button 
            onClick={() => navigate('/dcc/periodic-reviews')}
            className="mt-6 px-4 py-2 bg-white text-red-700 font-medium rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
          >
            กลับสู่หน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  const schedule = synthesizedSchedule ? { ...synthesizedSchedule, ...accessCheck.data } : accessCheck.data;
  
  const linkedDar = schedule.linkedActionId ? (dars || []).find(d => d.id === schedule.linkedActionId) : null;
  const linkedDarStatus = linkedDar && useStore.getState()?.getLinkedActionStatus
    ? useStore.getState().getLinkedActionStatus(linkedDar.status)
    : null;
  
  const targetDoc = accessCheck.document || resolvedDoc || allDocs.find(d => 
    (schedule.documentId && d.id === schedule.documentId) || 
    (schedule.externalDocumentId && d.id === schedule.externalDocumentId) ||
    (schedule.documentNumber && (d.documentNumber === schedule.documentNumber || d.code === schedule.documentNumber || d.docCode === schedule.documentNumber))
  );

  const doc = targetDoc;
  const effectiveDocCode = schedule?.documentNumber || schedule?.docCode || doc?.docCode || doc?.code || doc?.documentNumber || doc?.edCode || docCode || reviewId || '';
  const isExternal = Boolean(
    schedule?.documentCategory === 'EXTERNAL' ||
    schedule?.isExternal ||
    schedule?.externalDocumentId ||
    doc?.is_external ||
    doc?.external ||
    doc?.isExternal ||
    doc?.doc_type === 'EXTERNAL' ||
    doc?.edCode ||
    String(effectiveDocCode).toUpperCase().startsWith('ED-') ||
    location.state?.isExternal
  );
  const isInternal = !isExternal;

  const docDept = schedule?.ownerDepartmentId || targetDoc?.department || targetDoc?.owner_dept || targetDoc?.dept || 'DC';
  const isFastTrack = canFastTrackReview(currentUser, docDept);

  const userPositionLevel = getPositionLevelForDepartment(normalizedUser, docDept) || Number(currentUser?.level || currentUser?.approval_level || 0);
  const isDeptManagerOrSupervisor = 
    userPositionLevel >= 4 ||
    ['HOD', 'MANAGER', 'DEPT_HEAD', 'SUPERVISOR', 'DEPT_SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'DCC'].includes(currentUser?.role) ||
    Boolean(currentUser?.is_hod || currentUser?.is_manager || currentUser?.isDeptHead || currentUser?.isDcc || currentUser?.is_dcc);

  const canPerform = canPerformPeriodicReview(normalizedUser, schedule, targetDoc) || isDeptManagerOrSupervisor;

  const effectiveOutcome = schedule.outcome || schedule.pendingReview?.outcome || doc?.pending_periodic_review?.outcome || schedule.reviewDetails?.outcome || '';

  const isPendingApproval = !isReEvaluating && Boolean(
    schedule.status === 'PENDING_APPROVAL' || 
    targetDoc?.review_status === 'PENDING_APPROVAL' ||
    schedule.pendingApprovalTaskId
  );

  const isEvaluated = !isReEvaluating && !isPendingApproval && Boolean(
    schedule.status === 'COMPLETED' || 
    schedule.status === 'IN_PROGRESS' || 
    schedule.status === 'ACTION_REQUIRED' || 
    schedule.status === 'COMPLETED_WITH_REVISION' ||
    schedule.status === 'COMPLETED_WITH_OBSOLETE' ||
    effectiveOutcome
  );

  const getComputedStatusLabel = () => {
    if (isPendingApproval) {
      return { label: '⏳ รออนุมัติผล', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    if (effectiveOutcome === 'REVISION_REQUIRED' || effectiveOutcome === 'REVISE') {
      return { label: 'ต้องแก้ไขเอกสาร', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    if (effectiveOutcome === 'OBSOLETE_REQUIRED' || effectiveOutcome === 'OBSOLETE') {
      return { label: 'ต้องยกเลิกเอกสาร', color: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    if (schedule.status === 'COMPLETED' || targetDoc?.review_status === 'COMPLETED' || targetDoc?.review_status === 'UP_TO_DATE') {
      return { label: 'ทบทวนเสร็จแล้ว', color: 'bg-green-100 text-green-800' };
    }
    return getReviewStatusLabel(schedule.status);
  };

  const statusLabel = getComputedStatusLabel();

  const rawInternalRev = String(schedule?.rev || doc?.revision || doc?.rev || '00').replace(/^(Rev\.?\s*)+/i, '').trim() || '00';
  const rawExternalEdition = String(doc?.sourceVersion || doc?.edition || schedule?.edition || schedule?.sourceVersion || schedule?.rev || doc?.revision || doc?.rev || '-').replace(/^(Edition\s*|Rev\.?\s*)+/i, '').trim() || '-';
  const displayVersion = isExternal
    ? (rawExternalEdition === '-' ? 'Edition -' : `Edition ${rawExternalEdition}`)
    : rawInternalRev;
  const displayIssuer = doc?.issuer || doc?.officialIssuer || doc?.source || doc?.issuing_agency || schedule?.issuer || '-';

  const handleOpenDocModal = () => {
    if (targetDoc) {
      setIsDocModalOpen(true);
    } else {
      toast.error('ไม่พบข้อมูลเอกสารต้นทาง');
    }
  };

  const handleStartReReview = () => {
    setIsReEvaluating(true);
    const existingOutcome = effectiveOutcome || 'NO_CHANGE';
    setOutcome(existingOutcome);
    setComment(schedule.comment || schedule.reason || schedule.pendingReview?.details?.comment || schedule.pendingReview?.details?.reason || '');
    setFindings(schedule.findings || schedule.pendingReview?.details?.findings || '');
    setStandards(schedule.standards || schedule.standard_clause || schedule.pendingReview?.details?.standards || '');
    setReferences(schedule.references || schedule.evidence_reference || schedule.pendingReview?.details?.references || '');
    setAdditionalComments(schedule.additionalComments || schedule.additional_comment || schedule.pendingReview?.details?.additional_comment || '');
  };

  const handleApproveReview = () => {
    const storeState = useStore.getState();
    const currentTasks = storeState.tasks || [];
    const approvalTask = currentTasks.find(t => 
      (t.type === 'PERIODIC_REVIEW_APPROVAL' || t.taskType === 'PERIODIC_REVIEW_APPROVAL') &&
      (
        t.id === taskId ||
        t.id === schedule.pendingApprovalTaskId ||
        t.id === doc?.pending_review_task_id ||
        t.scheduleId === schedule.id ||
        t.docId === (doc?.id || schedule.documentId || schedule.externalDocumentId) ||
        t.docCode === effectiveDocCode ||
        t.document_code === effectiveDocCode
      )
    );

    let targetTaskId = approvalTask?.id;
    if (!targetTaskId) {
      targetTaskId = `TASK-APPR-REV-${Date.now()}`;
      const syntheticTask = {
        id: targetTaskId,
        type: 'PERIODIC_REVIEW_APPROVAL',
        title: `อนุมัติผลการทบทวนเอกสาร: ${schedule.documentNumber || effectiveDocCode} (ไม่มีการเปลี่ยนแปลง)`,
        document_code: schedule.documentNumber || effectiveDocCode,
        document_title: schedule.documentName || doc?.title,
        docId: doc?.id || schedule.documentId || schedule.externalDocumentId,
        docCode: schedule.documentNumber || effectiveDocCode,
        revision: schedule.rev || '00',
        department: docDept,
        target_role: 'HOD',
        target_level: 5,
        status: 'PENDING',
        payload: schedule.pendingReview || doc?.pending_periodic_review || {
          doc_id: doc?.id || schedule.documentId || schedule.externalDocumentId,
          doc_code: effectiveDocCode,
          scheduleId: schedule.id,
          is_external: isExternal,
          reviewer_id: schedule.ownerUserId || currentUser?.id,
          reviewer_name: schedule.ownerUserId || currentUser?.name,
          reviewer_role: 'Staff',
          submitted_at: new Date().toISOString(),
          details: { comment: schedule.comment || 'ไม่มีการเปลี่ยนแปลง' }
        },
        scheduleId: schedule.id,
        created_at: new Date().toISOString()
      };
      useStore.setState({ tasks: [syntheticTask, ...currentTasks] });
    }

    useStore.getState().approvePeriodicReview({
      taskId: targetTaskId,
      approverUser: currentUser,
      remarks: 'อนุมัติผลการทบทวน'
    });

    toast.success('อนุมัติผลการทบทวนเรียบร้อยแล้ว (ขยายรอบ 1 ปี)');
  };

  const handleLinkedAction = (actionType, explicitDraftId) => {
    if (isExternal) {
      toast.success(
        actionType === 'REVISION'
          ? 'บันทึกผลการทบทวนแล้ว กำลังนำไปยังทะเบียนเอกสารภายนอกเพื่ออัปเดตเวอร์ชัน'
          : 'บันทึกผลการทบทวนแล้ว กำลังนำไปยังทะเบียนเอกสารภายนอกเพื่อยกเลิกเอกสาร'
      );
      const isRev = actionType === 'REVISION';
      navigate(`/dcc/external-docs?docCode=${encodeURIComponent(effectiveDocCode)}&${isRev ? 'autoOpenUpdate=true' : 'autoOpenObsolete=true'}`, {
        state: {
          openDocId: doc?.id || schedule.externalDocumentId,
          openDocCode: effectiveDocCode,
          fromPeriodicReview: true,
          reviewOutcome: actionType,
          autoOpenUpdate: isRev,
          autoOpenObsolete: !isRev
        }
      });
      return;
    }

    const draftId = explicitDraftId || schedule.linkedActionId;
    if (draftId) {
       toast.success(`กำลังเปิด DAR ที่เชื่อมโยง: ${draftId}`);
       const basePath = actionType === 'REVISION' ? '/dcc/dar/new/revision' : '/dcc/dar/new/obsolete';
       navigate(`${basePath}?draftId=${draftId}`);
       return;
    }
    
    toast.success(`กำลังพาไปสร้าง DAR...`);
    const route = actionType === 'REVISION' ? '/dcc/dar/new/revision' : '/dcc/dar/new/obsolete';
    navigate(route, { state: { prefillDocId: schedule.documentId || schedule.externalDocumentId, prefillReviewId: schedule.id } });
  };

  const handleSubmit = () => {
    if (!outcome) {
      toast.error('กรุณาเลือกผลการทบทวน');
      return;
    }
    if (comment.length < 5) {
      toast.error('กรุณาระบุเหตุผล/รายละเอียดการทบทวน');
      return;
    }

    // Ensure synthesized or department-resolved schedule exists in store before submitting
    if (typeof useStore.setState === 'function' && typeof useStore.getState === 'function') {
      const storeSchedules = useStore.getState().periodicReviewSchedules || [];
      const existingIdx = storeSchedules.findIndex(s => s.id === schedule.id);
      if (existingIdx === -1) {
        useStore.setState({
          periodicReviewSchedules: [...storeSchedules, schedule]
        });
      } else if (storeSchedules[existingIdx].ownerDepartmentId !== docDept) {
        const nextSchedules = [...storeSchedules];
        nextSchedules[existingIdx] = { ...nextSchedules[existingIdx], ownerDepartmentId: docDept };
        useStore.setState({ periodicReviewSchedules: nextSchedules });
      }
    }

    const standardizedReviewDetails = {
      outcome,
      reason: comment,
      comment,
      findings,
      standard_clause: standards,
      standards,
      evidence_reference: references,
      references,
      additional_comment: additionalComments,
      additionalComments
    };

    const postSubmitNavigation = (navOutcome, linkStatus, newDraftId) => {
      setIsReEvaluating(false);
      if (linkStatus === 'FAILED') {
        toast.error('การบันทึกสำเร็จ แต่การเชื่อมโยง DAR ล้มเหลว');
      } else {
        if (navOutcome === 'NO_CHANGE') {
          if (isFastTrack) {
            toast.success('อนุมัติผลการทบทวนเรียบร้อยแล้ว (Fast-Track ขยายรอบ 1 ปี)');
          } else {
            toast.success('ส่งผลการทบทวนไปยังหัวหน้าแผนก (HOD) เรียบร้อยแล้ว');
          }
        } else {
          toast.success('บันทึกผลการทบทวนเรียบร้อยแล้ว');
        }

        if (navOutcome === 'REVISION_REQUIRED') {
          handleLinkedAction('REVISION', newDraftId);
        } else if (navOutcome === 'OBSOLETE_REQUIRED') {
          handleLinkedAction('OBSOLETE', newDraftId);
        } else if (taskId) {
          toast.success('อัปเดตงานใน Task Inbox สำเร็จ');
          navigate('/tasks');
        } else {
          navigate('/dcc/periodic-reviews');
        }
      }
    };

    const idempotencyKey = !isExternal && outcome === 'REVISION_REQUIRED' 
      ? `PERIODIC_REVIEW_${schedule.id}_REVISION` 
      : (!isExternal && outcome === 'OBSOLETE_REQUIRED' ? `PERIODIC_REVIEW_${schedule.id}_OBSOLETE` : null);

    if (idempotencyKey) {
      if (schedule.linkedActionId && schedule.linkageStatus === 'SUCCESS') {
        // Already created, just re-submit core
        submitPeriodicReview({
          scheduleId: schedule.id,
          docId: doc?.id || schedule.documentId,
          docCode: effectiveDocCode,
          isExternal: false,
          documentCategory: 'INTERNAL',
          outcome,
          comment,
          linkedActionId: schedule.linkedActionId,
          linkageStatus: 'SUCCESS',
          idempotencyKey,
          taskId,
          reviewDetails: standardizedReviewDetails
        });
        postSubmitNavigation(outcome, 'SUCCESS', schedule.linkedActionId);
      } else {
        // Generate actual DAR
        const darPayload = {
          type: outcome === 'REVISION_REQUIRED' ? 'REVISION' : 'OBSOLETE',
          title: schedule.documentName || schedule.documentNumber,
          department: docDept,
          isDraft: true,
          status: 'DRAFT',
          refDocId: schedule.documentId || doc?.id
        };
        const darAdapter = (payload) => useStore.getState().createOrGetLinkedDarDraft(schedule.id, outcome, payload);
        
        useStore.getState().submitPeriodicReviewWithDarAction(
          schedule.id, 
          outcome, 
          comment, 
          darPayload, 
          darAdapter,
          { taskId, reviewDetails: standardizedReviewDetails }
        );
        
        // Check new status directly from store for accurate navigation
        const updatedSchedule = useStore.getState().periodicReviewSchedules.find(s => s.id === schedule.id);
        postSubmitNavigation(outcome, updatedSchedule?.linkageStatus, updatedSchedule?.linkedActionId);
      }
    } else {
      submitPeriodicReview({
        scheduleId: schedule.id,
        docId: doc?.id || schedule.externalDocumentId || schedule.documentId,
        docCode: effectiveDocCode,
        isExternal,
        documentCategory: isExternal ? 'EXTERNAL' : 'INTERNAL',
        outcome,
        comment,
        taskId,
        reviewDetails: standardizedReviewDetails
      });
      postSubmitNavigation(outcome, null, null);
    }
  };

  const handleRetryDarLinkage = () => {
    const darPayload = {
      type: schedule.outcome === 'REVISION_REQUIRED' ? 'REVISION' : 'OBSOLETE',
      title: schedule.documentName || schedule.documentNumber,
      department: docDept,
      isDraft: true,
      status: 'DRAFT',
      refDocId: schedule.documentId || schedule.externalDocumentId
    };
    
    const darAdapter = (payload) => useStore.getState().createOrGetLinkedDarDraft(schedule.id, schedule.outcome, payload);
    
    useStore.getState().retryPeriodicReviewLinkageWithDarAction(schedule.id, darPayload, darAdapter);
    
    const updatedSchedule = useStore.getState().periodicReviewSchedules.find(s => s.id === schedule.id);
    if (updatedSchedule?.linkageStatus === 'SUCCESS') {
      toast.success('สร้างคำขอสำเร็จ');
      if (schedule.outcome === 'REVISION_REQUIRED') {
        navigate(`/dcc/dar/new/revision?draftId=${updatedSchedule.linkedActionId}`);
      } else {
        navigate(`/dcc/dar/new/obsolete?draftId=${updatedSchedule.linkedActionId}`);
      }
    } else {
      toast.error('การสร้าง DAR ล้มเหลว กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Top Navigation */}
      <div className="mb-4">
        <button 
          type="button"
          onClick={() => {
            if (taskId) {
              navigate('/tasks');
            } else {
              navigate('/dcc/periodic-reviews');
            }
          }}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium text-sm"
        >
          <ArrowLeft size={16} /> {taskId ? 'กลับสู่กล่องงาน (Task Inbox)' : 'กลับสู่ภาพรวมการทบทวน'}
        </button>
      </div>

      {/* Main Two-Column Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Document Context Card: 5 cols / ~40%) */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm sticky top-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`p-2.5 rounded-xl shrink-0 ${isInternal ? 'bg-sky-50 text-sky-600 border border-sky-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-snug truncate">
                      {effectiveDocCode || schedule.documentNumber}
                    </h1>
                    {isExternal && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        เอกสารภายนอก
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-0.5 line-clamp-2" title={schedule.documentName || doc?.title || doc?.name}>
                    {schedule.documentName || doc?.title || doc?.name}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusLabel.color}`}>
                  {statusLabel.label}
                </span>
                {schedule.dueState === 'OVERDUE' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 animate-pulse border border-rose-200">
                    เลยกำหนด
                  </span>
                )}
              </div>
            </div>

            {/* Metadata Table / Key-Value Rows */}
            <div className="mt-4 pt-3 border-t border-slate-100 divide-y divide-slate-100 text-xs">
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">{isExternal ? 'รุ่นเอกสาร (Edition)' : 'ฉบับที่ (Revision)'}</span>
                <span className="font-semibold text-slate-800 font-mono">{displayVersion}</span>
              </div>
              {isExternal && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500 font-medium">หน่วยงานผู้ออกเอกสาร</span>
                  <span className="font-semibold text-slate-800 text-right">{displayIssuer}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">แผนกเจ้าของ</span>
                <span className="font-semibold text-slate-800">{docDept || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">ผู้รับผิดชอบ / เจ้าของ</span>
                <span className="font-semibold text-slate-800">{schedule.ownerUserId || targetDoc?.owner || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">วันที่มีผลบังคับใช้</span>
                <span className="font-semibold text-slate-800">{formatQmsDisplayDate(schedule.originalReviewAnchorDate || targetDoc?.effectiveDate)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 px-3 bg-sky-50/70 rounded-lg mt-2 border border-sky-100/80">
                <span className="text-xs text-sky-900 font-medium">วันที่ครบกำหนดรอบนี้</span>
                <span className="font-bold text-sm text-sky-700 font-mono">
                  {formatQmsDisplayDate(schedule.nextReviewDate)}
                </span>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleOpenDocModal}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200/80 transition-colors"
              >
                <Eye size={14} className="text-slate-500" />
                <span>เปิดดูไฟล์เอกสาร</span>
              </button>
              <button
                type="button"
                onClick={handleOpenDocModal}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200/80 transition-colors"
              >
                <History size={14} className="text-slate-500" />
                <span>ดูประวัติย้อนหลัง</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (Review Action Form / Completed Status: 7 cols / ~60%) */}
        <div className="lg:col-span-7">
          {isPendingApproval ? (
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
                <Clock className="w-14 h-14 text-amber-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-amber-800 mb-1">อยู่ระหว่างรอหัวหน้าแผนกพิจารณาอนุมัติ</h2>
                <p className="text-amber-700 mb-1 text-sm">
                  ผลการทบทวน: <span className="font-semibold">ไม่มีการเปลี่ยนแปลง (ส่งขออนุมัติแล้ว)</span>
                </p>
                {(schedule.comment || schedule.pendingReview?.details?.comment) && (
                  <p className="text-xs text-amber-800/80 mt-2 bg-amber-100/60 rounded-lg p-2.5 max-w-lg mx-auto text-left">
                    <strong>เหตุผล:</strong> {schedule.comment || schedule.pendingReview?.details?.comment}
                  </p>
                )}

                {/* Supervisor/Manager Section vs Reviewer Notice */}
                {isDeptManagerOrSupervisor ? (
                  <div className="mt-6 p-4 bg-white/95 border border-amber-300 rounded-xl text-left shadow-2xs max-w-lg mx-auto">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-slate-900">การอนุมัติสำหรับหัวหน้างาน / ผู้จัดการ (L4+)</h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          คุณมีสิทธิ์พิจารณาอนุมัติผลการทบทวนเอกสารนี้เพื่อขยายรอบการทบทวน 1 ปี
                        </p>
                        <div className="mt-3 flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={handleApproveReview}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors shadow-2xs cursor-pointer"
                          >
                            <CheckCircle size={14} />
                            <span>✅ อนุมัติผลการทบทวน</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 p-3.5 bg-amber-100/70 border border-amber-200 rounded-xl max-w-lg mx-auto text-xs text-amber-900 flex items-center justify-center gap-2">
                    <Clock size={16} className="text-amber-600 shrink-0" />
                    <span>⏳ อยู่ระหว่างรอหัวหน้าแผนก/ผู้จัดการอนุมัติผลการทบทวน</span>
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-amber-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => navigate(taskId ? '/tasks' : '/dcc/periodic-reviews')}
                    className="px-3.5 py-1.5 text-xs text-amber-800 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors"
                  >
                    {taskId ? 'กลับสู่กล่องงาน' : 'กลับสู่ภาพรวมการทบทวน'}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartReReview}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-sky-700 bg-white hover:bg-slate-50 border border-amber-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    <RotateCw size={13} className="text-slate-500" />
                    <span>🔄 เริ่มการทบทวนใหม่ / แก้ไขผลประเมิน</span>
                  </button>
                </div>
              </div>
            </div>
          ) : isEvaluated ? (
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
              <div className={`rounded-xl p-8 text-center ${
                effectiveOutcome === 'OBSOLETE_REQUIRED' || effectiveOutcome === 'OBSOLETE'
                  ? 'bg-rose-50/70 border border-rose-200'
                  : effectiveOutcome === 'REVISION_REQUIRED' || effectiveOutcome === 'REVISE'
                    ? 'bg-amber-50/70 border border-amber-200'
                    : 'bg-emerald-50 border border-emerald-200'
              }`}>
                {effectiveOutcome === 'OBSOLETE_REQUIRED' || effectiveOutcome === 'OBSOLETE' ? (
                  <Ban className="w-14 h-14 text-rose-500 mx-auto mb-3" />
                ) : effectiveOutcome === 'REVISION_REQUIRED' || effectiveOutcome === 'REVISE' ? (
                  <FileEdit className="w-14 h-14 text-amber-500 mx-auto mb-3" />
                ) : (
                  <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                )}
                
                <h2 className={`text-xl font-bold mb-1 ${
                  effectiveOutcome === 'OBSOLETE_REQUIRED' || effectiveOutcome === 'OBSOLETE'
                    ? 'text-rose-900'
                    : effectiveOutcome === 'REVISION_REQUIRED' || effectiveOutcome === 'REVISE'
                      ? 'text-amber-900'
                      : 'text-emerald-800'
                }`}>
                  {effectiveOutcome === 'REVISION_REQUIRED' || effectiveOutcome === 'REVISE'
                    ? 'บันทึกผลการทบทวนแล้ว: ต้องแก้ไขเอกสาร'
                    : effectiveOutcome === 'OBSOLETE_REQUIRED' || effectiveOutcome === 'OBSOLETE'
                      ? 'บันทึกผลการทบทวนแล้ว: ต้องยกเลิกเอกสาร'
                      : 'การทบทวนเสร็จแล้ว'}
                </h2>
                <p className={`mb-1 text-sm ${
                  effectiveOutcome === 'OBSOLETE_REQUIRED' || effectiveOutcome === 'OBSOLETE'
                    ? 'text-rose-700'
                    : effectiveOutcome === 'REVISION_REQUIRED' || effectiveOutcome === 'REVISE'
                      ? 'text-amber-700'
                      : 'text-emerald-600'
                }`}>
                  ผลการทบทวน: <span className="font-semibold">{getReviewOutcomeLabel(effectiveOutcome).label}</span>
                </p>

                {(schedule.comment || schedule.reason) && (
                  <p className="text-xs text-slate-600 mt-2 bg-white/80 rounded-lg p-2.5 max-w-lg mx-auto text-left border border-slate-200/60">
                    <strong>เหตุผล:</strong> {schedule.comment || schedule.reason}
                  </p>
                )}

                {/* External Document Action Box: REVISION_REQUIRED / REVISE */}
                {isExternal && (effectiveOutcome === 'REVISION_REQUIRED' || effectiveOutcome === 'REVISE') && (
                  <div className="mt-5 p-5 bg-gradient-to-br from-amber-50 to-orange-50/60 border-2 border-amber-300/80 rounded-xl text-left shadow-xs">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                        <FileEdit className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-amber-900 leading-snug">
                          ขั้นตอนถัดไป: จัดทำเอกสารภายนอกฉบับใหม่ (Edition Update Required)
                        </h3>
                        <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
                          ผลการทบทวนระบุว่าเอกสารนี้จำเป็นต้องออก Edition ใหม่เพื่อความทันสมัย
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/dcc/external-docs?docCode=${encodeURIComponent(effectiveDocCode)}&autoOpenUpdate=true`, {
                                state: {
                                  openDocCode: effectiveDocCode,
                                  openDocId: doc?.id,
                                  autoOpenUpdate: true
                                }
                              });
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                          >
                            <span>📝 ดำเนินการอัปเดตฉบับใหม่ (Update Edition)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* External Document Action Box: OBSOLETE_REQUIRED / OBSOLETE */}
                {isExternal && (effectiveOutcome === 'OBSOLETE_REQUIRED' || effectiveOutcome === 'OBSOLETE') && (
                  <div className="mt-5 p-5 bg-gradient-to-br from-rose-50 to-red-50/60 border-2 border-rose-300/80 rounded-xl text-left shadow-xs">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0 mt-0.5">
                        <Ban className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-rose-900 leading-snug">
                          ขั้นตอนถัดไป: ขอยกเลิกเอกสารภายนอก (Obsolete Required)
                        </h3>
                        <p className="text-xs text-rose-800 mt-1.5 leading-relaxed">
                          ผลการทบทวนระบุว่าเอกสารนี้ไม่มีความจำเป็นต้องใช้งานต่อไป ควรดำเนินการขอยกเลิกเอกสาร
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/dcc/external-docs?docCode=${encodeURIComponent(effectiveDocCode)}&autoOpenObsolete=true`, {
                                state: {
                                  openDocCode: effectiveDocCode,
                                  openDocId: doc?.id,
                                  autoOpenObsolete: true
                                }
                              });
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                          >
                            <span>🚫 ดำเนินการยกเลิกเอกสารภายนอก (Obsolete)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Internal Document DAR Action Box */}
                {!isExternal && (
                  <>
                    {linkedDarStatus && (
                      <p className="text-emerald-600 font-medium text-xs mt-2">สถานะคำขอที่เชื่อมโยง: {linkedDarStatus}</p>
                    )}
                    {schedule.linkageStatus === 'FAILED' ? (
                      <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl text-left">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="text-red-600 mt-0.5 shrink-0" size={18} />
                          <div>
                            <h3 className="text-red-800 font-bold text-sm mb-0.5">การบันทึกสำเร็จ แต่การสร้าง DAR ล้มเหลว</h3>
                            <p className="text-red-600 text-xs mb-3">กรุณาลองสร้างคำขออีกครั้ง</p>
                            <button 
                              type="button"
                              onClick={handleRetryDarLinkage}
                              className="px-3.5 py-1.5 bg-red-600 text-white font-medium text-xs rounded-lg hover:bg-red-700 transition-colors shadow-2xs"
                            >
                              ลองสร้างคำขออีกครั้ง
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : schedule.linkedActionId ? (
                      <button 
                        type="button"
                        onClick={() => navigate(`/dar/draft/${schedule.linkedActionId}`)}
                        className="mt-5 px-4 py-2 bg-emerald-600 text-white font-medium text-xs rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs"
                      >
                        ดู DAR ที่เชื่อมโยง
                      </button>
                    ) : null}
                  </>
                )}

                {/* Footer Controls: Back and Re-review / Edit Evaluation */}
                <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => navigate(taskId ? '/tasks' : '/dcc/periodic-reviews')}
                    className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    {taskId ? 'กลับสู่กล่องงาน' : 'กลับสู่ภาพรวมการทบทวน'}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartReReview}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-sky-700 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    <RotateCw size={13} className="text-slate-500" />
                    <span>🔄 เริ่มการทบทวนใหม่ / แก้ไขผลประเมิน</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
              {isReEvaluating && (
                <div className="flex items-center justify-between p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <RotateCw className="w-4 h-4 text-amber-600" />
                    <span className="font-medium">โหมดแก้ไขผลการทบทวน: คุณสามารถเปลี่ยนผลการประเมินหรือปรับปรุงรายละเอียดได้</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReEvaluating(false)}
                    className="text-amber-700 hover:text-amber-900 font-semibold underline text-xs cursor-pointer"
                  >
                    ยกเลิกการแก้ไข
                  </button>
                </div>
              )}
              <div className="border-b border-slate-100 pb-3 mb-5">
                <h2 className="text-base font-bold text-slate-900">
                  แบบฟอร์มบันทึกผลการทบทวน
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ระบุผลการพิจารณาความสอดคล้องของเอกสารและรายละเอียดประกอบ
                </p>
              </div>

              {/* หมวดที่ 1: ผลและเหตุผลหลัก */}
              <div className="space-y-4 mb-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      ผลการทบทวน <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-normal">เลือก 1 ข้อ</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { 
                        id: 'NO_CHANGE', 
                        label: 'ไม่มีการเปลี่ยนแปลง',
                        icon: CheckCircle,
                        activeStyle: 'border-2 border-emerald-500 bg-emerald-50/40 text-emerald-800 font-semibold shadow-xs',
                        inactiveStyle: 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-slate-700',
                        activeIcon: 'text-emerald-600',
                        inactiveIcon: 'text-emerald-500'
                      },
                      { 
                        id: 'REVISION_REQUIRED', 
                        label: 'ต้องแก้ไขเอกสาร',
                        icon: FileEdit,
                        activeStyle: 'border-2 border-amber-500 bg-amber-50/40 text-amber-800 font-semibold shadow-xs',
                        inactiveStyle: 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 text-slate-700',
                        activeIcon: 'text-amber-600',
                        inactiveIcon: 'text-amber-500'
                      },
                      { 
                        id: 'OBSOLETE_REQUIRED', 
                        label: 'ต้องยกเลิกเอกสาร',
                        icon: Ban,
                        activeStyle: 'border-2 border-rose-500 bg-rose-50/40 text-rose-800 font-semibold shadow-xs',
                        inactiveStyle: 'border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 text-slate-700',
                        activeIcon: 'text-rose-600',
                        inactiveIcon: 'text-rose-500'
                      }
                    ].map(opt => {
                      const IconComponent = opt.icon;
                      const isSelected = outcome === opt.id;
                      return (
                        <label 
                          key={opt.id} 
                          className={`flex flex-col items-center justify-center p-3 min-h-[72px] border rounded-xl cursor-pointer transition-all ${
                            isSelected ? opt.activeStyle : opt.inactiveStyle
                          } ${!canPerform ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <input 
                            type="radio" 
                            name="outcome" 
                            value={opt.id} 
                            checked={isSelected}
                            className="sr-only"
                            onChange={(e) => setOutcome(e.target.value)}
                            disabled={!canPerform}
                          />
                          <IconComponent className={`w-5 h-5 mb-1.5 ${isSelected ? opt.activeIcon : opt.inactiveIcon}`} />
                          <span className="text-xs font-medium leading-tight text-center">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Reason / Comment Textarea */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    เหตุผล / รายละเอียดการทบทวน <span className="text-rose-500">*</span>
                  </label>
                  <textarea 
                    rows={2} 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="ระบุเหตุผลที่เลือกผลลัพธ์ดังกล่าว..."
                    disabled={!canPerform}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-400 resize-none"
                  />
                </div>
              </div>

              {/* หมวดที่ 2: หลักฐานและรายละเอียดประกอบ (Audit Details Card) */}
              <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-100 space-y-3 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">หลักฐานและรายละเอียดประกอบ</span>
                  <span className="text-[11px] text-slate-400 font-normal">ไม่บังคับ (Optional)</span>
                </div>
                
                {/* แถวที่ 1: ประเด็นที่พบ & มาตรฐานหรือข้อกำหนด */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ประเด็นที่พบ</label>
                    <textarea 
                      rows={2} 
                      value={findings}
                      onChange={(e) => setFindings(e.target.value)}
                      placeholder="ประเด็นหรือข้อสังเกตที่พบ..."
                      disabled={!canPerform}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-400 resize-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">มาตรฐานหรือข้อกำหนดที่ใช้พิจารณา</label>
                    <textarea 
                      rows={2} 
                      value={standards}
                      onChange={(e) => setStandards(e.target.value)}
                      placeholder="เช่น ISO 9001, มอก., หรือระเบียบปฏิบัติ..."
                      disabled={!canPerform}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-400 resize-none bg-white"
                    />
                  </div>
                </div>

                {/* แถวที่ 2: ข้อมูลหรือหลักฐานอ้างอิง & ความคิดเห็นเพิ่มเติม */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ข้อมูลหรือหลักฐานอ้างอิง</label>
                    <input 
                      type="text" 
                      value={references}
                      onChange={(e) => setReferences(e.target.value)}
                      placeholder="เช่น รายงาน Internal Audit, CAR..."
                      disabled={!canPerform}
                      className="w-full h-9 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs outline-none transition-all placeholder:text-slate-400 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ความคิดเห็นเพิ่มเติม</label>
                    <input 
                      type="text" 
                      value={additionalComments}
                      onChange={(e) => setAdditionalComments(e.target.value)}
                      placeholder="ข้อเสนอแนะเพิ่มเติม..."
                      disabled={!canPerform}
                      className="w-full h-9 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs outline-none transition-all placeholder:text-slate-400 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Action Footer */}
              {canPerform ? (
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-4">
                  {/* กล่องแจ้งเตือนสายการอนุมัติ: แสดงเต็มแถบพร้อมไอคอนเรียบร้อย */}
                  {!isFastTrack ? (
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-sky-50/80 border border-sky-100 rounded-lg text-xs text-sky-800">
                      <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>
                        <strong>สายการอนุมัติ 1 ระดับ:</strong> ผลการทบทวนนี้จะถูกส่งไปยังหัวหน้าแผนก <strong>({docDept} - HOD)</strong> เพื่อพิจารณาอนุมัติก่อนขยายรอบ
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-50/80 border border-amber-100 rounded-lg text-xs text-amber-800">
                      <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>สิทธิ์ Fast-Track (HOD/DCC):</strong> ผลการทบทวนจะได้รับการอนุมัติและขยายรอบ 1 ปีทันที
                      </span>
                    </div>
                  )}

                  {/* ปุ่มกดยกเลิกและยืนยัน จัดชิดขวา Balance สวยงาม */}
                  <div className="flex items-center justify-end gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        if (isReEvaluating) {
                          setIsReEvaluating(false);
                          return;
                        }
                        if (taskId) {
                          navigate('/tasks');
                        } else {
                          navigate('/dcc/periodic-reviews');
                        }
                      }}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      type="button"
                      onClick={handleSubmit}
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2 h-10 text-sm font-medium text-white rounded-lg shadow-sm transition-all ${
                        outcome === 'NO_CHANGE' && isFastTrack
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-sky-600 hover:bg-sky-700'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {outcome === 'NO_CHANGE'
                          ? (isFastTrack ? 'อนุมัติผลทบทวนทันที' : 'ส่งผลการทบทวนให้หัวหน้าแผนก')
                          : 'บันทึกผลการทบทวน'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200/80 flex items-start gap-2.5 text-xs">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-bold">คุณไม่มีสิทธิ์ดำเนินการทบทวนเอกสารนี้</p>
                    <p className="mt-0.5 text-amber-700">สิทธิ์ในการบันทึกถูกจำกัดเฉพาะเจ้าของเอกสารหรือผู้บังคับบัญชาในแผนก {schedule.ownerDepartmentId || '-'} เท่านั้น</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Internal Document Detail Modal */}
      {isDocModalOpen && targetDoc && !isExternal && (
        <DocumentDetailModal
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
          document={targetDoc}
        />
      )}

      {/* External Document Detail Modal */}
      {isDocModalOpen && targetDoc && isExternal && (
        <ExternalDocDetailModal
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
          document={targetDoc}
        />
      )}
    </div>
  );
};

export default PeriodicReviewDetail;
