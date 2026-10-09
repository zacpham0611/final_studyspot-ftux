import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { store } from '@/lib/data/store';

export async function GET(request: NextRequest) {
  try {
    const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();
    const roleCookie = request.cookies.get('studyspot_role')?.value?.toLowerCase();
    const emailCookie = request.cookies.get('studyspot_user_email')?.value?.toLowerCase();

    const isAdmin = roleCookie === 'admin' || (emailCookie && emailCookie === ADMIN_EMAIL);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Từ chối truy cập: Chỉ Quản trị viên mới có quyền xem danh sách.' },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase URL hoặc API Key hợp lệ' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Fetch live user list directly from public.users
    const { data: dbUsers, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, avatar_url, role, is_locked, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase get users error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let usersList: any[] = dbUsers || [];

    // 2. Also check if there are auth.users not yet inserted into public.users (e.g. trigger didn't run)
    try {
      const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers();
      if (authUsersData?.users && authUsersData.users.length > 0) {
        for (const au of authUsersData.users) {
          const exists = usersList.some((u) => u.id === au.id || u.email?.toLowerCase() === au.email?.toLowerCase());
          if (!exists && au.email) {
            const newRow = {
              id: au.id,
              email: au.email.toLowerCase(),
              full_name: au.user_metadata?.full_name || au.email.split('@')[0],
              avatar_url: au.user_metadata?.avatar_url || null,
              role: au.email.toLowerCase() === ADMIN_EMAIL ? 'admin' : (au.user_metadata?.role || 'user'),
              is_locked: false,
              created_at: au.created_at || new Date().toISOString(),
            };
            await supabaseAdmin.from('users').upsert(newRow);
            usersList.unshift(newRow);
          }
        }
      }
    } catch (authErr: any) {
      console.warn('Auth admin listUsers notice:', authErr.message);
    }

    store.syncUsersFromSupabase(usersList);
    return NextResponse.json({ success: true, users: usersList, source: 'supabase' });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // 1. Authorize: Only authenticated admins can call this endpoint
    const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();
    const roleCookie = request.cookies.get('studyspot_role')?.value?.toLowerCase();
    const emailCookie = request.cookies.get('studyspot_user_email')?.value?.toLowerCase();

    const isAdmin = roleCookie === 'admin' || (emailCookie && emailCookie === ADMIN_EMAIL);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Từ chối truy cập: Chỉ Quản trị viên mới có quyền thực hiện thao tác này.' },
        { status: 403 }
      );
    }

    const { userId, isLocked } = await request.json();
    if (!userId || typeof isLocked !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Thiếu userId hoặc isLocked' }, { status: 400 });
    }

    // 1. Sync in local store
    store.setUserLocked(userId, isLocked);

    // 2. Sync to Supabase Database (public.users) if configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

    if (isUuid && supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });

        const { error } = await supabaseAdmin
          .from('users')
          .update({ is_locked: isLocked })
          .eq('id', userId);

        if (error) {
          console.warn('API users update error:', error.message);
          // If network host cannot be resolved (local demo URL), permit store persistence
          if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
            return NextResponse.json({ success: true, userId, is_locked: isLocked, offline: true });
          }
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
      } catch (err: any) {
        console.warn('API users update network notice:', err.message);
        if (err.message.includes('fetch failed') || err.message.includes('ENOTFOUND')) {
          return NextResponse.json({ success: true, userId, is_locked: isLocked, offline: true });
        }
      }
    }

    return NextResponse.json({ success: true, userId, is_locked: isLocked });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();
    const roleCookie = request.cookies.get('studyspot_role')?.value?.toLowerCase();
    const rawEmailCookie = request.cookies.get('studyspot_user_email')?.value;
    const emailCookie = rawEmailCookie ? decodeURIComponent(rawEmailCookie).toLowerCase() : '';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;

    let callerUser: { id: string; email?: string } | null = null;
    let isCallerAdmin = false;

    // 1. Verify caller identity via Supabase Auth SSR session
    if (supabaseUrl && anonKey && !supabaseUrl.includes('placeholder')) {
      try {
        const supabase = createServerClient(supabaseUrl, anonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {},
          },
        });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          callerUser = user;
          if (user.email?.toLowerCase() === ADMIN_EMAIL) {
            isCallerAdmin = true;
          } else if (serviceKey) {
            const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
            const { data: dbCaller } = await adminClient.from('users').select('role, email').eq('id', user.id).maybeSingle();
            if (dbCaller?.role === 'admin' || dbCaller?.email?.toLowerCase() === ADMIN_EMAIL) {
              isCallerAdmin = true;
            }
          }
        }
      } catch (authErr) {
        console.warn('Caller auth check notice:', authErr);
      }
    }

    // Fallback verification for cookie-based session
    if (!isCallerAdmin) {
      if (roleCookie === 'admin' || (emailCookie && emailCookie === ADMIN_EMAIL)) {
        isCallerAdmin = true;
        if (!callerUser && emailCookie) {
          callerUser = { id: '', email: emailCookie };
        }
      }
    }

    if (!isCallerAdmin) {
      return NextResponse.json(
        { success: false, error: 'Từ chối truy cập: Chỉ Quản trị viên mới có quyền thực hiện thao tác xóa tài khoản.' },
        { status: 403 }
      );
    }

    let targetUserId = '';
    try {
      const body = await request.json();
      targetUserId = body?.userId;
    } catch {
      targetUserId = request.nextUrl.searchParams.get('userId') || '';
    }

    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Thiếu ID người dùng cần xóa.' },
        { status: 400 }
      );
    }

    const cleanTargetId = targetUserId.trim();

    // 2. Prevent Admin from deleting their own logged-in account
    if (
      callerUser &&
      (callerUser.id === cleanTargetId ||
        (callerUser.email && callerUser.email.toLowerCase() === ADMIN_EMAIL && cleanTargetId === 'a0000000-0000-0000-0000-000000000001'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Bạn không thể tự xóa tài khoản Quản trị viên của chính mình!' },
        { status: 400 }
      );
    }

    // 3. Retrieve target user record to validate constraints
    let targetUser: any = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanTargetId);
    let supabaseAdmin: any = null;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data: dbTarget } = await supabaseAdmin.from('users').select('*').eq('id', cleanTargetId).maybeSingle();
      targetUser = dbTarget;
    }

    if (!targetUser) {
      targetUser = store.getUserById(cleanTargetId);
    }

    if (targetUser) {
      // Prevent deleting self via email match
      if (callerUser?.email && targetUser.email && callerUser.email.toLowerCase() === targetUser.email.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: 'Bạn không thể tự xóa tài khoản của chính mình!' },
          { status: 400 }
        );
      }

      // Prevent deleting default system admin
      if (targetUser.email?.toLowerCase() === ADMIN_EMAIL || cleanTargetId === 'a0000000-0000-0000-0000-000000000001') {
        return NextResponse.json(
          { success: false, error: 'Không thể xóa tài khoản Quản trị viên mặc định của hệ thống!' },
          { status: 400 }
        );
      }

      // Prevent deleting the last remaining admin
      if (targetUser.role === 'admin') {
        let adminCount = 0;
        if (supabaseAdmin) {
          const { count } = await supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin');
          adminCount = count ?? 0;
        } else {
          adminCount = store.getUsers().filter((u) => u.role === 'admin').length;
        }

        if (adminCount <= 1) {
          return NextResponse.json(
            { success: false, error: 'Không thể xóa tài khoản Quản trị viên cuối cùng trong hệ thống!' },
            { status: 400 }
          );
        }
      }
    }

    // 4. Perform safe database deletion
    if (supabaseAdmin && isUuid) {
      try {
        // Disassociate places created by this user to preserve place data without foreign key conflict
        await supabaseAdmin.from('places').update({ created_by: null }).eq('created_by', cleanTargetId);

        // Delete from public.users table
        const { error: dbDeleteErr } = await supabaseAdmin.from('users').delete().eq('id', cleanTargetId);
        if (dbDeleteErr) {
          console.error('Supabase delete public.users error:', dbDeleteErr.message);
          return NextResponse.json({ success: false, error: dbDeleteErr.message }, { status: 500 });
        }

        // Delete from Supabase Auth (auth.users) via Service Role Admin API
        try {
          const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(cleanTargetId);
          if (authDeleteErr) {
            console.warn('Supabase auth.admin.deleteUser notice:', authDeleteErr.message);
          }
        } catch (authErr: any) {
          console.warn('Supabase auth.admin.deleteUser exception:', authErr.message);
        }
      } catch (dbErr: any) {
        console.error('Database deletion error:', dbErr.message);
        if (!dbErr.message.includes('fetch failed') && !dbErr.message.includes('ENOTFOUND')) {
          return NextResponse.json({ success: false, error: dbErr.message }, { status: 500 });
        }
      }
    }

    // 5. Update in-memory store
    store.deleteUser(cleanTargetId);

    return NextResponse.json({
      success: true,
      userId: cleanTargetId,
      message: 'Đã xóa vĩnh viễn tài khoản người dùng thành công.',
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
