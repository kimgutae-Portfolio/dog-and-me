"use client";
/* eslint-disable @next/next/no-img-element -- Local object URLs need native image previews before upload. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { CONSENT_VERSIONS } from "../lib/consent";
import { formatYen, MEMORY_FILM_PRICING } from "../lib/pricing";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import type { AppearancePolicy } from "../lib/supabase/types";
import { OrderImageUploadError, uploadOrderImages } from "../lib/supabase/uploads";

type FilmPurpose = "いまを残す" | "虹の橋メモリアル";
type PresenceAnswer = "" | "none" | "included";
type PeopleHandling = "" | "not_applicable" | "dog_only_crop" | "anonymous_person" | "original_still" | "consult";
type MissingField = { key: string; label: string; step: number };
type PhotoDraft = { clientKey: string; file: File; previewUrl: string };

type MemoryDraft = {
  clientKey: string;
  title: string;
  whenText: string;
  location: string;
  description: string;
  dogBehavior: string;
  photoKeys: string[];
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
  primaryFacePhotoKey: string;
  primaryBodyPhotoKey: string;
  sideTailPhotoKey: string;
  appearancePolicy: AppearancePolicy;
  selectedAppearanceDescription: string;
  selectedAppearancePhotoKeys: string[];
  ownerLockedTraits: string[];
  termsConsent: boolean;
  photoRightsConsent: boolean;
  depictedPeopleConsent: boolean;
  minorGuardianConsent: boolean;
  externalAiConsent: boolean;
  aiReconstructionAcknowledged: boolean;
};

const MIN_MEMORY_COUNT = 2;
const MAX_MEMORY_COUNT = 6;
const MIN_TOTAL_PHOTOS = 5;
const MAX_TOTAL_PHOTOS = 30;
const MAX_PHOTOS_PER_MEMORY = 5;

const createMemoryDraft = (clientKey: string): MemoryDraft => ({
  clientKey,
  title: "",
  whenText: "",
  location: "",
  description: "",
  dogBehavior: "",
  photoKeys: [],
});

const isMemoryReady = (memory: MemoryDraft) => (
  Boolean(memory.title.trim())
  && memory.description.trim().length >= 30
  && memory.dogBehavior.trim().length >= 10
  && memory.photoKeys.length >= 1
);

const emptyDraft: Draft = {
  purpose: "いまを残す",
  petName: "",
  nameKana: "",
  breed: "",
  age: "",
  personality: [],
  memories: [createMemoryDraft("memory-1"), createMemoryDraft("memory-2")],
  message: "",
  avoid: "",
  style: "あたたかな日常映画",
  ratio: "16:9 横型",
  narration: "ナレーションなし",
  bgm: "おまかせ",
  peoplePresence: "",
  peopleHandling: "",
  minorPresence: "",
  primaryFacePhotoKey: "",
  primaryBodyPhotoKey: "",
  sideTailPhotoKey: "",
  appearancePolicy: "photo_era_by_scene",
  selectedAppearanceDescription: "",
  selectedAppearancePhotoKeys: [],
  ownerLockedTraits: [""],
  termsConsent: false,
  photoRightsConsent: false,
  depictedPeopleConsent: false,
  minorGuardianConsent: false,
  externalAiConsent: false,
  aiReconstructionAcknowledged: false,
};

const steps = ["目的", "愛犬のこと", "お写真", "思い出", "映画の雰囲気", "確認"];
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
const appearanceOptions: Array<[AppearancePolicy, string]> = [
  ["photo_era_by_scene", "写真を撮った当時の姿を、場面ごとに残したい"],
  ["current_appearance", "現在の姿で全編を統一したい"],
  ["selected_period", "特定の時期の姿で全編を統一したい"],
];
const peopleHandlingOptions = [
  ["dog_only_crop", "愛犬だけを切り抜いて使用する（おすすめ）"],
  ["anonymous_person", "お顔が分からない後ろ姿・手元・足元・シルエットで表現する"],
  ["original_still", "元の家族写真を、動かさずそのまま映像内に使用する"],
  ["consult", "どの方法がよいか担当者に相談したい"],
] as const;

function peopleHandlingLabel(value: PeopleHandling) {
  if (value === "not_applicable") return "該当なし";
  return peopleHandlingOptions.find(([key]) => key === value)?.[1] ?? "未選択";
}

function appearancePolicyLabel(value: AppearancePolicy) {
  return appearanceOptions.find(([key]) => key === value)?.[1] ?? "未選択";
}

type PhotoSelectorProps = {
  id: string;
  stepLabel: string;
  legend: string;
  guide?: string;
  optional?: boolean;
  name: string;
  photos: PhotoDraft[];
  value: string;
  roleLabel: string;
  roleKeys: Record<string, string[]>;
  onChange: (value: string) => void;
};

function PhotoSelector({ id, stepLabel, legend, guide, optional, name, photos, value, roleLabel, roleKeys, onChange }: PhotoSelectorProps) {
  return <fieldset className="representative-photo-fieldset" id={id}>
    <legend><span className="photo-selector-step">{stepLabel}</span>{legend} <em>{optional ? "任意" : "必須"}</em></legend>
    {guide && <p>{guide}</p>}
    <div className="photo-choice-grid">
      {optional && <label className={value ? "photo-choice-card empty" : "photo-choice-card empty selected"}>
        <input type="radio" name={name} checked={!value} onChange={() => onChange("")} />
        <span className="photo-choice-empty">選択しない</span>
        {!value && <strong className="photo-selected-mark">✓ 未選択</strong>}
      </label>}
      {photos.map((photo, index) => {
        const selected = value === photo.clientKey;
        return <label className={selected ? "photo-choice-card selected" : "photo-choice-card"} key={`${name}-${photo.clientKey}`}>
          <input type="radio" name={name} checked={selected} onChange={() => onChange(photo.clientKey)} />
          <img src={photo.previewUrl} alt={`愛犬の写真 ${index + 1}`} loading="lazy" />
          <span className="photo-choice-meta" title={photo.file.name}>写真 {index + 1}</span>
          {roleKeys[photo.clientKey]?.map((badge) => <small className="photo-role-badge" key={badge}>{badge}</small>)}
          {!selected && <span className="photo-choice-action">タップして選ぶ</span>}
          {selected && <strong className="photo-selected-mark">✓ {roleLabel}</strong>}
        </label>;
      })}
    </div>
  </fieldset>;
}

export function StoryWizard() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [photoFiles, setPhotoFiles] = useState<PhotoDraft[]>([]);
  const [previewPhotoKey, setPreviewPhotoKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [failedUploadName, setFailedUploadName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoRestoreNotice, setPhotoRestoreNotice] = useState(false);
  const [photoSelectionNotice, setPhotoSelectionNotice] = useState("");
  const [activeMemoryKey, setActiveMemoryKey] = useState("memory-1");
  const [stepValidationAttempted, setStepValidationAttempted] = useState(false);
  const [photoGuideOpen, setPhotoGuideOpen] = useState(false);
  const [photoGuideStep, setPhotoGuideStep] = useState(0);
  const autoAdvancedMemories = useRef(new Set<string>());
  const photoFilesRef = useRef<PhotoDraft[]>([]);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const photoPreviewDialogRef = useRef<HTMLElement>(null);
  const photoGuideDialogRef = useRef<HTMLElement>(null);
  const photoUploadTriggerRef = useRef<HTMLLabelElement>(null);
  const photoGuideFocusTargetRef = useRef<"previous" | "upload">("previous");

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
                photoKeys: [],
              }))
            : [{ ...createMemoryDraft("memory-1"), title: parsed.firstMeeting ? "はじめて会った日" : "大切な思い出", description: parsed.favoriteMemory || parsed.firstMeeting || "" }];
          while (parsedMemories.length < MIN_MEMORY_COUNT) parsedMemories.push(createMemoryDraft(`memory-${parsedMemories.length + 1}`));
          setPhotoRestoreNotice(window.localStorage.getItem("wan-memory-had-selected-photos") === "1");
          setActiveMemoryKey(parsedMemories[0].clientKey);
          setDraft({
            ...emptyDraft,
            ...parsed,
            petName: parsed.petName?.trim() || preferredPetName,
            memories: parsedMemories,
            purpose,
            primaryFacePhotoKey: "",
            primaryBodyPhotoKey: "",
            sideTailPhotoKey: "",
            selectedAppearancePhotoKeys: [],
            ownerLockedTraits: Array.isArray(parsed.ownerLockedTraits) && parsed.ownerLockedTraits.length ? parsed.ownerLockedTraits.slice(0, 3) : [""],
            termsConsent: parsed.termsConsent ?? parsed.consent ?? false,
            photoRightsConsent: parsed.photoRightsConsent ?? false,
            depictedPeopleConsent: parsed.depictedPeopleConsent ?? false,
            minorGuardianConsent: parsed.minorGuardianConsent ?? false,
            externalAiConsent: parsed.externalAiConsent ?? false,
            aiReconstructionAcknowledged: false,
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

  useEffect(() => { photoFilesRef.current = photoFiles; }, [photoFiles]);
  useEffect(() => () => { photoFilesRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)); }, []);

  useEffect(() => {
    if (!photoFiles.length || submitting) return;
    const confirmBeforeLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", confirmBeforeLeave);
    return () => window.removeEventListener("beforeunload", confirmBeforeLeave);
  }, [photoFiles.length, submitting]);

  useEffect(() => {
    if (!previewPhotoKey) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = photoPreviewDialogRef.current;
    const closeButton = dialog?.querySelector<HTMLButtonElement>("button");
    closeButton?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewPhotoKey("");
      if (event.key === "Tab" && dialog) {
        event.preventDefault();
        closeButton?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [previewPhotoKey]);

  useEffect(() => {
    if (!photoGuideOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = photoGuideDialogRef.current;
    const uploadTrigger = photoUploadTriggerRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        window.localStorage.setItem("wan-memory-photo-guide-seen-v1", "1");
        setPhotoGuideOpen(false);
      }
      if (event.key === "Tab" && dialog) {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (photoGuideFocusTargetRef.current === "upload") {
        window.requestAnimationFrame(() => {
          uploadTrigger?.focus({ preventScroll: true });
          document.getElementById("photo-upload-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          photoGuideFocusTargetRef.current = "previous";
        });
      } else {
        previousFocus?.focus();
      }
    };
  }, [photoGuideOpen]);

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const updateMemory = <K extends keyof MemoryDraft>(clientKey: string, key: K, value: MemoryDraft[K]) => setDraft((current) => ({
    ...current,
    memories: current.memories.map((memory) => memory.clientKey === clientKey ? { ...memory, [key]: value } : memory),
  }));
  const togglePersonality = (value: string) => update("personality", draft.personality.includes(value) ? draft.personality.filter((item) => item !== value) : [...draft.personality, value]);
  const selectedPurpose = filmPurposes.find((purpose) => purpose.value === draft.purpose) ?? filmPurposes[0];
  const previewPhoto = photoFiles.find((photo) => photo.clientKey === previewPhotoKey);

  const roleKeys = useMemo(() => {
    const roles: Record<string, string[]> = {};
    const add = (key: string, label: string) => { if (key) (roles[key] ??= []).push(label); };
    add(draft.primaryFacePhotoKey, "お顔の基準");
    add(draft.primaryBodyPhotoKey, "全身の基準");
    add(draft.sideTailPhotoKey, "横向き・しっぽ");
    return roles;
  }, [draft.primaryBodyPhotoKey, draft.primaryFacePhotoKey, draft.sideTailPhotoKey]);

  const handlePhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []);
    setPhotoFiles((current) => {
      const existing = new Set(current.map((photo) => `${photo.file.name}:${photo.file.size}:${photo.file.lastModified}`));
      const accepted = incoming.filter((file) => !existing.has(`${file.name}:${file.size}:${file.lastModified}`)).slice(0, MAX_TOTAL_PHOTOS - current.length);
      if (accepted.length < incoming.length) setPhotoSelectionNotice(current.length + accepted.length >= MAX_TOTAL_PHOTOS ? `写真は最大${MAX_TOTAL_PHOTOS}枚までです。超えた分は追加されていません。` : "同じ写真は重複せず、1枚だけ追加しました。");
      else setPhotoSelectionNotice(accepted.length ? "写真を追加しました。下の一覧から基準写真を選んでください。" : "");
      return [...current, ...accepted.map((file) => ({ clientKey: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }))];
    });
    if (incoming.length) {
      setPhotoRestoreNotice(false);
      window.localStorage.setItem("wan-memory-had-selected-photos", "1");
    }
    event.target.value = "";
  };

  const removePhoto = (photoKey: string) => {
    const target = photoFiles.find((photo) => photo.clientKey === photoKey);
    if (target) URL.revokeObjectURL(target.previewUrl);
    setPhotoFiles((current) => current.filter((photo) => photo.clientKey !== photoKey));
    setDraft((current) => ({
      ...current,
      primaryFacePhotoKey: current.primaryFacePhotoKey === photoKey ? "" : current.primaryFacePhotoKey,
      primaryBodyPhotoKey: current.primaryBodyPhotoKey === photoKey ? "" : current.primaryBodyPhotoKey,
      sideTailPhotoKey: current.sideTailPhotoKey === photoKey ? "" : current.sideTailPhotoKey,
      selectedAppearancePhotoKeys: current.selectedAppearancePhotoKeys.filter((key) => key !== photoKey),
      memories: current.memories.map((memory) => ({ ...memory, photoKeys: memory.photoKeys.filter((key) => key !== photoKey) })),
    }));
    setPhotoSelectionNotice("削除した写真の基準設定と思い出とのつながりを解除しました。必要な項目を選び直してください。");
    if (photoFiles.length === 1) window.localStorage.removeItem("wan-memory-had-selected-photos");
  };

  const selectFilmPurpose = (purpose: FilmPurpose) => setDraft((current) => ({ ...current, purpose, style: purpose === "虹の橋メモリアル" ? "穏やかなメモリアル" : current.style === "穏やかなメモリアル" ? "あたたかな日常映画" : current.style }));
  const selectPeoplePresence = (value: PresenceAnswer) => setDraft((current) => value === "none"
    ? { ...current, peoplePresence: value, peopleHandling: "not_applicable", minorPresence: "none", depictedPeopleConsent: false, minorGuardianConsent: false }
    : { ...current, peoplePresence: value, peopleHandling: "", minorPresence: "", depictedPeopleConsent: false, minorGuardianConsent: false });

  const selectAppearancePolicy = (policy: AppearancePolicy) => setDraft((current) => ({
    ...current,
    appearancePolicy: policy,
    selectedAppearanceDescription: policy === "selected_period" ? current.selectedAppearanceDescription : "",
    selectedAppearancePhotoKeys: policy === "selected_period" ? current.selectedAppearancePhotoKeys : [],
  }));

  const updateTrait = (index: number, value: string) => update("ownerLockedTraits", draft.ownerLockedTraits.map((trait, traitIndex) => traitIndex === index ? value : trait));
  const removeTrait = (index: number) => update("ownerLockedTraits", draft.ownerLockedTraits.filter((_, traitIndex) => traitIndex !== index));
  const addTrait = () => { if (draft.ownerLockedTraits.length < 3) update("ownerLockedTraits", [...draft.ownerLockedTraits, ""]); };

  const assignedMemoryByPhoto = useMemo(() => {
    const assigned: Record<string, string> = {};
    draft.memories.forEach((memory) => memory.photoKeys.forEach((key) => { assigned[key] = memory.clientKey; }));
    return assigned;
  }, [draft.memories]);

  const toggleMemoryPhoto = (memoryKey: string, photoKey: string) => {
    const memory = draft.memories.find((item) => item.clientKey === memoryKey);
    if (!memory) return;
    if (memory.photoKeys.includes(photoKey)) updateMemory(memoryKey, "photoKeys", memory.photoKeys.filter((key) => key !== photoKey));
    else if (!assignedMemoryByPhoto[photoKey] && memory.photoKeys.length < MAX_PHOTOS_PER_MEMORY) updateMemory(memoryKey, "photoKeys", [...memory.photoKeys, photoKey]);
  };

  const totalPhotoCount = photoFiles.length;
  const totalLinkedPhotoCount = useMemo(() => draft.memories.reduce((total, memory) => total + memory.photoKeys.length, 0), [draft.memories]);
  const allMemoryEntriesComplete = useMemo(() => draft.memories.every(isMemoryReady), [draft.memories]);

  const photoGuideItems = [
    { label: `写真を${MIN_TOTAL_PHOTOS}枚以上追加`, complete: totalPhotoCount >= MIN_TOTAL_PHOTOS },
    { label: "お顔の基準を1枚選択", complete: Boolean(draft.primaryFacePhotoKey) },
    { label: "全身の基準を1枚選択", complete: Boolean(draft.primaryBodyPhotoKey) },
  ];
  const photoGuideSlides = [
    { number: "01", title: `まず、写真を${MIN_TOTAL_PHOTOS}枚以上追加します`, copy: "スマートフォンの写真一覧から、顔・全身・思い出の場面が分かる写真をまとめて選べます。あとから追加や削除もできます。" },
    { number: "02", title: "次に、お顔の基準を1枚選びます", copy: "追加した写真がもう一度並びます。目・鼻・口元がはっきり見える写真を、カードごとタップしてください。" },
    { number: "03", title: "全身の基準も1枚選びます", copy: "立った姿で頭から足先まで見える写真がおすすめです。同じ写真をお顔と全身の両方に選んでも問題ありません。" },
    { number: "04", title: "次の画面で、思い出と写真をつなぎます", copy: "最後に『この写真はどの思い出の場面か』を選びます。迷った場合は、写真に近い出来事を選べば大丈夫です。" },
  ];
  const closePhotoGuide = () => {
    window.localStorage.setItem("wan-memory-photo-guide-seen-v1", "1");
    setPhotoGuideOpen(false);
  };
  const showPhotoGuide = () => {
    photoGuideFocusTargetRef.current = "previous";
    setPhotoGuideStep(0);
    setPhotoGuideOpen(true);
  };
  const closePhotoGuideAndShowUploader = () => {
    photoGuideFocusTargetRef.current = "upload";
    closePhotoGuide();
  };
  const scrollToPhotoTask = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const handleNextPhotoTask = () => {
    if (totalPhotoCount < MIN_TOTAL_PHOTOS) {
      document.getElementById("shared-photo-input")?.click();
      return;
    }
    if (!draft.primaryFacePhotoKey) { scrollToPhotoTask("primary-face-section"); return; }
    if (!draft.primaryBodyPhotoKey) { scrollToPhotoTask("primary-body-section"); return; }
    scrollToPhotoTask("appearance-policy-section");
  };
  const nextPhotoTaskLabel = totalPhotoCount < MIN_TOTAL_PHOTOS
    ? photoFiles.length ? `写真を追加する（あと${MIN_TOTAL_PHOTOS - totalPhotoCount}枚）` : "写真を選ぶ"
    : !draft.primaryFacePhotoKey ? "お顔の基準写真を選ぶ"
    : !draft.primaryBodyPhotoKey ? "全身の基準写真を選ぶ"
    : "次の設定へ進む";

  const addMemory = () => {
    if (draft.memories.length >= MAX_MEMORY_COUNT || !allMemoryEntriesComplete) return;
    const clientKey = `memory-${crypto.randomUUID()}`;
    update("memories", [...draft.memories, createMemoryDraft(clientKey)]);
    setActiveMemoryKey(clientKey);
  };
  const removeMemory = (clientKey: string) => {
    if (draft.memories.length <= MIN_MEMORY_COUNT) return;
    const removedIndex = draft.memories.findIndex((memory) => memory.clientKey === clientKey);
    const remaining = draft.memories.filter((memory) => memory.clientKey !== clientKey);
    update("memories", remaining);
    if (activeMemoryKey === clientKey) setActiveMemoryKey(remaining[Math.max(0, removedIndex - 1)]?.clientKey ?? remaining[0]?.clientKey ?? "");
  };

  useEffect(() => {
    if (!hydrated) return;
    for (let index = 0; index < draft.memories.length - 1; index += 1) {
      const memory = draft.memories[index];
      if (!isMemoryReady(memory) || autoAdvancedMemories.current.has(memory.clientKey)) continue;
      autoAdvancedMemories.current.add(memory.clientKey);
      setActiveMemoryKey((current) => current === memory.clientKey ? draft.memories[index + 1].clientKey : current);
      break;
    }
  }, [draft.memories, hydrated]);

  const missingFields = useMemo<MissingField[]>(() => {
    const missing: MissingField[] = [];
    if (!draft.petName.trim()) missing.push({ key: "petName", label: "愛犬のお名前", step: 1 });
    if (!draft.breed.trim()) missing.push({ key: "breed", label: "犬種", step: 1 });
    if (!draft.age.trim()) missing.push({ key: "age", label: "年齢（推定でも可）", step: 1 });
    if (draft.personality.length === 0) missing.push({ key: "personality", label: "性格（1つ以上）", step: 1 });
    if (totalPhotoCount < MIN_TOTAL_PHOTOS) missing.push({ key: "totalPhotos", label: `写真${MIN_TOTAL_PHOTOS}枚以上（現在${totalPhotoCount}枚）`, step: 2 });
    if (!draft.primaryFacePhotoKey) missing.push({ key: "primaryFace", label: "お顔の基準写真", step: 2 });
    if (!draft.primaryBodyPhotoKey) missing.push({ key: "primaryBody", label: "全身の基準写真", step: 2 });
    if (!draft.appearancePolicy) missing.push({ key: "appearancePolicy", label: "思い出の中の姿", step: 2 });
    if (draft.appearancePolicy === "selected_period") {
      if (!draft.selectedAppearanceDescription.trim() || draft.selectedAppearanceDescription.trim().length > 200) missing.push({ key: "appearanceDescription", label: "残したい時期の姿（200文字以内）", step: 2 });
      if (draft.selectedAppearancePhotoKeys.length < 1 || draft.selectedAppearancePhotoKeys.length > 3) missing.push({ key: "appearancePhotos", label: "その時期が分かる写真（1〜3枚）", step: 2 });
    }
    const traits = draft.ownerLockedTraits.map((trait) => trait.trim()).filter(Boolean);
    if (draft.ownerLockedTraits.some((trait) => trait.trim().length > 80) || traits.length > 3) missing.push({ key: "traits", label: "変わってほしくない特徴（各80文字・3つまで）", step: 2 });
    if (!draft.peoplePresence) missing.push({ key: "peoplePresence", label: "写真に人物が写っているか", step: 2 });
    if (draft.peoplePresence === "included" && !draft.peopleHandling) missing.push({ key: "peopleHandling", label: "人物の映像での取り扱い", step: 2 });
    if (draft.peoplePresence === "included" && !draft.minorPresence) missing.push({ key: "minorPresence", label: "未成年者が写っているか", step: 2 });
    if (draft.minorPresence === "included" && !draft.minorGuardianConsent) missing.push({ key: "minorGuardianConsent", label: "未成年者の保護者同意", step: 2 });
    if (draft.memories.length < MIN_MEMORY_COUNT) missing.push({ key: "memories", label: `思い出の項目（${MIN_MEMORY_COUNT}つ以上）`, step: 3 });
    draft.memories.forEach((memory, index) => {
      const number = index + 1;
      if (!memory.title.trim()) missing.push({ key: `memory-${memory.clientKey}-title`, label: `思い出${number}のタイトル`, step: 3 });
      if (memory.description.trim().length < 30) missing.push({ key: `memory-${memory.clientKey}-description`, label: `思い出${number}の詳しい内容（30文字以上）`, step: 3 });
      if (memory.dogBehavior.trim().length < 10) missing.push({ key: `memory-${memory.clientKey}-behavior`, label: `思い出${number}の表情・動き（10文字以上）`, step: 3 });
      if (memory.photoKeys.length < 1) missing.push({ key: `memory-${memory.clientKey}-photos`, label: `思い出${number}の写真（1〜${MAX_PHOTOS_PER_MEMORY}枚）`, step: 3 });
    });
    if (totalLinkedPhotoCount < MIN_TOTAL_PHOTOS) missing.push({ key: "linkedPhotos", label: `思い出に使う写真 合計${MIN_TOTAL_PHOTOS}枚以上（現在${totalLinkedPhotoCount}枚）`, step: 3 });
    if (!draft.message.trim()) missing.push({ key: "message", label: "その子へ伝えたいこと", step: 3 });
    if (!draft.termsConsent) missing.push({ key: "termsConsent", label: "利用規約・プライバシーポリシーへの同意", step: 5 });
    if (!draft.photoRightsConsent) missing.push({ key: "photoRightsConsent", label: "提出写真の使用権限の確認", step: 5 });
    if (draft.peoplePresence === "included" && !draft.depictedPeopleConsent) missing.push({ key: "depictedPeopleConsent", label: "写真に写っている人物の同意確認", step: 5 });
    if (!draft.externalAiConsent) missing.push({ key: "externalAiConsent", label: "外部AIサービスでの処理への同意", step: 5 });
    if (!draft.aiReconstructionAcknowledged) missing.push({ key: "aiReconstructionAcknowledged", label: "映画的な再構成についての確認", step: 5 });
    return missing;
  }, [draft, totalLinkedPhotoCount, totalPhotoCount]);

  const currentStepMissingFields = useMemo(() => missingFields.filter((item) => item.step === step), [missingFields, step]);

  const goToStep = (targetStep: number) => {
    setError("");
    setStepValidationAttempted(false);
    setStep(targetStep);
    if (targetStep === 2 && window.localStorage.getItem("wan-memory-photo-guide-seen-v1") !== "1") {
      photoGuideFocusTargetRef.current = "upload";
      setPhotoGuideStep(0);
      setPhotoGuideOpen(true);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    if (currentStepMissingFields.length > 0) {
      setStepValidationAttempted(true);
      setError("このステップの必須項目をすべて入力してください。未入力の内容を下に表示しています。");
      if (step === 3) {
        const firstIncompleteMemory = draft.memories.find((memory) => !isMemoryReady(memory));
        if (firstIncompleteMemory) setActiveMemoryKey(firstIncompleteMemory.clientKey);
      }
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    goToStep(Math.min(step + 1, steps.length - 1));
  };

  const submit = async () => {
    if (missingFields.length > 0) {
      setError("必須項目がまだ入力されていません。画面内の一覧から入力する項目を選んでください。");
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    if (!user) { router.push("/auth?mode=signup&next=/story"); return; }

    setSubmitting(true);
    setUploadProgress(0);
    setError("");
    setFailedUploadName("");
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

      const memoryIds = new Map<string, string>();
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
        memoryIds.set(memory.clientKey, memoryId as string);
      }

      const uploadedAssets = await uploadOrderImages(
        supabase,
        user.id,
        orderId,
        photoFiles.map((photo) => photo.file),
        (completed, total) => setUploadProgress(Math.round((completed / total) * 100)),
      );
      if (uploadedAssets.length !== photoFiles.length) throw new Error("写真をすべて確認できませんでした。");
      const assetIdByPhotoKey = new Map(photoFiles.map((photo, index) => [photo.clientKey, uploadedAssets[index].id]));
      const requiredAssetId = (photoKey: string) => {
        const id = assetIdByPhotoKey.get(photoKey);
        if (!id) throw new Error("選んだ写真を確認できませんでした。");
        return id;
      };

      for (const memory of draft.memories) {
        const memoryId = memoryIds.get(memory.clientKey);
        if (!memoryId) throw new Error("思い出を確認できませんでした。");
        const { error: linkError } = await supabase.rpc("assign_memory_photos", {
          p_order_id: orderId,
          p_memory_id: memoryId,
          p_asset_ids: memory.photoKeys.map(requiredAssetId),
        });
        if (linkError) throw linkError;
      }

      const { error: productionError } = await supabase.rpc("save_order_production_fields", {
        p_order_id: orderId,
        p_data: {
          primary_face_photo_id: requiredAssetId(draft.primaryFacePhotoKey),
          primary_body_photo_id: requiredAssetId(draft.primaryBodyPhotoKey),
          side_tail_photo_id: draft.sideTailPhotoKey ? requiredAssetId(draft.sideTailPhotoKey) : null,
          appearance_policy: draft.appearancePolicy,
          selected_appearance_description: draft.appearancePolicy === "selected_period" ? draft.selectedAppearanceDescription.trim() : null,
          selected_appearance_photo_ids: draft.appearancePolicy === "selected_period" ? draft.selectedAppearancePhotoKeys.map(requiredAssetId) : [],
          owner_locked_traits: draft.ownerLockedTraits.map((trait) => trait.trim()).filter(Boolean),
          ai_reconstruction_acknowledged: draft.aiReconstructionAcknowledged,
        },
      });
      if (productionError) throw productionError;

      const { error: submitError } = await supabase.rpc("submit_memory_order", { p_order_id: orderId });
      if (submitError) throw submitError;
      window.localStorage.removeItem("kimi-film-draft");
      window.localStorage.removeItem("wan-memory-had-selected-photos");
      window.localStorage.removeItem("wan-memory-pending-order-id");
      router.push(`/studio?received=1&order=${orderId}`);
    } catch (caught) {
      console.error(caught);
      if (caught instanceof OrderImageUploadError) setFailedUploadName(caught.fileName);
      const message = caught instanceof Error && /[ぁ-んァ-ヶ一-龠]/.test(caught.message)
        ? caught.message
        : "受付を完了できませんでした。通信状態をご確認のうえ、もう一度お試しください。";
      setError(message);
      setSubmitting(false);
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
  };

  if (!hydrated || authLoading || !user) return <div className="wizard-loading">思い出の続きを準備しています…</div>;

  return (
    <main className="wizard-page">
      <header className="wizard-header">
        <Link className="brand" href="/" aria-label="WAN MEMORY トップへ"><span className="brand-mark" aria-hidden="true">WM</span><span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span></Link>
        <div className="save-status" aria-live="polite"><span className={saved ? "save-dot active" : "save-dot"} />{saved ? "下書きを保存しました" : "入力内容は自動保存されます"}</div>
        <Link className="wizard-close" href="/" aria-label="入力を閉じる">×</Link>
      </header>
      <div className="wizard-progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="wizard-layout">
        <aside className="wizard-side"><p>YOUR STORY</p><ol>{steps.map((label, index) => <li className={index === step ? "active" : index < step ? "done" : ""} key={label}><span>{index < step ? "✓" : index + 1}</span>{label}</li>)}</ol><blockquote>「きれいに書こうとしなくて大丈夫です。覚えているままを聞かせてください。」</blockquote></aside>

        <section className="wizard-main" aria-labelledby="step-title">
          <div className="step-count">STEP {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")} <strong>{steps[step]}</strong></div>
          {step === 0 && <div className="wizard-panel"><p className="eyebrow">CHOOSE YOUR FILM</p><h1 id="step-title">最初に、どちらの映画か教えてください。</h1><p className="step-lead">2つのコンセプト案は異なる物語でご提案しますが、最後は選んだ種類に合う共通エンディングで結びます。</p><div className="film-type-grid">{filmPurposes.map((purpose) => <label className={draft.purpose === purpose.value ? `film-type-card selected ${purpose.value === "虹の橋メモリアル" ? "memorial" : ""}` : `film-type-card ${purpose.value === "虹の橋メモリアル" ? "memorial" : ""}`} key={purpose.value}><input type="radio" name="purpose" checked={draft.purpose === purpose.value} onChange={() => selectFilmPurpose(purpose.value)} /><span className="choice-check" aria-hidden="true">✓</span><span className="film-type-number">{purpose.number}</span><strong>{purpose.title}</strong><p>{purpose.copy}</p><div className="film-type-ending"><small>COMMON ENDING · 2案共通</small><b>{purpose.endingTitle}</b><span>{purpose.endingCopy}</span><em>「{purpose.endingLine}」</em></div></label>)}</div></div>}

          {step === 1 && <div className="wizard-panel"><p className="eyebrow">ABOUT YOUR DOG</p><h1 id="step-title">その子のことを教えてください。</h1><p className="step-lead">「必須」と表示された項目をすべて入力すると、次のステップへ進めます。</p><div className="form-grid"><label><span>お名前 <em>必須</em></span><input required value={draft.petName} onChange={(event) => update("petName", event.target.value)} placeholder="例：モモ" /></label><label><span>お名前の読み方 <small>任意</small></span><input value={draft.nameKana} onChange={(event) => update("nameKana", event.target.value)} placeholder="例：もも" /></label><label><span>犬種 <em>必須</em></span><input required value={draft.breed} onChange={(event) => update("breed", event.target.value)} placeholder="例：柴犬" /></label><label><span>年齢 <em>必須</em></span><input required value={draft.age} onChange={(event) => update("age", event.target.value)} placeholder="例：12歳 / 推定3歳" /></label></div><fieldset className="chip-field"><legend>どんな性格ですか？ <small>1つ以上・必須</small></legend><div>{personalities.map((personality) => <button type="button" className={draft.personality.includes(personality) ? "chip selected" : "chip"} onClick={() => togglePersonality(personality)} key={personality}>{personality}<span aria-hidden="true">＋</span></button>)}</div></fieldset></div>}

          {step === 2 && <div className="wizard-panel photo-preparation-panel">
            <p className="eyebrow">YOUR PHOTOS</p><h1 id="step-title">その子らしさが分かる写真を。</h1>
            <p className="step-lead">映像の中で大切な姿をできるだけ自然に残すため、<br />お顔・全身・横向きが分かる写真をご用意ください。<br />強いフィルターや大きくぼけた写真は避けてください。</p>
            <section className="photo-task-guide" aria-labelledby="photo-task-guide-title">
              <header><div><p className="eyebrow">EASY GUIDE</p><h2 id="photo-task-guide-title">この画面で行うこと</h2></div><button type="button" onClick={showPhotoGuide}>写真選びガイドを見る</button></header>
              <p className="photo-task-guide-lead">写真を追加したあと、同じ写真の中から<strong>「お顔」と「全身」の基準を1枚ずつ</strong>選びます。</p>
              <div className="photo-guide-photo-types">
                <strong>この3種類が入るように選ぶと安心です</strong>
                <ul>
                  <li><span>FACE</span><b>お顔がよく分かる</b><small>目・鼻・口元が鮮明</small></li>
                  <li><span>BODY</span><b>立っている全身</b><small>頭から足先まで見える</small></li>
                  <li><span>SIDE</span><b>横向き・しっぽ</b><small>体型が分かる・任意</small></li>
                </ul>
                <p>上の写真を含めて、合計{MIN_TOTAL_PHOTOS}枚以上・最大{MAX_TOTAL_PHOTOS}枚までお送りいただけます。</p>
              </div>
              <ol>{photoGuideItems.map((item, index) => <li className={item.complete ? "complete" : ""} key={item.label}><span aria-hidden="true">{item.complete ? "✓" : index + 1}</span><strong>{item.label}</strong><small>{item.complete ? "完了" : index === photoGuideItems.findIndex((entry) => !entry.complete) ? "次に行います" : "未完了"}</small></li>)}</ol>
              <button className="photo-next-task" type="button" onClick={handleNextPhotoTask}>{nextPhotoTaskLabel}<span aria-hidden="true">→</span></button>
            </section>
            <div className="shared-photo-upload" id="photo-upload-section">
              <input id="shared-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={handlePhotos} />
              <label htmlFor="shared-photo-input" ref={photoUploadTriggerRef} tabIndex={-1}><span className="upload-step-label">1. まずここをタップ</span><span className="upload-mark" aria-hidden="true">＋</span><strong>{photoFiles.length ? "写真を追加する" : "スマートフォンから写真を選ぶ"} <em>必須</em></strong><small>一度に複数選べます · JPG・PNG・HEIC・WebP</small></label>
            </div>
            <div className="upload-count" role="status" aria-live="polite"><strong>{photoFiles.length} / {MIN_TOTAL_PHOTOS}枚以上</strong><span>{photoFiles.length >= MIN_TOTAL_PHOTOS ? "必要な枚数が揃いました。" : `あと${MIN_TOTAL_PHOTOS - photoFiles.length}枚必要です。`}</span></div>
            {photoSelectionNotice && <aside className="photo-reselect-notice" role="status"><strong>写真の選択を更新しました。</strong><span>{photoSelectionNotice}</span></aside>}
            {photoRestoreNotice && <aside className="photo-reselect-notice" role="alert"><strong>写真をもう一度選んでください。</strong><span>文章の下書きは復元しましたが、ブラウザの安全上、再読み込み前に選んだ写真ファイルは復元されません。</span></aside>}
            {photoFiles.length > 0 && <><h2 className="uploaded-photo-heading">追加した写真 <small>写真を押すと大きく確認できます</small></h2><div className="uploaded-photo-grid" aria-label="選択した写真">
              {photoFiles.map((photo, index) => <article key={photo.clientKey}><button type="button" className="uploaded-photo-preview" onClick={() => setPreviewPhotoKey(photo.clientKey)}><img src={photo.previewUrl} alt={`追加した愛犬の写真 ${index + 1}`} loading="lazy" /><span>大きく見る</span></button><div><small title={photo.file.name}>写真 {index + 1}</small>{roleKeys[photo.clientKey]?.map((badge) => <strong key={badge}>{badge}</strong>)}<button type="button" onClick={() => removePhoto(photo.clientKey)}>削除</button></div></article>)}
            </div></>}

            {photoFiles.length > 0 && <div className="representative-photo-stack">
              <PhotoSelector id="primary-face-section" stepLabel="2" legend="いちばん「この子らしい」顔の写真を1枚選んでください" guide="写真カードをタップして選びます。正面または斜め前から撮影され、目・鼻・口元がはっきり見える写真がおすすめです。" name="primary-face" photos={photoFiles} value={draft.primaryFacePhotoKey} roleLabel="お顔の基準" roleKeys={roleKeys} onChange={(value) => update("primaryFacePhotoKey", value)} />
              <PhotoSelector id="primary-body-section" stepLabel="3" legend="実際の体型がいちばん分かる全身写真を1枚選んでください" guide="写真カードをタップして選びます。立っている状態で、頭から足先、しっぽまで見える写真が理想です。同じ写真をお顔の基準にも選べます。" name="primary-body" photos={photoFiles} value={draft.primaryBodyPhotoKey} roleLabel="全身の基準" roleKeys={roleKeys} onChange={(value) => update("primaryBodyPhotoKey", value)} />
              <PhotoSelector id="side-tail-section" stepLabel="任意" legend="横向きの体型と、しっぽの形が分かる写真があれば選んでください" optional name="side-tail" photos={photoFiles} value={draft.sideTailPhotoKey} roleLabel="横向き・しっぽ" roleKeys={roleKeys} onChange={(value) => update("sideTailPhotoKey", value)} />
            </div>}

            <fieldset className="appearance-policy-fieldset" id="appearance-policy-section"><legend>思い出の中の姿を、どのように残したいですか？ <em>必須</em></legend><div>{appearanceOptions.map(([value, label]) => <label className={draft.appearancePolicy === value ? "selected" : ""} key={value}><input type="radio" name="appearance-policy" checked={draft.appearancePolicy === value} onChange={() => selectAppearancePolicy(value)} /><span>{label}</span><i aria-hidden="true">{draft.appearancePolicy === value ? "✓" : ""}</i></label>)}</div></fieldset>
            {draft.appearancePolicy === "selected_period" && <section className="selected-period-panel"><label><span>残したい時期の姿を教えてください <em>必須</em></span><textarea rows={3} maxLength={200} value={draft.selectedAppearanceDescription} onChange={(event) => update("selectedAppearanceDescription", event.target.value)} placeholder="例：2〜3歳頃の、耳の毛が少し短かった姿" /><small>{draft.selectedAppearanceDescription.trim().length} / 200</small></label><fieldset><legend>その時期が分かる写真を1〜3枚選んでください <em>必須</em></legend><div className="photo-choice-grid compact">{photoFiles.map((photo, index) => { const selected = draft.selectedAppearancePhotoKeys.includes(photo.clientKey); const disabled = !selected && draft.selectedAppearancePhotoKeys.length >= 3; return <label className={selected ? "photo-choice-card selected" : "photo-choice-card"} key={`period-${photo.clientKey}`}><input type="checkbox" checked={selected} disabled={disabled} onChange={() => update("selectedAppearancePhotoKeys", selected ? draft.selectedAppearancePhotoKeys.filter((key) => key !== photo.clientKey) : [...draft.selectedAppearancePhotoKeys, photo.clientKey])} /><img src={photo.previewUrl} alt={`愛犬の写真 ${index + 1}`} loading="lazy" />{!selected && !disabled && <span className="photo-choice-action">タップして選ぶ</span>}{selected && <strong className="photo-selected-mark">✓ 時期の基準</strong>}</label>; })}</div></fieldset></section>}

            <section className="locked-traits-panel"><h2>変わってほしくない、この子らしい特徴を教えてください <small>任意・最大3つ</small></h2><p>目の大きさ、耳の形、口元、毛の長さ、しっぽ、いつもの表情など</p>{draft.ownerLockedTraits.map((trait, index) => <label key={`trait-${index}`}><span>特徴 {index + 1}</span><input value={trait} maxLength={80} onChange={(event) => updateTrait(index, event.target.value)} placeholder="例：丸く大きな黒い目" /><small>{trait.length} / 80</small>{draft.ownerLockedTraits.length > 1 && <button type="button" onClick={() => removeTrait(index)}>削除</button>}</label>)}{draft.ownerLockedTraits.length < 3 && <button type="button" className="add-trait-button" onClick={addTrait}>＋ 特徴を追加</button>}</section>

            <aside className="people-photo-policy"><p className="eyebrow">PEOPLE IN PHOTOS</p><h2>人物が写っている写真について</h2><p>ご家族と一緒に写っている写真もお送りいただけます。現在のWAN MEMORYでは、人物のお顔を新しく生成・再現する制作は行っていません。</p><p>愛犬だけを切り抜く、お顔が分からない後ろ姿・手元・足元・シルエットで表現する、または元の家族写真を動かさずそのまま映像内に使用する方法からお選びいただけます。</p></aside>
            <fieldset className="photo-policy-question"><legend>お送りいただく写真に人物は写っていますか？ <em>必須</em></legend><div className="photo-policy-options"><label><input type="radio" name="peoplePresence" checked={draft.peoplePresence === "none"} onChange={() => selectPeoplePresence("none")} /><span>人物は写っていない</span></label><label><input type="radio" name="peoplePresence" checked={draft.peoplePresence === "included"} onChange={() => selectPeoplePresence("included")} /><span>人物が写っている</span></label></div></fieldset>
            {draft.peoplePresence === "included" && <div className="people-photo-details"><fieldset className="photo-policy-question"><legend>人物の映像での取り扱いを選んでください。 <em>必須</em></legend><div className="photo-policy-options vertical">{peopleHandlingOptions.map(([value, label]) => <label key={value}><input type="radio" name="peopleHandling" checked={draft.peopleHandling === value} onChange={() => update("peopleHandling", value)} /><span>{label}</span></label>)}</div></fieldset><fieldset className="photo-policy-question"><legend>写真に未成年の方は写っていますか？ <em>必須</em></legend><div className="photo-policy-options"><label><input type="radio" name="minorPresence" checked={draft.minorPresence === "none"} onChange={() => setDraft((current) => ({ ...current, minorPresence: "none", minorGuardianConsent: false }))} /><span>写っていない</span></label><label><input type="radio" name="minorPresence" checked={draft.minorPresence === "included"} onChange={() => update("minorPresence", "included")} /><span>写っている</span></label></div></fieldset>{draft.minorPresence === "included" && <label className="guardian-consent"><input type="checkbox" checked={draft.minorGuardianConsent} onChange={(event) => update("minorGuardianConsent", event.target.checked)} /><span>未成年者が写っている写真について、保護者から制作利用の同意を得ています。 <em>必須</em></span></label>}</div>}
          </div>}

          {step === 3 && <div className="wizard-panel"><p className="eyebrow">YOUR MEMORIES</p><h1 id="step-title">覚えていることを、少しずつ。</h1><p className="step-lead">思い出は最低{MIN_MEMORY_COUNT}つ必要です。文章を入力し、先ほど選んだ写真から同じ場面の写真をつないでください。</p><section className="memory-writing-guide" aria-labelledby="memory-writing-guide-title"><div><p className="eyebrow">WRITING GUIDE</p><h2 id="memory-writing-guide-title">映像にしやすい伝え方</h2></div><ol><li><span>01</span><div><strong>ひとつの出来事に絞る</strong><p>「旅行」だけではなく「海辺で初めて波を見た日」のように、ひとつの場面にします。</p></div></li><li><span>02</span><div><strong>その子の動きや表情を書く</strong><p>走った、振り返った、首をかしげたなど、実際に見た様子を教えてください。</p></div></li><li><span>03</span><div><strong>内容と同じ写真をつなぐ</strong><p>場所・服・季節が分かる写真を1〜{MAX_PHOTOS_PER_MEMORY}枚選びます。</p></div></li></ol><p>例：「去年の春、いつもの公園で桜を見ました。モモは花びらを追いかけたあと、こちらを見て首をかしげました。」</p></section>
            <div className="memory-entry-list">{draft.memories.map((memory, index) => { const complete = isMemoryReady(memory); const unlocked = index === 0 || draft.memories.slice(0, index).every(isMemoryReady); const expanded = activeMemoryKey === memory.clientKey && unlocked; return <article className={`memory-entry-card${complete ? " complete" : ""}${!unlocked ? " locked" : ""}`} key={memory.clientKey}><button type="button" className="memory-entry-toggle" aria-expanded={expanded} aria-controls={`memory-entry-content-${memory.clientKey}`} disabled={!unlocked} onClick={() => setActiveMemoryKey((current) => current === memory.clientKey ? "" : memory.clientKey)}><span className="memory-entry-toggle-copy"><span>MEMORY {String(index + 1).padStart(2, "0")}</span><strong>{memory.title.trim() || `思い出 ${index + 1}`}</strong></span><span className="memory-entry-status">{complete ? "入力完了 ✓" : !unlocked ? "前の思い出を完成すると開きます" : expanded ? "入力中" : "続きを入力"}</span><span className={expanded ? "memory-entry-chevron open" : "memory-entry-chevron"} aria-hidden="true">⌄</span></button>{expanded && <div className="memory-entry-content" id={`memory-entry-content-${memory.clientKey}`}>{index >= MIN_MEMORY_COUNT && <div className="memory-entry-tools"><button type="button" onClick={() => removeMemory(memory.clientKey)}>この項目を削除</button></div>}<div className="memory-entry-fields"><label className="wide"><span>思い出のタイトル <em>必須</em></span><input required value={memory.title} maxLength={80} onChange={(event) => updateMemory(memory.clientKey, "title", event.target.value)} placeholder="例：はじめて海を見た日" /></label><label><span>いつ頃ですか？ <small>任意</small></span><input value={memory.whenText} maxLength={120} onChange={(event) => updateMemory(memory.clientKey, "whenText", event.target.value)} placeholder="例：2025年の春 / 3歳の頃" /></label><label><span>どこでの思い出ですか？ <small>任意</small></span><input value={memory.location} maxLength={120} onChange={(event) => updateMemory(memory.clientKey, "location", event.target.value)} placeholder="例：いつもの公園、家のリビング" /></label><label className="wide"><span>そのときのことを詳しく教えてください <em>必須・30文字以上</em></span><textarea required rows={5} maxLength={2000} value={memory.description} onChange={(event) => updateMemory(memory.clientKey, "description", event.target.value)} placeholder="誰と、どんな時間を過ごし、何が心に残っていますか？ 写真に写っている場面と結びつくように書いてください。" /><small className={memory.description.trim().length >= 30 ? "field-count complete" : "field-count"}>{memory.description.trim().length} / 30文字以上</small></label><label className="wide"><span>その子の表情や動き <em>必須・10文字以上</em></span><textarea required rows={3} maxLength={1000} value={memory.dogBehavior} onChange={(event) => updateMemory(memory.clientKey, "dogBehavior", event.target.value)} placeholder="例：花びらを追いかけ、最後にこちらを見て首をかしげました。" /><small className={memory.dogBehavior.trim().length >= 10 ? "field-count complete" : "field-count"}>{memory.dogBehavior.trim().length} / 10文字以上</small></label></div><fieldset className="memory-photo-linker"><legend>この思い出と同じ場面の写真 <em>必須・1〜{MAX_PHOTOS_PER_MEMORY}枚</em></legend><p>写真カードをタップして選びます。同じ写真を別の思い出に重ねて設定することはできません。</p><div className="photo-choice-grid compact">{photoFiles.map((photo, photoIndex) => { const selected = memory.photoKeys.includes(photo.clientKey); const assignedToOther = Boolean(assignedMemoryByPhoto[photo.clientKey] && assignedMemoryByPhoto[photo.clientKey] !== memory.clientKey); const disabled = assignedToOther || (!selected && memory.photoKeys.length >= MAX_PHOTOS_PER_MEMORY); return <label className={selected ? "photo-choice-card selected" : disabled ? "photo-choice-card disabled" : "photo-choice-card"} key={`${memory.clientKey}-${photo.clientKey}`}><input type="checkbox" checked={selected} disabled={disabled} onChange={() => toggleMemoryPhoto(memory.clientKey, photo.clientKey)} /><img src={photo.previewUrl} alt={`愛犬の写真 ${photoIndex + 1}`} loading="lazy" />{!selected && !disabled && <span className="photo-choice-action">この思い出に選ぶ</span>}{selected && <strong className="photo-selected-mark">✓ この思い出</strong>}{assignedToOther && <small className="photo-assigned-label">別の思い出で選択済み</small>}</label>; })}</div><strong className="memory-photo-count">{memory.photoKeys.length} / {MAX_PHOTOS_PER_MEMORY}枚</strong></fieldset></div>}</article>; })}</div>
            <div className="memory-entry-add"><button type="button" disabled={draft.memories.length >= MAX_MEMORY_COUNT || !allMemoryEntriesComplete} onClick={addMemory}>＋ 別の思い出を追加する</button><p>{!allMemoryEntriesComplete && draft.memories.length < MAX_MEMORY_COUNT ? "表示中の思い出をすべて完成すると、次の項目を追加できます。" : `${MIN_MEMORY_COUNT}〜${MAX_MEMORY_COUNT}項目・各1〜${MAX_PHOTOS_PER_MEMORY}枚必要です。`}<br />現在：{draft.memories.length}項目 / 写真{totalLinkedPhotoCount}枚</p></div><div className="stacked-fields memory-ending-fields"><label><span>その子へ伝えたいこと <em>必須</em></span><textarea required rows={3} value={draft.message} onChange={(event) => update("message", event.target.value)} placeholder="映画の最後に残したい言葉があれば" /></label><label><span>映像に入れたくないこと <small>任意</small></span><textarea rows={2} value={draft.avoid} onChange={(event) => update("avoid", event.target.value)} placeholder="病院の場面、最後の時期、直接的な表現など。遠慮なく書いてください" /></label></div>
          </div>}

          {step === 4 && <div className="wizard-panel"><p className="eyebrow">FILM DIRECTION</p><h1 id="step-title">どんな空気の映画にしますか？</h1><p className="step-lead">迷ったら「日常映画」がおすすめです。担当者からもご提案します。映像はBGMと短い字幕を中心に、思い出へ集中できる構成にします。</p><div className="style-list">{styles.map(([title, copy], index) => <label className={draft.style === title ? "style-card selected" : "style-card"} key={title}><input type="radio" name="style" checked={draft.style === title} onChange={() => update("style", title)} /><span className={`style-swatch swatch-${index + 1}`} aria-hidden="true" /><span><strong>{title}</strong><small>{copy}</small></span><span className="radio-dot" /></label>)}</div><div className="form-grid compact"><label><span>映像比率</span><select value={draft.ratio} onChange={(event) => update("ratio", event.target.value)}><option>16:9 横型</option><option>9:16 縦型</option><option>1:1 正方形</option></select></label><label><span>BGM</span><select value={draft.bgm} onChange={(event) => update("bgm", event.target.value)}><option>おまかせ</option><option>静かなピアノ</option><option>アコースティックギター</option><option>映画音楽のように</option></select></label></div></div>}

          {step === 5 && <div className="wizard-panel"><p className="eyebrow">REVIEW</p><h1 id="step-title">ありがとうございます。</h1><p className="step-lead">まずは相談受付としてお預かりします。決済は内容と納期をご確認いただいた後です。</p><div className="review-card"><div className="review-title"><span className="brand-mark" aria-hidden="true">WM</span><div><strong>{draft.petName || "愛犬"}ちゃんの映画</strong><small>{draft.purpose}・{draft.style}</small></div></div><section className="review-section"><header><h2>基本情報</h2><button type="button" onClick={() => goToStep(1)}>修正する</button></header><dl><div><dt>お名前</dt><dd>{draft.petName || "未入力"}</dd></div><div><dt>犬種・年齢</dt><dd>{[draft.breed, draft.age].filter(Boolean).join(" / ") || "未入力"}</dd></div><div><dt>性格</dt><dd>{draft.personality.join("、") || "未入力"}</dd></div><div><dt>映画の種類</dt><dd>{selectedPurpose.title}</dd></div></dl></section><section className="review-section"><header><h2>お写真とその子らしさ</h2><button type="button" onClick={() => goToStep(2)}>修正する</button></header><div className="review-reference-grid">{[["お顔の基準", draft.primaryFacePhotoKey], ["全身の基準", draft.primaryBodyPhotoKey], ["横向き・しっぽ", draft.sideTailPhotoKey]] .map(([label, key]) => { const photo = photoFiles.find((item) => item.clientKey === key); return <article key={label}><strong>{label}</strong>{photo ? <img src={photo.previewUrl} alt={`${label}として選んだ愛犬の写真`} /> : <span>未選択</span>}</article>; })}</div><dl><div><dt>思い出の中の姿</dt><dd>{appearancePolicyLabel(draft.appearancePolicy)}</dd></div>{draft.appearancePolicy === "selected_period" && <div><dt>残したい時期</dt><dd>{draft.selectedAppearanceDescription || "未入力"} · 写真{draft.selectedAppearancePhotoKeys.length}枚</dd></div>}<div><dt>変わってほしくない特徴</dt><dd>{draft.ownerLockedTraits.map((trait) => trait.trim()).filter(Boolean).join("、") || "指定なし"}</dd></div><div><dt>人物の有無</dt><dd>{draft.peoplePresence === "included" ? "あり" : draft.peoplePresence === "none" ? "なし" : "未入力"}</dd></div>{draft.peoplePresence === "included" && <><div><dt>人物の取り扱い</dt><dd>{peopleHandlingLabel(draft.peopleHandling)}</dd></div><div><dt>未成年者</dt><dd>{draft.minorPresence === "included" ? "あり" : draft.minorPresence === "none" ? "なし" : "未入力"}</dd></div></>}</dl></section><section className="review-section"><header><h2>思い出</h2><button type="button" onClick={() => goToStep(3)}>修正する</button></header><div className="review-memory-list">{draft.memories.map((memory, index) => <article key={memory.clientKey}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{memory.title || "タイトル未入力"}</strong><p>{memory.description || "詳しい内容が未入力です。"}</p><small>{memory.whenText || "時期未入力"} · {memory.location || "場所未入力"} · 写真{memory.photoKeys.length}枚</small></div></article>)}</div></section><section className="review-section"><header><h2>仕上がり</h2><button type="button" onClick={() => goToStep(4)}>修正する</button></header><dl><div><dt>希望</dt><dd>{draft.ratio}・BGM：{draft.bgm}</dd></div><div><dt>プラン</dt><dd>メモリーフィルム</dd></div><div><dt>料金</dt><dd className="review-monitor-price"><strong>先着{MEMORY_FILM_PRICING.launchLimit}組 ¥{formatYen(MEMORY_FILM_PRICING.launchPrice)}（税込）</strong><small>必要な思い出と写真の送信が完了した時点で確定・終了後は ¥{formatYen(MEMORY_FILM_PRICING.regularPrice)}</small></dd></div><div><dt>コンセプト</dt><dd>2案から1案を選択</dd></div><div><dt>専用サイト</dt><dd>プランに含まれます</dd></div></dl></section></div>
            <div className="consent-stack"><label className="consent-box"><input type="checkbox" checked={draft.termsConsent} onChange={(event) => update("termsConsent", event.target.checked)} /><span><strong>利用規約とプライバシーポリシーに同意します <em>必須</em></strong><small><Link href="/terms" target="_blank">利用規約</Link>（{CONSENT_VERSIONS.terms}）と<Link href="/privacy" target="_blank">プライバシーポリシー</Link>（{CONSENT_VERSIONS.privacy}）を確認しました。</small></span></label><label className="consent-box"><input type="checkbox" checked={draft.photoRightsConsent} onChange={(event) => update("photoRightsConsent", event.target.checked)} /><span><strong>写真の使用権限について確認しました <em>必須</em></strong><small>提出する写真について、本サービスの映像制作に使用する権限を持っています。確認文版：{CONSENT_VERSIONS.photoRights}</small></span></label>{draft.peoplePresence === "included" && <label className="consent-box"><input type="checkbox" checked={draft.depictedPeopleConsent} onChange={(event) => update("depictedPeopleConsent", event.target.checked)} /><span><strong>写っている人物の同意を得ています <em>必須</em></strong><small>写真に写っているご本人から、本サービスの制作に使用する同意を得ています。確認文版：{CONSENT_VERSIONS.depictedPeople}</small></span></label>}<label className="consent-box"><input type="checkbox" checked={draft.externalAiConsent} onChange={(event) => update("externalAiConsent", event.target.checked)} /><span><strong>外部AIサービスの利用を確認しました <em>必須</em></strong><small>映像制作のため、写真や制作情報が外部AIサービスで処理される場合があります。WAN MEMORYが独自のAIモデル学習や広告・ポートフォリオ公開に使用することはありません。外部サービスでのデータの取り扱いは各サービスの条件に基づきます。案内版：{CONSENT_VERSIONS.aiNotice}</small></span></label><label className="consent-box important"><input type="checkbox" checked={draft.aiReconstructionAcknowledged} onChange={(event) => update("aiReconstructionAcknowledged", event.target.checked)} /><span><strong>映画的な再構成について確認しました <em>必須</em></strong><small>AI技術を使用する場面は、元写真を大切にしながら映画的に再構成されるため、細部が完全に同一にならない場合があることを確認しました。</small></span></label></div>
            {missingFields.length > 0 ? <aside className="missing-fields-panel" role="status" aria-labelledby="missing-fields-title"><p className="eyebrow">REQUIRED ITEMS</p><h2 id="missing-fields-title">あと{missingFields.length}項目の入力が必要です。</h2><p>項目を選ぶと入力する画面へ戻れます。すべて入力すると、ご相談を送信できます。</p><ul>{missingFields.map((item) => <li key={item.key}><button type="button" onClick={() => goToStep(item.step)}><span>{steps[item.step]}</span><strong>{item.label}</strong><em>入力する →</em></button></li>)}</ul></aside> : <aside className="ready-to-submit" role="status"><span aria-hidden="true">✓</span><div><strong>必要な項目がすべて揃いました。</strong><small>下のボタンからご相談を送信できます。</small></div></aside>}
          </div>}

          {[1, 2, 3].includes(step) && (currentStepMissingFields.length > 0 ? <aside className={stepValidationAttempted ? "step-required-panel attempted" : "step-required-panel"} id="step-required-status" role="status" aria-live="polite"><strong>このステップは、あと{currentStepMissingFields.length}項目の入力が必要です。</strong><span>「必須」の内容をすべて入力すると、次へ進めます。</span><ul>{currentStepMissingFields.map((item) => <li key={item.key}>{item.label}</li>)}</ul></aside> : <aside className="step-ready-panel" id="step-required-status" role="status"><span aria-hidden="true">✓</span><strong>このステップの必須項目が揃いました。次へ進めます。</strong></aside>)}
          {error && <div className="form-error" role="alert" tabIndex={-1} ref={errorSummaryRef}><span>{error}</span>{failedUploadName && <button type="button" disabled={submitting} onClick={submit}>「{failedUploadName}」だけ再試行する</button>}</div>}
          {submitting && <div className="submit-progress" role="status"><span style={{ width: `${totalPhotoCount ? uploadProgress : 100}%` }} /><p>{totalPhotoCount ? `思い出と写真を安全に送信しています… ${uploadProgress}%` : "ご相談を受け付けています…"}</p></div>}
          <div className="wizard-actions">{step > 0 ? <button className="button button-ghost" type="button" disabled={submitting} onClick={() => goToStep(step - 1)}>← 戻る</button> : <span />}{step < steps.length - 1 ? <button className="button button-primary" type="button" aria-describedby={[1, 2, 3].includes(step) ? "step-required-status" : undefined} onClick={goNext}>次へ進む →</button> : <button className="button button-primary" type="button" disabled={submitting} onClick={submit}>{submitting ? "送信中…" : missingFields.length ? `未入力${missingFields.length}項目を確認する →` : "相談を受け付ける →"}</button>}</div>
        </section>
      </div>
      {photoGuideOpen && <div className="photo-guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePhotoGuide(); }}><section className="photo-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="photo-guide-title" aria-describedby="photo-guide-description" ref={photoGuideDialogRef}>
        <header><span>写真選びガイド</span><button type="button" onClick={closePhotoGuide} aria-label="写真選びガイドを閉じる">×</button></header>
        <div className="photo-guide-progress" aria-label={`${photoGuideStep + 1} / ${photoGuideSlides.length}`}><span style={{ width: `${((photoGuideStep + 1) / photoGuideSlides.length) * 100}%` }} /></div>
        <div className="photo-guide-content"><span className="photo-guide-number">{photoGuideSlides[photoGuideStep].number}</span><p className="eyebrow">STEP {photoGuideStep + 1} / {photoGuideSlides.length}</p><h2 id="photo-guide-title">{photoGuideSlides[photoGuideStep].title}</h2><p id="photo-guide-description">{photoGuideSlides[photoGuideStep].copy}</p>{photoGuideStep === 1 && <aside>写真をアップロードしただけでは選択は完了していません。並んだ写真をもう一度タップして、基準写真を決めます。</aside>}</div>
        <footer>{photoGuideStep > 0 ? <button type="button" className="button button-ghost" onClick={() => setPhotoGuideStep((current) => current - 1)}>← 戻る</button> : <span />}{photoGuideStep < photoGuideSlides.length - 1 ? <button type="button" className="button button-primary" onClick={() => setPhotoGuideStep((current) => current + 1)}>次を見る →</button> : <button type="button" className="button button-primary" onClick={closePhotoGuideAndShowUploader}>分かりました。写真を選ぶ →</button>}</footer>
      </section></div>}
      {previewPhoto && <div className="photo-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewPhotoKey(""); }}><section className="photo-preview-dialog" role="dialog" aria-modal="true" aria-label="写真の拡大表示" ref={photoPreviewDialogRef}><button type="button" onClick={() => setPreviewPhotoKey("")} aria-label="拡大表示を閉じる">×</button><img src={previewPhoto.previewUrl} alt="選択した愛犬の写真を拡大表示" /><small>{previewPhoto.file.name}</small></section></div>}
    </main>
  );
}
