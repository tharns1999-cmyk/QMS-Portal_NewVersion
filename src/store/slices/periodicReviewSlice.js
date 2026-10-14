/**
 * Periodic Review Zustand Slice
 * Extracted from useStore.js (Phase 2 Refactor)
 */
import toast from 'react-hot-toast';
import { 
  generateSchedules, 
  generateTasksForSchedules, 
  getDueState 
} from '../../services/PeriodicReviewService';
import { 
  addYears, 
  getReviewCycleYears, 
  getReviewStatusFlag 
} from '../../utils/documentUtils';
import { 
  createOrGetLinkedDarDraft, 
  validateLinkedDarSource, 
  resolveLockedSourceDocument, 
  getLinkedActionStatus 
} from '../../services/PeriodicReviewDarLinkService';
import { 
  isSameDepartment, 
  userMatchesDepartment, 
  isDccAdmin, 
  getUserLevelNumber 
} from '../../utils/taskFilter';

// Extracted Domain Helper Functions
export const canFastTrackReview = (currentUser, docDepartment) => {
  if (!currentUser) return false;

  // 1. ระดับสากล: DCC หรือ System Admin ทำ Fast-Track ได้เสมอ
  const isDccOrAdmin = ['DCC', 'ADMIN', 'DC', 'SUPER_ADMIN'].includes(currentUser.role) || currentUser.is_dcc || currentUser.isDcc;
  if (isDccOrAdmin) return true;

  // 2. ตรวจสอบระดับ Level: ต้องเป็น L5 ขึ้นไปเท่านั้น (ตัด L4 Supervisor ออกเด็ดขาด)
  const userLevel = Number(
    currentUser.level || 
    currentUser.approval_level || 
    currentUser.departmentMemberships?.find(m => (m.departmentId === docDepartment || m.department === docDepartment) && m.isActive)?.positionLevel ||
    currentUser.departmentMemberships?.[0]?.positionLevel ||
    (currentUser.role_level ? String(currentUser.role_level).replace(/\D/g, '') : 0)
  );

  // ตัด L1 ถึง L4 (Staff, Officer, Supervisor) ออกจาก Fast-Track เด็ดขาด
  const isSupervisorOrStaff = ['SUPERVISOR', 'DEPT_SUPERVISOR', 'STAFF', 'OFFICER'].includes(currentUser.role) || 
                              String(currentUser.position || '').toLowerCase().includes('supervisor') ||
                              String(currentUser.position || '').toLowerCase().includes('staff') ||
                              String(currentUser.position || '').toLowerCase().includes('officer');
  if (isSupervisorOrStaff && userLevel < 5) {
    return false;
  }

  const isHodOrManager = userLevel >= 5 || 
                         currentUser.role === 'HOD' || 
                         currentUser.role === 'MANAGER' || 
                         currentUser.is_hod === true ||
                         currentUser.isDeptHead === true ||
                         currentUser.is_manager === true;

  // 3. ตรวจสอบขอบเขตแผนก: ต้องเป็น HOD/Manager ของแผนกเอกสารนั้น หรือดูแลข้ามแผนก ('*')
  const hasDeptScope = currentUser.managedDepartments?.includes('*') || 
                       currentUser.managedDepartments?.includes(docDepartment) ||
                       userMatchesDepartment(currentUser, docDepartment) ||
                       (isHodOrManager && (currentUser.department === docDepartment || currentUser.primary_department === docDepartment));

  // ต้องเป็น L5+ และมีสิทธิ์ในแผนกนั้นเท่านั้น ถึงจะได้ Fast-Track
  return Boolean(isHodOrManager && hasDeptScope);
};

export const canFastTrackExternalReview = (currentUser, docDepartment) => {
  if (!currentUser) return false;

  // 1. ระดับสากล: DCC, DCC_ADMIN, QMR, ADMIN, SUPER_ADMIN ทำ Fast-Track ได้เสมอ
  const isGlobalApprover = 
    ['DCC', 'ADMIN', 'DC', 'SUPER_ADMIN', 'DCC_ADMIN', 'QMR', 'EXECUTIVE', 'MANAGING_DIRECTOR', 'BOARD'].includes(currentUser.role) ||
    Boolean(currentUser.is_dcc || currentUser.isDcc || currentUser.is_dcc_admin || currentUser.isDccAdmin || currentUser.is_qmr || currentUser.isQmr || currentUser.is_admin || currentUser.isAdmin || currentUser.isExecutive);
  if (isGlobalApprover) return true;

  // 2. ตรวจสอบระดับ Level: ต้องเป็น Level 4+ ขึ้นไป (Supervisor, Dept Manager, HOD)
  const userLevel = Number(
    currentUser.level || 
    currentUser.approval_level || 
    currentUser.approvalLevel ||
    currentUser.departmentMemberships?.find(m => (m.departmentId === docDepartment || m.department === docDepartment) && m.isActive)?.positionLevel ||
    currentUser.departmentMemberships?.[0]?.positionLevel ||
    getUserLevelNumber(currentUser)
  );

  const isLevel4Plus = userLevel >= 4 ||
    ['HOD', 'MANAGER', 'DEPT_MANAGER', 'SUPERVISOR', 'DEPT_SUPERVISOR'].includes(currentUser.role) ||
    Boolean(currentUser.is_hod || currentUser.isDeptHead || currentUser.is_manager || currentUser.is_supervisor);

  if (!isLevel4Plus) return false;

  // 3. ตรวจสอบขอบเขตแผนก: ต้องเป็น Level 4+ ในแผนกของเอกสารนั้น หรือมีสิทธิ์ข้ามแผนก ('*')
  if (!docDepartment) return true;
  const hasDeptScope = currentUser.managedDepartments?.includes('*') || 
                       currentUser.managedDepartments?.includes(docDepartment) ||
                       userMatchesDepartment(currentUser, docDepartment) ||
                       isSameDepartment(currentUser.department, docDepartment) ||
                       isSameDepartment(currentUser.dept, docDepartment) ||
                       isSameDepartment(currentUser.primary_department, docDepartment) ||
                       currentUser.depts?.some(d => isSameDepartment(d, docDepartment)) ||
                       currentUser.departments?.some(d => isSameDepartment(d, docDepartment));

  return Boolean(hasDeptScope);
};

export const sanitizeExternalDocReviewStatus = (doc, refDate = new Date()) => {
  if (!doc) return doc;
  const nextDateStr = doc.nextReviewDate || doc.next_review_date;
  if (!nextDateStr) return doc;
  const target = new Date(nextDateStr);
  if (isNaN(target.getTime())) return doc;
  const today = new Date(refDate);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  // If future date (diffDays > 30) and no completed review in current cycle, ensure review_status is 'UP_TO_DATE'
  if (diffDays > 30 && !doc.is_reviewed_this_cycle && doc.review_status !== 'COMPLETED' && doc.review_status !== 'PENDING_APPROVAL' && doc.review_status !== 'AWAITING_ACTION') {
    if (doc.review_status === 'DUE_SOON' || doc.review_status === 'OVERDUE' || !doc.review_status) {
      return { ...doc, review_status: 'UP_TO_DATE' };
    }
  }
  return doc;
};

export const createPeriodicReviewSlice = (set, get) => ({
  // State
  periodicReviews: [],
  periodicReviewSchedules: [],
  periodicReviewTasks: [],
  periodicReviewRecords: [],

  // Periodic Review Lifecycle Actions
  // Helper ซิงค์สถานะรอบทบทวนและสร้าง/อัปเดตงานใน Task Inbox ตามเวลาจำลอง
  syncPeriodicReviewSchedulesAndTasks: (targetDate = null) => {
    try {
      const state = get();
      const effectiveToday = targetDate || state.getEffectiveToday();

      let schedules = state.periodicReviewSchedules && state.periodicReviewSchedules.length > 0
        ? [...state.periodicReviewSchedules]
        : generateSchedules(state.documents || [], state.externalDocuments || [], []);

      schedules = schedules.map(s => {
        const dueDate = s.nextReviewDate || s.currentScheduledReviewDate;
        if (!dueDate) return s;
        const dueState = getDueState(dueDate, effectiveToday);
        const statusFlag = getReviewStatusFlag(dueDate, effectiveToday);
        return {
          ...s,
          dueState,
          reviewStatusFlag: statusFlag,
          statusFlag: statusFlag
        };
      });

      const newTasks = generateTasksForSchedules(schedules, state.tasks || [], effectiveToday);

      set({
        periodicReviewSchedules: schedules,
        tasks: newTasks
      });
    } catch {
      // Safe fallback
    }
  },

  initializePeriodicReviews: () => set(state => {
    if (state.periodicReviewSchedules && state.periodicReviewSchedules.length > 0) {
      // Ensure tasks in state.tasks are synchronized
      const existingTaskIds = new Set((state.tasks || []).map(t => t.id || t.scheduleId));
      const missingTasks = (state.periodicReviewTasks || []).filter(t => !existingTaskIds.has(t.id));
      if (missingTasks.length > 0) {
        return { tasks: [...missingTasks, ...(state.tasks || [])] };
      }
      return state;
    }
    const schedules = generateSchedules(state.documents || [], state.externalDocuments || [], []);
    const tasks = generateTasksForSchedules(schedules, []);
    
    // Deduplicate against state.tasks
    const existingTaskIds = new Set((state.tasks || []).map(t => t.id || t.scheduleId));
    const newTasksToAdd = tasks.filter(t => !existingTaskIds.has(t.id));

    return { 
      periodicReviewSchedules: schedules, 
      periodicReviewTasks: tasks,
      tasks: [...newTasksToAdd, ...(state.tasks || [])]
    };
  }),

  submitPeriodicReview: (...args) => {
    let result = null;
    set(state => {
      let scheduleId, outcome, comment, linkedActionId, linkageStatus, idempotencyKey;
      let reviewDetails = {}, currentUserParam = null, isExternalParam = false, docIdParam = null, docCodeParam = null, taskIdParam = null;

      if (typeof args[0] === 'object' && args[0] !== null) {
        const p = args[0];
        scheduleId = p.scheduleId;
        docIdParam = p.docId;
        docCodeParam = p.docCode;
        isExternalParam = Boolean(p.isExternal);
        outcome = p.outcome || p.result;
        reviewDetails = p.reviewDetails || p.details || { comment: p.comment || '' };
        comment = p.comment || reviewDetails?.reason || reviewDetails?.comment || reviewDetails?.remarks || '';
        currentUserParam = p.currentUser;
        linkedActionId = p.linkedActionId;
        linkageStatus = p.linkageStatus;
        idempotencyKey = p.idempotencyKey;
        taskIdParam = p.taskId;
      } else {
        [scheduleId, outcome, comment, linkedActionId, linkageStatus, idempotencyKey] = args;
        reviewDetails = { comment };
      }

      const isActiveDocRecord = (d) => d && !d.is_superseded && !d.is_obsolete && !d.isSuperseded && !d.isObsolete && d.status !== 'SUPERSEDED' && d.status !== 'OBSOLETE';
      const findActiveDocIdx = (list, { docId, docCode, schedId }) => {
        if (!Array.isArray(list) || list.length === 0) return -1;
        const cleanSchedId = schedId ? String(schedId).replace(/^PRS-(AUTO|GEN|EXT|INT)-/, '') : null;
        const matches = (d) => (
          (docId && String(d.id) === String(docId)) ||
          (cleanSchedId && String(d.id) === String(cleanSchedId)) ||
          (docCode && (
            d.edCode === docCode ||
            d.doc_code === docCode ||
            d.code === docCode ||
            d.document_number === docCode ||
            d.docNo === docCode ||
            d.title === docCode ||
            d.id === docCode
          )) ||
          (cleanSchedId && (
            d.edCode === cleanSchedId ||
            d.doc_code === cleanSchedId ||
            d.code === cleanSchedId ||
            d.document_number === cleanSchedId ||
            d.docNo === cleanSchedId ||
            d.title === cleanSchedId
          ))
        );
        if (docId) {
          const activeById = list.findIndex(d => isActiveDocRecord(d) && String(d.id) === String(docId));
          if (activeById !== -1) return activeById;
        }
        const activeMatch = list.findIndex(d => isActiveDocRecord(d) && matches(d));
        if (activeMatch !== -1) return activeMatch;
        if (docId) {
          const anyById = list.findIndex(d => String(d.id) === String(docId));
          if (anyById !== -1) return anyById;
        }
        return list.findIndex(matches);
      };

      const activeUser = currentUserParam || state.currentUser;
      const schedules = [...(state.periodicReviewSchedules || [])];
      const tasks = [...(state.periodicReviewTasks || [])];
      const records = [...(state.periodicReviewRecords || [])];
      const now = (state.simulatedSystemDate ? new Date(state.simulatedSystemDate) : new Date()).toISOString().split('T')[0];

      const autoDocId = scheduleId ? String(scheduleId).replace(/^PRS-AUTO-/, '') : null;
      let scheduleIndex = scheduleId ? schedules.findIndex(s => s.id === scheduleId) : -1;
      if (scheduleIndex === -1 && (docIdParam || docCodeParam || autoDocId)) {
        scheduleIndex = schedules.findIndex(s =>
          s.isActive !== false && (
            (docIdParam && (s.documentId === docIdParam || s.externalDocumentId === docIdParam)) ||
            (autoDocId && (s.documentId === autoDocId || s.externalDocumentId === autoDocId || s.documentNumber === autoDocId)) ||
            (docCodeParam && s.documentNumber === docCodeParam) ||
            (scheduleId && s.documentNumber === scheduleId)
          )
        );
      }

      if (scheduleIndex === -1) {
        const extIdx = findActiveDocIdx(state.externalDocuments, { docId: docIdParam, docCode: docCodeParam, schedId: scheduleId });
        const intIdx = findActiveDocIdx(state.documents, { docId: docIdParam, docCode: docCodeParam, schedId: scheduleId });
        const preferExt = Boolean(
          isExternalParam ||
          String(scheduleId || '').startsWith('PRS-EXT-') ||
          String(autoDocId || docIdParam || '').startsWith('EXT-') ||
          String(docCodeParam || autoDocId || '').startsWith('ED-')
        );
        const isExtDoc = preferExt ? (extIdx !== -1 || intIdx === -1) : (intIdx === -1 && extIdx !== -1);
        const doc = isExtDoc
          ? (extIdx !== -1 ? state.externalDocuments[extIdx] : null)
          : (intIdx !== -1 ? state.documents[intIdx] : null);

        if (doc) {
          const docCode = doc.edCode || doc.doc_code || doc.code || doc.document_number || doc.docNo || doc.title || doc.id;
          const rawRev = doc.revision || doc.rev || doc.revNo || '00';
          const cleanRev = String(rawRev).trim().replace(/^(Rev\.?\s*)+/i, '') || '00';
          const extCycleMonths = Number(doc.reviewCycleMonths || doc.frequencyMonths || (doc.verification_frequency ? Number(doc.verification_frequency) * 12 : 12)) || 12;
          const intCycleYears = getReviewCycleYears(doc.doc_type || doc.type || docCode);
          const synthSchedule = {
            id: scheduleId || `PRS-AUTO-${doc.id}`,
            documentId: doc.id,
            externalDocumentId: isExtDoc ? doc.id : null,
            documentNumber: docCode,
            documentName: doc.title || doc.name || doc.doc_name || docCode,
            ownerDepartmentId: doc.department || doc.dept || doc.owner_dept || 'DC',
            ownerUserId: doc.ownerId || doc.owner_id || 'U002',
            responsibleUserId: doc.ownerId || doc.owner_id || 'U002',
            rev: cleanRev,
            edition: doc.sourceVersion || doc.edition || '',
            sourceVersion: doc.sourceVersion || doc.edition || '',
            frequencyMonths: isExtDoc ? extCycleMonths : intCycleYears * 12,
            cycleYears: isExtDoc ? extCycleMonths / 12 : intCycleYears,
            originalReviewAnchorDate: doc.effectiveDate || doc.effective_date || doc.receivedDate || now,
            currentScheduledReviewDate: doc.nextReviewDate || doc.next_review_date || now,
            nextReviewDate: doc.nextReviewDate || doc.next_review_date || now,
            status: 'ACTION_REQUIRED',
            dueState: 'DUE',
            documentCategory: isExtDoc ? 'EXTERNAL' : 'INTERNAL',
            isExternal: isExtDoc,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          schedules.push(synthSchedule);
          scheduleIndex = schedules.length - 1;
        }
      }

      if (scheduleIndex === -1) return state;
      
      const schedule = { ...schedules[scheduleIndex] };
      const lookupParams = {
        docId: docIdParam || schedule.documentId || schedule.externalDocumentId,
        docCode: docCodeParam || schedule.documentNumber,
        schedId: schedule.id || scheduleId
      };
      const matchedExtIdx = findActiveDocIdx(state.externalDocuments, lookupParams);
      const matchedIntIdx = findActiveDocIdx(state.documents, lookupParams);
      const isExternalTarget = Boolean(
        isExternalParam ||
        schedule.documentCategory === 'EXTERNAL' ||
        schedule.isExternal ||
        schedule.externalDocumentId ||
        (matchedExtIdx !== -1 && matchedIntIdx === -1)
      );
      if (isExternalTarget) {
        schedule.documentCategory = 'EXTERNAL';
        schedule.isExternal = true;
        if (!schedule.externalDocumentId && matchedExtIdx !== -1) {
          schedule.externalDocumentId = state.externalDocuments[matchedExtIdx].id;
        }
      }
      const docDept = schedule.ownerDepartmentId || 'DC';
      
      // Find active review task
      const taskIndex = tasks.findIndex(t => t.scheduleId === schedule.id && t.status === 'ACTION_REQUIRED');
      if (taskIndex !== -1) {
        tasks[taskIndex] = { ...tasks[taskIndex], status: 'COMPLETED', is_completed: true, actionRequired: false, updatedAt: new Date().toISOString() };
      }

      const updatedTasks = (state.tasks || []).map(t => {
        if (
          (taskIdParam && t.id === taskIdParam) ||
          t.scheduleId === schedule.id || 
          (t.docId && (t.docId === schedule.documentId || t.docId === schedule.externalDocumentId)) ||
          (schedule.documentNumber && (t.document_code === schedule.documentNumber || t.docCode === schedule.documentNumber || t.doc_code === schedule.documentNumber))
        ) {
          return { ...t, status: 'COMPLETED', is_completed: true, actionRequired: false, updatedAt: new Date().toISOString() };
        }
        return t;
      });

      let newStatus = 'COMPLETED';
      let requiresLinkedAction = false;

      if (outcome === 'REVISION_REQUIRED' || outcome === 'OBSOLETE_REQUIRED') {
        newStatus = 'AWAITING_ACTION';
        requiresLinkedAction = true;
      } else if (outcome === 'NO_CHANGE' || outcome === 'CONFIRM_CONTINUE') {
        newStatus = 'COMPLETED';
      }

      schedule.status = newStatus;
      schedule.outcome = outcome;
      if (requiresLinkedAction) {
        schedule.review_status = 'AWAITING_ACTION';
        schedule.periodic_review_outcome = outcome;
        schedule.is_reviewed_this_cycle = false;
        schedule.dueState = 'AWAITING_ACTION';
      }
      if (linkedActionId) schedule.linkedActionId = linkedActionId;
      if (linkageStatus) schedule.linkageStatus = linkageStatus;
      if (idempotencyKey) schedule.idempotencyKey = idempotencyKey;
      schedule.dueState = 'NOT_YET_DUE';
      schedule.updatedAt = new Date().toISOString();
      
      let updatedDocs = state.documents;
      let updatedExtDocs = state.externalDocuments;

      if (!requiresLinkedAction) {
        const isFastTrack = isExternalTarget
          ? canFastTrackExternalReview(activeUser, docDept)
          : canFastTrackReview(activeUser, docDept);

        if (isFastTrack) {
          // === Flow 1: Fast-Track (1-Click Direct Approval by HOD/Manager/DCC/Admin) ===
          const targetExtDoc = matchedExtIdx !== -1 ? state.externalDocuments[matchedExtIdx] : null;
          const extCycleMonths = Number(
            targetExtDoc?.reviewCycleMonths ||
            schedule.frequencyMonths ||
            (targetExtDoc?.verification_frequency ? Number(targetExtDoc.verification_frequency) * 12 : 0) ||
            (schedule.cycleYears ? schedule.cycleYears * 12 : 12)
          ) || 12;
          const cycleYears = isExternalTarget
            ? (extCycleMonths / 12)
            : (schedule.cycleYears || getReviewCycleYears(schedule.documentNumber));
          let nextDate;
          if (isExternalTarget && extCycleMonths % 12 !== 0) {
            const dt = new Date(now);
            dt.setMonth(dt.getMonth() + extCycleMonths);
            nextDate = dt.toISOString().split('T')[0];
          } else {
            nextDate = addYears(now, cycleYears);
          }
          
          schedule.currentScheduledReviewDate = nextDate;
          schedule.nextReviewDate = nextDate;
          schedule.next_review_date = nextDate;
          schedule.lastReviewedDate = now;
          schedule.last_reviewed_at = now;
          schedule.is_reviewed_this_cycle = true;
          schedule.status = isExternalTarget ? 'COMPLETED' : 'UPCOMING';
          schedule.review_status = isExternalTarget ? 'COMPLETED' : 'UPCOMING';
          schedule.dueState = 'NOT_YET_DUE';

          const periodicReviewAuditEntry = {
            id: `REV-HIST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            round: 1,
            review_round: 1,
            reviewed_at: new Date().toISOString(),
            reviewed_date: now,
            result: outcome === 'CONFIRM_CONTINUE' ? 'NO_CHANGE' : (outcome || 'NO_CHANGE'),
            outcome: outcome || 'NO_CHANGE',
            reason: reviewDetails?.reason || reviewDetails?.remarks || reviewDetails?.comment || comment || '-',
            findings: reviewDetails?.findings || '-',
            standard_clause: reviewDetails?.standard_clause || reviewDetails?.standards || reviewDetails?.check_source || '-',
            check_source: reviewDetails?.standard_clause || reviewDetails?.standards || reviewDetails?.check_source || '-',
            evidence_reference: reviewDetails?.evidence_reference || reviewDetails?.references || '-',
            additional_comment: reviewDetails?.additional_comment || reviewDetails?.additionalComments || '-',
            remarks: reviewDetails?.reason || reviewDetails?.remarks || reviewDetails?.comment || comment || '-',
            next_review_due: nextDate,
            
            // ผู้ทบทวน (Reviewer)
            reviewer_id: activeUser?.id || null,
            reviewer_name: activeUser?.name || 'Reviewer',
            reviewer_role: activeUser?.role || 'Staff',
            
            // ผู้อนุมัติ (Approver - 1 Level Fast-Track)
            approver_id: activeUser?.id || null,
            approver_name: activeUser?.name || 'HOD',
            approver_role: activeUser?.role || 'HOD',
            approved_at: new Date().toISOString(),
            approval_status: 'APPROVED',
            approval_remarks: reviewDetails?.approval_remarks || '-'
          };

          const historyEntry = {
            id: `PRR-${Date.now()}`,
            reviewer: activeUser?.name || '-',
            reviewerId: activeUser?.id || null,
            reviewerRole: activeUser?.role || 'Staff',
            approver: activeUser?.name || '-',
            approverRole: activeUser?.role || 'HOD',
            reviewDate: now,
            comment: comment || '',
            reason: reviewDetails?.reason || comment || '',
            findings: reviewDetails?.findings || '',
            standard_clause: reviewDetails?.standard_clause || reviewDetails?.standards || '',
            evidence_reference: reviewDetails?.evidence_reference || reviewDetails?.references || '',
            additional_comment: reviewDetails?.additional_comment || reviewDetails?.additionalComments || '',
            outcome: outcome || 'NO_CHANGE',
            nextReviewDate: nextDate
          };

          if (!isExternalTarget && matchedIntIdx !== -1) {
            const doc = { ...state.documents[matchedIntIdx] };
            periodicReviewAuditEntry.round = (doc.periodic_reviews?.length || 0) + 1;
            periodicReviewAuditEntry.review_round = (doc.periodic_reviews?.length || 0) + 1;
            doc.last_reviewed_at = now;
            doc.lastReviewedDate = now;
            doc.next_review_date = nextDate;
            doc.nextReviewDate = nextDate;
            doc.review_status = 'UP_TO_DATE';
            doc.is_reviewed_this_cycle = true;
            delete doc.pending_periodic_review;
            delete doc.pending_review_task_id;
            doc.periodic_reviews = [...(doc.periodic_reviews || []), periodicReviewAuditEntry];
            doc.review_history = [...(doc.review_history || []), historyEntry];
            updatedDocs = [...state.documents];
            updatedDocs[matchedIntIdx] = doc;
          } else if (isExternalTarget && matchedExtIdx !== -1) {
            const doc = { ...state.externalDocuments[matchedExtIdx] };
            periodicReviewAuditEntry.round = (doc.periodic_reviews?.length || 0) + 1;
            periodicReviewAuditEntry.review_round = (doc.periodic_reviews?.length || 0) + 1;
            doc.last_reviewed_at = now;
            doc.lastReviewedDate = now;
            doc.last_verified_at = now;
            doc.nextReviewDate = nextDate;
            doc.next_review_date = nextDate;
            doc.review_status = 'COMPLETED';
            doc.is_reviewed_this_cycle = true;
            doc.pending_periodic_review = false;
            delete doc.pending_review_task_id;
            doc.periodic_reviews = [...(doc.periodic_reviews || []), periodicReviewAuditEntry];
            doc.review_history = [...(doc.review_history || []), historyEntry];
            updatedExtDocs = [...state.externalDocuments];
            updatedExtDocs[matchedExtIdx] = doc;
            schedule.periodic_reviews = doc.periodic_reviews;
          }

          schedules[scheduleIndex] = schedule;

          records.push({
            id: `PRR-${Date.now()}`,
            scheduleId: schedule.id,
            outcome,
            comment,
            reason: reviewDetails?.reason || reviewDetails?.comment || comment,
            findings: reviewDetails?.findings || '',
            standard_clause: reviewDetails?.standard_clause || reviewDetails?.standards || '',
            evidence_reference: reviewDetails?.evidence_reference || reviewDetails?.references || '',
            additional_comment: reviewDetails?.additional_comment || reviewDetails?.additionalComments || '',
            linkedActionId,
            reviewedByUserId: activeUser?.id,
            reviewedAt: new Date().toISOString()
          });

          result = { status: 'COMPLETED', fastTrack: true };

          return {
            documents: updatedDocs,
            externalDocuments: (updatedExtDocs || []).map(d => sanitizeExternalDocReviewStatus(d, now)),
            periodicReviewSchedules: schedules,
            periodicReviewTasks: tasks,
            tasks: updatedTasks,
            periodicReviewRecords: records,
            actionLog: [{
              id: `LOG-${Date.now()}`,
              actionType: 'PERIODIC_REVIEW_SUBMITTED',
              details: `Periodic review (Fast-Track) completed for ${schedule.documentNumber} with outcome ${outcome}`,
              actor: activeUser?.name,
              actorId: activeUser?.id,
              date: new Date().toISOString()
            }, ...(state.actionLog || [])]
          };
        } else {
          // === Flow 2: 2-Step Approval (Staff Submits -> Creates Task for HOD / Supervisor) ===
          // Expiration date is NOT extended yet!
          schedule.status = 'PENDING_APPROVAL';
          schedule.review_status = 'PENDING_APPROVAL';
          schedule.dueState = 'PENDING_APPROVAL';
          schedule.pending_periodic_review = true;

          // 1. Dynamic Approver Resolution: ค้นหาผู้มีอำนาจอนุมัติในแผนกเดียวกันจาก Store
          const allUsers = (state.users && state.users.length > 0) ? state.users : (state.masterUsers || masterUsers);
          const departmentApprover = allUsers.find(u => {
            const isSameDept = Boolean(
              docDept && (
                userMatchesDepartment(u, docDept) ||
                isSameDepartment(u.department, docDept) || 
                isSameDepartment(u.dept, docDept) || 
                isSameDepartment(u.primary_department, docDept) ||
                u.depts?.some(d => isSameDepartment(d, docDept)) ||
                u.departments?.some(d => isSameDepartment(d, docDept))
              )
            );
            const userLvl = getUserLevelNumber(u);
            const hasApprovalRole = isExternalTarget
              ? (userLvl >= 4 || Number(u.level) >= 4 || Number(u.approval_level) >= 4 || ['SUPERVISOR', 'DEPT_SUPERVISOR', 'HOD', 'MANAGER', 'DEPT_MANAGER'].includes(u.role) || Boolean(u.is_supervisor || u.is_hod || u.is_manager || u.isDeptHead))
              : (u.is_hod || u.is_manager || u.isDeptHead || userLvl >= 5 || Number(u.level) >= 5 || Number(u.approval_level) >= 5 || u.role === 'HOD' || u.role === 'MANAGER');
            return isSameDept && hasApprovalRole;
          });

          // 2. Dynamic Fallback: หากไม่พบผู้อนุมัติในแผนก ให้ค้นหาผู้ใช้ที่เป็น DCC / QMR จาก Store
          const dccApprover = allUsers.find(u => 
            u.is_dcc || 
            u.isDcc ||
            u.is_dcc_admin ||
            u.isDccAdmin ||
            u.is_qmr ||
            u.isQmr ||
            u.role === 'DCC' || 
            u.role === 'DCC_ADMIN' ||
            u.role === 'QMR' ||
            u.managedDepartments?.includes('*')
          );

          // เลือกรหัสผู้รับงานจากข้อมูลที่ค้นพบจริง (Zero Hardcoding)
          const targetAssigneeId = departmentApprover?.id || dccApprover?.id || null;
          const targetAssigneeName = departmentApprover?.name || dccApprover?.name || null;

          const pendingReviewPayload = {
            id: `REV-REQ-${Date.now()}`,
            doc_id: schedule.documentId || schedule.externalDocumentId || docIdParam,
            doc_code: schedule.documentNumber || docCodeParam,
            doc_title: schedule.documentName,
            revision: schedule.rev || '00',
            department: docDept,
            is_external: isExternalTarget,
            scheduleId: schedule.id,
            outcome: 'NO_CHANGE',
            reviewer_id: activeUser?.id,
            reviewer_name: activeUser?.name,
            reviewer_role: activeUser?.role || 'Staff',
            reviewer_position: activeUser?.position || activeUser?.role_name || (activeUser?.role !== 'DEPT_ADMIN' ? activeUser?.role : 'ผู้จัดทำ') || 'Staff',
            reviewer_department: activeUser?.department || activeUser?.dept || activeUser?.primary_department || docDept,
            submitted_at: new Date().toISOString(),
            details: reviewDetails || { comment }
          };

          const approvalTask = {
            id: `TASK-APPR-REV-${Date.now()}`,
            type: 'PERIODIC_REVIEW_APPROVAL',
            taskType: 'PERIODIC_REVIEW_APPROVAL',
            title: isExternalTarget
              ? `อนุมัติผลการทบทวนเอกสารภายนอก: ${schedule.documentNumber} (ไม่มีการเปลี่ยนแปลง)`
              : `อนุมัติผลการทบทวนเอกสาร: ${schedule.documentNumber} (ไม่มีการเปลี่ยนแปลง)`,
            document_code: schedule.documentNumber,
            document_title: schedule.documentName,
            docId: schedule.documentId || schedule.externalDocumentId,
            docCode: schedule.documentNumber,
            docTitle: schedule.documentName,
            revision: schedule.rev || '00',
            department: docDept,
            target_department: docDept,
            targetDepartment: docDept,
            target_role: isExternalTarget ? (departmentApprover?.role || 'SUPERVISOR') : 'HOD',
            targetRole: isExternalTarget ? (departmentApprover?.role || 'SUPERVISOR') : 'HOD',
            target_level: departmentApprover ? getUserLevelNumber(departmentApprover) : (isExternalTarget ? 4 : 5),
            assignee_id: targetAssigneeId,
            assigned_to: targetAssigneeId,
            assignee_name: targetAssigneeName,
            assignee_department: docDept,
            status: 'PENDING',
            payload: pendingReviewPayload,
            scheduleId: schedule.id,
            isExternal: isExternalTarget,
            is_external: isExternalTarget,
            created_at: new Date().toISOString()
          };

          schedule.pendingApprovalTaskId = approvalTask.id;
          schedule.pendingReview = pendingReviewPayload;
          schedules[scheduleIndex] = schedule;

          if (!isExternalTarget && matchedIntIdx !== -1) {
            const doc = { ...state.documents[matchedIntIdx] };
            doc.review_status = 'PENDING_APPROVAL';
            doc.pending_review_task_id = approvalTask.id;
            doc.pending_periodic_review = pendingReviewPayload;
            updatedDocs = [...state.documents];
            updatedDocs[matchedIntIdx] = doc;
          } else if (isExternalTarget && matchedExtIdx !== -1) {
            const doc = { ...state.externalDocuments[matchedExtIdx] };
            doc.review_status = 'PENDING_APPROVAL';
            doc.pending_review_task_id = approvalTask.id;
            doc.pending_periodic_review = true;
            doc.pendingReview = pendingReviewPayload;
            doc.pending_review_details = pendingReviewPayload;
            updatedExtDocs = [...state.externalDocuments];
            updatedExtDocs[matchedExtIdx] = doc;
          }

          result = { status: 'PENDING_APPROVAL', fastTrack: false, task: approvalTask };

          return {
            documents: updatedDocs,
            externalDocuments: (updatedExtDocs || []).map(d => sanitizeExternalDocReviewStatus(d, now)),
            periodicReviewSchedules: schedules,
            periodicReviewTasks: tasks,
            tasks: [approvalTask, ...updatedTasks],
            actionLog: [{
              id: `LOG-${Date.now()}`,
              actionType: 'PERIODIC_REVIEW_SUBMITTED_FOR_APPROVAL',
              details: `Periodic review submitted for approval for ${schedule.documentNumber} to ${isExternalTarget ? 'Supervisor/Manager' : 'HOD'} (${docDept})`,
              actor: activeUser?.name,
              actorId: activeUser?.id,
              date: new Date().toISOString()
            }, ...(state.actionLog || [])]
          };
        }
      }

      if (requiresLinkedAction) {
        const isFastTrack = isExternalTarget ? canFastTrackExternalReview(activeUser, docDept) : canFastTrackReview(activeUser, docDept);
        const linkedAuditEntry = {
          id: `REV-HIST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          round: 1,
          review_round: 1,
          reviewed_at: new Date().toISOString(),
          reviewed_date: now,
          result: outcome === 'REVISION_REQUIRED' ? 'REVISE' : (outcome === 'OBSOLETE_REQUIRED' ? 'OBSOLETE' : outcome),
          outcome: outcome,
          reason: reviewDetails?.reason || reviewDetails?.remarks || reviewDetails?.comment || comment || '-',
          findings: reviewDetails?.findings || '-',
          standard_clause: reviewDetails?.standard_clause || reviewDetails?.standards || reviewDetails?.check_source || '-',
          check_source: reviewDetails?.standard_clause || reviewDetails?.standards || reviewDetails?.check_source || '-',
          evidence_reference: reviewDetails?.evidence_reference || reviewDetails?.references || '-',
          additional_comment: reviewDetails?.additional_comment || reviewDetails?.additionalComments || '-',
          remarks: reviewDetails?.reason || reviewDetails?.remarks || reviewDetails?.comment || comment || '-',
          linkedActionId: linkedActionId || null,

          // ผู้ทบทวน (Reviewer)
          reviewer_id: activeUser?.id || null,
          reviewer_name: activeUser?.name || 'Reviewer',
          reviewer_role: activeUser?.role || 'Staff',

          // ผู้อนุมัติ (Approver - 1 Level)
          approver_id: isFastTrack ? activeUser?.id : null,
          approver_name: isFastTrack ? activeUser?.name : null,
          approver_role: isFastTrack ? activeUser?.role : null,
          approved_at: isFastTrack ? new Date().toISOString() : null,
          approval_status: isFastTrack ? 'APPROVED' : 'PENDING_APPROVAL',
          approval_remarks: reviewDetails?.approval_remarks || '-'
        };

        if (!isExternalTarget && matchedIntIdx !== -1) {
          const doc = { ...state.documents[matchedIntIdx] };
          linkedAuditEntry.round = (doc.periodic_reviews?.length || 0) + 1;
          linkedAuditEntry.review_round = (doc.periodic_reviews?.length || 0) + 1;
          doc.last_reviewed_at = now;
          doc.review_status = 'AWAITING_ACTION';
          doc.periodic_review_outcome = outcome;
          doc.is_reviewed_this_cycle = false;
          doc.periodic_reviews = [...(doc.periodic_reviews || []), linkedAuditEntry];
          doc.review_history = [...(doc.review_history || []), {
            id: `PRR-${Date.now()}`,
            reviewer: activeUser?.name || '-',
            reviewerId: activeUser?.id || null,
            reviewerRole: activeUser?.role || 'Staff',
            approver: isFastTrack ? activeUser?.name : null,
            approverRole: isFastTrack ? activeUser?.role : null,
            reviewDate: now,
            comment: comment || '',
            reason: reviewDetails?.reason || comment || '',
            outcome: outcome,
            linkedActionId: linkedActionId || null
          }];
          updatedDocs = [...state.documents];
          updatedDocs[matchedIntIdx] = doc;
        } else if (isExternalTarget && matchedExtIdx !== -1) {
          const doc = { ...state.externalDocuments[matchedExtIdx] };
          linkedAuditEntry.round = (doc.periodic_reviews?.length || 0) + 1;
          linkedAuditEntry.review_round = (doc.periodic_reviews?.length || 0) + 1;
          doc.last_reviewed_at = now;
          doc.review_status = 'AWAITING_ACTION';
          doc.periodic_review_outcome = outcome;
          doc.is_reviewed_this_cycle = false;
          doc.periodic_reviews = [...(doc.periodic_reviews || []), linkedAuditEntry];
          doc.review_history = [...(doc.review_history || []), {
            id: `PRR-${Date.now()}`,
            reviewer: activeUser?.name || '-',
            reviewerId: activeUser?.id || null,
            reviewerRole: activeUser?.role || 'Staff',
            approver: isFastTrack ? activeUser?.name : null,
            approverRole: isFastTrack ? activeUser?.role : null,
            reviewDate: now,
            comment: comment || '',
            reason: reviewDetails?.reason || comment || '',
            outcome: outcome,
            linkedActionId: linkedActionId || null
          }];
          updatedExtDocs = [...state.externalDocuments];
          updatedExtDocs[matchedExtIdx] = doc;
        }
      }

      if (requiresLinkedAction) {
        schedule.review_status = 'AWAITING_ACTION';
        schedule.status = 'AWAITING_ACTION';
        schedule.periodic_review_outcome = outcome;
        schedule.is_reviewed_this_cycle = false;
      }

      schedules[scheduleIndex] = schedule;

      records.push({
        id: `PRR-${Date.now()}`,
        scheduleId: schedule.id,
        outcome,
        comment,
        reason: reviewDetails?.reason || comment,
        findings: reviewDetails?.findings || '',
        standard_clause: reviewDetails?.standard_clause || reviewDetails?.standards || '',
        evidence_reference: reviewDetails?.evidence_reference || reviewDetails?.references || '',
        additional_comment: reviewDetails?.additional_comment || reviewDetails?.additionalComments || '',
        linkedActionId,
        reviewedByUserId: activeUser?.id,
        reviewedAt: new Date().toISOString()
      });

      result = { status: newStatus, outcome };

      return {
        documents: updatedDocs,
        externalDocuments: (updatedExtDocs || []).map(d => sanitizeExternalDocReviewStatus(d, now)),
        periodicReviewSchedules: schedules,
        periodicReviewTasks: tasks,
        tasks: updatedTasks,
        periodicReviewRecords: records,
        actionLog: [{
          id: `LOG-${Date.now()}`,
          actionType: 'PERIODIC_REVIEW_SUBMITTED',
          details: `Periodic review submitted for ${schedule.documentNumber} with outcome ${outcome}`,
          actor: activeUser?.name,
          actorId: activeUser?.id,
          date: new Date().toISOString()
        }, ...(state.actionLog || [])]
      };
    });
    return result;
  },

  retryPeriodicReviewLinkage: (scheduleId, newLinkedActionId) => set(state => {
    const schedules = [...state.periodicReviewSchedules];
    const scheduleIndex = schedules.findIndex(s => s.id === scheduleId);
    if (scheduleIndex === -1) return state;
    
    schedules[scheduleIndex] = { 
      ...schedules[scheduleIndex], 
      linkedActionId: newLinkedActionId, 
      linkageStatus: 'SUCCESS',
      updatedAt: new Date().toISOString()
    };
    return { periodicReviewSchedules: schedules };
  }),

  resetPendingReviewIntent: (docIdOrCode) => set(state => {
    if (!docIdOrCode) return state;

    const targetKey = String(docIdOrCode).trim();
    const cleanSchedKey = targetKey.replace(/^PRS-(AUTO|GEN|EXT|INT)-/, '');

    const matchesDoc = (d) => d && (
      String(d.id) === targetKey ||
      String(d.id) === cleanSchedKey ||
      d.edCode === targetKey ||
      d.edCode === cleanSchedKey ||
      d.doc_code === targetKey ||
      d.doc_code === cleanSchedKey ||
      d.code === targetKey ||
      d.code === cleanSchedKey ||
      d.document_number === targetKey ||
      d.docNo === targetKey ||
      d.title === targetKey
    );

    let extDocIdx = (state.externalDocuments || []).findIndex(matchesDoc);
    let intDocIdx = (state.documents || []).findIndex(matchesDoc);

    let schedIdx = (state.periodicReviewSchedules || []).findIndex(s =>
      s && (
        s.id === targetKey ||
        String(s.documentId) === targetKey ||
        String(s.externalDocumentId) === targetKey ||
        String(s.documentId) === cleanSchedKey ||
        String(s.externalDocumentId) === cleanSchedKey ||
        s.documentNumber === targetKey ||
        s.documentNumber === cleanSchedKey
      )
    );

    const targetSched = schedIdx !== -1 ? state.periodicReviewSchedules[schedIdx] : null;
    if (targetSched) {
      if (extDocIdx === -1 && targetSched.externalDocumentId) {
        extDocIdx = (state.externalDocuments || []).findIndex(d => String(d.id) === String(targetSched.externalDocumentId));
      }
      if (extDocIdx === -1 && targetSched.documentCategory === 'EXTERNAL') {
        extDocIdx = (state.externalDocuments || []).findIndex(d => String(d.id) === String(targetSched.documentId) || d.edCode === targetSched.documentNumber);
      }
      if (intDocIdx === -1 && targetSched.documentId && targetSched.documentCategory !== 'EXTERNAL') {
        intDocIdx = (state.documents || []).findIndex(d => String(d.id) === String(targetSched.documentId) || d.code === targetSched.documentNumber || d.doc_code === targetSched.documentNumber);
      }
    }

    const isExternal = extDocIdx !== -1 || Boolean(targetSched && (targetSched.documentCategory === 'EXTERNAL' || targetSched.isExternal));
    const targetDoc = isExternal
      ? (extDocIdx !== -1 ? state.externalDocuments[extDocIdx] : null)
      : (intDocIdx !== -1 ? state.documents[intDocIdx] : null);

    if (!targetDoc && !targetSched) {
      return state;
    }

    const docReviewStatus = String(targetDoc?.review_status || targetDoc?.status || '').toUpperCase();
    const docOutcome = String(targetDoc?.periodic_review_outcome || targetDoc?.outcome || '').toUpperCase();
    const schedStatus = String(targetSched?.status || targetSched?.review_status || '').toUpperCase();
    const schedOutcome = String(targetSched?.outcome || targetSched?.periodic_review_outcome || '').toUpperCase();

    const isTargetReviewState = (
      docReviewStatus === 'AWAITING_ACTION' ||
      docReviewStatus === 'PENDING_APPROVAL' ||
      docReviewStatus === 'REVISION_REQUIRED' ||
      docReviewStatus === 'OBSOLETE_REQUIRED' ||
      docOutcome === 'REVISION_REQUIRED' ||
      docOutcome === 'OBSOLETE_REQUIRED' ||
      schedStatus === 'AWAITING_ACTION' ||
      schedStatus === 'PENDING_APPROVAL' ||
      schedStatus === 'REVISION_REQUIRED' ||
      schedStatus === 'OBSOLETE_REQUIRED' ||
      schedOutcome === 'REVISION_REQUIRED' ||
      schedOutcome === 'OBSOLETE_REQUIRED' ||
      Boolean(targetDoc?.pending_periodic_review) ||
      Boolean(targetDoc?.pendingReview) ||
      Boolean(targetDoc?.pending_review_details) ||
      Boolean(targetDoc?.pending_review_task_id) ||
      Boolean(targetSched?.pendingReview) ||
      Boolean(targetSched?.pendingApprovalTaskId)
    );

    if (!isTargetReviewState) {
      return state;
    }

    // Must have NO confirmed active linked EDR/DAR request
    const linkedReqId = targetDoc?.linkedRequestId || targetDoc?.linkedActionId || targetSched?.linkedRequestId || targetSched?.linkedActionId;
    if (linkedReqId) {
      const activeExternalReq = (state.externalRequests || []).find(r =>
        (r.id === linkedReqId || r.requestId === linkedReqId) &&
        !['CANCELLED', 'REJECTED'].includes(r.status)
      );
      const activeDar = (state.dars || []).find(d =>
        (d.id === linkedReqId || d.dar_no === linkedReqId || d.darNo === linkedReqId) &&
        !['CANCELLED', 'REJECTED'].includes(d.status)
      );
      if (activeExternalReq || activeDar) {
        return state;
      }
    }

    const anchorDateStr = targetDoc?.nextReviewDate || targetDoc?.next_review_date || targetSched?.nextReviewDate || targetSched?.currentScheduledReviewDate;
    let evalStatus = 'UP_TO_DATE';
    if (anchorDateStr) {
      const today = new Date(state.simulatedSystemDate ? state.simulatedSystemDate : new Date());
      today.setHours(0, 0, 0, 0);
      const target = new Date(anchorDateStr);
      if (!isNaN(target.getTime())) {
        target.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          evalStatus = 'OVERDUE';
        } else if (diffDays <= 30) {
          evalStatus = 'DUE_SOON';
        } else {
          evalStatus = 'UP_TO_DATE';
        }
      }
    }

    let updatedExtDocs = state.externalDocuments;
    let updatedIntDocs = state.documents;

    if (isExternal && extDocIdx !== -1) {
      const doc = { ...state.externalDocuments[extDocIdx] };
      delete doc.periodic_review_outcome;
      delete doc.pending_periodic_review;
      delete doc.pendingReview;
      delete doc.pending_review_details;
      delete doc.pending_review_task_id;
      delete doc.linkedRequestId;
      delete doc.linkedActionId;
      doc.review_status = evalStatus;
      doc.is_reviewed_this_cycle = false;

      if (Array.isArray(doc.periodic_reviews) && doc.periodic_reviews.length > 0) {
        const lastRev = doc.periodic_reviews[doc.periodic_reviews.length - 1];
        const isDraftUncommitted = (
          lastRev.approval_status !== 'APPROVED' ||
          lastRev.outcome === 'REVISION_REQUIRED' ||
          lastRev.outcome === 'OBSOLETE_REQUIRED' ||
          lastRev.result === 'REVISE' ||
          lastRev.result === 'OBSOLETE'
        ) && (!lastRev.linkedActionId || lastRev.linkedActionId === linkedReqId) &&
             (!lastRev.linkedRequestId || lastRev.linkedRequestId === linkedReqId);
        if (isDraftUncommitted) {
          doc.periodic_reviews = doc.periodic_reviews.slice(0, -1);
        }
      }
      if (Array.isArray(doc.review_history) && doc.review_history.length > 0) {
        const lastHist = doc.review_history[doc.review_history.length - 1];
        const isDraftHist = (
          lastHist.outcome === 'REVISION_REQUIRED' ||
          lastHist.outcome === 'OBSOLETE_REQUIRED' ||
          lastHist.outcome === 'PENDING_APPROVAL'
        ) && (!lastHist.linkedActionId || lastHist.linkedActionId === linkedReqId) &&
             (!lastHist.linkedRequestId || lastHist.linkedRequestId === linkedReqId);
        if (isDraftHist) {
          doc.review_history = doc.review_history.slice(0, -1);
        }
      }

      updatedExtDocs = [...state.externalDocuments];
      updatedExtDocs[extDocIdx] = doc;
    } else if (!isExternal && intDocIdx !== -1) {
      const doc = { ...state.documents[intDocIdx] };
      delete doc.periodic_review_outcome;
      delete doc.pending_periodic_review;
      delete doc.pendingReview;
      delete doc.pending_review_details;
      delete doc.pending_review_task_id;
      delete doc.linkedRequestId;
      delete doc.linkedActionId;
      doc.review_status = evalStatus;
      doc.is_reviewed_this_cycle = false;

      if (Array.isArray(doc.periodic_reviews) && doc.periodic_reviews.length > 0) {
        const lastRev = doc.periodic_reviews[doc.periodic_reviews.length - 1];
        const isDraftUncommitted = (
          lastRev.approval_status !== 'APPROVED' ||
          lastRev.outcome === 'REVISION_REQUIRED' ||
          lastRev.outcome === 'OBSOLETE_REQUIRED' ||
          lastRev.result === 'REVISE' ||
          lastRev.result === 'OBSOLETE'
        ) && (!lastRev.linkedActionId || lastRev.linkedActionId === linkedReqId);
        if (isDraftUncommitted) {
          doc.periodic_reviews = doc.periodic_reviews.slice(0, -1);
        }
      }
      if (Array.isArray(doc.review_history) && doc.review_history.length > 0) {
        const lastHist = doc.review_history[doc.review_history.length - 1];
        const isDraftHist = (
          lastHist.outcome === 'REVISION_REQUIRED' ||
          lastHist.outcome === 'OBSOLETE_REQUIRED' ||
          lastHist.outcome === 'PENDING_APPROVAL'
        );
        if (isDraftHist) {
          doc.review_history = doc.review_history.slice(0, -1);
        }
      }

      updatedIntDocs = [...state.documents];
      updatedIntDocs[intDocIdx] = doc;
    }

    let updatedSchedules = state.periodicReviewSchedules;
    if (state.periodicReviewSchedules && state.periodicReviewSchedules.length > 0) {
      const targetDocId = targetDoc ? String(targetDoc.id) : null;
      const targetDocCode = targetDoc ? (targetDoc.edCode || targetDoc.doc_code || targetDoc.code || targetDoc.document_number) : null;
      const targetSchedId = targetSched?.id;

      updatedSchedules = state.periodicReviewSchedules.map(s => {
        const isTargetSched = (
          (targetSchedId && s.id === targetSchedId) ||
          (targetDocId && (String(s.documentId) === targetDocId || String(s.externalDocumentId) === targetDocId)) ||
          (targetDocCode && s.documentNumber === targetDocCode) ||
          s.id === targetKey ||
          s.id === `PRS-AUTO-${targetKey}`
        );
        if (!isTargetSched) return s;

        const schedStatus = evalStatus === 'DUE_SOON' ? 'DUE_SOON' : (evalStatus === 'OVERDUE' ? 'ACTION_REQUIRED' : 'NOT_YET_DUE');
        const dueState = evalStatus === 'OVERDUE' ? 'OVERDUE' : (evalStatus === 'DUE_SOON' ? 'DUE_SOON_30' : 'NOT_YET_DUE');

        const nextSched = { ...s };
        delete nextSched.outcome;
        delete nextSched.periodic_review_outcome;
        delete nextSched.review_status;
        delete nextSched.pendingApprovalTaskId;
        delete nextSched.pendingReview;
        delete nextSched.linkedActionId;
        delete nextSched.linkedRequestId;
        delete nextSched.linkageStatus;
        nextSched.status = schedStatus;
        nextSched.dueState = dueState;
        nextSched.is_reviewed_this_cycle = false;
        nextSched.updatedAt = new Date().toISOString();
        return nextSched;
      });
    }

    const targetDocId = targetDoc ? String(targetDoc.id) : null;
    const targetDocCode = targetDoc ? (targetDoc.edCode || targetDoc.doc_code || targetDoc.code || targetDoc.document_number) : null;
    const targetSchedId = targetSched?.id;
    const pendingTaskId = targetSched?.pendingApprovalTaskId || targetDoc?.pending_review_task_id;

    const cancelApprovalTask = (t) => {
      const isApprovalTask = t.type === 'PERIODIC_REVIEW_APPROVAL' || t.taskType === 'PERIODIC_REVIEW_APPROVAL';
      if (!isApprovalTask) return t;
      if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return t;

      const isTaskMatch = (
        (pendingTaskId && t.id === pendingTaskId) ||
        (targetSchedId && t.scheduleId === targetSchedId) ||
        (targetDocId && (String(t.docId) === targetDocId || String(t.documentId) === targetDocId)) ||
        (targetDocCode && (t.docCode === targetDocCode || t.document_code === targetDocCode || t.doc_code === targetDocCode)) ||
        (t.payload && (
          (targetSchedId && t.payload.scheduleId === targetSchedId) ||
          (targetDocId && String(t.payload.doc_id) === targetDocId) ||
          (targetDocCode && t.payload.doc_code === targetDocCode)
        ))
      );

      if (isTaskMatch) {
        return {
          ...t,
          status: 'CANCELLED',
          is_completed: true,
          actionRequired: false,
          cancelReason: 'Review draft intent reset/cancelled',
          updatedAt: new Date().toISOString()
        };
      }
      return t;
    };

    const updatedTasks = (state.tasks || []).map(cancelApprovalTask);
    const updatedPeriodicTasks = (state.periodicReviewTasks || []).map(cancelApprovalTask);

    return {
      documents: updatedIntDocs,
      externalDocuments: updatedExtDocs,
      periodicReviewSchedules: updatedSchedules,
      tasks: updatedTasks,
      periodicReviewTasks: updatedPeriodicTasks,
      actionLog: [{
        id: `LOG-${Date.now()}`,
        actionType: 'PERIODIC_REVIEW_INTENT_RESET',
        details: `Reset pending review intent for ${targetDoc?.title || targetDocCode || targetKey}: status returned to ${evalStatus}`,
        actor: state.currentUser?.name || 'System',
        actorId: state.currentUser?.id || 'system',
        date: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  cancelOrResetPeriodicReview: (scheduleIdOrDocId) => {
    return get().resetPendingReviewIntent(scheduleIdOrDocId);
  },
  // --- Narrow Dependency-Injection Seam for Testing Real Workflow ---
  // Safe because these methods only orchestrate existing actions and are explicitly designed to take adapter dependencies
  submitPeriodicReviewWithDarAction: (scheduleId, outcome, comment, darPayload, darAdapter, extraOptions = {}) => {
    const store = get();
    const idempotencyKey = `PERIODIC_REVIEW_${scheduleId}_${outcome}`;
    const reviewDetails = extraOptions.reviewDetails || { comment };
    try {
      const newLinkedId = darAdapter(darPayload);
      store.submitPeriodicReview({
        scheduleId,
        outcome,
        comment,
        linkedActionId: newLinkedId,
        linkageStatus: 'SUCCESS',
        idempotencyKey,
        taskId: extraOptions.taskId,
        reviewDetails
      });
    } catch {
      store.submitPeriodicReview({
        scheduleId,
        outcome,
        comment,
        linkedActionId: null,
        linkageStatus: 'FAILED',
        idempotencyKey,
        taskId: extraOptions.taskId,
        reviewDetails
      });
    }
  },

  retryPeriodicReviewLinkageWithDarAction: (scheduleId, darPayload, darAdapter) => {
    const store = get();
    const schedule = store.periodicReviewSchedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    
    // Check idempotency visually
    if (schedule.linkedActionId && schedule.linkageStatus === 'SUCCESS') return;

    try {
      const newLinkedId = darAdapter(darPayload);
      store.retryPeriodicReviewLinkage(scheduleId, newLinkedId);
    } catch {
      // Intentionally swallow to maintain FAILED state
    }
  },
  // --- Periodic Review DAR Linkage Service Wrappers ---
  createOrGetLinkedDarDraft: (reviewId, outcome, darPayload) => {
    const state = get();
    const autoId = reviewId ? String(reviewId).replace(/^PRS-AUTO-/, '') : null;
    let schedule = (state.periodicReviewSchedules || []).find(s =>
      s.id === reviewId ||
      (autoId && (s.documentId === autoId || s.externalDocumentId === autoId || s.documentNumber === autoId))
    );
    if (!schedule) {
      const allActive = [...(state.documents || []), ...(state.externalDocuments || [])].filter(
        d => d && !d.is_superseded && !d.is_obsolete && d.status !== 'SUPERSEDED' && d.status !== 'OBSOLETE'
      );
      const doc = allActive.find(d =>
        d.id === autoId ||
        d.id === darPayload?.refDocId ||
        d.edCode === autoId ||
        d.doc_code === autoId ||
        d.code === autoId ||
        d.title === autoId
      );
      if (doc) {
        const isExt = Boolean(doc.is_external || doc.edCode || (state.externalDocuments || []).some(ed => ed.id === doc.id));
        schedule = {
          id: reviewId,
          documentId: doc.id,
          externalDocumentId: isExt ? doc.id : null,
          documentNumber: doc.edCode || doc.doc_code || doc.code || doc.title || doc.id,
          documentName: doc.title || doc.name || doc.doc_name,
          ownerDepartmentId: doc.department || doc.dept || 'DC',
          documentCategory: isExt ? 'EXTERNAL' : 'INTERNAL'
        };
      }
    }
    if (!schedule) throw new Error('Schedule not found');
    return createOrGetLinkedDarDraft(schedule, outcome, darPayload, get);
  },

  validateLinkedDarSource: (draft) => {
    return validateLinkedDarSource(draft, get);
  },

  resolveLockedSourceDocument: (draft) => {
    return resolveLockedSourceDocument(draft, get);
  },

  getLinkedActionStatus: (darStatus) => {
    return getLinkedActionStatus(darStatus);
  },

  /**
   * ISO 9001 Clause 7.5.3 — Periodic Document Review Logger
   *
   * Records a review outcome on the target schedule without modifying
   * the document's Revision number.  Three outcomes are supported:
   *   'CONFIRM_CONTINUE'   → stamps reviewLog entry + rolls nextReviewDate +1 year
   *   'REVISION_REQUIRED'  → delegates to submitPeriodicReview (opens DAR)
   *   'OBSOLETE_REQUIRED'  → delegates to submitPeriodicReview (opens obsolete DAR)
   *
   * @param {{ scheduleId, isExternal, outcome, comment, reviewer, reviewDate }} payload
   */
  recordPeriodicReview: (payload) => set(state => {
    const { scheduleId, docId, docCode, outcome, comment, reviewer, reviewDate, verificationChannel } = payload || {};
    const rawScheduleKey = scheduleId ? String(scheduleId).replace(/^PRS-AUTO-/, '') : null;
    const isActiveRecord = (d) => d && !d.is_superseded && !d.is_obsolete && d.status !== 'SUPERSEDED' && d.status !== 'OBSOLETE' && d.status !== 'OBSOLETE_ARCHIVED';
    const matchesExtRecord = (d) =>
      (docId && String(d.id) === String(docId)) ||
      (rawScheduleKey && (String(d.id) === rawScheduleKey || d.edCode === rawScheduleKey || d.doc_code === rawScheduleKey || d.code === rawScheduleKey)) ||
      (docCode && (String(d.id) === String(docCode) || d.edCode === docCode || d.doc_code === docCode || d.code === docCode || d.title === docCode));
    const matchesIntRecord = (d) =>
      (docId && String(d.id) === String(docId)) ||
      (rawScheduleKey && (String(d.id) === rawScheduleKey || d.doc_code === rawScheduleKey || d.doc_number === rawScheduleKey || d.code === rawScheduleKey || d.title === rawScheduleKey)) ||
      (docCode && (String(d.id) === String(docCode) || d.doc_code === docCode || d.doc_number === docCode || d.code === docCode || d.title === docCode));

    const schedules = [...(state.periodicReviewSchedules || [])];
    let idx = schedules.findIndex(s =>
      (scheduleId && s.id === scheduleId) ||
      (docId && (s.documentId === docId || s.externalDocumentId === docId)) ||
      (rawScheduleKey && (s.documentId === rawScheduleKey || s.externalDocumentId === rawScheduleKey || s.documentNumber === rawScheduleKey))
    );

    const matchedExtDoc = (state.externalDocuments || []).find(d => isActiveRecord(d) && matchesExtRecord(d)) ||
      (state.externalDocuments || []).find(matchesExtRecord) || null;
    const matchedIntDoc = (state.documents || []).find(d => isActiveRecord(d) && matchesIntRecord(d)) ||
      (state.documents || []).find(matchesIntRecord) || null;

    if (idx === -1) {
      const fallbackDoc = (payload?.isExternal ? matchedExtDoc : matchedIntDoc) || matchedExtDoc || matchedIntDoc;
      if (!fallbackDoc) return state;
      const isExtFallback = Boolean(payload?.isExternal ?? (matchedExtDoc && fallbackDoc === matchedExtDoc));
      const cycleMonths = fallbackDoc.reviewCycleMonths ? Number(fallbackDoc.reviewCycleMonths) : 12;
      const cycleYrs = isExtFallback ? (cycleMonths / 12 || 1) : getReviewCycleYears(fallbackDoc.code || fallbackDoc.doc_code || fallbackDoc.title || '');
      const docNum = isExtFallback
        ? (fallbackDoc.edCode || fallbackDoc.doc_code || fallbackDoc.code || fallbackDoc.id)
        : (fallbackDoc.doc_code || fallbackDoc.code || fallbackDoc.title || fallbackDoc.id);
      const synthesizedSchedule = {
        id: scheduleId || `PRS-AUTO-${fallbackDoc.id || docNum}`,
        documentCategory: isExtFallback ? 'EXTERNAL' : 'INTERNAL',
        isExternal: isExtFallback,
        documentId: fallbackDoc.id,
        externalDocumentId: isExtFallback ? fallbackDoc.id : null,
        documentNumber: docNum,
        title: fallbackDoc.name || fallbackDoc.title || docNum,
        department: fallbackDoc.department || 'General',
        edition: fallbackDoc.sourceVersion || fallbackDoc.edition || '',
        sourceVersion: fallbackDoc.sourceVersion || fallbackDoc.edition || '',
        rev: isExtFallback
          ? String(fallbackDoc.sourceVersion || fallbackDoc.edition || '1.0').replace(/^(Rev\.?\s*)+/i, '').trim()
          : String(fallbackDoc.rev || fallbackDoc.version || '00').replace(/^(Rev\.?\s*)+/i, '').trim(),
        effectiveDate: fallbackDoc.effectiveDate || fallbackDoc.effective_date || fallbackDoc.issueDate || new Date().toISOString().split('T')[0],
        nextReviewDate: fallbackDoc.nextReviewDate || fallbackDoc.next_review_date || new Date().toISOString().split('T')[0],
        currentScheduledReviewDate: fallbackDoc.nextReviewDate || fallbackDoc.next_review_date || new Date().toISOString().split('T')[0],
        cycleYears: cycleYrs,
        frequencyMonths: isExtFallback ? cycleMonths : cycleYrs * 12,
        status: 'PENDING_REVIEW',
        dueState: 'DUE',
        reviewLogs: []
      };
      schedules.push(synthesizedSchedule);
      idx = schedules.length - 1;
    }

    const schedule = { ...schedules[idx] };
    const isExternal = payload?.isExternal !== undefined 
      ? Boolean(payload.isExternal) 
      : Boolean(schedule.documentCategory === 'EXTERNAL' || schedule.isExternal || matchedExtDoc);
    const now = reviewDate || new Date().toISOString().split('T')[0];

    // Build a stamped review log entry (ISO 9001 Clause 7.5.3 evidence)
    const logEntry = {
      id: `PRL-${Date.now()}`,
      reviewDate: now,
      reviewer: reviewer || state.currentUser?.name || '-',
      reviewerId: state.currentUser?.id || null,
      outcome,
      comment: comment || '',
      channel: verificationChannel || null,
      previousNextReviewDate: schedule.nextReviewDate || null,
    };

    const isNoChange = outcome === 'CONFIRM_CONTINUE' || outcome === 'NO_CHANGE';
    const isRevise = outcome === 'REVISION_REQUIRED' || outcome === 'REVISE';
    const isObsolete = outcome === 'OBSOLETE_REQUIRED' || outcome === 'OBSOLETE';
    const normalizedResult = isNoChange ? 'NO_CHANGE' : (isRevise ? 'REVISE' : (isObsolete ? 'OBSOLETE' : outcome));

    let nextDate = null;
    if (isNoChange) {
      // Extend next_review_date by document cycle years (e.g. 1 yr for SOP/QP, 2 yr for WI/FM, or reviewCycleMonths / 12 for External)
      const extCycleYears = matchedExtDoc?.reviewCycleMonths ? Number(matchedExtDoc.reviewCycleMonths) / 12 : null;
      const cycleYears = schedule.cycleYears || (schedule.frequencyMonths ? schedule.frequencyMonths / 12 : (extCycleYears || 1));
      nextDate = addYears(now, cycleYears || 1);
      logEntry.newNextReviewDate = nextDate;

      schedule.lastReviewedDate = now;
      schedule.last_reviewed_at = now;
      schedule.nextReviewDate = nextDate;
      schedule.currentScheduledReviewDate = nextDate;
      schedule.status = 'UPCOMING';
      schedule.dueState = 'NOT_YET_DUE';
      schedule.is_reviewed_this_cycle = true;
    }

    schedule.reviewLogs = [...(schedule.reviewLogs || []), logEntry];
    schedule.updatedAt = new Date().toISOString();
    schedules[idx] = schedule;

    const reviewerName = (typeof reviewer === 'object' ? reviewer?.name : reviewer) || state.currentUser?.name || '-';
    const reviewerRole = (typeof reviewer === 'object' ? reviewer?.role : null) || state.currentUser?.role || 'Staff';
    const approverUser = isNoChange ? (payload?.approver || state.currentUser) : (payload?.approver || null);
    const approverName = approverUser ? ((typeof approverUser === 'object' ? approverUser?.name : approverUser) || 'HOD') : null;
    const approverRole = approverUser ? ((typeof approverUser === 'object' ? approverUser?.role : null) || 'HOD') : null;

    const auditEntry = {
      id: `REV-HIST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      round: 1,
      review_round: 1,
      reviewed_at: new Date().toISOString(),
      reviewed_date: now,
      result: normalizedResult,
      outcome,
      reason: payload?.reviewDetails?.reason || payload?.reviewDetails?.remarks || payload?.reviewDetails?.comment || comment || '-',
      findings: payload?.reviewDetails?.findings || '-',
      standard_clause: payload?.reviewDetails?.standard_clause || payload?.reviewDetails?.standards || payload?.verificationChannel || '-',
      check_source: payload?.reviewDetails?.standard_clause || payload?.reviewDetails?.standards || payload?.verificationChannel || '-',
      evidence_reference: payload?.reviewDetails?.evidence_reference || payload?.reviewDetails?.references || '-',
      additional_comment: payload?.reviewDetails?.additional_comment || payload?.reviewDetails?.additionalComments || '-',
      remarks: payload?.reviewDetails?.remarks || payload?.reviewDetails?.reason || payload?.reviewDetails?.comment || comment || '-',
      ...(isNoChange ? { next_review_due: nextDate } : {}),
      reviewer_id: (typeof reviewer === 'object' ? reviewer?.id : null) || state.currentUser?.id || null,
      reviewer_name: reviewerName,
      reviewer_role: reviewerRole,
      approver_id: (typeof approverUser === 'object' ? approverUser?.id : null) || (isNoChange ? state.currentUser?.id : null),
      approver_name: approverName,
      approver_role: approverRole,
      approved_at: approverUser ? new Date().toISOString() : null,
      approval_status: approverUser ? 'APPROVED' : 'PENDING_APPROVAL',
      approval_remarks: payload?.reviewDetails?.approval_remarks || '-'
    };

    let updatedDocs = state.documents;
    let updatedExtDocs = state.externalDocuments;

    if (!isExternal && state.documents && state.documents.length > 0) {
      const matchInt = (d) =>
        (schedule.documentId && String(d.id) === String(schedule.documentId)) ||
        (schedule.documentNumber && (d.title === schedule.documentNumber || d.doc_code === schedule.documentNumber || d.doc_number === schedule.documentNumber || d.code === schedule.documentNumber)) ||
        matchesIntRecord(d);
      let docIdx = state.documents.findIndex(d => isActiveRecord(d) && matchInt(d));
      if (docIdx === -1) docIdx = state.documents.findIndex(matchInt);
      if (docIdx !== -1) {
        const doc = { ...state.documents[docIdx] };
        const newRound = (doc.periodic_reviews?.length || 0) + 1;
        auditEntry.round = newRound;
        auditEntry.review_round = newRound;
        doc.last_reviewed_at = now;
        if (isNoChange) {
          doc.next_review_date = nextDate;
          doc.review_status = 'UP_TO_DATE';
          doc.is_reviewed_this_cycle = true;
          delete doc.pending_periodic_review;
          doc.review_history = [...(doc.review_history || []), {
            id: logEntry.id,
            reviewer: reviewerName,
            reviewerId: state.currentUser?.id || null,
            reviewerRole,
            approver: approverName,
            approverRole,
            reviewDate: now,
            comment: comment || '',
            outcome: 'NO_CHANGE',
            channel: verificationChannel || null,
            nextReviewDate: nextDate
          }];
        } else if (isRevise || isObsolete) {
          doc.review_status = 'AWAITING_ACTION';
          doc.periodic_review_outcome = outcome;
          doc.is_reviewed_this_cycle = false;
          schedule.status = 'AWAITING_ACTION';
          schedule.review_status = 'AWAITING_ACTION';
          schedule.periodic_review_outcome = outcome;
          schedule.is_reviewed_this_cycle = false;
        }
        doc.periodic_reviews = [...(doc.periodic_reviews || []), auditEntry];
        updatedDocs = [...state.documents];
        updatedDocs[docIdx] = doc;
      }
    } else if (isExternal && state.externalDocuments && state.externalDocuments.length > 0) {
      const matchExt = (d) =>
        (schedule.externalDocumentId && String(d.id) === String(schedule.externalDocumentId)) ||
        (schedule.documentId && String(d.id) === String(schedule.documentId)) ||
        (schedule.documentNumber && (String(d.id) === String(schedule.documentNumber) || d.edCode === schedule.documentNumber || d.doc_code === schedule.documentNumber || d.title === schedule.documentNumber || d.code === schedule.documentNumber)) ||
        matchesExtRecord(d);
      let docIdx = state.externalDocuments.findIndex(d => isActiveRecord(d) && matchExt(d));
      if (docIdx === -1) docIdx = state.externalDocuments.findIndex(matchExt);
      if (docIdx !== -1) {
        const doc = { ...state.externalDocuments[docIdx] };
        const newRound = (doc.periodic_reviews?.length || 0) + 1;
        auditEntry.round = newRound;
        auditEntry.review_round = newRound;
        doc.last_reviewed_at = now;
        doc.lastReviewedDate = now;
        if (isNoChange) {
          doc.last_verified_at = now;
          doc.nextReviewDate = nextDate;
          doc.next_review_date = nextDate;
          doc.review_status = 'COMPLETED';
          doc.is_reviewed_this_cycle = true;
          doc.pending_periodic_review = false;
          delete doc.pending_review_task_id;
          if (verificationChannel) doc.verification_channel = verificationChannel;
          doc.review_history = [...(doc.review_history || []), {
            id: logEntry.id,
            reviewer: reviewerName,
            reviewerId: state.currentUser?.id || null,
            reviewerRole,
            approver: approverName,
            approverRole,
            reviewDate: now,
            comment: comment || '',
            outcome: 'NO_CHANGE',
            channel: verificationChannel || null,
            nextReviewDate: nextDate
          }];
        } else if (isRevise || isObsolete) {
          doc.review_status = 'AWAITING_ACTION';
          doc.periodic_review_outcome = outcome;
          doc.is_reviewed_this_cycle = false;
          schedule.status = 'AWAITING_ACTION';
          schedule.review_status = 'AWAITING_ACTION';
          schedule.periodic_review_outcome = outcome;
          schedule.is_reviewed_this_cycle = false;
        }
        doc.periodic_reviews = [...(doc.periodic_reviews || []), auditEntry];
        updatedExtDocs = [...state.externalDocuments];
        updatedExtDocs[docIdx] = doc;
      }
    }

    if (isNoChange) {
      const updatedTasks = (state.tasks || []).map(t => {
        if (t.scheduleId === scheduleId || t.scheduleId === schedule.id || (t.docId && (t.docId === schedule.documentId || t.docId === schedule.externalDocumentId))) {
          return { ...t, status: 'COMPLETED', is_completed: true, actionRequired: false, updatedAt: new Date().toISOString() };
        }
        return t;
      });

      const updatedPeriodicReviewTasks = (state.periodicReviewTasks || []).map(t => {
        if (t.scheduleId === scheduleId || t.scheduleId === schedule.id || (t.docId && (t.docId === schedule.documentId || t.docId === schedule.externalDocumentId))) {
          return { ...t, status: 'COMPLETED', is_completed: true, actionRequired: false, updatedAt: new Date().toISOString() };
        }
        return t;
      });

      const records = [...(state.periodicReviewRecords || []), {
        id: logEntry.id,
        scheduleId: schedule.id,
        outcome,
        comment,
        channel: verificationChannel || null,
        reviewedByUserId: state.currentUser?.id,
        reviewedAt: new Date().toISOString()
      }];

      return {
        documents: updatedDocs,
        externalDocuments: (updatedExtDocs || []).map(d => sanitizeExternalDocReviewStatus(d, now)),
        periodicReviewSchedules: schedules,
        periodicReviewTasks: updatedPeriodicReviewTasks,
        tasks: updatedTasks,
        periodicReviewRecords: records,
        actionLog: [{
          id: `LOG-${Date.now()}`,
          actionType: 'PERIODIC_REVIEW_CONFIRMED',
          details: `ยืนยันใช้งานต่อโดยไม่แก้ไข: ${schedule.documentNumber || scheduleId} → ทบทวนครั้งถัดไป ${nextDate}`,
          actor: state.currentUser?.name,
          actorId: state.currentUser?.id,
          date: new Date().toISOString()
        }, ...(state.actionLog || [])]
      };
    }

    return { 
      documents: updatedDocs,
      externalDocuments: (updatedExtDocs || []).map(d => sanitizeExternalDocReviewStatus(d, now)),
      periodicReviewSchedules: schedules 
    };
  }),

  confirmPeriodicReviewNoChange: (payload) => {
    return get().recordPeriodicReview({
      ...payload,
      outcome: 'CONFIRM_CONTINUE'
    });
  },

  approvePeriodicReview: (arg1, arg2, arg3) => set(state => {
    const params = (typeof arg1 === 'object' && arg1 !== null)
      ? arg1
      : { taskId: arg1, approverUser: arg2, remarks: arg3 };
    const { taskId, approverUser, remarks } = params;

    const task = (state.tasks || []).find(t => t.id === taskId) ||
      (state.periodicReviewTasks || []).find(t => t.id === taskId);
    if (!task) return state;

    const taskPayload = task.payload || {};
    const approver = approverUser || state.currentUser;
    const doc_id = taskPayload.doc_id || task.docId || task.documentId || task.doc_id || null;
    const doc_code = taskPayload.doc_code || task.docCode || task.document_code || task.documentNumber || null;
    const scheduleId = taskPayload.scheduleId || task.scheduleId || null;
    const rawScheduleKey = scheduleId ? String(scheduleId).replace(/^PRS-AUTO-/, '') : null;
    const reviewer_id = taskPayload.reviewer_id || task.reviewer_id || null;
    const reviewer_name = taskPayload.reviewer_name || task.reviewer_name || 'Staff';
    const reviewer_role = taskPayload.reviewer_role || task.reviewer_role || 'Staff';
    const submitted_at = taskPayload.submitted_at || task.created_at || null;
    const details = taskPayload.details || {};

    const isActiveRecord = (d) => d && !d.is_superseded && !d.is_obsolete && d.status !== 'SUPERSEDED' && d.status !== 'OBSOLETE' && d.status !== 'OBSOLETE_ARCHIVED';
    const matchesExtRecord = (d) =>
      (doc_id && String(d.id) === String(doc_id)) ||
      (rawScheduleKey && (String(d.id) === rawScheduleKey || d.edCode === rawScheduleKey || d.doc_code === rawScheduleKey || d.code === rawScheduleKey)) ||
      (doc_code && (String(d.id) === String(doc_code) || d.edCode === doc_code || d.doc_code === doc_code || d.code === doc_code || d.title === doc_code));
    const matchesIntRecord = (d) =>
      (doc_id && String(d.id) === String(doc_id)) ||
      (rawScheduleKey && (String(d.id) === rawScheduleKey || d.doc_code === rawScheduleKey || d.doc_number === rawScheduleKey || d.code === rawScheduleKey || d.title === rawScheduleKey)) ||
      (doc_code && (String(d.id) === String(doc_code) || d.doc_code === doc_code || d.doc_number === doc_code || d.code === doc_code || d.title === doc_code));

    const matchedExtDoc = (state.externalDocuments || []).find(d => isActiveRecord(d) && matchesExtRecord(d)) ||
      (state.externalDocuments || []).find(matchesExtRecord) || null;
    const matchedIntDoc = (state.documents || []).find(d => isActiveRecord(d) && matchesIntRecord(d)) ||
      (state.documents || []).find(matchesIntRecord) || null;

    const is_external = taskPayload.is_external !== undefined
      ? Boolean(taskPayload.is_external)
      : Boolean(task.isExternal || (matchedExtDoc && !matchedIntDoc));

    const targetSchedule = (state.periodicReviewSchedules || []).find(s =>
      (scheduleId && s.id === scheduleId) ||
      (doc_id && (s.documentId === doc_id || s.externalDocumentId === doc_id)) ||
      (rawScheduleKey && (s.documentId === rawScheduleKey || s.externalDocumentId === rawScheduleKey || s.documentNumber === rawScheduleKey))
    );

    const docDept = task.department || task.target_department || targetSchedule?.ownerDepartmentId || matchedExtDoc?.department || matchedIntDoc?.department || 'DC';

    // RBAC Check for External Documents: Only Level 4+ in the same department (or QMR/Admin) can approve
    if (is_external && !canFastTrackExternalReview(approver, docDept)) {
      console.warn(`[RBAC] User ${approver?.name} is not authorized to approve periodic review for external doc ${doc_code || doc_id} in dept ${docDept}`);
      if (typeof toast !== 'undefined' && toast.error) {
        toast.error('ไม่มีสิทธิ์อนุมัติ: ต้องเป็นระดับหัวหน้างาน (Level 4 ขึ้นไป) ในแผนก หรือ QMR/DCC Admin');
      }
      return state;
    }

    const now = (state.simulatedSystemDate ? new Date(state.simulatedSystemDate) : new Date()).toISOString().split('T')[0];
    const extCycleYears = matchedExtDoc?.reviewCycleMonths ? Number(matchedExtDoc.reviewCycleMonths) / 12 : null;
    const cycleYears = targetSchedule?.cycleYears ||
      (targetSchedule?.frequencyMonths ? targetSchedule.frequencyMonths / 12 : null) ||
      (is_external ? (extCycleYears || 1) : (targetSchedule?.documentNumber ? getReviewCycleYears(targetSchedule.documentNumber) : (doc_code ? getReviewCycleYears(doc_code) : 1)));
    const nextDate = addYears(now, cycleYears || 1);

    const periodicReviewAuditEntry = {
      id: `REV-HIST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      round: 1,
      review_round: 1,
      reviewed_at: submitted_at ? submitted_at.split('T')[0] : now,
      reviewed_date: submitted_at ? submitted_at.split('T')[0] : now,
      result: 'NO_CHANGE',
      outcome: 'NO_CHANGE',
      reason: details?.reason || details?.remarks || details?.comment || remarks || '-',
      findings: details?.findings || '-',
      standard_clause: details?.standard_clause || details?.standards || details?.check_source || '-',
      check_source: details?.standard_clause || details?.standards || details?.check_source || '-',
      evidence_reference: details?.evidence_reference || details?.references || '-',
      additional_comment: details?.additional_comment || details?.additionalComments || '-',
      remarks: details?.remarks || details?.reason || details?.comment || remarks || '-',
      next_review_due: nextDate,

      // ผู้ทบทวน (Reviewer)
      reviewer_id: reviewer_id || null,
      reviewer_name: reviewer_name || 'Staff',
      reviewer_role: reviewer_role || 'Staff',

      // ผู้อนุมัติ (Approver - 1 Level)
      approver_id: approver?.id || null,
      approver_name: approver?.name || 'HOD',
      approver_role: approver?.role || 'HOD',
      approved_at: new Date().toISOString(),
      approval_status: 'APPROVED',
      approval_remarks: remarks || details?.approval_remarks || '-'
    };

    let updatedDocs = state.documents;
    let updatedExtDocs = state.externalDocuments;

    if (!is_external && state.documents) {
      let docIdx = state.documents.findIndex(d => isActiveRecord(d) && matchesIntRecord(d));
      if (docIdx === -1) docIdx = state.documents.findIndex(matchesIntRecord);
      if (docIdx !== -1) {
        const doc = { ...state.documents[docIdx] };
        periodicReviewAuditEntry.round = (doc.periodic_reviews?.length || 0) + 1;
        periodicReviewAuditEntry.review_round = (doc.periodic_reviews?.length || 0) + 1;
        doc.last_reviewed_at = now;
        doc.next_review_date = nextDate;
        doc.review_status = 'UP_TO_DATE';
        doc.is_reviewed_this_cycle = true;
        delete doc.pending_periodic_review;
        delete doc.pending_review_task_id;
        doc.periodic_reviews = [...(doc.periodic_reviews || []), periodicReviewAuditEntry];
        doc.review_history = [...(doc.review_history || []), {
          id: `PRH-${Date.now()}`,
          reviewer: reviewer_name,
          reviewerId: reviewer_id,
          reviewerRole: reviewer_role,
          approver: approver?.name,
          approverRole: approver?.role,
          reviewDate: now,
          comment: details?.comment || remarks || '',
          outcome: 'NO_CHANGE',
          nextReviewDate: nextDate
        }];
        updatedDocs = [...state.documents];
        updatedDocs[docIdx] = doc;
      }
    } else if (is_external && state.externalDocuments) {
      let docIdx = state.externalDocuments.findIndex(d => isActiveRecord(d) && matchesExtRecord(d));
      if (docIdx === -1) docIdx = state.externalDocuments.findIndex(matchesExtRecord);
      if (docIdx !== -1) {
        const doc = { ...state.externalDocuments[docIdx] };
        periodicReviewAuditEntry.round = (doc.periodic_reviews?.length || 0) + 1;
        periodicReviewAuditEntry.review_round = (doc.periodic_reviews?.length || 0) + 1;
        doc.last_reviewed_at = now;
        doc.lastReviewedDate = now;
        doc.last_verified_at = now;
        doc.nextReviewDate = nextDate;
        doc.next_review_date = nextDate;
        doc.review_status = 'COMPLETED';
        doc.is_reviewed_this_cycle = true;
        doc.pending_periodic_review = false;
        delete doc.pending_review_task_id;
        doc.periodic_reviews = [...(doc.periodic_reviews || []), periodicReviewAuditEntry];
        doc.review_history = [...(doc.review_history || []), {
          id: `PRH-${Date.now()}`,
          reviewer: reviewer_name,
          reviewerId: reviewer_id,
          reviewerRole: reviewer_role,
          approver: approver?.name,
          approverRole: approver?.role,
          reviewDate: now,
          comment: details?.comment || remarks || '',
          outcome: 'NO_CHANGE',
          nextReviewDate: nextDate
        }];
        updatedExtDocs = [...state.externalDocuments];
        updatedExtDocs[docIdx] = doc;
      }
    }

    let foundScheduleInList = false;
    const schedules = (state.periodicReviewSchedules || []).map(s => {
      if (
        (scheduleId && s.id === scheduleId) ||
        (doc_id && (s.documentId === doc_id || s.externalDocumentId === doc_id)) ||
        (rawScheduleKey && (s.documentId === rawScheduleKey || s.externalDocumentId === rawScheduleKey || s.documentNumber === rawScheduleKey))
      ) {
        foundScheduleInList = true;
        return {
          ...s,
          status: is_external ? 'COMPLETED' : 'UPCOMING',
          dueState: 'NOT_YET_DUE',
          outcome: 'NO_CHANGE',
          lastReviewedDate: now,
          last_reviewed_at: now,
          nextReviewDate: nextDate,
          currentScheduledReviewDate: nextDate,
          is_reviewed_this_cycle: true,
          pendingApprovalTaskId: null,
          pendingReview: null,
          updatedAt: new Date().toISOString()
        };
      }
      return s;
    });

    if (!foundScheduleInList && (matchedExtDoc || matchedIntDoc)) {
      const refDoc = (is_external ? matchedExtDoc : matchedIntDoc) || matchedExtDoc || matchedIntDoc;
      const docNum = is_external
        ? (refDoc.edCode || refDoc.doc_code || refDoc.code || refDoc.id)
        : (refDoc.doc_code || refDoc.code || refDoc.title || refDoc.id);
      schedules.push({
        id: scheduleId || `PRS-AUTO-${refDoc.id || docNum}`,
        documentCategory: is_external ? 'EXTERNAL' : 'INTERNAL',
        isExternal: is_external,
        documentId: refDoc.id,
        externalDocumentId: is_external ? refDoc.id : null,
        documentNumber: docNum,
        title: refDoc.name || refDoc.title || docNum,
        department: refDoc.department || 'General',
        edition: refDoc.sourceVersion || refDoc.edition || '',
        sourceVersion: refDoc.sourceVersion || refDoc.edition || '',
        rev: is_external
          ? String(refDoc.sourceVersion || refDoc.edition || '1.0').replace(/^(Rev\.?\s*)+/i, '').trim()
          : String(refDoc.rev || refDoc.version || '00').replace(/^(Rev\.?\s*)+/i, '').trim(),
        effectiveDate: refDoc.effectiveDate || refDoc.effective_date || refDoc.issueDate || now,
        lastReviewedDate: now,
        last_reviewed_at: now,
        nextReviewDate: nextDate,
        currentScheduledReviewDate: nextDate,
        cycleYears: cycleYears || 1,
        frequencyMonths: (cycleYears || 1) * 12,
        status: is_external ? 'COMPLETED' : 'UPCOMING',
        dueState: 'NOT_YET_DUE',
        outcome: 'NO_CHANGE',
        is_reviewed_this_cycle: true,
        pendingApprovalTaskId: null,
        pendingReview: null,
        updatedAt: new Date().toISOString()
      });
    }

    const updatedTasks = (state.tasks || []).map(t => {
      const isTargetApprovalTask = t.id === taskId;
      const isRelatedReviewTask = (
        t.type === 'PERIODIC_REVIEW' || 
        t.taskType === 'PERIODIC_REVIEW' ||
        t.type === 'EXTERNAL_VERIFICATION' ||
        t.taskType === 'EXTERNAL_VERIFICATION' ||
        t.type === 'PERIODIC_REVIEW_APPROVAL' ||
        t.taskType === 'PERIODIC_REVIEW_APPROVAL'
      ) && (
        (scheduleId && t.scheduleId === scheduleId) ||
        (doc_id && (t.docId === doc_id || t.documentId === doc_id || t.doc_id === doc_id)) ||
        (doc_code && (t.docCode === doc_code || t.documentNumber === doc_code || t.document_code === doc_code || t.doc_code === doc_code))
      );

      if (isTargetApprovalTask || isRelatedReviewTask) {
        return { 
          ...t, 
          status: 'COMPLETED', 
          is_completed: true, 
          actionRequired: false, 
          completed_at: new Date().toISOString(),
          approvedBy: approver?.name, 
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
      return t;
    });

    const updatedPeriodicReviewTasks = (state.periodicReviewTasks || []).map(t => {
      const isTargetApprovalTask = t.id === taskId;
      const isRelatedReviewTask = (
        (scheduleId && t.scheduleId === scheduleId) ||
        (doc_id && (t.docId === doc_id || t.documentId === doc_id || t.doc_id === doc_id)) ||
        (doc_code && (t.docCode === doc_code || t.documentNumber === doc_code || t.document_code === doc_code || t.doc_code === doc_code))
      );
      if (isTargetApprovalTask || isRelatedReviewTask) {
        return { 
          ...t, 
          status: 'COMPLETED', 
          is_completed: true, 
          actionRequired: false, 
          completed_at: new Date().toISOString(),
          updatedAt: new Date().toISOString() 
        };
      }
      return t;
    });

    const records = [...(state.periodicReviewRecords || []), {
      id: `PRR-${Date.now()}`,
      scheduleId,
      outcome: 'NO_CHANGE',
      comment: details?.comment || remarks || '',
      reviewedByUserId: reviewer_id,
      approvedByUserId: approver?.id,
      reviewedAt: submitted_at || new Date().toISOString(),
      approvedAt: new Date().toISOString()
    }];

    return {
      documents: updatedDocs,
      externalDocuments: (updatedExtDocs || []).map(d => sanitizeExternalDocReviewStatus(d, now)),
      periodicReviewSchedules: schedules,
      periodicReviewTasks: updatedPeriodicReviewTasks,
      tasks: updatedTasks,
      periodicReviewRecords: records,
      actionLog: [{
        id: `LOG-${Date.now()}`,
        actionType: 'PERIODIC_REVIEW_APPROVED',
        details: `${is_external ? 'Approved' : 'HOD Approved'} periodic review for ${task.document_code || doc_code || scheduleId}: Next review ${nextDate}`,
        actor: approver?.name,
        actorId: approver?.id,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  approveExternalPeriodicReview: (docId, approverUser, remarks) => {
    let targetDocId = docId;
    let approver = approverUser;
    let note = remarks || '';
    if (typeof docId === 'object' && docId !== null) {
      targetDocId = docId.docId || docId.id || docId.documentId || docId.taskId;
      approver = docId.approverUser || docId.approver || approverUser;
      note = docId.remarks || docId.comment || remarks || '';
    }

    const state = get();
    const activeApprover = approver || state.currentUser;
    const docIdx = (state.externalDocuments || []).findIndex(d => 
      String(d.id) === String(targetDocId) ||
      d.edCode === targetDocId ||
      d.doc_code === targetDocId ||
      d.code === targetDocId
    );

    if (docIdx === -1) {
      console.warn(`[approveExternalPeriodicReview] Document not found: ${targetDocId}`);
      return { success: false, error: 'DOC_NOT_FOUND' };
    }

    const doc = state.externalDocuments[docIdx];
    const docDept = doc.department || doc.dept || 'DC';

    // RBAC Check: Only Level 4+ in the same department (or QMR/Admin) can approve
    if (!canFastTrackExternalReview(activeApprover, docDept)) {
      console.warn(`[RBAC] User ${activeApprover?.name} is not authorized to approve periodic review for external doc ${doc.edCode || doc.id} in dept ${docDept}`);
      if (typeof toast !== 'undefined' && toast.error) {
        toast.error('ไม่มีสิทธิ์อนุมัติ: ต้องเป็นระดับหัวหน้างาน (Level 4 ขึ้นไป) ในแผนก หรือ QMR/DCC Admin');
      }
      return { success: false, error: 'UNAUTHORIZED' };
    }

    // 1. If an existing approval task exists for this document, delegate to approvePeriodicReview
    const matchingTask = (state.tasks || []).find(t => 
      !['COMPLETED', 'CANCELLED'].includes(t.status) &&
      (t.type === 'PERIODIC_REVIEW_APPROVAL' || t.taskType === 'PERIODIC_REVIEW_APPROVAL') &&
      (
        (t.docId && String(t.docId) === String(targetDocId)) ||
        (t.documentId && String(t.documentId) === String(targetDocId)) ||
        (t.payload?.doc_id && String(t.payload.doc_id) === String(targetDocId)) ||
        (t.payload?.doc_code && String(t.payload.doc_code) === String(targetDocId)) ||
        (t.document_code && String(t.document_code) === String(targetDocId)) ||
        (t.id && String(t.id) === String(targetDocId))
      )
    );

    if (matchingTask) {
      get().approvePeriodicReview(matchingTask.id, activeApprover, note);
      const updatedDoc = (get().externalDocuments || []).find(d => String(d.id) === String(targetDocId) || d.edCode === targetDocId);
      return { success: true, doc: updatedDoc, nextReviewDate: updatedDoc?.nextReviewDate };
    }

    // 2. Direct approval flow if called directly on document
    let result = null;
    set(currState => {
      const doc = { ...currState.externalDocuments[docIdx] };

      const now = (currState.simulatedSystemDate ? new Date(currState.simulatedSystemDate) : new Date()).toISOString().split('T')[0];
      const extCycleMonths = Number(doc.reviewCycleMonths || doc.frequencyMonths || (doc.verification_frequency ? Number(doc.verification_frequency) * 12 : 12)) || 12;
      const nextDate = addYears(now, extCycleMonths / 12 || 1);

      const pendingInfo = doc.pending_periodic_review && typeof doc.pending_periodic_review === 'object' ? doc.pending_periodic_review : (doc.pending_review_details || {});
      const reviewerName = pendingInfo.reviewer_name || doc.reviewerName || 'Staff';
      const reviewerId = pendingInfo.reviewer_id || doc.reviewerId || null;
      const reviewerRole = pendingInfo.reviewer_role || 'Staff';
      const reasonComment = note || pendingInfo.details?.comment || pendingInfo.details?.reason || pendingInfo.details?.remarks || '-';

      const periodicReviewAuditEntry = {
        id: `REV-HIST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        round: (doc.periodic_reviews?.length || 0) + 1,
        review_round: (doc.periodic_reviews?.length || 0) + 1,
        reviewed_at: pendingInfo.submitted_at || new Date().toISOString(),
        reviewed_date: pendingInfo.submitted_at ? pendingInfo.submitted_at.split('T')[0] : now,
        result: 'NO_CHANGE',
        outcome: 'NO_CHANGE',
        reason: reasonComment,
        findings: pendingInfo.details?.findings || '-',
        standard_clause: pendingInfo.details?.standard_clause || pendingInfo.details?.standards || pendingInfo.details?.check_source || '-',
        check_source: pendingInfo.details?.standard_clause || pendingInfo.details?.standards || pendingInfo.details?.check_source || '-',
        evidence_reference: pendingInfo.details?.evidence_reference || pendingInfo.details?.references || '-',
        additional_comment: pendingInfo.details?.additional_comment || pendingInfo.details?.additionalComments || '-',
        remarks: reasonComment,
        next_review_due: nextDate,

        reviewer_id: reviewerId,
        reviewer_name: reviewerName,
        reviewer_role: reviewerRole,

        approver_id: activeApprover?.id || null,
        approver_name: activeApprover?.name || 'Approver',
        approver_role: activeApprover?.role || 'Supervisor',
        approved_at: new Date().toISOString(),
        approval_status: 'APPROVED',
        approval_remarks: note || '-'
      };

      const historyEntry = {
        id: `PRR-${Date.now()}`,
        reviewer: reviewerName,
        reviewerId: reviewerId,
        reviewerRole: reviewerRole,
        approver: activeApprover?.name || '-',
        approverRole: activeApprover?.role || 'Supervisor',
        reviewDate: now,
        comment: reasonComment,
        reason: reasonComment,
        findings: pendingInfo.details?.findings || '',
        outcome: 'NO_CHANGE',
        nextReviewDate: nextDate
      };

      doc.last_reviewed_at = now;
      doc.lastReviewedDate = now;
      doc.last_verified_at = now;
      doc.nextReviewDate = nextDate;
      doc.next_review_date = nextDate;
      doc.review_status = 'COMPLETED';
      doc.is_reviewed_this_cycle = true;
      doc.pending_periodic_review = false;
      delete doc.pending_review_task_id;
      delete doc.pending_review_details;
      doc.periodic_reviews = [...(doc.periodic_reviews || []), periodicReviewAuditEntry];
      doc.review_history = [...(doc.review_history || []), historyEntry];

      const updatedExtDocs = [...currState.externalDocuments];
      updatedExtDocs[docIdx] = doc;

      const rawDocId = String(doc.id);
      const rawEdCode = doc.edCode;

      const updatedSchedules = (currState.periodicReviewSchedules || []).map(s => {
        const matches = s.externalDocumentId === rawDocId ||
          s.documentId === rawDocId ||
          (rawEdCode && s.documentNumber === rawEdCode) ||
          s.id === `PRS-AUTO-${rawDocId}` ||
          s.id === `PRS-EXT-${rawDocId}`;
        if (matches) {
          return {
            ...s,
            status: 'COMPLETED',
            dueState: 'NOT_YET_DUE',
            outcome: 'NO_CHANGE',
            lastReviewedDate: now,
            last_reviewed_at: now,
            nextReviewDate: nextDate,
            currentScheduledReviewDate: nextDate,
            is_reviewed_this_cycle: true,
            pendingApprovalTaskId: null,
            pendingReview: null,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      });

      const updatedTasks = (currState.tasks || []).map(t => {
        const matches = (
          (t.docId && String(t.docId) === rawDocId) ||
          (t.documentId && String(t.documentId) === rawDocId) ||
          (rawEdCode && (t.document_code === rawEdCode || t.docCode === rawEdCode || t.doc_code === rawEdCode)) ||
          (t.payload && (String(t.payload.doc_id) === rawDocId || t.payload.doc_code === rawEdCode))
        ) && (
          t.type === 'PERIODIC_REVIEW_APPROVAL' ||
          t.taskType === 'PERIODIC_REVIEW_APPROVAL' ||
          t.type === 'PERIODIC_REVIEW' ||
          t.type === 'EXTERNAL_VERIFICATION'
        );
        if (matches) {
          return {
            ...t,
            status: 'COMPLETED',
            is_completed: true,
            actionRequired: false,
            completed_at: new Date().toISOString(),
            approvedBy: activeApprover?.name,
            approvedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      });

      const updatedPeriodicReviewTasks = (currState.periodicReviewTasks || []).map(t => {
        const matches = (
          (t.docId && String(t.docId) === rawDocId) ||
          (rawEdCode && (t.document_code === rawEdCode || t.docCode === rawEdCode || t.doc_code === rawEdCode))
        );
        if (matches) {
          return {
            ...t,
            status: 'COMPLETED',
            is_completed: true,
            actionRequired: false,
            completed_at: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      });

      result = { success: true, doc, nextReviewDate: nextDate };

      return {
        externalDocuments: updatedExtDocs.map(d => sanitizeExternalDocReviewStatus(d, now)),
        periodicReviewSchedules: updatedSchedules,
        tasks: updatedTasks,
        periodicReviewTasks: updatedPeriodicReviewTasks,
        actionLog: [{
          id: `LOG-${Date.now()}`,
          actionType: 'EXTERNAL_PERIODIC_REVIEW_APPROVED',
          details: `Approved periodic review for external document ${rawEdCode || rawDocId}: Next review ${nextDate}`,
          actor: activeApprover?.name,
          actorId: activeApprover?.id,
          date: new Date().toISOString()
        }, ...(currState.actionLog || [])]
      };
    });

    return result;
  },

  approvePeriodicReviewTask: (arg1, arg2, arg3) => {
    return get().approvePeriodicReview(arg1, arg2, arg3);
  },

  rejectPeriodicReview: (arg1, arg2, arg3) => set(state => {
    const params = (typeof arg1 === 'object' && arg1 !== null)
      ? arg1
      : { taskId: arg1, approverUser: arg2, remarks: arg3 };
    const { taskId, approverUser, remarks } = params;

    const task = (state.tasks || []).find(t => t.id === taskId) ||
      (state.periodicReviewTasks || []).find(t => t.id === taskId);
    if (!task) return state;

    const approver = approverUser || state.currentUser;
    const { scheduleId, doc_id } = task.payload || {};
    const doc_code = task.payload?.doc_code || task.docCode || task.document_code || null;
    const rawScheduleKey = scheduleId ? String(scheduleId).replace(/^PRS-AUTO-/, '') : null;
    const isActiveRecord = (d) => d && !d.is_superseded && !d.is_obsolete && d.status !== 'SUPERSEDED' && d.status !== 'OBSOLETE' && d.status !== 'OBSOLETE_ARCHIVED';

    let updatedDocs = state.documents;
    let updatedExtDocs = state.externalDocuments;

    if (!task.payload?.is_external && state.documents) {
      const matchInt = (d) =>
        (doc_id && String(d.id) === String(doc_id)) ||
        (rawScheduleKey && (String(d.id) === rawScheduleKey || d.doc_code === rawScheduleKey || d.code === rawScheduleKey)) ||
        (doc_code && (d.code === doc_code || d.doc_code === doc_code || d.title === doc_code));
      let docIdx = state.documents.findIndex(d => isActiveRecord(d) && matchInt(d));
      if (docIdx === -1) docIdx = state.documents.findIndex(matchInt);
      if (docIdx !== -1) {
        const doc = { ...state.documents[docIdx] };
        doc.review_status = 'ACTION_REQUIRED';
        delete doc.pending_periodic_review;
        delete doc.pending_review_task_id;
        doc.rejection_remarks = remarks;
        updatedDocs = [...state.documents];
        updatedDocs[docIdx] = doc;
      }
    } else if (task.payload?.is_external && state.externalDocuments) {
      const matchExt = (d) =>
        (doc_id && String(d.id) === String(doc_id)) ||
        (rawScheduleKey && (String(d.id) === rawScheduleKey || d.edCode === rawScheduleKey || d.doc_code === rawScheduleKey || d.code === rawScheduleKey)) ||
        (doc_code && (String(d.id) === String(doc_code) || d.edCode === doc_code || d.doc_code === doc_code || d.code === doc_code));
      let docIdx = state.externalDocuments.findIndex(d => isActiveRecord(d) && matchExt(d));
      if (docIdx === -1) docIdx = state.externalDocuments.findIndex(matchExt);
      if (docIdx !== -1) {
        const doc = { ...state.externalDocuments[docIdx] };
        doc.review_status = 'ACTION_REQUIRED';
        doc.pending_periodic_review = false;
        delete doc.pending_review_task_id;
        doc.rejection_remarks = remarks;
        updatedExtDocs = [...state.externalDocuments];
        updatedExtDocs[docIdx] = doc;
      }
    }

    const schedules = (state.periodicReviewSchedules || []).map(s => {
      if (
        (scheduleId && s.id === scheduleId) ||
        (doc_id && (s.documentId === doc_id || s.externalDocumentId === doc_id)) ||
        (rawScheduleKey && (s.documentId === rawScheduleKey || s.externalDocumentId === rawScheduleKey || s.documentNumber === rawScheduleKey))
      ) {
        return {
          ...s,
          status: 'ACTION_REQUIRED',
          dueState: 'DUE',
          pendingApprovalTaskId: null,
          rejectionRemarks: remarks,
          updatedAt: new Date().toISOString()
        };
      }
      return s;
    });

    const updatedTasks = (state.tasks || []).map(t => {
      if (t.id === taskId) {
        return { 
          ...t, 
          status: 'REJECTED', 
          rejectReason: remarks, 
          returnReason: remarks, 
          updatedAt: new Date().toISOString() 
        };
      }
      return t;
    });

    // 🛡️ Create Notification for Reviewer
    const newNotifications = [...(state.notifications || [])];
    const reviewerId = task.payload?.reviewer_id;
    if (reviewerId) {
      newNotifications.unshift({
        id: `notif-rev-reject-${Date.now()}`,
        userId: reviewerId,
        user_id: reviewerId,
        title: `ผลการทบทวนเอกสาร ${task.document_code || task.payload?.doc_code || ''} ถูกตีกลับแก้ไข`,
        message: `หัวหน้าแผนก (${approver?.name || 'HOD'}) ตีกลับผลการทบทวน: ${remarks || '-'}`,
        isRead: false,
        read: false,
        type: 'PERIODIC_REVIEW_REJECTED',
        createdAt: new Date().toISOString()
      });
    }

    return {
      documents: updatedDocs,
      externalDocuments: updatedExtDocs,
      periodicReviewSchedules: schedules,
      tasks: updatedTasks,
      notifications: newNotifications,
      actionLog: [{
        id: `LOG-${Date.now()}`,
        actionType: 'PERIODIC_REVIEW_REJECTED',
        details: `Periodic review rejected for ${task.document_code || doc_code || scheduleId}. Reason: ${remarks}`,
        actor: approver?.name,
        actorId: approver?.id,
        date: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  rejectPeriodicReviewTask: (arg1, arg2, arg3) => {
    return get().rejectPeriodicReview(arg1, arg2, arg3);
  },

  verifyExternalDocument: ({ scheduleId, docId, verificationChannel, verificationResult, comment, reviewer, verificationDate }) => {
    const state = get();
    const now = verificationDate || new Date().toISOString().split('T')[0];
    
    // Mandatory validation (Criterion 3)
    if (!verificationChannel || !verificationResult) {
      throw new Error('กรุณาระบุช่องทางการตรวจสอบและผลการตรวจสอบ');
    }

    if (verificationResult === 'CURRENT_VALID' || verificationResult === 'NO_CHANGE' || verificationResult === 'CONFIRM_CONTINUE') {
      return state.recordPeriodicReview({
        scheduleId,
        outcome: 'CONFIRM_CONTINUE',
        comment,
        reviewer,
        reviewDate: now,
        verificationChannel
      });
    }

    if (verificationResult === 'NEW_VERSION_FOUND' || verificationResult === 'SUPERSEDED') {
      const schedules = [...(state.periodicReviewSchedules || [])];
      const schIdx = schedules.findIndex(s => s.id === scheduleId || s.externalDocumentId === docId);
      let targetSchedule = schIdx !== -1 ? { ...schedules[schIdx] } : null;

      let updatedExtDocs = [...(state.externalDocuments || [])];
      const docIdx = updatedExtDocs.findIndex(d => d.id === docId || (targetSchedule && d.id === targetSchedule.externalDocumentId));
      let supersededDoc = null;

      if (docIdx !== -1) {
        supersededDoc = {
          ...updatedExtDocs[docIdx],
          status: 'SUPERSEDED',
          is_superseded: true,
          superseded_date: now,
          superseded_reason: `ตรวจพบฉบับใหม่จากแหล่งอ้างอิง (${verificationChannel}): ${comment || ''}`,
          review_history: [
            ...(updatedExtDocs[docIdx].review_history || []),
            {
              id: `EXT-VER-${Date.now()}`,
              reviewer: reviewer || state.currentUser?.name || '-',
              date: now,
              channel: verificationChannel,
              result: 'NEW_VERSION_FOUND',
              comment: comment || ''
            }
          ],
          updated_at: new Date().toISOString()
        };
        updatedExtDocs[docIdx] = supersededDoc;
      }

      if (targetSchedule) {
        targetSchedule.status = 'CANCELLED_BY_DOCUMENT_STATUS';
        targetSchedule.isActive = false;
        targetSchedule.updatedAt = new Date().toISOString();
        schedules[schIdx] = targetSchedule;
      }

      const updatedTasks = (state.tasks || []).map(t => {
        if (t.scheduleId === scheduleId || (t.docId && (t.docId === docId || t.docId === targetSchedule?.externalDocumentId))) {
          return { ...t, status: 'COMPLETED', is_completed: true, actionRequired: false, updatedAt: new Date().toISOString() };
        }
        return t;
      });

      const updatedPeriodicReviewTasks = (state.periodicReviewTasks || []).map(t => {
        if (t.scheduleId === scheduleId || (t.docId && (t.docId === docId || t.docId === targetSchedule?.externalDocumentId))) {
          return { ...t, status: 'COMPLETED', is_completed: true, actionRequired: false, updatedAt: new Date().toISOString() };
        }
        return t;
      });

      set({
        externalDocuments: updatedExtDocs,
        periodicReviewSchedules: schedules,
        periodicReviewTasks: updatedPeriodicReviewTasks,
        tasks: updatedTasks,
        actionLog: [{
          id: `LOG-${Date.now()}`,
          actionType: 'EXTERNAL_DOC_SUPERSEDED_BY_VERIFICATION',
          details: `เอกสารภายนอก ${supersededDoc?.edCode || docId} ตกรุ่น (ตรวจพบฉบับใหม่: ${verificationChannel})`,
          actor: state.currentUser?.name,
          actorId: state.currentUser?.id,
          date: new Date().toISOString()
        }, ...(state.actionLog || [])]
      });

      return { success: true, supersededDoc, shouldOpenRegister: true };
    }
  },
});
