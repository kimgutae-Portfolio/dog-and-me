"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { formatYen, MEMORY_FILM_PRICING } from "../lib/pricing";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { uploadOrderImages } from "../lib/supabase/uploads";

type FilmPurpose = "いまを残す" | "虹の橋メモリアル";

type Draft = {
  purpose: FilmPurpose;
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
  consent: boolean;
};

const emptyDraft: Draft = {
  purpose: "いまを残す", petName: "", nameKana: "", breed: "", age: "", personality: [], firstMeeting: "", favoriteMemory: "", message: "", avoid: "", photoNames: [], style: "あたたかな日常映画", ratio: "16:9 横型", narration: "ナレーションなし", bgm: "おまかせ", consent: false,
};

const steps = ["目的", "愛犬のこと", "思い出と写真", "映画の雰囲気", "確認"];
const filmPurposes = [
  { value: "いまを残す", number: "01", title: "いまを残す思い出フィルム", copy: "今を一緒に過ごしているその子との、何気ない毎日を残します。", endingTitle: "また明日も、いつもの道を。", endingCopy: "夕暮れの散歩道で家族を振り返り、並んで歩き続ける。今もこれからも続く時間を表します。", endingLine: "明日もまた、一緒に歩こう。" },
  { value: "虹の橋メモリアル", number: "02", title: "虹の橋メモリアル", copy: "先に旅立ったその子へ、悲しみだけではなく感謝を伝える映画です。", endingTitle: "少し先で、待っているね。", endingCopy: "穏やかな光に包まれた草原から空へ続く道を歩き、家族を一度振り返って光の向こうへ進みます。", endingLine: "先に行って、少しだけ待っているね。" },
] as const;
const personalities = ["甘えん坊", "元気", "おだやか", "食いしん坊", "人が好き", "マイペース", "優しい", "ちょっぴり頑固"];
const styles = [
  ["あたたかな日常映画", "自然光といつもの場所。静かな幸福を残します。"],
  ["日本映画のように", "季節感と余白を大切に、落ち着いた画づくりで。"],
  ["明るく楽しい思い出", "元気なテンポと明るい色で、その子らしく。"],
  ["穏やかなメモリアル", "夕暮れや風の気配とともに、ありがとうを伝えます。"],
];

export function StoryWizard() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/story");
  }, [authLoading, router, user]);

  const preferredPetName = (profile?.primary_pet_name || user?.user_metadata?.pet_name || "").trim();

  useEffect(() => {
    if (authLoading || hydrated) return;
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("kimi-film-draft");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const purpose: FilmPurpose = parsed.purpose === "虹の橋メモリアル" || parsed.purpose === "お別れ・メモリアル" ? "虹の橋メモリアル" : "いまを残す";
          setDraft({ ...emptyDraft, ...parsed, petName: parsed.petName?.trim() || preferredPetName, photoNames: [], purpose });
        } catch { setDraft({ ...emptyDraft, petName: preferredPetName }); }
      } else setDraft({ ...emptyDraft, petName: preferredPetName });
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, hydrated, preferredPetName]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const localDraft = { ...draft, photoNames: [] };
      window.localStorage.setItem("kimi-film-draft", JSON.stringify(localDraft));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, hydrated]);

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const togglePersonality = (value: string) => update("personality", draft.personality.includes(value) ? draft.personality.filter((item) => item !== value) : [...draft.personality, value]);
  const handlePhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 20);
    setPhotoFiles(files);
    update("photoNames", files.map((file) => file.name));
  };
  const selectFilmPurpose = (purpose: FilmPurpose) => setDraft((current) => ({ ...current, purpose, style: purpose === "虹の橋メモリアル" ? "穏やかなメモリアル" : current.style === "穏やかなメモリアル" ? "あたたかな日常映画" : current.style }));

  const goNext = () => {
    if (step === 1 && (!draft.petName.trim() || !draft.breed.trim())) { setError("お名前と犬種を教えてください。"); return; }
    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!draft.consent) { setError("内容と写真の利用確認に同意してください。"); return; }
    if (!user) { router.push("/auth?next=/story"); return; }

    setSubmitting(true);
    setUploadProgress(0);
    setError("");
    const supabase = getSupabaseBrowserClient();

    try {
      const { data, error: orderError } = await supabase.rpc("create_memory_order", {
        p_data: {
          pet_name: draft.petName, name_kana: draft.nameKana, breed: draft.breed, age_text: draft.age,
          purpose: draft.purpose, personality: draft.personality, first_meeting: draft.firstMeeting,
          favorite_memory: draft.favoriteMemory, message_to_pet: draft.message, avoid_notes: draft.avoid,
          style: draft.style, aspect_ratio: draft.ratio, narration: draft.narration, bgm: draft.bgm,
        },
      });
      if (orderError) throw orderError;
      const created = Array.isArray(data) ? data[0] : data;
      if (!created?.order_id) throw new Error("注文番号を作成できませんでした。");

      if (photoFiles.length) {
        await uploadOrderImages(supabase, user.id, created.order_id, photoFiles, (completed, total) => setUploadProgress(Math.round((completed / total) * 100)));
      }

      const { error: submitError } = await supabase.rpc("submit_memory_order", { p_order_id: created.order_id });
      if (submitError) throw submitError;
      window.localStorage.removeItem("kimi-film-draft");
      router.push(`/studio?received=1&order=${created.order_id}`);
    } catch (caught) {
      console.error(caught);
      setError("受付を完了できませんでした。通信状態をご確認のうえ、もう一度お試しください。");
      setSubmitting(false);
    }
  };

  if (!hydrated || authLoading || !user) return <div className="wizard-loading">思い出の続きを準備しています…</div>;

  const selectedPurpose = filmPurposes.find((purpose) => purpose.value === draft.purpose) ?? filmPurposes[0];

  return (
    <main className="wizard-page">
      <header className="wizard-header">
        <Link className="brand" href="/" aria-label="WAN MEMORY トップへ"><span className="brand-mark" aria-hidden="true">WM</span><span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span></Link>
        <div className="save-status" aria-live="polite"><span className={saved ? "save-dot active" : "save-dot"} />{saved ? "下書きを保存しました" : user.email}</div>
        <Link className="wizard-close" href="/" aria-label="入力を閉じる">×</Link>
      </header>
      <div className="wizard-progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="wizard-layout">
        <aside className="wizard-side"><p>YOUR STORY</p><ol>{steps.map((label, index) => <li className={index === step ? "active" : index < step ? "done" : ""} key={label}><span>{index < step ? "✓" : index + 1}</span>{label}</li>)}</ol><blockquote>「きれいに書こうとしなくて大丈夫です。覚えているままを聞かせてください。」</blockquote></aside>

        <section className="wizard-main" aria-labelledby="step-title">
          <div className="step-count">STEP {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</div>
          {step === 0 && <div className="wizard-panel"><p className="eyebrow">CHOOSE YOUR FILM</p><h1 id="step-title">最初に、どちらの映画か教えてください。</h1><p className="step-lead">2つのコンセプト案は異なる物語でご提案しますが、最後は選んだ種類に合う共通エンディングで結びます。</p><div className="film-type-grid">{filmPurposes.map((purpose) => <label className={draft.purpose === purpose.value ? `film-type-card selected ${purpose.value === "虹の橋メモリアル" ? "memorial" : ""}` : `film-type-card ${purpose.value === "虹の橋メモリアル" ? "memorial" : ""}`} key={purpose.value}><input type="radio" name="purpose" checked={draft.purpose === purpose.value} onChange={() => selectFilmPurpose(purpose.value)} /><span className="choice-check" aria-hidden="true">✓</span><span className="film-type-number">{purpose.number}</span><strong>{purpose.title}</strong><p>{purpose.copy}</p><div className="film-type-ending"><small>COMMON ENDING · 2案共通</small><b>{purpose.endingTitle}</b><span>{purpose.endingCopy}</span><em>「{purpose.endingLine}」</em></div></label>)}</div></div>}
          {step === 1 && <div className="wizard-panel"><p className="eyebrow">ABOUT YOUR DOG</p><h1 id="step-title">その子のことを教えてください。</h1><p className="step-lead">まずは基本のことから。必須項目は2つだけです。</p><div className="form-grid"><label><span>お名前 <em>必須</em></span><input value={draft.petName} onChange={(event) => update("petName", event.target.value)} placeholder="例：モモ" /></label><label><span>お名前の読み方</span><input value={draft.nameKana} onChange={(event) => update("nameKana", event.target.value)} placeholder="例：もも" /></label><label><span>犬種 <em>必須</em></span><input value={draft.breed} onChange={(event) => update("breed", event.target.value)} placeholder="例：柴犬" /></label><label><span>年齢</span><input value={draft.age} onChange={(event) => update("age", event.target.value)} placeholder="例：12歳 / 推定3歳" /></label></div><fieldset className="chip-field"><legend>どんな性格ですか？ <small>いくつでも</small></legend><div>{personalities.map((personality) => <button type="button" className={draft.personality.includes(personality) ? "chip selected" : "chip"} onClick={() => togglePersonality(personality)} key={personality}>{personality}<span aria-hidden="true">＋</span></button>)}</div></fieldset></div>}
          {step === 2 && <div className="wizard-panel"><p className="eyebrow">MEMORIES &amp; PHOTOS</p><h1 id="step-title">覚えていることを、少しずつ。</h1><p className="step-lead">{draft.purpose === "虹の橋メモリアル" ? "答えにくいことは飛ばして大丈夫です。最後の時期や病院のことを、望まない限り映像に入れません。" : "全部埋めなくても大丈夫です。言葉にならないところは空欄のままで。"}</p><div className="stacked-fields"><label><span>はじめて会った日のこと</span><textarea rows={4} value={draft.firstMeeting} onChange={(event) => update("firstMeeting", event.target.value)} placeholder="どこで、どんな表情で出会いましたか？" /></label><label><span>いちばん思い出に残っている時間</span><textarea rows={4} value={draft.favoriteMemory} onChange={(event) => update("favoriteMemory", event.target.value)} placeholder="いつもの散歩道、旅行、家での何気ない時間など" /></label><label><span>その子へ伝えたいこと</span><textarea rows={3} value={draft.message} onChange={(event) => update("message", event.target.value)} placeholder="映画の最後に残したい言葉があれば" /></label><label><span>映像に入れたくないこと</span><textarea rows={2} value={draft.avoid} onChange={(event) => update("avoid", event.target.value)} placeholder="病院の場面、最後の時期、直接的な表現など。遠慮なく書いてください" /></label></div><div className="upload-box"><input id="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={handlePhotos} /><label htmlFor="photos"><span className="upload-mark" aria-hidden="true">＋</span><strong>写真を選ぶ</strong><small>JPG・PNG・HEIC・WebP / 最大20枚</small></label>{draft.photoNames.length > 0 && <div className="file-list"><strong>{draft.photoNames.length}枚を選択しました</strong>{draft.photoNames.slice(0, 5).map((name) => <span key={name}>{name}</span>)}{draft.photoNames.length > 5 && <span>ほか {draft.photoNames.length - 5}枚</span>}<p>HEICは送信時にJPGへ変換し、写真はお客様専用の非公開領域へ保存します。</p></div>}</div></div>}
          {step === 3 && <div className="wizard-panel"><p className="eyebrow">FILM DIRECTION</p><h1 id="step-title">どんな空気の映画にしますか？</h1><p className="step-lead">迷ったら「日常映画」がおすすめです。担当者からもご提案します。</p><div className="style-list">{styles.map(([title, copy], index) => <label className={draft.style === title ? "style-card selected" : "style-card"} key={title}><input type="radio" name="style" checked={draft.style === title} onChange={() => update("style", title)} /><span className={`style-swatch swatch-${index + 1}`} aria-hidden="true" /><span><strong>{title}</strong><small>{copy}</small></span><span className="radio-dot" /></label>)}</div><div className="form-grid compact"><label><span>映像比率</span><select value={draft.ratio} onChange={(event) => update("ratio", event.target.value)}><option>16:9 横型</option><option>9:16 縦型</option><option>1:1 正方形</option></select></label><label><span>ナレーション</span><select value={draft.narration} onChange={(event) => update("narration", event.target.value)}><option>ナレーションなし</option><option>女性・日本語</option><option>男性・日本語</option><option>家族の声を使う</option></select></label><label><span>BGM</span><select value={draft.bgm} onChange={(event) => update("bgm", event.target.value)}><option>おまかせ</option><option>静かなピアノ</option><option>アコースティックギター</option><option>映画音楽のように</option></select></label></div></div>}
          {step === 4 && <div className="wizard-panel"><p className="eyebrow">REVIEW</p><h1 id="step-title">ありがとうございます。</h1><p className="step-lead">まずは相談受付としてお預かりします。決済は内容と納期をご確認いただいた後です。</p><div className="review-card"><div className="review-title"><span className="brand-mark" aria-hidden="true">WM</span><div><strong>{draft.petName || "愛犬"}ちゃんの映画</strong><small>{draft.purpose}・{draft.style}</small></div></div><dl><div><dt>お名前</dt><dd>{draft.petName || "未入力"}</dd></div><div><dt>犬種・年齢</dt><dd>{[draft.breed, draft.age].filter(Boolean).join(" / ") || "未入力"}</dd></div><div><dt>性格</dt><dd>{draft.personality.join("、") || "未入力"}</dd></div><div><dt>希望</dt><dd>{draft.ratio}・{draft.narration}</dd></div><div><dt>写真</dt><dd>{draft.photoNames.length ? `${draft.photoNames.length}枚を選択` : "制作室から後で追加"}</dd></div><div><dt>プラン</dt><dd>メモリーフィルム</dd></div><div><dt>料金</dt><dd className="review-monitor-price"><strong>先着{MEMORY_FILM_PRICING.launchLimit}組 ¥{formatYen(MEMORY_FILM_PRICING.launchPrice)}（税込）</strong><small>受付時に自動確定・終了後は ¥{formatYen(MEMORY_FILM_PRICING.regularPrice)}</small></dd></div><div><dt>映画の種類</dt><dd>{selectedPurpose.title}</dd></div><div><dt>コンセプト</dt><dd>2案から1案を選択</dd></div><div><dt>共通エンディング</dt><dd>{selectedPurpose.endingTitle}</dd></div><div><dt>専用サイト</dt><dd>プランに含まれます</dd></div></dl><button type="button" className="review-edit" onClick={() => setStep(0)}>最初から内容を見直す</button></div><label className="consent-box"><input type="checkbox" checked={draft.consent} onChange={(event) => update("consent", event.target.checked)} /><span><strong>内容と写真の取り扱いについて確認しました</strong><small>使用権限を持つ写真のみを提出し、制作のため非公開領域で取り扱われることに同意します。AI学習には使用しません。</small></span></label></div>}

          {error && <p className="form-error" role="alert">{error}</p>}
          {submitting && <div className="submit-progress" role="status"><span style={{ width: `${photoFiles.length ? uploadProgress : 100}%` }} /><p>{photoFiles.length ? `写真を安全に送信しています… ${uploadProgress}%` : "ご相談を受け付けています…"}</p></div>}
          <div className="wizard-actions">{step > 0 ? <button className="button button-ghost" type="button" disabled={submitting} onClick={() => { setError(""); setStep((current) => current - 1); }}>← 戻る</button> : <span />}{step < steps.length - 1 ? <button className="button button-primary" type="button" onClick={goNext}>次へ進む →</button> : <button className="button button-primary" type="button" disabled={submitting} onClick={submit}>{submitting ? "送信中…" : "相談を受け付ける →"}</button>}</div>
        </section>
      </div>
    </main>
  );
}
