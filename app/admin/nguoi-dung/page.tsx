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
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleLock = async (userId: string, currentLocked: boolean) => {
    const targetStatus = !currentLocked;

    // 1. Optimistic UI update (Instant 0ms feedback)
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_locked: targetStatus } : u))
    );
    store.toggleLockUser(userId);

    showToast(
      targetStatus
        ? 'Đã khóa tài khoản người dùng trên hệ thống!'
        : 'Đã mở khóa tài khoản thành công!',
      'info'
    );

    try {
      // 2. Direct single-record UPDATE in Supabase Database (public.users)
      const { error } = await supabase
        .from('users')
        .update({ is_locked: targetStatus })
        .eq('id', userId);

      if (error) {
        throw error;
      }
    } catch (e: any) {
      console.warn('Supabase lock error:', e);
      // Rollback optimistic update on failure
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_locked: currentLocked } : u))
      );
      store.toggleLockUser(userId);
      showToast('Không thể cập nhật trạng thái trong cơ sở dữ liệu. Vui lòng thử lại!', 'error');
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
                          onClick={() => handleToggleLock(u.id, u.is_locked)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            u.is_locked
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          }`}
                        >
                          {u.is_locked ? 'Mở khóa' : 'Khóa nick'}
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
