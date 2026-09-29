'use client';

import React, { useState, useEffect } from 'react';
import { store } from '@/lib/data/store';
import { UserProfile } from '@/lib/types/database';
import { useToast } from '@/components/common/Toast';
import { Lock, Unlock, Shield, User } from 'lucide-react';

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);

  const loadData = () => {
    setUsers(store.getAllUsers());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleLock = (userId: string, currentLocked: boolean) => {
    store.toggleLockUser(userId);
    loadData();
    showToast(
      currentLocked ? 'Đã mở khóa tài khoản thành công!' : 'Đã khóa tài khoản người dùng!',
      'info'
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold text-gray-900">Quản trị Người dùng & Khóa tài khoản</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Danh sách sinh viên và ban quản trị. Tài khoản bị khóa sẽ không thể đăng nhập vào ứng dụng.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden">
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
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
      </div>
    </div>
  );
}
