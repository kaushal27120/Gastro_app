import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type CreateUserBody = {
  email: string;
  role: string;
  password?: string;
  locationId?: string;
  locationName?: string;
};

export async function POST(request: Request) {
  try {
    const { email, role, password, locationId, locationName }: CreateUserBody =
      await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, subscription_plan, company_id")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    if (profile?.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    // Enforce simple per-plan manager limits based on the owner's
    // subscription_plan. Plan 1 -> 1 manager, Plan 2 -> 2 managers,
    // Plan 3/other -> up to 5 managers. Only counts manager roles
    // (point_manager, regional_manager) within the same company.
    const plan = profile.subscription_plan as string | null;
    const companyId = profile.company_id as string | null;

    let maxManagers: number | null = null;
    if (plan === "plan1") maxManagers = 1;
    else if (plan === "plan2") maxManagers = 2;
    else if (plan === "plan3") maxManagers = 5;

    if (
      maxManagers !== null &&
      companyId &&
      (role === "point_manager" || role === "regional_manager")
    ) {
      const { count, error: countError } = await adminClient
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .in("role", ["point_manager", "regional_manager"]);

      if (countError) {
        return NextResponse.json(
          { error: countError.message },
          { status: 500 },
        );
      }

      if (typeof count === "number" && count >= maxManagers) {
        return NextResponse.json(
          {
            error:
              "Twój plan subskrypcji osiągnął limit managerów. Zaktualizuj plan, aby dodać więcej.",
          },
          { status: 403 },
        );
      }
    }

    let created;
    let createError;

    if (password && password.trim().length >= 6) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      created = data;
      createError = error || undefined;
    } else {
      const { data, error } =
        await adminClient.auth.admin.inviteUserByEmail(email);
      created = data;
      createError = error || undefined;
    }

    if (createError || !created?.user) {
      return NextResponse.json(
        { error: createError?.message || "Failed to create user" },
        { status: 500 },
      );
    }

    const newUser = created.user;

    const { error: upsertError } = await adminClient
      .from("user_profiles")
      .upsert({ id: newUser.id, role, company_id: companyId });

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 },
      );
    }

    // Resolve or create a location by name (for point managers)
    // and grant access so they can use the Ops panel.
    let finalLocationId = locationId || null;

    if (!finalLocationId && locationName && companyId) {
      // Try to find an existing location with this name for the company
      const { data: existing, error: locError } = await adminClient
        .from("locations")
        .select("id")
        .eq("company_id", companyId)
        .ilike("name", locationName)
        .maybeSingle();

      if (locError) {
        return NextResponse.json(
          { error: locError.message },
          { status: 500 },
        );
      }

      if (existing) {
        finalLocationId = (existing as any).id as string;
      } else {
        // Ensure there is a brand for this company so we can
        // satisfy the NOT NULL brand_id constraint on locations.
        const { data: existingBrand, error: brandError } = await adminClient
          .from("brands")
          .select("id")
          .eq("company_id", companyId)
          .maybeSingle();

        if (brandError) {
          return NextResponse.json(
            { error: brandError.message },
            { status: 500 },
          );
        }

        let brandId = (existingBrand as any)?.id as string | undefined;

        if (!brandId) {
          const { data: createdBrand, error: createBrandError } =
            await adminClient
              .from("brands")
              .insert({ company_id: companyId, name: "Domyślna marka" })
              .select("id")
              .single();

          if (createBrandError) {
            return NextResponse.json(
              { error: createBrandError.message },
              { status: 500 },
            );
          }

          brandId = (createdBrand as any).id as string;
        }

        // Create a location for this company with the resolved brand
        const { data: createdLoc, error: createLocError } = await adminClient
          .from("locations")
          .insert({ name: locationName, company_id: companyId, brand_id: brandId })
          .select("id")
          .single();

        if (createLocError) {
          return NextResponse.json(
            { error: createLocError.message },
            { status: 500 },
          );
        }

        finalLocationId = (createdLoc as any).id as string;
      }
    }

    if (finalLocationId) {
      const { error: accessError } = await adminClient
        .from("user_access")
        .insert({ user_id: newUser.id, location_id: finalLocationId });

      if (accessError) {
        return NextResponse.json(
          { error: accessError.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
