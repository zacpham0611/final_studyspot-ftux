import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
    const { placeId, level, note, userId } = await request.json();
    if (!placeId || !level) {
      return NextResponse.json({ success: false, message: 'Thiếu placeId hoặc level' }, { status: 400 });
    }

    // Validate that target place exists
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });
      const { data: placeRow } = await supabaseAdmin
        .from('places')
        .select('id')
        .eq('id', placeId)
        .maybeSingle();

      if (!placeRow) {
        return NextResponse.json(
          { success: false, message: 'Địa điểm không tồn tại hoặc đã bị xóa.' },
          { status: 404 }
        );
      }
    }

    const result = store.addCheckin(placeId, level, note);
    if (!result.success) {
      return NextResponse.json(result, { status: 429 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
