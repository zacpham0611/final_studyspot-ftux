import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { store } from '@/lib/data/store';

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
