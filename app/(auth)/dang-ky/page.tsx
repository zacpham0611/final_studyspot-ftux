'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Coffee, Lock, Mail, User, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { store } from '@/lib/data/store';
import { useToast } from '@/components/common/Toast';

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim();

    // 1. Client validation
    if (!cleanFullName) {
      setErrorMessage('Vui lòng nhập họ và tên của bạn.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải chứa ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại!');
      return;
    }

    setLoading(true);

    try {
      // 2. Call Supabase Auth signUp (role 'user' complies with Postgres check constraint in schema.sql)
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanFullName,
            role: 'user',
          },
        },
      });

      if (error) {
        // If Supabase reports user already registered
        if (error.message.includes('already registered') || error.message.includes('unique')) {
          setErrorMessage('Email này đã được đăng ký trong hệ thống. Vui lòng đăng nhập!');
          setLoading(false);
          return;
        }
        console.warn('Supabase Auth warning during signup:', error.message);
      }

      const userId = data?.user?.id || `user-${Date.now()}`;

      // 3. Save to Supabase users table (using client upsert + server-side sync endpoint)
      try {
        await supabase.from('users').upsert({
          id: userId,
          email: cleanEmail,
          full_name: cleanFullName,
          role: 'user',
          is_locked: false,
          created_at: new Date().toISOString(),
        });
      } catch (userErr) {
        console.warn('Users table client upsert notice:', userErr);
      }

      try {
        await fetch('/api/user/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: userId,
            email: cleanEmail,
            full_name: cleanFullName,
            role: 'user',
          }),
        });
      } catch (syncErr) {
        console.warn('User server sync notice:', syncErr);
      }

      // 4. Register in local store (for client persistence & instant login capability)
      const storeRes = store.registerUser(cleanEmail, password, cleanFullName, 'student');
      if (!storeRes.success && storeRes.message && !data?.user) {
        setErrorMessage(storeRes.message);
        setLoading(false);
        return;
      }

      // 5. Notify success and redirect to login page (KHÔNG tự động vào thẳng giao diện nếu chưa qua bước đăng nhập)
      const successMsg = 'Đăng ký tài khoản thành công! Vui lòng đăng nhập để tiếp tục.';
      setSuccessMessage(successMsg);
      showToast(successMsg, 'success');

      setTimeout(() => {
        router.push('/dang-nhap');
      }, 1200);
    } catch (err: any) {
      console.error('Registration error:', err);
      // Fallback local store registration
      const storeRes = store.registerUser(cleanEmail, password, cleanFullName, 'student');
      if (storeRes.success) {
        const successMsg = 'Đăng ký tài khoản thành công! Vui lòng đăng nhập để tiếp tục.';
        setSuccessMessage(successMsg);
        showToast(successMsg, 'success');
        setTimeout(() => {
          router.push('/dang-nhap');
        }, 1200);
      } else {
        setErrorMessage(storeRes.message || 'Đã xảy ra lỗi trong quá trình đăng ký. Vui lòng thử lại!');
      }
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tạo tài khoản FTUer</h1>
          <p className="text-xs text-gray-500">Đăng ký tài khoản sinh viên để lưu quán yêu thích và đánh giá</p>
        </div>

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Success Notification Alert */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span className="font-medium leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* Register Form */}
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Email FTU / Cá nhân</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="sinhvien@ftu.edu.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy transition-all"
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Xác nhận mật khẩu</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="Nhập lại mật khẩu..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-burgundy hover:bg-burgundy-hover text-white text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý đăng ký...</span>
              </>
            ) : (
              <>
                <span>Đăng ký ngay</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Login Link */}
        <div className="text-center text-xs text-gray-500 pt-2 border-t border-border">
          Đã có tài khoản?{' '}
          <Link href="/dang-nhap" className="font-bold text-burgundy hover:underline">
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
