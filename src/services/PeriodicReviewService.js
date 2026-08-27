export const calculateNextReviewDate = (anchorDate, frequencyMonths, referenceDate = new Date()) => {
  const anchor = new Date(anchorDate);
  
  // We want to find the current cycle's review date.
  // If the document has never been reviewed, the first review is exactly anchor + frequency.
  let nextDate = new Date(anchor);
  nextDate.setMonth(nextDate.getMonth() + frequencyMonths);
  
  // Only leap forward if referenceDate is explicitly provided and we want the strictly next future date 
  // (e.g. after completing a review).
  if (referenceDate) {
    const ref = new Date(referenceDate);
    while (nextDate <= ref) {
      nextDate.setMonth(nextDate.getMonth() + frequencyMonths);
    }
  }
  
  return nextDate.toISOString().split('T')[0];
};

export const getDueState = (dueDate, referenceDate = new Date()) => {
  const due = new Date(dueDate);
  const ref = new Date(referenceDate);
  
  // Strip time for pure day comparisons
  due.setHours(0, 0, 0, 0);
  ref.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - ref.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    if (diffDays <= -30) return 'ESCALATED';
    return 'OVERDUE';
  } else if (diffDays === 0) {
    return 'DUE_TODAY';
  } else if (diffDays <= 7) {
    return 'DUE_SOON_7';
  } else if (diffDays <= 30) {
    return 'DUE_SOON_30';
  } else if (diffDays <= 60) {
    return 'DUE_SOON_60';
  }
  
  return 'NOT_YET_DUE';
};

export const generateSchedules = (internalDocs, externalDocs, existingSchedules = []) => {
  const newSchedules = [...existingSchedules];
  const now = new Date().toISOString();

  // Internal Docs
  internalDocs.forEach(doc => {
    if (doc.status !== 'EFFECTIVE') return; // Only effective internal docs

    // Check if schedule already exists
    const exists = newSchedules.find(s => s.documentId === doc.id && s.documentCategory === 'INTERNAL' && s.isActive);
    if (exists) return;

    // The anchor is the effective date of the document
    const anchor = doc.effectiveDate || now.split('T')[0];
    // Do not pass referenceDate here, so it just returns anchor + 12 months, allowing it to be overdue
    const nextReviewDate = calculateNextReviewDate(anchor, 12, null);
    
    newSchedules.push({
      id: `PRS-INT-${doc.id}-${Date.now()}`,
      documentCategory: 'INTERNAL',
      documentId: doc.id,
      documentNumber: doc.title, // e.g., WI-IT-001
      documentName: doc.name,
      ownerUserId: doc.ownerId || 'U002', 
      ownerDepartmentId: doc.department || 'QA',
      responsibleUserId: doc.ownerId || 'U002',
      frequencyMonths: 12,
      originalReviewAnchorDate: anchor,
      currentScheduledReviewDate: nextReviewDate,
      nextReviewDate: nextReviewDate,
      status: 'NOT_YET_DUE',
      dueState: getDueState(nextReviewDate),
      escalationLevel: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
  });

  // External Docs
  externalDocs.forEach(doc => {
    if (doc.status !== 'ACTIVE') return;

    const exists = newSchedules.find(s => s.externalDocumentId === doc.id && s.documentCategory === 'EXTERNAL' && s.isActive);
    if (exists) return;

    const anchor = doc.receivedDate || now.split('T')[0];
    const nextReviewDate = calculateNextReviewDate(anchor, 24, null);

    newSchedules.push({
      id: `PRS-EXT-${doc.id}-${Date.now()}`,
      documentCategory: 'EXTERNAL',
      externalDocumentId: doc.id,
      documentNumber: doc.id, 
      documentName: doc.title,
      ownerUserId: doc.ownerId || 'U002',
      ownerDepartmentId: doc.department || 'QA',
      responsibleUserId: doc.ownerId || 'U002',
      frequencyMonths: 24,
      originalReviewAnchorDate: anchor,
      currentScheduledReviewDate: nextReviewDate,
      nextReviewDate: nextReviewDate,
      status: 'NOT_YET_DUE',
      dueState: getDueState(nextReviewDate),
      escalationLevel: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
  });

  return newSchedules;
};

export const generateTasksForSchedules = (schedules, existingTasks = [], referenceDate = new Date()) => {
  const newTasks = [...existingTasks];
  const now = new Date().toISOString();

  schedules.forEach(schedule => {
    if (!schedule.isActive) return;

    // Check if task already exists and is not completed
    const existingTask = newTasks.find(t => t.scheduleId === schedule.id && !['COMPLETED', 'CANCELLED'].includes(t.status));
    
    // Update due state of existing task if it exists
    if (existingTask) {
      existingTask.dueState = getDueState(existingTask.dueDate, referenceDate);
      if (existingTask.dueState === 'ESCALATED') existingTask.escalationLevel = 1;
      return;
    }

    // Determine if we need to create a new task (e.g. <= 60 days before due)
    const dueState = getDueState(schedule.currentScheduledReviewDate, referenceDate);
    if (dueState !== 'NOT_YET_DUE') {
      schedule.status = 'ACTION_REQUIRED';
      schedule.dueState = dueState;

      newTasks.push({
        id: `PRT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        scheduleId: schedule.id,
        assignedToUserId: schedule.responsibleUserId,
        assignedToDepartmentId: schedule.ownerDepartmentId,
        dueDate: schedule.currentScheduledReviewDate,
        status: 'ACTION_REQUIRED',
        dueState: dueState,
        overdueDays: 0,
        reminderState: dueState,
        escalationLevel: dueState === 'ESCALATED' ? 1 : 0,
        createdAt: now,
        updatedAt: now,
        
        // Denormalized for easy listing
        documentNumber: schedule.documentNumber,
        documentName: schedule.documentName,
        documentCategory: schedule.documentCategory
      });
    }
  });

  return newTasks;
};

export const getDueStateLabel = (state) => {
  const map = {
    'NOT_YET_DUE': { label: 'ยังไม่ถึงกำหนด (Not Due)', color: 'bg-gray-100 text-gray-700' },
    'DUE_SOON_60': { label: 'ครบกำหนดใน 60 วัน (Due in 60d)', color: 'bg-blue-100 text-blue-700' },
    'DUE_SOON_30': { label: 'ครบกำหนดใน 30 วัน (Due in 30d)', color: 'bg-yellow-100 text-yellow-700' },
    'DUE_SOON_7': { label: 'ครบกำหนดใน 7 วัน (Due in 7d)', color: 'bg-orange-100 text-orange-700' },
    'DUE_TODAY': { label: 'ครบกำหนดวันนี้ (Due Today)', color: 'bg-red-100 text-red-700' },
    'OVERDUE': { label: 'เกินกำหนด (Overdue)', color: 'bg-red-600 text-white animate-pulse' },
    'ESCALATED': { label: 'เกินกำหนด/ยกระดับ (Escalated)', color: 'bg-black text-red-500 font-bold border-red-500 animate-pulse' }
  };
  return map[state] || map['NOT_YET_DUE'];
};

export const getReviewStatusLabel = (status) => {
  const map = {
    // New Normalized Statuses
    'UPCOMING': { label: 'ยังไม่ถึงกำหนด', color: 'bg-gray-100 text-gray-700' },
    'DUE_SOON': { label: 'ใกล้ครบกำหนด', color: 'bg-yellow-100 text-yellow-800' },
    'DUE': { label: 'ถึงกำหนดทบทวน', color: 'bg-orange-100 text-orange-800' },
    'IN_PROGRESS': { label: 'อยู่ระหว่างทบทวน', color: 'bg-blue-100 text-blue-800' },
    'OVERDUE': { label: 'เกินกำหนด', color: 'bg-red-100 text-red-800' },
    'COMPLETED': { label: 'ทบทวนเสร็จแล้ว', color: 'bg-green-100 text-green-800' },

    // Fallbacks for legacy states before normalization
    'NOT_YET_DUE': { label: 'ยังไม่ถึงกำหนด', color: 'bg-gray-100 text-gray-700' },
    'ACTION_REQUIRED': { label: 'ต้องดำเนินการ', color: 'bg-yellow-100 text-yellow-800' },
    'ACTION_IN_PROGRESS': { label: 'อยู่ระหว่างดำเนินการ', color: 'bg-blue-100 text-blue-800' },
    'COMPLETED_NO_CHANGE': { label: 'เสร็จสิ้น (ไม่มีการเปลี่ยนแปลง)', color: 'bg-green-100 text-green-800' },
    'COMPLETED_WITH_REVISION': { label: 'เสร็จสิ้น (ขอแก้ไข)', color: 'bg-emerald-100 text-emerald-800' },
    'COMPLETED_WITH_OBSOLETE': { label: 'เสร็จสิ้น (ขอยกเลิก)', color: 'bg-emerald-100 text-emerald-800' },
    'COMPLETED_EXTERNAL_CONFIRMED': { label: 'เสร็จสิ้น (ยืนยันเวอร์ชันเดิม)', color: 'bg-green-100 text-green-800' },
    'COMPLETED_EXTERNAL_UPDATED': { label: 'เสร็จสิ้น (อัปเดตเวอร์ชันใหม่)', color: 'bg-emerald-100 text-emerald-800' },
    'COMPLETED_NO_LONGER_APPLICABLE': { label: 'เสร็จสิ้น (ไม่ใช้งานแล้ว)', color: 'bg-slate-100 text-slate-800' },
    'CANCELLED_BY_DOCUMENT_STATUS': { label: 'ยกเลิก (สถานะเอกสารเปลี่ยน)', color: 'bg-slate-200 text-slate-500 line-through' }
  };
  return map[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
};

export const getReviewOutcomeLabel = (outcome) => {
  const map = {
    'NO_CHANGE': { label: 'ไม่มีการเปลี่ยนแปลง', color: 'bg-green-100 text-green-800' },
    'REVISION_REQUIRED': { label: 'ต้องแก้ไขเอกสาร', color: 'bg-yellow-100 text-yellow-800' },
    'OBSOLETE_REQUIRED': { label: 'ต้องยกเลิกเอกสาร', color: 'bg-red-100 text-red-800' }
  };
  return map[outcome] || { label: outcome || '-', color: 'bg-gray-100 text-gray-700' };
};
