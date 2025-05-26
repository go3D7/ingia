```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  // If user is not logged in and tries to access a protected route (anything under /dashboard or /auth/complete-profile)
  if (!session && (pathname.startsWith('/dashboard') || pathname === '/auth/complete-profile')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // If user is logged in and tries to access /login or /register, redirect to dashboard
  if (session && (pathname === '/login' || pathname === '/auth/register')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // If user is logged in but has no profile, redirect to complete-profile, unless already there or at callback or root
  // This check is also in AuthContext for client-side, but middleware provides server-side protection.
  if (session && user && !pathname.startsWith('/auth/complete-profile') && pathname !== '/auth/callback' && pathname !== '/') {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('id', user.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116: no rows found
      console.error('Middleware: Error checking profile:', profileError.message);
      // Allow request to proceed, client-side will handle or show error
      return res;
    }

    if (!profile) {
      return NextResponse.redirect(new URL('/auth/complete-profile', req.url));
    }

    // Check if the user has a premise
    const { data: premise, error: premiseError } = await supabase
        .from('premises')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .maybeSingle();

    if (premiseError && premiseError.code !== 'PGRST116') {
        console.error('Middleware: Error checking premise:', premiseError.message);
        // Allow request to proceed, client-side will handle or show error
        return res;
    }

    if (!premise) {
        return NextResponse.redirect(new URL('/auth/complete-profile', req.url));
    }
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Also exclude /auth/login and /auth/register from certain checks if user is not logged in
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth/login|auth/register).*)',
    '/', // This ensures the root path is also checked by the middleware
  ],
}
```
