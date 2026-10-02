import { NextRequest, NextResponse } from 'next/server';
import { store, isUuid } from '@/lib/data/store';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId') || searchParams.get('place_id');

  if (!placeId) {
    return NextResponse.json({ success: false, message: 'placeId is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data, error } = await supabaseAdmin
        .from('reviews')
        .select('*, user:users(full_name, avatar_url)')
        .eq('place_id', placeId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return NextResponse.json({ reviews: data, count: data.length });
      }
    } catch (e: any) {
      console.warn('GET /api/reviews Supabase notice:', e.message);
    }
  }

  const reviews = store.getReviewsForPlace(placeId);
  return NextResponse.json({ reviews, count: reviews.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      place_id,
      user_id,
      rating,
      wifi_rating,
      outlet_rating,
      quiet_rating,
      price_rating,
      space_rating,
      content,
      images,
    } = body;

    if (!place_id || !user_id || !rating || !content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc: place_id, user_id, rating hoặc content' },
        { status: 400 }
      );
    }

    let targetPlaceId = place_id;
    if (!isUuid(targetPlaceId)) {
      const matched = store.getPlaceById(place_id);
      if (matched && isUuid(matched.id)) {
        targetPlaceId = matched.id;
      }
    }

    let createdReview: any = null;

    // 1. Persist to Supabase Database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder') && isUuid(targetPlaceId) && isUuid(user_id)) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const { data, error } = await supabaseAdmin
          .from('reviews')
          .insert({
            place_id: targetPlaceId,
            user_id,
            rating,
            wifi_rating,
            outlet_rating,
            quiet_rating,
            price_rating,
            space_rating,
            content: content.trim(),
            images: images || [],
            is_hidden: false,
          })
          .select('*, user:users(full_name, avatar_url)')
          .single();

        if (error) {
          if (error.message.includes('duplicate key') || error.message.includes('unique')) {
            return NextResponse.json(
              { success: false, error: 'Bạn đã viết đánh giá cho địa điểm này rồi.' },
              { status: 409 }
            );
          }
          console.warn('Supabase review insert error:', error.message);
        } else if (data) {
          createdReview = data;
        }
      } catch (dbErr: any) {
        console.warn('Supabase review insert network notice:', dbErr.message);
      }
    }

    // 2. Sync to local store
    const storeRes = store.addReview({
      place_id: targetPlaceId,
      user_id,
      rating,
      wifi_rating,
      outlet_rating,
      quiet_rating,
      price_rating,
      space_rating,
      content: content.trim(),
      images: images || [],
    });

    return NextResponse.json(
      { success: true, review: createdReview || storeRes.review },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
