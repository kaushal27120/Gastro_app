import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (
    request.nextUrl.pathname !== "/" &&
    !claims &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/pricing") &&
    !request.nextUrl.pathname.startsWith("/api")
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // If user is logged in but has no active subscription,
  // redirect them to the pricing/subscription page.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    if (
      user &&
      pathname !== "/" &&
      !pathname.startsWith("/pricing") &&
      !pathname.startsWith("/billing") &&
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/api") &&
      pathname !== "/logout"
    ) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("subscription_active, company_id, subscription_plan, role")
        .eq("id", user.id)
        .maybeSingle();

      // Akab Group company UUID from companies table
      const AKAB_GROUP_COMPANY_ID =
        "1a7d7577-42b3-4cb0-858e-2c4db917172c";
      const isAkabByCompany = profile?.company_id === AKAB_GROUP_COMPANY_ID;
      const email = (user.email || "").toLowerCase();
      const isAkabByEmail = email.includes("akab");

      // Explicit email whitelist for lifetime/bypass accounts
      const BYPASS_EMAILS = [
        "chmielna@panprecel.pl",
        "panpreceltorun.szeroka@gmail.com",
      ];
      const isBypassEmail = BYPASS_EMAILS.includes(email);

      const isAkabGroup = isAkabByCompany || isAkabByEmail || isBypassEmail;

      // We only enforce subscription for owner-level accounts.
      // All other roles (e.g. managers for Ops) are allowed to use
      // the app even if their own subscription_active is false, as
      // long as they belong to a company.
      const role = profile?.role;
      const isOwnerLike = role === "owner" || role === "superadmin";

      // If subscription is not active, user is not in a bypass group,
      // and this is an owner/superadmin, send them to pricing.
      if (!profile?.subscription_active && !isAkabGroup && isOwnerLike) {
        const url = request.nextUrl.clone();
        url.pathname = "/pricing";
        return NextResponse.redirect(url);
      }

      // If user has an active subscription, restrict access to certain
      // parts of the app based on subscription_plan.
      const plan = profile?.subscription_plan || null;

      // For now we enforce a simple route-level policy:
      // - plan1: owner admin + basic sales views, no finance/region/inventory admin
      // - plan2: admin + ops (sales) + invoices + inventory, but no finance/region
      // - plan3: full access (no extra restrictions here)
      if (!isAkabGroup && plan) {
        const restrictedByPlan1 = [
          "/finance",
          "/region",
        ];
        const restrictedByPlan2 = [
          "/finance",
          "/region",
        ];

        if (plan === "plan1" && restrictedByPlan1.some((p) => pathname.startsWith(p))) {
          const url = request.nextUrl.clone();
          url.pathname = "/admin";
          return NextResponse.redirect(url);
        }

        if (plan === "plan2" && restrictedByPlan2.some((p) => pathname.startsWith(p))) {
          const url = request.nextUrl.clone();
          url.pathname = "/admin";
          return NextResponse.redirect(url);
        }
      }
    }
  } catch {
    // If something goes wrong with subscription lookup, fall through
    // and let the request continue rather than breaking the app.
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
