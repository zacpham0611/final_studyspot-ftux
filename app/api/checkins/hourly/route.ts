import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { store } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();
    const roleCookie = request.cookies.get('studyspot_role')?.value?.toLowerCase();
    const emailCookie = request.cookies.get('studyspot_user_email')?.value?.toLowerCase();

    const isAdmin = roleCookie === 'admin' || (emailCookie && emailCookie === ADMIN_EMAIL);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Quản trị viên mới có quyền thiết lập dữ liệu độ đông.' },
        { status: 403 }
      );
    }

    const { placeId, hourlyData } = await request.json();
    if (!placeId || !Array.isArray(hourlyData)) {
      return NextResponse.json({ success: false, error: 'Thiếu placeId hoặc hourlyData' }, { status: 400 });
    }

    // 1. Update in local store
    store.setHourlyCrowdData(placeId, hourlyData);

    // 2. Batch persist to Supabase Database (public.checkins) in a single DB operation
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });

        // Batch delete existing checkins for this place
        await supabaseAdmin.from('checkins').delete().eq('place_id', placeId);

        // Prepare batch rows for all hours (07:00 to 22:00)
        const today = new Date();
        const rows = hourlyData.map((item: { hour: number; level: number }) => {
          const d = new Date(today);
          d.setHours(item.hour, 0, 0, 0);
          return {
            place_id: placeId,
            user_id: 'a0000000-0000-0000-0000-000000000001',
            level: item.level,
            note: 'Admin thiết lập độ đông',
            created_at: d.toISOString(),
          };
        });

        // Single batch insert of all 16 rows at once
        const { error: insErr } = await supabaseAdmin.from('checkins').insert(rows);
        if (insErr) {
          console.error('Supabase checkins batch insert error:', insErr.message);
          return NextResponse.json(
            { success: false, error: `Lỗi batch insert vào Supabase: ${insErr.message}` },
            { status: 500 }
          );
        }
      } catch (err: any) {
        console.error('Supabase checkins update exception:', err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, placeId, count: hourlyData.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
