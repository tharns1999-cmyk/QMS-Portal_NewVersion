import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, AlertTriangle, CheckCircle, FileText, Search, Filter, ArrowRight, RotateCw, ClipboardList } from 'lucide-react';
import useStore from '../../store/useStore';
import { canViewAllPeriodicReviews, getVisiblePeriodicReviews } from '../../services/PeriodicReviewAccessService';
import PeriodicReviewControlBoard from './PeriodicReviewControlBoard';
import PeriodicReviewManageModal from './PeriodicReviewManageModal';
import { getReviewStatusLabel, getDueState } from '../../services/PeriodicReviewService';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';

const DashboardCard = ({ title, value, icon: Icon, colorClass, onClick, active }) => (
  <div
    onClick={onClick}
    className={`card-surface p-5 cursor-pointer transition-all relative overflow-hidden group ${
      active ? 'ring-2 ring-[#0D99FF]/20 border-indigo-300 bg-[#E5F4FF]/20' : 'hover:border-[#E5E5E5]'
    }`}
  >
    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorClass} opacity-10 rounded-bl-full`} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-bold text-[#666666] mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-[#1E1E1E] font-mono">{value}</h3>
      </div>
      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${colorClass} text-white shadow-xs group-hover:scale-105 transition-transform`}>
        <Icon size={18} />
      </div>
    </div>
  </div>
);

const OwnerDepartmentView = ({ visibleRecords }) => {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [activeTab, setActiveTab] = useState('ACTION_REQUIRED'); // ACTION_REQUIRED, DUE_SOON, OVERDUE, COMPLETED, ALL
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  // Available departments for the user
  const availableDepts = useMemo(() => {
    const depts = new Set();
    if (currentUser?.department) depts.add(currentUser.department);
    if (currentUser?.dept) depts.add(currentUser.dept);
    if (currentUser?.primary_department) depts.add(currentUser.primary_department);
    (currentUser?.depts || []).forEach(d => depts.add(d));
    (currentUser?.affiliated_departments || []).forEach(d => depts.add(d));
    if (Array.isArray(currentUser?.managedDepartments)) {
      currentUser.managedDepartments.forEach(d => {
        if (d !== '*') depts.add(d);
      });
    }
    if (currentUser?.managedDepartments?.includes('*') || currentUser?.isDcc || currentUser?.role === 'DCC_ADMIN') {
      (visibleRecords || []).forEach(r => {
        if (r.ownerDepartmentId) depts.add(r.ownerDepartmentId);
      });
    }
    return Array.from(depts).filter(Boolean);
  }, [currentUser, visibleRecords]);

  const stats = useMemo(() => {
    return {
      actionRequired: visibleRecords.filter(r => ['DUE_SOON', 'DUE', 'IN_PROGRESS', 'ACTION_REQUIRED', 'OVERDUE'].includes(r.status) || r.hasActiveTask).length,
      dueSoon30: visibleRecords.filter(r => ['DUE_SOON', 'DUE'].includes(r.status)).length,
      overdue: visibleRecords.filter(r => r.status === 'OVERDUE').length,
      completedThisYear: visibleRecords.filter(r => r.status === 'COMPLETED' && new Date(r.updatedAt).getFullYear() === new Date().getFullYear()).length,
    };
  }, [visibleRecords]);

  const filteredRecords = useMemo(() => {
    let result = visibleRecords;

    // Tab filter
    if (activeTab === 'ACTION_REQUIRED') {
      result = result.filter(r => ['DUE_SOON', 'DUE', 'IN_PROGRESS', 'ACTION_REQUIRED', 'OVERDUE'].includes(r.status) || r.hasActiveTask);
    } else if (activeTab === 'DUE_SOON') {
      result = result.filter(r => ['DUE_SOON', 'DUE'].includes(r.status));
    } else if (activeTab === 'OVERDUE') {
      result = result.filter(r => r.status === 'OVERDUE');
    } else if (activeTab === 'COMPLETED') {
      result = result.filter(r => r.status === 'COMPLETED');
    }

    if (selectedDept !== 'ALL') {
      result = result.filter(r => r.ownerDepartmentId === selectedDept);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => (r.documentNumber || '').toLowerCase().includes(term) || (r.documentName || '').toLowerCase().includes(term));
    }

    return result;
  }, [visibleRecords, activeTab, selectedDept, searchTerm]);

  const pagination = useTablePagination(filteredRecords, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashboardCard 
          title="งานที่ต้องดำเนินการ" 
          value={stats.actionRequired} 
          icon={Clock} 
          colorClass="from-indigo-500 to-indigo-600" 
          onClick={() => setActiveTab('ACTION_REQUIRED')}
          active={activeTab === 'ACTION_REQUIRED'}
        />
        <DashboardCard 
          title="ใกล้ครบกำหนดภายใน 30 วัน" 
          value={stats.dueSoon30} 
          icon={Calendar} 
          colorClass="from-amber-400 to-orange-500" 
          onClick={() => setActiveTab('DUE_SOON')}
          active={activeTab === 'DUE_SOON'}
        />
        <DashboardCard 
          title="เกินกำหนด" 
          value={stats.overdue} 
          icon={AlertTriangle} 
          colorClass="from-rose-500 to-red-600" 
          onClick={() => setActiveTab('OVERDUE')}
          active={activeTab === 'OVERDUE'}
        />
        <DashboardCard 
          title="ดำเนินการเสร็จแล้วในปีนี้" 
          value={stats.completedThisYear} 
          icon={CheckCircle} 
          colorClass="from-emerald-500 to-teal-600" 
          onClick={() => setActiveTab('COMPLETED')}
          active={activeTab === 'COMPLETED'}
        />
      </div>

      <div className="card-surface overflow-hidden flex flex-col min-h-0">
        <div className="border-b border-[#E5E5E5]/80 flex flex-wrap gap-1.5 p-2 bg-[#F5F5F5]/50">
          {[
            { id: 'ACTION_REQUIRED', label: 'ต้องดำเนินการ' },
            { id: 'DUE_SOON', label: 'ใกล้ครบกำหนด' },
            { id: 'OVERDUE', label: 'เกินกำหนด' },
            { id: 'COMPLETED', label: 'เสร็จแล้ว' },
            { id: 'ALL', label: 'ทั้งหมดของแผนก' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id ? 'bg-[#0D99FF] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 border-b border-[#E5E5E5]/80 flex flex-col sm:flex-row gap-3 justify-between items-center bg-white">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="ค้นหาเลขที่/ชื่อเอกสาร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#E5E5E5] rounded-xl text-xs focus:outline-none focus:border-[#0D99FF] bg-[#F5F5F5] focus:bg-white transition-all"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto items-center">
            <Filter size={15} className="text-slate-400 hidden sm:block" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="border border-[#E5E5E5] rounded-xl text-xs px-3 py-2 w-full sm:w-48 bg-[#F5F5F5] focus:bg-white focus:outline-none focus:border-[#0D99FF] font-medium"
            >
              <option value="ALL">ทุกแผนกที่ฉันอยู่</option>
              {availableDepts.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full max-w-full scrollbar-thin">
          <table className="w-full text-left text-xs table-fixed border-collapse">
            <thead className="table-header sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E2E8F0] shadow-xs backdrop-blur-sm whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 w-32 font-mono bg-[#F8FAFC]">เลขที่เอกสาร</th>
                <th className="px-4 py-3 bg-[#F8FAFC]">ชื่อเอกสาร</th>
                <th className="px-4 py-3 w-28 bg-[#F8FAFC]">แผนกเจ้าของ</th>
                <th className="px-4 py-3 w-28 bg-[#F8FAFC]">เจ้าของเอกสาร</th>
                <th className="px-4 py-3 w-32 font-mono bg-[#F8FAFC]">วันครบกำหนด</th>
                <th className="px-4 py-3 w-32 text-center bg-[#F8FAFC]">สถานะ</th>
                <th className="px-4 py-3 w-24 text-center bg-[#F8FAFC]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pagination.paginatedData.map(record => {
                const statusLabel = getReviewStatusLabel(record.status);
                return (
                  <tr key={record.id} className="hover:bg-[#F5F5F5]/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0D99FF] text-sm sm:text-[15px] whitespace-nowrap">{record.documentNumber}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 text-sm sm:text-[15px] break-all break-words min-w-0 [overflow-wrap:anywhere] leading-relaxed">{record.documentName}</td>
                    <td className="px-4 py-3 font-bold text-slate-600 text-xs sm:text-sm">{record.ownerDepartmentId}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs sm:text-sm">{record.ownerUserId}</td>
                    <td className="px-4 py-3 font-mono text-[#666666] text-xs sm:text-sm">{record.nextReviewDate}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusLabel.color}`}>
                        {statusLabel.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => navigate(`/dcc/periodic-reviews/${record.id}`)}
                        className="action-icon-btn text-[#0D99FF] hover:bg-[#E5F4FF] mx-auto"
                        title="เปิดดูการทบทวน"
                      >
                        <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pagination.paginatedData.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-xs text-slate-600">ไม่พบรายการทบทวนที่ตรงกับเงื่อนไข</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={pagination.currentPage}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>
    </div>
  );
};


const PeriodicReviewDashboard = () => {
  const { currentUser, periodicReviewSchedules, documents, externalDocuments, tasks, simulatedSystemDate, getEffectiveToday } = useStore();
  const canSeeAll = canViewAllPeriodicReviews(currentUser);
  const [view, setView] = useState(canSeeAll ? 'CONTROL_BOARD' : 'OWNER_DEPT');
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  const allDocs = useMemo(() => [...(documents || []), ...(externalDocuments || [])], [documents, externalDocuments]);
  const effectiveToday = useMemo(() => {
    return getEffectiveToday ? getEffectiveToday() : (simulatedSystemDate ? new Date(simulatedSystemDate) : new Date());
  }, [simulatedSystemDate, getEffectiveToday]);

  const effectiveSchedules = useMemo(() => {
    const existing = [...(periodicReviewSchedules || [])];
    const registeredDocIds = new Set(
      existing.map(s => String(s.documentId || s.externalDocumentId || s.documentNumber || '')).filter(Boolean)
    );

    // If there are documents not yet in schedules, synthesize schedule representations
    (allDocs || []).forEach(doc => {
      const docIdStr = String(doc.id || '');
      const docCode = String(doc.title || doc.doc_code || doc.docNo || doc.document_number || docIdStr);
      if (registeredDocIds.has(docIdStr) || registeredDocIds.has(docCode)) return;

      const statusUpper = (doc.status || '').toUpperCase();
      if (statusUpper === 'SUPERSEDED' || statusUpper === 'OBSOLETE' || doc.is_superseded || doc.is_obsolete) return;

      const isExternal = Boolean(doc.is_external || doc.external || doc.document_type === 'EXTERNAL');
      const docDept = doc.department || doc.dept || doc.owner_dept || (isExternal ? 'DC' : 'QA');
      const nextReviewDate = doc.next_review_date || doc.nextReviewDate || doc.effectiveDate || doc.effective_date;
      if (!nextReviewDate) return;

      const activeTask = (tasks || []).find(t => 
        (t.type === 'PERIODIC_REVIEW' || t.taskType === 'PERIODIC_REVIEW') &&
        t.status !== 'COMPLETED' &&
        (t.docId === doc.id || t.documentId === doc.id || t.docCode === docCode || t.documentNumber === docCode)
      );

      existing.push({
        id: `PRS-AUTO-${doc.id}`,
        documentCategory: isExternal ? 'EXTERNAL' : 'INTERNAL',
        documentId: doc.id,
        externalDocumentId: isExternal ? doc.id : undefined,
        documentNumber: docCode,
        documentName: doc.name || doc.doc_name || doc.title || docCode,
        ownerUserId: doc.ownerId || doc.owner_id || 'U002',
        ownerDepartmentId: docDept,
        responsibleUserId: doc.ownerId || doc.owner_id || 'U002',
        currentScheduledReviewDate: nextReviewDate,
        nextReviewDate: nextReviewDate,
        status: doc.review_status || (activeTask ? 'ACTION_REQUIRED' : 'UPCOMING'),
        dueState: getDueState ? getDueState(nextReviewDate, effectiveToday) : 'UPCOMING',
        hasActiveTask: Boolean(activeTask),
        isActive: true,
        createdAt: doc.createdAt || new Date().toISOString(),
        updatedAt: doc.updatedAt || new Date().toISOString()
      });
      registeredDocIds.add(docIdStr);
      registeredDocIds.add(docCode);
    });

    return existing;
  }, [periodicReviewSchedules, allDocs, tasks, effectiveToday]);

  const visibleRecords = useMemo(
    () => getVisiblePeriodicReviews(currentUser, effectiveSchedules, allDocs, effectiveToday),
    [currentUser, effectiveSchedules, allDocs, effectiveToday]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 w-full max-w-full overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1E1E1E] tracking-tight flex items-center gap-2">
            <RotateCw className="text-[#0D99FF]" size={24} /> การทบทวนเอกสารตามรอบ (Periodic Review Dashboard)
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            {view === 'OWNER_DEPT' ? 'งานทบทวนเอกสารของแผนกฉัน' : 'ภาพรวมการทบทวนเอกสารทุกแผนก'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <button
            onClick={() => setIsManageModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
          >
            <FileText className="w-4 h-4"/>
            <span>จัดการทบทวน (Internal/External)</span>
          </button>
          {canSeeAll && (
            <div className="bg-[#F5F5F5] p-1 rounded-xl flex items-center shadow-xs">
              <button
                onClick={() => setView('OWNER_DEPT')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${view === 'OWNER_DEPT' ? 'bg-white text-[#007BE5] shadow-xs' : 'text-slate-600 hover:text-[#1E1E1E]'}`}
              >
                งานของแผนกฉัน
              </button>
              <button
                onClick={() => setView('CONTROL_BOARD')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${view === 'CONTROL_BOARD' ? 'bg-white text-[#007BE5] shadow-xs' : 'text-slate-600 hover:text-[#1E1E1E]'}`}
              >
                ภาพรวมทุกแผนก
              </button>
            </div>
          )}
        </div>
      </div>

      {view === 'OWNER_DEPT' ? (
        <OwnerDepartmentView visibleRecords={visibleRecords} />
      ) : (
        <PeriodicReviewControlBoard />
      )}

      {/* Periodic Review Management Modal (Internal / External) */}
      <PeriodicReviewManageModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
      />

    </div>
  );
};

export default PeriodicReviewDashboard;
