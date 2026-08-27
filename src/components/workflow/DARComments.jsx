import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { Send, UserCircle } from 'lucide-react';

const DARComments = ({ darId, requesterId }) => {
  const { timeline, currentUser, addComment } = useStore();
  const [newComment, setNewComment] = useState('');

  // Get only comments and important timeline events
  const commentsAndEvents = timeline
    .filter(t => t.darId === darId && (t.isChat || ['RETURN', 'REJECT', 'APPROVE'].includes(t.action)))
    .sort((a, b) => a.id - b.id); // Oldest first for chat view

  const handleSend = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    addComment(darId, newComment, currentUser);
    setNewComment('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
      <div className="px-6 py-4 border-b border-gray-100 bg-[#F5F5F5] flex items-center justify-between">
        <h3 className="font-bold text-gray-800 ">ความคิดเห็น (Comments)</h3>
        <span className="text-xs bg-blue-100 text-[#007BE5]  px-2 py-1 rounded-full font-medium">Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F5F5]/50">
        {commentsAndEvents.length === 0 ? (
          <div className="text-center text-[#666666]  mt-10 text-sm">ยังไม่มีความคิดเห็น</div>
        ) : (
          commentsAndEvents.map(item => {
            // Determine if the message is from the requester (Right) or reviewer/system (Left)
            // If the action is a system action (e.g. RETURN, APPROVE), we'll show it as a system message
            // Otherwise, check if the sender is the requester.
            
            const isSystemAction = ['RETURN', 'REJECT', 'APPROVE'].includes(item.action);
            const isRequester = item.userId === requesterId || item.user === currentUser.name; 
            // In a real app we check strictly by ID. Since timeline didn't have userId previously, we fall back to name comparison for mock data.

            const alignRight = !isSystemAction && isRequester;

            return (
              <div key={item.id} className={`flex flex-col ${alignRight ? 'items-end' : 'items-start'}`}>
                {isSystemAction ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 w-full max-w-sm mb-2 mx-auto text-center">
                    <p className="text-xs text-yellow-800 font-bold mb-1">System Event: {item.action}</p>
                    <p className="text-sm text-yellow-900">{item.comment}</p>
                    <p className="text-xs text-yellow-600 mt-1">โดย {item.user} • {item.date}</p>
                  </div>
                ) : (
                  <div className={`flex gap-2.5 max-w-[85%] ${alignRight ? 'flex-row-reverse' : 'flex-row'}`}>
                    <UserCircle className="text-gray-400 shrink-0" size={32} strokeWidth={1.25}/>
                    <div>
                      <div className={`flex items-baseline gap-2 mb-1 ${alignRight ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-xs font-bold text-gray-700">{item.user}</span>
                        <span className="text-xs text-gray-400">{item.date}</span>
                      </div>
                      <div className={`px-4 py-2.5 rounded-xl text-sm shadow-xs leading-relaxed ${alignRight ? 'bg-[#0D99FF] text-white rounded-tr-none' : 'bg-white border border-[#E5E5E5] text-gray-800 rounded-tl-none'}`}>
                        {item.comment}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <form onSubmit={handleSend} className="flex gap-2 relative">
          <input 
            type="text" 
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="พิมพ์ความคิดเห็น..." 
            className="flex-1 border border-[#E5E5E5] rounded-full pl-4 pr-12 py-2 focus:ring focus:ring-blue-100 text-sm"
          />
          <button 
            type="submit"
            disabled={!newComment.trim()}
            className="absolute right-1 top-1 p-1.5 bg-[#0D99FF] text-white rounded-full hover:bg-[#007BE5] disabled:bg-gray-300 transition-colors"
          >
            <Send size={24} strokeWidth={1.25}/>
          </button>
        </form>
      </div>
    </div>
  );
};

export default DARComments;
