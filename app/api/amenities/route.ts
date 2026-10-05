import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { store } from '@/lib/data/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });
      const { data, error } = await supabaseAdmin
        .from('amenities')
        .select('*')
        .order('id', { ascending: true });

      if (!error && data && data.length > 0) {
        return NextResponse.json(
          { amenities: data },
          { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
        );
      } else if (error) {
        console.warn('GET /api/amenities Supabase notice:', error.message);
      }
    } catch (e: any) {
      console.warn('GET /api/amenities Supabase query error:', e.message);
    }
  }

  // Fallback to store
  return NextResponse.json(
    { amenities: store.getAmenities() },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, icon } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Tên tiện ích không được để trống' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const chosenIcon = (icon && typeof icon === 'string' && icon.trim()) ? icon.trim() : 'Sparkles';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let createdAmenity: any = null;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      // Check duplicate name
      const { data: existing } = await supabaseAdmin
        .from('amenities')
        .select('id, name')
        .ilike('name', trimmedName)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { success: false, error: `Tiện ích "${trimmedName}" đã tồn tại trong hệ thống.` },
          { status: 409 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from('amenities')
        .insert({ name: trimmedName, icon: chosenIcon })
        .select()
        .single();

      if (error) {
        console.error('Supabase amenities insert error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      createdAmenity = data;
    }

    // Fallback to in-memory store if Supabase not configured
    if (!createdAmenity) {
      const existing = store.getAmenities().find(
        (a) => a.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (existing) {
        return NextResponse.json(
          { success: false, error: `Tiện ích "${trimmedName}" đã tồn tại.` },
          { status: 409 }
        );
      }
      const newId = Math.max(0, ...store.getAmenities().map((a) => Number(a.id) || 0)) + 1;
      createdAmenity = { id: newId, name: trimmedName, icon: chosenIcon };
    }

    // Sync to store
    store.saveAmenity(createdAmenity);

    return NextResponse.json(
      { success: true, amenity: createdAmenity },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const amIdStr = searchParams.get('id');

    if (!amIdStr) {
      return NextResponse.json({ success: false, error: 'Thiếu ID tiện ích cần xóa' }, { status: 400 });
    }

    const amId = Number(amIdStr);
    if (isNaN(amId)) {
      return NextResponse.json({ success: false, error: 'ID tiện ích không hợp lệ' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      // Delete associations from place_amenities first
      try {
        await supabaseAdmin.from('place_amenities').delete().eq('amenity_id', amId);
      } catch (paErr) {}

      // Delete from amenities
      const { error } = await supabaseAdmin
        .from('amenities')
        .delete()
        .eq('id', amId);

      if (error) {
        console.error('Supabase amenities delete error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    // Sync to store
    store.deleteAmenity(amId);

    return NextResponse.json({ success: true, deletedId: amId });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
