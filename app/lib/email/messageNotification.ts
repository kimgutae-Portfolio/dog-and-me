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

type PaymentRequestNotificationInput = {
  to: string;
  petName: string;
  amount: number;
  studioUrl: string;
  idempotencyKey: string;
};

export async function sendPaymentRequestNotification({
  to,
  petName,
  amount,
  studioUrl,
  idempotencyKey,
}: PaymentRequestNotificationInput): Promise<CustomerMessageNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };

  const formattedAmount = new Intl.NumberFormat("ja-JP").format(amount);
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
      subject: "WAN MEMORY｜お支払いの準備ができました",
      html: `
        <div style="margin:0;background:#f5f1e8;padding:36px 16px;color:#303a31;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif">
          <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:32px">
            <p style="margin:0 0 20px;font-size:13px;letter-spacing:.14em;color:#7b826f">WAN MEMORY</p>
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.5">${petName}ちゃんの制作料金をご案内しました</h1>
            <p style="margin:0 0 8px;font-size:15px;line-height:1.8">お支払い金額：¥${formattedAmount}（税込）</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.8">ログイン後、制作室に表示される内容・納期・キャンセル条件をご確認のうえ、カード決済へお進みください。</p>
            <a href="${studioUrl}" style="display:inline-block;border-radius:999px;background:#303a31;padding:14px 24px;color:#fff;text-decoration:none;font-weight:700">制作室で確認する</a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:#777">カード番号などの決済情報をWAN MEMORYがお尋ねすることはありません。</p>
          </div>
        </div>
      `,
      text: `WAN MEMORYのお支払い準備ができました。\n\n${petName}ちゃんの制作料金：¥${formattedAmount}（税込）\n\nログイン後、制作室からカード決済へお進みください。\n\n${studioUrl}`,
    }),
  });

  return response.ok ? { sent: true } : { sent: false, reason: "provider_error" };
}

type LoginNotificationInput = {
  to: string;
  signedInAt: Date;
  idempotencyKey: string;
};

const LOGIN_EMAIL_SUBJECT = "WAN MEMORY｜ログインのお知らせ";

/**
 * Sent after a successful password sign-in so the account owner notices a login
 * they did not perform. Deliberately carries no credential, token or link that
 * could act on the account — only the time and instructions to change the
 * password if it was not them.
 */
export async function sendLoginNotification({
  to,
  signedInAt,
  idempotencyKey,
}: LoginNotificationInput): Promise<CustomerMessageNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };

  const when = new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(signedInAt);

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
      subject: LOGIN_EMAIL_SUBJECT,
      html: `
        <div style="margin:0;background:#f5f1e8;padding:36px 16px;color:#303a31;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif">
          <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:32px">
            <p style="margin:0 0 20px;font-size:13px;letter-spacing:.14em;color:#7b826f">WAN MEMORY</p>
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.5">アカウントにログインがありました</h1>
            <p style="margin:0 0 8px;font-size:15px;line-height:1.8">日時：${when}（日本時間）</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.8">お心当たりがある場合、このメールへの対応は不要です。</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.8"><strong>お心当たりがない場合</strong>は、ただちにパスワードを変更してください。ログイン画面の「パスワードをお忘れですか」から再設定できます。</p>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:#777">このメールはWAN MEMORYのセキュリティに関する自動通知です。パスワードなどの重要な情報をメールでお尋ねすることはありません。</p>
          </div>
        </div>
      `,
      text: `WAN MEMORYのアカウントにログインがありました。\n\n日時：${when}（日本時間）\n\nお心当たりがある場合、対応は不要です。\nお心当たりがない場合は、ただちにパスワードを変更してください。\n\nこのメールはセキュリティに関する自動通知です。パスワードなどの重要な情報をメールでお尋ねすることはありません。`,
    }),
  });

  return response.ok ? { sent: true } : { sent: false, reason: "provider_error" };
}
