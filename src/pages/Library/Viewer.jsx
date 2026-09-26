import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import useStore from '../../store/useStore';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Sparkles, ExternalLink, ArrowLeft, ShieldAlert } from 'lucide-react';
import { UniversalWatermarkService, WATERMARK_TYPES, getWatermarkConfig } from '../../services/UniversalWatermarkService';
import { resolveFileBlob } from '../../utils/fileStorage';
import { applyProgressiveSignatoryStamp } from '../../utils/pdfStamper';
import { resolveProgressiveSignatories } from '../../utils/signatoryResolver';
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
  const [realPdfUrl, setRealPdfUrl] = useState(null);
  const [_loadingPdf, setLoadingPdf] = useState(false);
  const [zoomMode, setZoomMode] = useState('FitH'); // 'FitH' | '100' | '125' | '150' | '75'
  
  const doc = (documents || []).find(d => 
    String(d.id) === String(docId) ||
    String(d.document_code) === String(docId) ||
    String(d.doc_code) === String(docId) ||
    String(d.docCode) === String(docId) ||
    String(d.code) === String(docId) ||
    String(d.docNo) === String(docId) ||
    String(d.title) === String(docId)
  );

  useEffect(() => {
    let activeUrl = null;
    let isCancelled = false;

    if (doc) {
      setLoadingPdf(true);
      resolveFileBlob(doc, doc.fileId || doc.id || doc.docCode || doc.title || doc.darId)
        .then(async (blob) => {
          if (!isCancelled && blob) {
            let displayBlob = blob;
            const status = (doc.status || (isArchive ? 'OBSOLETE' : '')).toUpperCase();
            const isMasterDoc = status === 'ACTIVE' || status === 'EFFECTIVE' || status === 'APPROVED' || isArchive;
            const isInternal = !doc.isExternal && doc.docType !== 'ED' && !String(doc.title || doc.docCode || '').startsWith('ED-') && !String(doc.title || doc.docCode || '').startsWith('EXT-');

            if (isMasterDoc && isInternal && !doc.isSignatoryStamped) {
              try {
                const store = useStore.getState();
                const relatedDar = (store.dars || []).find(d => 
                  d.id === doc.darId || 
                  d.darNumber === doc.darNumber || 
                  d.docNo === doc.document_code || 
                  d.docCode === doc.document_code ||
                  d.title === doc.title
                );
                const signatories = resolveProgressiveSignatories({
                  dar: relatedDar,
                  masterDoc: doc,
                  stage: 'MASTER',
                  masterUsers: store.masterUsers,
                  users: store.users,
                  currentUser: store.currentUser
                });
                const stampedBytes = await applyProgressiveSignatoryStamp(blob, signatories);
                displayBlob = new Blob([stampedBytes], { type: 'application/pdf' });
              } catch (stampErr) {
                console.warn('[Viewer] Stamping 3x3 table warning:', stampErr);
              }
            }

            activeUrl = URL.createObjectURL(displayBlob);
            setRealPdfUrl(activeUrl);
          }
        })
        .catch(err => {
          console.warn('[Viewer] Could not resolve file blob:', err);
        })
        .finally(() => {
          if (!isCancelled) setLoadingPdf(false);
        });
    }

    return () => {
      isCancelled = true;
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [doc]);

  const iframeUrl = useMemo(() => {
    if (!realPdfUrl) return '';
    const viewParam = zoomMode === 'FitH' ? 'view=FitH' : `view=Fit&zoom=${zoomMode}`;
    return `${realPdfUrl}#${viewParam}&toolbar=0&navpanes=0`;
  }, [realPdfUrl, zoomMode]);

  const title = doc ? doc.title : docId;
  const docStatus = doc?.status || (isArchive ? 'OBSOLETE' : '');
  const watermarkConfig = getWatermarkConfig(docStatus);
  const canDownload = doc && !isArchive && docStatus === 'EFFECTIVE' ? canDownloadDocument(doc, currentUser) : false;

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
    <div className="h-full w-full flex flex-col bg-slate-900 rounded-xl overflow-hidden shadow-none border border-slate-800 relative min-h-0">
      {/* Viewer Toolbar */}
      <div className="bg-slate-800 text-slate-200 px-4 py-2.5 flex items-center justify-between border-b border-slate-700/80 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors" title="ย้อนกลับ">
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

          <div className="hidden md:flex items-center gap-1 bg-slate-700/80 rounded-xl px-2.5 py-1">
            <button 
              onClick={() => setZoomMode(prev => prev === 'FitH' ? '100' : String(Math.max(50, parseInt(prev, 10) - 25)))} 
              className="p-1 hover:bg-slate-600 rounded text-slate-300 transition-colors" 
              title="ซูมออก"
            >
              <ZoomOut size={15} />
            </button>
            <button 
              onClick={() => setZoomMode('FitH')} 
              className="text-xs w-12 text-center font-mono text-slate-300 hover:text-white transition-colors cursor-pointer" 
              title="คลิกเพื่อรีเซ็ต Fit-Width (พอดีความกว้าง)"
            >
              {zoomMode === 'FitH' ? 'Fit' : `${zoomMode}%`}
            </button>
            <button 
              onClick={() => setZoomMode(prev => prev === 'FitH' ? '125' : String(Math.min(200, parseInt(prev, 10) + 25)))} 
              className="p-1 hover:bg-slate-600 rounded text-slate-300 transition-colors" 
              title="ซูมเข้า"
            >
              <ZoomIn size={15} />
            </button>
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

      {/* Viewer Canvas - Full Frame Immersive (Edge-to-Edge, Fit-Width Enforced) */}
      <div className="flex-1 w-full bg-slate-950 overflow-hidden flex flex-col p-0 relative min-h-0">
        
        {/* Watermark Overlay for Superseded and Obsolete Documents */}
        {watermarkConfig.visible && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-50 overflow-hidden select-none">
            {Array.from({ length: 6 }).map((_, i) => (
              <div 
                key={i} 
                style={{ color: watermarkConfig.color }}
                className="font-black text-4xl sm:text-6xl md:text-7xl whitespace-nowrap -rotate-45 mb-24 md:mb-32 select-none tracking-widest drop-shadow-sm font-sans"
              >
                {watermarkConfig.text}
              </div>
            ))}
          </div>
        )}

        {realPdfUrl ? (
          <div className="w-full flex-1 h-full bg-white overflow-hidden relative z-0 flex flex-col min-h-0">
            <iframe
              src={iframeUrl}
              className="w-full flex-1 h-full border-0 block"
              style={{ minHeight: '100%' }}
              title={`Viewer - ${title}`}
            />
          </div>
        ) : (
          <div className="w-full flex-1 h-full bg-white rounded-lg sm:rounded-xl shadow-none flex flex-col items-center justify-center text-center p-6 sm:p-10 relative z-0 min-h-0">
            <div className="border-2 border-dashed border-[#E5E5E5] rounded-xl p-8 w-full max-w-2xl flex flex-col items-center justify-center bg-[#F5F5F5]/50">
              <h1 className="text-xl font-bold text-slate-400 mb-2">PDF Document Viewer</h1>
              <p className="text-sm text-slate-800 font-bold font-mono">Document: {title}</p>
              <p className="text-xs text-[#666666] font-mono mt-0.5">Revision: {rev}</p>
              {watermarkConfig.visible && (
                <div 
                  className="mt-6 px-4 py-2 rounded-full font-bold text-xs border tracking-wide flex items-center gap-2"
                  style={{
                    backgroundColor: docStatus.includes('SUPERSEDED') ? '#FFF7ED' : '#FEF2F2',
                    borderColor: docStatus.includes('SUPERSEDED') ? '#FDBA74' : '#FECACA',
                    color: docStatus.includes('SUPERSEDED') ? '#C2410C' : '#DC2626'
                  }}
                >
                  {docStatus.includes('SUPERSEDED') ? '⏳' : '🚨'} {watermarkConfig.text} (ห้ามนำไปใช้อ้างอิง)
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Floating Pagination */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full flex items-center gap-3 shadow-lg border border-slate-700/80 text-xs z-20 pointer-events-auto">
        <button className="p-1 hover:bg-slate-700 rounded-full text-slate-300 transition-colors"><ChevronLeft size={16} /></button>
        <span className="font-mono font-medium">Page 1 of 5</span>
        <button className="p-1 hover:bg-slate-700 rounded-full text-slate-300 transition-colors"><ChevronRight size={16} /></button>
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
