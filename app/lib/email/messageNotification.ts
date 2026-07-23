type CustomerMessageNotificationInput = {
  to: string;
  studioUrl: string;
  idempotencyKey: string;
};

type CustomerMessageNotificationResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "provider_error" };

const EMAIL_SUBJECT = "WAN MEMORY｜新しいメッセージが届いています";

export async function sendCustomerMessageNotification({
  to,
  studioUrl,
  idempotencyKey,
}: CustomerMessageNotificationInput): Promise<CustomerMessageNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: EMAIL_SUBJECT,
      html: `
        <div style="margin:0;background:#f5f1e8;padding:36px 16px;color:#303a31;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif">
          <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:32px">
            <p style="margin:0 0 20px;font-size:13px;letter-spacing:.14em;color:#7b826f">WAN MEMORY</p>
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.5">新しいメッセージが届いています</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.8">内容はメールには記載していません。ログイン後、制作室でご確認ください。</p>
            <a href="${studioUrl}" style="display:inline-block;border-radius:999px;background:#303a31;padding:14px 24px;color:#fff;text-decoration:none;font-weight:700">制作室で確認する</a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:#777">このメールはWAN MEMORYの制作連絡に関する自動通知です。</p>
          </div>
        </div>
      `,
      text: `WAN MEMORYに新しいメッセージが届いています。\n\n内容はメールには記載していません。ログイン後、制作室でご確認ください。\n\n${studioUrl}`,
    }),
  });

  return response.ok ? { sent: true } : { sent: false, reason: "provider_error" };
}
