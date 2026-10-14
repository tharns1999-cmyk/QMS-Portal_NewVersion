import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { stampExternalDocumentTopRight, applyProgressiveSignatoryStamp, getSystemSampleDocumentBlob } from '../utils/pdfStamper';
import { resolveProgressiveSignatories } from '../utils/signatoryResolver';
import { getFile, saveFile, resolveFileBlob, resolveRawFileBlob } from '../utils/fileStorage';
import { resolveReviewer, resolveApprover } from '../utils/workflowResolver';
import { generateDynamicWorkflow } from '../utils/workflowEngine';
import { addYears, getReviewCycleYears } from '../utils/documentUtils';
import { syncRevisionEffective, syncObsoleteCompleted } from '../services/PeriodicReviewDarLinkService';
import {
  createPeriodicReviewSlice,
  canFastTrackReview,
  canFastTrackExternalReview,
  sanitizeExternalDocReviewStatus
} from './slices/periodicReviewSlice';
export {
  createPeriodicReviewSlice,
  canFastTrackReview,
  canFastTrackExternalReview,
  sanitizeExternalDocReviewStatus
};
import {
  createExternalDocSlice,
  resolveDccAdminUserId,
  generateNextEdrNumber
} from './slices/externalDocSlice';
export {
  createExternalDocSlice,
  resolveDccAdminUserId,
  generateNextEdrNumber
};
import {
  createControlledCopySlice,
  CONTROLLED_COPY_STATUS,
  buildControlledCopyId,
  deduplicateControlledCopies,
  sanitizeControlledCopies,
  resolveReceiptTaskDepartment,
  cleanupDccTasks,
  reconcileAndResolveTasks,
  createReceiptTask,
  getActivePhysicalCopies,
  resolveDarDocumentCode
} from './slices/controlledCopySlice';
export {
  createControlledCopySlice,
  CONTROLLED_COPY_STATUS,
  buildControlledCopyId,
  deduplicateControlledCopies,
  sanitizeControlledCopies,
  resolveReceiptTaskDepartment,
  cleanupDccTasks,
  reconcileAndResolveTasks,
  createReceiptTask,
  getActivePhysicalCopies,
  resolveDarDocumentCode
};
import {
  createDarSlice,
  syncCompletedDarToMasterDocuments,
  generateNextDarNumber
} from './slices/darSlice';
export {
  createDarSlice,
  syncCompletedDarToMasterDocuments,
  generateNextDarNumber
};
import {
  createMasterDocSlice,
  DEFAULT_DOCUMENT_CATEGORIES
} from './slices/masterDocSlice';
export {
  createMasterDocSlice,
  DEFAULT_DOCUMENT_CATEGORIES
};
import { 
  STANDARD_STATIONS, 
  calculateCopyAllocations, 
  cleanLocationName,
  formatDocumentRunningNumber, 
  calculateNextDocumentSequence,
  calculateNextExternalDocSequence,
  checkDocumentCodeCollision
} from '../services/MasterDataService';
import { getMockQaSeedData } from '../data/mockQaWorkflowSeed';
import { 
  MASTER_DATA_USER,
  REQUEST_MASTER_DATA_USER,
  REVIEW_MASTER_DATA_USER,
  APPROVE_MASTER_DATA_USER,
  MOCK_DOC_FORMATS,
  MOCK_DARS,
  MOCK_TASKS,
  MOCK_TIMELINE,
  MOCK_DOCUMENTS,
  MOCK_CONTROLLED_COPY_INSTANCES,
  INITIAL_NOTIFICATIONS,
  defaultSeedDocuments, 
  defaultSeedDars, 
  defaultSeedTasks, 
  defaultSeedCopies, 
  defaultSeedCurrentUser,
  initialUsers,
  initialDocuments,
  initialExternalDocuments,
  initialDarRequests,
  initialTasks,
  initialTimeline,
  initialControlledCopyInstances,
  initialNotifications
} from './fixtures/seedData';
export {
  MASTER_DATA_USER,
  REQUEST_MASTER_DATA_USER,
  REVIEW_MASTER_DATA_USER,
  APPROVE_MASTER_DATA_USER,
  MOCK_DOC_FORMATS,
  MOCK_DARS,
  MOCK_TASKS,
  MOCK_TIMELINE,
  MOCK_DOCUMENTS,
  MOCK_CONTROLLED_COPY_INSTANCES,
  INITIAL_NOTIFICATIONS,
  defaultSeedDocuments, 
  defaultSeedDars, 
  defaultSeedTasks, 
  defaultSeedCopies, 
  defaultSeedCurrentUser,
  initialUsers,
  initialDocuments,
  initialExternalDocuments,
  initialDarRequests,
  initialTasks,
  initialTimeline,
  initialControlledCopyInstances,
  initialNotifications
};
import toast from 'react-hot-toast';
import { IN_FLIGHT_DAR_STATUSES, getActiveDarForDocument } from '../utils/workflowHelpers';
export { IN_FLIGHT_DAR_STATUSES, getActiveDarForDocument };
import { hasDocumentAccess, canUserAccessDocument, canManageControlledCopy } from '../utils/accessControl';
export { canManageControlledCopy } from '../utils/accessControl';
import { calculateTaskDueDate } from '../utils/slaCalculator';
import { generateInternalDarNumber } from '../utils/darNumberGenerator';
import { 
  isSameDepartment, 
  userMatchesDepartment, 
  isDccAdmin, 
  isDccExclusiveTask, 
  isDccOperationalTask,
  getUserLevelNumber,
  isLevel6Plus,
  isLevel1To5,
  isReceiptTask,
  isActionableTask
} from '../utils/taskFilter';

export const getUserDepartments = (user) => {
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

export { 
  canUserAccessDocument, 
  hasDocumentAccess, 
  calculateTaskDueDate, 
  generateInternalDarNumber, 
  isSameDepartment, 
  userMatchesDepartment, 
  isDccAdmin, 
  isDccExclusiveTask, 
  isDccOperationalTask,
  getUserLevelNumber,
  isLevel6Plus,
  isLevel1To5,
  isReceiptTask,
  isActionableTask
};

/**
 * Helper to determine if a notification is visible to the given user.
 * Supports:
 * - Direct target: n.userId === user.id || n.user_id === user.id || n.userId === user.empId
 * - Target array: n.targetUserIds?.includes(user.id || user.empId)
 * - Department: n.targetDepartment or n.department matching any of user's depts
 * - Global broadcast: n.isGlobal || n.global || n.scope === 'GLOBAL'
 * - Default broadcast: no specific target user, department or scope specified
 */
export const isNotificationVisibleToUser = (notification, user) => {
  if (!notification) return false;
  if (!user) return true;

  // 1. Global / Organization-wide announcement
  if (notification.isGlobal || notification.global || notification.scope === 'GLOBAL') {
    return true;
  }

  // 2. Direct user targeting
  const targetId = notification.userId || notification.user_id;
  const userEmpId = user.empId || user.id;
  if (targetId && (targetId === user.id || targetId === userEmpId)) {
    return true;
  }

  // 3. Multi-user targeting
  if (Array.isArray(notification.targetUserIds) && notification.targetUserIds.length > 0) {
    if (notification.targetUserIds.includes(user.id) || (userEmpId && notification.targetUserIds.includes(userEmpId))) {
      return true;
    }
  }

  // 4. Department-level targeting
  const targetDept = notification.targetDepartment || notification.recipientDept || (notification.userId ? null : notification.department);
  if (targetDept) {
    const userDepts = [
      user.department,
      user.dept,
      user.primary_department,
      ...(Array.isArray(user.departments) ? user.departments : []),
      ...(Array.isArray(user.affiliated_departments) ? user.affiliated_departments : []),
      ...(Array.isArray(user.depts) ? user.depts : []),
      ...(Array.isArray(user.secondaryDepartments) ? user.secondaryDepartments : [])
    ].filter(Boolean);

    if (userDepts.some(d => String(d).trim().toLowerCase() === String(targetDept).trim().toLowerCase())) {
      return true;
    }
  }

  // 5. If no target specified at all (neither userId, user_id, targetUserIds, nor targetDept) -> broadcast
  if (!targetId && (!Array.isArray(notification.targetUserIds) || notification.targetUserIds.length === 0) && !targetDept) {
    return true;
  }

  return false;
};

/**
 * Helper to determine if a notification has been read by the given user.
 * Supports:
 * - Read tracking array: n.readBy?.includes(userId)
 * - Legacy / single-user flags: (n.userId === userId || n.user_id === userId) && (n.isRead || n.read)
 */
export const isNotificationReadByUser = (notification, userId) => {
  if (!notification) return true;
  if (!userId) return Boolean(notification.isRead || notification.read);

  // 1. Check per-user read tracking array
  if (Array.isArray(notification.readBy) && notification.readBy.includes(userId)) {
    return true;
  }

  // 2. If notification is specifically for this user and flagged as read
  const targetId = notification.userId || notification.user_id;
  if (targetId && targetId === userId && (notification.isRead || notification.read)) {
    return true;
  }

  // 3. If single-user notification without readBy array, check isRead / read
  if (!notification.isGlobal && !notification.targetDepartment && (!Array.isArray(notification.targetUserIds) || notification.targetUserIds.length <= 1) && (notification.isRead || notification.read)) {
    return true;
  }

  return false;
};


// 2. Master Departments & Constants (Sourced from qmsRegistry - Single Source of Truth)
import {
  MASTER_DEPARTMENTS,
  MASTER_DATA_DEPT,
  SYSTEM_CORE_DEPTS,
  MASTER_DOC_TYPES,
  MASTER_DOCUMENT_TYPES,
  DEFAULT_SIGNATURE_SETTINGS,
  DEFAULT_SLA_SETTINGS,
  DEFAULT_APPROVAL_MATRIX
} from '../config/qmsRegistry';

export {
  MASTER_DEPARTMENTS,
  MASTER_DATA_DEPT,
  SYSTEM_CORE_DEPTS,
  MASTER_DOC_TYPES,
  MASTER_DOCUMENT_TYPES,
  DEFAULT_SIGNATURE_SETTINGS,
  DEFAULT_SLA_SETTINGS,
  DEFAULT_APPROVAL_MATRIX
};


export const calculateSLAStatus = (effectiveDate, currentDate) => {
  if (!effectiveDate) return 'NORMAL';

  const eff = new Date(effectiveDate);
  eff.setHours(0, 0, 0, 0);
  const cur = new Date(currentDate);
  cur.setHours(0, 0, 0, 0);

  const diffTime = eff.getTime() - cur.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'OVERDUE';
  if (diffDays <= 3) return 'DUE_SOON';
  return 'NORMAL';
};

/**
 * Robust Safe Auto-Running EDR Generator (ISO 9001 & Year Sequence Compliance)
 * Calculates maximum sequence for current Christian calendar year (e.g. 2026).
 * Concurrency & Seed Guard: ensures generated key never collides with existing requests.
 */

export const getUserActionableTasks = (tasks = [], user = null, documents = [], referenceDate = new Date()) => {
  if (!user) return [];
  return (tasks || []).filter(t => isActionableTask(t, user, documents, referenceDate));
};

export const getUserTaskBadgeCount = (tasks = [], user = null, documents = [], referenceDate = new Date()) => {
  if (!user) return 0;
  const actionable = getUserActionableTasks(tasks, user, documents, referenceDate);
  return actionable.filter(t => t.actionRequired !== false && !t.is_completed && t.status !== 'COMPLETED').length;
};

export const getInitialStoreState = () => ({
  masterUsers: MASTER_DATA_USER,
  isHydrated: false,
  requestUsers: REQUEST_MASTER_DATA_USER,
  reviewUsers: REVIEW_MASTER_DATA_USER,
  approveUsers: APPROVE_MASTER_DATA_USER,
  masterDepartments: MASTER_DEPARTMENTS,
  departments: MASTER_DEPARTMENTS,
  documentTypes: MASTER_DOCUMENT_TYPES,
  distributionLocations: JSON.parse(JSON.stringify(STANDARD_STATIONS.map(s => ({ ...s, status: s.status || 'ACTIVE' })))),
  signatureSettings: { ...DEFAULT_SIGNATURE_SETTINGS },
  slaSettings: { ...DEFAULT_SLA_SETTINGS },
  approvalMatrix: JSON.parse(JSON.stringify(DEFAULT_APPROVAL_MATRIX)),
  approval_matrix: JSON.parse(JSON.stringify(DEFAULT_APPROVAL_MATRIX)),
  docFormats: MOCK_DOC_FORMATS,
  dars: [],
  darRequests: [],
  tasks: [],
  completedTasks: [],
  timeline: [],
  documents: [],
  masterDocuments: [],
  supersededDocuments: [],
  externalDocuments: [],
  externalRequests: [],
  externalAuditTrail: [],
  notifications: [...INITIAL_NOTIFICATIONS],
  actionLog: [],
  copyRequests: [],
  documentControlledCopies: [],
  controlledCopies: [],
  controlledCopyInstances: [],
  controlledCopyAuditTrail: [],
  copyDispositionRecords: [],
  dispositionHistory: [],
  periodicReviewSchedules: [],
  periodicReviewTasks: [],
  periodicReviewRecords: [],
  distributionLogs: [],
  acknowledgments: [],
  darHistory: [],
  simulatedSystemDate: null,
  mockDateOffset: 0,
  currentUser: { 
    ...MASTER_DATA_USER[0], 
    department: 'DC', 
    depts: ['DC'], 
    primary_department: 'DC', 
    affiliated_departments: ['DC', 'QC', 'MGMT'],
    affiliatedDepartments: ['DC', 'QC', 'MGMT'],
    approval_level: 4 
  },
});

const useStore = create(persist((set, get) => ({
  ...getInitialStoreState(),
  ...createPeriodicReviewSlice(set, get),
  ...createExternalDocSlice(set, get),
  ...createControlledCopySlice(set, get),
    ...createDarSlice(set, get),
    ...createMasterDocSlice(set, get),

  // Centralized System Date Time Travel Simulator
  simulatedSystemDate: null, // null หมายถึงใช้วันที่จริงของเครื่อง

  // Action ปรับเปลี่ยนวันที่จำลอง
  setSimulatedDate: (dateString) => {
    set({ simulatedSystemDate: dateString });
    get().syncPeriodicReviewSchedulesAndTasks?.(dateString ? new Date(dateString) : new Date());
  },

  // Action กระโดดเวลาไปข้างหน้า
  fastForwardSystemDate: (monthsToAdd) => {
    const baseDate = get().simulatedSystemDate 
      ? new Date(get().simulatedSystemDate) 
      : new Date();
    baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
    const dateString = baseDate.toISOString().split('T')[0];
    set({ simulatedSystemDate: dateString });
    get().syncPeriodicReviewSchedulesAndTasks?.(baseDate);
  },

  // Action คืนค่ากลับสู่วันที่จริง
  resetSimulatedDate: () => {
    set({ simulatedSystemDate: null });
    get().syncPeriodicReviewSchedulesAndTasks?.(new Date());
  },

  // Helper ดึงเวลาปัจจุบันที่มีผลบังคับใช้
  getEffectiveToday: () => {
    const sim = get().simulatedSystemDate;
    return sim ? new Date(sim) : new Date();
  },

  // Helper ซิงค์สถานะรอบทบทวนและสร้าง/อัปเดตงานใน Task Inbox ตามเวลาจำลอง

  // EXCLUSIVELY FOR TESTING - Resets store to deterministic initial state
  resetStore: () => set(getInitialStoreState()),

  // DEV TOOL: Manual Mock Data Seeding (Runs strictly when user clicks Manual Seed in Dev Tools)
  manualSeedData: () => {
    set({
      documents: defaultSeedDocuments,
      masterDocuments: defaultSeedDocuments,
      supersededDocuments: defaultSeedDocuments.filter(d => d.status === 'SUPERSEDED' || d.is_superseded),
      dars: defaultSeedDars,
      darRequests: defaultSeedDars,
      tasks: defaultSeedTasks,
      controlledCopies: defaultSeedCopies,
      documentControlledCopies: defaultSeedCopies,
      controlledCopyInstances: defaultSeedCopies
    });
  },

  // Reset & Re-seed store to default mock data (kept for manual trigger & backward compatibility)
  resetToDefaultSeed: () => {
    get().manualSeedData();
  },

  // Alias for manual seed trigger strictly via DevTools
  seedMockData: () => {
    get().manualSeedData();
  },

  // Clear all transaction data back to empty state
  clearAllData: () => {
    set({
      documents: [],
      masterDocuments: [],
      supersededDocuments: [],
      dars: [],
      darRequests: [],
      tasks: [],
      completedTasks: [],
      timeline: [],
      externalDocuments: [],
      externalRequests: [],
      externalAuditTrail: [],
      notifications: [],
      actionLog: [],
      copyRequests: [],
      controlledCopies: [],
      documentControlledCopies: [],
      controlledCopyInstances: [],
      controlledCopyAuditTrail: [],
      copyDispositionRecords: [],
      dispositionHistory: [],
      periodicReviewSchedules: [],
      periodicReviewTasks: [],
      periodicReviewRecords: [],
      distributionLogs: [],
      acknowledgments: [],
      darHistory: [],
      simulatedSystemDate: null
    });
  },

    // Controlled Copy Print State Tracking

  // Auto-running EDR Number Generator

  // DEV TOOL: Factory Reset Transactions to Clean Slate (Preserving Master Data 100%)
  resetTransactionDataToCleanSlate: () => {
    set({
      dars: [],
      darRequests: [],
      tasks: [],
      timeline: [],
      documents: [],
      masterDocuments: [],
      supersededDocuments: [],
      externalDocuments: [],
      externalRequests: [],
      externalAuditTrail: [],
      notifications: [],
      actionLog: [],
      copyRequests: [],
      documentControlledCopies: [],
      controlledCopyInstances: [],
      controlledCopyAuditTrail: [],
      copyDispositionRecords: [],
      dispositionHistory: [],
      periodicReviewSchedules: [],
      periodicReviewTasks: [],
      periodicReviewRecords: [],
      distributionLogs: [],
      acknowledgments: [],
      darHistory: []
    });

    if (typeof window !== 'undefined' && window.localStorage) {
      const storageKey = 'qms-enterprise-storage';
      try {
        const persisted = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (persisted && persisted.state) {
          persisted.state.dars = [];
          persisted.state.darRequests = [];
          persisted.state.tasks = [];
          persisted.state.timeline = [];
          persisted.state.documents = [];
          persisted.state.masterDocuments = [];
          persisted.state.supersededDocuments = [];
          persisted.state.externalDocuments = [];
          persisted.state.externalRequests = [];
          persisted.state.externalAuditTrail = [];
          persisted.state.notifications = [];
          persisted.state.actionLog = [];
          persisted.state.copyRequests = [];
          persisted.state.documentControlledCopies = [];
          persisted.state.controlledCopies = [];
          persisted.state.controlledCopyInstances = [];
          persisted.state.controlledCopyAuditTrail = [];
          persisted.state.copyDispositionRecords = [];
          persisted.state.dispositionHistory = [];
          persisted.state.periodicReviewSchedules = [];
          persisted.state.periodicReviewTasks = [];
          persisted.state.periodicReviewRecords = [];
          persisted.state.distributionLogs = [];
          persisted.state.acknowledgments = [];
          persisted.state.darHistory = [];
          localStorage.setItem(storageKey, JSON.stringify(persisted));
        }
      } catch (err) {
        console.error('Failed to reset persisted storage:', err);
      }
    }
  },



  seedComprehensiveQaMockData: () => {
    const seed = getMockQaSeedData();
    set(state => ({
      ...state,
      ...seed
    }));

    if (typeof window !== 'undefined' && window.localStorage) {
      const storageKey = 'qms-enterprise-storage';
      try {
        const persisted = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (persisted && persisted.state) {
          Object.assign(persisted.state, seed);
          localStorage.setItem(storageKey, JSON.stringify(persisted));
        }
      } catch (err) {
        console.error('Failed to persist seeded mock data:', err);
      }
    }
  },

  // Seed historical superseded snapshots (WI-QC-01 Rev.00 & Rev.01) if overwritten or absent
    setMockDateOffset: (days) => set({ mockDateOffset: days }),


      
  // Document Access Verification Engine (Auto-whitelisting for Workflow Participants & Admins)
    // ------------------------------------------------------------------

  // Default user is DCC Admin
  currentUser: { 
    ...MASTER_DATA_USER[0], 
    department: 'DC', 
    departments: ['DC'],
    secondaryDepartments: [],
    depts: ['DC'],
    primary_department: 'DC',
    affiliated_departments: ['DC']
  },

  setCurrentUser: (userId) => set((state) => {
    const targetId = typeof userId === 'object' && userId !== null ? (userId.id || userId.empId) : userId;
    const baseUser = state.masterUsers.find(u => u.id === targetId || u.empId === targetId) || (typeof userId === 'object' && userId !== null ? userId : null);
    if (!baseUser) return state;

    // Find departments from any of the lists
    const req = state.requestUsers.find(u => u.id === targetId || u.empId === targetId);
    const rev = state.reviewUsers.find(u => u.id === targetId || u.empId === targetId);
    const app = state.approveUsers.find(u => u.id === targetId || u.empId === targetId);
    let depts = baseUser.depts || req?.depts || rev?.depts || app?.depts || (baseUser.department ? [baseUser.department] : ['DC']);

    // The primary active department
    let userDeptsList = Array.isArray(baseUser.departments) ? baseUser.departments : (Array.isArray(depts) ? depts : [baseUser.department].filter(Boolean));
    let activeDept = baseUser.primary_department || baseUser.department || userDeptsList[0] || 'DC';
    if (activeDept === 'QA/QC' || activeDept === 'QA') activeDept = 'QC';

    userDeptsList = userDeptsList.map(d => (d === 'QA/QC' || d === 'QA') ? 'QC' : d);
    depts = depts.map(d => (d === 'QA/QC' || d === 'QA') ? 'QC' : d);

    const rawSecondary = baseUser.secondaryDepartments || (Array.isArray(baseUser.affiliated_departments) ? baseUser.affiliated_departments.filter(d => d !== activeDept) : userDeptsList.filter(d => d !== activeDept));
    const secondaryDepts = rawSecondary.map(d => (d === 'QA/QC' || d === 'QA') ? 'QC' : d).filter(d => d !== activeDept);
    const affiliated = Array.from(new Set([activeDept, ...secondaryDepts, ...userDeptsList])).map(d => (d === 'QA/QC' || d === 'QA') ? 'QC' : d);

    const permissions = (baseUser.permissions && baseUser.permissions.length > 0)
      ? baseUser.permissions
      : ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'];

    return { 
      currentUser: { 
        ...baseUser, 
        department: activeDept, 
        primary_department: activeDept, 
        primaryDepartment: activeDept,
        departments: Array.from(new Set(userDeptsList)),
        departmentMemberships: Array.from(new Set(userDeptsList)),
        secondaryDepartments: Array.from(new Set(secondaryDepts)),
        affiliated_departments: affiliated,
        depts: Array.from(new Set(depts)),
        permissions,
        canCreateDar: baseUser.canCreateDar !== undefined ? Boolean(baseUser.canCreateDar) : true,
        canAccessTasks: baseUser.canAccessTasks !== undefined ? Boolean(baseUser.canAccessTasks) : true,
        canViewRegister: baseUser.canViewRegister !== undefined ? Boolean(baseUser.canViewRegister) : true,
        isWorkflowUser: baseUser.isWorkflowUser !== undefined ? Boolean(baseUser.isWorkflowUser) : true
      }
    };
  }),

  switchUser: (userId) => {
    get().setCurrentUser(userId);
  },

  // Session Selectors
  getCurrentUser: () => get().currentUser,
  selectCurrentUser: (state) => state.currentUser,

  logAction: (logEntry, maybeDetails) => set((state) => {
    let actionType = 'ACTIVITY';
    let details = '-';
    let actor = state.currentUser?.name || 'System';
    let actorId = state.currentUser?.id || 'SYSTEM';
    let actorRole = state.currentUser?.role || state.currentUser?.position || 'User';
    let category = 'SYSTEM';
    let timestamp = new Date().toISOString();

    if (typeof logEntry === 'string') {
      actionType = logEntry;
      details = maybeDetails !== undefined ? maybeDetails : '-';
    } else if (typeof logEntry === 'object' && logEntry !== null) {
      actionType = logEntry.actionType || logEntry.action || logEntry.action_type || 'ACTIVITY';
      details = logEntry.details || logEntry.detail || logEntry.remarks || logEntry.remark || logEntry.comment || '-';
      actor = logEntry.actor || logEntry.user || logEntry.actorName || logEntry.userName || state.currentUser?.name || 'System';
      actorId = logEntry.actorId || logEntry.userId || logEntry.user_id || state.currentUser?.id || 'SYSTEM';
      actorRole = logEntry.actorRole || logEntry.role || logEntry.user_role || state.currentUser?.role || 'User';
      category = logEntry.category || 'SYSTEM';
      timestamp = logEntry.timestamp || logEntry.created_at || logEntry.createdAt || logEntry.date || logEntry.time || new Date().toISOString();
    }

    const newLog = {
      id: (typeof logEntry === 'object' && logEntry?.id) ? logEntry.id : `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      actionType,
      action: actionType,
      action_type: actionType,
      details,
      actor,
      user: actor,
      actorId,
      user_id: actorId,
      actorRole,
      role: actorRole,
      user_role: actorRole,
      category,
      timestamp,
      created_at: timestamp,
      createdAt: timestamp,
      date: timestamp,
      rawDate: timestamp
    };

    return {
      actionLog: [newLog, ...(state.actionLog || [])]
    };
  }),

  addNotification: (arg1, arg2, arg3, arg4, arg5, arg6, arg7) => set(state => {
    let notifObj = {};
    if (typeof arg1 === 'object' && arg1 !== null) {
      notifObj = { ...arg1 };
    } else {
      notifObj = {
        userId: arg1,
        title: arg2,
        message: arg3,
        link: arg4,
        relatedTaskId: arg5,
        category: arg6,
        ...(arg7 || {})
      };
    }

    const title = notifObj.title || 'การแจ้งเตือน';
    const message = notifObj.message || notifObj.description || '';
    const nowIso = new Date().toISOString();

    const cat = notifObj.category || (
      title.includes('DAR') || notifObj.docCode?.includes('DAR') ? 'DAR' :
      (title.includes('เอกสารภายนอก') || notifObj.link?.includes('external') || notifObj.docCode?.startsWith('ED')) ? 'EXTERNAL_DOC' :
      (title.includes('สำเนา') || title.includes('ทดแทน') || title.includes('เรียกคืน')) ? 'CONTROLLED_COPY' :
      'SYSTEM'
    );

    const type = notifObj.type || (
      title.includes('รอการ') || title.includes('งานใหม่') || title.includes('ภาระงาน') ? 'TASK_ASSIGNED' :
      title.includes('ปฏิเสธ') || title.includes('ไม่ผ่าน') ? 'REJECTED' :
      title.includes('ส่งกลับ') ? 'ACTION_REQUIRED' :
      title.includes('สำเร็จ') || title.includes('อนุมัติแล้ว') ? 'SUCCESS' :
      title.includes('ยกเลิก') ? 'OBSOLETE' :
      'INFO'
    );

    const newEntry = {
      id: notifObj.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: notifObj.userId || notifObj.user_id || null,
      user_id: notifObj.userId || notifObj.user_id || null,
      targetUserIds: Array.isArray(notifObj.targetUserIds) ? notifObj.targetUserIds : (notifObj.userId ? [notifObj.userId] : []),
      targetDepartment: notifObj.targetDepartment || notifObj.department || null,
      isGlobal: Boolean(notifObj.isGlobal || notifObj.global),
      title,
      message,
      description: message,
      type,
      category: cat,
      docCode: notifObj.docCode || notifObj.doc_code || null,
      refId: notifObj.refId || notifObj.referenceId || null,
      link: notifObj.link || '/dcc/tasks',
      isRead: false,
      read: false,
      readBy: [],
      timestamp: notifObj.timestamp || nowIso,
      createdAt: notifObj.createdAt || nowIso,
      created_at: notifObj.created_at || nowIso,
      relatedTaskId: notifObj.relatedTaskId || null
    };

    return {
      notifications: [newEntry, ...(state.notifications || [])]
    };
  }),
  markNotificationAsReadByTaskId: (taskId, userId) => set(state => {
    const currentUserId = userId || state.currentUser?.id;
    return {
      notifications: (state.notifications || []).map(n => {
        if (String(n.relatedTaskId) === String(taskId)) {
          const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
          if (currentUserId && !readBy.includes(currentUserId)) {
            readBy.push(currentUserId);
          }
          return { ...n, isRead: true, read: true, readBy };
        }
        return n;
      })
    };
  }),
  markNotificationAsRead: (id, userId) => set(state => {
    const currentUserId = userId || state.currentUser?.id;
    return {
      notifications: (state.notifications || []).map(n => {
        if (String(n.id) === String(id)) {
          const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
          if (currentUserId && !readBy.includes(currentUserId)) {
            readBy.push(currentUserId);
          }
          return { ...n, isRead: true, read: true, readBy };
        }
        return n;
      })
    };
  }),
  markAsRead: (id, userId) => set(state => {
    const currentUserId = userId || state.currentUser?.id;
    return {
      notifications: (state.notifications || []).map(n => {
        if (String(n.id) === String(id)) {
          const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
          if (currentUserId && !readBy.includes(currentUserId)) {
            readBy.push(currentUserId);
          }
          return { ...n, isRead: true, read: true, readBy };
        }
        return n;
      })
    };
  }),
  markAllNotificationsAsRead: (userId) => set(state => {
    const currentUserId = userId || state.currentUser?.id;
    return {
      notifications: (state.notifications || []).map(n => {
        const isVisible = !currentUserId || isNotificationVisibleToUser(n, state.currentUser || { id: currentUserId });
        if (isVisible) {
          const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
          if (currentUserId && !readBy.includes(currentUserId)) {
            readBy.push(currentUserId);
          }
          return { ...n, isRead: true, read: true, readBy };
        }
        return n;
      })
    };
  }),
  markAllAsRead: (userId) => set(state => {
    const currentUserId = userId || state.currentUser?.id;
    return {
      notifications: (state.notifications || []).map(n => {
        const isVisible = !currentUserId || isNotificationVisibleToUser(n, state.currentUser || { id: currentUserId });
        if (isVisible) {
          const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
          if (currentUserId && !readBy.includes(currentUserId)) {
            readBy.push(currentUserId);
          }
          return { ...n, isRead: true, read: true, readBy };
        }
        return n;
      })
    };
  }),
  clearNotifications: (userId) => set(state => ({
    notifications: userId ? (state.notifications || []).filter(n => n.userId !== userId && n.user_id !== userId) : []
  })),
  pruneOldNotifications: () => set(state => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    return {
      notifications: (state.notifications || []).filter(
        n => (!n.isRead && !n.read) || ((n.created_at || n.createdAt || n.timestamp) && (n.created_at || n.createdAt || n.timestamp) >= ninetyDaysAgo)
      )
    };
  }),

    updateTask: (taskId, updates) => set((state) => {
    const newTasks = state.tasks.map(t => {
      // Note: task processing starts here
      // Check both id and taskId
      if (t.id === taskId || t.taskId === taskId) {
        return { ...t, ...updates };
      }
      return t;
    });
    return { tasks: newTasks };
  }),

      // Universal DAR Draft Save & Upsert Action
      removeTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== taskId)
  })),

          // Generic createTask helper enforcing Task Department Scoping (Document/DAR Owner Authority)
  createTask: (taskInput) => set((state) => {
    if (!taskInput) return state;
    const safeDars = state.dars || [];
    const safeDocs = state.documents || [];
    const matchedDar = safeDars.find(d => String(d.id) === String(taskInput.darId));
    const docCode = taskInput.doc_code || taskInput.docCode || taskInput.document_code || '';
    const docId = taskInput.docId || taskInput.doc_id;
    const matchedDoc = safeDocs.find(d => 
      (docId && String(d.id) === String(docId)) ||
      (docCode && (d.title === docCode || d.document_code === docCode || d.code === docCode))
    );

    let ownerDept = matchedDar?.department || matchedDoc?.department || taskInput.department;
    if (!ownerDept) {
      if (String(docCode).includes('-PD-') || String(taskInput.title).includes('-PD-') || String(taskInput.darId).includes('-PD-')) {
        ownerDept = 'PD';
      }
    }
    const cleanDept = ownerDept === 'DCC' ? 'DC' : (ownerDept || 'PD');

    const newTask = {
      ...taskInput,
      id: taskInput.id || `t-${Date.now()}`,
      department: cleanDept,
      target_department: cleanDept,
      owner_dept: cleanDept,
      currentHandlerDepartment: cleanDept
    };

    return {
      tasks: [newTask, ...state.tasks]
    };
  }),

    simulatedDate: new Date().toISOString().split('T')[0],

  simulateNextDay: () => {
    set((state) => {
      const current = new Date(state.simulatedDate);
      current.setDate(current.getDate() + 1);
      return { simulatedDate: current.toISOString().split('T')[0] };
    });
    useStore.getState().checkSLA();
  },

  checkSLA: () => {
    let newlyCompletedDars = [];
    set((state) => {
    const today = state.simulatedSystemDate ? new Date(state.simulatedSystemDate) : new Date();
    today.setDate(today.getDate() + (state.mockDateOffset || 0));
    const todayStr = state.simulatedSystemDate || state.simulatedDate || today.toISOString().split('T')[0];
    const activeStatuses = ['DRAFT', 'UNDER_REVIEW', 'PENDING_APPROVAL', 'RETURNED_FOR_REVISION', 'WAITING_ACKNOWLEDGEMENT'];
    const activeExtStatuses = ['PENDING_EXT_REVIEW', 'PENDING_EXT_APPROVAL', 'RETURNED_FOR_REVISION'];
    
    const darIdsToCancel = state.dars
      .filter(d => activeStatuses.includes(d.status))
      .filter(d => calculateSLAStatus(d.effectiveDate, todayStr) === 'OVERDUE')
      .map(d => d.id);

    const extDocIdsToCancel = state.externalDocuments
      .filter(d => activeExtStatuses.includes(d.status))
      .filter(d => calculateSLAStatus(d.effectiveDate, todayStr) === 'OVERDUE')
      .map(d => d.id);
    
    let newTasks = state.tasks
      .filter(t => !darIdsToCancel.includes(t.darId) && !extDocIdsToCancel.includes(t.referenceId))
      .map(t => {
        let sla = 'NORMAL';
        if (t.darId) {
          const dar = state.dars.find(d => d.id === t.darId);
          if (dar && activeStatuses.includes(dar.status)) {
            sla = calculateSLAStatus(dar.effectiveDate, todayStr);
          }
        } else if (t.referenceType === 'EXTERNAL_DOC' && t.referenceId) {
          const extDoc = state.externalDocuments.find(d => d.id === t.referenceId);
          if (extDoc && activeExtStatuses.includes(extDoc.status)) {
            sla = calculateSLAStatus(extDoc.effectiveDate, todayStr);
          }
        }
        return { ...t, status: sla };
      });

    let newDars = state.dars.map(d => darIdsToCancel.includes(d.id) ? { ...d, status: 'CANCELLED_OVERDUE' } : d);
    let newExtDocs = state.externalDocuments.map(d => extDocIdsToCancel.includes(d.id) ? { ...d, status: 'CANCELLED_OVERDUE' } : d);
    let newDocuments = [...state.documents];
    const newTimeline = [...state.timeline];
    let newActionLog = state.actionLog ? [...state.actionLog] : [];
    let newExtAuditTrail = state.externalAuditTrail ? [...state.externalAuditTrail] : [];

    darIdsToCancel.forEach(darId => {
      newTimeline.push({
        id: Date.now() + Math.random(), darId, action: 'System Cancel', user: 'System (SLA Engine)', date: new Date().toLocaleString(), comment: 'Auto-cancelled due to Overdue Effective Date'
      });
    });

    extDocIdsToCancel.forEach(extId => {
      newActionLog.unshift({
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'SYSTEM_CANCEL',
        details: `External document cancelled due to Overdue SLA`,
        actor: 'System (SLA Engine)',
        actorId: 'SYS',
        date: new Date().toISOString()
      });
      newExtAuditTrail.unshift({
        id: `EXTA-${Date.now()}-${Math.random()}`,
        docId: extId,
        action: 'SYSTEM_CANCEL',
        actor: 'System (SLA Engine)',
        actorId: 'SYS',
        date: new Date().toISOString(),
        details: 'Auto-cancelled due to Overdue Effective Date'
      });
    });

    const waitingEffectiveDars = newDars.filter(d => d.status === 'APPROVED_WAITING_EFFECTIVE' && d.effectiveDate <= todayStr);

    let newControlledCopyInstances = [...state.controlledCopyInstances];
    let newAuditTrail = [...state.controlledCopyAuditTrail];
    let newNotifications = [...state.notifications];

    if (waitingEffectiveDars.length > 0) {
      waitingEffectiveDars.forEach(dar => {
        const completedDar = { ...dar, status: 'COMPLETED' };
        newlyCompletedDars.push(completedDar);
        newDars = newDars.map(d => d.id === dar.id ? completedDar : d);
        
        if (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') {
          const isFormDoc = Boolean(
            dar.docType === 'FM' ||
            dar.doc_type === 'FM' ||
            dar.type === 'FM' ||
            String(dar.docIdInput || dar.title || '').startsWith('FM')
          );
          const newDoc = {
            id: `doc-${Date.now()}-${Math.random()}`,
            darId: dar.id,
            title: dar.docIdInput || 'TBD',
            name: dar.title,
            status: 'EFFECTIVE',
            rev: '00',
            department: dar.department,
            controlledCopy: 0,
            effectiveDate: dar.effectiveDate || todayStr,
            distributions: isFormDoc ? [] : (dar.distributions || []),
            access_control: dar.access_control || { scope: 'GENERAL' }
          };
          newDocuments.push(newDoc);
          newNotifications.push({ id: Date.now() + Math.random(), userId: dar.requesterId, title: 'เอกสารบังคับใช้แล้ว', message: `เอกสารใหม่ "${dar.title}" มีผลบังคับใช้แล้ว`, isRead: false, link: '/library', timestamp: new Date().toISOString() });

          if (!isFormDoc) {
            const allocations = calculateCopyAllocations(newDoc.department, newDoc.distributions || []);
            const allTargets = allocations.allAllocations || [];

            if (allTargets.length > 0) {
              const distSla = calculateTaskDueDate({
                submissionDate: today,
                effectiveDate: dar.effectiveDate || newDoc.effectiveDate,
                stepSlaDays: state.slaSettings?.hardcopyReceiptSlaDays || 3,
                mockDateOffset: state.mockDateOffset
              });
              const distDocOfficialTitle = newDoc.name || dar.name || newDoc.title;
              newTasks.push({
                id: `task-dist-${Date.now()}-${Math.random()}`,
                title: `แจกจ่ายเอกสาร Controlled Copy (NEW): ${distDocOfficialTitle} (${newDoc.title})`,
                description: `กรุณาพิมพ์และแจกจ่ายสำเนาควบคุมสำหรับเอกสาร ${newDoc.title} (${distDocOfficialTitle}) จำนวน ${allTargets.length} แผนก/จุดใช้งาน`,
                type: 'DCC_DISTRIBUTE',
            assignee_department: 'DC',
            document_department: 'QC',
                taskType: 'DISTRIBUTION',
                task_type: 'DISTRIBUTION',
                status: 'PENDING',
                assigneeId: resolveDccAdminUserId(state.masterUsers),
                assignedToRole: 'DCC_ADMIN',
                targetRole: 'DCC_ADMIN',
                target_role: 'DCC_ADMIN',
                department: 'DC',
                target_department: 'DC',
                docId: newDoc.id,
                doc_id: newDoc.id,
                document_code: newDoc.title,
                doc_code: newDoc.title,
                docCode: newDoc.title,
                docTitle: distDocOfficialTitle,
                docName: distDocOfficialTitle,
                dueDate: distSla.dueDate,
                cancelDate: distSla.cancelDate,
                isUrgent: distSla.isUrgent,
                isFastTrack: distSla.isFastTrack,
                priority: distSla.isUrgent ? 'URGENT' : 'HIGH',
                slaType: distSla.slaType,
                effectiveDate: distSla.effectiveDate,
                darId: dar.id
              });

              allTargets.forEach((dist, idx) => {
                const deptName = dist.departmentId || dist.dept || dist.dept_code || newDoc.department;
                const locName = cleanLocationName(dist.station_name || dist.locationName || dist.name || dist.location || `${deptName} Head Office`);
                const locId = dist.station_id || dist.locationId || dist.id || `${deptName}-LOC-${idx + 1}`;
                const copyNo = dist.copy_no || dist.copyNo || String(idx + 1).padStart(2, '0');
                const nextCcNum = `CC-${String(idx + 1).padStart(3, '0')}`;
                const isOrigin = dist.isOwner || dist.copyNo === '01' || copyNo === '01';
                const copyDocCode = newDoc.document_code || newDoc.code || newDoc.doc_code || newDoc.title;
                const copyDocTitle = newDoc.document_title || newDoc.docName || newDoc.name || dar.title || copyDocCode;
                const copyId = buildControlledCopyId(copyDocCode, newDoc.rev, copyNo);
                const newInst = {
                  id: copyId,
                  doc_id: newDoc.id,
                  docId: newDoc.id,
                  document_code: copyDocCode,
                  doc_code: copyDocCode,
                  docCode: copyDocCode,
                  document_title: copyDocTitle,
                  doc_title: copyDocTitle,
                  docName: copyDocTitle,
                  docTitle: copyDocCode,
                  doc_version: newDoc.rev,
                  rev: newDoc.rev,
                  copy_no: copyNo,
                  copyNo: copyNo,
                  ccNumber: nextCcNum,
                  issue_no: '01',
                  issueNumber: 'I01',
                  holder_dept: deptName,
                  department: deptName,
                  departmentId: deptName,
                  dept_code: deptName,
                  target_department: deptName,
                  targetDepartment: deptName,
                  recipientDepartment: deptName,
                  recipient_department: deptName,
                  owner_dept: newDoc.department,
                  holder_name: `${deptName} (${locName})`,
                  location: locName,
                  locationName: locName,
                  locationId: locId,
                  station_id: locId,
                  station_name: locName,
                  is_master: Boolean(isOrigin || dist.is_master || dist.isMaster),
                  isMaster: Boolean(isOrigin || dist.is_master || dist.isMaster),
                  is_owner: isOrigin,
                  isOwner: isOrigin,
                  copy_type: 'CONTROLLED',
                  copyType: 'CONTROLLED',
                  status: 'PENDING_ISSUE',
                  is_active_in_field: false,
                  received_by: null,
                  received_at: null,
                  is_replacement: false,
                  dispatched_at: null,
                  dispatched_by: null,
                  dateIssued: todayStr,
                  receipt_confirmed_at: null,
                  receipt_confirmed_by: null,
                  receipt_remarks: null,
                  recall_task_id: null
                };
                const alreadyExists = newControlledCopyInstances.some(inst => {
                  if (inst.id === copyId) return true;
                  const isMatchDoc = (String(inst.docId || inst.doc_id) === String(newDoc.id)) ||
                                     (inst.doc_code === newDoc.title || inst.docTitle === newDoc.title || inst.doc_code === copyDocCode);
                  const isMatchRev = String(inst.rev || inst.doc_version || inst.revision) === String(newDoc.rev);
                  const isMatchCopyNo = String(inst.copy_no || inst.copyNo || inst.ccNumber).replace(/\D/g, '') === String(copyNo).replace(/\D/g, '');
                  return isMatchDoc && isMatchRev && isMatchCopyNo;
                });
                if (!alreadyExists) {
                  newControlledCopyInstances.push(newInst);
                }

                newAuditTrail.push({
                  id: `audit-${Date.now()}-${idx}`,
                  timestamp: new Date().toISOString(),
                  user: 'System (SLA Engine)',
                  action: 'AUTO_GENERATE',
                  docTitle: newInst.docTitle,
                  docRev: newInst.rev,
                  ccNumber: newInst.ccNumber,
                  oldStatus: '-',
                  newStatus: newInst.status,
                  remarks: `Auto-generated CC for ${deptName} (${locName}) upon document effective`
                });
              });
            }
          }
        } else if (dar.type === 'REVISION') {
          const targetDocId = dar.docIdRef || dar.docId || dar.doc_id;
          let targetCode = dar.document_code || dar.doc_code || dar.docCode || dar.docIdInput;
          if (!targetCode && targetDocId) {
            const found = newDocuments.find(d => String(d.id) === String(targetDocId));
            if (found) targetCode = found.document_code || found.code || found.title;
          }
          if (!targetCode && dar.title && !dar.title.startsWith('[')) {
            targetCode = dar.title;
          }

          const matchingOldDocs = newDocuments.filter(doc => {
            const code = doc.document_code || doc.code || doc.title;
            return (targetCode && code === targetCode) || (targetDocId && String(doc.id) === String(targetDocId));
          });
          const oldDoc = matchingOldDocs.find(d => d.status === 'EFFECTIVE') || matchingOldDocs[matchingOldDocs.length - 1];

          if (oldDoc || targetCode) {
             const oldRev = oldDoc ? (oldDoc.revision || oldDoc.rev) : (dar.previous_revision || dar.previousRev || '00');
             const currentRevNum = parseInt(oldRev, 10) || 0;
             const newRevNum = currentRevNum + 1;
             const newRevStr = dar.revision || dar.rev || (newRevNum < 10 ? `0${newRevNum}` : `${newRevNum}`);

             // Single Effective Invariant: Update ALL previous revisions of this document code to SUPERSEDED
             newDocuments = newDocuments.map(doc => {
               const code = doc.document_code || doc.code || doc.title;
               const isMatch = (targetCode && code === targetCode) || (targetDocId && String(doc.id) === String(targetDocId));
               if (isMatch) {
                 return { ...doc, status: 'SUPERSEDED', is_active: false, is_superseded: true, superseded_at: doc.superseded_at || new Date().toISOString() };
               }
               return doc;
             });
             
             const isFormDoc = Boolean(
               dar.docType === 'FM' ||
               dar.doc_type === 'FM' ||
               dar.type === 'FM' ||
               oldDoc?.docType === 'FM' ||
               String(targetCode || oldDoc?.document_code || oldDoc?.code || oldDoc?.title || dar.title || '').startsWith('FM')
             );
             const newDoc = {
               id: `doc-${Date.now()}-${Math.random()}`,
               darId: dar.id,
               document_code: targetCode || oldDoc?.document_code || oldDoc?.title,
               code: targetCode || oldDoc?.code || oldDoc?.title,
               title: oldDoc ? oldDoc.title : targetCode,
               name: dar.title || oldDoc?.name || 'Procedure Document',
               status: 'EFFECTIVE',
               is_active: true,
               is_superseded: false,
               is_obsolete: false,
               rev: newRevStr,
               revision: newRevStr,
               department: dar.department || oldDoc?.department || 'PD',
               controlledCopy: isFormDoc ? 0 : (oldDoc?.controlledCopy || 0),
               effectiveDate: dar.effectiveDate || todayStr,
               distributions: isFormDoc ? [] : (dar.distributions && dar.distributions.length > 0 ? dar.distributions : (oldDoc?.distributions || [])),
               access_control: dar.access_control || oldDoc?.access_control || { scope: 'GENERAL' }
             };
             newDocuments.push(newDoc);
             newNotifications.push({ id: Date.now() + Math.random(), userId: dar.requesterId, title: 'ฉบับปรับปรุงบังคับใช้แล้ว', message: `เอกสารปรับปรุง "${dar.title}" มีผลบังคับใช้เป็น Rev.${newDoc.rev} แล้ว`, isRead: false, link: '/library', timestamp: new Date().toISOString() });

              if (!isFormDoc) {
                // Universal Superseded Copy Recall Invariant: Mark ALL active / received copies of oldDoc as PENDING_RECALL across all stations
                const isMatchingOldCopy = (inst) => {
                  const copyCode = inst.document_code || inst.doc_code || inst.docTitle;
                  const isDocMatch = (oldDoc && String(inst.docId || inst.doc_id) === String(oldDoc.id)) ||
                                     (targetCode && copyCode === targetCode) ||
                                     (oldDoc?.title && copyCode === oldDoc.title);
                  const copyRev = inst.rev || inst.doc_version || inst.revision;
                  if (copyRev && String(copyRev) === String(newDoc.rev)) {
                    return false;
                  }
                  const isOldRev = copyRev ? (String(copyRev) === String(oldRev) || copyRev < newDoc.rev) : true;
                  const isActive = inst.status === 'ACTIVE' || inst.status === 'ISSUED_ACTIVE' || inst.status === 'RECEIVED' || inst.status === 'DISPATCHED_PENDING_RECEIPT';
                  return isDocMatch && isOldRev && isActive;
                };

                const oldCopiesToRecall = newControlledCopyInstances.filter(isMatchingOldCopy);

                newControlledCopyInstances = newControlledCopyInstances.map(inst => {
                  if (isMatchingOldCopy(inst)) {
                    newAuditTrail.unshift({
                      id: `audit-supersede-${Date.now()}-${inst.id}`,
                      timestamp: new Date().toISOString(),
                      user: 'System (SLA Engine)',
                      action: 'SUPERSEDED_PENDING_RECALL',
                      docTitle: inst.doc_code || inst.docTitle || targetCode,
                      docRev: inst.rev || inst.doc_version || oldRev,
                      ccNumber: inst.ccNumber || inst.copy_no,
                      oldStatus: inst.status,
                      newStatus: 'SUPERSEDED_PENDING_RECALL',
                      remarks: `Superseded by Rev.${newDoc.rev} (DAR ${dar.id}). Set to SUPERSEDED_PENDING_RECALL for physical recall/destruction.`
                    });

                    return {
                      ...inst,
                      status: 'PENDING_RECALL',
                      is_superseded: true,
                      superseded_at: new Date().toISOString(),
                      superseded_by_dar: dar.dar_no || dar.id,
                      superseded_by_rev: newDoc.rev,
                      recall_reason: `เอกสารมีการปรับปรุง Revision ใหม่ (Superseded by Rev.${newDoc.rev})`
                    };
                  }
                  return inst;
                });

                newActionLog.unshift({
                  id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  actionType: 'REVISION_PUBLISHED',
                  actor: 'System (SLA Engine)',
                  details: `เอกสาร ${newDoc.title} ปรับปรุงเป็น Rev.${newDoc.rev}: สำเนาเดิม Rev.${oldRev} ทั้งหมด (${oldCopiesToRecall.length} เล่ม) ถูกตั้งสถานะเรียกคืน (SUPERSEDED_PENDING_RECALL)`,
                  timestamp: new Date().toISOString()
                });
                
                const allocations = calculateCopyAllocations(newDoc.department, newDoc.distributions || []);
                const allTargets = allocations.allAllocations || [];

                // Universal Recall Task: ALWAYS created if there are copies to recall or if oldDoc had controlled copies
                if (oldCopiesToRecall.length > 0 || (oldDoc && oldDoc.controlledCopy > 0)) {
                  const recallDocOfficialTitle = oldDoc?.name || newDoc.name || dar.name || targetCode;
                  newTasks.push({
                    id: `task-recall-${targetCode}-${oldRev}-${Date.now()}`,
                    type: 'DCC_RECALL',
            assignee_department: 'DC',
            document_department: 'QC',
                    taskType: 'RECALL',
                    task_type: 'RECALL',
                    targetRole: 'DCC_ADMIN',
                    target_role: 'DCC_ADMIN',
                    assignedToRole: 'DCC_ADMIN',
                    assigneeId: resolveDccAdminUserId(state.masterUsers),
                    department: 'DC',
                    target_department: 'DC',
                    docId: oldDoc?.id,
                    doc_id: oldDoc?.id,
                    document_code: targetCode,
                    doc_code: targetCode,
                    docCode: targetCode,
                    docTitle: recallDocOfficialTitle,
                    docName: recallDocOfficialTitle,
                    targetRevision: oldRev,
                    revision: oldRev,
                    doc_version: oldRev,
                    title: `[เรียกคืนสำเนาตกรุ่น] เรียกคืนเอกสาร Controlled Copy: ${recallDocOfficialTitle} (${targetCode} Rev.${oldRev})`,
                    description: `เอกสาร ${targetCode} (${recallDocOfficialTitle}) มีการอัปเดตเป็น Rev.${newDoc.rev} แล้ว กรุณาเรียกคืนเอกสารฉบับเดิม (Rev.${oldRev}) จากทุกสถานีใช้งาน (${oldCopiesToRecall.length} จุด)`,
                    copies_to_recall: oldCopiesToRecall.map(c => ({
                      id: c.id,
                      copy_no: c.copy_no || c.copyNo,
                      holder_dept: c.holder_dept || c.department,
                      location: c.location || c.locationName,
                      status: c.status
                    })),
                    supersededCopyIds: oldCopiesToRecall.map(c => c.id),
                    status: 'PENDING',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    priority: 'HIGH',
                    darId: dar.id,
                    createdAt: new Date().toISOString()
                  });
                }

                if (allTargets.length > 0) {
                  const distSla = calculateTaskDueDate({
                    submissionDate: today,
                    effectiveDate: dar.effectiveDate || newDoc.effectiveDate,
                    stepSlaDays: state.slaSettings?.hardcopyReceiptSlaDays || 3,
                    mockDateOffset: state.mockDateOffset
                  });
                  const distDocOfficialTitle = newDoc.name || dar.name || newDoc.title;
                  newTasks.push({
                    id: `task-dist-${newDoc.title}-${newDoc.rev}-${Date.now()}`,
                    title: `แจกจ่ายเอกสาร Controlled Copy: ${distDocOfficialTitle} (${newDoc.title} Rev.${newDoc.rev})`,
                    description: `กรุณาพิมพ์และแจกจ่ายสำเนาควบคุมสำหรับเอกสาร ${newDoc.title} (${distDocOfficialTitle}) (Rev.${newDoc.rev}) จำนวน ${allTargets.length} แผนก/จุดใช้งาน`,
                    type: 'DCC_DISTRIBUTE',
            assignee_department: 'DC',
            document_department: 'QC',
                    taskType: 'DISTRIBUTION',
                    task_type: 'DISTRIBUTION',
                    targetRole: 'DCC_ADMIN',
                    target_role: 'DCC_ADMIN',
                    assignedToRole: 'DCC_ADMIN',
                    assigneeId: resolveDccAdminUserId(state.masterUsers),
                    department: 'DC',
                    target_department: 'DC',
                    docId: newDoc.id,
                    doc_id: newDoc.id,
                    document_code: newDoc.title,
                    doc_code: newDoc.title,
                    docCode: newDoc.title,
                    docTitle: distDocOfficialTitle,
                    docName: distDocOfficialTitle,
                    targetRevision: newDoc.rev,
                    revision: newDoc.rev,
                    doc_version: newDoc.rev,
                    status: 'PENDING',
                    dueDate: distSla.dueDate,
                    cancelDate: distSla.cancelDate,
                    isUrgent: distSla.isUrgent,
                    isFastTrack: distSla.isFastTrack,
                    priority: distSla.isUrgent ? 'URGENT' : 'HIGH',
                    slaType: distSla.slaType,
                    effectiveDate: distSla.effectiveDate,
                    darId: dar.id,
                    createdAt: new Date().toISOString()
                  });

                  allTargets.forEach((dist, idx) => {
                    const deptName = dist.departmentId || dist.dept || dist.dept_code || newDoc.department;
                    const locName = cleanLocationName(dist.station_name || dist.locationName || dist.name || dist.location || `${deptName} Head Office`);
                    const locId = dist.station_id || dist.locationId || dist.id || `${deptName}-LOC-${idx + 1}`;
                    const copyNo = dist.copy_no || dist.copyNo || String(idx + 1).padStart(2, '0');
                    const nextCcNum = `CC-${String(idx + 1).padStart(3, '0')}`;
                    const isOrigin = dist.isOwner || dist.copyNo === '01' || copyNo === '01';

                    const copyDocCode = newDoc.document_code || newDoc.code || newDoc.doc_code || newDoc.title;
                    const copyDocTitle = newDoc.document_title || newDoc.docName || newDoc.name || copyDocCode;
                    const copyId = buildControlledCopyId(copyDocCode, newDoc.rev, copyNo);
                    const newInst = {
                      id: copyId,
                      doc_id: newDoc.id,
                      docId: newDoc.id,
                      document_code: copyDocCode,
                      doc_code: copyDocCode,
                      docCode: copyDocCode,
                      document_title: copyDocTitle,
                      doc_title: copyDocTitle,
                      docName: copyDocTitle,
                      docTitle: copyDocCode,
                      doc_version: newDoc.rev,
                      rev: newDoc.rev,
                      revision: newDoc.rev,
                      copy_no: copyNo,
                      copyNo: copyNo,
                      ccNumber: nextCcNum,
                      issue_no: '01',
                      issueNumber: 'I01',
                      holder_dept: deptName,
                      department: deptName,
                      departmentId: deptName,
                      dept_code: deptName,
                      target_department: deptName,
                      targetDepartment: deptName,
                      recipientDepartment: deptName,
                      recipient_department: deptName,
                      owner_dept: newDoc.department,
                      holder_name: `${deptName} (${locName})`,
                      location: locName,
                      locationName: locName,
                      locationId: locId,
                      station_id: locId,
                      station_name: locName,
                      is_master: Boolean(isOrigin || dist.is_master || dist.isMaster),
                      isMaster: Boolean(isOrigin || dist.is_master || dist.isMaster),
                      is_owner: isOrigin,
                      isOwner: isOrigin,
                      copy_type: 'CONTROLLED',
                      copyType: 'CONTROLLED',
                      status: 'PENDING_ISSUE',
                      is_active_in_field: false,
                      received_by: null,
                      received_at: null,
                      is_replacement: false,
                      dispatched_at: null,
                      dispatched_by: null,
                      dateIssued: todayStr,
                      receipt_confirmed_at: null,
                      receipt_confirmed_by: null,
                      receipt_remarks: null,
                      recall_task_id: null
                    };
                    const alreadyExists = newControlledCopyInstances.some(inst => {
                      if (inst.id === copyId) return true;
                      const isMatchDoc = (String(inst.docId || inst.doc_id) === String(newDoc.id)) ||
                                         (inst.doc_code === newDoc.title || inst.docTitle === newDoc.title || inst.doc_code === copyDocCode);
                      const isMatchRev = String(inst.rev || inst.doc_version || inst.revision) === String(newDoc.rev);
                      const isMatchCopyNo = String(inst.copy_no || inst.copyNo || inst.ccNumber).replace(/\D/g, '') === String(copyNo).replace(/\D/g, '');
                      return isMatchDoc && isMatchRev && isMatchCopyNo;
                    });
                    if (!alreadyExists) {
                      newControlledCopyInstances.push(newInst);
                    }
                    
                    newAuditTrail.push({
                      id: `audit-${Date.now()}-${idx}`,
                      timestamp: new Date().toISOString(),
                      user: 'System (SLA Engine)',
                      action: 'AUTO_GENERATE',
                      docTitle: newInst.docTitle,
                      docRev: newInst.rev,
                      ccNumber: newInst.ccNumber,
                      oldStatus: '-',
                      newStatus: newInst.status,
                      remarks: `Auto-generated CC for ${deptName} (${locName}) upon new revision effective`
                    });
                  });
                }
              }
            }
        } else if (dar.type === 'OBSOLETE') {
          const targetDocId = dar.docIdRef || dar.docId || dar.doc_id;
          let targetDocCode = dar.document_code || dar.doc_code || dar.docCode || dar.docIdInput;
          if (!targetDocCode && targetDocId) {
            const found = newDocuments.find(d => String(d.id) === String(targetDocId));
            if (found) {
              targetDocCode = found.document_code || found.code || found.title;
            }
          }
          if (!targetDocCode) {
            targetDocCode = dar.title?.startsWith('[') ? dar.title.replace(/^\[.*?\]\s*/, '') : dar.title;
          }

          // 1. Cascade Obsolete across ALL revisions of targetDocCode
          newDocuments = newDocuments.map(doc => {
            const docCode = doc.document_code || doc.code || doc.title;
            const isMatch = (targetDocCode && docCode === targetDocCode) || (targetDocId && String(doc.id) === String(targetDocId));
            if (isMatch) {
              const existingHist = Array.isArray(doc.revision_history) ? [...doc.revision_history] : [];
              const curRev = String(doc.revision || doc.rev || '01').replace(/^Rev\.?/i, '').padStart(2, '0');
              if (!existingHist.some(h => String(h.revision || h.rev || '').replace(/^Rev\.?/i, '').padStart(2, '0') === curRev)) {
                existingHist.push({
                  dar_no: doc.dar_no || doc.darNo || dar.dar_no || dar.id,
                  revision: curRev,
                  rev: curRev,
                  type: curRev === '00' ? 'NEW' : 'REVISION',
                  status: 'COMPLETED',
                  effective_date: doc.effectiveDate || doc.effective_date,
                  date: doc.effectiveDate || doc.effective_date,
                  reason: doc.reason || doc.change_details || 'ประวัติการประกาศใช้เดิม',
                  file: doc.file,
                  fileBlob: doc.fileBlob
                });
              }
              if (!existingHist.some(h => (h.type === 'OBSOLETE' || h.request_type === 'OBSOLETE') || h.dar_no === (dar.dar_no || dar.id))) {
                existingHist.push({
                  dar_no: dar.dar_no || dar.id,
                  revision: curRev,
                  rev: curRev,
                  target_revision: curRev,
                  type: 'OBSOLETE',
                  request_type: 'OBSOLETE',
                  status: 'COMPLETED',
                  effective_date: todayStr,
                  date: todayStr,
                  reason: dar.obsoleteReason || dar.reason || 'ขอยกเลิกเอกสาร'
                });
              }

              return {
                ...doc,
                status: 'OBSOLETE',
                is_obsolete: true,
                obsolete_dar_id: dar.id,
                obsolete_date: todayStr,
                revision_history: existingHist
              };
            }
            return doc;
          });
          
          // 2. Mark active copies across ALL revisions as OBSOLETE_PENDING_RECALL
          const isTargetCopy = (inst) => {
            const cCode = inst.document_code || inst.doc_code || inst.docTitle;
            const isMatch = (targetDocCode && cCode === targetDocCode) || (targetDocId && String(inst.docId || inst.doc_id) === String(targetDocId));
            const isActive = inst.status === 'ACTIVE' || inst.status === 'ISSUED_ACTIVE' || inst.status === 'RECEIVED' || inst.status === 'DISPATCHED_PENDING_RECEIPT';
            return isMatch && isActive;
          };

          const obsoleteCopiesToRecall = newControlledCopyInstances.filter(isTargetCopy);

          newControlledCopyInstances = newControlledCopyInstances.map(inst => {
            if (isTargetCopy(inst)) {
              return {
                ...inst,
                status: 'OBSOLETE_PENDING_RECALL',
                obsolete_at: new Date().toISOString(),
                obsolete_by_dar: dar.dar_no || dar.id,
                recall_reason: `เอกสารถูกประกาศยกเลิกการใช้งาน (Obsolete DAR ${dar.dar_no || dar.id})`
              };
            }
            return inst;
          });

          // 3. Invalidate/dismiss pending tasks for this document
          newTasks = newTasks.map(t => {
            const isTaskMatch = (t.document_code && t.document_code === targetDocCode) ||
                                (t.doc_code && t.doc_code === targetDocCode) ||
                                (t.docTitle && t.docTitle === targetDocCode) ||
                                (t.doc_id && String(t.doc_id) === String(targetDocId)) ||
                                (t.title && targetDocCode && t.title.includes(targetDocCode));
            const isPendingWorkflow = t.type === 'RECEIPT_CONFIRMATION' || t.type === 'DOCUMENT_RECEIPT' ||
                                      t.type === 'DCC_RECEIPT' || t.type === 'DAR_REVIEW' || t.type === 'DAR_APPROVE';
            if (isTaskMatch && isPendingWorkflow && t.status !== 'COMPLETED' && t.status !== 'DISMISSED') {
              return {
                ...t,
                status: 'DISMISSED',
                is_dismissed: true,
                dismissed_reason: `เอกสาร ${targetDocCode} ถูกยกเลิกการใช้งาน (OBSOLETE) จึงยกเลิกงานตกค้างอัตโนมัติ`
              };
            }
            return t;
          });
          
          // 4. Create DCC Recall Task
          const obsoleteTargetDoc = (newDocuments || []).find(d => (targetDocCode && (d.title === targetDocCode || d.document_code === targetDocCode)) || (targetDocId && String(d.id) === String(targetDocId)));
          const obsoleteDocOfficialTitle = obsoleteTargetDoc?.name || obsoleteTargetDoc?.document_name || dar.name || targetDocCode;
          newTasks.push({
            id: `task-recall-${targetDocCode}-ALL-${Date.now()}`,
            type: 'DCC_RECALL',
            assignee_department: 'DC',
            document_department: 'QC',
            taskType: 'RECALL',
            task_type: 'RECALL',
            targetRole: 'DCC_ADMIN',
            target_role: 'DCC_ADMIN',
            assignedToRole: 'DCC_ADMIN',
            assigneeId: resolveDccAdminUserId(state.masterUsers),
            department: 'DC',
            target_department: 'DC',
            docId: targetDocId,
            doc_id: targetDocId,
            document_code: targetDocCode,
            doc_code: targetDocCode,
            docCode: targetDocCode,
            docTitle: obsoleteDocOfficialTitle,
            docName: obsoleteDocOfficialTitle,
            targetRevision: 'ALL',
            revision: 'ALL',
            doc_version: 'ALL',
            title: `[เรียกคืนสำเนาเอกสารยกเลิก] ${obsoleteDocOfficialTitle} (${targetDocCode}) (ทั้งหมด ${obsoleteCopiesToRecall.length} เล่ม)`,
            description: `เอกสาร ${targetDocCode} (${obsoleteDocOfficialTitle}) ถูกประกาศยกเลิกการใช้งาน (OBSOLETE) แล้ว กรุณาเรียกคืนสำเนาทั้งหมด (${obsoleteCopiesToRecall.length} ชุด) เพื่อดำเนินการทำลายหรือจัดเก็บ`,
            copies_to_recall: obsoleteCopiesToRecall.map(c => ({
              id: c.id,
              copy_no: c.copy_no || c.copyNo,
              holder_dept: c.holder_dept || c.department,
              location: c.location || c.locationName,
              status: c.status
            })),
            supersededCopyIds: obsoleteCopiesToRecall.map(c => c.id),
            status: 'PENDING',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'HIGH',
            darId: dar.id,
            createdAt: new Date().toISOString()
          });

          newNotifications.push({ id: Date.now() + Math.random(), userId: dar.requesterId, title: 'ยกเลิกเอกสารสำเร็จ', message: `เอกสาร "${targetDocCode}" ถูกยกเลิกและย้ายไปเก็บที่ Archive แล้ว`, isRead: false, link: '/library', timestamp: new Date().toISOString() });
        }

        newTimeline.push({
          id: Date.now() + Math.random(), darId: dar.id, action: 'Auto Publish', user: 'System (Lifecycle Engine)', date: new Date().toLocaleString(), comment: 'Document changed to EFFECTIVE status automatically'
        });
      });
    }

    if (darIdsToCancel.length === 0 && waitingEffectiveDars.length === 0 && JSON.stringify(newTasks) === JSON.stringify(state.tasks)) {
      return state;
    }

    return {
      tasks: cleanupDccTasks(newTasks, newControlledCopyInstances, newDocuments),
      dars: newDars,
      externalDocuments: newExtDocs,
      documents: newDocuments,
      timeline: newTimeline,
      documentControlledCopies: sanitizeControlledCopies(newControlledCopyInstances),
      controlledCopyInstances: sanitizeControlledCopies(newControlledCopyInstances),
      controlledCopies: sanitizeControlledCopies(newControlledCopyInstances),
      controlledCopyAuditTrail: newAuditTrail,
      notifications: newNotifications,
      actionLog: newActionLog,
      externalAuditTrail: newExtAuditTrail
    };
    });

    if (newlyCompletedDars.length > 0) {
      const store = get();
      newlyCompletedDars.forEach(dar => {
        store.syncRevisionEffective(dar);
        store.syncObsoleteCompleted(dar);
      });
    }
    get().checkScheduledEffectiveDocs?.();
  },

        // Phase 1.5 Departmental Access Control
      // --- CONTROLLED COPY STATE MACHINE & LIFECYCLE METHODS ---

  getUserActionableTasks: (user) => {
    const s = useStore.getState();
    const effectiveToday = s.getEffectiveToday ? s.getEffectiveToday() : (s.simulatedSystemDate ? new Date(s.simulatedSystemDate) : new Date());
    const allDocs = [...(s.documents || []), ...(s.externalDocuments || [])];
    return getUserActionableTasks(s.tasks, user || s.currentUser, allDocs, effectiveToday);
  },
  getUserTaskBadgeCount: (user) => {
    const s = useStore.getState();
    const effectiveToday = s.getEffectiveToday ? s.getEffectiveToday() : (s.simulatedSystemDate ? new Date(s.simulatedSystemDate) : new Date());
    const allDocs = [...(s.documents || []), ...(s.externalDocuments || [])];
    return getUserTaskBadgeCount(s.tasks, user || s.currentUser, allDocs, effectiveToday);
  },


  // ─── NEW: Zero-Hard-Delete Obsolete Publish Action ───────────────────────
      // ─── NEW: DCC Physical Copy Disposition (Stamp & Archive OR Destroy) ──────

  // ─── NEW: Auto-Publish Master Document upon Final Approval ───────────────
    // ฟังก์ชันเมื่อ DAR ได้รับการอนุมัติและเลื่อนฉบับ (Promote New Revision)
              // ================= MASTER DATA ACTIONS ================= //

  // --- 1. User Management Actions ---
  addMasterUser: (userData) => {
    let finalUsersList = [];
    let createdUser = null;

    set((state) => {
      const newId = userData.id || `U${String(Date.now()).slice(-4)}`;
      const empId = userData.empId || `EMP-${String((state.masterUsers || []).length + 1).padStart(3, '0')}`;
      const primaryDept = userData.primary_department || userData.department || userData.dept || 'QA/QC';
      const rawAffiliated = userData.affiliated_departments || userData.depts || (userData.department ? [userData.department] : [primaryDept]);
      const affiliatedDepts = Array.from(new Set([primaryDept, ...(Array.isArray(rawAffiliated) ? rawAffiliated : [rawAffiliated])]));
      const approvalLevel = Number(userData.approval_level || userData.level) || 1;
      const isQmr = userData.role === 'QMR' || Boolean(userData.isQmr);
      const isDcc = userData.role === 'DCC_ADMIN' || Boolean(userData.isDcc);

      const basePermissions = ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'];
      if (isDcc) basePermissions.push('DCC_ADMIN');
      if (isQmr) basePermissions.push('QMR_ACCESS');
      const userPermissions = (userData.permissions && userData.permissions.length > 0)
        ? Array.from(new Set([...basePermissions, ...userData.permissions]))
        : basePermissions;

      const newUser = {
        id: newId,
        empId,
        name: userData.name,
        fullName: userData.fullName || userData.name,
        email: userData.email || `${newId.toLowerCase()}@company.com`,
        department: primaryDept,
        dept: primaryDept,
        primary_department: primaryDept,
        depts: affiliatedDepts,
        affiliated_departments: affiliatedDepts,
        position: userData.position || 'Staff',
        role: userData.role || 'GENERAL_USER',
        level: approvalLevel,
        approval_level: approvalLevel,
        isDcc,
        isQmr,
        status: userData.status || 'Active',
        pin: userData.pin || '123456',
        failedPinAttempts: 0,
        isLocked: false,
        lastPinChangedAt: new Date().toISOString(),
        permissions: userPermissions,
        canCreateDar: userData.canCreateDar !== undefined ? Boolean(userData.canCreateDar) : true,
        canAccessTasks: userData.canAccessTasks !== undefined ? Boolean(userData.canAccessTasks) : true,
        canViewRegister: userData.canViewRegister !== undefined ? Boolean(userData.canViewRegister) : true,
        isWorkflowUser: userData.isWorkflowUser !== undefined ? Boolean(userData.isWorkflowUser) : true,
        signatureType: userData.signatureType || 'TYPOGRAPHIC',
        signatureStyle: userData.signatureStyle || 'MODERN_SANS',
        signatureInitials: userData.signatureInitials || `${(userData.name || newId).slice(0, 3).toUpperCase()}-${primaryDept}`,
        signatureImage: userData.signatureImage || null,
        hasRegisteredSignature: Boolean(userData.signatureImage || userData.hasRegisteredSignature)
      };

      const updatedUsers = [...(state.masterUsers || []), newUser];
      finalUsersList = updatedUsers;
      createdUser = newUser;

      const userRoleObj = (u) => ({
        id: u.id,
        empId: u.empId || u.id,
        name: u.name,
        depts: u.affiliated_departments || u.depts,
        affiliated_departments: u.affiliated_departments || u.depts,
        department: u.primary_department || u.department,
        primary_department: u.primary_department || u.department,
        level: u.approval_level || u.level,
        approval_level: u.approval_level || u.level,
        signatureImage: u.signatureImage
      });

      return {
        masterUsers: updatedUsers,
        requestUsers: updatedUsers.map(userRoleObj),
        reviewUsers: updatedUsers.map(userRoleObj),
        approveUsers: updatedUsers.map(userRoleObj),
        actionLog: [{
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actionType: 'MASTER_USER_CREATED',
          actor: state.currentUser?.name || 'DCC Officer',
          details: `Created user ${newUser.name} (${newUser.id}) with role ${newUser.role}`,
          timestamp: new Date().toISOString()
        }, ...(state.actionLog || [])]
      };
    });

    if (createdUser?.signatureImage) {
      const sigKey = `user_sig_${createdUser.id}`;
      saveFile(sigKey, createdUser.signatureImage).catch(err => console.error('Failed to save user signature:', err));
    }
    // Direct persistence of masterUsers to IndexedDB
    const cleanUsers = (finalUsersList || []).map(u => ({ ...u, signatureImage: null }));
    saveFile('master_users_persistent_data', cleanUsers).catch(err => console.error('Failed to sync masterUsers list:', err));
  },

  updateMasterUser: (userId, userData) => {
    let finalUsersList = [];

    set((state) => {
      const updatedUsers = (state.masterUsers || []).map(u => {
        if (u.id === userId || u.userId === userId) {
          const primaryDept = userData.primary_department || userData.department || u.primary_department || u.department || 'QA/QC';
          const rawAffiliated = userData.affiliated_departments || userData.depts || u.affiliated_departments || u.depts || [primaryDept];
          const affiliatedDepts = Array.from(new Set([primaryDept, ...(Array.isArray(rawAffiliated) ? rawAffiliated : [rawAffiliated])]));
          const approvalLevel = userData.approval_level !== undefined 
            ? Number(userData.approval_level) 
            : (userData.level !== undefined ? Number(userData.level) : (u.approval_level || u.level || 1));
          const isQmr = userData.role === 'QMR' ? true : (userData.isQmr !== undefined ? Boolean(userData.isQmr) : Boolean(u.isQmr));

          const updated = {
            ...u,
            ...userData,
            department: primaryDept,
            dept: primaryDept,
            primary_department: primaryDept,
            depts: affiliatedDepts,
            affiliated_departments: affiliatedDepts,
            level: approvalLevel,
            approval_level: approvalLevel,
            isDcc: userData.role === 'DCC_ADMIN' ? true : (userData.role ? false : u.isDcc),
            isQmr: isQmr,
            permissions: (userData.permissions && userData.permissions.length > 0) ? userData.permissions : (u.permissions?.length > 0 ? u.permissions : ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER']),
            canCreateDar: userData.canCreateDar !== undefined ? Boolean(userData.canCreateDar) : (u.canCreateDar ?? true),
            canAccessTasks: userData.canAccessTasks !== undefined ? Boolean(userData.canAccessTasks) : (u.canAccessTasks ?? true),
            canViewRegister: userData.canViewRegister !== undefined ? Boolean(userData.canViewRegister) : (u.canViewRegister ?? true),
            isWorkflowUser: userData.isWorkflowUser !== undefined ? Boolean(userData.isWorkflowUser) : (u.isWorkflowUser ?? true)
          };
          return updated;
        }
        return u;
      });

      finalUsersList = updatedUsers;

      const updatedCurrentUser = (state.currentUser?.id === userId || state.currentUser?.userId === userId)
        ? { ...state.currentUser, ...(updatedUsers.find(u => u.id === userId || u.userId === userId) || {}) }
        : state.currentUser;

      const userRoleObj = (u) => ({
        id: u.id,
        empId: u.empId || u.id,
        name: u.name,
        depts: u.affiliated_departments || u.depts,
        affiliated_departments: u.affiliated_departments || u.depts,
        department: u.primary_department || u.department,
        primary_department: u.primary_department || u.department,
        level: u.approval_level || u.level,
        approval_level: u.approval_level || u.level,
        signatureImage: u.signatureImage
      });

      return {
        masterUsers: updatedUsers,
        currentUser: updatedCurrentUser,
        requestUsers: updatedUsers.map(userRoleObj),
        reviewUsers: updatedUsers.map(userRoleObj),
        approveUsers: updatedUsers.map(userRoleObj),
        actionLog: [{
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actionType: 'MASTER_USER_UPDATED',
          actor: state.currentUser?.name || 'DCC Officer',
          details: `Updated user ${userId}`,
          timestamp: new Date().toISOString()
        }, ...(state.actionLog || [])]
      };
    });

    if (userData?.signatureImage) {
      const sigKey = `user_sig_${userId}`;
      saveFile(sigKey, userData.signatureImage).catch(err => console.error('Failed to save signature to IndexedDB:', err));
    }
    // Direct persistence of masterUsers to IndexedDB
    const cleanUsers = (finalUsersList || []).map(u => ({ ...u, signatureImage: null }));
    saveFile('master_users_persistent_data', cleanUsers).catch(err => console.error('Failed to sync masterUsers to IndexedDB:', err));
  },

  toggleUserStatus: (userId) => {
    let finalUsersList = [];

    set((state) => {
      const updatedUsers = (state.masterUsers || []).map(u => {
        if (u.id === userId || u.userId === userId) {
          const newStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          return { ...u, status: newStatus };
        }
        return u;
      });

      finalUsersList = updatedUsers;

      const userRoleObj = (u) => ({
        id: u.id,
        empId: u.empId || u.id,
        name: u.name,
        depts: u.affiliated_departments || u.depts,
        affiliated_departments: u.affiliated_departments || u.depts,
        department: u.primary_department || u.department,
        primary_department: u.primary_department || u.department,
        level: u.approval_level || u.level,
        approval_level: u.approval_level || u.level,
        signatureImage: u.signatureImage
      });

      return {
        masterUsers: updatedUsers,
        requestUsers: updatedUsers.map(userRoleObj),
        reviewUsers: updatedUsers.map(userRoleObj),
        approveUsers: updatedUsers.map(userRoleObj)
      };
    });

    const cleanUsers = (finalUsersList || []).map(u => ({ ...u, signatureImage: null }));
    saveFile('master_users_persistent_data', cleanUsers).catch(err => console.error('Failed to sync masterUsers status to IndexedDB:', err));
  },

  resetUserPassword: (userId) => set((state) => {
    return {
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_USER_PASSWORD_RESET',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Reset password to default for user ${userId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  resetUserPin: (userId) => {
    let finalUsersList = [];

    set((state) => {
      const defaultPin = state.signatureSettings?.defaultPin || '123456';
      const updatedUsers = (state.masterUsers || []).map(u => {
        if (u.id === userId || u.userId === userId) {
          return { 
            ...u, 
            pin: defaultPin, 
            failedPinAttempts: 0, 
            isLocked: false, 
            lastPinChangedAt: new Date().toISOString() 
          };
        }
        return u;
      });

      finalUsersList = updatedUsers;

      return {
        masterUsers: updatedUsers,
        actionLog: [{
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actionType: 'MASTER_USER_PIN_RESET',
          actor: state.currentUser?.name || 'DCC Officer',
          details: `Reset signing PIN to default for user ${userId}`,
          timestamp: new Date().toISOString()
        }, ...(state.actionLog || [])]
      };
    });

    const cleanUsers = (finalUsersList || []).map(u => ({ ...u, signatureImage: null }));
    saveFile('master_users_persistent_data', cleanUsers).catch(err => console.error('Failed to sync masterUsers after PIN reset:', err));
  },

  unlockUserAccount: (userId) => {
    let finalUsersList = [];

    set((state) => {
      const updatedUsers = (state.masterUsers || []).map(u => {
        if (u.id === userId || u.userId === userId) {
          return { ...u, isLocked: false, failedPinAttempts: 0 };
        }
        return u;
      });

      finalUsersList = updatedUsers;

      return {
        masterUsers: updatedUsers,
        actionLog: [{
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actionType: 'MASTER_USER_UNLOCKED',
          actor: state.currentUser?.name || 'DCC Officer',
          details: `Unlocked account for user ${userId}`,
          timestamp: new Date().toISOString()
        }, ...(state.actionLog || [])]
      };
    });

    const cleanUsers = (finalUsersList || []).map(u => ({ ...u, signatureImage: null }));
    saveFile('master_users_persistent_data', cleanUsers).catch(err => console.error('Failed to sync masterUsers after unlock:', err));
  },

  updateUserSignatureProfile: (userId, profileData) => {
    let finalUsersList = [];

    set((state) => {
      const updatedUsers = (state.masterUsers || []).map(u => {
        if (u.id === userId || u.userId === userId) {
          return {
            ...u,
            ...profileData,
            hasRegisteredSignature: true,
            lastSignatureUpdatedAt: new Date().toISOString()
          };
        }
        return u;
      });

      finalUsersList = updatedUsers;

      const updatedCurrentUser = (state.currentUser?.id === userId || state.currentUser?.userId === userId)
        ? { ...state.currentUser, ...(updatedUsers.find(u => u.id === userId || u.userId === userId) || {}) }
        : state.currentUser;

      const userRoleObj = (u) => ({
        id: u.id,
        empId: u.empId || u.id,
        name: u.name,
        depts: u.affiliated_departments || u.depts,
        affiliated_departments: u.affiliated_departments || u.depts,
        department: u.primary_department || u.department,
        primary_department: u.primary_department || u.department,
        level: u.approval_level || u.level,
        approval_level: u.approval_level || u.level,
        signatureImage: u.signatureImage
      });

      return {
        masterUsers: updatedUsers,
        currentUser: updatedCurrentUser,
        requestUsers: updatedUsers.map(userRoleObj),
        reviewUsers: updatedUsers.map(userRoleObj),
        approveUsers: updatedUsers.map(userRoleObj),
        actionLog: [{
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          actionType: 'MASTER_USER_SIGNATURE_UPDATED',
          action: 'อัปเดตโปรไฟล์ลายเซ็นดิจิทัล',
          actor: state.currentUser?.name || 'DCC Officer',
          user: state.currentUser?.name || 'DCC Officer',
          details: `Updated digital signature profile for user ${userId} (${profileData.signatureType || 'TYPOGRAPHIC'})`,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
          date: new Date().toISOString(),
          category: 'SYSTEM'
        }, ...(state.actionLog || [])]
      };
    });

    if (profileData?.signatureImage) {
      const sigKey = `user_sig_${userId}`;
      saveFile(sigKey, profileData.signatureImage).catch(err => console.error('Failed to persist signature to IndexedDB:', err));
    }
    const cleanUsers = (finalUsersList || []).map(u => ({ ...u, signatureImage: null }));
    saveFile('master_users_persistent_data', cleanUsers).catch(err => console.error('Failed to sync masterUsers list:', err));
  },

  // 1. Action บันทึกลายเซ็นผู้ใช้ พร้อม Sync ลง IndexedDB ถาวร (Blueprint A)
  updateUserSignature: async (userId, signatureDataUrl) => {
    // บันทึกภาพ Base64 ลง IndexedDB ทันที
    const sigKey = `user_sig_${userId}`;
    try {
      await saveFile(sigKey, signatureDataUrl);
    } catch (e) {
      console.error('Failed to persist signature to IndexedDB:', e);
    }

    // อัปเดต State ภายใน Store
    const updatedUsers = (get().masterUsers || []).map(user => {
      if (user.id === userId || user.userId === userId) {
        return {
          ...user,
          signatureImage: signatureDataUrl,
          hasSignature: Boolean(signatureDataUrl),
          hasRegisteredSignature: Boolean(signatureDataUrl),
          updatedAt: new Date().toISOString(),
          lastSignatureUpdatedAt: new Date().toISOString()
        };
      }
      return user;
    });

    const userRoleObj = (u) => ({
      id: u.id,
      empId: u.empId || u.id,
      name: u.name,
      depts: u.affiliated_departments || u.depts,
      affiliated_departments: u.affiliated_departments || u.depts,
      department: u.primary_department || u.department,
      primary_department: u.primary_department || u.department,
      level: u.approval_level || u.level,
      approval_level: u.approval_level || u.level,
      signatureImage: u.signatureImage
    });

    const currentUser = get().currentUser;
    const updatedCurrentUser = (currentUser?.id === userId || currentUser?.userId === userId)
      ? { ...currentUser, signatureImage: signatureDataUrl, hasSignature: Boolean(signatureDataUrl), hasRegisteredSignature: Boolean(signatureDataUrl) }
      : currentUser;

    set({
      masterUsers: updatedUsers,
      currentUser: updatedCurrentUser,
      requestUsers: updatedUsers.map(userRoleObj),
      reviewUsers: updatedUsers.map(userRoleObj),
      approveUsers: updatedUsers.map(userRoleObj)
    });

    // บันทึก MasterUsers Array ล่าสุดลง IndexedDB (ตัดก้อน base64 ออก เพื่อรักษา metadata)
    try {
      const cleanUsers = updatedUsers.map(u => ({
        ...u,
        signatureImage: null // ป้องกันข้อมูลบวม ให้ดึงจาก user_sig_${userId} แยกต่างหาก
      }));
      await saveFile('master_users_persistent_data', cleanUsers);
    } catch (e) {
      console.error('Failed to sync masterUsers list:', e);
    }
  },

  // 3. ฟังก์ชัน Hydrate ประกอบร่างข้อมูลตอนเปิดเว็บ/Refresh (Blueprint A)
  hydrateMasterData: async () => {
    try {
      // 3.1 ดึงรายชื่อ MasterUsers ล่าสุดจาก IndexedDB
      const savedUsersRaw = await resolveRawFileBlob('master_users_persistent_data');
      let savedUsers = savedUsersRaw;
      if (typeof savedUsers === 'string') {
        try {
          savedUsers = JSON.parse(savedUsers);
        } catch {
          // not json string
        }
      }

      let baseUsers = get().masterUsers || [];

      if (savedUsers && Array.isArray(savedUsers) && savedUsers.length > 0) {
        // Saved data from IndexedDB takes precedence to prevent seed overwrite
        const savedMap = new Map();
        savedUsers.forEach(u => {
          const key = u.id || u.userId;
          if (key) savedMap.set(key, u);
        });

        // Start with saved users, and append any unedited initial seed users if not already present
        const mergedUsers = [...savedUsers];
        (baseUsers || []).forEach(seedUser => {
          const key = seedUser.id || seedUser.userId;
          if (key && !savedMap.has(key)) {
            mergedUsers.push(seedUser);
          }
        });
        baseUsers = mergedUsers;
      }

      // 3.2 ดึงภาพลายเซ็นเฉพาะตัวของแต่ละ User จาก IndexedDB มาประกอบคืน
      const hydratedUsers = await Promise.all(
        baseUsers.map(async (user) => {
          const userId = user.id || user.userId;
          const sigKey = `user_sig_${userId}`;
          let savedSig = await resolveRawFileBlob(sigKey);

          if (typeof Blob !== 'undefined' && savedSig instanceof Blob) {
            savedSig = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(savedSig);
            });
          }

          const finalSig = savedSig || user.signatureImage || null;
          return {
            ...user,
            signatureImage: finalSig,
            hasSignature: Boolean(finalSig),
            hasRegisteredSignature: Boolean(finalSig || user.hasRegisteredSignature)
          };
        })
      );

      const userRoleObj = (u) => ({
        id: u.id,
        empId: u.empId || u.id,
        name: u.name,
        depts: u.affiliated_departments || u.depts,
        affiliated_departments: u.affiliated_departments || u.depts,
        department: u.primary_department || u.department,
        primary_department: u.primary_department || u.department,
        level: u.approval_level || u.level,
        approval_level: u.approval_level || u.level,
        signatureImage: u.signatureImage
      });

      const current = get().currentUser;
      const updatedCurrentUser = current 
        ? (hydratedUsers.find(u => u.id === current.id || u.userId === current.id) 
            ? { ...current, ...(hydratedUsers.find(u => u.id === current.id || u.userId === current.id) || {}) } 
            : current)
        : current;

      set({
        masterUsers: hydratedUsers,
        currentUser: updatedCurrentUser,
        requestUsers: hydratedUsers.map(userRoleObj),
        reviewUsers: hydratedUsers.map(userRoleObj),
        approveUsers: hydratedUsers.map(userRoleObj),
        isHydrated: true
      });

      // Seed protection: If no savedUsers existed yet in IndexedDB, persist baseline
      if (!savedUsers || !Array.isArray(savedUsers) || savedUsers.length === 0) {
        const cleanUsers = hydratedUsers.map(u => ({ ...u, signatureImage: null }));
        await saveFile('master_users_persistent_data', cleanUsers);
      }

      console.log('✅ Master data & signatures hydrated successfully from IndexedDB');
    } catch (error) {
      console.error('Error hydrating master data from IndexedDB:', error);
      set({ isHydrated: true });
    }
  },

  // --- 2. Department Management Actions ---
  addDepartment: (deptData) => {
    try {
      set((state) => {
        const rawId = String(deptData?.id || deptData?.code || deptData?.deptCode || '').toUpperCase().trim();
        const rawNameTh = String(deptData?.nameTh || deptData?.name || deptData?.name_th || rawId).trim();
        const rawNameEn = String(deptData?.nameEn || deptData?.name_en || deptData?.name || rawId).trim();
        const headNameVal = deptData?.headName || deptData?.manager || '';

        if (!rawId) {
          throw new Error('รหัสแผนกไม่ถูกต้อง');
        }

        const newDept = {
          id: rawId,
          code: rawId,
          deptCode: rawId,
          name: rawNameTh,
          nameTh: rawNameTh,
          name_th: rawNameTh,
          nameEn: rawNameEn,
          name_en: rawNameEn,
          headUserId: deptData?.headUserId || '',
          headName: headNameVal,
          manager: headNameVal,
          status: deptData?.status || 'ACTIVE',
          color: deptData?.color || 'indigo'
        };

        const currentDepts = state.departments || state.masterDepartments || [];
        if (currentDepts.some(d => String(d.id || d.code || d.deptCode || '').toUpperCase().trim() === newDept.id)) {
          throw new Error(`รหัสแผนก "${newDept.id}" มีอยู่ในระบบแล้ว`);
        }

        const updatedDepts = [...currentDepts, newDept];
        return {
          departments: updatedDepts,
          masterDepartments: updatedDepts,
          actionLog: [{
            id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            actionType: 'MASTER_DEPT_CREATED',
            actor: state.currentUser?.name || 'DCC Officer',
            details: `Created department ${newDept.id} (${newDept.nameTh})`,
            timestamp: new Date().toISOString()
          }, ...(state.actionLog || [])]
        };
      });
      return true;
    } catch (err) {
      console.error('addDepartment error:', err);
      throw err;
    }
  },

  updateDepartment: (deptId, deptData) => {
    try {
      set((state) => {
        const currentDepts = state.departments || state.masterDepartments || [];
        const oldCode = String(deptId || deptData?.oldCode || '').trim().toUpperCase();
        const newCode = String(deptData?.id || deptData?.code || deptData?.deptCode || deptId || '').trim().toUpperCase();
        const isCodeChanged = Boolean(oldCode && newCode && oldCode !== newCode);

        if (!newCode) {
          throw new Error('รหัสแผนกไม่ถูกต้อง');
        }

        // Case-Insensitive Uniqueness Check (prevent duplicate department code)
        if (isCodeChanged) {
          const duplicateDept = currentDepts.find(d => {
            const existingCode = String(d.id || d.code || d.deptCode || '').trim().toUpperCase();
            const isSelf = existingCode === oldCode;
            return !isSelf && existingCode === newCode;
          });
          if (duplicateDept) {
            throw new Error(`รหัสแผนก "${newCode}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`);
          }
        }

        const headNameVal = deptData.headName !== undefined 
          ? deptData.headName 
          : (deptData.manager !== undefined ? deptData.manager : undefined);

        // 1. Update Departments Collection
        const updatedDepts = currentDepts.map(d => {
          const c = String(d.id || d.code || d.deptCode || '').trim().toUpperCase();
          if (c === oldCode) {
            return {
              ...d,
              ...deptData,
              id: newCode,
              code: newCode,
              deptCode: newCode,
              name: deptData.name || deptData.nameTh || d.name,
              nameTh: deptData.nameTh || deptData.name || d.nameTh,
              name_th: deptData.nameTh || deptData.name || d.name_th || d.nameTh,
              nameEn: deptData.nameEn !== undefined ? deptData.nameEn : (d.nameEn || d.name_en || ''),
              name_en: deptData.nameEn !== undefined ? deptData.nameEn : (d.name_en || d.nameEn || ''),
              headUserId: deptData.headUserId !== undefined ? deptData.headUserId : d.headUserId,
              headName: headNameVal !== undefined ? headNameVal : (d.headName || d.manager || ''),
              manager: headNameVal !== undefined ? headNameVal : (d.manager || d.headName || '')
            };
          }
          return d;
        });

    // If code has NOT changed, return simple single-collection update
    if (!isCodeChanged) {
      return {
        departments: updatedDepts,
        masterDepartments: updatedDepts,
        actionLog: [{
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actionType: 'MASTER_DEPT_UPDATED',
          actor: state.currentUser?.name || 'DCC Officer',
          details: `Updated department ${deptId}`,
          timestamp: new Date().toISOString()
        }, ...(state.actionLog || [])]
      };
    }

    // 2. Cascading Relational Propagation Engine (Atomic-like single set call)
    const matchDept = (val) => {
      if (!val) return false;
      if (typeof val === 'string') {
        return val.trim().toUpperCase() === oldCode;
      }
      if (typeof val === 'object') {
        const code = val.id || val.code || val.dept || val.department || val.departmentId;
        return typeof code === 'string' && code.trim().toUpperCase() === oldCode;
      }
      return false;
    };

    const replaceDeptString = (val) => {
      if (!val) return val;
      if (typeof val === 'string') {
        return val.trim().toUpperCase() === oldCode ? newCode : val;
      }
      return val;
    };

    // 2.1 Master Users & Participant lists
    const updateUsersCollection = (usersList) => {
      if (!Array.isArray(usersList)) return usersList;
      return usersList.map(u => {
        let changed = false;
        let updated = { ...u };
        if (matchDept(u.department)) { updated.department = newCode; changed = true; }
        if (matchDept(u.dept)) { updated.dept = newCode; changed = true; }
        if (matchDept(u.primary_department)) { updated.primary_department = newCode; changed = true; }
        if (matchDept(u.dept_code)) { updated.dept_code = newCode; changed = true; }
        if (Array.isArray(u.departments)) {
          updated.departments = u.departments.map(d => replaceDeptString(d));
          changed = true;
        }
        if (Array.isArray(u.secondaryDepartments)) {
          updated.secondaryDepartments = u.secondaryDepartments.map(d => replaceDeptString(d));
          changed = true;
        }
        if (Array.isArray(u.affiliated_departments)) {
          updated.affiliated_departments = u.affiliated_departments.map(d => replaceDeptString(d));
          changed = true;
        }
        if (Array.isArray(u.depts)) {
          updated.depts = u.depts.map(d => replaceDeptString(d));
          changed = true;
        }
        return changed ? updated : u;
      });
    };

    const updatedMasterUsers = updateUsersCollection(state.masterUsers);
    const updatedRequestUsers = updateUsersCollection(state.requestUsers);
    const updatedReviewUsers = updateUsersCollection(state.reviewUsers);
    const updatedApproveUsers = updateUsersCollection(state.approveUsers);

    // 2.2 Current Session User (Prevent privilege loss)
    let updatedCurrentUser = state.currentUser;
    if (state.currentUser) {
      let cuChanged = false;
      let newCu = { ...state.currentUser };
      if (matchDept(newCu.department)) { newCu.department = newCode; cuChanged = true; }
      if (matchDept(newCu.dept)) { newCu.dept = newCode; cuChanged = true; }
      if (matchDept(newCu.primary_department)) { newCu.primary_department = newCode; cuChanged = true; }
      if (matchDept(newCu.dept_code)) { newCu.dept_code = newCode; cuChanged = true; }
      if (Array.isArray(newCu.departments)) {
        newCu.departments = newCu.departments.map(d => replaceDeptString(d));
        cuChanged = true;
      }
      if (Array.isArray(newCu.secondaryDepartments)) {
        newCu.secondaryDepartments = newCu.secondaryDepartments.map(d => replaceDeptString(d));
        cuChanged = true;
      }
      if (Array.isArray(newCu.affiliated_departments)) {
        newCu.affiliated_departments = newCu.affiliated_departments.map(d => replaceDeptString(d));
        cuChanged = true;
      }
      if (Array.isArray(newCu.depts)) {
        newCu.depts = newCu.depts.map(d => replaceDeptString(d));
        cuChanged = true;
      }
      if (cuChanged) {
        updatedCurrentUser = newCu;
      }
    }

    // 2.3 Master Documents
    const updatedDocuments = (state.documents || []).map(doc => {
      let changed = false;
      let updated = { ...doc };

      if (matchDept(doc.department)) { updated.department = newCode; changed = true; }
      if (matchDept(doc.owner_dept)) { updated.owner_dept = newCode; changed = true; }
      if (matchDept(doc.dept)) { updated.dept = newCode; changed = true; }
      if (matchDept(doc.dept_code)) { updated.dept_code = newCode; changed = true; }

      if (Array.isArray(doc.controlledCopies)) {
        updated.controlledCopies = doc.controlledCopies.map(copy => {
          let copyChanged = false;
          let c = { ...copy };
          if (matchDept(c.department)) { c.department = newCode; copyChanged = true; }
          if (matchDept(c.holder_dept)) { c.holder_dept = newCode; copyChanged = true; }
          if (matchDept(c.dept)) { c.dept = newCode; copyChanged = true; }
          return copyChanged ? c : copy;
        });
        changed = true;
      }

      if (Array.isArray(doc.distributions)) {
        updated.distributions = doc.distributions.map(dist => {
          let distChanged = false;
          let d = { ...dist };
          if (matchDept(d.departmentId)) { d.departmentId = newCode; distChanged = true; }
          if (matchDept(d.department)) { d.department = newCode; distChanged = true; }
          if (matchDept(d.dept)) { d.dept = newCode; distChanged = true; }
          return distChanged ? d : dist;
        });
        changed = true;
      }
      if (Array.isArray(doc.distributed_depts)) {
        updated.distributed_depts = doc.distributed_depts.map(d => replaceDeptString(d));
        changed = true;
      }
      if (Array.isArray(doc.distributionTargets)) {
        updated.distributionTargets = doc.distributionTargets.map(d => replaceDeptString(d));
        changed = true;
      }

      if (doc.access_control && Array.isArray(doc.access_control.departments)) {
        updated.access_control = {
          ...doc.access_control,
          departments: doc.access_control.departments.map(d => replaceDeptString(d))
        };
        changed = true;
      }
      if (Array.isArray(doc.accessDepartments)) {
        updated.accessDepartments = doc.accessDepartments.map(d => replaceDeptString(d));
        changed = true;
      }

      return changed ? updated : doc;
    });

    // 2.4 Controlled Copies (Store Collections)
    const updateCopiesCollection = (copiesList) => {
      if (!Array.isArray(copiesList)) return copiesList;
      return copiesList.map(copy => {
        let changed = false;
        let c = { ...copy };
        if (matchDept(c.department)) { c.department = newCode; changed = true; }
        if (matchDept(c.holder_dept)) { c.holder_dept = newCode; changed = true; }
        if (matchDept(c.dept)) { c.dept = newCode; changed = true; }
        return changed ? c : copy;
      });
    };

    const updatedControlledCopyInstances = updateCopiesCollection(state.controlledCopyInstances);
    const updatedDocumentControlledCopies = updateCopiesCollection(state.documentControlledCopies);

    // 2.5 External Documents
    const updatedExternalDocuments = (state.externalDocuments || []).map(doc => {
      let changed = false;
      let updated = { ...doc };

      if (matchDept(doc.department)) { updated.department = newCode; changed = true; }
      if (matchDept(doc.dept)) { updated.dept = newCode; changed = true; }
      if (matchDept(doc.owner_dept)) { updated.owner_dept = newCode; changed = true; }

      if (Array.isArray(doc.distributions)) {
        updated.distributions = doc.distributions.map(dist => {
          let distChanged = false;
          let d = { ...dist };
          if (matchDept(d.departmentId)) { d.departmentId = newCode; distChanged = true; }
          if (matchDept(d.department)) { d.department = newCode; distChanged = true; }
          if (matchDept(d.dept)) { d.dept = newCode; distChanged = true; }
          return distChanged ? d : dist;
        });
        changed = true;
      }
      if (Array.isArray(doc.distributed_depts)) {
        updated.distributed_depts = doc.distributed_depts.map(d => replaceDeptString(d));
        changed = true;
      }
      if (Array.isArray(doc.accessDepartments)) {
        updated.accessDepartments = doc.accessDepartments.map(d => replaceDeptString(d));
        changed = true;
      }
      if (Array.isArray(doc.controlledCopies)) {
        updated.controlledCopies = doc.controlledCopies.map(copy => {
          let copyChanged = false;
          let c = { ...copy };
          if (matchDept(c.department)) { c.department = newCode; copyChanged = true; }
          if (matchDept(c.holder_dept)) { c.holder_dept = newCode; copyChanged = true; }
          if (matchDept(c.dept)) { c.dept = newCode; copyChanged = true; }
          return copyChanged ? c : copy;
        });
        changed = true;
      }

      return changed ? updated : doc;
    });

    // 2.6 DAR Workflow Records
    const updateDarsCollection = (darList) => {
      if (!Array.isArray(darList)) return darList;
      return darList.map(dar => {
        let changed = false;
        let updated = { ...dar };

        if (matchDept(dar.department)) { updated.department = newCode; changed = true; }
        if (matchDept(dar.requestingDepartment)) { updated.requestingDepartment = newCode; changed = true; }
        if (matchDept(dar.requesting_dept)) { updated.requesting_dept = newCode; changed = true; }
        if (matchDept(dar.dept)) { updated.dept = newCode; changed = true; }
        if (matchDept(dar.owner_dept)) { updated.owner_dept = newCode; changed = true; }
        if (matchDept(dar.targetDept)) { updated.targetDept = newCode; changed = true; }

        if (Array.isArray(dar.targetDepartments)) {
          updated.targetDepartments = dar.targetDepartments.map(d => replaceDeptString(d));
          changed = true;
        }
        if (Array.isArray(dar.distributions)) {
          updated.distributions = dar.distributions.map(dist => {
            let distChanged = false;
            let d = { ...dist };
            if (matchDept(d.departmentId)) { d.departmentId = newCode; distChanged = true; }
            if (matchDept(d.department)) { d.department = newCode; distChanged = true; }
            if (matchDept(d.dept)) { d.dept = newCode; distChanged = true; }
            return distChanged ? d : dist;
          });
          changed = true;
        }
        if (Array.isArray(dar.distributed_depts)) {
          updated.distributed_depts = dar.distributed_depts.map(d => replaceDeptString(d));
          changed = true;
        }

        return changed ? updated : dar;
      });
    };

    const updatedDars = updateDarsCollection(state.dars);
    const updatedDarRequests = updateDarsCollection(state.darRequests);

    // 2.7 Tasks Collections
    const updateTasksCollection = (taskList) => {
      if (!Array.isArray(taskList)) return taskList;
      return taskList.map(task => {
        let changed = false;
        let updated = { ...task };

        if (matchDept(task.department)) { updated.department = newCode; changed = true; }
        if (matchDept(task.dept)) { updated.dept = newCode; changed = true; }
        if (matchDept(task.assignedToDept)) { updated.assignedToDept = newCode; changed = true; }
        if (matchDept(task.assignee_dept)) { updated.assignee_dept = newCode; changed = true; }
        if (matchDept(task.target_department)) { updated.target_department = newCode; changed = true; }
        if (matchDept(task.targetDepartment)) { updated.targetDepartment = newCode; changed = true; }
        if (matchDept(task.currentHandlerDepartment)) { updated.currentHandlerDepartment = newCode; changed = true; }
        if (matchDept(task.requester_dept)) { updated.requester_dept = newCode; changed = true; }
        if (matchDept(task.owner_dept)) { updated.owner_dept = newCode; changed = true; }

        return changed ? updated : task;
      });
    };

    const updatedTasks = updateTasksCollection(state.tasks);
    const updatedPeriodicReviewTasks = updateTasksCollection(state.periodicReviewTasks);

    // 2.8 Approval Matrix
    const updateMatrixCollection = (matrixList) => {
      if (!Array.isArray(matrixList)) return matrixList;
      return matrixList.map(entry => {
        let changed = false;
        let updated = { ...entry };
        if (matchDept(entry.departmentId)) { updated.departmentId = newCode; changed = true; }
        if (matchDept(entry.department)) { updated.department = newCode; changed = true; }
        if (matchDept(entry.dept)) { updated.dept = newCode; changed = true; }
        return changed ? updated : entry;
      });
    };

    const updatedApprovalMatrix = updateMatrixCollection(state.approvalMatrix);
    const updatedApprovalMatrixAlt = updateMatrixCollection(state.approval_matrix);

    // 2.9 Distribution Locations & Copy Requests
    const updatedLocations = (state.distributionLocations || []).map(loc => {
      let changed = false;
      let updated = { ...loc };
      if (matchDept(loc.departmentId)) { updated.departmentId = newCode; changed = true; }
      if (matchDept(loc.department)) { updated.department = newCode; changed = true; }
      if (matchDept(loc.dept)) { updated.dept = newCode; changed = true; }
      return changed ? updated : loc;
    });

    const updatedCopyRequests = (state.copyRequests || []).map(req => {
      let changed = false;
      let updated = { ...req };
      if (matchDept(req.department)) { updated.department = newCode; changed = true; }
      if (matchDept(req.dept)) { updated.dept = newCode; changed = true; }
      if (matchDept(req.requesting_dept)) { updated.requesting_dept = newCode; changed = true; }
      return changed ? updated : req;
    });

    // Return all cascaded collections in a single atomic state batch
    return {
      departments: updatedDepts,
      masterDepartments: updatedDepts,
      masterUsers: updatedMasterUsers,
      requestUsers: updatedRequestUsers,
      reviewUsers: updatedReviewUsers,
      approveUsers: updatedApproveUsers,
      currentUser: updatedCurrentUser,
      documents: updatedDocuments,
      controlledCopyInstances: updatedControlledCopyInstances,
      documentControlledCopies: updatedDocumentControlledCopies,
      externalDocuments: updatedExternalDocuments,
      dars: updatedDars,
      darRequests: updatedDarRequests,
      tasks: updatedTasks,
      periodicReviewTasks: updatedPeriodicReviewTasks,
      approvalMatrix: updatedApprovalMatrix,
      approval_matrix: updatedApprovalMatrixAlt,
      distributionLocations: updatedLocations,
      copyRequests: updatedCopyRequests,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_DEPT_UPDATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Updated department ${oldCode} to ${newCode} with cascading relational propagation`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  });
  return true;
} catch (err) {
  console.error('updateDepartment error:', err);
  throw err;
}
},

  // --- 2.1 Department Dependency Pre-check & Deactivation ---
  checkDepartmentDependencies: (targetDeptId) => {
    const state = get();
    const allDocs = state.documents || [];
    const activeDocs = allDocs.filter(d => 
      (d.department === targetDeptId || d.owner_dept === targetDeptId) && 
      (d.status === 'EFFECTIVE' || d.status === 'ACTIVE')
    );

    const instances = state.controlledCopyInstances || [];
    const docCopies = state.documentControlledCopies || [];
    const copyList = instances.length > 0 ? instances : docCopies;
    const activeCopies = copyList.filter(c => 
      (c.holder_dept === targetDeptId || c.department === targetDeptId) && 
      (c.status === 'ACTIVE' || c.status === 'RECEIVED')
    );

    const allTasks = state.tasks || [];
    const pendingTasks = allTasks.filter(t => 
      (t.target_department === targetDeptId || t.department === targetDeptId || t.dept === targetDeptId) && 
      t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    );

    const allUsers = state.masterUsers || [];
    const affectedUsers = [];
    allUsers.forEach(u => {
      const primary = u.primary_department || u.department || u.dept;
      const affiliated = Array.isArray(u.affiliated_departments) ? u.affiliated_departments : (Array.isArray(u.depts) ? u.depts : []);
      const uniqueDepts = Array.from(new Set([primary, ...affiliated].filter(Boolean)));
      if (uniqueDepts.includes(targetDeptId)) {
        const remainingDepts = uniqueDepts.filter(d => d !== targetDeptId);
        const isSingleDept = remainingDepts.length === 0;
        affectedUsers.push({
          ...u,
          isSingleDept,
          remainingDepts,
          currentPrimary: primary,
          nextPrimary: isSingleDept ? null : (primary === targetDeptId ? remainingDepts[0] : primary)
        });
      }
    });

    const isCoreDept = SYSTEM_CORE_DEPTS.includes(targetDeptId);

    return {
      targetDeptId,
      isCoreDept,
      activeDocsCount: activeDocs.length,
      activeCopiesCount: activeCopies.length,
      pendingTasksCount: pendingTasks.length,
      affectedUsers,
      activeDocs,
      activeCopies,
      pendingTasks
    };
  },

  deactivateDepartment: (targetDeptId, fallbackDepartmentId) => {
    const state = get();

    // Guardrail 1: System Core Departments Guard
    if (SYSTEM_CORE_DEPTS.includes(targetDeptId)) {
      throw new Error(`แผนก "${targetDeptId}" เป็นแผนกหลักของระบบควบคุมคุณภาพและเอกสาร (System Core Department) ไม่อนุญาตให้ระงับการใช้งาน`);
    }

    // Guardrail 2: Dependency Pre-check (Active Docs, Active Copies, Pending Tasks)
    const check = get().checkDepartmentDependencies(targetDeptId);
    if (check.activeDocsCount > 0 || check.activeCopiesCount > 0 || check.pendingTasksCount > 0) {
      const reasons = [];
      if (check.activeDocsCount > 0) reasons.push(`เอกสารแม่บทที่มีผลบังคับใช้ ${check.activeDocsCount} รายการ`);
      if (check.activeCopiesCount > 0) reasons.push(`สำเนาควบคุมถือครองจริง ${check.activeCopiesCount} เล่ม`);
      if (check.pendingTasksCount > 0) reasons.push(`งานคงค้างในระบบ ${check.pendingTasksCount} รายการ`);
      throw new Error(`ไม่สามารถระงับแผนก "${targetDeptId}" ได้เนื่องจากมีภาระผูกพันคงค้าง: ${reasons.join(', ')}`);
    }

    // Guardrail 3: Single-dept Users Fallback Validation
    const singleDeptUsers = check.affectedUsers.filter(u => u.isSingleDept);
    if (singleDeptUsers.length > 0) {
      if (!fallbackDepartmentId) {
        throw new Error(`กรุณาระบุแผนกใหม่ (Fallback Department) สำหรับย้ายพนักงานที่ไม่มีแผนกรอง (${singleDeptUsers.length} คน)`);
      }
      if (fallbackDepartmentId === targetDeptId) {
        throw new Error(`แผนกใหม่ต้องไม่ใช่แผนกที่กำลังจะถูกระงับการใช้งาน`);
      }
      const availableDepts = state.departments || state.masterDepartments || [];
      const targetFallback = availableDepts.find(d => d.id === fallbackDepartmentId);
      if (!targetFallback || targetFallback.status === 'INACTIVE') {
        throw new Error(`แผนกปลายทาง "${fallbackDepartmentId}" ไม่พร้อมใช้งานหรือถูกระงับอยู่`);
      }
    }

    // User Re-assignment Handling
    const migrateUser = (u) => {
      const primary = u.primary_department || u.department || u.dept;
      const affiliated = Array.isArray(u.affiliated_departments) ? u.affiliated_departments : (Array.isArray(u.depts) ? u.depts : []);
      const uniqueDepts = Array.from(new Set([primary, ...affiliated].filter(Boolean)));
      if (!uniqueDepts.includes(targetDeptId)) return u;

      const remainingDepts = uniqueDepts.filter(d => d !== targetDeptId);
      if (remainingDepts.length > 0) {
        // Multi-dept user: remove targetDeptId, shift primary if needed
        const newPrimary = (primary === targetDeptId) ? remainingDepts[0] : primary;
        return {
          ...u,
          primary_department: newPrimary,
          department: newPrimary,
          dept: newPrimary,
          affiliated_departments: remainingDepts,
          depts: remainingDepts
        };
      } else {
        // Single-dept user: re-assign to fallbackDepartmentId
        return {
          ...u,
          primary_department: fallbackDepartmentId,
          department: fallbackDepartmentId,
          dept: fallbackDepartmentId,
          affiliated_departments: [fallbackDepartmentId],
          depts: [fallbackDepartmentId]
        };
      }
    };

    const updatedMasterUsers = (state.masterUsers || []).map(migrateUser);
    const updatedRequestUsers = (state.requestUsers || []).map(migrateUser);
    const updatedReviewUsers = (state.reviewUsers || []).map(migrateUser);
    const updatedApproveUsers = (state.approveUsers || []).map(migrateUser);
    const updatedCurrentUser = state.currentUser ? migrateUser(state.currentUser) : state.currentUser;

    // Department Status & Lead Cleanup
    const currentDepts = state.departments || state.masterDepartments || [];
    const updatedDepts = currentDepts.map(d => {
      if (d.id === targetDeptId) {
        return {
          ...d,
          status: 'INACTIVE',
          headUserId: '',
          headName: 'ยังไม่ได้กำหนด (ระงับการใช้งานแล้ว)'
        };
      }
      return d;
    });

    set({
      masterUsers: updatedMasterUsers,
      requestUsers: updatedRequestUsers,
      reviewUsers: updatedReviewUsers,
      approveUsers: updatedApproveUsers,
      currentUser: updatedCurrentUser,
      departments: updatedDepts,
      masterDepartments: updatedDepts,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_DEPT_DEACTIVATED',
        actor: state.currentUser?.name || 'DCC Admin',
        details: `Deactivated department ${targetDeptId}. Reassigned ${check.affectedUsers.length} user(s). Fallback: ${fallbackDepartmentId || 'N/A'}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    });

    return {
      success: true,
      targetDeptId,
      migratedUsersCount: check.affectedUsers.length
    };
  },

  reactivateDepartment: (deptId) => set((state) => {
    const currentDepts = state.departments || state.masterDepartments || [];
    const updatedDepts = currentDepts.map(d => {
      if (d.id === deptId) {
        return {
          ...d,
          status: 'ACTIVE',
          headName: d.headName === 'ยังไม่ได้กำหนด (ระงับการใช้งานแล้ว)' ? 'ยังไม่ได้กำหนด' : d.headName
        };
      }
      return d;
    });

    return {
      departments: updatedDepts,
      masterDepartments: updatedDepts,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_DEPT_REACTIVATED',
        actor: state.currentUser?.name || 'DCC Admin',
        details: `Reactivated department ${deptId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  toggleDepartmentStatus: (deptId) => {
    const state = get();
    const currentDepts = state.departments || state.masterDepartments || [];
    const targetDept = currentDepts.find(d => d.id === deptId);
    if (!targetDept) return;

    if (targetDept.status === 'INACTIVE') {
      get().reactivateDepartment(deptId);
    } else {
      // Find a safe fallback if possible, else throws if single-dept exists
      const availableFallback = currentDepts.find(d => d.id !== deptId && d.status !== 'INACTIVE');
      get().deactivateDepartment(deptId, availableFallback?.id);
    }
  },

  // --- 3. Document Type Actions ---
        // --- 4. Point-of-Use Locations (Matrix) Actions ---
  addMasterStation: (departmentId, stationData) => {
    let created = null;
    set((state) => {
      const stationName = typeof stationData === 'string' ? stationData : stationData?.name || '';
      const cleanName = cleanLocationName(stationName.trim());
      const newStation = {
        id: (stationData && typeof stationData === 'object' && stationData.id) 
          ? stationData.id 
          : `STATION-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        code: (stationData && typeof stationData === 'object' && stationData.code) || `STATION-${Date.now().toString().slice(-4)}`,
        departmentId: departmentId,
        isCustom: true,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        ...(typeof stationData === 'object' ? stationData : {})
      };
      newStation.name = cleanName;
      newStation.departmentId = departmentId;
      newStation.isCustom = true;
      newStation.status = 'ACTIVE';
      created = newStation;

      const currentLocs = state.distributionLocations || [];
      const updatedLocs = [...currentLocs, newStation];

      return {
        distributionLocations: updatedLocs,
        actionLog: [{
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actionType: 'MASTER_STATION_CREATED',
          actor: state.currentUser?.name || 'Requester',
          details: `Created new point-of-use station "${newStation.name}" in department ${departmentId}`,
          timestamp: new Date().toISOString()
        }, ...(state.actionLog || [])]
      };
    });
    return created;
  },

  addDistributionLocation: (locData) => set((state) => {
    const newLoc = {
      id: locData.id || `${locData.departmentId}-${Date.now().toString().slice(-4)}`,
      departmentId: locData.departmentId,
      name: cleanLocationName(locData.name),
      code: locData.code || locData.id,
      isMasterOffice: Boolean(locData.isMasterOffice),
      description: locData.description || '',
      status: locData.status || 'ACTIVE'
    };

    const currentLocs = state.distributionLocations || [];
    const updatedLocs = [...currentLocs, newLoc];

    return {
      distributionLocations: updatedLocs,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_LOCATION_CREATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Created station ${newLoc.name} (${newLoc.id}) in ${newLoc.departmentId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  updateDistributionLocation: (locId, locData) => set((state) => {
    const currentLocs = state.distributionLocations || [];
    const updatedLocs = currentLocs.map(l => {
      if (l.id === locId) {
        return {
          ...l,
          ...locData,
          isMasterOffice: locData.isMasterOffice !== undefined ? Boolean(locData.isMasterOffice) : l.isMasterOffice
        };
      }
      return l;
    });

    return {
      distributionLocations: updatedLocs,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_LOCATION_UPDATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Updated station ${locId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  toggleLocationStatus: (locId) => set((state) => {
    const currentLocs = state.distributionLocations || [];
    const updatedLocs = currentLocs.map(l => {
      if (l.id === locId) {
        return { ...l, status: l.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' };
      }
      return l;
    });

    return {
      distributionLocations: updatedLocs
    };
  }),

  deleteDistributionLocation: (locId) => {
    const state = get();
    const allCopies = (state.controlledCopyInstances && state.controlledCopyInstances.length > 0)
      ? state.controlledCopyInstances
      : (state.documentControlledCopies || []);
    
    // Check if any copy is actively using or pending receipt/recall at this location
    const activeAttachedCopy = allCopies.find(c => 
      (c.location_id === locId || c.locationId === locId || c.location === locId) &&
      (c.status === 'ISSUED_ACTIVE' || c.status === 'ACTIVE' || c.status === 'PENDING_ISSUE' || c.status === 'DISPATCHED_PENDING_RECEIPT')
    );

    if (activeAttachedCopy) {
      throw new Error(`ไม่สามารถลบจุดใช้งานนี้ได้ เนื่องจากมีสำเนาควบคุม (${activeAttachedCopy.doc_code || activeAttachedCopy.docTitle} - Copy ${activeAttachedCopy.copy_no || activeAttachedCopy.ccNumber}) ใช้งานอยู่จริงหน้างาน (กรุณาเปลี่ยนสถานะเป็น Inactive แทน)`);
    }

    set(state => ({
      distributionLocations: (state.distributionLocations || []).filter(l => l.id !== locId),
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_LOCATION_DELETED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Deleted point-of-use station ${locId}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    }));
    return true;
  },

  // --- 5. Settings Actions ---
  updateSignatureSettings: (settings) => set((state) => ({
    signatureSettings: { ...(state.signatureSettings || DEFAULT_SIGNATURE_SETTINGS), ...settings },
    actionLog: [{
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actionType: 'MASTER_SIGNATURE_SETTINGS_UPDATED',
      actor: state.currentUser?.name || 'DCC Officer',
      details: 'Updated e-signature security policies',
      timestamp: new Date().toISOString()
    }, ...(state.actionLog || [])]
  })),

  updateSlaSettings: (settings) => set((state) => ({
    slaSettings: { ...(state.slaSettings || DEFAULT_SLA_SETTINGS), ...settings },
    actionLog: [{
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actionType: 'MASTER_SLA_SETTINGS_UPDATED',
      actor: state.currentUser?.name || 'DCC Officer',
      details: 'Updated workflow SLA thresholds',
      timestamp: new Date().toISOString()
    }, ...(state.actionLog || [])]
  })),

  updateApprovalMatrix: (matrix) => set((state) => ({
    approvalMatrix: matrix,
    approval_matrix: matrix,
    actionLog: [{
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actionType: 'MASTER_APPROVAL_MATRIX_UPDATED',
      actor: state.currentUser?.name || 'DCC Officer',
      details: 'Updated approval routing matrix by document type',
      timestamp: new Date().toISOString()
    }, ...(state.actionLog || [])]
  })),

  updateApprovalMatrixEntry: (docType, entryData) => set((state) => {
    const current = state.approvalMatrix || DEFAULT_APPROVAL_MATRIX;
    const exists = current.some(item => (item.docType || item.doc_type) === docType);
    let updated;
    if (exists) {
      updated = current.map(item => {
        if ((item.docType || item.doc_type) === docType) {
          const minReq = entryData.minRequesterLevel ?? entryData.min_requester_level ?? item.minRequesterLevel ?? item.min_requester_level ?? 1;
          const reqRev = entryData.requiredReviewerLevel ?? entryData.required_reviewer_level ?? item.requiredReviewerLevel ?? item.required_reviewer_level ?? 4;
          const reqApp = entryData.requiredApproverLevel ?? entryData.required_approver_level ?? item.requiredApproverLevel ?? item.required_approver_level ?? 6;
          const reqAck = Boolean(entryData.requireAckDefault ?? entryData.require_ack_default ?? item.requireAckDefault ?? item.require_ack_default ?? false);
          
          return {
            ...item,
            ...entryData,
            docType,
            doc_type: docType,
            minRequesterLevel: minReq,
            min_requester_level: minReq,
            requiredReviewerLevel: reqRev,
            required_reviewer_level: reqRev,
            requiredApproverLevel: reqApp,
            required_approver_level: reqApp,
            requireAckDefault: reqAck,
            require_ack_default: reqAck
          };
        }
        return item;
      });
    } else {
      const minReq = entryData.minRequesterLevel ?? entryData.min_requester_level ?? 1;
      const reqRev = entryData.requiredReviewerLevel ?? entryData.required_reviewer_level ?? 4;
      const reqApp = entryData.requiredApproverLevel ?? entryData.required_approver_level ?? 5;
      const reqAck = Boolean(entryData.requireAckDefault ?? entryData.require_ack_default ?? false);
      const newEntry = {
        docType,
        doc_type: docType,
        ...entryData,
        minRequesterLevel: minReq,
        min_requester_level: minReq,
        requiredReviewerLevel: reqRev,
        required_reviewer_level: reqRev,
        requiredApproverLevel: reqApp,
        required_approver_level: reqApp,
        requireAckDefault: reqAck,
        require_ack_default: reqAck
      };
      updated = [...current, newEntry];
    }

    return {
      approvalMatrix: updated,
      approval_matrix: updated,
      actionLog: [{
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'MASTER_APPROVAL_MATRIX_ENTRY_UPDATED',
        actor: state.currentUser?.name || 'DCC Officer',
        details: `Updated approval routing matrix entry for document type ${docType}`,
        timestamp: new Date().toISOString()
      }, ...(state.actionLog || [])]
    };
  }),

  // Expose Setters for Demo Data Loader
  setTasks: (tasks) => set({ tasks }),
    setTimeline: (timeline) => set({ timeline })
}), {
  name: 'qms-enterprise-storage',
  version: 5,
  migrate: (persistedState, version) => {
    if (!version || version < 5) {
      if (Array.isArray(persistedState.controlledCopyInstances) || Array.isArray(persistedState.documentControlledCopies)) {
        const rawCopies = persistedState.controlledCopyInstances || persistedState.documentControlledCopies || [];
        const cleanedCopies = sanitizeControlledCopies(rawCopies);
        persistedState.controlledCopyInstances = cleanedCopies;
        persistedState.documentControlledCopies = cleanedCopies;
        if (Array.isArray(persistedState.controlledCopies)) {
          persistedState.controlledCopies = cleanedCopies;
        }
      }
    }
    if (!version || version < 4) {
      if (persistedState.masterUsers && Array.isArray(persistedState.masterUsers)) {
        persistedState.masterUsers = persistedState.masterUsers.map(u => {
          const defaultUser = MASTER_DATA_USER.find(m => m.id === u.id);
          return {
            ...u,
            signatureImage: u.signatureImage || defaultUser?.signatureImage || '',
            hasRegisteredSignature: u.hasRegisteredSignature ?? defaultUser?.hasRegisteredSignature ?? true,
            permissions: (u.permissions && u.permissions.length > 0) ? u.permissions : ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'],
            canCreateDar: u.canCreateDar ?? true,
            canAccessTasks: u.canAccessTasks ?? true,
            canViewRegister: u.canViewRegister ?? true,
            isWorkflowUser: u.isWorkflowUser ?? true
          };
        });
        const userRoleObj = (u) => ({
          id: u.id,
          empId: u.empId || u.id,
          name: u.name,
          depts: u.affiliated_departments || u.depts,
          affiliated_departments: u.affiliated_departments || u.depts,
          department: u.primary_department || u.department,
          primary_department: u.primary_department || u.department,
          level: u.approval_level || u.level,
          approval_level: u.approval_level || u.level
        });
        persistedState.requestUsers = persistedState.masterUsers.map(userRoleObj);
        persistedState.reviewUsers = [...persistedState.requestUsers];
        persistedState.approveUsers = [...persistedState.requestUsers];
      }
      if (persistedState.currentUser) {
        persistedState.currentUser = {
          ...persistedState.currentUser,
          permissions: (persistedState.currentUser.permissions && persistedState.currentUser.permissions.length > 0) ? persistedState.currentUser.permissions : ['DAR_CREATE', 'TASK_ACCESS', 'VIEW_REGISTER'],
          canCreateDar: persistedState.currentUser.canCreateDar ?? true,
          canAccessTasks: persistedState.currentUser.canAccessTasks ?? true,
          canViewRegister: persistedState.currentUser.canViewRegister ?? true,
          isWorkflowUser: persistedState.currentUser.isWorkflowUser ?? true
        };
      }
    }
    if (!version || version < 3) {
      // Force refresh of master users, departments, and default active user to Thanawut (EMP-001)
      persistedState.masterUsers = MASTER_DATA_USER;
      persistedState.masterDepartments = MASTER_DEPARTMENTS;
      persistedState.departments = MASTER_DEPARTMENTS;
      persistedState.currentUser = { ...MASTER_DATA_USER[0] };
    }
    if (version < 2 || !version) {
      // Clean slate migration: purge all mock transactions while preserving master data
      persistedState.tasks = [];
      persistedState.dars = [];
      persistedState.darRequests = [];
      persistedState.timeline = [];
      persistedState.actionLog = [];
      persistedState.notifications = [];
      persistedState.documents = [];
      persistedState.externalDocuments = [];
      persistedState.documentControlledCopies = [];
      persistedState.controlledCopyInstances = [];
      persistedState.controlledCopyAuditTrail = [];
      persistedState.periodicReviewSchedules = [];
      persistedState.periodicReviewTasks = [];
      persistedState.periodicReviewRecords = [];
      persistedState.distributionLogs = [];
      persistedState.acknowledgments = [];
      persistedState.darHistory = [];
    }

    // Eradicate legacy 'DCC' department code and migrate task departments to owner department
    if (persistedState.tasks && Array.isArray(persistedState.tasks)) {
      const persistedDars = persistedState.dars || [];
      const persistedDocs = persistedState.documents || [];
      persistedState.tasks = persistedState.tasks.map(t => {
        if (!t) return t;
        let updated = { ...t };
        if (updated.target_department === 'DCC') updated.target_department = 'DC';
        if (updated.targetDepartment === 'DCC') updated.targetDepartment = 'DC';
        if (updated.department === 'DCC') updated.department = 'DC';
        if (updated.dept === 'DCC') updated.dept = 'DC';
        if (updated.assignedToDept === 'DCC') updated.assignedToDept = 'DC';
        if (updated.destinationDept === 'DCC') updated.destinationDept = 'DC';
        if (updated.currentHandlerDepartment === 'DCC') updated.currentHandlerDepartment = 'DC';

        // Data Migration: Ensure task.department is strictly bound to document/DAR owner department
        const docCode = updated.doc_code || updated.docCode || updated.document_code || '';
        const docId = updated.docId || updated.doc_id;
        const matchedDoc = persistedDocs.find(d => 
          (docId && String(d.id) === String(docId)) ||
          (docCode && (d.title === docCode || d.document_code === docCode || d.code === docCode))
        );
        const matchedDar = persistedDars.find(d => String(d.id) === String(updated.darId));
        let ownerDept = matchedDar?.department || matchedDoc?.department;
        if (!ownerDept) {
          if (String(docCode).includes('-PD-') || String(updated.title).includes('-PD-') || String(updated.darId).includes('-PD-')) {
            ownerDept = 'PD';
          }
        }
        if (ownerDept) {
          const cleanDept = ownerDept === 'DCC' ? 'DC' : ownerDept;
          updated.department = cleanDept;
          updated.target_department = cleanDept;
          updated.owner_dept = cleanDept;
          updated.currentHandlerDepartment = cleanDept;
        }
        return updated;
      });
    }
    if (persistedState.currentUser) {
      if (persistedState.currentUser.department === 'DCC') persistedState.currentUser.department = 'DC';
      if (persistedState.currentUser.primary_department === 'DCC') persistedState.currentUser.primary_department = 'DC';
      if (persistedState.currentUser.dept === 'DCC') persistedState.currentUser.dept = 'DC';
      if (Array.isArray(persistedState.currentUser.affiliated_departments)) {
        persistedState.currentUser.affiliated_departments = Array.from(new Set(persistedState.currentUser.affiliated_departments.map(d => d === 'DCC' ? 'DC' : d)));
      }
      if (Array.isArray(persistedState.currentUser.depts)) {
        persistedState.currentUser.depts = Array.from(new Set(persistedState.currentUser.depts.map(d => d === 'DCC' ? 'DC' : d)));
      }

      // Auto-Healing Migration: Migrate QA/QC to QC for currentUser
      const isQaQc = (d) => typeof d === 'string' && (d === 'QA/QC' || d.includes('QA/QC'));
      const replaceQaQc = (d) => isQaQc(d) ? 'QC' : d;
      if (isQaQc(persistedState.currentUser.department) || isQaQc(persistedState.currentUser.primary_department)) {
        persistedState.currentUser.department = 'QC';
        persistedState.currentUser.dept = 'QC';
        persistedState.currentUser.primary_department = 'QC';
        persistedState.currentUser.primaryDepartment = 'QC';
        if (Array.isArray(persistedState.currentUser.affiliated_departments)) {
          persistedState.currentUser.affiliated_departments = Array.from(new Set(persistedState.currentUser.affiliated_departments.map(replaceQaQc)));
        }
        if (Array.isArray(persistedState.currentUser.depts)) {
          persistedState.currentUser.depts = Array.from(new Set(persistedState.currentUser.depts.map(replaceQaQc)));
        }
        if (Array.isArray(persistedState.currentUser.departments)) {
          persistedState.currentUser.departments = Array.from(new Set(persistedState.currentUser.departments.map(replaceQaQc)));
        }
        if (Array.isArray(persistedState.currentUser.departmentMemberships)) {
          persistedState.currentUser.departmentMemberships = Array.from(new Set(persistedState.currentUser.departmentMemberships.map(replaceQaQc)));
        }
      }
    }

    if (persistedState.masterUsers && Array.isArray(persistedState.masterUsers)) {
      const isQaQc = (d) => typeof d === 'string' && (d === 'QA/QC' || d.includes('QA/QC'));
      const replaceQaQc = (d) => isQaQc(d) ? 'QC' : d;
      persistedState.masterUsers = persistedState.masterUsers.map(u => {
        if (isQaQc(u.department) || isQaQc(u.primary_department)) {
          return {
            ...u,
            department: 'QC',
            dept: 'QC',
            primary_department: 'QC',
            primaryDepartment: 'QC',
            departments: Array.isArray(u.departments) ? Array.from(new Set(u.departments.map(replaceQaQc))) : ['QC'],
            departmentMemberships: Array.isArray(u.departmentMemberships) ? Array.from(new Set(u.departmentMemberships.map(replaceQaQc))) : ['QC'],
            depts: Array.isArray(u.depts) ? Array.from(new Set(u.depts.map(replaceQaQc))) : ['QC'],
            affiliated_departments: Array.isArray(u.affiliated_departments) ? Array.from(new Set(u.affiliated_departments.map(replaceQaQc))) : ['QC'],
            secondaryDepartments: Array.isArray(u.secondaryDepartments) ? u.secondaryDepartments.map(replaceQaQc).filter(d => d !== 'QC') : []
          };
        }
        return u;
      });
    }

    return persistedState;
  },
  onRehydrateStorage: () => (state, error) => {
    if (error) {
      console.error('[Storage] Storage rehydration error:', error);
      return;
    }

    // 0. Master Data & Signature Asset Hydration Lifecycle from IndexedDB
    if (state && typeof state.hydrateMasterData === 'function') {
      state.hydrateMasterData();
    }

    // Auto-Healing Migration for currentUser on app boot
    if (state && state.currentUser) {
      const cu = state.currentUser;
      const isQaQc = (d) => typeof d === 'string' && (d === 'QA/QC' || d.includes('QA/QC'));
      const replaceQaQc = (d) => isQaQc(d) ? 'QC' : d;
      if (isQaQc(cu.department) || isQaQc(cu.primary_department)) {
        useStore.setState({
          currentUser: {
            ...cu,
            department: 'QC',
            dept: 'QC',
            primary_department: 'QC',
            primaryDepartment: 'QC',
            departments: Array.isArray(cu.departments) ? Array.from(new Set(cu.departments.map(replaceQaQc))) : ['QC'],
            departmentMemberships: Array.isArray(cu.departmentMemberships) ? Array.from(new Set(cu.departmentMemberships.map(replaceQaQc))) : ['QC'],
            depts: Array.isArray(cu.depts) ? Array.from(new Set(cu.depts.map(replaceQaQc))) : ['QC'],
            affiliated_departments: Array.isArray(cu.affiliated_departments) ? Array.from(new Set(cu.affiliated_departments.map(replaceQaQc))) : ['QC'],
            secondaryDepartments: Array.isArray(cu.secondaryDepartments) ? cu.secondaryDepartments.map(replaceQaQc).filter(d => d !== 'QC') : []
          }
        });
      }
    }

    if (state && state.tasks && Array.isArray(state.tasks)) {
      let hasChange = false;
      const safeDars = state.dars || [];
      const safeDocs = state.documents || [];
      const cleaned = state.tasks.map(t => {
        if (!t) return t;
        let updated = { ...t };
        let changed = false;
        if (
          t.target_department === 'DCC' ||
          t.targetDepartment === 'DCC' ||
          t.department === 'DCC' ||
          t.dept === 'DCC' ||
          t.assignedToDept === 'DCC' ||
          t.destinationDept === 'DCC' ||
          t.currentHandlerDepartment === 'DCC'
        ) {
          changed = true;
          updated.target_department = t.target_department === 'DCC' ? 'DC' : t.target_department;
          updated.targetDepartment = t.targetDepartment === 'DCC' ? 'DC' : t.targetDepartment;
          updated.department = t.department === 'DCC' ? 'DC' : t.department;
          updated.dept = t.dept === 'DCC' ? 'DC' : t.dept;
          updated.assignedToDept = t.assignedToDept === 'DCC' ? 'DC' : t.assignedToDept;
          updated.destinationDept = t.destinationDept === 'DCC' ? 'DC' : t.destinationDept;
          updated.currentHandlerDepartment = t.currentHandlerDepartment === 'DCC' ? 'DC' : t.currentHandlerDepartment;
        }

        // Fix task department scoping (e.g. PD tasks like DAR-2026-002 / SOP-PD-01)
        const docCode = updated.doc_code || updated.docCode || updated.document_code || '';
        const docId = updated.docId || updated.doc_id;
        const matchedDoc = safeDocs.find(d => 
          (docId && String(d.id) === String(docId)) ||
          (docCode && (d.title === docCode || d.document_code === docCode || d.code === docCode))
        );
        const matchedDar = safeDars.find(d => String(d.id) === String(updated.darId));
        let ownerDept = matchedDar?.department || matchedDoc?.department;
        if (!ownerDept) {
          if (String(docCode).includes('-PD-') || String(updated.title).includes('-PD-') || String(updated.darId).includes('-PD-')) {
            ownerDept = 'PD';
          }
        }
        
        const isDccTask = isDccExclusiveTask(updated) || isDccOperationalTask(updated);
        const isReceipt = isReceiptTask(updated);
        if (isDccTask) {
          if (updated.department !== 'DC' || updated.target_department !== 'DC' || updated.targetRole !== 'DCC_ADMIN') {
            changed = true;
            updated.department = 'DC';
            updated.target_department = 'DC';
            updated.targetDepartment = 'DC';
            updated.targetRole = 'DCC_ADMIN';
            updated.target_role = 'DCC_ADMIN';
            updated.assignedToRole = 'DCC_ADMIN';
          }
        } else if (isReceipt) {
          const safeCopies = state.controlledCopyInstances || state.documentControlledCopies || [];
          const targetCopyId = String(updated.copy_id || updated.copyId || updated.instanceId || '');
          const matchedCopy = safeCopies.find(i => String(i.id) === targetCopyId);

          const cleanRecipientDept = resolveReceiptTaskDepartment(updated, matchedCopy);

          if (
            updated.department !== cleanRecipientDept ||
            updated.target_department !== cleanRecipientDept ||
            updated.destinationDept !== cleanRecipientDept ||
            updated.assignedToDept !== cleanRecipientDept
          ) {
            changed = true;
            updated.department = cleanRecipientDept;
            updated.target_department = cleanRecipientDept;
            updated.targetDepartment = cleanRecipientDept;
            updated.destinationDept = cleanRecipientDept;
            updated.destination_dept = cleanRecipientDept;
            updated.recipientDepartment = cleanRecipientDept;
            updated.recipient_department = cleanRecipientDept;
            updated.currentHandlerDepartment = cleanRecipientDept;
            updated.assignedToDept = cleanRecipientDept;
            updated.dept_code = cleanRecipientDept;
          }
        } else if (ownerDept) {
          const cleanDept = ownerDept === 'DCC' ? 'DC' : ownerDept;
          if (updated.department !== cleanDept || updated.target_department !== cleanDept) {
            changed = true;
            updated.department = cleanDept;
            updated.target_department = cleanDept;
            updated.owner_dept = cleanDept;
            updated.currentHandlerDepartment = cleanDept;
          }
        }

        // Auto-Sanitize QA/QC residue to QC
        const taskDeptStr = String(updated.department || '');
        if (taskDeptStr === 'QA/QC' || taskDeptStr === 'QA' || taskDeptStr === 'QAQC' || taskDeptStr.includes('QA/QC') || taskDeptStr.includes('ประกันและควบคุมคุณภาพ')) {
          if (updated.department !== 'QC') {
            updated.department = 'QC';
            changed = true;
          }
          if (updated.departmentName !== 'ฝ่ายประกันและควบคุมคุณภาพ') {
            updated.departmentName = 'ฝ่ายประกันและควบคุมคุณภาพ';
            changed = true;
          }
          if (updated.target_department === 'QA/QC' || updated.target_department === 'QA') {
            updated.target_department = 'QC';
            changed = true;
          }
          if (updated.targetDepartment === 'QA/QC' || updated.targetDepartment === 'QA') {
            updated.targetDepartment = 'QC';
            changed = true;
          }
          if (updated.destinationDept === 'QA/QC' || updated.destinationDept === 'QA') {
            updated.destinationDept = 'QC';
            changed = true;
          }
          if (updated.assignedToDept === 'QA/QC' || updated.assignedToDept === 'QA') {
            updated.assignedToDept = 'QC';
            changed = true;
          }
        }

        if (updated.department === 'QC' && updated.departmentName !== 'ฝ่ายประกันและควบคุมคุณภาพ') {
          updated.departmentName = 'ฝ่ายประกันและควบคุมคุณภาพ';
          changed = true;
        }

        if (changed) hasChange = true;
        return updated;
      });
      if (hasChange) {
        useStore.setState({ tasks: cleaned });
      }
    }

    // Auto-Heal external documents review_status on app boot
    if (state && state.externalDocuments && Array.isArray(state.externalDocuments)) {
      const now = new Date();
      let extChanged = false;
      const sanitizedExtDocs = state.externalDocuments.map(doc => {
        const sanitized = sanitizeExternalDocReviewStatus(doc, now);
        if (sanitized !== doc) extChanged = true;
        return sanitized;
      });
      if (extChanged) {
        useStore.setState({ externalDocuments: sanitizedExtDocs });
      }
    }
  },
  partialize: (state) => {
    // 🛡️ Sanitize documents: strip all in-memory File, Blobs, binary data to prevent QuotaExceededError
    const sanitizeDoc = (doc) => {
      if (!doc) return doc;
      const {
        fileBlob,
        binaryData,
        pdf_binary,
        pdfBlob,
        blob,
        file,
        previewBlob,
        rawBlob,
        fileContent,
        ...cleanDoc
      } = doc;

      // Retain serializable fileKey and fileName
      const fileName = cleanDoc.fileName || cleanDoc.file_name || cleanDoc.name || (typeof file === 'object' && file?.name ? file.name : undefined);
      const fileKey = cleanDoc.fileKey || cleanDoc.fileId || cleanDoc.file_id || (typeof file === 'string' && !file.startsWith('data:') ? file : undefined);

      const res = {
        ...cleanDoc,
        fileName,
        fileKey: fileKey || cleanDoc.id
      };

      if (Array.isArray(res.revision_history)) {
        res.revision_history = res.revision_history.map(rev => {
          if (!rev) return rev;
          const { fileBlob: _fb, binaryData: _bd, pdf_binary: _pb, pdfBlob: _pb2, blob: _b, file: _f, ...cleanRev } = rev;
          return {
            ...cleanRev,
            fileName: cleanRev.fileName || res.fileName,
            fileKey: cleanRev.fileKey || cleanRev.fileId || res.fileKey
          };
        });
      }

      return res;
    };

    // 🛡️ Sanitize DARs: strip attached file blobs and binary payloads
    const sanitizeDar = (dar) => {
      if (!dar) return dar;
      const {
        fileBlob,
        pdf_binary,
        binaryData,
        pdfBlob,
        blob,
        file,
        final_file,
        previewBlob,
        rawBlob,
        fileContent,
        ...cleanDar
      } = dar;

      let cleanAttachedFile = cleanDar.attachedFile;
      if (cleanAttachedFile) {
        cleanAttachedFile = {
          name: cleanAttachedFile.name || cleanAttachedFile.fileName || cleanDar.fileName,
          fileId: cleanAttachedFile.fileId || cleanAttachedFile.id || cleanDar.fileId || cleanDar.id,
          size: cleanAttachedFile.size,
          type: cleanAttachedFile.type
        };
      }

      return {
        ...cleanDar,
        fileName: cleanDar.fileName || cleanDar.fileNameOriginal || cleanAttachedFile?.name,
        fileKey: cleanDar.fileKey || cleanDar.fileId || cleanAttachedFile?.fileId || cleanDar.id,
        attachedFile: cleanAttachedFile
      };
    };

    // 🛡️ Sanitize Tasks: strip large file blobs
    const sanitizeTask = (task) => {
      if (!task) return task;
      const {
        fileBlob,
        binaryData,
        pdf_binary,
        pdfBlob,
        blob,
        file,
        previewBlob,
        ...cleanTask
      } = task;

      let cleanAttachedFile = cleanTask.attachedFile;
      if (cleanAttachedFile) {
        cleanAttachedFile = {
          name: cleanAttachedFile.name || cleanAttachedFile.fileName,
          fileId: cleanAttachedFile.fileId || cleanAttachedFile.id,
          size: cleanAttachedFile.size,
          type: cleanAttachedFile.type
        };
      }

      return {
        ...cleanTask,
        fileName: cleanTask.fileName || cleanAttachedFile?.name,
        fileKey: cleanTask.fileKey || cleanTask.fileId || cleanAttachedFile?.fileId,
        attachedFile: cleanAttachedFile
      };
    };

    // 🛡️ Sanitize Controlled Copies: strip binary data
    const sanitizeCopy = (copy) => {
      if (!copy) return copy;
      const {
        fileBlob,
        binaryData,
        pdf_binary,
        pdfBlob,
        blob,
        file,
        ...cleanCopy
      } = copy;
      return cleanCopy;
    };

    return {
      currentUser: state.currentUser,
      masterUsers: state.masterUsers?.map(u => ({
        ...u,
        signatureImage: u.signatureType === 'DRAWN' ? null : u.signatureImage
      })),
      requestUsers: state.requestUsers?.map(u => ({
        ...u,
        signatureImage: u.signatureType === 'DRAWN' ? null : u.signatureImage
      })),
      reviewUsers: state.reviewUsers?.map(u => ({
        ...u,
        signatureImage: u.signatureType === 'DRAWN' ? null : u.signatureImage
      })),
      approveUsers: state.approveUsers?.map(u => ({
        ...u,
        signatureImage: u.signatureType === 'DRAWN' ? null : u.signatureImage
      })),
      masterDepartments: state.masterDepartments,
      departments: state.departments,
      documentTypes: state.documentTypes,
      distributionLocations: state.distributionLocations,
      signatureSettings: state.signatureSettings,
      slaSettings: state.slaSettings,
      approvalMatrix: state.approvalMatrix,
      approval_matrix: state.approval_matrix,
      tasks: state.tasks?.map(sanitizeTask),
      notifications: state.notifications,
      dars: state.dars?.map(sanitizeDar),
      darRequests: (state.darRequests || state.dars)?.map(sanitizeDar),
      timeline: state.timeline,
      documents: state.documents?.map(sanitizeDoc),
      masterDocuments: (state.masterDocuments || state.documents)?.map(sanitizeDoc),
      supersededDocuments: state.supersededDocuments?.map(sanitizeDoc),
      externalDocuments: state.externalDocuments?.map(sanitizeDoc),
      externalRequests: state.externalRequests,
      controlledCopies: (state.controlledCopies || state.documentControlledCopies)?.map(sanitizeCopy),
      documentControlledCopies: (state.documentControlledCopies || state.controlledCopies)?.map(sanitizeCopy),
      controlledCopyInstances: state.controlledCopyInstances?.map(sanitizeCopy),
      controlledCopyAuditTrail: state.controlledCopyAuditTrail,
      copyDispositionRecords: state.copyDispositionRecords,
      dispositionHistory: state.dispositionHistory,
      actionLog: state.actionLog,
      periodicReviewSchedules: state.periodicReviewSchedules,
      periodicReviewTasks: state.periodicReviewTasks,
      periodicReviewRecords: state.periodicReviewRecords
    };
  },
  storage: createJSONStorage(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return {
        getItem: (name) => {
          try {
            return window.localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            window.localStorage.setItem(name, value);
          } catch (error) {
            if (error?.name === 'QuotaExceededError' || error?.code === 22) {
              console.warn(`[Storage] LocalStorage quota exceeded on key "${name}". Running emergency purge of temporary cache.`);
              const keysToPurge = ['recent_preview_cache', 'temp_pdf_data', 'draft_backups'];
              keysToPurge.forEach(k => {
                try { window.localStorage.removeItem(k); } catch { /* ignore */ }
              });

              try {
                window.localStorage.setItem(name, value);
              } catch (innerErr) {
                console.error('[Storage] LocalStorage quota exceeded even after cache purge; preserving in-memory state without overwriting:', innerErr);
              }
            } else {
              console.error('[Storage] LocalStorage error:', error);
            }
          }
        },
        removeItem: (name) => {
          try {
            window.localStorage.removeItem(name);
          } catch { /* ignore */ }
        },
      };
    }
    const memStore = new Map();
    return {
      getItem: (name) => memStore.get(name) || null,
      setItem: (name, value) => memStore.set(name, String(value)),
      removeItem: (name) => memStore.delete(name),
    };
  })
}));

// Auto-cleanup legacy local storage cache and heal stale tasks in storage
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.removeItem('qms-storage-uat-v6');
    localStorage.removeItem('qms-storage-uat-v7');
  } catch {
    // Ignore in non-browser or sandbox environments
  }

  try {
    const storageKey = 'qms-enterprise-storage';
    const persisted = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (persisted && persisted.state && Array.isArray(persisted.state.tasks)) {
      let migrated = false;
      persisted.state.tasks = persisted.state.tasks.map(t => {
        if (isReceiptTask(t)) {
          const loc = t.location || t.locationName || t.location_name || '';
          const text = `${t.title || ''} ${t.description || ''} ${loc}`;
          if (text.includes('EN Office') || text.includes('EN-') || text.includes('(EN)')) {
            if (t.department !== 'EN') {
              migrated = true;
              return {
                ...t,
                department: 'EN',
                target_department: 'EN',
                targetDepartment: 'EN',
                destinationDept: 'EN',
                destination_dept: 'EN',
                recipientDepartment: 'EN',
                recipient_department: 'EN',
                currentHandlerDepartment: 'EN',
                assignedToDept: 'EN',
                dept_code: 'EN'
              };
            }
          }
        }
        return t;
      });
      if (migrated) {
        localStorage.setItem(storageKey, JSON.stringify(persisted));
      }
    }

    // Self-healing migration for DAR Completion & Master Document Lifecycle Sync
    if (persisted && persisted.state && Array.isArray(persisted.state.dars) && Array.isArray(persisted.state.documents)) {
      let darsMigrated = false;
      persisted.state.dars.forEach(dar => {
        if (dar.status === 'COMPLETED') {
          const darType = String(dar.type || dar.requestType || dar.darType || '').toUpperCase();
          if (darType === 'REVISE' || darType === 'REVISION' || darType === 'REVISE_DOCUMENT') {
            const targetCode = dar.docNo || dar.document_code || dar.doc_code || dar.docCode || dar.docIdInput || dar.code || dar.title;
            const rawTarget = dar.targetRevision || dar.newRevision || dar.newRev || dar.targetRev || dar.proposedRev;
            if (targetCode && rawTarget) {
              const cleanTarget = String(rawTarget).replace(/^rev\.?/i, '').trim().padStart(2, '0');
              const docs = persisted.state.documents;
              const hasActiveNewRev = docs.some(d => {
                const code = d.docNo || d.document_code || d.doc_code || d.code || d.docCode || d.title;
                const rev = String(d.revision || d.rev || d.doc_version || d.version).replace(/^rev\.?/i, '').trim().padStart(2, '0');
                return code && code.trim().toLowerCase() === targetCode.trim().toLowerCase() && rev === cleanTarget && (d.status === 'EFFECTIVE' || d.status === 'ACTIVE' || d.is_active);
              });
              if (!hasActiveNewRev) {
                persisted.state.documents = syncCompletedDarToMasterDocuments(dar, persisted.state.documents);
                darsMigrated = true;
              }
            }
          }
        }
      });
      if (darsMigrated) {
        persisted.state.masterDocuments = persisted.state.documents;
        persisted.state.darRequests = persisted.state.dars;
        localStorage.setItem(storageKey, JSON.stringify(persisted));
      }
    }

    // Self-healing migration for ISO 9001 Clause 7.5.3: Obsolete DAR Revision Binding (e.g. DAR-2026-005 for SOP-PD-01)
    if (persisted && persisted.state && Array.isArray(persisted.state.dars)) {
      let obsoleteDarsMigrated = false;
      const allDocs = persisted.state.documents || [];
      persisted.state.dars = persisted.state.dars.map(dar => {
        if (!dar) return dar;
        const isObs = dar.type === 'OBSOLETE' || dar.request_type === 'OBSOLETE' || dar.darType === 'OBSOLETE' || dar.is_obsolete;
        if (isObs) {
          const targetCode = dar.doc_code || dar.docCode || dar.docNo || dar.code || dar.title;
          const targetDoc = allDocs.find(d => 
            (dar.doc_id && String(d.id) === String(dar.doc_id)) ||
            (dar.targetDocumentId && String(d.id) === String(dar.targetDocumentId)) ||
            (targetCode && (d.title === targetCode || d.document_code === targetCode || d.code === targetCode))
          );
          const rawTargetRev = targetDoc 
            ? ((targetDoc.revision && targetDoc.revision !== '00') 
                ? targetDoc.revision 
                : (targetDoc.rev || targetDoc.revision || '03'))
            : ((dar.id === 'DAR-2026-005' || dar.dar_no === 'DAR-2026-005' || dar.darNo === 'DAR-2026-005') ? '03' : '01');
          const cleanTargetRev = String(rawTargetRev).replace(/^Rev\.?/i, '').padStart(2, '0');

          if (
            dar.id === 'DAR-2026-005' ||
            dar.dar_no === 'DAR-2026-005' ||
            dar.darNo === 'DAR-2026-005' ||
            dar.revision === '00' ||
            !dar.revision ||
            dar.targetRevision === '00' ||
            !dar.targetRevision
          ) {
            obsoleteDarsMigrated = true;
            return {
              ...dar,
              revision: cleanTargetRev,
              targetRevision: cleanTargetRev,
              rev: cleanTargetRev,
              docRev: cleanTargetRev
            };
          }
        }
        return dar;
      });
      if (obsoleteDarsMigrated) {
        persisted.state.darRequests = persisted.state.dars;
        localStorage.setItem(storageKey, JSON.stringify(persisted));
      }
    }

    // Self-healing migration: Strict In-Flight DAR Deduplication (e.g. resolve duplicate OBSOLETE DAR-2026-004 vs DAR-2026-005 for SOP-QC-01)
    if (persisted && persisted.state && Array.isArray(persisted.state.dars)) {
      let duplicateDarsCleaned = false;
      const darsList = persisted.state.dars;
      const hasDar004 = darsList.some(d => (d?.id === 'DAR-2026-004' || d?.dar_no === 'DAR-2026-004' || d?.darNo === 'DAR-2026-004') && (d?.document_code === 'SOP-QC-01' || d?.doc_code === 'SOP-QC-01' || d?.title === 'SOP-QC-01' || d?.title === '[OBSOLETE] SOP-QC-01'));
      const hasDar005 = darsList.some(d => (d?.id === 'DAR-2026-005' || d?.dar_no === 'DAR-2026-005' || d?.darNo === 'DAR-2026-005') && (d?.document_code === 'SOP-QC-01' || d?.doc_code === 'SOP-QC-01' || d?.title === 'SOP-QC-01' || d?.title === '[OBSOLETE] SOP-QC-01'));

      if (hasDar004 && hasDar005) {
        persisted.state.dars = darsList.map(d => {
          if ((d?.id === 'DAR-2026-005' || d?.dar_no === 'DAR-2026-005' || d?.darNo === 'DAR-2026-005') &&
              (d?.document_code === 'SOP-QC-01' || d?.doc_code === 'SOP-QC-01' || d?.title === 'SOP-QC-01' || d?.title === '[OBSOLETE] SOP-QC-01')) {
            duplicateDarsCleaned = true;
            return { ...d, status: 'CANCELLED' };
          }
          return d;
        });
      }

      if (duplicateDarsCleaned) {
        persisted.state.darRequests = persisted.state.dars;
        localStorage.setItem(storageKey, JSON.stringify(persisted));
      }
    }

    // Self-healing migration: Sanitize SOP-QC-01 revision_history duplicates
    if (persisted && persisted.state && Array.isArray(persisted.state.documents)) {
      let historySanitized = false;
      persisted.state.documents = persisted.state.documents.map(doc => {
        if ((doc.title === 'SOP-QC-01' || doc.document_code === 'SOP-QC-01' || doc.doc_code === 'SOP-QC-01') && Array.isArray(doc.revision_history)) {
          const uniqueRevs = new Set();
          const cleanHistory = [];
          doc.revision_history.forEach(hist => {
            const rev = String(hist.revision ?? hist.rev ?? hist.target_revision ?? hist.docRev ?? '00').padStart(2, '0');
            if (!uniqueRevs.has(rev)) {
              uniqueRevs.add(rev);
              cleanHistory.push(hist);
            }
          });
          if (cleanHistory.length !== doc.revision_history.length) {
            historySanitized = true;
            return { ...doc, revision_history: cleanHistory };
          }
        }
        return doc;
      });
      if (historySanitized) {
        persisted.state.masterDocuments = persisted.state.documents;
        localStorage.setItem(storageKey, JSON.stringify(persisted));
      }
    }

    // Self-healing migration for Controlled Copies: Deduplicate Copy records & Sanitize QM-QC-01
    if (persisted && persisted.state) {
      const rawCopies = persisted.state.controlledCopyInstances || persisted.state.documentControlledCopies || [];
      if (Array.isArray(rawCopies) && rawCopies.length > 0) {
        const cleanedCopies = sanitizeControlledCopies(rawCopies);
        if (cleanedCopies.length !== rawCopies.length || JSON.stringify(cleanedCopies) !== JSON.stringify(rawCopies)) {
          persisted.state.controlledCopyInstances = cleanedCopies;
          persisted.state.documentControlledCopies = cleanedCopies;
          if (Array.isArray(persisted.state.controlledCopies)) {
            persisted.state.controlledCopies = cleanedCopies;
          }
          localStorage.setItem(storageKey, JSON.stringify(persisted));
        }
      }
    }

    // Self-healing migration for OBSOLETE Cascading: Fix active copies of obsolete documents (e.g. SOP-QC-01)
    if (persisted && persisted.state) {
      let obsoleteCopiesCleaned = false;
      const allDocs = persisted.state.documents || [];
      const copiesList = persisted.state.controlledCopyInstances || persisted.state.documentControlledCopies || [];
      
      const updatedCopiesList = copiesList.map(copy => {
        const docCode = copy.document_code || copy.doc_code || copy.docTitle;
        if (!docCode) return copy;
        
        const matchedDoc = allDocs.find(d => 
          (d.id && (d.id === copy.doc_id || d.id === copy.docId)) || 
          (docCode && (d.document_code === docCode || d.doc_code === docCode || d.title === docCode || d.code === docCode))
        );
        
        if (matchedDoc && (matchedDoc.status === 'OBSOLETE' || matchedDoc.is_obsolete)) {
          if (copy.status === 'ACTIVE' || copy.status === 'IN_USE' || copy.status === 'ISSUED_ACTIVE' || !copy.status) {
            obsoleteCopiesCleaned = true;
            return {
              ...copy,
              status: 'PENDING_RECALL',
              obsoleted_at: matchedDoc.obsolete_at || new Date().toISOString(),
              obsolete_dar_no: matchedDoc.obsolete_dar_id || matchedDoc.darId || matchedDoc.dar_no
            };
          }
        }
        return copy;
      });

      if (obsoleteCopiesCleaned) {
        persisted.state.controlledCopyInstances = updatedCopiesList;
        persisted.state.documentControlledCopies = updatedCopiesList;
        if (Array.isArray(persisted.state.controlledCopies)) {
          persisted.state.controlledCopies = updatedCopiesList;
        }
        localStorage.setItem(storageKey, JSON.stringify(persisted));
      }
    }

    // Self-healing migration for Periodic Review Mock Data: Remove leftover mock data
    if (persisted && persisted.state) {
      let mockDataCleaned = false;
      const mockDocIds = ['DOC-REV-OVERDUE', 'DOC-REV-DUESOON', 'DOC-REV-UPTODATE', 'DOC-REVIEW-01', 'DOC-REVIEW-02'];
      const mockExtIds = ['EXT-REV-OVERDUE', 'EXT-REV-DUESOON', 'EXT-REV-UPTODATE', 'EXT-LAW-001'];
      const mockTaskIds = ['TASK-REV-1', 'TASK-REV-2', 'TASK-REV-001'];

      if (Array.isArray(persisted.state.documents)) {
        const cleanDocs = persisted.state.documents.filter(d => !mockDocIds.includes(d.id));
        if (cleanDocs.length !== persisted.state.documents.length) {
          persisted.state.documents = cleanDocs;
          mockDataCleaned = true;
        }
      }

      if (Array.isArray(persisted.state.masterDocuments)) {
        const cleanMasterDocs = persisted.state.masterDocuments.filter(d => !mockDocIds.includes(d.id));
        if (cleanMasterDocs.length !== persisted.state.masterDocuments.length) {
          persisted.state.masterDocuments = cleanMasterDocs;
          mockDataCleaned = true;
        }
      }

      if (Array.isArray(persisted.state.externalDocuments)) {
        const cleanExtDocs = persisted.state.externalDocuments.filter(d => !mockExtIds.includes(d.id));
        if (cleanExtDocs.length !== persisted.state.externalDocuments.length) {
          persisted.state.externalDocuments = cleanExtDocs;
          mockDataCleaned = true;
        }
      }

      if (Array.isArray(persisted.state.tasks)) {
        const cleanTasks = persisted.state.tasks.filter(t => !mockTaskIds.includes(t.id));
        if (cleanTasks.length !== persisted.state.tasks.length) {
          persisted.state.tasks = cleanTasks;
          mockDataCleaned = true;
        }
      }

      if (mockDataCleaned) {
        localStorage.setItem(storageKey, JSON.stringify(persisted));
      }
    }
  } catch {
    // Ignore in non-browser or sandbox environments
  }
}

export default useStore;

