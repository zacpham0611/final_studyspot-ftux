import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /admin routes
  if (pathname.startsWith('/admin')) {
    // 1. Check local demo store cookies & headers
    const userRoleCookie = request.cookies.get('studyspot_role')?.value;
    const userEmailCookie = request.cookies.get('studyspot_user_email')?.value;
    const authHeader = request.headers.get('x-user-role');
    
    const isLocalAdmin = 
      userRoleCookie === 'admin' || 
      authHeader === 'admin' || 
      userEmailCookie === 'admin123@ftu.edu.vn';

    if (isLocalAdmin) {
      return NextResponse.next();
    }

    // 2. Query Supabase database for user role if connected
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
          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

          if (profile && profile.role === 'admin') {
            return NextResponse.next();
          }
        }
      }
    } catch (e) {
      // Supabase query error fallback
    }

    // 3. Prevent redirect loop: only redirect if trying to access /admin/*
    const url = new URL('/', request.url);
    url.searchParams.set('denied', '1');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
  ],
};
