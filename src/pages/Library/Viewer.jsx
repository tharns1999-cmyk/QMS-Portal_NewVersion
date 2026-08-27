import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import useStore from '../../store/useStore';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Sparkles, ExternalLink, ArrowLeft, ShieldAlert } from 'lucide-react';
import { UniversalWatermarkService, WATERMARK_TYPES } from '../../services/UniversalWatermarkService';
import WatermarkStudioModal from '../../components/workflow/WatermarkStudioModal';
import toast from 'react-hot-toast';
import { hasDocumentAccess } from '../../utils/accessControl';

const Viewer = () => {
  const { docId, rev } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isArchive = searchParams.get('archive') === 'true';
  const { documents, currentUser, canDownloadDocument } = useStore();
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  
  const doc = documents.find(d => d.id === docId);
  const title = doc ? doc.title : docId;
  const canDownload = doc && !isArchive ? canDownloadDocument(doc, currentUser) : false;

  // Access Control Guard
  if (doc && !hasDocumentAccess(doc, currentUser)) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl p-8 text-center border border-[#E5E5E5] space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
          <ShieldAlert size={36} />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-bold text-[#1E1E1E]">เอกสารนี้ถูกจำกัดสิทธิ์ (Access Restricted)</h2>
          <p className="text-xs text-[#666666] leading-relaxed">
            คุณไม่มีสิทธิ์ในการเข้าถึงหรือดูเนื้อหาเอกสารลับฉบับนี้ ({title}) หากต้องการเข้าถึงกรุณาติดต่อเจ้าของเอกสาร ({doc.department || 'ต้นสังกัด'}) หรือเจ้าหน้าที่ DCC
          </p>
        </div>
        <button
          onClick={() => navigate('/library')}
          className="btn-primary flex items-center gap-2 text-xs"
        >
          <ArrowLeft size={16} /> กลับสู่คลังเอกสาร
        </button>
      </div>
    );
  }

  const handleDownload = async (openInTab = false) => {
    if (!doc) return;
    try {
      const watermarkType = currentUser.isDcc ? WATERMARK_TYPES.OFFICIAL_MASTER_COPY : WATERMARK_TYPES.UNCONTROLLED_COPY;
      
      await UniversalWatermarkService.downloadWatermarkedPdf(doc, watermarkType, {
        userName: currentUser.name,
        userDept: currentUser.department || currentUser.dept || 'PD',
        effectiveDate: doc.effectiveDate
      }, openInTab);

      toast.success(openInTab ? 'เปิดเอกสาร PDF ในแท็บใหม่สำเร็จ' : `ดาวน์โหลดเอกสาร (${currentUser.isDcc ? 'Master' : 'Uncontrolled Copy'}) สำเร็จ`);
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการสร้าง PDF');
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-xl overflow-hidden shadow-none border border-slate-800 relative">
      {/* Viewer Toolbar */}
      <div className="bg-slate-800 text-slate-200 px-4 py-3 flex items-center justify-between border-b border-slate-700/80 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="font-bold text-sm md:text-base truncate max-w-[200px] md:max-w-md flex items-center gap-2">
            <span className="font-mono text-[#0D99FF]">{title}</span>
            <span className="text-slate-400 font-mono">Rev. {rev}</span>
            {isArchive && <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-400 rounded-full text-xs font-bold border border-rose-500/30">ARCHIVED</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setIsStudioOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0D99FF] hover:bg-[#007BE5] text-white rounded-xl text-xs font-bold shadow-xs transition-all"
            title="ทดสอบดูและดาวน์โหลดลายน้ำทั้ง 7 รูปแบบ"
          >
            <Sparkles size={14} /> <span className="hidden sm:inline">Watermark Studio</span>
          </button>

          <div className="hidden md:flex items-center gap-1.5 bg-slate-700/80 rounded-xl px-2.5 py-1">
            <button className="p-1 hover:bg-slate-600 rounded text-slate-300"><ZoomOut size={16} /></button>
            <span className="text-xs w-10 text-center font-mono text-slate-300">100%</span>
            <button className="p-1 hover:bg-slate-600 rounded text-slate-300"><ZoomIn size={16} /></button>
          </div>
          
          <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
            {canDownload ? (
              <>
                <button 
                  onClick={() => handleDownload(true)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-[#0D99FF] hover:text-[#0D99FF] transition-colors" 
                  title="เปิดดู PDF ตัวจริงในแท็บใหม่ (Open PDF Tab)"
                >
                  <ExternalLink size={16} />
                </button>
                <button 
                  onClick={() => handleDownload(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-emerald-400 hover:text-emerald-300 transition-colors" 
                  title={doc?.title?.startsWith('FM') ? "Download Form" : (currentUser.isDcc ? "Download Master PDF" : "ดาวน์โหลดเอกสาร PDF (Uncontrolled Copy)")}
                >
                  <Download size={16} />
                </button>
              </>
            ) : (
              <button className="w-8 h-8 rounded-lg opacity-40 cursor-not-allowed flex items-center justify-center text-slate-400" title={isArchive ? "Archive Document (Download Disabled)" : "ไม่มีสิทธิ์ดาวน์โหลด"}>
                <Download size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Viewer Canvas (Mock) */}
      <div className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-4 md:p-8 relative">
        
        {/* Watermark Overlay for Archived Documents */}
        {isArchive && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-50 overflow-hidden opacity-20">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="text-rose-500 font-bold text-6xl md:text-8xl whitespace-nowrap -rotate-45 mb-32 select-none tracking-wider drop-shadow-sm">
                ARCHIVE DOCUMENT
              </div>
            ))}
          </div>
        )}

        <div className="bg-white w-full max-w-4xl min-h-[700px] shadow-none rounded-xl flex flex-col items-center justify-center text-center p-10 relative z-0">
          <div className="border-2 border-dashed border-[#E5E5E5] rounded-xl p-10 w-full h-full flex flex-col items-center justify-center bg-[#F5F5F5]/50">
            <h1 className="text-xl font-bold text-slate-400 mb-2">PDF Document Viewer</h1>
            <p className="text-sm text-slate-800 font-bold font-mono">Document: {title}</p>
            <p className="text-xs text-[#666666] font-mono mt-0.5">Revision: {rev}</p>
            {isArchive && (
              <div className="mt-6 px-3.5 py-1.5 bg-rose-50 text-rose-800 rounded-full font-bold text-xs border border-rose-200">
                🚨 ARCHIVE DOCUMENT (เอกสารยกเลิกแล้ว ห้ามนำไปใช้อ้างอิง)
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Floating Pagination */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur-xs text-white px-4 py-1.5 rounded-full flex items-center gap-3 shadow-none border border-slate-700 text-xs">
        <button className="p-1 hover:bg-slate-700 rounded-full text-slate-300"><ChevronLeft size={16} /></button>
        <span className="font-mono font-medium">Page 1 of 5</span>
        <button className="p-1 hover:bg-slate-700 rounded-full text-slate-300"><ChevronRight size={16} /></button>
      </div>

      {/* Watermark Studio Modal */}
      {doc && (
        <WatermarkStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          document={doc}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default Viewer;
