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

  // Filter out empty JSON, raw stringified object representations
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

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Sync user state to browser cookies for Next.js middleware
  const syncCookies = useCallback((usr: UserProfile | null) => {
    if (typeof document === 'undefined') return;
    if (usr) {
      const isAdm = usr.email.toLowerCase() === ADMIN_EMAIL || usr.role === 'admin';
      const role = isAdm ? 'admin' : (usr.role || 'student');
      document.cookie = `studyspot_role=${role}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `studyspot_user_email=${usr.email.toLowerCase()}; path=/; max-age=604800; SameSite=Lax`;
    } else {
      document.cookie = 'studyspot_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'studyspot_user_email=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }, []);

  // Fetch or sync the latest profile from Supabase Database (public.users)
  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      // 1. Check active Supabase session (primary: getSession, fallback: getUser)
      let sessionUser: any = null;
      let sessionCreatedAt: string | undefined = undefined;

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        sessionUser = sessionData.session.user;
        sessionCreatedAt = sessionData.session.user.created_at;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          sessionUser = userData.user;
          sessionCreatedAt = userData.user.created_at;
        }
      }
      
      if (sessionUser) {
        const userId = sessionUser.id;
        const userEmail = sessionUser.email?.toLowerCase() || '';
        const isAdm = userEmail === ADMIN_EMAIL;
        const targetRole: UserRole = isAdm ? 'admin' : 'student';
        const dbRole = isAdm ? 'admin' : 'user';

        // 2. Query public.users table directly from Supabase
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (dbUser) {
          // If locked by admin, terminate session immediately
          if (dbUser.is_locked) {
            await supabase.auth.signOut();
            store.logout();
            setUser(null);
            syncCookies(null);
            return null;
          }

          const isUserAdmin = isAdm || dbUser.role === 'admin';
          const resolvedUser: UserProfile = {
            id: dbUser.id,
            full_name: dbUser.full_name || sessionUser.user_metadata?.full_name || userEmail.split('@')[0],
            email: userEmail,
            avatar_url: dbUser.avatar_url || sessionUser.user_metadata?.avatar_url || null,
            role: (isUserAdmin ? 'admin' : 'student') as UserRole,
            is_locked: false,
            created_at: dbUser.created_at || sessionCreatedAt || new Date().toISOString(),
          };

          store.setCurrentUser(resolvedUser);
          setUser(resolvedUser);
          syncCookies(resolvedUser);
          return resolvedUser;
        } else {
          // User exists in auth but not yet in public.users -> insert directly with valid dbRole ('admin' | 'user')
          const newUser: UserProfile = {
            id: userId,
            full_name: sessionUser.user_metadata?.full_name || userEmail.split('@')[0],
            email: userEmail,
            avatar_url: sessionUser.user_metadata?.avatar_url || null,
            role: targetRole,
            is_locked: false,
            created_at: sessionCreatedAt || new Date().toISOString(),
          };

          try {
            await supabase.from('users').insert({
              id: userId,
              full_name: newUser.full_name,
              email: userEmail,
              avatar_url: newUser.avatar_url,
              role: dbRole,
              is_locked: false,
            });
          } catch (e) {
            console.warn('Insert public.users fallback notice:', e);
          }

          store.setCurrentUser(newUser);
          setUser(newUser);
          syncCookies(newUser);
          return newUser;
        }
      }

      // If no active Supabase auth session:
      const isSupabaseConfigured = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
      );

      if (!isSupabaseConfigured) {
        const currentStored = store.getCurrentUser();
        if (currentStored) {
          setUser(currentStored);
          syncCookies(currentStored);
          return currentStored;
        }
      }

      // Truly Unauthenticated Guest
      store.setCurrentUser(null);
      setUser(null);
      syncCookies(null);
      return null;
    } catch (e) {
      console.warn('Auth refresh warning:', e);
      // Resilience against transient network failure or navigation abort:
      // If we already have a valid user in store/ref, preserve it instead of dropping session
      const existingUser = userRef.current || store.getCurrentUser();
      if (existingUser) {
        return existingUser;
      }
      return null;
    }
  }, [syncCookies]);

  // Initial authentication check on application mount
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      setIsLoading(true);
      await refreshUser();
      if (mounted) {
        setIsLoading(false);
      }
      // Load Supabase Database places & reviews into store asynchronously in the background
      store.loadFromSupabase().catch(() => {});
    };

    initAuth();

    // Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        store.setCurrentUser(null);
        setUser(null);
        syncCookies(null);
        if (mounted) setIsLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          await refreshUser();
        }
        if (mounted) setIsLoading(false);
      } else if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          await refreshUser();
          if (mounted) setIsLoading(false);
        }
        // Do NOT eagerly clear user if session is null on INITIAL_SESSION:
        // initAuth() runs concurrently and performs authoritative session verification.
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [refreshUser, syncCookies]);

  // Robust Login function with full DB synchronization before navigation
  const login = useCallback(async (
    email: string, 
    pass: string
  ): Promise<{ success: boolean; message?: string; role?: string }> => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const isAdm = cleanEmail === ADMIN_EMAIL;
    const targetRole: UserRole = isAdm ? 'admin' : 'student';

    try {
      // 1. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });

      if (!error && data?.user) {
        const sessionUser = data.user;

        // 2. Await profile & role verification from Supabase public.users
        let fullName = sessionUser.user_metadata?.full_name || cleanEmail.split('@')[0];
        let avatarUrl = sessionUser.user_metadata?.avatar_url || null;

        let existingDbUser: any = null;

        try {
          const { data: dbUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', sessionUser.id)
            .single();

          if (dbUser) {
            existingDbUser = dbUser;
            if (dbUser.is_locked) {
              await supabase.auth.signOut();
              store.logout();
              setUser(null);
              syncCookies(null);
              setIsLoading(false);
              return { success: false, message: 'Tài khoản của bạn đã bị khóa bởi Ban Quản Trị.' };
            }
            if (dbUser.full_name) fullName = dbUser.full_name;
            if (dbUser.avatar_url) avatarUrl = dbUser.avatar_url;
          }
        } catch (dbErr) {
          console.warn('DB user lookup notice:', dbErr);
        }

        // Determine effective roles:
        // In PostgreSQL public.users: role can only be 'admin' or 'user' (never 'student')
        // In UI UserProfile: role is 'admin' or 'student'
        const isUserAdmin = isAdm || existingDbUser?.role === 'admin';
        const finalUiRole: UserRole = isUserAdmin ? 'admin' : 'student';
        const dbRole = isUserAdmin ? 'admin' : 'user';

        // 3. Only if no record exists in public.users, insert profile (NEVER overwrite existing role)
        if (!existingDbUser) {
          try {
            await supabase.from('users').insert({
              id: sessionUser.id,
              email: cleanEmail,
              full_name: fullName,
              avatar_url: avatarUrl,
              role: dbRole,
              is_locked: false,
            });
          } catch (insertErr) {
            console.warn('DB insert notice:', insertErr);
          }
        }

        const authenticatedUser: UserProfile = {
          id: sessionUser.id,
          full_name: fullName,
          email: cleanEmail,
          avatar_url: avatarUrl,
          role: finalUiRole,
          is_locked: false,
          created_at: existingDbUser?.created_at || sessionUser.created_at || new Date().toISOString(),
        };

        // 4. Set cookies and client store BEFORE resolving
        syncCookies(authenticatedUser);
        store.setCurrentUser(authenticatedUser);
        setUser(authenticatedUser);
        setIsLoading(false);

        return { success: true, role: finalUiRole };
      }

      // 5. Fallback for demo / offline accounts in local store ONLY when Supabase is not configured
      const isSupabaseConfigured = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
      );

      if (!isSupabaseConfigured) {
        const localRes = store.loginWithEmail(cleanEmail, pass);
        if (localRes.success && localRes.user) {
          const localUser = localRes.user;
          localUser.role = targetRole;
          syncCookies(localUser);
          store.setCurrentUser(localUser);
          setUser(localUser);
          setIsLoading(false);
          return { success: true, role: targetRole };
        }
      }

      const errorMessage = extractAuthErrorMessage(error);
      setIsLoading(false);
      return {
        success: false,
        message: errorMessage,
      };
    } catch (err: any) {
      console.error('Login process error:', err);
      // Offline fallback only when Supabase is not configured
      const isSupabaseConfigured = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
      );

      if (!isSupabaseConfigured) {
        const localRes = store.loginWithEmail(cleanEmail, pass);
        if (localRes.success && localRes.user) {
          const localUser = localRes.user;
          localUser.role = targetRole;
          syncCookies(localUser);
          store.setCurrentUser(localUser);
          setUser(localUser);
          setIsLoading(false);
          return { success: true, role: targetRole };
        }
      }

      const errorMessage = extractAuthErrorMessage(err);
      setIsLoading(false);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }, [syncCookies]);

  // Logout function
  const logout = useCallback(async () => {
    setIsLoading(true);
    store.logout();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Signout warning:', e);
    }
    setUser(null);
    syncCookies(null);
    setIsLoading(false);
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
