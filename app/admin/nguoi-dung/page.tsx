'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { store } from '@/lib/data/store';
import { UserProfile } from '@/lib/types/database';
import { useToast } from '@/components/common/Toast';
import { Lock, Unlock, Shield, User, Loader2 } from 'lucide-react';

export default function AdminUsersPage() {
  const { showToast } = useToast();
  // Instant render from store cache if available
  const [users, setUsers] = useState<UserProfile[]>(() => store.getAllUsers());
  const [loading, setLoading] = useState(() => store.getAllUsers().length === 0);

  const loadData = async () => {
    try {
      // 1. Fetch live user list directly from Supabase Database (public.users)
      // Only select required columns for minimal payload & faster query
      const { data: dbUsers, error } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url, role, is_locked, created_at')
        .order('created_at', { ascending: false });

      if (!error && dbUsers && dbUsers.length > 0) {
        // Sync with review counts from store
        const allReviews = store.getAllReviewsAdmin();
        const enriched = dbUsers.map((u: any) => ({
          ...u,
          review_count: allReviews.filter((r) => r.user_id === u.id).length,
        }));
        setUsers(enriched);
        // Supabase is the ultimate source of truth:
        store.syncUsersFromSupabase(dbUsers);
        return;
      }
    } catch (e) {
      console.warn('Supabase users load notice:', e);
    }

    // Fallback to store
    setUsers(store.getAllUsers());
  };

  useEffect(() => {
    let isMounted = true;
    loadData().finally(() => {
      if (isMounted) setLoading(false);
    });

    // 1. Listen to store updates (e.g. background loadFromSupabase, local signups)
    const unsubscribeStore = store.subscribe(() => {
      if (isMounted) {
        loadData();
      }
    });

    // 2. Realtime listener for cross-device signups on public.users
    const channel = supabase
      .channel('admin-users-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => {
          if (isMounted) {
            loadData();
          }
        }
      )
      .subscribe();

    // 3. Fallback interval polling every 8s for cross-device updates if realtime is disconnected
    const pollTimer = setInterval(() => {
      if (isMounted) {
        loadData();
      }
    }, 8000);

    return () => {
      isMounted = false;
      unsubscribeStore();
      supabase.removeChannel(channel);
      clearInterval(pollTimer);
    };
  }, []);

  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  const handleToggleLock = async (userId: string, currentLocked: boolean) => {
    // Prevent duplicate clicks or concurrent requests on the same user
    if (togglingUserId === userId) return;

    const targetStatus = !currentLocked;
    setTogglingUserId(userId);

    // 1. Optimistic UI update (Instant 0ms feedback)
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_locked: targetStatus } : u))
    );
    store.setUserLocked(userId, targetStatus);

    try {
      // 2. Direct UPDATE via secure Server API
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, isLocked: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi cập nhật người dùng từ máy chủ');
      }

      // 3. Success: Show ONLY ONE toast AFTER operation succeeds
      showToast(
        targetStatus
          ? 'Đã khóa tài khoản người dùng trên hệ thống!'
          : 'Đã mở khóa tài khoản thành công!',
        'info'
      );
    } catch (e: any) {
      console.warn('Supabase lock error:', e);
      // 4. Rollback optimistic update on failure
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_locked: currentLocked } : u))
      );
      store.setUserLocked(userId, currentLocked);

      // Show ONLY ONE error toast on failure
      showToast('Không thể cập nhật trạng thái trong cơ sở dữ liệu. Vui lòng thử lại!', 'error');
    } finally {
      setTogglingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold text-gray-900">Quản trị Người dùng & Khóa tài khoản</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Danh sách sinh viên và ban quản trị. Dữ liệu được đồng bộ trực tiếp với Supabase Database. Tài khoản bị khóa sẽ không thể đăng nhập hoặc thực hiện các thao tác người dùng.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin text-burgundy" />
            <span>Đang tải danh sách người dùng từ Supabase Database...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-slate-50 border-b border-border text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Thành viên</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Ngày tham gia</th>
                  <th className="py-3 px-4">Số review</th>
                  <th className="py-3 px-4">Vai trò</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900 flex items-center gap-2.5">
                      <img
                        src={u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-border"
                      />
                      <span>{u.full_name}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">{u.email}</td>
                    <td className="py-3 px-4">{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                    <td className="py-3 px-4 font-bold text-gray-800">{u.review_count || 0}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'admin'
                            ? 'bg-burgundy-light text-burgundy border border-burgundy-border'
                            : 'bg-slate-100 text-gray-700'
                        }`}
                      >
                        {u.role === 'admin' ? 'Ban Quản Trị' : 'Sinh viên'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.is_locked
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {u.is_locked ? 'Đã khóa' : 'Hoạt động'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.role !== 'admin' && (
                        <button
                          disabled={togglingUserId === u.id}
                          onClick={() => handleToggleLock(u.id, u.is_locked)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            u.is_locked
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          }`}
                        >
                          {togglingUserId === u.id ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              {u.is_locked ? 'Đang mở...' : 'Đang khóa...'}
                            </span>
                          ) : (
                            u.is_locked ? 'Mở khóa' : 'Khóa nick'
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
