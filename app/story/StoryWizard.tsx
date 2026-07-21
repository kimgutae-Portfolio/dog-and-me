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

type MemoryDraft = {
  clientKey: string;
  title: string;
  whenText: string;
  location: string;
  description: string;
  dogBehavior: string;
  photoNames: string[];
};

type Draft = {
  purpose: FilmPurpose;
  petName: string;
  nameKana: string;
  breed: string;
  age: string;
  personality: string[];
  memories: MemoryDraft[];
  message: string;
  avoid: string;
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

const MIN_MEMORY_COUNT = 2;
const MAX_MEMORY_COUNT = 6;
const MIN_TOTAL_PHOTOS = 5;

const createMemoryDraft = (clientKey: string): MemoryDraft => ({
  clientKey,
  title: "",
  whenText: "",
  location: "",
  description: "",
  dogBehavior: "",
  photoNames: [],
});

const emptyDraft: Draft = {
  purpose: "いまを残す", petName: "", nameKana: "", breed: "", age: "", personality: [], memories: [createMemoryDraft("memory-1")], message: "", avoid: "", style: "あたたかな日常映画", ratio: "16:9 横型", narration: "ナレーションなし", bgm: "おまかせ", peoplePresence: "", peopleHandling: "", minorPresence: "", termsConsent: false, photoRightsConsent: false, depictedPeopleConsent: false, minorGuardianConsent: false, externalAiConsent: false,
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
  const [memoryPhotoFiles, setMemoryPhotoFiles] = useState<Record<string, File[]>>({});
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
          const parsedMemories: MemoryDraft[] = Array.isArray(parsed.memories) && parsed.memories.length
            ? parsed.memories.slice(0, MAX_MEMORY_COUNT).map((memory: Partial<MemoryDraft>, index: number) => ({
                ...createMemoryDraft(memory.clientKey || `memory-${index + 1}`),
                ...memory,
                photoNames: [],
              }))
            : [{
                ...createMemoryDraft("memory-1"),
                title: parsed.firstMeeting ? "はじめて会った日" : "大切な思い出",
                description: parsed.favoriteMemory || parsed.firstMeeting || "",
              }];
          setPhotoRestoreNotice(window.localStorage.getItem("wan-memory-had-selected-photos") === "1" || (Array.isArray(parsed.memories) && parsed.memories.some((memory: MemoryDraft) => memory.photoNames?.length)) || (Array.isArray(parsed.photoNames) && parsed.photoNames.length > 0));
          setDraft({
            ...emptyDraft,
            ...parsed,
            petName: parsed.petName?.trim() || preferredPetName,
            memories: parsedMemories,
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
      window.localStorage.setItem("kimi-film-draft", JSON.stringify(draft));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, hydrated]);

  useEffect(() => {
    const selectedPhotoCount = Object.values(memoryPhotoFiles).reduce((total, files) => total + files.length, 0);
    if (!selectedPhotoCount || submitting) return;
    const confirmBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmBeforeLeave);
    return () => window.removeEventListener("beforeunload", confirmBeforeLeave);
  }, [memoryPhotoFiles, submitting]);

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const togglePersonality = (value: string) => update("personality", draft.personality.includes(value) ? draft.personality.filter((item) => item !== value) : [...draft.personality, value]);
  const updateMemory = <K extends keyof MemoryDraft>(clientKey: string, key: K, value: MemoryDraft[K]) => setDraft((current) => ({
    ...current,
    memories: current.memories.map((memory) => memory.clientKey === clientKey ? { ...memory, [key]: value } : memory),
  }));
  const addMemory = () => {
    if (draft.memories.length >= MAX_MEMORY_COUNT) return;
    const clientKey = `memory-${crypto.randomUUID()}`;
    update("memories", [...draft.memories, createMemoryDraft(clientKey)]);
  };
  const removeMemory = (clientKey: string) => {
    if (draft.memories.length <= 1) return;
    setMemoryPhotoFiles((current) => {
      const next = { ...current };
      delete next[clientKey];
      return next;
    });
    update("memories", draft.memories.filter((memory) => memory.clientKey !== clientKey));
  };
  const handleMemoryPhotos = (clientKey: string, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 3);
    setMemoryPhotoFiles((current) => ({ ...current, [clientKey]: files }));
    setPhotoRestoreNotice(false);
    if (files.length || Object.values(memoryPhotoFiles).some((selected) => selected.length)) window.localStorage.setItem("wan-memory-had-selected-photos", "1");
    else window.localStorage.removeItem("wan-memory-had-selected-photos");
    updateMemory(clientKey, "photoNames", files.map((file) => file.name));
  };
  const selectFilmPurpose = (purpose: FilmPurpose) => setDraft((current) => ({ ...current, purpose, style: purpose === "虹の橋メモリアル" ? "穏やかなメモリアル" : current.style === "穏やかなメモリアル" ? "あたたかな日常映画" : current.style }));
  const selectPeoplePresence = (value: PresenceAnswer) => setDraft((current) => value === "none"
    ? { ...current, peoplePresence: value, peopleHandling: "not_applicable", minorPresence: "none", depictedPeopleConsent: false, minorGuardianConsent: false }
    : { ...current, peoplePresence: value, peopleHandling: "", minorPresence: "", depictedPeopleConsent: false, minorGuardianConsent: false });

  const totalPhotoCount = useMemo(
    () => draft.memories.reduce((total, memory) => total + (memoryPhotoFiles[memory.clientKey]?.length ?? 0), 0),
    [draft.memories, memoryPhotoFiles],
  );

  const missingFields = useMemo<MissingField[]>(() => {
    const missing: MissingField[] = [];
    if (!draft.petName.trim()) missing.push({ key: "petName", label: "愛犬のお名前", step: 1 });
    if (!draft.breed.trim()) missing.push({ key: "breed", label: "犬種", step: 1 });
    if (!draft.age.trim()) missing.push({ key: "age", label: "年齢（推定でも可）", step: 1 });
    if (draft.personality.length === 0) missing.push({ key: "personality", label: "性格（1つ以上）", step: 1 });
    if (draft.memories.length < MIN_MEMORY_COUNT) missing.push({ key: "memories", label: `思い出の項目（${MIN_MEMORY_COUNT}つ以上）`, step: 2 });
    draft.memories.forEach((memory, index) => {
      const number = index + 1;
      if (!memory.title.trim()) missing.push({ key: `memory-${memory.clientKey}-title`, label: `思い出${number}のタイトル`, step: 2 });
      if (memory.description.trim().length < 30) missing.push({ key: `memory-${memory.clientKey}-description`, label: `思い出${number}の詳しい内容（30文字以上）`, step: 2 });
      if (memory.dogBehavior.trim().length < 10) missing.push({ key: `memory-${memory.clientKey}-behavior`, label: `思い出${number}の表情・動き（10文字以上）`, step: 2 });
      const memoryPhotoCount = memoryPhotoFiles[memory.clientKey]?.length ?? 0;
      if (memoryPhotoCount < 1) missing.push({ key: `memory-${memory.clientKey}-photos`, label: `思い出${number}の写真（1〜3枚）`, step: 2 });
    });
    if (totalPhotoCount < MIN_TOTAL_PHOTOS) missing.push({ key: "totalPhotos", label: `写真合計${MIN_TOTAL_PHOTOS}枚以上（現在${totalPhotoCount}枚）`, step: 2 });
    if (!draft.message.trim()) missing.push({ key: "message", label: "その子へ伝えたいこと", step: 2 });
    if (!draft.peoplePresence) missing.push({ key: "peoplePresence", label: "写真に人物が写っているか", step: 2 });
    if (draft.peoplePresence === "included" && !draft.peopleHandling) missing.push({ key: "peopleHandling", label: "人物の映像での取り扱い", step: 2 });
    if (draft.peoplePresence === "included" && !draft.minorPresence) missing.push({ key: "minorPresence", label: "未成年者が写っているか", step: 2 });
    if (draft.minorPresence === "included" && !draft.minorGuardianConsent) missing.push({ key: "minorGuardianConsent", label: "未成年者の保護者同意", step: 2 });
    if (!draft.termsConsent) missing.push({ key: "termsConsent", label: "利用規約・プライバシーポリシーへの同意", step: 4 });
    if (!draft.photoRightsConsent) missing.push({ key: "photoRightsConsent", label: "提出写真の使用権限の確認", step: 4 });
    if (draft.peoplePresence === "included" && !draft.depictedPeopleConsent) missing.push({ key: "depictedPeopleConsent", label: "写真に写っている人物の同意確認", step: 4 });
    if (!draft.externalAiConsent) missing.push({ key: "externalAiConsent", label: "外部AI制作サービスでの処理への同意", step: 4 });
    return missing;
  }, [draft, memoryPhotoFiles, totalPhotoCount]);

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
      const memorySummary = draft.memories.map((memory, index) => `${index + 1}. ${memory.title}\n${memory.description}`).join("\n\n");
      const orderPayload = {
        pet_name: draft.petName, name_kana: draft.nameKana, breed: draft.breed, age_text: draft.age,
        purpose: draft.purpose, personality: draft.personality, first_meeting: "",
        favorite_memory: memorySummary, message_to_pet: draft.message, avoid_notes: draft.avoid,
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

      let completedPhotos = 0;
      for (let index = 0; index < draft.memories.length; index += 1) {
        const memory = draft.memories[index];
        const { data: memoryId, error: memoryError } = await supabase.rpc("save_order_memory_entry", {
          p_order_id: orderId,
          p_client_key: memory.clientKey,
          p_sort_order: index + 1,
          p_title: memory.title.trim(),
          p_when_text: memory.whenText.trim() || null,
          p_location: memory.location.trim() || null,
          p_description: memory.description.trim(),
          p_dog_behavior: memory.dogBehavior.trim(),
        });
        if (memoryError || !memoryId) throw memoryError || new Error("思い出を保存できませんでした。");
        const files = memoryPhotoFiles[memory.clientKey] ?? [];
        await uploadOrderImages(supabase, user.id, orderId, files, (memoryCompleted) => {
          setUploadProgress(Math.round(((completedPhotos + memoryCompleted) / totalPhotoCount) * 100));
        }, memoryId as string);
        completedPhotos += files.length;
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
            <p className="step-lead">思い出をひとつずつ追加し、その場面が分かる写真を結びつけてください。{draft.purpose === "虹の橋メモリアル" ? "最後の時期や病院のことは、望まない限り書かなくて大丈夫です。" : "うまく文章にしようとせず、覚えている順に書いて大丈夫です。"}</p>

            <section className="memory-writing-guide" aria-labelledby="memory-writing-guide-title">
              <div><p className="eyebrow">WRITING GUIDE</p><h2 id="memory-writing-guide-title">映像にしやすい伝え方</h2></div>
              <ol>
                <li><span>01</span><div><strong>ひとつの出来事に絞る</strong><p>「旅行」だけではなく「海辺で初めて波を見た日」のように、ひとつの場面にします。</p></div></li>
                <li><span>02</span><div><strong>その子の動きや表情を書く</strong><p>走った、振り返った、首をかしげたなど、実際に見た様子を教えてください。</p></div></li>
                <li><span>03</span><div><strong>内容と同じ場面の写真を選ぶ</strong><p>その場所・服・季節が分かる写真を1〜3枚選ぶと、確認と映像制作がしやすくなります。</p></div></li>
              </ol>
              <p>例：「去年の春、いつもの公園で桜を見ました。モモは花びらを追いかけたあと、こちらを見て首をかしげました。」</p>
            </section>

            <section className="photo-quality-guide" aria-labelledby="photo-quality-title">
              <p className="eyebrow">PHOTO GUIDE</p>
              <h2 id="photo-quality-title">その思い出と同じ場面の、見やすい写真を選んでください。</h2>
              <ul>
                <li>顔と目がはっきり見える</li><li>毛色と模様が自然に見える</li><li>強いフィルターや逆光がない</li>
                <li>身体の一部が切れていない</li><li>ほかの動物や物に隠れていない</li><li>実際の体型が分かる</li>
              </ul>
              <p>その場所・服・季節が分かる写真を優先してください。正面の顔・横顔・全身が組み合わさると、外見も確認しやすくなります。</p>
            </section>

            <div className="memory-entry-list">
              {draft.memories.map((memory, index) => {
                const files = memoryPhotoFiles[memory.clientKey] ?? [];
                return <article className="memory-entry-card" key={memory.clientKey}>
                  <header><div><span>MEMORY {String(index + 1).padStart(2, "0")}</span><strong>{memory.title.trim() || "新しい思い出"}</strong></div>{draft.memories.length > 1 && <button type="button" onClick={() => removeMemory(memory.clientKey)}>この項目を削除</button>}</header>
                  <div className="memory-entry-fields">
                    <label className="wide"><span>思い出のタイトル <em>必須</em></span><input value={memory.title} maxLength={80} onChange={(event) => updateMemory(memory.clientKey, "title", event.target.value)} placeholder="例：はじめて海を見た日" /></label>
                    <label><span>いつ頃ですか？ <small>任意</small></span><input value={memory.whenText} maxLength={120} onChange={(event) => updateMemory(memory.clientKey, "whenText", event.target.value)} placeholder="例：2025年の春 / 3歳の頃" /></label>
                    <label><span>どこでの思い出ですか？ <small>任意</small></span><input value={memory.location} maxLength={120} onChange={(event) => updateMemory(memory.clientKey, "location", event.target.value)} placeholder="例：いつもの公園、家のリビング" /></label>
                    <label className="wide"><span>そのときのことを詳しく教えてください <em>必須・30文字以上</em></span><textarea rows={5} maxLength={2000} value={memory.description} onChange={(event) => updateMemory(memory.clientKey, "description", event.target.value)} placeholder="誰と、どんな時間を過ごし、何が心に残っていますか？ 写真に写っている場面と結びつくように書いてください。" /><small className={memory.description.trim().length >= 30 ? "field-count complete" : "field-count"}>{memory.description.trim().length} / 30文字以上</small></label>
                    <label className="wide"><span>その子の表情や動き <em>必須・10文字以上</em></span><textarea rows={3} maxLength={1000} value={memory.dogBehavior} onChange={(event) => updateMemory(memory.clientKey, "dogBehavior", event.target.value)} placeholder="例：花びらを追いかけ、最後にこちらを見て首をかしげました。" /><small className={memory.dogBehavior.trim().length >= 10 ? "field-count complete" : "field-count"}>{memory.dogBehavior.trim().length} / 10文字以上</small></label>
                  </div>
                  <div className="memory-photo-upload">
                    <input id={`memory-photos-${memory.clientKey}`} type="file" required accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={(event) => handleMemoryPhotos(memory.clientKey, event)} />
                    <label htmlFor={`memory-photos-${memory.clientKey}`}><span className="upload-mark" aria-hidden="true">＋</span><strong>この思い出の写真を選ぶ <em>必須</em></strong><small>1〜3枚 · JPG・PNG・HEIC・WebP</small></label>
                    {files.length > 0 && <div className="memory-photo-files"><strong>{files.length}枚を選択しました</strong>{files.map((file) => <span key={`${file.name}-${file.size}`}>{file.name}</span>)}<button type="button" onClick={() => { setMemoryPhotoFiles((current) => ({ ...current, [memory.clientKey]: [] })); updateMemory(memory.clientKey, "photoNames", []); }}>選び直す</button></div>}
                  </div>
                </article>;
              })}
            </div>

            <div className="memory-entry-add"><button type="button" disabled={draft.memories.length >= MAX_MEMORY_COUNT} onClick={addMemory}>＋ 別の思い出を追加する</button><p>{MIN_MEMORY_COUNT}〜{MAX_MEMORY_COUNT}項目・各1〜3枚、写真は合計{MIN_TOTAL_PHOTOS}枚以上必要です。現在：{draft.memories.length}項目 / {totalPhotoCount}枚</p></div>

            <div className="stacked-fields memory-ending-fields">
              <label><span>その子へ伝えたいこと <em>必須</em></span><textarea required rows={3} value={draft.message} onChange={(event) => update("message", event.target.value)} placeholder="映画の最後に残したい言葉があれば" /></label>
              <label><span>映像に入れたくないこと <small>任意</small></span><textarea rows={2} value={draft.avoid} onChange={(event) => update("avoid", event.target.value)} placeholder="病院の場面、最後の時期、直接的な表現など。遠慮なく書いてください" /></label>
            </div>

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
          </div>}
          {step === 3 && <div className="wizard-panel"><p className="eyebrow">FILM DIRECTION</p><h1 id="step-title">どんな空気の映画にしますか？</h1><p className="step-lead">迷ったら「日常映画」がおすすめです。担当者からもご提案します。映像はBGMと短い字幕を中心に、思い出へ集中できる構成にします。</p><div className="style-list">{styles.map(([title, copy], index) => <label className={draft.style === title ? "style-card selected" : "style-card"} key={title}><input type="radio" name="style" checked={draft.style === title} onChange={() => update("style", title)} /><span className={`style-swatch swatch-${index + 1}`} aria-hidden="true" /><span><strong>{title}</strong><small>{copy}</small></span><span className="radio-dot" /></label>)}</div><div className="form-grid compact"><label><span>映像比率</span><select value={draft.ratio} onChange={(event) => update("ratio", event.target.value)}><option>16:9 横型</option><option>9:16 縦型</option><option>1:1 正方形</option></select></label><label><span>BGM</span><select value={draft.bgm} onChange={(event) => update("bgm", event.target.value)}><option>おまかせ</option><option>静かなピアノ</option><option>アコースティックギター</option><option>映画音楽のように</option></select></label></div></div>}
          {step === 4 && <div className="wizard-panel">
            <p className="eyebrow">REVIEW</p><h1 id="step-title">ありがとうございます。</h1>
            <p className="step-lead">まずは相談受付としてお預かりします。決済は内容と納期をご確認いただいた後です。</p>
            <div className="review-card">
              <div className="review-title"><span className="brand-mark" aria-hidden="true">WM</span><div><strong>{draft.petName || "愛犬"}ちゃんの映画</strong><small>{draft.purpose}・{draft.style}</small></div></div>
              <dl>
                <div><dt>お名前</dt><dd>{draft.petName || "未入力"}</dd></div><div><dt>犬種・年齢</dt><dd>{[draft.breed, draft.age].filter(Boolean).join(" / ") || "未入力"}</dd></div><div><dt>性格</dt><dd>{draft.personality.join("、") || "未入力"}</dd></div><div><dt>希望</dt><dd>{draft.ratio}・BGM：{draft.bgm}</dd></div><div><dt>思い出・写真</dt><dd>{draft.memories.length}項目 / {totalPhotoCount}枚</dd></div>
                <div><dt>人物の有無</dt><dd>{draft.peoplePresence === "included" ? "あり" : draft.peoplePresence === "none" ? "なし" : "未入力"}</dd></div>
                {draft.peoplePresence === "included" && <><div><dt>人物の取り扱い</dt><dd>{peopleHandlingLabel(draft.peopleHandling)}</dd></div><div><dt>未成年者</dt><dd>{draft.minorPresence === "included" ? "あり" : draft.minorPresence === "none" ? "なし" : "未入力"}</dd></div></>}
                <div><dt>プラン</dt><dd>メモリーフィルム</dd></div><div><dt>料金</dt><dd className="review-monitor-price"><strong>先着{MEMORY_FILM_PRICING.launchLimit}組 ¥{formatYen(MEMORY_FILM_PRICING.launchPrice)}（税込）</strong><small>必要な思い出と写真の送信が完了した時点で確定・終了後は ¥{formatYen(MEMORY_FILM_PRICING.regularPrice)}</small></dd></div><div><dt>映画の種類</dt><dd>{selectedPurpose.title}</dd></div><div><dt>コンセプト</dt><dd>2案から1案を選択</dd></div><div><dt>共通エンディング</dt><dd>{selectedPurpose.endingTitle}</dd></div><div><dt>専用サイト</dt><dd>プランに含まれます</dd></div>
              </dl>
              <div className="review-memory-list">{draft.memories.map((memory, index) => <article key={memory.clientKey}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{memory.title || "タイトル未入力"}</strong><p>{memory.description || "詳しい内容が未入力です。"}</p><small>{memory.whenText || "時期未入力"} · {memory.location || "場所未入力"} · 写真{memoryPhotoFiles[memory.clientKey]?.length ?? 0}枚</small></div></article>)}</div>
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
          {submitting && <div className="submit-progress" role="status"><span style={{ width: `${totalPhotoCount ? uploadProgress : 100}%` }} /><p>{totalPhotoCount ? `思い出と写真を安全に送信しています… ${uploadProgress}%` : "ご相談を受け付けています…"}</p></div>}
          <div className="wizard-actions">{step > 0 ? <button className="button button-ghost" type="button" disabled={submitting} onClick={() => goToStep(step - 1)}>← 戻る</button> : <span />}{step < steps.length - 1 ? <button className="button button-primary" type="button" onClick={goNext}>次へ進む →</button> : <button className="button button-primary" type="button" disabled={submitting} onClick={submit}>{submitting ? "送信中…" : missingFields.length ? `未入力${missingFields.length}項目を確認する →` : "相談を受け付ける →"}</button>}</div>
        </section>
      </div>
    </main>
  );
}
