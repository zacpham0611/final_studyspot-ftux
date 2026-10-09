'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { store } from '@/lib/data/store';
import { UserProfile } from '@/lib/types/database';
import { useToast } from '@/components/common/Toast';
import { Lock, Unlock, Shield, User, Loader2, Trash2, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const { user: currentAdmin } = useAuth();
  // Instant render from store cache if available
  const [users, setUsers] = useState<UserProfile[]>(() => store.getAllUsers());
  const [loading, setLoading] = useState(() => store.getAllUsers().length === 0);

  const [deleteModalUser, setDeleteModalUser] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isSyncingRef = useRef(false);

  const loadData = async () => {
    try {
      isSyncingRef.current = true;
      // 1. Fetch live user list via server API (bypasses RLS using Service Role & auto-syncs auth.users)
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.users)) {
          const allReviews = store.getAllReviewsAdmin();
          const enriched = json.users.map((u: any) => ({
            ...u,
            review_count: allReviews.filter((r) => r.user_id === u.id).length,
          }));
          setUsers(enriched);
          store.syncUsersFromSupabase(json.users);
          return;
        }
      }
    } catch (apiErr) {
      console.warn('API users fetch warning:', apiErr);
    } finally {
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 50);
    }

    try {
      isSyncingRef.current = true;
      // 2. Direct Supabase Client fallback
      const { data: dbUsers, error } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url, role, is_locked, created_at')
        .order('created_at', { ascending: false });

      if (!error && dbUsers && dbUsers.length > 0) {
        const allReviews = store.getAllReviewsAdmin();
        const enriched = dbUsers.map((u: any) => ({
          ...u,
          review_count: allReviews.filter((r) => r.user_id === u.id).length,
        }));
        setUsers(enriched);
        store.syncUsersFromSupabase(dbUsers);
        return;
      }
    } catch (e) {
      console.warn('Supabase users load notice:', e);
    } finally {
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 50);
    }

    // 3. Fallback to store
    setUsers(store.getAllUsers());
  };

  useEffect(() => {
    let isMounted = true;
    loadData().finally(() => {
      if (isMounted) setLoading(false);
    });

    // 1. Listen to external store updates (ignoring triggers initiated by this page)
    const unsubscribeStore = store.subscribe(() => {
      if (isMounted && !isSyncingRef.current) {
        loadData();
      }
    });

    // 2. Realtime listener for cross-device signups / updates on public.users
    const channel = supabase
      .channel('admin-users-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => {
          if (isMounted && !isSyncingRef.current) {
            loadData();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      unsubscribeStore();
      supabase.removeChannel(channel);
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

  const handleDeleteUser = async () => {
    if (!deleteModalUser || isDeleting) return;

    const targetUser = deleteModalUser;
    setIsDeleting(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUser.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi khi xóa người dùng từ máy chủ.');
      }

      // 1. Remove from UI state immediately
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));

      // 2. Remove from local store
      store.deleteUser(targetUser.id);

      showToast(`Đã xóa vĩnh viễn tài khoản "${targetUser.full_name}" thành công!`, 'success');
      setDeleteModalUser(null);
      setDeleteConfirmText('');
    } catch (err: any) {
      showToast(err.message || 'Không thể xóa tài khoản. Vui lòng thử lại!', 'error');
    } finally {
      setIsDeleting(false);
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
                      <div className="flex items-center justify-end gap-2">
                        {u.role !== 'admin' && (
                          <button
                            disabled={togglingUserId === u.id || (deleteModalUser?.id === u.id && isDeleting)}
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

                        {u.role !== 'admin' && u.id !== currentAdmin?.id && (
                          <button
                            disabled={togglingUserId === u.id || isDeleting}
                            onClick={() => {
                              setDeleteModalUser(u);
                              setDeleteConfirmText('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            title="Xóa vĩnh viễn tài khoản người dùng"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Permanent Account Deletion */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-gray-900">
                  Xác nhận xóa vĩnh viễn tài khoản
                </h3>
                <p className="text-xs text-rose-600 font-semibold mt-0.5">
                  CẢNH BÁO: Thao tác này KHÔNG THỂ HOÀN TÁC!
                </p>
              </div>
              <button
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteModalUser(null);
                    setDeleteConfirmText('');
                  }
                }}
                disabled={isDeleting}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center gap-2.5">
                <img
                  src={
                    deleteModalUser.avatar_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
                  }
                  alt=""
                  className="w-9 h-9 rounded-full object-cover ring-1 ring-border"
                />
                <div>
                  <p className="font-bold text-gray-900">{deleteModalUser.full_name}</p>
                  <p className="font-mono text-gray-500 text-[11px]">{deleteModalUser.email}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 text-gray-600 space-y-1">
                <p>• Tài khoản sẽ bị xóa hoàn toàn khỏi Supabase Auth và cơ sở dữ liệu.</p>
                <p>
                  • Người dùng này sẽ <strong>không thể đăng nhập lại</strong>.
                </p>
                <p>• Các địa điểm đã đề xuất vẫn được bảo lưu an toàn trong hệ thống.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-700 block">
                Nhập chữ <span className="font-bold text-rose-600 font-mono">XOA</span> để xác nhận:
              </label>
              <input
                type="text"
                placeholder="Nhập XOA..."
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                disabled={isDeleting}
                className="w-full px-3 py-2 text-xs rounded-xl border border-border focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteModalUser(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting || deleteConfirmText.trim().toUpperCase() !== 'XOA'}
                onClick={handleDeleteUser}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác nhận xóa vĩnh viễn</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
