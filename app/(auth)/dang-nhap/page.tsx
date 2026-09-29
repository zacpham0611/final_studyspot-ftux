'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Coffee, Lock, Mail, ArrowRight, Shield, UserCheck, AlertCircle } from 'lucide-react';
import { store } from '@/lib/data/store';
import { useToast } from '@/components/common/Toast';

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      const res = store.loginWithEmail(email, password);
      if (res.success && res.user) {
        showToast(
          `Đăng nhập thành công! Chào mừng ${res.user.full_name} (${res.user.role === 'admin' ? 'Quản trị viên' : 'Sinh viên'}).`,
          'success'
        );
        if (res.user.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/');
        }
      } else {
        setErrorMessage(res.message || 'Email hoặc mật khẩu không chính xác');
        showToast(res.message || 'Đăng nhập không thành công', 'error');
      }
    }, 400);
  };

  const handleQuickLoginAdmin = () => {
    setEmail('admin123@ftu.edu.vn');
    setPassword('123456');
    const res = store.loginWithEmail('admin123@ftu.edu.vn', '123456');
    if (res.success) {
      showToast('Đăng nhập thành công tài khoản Quản trị viên FTU mặc định!', 'success');
      router.push('/admin');
    }
  };

  const handleQuickLoginStudent = () => {
    setEmail('minhanh.k61@ftu.edu.vn');
    setPassword('123456');
    const res = store.loginWithEmail('minhanh.k61@ftu.edu.vn', '123456');
    if (res.success) {
      showToast('Đăng nhập thành công tài khoản Sinh viên FTU!', 'success');
      router.push('/');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-[calc(100vh-140px)]">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl border border-border shadow-elevated space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-burgundy text-white flex items-center justify-center mx-auto shadow-md">
            <Coffee className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Đăng nhập STUDYSPOT</h1>
          <p className="text-xs text-gray-500">Khám phá và chia sẻ điểm học tập quanh Ngoại thương</p>
        </div>

        {/* Default Admin Quick Login Box */}
        <div className="p-3.5 bg-burgundy-light/40 rounded-xl border border-burgundy-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-burgundy uppercase tracking-wider flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-burgundy" /> Tài khoản Admin mặc định
            </p>
            <span className="text-[10px] text-gray-500 font-mono">123456</span>
          </div>
          <div className="text-xs text-gray-700 font-medium">
            Email: <span className="font-mono font-bold text-burgundy">admin123@ftu.edu.vn</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleQuickLoginAdmin}
              className="py-1.5 px-3 rounded-lg bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover shadow-xs transition-colors flex items-center justify-center gap-1"
            >
              <Shield className="w-3.5 h-3.5" /> Vào vai Admin
            </button>
            <button
              type="button"
              onClick={handleQuickLoginStudent}
              className="py-1.5 px-3 rounded-lg bg-white border border-border text-xs font-bold text-gray-700 hover:border-burgundy hover:text-burgundy transition-colors flex items-center justify-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Vào vai Sinh viên
            </button>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Email FTU / Cá nhân</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="admin123@ftu.edu.vn"
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
                placeholder="123456"
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
            {loading ? 'Đang xác thực...' : 'Đăng nhập'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-xs text-gray-500 pt-2 border-t border-border">
          Chưa có tài khoản?{' '}
          <Link href="/dang-ky" className="font-bold text-burgundy hover:underline">
            Đăng ký ngay (Tự động vào phiên)
          </Link>
        </div>
      </div>
    </div>
  );
}
