import React from 'react';
import { PackageOpen } from 'lucide-react';

const EmptyState = ({ message = "ไม่พบรายการข้อมูลที่เกี่ยวข้อง", icon: Icon = PackageOpen }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="bg-slate-100/80 rounded-2xl p-4 mb-3 text-slate-400">
        <Icon className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
      </div>
      <p className="text-slate-700 font-bold text-sm">{message}</p>
      <p className="text-slate-400 text-xs mt-0.5">
        ยังไม่มีข้อมูลที่ต้องแสดงผลในขณะนี้
      </p>
    </div>
  );
};

export default EmptyState;
