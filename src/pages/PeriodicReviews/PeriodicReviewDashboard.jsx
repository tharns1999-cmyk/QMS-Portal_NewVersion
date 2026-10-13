import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Check,
  FileText,
  Search,
  Filter,
  RotateCw,
  Eye,
  History,
  X,
  ExternalLink,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import useStore from '../../store/useStore';
import { getVisiblePeriodicReviews, normalizePeriodicReviewRecord, canExportPeriodicReviews } from '../../services/PeriodicReviewAccessService';
import { getDueState, getReviewStatusLabel, getReviewOutcomeLabel } from '../../services/PeriodicReviewService';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';
import { formatQmsDisplayDate } from '../../utils/dateFormatter';
import { getDocumentReviewMetrics, isDocumentReviewedThisCycle, evaluateDocumentReviewStatus } from '../../utils/documentUtils';
import { PeriodicReviewAuditCard } from '../../components/workflow/PeriodicReviewHistoryTab';

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

const getStatusBadgeConfig = (status, hasActiveTask, isPendingApproval, isReviewed) => {
  if (isReviewed) {
    return {
      label: '✔️ ทบทวนแล้วเสร็จ',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  }
  if (status === 'PENDING_APPROVAL' || isPendingApproval) {
    return {
      label: '⏳ รออนุมัติผล',
      cls: 'bg-amber-50 text-amber-800 border-amber-200'
    };
  }
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

const ReviewHistoryModal = ({ isOpen, onClose, record, doc, effectiveToday, onNavigateRecord }) => {
  const isReviewedThisCycle = isDocumentReviewedThisCycle(record, effectiveToday) || (doc && isDocumentReviewedThisCycle(doc, effectiveToday));
  const reviewHistory = useMemo(() => {
    const list = [];
    if (doc?.periodic_reviews && Array.isArray(doc.periodic_reviews) && doc.periodic_reviews.length > 0) {
      list.push(...doc.periodic_reviews);
    } else if (doc?.review_history && Array.isArray(doc.review_history) && doc.review_history.length > 0) {
      list.push(...doc.review_history);
    } else if (record?.reviewLogs && Array.isArray(record.reviewLogs)) {
      list.push(...record.reviewLogs);
    }
    return list;
  }, [doc, record]);

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
                  <PeriodicReviewAuditCard key={item.id || idx} item={item} index={idx} />
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
          {isReviewedThisCycle ? (
            <button
              disabled
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-400 text-xs font-semibold rounded-xl cursor-not-allowed"
              title="เอกสารผ่านการทบทวนรอบปีนี้เรียบร้อยแล้ว"
            >
              <Check size={13} className="text-emerald-500" />
              <span>ทบทวนแล้ว</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateRecord(record);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0D99FF] hover:bg-[#007BE5] text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <RotateCw size={13} />
              <span>บันทึกผลการทบทวนรอบนี้</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const UnifiedWorkspaceView = ({ 
  visibleRecords = [], 
  allDocs = [], 
  effectiveToday: propEffectiveToday,
  viewScope = 'MY_DEPT',
  setViewScope,
  selectedDeptFilter = 'ALL',
  setSelectedDeptFilter,
  isManagementOrDcc = false
}) => {
  const navigate = useNavigate();
  const { currentUser, simulatedSystemDate, getEffectiveToday } = useStore();
  const effectiveToday = propEffectiveToday || (getEffectiveToday ? getEffectiveToday() : (simulatedSystemDate ? new Date(simulatedSystemDate) : new Date()));

  const [categoryTab, setCategoryTab] = useState('INTERNAL'); // 'INTERNAL' | 'EXTERNAL'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTION_REQUIRED' | 'DUE_SOON' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({
    key: 'next_review_date',
    direction: 'asc' // ค่าเริ่มต้น: ใกล้สุดขึ้นก่อน
  });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // History Modal State
  const [historyTarget, setHistoryTarget] = useState(null);

  const getRecordDept = (r) => r.ownerDepartmentId || r.targetDoc?.department || r.targetDoc?.owner_dept || r.department;

  // Scoped records based on viewScope and selectedDeptFilter
  const scopedRecords = useMemo(() => {
    return visibleRecords.filter(r => {
      const dept = getRecordDept(r);

      // Non-management: restricted to their department / managed departments
      if (!isManagementOrDcc) {
        const userDept = currentUser?.department || currentUser?.dept || currentUser?.primary_department;
        const permitted = new Set([
          userDept,
          ...(currentUser?.depts || []),
          ...(currentUser?.departments || []),
          ...(currentUser?.affiliated_departments || [])
        ].filter(Boolean));
        if (currentUser?.managedDepartments?.includes('*') || currentUser?.isDcc) return true;
        if (Array.isArray(currentUser?.managedDepartments)) {
          currentUser.managedDepartments.forEach(d => permitted.add(d));
        }
        return permitted.has(dept);
      }

      // If user selected "MY_DEPT"
      if (viewScope === 'MY_DEPT') {
        const userDept = currentUser?.department || currentUser?.dept || currentUser?.primary_department;
        return dept === userDept;
      }

      // If user selected "ALL" but specified a department in the dropdown
      if (selectedDeptFilter !== 'ALL') {
        return dept === selectedDeptFilter;
      }

      // If user selected "ALL" and dropdown is "ALL"
      return true;
    });
  }, [visibleRecords, isManagementOrDcc, viewScope, selectedDeptFilter, currentUser]);

  // Split scoped records into Internal & External categories
  const internalRecords = useMemo(
    () => scopedRecords.filter(r => !r.isExternal),
    [scopedRecords]
  );

  const externalRecords = useMemo(
    () => scopedRecords.filter(r => r.isExternal),
    [scopedRecords]
  );

  const currentCategoryList = useMemo(
    () => (categoryTab === 'INTERNAL' ? internalRecords : externalRecords),
    [categoryTab, internalRecords, externalRecords]
  );

  // Available departments for the user/dropdown
  const availableDepts = useMemo(() => {
    const depts = new Set();
    visibleRecords.forEach(r => {
      const d = getRecordDept(r);
      if (d) depts.add(d);
    });
    if (currentUser?.department) depts.add(currentUser.department);
    return Array.from(depts).filter(Boolean).sort();
  }, [visibleRecords, currentUser]);

  // KPI Metrics computed for the currently selected Category Tab using MECE helper
  const stats = useMemo(() => {
    return getDocumentReviewMetrics(currentCategoryList, effectiveToday);
  }, [currentCategoryList, effectiveToday]);

  // Filtered records for the Table
  const filteredRecords = useMemo(() => {
    let result = currentCategoryList;

    // Status filter
    if (statusFilter === 'ACTION_REQUIRED') {
      result = result.filter(r => {
        const ev = evaluateDocumentReviewStatus(r, effectiveToday);
        const st = typeof ev === 'object' ? ev.status : ev;
        return st === 'OVERDUE' || st === 'DUE_SOON' || r.hasActiveTask;
      });
    } else if (statusFilter === 'DUE_SOON') {
      result = result.filter(r => {
        const ev = evaluateDocumentReviewStatus(r, effectiveToday);
        const st = typeof ev === 'object' ? ev.status : ev;
        return st === 'DUE_SOON' || ((['DUE_SOON', 'DUE'].includes(r.status) || r.hasActiveTask) && r.status !== 'OVERDUE');
      });
    } else if (statusFilter === 'UPCOMING') {
      result = result.filter(r => {
        const ev = evaluateDocumentReviewStatus(r, effectiveToday);
        const st = typeof ev === 'object' ? ev.status : ev;
        return st === 'UP_TO_DATE' && !r.hasActiveTask;
      });
    } else if (statusFilter === 'OVERDUE') {
      result = result.filter(r => {
        const ev = evaluateDocumentReviewStatus(r, effectiveToday);
        const st = typeof ev === 'object' ? ev.status : ev;
        return st === 'OVERDUE';
      });
    } else if (statusFilter === 'COMPLETED') {
      result = result.filter(r => {
        const ev = evaluateDocumentReviewStatus(r, effectiveToday);
        const st = typeof ev === 'object' ? ev.status : ev;
        return st === 'COMPLETED';
      });
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
  }, [currentCategoryList, statusFilter, searchTerm, effectiveToday]);

  const sortedDocuments = useMemo(() => {
    const list = [...filteredRecords];

    list.sort((a, b) => {
      if (sortConfig.key === 'next_review_date') {
        const dateA = a.nextReviewDate || a.next_review_date || a.currentScheduledReviewDate;
        const dateB = b.nextReviewDate || b.next_review_date || b.currentScheduledReviewDate;
        const timeA = dateA ? new Date(dateA).getTime() : null;
        const timeB = dateB ? new Date(dateB).getTime() : null;

        const validTimeA = timeA && !isNaN(timeA) ? timeA : null;
        const validTimeB = timeB && !isNaN(timeB) ? timeB : null;

        // เอกสารที่ไม่มีวันครบกำหนดจะถูกจัดไปอยู่ท้ายสุดของตารางเสมอ
        if (validTimeA === null && validTimeB === null) return 0;
        if (validTimeA === null) return 1;
        if (validTimeB === null) return -1;
        if (validTimeA === validTimeB) return 0;

        return sortConfig.direction === 'asc' ? validTimeA - validTimeB : validTimeB - validTimeA;
      }

      return 0;
    });

    return list;
  }, [filteredRecords, sortConfig]);

  const pagination = useTablePagination(sortedDocuments, 10);

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
                  if (setSelectedDeptFilter) setSelectedDeptFilter('ALL');
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
                  if (setSelectedDeptFilter) setSelectedDeptFilter('ALL');
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
              aria-label="กรองตามแผนก"
              value={selectedDeptFilter}
              onChange={(e) => {
                const newDept = e.target.value;
                if (setSelectedDeptFilter) {
                  setSelectedDeptFilter(newDept);
                }
                if (newDept === 'ALL' && setViewScope) {
                  setViewScope('ALL');
                } else if (newDept !== currentUser?.department && setViewScope) {
                  setViewScope('ALL');
                }
              }}
              className="border border-[#E5E5E5] rounded-xl text-xs px-3 py-2 w-full sm:w-48 bg-[#F5F5F5] focus:bg-white focus:outline-none focus:border-[#0D99FF] font-medium cursor-pointer"
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
                <th
                  scope="col"
                  onClick={() => handleSort('next_review_date')}
                  className="px-4 py-3 w-32 text-center font-mono bg-[#F8FAFC] cursor-pointer select-none hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>ครบกำหนด</span>
                    <span className="text-slate-400 group-hover:text-slate-700">
                      {sortConfig.key === 'next_review_date' ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-sky-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
                      )}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 w-36 text-center bg-[#F8FAFC]">สถานะรอบ</th>
                <th className="px-4 py-3 w-48 text-center bg-[#F8FAFC]">จัดการ (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pagination.paginatedData.map(record => {
                const targetDoc = record.targetDoc || allDocs?.find(d => 
                  (record.documentId && d.id === record.documentId) || 
                  (record.externalDocumentId && d.id === record.externalDocumentId) ||
                  (record.documentNumber && (d.documentNumber === record.documentNumber || d.code === record.documentNumber || d.doc_code === record.documentNumber))
                );
                const isPendingApproval = record.status === 'PENDING_APPROVAL' || targetDoc?.review_status === 'PENDING_APPROVAL';
                const docToEvaluate = targetDoc ? { ...targetDoc, ...record } : record;
                const evaluation = evaluateDocumentReviewStatus(docToEvaluate, effectiveToday);
                const calculatedStatus = typeof evaluation === 'object' ? evaluation.status : evaluation;
                const isReviewed = calculatedStatus === 'COMPLETED';
                const effectiveStatus = (calculatedStatus === 'OVERDUE' || calculatedStatus === 'DUE_SOON' || calculatedStatus === 'COMPLETED')
                  ? calculatedStatus
                  : (record.status === 'PENDING_APPROVAL' || record.status === 'IN_PROGRESS' ? record.status : calculatedStatus || record.status);
                const badge = getStatusBadgeConfig(effectiveStatus, record.hasActiveTask, isPendingApproval, isReviewed);
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
                      {isReviewed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ทบทวนแล้วเสร็จ</span>
                        </span>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {isReviewed ? (
                          <button
                            disabled
                            className="px-2.5 py-1 text-xs text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed inline-flex items-center gap-1"
                            title="เอกสารผ่านการทบทวนรอบปีนี้เรียบร้อยแล้ว"
                          >
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>ทบทวนแล้ว</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleNavigateRecord(record)}
                            disabled={isPendingApproval}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-2xs ${
                              isPendingApproval
                                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                : 'bg-[#0D99FF] hover:bg-[#007BE5] text-white cursor-pointer'
                            }`}
                            title={isPendingApproval ? 'อยู่ระหว่างรอหัวหน้าแผนกอนุมัติผล' : 'บันทึกผลการทบทวน'}
                          >
                            <RotateCw size={13} />
                            <span>บันทึกผล</span>
                          </button>
                        )}
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
        effectiveToday={effectiveToday}
        onNavigateRecord={handleNavigateRecord}
      />
    </div>
  );
};

const PeriodicReviewDashboard = () => {
  const { currentUser, periodicReviewSchedules, documents, externalDocuments, tasks, simulatedSystemDate, getEffectiveToday } = useStore();

  const isDccUser = Boolean(
    currentUser?.role === 'DCC' ||
    currentUser?.role === 'DCC_ADMIN' ||
    currentUser?.isDcc ||
    currentUser?.is_dcc
  );

  const isManagementOrDcc = Boolean(
    isDccUser ||
    Number(currentUser?.level) >= 5 || 
    Number(currentUser?.approval_level) >= 5 ||
    currentUser?.is_hod || 
    currentUser?.is_manager ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'QMR' ||
    (Array.isArray(currentUser?.managedDepartments) && currentUser?.managedDepartments.includes('*'))
  );

  // default: หากเป็น DCC ให้เริ่มที่ 'ALL', หากเป็นผู้ใช้ทั่วไปให้เริ่มที่ 'MY_DEPT'
  const [viewScope, setViewScope] = useState(isDccUser ? 'ALL' : 'MY_DEPT');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');

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
        lastReviewedDate: doc.last_reviewed_at,
        last_reviewed_at: doc.last_reviewed_at,
        periodic_reviews: doc.periodic_reviews,
        is_reviewed_this_cycle: doc.is_reviewed_this_cycle,
        targetDoc: doc,
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
      const records = isManagementOrDcc
        ? effectiveSchedules.map(s => normalizePeriodicReviewRecord(s, effectiveToday))
        : getVisiblePeriodicReviews(currentUser, effectiveSchedules, allDocs, effectiveToday);

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
          targetDoc,
          isExternal,
          documentCategory: isExternal ? 'EXTERNAL' : 'INTERNAL',
          rev: r.rev || targetDoc?.revision || targetDoc?.rev || targetDoc?.revNo || targetDoc?.edition || '00',
          nextReviewDate: targetDoc?.next_review_date || r.nextReviewDate || r.currentScheduledReviewDate,
          currentScheduledReviewDate: targetDoc?.next_review_date || r.currentScheduledReviewDate || r.nextReviewDate,
          next_review_date: targetDoc?.next_review_date || r.nextReviewDate || r.currentScheduledReviewDate,
          lastReviewedDate: r.lastReviewedDate || targetDoc?.last_reviewed_at,
          last_reviewed_at: r.lastReviewedDate || targetDoc?.last_reviewed_at,
          periodic_reviews: targetDoc?.periodic_reviews || r.periodic_reviews,
          is_reviewed_this_cycle: r.is_reviewed_this_cycle || targetDoc?.is_reviewed_this_cycle
        };
      });
    },
    [currentUser, effectiveSchedules, allDocs, externalDocuments, effectiveToday, isManagementOrDcc]
  );

  const handleExportCsv = () => {
    if (!canExportPeriodicReviews(currentUser)) return;
    const rows = [
      ['เลขที่เอกสาร', 'ชื่อเอกสาร', 'ฉบับที่ (Rev)', 'ประเภทเอกสาร', 'แผนกเจ้าของเอกสาร', 'เจ้าของเอกสาร', 'วันที่บังคับใช้', 'วันที่ทบทวนล่าสุด', 'วันที่ครบกำหนด', 'สถานะการทบทวน', 'ผลการทบทวน', 'ผู้ทบทวน', 'วันที่ดำเนินการ', 'เลขที่ DAR ที่เชื่อมโยง', 'จำนวนวันเกินกำหนด']
    ];
    visibleRecords.forEach(r => {
      rows.push([
        r.documentNumber || '',
        r.documentName || '',
        r.rev || '',
        r.documentCategory || '',
        r.ownerDepartmentId || '',
        r.ownerUserId || '',
        r.originalReviewAnchorDate || '',
        r.lastReviewedDate || '',
        r.nextReviewDate || '',
        getReviewStatusLabel(r.status)?.label || '',
        getReviewOutcomeLabel(r.outcome)?.label || '',
        '',
        r.updatedAt || '',
        r.linkedActionId || '',
        r.overdueDays || 0
      ]);
    });
    const csvContent = "\uFEFF" + rows.map(e => e.map(cell => `"${(cell||'').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `periodic_reviews_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1E1E1E] tracking-tight flex items-center gap-2">
            <RotateCw className="text-[#0D99FF]" size={24} /> การทบทวนเอกสารตามรอบ
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            {viewScope === 'MY_DEPT' ? 'งานทบทวนเอกสารของแผนกฉัน' : 'ภาพรวมการทบทวนเอกสารทุกแผนก'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isManagementOrDcc && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setViewScope('MY_DEPT');
                  setSelectedDeptFilter(currentUser?.department || 'ALL');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  viewScope === 'MY_DEPT'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                งานของแผนกฉัน{currentUser?.department ? ` (${currentUser.department})` : ''}
              </button>

              <button
                onClick={() => {
                  setViewScope('ALL');
                  setSelectedDeptFilter('ALL');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  viewScope === 'ALL'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                ภาพรวมทุกแผนก
              </button>
            </div>
          )}

          {canExportPeriodicReviews(currentUser) && (
            <div className="flex flex-col items-end gap-0.5">
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E5E5] text-slate-700 rounded-lg hover:bg-[#F5F5F5] text-xs font-medium transition-colors shadow-xs cursor-pointer"
              >
                <Download size={14} /> ส่งออก CSV
              </button>
              <span className="text-[10px] text-slate-400">สามารถเปิดด้วย Microsoft Excel ได้</span>
            </div>
          )}
        </div>
      </div>

      <UnifiedWorkspaceView
        visibleRecords={visibleRecords}
        allDocs={allDocs}
        effectiveToday={effectiveToday}
        viewScope={viewScope}
        setViewScope={setViewScope}
        selectedDeptFilter={selectedDeptFilter}
        setSelectedDeptFilter={setSelectedDeptFilter}
        isManagementOrDcc={isManagementOrDcc}
      />
    </div>
  );
};

export default PeriodicReviewDashboard;
