import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/employee-auth-status?user_ids=uuid1,uuid2,...
// Returns confirmed_at for each user_id
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('user_ids') ?? '').split(',').filter(Boolean)
  if (!ids.length) return NextResponse.json({ users: [] })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const results: { id: string; email: string; confirmed_at: string | null; last_sign_in: string | null }[] = []

  for (const uid of ids.slice(0, 50)) { // cap at 50
    const { data } = await admin.auth.admin.getUserById(uid)
    if (data?.user) {
      results.push({
        id: data.user.id,
        email: data.user.email ?? '',
        confirmed_at: data.user.email_confirmed_at ?? null,
        last_sign_in: data.user.last_sign_in_at ?? null,
      })
    }
  }

  return NextResponse.json({ users: results })
}
