import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import useStore from '../../store/useStore';
import { NotificationCenterModal } from '../modals/NotificationCenterModal';

dayjs.extend(relativeTime);

/**
 * NotificationPopover - Figma UI3 floating panel for system notifications
 * Provides wide comfortable layout (w-88 / w-96), visual hierarchy,
 * unread badges, mark-all-read action, and full NotificationCenterModal history.
 */
const NotificationPopover = ({
  notifications: propNotifications,
  unreadCount: propUnreadCount,
  onMarkAllAsRead: propOnMarkAllAsRead,
  onNotificationClick: propOnNotificationClick,
  onViewAll: propOnViewAll,
  className = ''
}) => {
  const navigate = useNavigate();
  const store = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const popoverRef = useRef(null);

  // Extract from store if props not explicitly passed
  const currentUser = store?.currentUser;
  const rawNotifications = propNotifications !== undefined ? propNotifications : (store?.notifications || []);
  const markNotificationAsRead = store?.markNotificationAsRead || store?.markAsRead;
  const markAllNotificationsAsRead = store?.markAllNotificationsAsRead || store?.markAllAsRead;

  // Filter for current user and sort newest first
  const userNotis = React.useMemo(() => {
    if (propNotifications !== undefined) return propNotifications;
    return (rawNotifications || [])
      .filter(n => !n.userId || n.userId === currentUser?.id || n.user_id === currentUser?.id)
      .sort((a, b) => new Date(b.timestamp || b.created_at || b.createdAt || 0) - new Date(a.timestamp || a.created_at || a.createdAt || 0));
  }, [rawNotifications, currentUser?.id, propNotifications]);

  const unreadCount = propUnreadCount !== undefined 
    ? propUnreadCount 
    : userNotis.filter(n => !n.isRead && !n.read).length;

  const handleToggle = () => {
    setIsOpen(prev => !prev);
  };

  const handleMarkAllAsRead = (e) => {
    e?.stopPropagation?.();
    if (propOnMarkAllAsRead) {
      propOnMarkAllAsRead();
    } else if (markAllNotificationsAsRead) {
      markAllNotificationsAsRead(currentUser?.id);
    }
  };

  const handleNotificationClick = (item) => {
    if (propOnNotificationClick) {
      propOnNotificationClick(item);
    } else {
      if (markNotificationAsRead && item.id) {
        markNotificationAsRead(item.id);
      }
      setIsOpen(false);
      if (item.link) {
        navigate(item.link);
      } else {
        navigate('/tasks');
      }
    }
  };

  const handleViewAllNotifications = (e) => {
    e?.stopPropagation?.();
    setIsOpen(false);
    if (propOnViewAll) {
      propOnViewAll();
    } else {
      setIsHistoryModalOpen(true);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className={`relative ${className}`} ref={popoverRef}>
        {/* Trigger Button */}
        <button 
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-label="การแจ้งเตือนระบบ"
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 border cursor-pointer ${
            isOpen
              ? 'bg-dream-surface-soft text-dream-primary font-medium border-dream-subtle shadow-none'
              : 'bg-white hover:bg-dream-surface-soft text-dream-secondary font-medium border-dream-subtle shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex items-center justify-center">
              <Bell size={16} strokeWidth={2} className="text-indigo-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white animate-pulse" />
              )}
            </div>
            <span className="truncate tracking-tight text-xs font-semibold text-dream-primary">
              การแจ้งเตือนระบบ
            </span>
          </div>
          {unreadCount > 0 ? (
            <span className="bg-indigo-600 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded-full shadow-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : (
            <span className="text-xs text-dream-muted font-mono font-medium">0</span>
          )}
        </button>

        {/* Floating Popover Dropdown (Figma UI3 Standards w-88 to w-96) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
              className="absolute left-0 sm:left-full sm:ml-3 top-0 w-88 sm:w-96 max-w-[calc(100vw-2rem)] bg-white border border-dream-subtle rounded-2xl shadow-dream z-50 focus:outline-none divide-y divide-dream-subtle overflow-hidden origin-top-left"
            >
              {/* 1. Header: Title + Unread Badge + Mark All As Read */}
              <div className="p-3.5 px-4 bg-dream-surface-soft flex items-center justify-between border-b border-dream-subtle">
                <div className="flex items-center gap-2">
                  <Bell className="text-indigo-600" size={16} strokeWidth={2} />
                  <h3 className="text-sm font-bold text-dream-primary">การแจ้งเตือน</h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-dream-lavender text-indigo-700 border border-indigo-200/60">
                      {unreadCount} ใหม่
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-all cursor-pointer"
                  >
                    อ่านทั้งหมด
                  </button>
                )}
              </div>

              {/* 2. Scrollable Notification Items Area */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-dream-subtle custom-scrollbar bg-white">
                {userNotis.length === 0 ? (
                  <div className="py-10 px-4 text-center">
                    <BellOff className="text-dream-muted mx-auto mb-2" size={28} strokeWidth={1.5} />
                    <p className="text-xs font-medium text-dream-muted">ไม่มีการแจ้งเตือนใหม่</p>
                  </div>
                ) : (
                  userNotis.map((item) => {
                    const isUnread = !item.isRead && !item.read;
                    const timeDisplay = item.timestamp || item.created_at || item.createdAt
                      ? dayjs(item.timestamp || item.created_at || item.createdAt).fromNow() 
                      : (item.time || 'เมื่อสักครู่');

                    return (
                      <div
                        key={item.id || item.title + (item.timestamp || Math.random())}
                        onClick={() => handleNotificationClick(item)}
                        className={`p-3.5 px-4 flex items-start gap-3 hover:bg-dream-surface-soft cursor-pointer transition-colors ${
                          isUnread ? 'bg-dream-lavender/30' : 'bg-white'
                        }`}
                      >
                        {/* Unread Indicator Dot */}
                        <div className="pt-1.5 shrink-0">
                          {isUnread ? (
                            <span className="block w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
                          ) : (
                            <span className="block w-2 h-2 rounded-full bg-transparent" />
                          )}
                        </div>

                        {/* Notification Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs truncate ${isUnread ? 'font-bold text-dream-primary' : 'font-semibold text-dream-secondary'}`}>
                              {item.title}
                            </p>
                            <span className="text-[10px] font-mono text-dream-muted shrink-0 whitespace-nowrap">
                              {timeDisplay}
                            </span>
                          </div>
                          <p className="text-xs text-dream-secondary line-clamp-2 leading-relaxed break-words">
                            {item.message || item.description}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 3. Footer */}
              <div className="p-2.5 bg-dream-surface-soft text-center border-t border-dream-subtle">
                <button
                  type="button"
                  onClick={handleViewAllNotifications}
                  className="text-xs font-semibold text-dream-secondary hover:text-dream-primary transition-colors cursor-pointer"
                >
                  ดูประวัติการแจ้งเตือนทั้งหมด
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notification Center Modal */}
      {isHistoryModalOpen && (
        <NotificationCenterModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      )}
    </>
  );
};

export default NotificationPopover;

