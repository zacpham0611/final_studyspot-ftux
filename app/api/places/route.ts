import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/data/store';
import { createClient } from '@supabase/supabase-js';
import { INITIAL_CATEGORIES } from '@/lib/data/mockData';
import { getOpeningStatus } from '@/lib/utils/hours';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('id') || undefined;
  const query = searchParams.get('q') || undefined;
  const categoryId = searchParams.get('category') ? Number(searchParams.get('category')) : undefined;
  const includeAll = searchParams.get('all') === '1';
  const statusParam = searchParams.get('status') || undefined;
  const createdBy = searchParams.get('created_by') || searchParams.get('userId') || undefined;

  // 1. Query Supabase directly if connected (Single Source of Truth)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });
      let q = supabaseAdmin.from('places').select('*');
      if (placeId) {
        q = q.eq('id', placeId);
      } else if (createdBy) {
        q = q.eq('created_by', createdBy);
      } else if (statusParam) {
        q = q.eq('status', statusParam);
      } else if (!includeAll) {
        q = q.eq('status', 'approved');
      }
      if (categoryId) {
        q = q.eq('category_id', categoryId);
      }
      q = q.order('created_at', { ascending: false });
      const { data, error } = await q;
      if (!error && data) {
        // Fetch place_amenities mapping for these places
        const placeIds = data.map((dp: any) => dp.id).filter(Boolean);
        let placeAmenitiesMap: Record<string, any[]> = {};
        if (placeIds.length > 0) {
          try {
            const [paRes, amRes] = await Promise.all([
              supabaseAdmin.from('place_amenities').select('place_id, amenity_id').in('place_id', placeIds),
              supabaseAdmin.from('amenities').select('*').order('id', { ascending: true }),
            ]);

            const allAmenities = (amRes.data && amRes.data.length > 0) ? amRes.data : store.getAmenities();
            const amMap = new Map<number, any>();
            for (const am of allAmenities) {
              amMap.set(Number(am.id), am);
            }

            if (paRes.data && Array.isArray(paRes.data)) {
              for (const row of paRes.data) {
                const pId = String(row.place_id);
                const aId = Number(row.amenity_id);
                const matchedAmenity = amMap.get(aId);
                if (matchedAmenity) {
                  if (!placeAmenitiesMap[pId]) {
                    placeAmenitiesMap[pId] = [];
                  }
                  placeAmenitiesMap[pId].push(matchedAmenity);
                }
              }
            }
          } catch (paErr) {
            console.warn('GET /api/places place_amenities mapping notice:', paErr);
          }
        }

        let places = data.map((dp: any) => {
          const parsedHours = typeof dp.opening_hours === 'string' ? JSON.parse(dp.opening_hours) : dp.opening_hours;
          const resolvedAmenities = placeAmenitiesMap[dp.id] || (Array.isArray(dp.amenities) ? dp.amenities : []);
          const hoursStatus = getOpeningStatus(parsedHours);
          return {
            ...dp,
            opening_hours: parsedHours,
            price_ranges: dp.price_ranges || parsedHours?.price_ranges || [],
            price_level: dp.price_level || 2,
            images: dp.images || [],
            view_count: dp.view_count || 0,
            amenities: resolvedAmenities,
            is_open: hoursStatus.isOpen,
            is_late_night: hoursStatus.isLateNight,
          };
        });

        if (query) {
          const lowerQ = query.toLowerCase();
          places = places.filter((p: any) =>
            p.name?.toLowerCase().includes(lowerQ) ||
            p.address?.toLowerCase().includes(lowerQ) ||
            p.description?.toLowerCase().includes(lowerQ)
          );
        }

        return NextResponse.json(
          { places, place: places[0] || null, count: places.length },
          { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
        );
      }
    } catch (e: any) {
      console.warn('GET /api/places Supabase query notice:', e.message);
    }
  }

  // 2. Fallback to store
  let places = includeAll 
    ? store.getAllPlacesAdmin() 
    : store.filterPlaces({ query, categoryId });

  if (placeId) {
    const single = store.getPlaceById(placeId);
    places = single ? [single] : [];
  } else if (createdBy) {
    places = store.getAllPlacesAdmin().filter((p: any) => p.created_by === createdBy);
  } else if (statusParam) {
    places = places.filter((p: any) => p.status === statusParam);
  }

  return NextResponse.json(
    { places, place: places[0] || null, count: places.length },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
  );
}

const isUuid = (str?: string | null): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

async function resolveCategoryFromSupabase(
  supabaseAdmin: any,
  submittedId: any,
  submittedName?: string | null
): Promise<number | null> {
  const parsedId = (submittedId != null && submittedId !== '') ? Number(submittedId) : NaN;

  // 1. ID tồn tại trong DB -> dùng ID
  if (!isNaN(parsedId)) {
    try {
      const { data: catRow, error: catErr } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('id', parsedId)
        .maybeSingle();

      if (!catErr && catRow?.id != null) {
        return Number(catRow.id);
      }
    } catch (e) {}
  }

  // 2. ID không tồn tại nhưng category_name khớp chính xác một category DB -> resolve bằng name
  if (submittedName && typeof submittedName === 'string' && submittedName.trim()) {
    try {
      const targetName = submittedName.trim().toLowerCase().normalize('NFC');
      const { data: dbCategories, error: listErr } = await supabaseAdmin
        .from('categories')
        .select('id, name');

      if (!listErr && dbCategories && dbCategories.length > 0) {
        const match = dbCategories.find(
          (c: any) => String(c.name).trim().toLowerCase().normalize('NFC') === targetName
        );
        if (match?.id != null) {
          return Number(match.id);
        }
      }
    } catch (e) {}
  }

  // 3. Cả hai không hợp lệ -> null (API trả về 400)
  return null;
}

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
          } else {
            // Check auth.admin to sync user into public.users
            try {
              const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(created_by);
              if (authUserData?.user) {
                const u = authUserData.user;
                await supabaseAdmin.from('users').upsert({
                  id: u.id,
                  email: u.email || '',
                  full_name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Sinh viên FTU',
                  role: u.user_metadata?.role || 'student',
                });
                validCreatedBy = u.id;
              } else {
                validCreatedBy = created_by;
              }
            } catch (aErr) {
              validCreatedBy = created_by;
            }
          }
        } catch (uErr) {
          validCreatedBy = created_by;
        }
      }

      if (placeStatus === 'pending' && !validCreatedBy) {
        return NextResponse.json(
          { success: false, error: 'Thiếu thông tin người đề xuất (user ID không hợp lệ). Vui lòng đăng nhập lại!' },
          { status: 400 }
        );
      }

      // Validate category_id foreign key directly against real Supabase public.categories
      const validCatId = await resolveCategoryFromSupabase(
        supabaseAdmin,
        category_id,
        body.category_name
      );

      // STRICT VALIDATION: If category ID does not exist in public.categories, return 400 immediately!
      // NEVER fallback to mock store! NEVER allow insert with invalid ID!
      if (validCatId == null) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Loại hình địa điểm (danh mục) không hợp lệ hoặc không tồn tại trong hệ thống. Vui lòng tải lại trang và chọn danh mục hợp lệ.' 
          },
          { status: 400 }
        );
      }

      console.log('[PLACES CATEGORY DEBUG]', {
        category_id: validCatId,
        type: typeof validCatId,
      });

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

            if (targetAdmins.length === 0) {
              const defaultAdminId = 'a0000000-0000-0000-0000-000000000001';
              await supabaseAdmin.from('users').upsert({
                id: defaultAdminId,
                email: ADMIN_EMAIL,
                full_name: 'Ban Quản Trị FTU',
                role: 'admin',
              });
              targetAdmins = [{ id: defaultAdminId }];
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

        const parsedHours = typeof inserted.opening_hours === 'string' ? JSON.parse(inserted.opening_hours) : inserted.opening_hours;
        store.savePlace({
          ...inserted,
          opening_hours: parsedHours,
          price_ranges: inserted.price_ranges || parsedHours?.price_ranges || [],
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

    // Return real error if Supabase persistence failed
    return NextResponse.json(
      { success: false, error: 'Cơ sở dữ liệu Supabase chưa được cấu hình hoặc không thể kết nối' },
      { status: 500 }
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

    let targetPlaceId = placeId;
    if (!isUuid(targetPlaceId)) {
      const matched = store.getPlaceById(placeId);
      if (matched && isUuid(matched.id)) {
        targetPlaceId = matched.id;
      }
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
    if (opening_hours !== undefined) {
      editFields.opening_hours = opening_hours;
      if (body.price_ranges !== undefined && typeof editFields.opening_hours === 'object' && editFields.opening_hours !== null) {
        editFields.opening_hours.price_ranges = body.price_ranges;
      }
    }

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

        if (category_id !== undefined || body.category_name !== undefined) {
          const patchCatId = await resolveCategoryFromSupabase(
            supabaseAdmin,
            category_id,
            body.category_name
          );

          if (patchCatId != null) {
            console.log('[PLACES CATEGORY DEBUG PATCH]', {
              category_id: patchCatId,
              type: typeof patchCatId,
            });
            updateData.category_id = patchCatId;
          }
        }

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
          .eq('id', targetPlaceId)
          .select()
          .single();

        if (error) {
          console.error('Supabase places update error:', error.message);
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (data && (status === 'approved' || status === 'rejected') && data.created_by && isUuid(data.created_by)) {
          const notifContent = status === 'approved'
            ? `Đề xuất địa điểm "${data.name}" của bạn đã được Admin phê duyệt và xuất bản!`
            : `Đề xuất địa điểm "${data.name}" của bạn đã bị từ chối. Lý do: ${rejectReason || 'Không đáp ứng tiêu chuẩn.'}`;
          const notifLink = status === 'approved' ? `/dia-diem/${data.id}` : '/ho-so';
          try {
            await supabaseAdmin.from('notifications').insert({
              user_id: data.created_by,
              noi_dung: notifContent,
              link: notifLink,
              is_read: false,
            });
          } catch (nErr) {}
        }

        if (body.amenities && Array.isArray(body.amenities)) {
          try {
            await supabaseAdmin.from('place_amenities').delete().eq('place_id', targetPlaceId);
            const rows = body.amenities.map((a: any) => ({
              place_id: targetPlaceId,
              amenity_id: typeof a === 'object' ? a.id : Number(a),
            })).filter((r: any) => !isNaN(r.amenity_id));
            if (rows.length > 0) {
              await supabaseAdmin.from('place_amenities').insert(rows);
            }
          } catch (paErr) {}
        }

        return NextResponse.json({ success: true, place: data });
      } catch (dbErr: any) {
        console.error('Supabase places update network error:', dbErr.message);
        return NextResponse.json({ success: false, error: dbErr.message }, { status: 500 });
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

