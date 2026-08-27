import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

const UserSelector = ({ value, onChange, error, users = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Find the selected user
  const selectedUser = users?.find(u => u?.id === value);

  // Filter users based on search
  const filteredUsers = (users || []).filter(u => {
    const sQuery = searchQuery?.toLowerCase() ?? "";
    const nameMatch = u?.name?.toLowerCase()?.includes(sQuery);
    const deptMatch = u?.department?.toLowerCase()?.includes(sQuery);
    return nameMatch || deptMatch;
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (user) => {
    onChange(user.id);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className="relative w-full z-30" ref={containerRef}>
      {value && selectedUser ? (
        <div className={`flex items-center justify-between rounded-xl px-3.5 py-2 bg-slate-100/80 border border-slate-200 min-h-[44px] ${error ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/50' : ''}`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
              {selectedUser.name?.charAt(0) || 'U'}
            </div>
            <div className="truncate">
              <span className="font-bold text-slate-800 text-sm">{selectedUser.name}</span>
              <span className="text-slate-500 text-xs ml-1.5 font-mono">({selectedUser.department})</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleClear}
            className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg ml-1"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="ค้นหาชื่อ หรือแผนก..."
            className={`w-full pl-10 pr-4 py-2.5 h-11 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all ${error ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/50' : ''}`}
          />
        </div>
      )}

      {isOpen && !value && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white shadow-2xl rounded-xl max-h-60 overflow-y-auto border border-slate-200">
          {filteredUsers.length > 0 ? (
            <ul className="py-1 divide-y divide-slate-50">
              {filteredUsers.map(u => (
                <li 
                  key={u?.id || Math.random()}
                  onClick={() => handleSelect(u)}
                  className="px-4 py-2.5 hover:bg-indigo-50/70 cursor-pointer flex justify-between items-center transition-colors text-sm"
                >
                  <span className="font-bold text-slate-800">{u?.name || 'Unknown'}</span>
                  <span className="text-xs text-slate-500 bg-slate-100 font-mono font-semibold px-2.5 py-0.5 rounded-full">{u?.department || '-'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-xs text-slate-400 text-center">
              ไม่พบผู้ใช้งานที่ตรงกับคำค้นหา
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserSelector;
