import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/data/store';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || undefined;
  const categoryId = searchParams.get('category') ? Number(searchParams.get('category')) : undefined;

  // 1. Query Supabase directly if connected (ONLY status = 'approved')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });
      let q = supabaseAdmin.from('places').select('*').eq('status', 'approved');
      if (categoryId) {
        q = q.eq('category_id', categoryId);
      }
      const { data, error } = await q;
      if (!error && data) {
        let places = data.map((dp: any) => ({
          ...dp,
          opening_hours: typeof dp.opening_hours === 'string' ? JSON.parse(dp.opening_hours) : dp.opening_hours,
          price_level: dp.price_level || 2,
          images: dp.images || [],
          view_count: dp.view_count || 0,
        }));

        if (query) {
          const lowerQ = query.toLowerCase();
          places = places.filter((p: any) =>
            p.name?.toLowerCase().includes(lowerQ) ||
            p.address?.toLowerCase().includes(lowerQ) ||
            p.description?.toLowerCase().includes(lowerQ)
          );
        }

        return NextResponse.json({ places, count: places.length });
      }
    } catch (e: any) {
      console.warn('GET /api/places Supabase query notice:', e.message);
    }
  }

  // 2. Fallback to store (which strictly filters status === 'approved')
  const places = store.filterPlaces({
    query,
    categoryId,
  });

  return NextResponse.json({ places, count: places.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      category_id,
      address,
      lat,
      lng,
      description,
      opening_hours,
      price_level,
      images,
      created_by,
      amenities,
    } = body;

    if (!name?.trim() || !address?.trim() || lat == null || lng == null) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc: tên, địa chỉ hoặc tọa độ của địa điểm' },
        { status: 400 }
      );
    }

    let createdId: string | null = null;
    let createdLat = Number(lat);
    let createdLng = Number(lng);

    // 1. Persist directly to Supabase public.places
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });

        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from('places')
          .insert({
            name: name.trim(),
            category_id: category_id || 1,
            address: address.trim(),
            lat: createdLat,
            lng: createdLng,
            description: description?.trim() || '',
            opening_hours: opening_hours || null,
            price_level: price_level || 2,
            images: images || [],
            status: 'pending',
            created_by: created_by || null,
          })
          .select('id, name, address, lat, lng')
          .single();

        if (!insertErr && inserted) {
          createdId = inserted.id;
          createdLat = Number(inserted.lat);
          createdLng = Number(inserted.lng);
        } else if (insertErr) {
          console.warn('Supabase places table insert notice:', insertErr.message);
        }
      } catch (dbErr: any) {
        console.warn('Supabase places table network exception:', dbErr.message);
      }
    }

    // 2. Persist in client store (with Supabase UUID or in-memory generated ID)
    const newPlace = store.proposePlace({
      ...body,
      id: createdId || undefined,
      lat: createdLat,
      lng: createdLng,
    });

    const finalId = createdId || newPlace.id;

    // 3. Return created record { id, name, address, lat, lng } as required
    return NextResponse.json(
      {
        success: true,
        place: {
          id: finalId,
          name: name.trim(),
          address: address.trim(),
          lat: createdLat,
          lng: createdLng,
        },
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error('API create place exception:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { placeId, status, rejectReason } = body;

    if (!placeId || !status) {
      return NextResponse.json(
        { success: false, error: 'Thiếu placeId hoặc status' },
        { status: 400 }
      );
    }

    if (!['pending', 'approved', 'rejected', 'hidden'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Trạng thái không hợp lệ' },
        { status: 400 }
      );
    }

    // 1. Update in-memory store
    if (status === 'approved') {
      store.approveProposal(placeId);
    } else if (status === 'rejected') {
      store.rejectProposal(placeId, rejectReason || 'Không đáp ứng tiêu chuẩn.');
    } else {
      store.updatePlaceStatus(placeId, status, rejectReason);
    }

    // 2. Persist directly to Supabase public.places
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });

        const updateData: any = {
          status,
        };
        if (status === 'approved') {
          updateData.approved_at = new Date().toISOString();
          updateData.reject_reason = null;
        } else if (status === 'rejected') {
          updateData.reject_reason = rejectReason || null;
        }

        const { data, error } = await supabaseAdmin
          .from('places')
          .update(updateData)
          .eq('id', placeId)
          .select()
          .single();

        if (error) {
          console.warn('Supabase places status update error:', error.message);
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, place: data });
      } catch (dbErr: any) {
        console.warn('Supabase places status update network error:', dbErr.message);
      }
    }

    return NextResponse.json({ success: true, placeId, status });
  } catch (e: any) {
    console.error('PATCH /api/places exception:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

