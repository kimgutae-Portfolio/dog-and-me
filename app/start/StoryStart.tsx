"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthProvider";
import { trackEvent } from "../lib/analytics";
import { STORY_START_STORAGE_KEY } from "../lib/site";
import { GoogleSignIn } from "../auth/GoogleSignIn";

type Purpose = "今の毎日を残したい" | "大切な思い出を残したい" | "記念日の贈り物にしたい";

function initialStart() {
  if (typeof window === "undefined") return { petName: "", purpose: "今の毎日を残したい" as Purpose };
  try {
    const stored = sessionStorage.getItem(STORY_START_STORAGE_KEY);
    if (!stored) return { petName: "", purpose: "今の毎日を残したい" as Purpose };
    const value = JSON.parse(stored) as { petName?: string; purpose?: Purpose };
    return { petName: value.petName || "", purpose: value.purpose || "今の毎日を残したい" };
  } catch { return { petName: "", purpose: "今の毎日を残したい" as Purpose }; }
}

export function StoryStart() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [initial] = useState(initialStart);
  const [petName, setPetName] = useState(initial.petName);
  const [purpose, setPurpose] = useState<Purpose>(initial.purpose);
  const [step, setStep] = useState<"details" | "signup">("details");

  useEffect(() => {
    trackEvent("story_start_view", { page_path: "/start" });
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanPetName = petName.trim();
    if (!cleanPetName) return;
    sessionStorage.setItem(
      STORY_START_STORAGE_KEY,
      JSON.stringify({ petName: cleanPetName, purpose }),
    );
    trackEvent("story_start_complete", { purpose, signed_in: Boolean(user) });
    if (user) {
      router.push("/story");
      return;
    }
    setStep("signup");
    trackEvent("story_signup_prompt_view", { purpose });
  };

  if (step === "signup") {
    const cleanPetName = petName.trim();
    return (
      <main className="start-page">
        <button className="auth-back start-back-button" type="button" onClick={() => setStep("details")}>
          ← 入力内容を確認する
        </button>
        <section className="start-card start-signup-card">
          <p className="eyebrow">SAVE &amp; CONTINUE</p>
          <p className="start-step">2 / 2　無料登録</p>
          <h1>{cleanPetName}ちゃんの<br />物語づくりを始めます。</h1>
          <p className="start-lead">
            入力した内容を保存して、あとから続きを作れるように、無料登録をお願いします。
            登録だけで注文や決済が行われることはありません。
          </p>
          <div className="start-signup-actions">
            <GoogleSignIn nextPath="/story" disabled={false} showDivider={false} />
            <Link
              className="button start-email-signup"
              href="/auth?mode=signup&next=/story&source=start"
              onClick={() => trackEvent("email_signup_choice", { source: "start" })}
            >
              メールアドレスで登録する
            </Link>
          </div>
          <ul className="start-assurances" aria-label="無料登録についてのご案内">
            <li>登録・入力途中では料金は発生しません</li>
            <li>内容と納期を確認したあとに注文できます</li>
            <li>写真は登録後にゆっくり選べます</li>
          </ul>
          <Link className="start-return-link" href="/">今は登録せずトップへ戻る</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="start-page">
      <Link className="auth-back" href="/">← トップへ戻る</Link>
      <section className="start-card">
        <p className="eyebrow">FIRST STEP · ABOUT 1 MINUTE</p>
        <p className="start-step">1 / 2　思い出づくりの準備</p>
        <h1>うちの子について、<br />最初に少しだけ教えてください。</h1>
        <p className="start-lead">ここではまだ注文・決済されません。最初から5つの出来事を決める必要はなく、短い一言から始めて途中保存できます。</p>
        <form className="start-form" onSubmit={submit}>
          <label>
            <span>愛犬のお名前 <em>必須</em></span>
            <input required autoFocus value={petName} onChange={(event) => setPetName(event.target.value)} placeholder="例：ひなた" />
          </label>
          <fieldset>
            <legend>どんな気持ちで残したいですか？</legend>
            {(["今の毎日を残したい", "大切な思い出を残したい", "記念日の贈り物にしたい"] as Purpose[]).map((option) => (
              <label key={option} className={purpose === option ? "selected" : ""}>
                <input type="radio" name="purpose" value={option} checked={purpose === option} onChange={() => setPurpose(option)} />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
          <button className="button button-primary" type="submit" disabled={loading}>次へ進む →</button>
        </form>
        <ul className="start-assurances" aria-label="お申し込み前のご案内">
          <li>登録だけでは料金は発生しません</li>
          <li>まず1つから。写真もあとでゆっくり選べます</li>
          <li>入力途中でも保存して続けられます</li>
        </ul>
      </section>
    </main>
  );
}
