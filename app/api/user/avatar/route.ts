import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { store } from '@/lib/data/store';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let userId = '';
    let avatarUrl = '';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let supabaseAdmin: any = null;
    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });
    }

    if (contentType.includes('multipart/form-data')) {
      // Direct file upload to Supabase Storage bucket 'avatars'
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      userId = (formData.get('userId') as string) || '';

      if (!file || !userId) {
        return NextResponse.json({ success: false, error: 'Thiếu file ảnh hoặc userId' }, { status: 400 });
      }

      if (supabaseAdmin) {
        try {
          // Ensure avatars bucket exists
          try {
            await supabaseAdmin.storage.createBucket('avatars', { public: true });
          } catch (e) {}

          const fileExt = file.name.split('.').pop() || 'jpg';
          const filePath = `${userId}/${Date.now()}.${fileExt}`;
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const { error: uploadErr } = await supabaseAdmin.storage
            .from('avatars')
            .upload(filePath, buffer, {
              contentType: file.type || 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr) {
            console.warn('Storage upload error:', uploadErr.message);
            if (!uploadErr.message.includes('fetch failed') && !uploadErr.message.includes('ENOTFOUND')) {
              return NextResponse.json({ success: false, error: uploadErr.message }, { status: 500 });
            }
          } else {
            const { data: { publicUrl } } = supabaseAdmin.storage
              .from('avatars')
              .getPublicUrl(filePath);
            avatarUrl = publicUrl;
          }
        } catch (storageException: any) {
          console.warn('Storage exception:', storageException.message);
        }
      }

      if (!avatarUrl) {
        return NextResponse.json(
          { success: false, error: 'Không thể tải ảnh lên Supabase Storage' },
          { status: 500 }
        );
      }
    } else {
      // JSON body with avatarUrl
      const body = await request.json();
      userId = body.userId;
      avatarUrl = body.avatarUrl;

      if (!userId || !avatarUrl) {
        return NextResponse.json({ success: false, error: 'Thiếu userId hoặc avatarUrl' }, { status: 400 });
      }
    }

    // 1. Update in local store
    store.updateUserAvatar(userId, avatarUrl);

    // 2. Update Supabase Database (public.users) & Auth metadata
    if (supabaseAdmin) {
      try {
        const { error: dbError } = await supabaseAdmin
          .from('users')
          .update({ avatar_url: avatarUrl })
          .eq('id', userId);

        if (dbError) {
          console.warn('Database avatar update warning:', dbError.message);
          if (!dbError.message.includes('fetch failed') && !dbError.message.includes('ENOTFOUND')) {
            return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
          }
        }

        // Also update auth.users metadata if it is a valid UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
        if (isUuid) {
          try {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              user_metadata: { avatar_url: avatarUrl },
            });
          } catch (authErr) {
            console.warn('Auth user metadata update notice:', authErr);
          }
        }
      } catch (err: any) {
        console.warn('Database avatar network notice:', err.message);
        if (!err.message.includes('fetch failed') && !err.message.includes('ENOTFOUND')) {
          return NextResponse.json({ success: false, error: err.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true, avatar_url: avatarUrl });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
