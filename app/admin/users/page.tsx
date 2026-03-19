import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminUsersClient } from "@/components/admin-users-client";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, subscription_plan, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "owner" && profile.role !== "superadmin")) {
    redirect("/admin");
  }

  return (
    <AdminUsersClient
      subscriptionPlan={profile.subscription_plan ?? null}
      companyId={profile.company_id ?? null}
    />
  );
}
