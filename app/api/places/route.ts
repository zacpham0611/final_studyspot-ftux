import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/data/store';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || undefined;
  const categoryId = searchParams.get('category') ? Number(searchParams.get('category')) : undefined;

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
