'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Coffee, Lock, Mail, User, ArrowRight } from 'lucide-react';
import { store } from '@/lib/data/store';
import { useToast } from '@/components/common/Toast';

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      // Auto session without requiring email confirmation
      const newUser = {
        id: `user-${Date.now()}`,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        role: 'user' as const,
        is_locked: false,
        created_at: new Date().toISOString(),
      };
      
      store.setCurrentUser(newUser);
      showToast('Đăng ký thành công! Đã tự động tạo phiên đăng nhập.', 'success');
      router.push('/');
    }, 400);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-[calc(100vh-140px)]">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl border border-border shadow-elevated space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-burgundy text-white flex items-center justify-center mx-auto shadow-md">
            <Coffee className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tạo tài khoản FTUer</h1>
          <p className="text-xs text-gray-500">Đăng ký tự động vào ngay không cần xác thực email</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Họ và tên</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="Nguyễn Văn A (K62 FTU)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="sinhvien@ftu.edu.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Mật khẩu</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-burgundy hover:bg-burgundy-hover text-white text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            {loading ? 'Đang tạo tài khoản...' : 'Đăng ký ngay'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-xs text-gray-500 pt-2 border-t border-border">
          Đã có tài khoản?{' '}
          <Link href="/dang-nhap" className="font-bold text-burgundy hover:underline">
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
