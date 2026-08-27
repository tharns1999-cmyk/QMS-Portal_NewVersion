import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import { getDueStateLabel, getReviewStatusLabel } from '../../services/PeriodicReviewService';
import { TablePagination } from '../../components/common/TablePagination';
import { useTablePagination } from '../../hooks/useTablePagination';

const MasterReviewSchedule = () => {
  const navigate = useNavigate();
  const { periodicReviewSchedules } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const schedules = periodicReviewSchedules || [];

  const filteredSchedules = schedules.filter(s => {
    const matchesSearch = s.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.documentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || s.documentCategory === filterCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => new Date(a.currentScheduledReviewDate) - new Date(b.currentScheduledReviewDate));

  const pagination = useTablePagination(filteredSchedules, 10);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Master Review Schedule</h1>
        <p className="text-[#666666] mt-1 text-sm">ตารางทบทวนเอกสารทั้งหมด (DCC Master Schedule)</p>
      </div>

      <div className="bg-white rounded-xl shadow-2xs border border-[#E2E8F0] overflow-hidden flex flex-col min-h-0">
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="ค้นหา Document No. หรือชื่อเอกสาร..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#E2E8F0] rounded-xl focus:ring-2 focus:ring-[#0D99FF]/20 focus:border-[#0D99FF] outline-none transition-all shadow-2xs bg-white text-sm"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <select 
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#0D99FF]/20 focus:border-[#0D99FF] shadow-2xs text-sm"
            >
              <option value="ALL">ทุกประเภท (All)</option>
              <option value="INTERNAL">เอกสารภายใน (Internal)</option>
              <option value="EXTERNAL">เอกสารภายนอก (External)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[560px] flex-1 scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E2E8F0] shadow-xs backdrop-blur-sm whitespace-nowrap">
              <tr>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 bg-[#F8FAFC]">Document No.</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 bg-[#F8FAFC]">Name</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 bg-[#F8FAFC]">Type</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 bg-[#F8FAFC]">Anchor Date</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 bg-[#F8FAFC]">Next Review</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 bg-[#F8FAFC]">Due State</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 bg-[#F8FAFC]">Status</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 bg-[#F8FAFC] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagination.paginatedData.length > 0 ? (
                pagination.paginatedData.map((schedule, i) => {
                  const dueLabel = getDueStateLabel(schedule.dueState);
                  const statusLabel = getReviewStatusLabel(schedule.status);
                  return (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      key={schedule.id} 
                      className="border-b border-slate-100 hover:bg-[#F8FAFC] transition-colors"
                    >
                      <td className="py-3 px-4 text-sm font-medium text-slate-800">{schedule.documentNumber}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate" title={schedule.documentName}>{schedule.documentName}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${schedule.documentCategory === 'INTERNAL' ? 'bg-indigo-100 text-[#007BE5]' : 'bg-emerald-100 text-emerald-700'}`}>
                          {schedule.documentCategory}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-[#666666]">{schedule.originalReviewAnchorDate}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-700">{schedule.currentScheduledReviewDate}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${dueLabel.color}`}>
                          {dueLabel.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusLabel.color}`}>
                          {statusLabel.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        <button 
                          onClick={() => navigate(`/periodic-reviews/${schedule.id}`)}
                          className="px-3 py-1 bg-white border border-[#E2E8F0] rounded-lg text-[#0D99FF] font-medium hover:bg-[#E5F4FF] transition-colors shadow-2xs text-xs cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-[#666666]">
                    <Calendar className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <p className="text-sm font-medium text-slate-600">ไม่พบข้อมูลตารางการทบทวน</p>
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

export default MasterReviewSchedule;
