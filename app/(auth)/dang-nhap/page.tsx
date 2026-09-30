'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Coffee, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { store } from '@/lib/data/store';
import { useToast } from '@/components/common/Toast';

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const isAdmin = cleanEmail === ADMIN_EMAIL;
    const assignedRole = isAdmin ? 'admin' : 'student';
    let fullName = cleanEmail.split('@')[0];
    let authenticated = false;
    let userId = '';

    try {
      // 1. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (!error && data?.user) {
        authenticated = true;
        userId = data.user.id;
        fullName = data.user.user_metadata?.full_name || fullName;

        // Check if user is locked
        try {
          const { data: userProfile } = await supabase
            .from('users')
            .select('is_locked, full_name')
            .eq('id', userId)
            .single();

          if (userProfile?.is_locked) {
            setErrorMessage('Tài khoản của bạn đã bị khóa bởi Ban Quản Trị.');
            showToast('Tài khoản đã bị khóa', 'error');
            setLoading(false);
            return;
          }
          if (userProfile?.full_name) {
            fullName = userProfile.full_name;
          }
        } catch (dbErr) {
          // Ignore table lookup error
        }

        // Automatic Admin / Student role syncing based on Admin Email
        try {
          await supabase.from('profiles').upsert({
            id: userId,
            email: cleanEmail,
            full_name: fullName,
            role: assignedRole,
            updated_at: new Date().toISOString(),
          });
        } catch (profileErr) {
          console.warn('Profiles sync warning:', profileErr);
        }

        try {
          await supabase.from('users').upsert({
            id: userId,
            email: cleanEmail,
            full_name: fullName,
            role: assignedRole,
            is_locked: false,
          });
        } catch (userErr) {
          console.warn('Users sync warning:', userErr);
        }
      } else {
        // Fallback for store credentials (seeded accounts or registered in store)
        const localRes = store.loginWithEmail(cleanEmail, password);
        if (localRes.success && localRes.user) {
          authenticated = true;
          userId = localRes.user.id;
          fullName = localRes.user.full_name;
          localRes.user.role = assignedRole;
          store.setCurrentUser(localRes.user);
        } else {
          // Show strict error message on UI
          const msg = 'Tài khoản chưa được đăng ký hoặc mật khẩu không chính xác. Vui lòng đăng ký tài khoản mới!';
          setErrorMessage(msg);
          showToast(msg, 'error');
          setLoading(false);
          return;
        }
      }
    } catch (err: any) {
      // Offline / network exception handling fallback
      const localRes = store.loginWithEmail(cleanEmail, password);
      if (localRes.success && localRes.user) {
        authenticated = true;
        userId = localRes.user.id;
        fullName = localRes.user.full_name;
        localRes.user.role = assignedRole;
        store.setCurrentUser(localRes.user);
      } else {
        const msg = 'Tài khoản chưa được đăng ký hoặc mật khẩu không chính xác. Vui lòng đăng ký tài khoản mới!';
        setErrorMessage(msg);
        showToast(msg, 'error');
        setLoading(false);
        return;
      }
    }

    setLoading(false);

    if (authenticated) {
      // 2. Set persistent cookies for server middleware
      document.cookie = `studyspot_role=${assignedRole}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `studyspot_user_email=${cleanEmail}; path=/; max-age=604800; SameSite=Lax`;

      // 3. Sync with local client store
      store.setCurrentUser({
        id: userId || `user-${Date.now()}`,
        full_name: fullName,
        email: cleanEmail,
        role: assignedRole,
        is_locked: false,
        created_at: new Date().toISOString(),
      });

      showToast(
        `Đăng nhập thành công! Chào mừng ${fullName} (${isAdmin ? 'Quản trị viên' : 'Sinh viên'}).`,
        'success'
      );

      // 4. Role-based routing: Admin -> /admin, Student -> /
      if (isAdmin) {
        router.push('/admin');
      } else {
        router.push('/');
      }
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

        {/* Error Notification Alert on UI */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Standard Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Email FTU / Cá nhân</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="vd: ten_ban@ftu.edu.vn"
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
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                <span>Đang xác thực...</span>
              </>
            ) : (
              <>
                <span>Đăng nhập</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Register Footer */}
        <div className="text-center text-xs text-gray-500 pt-2 border-t border-border">
          Chưa có tài khoản?{' '}
          <Link href="/dang-ky" className="font-bold text-burgundy hover:underline">
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
