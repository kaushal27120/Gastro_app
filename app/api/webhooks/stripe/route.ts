import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured" },
      { status: 500 },
    );
  }

  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Webhook signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const adminClient = createAdminClient();

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const customerId: string | undefined = subscription.customer;
        const status: string | undefined = subscription.status;
        const currentPeriodEnd: number | undefined = subscription.current_period_end;
        const planCode: string | undefined = subscription.metadata?.plan_code;

        if (!customerId) break;

        const subscriptionActive =
          status === "trialing" || status === "active";

        await adminClient
          .from("user_profiles")
          .update({
            subscription_active: subscriptionActive,
            subscription_status: status,
            current_period_end: currentPeriodEnd
              ? new Date(currentPeriodEnd * 1000).toISOString()
              : null,
            // planCode comes from Checkout -> subscription_data.metadata.plan_code
            subscription_plan: planCode ?? null,
          })
          .eq("stripe_customer_id", customerId);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const customerId: string | undefined = subscription.customer;

        if (!customerId) break;

        await adminClient
          .from("user_profiles")
          .update({
            subscription_active: false,
            subscription_status: "canceled",
            current_period_end: null,
          })
          .eq("stripe_customer_id", customerId);
        break;
      }
      default:
        // Ignore other events for now
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process webhook";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
