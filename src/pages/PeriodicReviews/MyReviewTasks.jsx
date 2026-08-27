import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import { getDueStateLabel } from '../../services/PeriodicReviewService';

const MyReviewTasks = () => {
  const navigate = useNavigate();
  const { periodicReviewTasks, currentUser } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  
  const tasks = periodicReviewTasks || [];
  
  // Filter for my active tasks
  const myTasks = tasks.filter(t => 
    t.status === 'ACTION_REQUIRED' && 
    t.assignedToUserId === currentUser.id
  ).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const filteredTasks = myTasks.filter(t => 
    t.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.documentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 w-full max-w-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">My Review Tasks</h1>
        <p className="text-[#666666] mt-1 text-xs sm:text-sm">งานทบทวนเอกสารตามรอบที่รอการจัดการของคุณ</p>
      </div>

      <div className="w-full bg-white rounded-xl shadow-2xs border border-[#E5E5E5] overflow-hidden flex flex-col h-auto">
        <div className="p-4 border-b border-[#E5E5E5] bg-[#F5F5F5] flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="ค้นหาชื่องาน หรือ Document No..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#E5E5E5] rounded-xl focus:ring-2 focus:ring-[#0D99FF]/20 focus:border-indigo-500 outline-none transition-all shadow-sm text-xs sm:text-sm"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 bg-white px-4 py-2 rounded-xl border border-[#E5E5E5] shadow-sm">
            <Clock size={16} className="text-indigo-500" />
            Total Tasks: <span className="font-bold text-slate-800 bg-[#F5F5F5] px-2 py-0.5 rounded-full font-mono">{myTasks.length}</span>
          </div>
        </div>

        <div className="p-4 bg-[#F5F5F5]/50 h-auto">
          <AnimatePresence>
            {filteredTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTasks.map((task, i) => {
                  const dueLabel = getDueStateLabel(task.dueState);
                  const isOverdue = task.dueState === 'OVERDUE' || task.dueState === 'ESCALATED';
                  
                  return (
                    <motion.div
                      layoutId={`task-${task.id}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                      key={task.id}
                      onClick={() => navigate(`/periodic-reviews/${task.scheduleId}`)}
                      className="bg-white p-5 rounded-xl border border-[#E5E5E5] shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-indigo-300 group flex flex-col"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${task.documentCategory === 'INTERNAL' ? 'bg-indigo-100 text-[#007BE5]' : 'bg-emerald-100 text-emerald-700'}`}>
                          {task.documentCategory}
                        </span>
                        {isOverdue && <AlertCircle size={18} className="text-red-500 animate-pulse" />}
                      </div>
                      
                      <h3 className="font-bold text-slate-800 text-base sm:text-lg mb-1 group-hover:text-[#0D99FF] transition-colors">
                        {task.documentNumber}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#666666] mb-4 line-clamp-2 flex-1">
                        {task.documentName}
                      </p>
                      
                      <div className="pt-4 border-t border-slate-100 mt-auto flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400 font-medium">DUE DATE</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-700 font-mono">{task.dueDate}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${dueLabel.color}`}>
                          {dueLabel.label}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="py-14 px-4 flex flex-col items-center justify-center text-[#666666]">
                <CheckCircle className="w-12 h-12 text-[#CCCCCC] mb-3" strokeWidth={1.5} />
                <p className="text-sm font-bold text-slate-700">ไม่มีงานที่ต้องดำเนินการ</p>
                <p className="text-xs text-slate-400 mt-0.5">คุณจัดการงานทบทวนเอกสารตามรอบครบหมดแล้ว</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default MyReviewTasks;
