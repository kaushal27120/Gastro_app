import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin = (await headers()).get("origin") || "http://localhost:3000";

    // Optional: allow frontend to choose a specific price & plan code
    let bodyPriceId: string | undefined;
    let bodyPlanCode: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.priceId === "string") {
        bodyPriceId = body.priceId;
      }
      if (body && typeof body.planCode === "string") {
        bodyPlanCode = body.planCode;
      }
    } catch {
      // no JSON body provided – that's fine, we'll fall back to default price
    }

    // Ensure we have a customer in Stripe and saved on the profile
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    let customerId = profile?.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }
    }

    const priceId = bodyPriceId || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID is not configured" },
        { status: 500 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        // Persist chosen plan code on the Stripe Subscription itself
        metadata: bodyPlanCode
          ? {
              plan_code: bodyPlanCode,
            }
          : undefined,
      },
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      metadata: {
        supabase_user_id: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
