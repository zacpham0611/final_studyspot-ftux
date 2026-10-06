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
      let data: any = null;
      const embedRes = await supabaseAdmin
        .from('reviews')
        .select('*, user:users!reviews_user_id_fkey(full_name, avatar_url)')
        .eq('place_id', placeId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      if (!embedRes.error && embedRes.data) {
        data = embedRes.data;
      } else {
        // Fallback: fetch plain reviews and join users to prevent ambiguous relationship errors
        const plainRes = await supabaseAdmin
          .from('reviews')
          .select('*')
          .eq('place_id', placeId)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false });

        if (!plainRes.error && plainRes.data) {
          const userIds = Array.from(new Set(plainRes.data.map((r: any) => r.user_id).filter(Boolean)));
          let userMap: Record<string, any> = {};
          if (userIds.length > 0) {
            const { data: usersData } = await supabaseAdmin
              .from('users')
              .select('id, full_name, avatar_url')
              .in('id', userIds);
            if (usersData) {
              userMap = Object.fromEntries(usersData.map((u: any) => [u.id, u]));
            }
          }
          data = plainRes.data.map((r: any) => ({
            ...r,
            user: userMap[r.user_id] || null,
          }));
        }
      }

      if (data) {
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
          .select('*')
          .single();

        if (error) {
          if (error.message.includes('duplicate key') || error.message.includes('unique')) {
            return NextResponse.json(
              { success: false, error: 'Bạn đã viết đánh giá cho địa điểm này rồi.' },
              { status: 409 }
            );
          }
          console.error('Supabase review insert error:', error.message);
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        } else if (data) {
          const { data: userData } = await supabaseAdmin
            .from('users')
            .select('full_name, avatar_url')
            .eq('id', user_id)
            .single();
          createdReview = {
            ...data,
            user: userData || null,
          };
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, is_hidden } = body;

    if (!reviewId) {
      return NextResponse.json({ success: false, error: 'Thiếu reviewId' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder') && isUuid(reviewId)) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const { error } = await supabaseAdmin
          .from('reviews')
          .update({ is_hidden })
          .eq('id', reviewId);

        if (error) {
          console.error('Supabase review update error:', error.message);
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
      } catch (err: any) {
        console.warn('Supabase review update network notice:', err.message);
      }
    }

    // Sync to store
    store.toggleHideReview(reviewId);

    return NextResponse.json({ success: true, reviewId, is_hidden });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('id');

    if (!reviewId) {
      return NextResponse.json({ success: false, error: 'Thiếu reviewId' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder') && isUuid(reviewId)) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        await supabaseAdmin.from('review_reports').delete().eq('review_id', reviewId);
        await supabaseAdmin.from('review_helpful').delete().eq('review_id', reviewId);
        const { error } = await supabaseAdmin.from('reviews').delete().eq('id', reviewId);
        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
      } catch (err: any) {
        console.warn('Supabase review delete network notice:', err.message);
      }
    }

    // Sync to store
    store.deleteReview(reviewId);

    return NextResponse.json({ success: true, deletedId: reviewId });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
