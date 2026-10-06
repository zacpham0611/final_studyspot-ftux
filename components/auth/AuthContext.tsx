'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { store } from '@/lib/data/store';
import { UserProfile, UserRole } from '@/lib/types/database';

export function extractAuthErrorMessage(err: any): string {
  if (!err) {
    return 'Tài khoản chưa được đăng ký hoặc mật khẩu không chính xác. Vui lòng đăng ký tài khoản mới!';
  }

  let msg = '';
  if (typeof err === 'string') {
    msg = err.trim();
  } else if (typeof err.message === 'string' && err.message.trim()) {
    msg = err.message.trim();
  } else if (typeof err.error_description === 'string' && err.error_description.trim()) {
    msg = err.error_description.trim();
  } else if (typeof err.msg === 'string' && err.msg.trim()) {
    msg = err.msg.trim();
  } else if (typeof err.description === 'string' && err.description.trim()) {
    msg = err.description.trim();
  } else if (err.error && typeof err.error === 'object') {
    return extractAuthErrorMessage(err.error);
  }

  // Filter out raw JSON, empty object strings, etc.
  if (
    !msg ||
    msg === '{}' ||
    msg === '[]' ||
    msg === '[object Object]' ||
    msg === 'null' ||
    msg === 'undefined'
  ) {
    return 'Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!';
  }

  return msg;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isLocked: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; message?: string; role?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAdmin: false,
  isLocked: false,
  login: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => null,
});

export const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const userRef = useRef<UserProfile | null>(null);
  const inFlightProfilePromiseRef = useRef<Promise<UserProfile | null> | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Sync user state to browser cookies for Next.js middleware and SSR
  const syncCookies = useCallback((usr: UserProfile | null) => {
    if (typeof document === 'undefined') return;
    if (usr) {
      const isAdm = usr.email.toLowerCase() === ADMIN_EMAIL || usr.role === 'admin';
      const role = isAdm ? 'admin' : (usr.role || 'student');
      document.cookie = `studyspot_role=${role}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `studyspot_user_email=${encodeURIComponent(usr.email.toLowerCase())}; path=/; max-age=604800; SameSite=Lax`;
    } else {
      document.cookie = 'studyspot_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'studyspot_user_email=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }, []);

  // Safe resolver for user profile from Supabase Database public.users
  const resolveUserProfile = useCallback(async (sessionUser: any): Promise<UserProfile> => {
    const userId = sessionUser.id;
    const userEmail = (sessionUser.email || '').toLowerCase();
    const isAdm = userEmail === ADMIN_EMAIL;
    const metaFullName = sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || userEmail.split('@')[0];
    const metaAvatar = sessionUser.user_metadata?.avatar_url || null;

    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url, role, is_locked, created_at')
        .eq('id', userId)
        .maybeSingle();

      if (dbUser) {
        if (dbUser.is_locked) {
          throw new Error('ACCOUNT_LOCKED');
        }

        const isUserAdmin = isAdm || dbUser.role === 'admin';
        return {
          id: dbUser.id,
          full_name: dbUser.full_name || metaFullName,
          email: dbUser.email || userEmail,
          avatar_url: dbUser.avatar_url || metaAvatar,
          role: (isUserAdmin ? 'admin' : 'student') as UserRole,
          is_locked: false,
          created_at: dbUser.created_at || sessionUser.created_at || new Date().toISOString(),
        };
      }

      // If no row exists in public.users yet, insert default record non-destructively
      const dbRole = isAdm ? 'admin' : 'user';
      try {
        await supabase.from('users').insert({
          id: userId,
          email: userEmail,
          full_name: metaFullName,
          avatar_url: metaAvatar,
          role: dbRole,
          is_locked: false,
        });
      } catch (insertErr) {
        console.warn('Insert public.users notice:', insertErr);
      }

      return {
        id: userId,
        full_name: metaFullName,
        email: userEmail,
        avatar_url: metaAvatar,
        role: isAdm ? 'admin' : 'student',
        is_locked: false,
        created_at: sessionUser.created_at || new Date().toISOString(),
      };
    } catch (err: any) {
      if (err?.message === 'ACCOUNT_LOCKED') {
        throw err;
      }
      // If public.users query fails transiently, keep user authenticated with session metadata
      console.warn('Profile fetch fallback to session metadata:', err);
      return {
        id: userId,
        full_name: metaFullName,
        email: userEmail,
        avatar_url: metaAvatar,
        role: isAdm ? 'admin' : 'student',
        is_locked: false,
        created_at: sessionUser.created_at || new Date().toISOString(),
      };
    }
  }, []);

  // Fetch or sync the latest profile from Supabase Auth & public.users
  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    // Deduplicate in-flight profile resolution to prevent races
    if (inFlightProfilePromiseRef.current) {
      return inFlightProfilePromiseRef.current;
    }

    const task = (async (): Promise<UserProfile | null> => {
      try {
        // 1. Authoritative check with Supabase Auth
        const { data: sessionData } = await supabase.auth.getSession();
        let sessionUser = sessionData?.session?.user;

        if (!sessionUser) {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            sessionUser = userData.user;
          }
        }

        if (sessionUser) {
          try {
            const profile = await resolveUserProfile(sessionUser);
            userRef.current = profile;
            setUser(profile);
            store.setCurrentUser(profile);
            syncCookies(profile);
            return profile;
          } catch (lockErr: any) {
            if (lockErr?.message === 'ACCOUNT_LOCKED') {
              await supabase.auth.signOut();
              userRef.current = null;
              setUser(null);
              store.logout();
              syncCookies(null);
              return null;
            }
            throw lockErr;
          }
        }

        // Definitively unauthenticated in Supabase Auth
        userRef.current = null;
        setUser(null);
        store.setCurrentUser(null);
        syncCookies(null);
        return null;
      } catch (e) {
        console.warn('Auth refresh transient error:', e);
        // On transient network error or navigation abort, preserve active user in memory
        if (userRef.current) {
          return userRef.current;
        }
        return null;
      } finally {
        inFlightProfilePromiseRef.current = null;
      }
    })();

    inFlightProfilePromiseRef.current = task;
    return task;
  }, [resolveUserProfile, syncCookies]);

  // Initial authentication check on application mount
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        await refreshUser();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
      store.loadFromSupabase().catch(() => {});
    };

    initAuth();

    // Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        userRef.current = null;
        setUser(null);
        store.logout();
        syncCookies(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          await refreshUser();
        }
        setIsLoading(false);
      } else if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          await refreshUser();
        }
        // Let initAuth() set isLoading(false) authoritatively
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [refreshUser, syncCookies]);

  // Login function using Supabase Auth as the ONLY source of truth
  const login = useCallback(async (
    email: string, 
    pass: string
  ): Promise<{ success: boolean; message?: string; role?: string }> => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });

      if (error) {
        setIsLoading(false);
        const errorMessage = extractAuthErrorMessage(error);
        return {
          success: false,
          message: errorMessage,
        };
      }

      if (!data?.user) {
        setIsLoading(false);
        return {
          success: false,
          message: 'Không tìm thấy thông tin tài khoản sau xác thực.',
        };
      }

      // 2. Resolve profile from Supabase public.users
      try {
        const profile = await resolveUserProfile(data.user);
        userRef.current = profile;
        setUser(profile);
        store.setCurrentUser(profile);
        syncCookies(profile);
        setIsLoading(false);
        return { success: true, role: profile.role };
      } catch (lockErr: any) {
        await supabase.auth.signOut();
        setIsLoading(false);
        return { success: false, message: 'Tài khoản của bạn đã bị khóa bởi Ban Quản Trị.' };
      }
    } catch (err: any) {
      console.error('Login process error:', err);
      setIsLoading(false);
      const errorMessage = extractAuthErrorMessage(err);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }, [resolveUserProfile, syncCookies]);

  // Logout function
  const logout = useCallback(async () => {
    setIsLoading(true);
    userRef.current = null;
    setUser(null);
    store.logout();
    syncCookies(null);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Signout warning:', e);
    } finally {
      setIsLoading(false);
    }
  }, [syncCookies]);

  const isAdmin = user?.role === 'admin' || user?.email?.toLowerCase() === ADMIN_EMAIL;
  const isLocked = Boolean(user?.is_locked);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin,
        isLocked,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
