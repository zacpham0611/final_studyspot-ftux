import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/data/store';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || undefined;
  const categoryId = searchParams.get('category') ? Number(searchParams.get('category')) : undefined;
  const includeAll = searchParams.get('all') === '1';

  // 1. Query Supabase directly if connected (Single Source of Truth)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });
      let q = supabaseAdmin.from('places').select('*');
      if (!includeAll) {
        q = q.eq('status', 'approved');
      }
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

        return NextResponse.json(
          { places, count: places.length },
          { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
        );
      }
    } catch (e: any) {
      console.warn('GET /api/places Supabase query notice:', e.message);
    }
  }

  // 2. Fallback to store
  const places = includeAll 
    ? store.getAllPlacesAdmin() 
    : store.filterPlaces({ query, categoryId });

  return NextResponse.json(
    { places, count: places.length },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
  );
}

const isUuid = (str?: string | null): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();

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
      status: requestedStatus,
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
    const placeStatus = (requestedStatus === 'approved' || requestedStatus === 'hidden' || requestedStatus === 'rejected')
      ? requestedStatus
      : 'pending';

    // 1. Persist directly to Supabase public.places
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      // Validate created_by foreign key to prevent PostgreSQL foreign key violation
      let validCreatedBy: string | null = null;
      if (isUuid(created_by)) {
        try {
          const { data: userRow } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', created_by)
            .maybeSingle();
          if (userRow?.id) {
            validCreatedBy = userRow.id;
          }
        } catch (uErr) {}
      }

      // Validate category_id foreign key
      let validCatId = Number(category_id) || 1;
      try {
        const { data: catRow } = await supabaseAdmin
          .from('categories')
          .select('id')
          .eq('id', validCatId)
          .maybeSingle();
        if (!catRow) {
          validCatId = 1;
        }
      } catch (cErr) {}

      const insertPayload: any = {
        name: name.trim(),
        category_id: validCatId,
        address: address.trim(),
        lat: createdLat,
        lng: createdLng,
        description: description?.trim() || '',
        opening_hours: opening_hours || null,
        price_level: Number(price_level) || 2,
        images: images && Array.isArray(images) ? images : [],
        status: placeStatus,
        created_by: validCreatedBy,
      };

      if (placeStatus === 'approved') {
        insertPayload.approved_at = new Date().toISOString();
      }

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('places')
        .insert(insertPayload)
        .select('*')
        .single();

      if (insertErr) {
        console.error('Supabase places table insert error:', insertErr.message);
        return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
      }

      if (inserted) {
        createdId = inserted.id;
        createdLat = Number(inserted.lat);
        createdLng = Number(inserted.lng);

        // Save place_amenities if provided
        if (amenities && Array.isArray(amenities) && amenities.length > 0) {
          const rows = amenities.map((a: any) => ({
            place_id: createdId,
            amenity_id: typeof a === 'object' ? a.id : Number(a),
          })).filter((r: any) => !isNaN(r.amenity_id));
          if (rows.length > 0) {
            try {
              await supabaseAdmin.from('place_amenities').insert(rows);
            } catch (paErr) {}
          }
        }

        // When a proposal is created (pending), WRITE notification into public.notifications for Admin
        if (placeStatus === 'pending') {
          try {
            // Find all Admin users in public.users
            const { data: admins } = await supabaseAdmin
              .from('users')
              .select('id')
              .or(`role.eq.admin,email.ilike.${ADMIN_EMAIL}`);

            let targetAdmins = admins && admins.length > 0 ? admins : [];

            if (targetAdmins.length === 0) {
              // Check auth.admin
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
                  targetAdmins = [{ id: authAdmin.id }];
                }
              } catch (authErr) {}
            }

            if (targetAdmins.length > 0) {
              const notifRows = targetAdmins.map((adm) => ({
                user_id: adm.id,
                noi_dung: `Có đề xuất địa điểm mới: "${name.trim()}" đang chờ duyệt.`,
                link: '/admin/de-xuat',
                is_read: false,
              }));
              await supabaseAdmin.from('notifications').insert(notifRows);
            }
          } catch (notifErr: any) {
            console.warn('Proposal notification write notice:', notifErr.message);
          }
        }

        // Also save to in-memory store
        store.savePlace({
          ...inserted,
          opening_hours: typeof inserted.opening_hours === 'string' ? JSON.parse(inserted.opening_hours) : inserted.opening_hours,
        });

        return NextResponse.json(
          {
            success: true,
            place: inserted,
          },
          { status: 201 }
        );
      }
    }

    // Fallback if Supabase not configured
    const newPlace = store.proposePlace({
      ...body,
      status: placeStatus,
      lat: createdLat,
      lng: createdLng,
    });

    return NextResponse.json(
      {
        success: true,
        place: newPlace,
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
    const { 
      placeId, 
      status, 
      rejectReason,
      name,
      category_id,
      address,
      lat,
      lng,
      description,
      price_level,
      images,
      opening_hours
    } = body;

    if (!placeId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu placeId' },
        { status: 400 }
      );
    }

    // 1. Update in-memory store
    if (status) {
      if (status === 'approved') {
        store.approveProposal(placeId);
      } else if (status === 'rejected') {
        store.rejectProposal(placeId, rejectReason || 'Không đáp ứng tiêu chuẩn.');
      } else {
        store.updatePlaceStatus(placeId, status, rejectReason);
      }
    }

    const editFields: any = {};
    if (name !== undefined) editFields.name = name;
    if (category_id !== undefined) editFields.category_id = category_id;
    if (address !== undefined) editFields.address = address;
    if (lat !== undefined) editFields.lat = Number(lat);
    if (lng !== undefined) editFields.lng = Number(lng);
    if (description !== undefined) editFields.description = description;
    if (price_level !== undefined) editFields.price_level = price_level;
    if (images !== undefined) editFields.images = images;
    if (opening_hours !== undefined) editFields.opening_hours = opening_hours;

    if (Object.keys(editFields).length > 0) {
      store.updatePlace(placeId, editFields);
    }

    // 2. Persist directly to Supabase public.places
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });

        const updateData: any = { ...editFields };
        if (status) {
          updateData.status = status;
          if (status === 'approved') {
            updateData.approved_at = new Date().toISOString();
            updateData.reject_reason = null;
          } else if (status === 'rejected') {
            updateData.reject_reason = rejectReason || null;
          }
        }

        const { data, error } = await supabaseAdmin
          .from('places')
          .update(updateData)
          .eq('id', placeId)
          .select()
          .single();

        if (error) {
          console.warn('Supabase places update error:', error.message);
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, place: data });
      } catch (dbErr: any) {
        console.warn('Supabase places update network error:', dbErr.message);
      }
    }

    return NextResponse.json({ success: true, placeId, status });
  } catch (e: any) {
    console.error('PATCH /api/places exception:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('id');

    if (!placeId) {
      return NextResponse.json({ success: false, error: 'Thiếu placeId' }, { status: 400 });
    }

    // 1. Delete from store
    store.deletePlace(placeId);

    // 2. Delete from Supabase public.places
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      if (isUuid(placeId)) {
        await supabaseAdmin.from('place_amenities').delete().eq('place_id', placeId);
        await supabaseAdmin.from('checkins').delete().eq('place_id', placeId);
        await supabaseAdmin.from('reviews').delete().eq('place_id', placeId);
        await supabaseAdmin.from('favorites').delete().eq('place_id', placeId);
        const { error } = await supabaseAdmin.from('places').delete().eq('id', placeId);
        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

