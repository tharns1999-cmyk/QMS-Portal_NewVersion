import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';
import { FileText, CheckCircle, ChevronLeft, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const TaskRevise = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tasks, dars, resubmitDar, currentUser } = useStore();
  
  const task = tasks.find(t => t.id === id);
  const dar = task ? dars.find(d => d.id === task.darId) : null;

  const [formData, setFormData] = useState({
    title: dar?.title || '',
    requestDetail: dar?.requestDetail || '',
    changeSummary: dar?.changeSummary || '',
  });

  if (!task || !dar) {
    return <div className="p-6 text-[#666666] font-medium">ไม่พบรายการงานที่ระบุ</div>;
  }

  if (task.assigneeId !== currentUser.id) {
    return <div className="p-6 text-rose-600 font-medium">คุณไม่มีสิทธิ์เข้าถึงงานนี้</div>;
  }

  const handleAction = () => {
    if (!formData.title) {
      toast.error('กรุณาระบุชื่อเอกสาร');
      return;
    }
    
    // Minimal mock resubmit data update
    resubmitDar(dar.id, formData, task.id);
    toast.success('ส่งกลับไปให้ Reviewer ตรวจสอบใหม่สำเร็จ');
    navigate('/tasks');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.2 }} 
      className="max-w-4xl mx-auto space-y-6 pb-12 w-full max-w-full overflow-hidden"
    >
      <button onClick={() => navigate('/tasks')} className="flex items-center text-xs font-bold text-slate-600 hover:text-[#0D99FF] transition-colors">
        <ChevronLeft size={16} /> กลับหน้า Inbox
      </button>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
          <FileText size={22} strokeWidth={1.75}/>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1E1E1E] tracking-tight">แก้ไขคำร้อง DAR: <span className="font-mono text-amber-600">{dar.id}</span></h2>
          <p className="text-xs text-[#666666] mt-0.5">แก้ไขรายละเอียดคำขอตามข้อเสนอแนะของผู้ทบทวนหรือผู้อนุมัติ</p>
        </div>
      </div>

      <div className="card-surface p-5 bg-amber-50/60 border-amber-200/80 flex items-start gap-4">
        <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700 shrink-0">
          <AlertCircle size={22} strokeWidth={1.75}/>
        </div>
        <div>
          <h3 className="font-bold text-sm text-amber-950 mb-1">เอกสารส่งกลับแก้ไข (Returned for Revision)</h3>
          <p className="text-amber-900 text-xs leading-relaxed">
            คำขอนี้ถูกส่งกลับมาให้คุณทำการแก้ไข กรุณาตรวจสอบความคิดเห็น (Comment) จาก Timeline แล้วแก้ไขข้อมูลให้ถูกต้องก่อนส่งกลับไปตรวจใหม่อีกครั้ง
          </p>
        </div>
      </div>

      <div className="card-surface p-6 space-y-5">
        <h3 className="font-bold text-sm text-[#1E1E1E] border-b border-slate-100 pb-2">แก้ไขข้อมูลคำร้อง (Edit DAR Information)</h3>
        
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อเอกสาร (Document Title) <span className="text-rose-500">*</span></label>
          <input 
            type="text" 
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            className="w-full input-primary text-xs"
            placeholder="ระบุชื่อเอกสาร..."
          />
        </div>

        {dar.type === 'NEW' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">รายละเอียดคำร้องขอ (Request Detail)</label>
            <textarea 
              rows="3"
              value={formData.requestDetail}
              onChange={(e) => setFormData({...formData, requestDetail: e.target.value})}
              className="w-full input-primary text-xs"
              placeholder="ระบุรายละเอียดเพิ่มเติม..."
            />
          </div>
        )}

        {dar.type === 'REVISION' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">สรุปการเปลี่ยนแปลง (Change Summary)</label>
            <textarea 
              rows="3"
              value={formData.changeSummary}
              onChange={(e) => setFormData({...formData, changeSummary: e.target.value})}
              className="w-full input-primary text-xs"
              placeholder="ระบุสรุปการเปลี่ยนแปลง..."
            />
          </div>
        )}

        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={handleAction}
            className="w-full btn-primary justify-center text-xs py-2.5"
          >
            <CheckCircle size={16} /> ส่งกลับไปทบทวนใหม่ (Resubmit for Review)
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default TaskRevise;
