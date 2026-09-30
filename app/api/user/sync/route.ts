import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { store } from '@/lib/data/store';

export async function POST(request: NextRequest) {
  try {
    const { id, email, full_name, role = 'user' } = await request.json();

    if (!id || !email || !full_name) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin người dùng' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = full_name.trim();
    // Default safe role: 'user' in Postgres
    const safeRole = role === 'admin' ? 'user' : role;

    // 1. Update in local store
    store.registerUser(cleanEmail, '******', cleanFullName, safeRole === 'user' ? 'student' : safeRole);

    // 2. Persist to Supabase Database via service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase URL hoặc API Key hợp lệ' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabaseAdmin.from('users').upsert({
      id,
      email: cleanEmail,
      full_name: cleanFullName,
      role: safeRole,
      is_locked: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Supabase user upsert error:', error.message);
      return NextResponse.json({ success: false, error: `Supabase user sync error: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('API user sync exception:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
