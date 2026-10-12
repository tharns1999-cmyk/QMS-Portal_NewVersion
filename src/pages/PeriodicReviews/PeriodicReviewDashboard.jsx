import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  Search,
  Filter,
  RotateCw,
  Eye,
  History,
  X,
  ExternalLink
} from 'lucide-react';
import useStore from '../../store/useStore';
import { canViewAllPeriodicReviews, getVisiblePeriodicReviews } from '../../services/PeriodicReviewAccessService';
import PeriodicReviewControlBoard from './PeriodicReviewControlBoard';
import { getDueState } from '../../services/PeriodicReviewService';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';
import { formatQmsDisplayDate } from '../../utils/dateFormatter';
import { getDocumentReviewMetrics } from '../../utils/documentUtils';

const DashboardCard = ({ title, sublabel, value, icon: Icon, colorClass, onClick, active }) => (
  <div
    onClick={onClick}
    className={`card-surface p-5 cursor-pointer transition-all relative overflow-hidden group ${
      active ? 'ring-2 ring-[#0D99FF]/30 border-sky-400 bg-[#E5F4FF]/30 shadow-xs' : 'hover:border-[#E5E5E5]'
    }`}
  >
    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorClass} opacity-10 rounded-bl-full`} />
    <div className="flex items-start justify-between">
      <div className="min-w-0 pr-2">
        <p className="text-xs font-bold text-[#666666] mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-[#1E1E1E] font-mono">{value}</h3>
        {sublabel && (
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            {Array.isArray(sublabel) ? (
              sublabel.map((s, idx) => <span key={idx} className="inline mr-1">{s}</span>)
            ) : (
              <span>{sublabel}</span>
            )}
          </div>
        )}
      </div>
      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${colorClass} text-white shadow-xs group-hover:scale-105 transition-transform shrink-0`}>
        <Icon size={18} />
      </div>
    </div>
  </div>
);

const getStatusBadgeConfig = (status, hasActiveTask) => {
  if (status === 'OVERDUE') {
    return {
      label: '🚨 เกินกำหนด',
      cls: 'bg-rose-50 text-rose-700 border-rose-200'
    };
  }
  if (status === 'DUE_SOON' || status === 'DUE' || hasActiveTask) {
    return {
      label: '⚠️ ใกล้ครบกำหนด',
      cls: 'bg-amber-50 text-amber-700 border-amber-200'
    };
  }
  if (status === 'COMPLETED') {
    return {
      label: '🏁 เสร็จสิ้นแล้ว',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  }
  return {
    label: '✅ ยังไม่ถึงกำหนด',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };
};

const ReviewHistoryModal = ({ isOpen, onClose, record, doc, onNavigateRecord }) => {
  const reviewHistory = useMemo(() => {
    const list = [];
    if (doc?.periodic_reviews && Array.isArray(doc.periodic_reviews)) {
      list.push(...doc.periodic_reviews);
    } else if (doc?.review_history && Array.isArray(doc.review_history)) {
      list.push(...doc.review_history);
    }
    return list;
  }, [doc]);

  if (!isOpen || !record) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        <div className="px-6 py-4 bg-white border-b border-[#E5E5E5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#E5F4FF] text-[#0D99FF] rounded-xl">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E1E1E]">
                ประวัติการทบทวนเอกสาร: {record.documentNumber}
              </h2>
              <p className="text-xs text-[#666666] line-clamp-1">{record.documentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#888888] hover:text-[#1E1E1E] hover:bg-[#F5F5F5] rounded-xl transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">แผนกเจ้าของ</span>
              <span className="font-bold text-slate-800">{record.ownerDepartmentId || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">ฉบับปัจจุบัน</span>
              <span className="font-bold text-slate-800 font-mono">Rev.{record.rev || '00'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">วันครบกำหนดรอบนี้</span>
              <span className="font-bold text-[#0D99FF] font-mono">{formatQmsDisplayDate(record.nextReviewDate)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              บันทึกผลการทบทวนย้อนหลัง ({reviewHistory.length} รายการ)
            </h3>

            {reviewHistory.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-500">
                  ยังไม่มีประวัติการบันทึกทบทวนย้อนหลังสำหรับเอกสารฉบับนี้
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  รอบทบทวนถัดไปมีกำหนดในวันที่ {formatQmsDisplayDate(record.nextReviewDate)}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviewHistory.map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        รอบที่ {item.review_round || idx + 1}: {item.review_type || 'ทบทวนประจำปี'}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {formatQmsDisplayDate(item.review_date || item.reviewedAt || item.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        {item.outcome === 'CONFIRM_CONTINUE' || item.outcome === 'NO_CHANGE'
                          ? '✅ ยืนยันใช้ต่อ (ไม่ต้องแก้ไข)'
                          : item.outcome === 'REVISION_REQUIRED'
                          ? '✏️ ขอแก้ไขเอกสาร (DAR)'
                          : item.outcome === 'OBSOLETE_REQUIRED'
                          ? '❌ ขอยกเลิกเอกสาร (DAR)'
                          : item.outcome || 'เสร็จสิ้น'}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        ผู้ทบทวน: {item.reviewer || item.reviewerName || '-'}
                      </span>
                    </div>
                    {item.comment && (
                      <p className="text-slate-600 bg-slate-50 p-2 rounded-lg text-xs leading-relaxed">
                        {item.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-[#E5E5E5] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            ปิด
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateRecord(record);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0D99FF] hover:bg-[#007BE5] text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCw size={13} />
            บันทึกผลการทบทวนรอบนี้
          </button>
        </div>
      </div>
    </div>
  );
};

const UnifiedWorkspaceView = ({ visibleRecords, allDocs, effectiveToday: propEffectiveToday }) => {
  const navigate = useNavigate();
  const { currentUser, simulatedSystemDate, getEffectiveToday } = useStore();
  const effectiveToday = propEffectiveToday || (getEffectiveToday ? getEffectiveToday() : (simulatedSystemDate ? new Date(simulatedSystemDate) : new Date()));

  const [categoryTab, setCategoryTab] = useState('INTERNAL'); // 'INTERNAL' | 'EXTERNAL'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTION_REQUIRED' | 'DUE_SOON' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  // History Modal State
  const [historyTarget, setHistoryTarget] = useState(null);

  // Split visible records into Internal & External categories
  const internalRecords = useMemo(
    () => visibleRecords.filter(r => !r.isExternal),
    [visibleRecords]
  );

  const externalRecords = useMemo(
    () => visibleRecords.filter(r => r.isExternal),
    [visibleRecords]
  );

  const currentCategoryList = useMemo(
    () => (categoryTab === 'INTERNAL' ? internalRecords : externalRecords),
    [categoryTab, internalRecords, externalRecords]
  );

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
      visibleRecords.forEach(r => {
        if (r.ownerDepartmentId) depts.add(r.ownerDepartmentId);
      });
    }
    return Array.from(depts).filter(Boolean).sort();
  }, [currentUser, visibleRecords]);

  // KPI Metrics computed for the currently selected Category Tab using MECE helper
  const stats = useMemo(() => {
    return getDocumentReviewMetrics(currentCategoryList, effectiveToday);
  }, [currentCategoryList, effectiveToday]);

  // Filtered records for the Table
  const filteredRecords = useMemo(() => {
    let result = currentCategoryList;

    // Status filter
    if (statusFilter === 'ACTION_REQUIRED') {
      result = result.filter(
        r => ['DUE_SOON', 'DUE', 'IN_PROGRESS', 'ACTION_REQUIRED', 'OVERDUE'].includes(r.status) || r.hasActiveTask
      );
    } else if (statusFilter === 'DUE_SOON') {
      result = result.filter(
        r => (['DUE_SOON', 'DUE'].includes(r.status) || r.hasActiveTask) && r.status !== 'OVERDUE'
      );
    } else if (statusFilter === 'UPCOMING') {
      result = result.filter(
        r => ['UP_TO_DATE', 'ON_SCHEDULE', 'NORMAL', 'UPCOMING'].includes(r.status) && !r.hasActiveTask
      );
    } else if (statusFilter === 'OVERDUE') {
      result = result.filter(r => r.status === 'OVERDUE');
    } else if (statusFilter === 'COMPLETED') {
      result = result.filter(r => r.status === 'COMPLETED');
    }

    // Department filter
    if (selectedDept !== 'ALL') {
      result = result.filter(r => r.ownerDepartmentId === selectedDept);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        r =>
          (r.documentNumber || '').toLowerCase().includes(term) ||
          (r.documentName || '').toLowerCase().includes(term) ||
          (r.ownerDepartmentId || '').toLowerCase().includes(term)
      );
    }

    return result;
  }, [currentCategoryList, statusFilter, selectedDept, searchTerm]);

  const pagination = useTablePagination(filteredRecords, 10);

  const handleNavigateRecord = (record) => {
    const docCode = record.documentNumber || record.id;
    navigate(`/periodic-review/record/${encodeURIComponent(docCode)}`);
  };

  const handleOpenHistory = (record) => {
    const targetDoc = allDocs.find(
      d =>
        d.id === record.documentId ||
        d.id === record.externalDocumentId ||
        d.doc_code === record.documentNumber ||
        d.document_number === record.documentNumber ||
        d.title === record.documentNumber
    );
    setHistoryTarget({ record, doc: targetDoc });
  };

  return (
    <div className="space-y-6">
      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashboardCard
          title="เอกสารทั้งหมด"
          value={stats.total}
          icon={FileText}
          colorClass="from-indigo-500 to-indigo-600"
          onClick={() => setStatusFilter('ALL')}
          active={statusFilter === 'ALL'}
        />
        <DashboardCard
          title="ใกล้ครบกำหนดใน 30 วัน"
          sublabel="ครบกำหนดภายใน 30 วันข้างหน้า"
          value={stats.dueSoon}
          icon={Clock}
          colorClass="from-amber-400 to-orange-500"
          onClick={() => setStatusFilter(statusFilter === 'DUE_SOON' ? 'ALL' : 'DUE_SOON')}
          active={statusFilter === 'DUE_SOON'}
        />
        <DashboardCard
          title="เกินกำหนด"
          sublabel="เลยกำหนดทบทวนแล้ว"
          value={stats.overdue}
          icon={AlertTriangle}
          colorClass="from-rose-500 to-red-600"
          onClick={() => setStatusFilter(statusFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
          active={statusFilter === 'OVERDUE'}
        />
        <DashboardCard
          title="ทบทวนแล้วเสร็จ"
          sublabel="ดำเนินการเสร็จสิ้นในรอบนี้"
          value={stats.completed}
          icon={CheckCircle}
          colorClass="from-emerald-500 to-teal-600"
          onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
          active={statusFilter === 'COMPLETED'}
        />
      </div>

      {/* Main Single Workspace Card */}
      <div className="card-surface overflow-hidden flex flex-col min-h-0 border border-slate-200 shadow-sm rounded-xl">
        {/* Category Tabs & Sub-status Filter Bar */}
        <div className="p-3 bg-[#FAFAFA] border-b border-[#E5E5E5] space-y-3">
          {/* Top row: Category Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategoryTab('INTERNAL');
                  setSelectedDept('ALL');
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  categoryTab === 'INTERNAL'
                    ? 'bg-[#0D99FF] text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FileText size={16} />
                <span>เอกสารภายใน (Internal)</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    categoryTab === 'INTERNAL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {internalRecords.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCategoryTab('EXTERNAL');
                  setSelectedDept('ALL');
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  categoryTab === 'EXTERNAL'
                    ? 'bg-[#0D99FF] text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <ExternalLink size={16} />
                <span>เอกสารภายนอก (External)</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    categoryTab === 'EXTERNAL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {externalRecords.length}
                </span>
              </button>
            </div>
          </div>

          {/* Sub row: Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[
              { id: 'ALL', label: 'ทั้งหมด' },
              { id: 'ACTION_REQUIRED', label: 'ต้องดำเนินการ (Due Soon / Overdue)' },
              { id: 'UPCOMING', label: 'ยังไม่ถึงกำหนด' },
              { id: 'COMPLETED', label: 'ดำเนินการแล้วเสร็จ' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 bg-white hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Department Filter */}
        <div className="p-3.5 border-b border-[#E5E5E5] flex flex-col sm:flex-row gap-3 justify-between items-center bg-white">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="ค้นหารหัสเอกสาร / ชื่อเอกสาร..."
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
              <option value="ALL">ทุกแผนก</option>
              {availableDepts.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full max-w-full scrollbar-thin">
          <table className="w-full text-left text-xs table-fixed border-collapse">
            <thead className="table-header sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E2E8F0] shadow-xs backdrop-blur-xs whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 w-36 font-mono bg-[#F8FAFC]">รหัสเอกสาร</th>
                <th className="px-4 py-3 bg-[#F8FAFC]">ชื่อเอกสาร</th>
                <th className="px-4 py-3 w-24 text-center bg-[#F8FAFC]">แผนก</th>
                <th className="px-4 py-3 w-24 text-center font-mono bg-[#F8FAFC]">ฉบับ (Rev)</th>
                <th className="px-4 py-3 w-32 text-center font-mono bg-[#F8FAFC]">ครบกำหนด</th>
                <th className="px-4 py-3 w-36 text-center bg-[#F8FAFC]">สถานะรอบ</th>
                <th className="px-4 py-3 w-48 text-center bg-[#F8FAFC]">จัดการ (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pagination.paginatedData.map(record => {
                const badge = getStatusBadgeConfig(record.status, record.hasActiveTask);
                return (
                  <tr key={record.id} className="hover:bg-[#F5F5F5]/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0D99FF] text-xs sm:text-sm whitespace-nowrap">
                      {record.documentNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 text-xs sm:text-sm break-all break-words min-w-0 [overflow-wrap:anywhere] leading-relaxed">
                      {record.documentName}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-600 text-xs">
                      {record.ownerDepartmentId}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-700 text-xs">
                      Rev.{record.rev || '00'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-600 text-xs whitespace-nowrap">
                      {formatQmsDisplayDate(record.nextReviewDate)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleNavigateRecord(record)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0D99FF] hover:bg-[#007BE5] text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                          title="บันทึกผลการทบทวน"
                        >
                          <RotateCw size={13} />
                          <span>บันทึกผล</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(record)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          title="ดูประวัติการทบทวน"
                        >
                          <Eye size={13} />
                          <span>ประวัติ</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pagination.paginatedData.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-xs text-slate-600">ไม่พบเอกสารที่ตรงกับเงื่อนไขการค้นหา</p>
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

      {/* Review History Modal */}
      <ReviewHistoryModal
        isOpen={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        record={historyTarget?.record}
        doc={historyTarget?.doc}
        onNavigateRecord={handleNavigateRecord}
      />
    </div>
  );
};

const PeriodicReviewDashboard = () => {
  const { currentUser, periodicReviewSchedules, documents, externalDocuments, tasks, simulatedSystemDate, getEffectiveToday } = useStore();
  const canSeeAll = canViewAllPeriodicReviews(currentUser);
  const [view, setView] = useState(canSeeAll ? 'CONTROL_BOARD' : 'OWNER_DEPT');

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
      const docCode = String(doc.doc_code || doc.code || doc.document_number || doc.title || doc.docNo || docIdStr);
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
        ownerUserId: doc.ownerId || doc.owner_id || doc.owner || 'U002',
        ownerDepartmentId: docDept,
        responsibleUserId: doc.ownerId || doc.owner_id || doc.owner || 'U002',
        currentScheduledReviewDate: nextReviewDate,
        nextReviewDate: nextReviewDate,
        rev: doc.revision || doc.rev || doc.revNo || doc.edition || '00',
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
    () => {
      const records = getVisiblePeriodicReviews(currentUser, effectiveSchedules, allDocs, effectiveToday);
      return records.map(r => {
        const isExternal =
          r.documentCategory === 'EXTERNAL' ||
          Boolean(r.externalDocumentId) ||
          (externalDocuments || []).some(
            ed => ed.id === r.documentId || ed.id === r.externalDocumentId || ed.document_number === r.documentNumber
          );
        const targetDoc = allDocs.find(
          d =>
            d.id === r.documentId ||
            d.id === r.externalDocumentId ||
            d.doc_code === r.documentNumber ||
            d.document_number === r.documentNumber ||
            d.title === r.documentNumber
        );
        return {
          ...r,
          isExternal,
          documentCategory: isExternal ? 'EXTERNAL' : 'INTERNAL',
          rev: r.rev || targetDoc?.revision || targetDoc?.rev || targetDoc?.revNo || targetDoc?.edition || '00'
        };
      });
    },
    [currentUser, effectiveSchedules, allDocs, externalDocuments, effectiveToday]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1E1E1E] tracking-tight flex items-center gap-2">
            <RotateCw className="text-[#0D99FF]" size={24} /> การทบทวนเอกสารตามรอบ
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            {view === 'OWNER_DEPT' ? 'งานทบทวนเอกสารของแผนกฉัน' : 'ภาพรวมการทบทวนเอกสารทุกแผนก'}
          </p>
        </div>

        {canSeeAll && (
          <div className="bg-[#F5F5F5] p-1 rounded-xl flex items-center shadow-xs">
            <button
              onClick={() => setView('OWNER_DEPT')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                view === 'OWNER_DEPT'
                  ? 'bg-white text-[#007BE5] shadow-xs'
                  : 'text-slate-600 hover:text-[#1E1E1E]'
              }`}
            >
              งานของแผนกฉัน
            </button>
            <button
              onClick={() => setView('CONTROL_BOARD')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                view === 'CONTROL_BOARD'
                  ? 'bg-white text-[#007BE5] shadow-xs'
                  : 'text-slate-600 hover:text-[#1E1E1E]'
              }`}
            >
              ภาพรวมทุกแผนก
            </button>
          </div>
        )}
      </div>

      {view === 'OWNER_DEPT' ? (
        <UnifiedWorkspaceView visibleRecords={visibleRecords} allDocs={allDocs} effectiveToday={effectiveToday} />
      ) : (
        <PeriodicReviewControlBoard />
      )}
    </div>
  );
};

export default PeriodicReviewDashboard;
