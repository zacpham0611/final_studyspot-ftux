import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ftu.edu.vn').toLowerCase();

  // Protect all /admin routes
  if (pathname.startsWith('/admin')) {
    const userRoleCookie = request.cookies.get('studyspot_role')?.value?.toLowerCase();
    const userEmailCookie = request.cookies.get('studyspot_user_email')?.value?.toLowerCase();
    const authHeader = request.headers.get('x-user-role')?.toLowerCase();

    // 1. Direct check: Does the user have Admin email or Admin header?
    const isDirectAdmin = 
      userEmailCookie === ADMIN_EMAIL || 
      (userRoleCookie === 'admin' && userEmailCookie === ADMIN_EMAIL) || 
      authHeader === 'admin';

    if (isDirectAdmin) {
      return NextResponse.next();
    }

    // 2. Check Supabase server session if available
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
        if (user && user.email?.toLowerCase() === ADMIN_EMAIL) {
          return NextResponse.next();
        }
      }
    } catch (e) {
      // Supabase query error fallback
    }

    // 3. Unauthorized: if student or non-admin attempts to access /admin, redirect directly to home '/'
    const homeUrl = new URL('/', request.url);
    homeUrl.searchParams.set('denied', '1');
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
  ],
};
