import React, { useState, useRef, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Send, UserCircle, MessageSquare, AlertTriangle } from 'lucide-react';

const DARComments = ({ darId, requesterId, dar }) => {
  const { timeline, currentUser, addComment } = useStore();
  const [newComment, setNewComment] = useState('');
  const messagesEndRef = useRef(null);

  const targetDarId = String(darId || dar?.id || '').trim();
  const targetDarNo = String(dar?.darNo || dar?.dar_no || dar?.darNumber || '').trim();

  // Strict DAR Scoping Guard: Only match timeline items tied to this specific DAR ID or DAR Number
  const commentsAndEvents = (timeline || [])
    .filter(t => {
      if (!t) return false;
      const tDarId = String(t.darId || '').trim();
      const tDarNo = String(t.darNo || '').trim();
      const matchesDar = (targetDarId && (tDarId === targetDarId || tDarNo === targetDarId)) ||
                         (targetDarNo && (tDarId === targetDarNo || tDarNo === targetDarNo));
      return matchesDar && (t.isChat || t.action === 'Comment' || ['RETURN', 'REJECT', 'APPROVE'].includes(t.action));
    })
    .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)); // Oldest first for natural chat flow

  const commentsCount = commentsAndEvents.filter(c => c.isChat || c.action === 'Comment').length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [commentsAndEvents.length]);

  const handleSend = (e) => {
    if (e?.preventDefault) e.preventDefault();
    const text = newComment.trim();
    if (!text || !targetDarId) return;
    addComment(targetDarId, text, currentUser);
    setNewComment('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 flex flex-col h-[480px] overflow-hidden">
      {/* Header Bar with Dynamic Badge Counter */}
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-[#0D99FF]" />
          <h3 className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wider">
            ความคิดเห็น (Comments)
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#E5F4FF] text-[#0D99FF] border border-[#B8E1FF] shadow-2xs">
            {commentsCount}
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium font-mono">
          {targetDarNo || targetDarId || 'DAR-THREAD'}
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/40">
        {commentsAndEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-slate-400 text-center p-6 space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-white text-slate-400 flex items-center justify-center shadow-2xs border border-slate-200">
              <MessageSquare size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-700">ยังไม่มีความคิดเห็น</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[240px] leading-relaxed">
                พิมพ์ข้อความสอบถามหรือบันทึกข้อเสนอแนะเกี่ยวกับคำร้องนี้ได้ที่ช่องด้านล่าง
              </p>
            </div>
          </div>
        ) : (
          commentsAndEvents.map((item, idx) => {
            const isSystemAction = ['RETURN', 'REJECT', 'APPROVE'].includes(item.action);
            const isRequester = item.userId === requesterId || item.user === currentUser?.name;
            const alignRight = !isSystemAction && isRequester;

            return (
              <div key={item.id || idx} className={`flex flex-col ${alignRight ? 'items-end' : 'items-start'}`}>
                {isSystemAction ? (
                  <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl px-4 py-2.5 w-full max-w-sm mb-1.5 mx-auto text-center shadow-2xs">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-amber-800 font-bold mb-1">
                      <AlertTriangle size={13} className="text-amber-600" />
                      <span>บันทึกสถานะระบบ: {item.action}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-amber-950 leading-relaxed break-words">{item.comment}</p>
                    <p className="text-[10px] font-mono text-amber-700 mt-1">โดย {item.user} • {item.date}</p>
                  </div>
                ) : (
                  <div className={`flex gap-2.5 max-w-[88%] ${alignRight ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                      <UserCircle size={20} strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <div className={`flex items-baseline gap-2 mb-1 ${alignRight ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-xs font-bold text-slate-800 truncate">{item.user}</span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">{item.date}</span>
                      </div>
                      <div className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm shadow-2xs leading-relaxed break-words [overflow-wrap:anywhere] ${
                        alignRight 
                          ? 'bg-[#0D99FF] text-white rounded-tr-xs' 
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                      }`}>
                        {item.comment}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field with Smooth Enter Key Support */}
      <div className="p-3 bg-white border-t border-slate-100 shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2 relative">
          <input 
            type="text" 
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="พิมพ์ความคิดเห็น หรือกด Enter เพื่อส่ง..." 
            className="flex-1 bg-slate-50 border border-slate-200/90 rounded-xl px-4 py-2.5 pr-11 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D99FF]/20 focus:border-[#0D99FF] transition-all"
          />
          <button 
            type="submit"
            disabled={!newComment.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-[#0D99FF] hover:bg-[#0088EE] active:scale-95 text-white rounded-lg disabled:opacity-30 disabled:hover:bg-[#0D99FF] disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
            title="ส่งข้อความ (Enter)"
          >
            <Send size={15} strokeWidth={2} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default DARComments;
