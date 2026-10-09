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
        .from('categories')
        .select('*')
        .order('id', { ascending: true });

      if (!error && data && data.length > 0) {
        return NextResponse.json(
          { categories: data },
          { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
        );
      } else if (error) {
        console.warn('GET /api/categories Supabase notice:', error.message);
      }
    } catch (e: any) {
      console.warn('GET /api/categories Supabase query error:', e.message);
    }
  }

  // Fallback to store
  return NextResponse.json(
    { categories: store.getCategories() },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, icon } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Tên danh mục không được để trống' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const chosenIcon = (icon && typeof icon === 'string' && icon.trim()) ? icon.trim() : 'Coffee';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let createdCategory: any = null;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      // Check duplicate name
      const { data: existing } = await supabaseAdmin
        .from('categories')
        .select('id, name')
        .ilike('name', trimmedName)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { success: false, error: `Danh mục "${trimmedName}" đã tồn tại trong hệ thống.` },
          { status: 409 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from('categories')
        .insert({ name: trimmedName, icon: chosenIcon })
        .select()
        .single();

      if (error) {
        console.error('Supabase categories insert error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      createdCategory = data;
    }

    // Fallback to in-memory store if Supabase not configured
    if (!createdCategory) {
      const existing = store.getCategories().find(
        (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (existing) {
        return NextResponse.json(
          { success: false, error: `Danh mục "${trimmedName}" đã tồn tại.` },
          { status: 409 }
        );
      }
      const newId = Math.max(0, ...store.getCategories().map((c) => Number(c.id) || 0)) + 1;
      createdCategory = { id: newId, name: trimmedName, icon: chosenIcon };
    }

    // Sync to store
    store.saveCategory(createdCategory);

    return NextResponse.json(
      { success: true, category: createdCategory },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const catIdStr = searchParams.get('id');

    if (!catIdStr) {
      return NextResponse.json({ success: false, error: 'Thiếu ID danh mục cần xóa' }, { status: 400 });
    }

    const catId = Number(catIdStr);
    if (isNaN(catId)) {
      return NextResponse.json({ success: false, error: 'ID danh mục không hợp lệ' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      // Check if any places use this category
      const { count, error: countErr } = await supabaseAdmin
        .from('places')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', catId);

      if (!countErr && count != null && count > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Không thể xóa danh mục này vì đang có ${count} địa điểm thuộc danh mục. Vui lòng chuyển các địa điểm sang danh mục khác trước khi xóa.`,
          },
          { status: 400 }
        );
      }

      const { error } = await supabaseAdmin
        .from('categories')
        .delete()
        .eq('id', catId);

      if (error) {
        console.error('Supabase categories delete error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    // Sync to store
    store.deleteCategory(catId);

    return NextResponse.json({ success: true, deletedId: catId });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
