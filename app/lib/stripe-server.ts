import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeServerClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("stripe_not_configured");
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

