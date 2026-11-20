"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthProvider";
import { trackEvent } from "../lib/analytics";
import { STORY_START_STORAGE_KEY } from "../lib/site";
import { GoogleSignIn } from "../auth/GoogleSignIn";
import { MemoryPlanChoice } from "../components/MemoryPlanChoice";
import { formatYen, getMemoryPlan, isMemoryPlanId, type MemoryPlanId } from "../lib/pricing";

type Purpose = "今の毎日を残したい" | "大切な思い出を残したい" | "記念日の贈り物にしたい";

function initialStart(initialPlanId?: MemoryPlanId) {
  const empty = {
    petName: "",
    purpose: "今の毎日を残したい" as Purpose,
    planId: initialPlanId ?? "memory-film" as MemoryPlanId,
  };
  if (typeof window === "undefined") return empty;
  const requestedPlan = new URLSearchParams(window.location.search).get("plan");
  const planId = initialPlanId ?? (isMemoryPlanId(requestedPlan) ? requestedPlan : undefined);
  try {
    const stored = sessionStorage.getItem(STORY_START_STORAGE_KEY);
    if (!stored) return { ...empty, planId: planId ?? empty.planId };
    const value = JSON.parse(stored) as { petName?: string; purpose?: Purpose; planId?: string };
    return {
      petName: value.petName || "",
      purpose: value.purpose || "今の毎日を残したい",
      planId: planId ?? getMemoryPlan(value.planId).planId,
    };
  } catch { return { ...empty, planId: planId ?? empty.planId }; }
}

export function StoryStart({ initialPlanId }: { initialPlanId?: MemoryPlanId }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [petName, setPetName] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("今の毎日を残したい");
  const [planId, setPlanId] = useState<MemoryPlanId>(initialPlanId ?? "memory-film");
  const [step, setStep] = useState<"details" | "signup">("details");
  const plan = getMemoryPlan(planId);
  const storyPath = `/story?plan=${planId}`;

  useEffect(() => {
    const initial = initialStart(initialPlanId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only draft values after hydration.
    setPetName(initial.petName);
    setPurpose(initial.purpose);
    setPlanId(initial.planId);
  }, [initialPlanId]);

  useEffect(() => {
    trackEvent("story_start_view", { page_path: "/start" });
  }, []);

  const rememberStart = (selectedPlanId: MemoryPlanId) => {
    try {
      sessionStorage.setItem(
        STORY_START_STORAGE_KEY,
        JSON.stringify({ petName: petName.trim(), purpose, planId: selectedPlanId }),
      );
    } catch { /* The authentication destination also carries the selected plan. */ }
  };

  const changePlan = (selectedPlanId: MemoryPlanId) => {
    setPlanId(selectedPlanId);
    rememberStart(selectedPlanId);
    const url = new URL(window.location.href);
    url.searchParams.set("plan", selectedPlanId);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanPetName = petName.trim();
    if (!cleanPetName) return;
    rememberStart(planId);
    trackEvent("story_start_complete", { purpose, signed_in: Boolean(user), plan_id: planId });
    if (user) {
      router.push(storyPath);
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
          <h1>{cleanPetName}ちゃんの<br />制作相談を始めます。</h1>
          <p className="start-lead">選択したプラン：{plan.name}　¥{formatYen(plan.price)}（税込）</p>
          <p className="start-lead">
            入力した内容を保存して、あとから続きを作れるように、無料登録をお願いします。
            登録だけで注文や決済が行われることはありません。
          </p>
          <div className="start-signup-actions">
            <GoogleSignIn nextPath={storyPath} disabled={false} showDivider={false} />
            <Link
              className="button start-email-signup"
              href={`/auth?${new URLSearchParams({ mode: "signup", next: storyPath, source: "start" })}`}
              onClick={() => trackEvent("email_signup_choice", { source: "start" })}
            >
              メールアドレスで登録する
            </Link>
          </div>
          <Link className="auth-text-button" href={`/auth?${new URLSearchParams({ mode: "login", next: storyPath })}`}>
            すでに登録済みの方はこちらからログイン
          </Link>
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
        <p className="consultation-steps start-consultation-steps">お名前 → 無料登録 → 写真と思い出を入力</p>
        <form className="start-form" onSubmit={submit}>
          <MemoryPlanChoice planId={planId} onChange={changePlan} />
          <label>
            <span>愛犬のお名前 <em>必須</em></span>
            <input required value={petName} onChange={(event) => setPetName(event.target.value)} placeholder="例：ひなた" />
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
          <button className="button button-primary" type="submit" disabled={loading}>{user ? "写真と思い出の入力へ →" : "無料登録へ進む →"}</button>
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
