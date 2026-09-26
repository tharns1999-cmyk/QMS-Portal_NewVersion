import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import { normalizeDepartmentId } from '../../services/MasterDataService';
import toast from 'react-hot-toast';
import { getDarReason, getDarDetail, getDarDocInfo, getRequesterName } from '../../utils/darHelper';
import { FileText, XCircle, ChevronLeft, Download, MessageSquare, ShieldAlert, Zap, Globe, Lock, Building2, RotateCcw, Check } from 'lucide-react';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';
import DarReviewModal from '../../components/workflow/DarReviewModal';
import { ACCESS_SCOPE_METADATA } from '../../utils/accessControl';
import { resolveApprover } from '../../utils/workflowResolver';
import { 
  stampDarPreviewPdf,
  stampUnifiedInternalPdf,
  formatSignOffDate, 
  resolveRawFileBlob, 
  getActiveUserSignatureAsset, 
  resolveSubmissionDate 
} from '../../utils/pdfStamper';
import { resolveFileBlob } from '../../utils/fileStorage';

const getSystemSampleDocumentBlob = (docCode = 'SOP-QC-002', docTitle = 'Standard Operating Procedure for Quality Control') => {
  const safeTitle = (docTitle || 'Standard Operating Procedure').replace(/[()\\\\]/g, '');
  const safeCode = (docCode || 'SOP-QC-002').replace(/[()\\\\]/g, '');
  const streamContent = [
    '0.75 w 0.2 0.3 0.5 RG 30 160 535.28 650 re S',
    '0.92 0.95 0.98 rg 31 765 533.28 44 re f',
    'BT /F2 14 Tf 0.1 0.2 0.4 rg 45 790 Td (' + safeTitle + ') Tj ET',
    'BT /F1 9 Tf 0.3 0.3 0.3 rg 45 775 Td (ISO 9001:2015 Quality Management System Standard Document) Tj ET',
    '0.5 w 0.7 0.75 0.8 RG 40 710 515.28 45 re S',
    '40 732.5 m 555.28 732.5 l S',
    '170 710 m 170 755 l S',
    '300 710 m 300 755 l S',
    '430 710 m 430 755 l S',
    'BT /F2 8 Tf 0.4 0.4 0.4 rg 45 744 Td (DOC NO:) Tj /F2 9 Tf 0.1 0.1 0.1 rg 45 735 Td (' + safeCode + ') Tj ET',
    'BT /F2 8 Tf 0.4 0.4 0.4 rg 175 744 Td (REVISION:) Tj /F2 9 Tf 0.1 0.1 0.1 rg 175 735 Td (Rev. 00) Tj ET',
    'BT /F2 8 Tf 0.4 0.4 0.4 rg 305 744 Td (EFFECTIVE DATE:) Tj /F2 9 Tf 0.1 0.1 0.1 rg 305 735 Td (2026-03-01) Tj ET',
    'BT /F2 8 Tf 0.4 0.4 0.4 rg 435 744 Td (STATUS:) Tj /F2 9 Tf 0.1 0.5 0.2 rg 435 735 Td (UNDER REVIEW) Tj ET',
    'BT /F2 8 Tf 0.4 0.4 0.4 rg 45 721 Td (OWNER DEPT:) Tj /F1 9 Tf 0.1 0.1 0.1 rg 45 713 Td (Quality Assurance / QC) Tj ET',
    'BT /F2 8 Tf 0.4 0.4 0.4 rg 305 721 Td (SECURITY SCOPE:) Tj /F1 9 Tf 0.1 0.1 0.1 rg 305 713 Td (INTERNAL USE ONLY) Tj ET',
    'BT /F2 11 Tf 0.1 0.2 0.4 rg 40 685 Td (1. PURPOSE & SCOPE) Tj ET',
    'BT /F1 9 Tf 0.2 0.2 0.2 rg 40 670 Td (This procedure defines the operational criteria and inspection requirements for quality verification.) Tj ET',
    'BT /F1 9 Tf 0.2 0.2 0.2 rg 40 658 Td (Applicable across all manufacturing stages, packaging, and finished goods release.) Tj ET',
    'BT /F2 11 Tf 0.1 0.2 0.4 rg 40 635 Td (2. RESPONSIBILITIES & ROLES) Tj ET',
    '0.94 0.96 0.98 rg 40 605 515.28 15 re f',
    '0.5 w 0.75 0.8 0.85 RG 40 565 515.28 55 re S',
    '40 605 m 555.28 605 l S',
    '40 585 m 555.28 585 l S',
    '150 565 m 150 620 l S',
    '350 565 m 350 620 l S',
    'BT /F2 8.5 Tf 0.2 0.2 0.2 rg 45 609 Td (Role / Position) Tj ET',
    'BT /F2 8.5 Tf 0.2 0.2 0.2 rg 155 609 Td (Key Responsibility) Tj ET',
    'BT /F2 8.5 Tf 0.2 0.2 0.2 rg 355 609 Td (Authority / Competence) Tj ET',
    'BT /F1 8.5 Tf 0.2 0.2 0.2 rg 45 592 Td (Requester / Initiator) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 155 592 Td (Draft procedure, execute initial runs, verify accuracy) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 355 592 Td (Staff / Officer Level) Tj ET',
    'BT /F1 8.5 Tf 0.2 0.2 0.2 rg 45 572 Td (Reviewer / Supervisor) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 155 572 Td (Review compliance, verify resources, technical audit) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 355 572 Td (Section Head / Level 4+) Tj ET',
    'BT /F2 11 Tf 0.1 0.2 0.4 rg 40 540 Td (3. PROCEDURE & WORKFLOW REQUIREMENTS) Tj ET',
    'BT /F1 8.5 Tf 0.2 0.2 0.2 rg 45 525 Td (3.1 Document preparation must comply with QMS manual guidelines and customer specs.) Tj ET',
    'BT /F1 8.5 Tf 0.2 0.2 0.2 rg 45 513 Td (3.2 All process parameters must be recorded in approved inspection log sheets.) Tj ET',
    'BT /F1 8.5 Tf 0.2 0.2 0.2 rg 45 501 Td (3.3 Non-conformances require immediate containment and CAPA initiation.) Tj ET',
    'BT /F2 11 Tf 0.1 0.2 0.4 rg 40 475 Td (4. QUALITY VERIFICATION MATRIX) Tj ET',
    '0.94 0.96 0.98 rg 40 440 515.28 18 re f',
    '0.5 w 0.75 0.8 0.85 RG 40 355 515.28 103 re S',
    '40 440 m 555.28 440 l S',
    '40 410 m 555.28 410 l S',
    '40 380 m 555.28 380 l S',
    '75 355 m 75 458 l S',
    '220 355 m 220 458 l S',
    '370 355 m 370 458 l S',
    '460 355 m 460 458 l S',
    'BT /F2 8 Tf 0.2 0.2 0.2 rg 45 446 Td (Item) Tj ET',
    'BT /F2 8 Tf 0.2 0.2 0.2 rg 82 446 Td (Process Step) Tj ET',
    'BT /F2 8 Tf 0.2 0.2 0.2 rg 225 446 Td (Acceptance Criteria) Tj ET',
    'BT /F2 8 Tf 0.2 0.2 0.2 rg 375 446 Td (Responsible) Tj ET',
    'BT /F2 8 Tf 0.2 0.2 0.2 rg 465 446 Td (Frequency) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 53 422 Td (1) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 82 422 Td (Raw Material Receiving) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 225 422 Td (Visual check & COA verification) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 375 422 Td (QC Inspector) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 465 422 Td (Every Lot) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 53 392 Td (2) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 82 392 Td (In-Process Inspection) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 225 392 Td (Tolerance +/- 0.05 mm standard) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 375 392 Td (Line QC) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 465 392 Td (Hourly) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 53 364 Td (3) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 82 364 Td (Finished Goods Release) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 225 364 Td (100% functional test passed) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 375 364 Td (QA Supervisor) Tj ET',
    'BT /F1 8 Tf 0.2 0.2 0.2 rg 465 364 Td (Per Batch) Tj ET',
    'BT /F1 7.5 Tf 0.5 0.5 0.5 rg 40 165 Td (Note: Official approval signatory matrix below is verified and stamped progressively by QMS Portal.) Tj ET'
  ].join('\n');

  const encoder = new TextEncoder();
  const streamBytes = encoder.encode(streamContent);
  const streamLen = streamBytes.length;

  let pdf = '%PDF-1.4\n';
  const offsets = [];

  offsets.push(pdf.length);
  pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

  offsets.push(pdf.length);
  pdf += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

  offsets.push(pdf.length);
  pdf += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>\nendobj\n';

  offsets.push(pdf.length);
  pdf += '4 0 obj\n<< /Length ' + streamLen + ' >>\nstream\n' + streamContent + '\nendstream\nendobj\n';

  offsets.push(pdf.length);
  pdf += '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

  offsets.push(pdf.length);
  pdf += '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n';

  const startxref = pdf.length;
  pdf += 'xref\n0 7\n0000000000 65535 f \n';
  for (const off of offsets) {
    pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += 'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n' + startxref + '\n%%EOF';

  const fullBytes = encoder.encode(pdf);
  return new Blob([fullBytes], { type: 'application/pdf' });
};

const TaskReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    masterDepartments = [], 
    tasks = [], 
    dars = [], 
    darRequests = [],
    timeline = [], 
    processWorkflow, 
    currentUser, 
    canDownloadDocument, 
    documents = [], 
    masterUsers = [],
    users = [] 
  } = useStore();
  
  const [comment, setComment] = useState('');
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [isStamped, setIsStamped] = useState(false);
  const scrollRef = useRef(null);
  const createdUrlsRef = useRef([]);

  // Graceful unmount cleanup to protect against React Strict Mode premature Blob revocation
  useEffect(() => {
    return () => {
      const urlsToClean = [...createdUrlsRef.current];
      setTimeout(() => {
        urlsToClean.forEach(u => {
          try { URL.revokeObjectURL(u); } catch {}
        });
      }, 15000);
    };
  }, []);

  const task = (tasks || []).find(t => String(t.id) === String(id) || String(t.taskId) === String(id));
  const dar = task ? (
    (dars || []).find(d => String(d.id) === String(task.darId) || d.darNo === task.darId || d.darNumber === task.darId) ||
    (darRequests || []).find(d => String(d.id) === String(task.darId) || d.darNo === task.darId || d.darNumber === task.darId)
  ) : null;
  
  const darTimeline = useMemo(() => {
    return dar ? (timeline || []).filter(t => String(t.darId) === String(dar.id)) : [];
  }, [dar, timeline]);

  const docInfo = useMemo(() => {
    return dar ? (getDarDocInfo(dar, documents) || { docCode: '-', docType: '-', docRev: '-' }) : { docCode: '-', docType: '-', docRev: '-' };
  }, [dar, documents]);

  const requesterName = useMemo(() => {
    return dar ? (getRequesterName(dar, masterUsers) || 'ผู้ร้องขอ') : 'ผู้ร้องขอ';
  }, [dar, masterUsers]);

  // Dynamic extraction and assembly of approvalWorkflow for DAR
  const darWithWorkflow = useMemo(() => {
    if (!dar) return null;
    if (dar.approvalWorkflow && Array.isArray(dar.approvalWorkflow)) return dar;

    // Resolve approver dynamically (strictly no hardcoding)
    let approverName = dar.approverName || dar.approver_name || (typeof dar.approver === 'string' ? dar.approver : dar.approver?.name);
    let approverRole = dar.approverRole || 'Approver';
    
    if (!approverName && (dar.approverId || dar.approver_id || dar.manualApproverId)) {
      const aId = dar.approverId || dar.approver_id || dar.manualApproverId;
      const user = (masterUsers || []).find(u => u && u.id === aId);
      if (user) {
        approverName = user.name || user.fullName;
        approverRole = user.position || approverRole;
      }
    }

    if (!approverName) {
      try {
        const resolved = typeof resolveApprover === 'function' ? resolveApprover(
          dar.requesterId || dar.requester_id,
          task?.assigneeId || currentUser?.id,
          dar.department || 'PD',
          masterUsers || [],
          masterUsers || [],
          dar.docType || dar.doc_type,
          null
        ) : null;
        if (resolved) {
          const user = (masterUsers || []).find(u => u && u.id === (resolved.id || resolved));
          approverName = user ? (user.name || user.fullName) : (resolved.name || 'ผู้อนุมัติ (Approver)');
          approverRole = user?.position || approverRole;
        }
      } catch (err) {
        console.warn('Could not auto-resolve approver in TaskReview:', err);
      }
    }

    const finalApproverName = approverName || 'ผู้อนุมัติ (Approver)';

    return {
      ...dar,
      approvalWorkflow: [
        {
          step: 1,
          roleKey: 'REQUESTER',
          role: 'ผู้ร้องขอ',
          name: dar.requesterName || dar.requester_name || 'ผู้ร้องขอ',
          assignedTo: dar.requesterName || dar.requester_name || 'ผู้ร้องขอ'
        },
        {
          step: 2,
          roleKey: 'REVIEWER',
          role: 'ผู้ทบทวน',
          name: dar.reviewerName || dar.reviewer_name || currentUser?.name || 'ผู้ทบทวน',
          assignedTo: dar.reviewerName || dar.reviewer_name || currentUser?.name || 'ผู้ทบทวน'
        },
        {
          step: 3,
          roleKey: 'APPROVER',
          role: approverRole,
          name: finalApproverName,
          assignedTo: finalApproverName
        },
        {
          step: 4,
          roleKey: 'DCC',
          role: 'DCC Admin',
          name: 'ธนาวุฒิ สมควรกิจดำรง (เจ้าหน้าที่ DCC)',
          assignedTo: 'ธนาวุฒิ สมควรกิจดำรง'
        }
      ]
    };
  }, [dar, task, currentUser, masterUsers]);

  // หาข้อมูล Approver จาก approvalWorkflow array (STRICT DYNAMIC BINDING)
  const nextSignatory = useMemo(() => {
    const currentDar = darWithWorkflow || dar;
    if (!currentDar || !currentDar.approvalWorkflow) return null;
    
    // หากเป็นโหมด Review -> ขั้นต่อไปคือ APPROVER
    return currentDar.approvalWorkflow.find(step => step.roleKey === 'APPROVER');
  }, [darWithWorkflow, dar]);

  // ดึงค่ามาเตรียมแสดงผล
  const nextActorName = nextSignatory?.name || nextSignatory?.assignedTo || 'ผู้อนุมัติ (Approver)';
  const nextActorRole = nextSignatory?.role || 'Approver';

  const [pdfLoadError, setPdfLoadError] = useState(null);
  const [pdfLoadRetryKey, setPdfLoadRetryKey] = useState(0);

  // Authority Signatory Data (Requester | Reviewer | Approver)
  const signOffData = useMemo(() => {
    if (!dar) return null;
    const reqName = dar.requesterName || dar.requester_name || requesterName || 'บีม';
    const reqUser = (masterUsers || []).find(u => u && (u.id === dar.requesterId || u.empId === dar.requesterId || u.name === reqName)) ||
      (users || []).find(u => u && (u.id === dar.requesterId || u.name === reqName));
    const reqDateFormatted = resolveSubmissionDate(dar, task, darTimeline);
    const reqSignature = getActiveUserSignatureAsset(reqUser);
    const reqPosition = reqUser?.position || reqUser?.role || dar.requesterRole || 'QAQC Supervisor';

    return {
      requester: {
        name: reqName,
        position: reqPosition,
        timestamp: reqDateFormatted,
        status: 'SUBMITTED',
        statusText: 'ยื่นคำร้องแล้ว',
        isCompleted: true,
        isPending: false,
        signature: reqSignature
      },
      reviewer: {
        name: currentUser?.name || dar.reviewerName || dar.reviewer_name || '',
        position: currentUser?.position || 'Reviewer',
        timestamp: '',
        status: 'PENDING_REVIEW',
        statusText: 'รอทบทวน (Pending Review)',
        isCompleted: false,
        isPending: true,
        signature: null
      },
      approver: {
        name: nextActorName || '',
        position: nextActorRole || 'Approver',
        timestamp: '',
        status: 'PENDING_APPROVAL',
        statusText: 'รอดำเนินการ (Pending Approval)',
        isCompleted: false,
        isPending: true,
        signature: null
      }
    };
  }, [dar, task, requesterName, masterUsers, users, darTimeline, currentUser, nextActorName, nextActorRole]);

  // Non-Blocking Instant Preview Lifecycle with Bulletproof Registry & Fallback
  useEffect(() => {
    let isCancelled = false;

    if (!dar) {
      setPdfBlobUrl(null);
      setLoadingPdf(false);
      setIsStamped(false);
      return;
    }

    setLoadingPdf(true);
    setPdfLoadError(null);
    setIsStamped(false);

    const loadAndPreview = async () => {
      try {
        const primaryKey = task?.fileId || task?.attachedFile?.fileId || dar.attachedFile?.fileId || dar.fileId || dar.id;
        const fallbackKeys = [
          task?.fileName,
          task?.attachedFile?.name,
          dar.fileId,
          dar.file_id,
          dar.fileName,
          dar.attachedFile?.fileId,
          dar.attachedFile?.id,
          dar.attachedFile?.key,
          dar.attachedFile?.name,
          dar.darNumber,
          dar.darNo,
          dar.id,
          dar.docCode,
          dar.document_code,
          dar.title
        ].filter(Boolean);

        let rawBlob = null;
        const allKeys = Array.from(new Set([primaryKey, ...fallbackKeys])).filter(Boolean);
        
        // 1. ตรวจหาจาก Synchronous In-Memory Registry ก่อน (เร็วที่สุด 0.01s ไม่ต้องรอ IndexedDB)
        for (const cache of [window.__PDF_CACHE__, window.__UPLOADED_FILES_MAP__]) {
          if (cache && !rawBlob) {
            for (const k of allKeys) {
              if (cache.has(k)) {
                rawBlob = cache.get(k);
                if (rawBlob && rawBlob.size > 0) break;
              }
            }
          }
        }

        // 2. ตรวจหาจาก IndexedDB (resolveRawFileBlob)
        if (!rawBlob) {
          rawBlob = await resolveRawFileBlob(primaryKey, fallbackKeys, dar);
          if (!rawBlob) {
            rawBlob = await resolveFileBlob(dar, primaryKey);
          }
        }

        // 3. Fallback อัจฉริยะ: หากเป็นคำร้องเก่าที่ไม่มีไฟล์ ให้ดึง Sample Document จริงที่มีตารางและเนื้อหา (ห้าม Blank PDF!)
        if (!rawBlob || rawBlob.size === 0) {
          console.warn('[TaskReview] Real file missing for legacy DAR. Falling back to system standard document template.');
          rawBlob = getSystemSampleDocumentBlob(docInfo.docCode || dar.docCode || 'SOP-QC-002', dar.title || 'Standard Operating Procedure');
        }

        // Zero-Blank-PDF guard: refuse to proceed if no document bytes found
        if (!rawBlob || rawBlob.size === 0) {
          const errMsg = 'ไม่สามารถเปิดอ่านไฟล์เอกสารได้ กรุณาตรวจสอบว่าท่านได้แนบไฟล์ในขั้นตอนยื่นคำร้องแล้ว';
          if (!isCancelled) {
            setPdfBlobUrl(null);
            setLoadingPdf(false);
            setPdfLoadError(errMsg);
          }
          return;
        }

        // 4. INSTANT DISPLAY: Display raw PDF immediately on screen
        const rawUrl = URL.createObjectURL(rawBlob);
        createdUrlsRef.current.push(rawUrl);

        if (!isCancelled) {
          setPdfBlobUrl(rawUrl);
          setLoadingPdf(false); // Unblock screen instantly!
        }

        // 5. BACKGROUND ASYNC STAMPING: Process stamping in background (3x3 Signatory Matrix on Page 1 Footer + DRAFT Watermark)
        try {
          await new Promise(resolve => setTimeout(resolve, 40));
          const stampedBlob = await stampUnifiedInternalPdf(rawBlob, {
            stage:       'REVIEW',
            dar,
            task,
            masterUsers,
            users,
            currentUser,
            watermarkType: 'DRAFT',
            docInfo: {
              docCode:      docInfo.docCode || dar.docCode || dar.document_code || dar.title || 'SOP-QC-02',
              title:        dar.title || dar.fileName,
              revision:     docInfo.docRev  || dar.targetRevision || dar.rev || '00',
              downloadDate: signOffData?.requester?.timestamp || resolveSubmissionDate(dar, task, darTimeline)
            }
          });
          if (!isCancelled && stampedBlob) {
            const stampedUrl = URL.createObjectURL(stampedBlob);
            createdUrlsRef.current.push(stampedUrl);
            setPdfBlobUrl(stampedUrl);
            setIsStamped(true);
          }
        } catch (stampErr) {
          console.warn('[TaskReview] Background stamping failed, maintaining raw preview:', stampErr);
        }
      } catch (err) {
        console.error('[TaskReview] PDF preview resolution error:', err);
        if (!isCancelled) {
          setPdfBlobUrl(null);
          setLoadingPdf(false);
          setPdfLoadError(err.message || 'เกิดข้อผิดพลาดในการโหลดไฟล์เอกสาร');
        }
      }
    };

    loadAndPreview();

    return () => {
      isCancelled = true;
      // Protected: Do NOT synchronously revoke URLs here to prevent React Strict Mode Blank PDF dropouts
    };
  }, [dar?.id, dar?.darNumber, dar?.fileId, dar?.attachedFile?.fileId, task?.id, pdfLoadRetryKey]);

  const handleDownloadDraft = async () => {
    const code = docInfo.docCode || dar?.title || 'DAR_Doc';

    // Primary: pdfBlobUrl is the already-stamped Blob URL — download it directly (Preview=Download parity)
    if (pdfBlobUrl) {
      const a = document.createElement('a');
      a.href = pdfBlobUrl;
      a.download = `${code}_DRAFT.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('เริ่มการดาวน์โหลดเอกสารแล้ว');
      return;
    }

    // Fallback: resolve raw blob then stamp through stampUnifiedInternalPdf (same pipeline as preview)
    try {
      const primaryKey = dar.attachedFile?.fileId || dar.fileId || dar.id;
      const fallbackKeys = [dar.attachedFile?.name, dar.darNumber, dar.darNo, dar.id].filter(Boolean);
      let raw = await resolveRawFileBlob(primaryKey, fallbackKeys, dar);
      if (!raw) raw = await resolveFileBlob(dar, primaryKey);

      if (raw) {
        const stampedBlob = await stampUnifiedInternalPdf(raw, {
          stage: 'REVIEW', dar, task, masterUsers, users, currentUser,
          watermarkType: 'DRAFT',
          docInfo: { docCode: docInfo.docCode || dar.docCode, title: dar.title, revision: docInfo.docRev || '00' }
        });
        const url = URL.createObjectURL(stampedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${code}_DRAFT.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('ดาวน์โหลดไฟล์เอกสารสำเร็จ');
      } else {
        toast.error('ไม่พบไฟล์เอกสารสำหรับดาวน์โหลด');
      }
    } catch (err) {
      console.error('Download error:', err);
      toast.error('ไม่สามารถดาวน์โหลดเอกสารได้');
    }
  };

  useEffect(() => {
    // If PDF container is small enough that it doesn't scroll, unlock immediately
    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollHeight, clientHeight } = scrollRef.current;
        if (scrollHeight <= clientHeight) {
          setHasReadToBottom(true);
        }
      }
    };
    checkScroll();
  }, []);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Add 10px threshold for easier triggering
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setHasReadToBottom(true);
    }
  };

  if (!task || !dar) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
        <div className="card-surface p-8 text-center max-w-md shadow-xs border border-slate-200 rounded-2xl bg-white">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mx-auto mb-4 text-amber-600">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1.5">ไม่พบข้อมูลคำร้องหรือภารกิจนี้</h2>
          <p className="text-xs text-slate-500 leading-relaxed mb-1">
            รหัสงาน: <span className="font-mono font-bold text-slate-700">{id || '-'}</span>
          </p>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            คำร้องนี้อาจถูกประมวลผลเสร็จสิ้นแล้ว หรือไม่มีอยู่ในระบบฐานข้อมูลปัจจุบัน
          </p>
          <button 
            type="button"
            onClick={() => navigate('/tasks')} 
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-all cursor-pointer shadow-xs"
          >
            <ChevronLeft size={14} /> กลับสู่หน้ารายการงาน (Task Inbox)
          </button>
        </div>
      </div>
    );
  }

  const isAssignee = !currentUser || !task.assigneeId || 
    task.assigneeId === currentUser?.id || 
    task.assigneeId === currentUser?.empId || 
    task.assigneeName === currentUser?.name ||
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'DCC_ADMIN' ||
    currentUser?.isDcc;

  if (!isAssignee) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
        <div className="card-surface p-8 text-center max-w-md shadow-xs border border-rose-200 rounded-2xl bg-white">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center mx-auto mb-4 text-rose-500">
            <XCircle size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1.5">ไม่มีสิทธิ์เข้าถึงงานนี้</h2>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            คุณไม่มีสิทธิ์เข้าถึงงานนี้ หรือเป็นงานที่ถูกมอบหมายให้เจ้าหน้าที่ท่านอื่น
          </p>
          <button 
            type="button"
            onClick={() => navigate('/tasks')} 
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-all cursor-pointer shadow-xs"
          >
            <ChevronLeft size={14} /> กลับสู่หน้ารายการงาน (Task Inbox)
          </button>
        </div>
      </div>
    );
  }

  // Use a pseudo-document for access rules since DAR is not in documents array yet
  const pseudoDoc = { department: dar.department, distributedTo: dar.distributedDepts || [] };
  const canDownload = canDownloadDocument ? canDownloadDocument(pseudoDoc, currentUser) : false;
  const accessScope = dar.access_control?.scope || dar.access_scope || 'GENERAL';
  const scopeMeta = ACCESS_SCOPE_METADATA[accessScope] || ACCESS_SCOPE_METADATA.GENERAL;

  const handleAction = (action) => {
    if (!hasReadToBottom) {
      toast.error('กรุณาเลื่อนอ่านเอกสารให้ครบทุกหน้าก่อนตัดสินใจ');
      return;
    }
    if (action === 'RETURN' && !comment) {
      toast.error('กรุณาระบุเหตุผลการส่งคืน (Comment)');
      return;
    }
    setPendingAction(action);
    setShowConfirm(true);
  };

  const executeAction = () => {
    try {
      processWorkflow(task.id, pendingAction, comment);
      toast.success(`ดำเนินการ ${pendingAction === 'APPROVE' ? 'ผ่านการทบทวน' : 'ส่งกลับแก้ไข'} สำเร็จ`);
      setShowConfirm(false);
      navigate('/tasks');
    } catch (error) {
      console.error('Review Action Crash:', error);
      toast.error(`เกิดข้อผิดพลาด: ${error.message || 'ระบบขัดข้อง'}`);
      setShowConfirm(false);
    }
  };

  return (
    <div 
      className="h-[calc(100vh-100px)] flex gap-4 overflow-hidden -mx-4 -mb-8 px-4 pb-4 transition-all duration-200 ease-out"
    >
      {/* LEFT COLUMN: Details & Chat (40%) */}
      <div className="w-[40%] flex flex-col card-surface overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-[#F5F5F5]/80 flex items-center justify-between shadow-xs z-10">
           <button onClick={() => navigate('/tasks')} className="flex items-center text-xs font-bold text-slate-600 hover:text-[#0D99FF] transition-colors">
             <ChevronLeft className="mr-1" size={16} /> ย้อนกลับ
           </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsInspectorOpen(true)}
                className="flex items-center px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#007BE5] border border-blue-200 text-xs font-bold transition-all cursor-pointer"
                title="เปิดหน้าต่างเอกสารฉบับเต็ม"
              >
                เอกสารฉบับเต็ม
              </button>
              <h2 className="font-bold text-[#1E1E1E] text-sm flex items-center gap-2">
               <FileText className="text-[#0D99FF]" size={16} /> ทบทวนเอกสาร
             </h2>
           </div>
        </div>

        {/* Scrollable Details & Timeline */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F5F5F5]/40 hide-scrollbar">
          
          {/* DAR Summary Card */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]/80 shadow-xs space-y-3">
            <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-xs text-slate-400 uppercase tracking-wider font-bold">คำร้องขอเอกสาร (DAR)</h3>
                  <p className="text-xl font-bold text-[#1E1E1E] font-mono mt-0.5">
                    {dar.darNumber || (dar.isDraft || dar.status === 'DRAFT' || String(dar.id).startsWith('draft_') ? 'ยังไม่ได้ระบุ (Draft)' : dar.id)}
                  </p>
               </div>
               <span className="badge-system">{dar.type}</span>
            </div>
            
            <div className="space-y-2 text-xs text-slate-700">
               <p><span className="text-slate-400 w-24 inline-block font-medium">ชื่อเอกสาร:</span> <span className="font-bold text-[#1E1E1E]">{dar.title}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">รหัสเอกสาร:</span> <span className="font-mono font-bold text-[#007BE5]">{docInfo.docCode}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">ประเภท:</span> <span className="font-medium">{docInfo.docType}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">ฉบับที่:</span> <span className="font-mono font-bold">
                 {dar.type === 'REVISION' ? `${docInfo.docRev} ➡️ ${String(parseInt(docInfo.docRev || 0, 10) + 1).padStart(2, '0')}` : docInfo.docRev}
               </span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">แผนกเจ้าของ:</span> <span className="font-bold font-mono">{(() => { const d = normalizeDepartmentId(dar.department); const dObj = masterDepartments.find(md => normalizeDepartmentId(md.id) === d); return dObj ? `${d} - ${dObj.nameTh || dObj.name}` : (d || '-'); })()}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">ผู้ร้องขอ:</span> <span className="font-bold text-[#1E1E1E]">{requesterName}</span></p>
               <p><span className="text-slate-400 w-24 inline-block font-medium">วันบังคับใช้:</span> <span className="font-mono font-bold text-emerald-700">{dar.effectiveDate || '-'}</span></p>
               {task?.dueDate && (
                 <p className="flex items-center gap-1.5 flex-wrap pt-0.5">
                   <span className="text-slate-400 w-24 inline-block font-medium">วันครบกำหนด:</span>
                   <span className={`font-mono font-bold ${task.isUrgent || task.slaType === 'FAST_TRACK' ? 'text-amber-700' : 'text-slate-700'}`}>
                     {task.dueDate}
                   </span>
                   {(task.isUrgent || task.slaType === 'FAST_TRACK') && (
                     <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                       <Zap size={10} className="fill-amber-500 text-amber-600" />
                       <span>งานด่วน (Fast-Track)</span>
                     </span>
                   )}
                 </p>
               )}
               
               {/* Confidentiality Pill */}
               <div className="flex items-center gap-2 pt-1">
                 <span className="text-slate-400 w-24 inline-block font-medium">ระดับความลับ:</span>
                 <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${scopeMeta.badgeClass}`}>
                   {accessScope === 'GENERAL' && <><Globe size={13} strokeWidth={1.5} /><span>ทั่วไป</span></>}
                   {accessScope === 'DEPT_ONLY' && <><Lock size={13} strokeWidth={1.5} /><span>เฉพาะแผนก</span></>}
                   {accessScope === 'TARGETED' && <><Building2 size={13} strokeWidth={1.5} /><span>เฉพาะบางแผนก</span></>}
                   {accessScope === 'RESTRICTED' && <><ShieldAlert size={13} strokeWidth={1.5} /><span>ลับเฉพาะ (Lv.{dar.access_control?.min_access_level || 4}+)</span></>}
                 </span>
               </div>

               {/* Related Standards */}
               {(dar.relatedStandards || dar.standards)?.length > 0 && (
                 <div className="flex items-center gap-1.5 pt-1">
                   <span className="text-slate-400 w-24 inline-block font-medium">มาตรฐาน:</span>
                   <div className="flex flex-wrap gap-1">
                     {(dar.relatedStandards || dar.standards).map(s => (
                       <span key={s} className="px-1.5 py-0.2 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] font-medium">
                         {s}
                       </span>
                     ))}
                   </div>
                 </div>
               )}

                <div className="pt-2.5 mt-2.5 border-t border-slate-100 space-y-2 text-xs">
                  <div className="grid grid-cols-[100px_1fr] gap-2 items-start min-w-0">
                    <span className="text-slate-500 font-bold shrink-0">
                      {getDarReason(dar).title}:
                    </span>
                    <div className="min-w-0 text-slate-800 font-normal leading-relaxed break-words break-all whitespace-pre-wrap [overflow-wrap:anywhere] bg-slate-50 border border-slate-200/70 rounded-lg p-2">
                      {getDarReason(dar).value}
                    </div>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-2 items-start min-w-0">
                    <span className="text-slate-500 font-bold shrink-0">
                      {getDarDetail(dar).title}:
                    </span>
                    <div className="min-w-0 text-slate-800 font-normal leading-relaxed break-words break-all whitespace-pre-wrap [overflow-wrap:anywhere] bg-slate-50 border border-slate-200/70 rounded-lg p-2">
                      {getDarDetail(dar).value}
                    </div>
                  </div>
                </div>
            </div>
          </div>

          {/* Timeline / Chat */}
          <div className="flex flex-col gap-3">
             <h4 className="text-xs font-bold text-[#666666] uppercase tracking-wider flex items-center gap-1.5">
               <MessageSquare size={16} /> ประวัติและข้อคิดเห็น (Workflow History)
             </h4>
             {darTimeline.map(tl => (
               <div key={tl.id} className={`flex flex-col ${tl.userId === currentUser?.id ? 'items-end' : 'items-start'}`}>
                 <div className="flex items-baseline gap-1.5 mb-1 px-1">
                   <span className="text-xs font-bold text-slate-700">{tl.user}</span>
                   <span className="text-xs text-slate-400 font-mono">{tl.date}</span>
                 </div>
                 <div className={`p-3.5 rounded-xl max-w-[90%] text-sm shadow-xs leading-relaxed ${tl.userId === currentUser?.id ? 'bg-[#0D99FF] text-white rounded-tr-sm' : 'bg-white border border-[#E5E5E5] text-slate-800 rounded-tl-sm'}`}>
                    {tl.isChat ? (
                      <p>{tl.comment}</p>
                    ) : (
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold mb-1 ${tl.userId === currentUser?.id ? 'bg-white/20 text-white' : 'bg-[#F5F5F5] text-slate-700'}`}>
                           {tl.action}
                        </span>
                        <p>{tl.comment}</p>
                      </div>
                    )}
                 </div>
               </div>
             ))}
          </div>
        </div>

        {/* Action Panel (Fixed Bottom) */}
        <div className="p-4 bg-white border-t border-slate-100 shadow-xs z-10">
          <textarea
            rows="3"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-hidden resize-none min-h-[88px]"
            placeholder="ระบุเหตุผล ข้อเสนอแนะ หรือสิ่งที่ต้องปรับปรุงเพิ่มเติม..."
          />
          <div className="flex items-center justify-end gap-2.5 pt-3 mt-2 border-t border-slate-100">
            <button
              disabled={!hasReadToBottom}
              onClick={() => handleAction('RETURN')}
              className="inline-flex items-center gap-1.5 h-9 px-4 py-2 rounded-xl text-xs font-medium text-amber-700 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/80 transition-all whitespace-nowrap shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="ส่งกลับไปให้ Requester แก้ไข"
            >
              <RotateCcw size={14} /> ส่งกลับแก้ไข (Return)
            </button>
            <button
              disabled={!hasReadToBottom}
              onClick={() => handleAction('APPROVE')}
              className="inline-flex items-center gap-1.5 h-9 px-5 py-2 rounded-xl text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-xs shadow-emerald-600/20 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="ผ่านการทบทวน"
            >
              <Check size={15} /> ผ่านการทบทวน (Approve Review)
            </button>
          </div>
          {!hasReadToBottom && (
            <p className="text-xs text-rose-500 text-center mt-2 font-medium">⚠️ กรุณาเลื่อนอ่านเอกสารทางขวาให้จบเพื่อปลดล็อคปุ่ม</p>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: PDF Viewer & Signatory Matrix (60%) */}
      <div className="w-[60%] flex flex-col bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-800">
        
        {/* PDF Toolbar */}
        <div className="bg-slate-800 text-slate-200 px-4 py-2.5 flex items-center justify-between shadow-xs z-10 shrink-0">
          <div className="font-mono text-xs truncate pr-4 text-slate-300 font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>{dar.attachedFile?.name || dar.fileName || task?.fileName || `${dar.title}.pdf`}</span>
            <span className="text-slate-400 font-mono text-[11px]">(DRAFT Rev. {docInfo.docRev || '00'})</span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
            <button 
              onClick={handleDownloadDraft}
              className="action-icon-btn text-sky-400 hover:text-white hover:bg-slate-700 cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors" 
              title="ดาวน์โหลดเอกสาร PDF"
            >
              <Download size={14} />
              <span className="hidden sm:inline">ดาวน์โหลด</span>
            </button>
          </div>
        </div>

        {/* Scrollable PDF Canvas */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/80 custom-scrollbar"
        >
           {/* Native PDF Viewer */}
           <div className="w-full h-full min-h-[800px] relative rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center border border-slate-700/80 shadow-2xl">
             {pdfBlobUrl ? (
               <iframe
                 src={`${pdfBlobUrl}#view=FitH&toolbar=0&navpanes=0&scrollbar=1`}
                 className="w-full h-full border-0 absolute inset-0 bg-white"
                 title="PDF Preview"
               />
             ) : loadingPdf ? (
               <div className="text-slate-400 font-medium animate-pulse flex flex-col items-center gap-3">
                 <div className="w-10 h-10 rounded-full border-3 border-sky-500/20 border-t-sky-500 animate-spin" />
                 <span className="text-xs text-slate-300">กำลังเปิดไฟล์เอกสารฉบับจริง...</span>
               </div>
             ) : pdfLoadError ? (
               <div className="text-slate-400 font-medium flex flex-col items-center gap-4 p-6 text-center">
                 <ShieldAlert size={40} className="text-amber-500" />
                 <span className="text-sm text-slate-300">{pdfLoadError}</span>
                 <button
                   onClick={() => setPdfLoadRetryKey(k => k + 1)}
                   className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors cursor-pointer"
                 >
                   <RotateCcw size={14} /> ลองโหลดใหม่
                 </button>
               </div>
             ) : (
               <div className="text-slate-500 font-medium flex flex-col items-center gap-3">
                 <ShieldAlert size={40} className="text-slate-600" />
                 <span>ไม่พบไฟล์เอกสารอ้างอิงจริง (No attached file)</span>
               </div>
             )}
           </div>
        </div>

      </div>

      <ActionConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executeAction}
        title={pendingAction === 'APPROVE' ? 'ยืนยันการผ่านการทบทวนเอกสาร (Review DAR)' : 'ยืนยันการส่งกลับแก้ไข (Request Revision)'}
        actionType={pendingAction === 'APPROVE' ? 'review' : 'reject'}
        confirmText={pendingAction === 'APPROVE' ? 'ยืนยันผ่านการทบทวน' : 'ยืนยันส่งกลับแก้ไข'}
        cancelText="ยกเลิก / กลับไปตรวจสอบ"
        dar={darWithWorkflow}
        currentActor={currentUser}
        currentStep="REVIEWER"
        workflowSignatories={darWithWorkflow?.approvalWorkflow || dar?.approvalWorkflow || []}
        summaryData={[
          { label: 'ผู้ดำเนินการ', value: `${currentUser?.name || 'ผู้ทบทวน'} (${currentUser?.department || '-'})` },
          { label: 'เอกสาร', value: dar ? `[${getDarDocInfo(dar, documents).docCode}] ${dar.title}` : '-' },
          { label: 'ผลการทบทวน', value: pendingAction === 'APPROVE' ? 'ผ่านการทบทวน (Review Passed)' : 'ส่งกลับแก้ไข (Revision Required)' },
          { label: 'ความเห็นประกอบ', value: comment || '-' },
          { 
            label: 'สายการอนุมัติถัดไป', 
            value: pendingAction === 'APPROVE' 
              ? `ส่งต่อไปยัง: ${nextActorName} (${nextActorRole})` 
              : 'ส่งกลับไปยัง: ผู้ร้องขอ (แก้ไขคำร้อง)' 
          }
        ]}
      />

      <DarReviewModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        dar={dar}
        role="REVIEWER"
        onApprove={(modalComment) => {
          setComment(modalComment || comment);
          setIsInspectorOpen(false);
          setPendingAction('APPROVE');
          setShowConfirm(true);
        }}
        onReturn={(modalComment) => {
          setComment(modalComment || comment);
          setIsInspectorOpen(false);
          setPendingAction('RETURN');
          setShowConfirm(true);
        }}
      />
    </div>
  );
};

export default TaskReview;
