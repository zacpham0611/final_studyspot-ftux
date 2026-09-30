import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();

  const userRoleCookie = request.cookies.get('studyspot_role')?.value?.toLowerCase();
  const userEmailCookie = request.cookies.get('studyspot_user_email')?.value?.toLowerCase();
  const authHeader = request.headers.get('x-user-role')?.toLowerCase();

  // 1. Check if user is locked via Supabase server client (if authenticated)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
      const { createServerClient } = await import('@supabase/ssr');
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('is_locked, role, email')
          .eq('id', user.id)
          .single();

        if (dbUser?.is_locked) {
          if (pathname.startsWith('/api/')) {
            return NextResponse.json(
              { success: false, message: 'Tài khoản của bạn đã bị khóa bởi Ban Quản Trị.' },
              { status: 403 }
            );
          }
          // Redirect locked user to login and clear cookies
          const lockedUrl = new URL('/dang-nhap?locked=1', request.url);
          const response = NextResponse.redirect(lockedUrl);
          response.cookies.delete('studyspot_role');
          response.cookies.delete('studyspot_user_email');
          return response;
        }

        // If accessing /admin and user is the verified admin
        if (pathname.startsWith('/admin')) {
          if (dbUser?.role === 'admin' || user.email?.toLowerCase() === ADMIN_EMAIL) {
            return NextResponse.next();
          }
        }
      }
    }
  } catch (e) {
    // Fallback to cookie check
  }

  // 2. Protect all /admin routes
  if (pathname.startsWith('/admin')) {
    const isDirectAdmin = 
      userEmailCookie === ADMIN_EMAIL || 
      (userRoleCookie === 'admin' && userEmailCookie === ADMIN_EMAIL) || 
      authHeader === 'admin';

    if (isDirectAdmin) {
      return NextResponse.next();
    }

    // Student or unauthenticated user trying to access /admin -> redirect to home '/'
    const homeUrl = new URL('/', request.url);
    homeUrl.searchParams.set('denied', '1');
    return NextResponse.redirect(homeUrl);
  }

  // 3. Protect authenticated user routes (ho-so, de-xuat, yeu-thich)
  const isAuthRoute = 
    pathname.startsWith('/ho-so') || 
    pathname.startsWith('/de-xuat') || 
    pathname.startsWith('/yeu-thich');

  if (isAuthRoute) {
    const hasUser = Boolean(userEmailCookie);
    if (!hasUser) {
      const loginUrl = new URL('/dang-nhap', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
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
