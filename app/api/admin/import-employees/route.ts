import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type EmployeeRow = {
  full_name: string;
  email: string;
  location_name?: string;
  hourly_cost?: number | null;
};

export async function POST(request: Request) {
  try {
    const { employees }: { employees: EmployeeRow[] } = await request.json();

    if (!employees?.length) {
      return NextResponse.json({ error: "No employees provided" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, company_id")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (!profile?.company_id || profile.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyId = profile.company_id;
    const adminClient = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    // Fetch all company locations for name matching
    const { data: locations } = await adminClient
      .from("locations")
      .select("id, name")
      .eq("company_id", companyId);

    const results: { email: string; status: "invited" | "exists" | "error"; message?: string }[] = [];

    for (const emp of employees) {
      const email = emp.email?.trim().toLowerCase();
      const fullName = emp.full_name?.trim();

      if (!email || !fullName) {
        results.push({ email: email ?? "", status: "error", message: "Missing name or email" });
        continue;
      }

      // Match location by name (case-insensitive)
      const locationName = emp.location_name?.trim();
      const matchedLocation = locationName
        ? locations?.find(l => l.name.toLowerCase() === locationName.toLowerCase())
        : locations?.[0]; // default to first location

      const locationId = matchedLocation?.id ?? null;

      try {
        // Try to invite the user
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
          email,
          { redirectTo: `${siteUrl}/auth/update-password` }
        );

        let authUserId: string | null = null;

        if (inviteError) {
          // User might already exist — look them up
          const { data: existingUsers } = await adminClient.auth.admin.listUsers();
          const existing = existingUsers?.users?.find(u => u.email === email);
          if (existing) {
            authUserId = existing.id;
          } else {
            results.push({ email, status: "error", message: inviteError.message });
            continue;
          }
        } else {
          authUserId = inviteData.user?.id ?? null;
        }

        // Upsert user_profiles
        if (authUserId) {
          await adminClient.from("user_profiles").upsert({
            id: authUserId,
            full_name: fullName,
            role: "employee",
            company_id: companyId,
          }, { onConflict: "id", ignoreDuplicates: false });

          // Grant location access
          if (locationId) {
            await adminClient.from("user_access").upsert({
              user_id: authUserId,
              location_id: locationId,
            }, { onConflict: "user_id,location_id", ignoreDuplicates: true });
          }
        }

        // Upsert employee record (by email to avoid duplicates)
        const { error: empError } = await adminClient.from("employees").upsert({
          full_name: fullName,
          email: email,
          location_id: locationId,
          real_hour_cost: emp.hourly_cost ?? null,
          status: "active",
          user_id: authUserId,
        }, { onConflict: "email", ignoreDuplicates: false });

        if (empError) {
          // If upsert fails (no unique constraint yet), try plain insert
          await adminClient.from("employees").insert({
            full_name: fullName,
            email: email,
            location_id: locationId,
            real_hour_cost: emp.hourly_cost ?? null,
            status: "active",
            user_id: authUserId,
          });
        }

        results.push({
          email,
          status: inviteError ? "exists" : "invited",
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ email, status: "error", message });
      }
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
