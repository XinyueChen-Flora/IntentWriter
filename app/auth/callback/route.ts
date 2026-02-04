import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Support redirect param for invite flows
  const redirect = requestUrl.searchParams.get('redirect')
  const redirectTo = redirect && redirect.startsWith('/') ? `${origin}${redirect}` : `${origin}/dashboard`

  return NextResponse.redirect(redirectTo)
}
