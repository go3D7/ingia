```typescript
// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

    if (sessionError) {
      console.error('Error exchanging code for session:', sessionError.message);
      // Redirect to an error page or show a message, adjust URL as needed
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`);
    }

    // Session is now set. Redirect to a page that can perform client-side checks.
    // The AuthProvider will handle redirection to /dashboard or /auth/complete-profile
    // based on the presence of profile/premise data after session is established.
    return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
  }

  // If 'code' is missing, redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/login?error=invalid_callback`);
}

```
