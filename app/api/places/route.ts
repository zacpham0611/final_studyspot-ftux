import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/data/store';
import { createClient } from '@supabase/supabase-js';
import { INITIAL_CATEGORIES } from '@/lib/data/mockData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
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
      if (createdBy) {
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
  let places = includeAll 
    ? store.getAllPlacesAdmin() 
    : store.filterPlaces({ query, categoryId });

  if (createdBy) {
    places = store.getAllPlacesAdmin().filter((p: any) => p.created_by === createdBy);
  } else if (statusParam) {
    places = places.filter((p: any) => p.status === statusParam);
  }

  return NextResponse.json(
    { places, count: places.length },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
  );
}

const isUuid = (str?: string | null): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

const normalizeCategoryText = (str?: string | null): string => {
  if (!str) return '';
  return str.normalize('NFC').toLowerCase().trim();
};

const unaccentCategoryText = (str?: string | null): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim();
};

async function resolveCategoryFromSupabase(
  supabaseAdmin: any,
  submittedId: any,
  submittedName?: string | null
): Promise<number | null> {
  const parsedId = (submittedId != null && submittedId !== '') ? Number(submittedId) : NaN;

  // 1. Direct ID lookup in Supabase public.categories
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

  // 2. If ID did not match directly, load all categories from public.categories
  try {
    const { data: dbCategories, error: listErr } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .order('id', { ascending: true });

    if (listErr || !dbCategories || dbCategories.length === 0) {
      return null;
    }

    // Direct ID check in loaded array
    if (!isNaN(parsedId)) {
      const idMatch = dbCategories.find((c: any) => Number(c.id) === parsedId);
      if (idMatch?.id != null) return Number(idMatch.id);
    }

    // Collect candidate names to test
    const candidateNames: string[] = [];
    if (submittedName && typeof submittedName === 'string' && submittedName.trim()) {
      candidateNames.push(submittedName.trim());
    }
    // Also if parsedId corresponds to a mock category, include its name as candidate
    if (!isNaN(parsedId)) {
      const mock = INITIAL_CATEGORIES.find((m) => m.id === parsedId);
      if (mock && !candidateNames.includes(mock.name)) {
        candidateNames.push(mock.name);
      }
    }

    // Match exact normalized NFC
    for (const cand of candidateNames) {
      const normCand = normalizeCategoryText(cand);
      const exactMatch = dbCategories.find(
        (c: any) => normalizeCategoryText(c.name) === normCand
      );
      if (exactMatch?.id != null) return Number(exactMatch.id);
    }

    // Match accent-insensitive
    for (const cand of candidateNames) {
      const unaccentCand = unaccentCategoryText(cand);
      const unaccentMatch = dbCategories.find(
        (c: any) => unaccentCategoryText(c.name) === unaccentCand
      );
      if (unaccentMatch?.id != null) return Number(unaccentMatch.id);
    }
  } catch (err) {}

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

        if (category_id !== undefined || body.category_name !== undefined) {
          const patchCatId = await resolveCategoryFromSupabase(
            supabaseAdmin,
            category_id,
            body.category_name
          );

          if (patchCatId != null) {
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
          .eq('id', placeId)
          .select()
          .single();

        if (error) {
          console.warn('Supabase places update error:', error.message);
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

