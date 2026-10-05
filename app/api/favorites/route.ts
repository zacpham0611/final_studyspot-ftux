import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { store, isUuid } from '@/lib/data/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Thiếu userId' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder') && isUuid(userId)) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data, error } = await supabaseAdmin
        .from('favorites')
        .select('place_id')
        .eq('user_id', userId);

      if (!error && data) {
        const placeIds = data.map((f: any) => f.place_id);
        return NextResponse.json({ success: true, placeIds });
      }
    } catch (e: any) {
      console.warn('GET /api/favorites Supabase notice:', e.message);
    }
  }

  const userFavs = store.getUserFavorites(userId).map((p) => p.id);
  return NextResponse.json({ success: true, placeIds: userFavs });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, placeId, isFavorite } = body;

    if (!userId || !placeId) {
      return NextResponse.json({ success: false, error: 'Thiếu userId hoặc placeId' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder') && isUuid(userId) && isUuid(placeId)) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        if (isFavorite) {
          await supabaseAdmin
            .from('favorites')
            .upsert({ user_id: userId, place_id: placeId });
        } else {
          await supabaseAdmin
            .from('favorites')
            .delete()
            .match({ user_id: userId, place_id: placeId });
        }
      } catch (err: any) {
        console.warn('POST /api/favorites notice:', err.message);
      }
    }

    return NextResponse.json({ success: true, userId, placeId, isFavorite });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
