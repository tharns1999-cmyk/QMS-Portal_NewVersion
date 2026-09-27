import React, { useState, useRef, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Database, Download, Search, Eye, X, FilterX, ChevronDown } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { getRequesterName, getReviewerName, getApproverName, getAckNames } from '../../utils/darHelper';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';
import { UniversalWatermarkService, WATERMARK_TYPES } from '../../services/UniversalWatermarkService';
import toast from 'react-hot-toast';

const MasterList = () => {
  const { 
    documents, 
    currentUser, 
    dars, 
    timeline, 
    masterUsers,
    documentTypes,
    masterDepartments,
    departments: storeDepts
  } = useStore();
  
  // Access Control
  const isAdmin = currentUser?.level >= 5 || currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN';
  const isDccAdmin = Boolean(
    currentUser?.isDcc || 
    currentUser?.role === 'DCC_ADMIN' || 
    currentUser?.isDccAdmin || 
    currentUser?.department === 'DC' || 
    currentUser?.department === 'DCC'
  );
  
  const [masterListDept, setMasterListDept] = useState('');
  const [masterListType, setMasterListType] = useState('');
  const [masterListStatus, setMasterListStatus] = useState('EFFECTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isPreviewMenuOpen, setIsPreviewMenuOpen] = useState(false);
  const previewMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (previewMenuRef.current && !previewMenuRef.current.contains(e.target)) {
        setIsPreviewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDownloadDoc = async (targetDoc, downloadMode = 'UNCONTROLLED') => {
    if (!targetDoc) return;
    try {
      let watermarkType = WATERMARK_TYPES.UNCONTROLLED_COPY;
      let isCleanMaster = false;

      if (downloadMode === 'CLEAN' || downloadMode === 'CLEAN_MASTER') {
        watermarkType = 'CLEAN';
        isCleanMaster = true;
      } else if (downloadMode === 'CONTROLLED' || downloadMode === 'CONTROLLED_COPY') {
        watermarkType = WATERMARK_TYPES.CONTROLLED_COPY;
      } else {
        watermarkType = WATERMARK_TYPES.UNCONTROLLED_COPY;
      }

      await UniversalWatermarkService.downloadWatermarkedPdf(targetDoc, watermarkType, {
        userName: currentUser?.name || 'Authorized User',
        userDept: currentUser?.department || currentUser?.dept || 'QMS',
        holderDept: targetDoc.department || currentUser?.department || 'DCC',
        location: targetDoc.location || targetDoc.pointOfUse || targetDoc.locationName || targetDoc.department || 'DCC Office',
        effectiveDate: targetDoc.effectiveDate,
        isCleanMaster,
        currentUser
      }, false);

      const label = isCleanMaster
        ? 'เอกสารแม่บทคลีน (Clean Master)'
        : (watermarkType === WATERMARK_TYPES.CONTROLLED_COPY ? 'สำเนาควบคุม (Controlled Copy)' : 'สำเนาไม่ควบคุม (Uncontrolled Copy)');

      toast.success(`ดาวน์โหลด ${label} สำเร็จ`);
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการดาวน์โหลดเอกสาร');
    }
  };

  // Filter Logic
  let filteredDocs = documents || [];
  
  if (!isAdmin) {
    filteredDocs = filteredDocs.filter(d => d.department === currentUser?.department);
  }

  if (masterListDept) {
    filteredDocs = filteredDocs.filter(d => d.department === masterListDept);
  }
  
  if (masterListStatus === 'EFFECTIVE') {
    filteredDocs = filteredDocs.filter(d => d.status === 'EFFECTIVE');
  } else if (masterListStatus === 'OBSOLETE') {
    filteredDocs = filteredDocs.filter(d => d.status === 'SUPERSEDED_ARCHIVED' || d.status === 'OBSOLETE_ARCHIVED' || d.status === 'OBSOLETE');
  }
  
  if (masterListType) {
    filteredDocs = filteredDocs.filter(d => (d.title || '').startsWith(masterListType));
  }
  
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredDocs = filteredDocs.filter(d => 
      (d.title || '').toLowerCase().includes(term) || (d.name || '').toLowerCase().includes(term)
    );
  }

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalItems
  } = useTablePagination(filteredDocs, 10);

  const availableDepts = [...new Set([
    ...(documents || []).map(d => d.department),
    ...(masterDepartments || storeDepts || []).filter(d => typeof d === 'string' || d.status !== 'INACTIVE').map(d => typeof d === 'string' ? d : d.id)
  ])].filter(Boolean).sort();

  const availableTypes = [...new Set([
    ...(documents || []).map(d => (d.title || '').split('-')[0]),
    ...(documentTypes || []).filter(t => t.status === 'ACTIVE' || t.status === 'Active' || t.isActive !== false).map(t => t.code || t.id)
  ])].filter(Boolean).sort();

  const handleExportExcel = () => {
    if (filteredDocs.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const headers = ['No.', 'Document No.', 'Document Title', 'Document Type', 'Revision No.', 'Effective Date', 'Requester', 'Reviewer', 'Approver', 'Ack', 'Distribution List', 'Status'];
    
    const rows = filteredDocs.map((doc, index) => {
      const docType = (doc.title || '').split('-')[0] || 'Unknown';
      const distribution = (doc.distributedTo || []).join(' | ');
      
      const dar = (dars || []).find(d => d.id === doc.darId);
      const reqName = dar ? getRequesterName(dar, masterUsers) : '-';
      const revName = dar ? getReviewerName(dar, timeline) : '-';
      const appName = dar ? getApproverName(dar, timeline) : '-';
      const ackName = dar ? getAckNames(dar, timeline) : '-';

      return [
        index + 1,
        `"${doc.title || ''}"`,
        `"${doc.name || ''}"`,
        docType,
        doc.rev || '00',
        doc.effectiveDate || '',
        `"${reqName}"`, 
        `"${revName}"`, 
        `"${appName}"`,
        `"${ackName}"`,
        `"${distribution}"`,
        doc.status || 'EFFECTIVE'
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(',') + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `QMS_MasterList_${masterListDept || 'ALL'}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    if (status === 'EFFECTIVE') return <span className="badge-active">มีผลบังคับใช้</span>;
    if (status === 'OBSOLETE_ARCHIVED' || status === 'OBSOLETE') return <span className="badge-draft">ยกเลิก / ตกรุ่น</span>;
    if (status === 'SUPERSEDED_ARCHIVED') return <span className="badge-pending">มีฉบับใหม่แทนที่</span>;
    return <span className="badge-draft">{status}</span>;
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto h-full flex flex-col min-h-0 pb-6 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="card-surface p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1E1E1E] flex items-center gap-2.5 tracking-tight">
            <Database className="text-[#0D99FF]" size={28} /> ทะเบียนเอกสารควบคุมหลัก (Master List Registry)
          </h2>
          <p className="text-sm text-[#666666] mt-1">ระบบคลังข้อมูลส่วนกลางสำหรับตรวจสอบและส่งออกทะเบียนเอกสาร QMS</p>
        </div>
        <div className="bg-[#E5F4FF] px-4 py-2.5 rounded-xl border border-[#E5F4FF]/80 flex items-center gap-3">
          <span className="text-[#007BE5] font-bold text-sm">เอกสารทั้งหมด (ตามเงื่อนไข):</span>
          <span className="text-2xl font-bold text-indigo-900 font-mono">{filteredDocs.length}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card-surface p-4 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <label className="font-bold text-slate-600">แผนก:</label>
            <select 
              value={masterListDept}
              onChange={(e) => setMasterListDept(e.target.value)}
              disabled={availableDepts.length === 0}
              className="px-3.5 py-2.5 h-11 text-sm bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl outline-none disabled:opacity-50 font-medium focus:bg-white focus:border-[#0D99FF]"
            >
              <option value="">ทั้งหมด (All)</option>
              {availableDepts.map(d => {
                const matchedDept = (masterDepartments || []).find(md => md.id === d);
                const label = matchedDept ? `${d} - ${matchedDept.nameTh || matchedDept.name}` : d;
                return <option key={d} value={d}>{label}</option>;
              })}
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <label className="font-bold text-slate-600">ประเภท:</label>
            <select 
              value={masterListType}
              onChange={(e) => setMasterListType(e.target.value)}
              disabled={availableTypes.length === 0}
              className="px-3.5 py-2.5 h-11 text-sm bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl outline-none disabled:opacity-50 font-medium focus:bg-white focus:border-[#0D99FF]"
            >
              <option value="">ทั้งหมด (All)</option>
              {availableTypes.map(t => {
                const matchedType = (documentTypes || []).find(dt => (dt.code || dt.id) === t);
                const label = matchedType ? `${matchedType.nameTh || matchedType.name} (${t})` : t;
                return <option key={t} value={t}>{label}</option>;
              })}
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <label className="font-bold text-slate-600">สถานะ:</label>
            <div className="flex bg-[#F5F5F5] p-0.5 rounded-xl h-11 items-center">
              <button 
                onClick={() => setMasterListStatus('EFFECTIVE')}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all h-full flex items-center ${masterListStatus === 'EFFECTIVE' ? 'bg-white shadow-xs text-[#007BE5]' : 'text-[#666666] hover:text-slate-800'}`}
              >
                มีผลบังคับใช้ (EFFECTIVE)
              </button>
              <button 
                onClick={() => setMasterListStatus('OBSOLETE')}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all h-full flex items-center ${masterListStatus === 'OBSOLETE' ? 'bg-white shadow-xs text-slate-800' : 'text-[#666666] hover:text-slate-800'}`}
              >
                ยกเลิก (OBSOLETE)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 relative flex-1 min-w-[220px]">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="ค้นหารหัส หรือชื่อเอกสาร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 h-11 text-sm bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl focus:bg-white focus:border-[#0D99FF] outline-none transition-all font-medium placeholder:text-slate-400"
              />
            </div>
            {(masterListDept || masterListType || masterListStatus !== 'EFFECTIVE' || searchTerm) && (
              <button 
                onClick={() => {
                  setMasterListDept('');
                  setMasterListType('');
                  setMasterListStatus('EFFECTIVE');
                  setSearchTerm('');
                }}
                title="ล้างตัวกรอง"
                className="action-icon-btn text-rose-600 hover:bg-rose-50 h-11 w-11 rounded-xl"
              >
                <FilterX size={18} />
              </button>
            )}
          </div>

          <button 
            onClick={handleExportExcel}
            className="btn-secondary text-sm font-medium py-2.5 px-4 h-11 ml-auto"
          >
            <Download size={16} /> ส่งออกไฟล์ Excel
          </button>
        </div>
      </div>

      {/* Data Table Container */}
      <div className="w-full max-w-full flex-1 flex flex-col min-h-0 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 scrollbar-thin">
          {paginatedData.length > 0 ? (
            <table className="w-full text-left text-sm table-auto min-w-[1150px] border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-700 font-bold text-xs sm:text-sm uppercase tracking-normal border-b border-[#E2E8F0] sticky top-0 z-10 whitespace-nowrap shadow-xs backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3.5 w-14 text-center font-mono whitespace-nowrap bg-[#F8FAFC]">ลำดับ</th>
                  <th className="px-4 py-3.5 w-36 font-mono whitespace-nowrap bg-[#F8FAFC]">รหัสเอกสาร</th>
                  <th className="px-4 py-3.5 min-w-[280px] max-w-[420px] whitespace-nowrap bg-[#F8FAFC]">ชื่อเอกสาร</th>
                  <th className="px-4 py-3.5 w-20 text-center whitespace-nowrap bg-[#F8FAFC]">ประเภท</th>
                  <th className="px-4 py-3.5 w-16 text-center whitespace-nowrap bg-[#F8FAFC]">ฉบับที่</th>
                  <th className="px-4 py-3.5 w-28 font-mono whitespace-nowrap bg-[#F8FAFC]">วันบังคับใช้</th>
                  <th className="px-4 py-3.5 w-36 whitespace-nowrap bg-[#F8FAFC]">ผู้ร้องขอ</th>
                  <th className="px-4 py-3.5 w-36 whitespace-nowrap bg-[#F8FAFC]">ผู้ทบทวน</th>
                  <th className="px-4 py-3.5 w-36 whitespace-nowrap bg-[#F8FAFC]">ผู้อนุมัติ</th>
                  <th className="px-4 py-3.5 w-36 whitespace-nowrap bg-[#F8FAFC]">การแจกจ่าย</th>
                  <th className="px-4 py-3.5 w-28 text-center whitespace-nowrap bg-[#F8FAFC]">สถานะ</th>
                  <th className="px-4 py-3.5 w-16 text-center whitespace-nowrap bg-[#F8FAFC]">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {paginatedData.map((doc, idx) => {
                  const dar = (dars || []).find(d => d.id === doc.darId);
                  
                  return (
                  <tr key={doc.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                    <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs sm:text-sm whitespace-nowrap">{(currentPage - 1) * pageSize + idx + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#0D99FF] text-sm sm:text-[15px] whitespace-nowrap">{doc.title}</td>
                    <td className="px-4 py-3 min-w-[280px] max-w-[420px]">
                      <span className="font-medium text-[#1E1E1E] text-sm sm:text-[15px] leading-relaxed block" title={doc.name}>
                        {doc.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-[#F5F5F5] text-slate-700 rounded-lg font-mono text-xs font-bold">
                        {(doc.title || '').split('-')[0]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-slate-700 text-xs sm:text-sm whitespace-nowrap">{doc.rev || '00'}</td>
                    <td className="px-4 py-3 font-mono text-slate-600 text-xs sm:text-sm whitespace-nowrap">{doc.effectiveDate}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs sm:text-sm truncate max-w-[150px] whitespace-nowrap" title={dar ? getRequesterName(dar, masterUsers) : '-'}>
                      {dar ? getRequesterName(dar, masterUsers) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs sm:text-sm truncate max-w-[150px] whitespace-nowrap" title={dar ? getReviewerName(dar, timeline) : '-'}>
                      {dar ? getReviewerName(dar, timeline) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs sm:text-sm truncate max-w-[150px] whitespace-nowrap" title={dar ? getApproverName(dar, timeline) : '-'}>
                      {dar ? getApproverName(dar, timeline) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs sm:text-sm truncate max-w-[150px] whitespace-nowrap" title={(doc.distributedTo || []).join(', ')}>
                      {(doc.distributedTo || []).join(', ') || '-'}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {getStatusBadge(doc.status)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => setPreviewDoc(doc)}
                          className="action-icon-btn text-[#0D99FF] hover:bg-[#E5F4FF] cursor-pointer"
                          title="ดูรายละเอียดเอกสาร"
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          onClick={() => handleDownloadDoc(doc, 'UNCONTROLLED')}
                          className="action-icon-btn text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                          title="ดาวน์โหลดสำเนาไม่ควบคุม (Uncontrolled Copy)"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          ) : (
            <div className="p-8 flex items-center justify-center">
              <EmptyState />
            </div>
          )}
        </div>
        <TablePagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Preview Dialog */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">{previewDoc.title}</span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">{previewDoc.name}</h3>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewDoc(null)} 
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">แผนกเจ้าของ:</span>
                <span className="font-bold text-slate-800">{previewDoc.department}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Revision:</span>
                <span className="font-bold font-mono text-slate-800">{previewDoc.rev || '00'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">วันบังคับใช้:</span>
                <span className="font-bold font-mono text-slate-800">{previewDoc.effectiveDate}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">สถานะ:</span>
                <span>{getStatusBadge(previewDoc.status)}</span>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              {isDccAdmin ? (
                <div className="relative inline-block text-left" ref={previewMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsPreviewMenuOpen(prev => !prev)}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    title="เลือกรูปแบบการดาวน์โหลด (DCC Admin)"
                  >
                    <Download size={14} />
                    <span>ดาวน์โหลด PDF</span>
                    <ChevronDown size={14} className={`opacity-80 transition-transform ${isPreviewMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isPreviewMenuOpen && (
                    <div className="absolute left-0 bottom-full mb-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPreviewMenuOpen(false);
                          handleDownloadDoc(previewDoc, 'UNCONTROLLED');
                        }}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg text-slate-700 hover:bg-slate-100 flex flex-col transition-colors cursor-pointer"
                      >
                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                          📄 สำเนาไม่ควบคุม (Uncontrolled Copy)
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5">ติดลายน้ำสีแดง สำหรับดูอ้างอิง</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsPreviewMenuOpen(false);
                          handleDownloadDoc(previewDoc, 'CLEAN');
                        }}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg text-blue-700 bg-blue-50/80 hover:bg-blue-100 flex flex-col mt-1 border-t border-slate-100 transition-colors cursor-pointer"
                      >
                        <span className="font-semibold text-blue-600 flex items-center gap-1">
                          📥 เอกสารแม่บทฉบับคลีน (Clean Master)
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5">ไม่มีลายน้ำ มีเฉพาะตารางลายเซ็น 3x3</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsPreviewMenuOpen(false);
                          handleDownloadDoc(previewDoc, 'CONTROLLED');
                        }}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg text-emerald-700 hover:bg-emerald-50 flex flex-col mt-1 border-t border-slate-100 transition-colors cursor-pointer"
                      >
                        <span className="font-semibold text-emerald-600 flex items-center gap-1">
                          📑 สำเนาควบคุม (Controlled Copy)
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5">ติดลายน้ำสีน้ำเงิน สำหรับหน้างาน</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(previewDoc, 'UNCONTROLLED')}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  title="ดาวน์โหลดสำเนาไม่ควบคุม (Uncontrolled Copy)"
                >
                  <Download size={14} />
                  <span>ดาวน์โหลด (สำเนาไม่ควบคุม)</span>
                </button>
              )}

              <button 
                type="button"
                onClick={() => {
                  setPreviewDoc(null);
                  setIsPreviewMenuOpen(false);
                }} 
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterList;
