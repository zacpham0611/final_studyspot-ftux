import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { store } from '@/lib/data/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();

const isUuid = (str?: string | null): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const roleCookie = request.cookies.get('studyspot_role')?.value?.toLowerCase();
    const emailCookie = request.cookies.get('studyspot_user_email')?.value?.toLowerCase();
    const isAdmin = roleCookie === 'admin' || emailCookie === ADMIN_EMAIL;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      let query = supabaseAdmin
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId && !isAdmin && isUuid(userId)) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (!error && data) {
        return NextResponse.json(
          { notifications: data },
          { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
        );
      }
    }

    // Fallback to store
    const notifications = store.getNotifications(userId || undefined);
    return NextResponse.json(
      { notifications },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    );
  } catch (e: any) {
    return NextResponse.json({ notifications: [], error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, noi_dung, link } = body;

    if (!noi_dung?.trim()) {
      return NextResponse.json({ success: false, error: 'Thiếu nội dung thông báo' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      let targetUserId = userId;

      // If targetUserId is not a valid UUID or is the admin placeholder, find real admin UUID in public.users
      if (!isUuid(targetUserId) || targetUserId === 'a0000000-0000-0000-0000-000000000001') {
        const { data: adminUsers } = await supabaseAdmin
          .from('users')
          .select('id')
          .or(`role.eq.admin,email.ilike.${ADMIN_EMAIL}`)
          .limit(1);

        if (adminUsers && adminUsers.length > 0) {
          targetUserId = adminUsers[0].id;
        } else {
          // If no admin in public.users, check auth.admin
          try {
            const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
            const authAdmin = authList?.users?.find(
              (u) => u.email?.toLowerCase() === ADMIN_EMAIL || u.user_metadata?.role === 'admin'
            );
            if (authAdmin) {
              await supabaseAdmin.from('users').upsert({
                id: authAdmin.id,
                email: authAdmin.email || ADMIN_EMAIL,
                full_name: authAdmin.user_metadata?.full_name || 'Admin StudySpot',
                role: 'admin',
              });
              targetUserId = authAdmin.id;
            }
          } catch (authErr) {}
        }
      }

      if (isUuid(targetUserId)) {
        const { data, error } = await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: targetUserId,
            noi_dung: noi_dung.trim(),
            link: link || null,
            is_read: false,
          })
          .select()
          .single();

        if (!error && data) {
          return NextResponse.json({ success: true, notification: data });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, userId, markAll } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      if (markAll && userId && isUuid(userId)) {
        await supabaseAdmin.from('notifications').update({ is_read: true }).eq('user_id', userId);
      } else if (notificationId && isUuid(notificationId)) {
        await supabaseAdmin.from('notifications').update({ is_read: true }).eq('id', notificationId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
