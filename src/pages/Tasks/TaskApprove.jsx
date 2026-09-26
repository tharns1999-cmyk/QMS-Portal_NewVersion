import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useStore from '../../store/useStore';
import { normalizeDepartmentId } from '../../services/MasterDataService';
import { FileText, XCircle, ChevronLeft, Download, MessageSquare, ShieldAlert, Zap, Globe, Lock, Building2, X, RotateCcw, Check, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { getDarReason, getDarDetail, getDarDocInfo, getRequesterName } from '../../utils/darHelper';
import ActionConfirmModal from '../../components/common/ActionConfirmModal';
import DarReviewModal from '../../components/workflow/DarReviewModal';
import { ACCESS_SCOPE_METADATA } from '../../utils/accessControl';
import { 
  stampDarPreviewPdf,
  stampUnifiedInternalPdf,
  formatSignOffDate, 
  resolveRawFileBlob, 
  getActiveUserSignatureAsset, 
  resolveSubmissionDate,
  getSystemSampleDocumentBlob
} from '../../utils/pdfStamper';
import { resolveFileBlob } from '../../utils/fileStorage';
import { generateQmsDownloadName, triggerBrowserDownload, formatDarHeaderTitle } from '../../utils/documentNamingHelper';

const TaskApprove = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    masterDepartments = [], 
    tasks = [], 
    completedTasks = [], 
    dars = [], 
    documents = [], 
    timeline = [], 
    processWorkflow, 
    finalizeAndPublishMaster,
    currentUser, 
    canDownloadDocument, 
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

  const allTasks = useMemo(() => {
    return [...(tasks || []), ...(completedTasks || [])];
  }, [tasks, completedTasks]);

  const task = allTasks.find(t => String(t.id) === String(id) || String(t.taskId) === String(id));
  const dar = task 
    ? (dars || []).find(d => String(d.id) === String(task.darId) || d.darNo === task.darId || d.darNumber === task.darId) 
    : (dars || []).find(d => String(d.id) === String(id) || d.darNo === id || d.darNumber === id);
    
  const darTimeline = useMemo(() => {
    return dar ? (timeline || []).filter(t => String(t.darId) === String(dar.id)) : [];
  }, [dar, timeline]);

  const docInfo = useMemo(() => {
    return dar ? (getDarDocInfo(dar, documents) || { docCode: '-', docType: '-', docRev: '-' }) : { docCode: '-', docType: '-', docRev: '-' };
  }, [dar, documents]);

  const targetDocCode = dar?.docCode || dar?.doc_code || dar?.docNo || docInfo?.docCode || 'No Code';
  const targetDocTitle = dar?.title || dar?.docName || dar?.documentName || dar?.docTitle || dar?.name || 'ไม่ระบุชื่อเอกสาร';
  const targetRev = dar?.targetRevision || dar?.newRevision || dar?.revision || docInfo?.docRev || '00';
  const headerDisplayTitle = formatDarHeaderTitle(dar, targetDocCode, targetDocTitle);

  const requesterName = useMemo(() => {
    return dar ? (getRequesterName(dar, masterUsers) || 'ผู้ร้องขอ') : 'ผู้ร้องขอ';
  }, [dar, masterUsers]);

  const [pdfLoadError, setPdfLoadError] = useState(null);
  const [pdfLoadRetryKey, setPdfLoadRetryKey] = useState(0);

  // Authority Signatory Data (Requester | Reviewer | Approver)
  const signOffData = useMemo(() => {
    if (!dar) return null;
    // 1. Requester Data Authority (ผู้จัดทำ)
    const reqName = dar.requesterName || dar.requester_name || requesterName || '';
    const reqUser = (masterUsers || []).find(u => u && (u.id === dar.requesterId || u.empId === dar.requesterId || u.name === reqName)) ||
      (users || []).find(u => u && (u.id === dar.requesterId || u.name === reqName));
    const reqDateFormatted = resolveSubmissionDate(dar, task, darTimeline);
    const reqSignature = getActiveUserSignatureAsset(reqUser);
    const reqPosition = reqUser?.position || reqUser?.role || dar.requesterRole || '';

    // 2. Reviewer Data Authority (Review completed in TaskApprove stage)
    const reviewTl = (darTimeline || []).find(t => t.action === 'REVIEW' || t.action === 'APPROVE_REVIEW' || t.action === 'REVIEWED');
    const rawRevDate = reviewTl?.date || reviewTl?.timestamp || dar.reviewedAt || dar.reviewDate;
    const revDateFormatted = rawRevDate ? formatSignOffDate(rawRevDate) : '';
    const revName = dar.reviewerName || dar.reviewer_name || reviewTl?.user || dar.reviewedBy || '';
    const revUser = (masterUsers || []).find(u => u && (u.id === dar.reviewerId || u.empId === dar.reviewerId || u.name === revName)) ||
      (users || []).find(u => u && (u.id === dar.reviewerId || u.name === revName));
    const revPosition = revUser?.position || revUser?.role || dar.reviewerRole || 'Reviewer';
    const revSignature = getActiveUserSignatureAsset(revUser);

    // 3. Approver Data Authority (Pending Approval)
    const appName = currentUser?.name || dar.approverName || 'ผู้อนุมัติ';
    const appPosition = currentUser?.position || dar.approverRole || 'Approver';

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
        name: revName,
        position: revPosition,
        timestamp: (revDateFormatted && revDateFormatted !== '-') ? revDateFormatted : '',
        status: 'REVIEWED',
        statusText: 'ผ่านการทบทวน (Reviewed)',
        isCompleted: true,
        isPending: false,
        signature: revSignature
      },
      approver: {
        name: appName,
        position: appPosition,
        timestamp: '',
        status: 'PENDING_APPROVAL',
        statusText: 'รออนุมัติ (Pending Approval)',
        isCompleted: false,
        isPending: true,
        signature: null
      }
    };
  }, [dar, task, darTimeline, masterUsers, users, currentUser, requesterName]);

  // Non-Blocking Instant Preview Lifecycle with Bulletproof Registry & Fallback
  useEffect(() => {
    let isCancelled = false;

    if (!dar) {
      setPdfBlobUrl(null);
      setLoadingPdf(false);
      return;
    }

    setLoadingPdf(true);
    setPdfLoadError(null);

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

        // 1. ตรวจหาจาก Synchronous In-Memory Registry ก่อน
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

        // 2. Direct and instant raw file resolution from IndexedDB
        if (!rawBlob) {
          rawBlob = await resolveRawFileBlob(primaryKey, fallbackKeys, dar);
          if (!rawBlob) {
            rawBlob = await resolveFileBlob(dar, primaryKey);
          }
        }

        // 3. Fallback อัจฉริยะ: หากเป็นคำร้องเก่าที่ไม่มีไฟล์ ให้ดึง Sample Document จริงที่มีตารางและเนื้อหา (ห้าม Blank PDF!)
        if (!rawBlob || rawBlob.size === 0) {
          console.warn('[TaskApprove] Real file missing for legacy DAR. Falling back to system standard document template.');
          rawBlob = getSystemSampleDocumentBlob(docInfo.docCode || dar.docCode || 'SOP-QC-002', dar.title || 'Standard Operating Procedure');
        }

        if (!rawBlob || rawBlob.size === 0) {
          if (!isCancelled) {
            setPdfBlobUrl(null);
            setLoadingPdf(false);
            setPdfLoadError('ไม่สามารถเปิดอ่านไฟล์เอกสารได้');
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

        // 5. BACKGROUND ASYNC STAMPING: Process stamping in background
        const draftMetadata = {
          darNo: dar.darNumber || dar.darNo || dar.id,
          docCode: docInfo.docCode || dar.docCode || dar.title,
          docTitle: dar.title,
          timestamp: signOffData?.requester?.timestamp || resolveSubmissionDate(dar, task, darTimeline)
        };

        try {
          // Allow React to render the instant preview first
          await new Promise(resolve => setTimeout(resolve, 40));
          // stampUnifiedInternalPdf: Progressive matrix (ผู้จัดทำ + ผู้ทบทวน filled, ผู้อนุมัติ blank)
          const stampedBlob = await stampUnifiedInternalPdf(rawBlob, {
            stage:       'APPROVE',
            dar,
            task,
            masterUsers,
            users,
            currentUser,
            watermarkType: 'DRAFT',
            docInfo: {
              docCode:      docInfo.docCode || dar.docCode || dar.title,
              title:        dar.title,
              revision:     docInfo.docRev  || dar.rev || '00',
              downloadDate: signOffData?.requester?.timestamp || resolveSubmissionDate(dar, task, darTimeline)
            }
          });
          if (!isCancelled && stampedBlob) {
            const stampedUrl = URL.createObjectURL(stampedBlob);
            createdUrlsRef.current.push(stampedUrl);
            setPdfBlobUrl(stampedUrl);
          }
        } catch (stampErr) {
          console.warn('[TaskApprove] Background stamping failed, maintaining raw preview:', stampErr);
        }
      } catch (err) {
        console.error('[TaskApprove] PDF preview resolution error:', err);
        if (!isCancelled) {
          setPdfBlobUrl(null);
          setLoadingPdf(false);
          setPdfLoadError('เกิดข้อผิดพลาดในการโหลดไฟล์เอกสาร');
        }
      }
    };

    loadAndPreview();

    return () => {
      isCancelled = true;
      // Protected: Do NOT synchronously revoke URLs here
    };
  }, [dar?.id, dar?.darNumber, dar?.fileId, dar?.attachedFile?.fileId, task?.id, pdfLoadRetryKey]);

  const handleDownloadDraft = async () => {
    const fileName = generateQmsDownloadName({
      docCode: targetDocCode,
      title: targetDocTitle,
      revision: targetRev,
      systemStatus: 'DRAFT'
    });

    // Primary: pdfBlobUrl is the already-stamped Blob URL — download it directly (Preview=Download parity)
    if (pdfBlobUrl) {
      triggerBrowserDownload(pdfBlobUrl, fileName);
      toast.success('เริ่มการดาวน์โหลดเอกสารแล้ว');
      return;
    }

    // Fallback: resolve raw blob then stamp through stampUnifiedInternalPdf (same pipeline as preview)
    try {
      const primaryKey = dar?.attachedFile?.fileId || dar?.fileId || dar?.id;
      const fallbackKeys = [dar?.attachedFile?.name, dar?.darNumber, dar?.darNo, dar?.id].filter(Boolean);
      let raw = await resolveRawFileBlob(primaryKey, fallbackKeys, dar);
      if (!raw) raw = await resolveFileBlob(dar, primaryKey);

      if (raw) {
        const stampedBlob = await stampUnifiedInternalPdf(raw, {
          stage: 'APPROVE', dar, task, masterUsers, users, currentUser,
          watermarkType: 'DRAFT',
          docInfo: { docCode: targetDocCode, title: targetDocTitle, revision: targetRev }
        });
        triggerBrowserDownload(stampedBlob, fileName);
        toast.success('ดาวน์โหลดไฟล์เอกสารสำเร็จ');
      } else {
        toast.error('ไม่พบไฟล์เอกสารสำหรับดาวน์โหลด');
      }
    } catch (err) {
      console.error('Download error:', err);
      toast.error('ไม่สามารถดาวน์โหลดเอกสารได้');
    }
  };

  // Dynamic extraction and assembly of approvalWorkflow for DAR
  const darWithWorkflow = useMemo(() => {
    if (!dar) return null;
    if (dar.approvalWorkflow && Array.isArray(dar.approvalWorkflow)) return dar;

    const dccUser = (masterUsers || []).find(u => u && (u.isDcc || u.role === 'DCC_ADMIN'));
    const dccName = dccUser ? (dccUser.fullName || dccUser.name) : 'เจ้าหน้าที่ DCC';

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
          name: dar.reviewerName || dar.reviewer_name || 'ผู้ทบทวน',
          assignedTo: dar.reviewerName || dar.reviewer_name || 'ผู้ทบทวน'
        },
        {
          step: 3,
          roleKey: 'APPROVER',
          role: dar.approverRole || 'Approver',
          name: dar.approverName || currentUser?.name || 'ผู้อนุมัติ',
          assignedTo: dar.approverName || currentUser?.name || 'ผู้อนุมัติ'
        },
        {
          step: 4,
          roleKey: 'DCC',
          role: 'เจ้าหน้าที่ DCC (ตรวจสอบและประกาศใช้)',
          name: dccName,
          assignedTo: dccName
        }
      ]
    };
  }, [dar, currentUser, masterUsers]);

  // Harmonized workflow signatories list
  const workflowSignatories = useMemo(() => {
    const list = darWithWorkflow?.approvalWorkflow || dar?.approvalWorkflow;
    return (list && Array.isArray(list)) ? list : [];
  }, [darWithWorkflow, dar]);

  // Find index of current step / Approver
  const approverStepIndex = useMemo(() => {
    return workflowSignatories.findIndex(s => 
      s.roleKey === 'APPROVER' || 
      (currentUser && (s.id === currentUser.id || s.name === currentUser.name || s.assignedTo === currentUser.name))
    );
  }, [workflowSignatories, currentUser]);

  const subsequentSteps = useMemo(() => {
    return approverStepIndex >= 0 
      ? workflowSignatories.slice(approverStepIndex + 1)
      : workflowSignatories.filter(s => s.roleKey !== 'REQUESTER' && s.roleKey !== 'REVIEWER' && s.roleKey !== 'APPROVER');
  }, [workflowSignatories, approverStepIndex]);

  // Check if DCC step is configured
  const dccStep = useMemo(() => {
    return subsequentSteps.find(s => 
      s.roleKey === 'DCC' || 
      s.roleKey === 'DCC_ADMIN' || 
      s.role === 'DCC' || 
      (typeof s.role === 'string' && s.role.toUpperCase().includes('DCC'))
    );
  }, [subsequentSteps]);

  const isObsolete = Boolean(
    dar?.type === 'OBSOLETE' || 
    dar?.darType === 'OBSOLETE' || 
    dar?.type === 'CANCEL' ||
    dar?.requestType === 'OBSOLETE'
  );

  const approvalNextStep = useMemo(() => {
    return isObsolete ? {
      title: 'ส่งมอบงานต่อให้ Document Control Center (DCC)',
      description: 'เพื่อดำเนินการปลดระวาง เรียกคืนสำเนาควบคุมทั้งหมดในระบบ และบันทึกผลการทำลายตามระเบียบ (Recall & Disposition)',
      boxClass: 'bg-rose-50/60 border-rose-200/80 text-rose-900',
      iconBg: 'bg-rose-600 text-white',
      buttonText: 'ยืนยันการอนุมัติยกเลิกเอกสาร',
      buttonClass: 'bg-rose-600 hover:bg-rose-700 text-white'
    } : {
      title: 'ส่งมอบงานต่อให้ Document Control Center (DCC)',
      description: 'เพื่อดำเนินการขึ้นทะเบียน ประทับตรา และแจกจ่ายสำเนาควบคุมตามระเบียบ',
      boxClass: 'bg-blue-50/60 border-blue-200/80 text-blue-900',
      iconBg: 'bg-blue-600 text-white',
      buttonText: 'ยืนยันการอนุมัติเอกสาร',
      buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white'
    };
  }, [isObsolete]);

  const isFinalStep = subsequentSteps.length === 0 || (!dccStep && subsequentSteps.every(s => s.roleKey === 'COMPLETED' || !s.roleKey));

  // Determine next destination details preventing self-targeting
  const nextDestination = useMemo(() => {
    if (pendingAction !== 'APPROVE') return null;

    if (dccStep) {
      return {
        type: 'DCC',
        label: approvalNextStep.title,
        title: approvalNextStep.title,
        subtitle: approvalNextStep.description,
        name: dccStep.name || dccStep.assignedTo || 'Document Control Center (DCC)',
        role: isObsolete ? 'เรียกคืนสำเนาและทำลาย' : (dccStep.role || 'DCC')
      };
    }

    if (isFinalStep) {
      return {
        type: 'COMPLETED',
        label: isObsolete ? 'สิ้นสุดขั้นตอนการขอยกเลิก (Obsolete Completed)' : 'สิ้นสุดขั้นตอนการอนุมัติ (Approval Completed)',
        title: isObsolete ? 'สิ้นสุดขั้นตอนการขอยกเลิก (Obsolete Completed)' : 'สิ้นสุดขั้นตอนการอนุมัติ (Approval Completed)',
        subtitle: isObsolete ? 'เอกสารจะถูกปรับสถานะเป็น "ยกเลิก (Obsolete)" ทันที' : 'เอกสารจะถูกปรับสถานะเป็น "มีผลบังคับใช้ (Active)" ทันที',
        name: isObsolete ? 'Obsolete Completed' : 'Approval Completed',
        role: isObsolete ? 'ยกเลิก (Obsolete)' : 'มีผลบังคับใช้ (Active)'
      };
    }

    // Safety check: ensure next signatory is NOT the current actor
    const nextValid = subsequentSteps.find(s => 
      (!currentUser?.id || s.id !== currentUser.id) &&
      (!currentUser?.name || (s.name !== currentUser.name && s.assignedTo !== currentUser.name))
    );

    if (nextValid) {
      return {
        type: 'SIGNATORY',
        label: `ส่งต่อไปยัง: ${nextValid.name} (${nextValid.role})`,
        title: 'ส่งต่อเพื่อพิจารณาขั้นถัดไป',
        name: nextValid.name || nextValid.assignedTo,
        role: nextValid.role
      };
    }

    return {
      type: 'COMPLETED',
      label: isObsolete ? 'สิ้นสุดขั้นตอนการขอยกเลิก (Obsolete Completed)' : 'สิ้นสุดขั้นตอนการอนุมัติ (Approval Completed)',
      title: isObsolete ? 'สิ้นสุดขั้นตอนการขอยกเลิก (Obsolete Completed)' : 'สิ้นสุดขั้นตอนการอนุมัติ (Approval Completed)',
      subtitle: isObsolete ? 'เอกสารจะถูกปรับสถานะเป็น "ยกเลิก (Obsolete)" ทันที' : 'เอกสารจะถูกปรับสถานะเป็น "มีผลบังคับใช้ (Active)" ทันที',
      name: isObsolete ? 'Obsolete Completed' : 'Approval Completed',
      role: isObsolete ? 'ยกเลิก (Obsolete)' : 'มีผลบังคับใช้ (Active)'
    };
  }, [pendingAction, dccStep, isFinalStep, subsequentSteps, currentUser, approvalNextStep, isObsolete]);

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
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setHasReadToBottom(true);
    }
  };

  const isCompletedTask = Boolean(
    task && (
      task.status === 'COMPLETED' || 
      task.status === 'RESOLVED' || 
      task.status === 'APPROVED' || 
      task.is_completed === true
    )
  );

  if (isCompletedTask) {
    const completedActor = task?.approvedBy || task?.completedBy || task?.assigneeName || currentUser?.name || 'ผู้อนุมัติ';
    const completedTime = task?.completedAt || task?.updatedAt || task?.timestamp;
    const completedTimeFormatted = completedTime
      ? `${new Date(completedTime).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.`
      : '';
    const darNumber = dar?.darNumber || dar?.darNo || (typeof dar?.id === 'string' && dar.id.startsWith('DAR') ? dar.id : null);

    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
        <div className="card-surface p-8 text-center max-w-md shadow-xs border border-emerald-200/80 rounded-2xl bg-white animate-in fade-in zoom-in-95 duration-150">
          {/* 1. ไอคอนสำเร็จ (Top Icon) */}
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3 mx-auto shadow-2xs">
            <CheckCircle2 size={24} className="text-emerald-600" />
          </div>

          {/* 2. ป้ายสถานะ (Status Pill) */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50/80 border border-emerald-200/60 text-emerald-700 text-xs font-medium mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            คำร้องนี้ได้รับการอนุมัติเสร็จสิ้นแล้ว
          </div>

          {/* Tag เลขที่ DAR (Sleek Monospace Tag) */}
          {darNumber && (
            <div>
              <span className="inline-block font-mono text-[11px] font-semibold tracking-wider text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/60 mb-1.5">
                DAR: {darNumber}
              </span>
            </div>
          )}

          {/* 3. ชื่อเอกสาร (Document Title) */}
          <h2 className="text-sm font-semibold text-slate-900 leading-snug px-4 break-words">
            {dar?.title || task?.title || 'งานอนุมัติเอกสารเสร็จสมบูรณ์'}
          </h2>

          {/* 4. ข้อมูลผู้อนุมัติและเวลาเป็นบรรทัดเดียว (Inline Muted Metadata) */}
          <p className="text-xs text-slate-500 mt-2 flex items-center justify-center gap-1.5 flex-wrap">
            <span>อนุมัติเสร็จสิ้นโดย <strong className="font-medium text-slate-700">{completedActor}</strong></span>
            {completedTimeFormatted && (
              <>
                <span className="text-slate-300">•</span>
                <span>{completedTimeFormatted}</span>
              </>
            )}
          </p>

          {/* 5. ปุ่ม Action สไตล์ Minimalist */}
          <button 
            type="button"
            onClick={() => navigate('/dcc/tasks', { replace: true })} 
            className="mt-6 w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-xs font-medium transition-all shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={14} /> กลับสู่หน้ารายการงาน (Task Inbox)
          </button>
        </div>
      </div>
    );
  }

  if (!task || !dar) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
        <div className="card-surface p-8 text-center max-w-md shadow-xs border border-slate-200 rounded-2xl bg-white">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mx-auto mb-4 text-amber-600">
            <AlertCircle size={28} />
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
            onClick={() => navigate('/dcc/tasks', { replace: true })} 
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft size={14} /> กลับสู่หน้ารายการงาน (Task Inbox)
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
            งานนี้ถูกมอบหมายให้ผู้อนุมัติท่านอื่น หรือคุณไม่มีสิทธิ์เข้าถึงงานในขั้นตอนนี้
          </p>
          <button 
            type="button"
            onClick={() => navigate('/dcc/tasks', { replace: true })} 
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft size={14} /> กลับสู่หน้ารายการงาน (Task Inbox)
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
    if ((action === 'RETURN' || action === 'REJECT') && !comment) {
      toast.error('กรุณาระบุเหตุผล (Comment) สำหรับการตีกลับหรือไม่อนุมัติ');
      return;
    }
    setPendingAction(action);
    setShowConfirm(true);
  };

  const executeAction = async () => {
    setShowConfirm(false);
    try {
      navigate('/dcc/tasks', { replace: true });
      await processWorkflow(task.id, pendingAction, comment);
      if (pendingAction === 'APPROVE' && !isObsolete) {
        const darTargetId = dar?.id || task?.darId;
        if (darTargetId && finalizeAndPublishMaster) {
          finalizeAndPublishMaster(darTargetId).catch(err => {
            console.warn('[TaskApprove] finalizeAndPublishMaster warning:', err);
          });
        }
      }
      const actionText = pendingAction === 'APPROVE' 
        ? (isObsolete ? 'อนุมัติยกเลิกเอกสารสำเร็จแล้ว' : 'อนุมัติเอกสารสำเร็จแล้ว') 
        : pendingAction === 'REJECT' 
          ? 'ไม่อนุมัติคำร้องเรียบร้อยแล้ว' 
          : 'ส่งกลับแก้ไขเรียบร้อยแล้ว';
      toast.success(actionText);
    } catch (error) {
      console.error('Approval Crash:', error);
      toast.error(`เกิดข้อผิดพลาด: ${error.message || 'ระบบขัดข้อง'}`);
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
           <button onClick={() => navigate('/dcc/tasks')} className="flex items-center text-xs font-bold text-slate-600 hover:text-[#0D99FF] transition-colors">
             <ChevronLeft className="mr-1" size={16} /> ย้อนกลับ
           </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsInspectorOpen(true)}
                className="flex items-center px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-all cursor-pointer"
                title="เปิดหน้าต่างเอกสารฉบับเต็ม"
              >
                เอกสารฉบับเต็ม
              </button>
              <h2 className="font-bold text-[#1E1E1E] text-sm flex items-center gap-2">
               <FileText className="text-purple-600" size={16} /> อนุมัติเอกสาร
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
          <div className="flex items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-100">
            {/* Left: Destructive Action */}
            <button
              disabled={!hasReadToBottom}
              onClick={() => handleAction('REJECT')}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="ไม่อนุมัติและยกเลิกคำขอนี้ทันที"
            >
              <X size={15} /> ไม่อนุมัติ (Reject)
            </button>

            {/* Right: Primary & Revision Actions */}
            <div className="flex items-center gap-2.5">
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
                className={`inline-flex items-center gap-1.5 h-9 px-5 py-2 rounded-xl text-xs font-medium text-white transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                  isObsolete
                    ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-xs shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-xs shadow-emerald-600/20'
                }`}
                title={isObsolete ? 'อนุมัติยกเลิกเอกสาร' : 'อนุมัติคำขอ'}
              >
                <Check size={15} /> {isObsolete ? 'อนุมัติยกเลิกเอกสาร (Approve Obsolete)' : 'อนุมัติ (Approve)'}
              </button>
            </div>
          </div>
          {!hasReadToBottom && (
            <p className="text-xs text-rose-500 text-center mt-2 font-medium">⚠️ กรุณาเลื่อนอ่านเอกสารทางขวาให้จบเพื่อปลดล็อคปุ่ม</p>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: PDF Viewer & Signatory Matrix (60%) */}
      <div className="w-[60%] flex flex-col bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-700">
        
        {/* Header - แสดงชื่อเอกสารตามฟอร์ม DAR แทนชื่อไฟล์ดิบ (Blueprint A) */}
        <div className="bg-slate-800 text-slate-200 px-4 py-3 flex items-center justify-between border-b border-slate-700 shadow-xs z-10 shrink-0">
          <div className="flex items-center gap-2 truncate pr-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-sm font-bold text-slate-200 truncate" title={headerDisplayTitle}>
              {headerDisplayTitle}
            </span>
            <span className="text-slate-400 font-mono text-[11px] shrink-0 font-normal">(โหมดการพิจารณาอนุมัติ)</span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-4 shrink-0">
            <button 
              onClick={handleDownloadDraft}
              className="action-icon-btn text-emerald-400 hover:text-white hover:bg-slate-700 cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" 
              title="ดาวน์โหลดเอกสาร PDF"
            >
              <Download size={14} />
              <span className="hidden sm:inline font-bold">ดาวน์โหลด</span>
            </button>
          </div>
        </div>

        {/* PDF Container - ขยาย Edge-to-Edge ห้ามมี Padding ล้อมรอบ (Blueprint A) */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 w-full h-full relative bg-slate-50 overflow-hidden flex items-center justify-center"
        >
          {loadingPdf ? (
            <div className="text-slate-400 font-medium animate-pulse flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-3 border-sky-500/20 border-t-sky-500 animate-spin" />
              <span className="text-xs text-slate-500">กำลังเปิดไฟล์เอกสารฉบับจริง...</span>
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              src={`${pdfBlobUrl}#view=FitH&toolbar=0&navpanes=0`}
              className="absolute inset-0 w-full h-full border-0 bg-white"
              title="PDF Preview"
            />
          ) : pdfLoadError ? (
            <div className="text-slate-400 font-medium flex flex-col items-center gap-4 p-6 text-center">
              <ShieldAlert size={40} className="text-amber-500" />
              <span className="text-sm text-slate-700">{pdfLoadError}</span>
              <button
                onClick={() => setPdfLoadRetryKey(k => k + 1)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <RotateCcw size={14} /> ลองโหลดใหม่
              </button>
            </div>
          ) : (
            <div className="text-slate-400 font-medium flex flex-col items-center gap-3">
              <ShieldAlert size={40} className="text-slate-400" />
              <span>ไม่พบไฟล์เอกสารอ้างอิงจริง (No attached file)</span>
            </div>
          )}
        </div>

      </div>

      <ActionConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executeAction}
        title={
          pendingAction === 'APPROVE' 
            ? (isObsolete ? 'ยืนยันการอนุมัติยกเลิกเอกสาร (Approve Obsolete DAR)' : 'ยืนยันการอนุมัติเอกสาร (Approve DAR)')
            : pendingAction === 'REJECT' 
              ? 'ยืนยันการไม่อนุมัติ (Reject DAR)' 
              : 'ยืนยันการส่งกลับแก้ไข (Request Revision)'
        }
        actionType={pendingAction === 'APPROVE' ? (isObsolete ? 'obsolete' : 'approve') : 'reject'}
        confirmText={
          pendingAction === 'APPROVE' 
            ? approvalNextStep.buttonText 
            : pendingAction === 'REJECT' 
              ? 'ยืนยันไม่อนุมัติคำร้อง' 
              : 'ยืนยันส่งกลับแก้ไข'
        }
        confirmButtonClass={
          pendingAction === 'APPROVE'
            ? approvalNextStep.buttonClass
            : undefined
        }
        cancelText="ยกเลิก / กลับไปตรวจสอบ"
        dar={darWithWorkflow}
        currentActor={currentUser}
        currentStep="APPROVER"
        workflowSignatories={workflowSignatories}
        summaryData={[
          { label: 'ผู้อนุมัติ', value: `${currentUser?.name || 'ผู้อนุมัติ'} (${currentUser?.department || '-'})` },
          { label: 'เอกสาร', value: dar ? `[${getDarDocInfo(dar, documents).docCode}] ${dar.title}` : '-' },
          { 
            label: 'ผลการพิจารณา', 
            value: pendingAction === 'APPROVE' 
              ? (isObsolete ? 'อนุมัติยกเลิกเอกสาร (Approved Obsolete)' : 'อนุมัติประกาศใช้ (Approved)') 
              : pendingAction === 'REJECT' 
                ? 'ไม่อนุมัติคำร้อง (Rejected)' 
                : 'ส่งกลับแก้ไข (Revision Required)' 
          },
          { label: 'ความเห็นประกอบ', value: comment || '-' },
          { 
            label: 'สายการอนุมัติถัดไป', 
            value: pendingAction === 'APPROVE' 
              ? (nextDestination?.label || (dccStep ? approvalNextStep.title : (isObsolete ? 'สิ้นสุดขั้นตอนการขอยกเลิก (Obsolete Completed)' : 'สิ้นสุดขั้นตอนการอนุมัติ (Approval Completed)')))
              : pendingAction === 'REJECT' 
                ? 'สิ้นสุดคำร้อง: ส่งเข้าคลังประวัติ (ไม่อนุมัติ)' 
                : 'ส่งกลับไปยัง: ผู้ร้องขอ (แก้ไขคำร้อง)' 
          }
        ]}
      />

      <DarReviewModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        dar={dar}
        role="APPROVER"
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
        onReject={(modalComment) => {
          setComment(modalComment || comment);
          setIsInspectorOpen(false);
          setPendingAction('REJECT');
          setShowConfirm(true);
        }}
      />
    </div>
  );
};

export default TaskApprove;
