import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { store, isUuid } from '@/lib/data/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function handleUpdateProfile(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Dữ liệu yêu cầu không hợp lệ' },
        { status: 400 }
      );
    }

    const { full_name, avatar_url, userId } = body;

    // 1. Validate full_name
    if (typeof full_name !== 'string' || !full_name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Họ và tên không được để trống' },
        { status: 400 }
      );
    }

    const cleanFullName = full_name.trim();
    if (cleanFullName.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Họ và tên không được vượt quá 100 ký tự' },
        { status: 400 }
      );
    }

    // 2. Identify caller
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;

    let authenticatedUserId: string | null = null;
    let authenticatedUserEmail: string | null = null;

    if (supabaseUrl && anonKey && !supabaseUrl.includes('placeholder')) {
      try {
        const supabase = createServerClient(supabaseUrl, anonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {},
          },
        });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          authenticatedUserId = user.id;
          authenticatedUserEmail = user.email || null;
        }
      } catch (authErr) {
        console.warn('Profile API auth check notice:', authErr);
      }
    }

    // Fallback: check cookie / store if Supabase SSR is not available or mock session
    if (!authenticatedUserId) {
      const emailCookie = request.cookies.get('studyspot_user_email')?.value;
      if (emailCookie) {
        const decodedEmail = decodeURIComponent(emailCookie).toLowerCase();
        const storeUser = store.getUsers().find((u) => u.email.toLowerCase() === decodedEmail);
        if (storeUser) {
          authenticatedUserId = storeUser.id;
          authenticatedUserEmail = storeUser.email;
        }
      } else {
        const currentStoreUser = store.getCurrentUser();
        if (currentStoreUser) {
          authenticatedUserId = currentStoreUser.id;
          authenticatedUserEmail = currentStoreUser.email;
        }
      }
    }

    // 3. Check if caller is authenticated (Requirement 5)
    if (!authenticatedUserId) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập để thực hiện thao tác này' },
        { status: 401 }
      );
    }

    // 4. Prevent modifying another user's profile (Requirement 6)
    if (userId && userId !== authenticatedUserId) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa hồ sơ của người dùng khác' },
        { status: 403 }
      );
    }

    const targetUserId = authenticatedUserId;
    const updates: { full_name: string; avatar_url?: string } = {
      full_name: cleanFullName,
    };
    if (typeof avatar_url === 'string') {
      updates.avatar_url = avatar_url;
    }

    // 5. Update Supabase Database public.users & Supabase Auth metadata
    if (supabaseUrl && serviceKey && !supabaseUrl.includes('placeholder')) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });

        // Update public.users table
        const { error: dbError } = await supabaseAdmin
          .from('users')
          .update(updates)
          .eq('id', targetUserId);

        if (dbError) {
          console.error('Supabase update profile error:', dbError.message);
          return NextResponse.json(
            { success: false, error: `Lỗi cập nhật hồ sơ trong cơ sở dữ liệu: ${dbError.message}` },
            { status: 500 }
          );
        }

        // Update Auth metadata if targetUserId is a valid UUID
        if (isUuid(targetUserId)) {
          try {
            await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
              user_metadata: {
                full_name: cleanFullName,
                ...(updates.avatar_url ? { avatar_url: updates.avatar_url } : {}),
              },
            });
          } catch (authMetaErr: any) {
            console.warn('Auth user metadata update notice:', authMetaErr?.message);
          }
        }
      } catch (err: any) {
        console.error('Database connection error in profile API:', err.message);
        return NextResponse.json(
          { success: false, error: `Lỗi kết nối cơ sở dữ liệu: ${err.message}` },
          { status: 500 }
        );
      }
    }

    // 6. Update local store
    store.updateUserProfile(targetUserId, updates);

    return NextResponse.json({
      success: true,
      message: 'Cập nhật thông tin hồ sơ thành công',
      user: {
        id: targetUserId,
        full_name: cleanFullName,
        email: authenticatedUserEmail,
        avatar_url: updates.avatar_url,
      },
    });
  } catch (e: any) {
    console.error('API update profile exception:', e.message);
    return NextResponse.json(
      { success: false, error: e.message || 'Lỗi xử lý yêu cầu' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  return handleUpdateProfile(request);
}

export async function PATCH(request: NextRequest) {
  return handleUpdateProfile(request);
}

export async function POST(request: NextRequest) {
  return handleUpdateProfile(request);
}
