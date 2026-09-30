import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { store } from '@/lib/data/store';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let userId = '';
    let avatarUrl = '';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase URL hoặc API Key hợp lệ cho Storage' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      userId = (formData.get('userId') as string) || '';

      if (!file || !userId) {
        return NextResponse.json({ success: false, error: 'Thiếu file ảnh hoặc userId' }, { status: 400 });
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 1. Upload directly to Supabase Storage bucket 'avatars'
      try {
        await supabaseAdmin.storage.createBucket('avatars', { public: true });
      } catch (e) {
        // Bucket may already exist
      }

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('avatars')
        .upload(filePath, buffer, {
          contentType: file.type || 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadErr) {
        console.error('Supabase storage upload error:', uploadErr.message);
        return NextResponse.json(
          { success: false, error: `Lỗi upload Supabase Storage: ${uploadErr.message}` },
          { status: 500 }
        );
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (!publicUrl) {
        return NextResponse.json(
          { success: false, error: 'Không lấy được URL công khai từ Supabase Storage' },
          { status: 500 }
        );
      }

      avatarUrl = publicUrl;
    } else {
      const body = await request.json();
      userId = body.userId;
      avatarUrl = body.avatarUrl;

      if (!userId || !avatarUrl) {
        return NextResponse.json({ success: false, error: 'Thiếu userId hoặc avatarUrl' }, { status: 400 });
      }
    }

    // 2. Persist to Supabase Database (public.users)
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (dbError) {
      console.error('Supabase users table update error:', dbError.message);
      return NextResponse.json(
        { success: false, error: `Lỗi lưu avatar vào Supabase Database: ${dbError.message}` },
        { status: 500 }
      );
    }

    // 3. Update Supabase Auth user metadata
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (isUuid) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { avatar_url: avatarUrl },
        });
      } catch (authErr: any) {
        console.warn('Auth user metadata update notice:', authErr.message);
      }
    }

    // 4. Update in-memory store
    store.updateUserAvatar(userId, avatarUrl);

    return NextResponse.json({ success: true, avatar_url: avatarUrl });
  } catch (e: any) {
    console.error('API user avatar exception:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
