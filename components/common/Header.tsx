'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Heart, 
  PlusCircle, 
  Shield, 
  User, 
  LogOut, 
  ChevronDown,
  Coffee,
  Bell,
  CheckCheck,
  ExternalLink
} from 'lucide-react';
import { store } from '@/lib/data/store';
import { UserProfile, Notification } from '@/lib/types/database';
import { useToast } from './Toast';
import { NotificationDropdown } from './NotificationDropdown';
import { useAuth } from '@/components/auth/AuthContext';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const { user: currentUser, logout, isAdmin } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadUserData = () => {
    if (currentUser) {
      setNotifications(store.getNotifications(currentUser.id));
    } else {
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadUserData();
    const unsubscribe = store.subscribe(() => {
      loadUserData();
    });
    return () => unsubscribe();
  }, [pathname, currentUser]);

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    showToast('Đã đăng xuất thành công', 'info');
    router.push('/');
  };

  const handleMarkAllRead = () => {
    if (currentUser) {
      store.markAllNotificationsRead(currentUser.id);
      setNotifications(store.getNotifications(currentUser.id));
      showToast('Đã đánh dấu đọc tất cả thông báo', 'info');
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-border shadow-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-burgundy flex items-center justify-center text-white shadow-md group-hover:bg-burgundy-hover transition-colors">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-burgundy">STUDYSPOT</span>
              <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-burgundy-light text-burgundy border border-burgundy-border">FTU</span>
            </div>
            <p className="text-[10px] text-text-secondary hidden sm:block">Bản đồ điểm học quanh ĐH Ngoại thương</p>
          </div>
        </Link>

        {/* Desktop Quick Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              pathname === '/'
                ? 'bg-burgundy-light text-burgundy font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
            }`}
          >
            Bản đồ
          </Link>
          <Link
            href="/yeu-thich"
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${
              pathname === '/yeu-thich'
                ? 'bg-burgundy-light text-burgundy font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
            }`}
          >
            <Heart className="w-4 h-4 text-rose-500" />
            Yêu thích
          </Link>
          <Link
            href="/de-xuat"
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${
              pathname === '/de-xuat'
                ? 'bg-burgundy-light text-burgundy font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-burgundy" />
            Đề xuất quán
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${
                pathname.startsWith('/admin')
                  ? 'bg-burgundy text-white font-semibold'
                  : 'text-burgundy bg-burgundy-light hover:bg-burgundy hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin
            </Link>
          )}
        </nav>

        {/* Right Section: Notifications & User Auth */}
        <div className="flex items-center gap-3">
          {/* Notification Bell Dropdown */}
          <NotificationDropdown currentUser={currentUser} />

          {/* User Profile Dropdown */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-border hover:border-burgundy transition-all bg-white"
              >
                <img
                  src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                  alt={currentUser.full_name}
                  className="w-8 h-8 rounded-lg object-cover ring-1 ring-burgundy/20"
                />
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-text-primary leading-tight flex items-center gap-1">
                    {currentUser.full_name.split(' ')[0]}
                    {currentUser.role === 'admin' && (
                      <span className="bg-rose-100 text-burgundy text-[9px] px-1 rounded font-bold">ADMIN</span>
                    )}
                  </div>
                  <span className="text-[10px] text-text-secondary">{currentUser.email}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-text-secondary ml-1" />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-elevated border border-border py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2 border-b border-border/60">
                    <p className="text-xs text-text-secondary">Đang đăng nhập:</p>
                    <p className="text-sm font-bold text-text-primary truncate">{currentUser.full_name}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-burgundy-light text-burgundy">
                      {currentUser.role === 'admin' ? 'Ban Quản Trị' : 'Sinh viên'}
                    </span>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/ho-so"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-primary hover:bg-slate-50"
                    >
                      <User className="w-4 h-4 text-text-secondary" />
                      Hồ sơ cá nhân
                    </Link>
                    <Link
                      href="/yeu-thich"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-primary hover:bg-slate-50"
                    >
                      <Heart className="w-4 h-4 text-rose-500" />
                      Quán yêu thích
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-burgundy font-medium hover:bg-burgundy-light"
                      >
                        <Shield className="w-4 h-4" />
                        Admin Dashboard
                      </Link>
                    )}
                  </div>

                  <div className="pt-1 border-t border-border/60">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/dang-nhap"
                className="px-3.5 py-1.5 rounded-xl text-sm font-semibold text-burgundy hover:bg-burgundy-light transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                href="/dang-ky"
                className="px-3.5 py-1.5 rounded-xl text-sm font-semibold text-white bg-burgundy hover:bg-burgundy-hover transition-colors shadow-sm"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
