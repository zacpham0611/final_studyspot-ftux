'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '@/lib/data/store';
import { Notification, UserProfile } from '@/lib/types/database';
import { useToast } from '@/components/common/Toast';
import { Bell, CheckCheck, ExternalLink, Inbox } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface NotificationDropdownProps {
  currentUser: UserProfile | null;
}

export function NotificationDropdown({ currentUser }: NotificationDropdownProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = () => {
    if (currentUser) {
      setNotifications(store.getNotifications(currentUser.id));
    } else {
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: Notification) => {
    // 1. Update is_read = true in store
    store.markNotificationRead(notif.id);
    
    // 2. Update is_read = true in Supabase (if connected)
    try {
      if (supabase && currentUser) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notif.id);
      }
    } catch (e) {
      // Supabase sync fallback
    }

    // Refresh local list
    loadNotifications();

    // 3. Close dropdown
    setIsOpen(false);

    // 4. Navigate if link exists
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    store.markAllNotificationsRead(currentUser.id);
    try {
      if (supabase) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', currentUser.id);
      }
    } catch (e) {
      // Fallback
    }
    loadNotifications();
    showToast('Đã đánh dấu đọc tất cả thông báo', 'info');
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (!currentUser) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-gray-600 hover:text-burgundy hover:bg-slate-100 transition-colors"
        title="Thông báo hệ thống"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-2 ring-white"></span>
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-elevated border border-border overflow-hidden z-50 animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="p-3.5 border-b border-border flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-burgundy" />
              <span className="font-bold text-xs text-gray-900">
                Thông báo ({notifications.length})
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-bold">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-burgundy hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Đã đọc hết
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 space-y-2">
                <Inbox className="w-8 h-8 text-gray-300 mx-auto" />
                <p>Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 text-xs transition-colors cursor-pointer hover:bg-slate-50 ${
                    !notif.is_read ? 'bg-burgundy-light/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-gray-800 leading-snug flex-1 ${!notif.is_read ? 'font-bold' : 'font-normal'}`}>
                      {notif.noi_dung}
                    </p>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-burgundy flex-shrink-0 mt-1"></span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1 text-[10px] text-gray-400">
                    <span>
                      {new Date(notif.created_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      •{' '}
                      {new Date(notif.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    {notif.link && (
                      <span className="font-bold text-burgundy flex items-center gap-0.5 hover:underline">
                        Xem ngay <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
