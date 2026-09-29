'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { store } from '@/lib/data/store';
import { UserProfile } from '@/lib/types/database';
import { supabase } from '@/lib/supabase/client';
import { 
  LayoutDashboard, 
  MapPin, 
  Inbox, 
  MessageSquare, 
  Users, 
  Tags, 
  ArrowLeft, 
  ShieldCheck, 
  Menu,
  X,
  AlertTriangle
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      // 1. Check local store user
      const localUser = store.getCurrentUser();
      
      // Auto-grant admin if email is default admin
      if (localUser?.email === 'admin123@ftu.edu.vn') {
        localUser.role = 'admin';
        store.setCurrentUser(localUser);
        setCurrentUser(localUser);
        setIsAdmin(true);
        setLoading(false);
        return;
      }

      if (localUser?.role === 'admin') {
        setCurrentUser(localUser);
        setIsAdmin(true);
        setLoading(false);
        return;
      }

      // 2. Query Supabase users table directly
      try {
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('users')
              .select('role')
              .eq('id', user.id)
              .single();

            if (profile?.role === 'admin') {
              setIsAdmin(true);
              setLoading(false);
              return;
            }
          }
        }
      } catch (e) {
        // Fallback
      }

      setCurrentUser(localUser);
      setIsAdmin(false);
      setLoading(false);
    };

    checkRole();
  }, [pathname]);

  const navItems = [
    { label: 'Dashboard Tổng quan', href: '/admin', icon: LayoutDashboard },
    { label: 'Quản lý Địa điểm & Ảnh', href: '/admin/dia-diem', icon: MapPin },
    { label: 'Duyệt Đề xuất', href: '/admin/de-xuat', icon: Inbox },
    { label: 'Kiểm duyệt Đánh giá', href: '/admin/danh-gia', icon: MessageSquare },
    { label: 'Quản trị Người dùng', href: '/admin/nguoi-dung', icon: Users },
    { label: 'Danh mục & Tiện ích', href: '/admin/danh-muc', icon: Tags },
  ];

  const handleMakeAdmin = () => {
    store.loginAs('admin');
    const updated = store.getCurrentUser();
    setCurrentUser(updated);
    setIsAdmin(true);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[500px]">
        <div className="flex flex-col items-center gap-2 text-gray-500 text-xs">
          <div className="w-8 h-8 border-3 border-burgundy border-t-transparent rounded-full animate-spin"></div>
          <span>Đang xác thực quyền Quản trị viên...</span>
        </div>
      </div>
    );
  }

  // If not admin, provide prompt to log in as default admin
  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 min-h-[calc(100vh-140px)]">
        <div className="bg-white max-w-md p-8 rounded-2xl border border-rose-200 shadow-elevated text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Yêu cầu quyền Quản trị viên FTU</h2>
          <p className="text-xs text-gray-600">
            Bạn đang truy cập với tài khoản không có quyền Admin. Hãy đăng nhập tài khoản <code>admin123@ftu.edu.vn</code> (mật khẩu <code>123456</code>).
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={handleMakeAdmin}
              className="py-2.5 px-4 rounded-xl bg-burgundy text-white text-xs font-bold shadow-sm hover:bg-burgundy-hover transition-colors cursor-pointer"
            >
              Vào vai Admin ngay (admin123@ftu.edu.vn)
            </button>
            <Link
              href="/"
              className="py-2.5 px-4 rounded-xl border border-border text-xs font-semibold text-gray-700 hover:bg-slate-50"
            >
              Quay lại trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-[calc(100vh-64px)] bg-slate-50 relative">
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-16 left-0 right-0 z-30 bg-white border-b border-border px-4 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-burgundy" />
          <span className="font-bold text-xs text-gray-900">STUDYSPOT ADMIN</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-gray-600 hover:text-burgundy rounded-lg hover:bg-slate-100"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Admin Sidebar (Desktop fixed, Mobile Drawer) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-border flex flex-col justify-between p-4 shadow-soft transform transition-transform duration-200 md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 top-16' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-9 h-9 rounded-xl bg-burgundy text-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-gray-900 leading-tight">ADMIN CONTROL</div>
              <div className="text-[10px] text-burgundy font-bold">Ban Quản Trị FTU</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-burgundy text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Link */}
        <div className="pt-4 border-t border-border">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-burgundy hover:bg-burgundy-light transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Về lại Bản đồ FTU
          </Link>
        </div>
      </aside>

      {/* Main Admin Content Container with Framer Motion */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 pt-16 md:pt-8">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="max-w-6xl mx-auto space-y-6"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
