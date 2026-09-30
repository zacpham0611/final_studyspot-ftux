import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { pathname } = request.nextUrl;
  const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();

  const userRoleCookie = request.cookies.get('studyspot_role')?.value?.toLowerCase();
  const userEmailCookie = request.cookies.get('studyspot_user_email')?.value?.toLowerCase();
  const authHeader = request.headers.get('x-user-role')?.toLowerCase();

  let supabaseUser: { id: string; email?: string } | null = null;
  let isUserLocked = false;
  let userDbRole: string | null = null;

  // 1. Verify Supabase Auth Session using @supabase/ssr
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
      const { createServerClient } = await import('@supabase/ssr');
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            cookiesToSet.forEach(({ name, value }: { name: string; value: string }) => request.cookies.set(name, value));
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: any }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        supabaseUser = user;

        const { data: dbUser } = await supabase
          .from('users')
          .select('is_locked, role, email')
          .eq('id', user.id)
          .single();

        if (dbUser) {
          isUserLocked = Boolean(dbUser.is_locked);
          userDbRole = dbUser.role || null;
        }
      }
    }
  } catch (e) {
    // If Supabase network issue occurs, continue with cookie check
  }

  // Handle locked account
  if (isUserLocked) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, message: 'Tài khoản của bạn đã bị khóa bởi Ban Quản Trị.' },
        { status: 403 }
      );
    }
    const lockedUrl = new URL('/dang-nhap?locked=1', request.url);
    const lockedResponse = NextResponse.redirect(lockedUrl);
    lockedResponse.cookies.delete('studyspot_role');
    lockedResponse.cookies.delete('studyspot_user_email');
    return lockedResponse;
  }

  // Unified authentication state: valid Supabase session OR valid session cookie
  const isAuthenticated = Boolean(supabaseUser || userEmailCookie);
  const effectiveEmail = (supabaseUser?.email || userEmailCookie || '').toLowerCase();
  const isAdmin = 
    effectiveEmail === ADMIN_EMAIL || 
    userDbRole === 'admin' || 
    userRoleCookie === 'admin' || 
    authHeader === 'admin';

  // If user is authenticated via Supabase, ensure cookie stays in sync
  if (supabaseUser && effectiveEmail) {
    response.cookies.set('studyspot_user_email', effectiveEmail, { path: '/', maxAge: 604800, sameSite: 'lax' });
    response.cookies.set('studyspot_role', isAdmin ? 'admin' : (userDbRole || 'student'), { path: '/', maxAge: 604800, sameSite: 'lax' });
  }

  // 2. Protect Admin routes (/admin/*)
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/dang-nhap', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!isAdmin) {
      const homeUrl = new URL('/', request.url);
      homeUrl.searchParams.set('denied', '1');
      return NextResponse.redirect(homeUrl);
    }

    return response;
  }

  // 3. Protect User routes (/ho-so, /de-xuat, /yeu-thich)
  const isAuthRoute = 
    pathname.startsWith('/ho-so') || 
    pathname.startsWith('/de-xuat') || 
    pathname.startsWith('/yeu-thich');

  if (isAuthRoute) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/dang-nhap', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/ho-so/:path*',
    '/de-xuat/:path*',
    '/yeu-thich/:path*',
    '/api/:path*',
  ],
};
