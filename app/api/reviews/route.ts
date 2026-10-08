import { NextRequest, NextResponse } from 'next/server';
import { store, isUuid } from '@/lib/data/store';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getSupabaseAdminClient(request?: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  }

  const authHeader = request?.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
  }

  if (request) {
    try {
      const serverClient = createServerSupabase();
      const { data: { session } } = await serverClient.auth.getSession();
      if (session?.access_token) {
        return serverClient;
      }
    } catch (e) {}
  }

  return createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId') || searchParams.get('place_id');
  const includeHidden =
    searchParams.get('includeHidden') === 'true' ||
    searchParams.get('admin') === '1' ||
    searchParams.get('all') === '1';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
    try {
      const supabaseAdmin = await getSupabaseAdminClient(request);
      let query = supabaseAdmin
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (!includeHidden) {
        query = query.eq('is_hidden', false);
      }

      if (placeId && placeId !== 'all') {
        query = query.eq('place_id', placeId);
      }

      const { data: revData, error: revError } = await query;

      if (!revError && revData) {
        const userIds = Array.from(new Set(revData.map((r: any) => r.user_id).filter(Boolean)));
        const placeIds = Array.from(new Set(revData.map((r: any) => r.place_id).filter(Boolean)));

        let userMap: Record<string, any> = {};
        let placeMap: Record<string, any> = {};

        const batchTasks = [];
        if (userIds.length > 0) {
          batchTasks.push(
            supabaseAdmin
              .from('users')
              .select('id, full_name, avatar_url')
              .in('id', userIds)
              .then(({ data: usersData }) => {
                if (usersData) {
                  userMap = Object.fromEntries(usersData.map((u: any) => [u.id, u]));
                }
              })
          );
        }

        if (placeIds.length > 0) {
          batchTasks.push(
            supabaseAdmin
              .from('places')
              .select('id, name')
              .in('id', placeIds)
              .then(({ data: placesData }) => {
                if (placesData) {
                  placeMap = Object.fromEntries(placesData.map((p: any) => [p.id, p]));
                }
              })
          );
        }

        await Promise.all(batchTasks);

        const enriched = revData.map((r: any) => ({
          ...r,
          user: userMap[r.user_id] || r.user || null,
          place: placeMap[r.place_id] ? { id: placeMap[r.place_id].id, name: placeMap[r.place_id].name } : null,
        }));

        return NextResponse.json({ reviews: enriched, count: enriched.length });
      }
    } catch (e: any) {
      console.warn('GET /api/reviews Supabase notice:', e.message);
    }
  }

  // Fallback to store
  let reviews = includeHidden
    ? store.getAllReviewsAdmin()
    : placeId && placeId !== 'all'
    ? store.getReviewsForPlace(placeId)
    : store.getAllReviewsAdmin().filter((r) => !r.is_hidden);

  if (placeId && placeId !== 'all') {
    reviews = reviews.filter((r) => r.place_id === placeId);
  }

  const allPlaces = store.getAllPlacesAdmin();
  const placeLookup = Object.fromEntries(allPlaces.map((p) => [p.id, { id: p.id, name: p.name }]));
  const enrichedFallback = reviews.map((r) => ({
    ...r,
    place: r.place || placeLookup[r.place_id] || null,
  }));

  return NextResponse.json({ reviews: enrichedFallback, count: enrichedFallback.length });
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

    if (supabaseUrl && !supabaseUrl.includes('placeholder') && isUuid(reviewId)) {
      try {
        const supabaseAdmin = await getSupabaseAdminClient(request);
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
    if (typeof is_hidden === 'boolean') {
      store.setReviewHidden(reviewId, is_hidden);
    } else {
      store.toggleHideReview(reviewId);
    }

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

    if (supabaseUrl && !supabaseUrl.includes('placeholder') && isUuid(reviewId)) {
      try {
        const supabaseAdmin = await getSupabaseAdminClient(request);
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
