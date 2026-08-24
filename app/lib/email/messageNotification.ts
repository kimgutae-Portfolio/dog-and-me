type CustomerMessageNotificationInput = {
  to: string;
  studioUrl: string;
  idempotencyKey: string;
};

type CustomerMessageNotificationResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "provider_error" };

const EMAIL_SUBJECT = "WAN MEMORY｜新しいメッセージが届いています";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export async function sendPasswordResetNotification({
  to,
  recoveryUrl,
  idempotencyKey,
}: {
  to: string;
  recoveryUrl: string;
  idempotencyKey: string;
}): Promise<CustomerMessageNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };

  const safeRecoveryUrl = escapeHtml(recoveryUrl);
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
      subject: "WAN MEMORY｜パスワード再設定のご案内",
      html: `
        <div style="margin:0;background:#f5f1e8;padding:40px 16px;color:#303a31;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif">
          <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #e3ddd1;border-radius:22px;background:#fff;box-shadow:0 18px 50px rgba(48,58,49,.09)">
            <div style="padding:24px 32px;color:#fff;background:#303a31">
              <p style="margin:0;font-size:14px;font-weight:700;letter-spacing:.16em">WAN MEMORY</p>
              <p style="margin:5px 0 0;font-size:10px;letter-spacing:.12em;color:#d9b9aa">MOVING STORYBOOKS FOR YOUR DOG</p>
            </div>
            <div style="padding:36px 32px 32px">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:.15em;color:#ad6f70">PASSWORD RESET</p>
              <h1 style="margin:0 0 18px;font-size:25px;font-weight:600;line-height:1.55">新しいパスワードを設定してください</h1>
              <p style="margin:0 0 26px;font-size:15px;line-height:1.9;color:#5f625d">WAN MEMORYの制作室で使用するパスワードの再設定を受け付けました。下のボタンから新しいパスワードを設定できます。</p>
              <a href="${safeRecoveryUrl}" style="display:block;border-radius:999px;background:#ad6f70;padding:15px 24px;color:#fff;text-align:center;text-decoration:none;font-size:15px;font-weight:700">新しいパスワードを設定する</a>
              <div style="margin-top:26px;padding:18px;border-radius:14px;background:#f5f1e8">
                <p style="margin:0;font-size:12px;line-height:1.8;color:#6e706b">この操作にお心当たりがない場合は、ボタンを押さずにこのメールを破棄してください。パスワードは変更されません。</p>
              </div>
              <p style="margin:24px 0 0;font-size:11px;line-height:1.8;color:#858780">安全のため、このリンクは一度だけ使用できます。WAN MEMORYがメールでパスワードをお尋ねすることはありません。</p>
            </div>
          </div>
          <p style="max-width:560px;margin:18px auto 0;text-align:center;font-size:10px;line-height:1.7;color:#8b8b86">このメールはWAN MEMORYのパスワード再設定に関する自動通知です。</p>
        </div>
      `,
      text: `WAN MEMORY｜パスワード再設定のご案内\n\n新しいパスワードを設定するには、以下のリンクを開いてください。\n\n${recoveryUrl}\n\nこの操作にお心当たりがない場合は、このメールを破棄してください。パスワードは変更されません。`,
    }),
  });

  return response.ok ? { sent: true } : { sent: false, reason: "provider_error" };
}

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

export async function sendAdminReviewApprovedNotification({
  to,
  petName,
  orderNumber,
  adminUrl,
  idempotencyKey,
}: {
  to: string;
  petName: string;
  orderNumber: string;
  adminUrl: string;
  idempotencyKey: string;
}): Promise<CustomerMessageNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };

  const safePetName = escapeHtml(petName);
  const safeOrderNumber = escapeHtml(orderNumber);
  const safeAdminUrl = escapeHtml(adminUrl);
  const subjectPetName = petName.replace(/[\r\n]+/g, " ").trim();
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
      subject: `WAN MEMORY｜${subjectPetName}ちゃんの完成前映像が承認されました`,
      html: `
        <div style="margin:0;background:#f5f1e8;padding:36px 16px;color:#303a31;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif">
          <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #e3ddd1;border-radius:22px;background:#fff;box-shadow:0 18px 50px rgba(48,58,49,.09)">
            <div style="padding:24px 32px;color:#fff;background:#303a31">
              <p style="margin:0;font-size:14px;font-weight:700;letter-spacing:.16em">WAN MEMORY</p>
              <p style="margin:5px 0 0;font-size:10px;letter-spacing:.12em;color:#d9b9aa">CUSTOMER APPROVAL</p>
            </div>
            <div style="padding:36px 32px 32px">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:.15em;color:#ad6f70">FINAL REVIEW APPROVED</p>
              <h1 style="margin:0 0 18px;font-size:25px;font-weight:600;line-height:1.55">${safePetName}ちゃんの映像が承認されました</h1>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.9;color:#5f625d">注文番号：${safeOrderNumber}</p>
              <p style="margin:0 0 26px;font-size:15px;line-height:1.9;color:#5f625d">お客様が完成前の確認映像を確定しました。管理画面から最終納品の準備へ進めます。</p>
              <a href="${safeAdminUrl}" style="display:block;border-radius:999px;background:#ad6f70;padding:15px 24px;color:#fff;text-align:center;text-decoration:none;font-size:15px;font-weight:700">管理画面で確認する</a>
              <p style="margin:24px 0 0;font-size:11px;line-height:1.8;color:#858780">このメールは、お客様による映像承認をお知らせする運営者向け自動通知です。</p>
            </div>
          </div>
        </div>
      `,
      text: `WAN MEMORY｜完成前映像が承認されました\n\n${petName}ちゃん（${orderNumber}）の完成前映像をお客様が確定しました。\n最終納品の準備へ進めます。\n\n${adminUrl}`,
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
