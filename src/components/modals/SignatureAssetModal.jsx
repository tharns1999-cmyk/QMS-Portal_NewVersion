import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenTool, X, Upload, Trash2, CheckCircle2, Save, RotateCcw, Type } from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../../store/useStore';
import { generateCursiveSignatureDataUrl } from '../../utils/pdfStamper';

const SIGNATURE_STYLES = [
  { id: 'BRUSH_SCRIPT', name: 'Brush Script (พู่กันศิลป์)', fontClass: 'font-serif italic font-bold' },
  { id: 'CLASSIC_CALLIGRAPHY', name: 'Classic Calligraphy (ประดิษฐ์)', fontClass: 'font-mono italic font-semibold' },
  { id: 'MODERN_SANS', name: 'Modern Sans (มินิมอลร่วมสมัย)', fontClass: 'font-sans font-extrabold tracking-wide uppercase' },
  { id: 'FORMAL_SERIF', name: 'Formal Serif (ทางการคลาสสิก)', fontClass: 'font-serif tracking-widest uppercase' }
];

export default function SignatureAssetModal({
  isOpen = true,
  onClose,
  targetUser = null,
  user = null,
  onSaved = null
}) {
  const activeUser = targetUser || user;
  const updateUserSignature = useStore(state => state.updateUserSignature);
  const updateUserSignatureProfile = useStore(state => state.updateUserSignatureProfile);

  const [activeTab, setActiveTab] = useState('DRAWN'); // 'DRAWN' | 'IMAGE' | 'TYPOGRAPHIC'
  const [currentSignatureAsset, setCurrentSignatureAsset] = useState('');
  const [signatureStyle, setSignatureStyle] = useState('BRUSH_SCRIPT');
  const [signatureInitials, setSignatureInitials] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef(null);

  // Initialize data from user
  useEffect(() => {
    if (activeUser) {
      const initSig = activeUser.signatureImage || '';
      setCurrentSignatureAsset(initSig);
      const initType = activeUser.signatureType || (initSig ? 'IMAGE' : 'TYPOGRAPHIC');
      setActiveTab(initType);
      setSignatureStyle(activeUser.signatureStyle || 'BRUSH_SCRIPT');
      setSignatureInitials(activeUser.signatureInitials || activeUser.name || '');
    }
  }, [activeUser]);

  // Canvas drawing handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setCurrentSignatureAsset(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setCurrentSignatureAsset('');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ภาพต้องไม่เกิน 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setCurrentSignatureAsset(event.target.result);
      toast.success('โหลดรูปภาพลายเซ็นสำเร็จ');
    };
    reader.readAsDataURL(file);
  };

  const handleTypographicSelect = (styleId) => {
    setSignatureStyle(styleId);
    const text = signatureInitials || activeUser?.name || 'Signer';
    const dataUrl = generateCursiveSignatureDataUrl(text, styleId);
    setCurrentSignatureAsset(dataUrl);
  };

  // Blueprint C Implementation
  const handleSaveSignature = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!activeUser) return;

    let finalAsset = currentSignatureAsset;
    if (activeTab === 'TYPOGRAPHIC' && (!finalAsset || finalAsset.length < 20)) {
      finalAsset = generateCursiveSignatureDataUrl(
        signatureInitials || activeUser.name,
        signatureStyle
      );
    }

    if (!finalAsset) {
      toast.error('กรุณาสร้างหรืออัปโหลดลายเซ็นก่อนบันทึก');
      return;
    }

    try {
      setIsSaving(true);
      const userId = activeUser.id || activeUser.userId;

      // 1. เรียก Action บันทึกลง IndexedDB ถาวร (Direct Persistence)
      if (typeof updateUserSignature === 'function') {
        await updateUserSignature(userId, finalAsset);
      }

      // 2. ซิงค์โปรไฟล์ลายเซ็นดิจิทัล
      if (typeof updateUserSignatureProfile === 'function') {
        updateUserSignatureProfile(userId, {
          signatureType: activeTab,
          signatureStyle,
          signatureInitials: signatureInitials || activeUser.name,
          signatureImage: finalAsset
        });
      }

      toast.success('บันทึกสินทรัพย์ลายเซ็นเรียบร้อยแล้ว');
      onSaved?.(finalAsset);
      onClose();
    } catch (error) {
      console.error('Save signature error:', error);
      toast.error('ไม่สามารถบันทึกลายเซ็นได้');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !activeUser) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#0D99FF]/20 rounded-xl text-[#0D99FF]">
                <PenTool size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  จัดการลายเซ็นอิเล็กทรอนิกส์ (Signature Asset)
                </h3>
                <p className="text-xs text-slate-400">
                  สำหรับผู้ใช้งาน: {activeUser.name} ({activeUser.department})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveSignature} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* User Identity Banner */}
              <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800 text-sm">
                    {activeUser.name}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                    {activeUser.empId || activeUser.id} • แผนก {activeUser.department} • {activeUser.position || 'User'}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#E5F4FF] text-[#007BE5] border border-[#B8E1FF]">
                  Level {activeUser.level || activeUser.approval_level || 1}
                </span>
              </div>

              {/* Mode Selection Tabs (3 Modes) */}
              <div>
                <label className="font-bold text-slate-700 block mb-2">
                  เลือกวิธีสร้างลายเซ็น (Signature Mode):
                </label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-[#F1F5F9] rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('DRAWN')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'DRAWN'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>✍️ วาดลายเซ็น</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('IMAGE')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'IMAGE'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🖼️ อัปโหลดรูป</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('TYPOGRAPHIC');
                      handleTypographicSelect(signatureStyle);
                    }}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'TYPOGRAPHIC'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🔤 เลือก Font</span>
                  </button>
                </div>
              </div>

              {/* Mode 1: DRAWN */}
              {activeTab === 'DRAWN' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">ลากเมาส์หรือใช้นิ้ววาดลงในกรอบ:</span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      <span>ล้างกระดานวาด</span>
                    </button>
                  </div>
                  <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      width={560}
                      height={180}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-[180px] bg-white cursor-crosshair touch-none"
                    />
                  </div>
                </div>
              )}

              {/* Mode 2: IMAGE */}
              {activeTab === 'IMAGE' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <input
                      type="file"
                      id="signature-file-upload-asset"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="signature-file-upload-asset"
                      className="cursor-pointer flex flex-col items-center justify-center gap-2"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Upload size={18} />
                      </div>
                      <div className="text-slate-700 font-bold">คลิกเพื่ออัปโหลดรูปภาพลายเซ็น</div>
                      <div className="text-[11px] text-slate-400">รองรับไฟล์ PNG, JPG, WEBP (โปร่งใสแนะนำ, สูงสุด 2MB)</div>
                    </label>
                  </div>

                  {currentSignatureAsset && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={currentSignatureAsset}
                          alt="Signature Preview"
                          className="h-10 max-w-[150px] object-contain border border-slate-100 rounded p-1"
                        />
                        <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 size={13} /> อัปโหลดสำเร็จ
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentSignatureAsset('')}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="ลบรูปภาพ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 3: TYPOGRAPHIC */}
              {activeTab === 'TYPOGRAPHIC' && (
                <div className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      ข้อความลายเซ็น (Signature Text / Initials):
                    </label>
                    <input
                      type="text"
                      value={signatureInitials}
                      onChange={(e) => {
                        setSignatureInitials(e.target.value);
                        const dataUrl = generateCursiveSignatureDataUrl(e.target.value, signatureStyle);
                        setCurrentSignatureAsset(dataUrl);
                      }}
                      placeholder={activeUser.name}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">
                      เลือกสไตล์ฟอนต์ (Font Family):
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {SIGNATURE_STYLES.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => handleTypographicSelect(style.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            signatureStyle === style.id
                              ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="text-[10px] text-slate-500 font-sans mb-1">{style.name}</div>
                          <div className={`text-base text-slate-800 truncate ${style.fontClass}`}>
                            {signatureInitials || activeUser.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Real-time Live Asset Preview */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  ตัวอย่างลายเซ็นบนเอกสาร (Live Asset Preview):
                </label>
                <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                  <div className="h-14 flex items-center justify-center">
                    {currentSignatureAsset ? (
                      <img
                        src={currentSignatureAsset}
                        alt="Signature Asset Preview"
                        className="max-h-12 max-w-[200px] object-contain"
                      />
                    ) : (
                      <div className="text-slate-400 italic font-mono text-xs">
                        ยังไม่มีสินทรัพย์ลายเซ็น
                      </div>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-500 space-y-0.5">
                    <div><strong className="text-slate-800">ผู้ลงนาม:</strong> {activeUser.name}</div>
                    <div><strong className="text-slate-800">สังกัด:</strong> {activeUser.department}</div>
                    <div className="text-emerald-600 font-bold inline-flex items-center gap-1 justify-end">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      <span>Persistent IndexedDB Asset</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Save size={14} />
                <span>{isSaving ? 'กำลังบันทึกลง IndexedDB...' : 'บันทึกสินทรัพย์ลายเซ็น'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
