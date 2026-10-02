import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { store } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();
    const roleCookie = request.cookies.get('studyspot_role')?.value?.toLowerCase();
    const emailCookie = request.cookies.get('studyspot_user_email')?.value?.toLowerCase();

    const isAdmin = roleCookie === 'admin' || (emailCookie && emailCookie === ADMIN_EMAIL);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Quản trị viên mới có quyền thiết lập dữ liệu độ đông.' },
        { status: 403 }
      );
    }

    const { placeId, hourlyData } = await request.json();
    if (!placeId || !Array.isArray(hourlyData)) {
      return NextResponse.json({ success: false, error: 'Thiếu placeId hoặc hourlyData' }, { status: 400 });
    }

    // 1. Resolve placeId to a valid Supabase public.places UUID
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(placeId);

    let resolvedPlaceId: string | null = null;
    let localPlace = store.getPlaceById(placeId) || store.getAllPlacesAdmin().find((p) => p.id === placeId);

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });

        // Step 1: If placeId is already a UUID format, verify existence in public.places
        if (isUuid) {
          const { data: directPlace } = await supabaseAdmin
            .from('places')
            .select('id')
            .eq('id', placeId)
            .maybeSingle();

          if (directPlace?.id) {
            resolvedPlaceId = directPlace.id;
          }
        }

        // Step 2: If not resolved yet (e.g. local ID 'p-1790781746296' or 'p-1'), resolve via place metadata
        if (!resolvedPlaceId) {
          if (localPlace) {
            // Attempt A: Match by exact name and address
            const { data: exactMatch } = await supabaseAdmin
              .from('places')
              .select('id')
              .eq('name', localPlace.name.trim())
              .eq('address', localPlace.address.trim())
              .limit(1);

            if (exactMatch && exactMatch.length > 0) {
              resolvedPlaceId = exactMatch[0].id;
            }

            // Attempt B: Match by case-insensitive name
            if (!resolvedPlaceId) {
              const { data: nameMatch } = await supabaseAdmin
                .from('places')
                .select('id')
                .ilike('name', localPlace.name.trim())
                .limit(1);

              if (nameMatch && nameMatch.length > 0) {
                resolvedPlaceId = nameMatch[0].id;
              }
            }

            // Attempt C: Match by coordinates
            if (!resolvedPlaceId && localPlace.lat && localPlace.lng) {
              const { data: coordMatch } = await supabaseAdmin
                .from('places')
                .select('id, lat, lng')
                .gte('lat', localPlace.lat - 0.0005)
                .lte('lat', localPlace.lat + 0.0005)
                .gte('lng', localPlace.lng - 0.0005)
                .lte('lng', localPlace.lng + 0.0005)
                .limit(1);

              if (coordMatch && coordMatch.length > 0) {
                resolvedPlaceId = coordMatch[0].id;
              }
            }
          }
        }

        // Step 3: If place does NOT exist in Supabase, report clear error and do not insert
        if (!resolvedPlaceId) {
          return NextResponse.json(
            {
              success: false,
              error: `Địa điểm "${localPlace?.name || placeId}" không tồn tại trong cơ sở dữ liệu Supabase. Vui lòng đảm bảo địa điểm đã được đồng bộ lên Supabase trước khi thiết lập độ đông.`
            },
            { status: 404 }
          );
        }

        // Step 4: Find a valid admin user_id in public.users to satisfy foreign key constraint
        let adminUserId = 'a0000000-0000-0000-0000-000000000001';
        try {
          const { data: adminUserRow } = await supabaseAdmin
            .from('users')
            .select('id')
            .or(`email.eq.${ADMIN_EMAIL},role.eq.admin`)
            .limit(1)
            .maybeSingle();

          if (adminUserRow?.id) {
            adminUserId = adminUserRow.id;
          }
        } catch (uErr) {
          console.warn('Admin user lookup notice:', uErr);
        }

        // Step 5: Batch delete existing checkins for this place using real UUID
        await supabaseAdmin.from('checkins').delete().eq('place_id', resolvedPlaceId);

        // Step 6: Prepare batch rows for all hours using real UUID
        const today = new Date();
        const rows = hourlyData.map((item: { hour: number; level: number }) => {
          const d = new Date(today);
          d.setHours(item.hour, 0, 0, 0);
          return {
            place_id: resolvedPlaceId,
            user_id: adminUserId,
            level: item.level,
            note: 'Admin thiết lập độ đông',
            created_at: d.toISOString(),
          };
        });

        // Step 7: Single batch insert of all rows at once
        const { error: insErr } = await supabaseAdmin.from('checkins').insert(rows);
        if (insErr) {
          console.error('Supabase checkins batch insert error:', insErr.message);
          return NextResponse.json(
            { success: false, error: `Lỗi batch insert vào Supabase: ${insErr.message}` },
            { status: 500 }
          );
        }
      } catch (err: any) {
        console.error('Supabase checkins update exception:', err.message);
        if (err.message?.includes('fetch failed') || err.message?.includes('ENOTFOUND')) {
          store.setHourlyCrowdData(placeId, hourlyData);
          return NextResponse.json({ success: true, placeId, count: hourlyData.length, offline: true });
        }
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // Step 8: Update in local store (for both original ID and resolved UUID)
    store.setHourlyCrowdData(placeId, hourlyData);
    if (resolvedPlaceId && resolvedPlaceId !== placeId) {
      store.setHourlyCrowdData(resolvedPlaceId, hourlyData);
      if (localPlace) {
        localPlace.id = resolvedPlaceId;
        store.savePlace(localPlace);
      }
    }

    return NextResponse.json({
      success: true,
      placeId: resolvedPlaceId || placeId,
      originalPlaceId: placeId,
      count: hourlyData.length
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
