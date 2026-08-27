const REASON_MAP = {
  'PROCESS_IMPROVEMENT': 'ปรับปรุงกระบวนการทำงานให้ดีขึ้น',
  'AUDIT_FINDING': 'แก้ไข/ยกเลิกตามข้อเสนอแนะจากการตรวจติดตาม (Audit Finding)',
  'MANAGEMENT_REVIEW': 'ทบทวนโดยฝ่ายบริหาร (Management Review)',
  'PROCESS_CHANGE': 'ปรับปรุงกระบวนการและควบรวมกับเอกสารอื่น',
  'PROCESS_REMOVED': 'ยกเลิกกระบวนการทำงานดังกล่าวแล้ว',
  'DUPLICATED': 'เอกสารซ้ำซ้อน',
  'OTHER': 'อื่นๆ'
};

export const getDarReason = (dar) => {
  if (!dar) return { title: 'เหตุผลในการร้องขอ', value: '-' };
  
  const mapReason = (val) => REASON_MAP[val] || val;

  if (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') {
    return {
      title: 'เหตุผลในการร้องขอ',
      value: dar.requestReason || '-'
    };
  } else if (dar.type === 'REVISION') {
    return {
      title: 'เหตุผลในการแก้ไข',
      value: dar.changeReason === 'OTHER' ? dar.otherReason : (mapReason(dar.changeReason) || '-')
    };
  } else if (dar.type === 'OBSOLETE') {
    return {
      title: 'เหตุผลในการยกเลิก',
      value: dar.obsoleteReason === 'OTHER' ? dar.otherReason : (mapReason(dar.obsoleteReason) || '-')
    };
  }
  
  return { title: 'เหตุผลในการร้องขอ', value: '-' };
};

export const getDarDetail = (dar) => {
  if (!dar) return { title: 'รายละเอียดเพิ่มเติม', value: '-' };
  
  if (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') {
    return {
      title: 'รายละเอียดเพิ่มเติม',
      value: dar.requestDetail || '-'
    };
  } else if (dar.type === 'REVISION') {
    return {
      title: 'สรุปการเปลี่ยนแปลง',
      value: dar.changeSummary || '-'
    };
  } else if (dar.type === 'OBSOLETE') {
    return {
      title: 'รายละเอียดเพิ่มเติม/แผนรองรับ',
      value: dar.obsoleteDetail || dar.recallPlan || '-'
    };
  }
  
  return { title: 'รายละเอียดเพิ่มเติม', value: '-' };
};

export const getDarDocInfo = (dar, documents) => {
  if (!dar) return { docCode: '-', docType: '-', docRev: '-' };
  
  if (dar.type === 'NEW' || dar.type === 'NEW_DOCUMENT') {
    return {
      docCode: dar.docIdInput || '-',
      docType: dar.docType || '-',
      docRev: dar.docRev || '00'
    };
  } else if (dar.type === 'REVISION' || dar.type === 'OBSOLETE') {
    const refDoc = documents?.find(d => d.id === dar.docIdRef);
    if (refDoc) {
      const docType = refDoc.title.split('-')[0] || '-';
      return {
        docCode: refDoc.title || '-',
        docType: docType,
        docRev: refDoc.rev || '-'
      };
    }
  }
  
  return { docCode: '-', docType: '-', docRev: '-' };
};

export const getRequesterName = (dar, masterUsers) => {
  if (!dar) return '-';
  const u = masterUsers?.find(u => u.id === dar.requesterId);
  return u ? u.name : (dar.requester || '-');
};

export const getReviewerName = (dar, timeline) => {
  if (!dar || !timeline) return '-';
  const tl = timeline.slice().reverse().find(t => t.darId === dar.id && (t.action === 'Reviewed' || t.action === 'Review'));
  return tl ? tl.user : (dar.reviewer || '-');
};

export const getApproverName = (dar, timeline) => {
  if (!dar || !timeline) return '-';
  const tl = timeline.slice().reverse().find(t => t.darId === dar.id && (t.action === 'Approved' || t.action === 'Approve'));
  return tl ? tl.user : (dar.approver || '-');
};

export const getAckNames = (dar, timeline) => {
  if (!dar || !timeline) return '-';
  const acks = timeline.filter(t => t.darId === dar.id && (t.action === 'Acknowledged' || t.action === 'Ack'));
  if (acks.length > 0) {
    return [...new Set(acks.map(a => a.user))].join(', ');
  }
  return '-';
};
