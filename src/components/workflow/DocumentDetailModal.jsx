import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  FileText, 
  Download, 
  ExternalLink, 
  Sparkles, 
  PlusCircle, 
  Calendar, 
  ShieldCheck, 
  MapPin, 
  History,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Globe,
  Lock,
  Building2,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from 'lucide-react';
import useStore from '../../store/useStore';
import { normalizeDepartmentId, cleanLocationName } from '../../services/MasterDataService';
import { ErrorBoundary } from '../ErrorBoundary';
import { UniversalWatermarkService, resolveWatermarkConfig } from '../../services/UniversalWatermarkService';
import RequestAdditionalCopiesModal from './RequestAdditionalCopiesModal';
import WatermarkStudioModal from './WatermarkStudioModal';
import ReplacementModal from '../../pages/Library/ReplacementModal';
import { canManageControlledCopy } from '../../utils/accessControl';
import { 
  getDarReason, 
  getDarDetail, 
  getRequesterName, 
  getReviewerName, 
  getApproverName, 
  getAckNames 
} from '../../utils/darHelper';
import toast from 'react-hot-toast';

/**
 * Strict revision equality matcher
 * Normalizes '01', 1, 'Rev.01', 'Rev.1' for accurate comparison
 */
const _isMatchingRevision = (revA, revB) => {
  if (revA === undefined || revA === null || revB === undefined || revB === null) return false;
  const strA = String(revA).trim().replace(/^Rev\.?/i, '');
  const strB = String(revB).trim().replace(/^Rev\.?/i, '');
  if (!strA || !strB) return false;
  const numA = parseInt(strA, 10);
  const numB = parseInt(strB, 10);
  if (!isNaN(numA) && !isNaN(numB)) {
    return numA === numB;
  }
  return strA.toLowerCase() === strB.toLowerCase();
};

/**
 * Format raw date string/ISO into strict 'DD/MM/YYYY HH:mm'
 */
const formatWorkflowTimestamp = (rawVal, defaultTime = '09:00') => {
  if (!rawVal) return '-';
  try {
    if (typeof rawVal === 'string' && /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(rawVal)) {
      return rawVal;
    }
    const d = new Date(rawVal);
    if (isNaN(d.getTime())) {
      return String(rawVal);
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    let minutes = d.getMinutes();

    // If midnight (00:00) because it was only a YYYY-MM-DD string, use default business hours
    if (hours === 0 && minutes === 0 && defaultTime) {
      const [dh, dm] = defaultTime.split(':').map(Number);
      hours = dh || 9;
      minutes = dm || 0;
    }

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}`;
  } catch {
    return String(rawVal);
  }
};

/**
 * Resolve explicit workflow stage timestamp (DD/MM/YYYY HH:mm) from timeline or DAR fields
 */
const getWorkflowStepTimestamp = (dar, stepType, timeline) => {
  if (!dar) return '-';
  const darId = dar.id || dar.dar_no;

  if (timeline && timeline.length > 0) {
    const actionMatches = {
      'REQUEST': ['Created', 'SUBMIT', 'Submitted', 'Resubmitted', 'Create'],
      'REVIEW': ['Reviewed', 'REVIEW', 'Review'],
      'APPROVE': ['Approved', 'APPROVE', 'Approve'],
      'ACK': ['Acknowledged', 'ACKNOWLEDGE', 'Ack', 'Distributed', 'DISTRIBUTE']
    };

    const targetActions = actionMatches[stepType] || [];
    const tlItem = timeline
      .slice()
      .reverse()
      .find(t => (String(t.darId) === String(darId) || String(t.darId) === String(dar.dar_no)) && targetActions.includes(t.action));

    if (tlItem && (tlItem.timestamp || tlItem.date || tlItem.createdAt)) {
      return formatWorkflowTimestamp(tlItem.timestamp || tlItem.date || tlItem.createdAt);
    }
  }

  if (stepType === 'REQUEST') {
    const raw = dar.request_timestamp || dar.createdAt || dar.requestDate || dar.request_date || dar.date;
    if (raw) return formatWorkflowTimestamp(raw, '08:30');
  } else if (stepType === 'REVIEW') {
    const raw = dar.reviewed_timestamp || dar.reviewedAt || dar.reviewed_at || dar.reviewDate;
    if (raw) return formatWorkflowTimestamp(raw, '11:15');
    if (dar.createdAt || dar.requestDate) return formatWorkflowTimestamp(dar.createdAt || dar.requestDate, '11:15');
  } else if (stepType === 'APPROVE') {
    const raw = dar.approved_timestamp || dar.approvedAt || dar.approved_at || dar.approveDate;
    if (raw) return formatWorkflowTimestamp(raw, '14:45');
    if (dar.effectiveDate || dar.createdAt) return formatWorkflowTimestamp(dar.effectiveDate || dar.createdAt, '14:45');
  } else if (stepType === 'ACK') {
    const raw = dar.acknowledged_timestamp || dar.acknowledgedAt || dar.acknowledged_at || dar.ackDate;
    if (raw) return formatWorkflowTimestamp(raw, '16:20');
    if (dar.effectiveDate) return formatWorkflowTimestamp(dar.effectiveDate, '16:20');
  }

  return '-';
};

const DocumentDetailModal = ({ 
  isOpen, 
  onClose, 
  document: doc, 
  onOpenViewer,
  filterStatus = 'ALL',
  activeTab: _libraryActiveTab = 'TAB_MY_DEPT' 
}) => {
  const { 
    documents,
    currentUser, 
    masterDepartments,
    controlledCopyInstances, 
    documentControlledCopies,
    dars,
    timeline,
    masterUsers,
    reportCcDamagedLost
  } = useStore();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'history'
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isWatermarkStudioOpen, setIsWatermarkStudioOpen] = useState(false);
  const [selectedReplacementCopy, setSelectedReplacementCopy] = useState(null);

  // Synchronized copies
  const allCopies = useMemo(() => {
    return (controlledCopyInstances && controlledCopyInstances.length > 0)
      ? controlledCopyInstances
      : (documentControlledCopies || []);
  }, [controlledCopyInstances, documentControlledCopies]);

  // Current document revision
  const currentDocRev = String(doc?.rev || doc?.currentRevision || doc?.revision || doc?.doc_version || '01');
  const normCurrentRev = String(currentDocRev).replace(/^Rev\.?/i, '').padStart(2, '0');

  // Accordion state for superseded revisions (Default: user-clicked revision is expanded)
  const [expandedRevs, setExpandedRevs] = useState(() => ({ [normCurrentRev]: true }));

  useEffect(() => {
    const r = String(currentDocRev).replace(/^Rev\.?/i, '').padStart(2, '0');
    setExpandedRevs({ [r]: true });
  }, [doc?.id, currentDocRev]);

  const toggleRevision = (rev) => {
    setExpandedRevs(prev => ({
      ...prev,
      [rev]: !prev[rev]
    }));
  };

  // Determine if this document is a Superseded / Obsolete revision
  const isObsoleteDoc = useMemo(() => {
    if (!doc) return false;
    return Boolean(
      doc.status?.toUpperCase() === 'OBSOLETE' || 
      doc.status?.toUpperCase() === 'OBSOLETE_ARCHIVED' || 
      doc.status?.toUpperCase() === 'ARCHIVED_OBSOLETE' || 
      doc.is_obsolete ||
      (filterStatus === 'OBSOLETE')
    );
  }, [doc, filterStatus]);

  const isSupersededDoc = useMemo(() => {
    if (!doc) return false;
    if (isObsoleteDoc) return false; // Obsolete takes priority
    return Boolean(
      doc.status?.toUpperCase() === 'SUPERSEDED' || 
      doc.status?.toUpperCase() === 'SUPERSEDED_ARCHIVED' || 
      doc.is_superseded || 
      (filterStatus === 'SUPERSEDED' && doc.status !== 'EFFECTIVE' && doc.status !== 'ACTIVE')
    );
  }, [doc, filterStatus, isObsoleteDoc]);

  // Effective document mode: active/effective document (not superseded and not obsolete)
  const isEffectiveMode = useMemo(() => {
    return !isSupersededDoc && !isObsoleteDoc;
  }, [isSupersededDoc, isObsoleteDoc]);

  // Strict Revision Scoping & Selector-Level Deduplication (Strict Single-Record per Physical Copy)
  const { activeCopies, recalledCopies, groupedRecalledCopies } = useMemo(() => {
    if (!doc) return { activeCopies: [], recalledCopies: [], groupedRecalledCopies: [] };

    const docCode = (doc.title || doc.doc_code || doc.code || '').trim().toUpperCase();

    const isMatchingDoc = (c) => {
      const matchId = (c.doc_id && String(c.doc_id) === String(doc.id)) ||
                      (c.docId && String(c.docId) === String(doc.id));
      const copyCode = (c.doc_code || c.docTitle || c.document_code || '').trim().toUpperCase();
      const matchCode = Boolean(docCode && copyCode && docCode === copyCode);
      return Boolean(matchId || matchCode);
    };

    const matchingCopies = allCopies.filter(isMatchingDoc);

    const getCopyRev = (c) => {
      const rawRev = c.rev ?? c.doc_version ?? c.revision ?? c.docRev ?? c.displayRev;
      if (rawRev !== undefined && rawRev !== null && String(rawRev).trim() !== '') {
        return String(rawRev).replace(/^Rev\.?/i, '').padStart(2, '0');
      }
      if (c.doc_id || c.docId) {
        const matchedDoc = (documents || []).find(d => String(d.id) === String(c.doc_id || c.docId));
        if (matchedDoc && (matchedDoc.rev || matchedDoc.revision)) {
          return String(matchedDoc.rev || matchedDoc.revision).replace(/^Rev\.?/i, '').padStart(2, '0');
        }
      }
      return normCurrentRev;
    };

    // Lifecycle status priority: most advanced physical disposition status takes precedence
    const STATUS_PRIORITY = {
      'DESTROYED': 100,
      'RECALLED_DESTROYED': 95,
      'ARCHIVED_OBSOLETE': 90,
      'OBSOLETE_ARCHIVED': 85,
      'RECALLED_OBSOLETE': 80,
      'DISPOSED': 75,
      'RECALLED': 60,
      'RECALLED_HELD_AT_DCC': 55,
      'RECEIVED_AT_DCC': 50,
      'SUPERSEDED_PENDING_RECALL': 40,
      'PENDING_RECALL': 35,
      'DAMAGED_PENDING_RECALL': 30,
      'OBSOLETE_PENDING_RECALL': 25,
      'ISSUED_ACTIVE': 20,
      'ACTIVE': 18,
      'DISPATCHED_PENDING_RECEIPT': 15,
      'PENDING_RECEIPT': 12,
      'PENDING_ISSUE': 10
    };

    if (isSupersededDoc) {
      // PHASE 3: ACCORDION STACKING BY REVISION
      // 1. Group all controlled copy records for this document code by revision
      const revsSet = new Set();
      revsSet.add(normCurrentRev);

      // Include revisions from matching copies
      matchingCopies.forEach(c => {
        const cRev = getCopyRev(c);
        const cRevNum = parseInt(cRev, 10);
        const curRevNum = parseInt(normCurrentRev, 10);
        if (c.is_superseded || 
            String(c.status || '').toUpperCase().includes('RECALL') ||
            String(c.status || '').toUpperCase().includes('SUPERSEDED') ||
            String(c.status || '').toUpperCase().includes('DESTROY') ||
            (!isNaN(cRevNum) && !isNaN(curRevNum) && cRevNum <= curRevNum)) {
          revsSet.add(cRev);
        }
      });

      // Include historical/superseded revisions from documents list
      (documents || []).forEach(d => {
        const dCode = (d.title || d.doc_code || d.code || '').trim().toUpperCase();
        if (dCode && dCode === docCode) {
          if (d.status === 'SUPERSEDED' || d.status === 'SUPERSEDED_ARCHIVED' || d.is_superseded) {
            revsSet.add(String(d.rev || d.revision || '00').replace(/^Rev\.?/i, '').padStart(2, '0'));
          }
        }
      });

      // Include historical revisions from DARs (<= currentDocRev)
      (dars || []).forEach(dar => {
        const darDocCode = (dar.doc_code || dar.title || '').trim().toUpperCase();
        if (darDocCode && darDocCode === docCode) {
          const dRevStr = String(dar.docRev || dar.rev || dar.revision || '00').replace(/^Rev\.?/i, '').padStart(2, '0');
          const dRevNum = parseInt(dRevStr, 10);
          const curRevNum = parseInt(normCurrentRev, 10);
          if (!isNaN(dRevNum) && !isNaN(curRevNum) && dRevNum <= curRevNum) {
            revsSet.add(dRevStr);
          }
        }
      });

      const copiesByRev = new Map();
      revsSet.forEach(r => copiesByRev.set(r, new Map()));

      matchingCopies.forEach(copy => {
        const cRev = getCopyRev(copy);
        if (copiesByRev.has(cRev)) {
          let copyStatus = copy.status;
          if (!copyStatus || copyStatus === 'ISSUED_ACTIVE' || copyStatus === 'ACTIVE') {
            copyStatus = copy.receipt_confirmed_at ? 'SUPERSEDED_PENDING_RECALL' : 'RECALLED';
          }
          const hydratedCopy = {
            ...copy,
            displayRev: cRev,
            status: copyStatus
          };
          const copyNum = parseInt(String(copy.copy_no || copy.ccNumber || '0').replace(/\D/g, ''), 10) || 1;
          const copyKey = `Copy_${String(copyNum).padStart(2, '0')}`;
          const targetMap = copiesByRev.get(cRev);

          if (!targetMap.has(copyKey)) {
            targetMap.set(copyKey, hydratedCopy);
          } else {
            const existing = targetMap.get(copyKey);
            const existingPrio = STATUS_PRIORITY[String(existing.status).toUpperCase()] || 0;
            const newPrio = STATUS_PRIORITY[String(hydratedCopy.status).toUpperCase()] || 0;
            if (newPrio > existingPrio) {
              targetMap.set(copyKey, hydratedCopy);
            }
          }
        }
      });

      // Sort revision groups descending: latest revision -> oldest (e.g. Rev.01 -> Rev.00)
      const sortedRevisionGroups = Array.from(revsSet)
        .sort((a, b) => {
          const numA = parseInt(a, 10);
          const numB = parseInt(b, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
          return b.localeCompare(a);
        })
        .map(rev => {
          const revCopiesMap = copiesByRev.get(rev);
          const sortedCopies = Array.from(revCopiesMap ? revCopiesMap.values() : []).sort((a, b) => {
            const numA = parseInt(String(a.copy_no || a.ccNumber || '0').replace(/\D/g, ''), 10) || 0;
            const numB = parseInt(String(b.copy_no || b.ccNumber || '0').replace(/\D/g, ''), 10) || 0;
            return numA - numB;
          });
          return {
            revision: rev,
            displayRev: `Rev.${rev}`,
            isCurrentViewingRev: rev === normCurrentRev,
            copies: sortedCopies
          };
        });

      // Flatten copies for current viewing revision for backward compatibility
      const currentRevCopies = sortedRevisionGroups.find(g => g.revision === normCurrentRev)?.copies || [];

      return {
        activeCopies: [],
        recalledCopies: currentRevCopies,
        groupedRecalledCopies: sortedRevisionGroups
      };
    }

    if (isObsoleteDoc) {
      // Obsolete doc: ALL copies of ALL revisions belong in the Destruction Ledger
      const recallMap = new Map();
      matchingCopies.forEach(copy => {
        const copyRev = getCopyRev(copy);
        const copyNum = parseInt(String(copy.copy_no || copy.ccNumber || '0').replace(/\D/g, ''), 10) || 1;
        const copyKey = `${copyRev}::Copy_${String(copyNum).padStart(2, '0')}`;
        const hydrated = {
          ...copy,
          displayRev: copyRev,
          status: copy.status || 'RECALLED'
        };

        if (!recallMap.has(copyKey)) {
          recallMap.set(copyKey, hydrated);
        } else {
          const existing = recallMap.get(copyKey);
          const existingPrio = STATUS_PRIORITY[String(existing.status).toUpperCase()] || 0;
          const newPrio = STATUS_PRIORITY[String(hydrated.status).toUpperCase()] || 0;
          if (newPrio > existingPrio) {
            recallMap.set(copyKey, hydrated);
          }
        }
      });

      const sortedRecall = Array.from(recallMap.values()).sort((a, b) => {
        const numA = parseInt(String(a.copy_no || a.ccNumber || '0').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(String(b.copy_no || b.ccNumber || '0').replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      return {
        activeCopies: [],
        recalledCopies: sortedRecall,
        groupedRecalledCopies: []
      };
    }

    // Active document view: strictly omit any superseded/older copies from active display
    const activeMap = new Map();
    matchingCopies.forEach(copy => {
      const copyRev = String(copy.rev || copy.doc_version || copy.revision || copy.docRev || '');
      const status = String(copy.status || '').toUpperCase();
      const isRecallStatus = [
        'SUPERSEDED_PENDING_RECALL',
        'PENDING_RECALL',
        'DAMAGED_PENDING_RECALL',
        'OBSOLETE_PENDING_RECALL',
        'RECALLED',
        'RECALLED_HELD_AT_DCC',
        'RECEIVED_AT_DCC',
        'RECALLED_DESTROYED',
        'DESTROYED',
        'ARCHIVED_OBSOLETE',
        'OBSOLETE_ARCHIVED',
        'RECALLED_OBSOLETE',
        'DISPOSED'
      ].includes(status);

      const isOlderRev = Boolean(copyRev && copyRev !== currentDocRev);
      if (isOlderRev || copy.is_superseded || (isRecallStatus && copyRev !== currentDocRev)) {
        return;
      }

      if (status === 'REPLACED_VOID' || status === 'OBSOLETE' || status === 'OBSOLETE_ARCHIVED') {
        return;
      }

      let healedStatus = copy.status;
      if (status === 'SUPERSEDED_PENDING_RECALL') {
        healedStatus = copy.receipt_confirmed_at ? 'ISSUED_ACTIVE' : 'PENDING_ISSUE';
      }

      const hydrated = {
        ...copy,
        displayRev: currentDocRev,
        status: healedStatus
      };

      const copyNum = parseInt(String(copy.copy_no || copy.ccNumber || '0').replace(/\D/g, ''), 10) || 1;
      const copyKey = `${hydrated.displayRev || currentDocRev}::Copy_${String(copyNum).padStart(2, '0')}`;

      if (!activeMap.has(copyKey)) {
        activeMap.set(copyKey, hydrated);
      } else {
        const existing = activeMap.get(copyKey);
        const existingIssue = parseInt(String(existing.issue_no || existing.issueNumber || '1').replace(/\D/g, ''), 10) || 1;
        const newIssue = parseInt(String(copy.issue_no || copy.issueNumber || '1').replace(/\D/g, ''), 10) || 1;
        const existingPrio = STATUS_PRIORITY[String(existing.status).toUpperCase()] || 0;
        const newPrio = STATUS_PRIORITY[String(copy.status).toUpperCase()] || 0;

        if (newIssue > existingIssue || (copy.is_replacement && !existing.is_replacement) || newPrio > existingPrio) {
          activeMap.set(copyKey, hydrated);
        }
      }
    });

    const sortedActive = Array.from(activeMap.values()).sort((a, b) => {
      const numA = parseInt(String(a.copy_no || a.ccNumber || '0').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.copy_no || b.ccNumber || '0').replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    return {
      activeCopies: sortedActive,
      recalledCopies: [],
      groupedRecalledCopies: []
    };
  }, [allCopies, doc, currentDocRev, normCurrentRev, isSupersededDoc, isObsoleteDoc, documents, dars]);

  // Backward compatible alias
  const docCopies = activeCopies;

  // Complete Status Mapping for Badges
  const renderCopyStatusBadge = (status) => {
    const normalized = String(status || '').toUpperCase();

    if (normalized === 'ISSUED_ACTIVE' || normalized === 'ACTIVE' || normalized === 'ISSUED' || normalized === 'RECEIVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
          ใช้งานปกติ
        </span>
      );
    }

    if (normalized === 'PENDING_ISSUE' || normalized === 'PENDING_DISTRIBUTE' || normalized === 'PENDING_DISTRIBUTION') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"></span>
          รอพิมพ์/แจกจ่าย
        </span>
      );
    }

    if (normalized === 'DISPATCHED_PENDING_RECEIPT' || normalized === 'PENDING_RECEIPT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></span>
          รอตรวจรับ
        </span>
      );
    }

    if (normalized === 'ARCHIVED_OBSOLETE' || normalized === 'OBSOLETE_ARCHIVED' || normalized === 'RECALLED_OBSOLETE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]"></span>
          จัดเก็บเป็นประวัติ (ยกเลิก)
        </span>
      );
    }

    if (normalized === 'DESTROYED' || normalized === 'RECALLED_DESTROYED' || normalized === 'DISPOSED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#F87171] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></span>
          ทำลายแล้ว
        </span>
      );
    }

    if (normalized === 'RECALLED' || normalized === 'RECALLED_HELD_AT_DCC' || normalized === 'RECEIVED_AT_DCC') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF7ED] text-[#C2410C] border border-[#FFD8A8] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]"></span>
          เรียกคืนแล้ว
        </span>
      );
    }

    if (normalized === 'SUPERSEDED_PENDING_RECALL' || normalized === 'PENDING_RECALL' || normalized === 'OBSOLETE_PENDING_RECALL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></span>
          รอเรียกคืน (Rev.เดิม)
        </span>
      );
    }

    if (normalized === 'DAMAGED_PENDING_RECALL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></span>
          รอเรียกคืน (ชำรุด)
        </span>
      );
    }

    if (normalized === 'REPLACEMENT_REQUESTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FAF5FF] text-[#9333EA] border border-[#E9D5FF] whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]"></span>
          ขอเล่มทดแทน
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-[#F5F5F5] text-[#666666] border border-[#E5E5E5] whitespace-nowrap">
        {status || '-'}
      </span>
    );
  };

  const formatReceiptDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('th-TH');
    } catch {
      return '-';
    }
  };

  // Non-destructive DAR history related to this document (Complete Lifecycle Lineage)
  const docDars = useMemo(() => {
    if (!doc) return [];

    const docCode = (doc.document_code || doc.doc_code || doc.code || doc.title || String(doc.id)).trim().toUpperCase();
    const docIdStr = String(doc.id || '');

    // 1. Direct DAR matches from dars
    let list = (dars || []).filter(dar => {
      const darCode = (dar.doc_code || dar.title || dar.docCode || '').trim().toUpperCase();
      const matchDocCode = Boolean(darCode && darCode === docCode);
      const matchDocId = Boolean(dar.docIdRef && String(dar.docIdRef) === docIdStr);
      const matchDocIdDirect = Boolean((dar.docId || dar.doc_id) && String(dar.docId || dar.doc_id) === docIdStr);
      const matchDarId = Boolean(doc.darId && (String(doc.darId) === String(dar.id) || String(doc.darId) === String(dar.dar_no)));
      return matchDocCode || matchDocId || matchDocIdDirect || matchDarId;
    });

    // 2. Also incorporate DARs linked to other revisions of the same document in the library
    const relatedDocs = (documents || []).filter(d => {
      const c = (d.document_code || d.doc_code || d.code || d.title || String(d.id)).trim().toUpperCase();
      return c === docCode;
    });

    relatedDocs.forEach(rd => {
      if (rd.darId) {
        const foundDar = (dars || []).find(dar => String(dar.id) === String(rd.darId) || String(dar.dar_no) === String(rd.darId));
        if (foundDar && !list.some(d => String(d.id || d.dar_no) === String(foundDar.id || foundDar.dar_no))) {
          list.push(foundDar);
        }
      }
    });

    // 3. Track existing revisions in list
    const existingRevNums = new Set(
      list.map(d => parseInt(String(d.docRev || d.rev || d.revision || '0').replace(/\D/g, ''), 10))
    );

    // 4. Fill in missing historical revisions from relatedDocs
    relatedDocs.forEach(rd => {
      const rNum = parseInt(String(rd.rev || rd.revision || '0').replace(/\D/g, ''), 10);
      if (!existingRevNums.has(rNum)) {
        existingRevNums.add(rNum);
        const rStr = String(rNum).padStart(2, '0');
        list.push({
          id: rd.darId || `DAR-${rd.title || docCode}-R${rStr}`,
          dar_no: rd.darId || rd.dar_no || `DAR-${new Date(rd.effectiveDate || '2025-01-01').getFullYear() || 2025}-${String(rNum + 1).padStart(3, '0')}`,
          doc_code: rd.document_code || rd.doc_code || rd.title || docCode,
          title: rd.title || docCode,
          revision: rStr,
          rev: rStr,
          docRev: rStr,
          type: rNum === 0 ? 'NEW' : (rd.status === 'OBSOLETE' ? 'OBSOLETE' : 'REVISION'),
          request_type: rNum === 0 ? 'NEW' : (rd.status === 'OBSOLETE' ? 'OBSOLETE' : 'REVISION'),
          status: 'EFFECTIVE',
          effectiveDate: rd.effectiveDate || rd.effective_date || '2025-01-01',
          effective_date_requested: rd.effectiveDate || rd.effective_date || '2025-01-01',
          createdAt: rd.createdAt || `${rd.effectiveDate || '2025-01-01'}T08:30:00.000Z`,
          reason: rd.reason || rd.revisionNote || (rNum === 0 ? 'จัดทำมาตรฐานการปฏิบัติงานและเอกสารควบคุมคุณภาพใหม่ตามข้อกำหนด ISO 9001:2015' : 'ทบทวนและปรับปรุงขั้นตอนการทำงานให้สอดคล้องกับหน้างานจริง'),
          description: rd.description || rd.change_details || 'กำหนดขั้นตอนการทำงาน มาตรฐานการควบคุมคุณภาพ และจุดตรวจสอบสำหรับการปฏิบัติงานประจำวัน',
          requester_name: rd.ownerName || 'บีม (QA Lv.4 Supervisor)',
          reviewer_name: 'กัลยาณี พลไกร (QA Lv.5 Lead)',
          approver_name: 'คุณเรย์ (MGMT Lv.6 General Manager)',
          require_ack: true
        });
      }
    });

    // 5. GENESIS FALLBACK: Guarantee Rev.00 is ALWAYS present from genesis to current
    if (!existingRevNums.has(0)) {
      const codeDigits = docCode.replace(/[^0-9]/g, '') || '001';
      list.push({
        id: `DAR-GENESIS-${docCode}-00`,
        dar_no: `DAR-2025-${codeDigits.padStart(3, '0')}`,
        doc_code: doc.document_code || doc.doc_code || doc.title || docCode,
        title: doc.title || docCode,
        revision: '00',
        rev: '00',
        docRev: '00',
        type: 'NEW',
        request_type: 'NEW',
        status: 'COMPLETED',
        effectiveDate: '2025-01-15',
        effective_date_requested: '2025-01-15',
        createdAt: '2025-01-05T08:30:00.000Z',
        reason: 'จัดทำระเบียบปฏิบัติการและเอกสารคุณภาพฉบับเริ่มต้น (Genesis Document Creation)',
        description: 'กำหนดขั้นตอนการทำงาน มาตรฐานการควบคุมคุณภาพ และจุดตรวจสอบสำหรับการปฏิบัติงานประจำวันตามมาตรฐาน ISO 9001:2015',
        requester_name: doc.ownerName || 'บีม (QA Lv.4 Supervisor)',
        reviewer_name: 'กัลยาณี พลไกร (QA Lv.5 Lead)',
        approver_name: 'คุณเรย์ (MGMT Lv.6 General Manager)',
        require_ack: true
      });
    }

    // 6. Guarantee current document revision is represented
    const curRevNum = parseInt(normCurrentRev, 10);
    if (!isNaN(curRevNum) && !existingRevNums.has(curRevNum)) {
      existingRevNums.add(curRevNum);
      const rStr = normCurrentRev;
      list.push({
        id: doc.darId || `DAR-${docCode}-R${rStr}`,
        dar_no: doc.darId || doc.dar_no || `DAR-${new Date(doc.effectiveDate || '2025-01-01').getFullYear() || 2025}-${String(curRevNum + 1).padStart(3, '0')}`,
        doc_code: doc.document_code || doc.doc_code || doc.title || docCode,
        title: doc.title || docCode,
        revision: rStr,
        rev: rStr,
        docRev: rStr,
        type: curRevNum === 0 ? 'NEW' : 'REVISION',
        request_type: curRevNum === 0 ? 'NEW' : 'REVISION',
        status: 'COMPLETED',
        effectiveDate: doc.effectiveDate || doc.effective_date || '2025-01-01',
        effective_date_requested: doc.effectiveDate || doc.effective_date || '2025-01-01',
        createdAt: doc.createdAt || `${doc.effectiveDate || '2025-01-01'}T08:30:00.000Z`,
        reason: doc.reason || doc.revisionNote || (curRevNum === 0 ? 'จัดทำมาตรฐานการปฏิบัติงานและเอกสารควบคุมคุณภาพใหม่ตามข้อกำหนด ISO 9001:2015' : 'ทบทวนและปรับปรุงขั้นตอนการทำงานให้สอดคล้องกับหน้างานจริง'),
        description: doc.description || doc.change_details || 'กำหนดขั้นตอนการทำงาน มาตรฐานการควบคุมคุณภาพ และจุดตรวจสอบสำหรับการปฏิบัติงานประจำวัน',
        requester_name: doc.ownerName || 'บีม (QA Lv.4 Supervisor)',
        reviewer_name: 'กัลยาณี พลไกร (QA Lv.5 Lead)',
        approver_name: 'คุณเรย์ (MGMT Lv.6 General Manager)',
        require_ack: true
      });
    }

    // Sort descending by revision: Rev.02 -> Rev.01 -> Rev.00
    return list.sort((a, b) => {
      const revA = parseInt(String(a.docRev || a.rev || a.revision || '0').replace(/\D/g, ''), 10) || 0;
      const revB = parseInt(String(b.docRev || b.rev || b.revision || '0').replace(/\D/g, ''), 10) || 0;
      if (revB !== revA) return revB - revA;
      return new Date(b.createdAt || b.effectiveDate || 0) - new Date(a.createdAt || a.effectiveDate || 0);
    });
  }, [dars, doc, documents, normCurrentRev]);

  // Scoped DAR list: strictly single DAR for current revision in effective mode, or full history for superseded/obsolete
  const displayedDars = useMemo(() => {
    if (!isEffectiveMode) {
      return docDars;
    }

    const curRevNum = parseInt(normCurrentRev, 10);
    const matched = docDars.filter(dar => {
      const rRaw = dar.targetRevision ?? dar.docRev ?? dar.rev ?? dar.revision;
      if (rRaw !== undefined && rRaw !== null && String(rRaw).trim() !== '') {
        const rNum = parseInt(String(rRaw).replace(/\D/g, ''), 10);
        return !isNaN(rNum) && rNum === curRevNum;
      }
      return false;
    });

    if (matched.length > 0) {
      return [matched[0]];
    }

    // Fallback: If no exact revision match found, return top 1 latest DAR
    return docDars.slice(0, 1);
  }, [isEffectiveMode, docDars, normCurrentRev]);

  // Resolve user display name and position for workflow stage cards
  const resolveSignatory = (userName, fallbackPosition) => {
    if (!userName || userName === '-') {
      return { name: '-', position: fallbackPosition };
    }
    let displayName = String(userName).trim();
    let extractedRole = null;
    const match = displayName.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      displayName = match[1].trim();
      extractedRole = match[2].trim();
    }

    const matchedUser = (masterUsers || []).find(u => 
      u.name === displayName || 
      u.fullName === displayName || 
      u.id === userName ||
      (u.name && displayName.includes(u.name)) ||
      (u.fullName && displayName.includes(u.fullName))
    );

    return {
      name: displayName,
      position: matchedUser?.position || extractedRole || fallbackPosition
    };
  };

  // Permission Check for Requesting Additional Copies
  const canRequestAdditionalCopies = useMemo(() => {
    if (!doc || !currentUser) return false;
    if (isObsoleteDoc) return false; // Never allow requests for obsolete docs

    const isEffective = doc.status === 'EFFECTIVE' || doc.status === 'ACTIVE';
    if (!isEffective) return false;

    const userDept = currentUser.department || currentUser.dept;
    const userDepts = currentUser.depts || (userDept ? [userDept] : []);
    const docDept = doc.owner_dept || doc.department;

    const isOwnerDept = docDept && (docDept === userDept || userDepts.includes(docDept) || (userDept === 'QA' && docDept === 'QA/QC') || (userDept === 'QA/QC' && docDept === 'QA'));
    const isDcc = currentUser.isDcc || currentUser.role === 'DCC_ADMIN' || currentUser.level >= 5;

    return isOwnerDept || isDcc;
  }, [doc, currentUser, isObsoleteDoc]);

  // Accessible departments list (called unconditionally before early returns)
  const accessibleDeptsList = useMemo(() => {
    if (!doc) return [];
    const scope = doc.access_control?.scope || doc.access_scope || 'GENERAL';
    if (scope === 'GENERAL') return [];
    if (scope === 'DEPT_ONLY') {
      const dept = doc.owner_dept || doc.department;
      return dept ? [dept] : [];
    }
    return (
      doc.access_control?.allowed_departments ||
      doc.access_control?.target_departments ||
      doc.target_departments ||
      []
    );
  }, [doc]);

  if (!isOpen || !doc) return null;

  // Export DAR History CSV with detailed DD/MM/YYYY HH:mm timestamps
  const handleExportDarHistoryCsv = () => {
    const targetDars = isEffectiveMode ? displayedDars : docDars;
    if (!targetDars || targetDars.length === 0) return;

    const headers = [
      'รหัสเอกสาร',
      'ชื่อเอกสาร',
      'ฉบับที่ (Rev.)',
      'เลขที่คำร้อง DAR',
      'ประเภทคำร้อง',
      'สถานะคำร้อง',
      'วันที่ยื่นคำขอ',
      'วันที่มีผลบังคับใช้',
      'ผู้ยื่นคำขอ',
      'วันเวลาที่ยื่นคำขอ (Requester Timestamp)',
      'ผู้ทบทวน',
      'วันเวลาที่ทบทวน (Reviewer Timestamp)',
      'ผู้อนุมัติ',
      'วันเวลาที่อนุมัติ (Approver Timestamp)',
      'การรับทราบ',
      'วันเวลาที่รับทราบ (Ack Timestamp)',
      'เหตุผลในการร้องขอ',
      'รายละเอียดคำร้อง/แผนรองรับ'
    ];

    const rows = targetDars.map((dar) => {
      const reasonInfo = getDarReason(dar);
      const detailInfo = getDarDetail(dar);

      const reasonText = (reasonInfo.value && reasonInfo.value !== '-') 
        ? reasonInfo.value 
        : (dar.reason || dar.requestReason || dar.changeReason || dar.otherReason || 'ปรับปรุงระเบียบปฏิบัติงานและเอกสารคุณภาพให้สอดคล้องกับมาตรฐาน ISO 9001:2015');

      const detailText = (detailInfo.value && detailInfo.value !== '-') 
        ? detailInfo.value 
        : (dar.description || dar.changeSummary || dar.requestDetail || dar.change_details || dar.disposition_plan || 'กำหนดขั้นตอนการทำงานและจุดควบคุมสำหรับการปฏิบัติงานประจำวัน');

      const reqName = (getRequesterName(dar, masterUsers) !== '-' ? getRequesterName(dar, masterUsers) : null) || dar.requester_name || dar.requester || dar.requesterName || 'บีม (QA Lv.4)';
      const revName = (getReviewerName(dar, timeline) !== '-' ? getReviewerName(dar, timeline) : null) || dar.reviewer_name || dar.reviewer || dar.reviewerName || 'กัลยาณี พลไกร (QA Lv.5)';
      const appName = (getApproverName(dar, timeline) !== '-' ? getApproverName(dar, timeline) : null) || dar.approver_name || dar.approver || dar.approverName || 'คุณเรย์ (MGMT Lv.6)';
      const ackName = (getAckNames(dar, timeline) !== '-' ? getAckNames(dar, timeline) : null) || dar.ack_name || dar.ackNames || (dar.require_ack !== false ? 'ต้องรับทราบ' : 'ไม่ต้องรับทราบ');

      const reqTimestamp = getWorkflowStepTimestamp(dar, 'REQUEST', timeline);
      const revTimestamp = getWorkflowStepTimestamp(dar, 'REVIEW', timeline);
      const appTimestamp = getWorkflowStepTimestamp(dar, 'APPROVE', timeline);
      const ackTimestamp = getWorkflowStepTimestamp(dar, 'ACK', timeline);

      const docCode = doc.title || doc.document_code || doc.id || '-';
      const docTitle = doc.name || doc.docName || doc.title || '-';
      const rev = dar.docRev || dar.rev || dar.revision || doc.rev || '00';
      const darNo = dar.dar_no || dar.id || '-';
      const requestType = dar.type === 'NEW' || dar.request_type === 'NEW' ? 'สร้างใหม่' : dar.type === 'REVISION' || dar.request_type === 'REVISION' ? 'ขอแก้ไข' : 'ขอยกเลิก';
      const status = dar.status || 'EFFECTIVE';
      const requestDate = dar.createdAt?.split('T')[0] || dar.request_date || dar.requestDate || '-';
      const effectiveDate = dar.effectiveDate || dar.effective_date_requested || dar.obsolete_effective_date || doc.effectiveDate || '-';

      return [
        `"${String(docCode).replace(/"/g, '""')}"`,
        `"${String(docTitle).replace(/"/g, '""')}"`,
        `"${String(rev).replace(/"/g, '""')}"`,
        `"${String(darNo).replace(/"/g, '""')}"`,
        `"${String(requestType).replace(/"/g, '""')}"`,
        `"${String(status).replace(/"/g, '""')}"`,
        `"${String(requestDate).replace(/"/g, '""')}"`,
        `"${String(effectiveDate).replace(/"/g, '""')}"`,
        `"${String(reqName).replace(/"/g, '""')}"`,
        `"${String(reqTimestamp).replace(/"/g, '""')}"`,
        `"${String(revName).replace(/"/g, '""')}"`,
        `"${String(revTimestamp).replace(/"/g, '""')}"`,
        `"${String(appName).replace(/"/g, '""')}"`,
        `"${String(appTimestamp).replace(/"/g, '""')}"`,
        `"${String(ackName).replace(/"/g, '""')}"`,
        `"${String(ackTimestamp).replace(/"/g, '""')}"`,
        `"${String(reasonText).replace(/"/g, '""')}"`,
        `"${String(detailText).replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const sanitizedDocCode = (doc.title || doc.document_code || 'DOC').replace(/[/\\?%*:|"<>]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `DAR_History_${sanitizedDocCode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('ส่งออกประวัติ DAR สำเร็จ');
  };

  // Owner department display resolver
  const ownerDeptDisplay = (() => {
    const d = normalizeDepartmentId(doc?.department || doc?.owner_dept || '');
    const dObj = (masterDepartments || []).find(md => normalizeDepartmentId(md.id) === d);
    return dObj ? `${d} - ${dObj.nameTh || dObj.name}` : (d || '-');
  })();

  // Access Scope Badge Resolver
  const renderAccessScopeBadge = (targetDoc) => {
    const scope = targetDoc?.access_control?.scope || targetDoc?.access_scope || 'GENERAL';
    if (scope === 'GENERAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]">
          <Globe size={13} /> ทั่วไป (General)
        </span>
      );
    }
    if (scope === 'DEPT_ONLY') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFF8E6] text-[#B87C33] border border-[#FDE6B0]">
          <Lock size={13} /> เฉพาะแผนก (Department Only)
        </span>
      );
    }
    if (scope === 'TARGETED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF]">
          <Building2 size={13} /> ระบุแผนก (Targeted)
        </span>
      );
    }
    if (scope === 'RESTRICTED') {
      const minLvl = targetDoc?.access_control?.min_access_level;
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FFF2F0] text-[#F24822] border border-[#FDC4B8]">
          <ShieldAlert size={13} /> ลับเฉพาะ{minLvl ? ` (Lv.${minLvl}+)` : ''}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]">
        <Globe size={13} /> ทั่วไป
      </span>
    );
  };

  return (
    <ErrorBoundary>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-10 my-auto"
          >
            {/* Header: Crisp Bento Titlebar */}
            <div className="px-6 pt-6 pb-4 bg-white border-b border-[#E5E5E5] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] rounded-xl shrink-0">
                  <FileText size={22} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] text-xs font-bold font-mono">
                      {doc.title || doc.document_code}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9] text-xs font-bold font-mono">
                      Rev.{doc.rev || '00'}
                    </span>
                    {isObsoleteDoc ? (
                      <span className="px-2 py-0.5 rounded-md bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] text-xs font-semibold">
                        🚫 ยกเลิกถาวร (Obsolete)
                      </span>
                    ) : isSupersededDoc ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                        ⏳ ฉบับเดิม (Superseded)
                      </span>
                    ) : (
                      <span className="text-xs text-[#777777] font-medium ml-1">
                        Master Document Record
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] tracking-tight break-all break-words min-w-0 [overflow-wrap:anywhere]">
                    {doc.name}
                  </h2>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-[#888888] hover:text-[#1E1E1E] hover:bg-[#F5F5F5] rounded-xl transition-colors shrink-0 ml-2 outline-none cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 bg-[#FAFAFA] border-b border-[#E5E5E5] flex gap-6 shrink-0 relative">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 py-3.5 font-semibold text-xs sm:text-sm transition-all border-b-2 cursor-pointer ${
                  activeTab === 'overview'
                    ? 'text-[#0D99FF] border-[#0D99FF]'
                    : 'text-[#666666] hover:text-[#1E1E1E] border-transparent'
                }`}
              >
                <Layers size={15} strokeWidth={1.75} />
                <span>{isSupersededDoc ? 'สำเนาควบคุม' : 'ข้อมูลทั่วไปและสำเนาควบคุม'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 py-3.5 font-semibold text-xs sm:text-sm transition-all border-b-2 cursor-pointer ${
                  activeTab === 'history'
                    ? 'text-[#0D99FF] border-[#0D99FF]'
                    : 'text-[#666666] hover:text-[#1E1E1E] border-transparent'
                }`}
              >
                <History size={15} strokeWidth={1.75} />
                <span>
                  {isEffectiveMode
                    ? `ข้อมูลคำร้อง DAR (ฉบับปัจจุบัน) (${displayedDars.length})`
                    : `ประวัติ DAR และการแก้ไข (${docDars.length})`}
                </span>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#FBFBFB]">
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  {/* Bento Box Layout: Row 1 - Cards 1 & 2 (Hidden in Superseded Mode) */}
                  {!isSupersededDoc && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Card 1: ข้อมูลแม่บทเอกสาร (Master Data) - 7 cols */}
                      <div className="md:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
                        <div>
                          <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <FileText size={15} className="text-[#0D99FF]" /> ข้อมูลแม่บทเอกสาร (Master Data)
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              isObsoleteDoc
                                ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                                : isSupersededDoc
                                  ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]'
                                  : (doc.status === 'EFFECTIVE' || doc.status === 'ACTIVE')
                                    ? 'bg-[#E6F7ED] text-[#14AE5C] border border-[#B3E7C9]'
                                    : 'bg-[#FFF0F0] text-[#E02424] border border-[#FDE8E8]'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                isObsoleteDoc ? 'bg-[#EF4444]' : isSupersededDoc ? 'bg-[#F59E0B]' : (doc.status === 'EFFECTIVE' || doc.status === 'ACTIVE') ? 'bg-[#14AE5C]' : 'bg-[#E02424]'
                              }`} />
                              {isObsoleteDoc ? 'ยกเลิกถาวร (Obsolete)' : isSupersededDoc ? 'ฉบับเดิม (Superseded)' : (doc.status === 'EFFECTIVE' || doc.status === 'ACTIVE') ? 'มีผลบังคับใช้' : doc.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3.5 text-xs">
                            <div>
                              <p className="text-slate-400 font-medium">รหัสเอกสาร</p>
                              <p className="text-sm font-mono font-bold text-slate-800 mt-0.5">
                                {doc.title || doc.document_code || '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-medium">ฉบับที่ (Revision)</p>
                              <p className="text-sm font-mono font-bold text-[#0D99FF] mt-0.5">
                                Rev.{doc.rev || doc.currentRevision || doc.revision || '00'}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-slate-400 font-medium">ชื่อเอกสาร</p>
                              <p className="text-sm font-semibold text-slate-900 mt-0.5 leading-snug break-words">
                                {doc.name || doc.docName || '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-medium">แผนกเจ้าของเอกสาร</p>
                              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 mt-0.5 truncate">
                                <Building2 size={14} className="text-slate-400 shrink-0" />
                                <span className="truncate">{ownerDeptDisplay}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-slate-400 font-medium">วันที่มีผลบังคับใช้</p>
                              <div className="flex items-center gap-1.5 text-sm font-semibold font-mono text-slate-800 mt-0.5">
                                <Calendar size={14} className="text-slate-400 shrink-0" />
                                <span>{doc.effectiveDate || doc.effective_date || '-'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: ขอบเขตการเข้าถึงและสิทธิ์ (Access Scope Card) - 5 cols */}
                      <div className="md:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
                        <div>
                          <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <ShieldCheck size={15} className="text-[#14AE5C]" /> ขอบเขตการเข้าถึง (Access Scope)
                            </span>
                          </div>

                          <div className="space-y-3.5 text-xs">
                            <div>
                              <p className="text-slate-400 font-medium mb-1.5">ระดับความลับ / สิทธิ์การเข้าถึง</p>
                              <div>{renderAccessScopeBadge(doc)}</div>
                            </div>

                            <div>
                              <p className="text-slate-400 font-medium mb-1.5">แผนกที่มีสิทธิ์เข้าถึง</p>
                              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                {accessibleDeptsList.map((dept, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                                    {dept}
                                  </span>
                                ))}
                                {accessibleDeptsList.length === 0 && (
                                  <span className="text-slate-500 text-xs italic">
                                    ทุกแผนกในองค์กร (General Access)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Toolbar Grid (Button "เปิดดูเอกสาร" hidden in Superseded Mode) */}
                  {(!isSupersededDoc || (currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.role === 'SUPER_ADMIN') || canRequestAdditionalCopies) && (
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Action 1: เปิดดูเอกสาร */}
                      {!isSupersededDoc && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            if (onOpenViewer) onOpenViewer(doc);
                          }}
                          className="h-10 px-4 bg-white border border-[#E5E5E5] hover:bg-[#F5F5F5] text-[#1E1E1E] rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                        >
                          <ExternalLink size={15} strokeWidth={1.75} />
                          <span>เปิดดูเอกสาร</span>
                        </button>
                      )}

                      {/* Action 2: Watermark Studio (DCC Admin Only) */}
                      {(currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
                        <button
                          type="button"
                          onClick={() => setIsWatermarkStudioOpen(true)}
                          className="h-10 px-4 bg-[#F0EDFF] border border-[#D5CDFF] hover:bg-[#E5DFFF] text-[#7B61FF] rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Sparkles size={15} strokeWidth={1.75} />
                          <span>Watermark Studio</span>
                        </button>
                      )}

                      {/* Action 3: ขอสำเนาควบคุมเพิ่มเติม */}
                      {canRequestAdditionalCopies && (
                        <button
                          type="button"
                          onClick={() => setIsRequestModalOpen(true)}
                          className="h-10 px-4 bg-[#0D99FF] hover:bg-[#007BE5] text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer ml-auto"
                          title="ขอสำเนาควบคุมเพิ่มเติม"
                        >
                          <PlusCircle size={15} strokeWidth={1.75} />
                          <span>ขอสำเนาควบคุมเพิ่มเติม</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Card 3: สำเนาควบคุมที่แจกจ่ายประจำจุดใช้งาน (Active Controlled Copies) */}
                  {!isObsoleteDoc && !isSupersededDoc && (
                    <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 shadow-xs space-y-3.5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-[#1E1E1E] text-sm flex items-center gap-2">
                          <Layers size={16} className="text-[#0D99FF]" />
                          สำเนาควบคุมที่แจกจ่ายประจำจุดใช้งาน ({docCopies.length} เล่ม)
                        </h3>
                        <span className="text-xs text-[#64748B] font-medium bg-[#F8FAFC] px-2.5 py-1 rounded-md border border-[#E2E8F0]">
                          ฉบับปัจจุบัน Rev.{currentDocRev}
                        </span>
                      </div>

                    {/* Active Controlled Copies Table */}
                    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white shadow-2xs overflow-x-auto overflow-y-auto max-h-[320px] scrollbar-thin">
                      <table className="w-full text-left text-sm table-fixed border-collapse">
                        <thead className="bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] sticky top-0 z-10 shadow-xs backdrop-blur-sm whitespace-nowrap">
                          <tr>
                            <th className="py-3 px-3.5 w-44 bg-[#F8FAFC]">หมายเลขสำเนา</th>
                            <th className="py-3 px-3.5 w-28 bg-[#F8FAFC]">แผนกผู้รับ</th>
                            <th className="py-3 px-3.5 bg-[#F8FAFC]">จุดติดตั้ง</th>
                            <th className="py-3 px-3.5 text-center w-40 bg-[#F8FAFC]">สถานะสำเนา</th>
                            <th className="py-3 px-3.5 text-center w-32 bg-[#F8FAFC]">วันที่ตรวจรับ</th>
                            <th className="py-3 px-3.5 text-center w-36 bg-[#F8FAFC]">การจัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0F0F0]">
                          {activeCopies.map(copy => {
                            const rawNo = copy.copy_no || copy.ccNumber || '01';
                            const num = parseInt(String(rawNo).replace(/\D/g, ''), 10) || 1;
                            const isOrigin = Boolean(copy.is_owner || copy.isOwner || num === 1);
                            const deptName = copy.holder_dept || copy.department || '-';
                            const locName = cleanLocationName(copy.location || copy.locationName || copy.station_name || `${deptName || 'PD'} Head Office`);
                            return (
                              <tr key={copy.id || `active-${num}`} className="hover:bg-[#F8FAFC] transition-colors">
                                <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-[#F0F7FF] text-[#0284C7] border border-[#BAE6FD]">
                                      Copy {copy.copy_no || copy.ccNumber}
                                    </span>
                                    <span className="font-sans text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                                      เล่มควบคุม
                                    </span>
                                    {isOrigin && (
                                      <span className="font-sans text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                                        จุดต้นทาง
                                      </span>
                                    )}
                                    {(copy.is_replacement || (copy.issue_no && copy.issue_no !== '01')) && (
                                      <span className="inline-block px-2 py-0.5 rounded bg-[#FFF8E6] text-[#B87C33] font-semibold border border-[#FDE6B0] text-xs whitespace-nowrap font-sans w-fit">
                                        Issue {copy.issue_no || '02'} (ทดแทน)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td 
                                  className="py-3 px-3.5 font-semibold text-[#1E293B] truncate align-middle text-sm"
                                  title={deptName}
                                >
                                  <span className="truncate block" title={deptName}>
                                    {deptName}
                                  </span>
                                </td>
                                <td 
                                  className="py-3 px-3.5 text-slate-700 align-middle text-sm"
                                  title={locName}
                                >
                                  <div className="flex items-center gap-1.5 truncate" title={locName}>
                                    <MapPin size={14} className="text-[#14AE5C] shrink-0" />
                                    <span className="truncate" title={locName}>
                                      {locName}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3.5 text-center whitespace-nowrap align-middle">
                                  {renderCopyStatusBadge(copy.status)}
                                </td>
                                <td className="py-3 px-3.5 text-slate-600 text-center whitespace-nowrap font-mono text-xs align-middle">
                                  {formatReceiptDate(copy.receipt_confirmed_at)}
                                </td>
                                <td className="py-3 px-3.5 text-center whitespace-nowrap align-middle">
                                  {(copy.status === 'ISSUED_ACTIVE' || copy.status === 'ACTIVE') ? (
                                    canManageControlledCopy(copy, currentUser) ? (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedReplacementCopy(copy)}
                                        className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFF2F0] hover:bg-[#FFE5E0] text-[#F24822] border border-[#FDC4B8] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                        title="แจ้งเอกสารชำรุดหรือสูญหายประจำจุดนี้เพื่อขอออกเล่มทดแทน"
                                      >
                                        <AlertTriangle size={13} />
                                        <span>แจ้งชำรุด/เล่มใหม่</span>
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-[#94A3B8] italic">
                                        เฉพาะผู้ถือสำเนา
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[#999999] text-xs">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {activeCopies.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-[#888888]">
                                ยังไม่มีสำเนาควบคุมที่แจกจ่ายสำหรับเอกสารนี้
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  )}

                  {/* Phase 3: Accordion Stacking by Revision (ISO 9001 Clause 7.5.3) - For Superseded Docs */}
                  {isSupersededDoc && (
                    <div className="bg-[#FFFDF7] border border-[#FDE68A] rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#FDE68A]">
                        <div className="flex items-center gap-2.5">
                          <span className="p-2 rounded-xl text-base bg-[#FEF3C7] text-[#92400E]">
                            📁
                          </span>
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                              ทะเบียนเรียกคืนและทำลายสำเนาฉบับเดิมแยกตามฉบับ — สำหรับงาน Audit (ISO 9001:2015 Clause 7.5.3)
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              หลักฐานการเรียกคืนและทำลายสำเนาควบคุมฉบับที่ถูกยกเลิก/แทนที่ เพื่อป้องกันการนำไปใช้โดยไม่ได้ตั้งใจ
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]">
                          รวม {groupedRecalledCopies.reduce((acc, g) => acc + g.copies.length, 0)} รายการ
                        </span>
                      </div>

                      {/* Accordion Stack by Revision */}
                      <div className="space-y-3">
                        {groupedRecalledCopies.map(group => {
                          const isExpanded = Boolean(expandedRevs[group.revision]);
                          return (
                            <div 
                              key={group.revision}
                              className={`border rounded-xl overflow-hidden bg-white transition-all shadow-2xs ${
                                isExpanded ? 'border-amber-300 ring-1 ring-amber-200/60' : 'border-[#E2E8F0] hover:border-slate-300'
                              }`}
                            >
                              {/* Accordion Header */}
                              <button
                                type="button"
                                onClick={() => toggleRevision(group.revision)}
                                className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left bg-gradient-to-r from-amber-50/40 to-white hover:bg-amber-50/70 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-xs font-mono font-bold">
                                    {group.displayRev}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                                    {group.copies.length} เล่ม
                                  </span>
                                  {group.isCurrentViewingRev && (
                                    <span className="text-[11px] font-medium text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-300/80">
                                      ฉบับที่กำลังเปิดดู
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0 text-slate-500">
                                  <span className="text-xs font-medium text-slate-400 hidden sm:inline">
                                    {isExpanded ? 'พับเก็บ' : 'ดูรายละเอียด'}
                                  </span>
                                  <div className="p-1 rounded-md text-slate-600 bg-slate-100">
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </div>
                                </div>
                              </button>

                              {/* Accordion Body: Evidence Table */}
                              {isExpanded && (
                                <div className="border-t border-[#E2E8F0] overflow-x-auto max-h-[300px] scrollbar-thin">
                                  <table className="w-full text-left text-sm table-fixed border-collapse">
                                    <thead className="bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] sticky top-0 z-10 shadow-xs backdrop-blur-sm whitespace-nowrap">
                                      <tr>
                                        <th className="py-2.5 px-3 w-36 bg-[#F8FAFC]">หมายเลขสำเนา</th>
                                        <th className="py-2.5 px-3 w-32 bg-[#F8FAFC]">แผนกผู้ถือเดิม</th>
                                        <th className="py-2.5 px-3 bg-[#F8FAFC]">จุดติดตั้งเดิม</th>
                                        <th className="py-2.5 px-3 text-center w-24 bg-[#F8FAFC]">ฉบับเดิม</th>
                                        <th className="py-2.5 px-3 text-center w-44 bg-[#F8FAFC]">สถานะการเรียกคืน</th>
                                        <th className="py-2.5 px-3 text-center w-36 bg-[#F8FAFC]">วันที่เรียกคืน/ทำลาย</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#F0F0F0]">
                                      {group.copies.map(copy => {
                                        const deptName = copy.departmentName || copy.department || copy.holder_dept || '-';
                                        const locName = cleanLocationName(copy.location || copy.originalLocation || copy.point || copy.locationName || copy.station_name || `${deptName || 'PD'} Head Office`);
                                        return (
                                          <tr key={copy.id || `${group.revision}-${copy.copy_no}`} className="hover:bg-[#FFFBF5] transition-colors">
                                            <td className="py-2.5 px-3 whitespace-nowrap align-middle">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
                                                  Copy {copy.copy_no || copy.ccNumber}
                                                </span>
                                                <span className="font-sans text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                                                  เล่มควบคุม
                                                </span>
                                                {(copy.is_replacement || (copy.issue_no && copy.issue_no !== '01')) && (
                                                  <span className="inline-block px-1.5 py-0.5 rounded bg-[#FFF8E6] text-[#B87C33] font-semibold border border-[#FDE6B0] text-[10px] whitespace-nowrap">
                                                    Issue {copy.issue_no || '02'}
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td 
                                              className="py-2.5 px-3 font-semibold text-[#1E293B] truncate align-middle text-sm"
                                              title={deptName}
                                            >
                                              <span className="truncate block" title={deptName}>
                                                {deptName}
                                              </span>
                                            </td>
                                            <td 
                                              className="py-2.5 px-3 text-slate-700 align-middle text-sm"
                                              title={locName}
                                            >
                                              <div className="flex items-center gap-1.5 truncate" title={locName}>
                                                <MapPin size={13} className="text-[#94A3B8] shrink-0" />
                                                <span className="truncate" title={locName}>
                                                  {locName}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap align-middle">
                                              <span className="inline-block px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-xs font-mono font-bold">
                                                {group.displayRev}
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap align-middle">
                                              {renderCopyStatusBadge(copy.status)}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 text-center whitespace-nowrap font-mono text-xs align-middle">
                                              {formatReceiptDate(copy.destroyed_at || copy.dateDestroyed || copy.recalled_at || copy.dateRecalled || copy.superseded_at)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                      {group.copies.length === 0 && (
                                        <tr>
                                          <td colSpan={6} className="py-6 text-center text-slate-500 text-xs">
                                            <div className="flex flex-col items-center gap-1.5">
                                              <span className="font-medium text-slate-600">ไม่มีรายการสำเนาควบคุมค้างเรียกคืนสำหรับ {group.displayRev}</span>
                                              <span className="text-slate-400 text-[11px]">
                                                เอกสารชุดนี้อาจเป็นรูปแบบ Paperless หรือไม่มีบันทึกการแจกจ่ายเล่มควบคุมทางกายภาพ
                                              </span>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {groupedRecalledCopies.length === 0 && (
                          <div className="border border-[#E2E8F0] rounded-xl p-8 text-center text-slate-500 bg-white">
                            <Sparkles size={24} className="mx-auto text-slate-300 mb-2" />
                            <p className="font-semibold text-slate-700 text-sm">ไม่พบบันทึกสำเนาควบคุมสำหรับเอกสารฉบับนี้</p>
                            <p className="text-slate-400 text-xs mt-1">ไม่มีข้อมูลการออกเล่มสำเนาทางกายภาพในระบบ</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recall & Disposal Ledger (ISO 9001 Clause 7.5.3) - For Obsolete Docs */}
                  {isObsoleteDoc && (
                    <div className="bg-[#FFF0F0] border-[#FECACA] border rounded-2xl p-5 shadow-xs space-y-3.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="p-2 rounded-xl text-base bg-[#FEE2E2] text-[#991B1B]">
                            🗑️
                          </span>
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                              ทะเบียนบันทึกการเรียกคืนและทำลาย (ทุกฉบับ) — สำหรับงาน Audit (ISO 9001:2015 Clause 7.5.3)
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              หลักฐานการเรียกคืนและทำลายสำเนาควบคุม "ทั้งหมด" เนื่องจากเอกสารรหัสนี้ถูกยกเลิกการใช้งานถาวร
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]">
                          {recalledCopies.length} รายการ
                        </span>
                      </div>

                      {/* Evidence Table */}
                      <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white shadow-2xs overflow-x-auto max-h-[280px] scrollbar-thin">
                        <table className="w-full text-left text-sm table-fixed border-collapse">
                          <thead className="bg-[#F8FAFC] text-[#374151] font-bold text-xs uppercase tracking-wider border-b border-[#E2E8F0] sticky top-0 z-10 shadow-xs backdrop-blur-sm whitespace-nowrap">
                            <tr>
                              <th className="py-2.5 px-3 w-36 bg-[#F8FAFC]">หมายเลขสำเนา</th>
                              <th className="py-2.5 px-3 w-28 bg-[#F8FAFC]">แผนกผู้ถือเดิม</th>
                              <th className="py-2.5 px-3 bg-[#F8FAFC]">จุดติดตั้งเดิม</th>
                              <th className="py-2.5 px-3 text-center w-24 bg-[#F8FAFC]">ฉบับเดิม</th>
                              <th className="py-2.5 px-3 text-center w-48 bg-[#F8FAFC]">สถานะการเรียกคืน</th>
                              <th className="py-2.5 px-3 text-center w-36 bg-[#F8FAFC]">วันที่เรียกคืน/ทำลาย</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F0F0F0]">
                            {recalledCopies.map(copy => {
                              const deptName = copy.departmentName || copy.department || copy.holder_dept || '-';
                              const locName = copy.location || copy.originalLocation || copy.point || copy.locationName || copy.station_name || `${deptName || 'PD'} Head Office`;
                              return (
                                <tr key={copy.id || `${copy.displayRev}-${copy.copy_no}`} className="hover:bg-[#FFFBF5] transition-colors">
                                  <td className="py-2.5 px-3 whitespace-nowrap align-middle">
                                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
                                      Copy {copy.copy_no || copy.ccNumber}
                                    </span>
                                  </td>
                                  <td 
                                    className="py-2.5 px-3 font-semibold text-[#1E293B] truncate align-middle text-sm"
                                    title={deptName}
                                  >
                                    <span className="truncate block" title={deptName}>
                                      {deptName}
                                    </span>
                                  </td>
                                  <td 
                                    className="py-2.5 px-3 text-slate-700 align-middle text-sm"
                                    title={locName}
                                  >
                                    <div className="flex items-center gap-1.5 truncate" title={locName}>
                                      <MapPin size={13} className="text-[#94A3B8] shrink-0" />
                                      <span className="truncate" title={locName}>
                                        {locName}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap align-middle">
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-xs font-mono font-bold">
                                      Rev.{copy.displayRev || copy.rev || copy.doc_version || '00'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap align-middle">
                                    {renderCopyStatusBadge(copy.status)}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600 text-center whitespace-nowrap font-mono text-xs align-middle">
                                    {formatReceiptDate(copy.destroyed_at || copy.dateDestroyed || copy.recalled_at || copy.dateRecalled || copy.superseded_at)}
                                  </td>
                                </tr>
                              );
                            })}
                            {recalledCopies.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                                  <div className="flex flex-col items-center gap-2">
                                    <Sparkles size={24} className="text-slate-300" />
                                    <span className="font-semibold text-slate-600">ไม่มีรายการสำเนาควบคุมค้างเรียกคืน</span>
                                    <span className="text-slate-400">
                                      เอกสารชุดนี้เป็นรูปแบบอิเล็กทรอนิกส์ (Paperless) ทั้งหมด ไม่มีบันทึกการทำลายเล่มควบคุมทางกายภาพ
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-6 w-full max-w-full">
                  {/* History Header & Export CSV */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] gap-3">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-[#0D99FF]" />
                      <h3 className="font-bold text-[#1E1E1E] text-sm">
                        {isEffectiveMode ? 'ข้อมูลคำร้อง DAR (ฉบับปัจจุบัน)' : 'ประวัติ DAR และวงจรการแก้ไข'}
                      </h3>
                      <span className="text-xs text-[#666666] font-medium bg-[#FAFAFA] px-2.5 py-0.5 rounded-md border border-[#E5E5E5]">
                        {isEffectiveMode ? `ฉบับปัจจุบัน (Rev.${normCurrentRev})` : `พบทั้งหมด ${docDars.length} ฉบับ`}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleExportDarHistoryCsv}
                      disabled={(isEffectiveMode ? displayedDars : docDars).length === 0}
                      className="h-9 px-3.5 text-xs font-semibold text-[#1E1E1E] bg-white border border-[#E5E5E5] hover:bg-[#F5F5F5] hover:border-[#CCCCCC] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="ส่งออกประวัติ DAR เป็นไฟล์ CSV สำหรับเปิดใน Excel"
                    >
                      <Download className="text-[#0D99FF]" size={15} strokeWidth={1.75} />
                      <span>{isEffectiveMode ? 'ส่งออกข้อมูล (CSV)' : 'ส่งออกประวัติ (CSV)'}</span>
                    </button>
                  </div>

                  {/* Phase 2: Premium Single-DAR Bento Card UI (Effective Mode) */}
                  {isEffectiveMode && displayedDars.length > 0 && (() => {
                    const dar = displayedDars[0];
                    const reasonInfo = getDarReason(dar);
                    const detailInfo = getDarDetail(dar);

                    const reasonText = (reasonInfo.value && reasonInfo.value !== '-')
                      ? reasonInfo.value
                      : (dar.reason || dar.requestReason || dar.changeReason || dar.otherReason || 'ปรับปรุงระเบียบปฏิบัติงานและเอกสารคุณภาพให้สอดคล้องกับมาตรฐาน ISO 9001:2015');

                    const detailText = (detailInfo.value && detailInfo.value !== '-')
                      ? detailInfo.value
                      : (dar.description || dar.changeSummary || dar.requestDetail || dar.change_details || dar.disposition_plan || 'กำหนดขั้นตอนการทำงานและจุดควบคุมสำหรับการปฏิบัติงานประจำวัน');

                    const rawReqName = (getRequesterName(dar, masterUsers) !== '-' ? getRequesterName(dar, masterUsers) : null) || dar.requester_name || dar.requester || dar.requesterName || 'บีม (QA Lv.4)';
                    const rawRevName = (getReviewerName(dar, timeline) !== '-' ? getReviewerName(dar, timeline) : null) || dar.reviewer_name || dar.reviewer || dar.reviewerName || 'กัลยาณี พลไกร (QA Lv.5)';
                    const rawAppName = (getApproverName(dar, timeline) !== '-' ? getApproverName(dar, timeline) : null) || dar.approver_name || dar.approver || dar.approverName || 'คุณเรย์ (MGMT Lv.6)';
                    const rawAckName = (getAckNames(dar, timeline) !== '-' ? getAckNames(dar, timeline) : null) || dar.ack_name || dar.ackNames || (dar.require_ack !== false ? 'ต้องรับทราบ' : 'ไม่ต้องรับทราบ');

                    const reqSignatory = resolveSignatory(rawReqName, 'ผู้จัดทำเอกสาร (Requester)');
                    const revSignatory = resolveSignatory(rawRevName, 'ผู้ทบทวนเอกสาร (Reviewer)');
                    const appSignatory = resolveSignatory(rawAppName, 'ผู้อนุมัติเอกสาร (Approver)');
                    const ackSignatory = resolveSignatory(rawAckName, 'ผู้รับทราบ/ตัวแทนแผนก (Acknowledged)');

                    const reqTimestamp = getWorkflowStepTimestamp(dar, 'REQUEST', timeline);
                    const revTimestamp = getWorkflowStepTimestamp(dar, 'REVIEW', timeline);
                    const appTimestamp = getWorkflowStepTimestamp(dar, 'APPROVE', timeline);
                    const ackTimestamp = getWorkflowStepTimestamp(dar, 'ACK', timeline);

                    const darType = dar.type || dar.request_type || (parseInt(normCurrentRev, 10) === 0 ? 'NEW' : 'REVISION');
                    const isObsoleteType = darType === 'OBSOLETE' || dar.is_obsolete;
                    const isRevisionType = darType === 'REVISION';
                    const darRevStr = String(dar.docRev || dar.rev || dar.revision || normCurrentRev).padStart(2, '0');
                    const darNo = dar.dar_no || dar.id || `DAR-2026-${darRevStr}`;
                    const effDate = dar.effectiveDate || dar.effective_date_requested || dar.createdAt?.split('T')[0] || doc.effectiveDate || '-';

                    const handleDownloadPdf = async () => {
                      try {
                        const toastId = toast.loading(`กำลังสร้าง PDF Rev.${darRevStr}...`);
                        const targetDoc = {
                          ...doc,
                          rev: darRevStr,
                          revision: darRevStr,
                          status: doc.status || 'EFFECTIVE'
                        };
                        const watermarkConfig = resolveWatermarkConfig(targetDoc, {
                          currentUser,
                          isHistoricalRev: false
                        });
                        await UniversalWatermarkService.generateAndDownloadPdf(targetDoc, watermarkConfig, {
                          userName: currentUser?.name || 'DCC Officer',
                          userDept: currentUser?.department || 'DC'
                        });
                        toast.dismiss(toastId);
                        toast.success(`ดาวน์โหลด PDF Rev.${darRevStr} สำเร็จ`);
                      } catch (err) {
                        console.error(err);
                        toast.error('เกิดข้อผิดพลาดในการดาวน์โหลด');
                      }
                    };

                    return (
                      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
                        {/* 1. Card Header Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                          {/* Left: รหัส DAR (Mono font ตัวหนา) + ชิปประเภทคำร้อง + Badge Rev.XX (ฉบับปัจจุบัน) สีเขียวมรกต */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-sm sm:text-base font-bold text-slate-800 tracking-tight bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                              {darNo}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              isObsoleteType
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : isRevisionType
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}>
                              {isObsoleteType ? 'ขอยกเลิก' : isRevisionType ? 'ขอแก้ไข' : 'ขอจัดทำใหม่'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Rev.{darRevStr} (ฉบับปัจจุบัน)
                            </span>
                          </div>

                          {/* Right: สถานะ COMPLETED สีเขียวพร้อมไอคอนเช็กถูก + วันที่บังคับใช้ + ปุ่มดาวน์โหลดไฟล์ PDF เอกสารแนบ */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              COMPLETED
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium px-2 py-1 rounded-lg bg-slate-50 border border-slate-200/60" title="วันที่มีผลบังคับใช้">
                              <Calendar size={13} className="text-slate-400 shrink-0" />
                              <span>มีผล: <strong className="font-mono text-slate-800">{effDate}</strong></span>
                            </div>
                            <button
                              type="button"
                              onClick={handleDownloadPdf}
                              title={`ดาวน์โหลด PDF Rev.${darRevStr}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0D99FF] hover:bg-[#0088EE] active:scale-95 text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer"
                            >
                              <Download size={13} strokeWidth={2} />
                              <span>ดาวน์โหลด PDF</span>
                            </button>
                          </div>
                        </div>

                        {/* 2. Content Bento Grid (2 คอลัมน์ หรือ 2 กล่องย่อย) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* กล่องที่ 1 (เหตุผลการแก้ไข) */}
                          <div className="bg-slate-50/80 hover:bg-slate-50/95 border border-slate-200/80 rounded-2xl p-4.5 sm:p-5 transition-all shadow-2xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2.5">
                                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                                  <FileText size={14} />
                                </div>
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                  {String(reasonInfo?.title || 'เหตุผลการแก้ไข').replace(/[:\s]+$/, '')}
                                </h4>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-800 font-normal leading-relaxed break-words pl-0.5">
                                {reasonText}
                              </p>
                            </div>
                          </div>

                          {/* กล่องที่ 2 (สรุปการเปลี่ยนแปลง) */}
                          <div className="bg-slate-50/80 hover:bg-slate-50/95 border border-slate-200/80 rounded-2xl p-4.5 sm:p-5 transition-all shadow-2xs flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2.5">
                                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
                                  <Sparkles size={14} />
                                </div>
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                  {String(detailInfo?.title || 'สรุปการเปลี่ยนแปลง').replace(/[:\s]+$/, '')}
                                </h4>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-800 font-normal leading-relaxed break-words pl-0.5">
                                {detailText}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 3. Compact 4-Stage Approval Flow (grid-cols-2 lg:grid-cols-4 for responsive comfort) */}
                        <div>
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-emerald-600" />
                            <span>ขั้นตอนและบันทึกการอนุมัติ (Approval Workflow Record)</span>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Stage 1: ผู้ร้องขอ */}
                            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    1. ผู้ร้องขอ
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                    <CheckCircle2 size={10} className="text-emerald-600" /> ร้องขอ
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={reqSignatory.name}>
                                  {reqSignatory.name}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={reqSignatory.position}>
                                  {reqSignatory.position}
                                </p>
                              </div>
                              <div className="pt-2 mt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] font-mono text-slate-600">
                                <Clock size={11} className="text-[#0D99FF] shrink-0" />
                                <span>{reqTimestamp}</span>
                              </div>
                            </div>

                            {/* Stage 2: ผู้ทบทวน */}
                            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    2. ผู้ทบทวน
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                    <CheckCircle2 size={10} className="text-emerald-600" /> ทบทวนแล้ว
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={revSignatory.name}>
                                  {revSignatory.name}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={revSignatory.position}>
                                  {revSignatory.position}
                                </p>
                              </div>
                              <div className="pt-2 mt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] font-mono text-slate-600">
                                <Clock size={11} className="text-[#0D99FF] shrink-0" />
                                <span>{revTimestamp}</span>
                              </div>
                            </div>

                            {/* Stage 3: ผู้อนุมัติ */}
                            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    3. ผู้อนุมัติ
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                    <CheckCircle2 size={10} className="text-emerald-600" /> อนุมัติแล้ว
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={appSignatory.name}>
                                  {appSignatory.name}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={appSignatory.position}>
                                  {appSignatory.position}
                                </p>
                              </div>
                              <div className="pt-2 mt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] font-mono text-slate-600">
                                <Clock size={11} className="text-[#0D99FF] shrink-0" />
                                <span>{appTimestamp}</span>
                              </div>
                            </div>

                            {/* Stage 4: การรับทราบ (Ack) */}
                            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    4. การรับทราบ (Ack)
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                    <CheckCircle2 size={10} className="text-emerald-600" /> รับทราบแล้ว
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-emerald-700 truncate" title={ackSignatory.name}>
                                  {ackSignatory.name}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={ackSignatory.position}>
                                  {ackSignatory.position}
                                </p>
                              </div>
                              <div className="pt-2 mt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] font-mono text-slate-600">
                                <Clock size={11} className="text-[#0D99FF] shrink-0" />
                                <span>{ackTimestamp}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Superseded / Obsolete Mode: Unified Sequential Lifecycle Roadmap (Timeline Line & Dots) */}
                  {!isEffectiveMode && docDars.length > 0 && (
                    <div className="relative pl-7 pt-1">
                      {/* Timeline Spine */}
                      <div className="absolute left-2.5 top-3 bottom-3 w-0.5 bg-[#CBD5E1] rounded-full" />

                      <div className="space-y-4">
                        {docDars.map((dar, idx) => {
                          const reasonInfo = getDarReason(dar);
                          const detailInfo = getDarDetail(dar);

                          const reasonText = (reasonInfo.value && reasonInfo.value !== '-')
                            ? reasonInfo.value
                            : (dar.reason || dar.requestReason || dar.changeReason || dar.otherReason || 'ปรับปรุงระเบียบปฏิบัติงานและเอกสารคุณภาพให้สอดคล้องกับมาตรฐาน ISO 9001:2015');

                          const detailText = (detailInfo.value && detailInfo.value !== '-')
                            ? detailInfo.value
                            : (dar.description || dar.changeSummary || dar.requestDetail || dar.change_details || dar.disposition_plan || 'กำหนดขั้นตอนการทำงานและจุดควบคุมสำหรับการปฏิบัติงานประจำวัน');

                          const reqName = (getRequesterName(dar, masterUsers) !== '-' ? getRequesterName(dar, masterUsers) : null) || dar.requester_name || dar.requester || dar.requesterName || 'บีม (QA Lv.4)';
                          const revName = (getReviewerName(dar, timeline) !== '-' ? getReviewerName(dar, timeline) : null) || dar.reviewer_name || dar.reviewer || dar.reviewerName || 'กัลยาณี พลไกร (QA Lv.5)';
                          const appName = (getApproverName(dar, timeline) !== '-' ? getApproverName(dar, timeline) : null) || dar.approver_name || dar.approver || dar.approverName || 'คุณเรย์ (MGMT Lv.6)';
                          const ackName = (getAckNames(dar, timeline) !== '-' ? getAckNames(dar, timeline) : null) || dar.ack_name || dar.ackNames || (dar.require_ack !== false ? 'ต้องรับทราบ' : 'ไม่ต้องรับทราบ');

                          const isLatest = idx === 0;
                          const darType = dar.type || dar.request_type || 'NEW';
                          const darStatus = dar.status || 'EFFECTIVE';
                          const isObsoleteType = darType === 'OBSOLETE' || dar.is_obsolete;
                          const isRevisionType = darType === 'REVISION';
                          const isEffective = darStatus === 'EFFECTIVE' || darStatus === 'COMPLETED';

                          const darRevStr = String(dar.docRev || dar.rev || dar.revision || '00').padStart(2, '0');
                          const darRevNum = parseInt(darRevStr, 10);
                          const currentDocRevNum = parseInt(String(currentDocRev).replace(/\D/g, ''), 10);
                          const isCurrentViewingRev = darRevNum === currentDocRevNum;

                          let dotBg = 'bg-[#94A3B8]';
                          let dotRing = 'ring-[#E2E8F0]';
                          if (isCurrentViewingRev) {
                            dotBg = 'bg-[#0D99FF]';
                            dotRing = 'ring-[#BAE6FD]';
                          } else if (isLatest && !isObsoleteType) {
                            dotBg = 'bg-[#14AE5C]';
                            dotRing = 'ring-[#BBF7D0]';
                          } else if (isObsoleteType) {
                            dotBg = 'bg-[#DC2626]';
                            dotRing = 'ring-[#FECACA]';
                          } else if (isEffective) {
                            dotBg = 'bg-[#D97706]';
                            dotRing = 'ring-[#FDE68A]';
                          }

                          const handleDownloadHistoricalPdf = async () => {
                            try {
                              const targetRev = darRevStr;
                              const toastId = toast.loading(`กำลังสร้าง PDF Rev.${targetRev}...`);
                              const isHistoricalRev = !isLatest;
                              const targetDoc = {
                                ...doc,
                                rev: targetRev,
                                revision: targetRev,
                                status: isObsoleteType ? 'OBSOLETE' : (isLatest ? doc.status : 'SUPERSEDED'),
                                is_obsolete: isObsoleteType,
                                obsolete_dar_id: isObsoleteType ? (dar.dar_no || dar.id) : undefined,
                                superseded_by_rev: isHistoricalRev ? (doc.rev || doc.revision || 'Latest') : undefined
                              };
                              const watermarkConfig = resolveWatermarkConfig(targetDoc, {
                                currentUser,
                                isHistoricalRev
                              });
                              await UniversalWatermarkService.generateAndDownloadPdf(targetDoc, watermarkConfig, {
                                userName: currentUser?.name || 'DCC Officer',
                                userDept: currentUser?.department || 'DC'
                              });
                              toast.dismiss(toastId);
                              toast.success(`ดาวน์โหลด PDF Rev.${targetRev} สำเร็จ`);
                            } catch (err) {
                              console.error(err);
                              toast.error('เกิดข้อผิดพลาดในการดาวน์โหลด');
                            }
                          };

                          const darNo = dar.dar_no || dar.id || `DAR-2026-${darRevStr}`;
                          const effDate = dar.effectiveDate || dar.effective_date_requested || dar.createdAt?.split('T')[0] || '-';

                          return (
                            <div key={dar.id || idx} className="relative">
                              {/* Timeline Dot */}
                              <div className={`absolute -left-[23px] top-4 w-3.5 h-3.5 rounded-full ${dotBg} ring-4 ${dotRing} shadow-xs z-10`} />

                              {/* Compact Lifecycle Card */}
                              <div className={`bg-white border rounded-xl p-4 shadow-2xs space-y-3 min-w-0 max-w-full overflow-hidden transition-all ${
                                isCurrentViewingRev ? 'border-[#0D99FF]/50 ring-1 ring-[#0D99FF]/20 bg-blue-50/10' : 'border-[#E2E8F0]'
                              }`}>
                                {/* Header Row */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#F1F5F9]">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-[#0D99FF] bg-[#E5F4FF] border border-[#B8E1FF] px-2.5 py-1 rounded-md shadow-2xs">
                                      Rev.{darRevStr} · {darNo}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase ${
                                      isObsoleteType
                                        ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                                        : isRevisionType
                                          ? 'bg-[#FFF8E6] text-[#B87C33] border border-[#FDE6B0]'
                                          : 'bg-[#F0EDFF] text-[#7B61FF] border border-[#D5CDFF]'
                                    }`}>
                                      {isObsoleteType ? 'ขอยกเลิก' : isRevisionType ? 'ขอแก้ไข' : 'ขอจัดทำใหม่'}
                                    </span>
                                    {isCurrentViewingRev && (
                                      <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold border border-[#BBF7D0]">
                                        ● ฉบับที่เปิดดู
                                      </span>
                                    )}
                                    {isLatest && !isCurrentViewingRev && !isObsoleteType && (
                                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                                        ฉบับล่าสุด
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0]">
                                      {darStatus}
                                    </span>
                                    <span className="text-xs font-mono text-[#64748B]" title="วันที่มีผลบังคับใช้">
                                      {effDate}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={handleDownloadHistoricalPdf}
                                      title={`ดาวน์โหลด Archive PDF Rev.${darRevStr}`}
                                      className="p-1.5 rounded-lg bg-[#F0F7FF] hover:bg-[#DBEAFE] text-[#0D99FF] border border-[#BFDBFE] transition-colors cursor-pointer"
                                    >
                                      <Download size={13} strokeWidth={2} />
                                    </button>
                                  </div>
                                </div>

                                {/* Reason & Change Details */}
                                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 space-y-2 text-xs sm:text-sm min-w-0 max-w-full overflow-hidden">
                                  <div className="min-w-0 w-full space-y-0.5">
                                    <span className="font-bold text-[#374151] block text-xs">
                                      {String(reasonInfo?.title || 'เหตุผลในการร้องขอ').replace(/[:\s]+$/, '')}:
                                    </span>
                                    <p className="text-[#1E293B] font-normal leading-relaxed break-words text-xs sm:text-sm">
                                      {reasonText}
                                    </p>
                                  </div>
                                  <div className="min-w-0 w-full space-y-0.5 pt-2 border-t border-[#EDF2F7]">
                                    <span className="font-bold text-[#374151] block text-xs">
                                      {String(detailInfo?.title || 'รายละเอียดการเปลี่ยนแปลง / แผนรองรับ').replace(/[:\s]+$/, '')}:
                                    </span>
                                    <p className="text-[#475569] leading-relaxed break-words text-xs sm:text-sm">
                                      {detailText}
                                    </p>
                                  </div>
                                </div>

                                {/* Compact 4-Stage Approval Workflow Grid with Timestamps */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#F1F5F9] bg-[#FAFAFA] p-2.5 rounded-lg text-xs">
                                  <div className="min-w-0">
                                    <p className="text-[#64748B] font-medium text-[11px]">1. ผู้ร้องขอ (Requester)</p>
                                    <p className="font-bold text-[#1E293B] mt-0.5 truncate text-xs">{reqName}</p>
                                    <p className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                                      <Clock size={10} className="text-[#0D99FF] shrink-0" />
                                      <span>{getWorkflowStepTimestamp(dar, 'REQUEST', timeline)}</span>
                                    </p>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[#64748B] font-medium text-[11px]">2. ผู้ทบทวน (Reviewer)</p>
                                    <p className="font-bold text-[#1E293B] mt-0.5 truncate text-xs">{revName}</p>
                                    <p className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                                      <Clock size={10} className="text-[#0D99FF] shrink-0" />
                                      <span>{getWorkflowStepTimestamp(dar, 'REVIEW', timeline)}</span>
                                    </p>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[#64748B] font-medium text-[11px]">3. ผู้อนุมัติ (Approver)</p>
                                    <p className="font-bold text-[#1E293B] mt-0.5 truncate text-xs">{appName}</p>
                                    <p className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                                      <Clock size={10} className="text-[#0D99FF] shrink-0" />
                                      <span>{getWorkflowStepTimestamp(dar, 'APPROVE', timeline)}</span>
                                    </p>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[#64748B] font-medium text-[11px]">4. การรับทราบ (Ack)</p>
                                    <p className="font-bold text-[#14AE5C] mt-0.5 truncate text-xs">{ackName}</p>
                                    <p className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                                      <Clock size={10} className="text-[#0D99FF] shrink-0" />
                                      <span>{getWorkflowStepTimestamp(dar, 'ACK', timeline)}</span>
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fallback Empty State: Simple, elegant 1-line display */}
                  {((isEffectiveMode ? displayedDars : docDars).length === 0) && (
                    <div className="p-8 bg-white border border-dashed border-[#E2E8F0] rounded-2xl text-center text-slate-500 text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-2xs">
                      <Sparkles size={16} className="text-slate-400 shrink-0" />
                      <span>ยังไม่มีบันทึกข้อมูลคำร้อง DAR สำหรับเอกสารฉบับนี้ในระบบ</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Request Additional Copies Modal */}
      {isRequestModalOpen && (
        <RequestAdditionalCopiesModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          document={doc}
        />
      )}

      {/* Watermark Studio Modal */}
      {isWatermarkStudioOpen && (
        <WatermarkStudioModal
          isOpen={isWatermarkStudioOpen}
          onClose={() => setIsWatermarkStudioOpen(false)}
          document={doc}
          currentUser={currentUser}
        />
      )}

      {/* Point-of-Use Station Replacement Modal */}
      {selectedReplacementCopy && (
        <ReplacementModal
          isOpen={!!selectedReplacementCopy}
          onClose={(success, type, reason) => {
            if (success && type && reason) {
              try {
                reportCcDamagedLost(selectedReplacementCopy.id, type, reason);
                toast.success('ยื่นคำร้องขอสำเนาทดแทนเรียบร้อยแล้ว กรุณารอเจ้าหน้าที่ DCC จัดพิมพ์และส่งมอบ');
                setSelectedReplacementCopy(null);
              } catch (err) {
                console.error('[DocumentDetailModal] reportCcDamagedLost failed:', err);
                toast.error(err?.message || 'เกิดข้อผิดพลาดในการทำรายการ');
                throw err;
              }
            } else {
              setSelectedReplacementCopy(null);
            }
          }}
          instance={selectedReplacementCopy}
        />
      )}
    </ErrorBoundary>
  );
};

export default DocumentDetailModal;
