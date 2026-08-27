import React, { useState } from 'react';
import { X, Download, ExternalLink, Sparkles, FileText, CheckCircle } from 'lucide-react';
import { UniversalWatermarkService, WATERMARK_TYPES, WATERMARK_PRESETS } from '../../services/UniversalWatermarkService';
import toast from 'react-hot-toast';

export const WatermarkStudioModal = ({
  isOpen = false,
  onClose = () => {},
  document: doc = { title: 'WI-PD-001', name: 'ขั้นตอนการล้างทำความสะอาดเครื่องผสม', rev: '01', department: 'PD', effectiveDate: '2026-08-01', status: 'EFFECTIVE' },
  currentUser = { name: 'ธนาวุฒิ สมควรกิจดำรง', department: 'PD', isDcc: false }
}) => {
  const [selectedType, setSelectedType] = useState(WATERMARK_TYPES.UNCONTROLLED_COPY);
  const [copyNo, setCopyNo] = useState('02');
  const [locationName, setLocationName] = useState('Line 1 - Mixing (ห้องผสม)');
  const [authorizedScope, setAuthorizedScope] = useState('External Auditor ISO 9001');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async (openInTab = false) => {
    setIsGenerating(true);
    try {
      await UniversalWatermarkService.downloadWatermarkedPdf(doc, selectedType, {
        userName: currentUser.name,
        userDept: currentUser.department || currentUser.dept || 'PD',
        dccName: currentUser.isDcc ? currentUser.name : 'Admin QA (DCC)',
        copyNo,
        location: locationName,
        authorizedScope,
        effectiveDate: doc.effectiveDate,
        status: selectedType === WATERMARK_TYPES.OBSOLETE ? 'OBSOLETE' : (doc.status || 'ACTIVE')
      }, openInTab);

      toast.success(openInTab ? 'เปิดเอกสาร PDF พร้อมลายน้ำในแท็บใหม่สำเร็จ' : `ดาวน์โหลดไฟล์ PDF (${selectedType}) สำเร็จ`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast.error('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const presetOptions = [
    { type: WATERMARK_TYPES.UNCONTROLLED_COPY, label: '1. Uncontrolled Copy (User Download)', color: 'border-orange-400 bg-orange-50 text-orange-950' },
    { type: WATERMARK_TYPES.OFFICIAL_MASTER_COPY, label: '2. Official Master Copy (DCC Archive)', color: 'border-blue-400 bg-[#E5F4FF] text-blue-950' },
    { type: WATERMARK_TYPES.STRICTLY_CONFIDENTIAL, label: '3. Strictly Confidential (External Release)', color: 'border-rose-400 bg-rose-50 text-rose-950' },
    { type: WATERMARK_TYPES.CONTROLLED_COPY, label: '4. Controlled Copy (DCC Distribution - Issue 01)', color: 'border-emerald-400 bg-emerald-50 text-emerald-950' },
    { type: WATERMARK_TYPES.CONTROLLED_COPY_REPLACEMENT, label: '5. Controlled Copy Replacement (Issue 02+)', color: 'border-amber-400 bg-amber-50 text-amber-950' },
    { type: WATERMARK_TYPES.OBSOLETE, label: '6. Obsolete - Do Not Use (ยกเลิก/ตกรุ่น)', color: 'border-red-500 bg-red-50 text-red-950' },
    { type: WATERMARK_TYPES.DRAFT, label: '7. Draft / Under Review (ฉบับร่าง DAR)', color: 'border-yellow-400 bg-yellow-50 text-yellow-950' }
  ];

  return (
    <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-stone-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-8 pt-8 pb-5 bg-white border-b border-stone-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#f9f8f6] rounded-xl border border-stone-200 text-[#b87c33] shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-xl sm:text-2xl text-[#2d2d2d] tracking-tight">Watermark Studio & PDF Downloader</h3>
              <p className="text-sm text-stone-500 mt-1">สร้างและดาวน์โหลดไฟล์ PDF จริง พร้อมประทับลายน้ำ 45 องศา (Client-Side 100%)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-[#2d2d2d] hover:bg-stone-50 transition-colors focus:ring-2 focus:ring-[#da7756]/20 outline-none"
            title="ปิดหน้าต่าง"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto bg-[#f9f8f6]">
          
          {/* Target Document Summary */}
          <div className="p-4 bg-white rounded-xl border border-stone-200 flex items-center justify-between text-sm shadow-sm">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-[#4a724b] shrink-0" />
              <div>
                <span className="font-bold text-[#2d2d2d] text-base">[{doc.title}] {doc.name}</span>
                <p className="text-stone-500 text-sm mt-0.5 font-mono">Rev: {doc.rev} • Dept: {doc.department} • Eff: {doc.effectiveDate || '-'}</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#f9f8f6] border border-stone-200 text-[#4a724b] font-bold text-xs shrink-0">
              {doc.status || 'EFFECTIVE'}
            </span>
          </div>

          {/* Preset Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-3 uppercase tracking-widest">
              เลือกรูปแบบลายน้ำดิจิทัล (Select Watermark Preset):
            </label>
            <div className="grid grid-cols-1 gap-3">
              {presetOptions.map((opt) => {
                const isSelected = selectedType === opt.type;
                // Simplified color mapping for Claude aesthetic
                let aestheticColor = '';
                if (opt.type === WATERMARK_TYPES.UNCONTROLLED_COPY) aestheticColor = 'border-[#da7756] bg-[#f9f8f6] text-[#da7756]';
                else if (opt.type === WATERMARK_TYPES.OFFICIAL_MASTER_COPY) aestheticColor = 'border-[#4a724b] bg-[#f9f8f6] text-[#4a724b]';
                else if (opt.type === WATERMARK_TYPES.STRICTLY_CONFIDENTIAL) aestheticColor = 'border-[#a94442] bg-[#f5e6e6] text-[#a94442]';
                else if (opt.type === WATERMARK_TYPES.CONTROLLED_COPY) aestheticColor = 'border-[#4a724b] bg-[#f9f8f6] text-[#4a724b]';
                else if (opt.type === WATERMARK_TYPES.CONTROLLED_COPY_REPLACEMENT) aestheticColor = 'border-[#b87c33] bg-[#f9f8f6] text-[#b87c33]';
                else if (opt.type === WATERMARK_TYPES.OBSOLETE) aestheticColor = 'border-[#a94442] bg-[#f5e6e6] text-[#a94442]';
                else if (opt.type === WATERMARK_TYPES.DRAFT) aestheticColor = 'border-stone-400 bg-[#f9f8f6] text-stone-600';

                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setSelectedType(opt.type)}
                    className={`p-4 rounded-xl border text-left text-sm font-bold flex items-center justify-between transition-all focus:outline-none ${
                      isSelected
                        ? `${aestheticColor} ring-4 shadow-sm border-2`
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'
                    }`}
                    style={isSelected ? { '--tw-ring-color': 'rgba(218, 119, 86, 0.1)' } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-current bg-current text-white' : 'border-stone-300 bg-white'
                      }`}>
                        {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                      </div>
                      <span className={isSelected ? 'font-bold' : ''}>{opt.label}</span>
                    </div>
                    <span className={`text-xs font-mono ${isSelected ? 'text-current opacity-80' : 'text-stone-400'}`}>
                      Opacity: {WATERMARK_PRESETS[opt.type]?.opacity}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional Options */}
          {(selectedType === WATERMARK_TYPES.CONTROLLED_COPY || selectedType === WATERMARK_TYPES.CONTROLLED_COPY_REPLACEMENT) && (
            <div className="p-5 bg-white rounded-xl border border-stone-200 grid grid-cols-2 gap-4 text-sm shadow-sm mt-4">
              <div>
                <label className="block font-bold text-[#2d2d2d] mb-1.5">หมายเลขสำเนา (Copy No.):</label>
                <input
                  type="text"
                  value={copyNo}
                  onChange={(e) => setCopyNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg focus:ring-4 focus:ring-[#da7756]/10 focus:border-[#da7756] outline-none transition-all font-mono"
                  placeholder="02"
                />
              </div>
              <div>
                <label className="block font-bold text-[#2d2d2d] mb-1.5">จุดใช้งาน / สถานี (Location):</label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg focus:ring-4 focus:ring-[#da7756]/10 focus:border-[#da7756] outline-none transition-all"
                  placeholder="Line 1 - Mixing"
                />
              </div>
            </div>
          )}

          {selectedType === WATERMARK_TYPES.STRICTLY_CONFIDENTIAL && (
            <div className="p-5 bg-white rounded-xl border border-stone-200 text-sm shadow-sm mt-4">
              <label className="block font-bold text-[#2d2d2d] mb-1.5">ขอบเขตผู้รับเอกสารภายนอก (Authorized Scope / Recipient):</label>
              <input
                type="text"
                value={authorizedScope}
                onChange={(e) => setAuthorizedScope(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg focus:ring-4 focus:ring-[#a94442]/10 focus:border-[#a94442] outline-none transition-all"
                placeholder="Global Auditor ISO 9001 / Partner Co."
              />
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-8 py-5 bg-white border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-stone-500 text-center sm:text-left flex items-center gap-2">
            <span className="text-lg">🎯</span> สร้างไฟล์ A4 แบบเต็มรูปแบบ พร้อมประทับข้อความเอียง 45°
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleDownload(true)}
              disabled={isGenerating}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 text-sm font-bold flex items-center justify-center gap-2 transition-colors focus:ring-4 focus:ring-stone-200 outline-none"
            >
              <ExternalLink className="w-4 h-4" />
              เปิดดูในแท็บใหม่
            </button>

            <button
              type="button"
              onClick={() => handleDownload(false)}
              disabled={isGenerating}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#da7756] hover:bg-[#c96646] active:scale-[0.99] text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 focus:ring-4 focus:ring-[#da7756]/20 outline-none"
            >
              <Download className="w-4 h-4" />
              {isGenerating ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF ทันที'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default WatermarkStudioModal;
