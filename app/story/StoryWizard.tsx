"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { CONSENT_VERSIONS } from "../lib/consent";
import { formatYen, MEMORY_FILM_PRICING } from "../lib/pricing";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { uploadOrderImages } from "../lib/supabase/uploads";

type FilmPurpose = "いまを残す" | "虹の橋メモリアル";
type PresenceAnswer = "" | "none" | "included";
type PeopleHandling = "" | "not_applicable" | "dog_only_crop" | "anonymous_person" | "original_still" | "consult";

type MissingField = {
  key: string;
  label: string;
  step: number;
};

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
  peoplePresence: PresenceAnswer;
  peopleHandling: PeopleHandling;
  minorPresence: PresenceAnswer;
  termsConsent: boolean;
  photoRightsConsent: boolean;
  depictedPeopleConsent: boolean;
  minorGuardianConsent: boolean;
  externalAiConsent: boolean;
};

const emptyDraft: Draft = {
  purpose: "いまを残す", petName: "", nameKana: "", breed: "", age: "", personality: [], firstMeeting: "", favoriteMemory: "", message: "", avoid: "", photoNames: [], style: "あたたかな日常映画", ratio: "16:9 横型", narration: "ナレーションなし", bgm: "おまかせ", peoplePresence: "", peopleHandling: "", minorPresence: "", termsConsent: false, photoRightsConsent: false, depictedPeopleConsent: false, minorGuardianConsent: false, externalAiConsent: false,
};

const steps = ["目的", "愛犬のこと", "思い出と写真", "映画の雰囲気", "確認"];
const filmPurposes = [
  { value: "いまを残す", number: "01", title: "いまを残す思い出フィルム", copy: "今を一緒に過ごしているその子との、何気ない毎日を残します。", endingTitle: "また明日も、いつもの道を。", endingCopy: "夕暮れの散歩道で家族を振り返り、並んで歩き続ける。今もこれからも続く時間を表します。", endingLine: "明日もまた、一緒に歩こう。" },
  { value: "虹の橋メモリアル", number: "02", title: "虹の橋メモリアル", copy: "先に旅立ったその子へ、悲しみだけではなく感謝を伝える映画です。", endingTitle: "ありがとう。これからも、思い出の中で一緒に。", endingCopy: "穏やかな光に包まれた草原から空へ続く道を歩き、家族を一度振り返って光の向こうへ進みます。", endingLine: "ありがとう。これからも、思い出の中で一緒に。" },
] as const;
const personalities = ["甘えん坊", "元気", "おだやか", "食いしん坊", "人が好き", "マイペース", "優しい", "ちょっぴり頑固"];
const styles = [
  ["あたたかな日常映画", "自然光といつもの場所。静かな幸福を残します。"],
  ["日本映画のように", "季節感と余白を大切に、落ち着いた画づくりで。"],
  ["明るく楽しい思い出", "元気なテンポと明るい色で、その子らしく。"],
  ["穏やかなメモリアル", "夕暮れや風の気配とともに、ありがとうを伝えます。"],
];
const peopleHandlingOptions = [
  ["dog_only_crop", "愛犬だけを切り抜いて使用する（おすすめ）"],
  ["anonymous_person", "お顔が分からない後ろ姿・手元・足元・シルエットで表現する"],
  ["original_still", "元の家族写真を、AIで動かさずそのまま映像内に使用する"],
  ["consult", "どの方法がよいか担当者に相談したい"],
] as const;

function peopleHandlingLabel(value: PeopleHandling) {
  if (value === "not_applicable") return "該当なし";
  return peopleHandlingOptions.find(([key]) => key === value)?.[1] ?? "未選択";
}

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
  const [photoRestoreNotice, setPhotoRestoreNotice] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?mode=signup&next=/story");
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
          setPhotoRestoreNotice(window.localStorage.getItem("wan-memory-had-selected-photos") === "1" || (Array.isArray(parsed.photoNames) && parsed.photoNames.length > 0));
          setDraft({
            ...emptyDraft,
            ...parsed,
            petName: parsed.petName?.trim() || preferredPetName,
            photoNames: [],
            purpose,
            termsConsent: parsed.termsConsent ?? parsed.consent ?? false,
            photoRightsConsent: parsed.photoRightsConsent ?? false,
            depictedPeopleConsent: parsed.depictedPeopleConsent ?? false,
            minorGuardianConsent: parsed.minorGuardianConsent ?? false,
          });
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

  useEffect(() => {
    if (!photoFiles.length || submitting) return;
    const confirmBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmBeforeLeave);
    return () => window.removeEventListener("beforeunload", confirmBeforeLeave);
  }, [photoFiles.length, submitting]);

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const togglePersonality = (value: string) => update("personality", draft.personality.includes(value) ? draft.personality.filter((item) => item !== value) : [...draft.personality, value]);
  const handlePhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 20);
    setPhotoFiles(files);
    setPhotoRestoreNotice(false);
    if (files.length) window.localStorage.setItem("wan-memory-had-selected-photos", "1");
    else window.localStorage.removeItem("wan-memory-had-selected-photos");
    update("photoNames", files.map((file) => file.name));
  };
  const selectFilmPurpose = (purpose: FilmPurpose) => setDraft((current) => ({ ...current, purpose, style: purpose === "虹の橋メモリアル" ? "穏やかなメモリアル" : current.style === "穏やかなメモリアル" ? "あたたかな日常映画" : current.style }));
  const selectPeoplePresence = (value: PresenceAnswer) => setDraft((current) => value === "none"
    ? { ...current, peoplePresence: value, peopleHandling: "not_applicable", minorPresence: "none", depictedPeopleConsent: false, minorGuardianConsent: false }
    : { ...current, peoplePresence: value, peopleHandling: "", minorPresence: "", depictedPeopleConsent: false, minorGuardianConsent: false });

  const missingFields = useMemo<MissingField[]>(() => {
    const missing: MissingField[] = [];
    if (!draft.petName.trim()) missing.push({ key: "petName", label: "愛犬のお名前", step: 1 });
    if (!draft.breed.trim()) missing.push({ key: "breed", label: "犬種", step: 1 });
    if (!draft.age.trim()) missing.push({ key: "age", label: "年齢（推定でも可）", step: 1 });
    if (draft.personality.length === 0) missing.push({ key: "personality", label: "性格（1つ以上）", step: 1 });
    if (!draft.favoriteMemory.trim()) missing.push({ key: "favoriteMemory", label: "いちばん思い出に残っている時間", step: 2 });
    if (!draft.message.trim()) missing.push({ key: "message", label: "その子へ伝えたいこと", step: 2 });
    if (photoFiles.length < 5) missing.push({ key: "photos", label: `写真（5枚以上・現在${photoFiles.length}枚）`, step: 2 });
    if (!draft.peoplePresence) missing.push({ key: "peoplePresence", label: "写真に人物が写っているか", step: 2 });
    if (draft.peoplePresence === "included" && !draft.peopleHandling) missing.push({ key: "peopleHandling", label: "人物の映像での取り扱い", step: 2 });
    if (draft.peoplePresence === "included" && !draft.minorPresence) missing.push({ key: "minorPresence", label: "未成年者が写っているか", step: 2 });
    if (draft.minorPresence === "included" && !draft.minorGuardianConsent) missing.push({ key: "minorGuardianConsent", label: "未成年者の保護者同意", step: 2 });
    if (!draft.termsConsent) missing.push({ key: "termsConsent", label: "利用規約・プライバシーポリシーへの同意", step: 4 });
    if (!draft.photoRightsConsent) missing.push({ key: "photoRightsConsent", label: "提出写真の使用権限の確認", step: 4 });
    if (draft.peoplePresence === "included" && !draft.depictedPeopleConsent) missing.push({ key: "depictedPeopleConsent", label: "写真に写っている人物の同意確認", step: 4 });
    if (!draft.externalAiConsent) missing.push({ key: "externalAiConsent", label: "外部AI制作サービスでの処理への同意", step: 4 });
    return missing;
  }, [draft, photoFiles.length]);

  const goToStep = (targetStep: number) => {
    setError("");
    setStep(targetStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    goToStep(Math.min(step + 1, steps.length - 1));
  };

  const submit = async () => {
    if (missingFields.length > 0) {
      setError("必須項目がまだ入力されていません。画面内の一覧から入力する項目を選んでください。");
      return;
    }
    if (!user) { router.push("/auth?mode=signup&next=/story"); return; }

    setSubmitting(true);
    setUploadProgress(0);
    setError("");
    const supabase = getSupabaseBrowserClient();

    try {
      const orderPayload = {
        pet_name: draft.petName, name_kana: draft.nameKana, breed: draft.breed, age_text: draft.age,
        purpose: draft.purpose, personality: draft.personality, first_meeting: draft.firstMeeting,
        favorite_memory: draft.favoriteMemory, message_to_pet: draft.message, avoid_notes: draft.avoid,
        style: draft.style, aspect_ratio: draft.ratio, narration: draft.narration, bgm: draft.bgm,
        consent_accepted: draft.termsConsent,
        photo_rights_consent_accepted: draft.photoRightsConsent,
        depicted_people_consent_accepted: draft.peoplePresence === "included" ? draft.depictedPeopleConsent : false,
        minor_guardian_consent_accepted: draft.minorPresence === "included" ? draft.minorGuardianConsent : false,
        external_ai_consent_accepted: draft.externalAiConsent,
        contains_people: draft.peoplePresence === "included",
        people_handling: draft.peopleHandling,
        contains_minors: draft.minorPresence === "included",
        terms_version: CONSENT_VERSIONS.terms,
        privacy_version: CONSENT_VERSIONS.privacy,
        ai_notice_version: CONSENT_VERSIONS.aiNotice,
        photo_rights_consent_version: CONSENT_VERSIONS.photoRights,
        depicted_people_consent_version: CONSENT_VERSIONS.depictedPeople,
        minor_guardian_consent_version: CONSENT_VERSIONS.minorGuardian,
        people_policy_version: CONSENT_VERSIONS.peoplePolicy,
      };
      let orderId = window.localStorage.getItem("wan-memory-pending-order-id") || "";

      if (orderId) {
        const { data: pendingOrder } = await supabase.from("orders").select("id,status").eq("id", orderId).eq("user_id", user.id).maybeSingle();
        if (pendingOrder?.status === "awaiting_materials") {
          const { error: draftError } = await supabase.rpc("save_memory_order_draft", { p_order_id: orderId, p_data: orderPayload });
          if (draftError) throw draftError;
        } else {
          orderId = "";
          window.localStorage.removeItem("wan-memory-pending-order-id");
        }
      }

      if (!orderId) {
        const { data, error: orderError } = await supabase.rpc("create_memory_order", { p_data: orderPayload });
        if (orderError) throw orderError;
        const created = Array.isArray(data) ? data[0] : data;
        if (!created?.order_id) throw new Error("注文番号を作成できませんでした。");
        orderId = created.order_id;
        window.localStorage.setItem("wan-memory-pending-order-id", orderId);
      }

      if (photoFiles.length) {
        await uploadOrderImages(supabase, user.id, orderId, photoFiles, (completed, total) => setUploadProgress(Math.round((completed / total) * 100)));
      }

      const { error: submitError } = await supabase.rpc("submit_memory_order", { p_order_id: orderId });
      if (submitError) throw submitError;
      window.localStorage.removeItem("kimi-film-draft");
      window.localStorage.removeItem("wan-memory-had-selected-photos");
      window.localStorage.removeItem("wan-memory-pending-order-id");
      router.push(`/studio?received=1&order=${orderId}`);
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
          {step === 1 && <div className="wizard-panel"><p className="eyebrow">ABOUT YOUR DOG</p><h1 id="step-title">その子のことを教えてください。</h1><p className="step-lead">未入力のまま次へ進めます。最後の確認画面で、必要な項目をまとめてご案内します。</p><div className="form-grid"><label><span>お名前 <em>必須</em></span><input required value={draft.petName} onChange={(event) => update("petName", event.target.value)} placeholder="例：モモ" /></label><label><span>お名前の読み方 <small>任意</small></span><input value={draft.nameKana} onChange={(event) => update("nameKana", event.target.value)} placeholder="例：もも" /></label><label><span>犬種 <em>必須</em></span><input required value={draft.breed} onChange={(event) => update("breed", event.target.value)} placeholder="例：柴犬" /></label><label><span>年齢 <em>必須</em></span><input required value={draft.age} onChange={(event) => update("age", event.target.value)} placeholder="例：12歳 / 推定3歳" /></label></div><fieldset className="chip-field"><legend>どんな性格ですか？ <small>1つ以上・必須</small></legend><div>{personalities.map((personality) => <button type="button" className={draft.personality.includes(personality) ? "chip selected" : "chip"} onClick={() => togglePersonality(personality)} key={personality}>{personality}<span aria-hidden="true">＋</span></button>)}</div></fieldset></div>}
          {step === 2 && <div className="wizard-panel">
            <p className="eyebrow">MEMORIES &amp; PHOTOS</p>
            <h1 id="step-title">覚えていることを、少しずつ。</h1>
            <p className="step-lead">{draft.purpose === "虹の橋メモリアル" ? "今は空欄でも次へ進めます。最後の時期や病院のことは任意で、望まない限り映像に入れません。" : "今は空欄でも次へ進めます。最後の確認画面で、必要な項目をまとめてご案内します。"}</p>
            <div className="stacked-fields">
              <label><span>はじめて会った日のこと <small>任意</small></span><textarea rows={4} value={draft.firstMeeting} onChange={(event) => update("firstMeeting", event.target.value)} placeholder="どこで、どんな表情で出会いましたか？" /></label>
              <label><span>いちばん思い出に残っている時間 <em>必須</em></span><textarea required rows={4} value={draft.favoriteMemory} onChange={(event) => update("favoriteMemory", event.target.value)} placeholder="いつもの散歩道、旅行、家での何気ない時間など" /></label>
              <label><span>その子へ伝えたいこと <em>必須</em></span><textarea required rows={3} value={draft.message} onChange={(event) => update("message", event.target.value)} placeholder="映画の最後に残したい言葉があれば" /></label>
              <label><span>映像に入れたくないこと <small>任意</small></span><textarea rows={2} value={draft.avoid} onChange={(event) => update("avoid", event.target.value)} placeholder="病院の場面、最後の時期、直接的な表現など。遠慮なく書いてください" /></label>
            </div>

            <section className="photo-quality-guide" aria-labelledby="photo-quality-title">
              <p className="eyebrow">PHOTO GUIDE</p>
              <h2 id="photo-quality-title">その子らしさが伝わる写真をお選びください。</h2>
              <ul>
                <li>顔と目がはっきり見える</li><li>毛色と模様が自然に見える</li><li>強いフィルターや逆光がない</li>
                <li>身体の一部が切れていない</li><li>ほかの動物や物に隠れていない</li><li>実際の体型が分かる</li>
              </ul>
              <p>正面の顔・左右の顔・全身・普段の表情を組み合わせると、外見を確認しやすくなります。</p>
            </section>

            <aside className="people-photo-policy">
              <p className="eyebrow">PEOPLE IN PHOTOS</p>
              <h2>人物が写っている写真について</h2>
              <p>ご家族と一緒に写っている写真もお送りいただけます。現在のWAN MEMORYでは、人物のお顔をAIで生成・再現する制作は行っていません。</p>
              <p>愛犬だけを切り抜く、お顔が分からない後ろ姿・手元・足元・シルエットで表現する、または元の家族写真をAIで動かさずそのまま映像内に使用する方法からお選びいただけます。</p>
            </aside>

            <fieldset className="photo-policy-question">
              <legend>お送りいただく写真に人物は写っていますか？ <em>必須</em></legend>
              <div className="photo-policy-options">
                <label><input type="radio" name="peoplePresence" checked={draft.peoplePresence === "none"} onChange={() => selectPeoplePresence("none")} /><span>人物は写っていない</span></label>
                <label><input type="radio" name="peoplePresence" checked={draft.peoplePresence === "included"} onChange={() => selectPeoplePresence("included")} /><span>人物が写っている</span></label>
              </div>
            </fieldset>

            {draft.peoplePresence === "included" && <div className="people-photo-details">
              <fieldset className="photo-policy-question">
                <legend>人物の映像での取り扱いを選んでください。 <em>必須</em></legend>
                <div className="photo-policy-options vertical">
                  {peopleHandlingOptions.map(([value, label]) => <label key={value}><input type="radio" name="peopleHandling" checked={draft.peopleHandling === value} onChange={() => update("peopleHandling", value)} /><span>{label}</span></label>)}
                </div>
              </fieldset>
              <fieldset className="photo-policy-question">
                <legend>写真に未成年の方は写っていますか？ <em>必須</em></legend>
                <div className="photo-policy-options">
                  <label><input type="radio" name="minorPresence" checked={draft.minorPresence === "none"} onChange={() => setDraft((current) => ({ ...current, minorPresence: "none", minorGuardianConsent: false }))} /><span>写っていない</span></label>
                  <label><input type="radio" name="minorPresence" checked={draft.minorPresence === "included"} onChange={() => update("minorPresence", "included")} /><span>写っている</span></label>
                </div>
              </fieldset>
              {draft.minorPresence === "included" && <label className="guardian-consent"><input type="checkbox" checked={draft.minorGuardianConsent} onChange={(event) => update("minorGuardianConsent", event.target.checked)} /><span>未成年者が写っている写真について、保護者から制作利用の同意を得ています。 <em>必須</em></span></label>}
            </div>}

            {photoRestoreNotice && <aside className="photo-reselect-notice" role="alert"><strong>写真をもう一度選んでください。</strong><span>文章の下書きは復元しましたが、ブラウザの安全上、再読み込み前に選んだ写真ファイルは復元されません。</span></aside>}
            <div className="upload-box"><input id="photos" type="file" required accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={handlePhotos} /><label htmlFor="photos"><span className="upload-mark" aria-hidden="true">＋</span><strong>写真を選ぶ <em>必須・5枚以上</em></strong><small>JPG・PNG・HEIC・WebP / 5〜20枚</small></label>{draft.photoNames.length > 0 && <div className="file-list"><strong>{draft.photoNames.length}枚を選択しました{draft.photoNames.length < 5 ? `（あと${5 - draft.photoNames.length}枚必要です）` : ""}</strong>{draft.photoNames.slice(0, 5).map((name) => <span key={name}>{name}</span>)}{draft.photoNames.length > 5 && <span>ほか {draft.photoNames.length - 5}枚</span>}<p>HEICは送信時にJPGへ変換し、写真はお客様専用の非公開領域へ保存します。写真を選んだ後は、送信完了まで再読み込みしないでください。</p></div>}</div>
          </div>}
          {step === 3 && <div className="wizard-panel"><p className="eyebrow">FILM DIRECTION</p><h1 id="step-title">どんな空気の映画にしますか？</h1><p className="step-lead">迷ったら「日常映画」がおすすめです。担当者からもご提案します。映像はBGMと短い字幕を中心に、思い出へ集中できる構成にします。</p><div className="style-list">{styles.map(([title, copy], index) => <label className={draft.style === title ? "style-card selected" : "style-card"} key={title}><input type="radio" name="style" checked={draft.style === title} onChange={() => update("style", title)} /><span className={`style-swatch swatch-${index + 1}`} aria-hidden="true" /><span><strong>{title}</strong><small>{copy}</small></span><span className="radio-dot" /></label>)}</div><div className="form-grid compact"><label><span>映像比率</span><select value={draft.ratio} onChange={(event) => update("ratio", event.target.value)}><option>16:9 横型</option><option>9:16 縦型</option><option>1:1 正方形</option></select></label><label><span>BGM</span><select value={draft.bgm} onChange={(event) => update("bgm", event.target.value)}><option>おまかせ</option><option>静かなピアノ</option><option>アコースティックギター</option><option>映画音楽のように</option></select></label></div></div>}
          {step === 4 && <div className="wizard-panel">
            <p className="eyebrow">REVIEW</p><h1 id="step-title">ありがとうございます。</h1>
            <p className="step-lead">まずは相談受付としてお預かりします。決済は内容と納期をご確認いただいた後です。</p>
            <div className="review-card">
              <div className="review-title"><span className="brand-mark" aria-hidden="true">WM</span><div><strong>{draft.petName || "愛犬"}ちゃんの映画</strong><small>{draft.purpose}・{draft.style}</small></div></div>
              <dl>
                <div><dt>お名前</dt><dd>{draft.petName || "未入力"}</dd></div><div><dt>犬種・年齢</dt><dd>{[draft.breed, draft.age].filter(Boolean).join(" / ") || "未入力"}</dd></div><div><dt>性格</dt><dd>{draft.personality.join("、") || "未入力"}</dd></div><div><dt>希望</dt><dd>{draft.ratio}・BGM：{draft.bgm}</dd></div><div><dt>写真</dt><dd>{draft.photoNames.length ? `${draft.photoNames.length}枚を選択` : "未入力"}</dd></div>
                <div><dt>人物の有無</dt><dd>{draft.peoplePresence === "included" ? "あり" : draft.peoplePresence === "none" ? "なし" : "未入力"}</dd></div>
                {draft.peoplePresence === "included" && <><div><dt>人物の取り扱い</dt><dd>{peopleHandlingLabel(draft.peopleHandling)}</dd></div><div><dt>未成年者</dt><dd>{draft.minorPresence === "included" ? "あり" : draft.minorPresence === "none" ? "なし" : "未入力"}</dd></div></>}
                <div><dt>プラン</dt><dd>メモリーフィルム</dd></div><div><dt>料金</dt><dd className="review-monitor-price"><strong>先着{MEMORY_FILM_PRICING.launchLimit}組 ¥{formatYen(MEMORY_FILM_PRICING.launchPrice)}（税込）</strong><small>写真5枚以上の送信が完了した時点で確定・終了後は ¥{formatYen(MEMORY_FILM_PRICING.regularPrice)}</small></dd></div><div><dt>映画の種類</dt><dd>{selectedPurpose.title}</dd></div><div><dt>コンセプト</dt><dd>2案から1案を選択</dd></div><div><dt>共通エンディング</dt><dd>{selectedPurpose.endingTitle}</dd></div><div><dt>専用サイト</dt><dd>プランに含まれます</dd></div>
              </dl>
              <button type="button" className="review-edit" onClick={() => goToStep(0)}>最初から内容を見直す</button>
            </div>
            <div className="consent-stack">
              <label className="consent-box"><input type="checkbox" checked={draft.termsConsent} onChange={(event) => update("termsConsent", event.target.checked)} /><span><strong>利用規約とプライバシーポリシーに同意します <em>必須</em></strong><small><Link href="/terms" target="_blank">利用規約</Link>（{CONSENT_VERSIONS.terms}）と<Link href="/privacy" target="_blank">プライバシーポリシー</Link>（{CONSENT_VERSIONS.privacy}）を確認しました。</small></span></label>
              <label className="consent-box"><input type="checkbox" checked={draft.photoRightsConsent} onChange={(event) => update("photoRightsConsent", event.target.checked)} /><span><strong>写真の使用権限について確認しました <em>必須</em></strong><small>提出する写真について、本サービスの映像制作に使用する権限を持っています。確認文版：{CONSENT_VERSIONS.photoRights}</small></span></label>
              {draft.peoplePresence === "included" && <label className="consent-box"><input type="checkbox" checked={draft.depictedPeopleConsent} onChange={(event) => update("depictedPeopleConsent", event.target.checked)} /><span><strong>写っている人物の同意を得ています <em>必須</em></strong><small>写真に写っているご本人から、本サービスの制作に使用する同意を得ています。確認文版：{CONSENT_VERSIONS.depictedPeople}</small></span></label>}
              <label className="consent-box"><input type="checkbox" checked={draft.externalAiConsent} onChange={(event) => update("externalAiConsent", event.target.checked)} /><span><strong>外部制作サービスの利用を確認しました <em>必須</em></strong><small>映像制作のため、写真や制作情報がRunway等の外部の生成AI・映像制作サービスで処理される場合があります。WAN MEMORYが独自のAIモデル学習や広告・ポートフォリオ公開に使用することはありません。外部サービスでのデータの取り扱いは各サービスの条件に基づきます。案内版：{CONSENT_VERSIONS.aiNotice}</small></span></label>
            </div>
            {missingFields.length > 0 ? <aside className="missing-fields-panel" role="status" aria-labelledby="missing-fields-title"><p className="eyebrow">REQUIRED ITEMS</p><h2 id="missing-fields-title">あと{missingFields.length}項目の入力が必要です。</h2><p>項目を選ぶと入力する画面へ戻れます。すべて入力すると、ご相談を送信できます。</p><ul>{missingFields.map((item) => <li key={item.key}><button type="button" onClick={() => goToStep(item.step)}><span>{steps[item.step]}</span><strong>{item.label}</strong><em>入力する →</em></button></li>)}</ul></aside> : <aside className="ready-to-submit" role="status"><span aria-hidden="true">✓</span><div><strong>必要な項目がすべて揃いました。</strong><small>下のボタンからご相談を送信できます。</small></div></aside>}
          </div>}

          {error && <p className="form-error" role="alert">{error}</p>}
          {submitting && <div className="submit-progress" role="status"><span style={{ width: `${photoFiles.length ? uploadProgress : 100}%` }} /><p>{photoFiles.length ? `写真を安全に送信しています… ${uploadProgress}%` : "ご相談を受け付けています…"}</p></div>}
          <div className="wizard-actions">{step > 0 ? <button className="button button-ghost" type="button" disabled={submitting} onClick={() => goToStep(step - 1)}>← 戻る</button> : <span />}{step < steps.length - 1 ? <button className="button button-primary" type="button" onClick={goNext}>次へ進む →</button> : <button className="button button-primary" type="button" disabled={submitting} onClick={submit}>{submitting ? "送信中…" : missingFields.length ? `未入力${missingFields.length}項目を確認する →` : "相談を受け付ける →"}</button>}</div>
        </section>
      </div>
    </main>
  );
}
