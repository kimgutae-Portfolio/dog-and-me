declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    expirationTime?: number | null;
    keys: { p256dh: string; auth: string };
  };

  export type SendNotificationOptions = {
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
  };

  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: PushSubscription,
      payload?: string,
      options?: SendNotificationOptions,
    ): Promise<unknown>;
  };

  export default webpush;
}
