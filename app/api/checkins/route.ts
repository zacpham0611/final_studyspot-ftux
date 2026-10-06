import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { store } from '@/lib/data/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const isUuid = (str?: string | null): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const placeId = searchParams.get('placeId');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      // Join with places!inner to guarantee that ONLY checkins for real, existing places are returned
      let query = supabaseAdmin
        .from('checkins')
        .select('*, place:places!inner(id, name, status, address)')
        .order('created_at', { ascending: false });

      if (userId && isUuid(userId)) {
        query = query.eq('user_id', userId);
      }
      if (placeId) {
        query = query.eq('place_id', placeId);
      }

      const { data, error } = await query;
      if (!error && data) {
        return NextResponse.json({ checkins: data });
      }
    }

    // Fallback: only checkins linked to valid places in store
    let checkins = store.getAllCheckins();
    if (userId) {
      checkins = checkins.filter((c) => c.user_id === userId);
    }
    if (placeId) {
      checkins = checkins.filter((c) => c.place_id === placeId);
    }
    return NextResponse.json({ checkins });
  } catch (e: any) {
    return NextResponse.json({ checkins: [], error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { placeId, level, note, userId } = body;

    if (!placeId || !level) {
      return NextResponse.json({ success: false, message: 'Thiếu placeId hoặc level' }, { status: 400 });
    }

    let targetPlaceId = placeId;
    if (!isUuid(targetPlaceId)) {
      const matched = store.getPlaceById(placeId);
      if (matched && isUuid(matched.id)) {
        targetPlaceId = matched.id;
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseAdmin = (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder'))
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;

    let targetUserId: string | null = null;
    let userProfile: any = null;

    if (supabaseAdmin) {
      // 1. Verification of user session strictly via Supabase Auth (Bearer token OR verified SSR session)
      let authenticatedUserId: string | null = null;

      // 1a. Verify Bearer token if provided
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

      if (token) {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (!authErr && authData?.user) {
          authenticatedUserId = authData.user.id;
        }
      }

      // 1b. Check SSR Supabase session via createServerSupabase if Bearer token was not present or failed
      if (!authenticatedUserId) {
        try {
          const serverSupabase = createServerSupabase();
          const { data: serverAuth, error: serverAuthErr } = await serverSupabase.auth.getUser();
          if (!serverAuthErr && serverAuth?.user) {
            authenticatedUserId = serverAuth.user.id;
          }
        } catch (cookieErr) {}
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('[CHECKIN DEBUG server]', {
          hasAuthHeader: Boolean(authHeader),
          hasBearerToken: Boolean(token),
          bearerVerified: Boolean(token && authenticatedUserId),
          hasSsrUser: Boolean(!token && authenticatedUserId),
          authenticatedUserId,
          providedUserId: userId,
        });
      }

      // 1c. If user is not authenticated through Supabase Auth, reject immediately
      if (!authenticatedUserId) {
        return NextResponse.json(
          { success: false, message: 'Vui lòng đăng nhập để báo độ đông (check-in)!' },
          { status: 401 }
        );
      }

      // Reject spoofed body.userId if client explicitly provided a different ID
      if (userId && userId !== authenticatedUserId) {
        return NextResponse.json(
          { success: false, message: 'User ID không khớp với phiên đăng nhập!' },
          { status: 403 }
        );
      }

      // Enforce authenticated user from verified session
      targetUserId = authenticatedUserId;

      // 2. Query user profile from public.users and check locked status
      if (!userProfile) {
        const { data: dbUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', targetUserId)
          .maybeSingle();

        if (dbUser) {
          userProfile = dbUser;
        } else {
          userProfile = {
            id: targetUserId,
            full_name: 'Sinh viên FTU',
            role: 'student',
            is_locked: false,
          };
        }
      }

      if (userProfile.is_locked) {
        return NextResponse.json(
          { success: false, message: 'Tài khoản của bạn đã bị khóa bởi Ban Quản Trị.' },
          { status: 403 }
        );
      }
    } else {
      // Fallback only when Supabase is not configured (mock/local environment)
      targetUserId = userId || null;
      if (!targetUserId) {
        return NextResponse.json(
          { success: false, message: 'Vui lòng đăng nhập để báo độ đông (check-in)!' },
          { status: 401 }
        );
      }
      userProfile = store.getUsers().find((u) => u.id === targetUserId) || {
        id: targetUserId,
        full_name: 'Sinh viên FTU',
        role: 'student',
        is_locked: false,
      };
    }

    if (!targetUserId || !userProfile) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng đăng nhập để báo độ đông (check-in)!' },
        { status: 401 }
      );
    }

    // 4. Validate place existence in Supabase
    let insertedCheckin: any = null;
    if (supabaseAdmin) {
      const { data: placeRow } = await supabaseAdmin
        .from('places')
        .select('id')
        .eq('id', targetPlaceId)
        .maybeSingle();

      if (!placeRow) {
        return NextResponse.json(
          { success: false, message: 'Địa điểm không tồn tại hoặc đã bị xóa.' },
          { status: 404 }
        );
      }

      if (isUuid(targetPlaceId) && isUuid(targetUserId)) {
        const { data: chkData, error: chkErr } = await supabaseAdmin
          .from('checkins')
          .insert({
            place_id: targetPlaceId,
            user_id: targetUserId,
            level,
            note: note ? note.slice(0, 100) : null,
          })
          .select('*, user:users(full_name, avatar_url)')
          .single();

        if (chkErr) {
          if (chkErr.message?.includes('CHECKIN_COOLDOWN') || chkErr.message?.includes('cooldown')) {
            return NextResponse.json(
              { success: false, message: 'CHECKIN_COOLDOWN: Bạn chỉ có thể check-in tại quán này sau 30 phút.' },
              { status: 429 }
            );
          }
          console.error('Supabase checkin insert error:', chkErr.message);
          return NextResponse.json({ success: false, error: chkErr.message }, { status: 500 });
        }
        insertedCheckin = chkData;
      }
    }

    // 5. Sync to server-side store with explicit userProfile
    const result = store.addCheckin(targetPlaceId, level, note, userProfile);
    if (!result.success) {
      return NextResponse.json(result, { status: 429 });
    }

    return NextResponse.json({
      success: true,
      message: 'Báo độ đông thành công! Cảm ơn bạn đã đóng góp cho cộng đồng FTU.',
      checkin: insertedCheckin || result.checkin,
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
