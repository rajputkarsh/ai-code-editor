'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import {
  listCollaborationNotificationsAPI,
  markCollaborationNotificationReadAPI,
  type CollaborationNotification,
} from '@/lib/collaboration/api-client';

function formatRelativeTime(dateInput: string): string {
  const ms = Date.now() - new Date(dateInput).getTime();
  const minutes = Math.max(1, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<CollaborationNotification[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const refreshNotifications = async () => {
    const next = await listCollaborationNotificationsAPI({ unread: false, limit: 25 });
    setNotifications(next);
  };

  useEffect(() => {
    void refreshNotifications();
    const interval = window.setInterval(() => {
      void refreshNotifications();
    }, 15000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const markOneAsRead = async (notificationId: string) => {
    const ok = await markCollaborationNotificationReadAPI(notificationId);
    if (!ok) return;
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId
          ? { ...item, isRead: true, readAt: new Date().toISOString() }
          : item
      )
    );
  };

  const markAllAsRead = async () => {
    setIsLoading(true);
    try {
      const unread = notifications.filter((item) => !item.isRead);
      await Promise.all(unread.map((item) => markCollaborationNotificationReadAPI(item.id)));
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? new Date().toISOString() }))
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-1 rounded-md transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800"
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell className="w-3 h-3" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-rose-500 text-[9px] leading-[14px] text-white text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-7 z-50 w-80 rounded-md border border-neutral-800 bg-neutral-900 shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 text-xs text-neutral-300">
            <span>Notifications</span>
            <button
              onClick={() => void markAllAsRead()}
              disabled={unreadCount === 0 || isLoading}
              className="text-[11px] text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-3 text-xs text-neutral-500">No notifications yet.</div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void markOneAsRead(item.id)}
                  className={`w-full text-left px-3 py-2 border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800 ${
                    item.isRead ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-neutral-200 truncate">{item.title}</span>
                    <span className="text-[10px] text-neutral-500 shrink-0">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-400 whitespace-normal">{item.message}</p>
                  {!item.isRead && <span className="mt-1 inline-block text-[10px] text-blue-400">Unread</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
