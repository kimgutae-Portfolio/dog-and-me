"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Draft = {
  purpose: string;
  petName: string;
  nameKana: string;
  breed: string;
  age: string;
  personality: string[];
  firstMeeting: string;
  favoriteMemory: string;
  message: string;
  avoid: string;
  photoNames: string[];
  style: string;
  ratio: string;
  narration: string;
  bgm: string;
  plan: "film" | "memorial";
  consent: boolean;
};

const emptyDraft: Draft = {
  purpose: "日常の思い出", petName: "", nameKana: "", breed: "", age: "", personality: [], firstMeeting: "", favoriteMemory: "", message: "", avoid: "", photoNames: [], style: "あたたかな日常映画", ratio: "16:9 横型", narration: "ナレーションなし", bgm: "おまかせ", plan: "film", consent: false,
};

const steps = ["目的", "愛犬のこと", "思い出と写真", "映画の雰囲気", "確認"];
const purposes = ["日常の思い出", "誕生日", "うちの子記念日", "シニア犬との記録", "家族へのプレゼント", "お別れ・メモリアル"];
const personalities = ["甘えん坊", "元気", "おだやか", "食いしん坊", "人が好き", "マイペース", "優しい", "ちょっぴり頑固"];
const styles = [
  ["あたたかな日常映画", "自然光といつもの場所。静かな幸福を残します。"],
  ["日本映画のように", "季節感と余白を大切に、落ち着いた画づくりで。"],
  ["明るく楽しい思い出", "元気なテンポと明るい色で、その子らしく。"],
  ["穏やかなメモリアル", "夕暮れや風の気配とともに、ありがとうを伝えます。"],
];

export function StoryWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("kimi-film-draft");
    const plan: Draft["plan"] = searchParams.get("plan") === "memorial" ? "memorial" : "film";
    if (stored) {
      try { setDraft({ ...emptyDraft, ...JSON.parse(stored), plan }); } catch { setDraft({ ...emptyDraft, plan }); }
    } else setDraft({ ...emptyDraft, plan });
    setHydrated(true);
  }, [searchParams]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem("kimi-film-draft", JSON.stringify(draft));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, hydrated]);

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const togglePersonality = (value: string) => update("personality", draft.personality.includes(value) ? draft.personality.filter((item) => item !== value) : [...draft.personality, value]);
  const handlePhotos = (event: ChangeEvent<HTMLInputElement>) => update("photoNames", Array.from(event.target.files ?? []).slice(0, 20).map((file) => file.name));

  const goNext = () => {
    if (step === 1 && (!draft.petName.trim() || !draft.breed.trim())) { setError("お名前と犬種を教えてください。"); return; }
    setError(""); setStep((current) => Math.min(current + 1, steps.length - 1)); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = () => {
    if (!draft.consent) { setError("内容と写真の利用確認に同意してください。"); return; }
    const order = { ...draft, orderNumber: `KF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`, submittedAt: new Date().toISOString() };
    window.localStorage.setItem("kimi-film-order", JSON.stringify(order));
    window.localStorage.removeItem("kimi-film-draft");
    router.push("/studio?received=1");
  };

  if (!hydrated) return <div className="wizard-loading">思い出の続きを準備しています…</div>;

  return (
    <main className="wizard-page">
      <header className="wizard-header">
        <Link className="brand" href="/" aria-label="WAN MEMORY トップへ"><span className="brand-mark" aria-hidden="true">WM</span><span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span></Link>
        <div className="save-status" aria-live="polite"><span className={saved ? "save-dot active" : "save-dot"} />{saved ? "保存しました" : "自動保存"}</div>
        <Link className="wizard-close" href="/" aria-label="入力を閉じる">×</Link>
      </header>
      <div className="wizard-progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="wizard-layout">
        <aside className="wizard-side">
          <p>YOUR STORY</p>
          <ol>{steps.map((label, index) => <li className={index === step ? "active" : index < step ? "done" : ""} key={label}><span>{index < step ? "✓" : index + 1}</span>{label}</li>)}</ol>
          <blockquote>「きれいに書こうとしなくて大丈夫です。覚えているままを聞かせてください。」</blockquote>
        </aside>

        <section className="wizard-main" aria-labelledby="step-title">
          <div className="step-count">STEP {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</div>

          {step === 0 && <div className="wizard-panel"><p className="eyebrow">FILM PURPOSE</p><h1 id="step-title">どんな時間を、映画にしますか？</h1><p className="step-lead">いちばん近いものをひとつ選んでください。あとから変更できます。</p><div className="choice-grid">{purposes.map((purpose) => <label className={draft.purpose === purpose ? "choice-card selected" : "choice-card"} key={purpose}><input type="radio" name="purpose" checked={draft.purpose === purpose} onChange={() => update("purpose", purpose)} /><span className="choice-check" aria-hidden="true">✓</span><strong>{purpose}</strong><small>{purpose === "お別れ・メモリアル" ? "ありがとうを、穏やかな物語に" : "その子らしい時間を大切に"}</small></label>)}</div></div>}

          {step === 1 && <div className="wizard-panel"><p className="eyebrow">ABOUT YOUR DOG</p><h1 id="step-title">その子のことを教えてください。</h1><p className="step-lead">まずは基本のことから。必須項目は2つだけです。</p><div className="form-grid"><label><span>お名前 <em>必須</em></span><input value={draft.petName} onChange={(e) => update("petName", e.target.value)} placeholder="例：モモ" /></label><label><span>お名前の読み方</span><input value={draft.nameKana} onChange={(e) => update("nameKana", e.target.value)} placeholder="例：もも" /></label><label><span>犬種 <em>必須</em></span><input value={draft.breed} onChange={(e) => update("breed", e.target.value)} placeholder="例：柴犬" /></label><label><span>年齢</span><input value={draft.age} onChange={(e) => update("age", e.target.value)} placeholder="例：12歳 / 推定3歳" /></label></div><fieldset className="chip-field"><legend>どんな性格ですか？ <small>いくつでも</small></legend><div>{personalities.map((personality) => <button type="button" className={draft.personality.includes(personality) ? "chip selected" : "chip"} onClick={() => togglePersonality(personality)} key={personality}>{personality}<span aria-hidden="true">＋</span></button>)}</div></fieldset></div>}

          {step === 2 && <div className="wizard-panel"><p className="eyebrow">MEMORIES &amp; PHOTOS</p><h1 id="step-title">覚えていることを、少しずつ。</h1><p className="step-lead">全部埋めなくても大丈夫です。言葉にならないところは空欄のままで。</p><div className="stacked-fields"><label><span>はじめて会った日のこと</span><textarea rows={4} value={draft.firstMeeting} onChange={(e) => update("firstMeeting", e.target.value)} placeholder="どこで、どんな表情で出会いましたか？" /></label><label><span>いちばん思い出に残っている時間</span><textarea rows={4} value={draft.favoriteMemory} onChange={(e) => update("favoriteMemory", e.target.value)} placeholder="いつもの散歩道、旅行、家での何気ない時間など" /></label><label><span>その子へ伝えたいこと</span><textarea rows={3} value={draft.message} onChange={(e) => update("message", e.target.value)} placeholder="映画の最後に残したい言葉があれば" /></label><label><span>映像に入れたくないこと</span><textarea rows={2} value={draft.avoid} onChange={(e) => update("avoid", e.target.value)} placeholder="病院の場面、最後の時期など。遠慮なく書いてください" /></label></div><div className="upload-box"><input id="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple onChange={handlePhotos} /><label htmlFor="photos"><span className="upload-mark" aria-hidden="true">＋</span><strong>写真を選ぶ</strong><small>JPG・PNG・HEIC・WebP / 1次版は最大20枚</small></label>{draft.photoNames.length > 0 && <div className="file-list"><strong>{draft.photoNames.length}枚を選択しました</strong>{draft.photoNames.slice(0, 5).map((name) => <span key={name}>{name}</span>)}{draft.photoNames.length > 5 && <span>ほか {draft.photoNames.length - 5}枚</span>}<p>※ 1次版ではファイル名のみ一時保存されます。正式送信はStorage接続後に有効化します。</p></div>}</div></div>}

          {step === 3 && <div className="wizard-panel"><p className="eyebrow">FILM DIRECTION</p><h1 id="step-title">どんな空気の映画にしますか？</h1><p className="step-lead">迷ったら「日常映画」がおすすめです。担当者からもご提案します。</p><div className="style-list">{styles.map(([title, copy], index) => <label className={draft.style === title ? "style-card selected" : "style-card"} key={title}><input type="radio" name="style" checked={draft.style === title} onChange={() => update("style", title)} /><span className={`style-swatch swatch-${index + 1}`} aria-hidden="true" /><span><strong>{title}</strong><small>{copy}</small></span><span className="radio-dot" /></label>)}</div><div className="form-grid compact"><label><span>映像比率</span><select value={draft.ratio} onChange={(e) => update("ratio", e.target.value)}><option>16:9 横型</option><option>9:16 縦型</option><option>1:1 正方形</option></select></label><label><span>ナレーション</span><select value={draft.narration} onChange={(e) => update("narration", e.target.value)}><option>ナレーションなし</option><option>女性・日本語</option><option>男性・日本語</option><option>家族の声を使う</option></select></label><label><span>BGM</span><select value={draft.bgm} onChange={(e) => update("bgm", e.target.value)}><option>おまかせ</option><option>静かなピアノ</option><option>アコースティックギター</option><option>映画音楽のように</option></select></label></div></div>}

          {step === 4 && <div className="wizard-panel"><p className="eyebrow">REVIEW</p><h1 id="step-title">ありがとうございます。</h1><p className="step-lead">まずは相談受付としてお預かりします。決済は内容と納期をご確認いただいた後です。</p><div className="review-card"><div className="review-title"><span className="brand-mark" aria-hidden="true">WM</span><div><strong>{draft.petName || "愛犬"}ちゃんの映画</strong><small>{draft.purpose}・{draft.style}</small></div></div><dl><div><dt>お名前</dt><dd>{draft.petName || "未入力"}</dd></div><div><dt>犬種・年齢</dt><dd>{[draft.breed, draft.age].filter(Boolean).join(" / ") || "未入力"}</dd></div><div><dt>性格</dt><dd>{draft.personality.join("、") || "未入力"}</dd></div><div><dt>希望</dt><dd>{draft.ratio}・{draft.narration}</dd></div><div><dt>写真</dt><dd>{draft.photoNames.length ? `${draft.photoNames.length}枚を選択` : "後から追加"}</dd></div><div><dt>プラン</dt><dd>{draft.plan === "memorial" ? "メモリアル" : "メモリーフィルム"}</dd></div><div><dt>専用サイト</dt><dd>プランに含まれます</dd></div></dl><button type="button" className="review-edit" onClick={() => setStep(0)}>最初から内容を見直す</button></div><label className="consent-box"><input type="checkbox" checked={draft.consent} onChange={(e) => update("consent", e.target.checked)} /><span><strong>内容と写真の取り扱いについて確認しました</strong><small>自分が使用権限を持つ写真のみを提出し、制作目的で取り扱われることに同意します。1次版では外部送信されません。</small></span></label></div>}

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="wizard-actions">{step > 0 ? <button className="button button-ghost" type="button" onClick={() => { setError(""); setStep((current) => current - 1); }}>← 戻る</button> : <span />}{step < steps.length - 1 ? <button className="button button-primary" type="button" onClick={goNext}>次へ進む →</button> : <button className="button button-primary" type="button" onClick={submit}>相談を受け付ける →</button>}</div>
        </section>
      </div>
    </main>
  );
}
