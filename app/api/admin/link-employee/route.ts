import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST: find user by email, link to employee record
export async function POST(req: NextRequest) {
  const { email, employee_id } = await req.json()
  if (!email || !employee_id) {
    return NextResponse.json({ error: 'email and employee_id are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Find auth user by email
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

  const found = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!found) {
    return NextResponse.json({ error: 'No user account found with that email' }, { status: 404 })
  }

  // Update employees.user_id
  const { error: updateErr } = await supabase
    .from('employees')
    .update({ user_id: found.id })
    .eq('id', employee_id)

  if (updateErr) {
    // Column might not exist yet (migration not run) - return graceful error
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, user_id: found.id, email: found.email })
}
