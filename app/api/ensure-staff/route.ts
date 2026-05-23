import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// POST /api/ensure-staff
// Called after login to guarantee public.staff row exists for auth user.
// Uses service role key server-side to bypass RLS.
export async function POST() {
  const cookieStore = cookies()

  // User client — to get the authenticated user's JWT
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch { /* headers already sent */ }
        },
      },
    }
  )

  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service-role client — can insert into public.staff regardless of RLS
  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* admin client doesn't need to set cookies */ },
      },
    }
  )

  // Upsert: if row already exists (same id), do nothing
  const { error: upsertErr } = await adminClient.from('staff').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Staff',
      role: 'frontdesk',
      is_active: true,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  if (upsertErr) {
    console.error('ensure-staff upsert error:', upsertErr)
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, staffId: user.id })
}
