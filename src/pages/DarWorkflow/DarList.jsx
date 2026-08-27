import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import { FilePlus, Edit, Trash2, ClipboardCheck, Eye, ChevronRight, ChevronLeft, Search, X, FileText } from 'lucide-react';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';

const DarList = () => {
  const navigate = useNavigate();
  const { dars, currentUser, tasks, masterUsers, deleteDar } = useStore();
  
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN' || currentUser?.id === 'u5' || currentUser?.id === 'U001';
  
  // Department-Wide Visibility
  const myDars = (dars || []).filter(dar => 
    isAdmin || 
    dar.department === currentUser?.department || 
    dar.requesterId === currentUser?.id
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredDars = myDars.filter(dar => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      dar.id?.toLowerCase().includes(term) ||
      dar.title?.toLowerCase().includes(term) ||
      dar.type?.toLowerCase().includes(term) ||
      dar.status?.toLowerCase().includes(term) ||
      (dar.department && dar.department.toLowerCase().includes(term))
    );
  });

  const pagination = useTablePagination(filteredDars, 30);

  const isMyTask = (t) => t.assigneeId === currentUser?.id || (t.currentHandlerDepartment === currentUser?.department && Number(t.currentHandlerLevel) === Number(currentUser?.level));

  const getCurrentHandler = (dar) => {
    if (dar.status === 'DRAFT') {
      const user = (masterUsers || []).find(u => u.id === dar.requesterId);
      const name = user ? user.name : (dar.requester || dar.requesterId);
      return <span className="text-slate-600 font-medium">{name} (ผู้ร้องขอ)</span>;
    } else if (dar.status === 'APPROVED_WAITING_EFFECTIVE' || dar.status === 'WAITING_EFFECTIVE') {
      return <span className="text-slate-400 font-medium">-</span>;
    } else if (dar.status === 'UNDER_REVIEW' || dar.status === 'PENDING_APPROVAL' || dar.status === 'WAITING_ACKNOWLEDGEMENT') {
      const activeTasks = (tasks || []).filter(t => t.darId === dar.id);
      if (activeTasks.length > 0) {
        const handlerNames = activeTasks.map(t => {
           const user = (masterUsers || []).find(u => u.id === t.assigneeId);
           const role = t.type === 'Review' ? 'ผู้ทบทวน' : t.type === 'Approve' ? 'ผู้อนุมัติ' : 'ผู้รับทราบ';
           if (user) {
             return `${user.name} (${role})`;
           } else {
             let fallbackName = t.assigneeId;
             if (t.assigneeId === 'AUTO' || !t.assigneeId) {
                fallbackName = t.type === 'Review' ? dar.reviewer : t.type === 'Approve' ? dar.approver : 'System';
             }
             return `${fallbackName} (${role})`;
           }
        });
        return <span className="text-[#007BE5] font-medium">{handlerNames.join(', ')}</span>;
      }
      return '-';
    } else if (dar.status === 'RETURNED_FOR_REVISION') {
      const user = (masterUsers || []).find(u => u.id === dar.requesterId);
      const name = user ? user.name : (dar.requester || dar.requesterId);
      return <span className="text-rose-600 font-medium flex items-center gap-1">{name} (ผู้ร้องขอ - แก้ไข)</span>;
    }
    return '-';
  };

  const renderActionButtons = (dar) => {
    const isRequesterOfDar = dar.requesterId === currentUser?.id;
    const activeTask = (tasks || []).find(t => t.darId === dar.id && isMyTask(t));
    
    if (dar.status === 'DRAFT' && isRequesterOfDar) {
      return (
        <div className="flex items-center justify-center gap-1">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const basePath = dar.type === 'NEW' ? '/dar/new/document' : 
                              dar.type === 'REVISION' ? '/dar/new/revision' : '/dar/new/obsolete';
              navigate(`${basePath}?draftId=${dar.id}`);
            }}
            className="action-icon-btn text-[#0D99FF] hover:bg-[#E5F4FF]"
            title="ดำเนินการต่อ (Resume Draft)"
          >
            <Edit size={14} />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('คุณต้องการลบแบบร่างนี้ทิ้งใช่หรือไม่?')) {
                deleteDar(dar.id);
              }
            }}
            className="action-icon-btn text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            title="ลบทิ้ง (Discard)"
          >
            <Trash2 size={14} />
          </button>
        </div>
      );
    }
    
    if (activeTask) {
      const taskRoute = activeTask.type === 'Review' ? `/tasks/review/${activeTask.id}` : 
                        activeTask.type === 'Approve' ? `/tasks/approve/${activeTask.id}` : `/tasks/ack/${activeTask.id}`;
      return (
        <div className="flex items-center justify-center">
          <button 
            onClick={(e) => { e.stopPropagation(); navigate(taskRoute); }}
            className="action-icon-btn text-[#0D99FF] hover:bg-[#E5F4FF]"
            title="ดำเนินการ (Process Task)"
          >
            <ClipboardCheck size={15} />
          </button>
        </div>
      );
    }

    if (isAdmin && (dar.status === 'APPROVED_WAITING_EFFECTIVE' || dar.status === 'WAITING_EFFECTIVE')) {
      return (
        <div className="flex items-center justify-center">
          <button 
            onClick={(e) => { e.stopPropagation(); navigate(`/tasks`); }}
            className="action-icon-btn text-purple-600 hover:bg-purple-50"
            title="ดำเนินการ DCC (Verify & Distribute)"
          >
            <ClipboardCheck size={15} />
          </button>
        </div>
      );
    }

    if (dar.status === 'RETURNED_FOR_REVISION' && isRequesterOfDar) {
      return (
        <div className="flex items-center justify-center">
          <button 
            onClick={(e) => { e.stopPropagation(); navigate(`/tasks/revise/${dar.id}`); }}
            className="action-icon-btn text-amber-600 hover:bg-amber-50"
            title="แก้ไขคำขอ (Revise DAR)"
          >
            <Edit size={14} />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center">
        <button 
          onClick={(e) => { e.stopPropagation(); navigate(`/dar/${dar.id}`); }}
          className="action-icon-btn text-slate-400 hover:text-slate-700"
          title="ดูรายละเอียด (View Details)"
        >
          <Eye size={14} />
        </button>
      </div>
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT': return <span className="badge-draft">ฉบับร่าง</span>;
      case 'UNDER_REVIEW': return <span className="badge-pending">รอการทบทวน</span>;
      case 'PENDING_APPROVAL': return <span className="badge-pending">รอการอนุมัติ</span>;
      case 'CANCELLED': return <span className="badge-rejected">ยกเลิก</span>;
      case 'EFFECTIVE': return <span className="badge-active">มีผลบังคับใช้</span>;
      case 'OBSOLETE': return <span className="badge-draft">ยกเลิก / ตกรุ่น</span>;
      case 'RETURNED_FOR_REVISION': return <span className="badge-rejected">ส่งกลับแก้ไข</span>;
      default: return <span className="badge-active">{status.replace(/_/g, ' ')}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-4 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1E1E1E] tracking-tight">ทะเบียนคำร้อง DAR (DAR Register)</h2>
          <p className="text-xs text-[#666666] mt-0.5">รายการคำร้องขอขึ้นทะเบียน แก้ไข หรือยกเลิกเอกสารทั้งหมดในแผนก</p>
        </div>
        <button 
          onClick={() => navigate('/dar/new')}
          className="btn-primary"
        >
          <FilePlus size={16} /> สร้างคำร้อง DAR ใหม่
        </button>
      </div>

      {/* Filter and Search */}
      <div className="card-surface p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="text-[#999999] absolute left-3.5 top-1/2 -translate-y-1/2" size={16} />
          <input
            type="text"
            placeholder="ค้นหาเลขที่ DAR, ชื่อเอกสาร, ประเภท, สถานะ..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              pagination.setCurrentPage(1);
            }}
            className="w-full pl-10 pr-8 py-2 h-10 text-sm bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg focus:bg-white focus:border-[#0D99FF] outline-none transition-all font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); pagination.setCurrentPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="text-sm text-[#666666] font-medium">
          พบทั้งหมด <span className="font-bold text-slate-800 font-mono">{filteredDars.length}</span> รายการ
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs flex flex-col min-h-0 h-auto">
        <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full max-w-full scrollbar-thin">
          <table className="w-full text-left text-sm table-fixed border-collapse">
            <thead className="table-header sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E2E8F0] shadow-xs backdrop-blur-sm whitespace-nowrap">
              <tr>
                <th className="px-3.5 py-3 w-16 text-center bg-[#F8FAFC]">การจัดการ</th>
                <th className="px-3.5 py-3 w-32 font-mono bg-[#F8FAFC]">เลขที่ DAR</th>
                <th className="px-3.5 py-3 bg-[#F8FAFC]">ชื่อเอกสาร / หัวข้อ</th>
                <th className="px-3.5 py-3 w-24 bg-[#F8FAFC]">ประเภท</th>
                {isAdmin && <th className="px-3.5 py-3 w-20 bg-[#F8FAFC]">แผนก</th>}
                <th className="px-3.5 py-3 w-32 bg-[#F8FAFC]">สถานะ</th>
                <th className="px-3.5 py-3 w-48 bg-[#F8FAFC]">ผู้รับผิดชอบปัจจุบัน</th>
                <th className="px-3.5 py-3 w-28 text-right font-mono bg-[#F8FAFC]">วันที่ยื่น</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagination.paginatedData.map((dar) => (
                <tr key={dar.id} className="hover:bg-[#F8FAFC] transition-colors cursor-pointer" onClick={() => navigate(`/dar/${dar.id}`)}>
                  <td className="px-3 py-2.5 text-center">
                    {renderActionButtons(dar)}
                  </td>
                  <td className="px-3.5 py-3 whitespace-nowrap font-mono font-bold text-[#0D99FF] text-sm sm:text-[15px]">
                    <span className="hover:underline">{dar.id}</span>
                  </td>
                  <td className="px-3.5 py-3 font-medium text-slate-800 break-all break-words min-w-0 [overflow-wrap:anywhere] text-sm sm:text-[15px] leading-relaxed" title={dar.title}>
                    {dar.title}
                  </td>
                  <td className="px-3.5 py-3 whitespace-nowrap">
                    <span className="px-2.5 py-1 bg-[#F5F5F5] text-slate-700 rounded-lg font-mono text-xs font-bold">
                      {dar.type}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-3.5 py-3 text-slate-700 font-bold font-mono text-xs sm:text-sm">
                      {dar.department}
                    </td>
                  )}
                  <td className="px-3.5 py-3 whitespace-nowrap">
                    {getStatusBadge(dar.status)}
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap min-w-0 truncate text-xs sm:text-sm">
                    {getCurrentHandler(dar)}
                  </td>
                  <td className="px-3.5 py-3 text-[#666666] text-right font-mono text-xs sm:text-sm whitespace-nowrap">
                    {dar.date}
                  </td>
                </tr>
              ))}
              {pagination.paginatedData.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-6 py-14 text-center text-[#888888]">
                    <FileText className="w-10 h-10 text-[#CCCCCC] mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-xs font-medium text-[#888888]">ไม่พบรายการคำร้อง DAR ที่ตรงกับเงื่อนไขการค้นหา</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Universal Pagination */}
        <TablePagination
          currentPage={pagination.currentPage}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={pagination.setPageSize}
          pageSizeOptions={[10, 25, 30, 50, 100]}
        />
      </div>
    </div>
  );
};

export default DarList;
