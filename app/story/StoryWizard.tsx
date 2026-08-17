"use client";
/* eslint-disable @next/next/no-img-element -- Local object URLs need native image previews before upload. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import {
  hasSeenPhotoUploadGuide,
  PhotoUploadGuideDialog,
  rememberPhotoUploadGuide,
} from "../components/PhotoUploadGuideDialog";
import { CONSENT_VERSIONS } from "../lib/consent";
import { formatYen, MEMORY_FILM_PRICING } from "../lib/pricing";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { notifyAdminFromCustomer } from "../lib/adminPushClient";
import type { StoryDraftAsset, StoryDraftRecord } from "../lib/supabase/types";
import {
  deleteStoryDraftImage,
  uploadStoryDraftImage,
} from "../lib/supabase/uploads";

type FilmPurpose = "いまを残す";
type MissingField = { key: string; label: string; step: number };
type PhotoSaveStatus = "uploading" | "saved" | "error";
type PhotoDraft = {
  clientKey: string;
  file: File | null;
  previewUrl: string;
  originalName: string;
  fileSize: number;
  lastModified: number;
  persistedAsset: StoryDraftAsset | null;
  status: PhotoSaveStatus;
};
type SaveStatus = "idle" | "saving" | "saved" | "error";

type MemoryDraft = {
  clientKey: string;
  title: string;
  whenText: string;
  location: string;
  description: string;
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
  termsConsent: boolean;
  photoRightsConsent: boolean;
  externalAiConsent: boolean;
  aiReconstructionAcknowledged: boolean;
};

// Each story is also a production unit. Customers may upload up to three
// candidates, but the administrator selects exactly one production photo.
const MIN_MEMORY_COUNT = 5;
const MAX_MEMORY_COUNT = 5;
const MAX_TOTAL_PHOTOS = MAX_MEMORY_COUNT * 3;
const MAX_PHOTOS_PER_MEMORY = 3;
const FIXED_FILM_PURPOSE: FilmPurpose = "いまを残す";
const FIXED_FILM_PURPOSE_LABEL = "うちの子が主人公の動く絵本";
// The output format is fixed: a cohesive hand-painted moving storybook with
// short on-screen story sentences and restrained motion.
const FIXED_FILM_STYLE = "水彩とガッシュで描く、やわらかな動く絵本";
const FIXED_ASPECT_RATIO = "16:9 横型";
const FIXED_NARRATION = "ナレーションなし・物語字幕あり";
const FIXED_BGM = "物語に合わせておまかせ";

const createMemoryDraft = (clientKey: string): MemoryDraft => ({
  clientKey,
  title: "",
  whenText: "",
  location: "",
  description: "",
  photoKeys: [],
});

const isMemoryReady = (memory: MemoryDraft) =>
  Boolean(memory.title.trim()) &&
  Boolean(memory.description.trim()) &&
  memory.photoKeys.length >= 1;

const emptyDraft: Draft = {
  purpose: FIXED_FILM_PURPOSE,
  petName: "",
  nameKana: "",
  breed: "",
  age: "",
  personality: [],
  memories: [
    createMemoryDraft("memory-1"),
    createMemoryDraft("memory-2"),
    createMemoryDraft("memory-3"),
    createMemoryDraft("memory-4"),
    createMemoryDraft("memory-5"),
  ],
  message: "",
  termsConsent: false,
  photoRightsConsent: false,
  externalAiConsent: false,
  aiReconstructionAcknowledged: false,
};

function normalizeDraft(
  value: unknown,
  preferredPetName: string,
  validPhotoKeys?: Set<string>,
): Draft {
  const parsed =
    value && typeof value === "object"
      ? (value as Partial<Draft> & {
          firstMeeting?: string;
          favoriteMemory?: string;
          consent?: boolean;
          primaryFacePhotoKey?: string;
          primaryBodyPhotoKey?: string;
          sideTailPhotoKey?: string;
        })
      : {};
  const memories: MemoryDraft[] =
    Array.isArray(parsed.memories) && parsed.memories.length
      ? parsed.memories.slice(0, MAX_MEMORY_COUNT).map((memory, index) => {
          const source =
            memory && typeof memory === "object"
              ? (memory as Partial<MemoryDraft> & { dogBehavior?: string })
              : {};
          const legacyBehavior =
            typeof source.dogBehavior === "string"
              ? source.dogBehavior.trim()
              : "";
          const description =
            typeof source.description === "string" ? source.description : "";
          const photoKeys = Array.isArray(source.photoKeys)
            ? source.photoKeys
                .filter(
                  (key): key is string =>
                    typeof key === "string" &&
                    (!validPhotoKeys || validPhotoKeys.has(key)),
                )
                .slice(0, MAX_PHOTOS_PER_MEMORY)
            : [];
          return {
            ...createMemoryDraft(source.clientKey || `memory-${index + 1}`),
            ...source,
            title:
              source.title?.trim() === "大切な思い出" &&
              !description.trim() &&
              photoKeys.length === 0
                ? ""
                : source.title || "",
            description:
              legacyBehavior && !description.includes(legacyBehavior)
                ? [description, legacyBehavior].filter(Boolean).join("\n")
                : description,
            photoKeys,
          };
        })
      : [
          {
            ...createMemoryDraft("memory-1"),
            title: parsed.firstMeeting ? "はじめて会った日" : "",
            description: parsed.favoriteMemory || parsed.firstMeeting || "",
          },
        ];
  while (memories.length < MIN_MEMORY_COUNT)
    memories.push(createMemoryDraft(`memory-${memories.length + 1}`));
  const photoKey = (key: unknown) =>
    typeof key === "string" && (!validPhotoKeys || validPhotoKeys.has(key))
      ? key
      : "";
  const representativePhotoKey =
    photoKey(parsed.primaryFacePhotoKey) ||
    photoKey(parsed.primaryBodyPhotoKey) ||
    photoKey(parsed.sideTailPhotoKey);
  // Old in-progress drafts may contain the former global representative photo.
  // Move it into story 1 so the customer does not have to upload it again.
  if (representativePhotoKey && memories[0].photoKeys.length === 0) {
    memories[0] = {
      ...memories[0],
      photoKeys: [representativePhotoKey],
    };
  }

  return {
    ...emptyDraft,
    ...parsed,
    petName: parsed.petName?.trim() || preferredPetName,
    memories,
    purpose: FIXED_FILM_PURPOSE,
    termsConsent: parsed.termsConsent ?? parsed.consent ?? false,
    photoRightsConsent: parsed.photoRightsConsent ?? false,
    externalAiConsent: parsed.externalAiConsent ?? false,
    aiReconstructionAcknowledged: parsed.aiReconstructionAcknowledged ?? false,
  };
}

const steps = ["愛犬のこと", "物語と写真", "確認"];
const personalities = [
  "甘えん坊",
  "元気",
  "おだやか",
  "食いしん坊",
  "人が好き",
  "マイペース",
  "優しい",
  "ちょっぴり頑固",
];

const PHOTO_INPUT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";

export function StoryWizard() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [photoFiles, setPhotoFiles] = useState<PhotoDraft[]>([]);
  const [previewPhotoKey, setPreviewPhotoKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [draftId, setDraftId] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState("");
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoSelectionNotice, setPhotoSelectionNotice] = useState("");
  const [activeMemoryKey, setActiveMemoryKey] = useState("memory-1");
  const [stepValidationAttempted, setStepValidationAttempted] = useState(false);
  const [pendingPhotoInputId, setPendingPhotoInputId] = useState("");
  const photoFilesRef = useRef<PhotoDraft[]>([]);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const photoPreviewDialogRef = useRef<HTMLElement>(null);
  const memoryCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const saveSequenceRef = useRef(0);

  const openPhotoInput = (inputId: string) => {
    if (hasSeenPhotoUploadGuide()) {
      document.getElementById(inputId)?.click();
      return;
    }
    setPendingPhotoInputId(inputId);
  };

  const continueToFirstPhoto = () => {
    const inputId = pendingPhotoInputId;
    rememberPhotoUploadGuide();
    setPendingPhotoInputId("");
    window.setTimeout(() => document.getElementById(inputId)?.click(), 0);
  };

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?mode=signup&next=/story");
  }, [authLoading, router, user]);

  const preferredPetName = (
    profile?.primary_pet_name ||
    user?.user_metadata?.pet_name ||
    ""
  ).trim();

  useEffect(() => {
    if (authLoading || hydrated || !user) return;
    let cancelled = false;
    const restore = async () => {
      const supabase = getSupabaseBrowserClient();
      const localKey = `wan-memory-story-draft-${user.id}`;
      let localDraft: unknown = null;
      let localStep = 0;
      try {
        const stored =
          window.localStorage.getItem(localKey) ||
          window.localStorage.getItem("kimi-film-draft");
        if (stored) {
          const parsed = JSON.parse(stored);
          localDraft = parsed?.data ?? parsed;
          localStep = Number.isInteger(parsed?.currentStep)
            ? parsed.currentStep
            : 0;
        }
      } catch {
        localDraft = null;
      }

      const { data: serverDraft, error: draftError } = await supabase
        .from("story_drafts")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      if (draftError) {
        setDraft(normalizeDraft(localDraft, preferredPetName));
        setStep(Math.max(0, Math.min(localStep, steps.length - 1)));
        setSaveStatus("error");
        setHydrated(true);
        return;
      }

      const record = serverDraft as StoryDraftRecord | null;
      if (!record) {
        const initial = normalizeDraft(localDraft, preferredPetName);
        const { data: createdId, error: createError } = await supabase.rpc(
          "save_story_draft",
          {
            p_draft_id: null,
            p_data: initial,
            p_current_step: Math.max(0, Math.min(localStep, steps.length - 1)),
          },
        );
        if (cancelled) return;
        if (createError || !createdId) {
          setDraft(initial);
          setStep(Math.max(0, Math.min(localStep, steps.length - 1)));
          setSaveStatus("error");
          setHydrated(true);
          return;
        }
        setDraftId(createdId as string);
        setDraft(initial);
        setStep(Math.max(0, Math.min(localStep, steps.length - 1)));
        setActiveMemoryKey(
          initial.memories.find((memory) => !isMemoryReady(memory))
            ?.clientKey ?? initial.memories[0].clientKey,
        );
        setSaveStatus("saved");
        setHydrated(true);
        return;
      }

      const { data: storedAssets, error: assetError } = await supabase
        .from("story_draft_assets")
        .select("*")
        .eq("draft_id", record.id)
        .order("sort_order");
      if (cancelled) return;
      if (assetError) {
        setSaveStatus("error");
        setHydrated(true);
        return;
      }

      const assets = (storedAssets ?? []) as StoryDraftAsset[];
      const restoredPhotos = await Promise.all(
        assets.map(async (asset) => {
          const { data } = await supabase.storage
            .from("order-assets")
            .createSignedUrl(asset.storage_path, 3600);
          return {
            clientKey: asset.client_key,
            file: null,
            previewUrl: data?.signedUrl ?? "",
            originalName: asset.original_filename,
            fileSize: asset.file_size,
            lastModified: 0,
            persistedAsset: asset,
            status: "saved" as const,
          };
        }),
      );
      if (cancelled) return;
      const validPhotoKeys = new Set(
        restoredPhotos.map((photo) => photo.clientKey),
      );
      const restoredDraft = normalizeDraft(
        record.data,
        preferredPetName,
        validPhotoKeys,
      );
      setDraftId(record.id);
      setPendingOrderId(record.pending_order_id ?? "");
      setPhotoFiles(restoredPhotos.filter((photo) => photo.previewUrl));
      setDraft(restoredDraft);
      setStep(Math.max(0, Math.min(record.current_step, steps.length - 1)));
      setActiveMemoryKey(
        restoredDraft.memories.find((memory) => !isMemoryReady(memory))
          ?.clientKey ?? restoredDraft.memories[0].clientKey,
      );
      setRestored(Boolean(record.updated_at || assets.length));
      setSaveStatus("saved");
      setHydrated(true);
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [authLoading, hydrated, preferredPetName, user]);

  useEffect(() => {
    if (!hydrated || !user) return;
    const localKey = `wan-memory-story-draft-${user.id}`;
    window.localStorage.setItem(
      localKey,
      JSON.stringify({ data: draft, currentStep: step }),
    );
    if (!draftId) return;
    const sequence = ++saveSequenceRef.current;
    const timer = window.setTimeout(async () => {
      setSaveStatus("saving");
      const { error: saveError } = await getSupabaseBrowserClient().rpc(
        "save_story_draft",
        {
          p_draft_id: draftId,
          p_data: draft,
          p_current_step: step,
        },
      );
      if (saveSequenceRef.current !== sequence) return;
      setSaveStatus(saveError ? "error" : "saved");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, draftId, hydrated, step, user]);

  useEffect(() => {
    photoFilesRef.current = photoFiles;
  }, [photoFiles]);
  useEffect(
    () => () => {
      photoFilesRef.current.forEach((photo) =>
        URL.revokeObjectURL(photo.previewUrl),
      );
    },
    [],
  );

  useEffect(() => {
    if (!photoFiles.some((photo) => photo.status === "uploading") || submitting)
      return;
    const confirmBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmBeforeLeave);
    return () => window.removeEventListener("beforeunload", confirmBeforeLeave);
  }, [photoFiles, submitting]);

  useEffect(() => {
    if (!previewPhotoKey) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const updateMemory = <K extends keyof MemoryDraft>(
    clientKey: string,
    key: K,
    value: MemoryDraft[K],
  ) =>
    setDraft((current) => ({
      ...current,
      memories: current.memories.map((memory) =>
        memory.clientKey === clientKey ? { ...memory, [key]: value } : memory,
      ),
    }));
  const togglePersonality = (value: string) =>
    update(
      "personality",
      draft.personality.includes(value)
        ? draft.personality.filter((item) => item !== value)
        : [...draft.personality, value],
    );
  const previewPhoto = photoFiles.find(
    (photo) => photo.clientKey === previewPhotoKey,
  );

  const persistPhoto = async (photo: PhotoDraft, sortOrder: number) => {
    if (!user || !draftId || !photo.file) return;
    try {
      const result = await uploadStoryDraftImage(
        getSupabaseBrowserClient(),
        user.id,
        draftId,
        photo.clientKey,
        photo.file,
        sortOrder,
      );
      setPhotoFiles((current) =>
        current.map((item) => {
          if (item.clientKey !== photo.clientKey) return item;
          if (result.file !== item.file) {
            URL.revokeObjectURL(item.previewUrl);
          }
          return {
            ...item,
            file: result.file,
            previewUrl:
              result.file !== item.file
                ? URL.createObjectURL(result.file)
                : item.previewUrl,
            originalName: result.file.name,
            fileSize: result.file.size,
            persistedAsset: result.asset,
            status: "saved",
          };
        }),
      );
      setPhotoSelectionNotice("お気に入りの写真を自動保存しました。");
    } catch (caught) {
      console.error(caught);
      setPhotoFiles((current) =>
        current.map((item) =>
          item.clientKey === photo.clientKey
            ? { ...item, status: "error" }
            : item,
        ),
      );
      setPhotoSelectionNotice(
        `「${photo.originalName}」を保存できませんでした。写真の「再試行」を押してください。`,
      );
    }
  };

  // Uploads land in one pool; every picker belongs to one story card.
  const ingestPhotos = (incoming: File[], limit: number): PhotoDraft[] => {
    const current = photoFilesRef.current;
    const accepted = incoming.slice(
      0,
      Math.max(0, Math.min(limit, MAX_TOTAL_PHOTOS - current.length)),
    );
    if (!accepted.length) {
      if (incoming.length)
        setPhotoSelectionNotice(
          `写真は全体で最大${MAX_TOTAL_PHOTOS}枚までです。`,
        );
      return [];
    }
    const additions: PhotoDraft[] = accepted.map((file) => ({
      clientKey: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      originalName: file.name,
      fileSize: file.size,
      lastModified: file.lastModified,
      persistedAsset: null,
      status: "uploading",
    }));
    setPhotoSelectionNotice(
      accepted.length < incoming.length
        ? `写真は全体で最大${MAX_TOTAL_PHOTOS}枚までです。超えた分は追加されていません。`
        : "写真を安全に自動保存しています…",
    );
    setPhotoFiles((prev) => [...prev, ...additions]);
    additions.forEach((photo, index) => {
      void persistPhoto(photo, current.length + index);
    });
    return additions;
  };

  const handleMemoryPhotoUpload = (
    event: ChangeEvent<HTMLInputElement>,
    memoryKey: string,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const memory = draft.memories.find((item) => item.clientKey === memoryKey);
    if (!memory || !files.length) return;
    const room = MAX_PHOTOS_PER_MEMORY - memory.photoKeys.length;
    if (room <= 0) {
      setPhotoSelectionNotice(
        `この思い出の写真は${MAX_PHOTOS_PER_MEMORY}枚までです。`,
      );
      return;
    }
    const added = ingestPhotos(files, room);
    if (!added.length) return;
    updateMemory(memoryKey, "photoKeys", [
      ...memory.photoKeys,
      ...added.map((photo) => photo.clientKey),
    ]);
  };

  const retryPhoto = (photoKey: string) => {
    const index = photoFiles.findIndex((photo) => photo.clientKey === photoKey);
    const photo = photoFiles[index];
    if (!photo?.file) return;
    setPhotoFiles((current) =>
      current.map((item) =>
        item.clientKey === photoKey ? { ...item, status: "uploading" } : item,
      ),
    );
    void persistPhoto(photo, index);
  };

  const removePhoto = async (photoKey: string) => {
    const target = photoFiles.find((photo) => photo.clientKey === photoKey);
    if (target?.persistedAsset) {
      try {
        await deleteStoryDraftImage(
          getSupabaseBrowserClient(),
          target.persistedAsset,
        );
      } catch (caught) {
        console.error(caught);
        setPhotoSelectionNotice(
          "写真を削除できませんでした。通信状態をご確認のうえ、もう一度お試しください。",
        );
        return;
      }
    }
    if (target) URL.revokeObjectURL(target.previewUrl);
    setPhotoFiles((current) =>
      current.filter((photo) => photo.clientKey !== photoKey),
    );
    setDraft((current) => ({
      ...current,
      memories: current.memories.map((memory) => ({
        ...memory,
        photoKeys: memory.photoKeys.filter((key) => key !== photoKey),
      })),
    }));
    setPhotoSelectionNotice(
      "写真を削除しました。各物語には少なくとも1枚の写真が必要です。",
    );
  };

  const photoByKey = useMemo(
    () => new Map(photoFiles.map((photo) => [photo.clientKey, photo])),
    [photoFiles],
  );
  const totalPhotoCount = photoFiles.length;
  const unsavedPhotoCount = photoFiles.filter(
    (photo) => photo.status !== "saved",
  ).length;
  const totalLinkedPhotoCount = useMemo(
    () =>
      draft.memories.reduce(
        (total, memory) => total + memory.photoKeys.length,
        0,
      ),
    [draft.memories],
  );
  const allMemoryEntriesComplete = useMemo(
    () => draft.memories.every(isMemoryReady),
    [draft.memories],
  );
  const completedMemoryCount = useMemo(
    () => draft.memories.filter(isMemoryReady).length,
    [draft.memories],
  );
  const showAllMemoryCards = useMemo(
    () =>
      completedMemoryCount > 0 ||
      draft.memories.slice(1).some(
        (memory) =>
          memory.title.trim() ||
          memory.description.trim() ||
          memory.photoKeys.length > 0,
      ),
    [completedMemoryCount, draft.memories],
  );

  const missingFields = useMemo<MissingField[]>(() => {
    const missing: MissingField[] = [];
    if (!draft.petName.trim())
      missing.push({ key: "petName", label: "愛犬のお名前", step: 0 });
    if (!draft.breed.trim())
      missing.push({ key: "breed", label: "犬種", step: 0 });
    if (!draft.age.trim())
      missing.push({ key: "age", label: "年齢（推定でも可）", step: 0 });
    if (draft.personality.length === 0)
      missing.push({ key: "personality", label: "性格（1つ以上）", step: 0 });
    if (unsavedPhotoCount > 0)
      missing.push({
        key: "photoUploads",
        label: `写真の自動保存完了（未完了${unsavedPhotoCount}枚）`,
        step: 1,
      });
    if (
      draft.memories.length < MIN_MEMORY_COUNT ||
      draft.memories.length > MAX_MEMORY_COUNT
    )
      missing.push({
        key: "memories",
        label: `物語の数（${MAX_MEMORY_COUNT}つ）`,
        step: 1,
      });
    draft.memories.forEach((memory, index) => {
      const number = index + 1;
      if (!memory.title.trim())
        missing.push({
          key: `memory-${memory.clientKey}-title`,
          label: `思い出${number}のタイトル`,
          step: 1,
        });
      if (!memory.description.trim())
        missing.push({
          key: `memory-${memory.clientKey}-description`,
          label: `思い出${number}の詳しい内容`,
          step: 1,
        });
      if (memory.photoKeys.length < 1)
        missing.push({
          key: `memory-${memory.clientKey}-photo`,
          label: `物語${number}の場面写真（1枚以上）`,
          step: 1,
        });
    });
    if (!draft.message.trim())
      missing.push({ key: "message", label: "その子へ伝えたいこと", step: 1 });
    if (!draft.termsConsent)
      missing.push({
        key: "termsConsent",
        label: "利用規約・プライバシーポリシーへの同意",
        step: 2,
      });
    if (!draft.photoRightsConsent)
      missing.push({
        key: "photoRightsConsent",
        label: "提出写真の使用権限の確認",
        step: 2,
      });
    if (!draft.externalAiConsent)
      missing.push({
        key: "externalAiConsent",
        label: "外部AIサービスでの処理への同意",
        step: 2,
      });
    if (!draft.aiReconstructionAcknowledged)
      missing.push({
        key: "aiReconstructionAcknowledged",
        label: "仕上がりの表現についての確認",
        step: 2,
      });
    return missing;
  }, [draft, unsavedPhotoCount]);

  const currentStepMissingFields = useMemo(
    () => missingFields.filter((item) => item.step === step),
    [missingFields, step],
  );

  const goToStep = (targetStep: number) => {
    setError("");
    setStepValidationAttempted(false);
    setStep(targetStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    if (currentStepMissingFields.length > 0) {
      setStepValidationAttempted(true);
      setError(
        "このステップの必須項目をすべて入力してください。未入力の内容を下に表示しています。",
      );
      if (step === 1) {
        const firstIncompleteMemory = draft.memories.find(
          (memory) => !isMemoryReady(memory),
        );
        if (firstIncompleteMemory)
          setActiveMemoryKey(firstIncompleteMemory.clientKey);
      }
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    goToStep(Math.min(step + 1, steps.length - 1));
  };

  const submit = async () => {
    if (missingFields.length > 0) {
      setError(
        "必須項目がまだ入力されていません。画面内の一覧から入力する項目を選んでください。",
      );
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    if (!user) {
      router.push("/auth?mode=signup&next=/story");
      return;
    }
    if (!draftId) {
      setError(
        "下書きの保存を確認できませんでした。通信状態をご確認のうえ、ページを再読み込みしてください。",
      );
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    setError("");
    const supabase = getSupabaseBrowserClient();

    try {
      const memorySummary = draft.memories
        .map(
          (memory, index) =>
            `${index + 1}. ${memory.title}\n${memory.description}`,
        )
        .join("\n\n");
      const orderPayload = {
        pet_name: draft.petName,
        name_kana: draft.nameKana,
        breed: draft.breed,
        age_text: draft.age,
        purpose: FIXED_FILM_PURPOSE,
        personality: draft.personality,
        first_meeting: "",
        favorite_memory: memorySummary,
        message_to_pet: draft.message,
        avoid_notes: null,
        style: FIXED_FILM_STYLE,
        aspect_ratio: FIXED_ASPECT_RATIO,
        narration: FIXED_NARRATION,
        bgm: FIXED_BGM,
        consent_accepted: draft.termsConsent,
        photo_rights_consent_accepted: draft.photoRightsConsent,
        external_ai_consent_accepted: draft.externalAiConsent,
        terms_version: CONSENT_VERSIONS.terms,
        privacy_version: CONSENT_VERSIONS.privacy,
        ai_notice_version: CONSENT_VERSIONS.aiNotice,
        photo_rights_consent_version: CONSENT_VERSIONS.photoRights,
        people_policy_version: CONSENT_VERSIONS.peoplePolicy,
      };
      let orderId =
        pendingOrderId ||
        window.localStorage.getItem("wan-memory-pending-order-id") ||
        "";
      if (orderId) {
        const { data: pendingOrder } = await supabase
          .from("orders")
          .select("id,status")
          .eq("id", orderId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (pendingOrder?.status === "awaiting_materials") {
          const { error: draftError } = await supabase.rpc(
            "save_memory_order_draft",
            { p_order_id: orderId, p_data: orderPayload },
          );
          if (draftError) throw draftError;
        } else {
          orderId = "";
          window.localStorage.removeItem("wan-memory-pending-order-id");
        }
      }
      if (!orderId) {
        const { data, error: orderError } = await supabase.rpc(
          "create_memory_order",
          { p_data: orderPayload },
        );
        if (orderError) throw orderError;
        const created = Array.isArray(data) ? data[0] : data;
        if (!created?.order_id)
          throw new Error("注文番号を作成できませんでした。");
        orderId = created.order_id;
        setPendingOrderId(orderId);
        window.localStorage.setItem("wan-memory-pending-order-id", orderId);
        const { error: linkDraftError } = await supabase.rpc(
          "link_story_draft_order",
          {
            p_draft_id: draftId,
            p_order_id: orderId,
          },
        );
        if (linkDraftError) throw linkDraftError;
      }

      const { error: pruneError } = await supabase.rpc(
        "prune_order_memories",
        {
          p_order_id: orderId,
          p_client_keys: draft.memories.map((memory) => memory.clientKey),
        },
      );
      if (pruneError) throw pruneError;

      const memoryIds = new Map<string, string>();
      for (let index = 0; index < draft.memories.length; index += 1) {
        const memory = draft.memories[index];
        const { data: memoryId, error: memoryError } = await supabase.rpc(
          "save_order_memory_entry",
          {
            p_order_id: orderId,
            p_client_key: memory.clientKey,
            p_sort_order: index + 1,
            p_title: memory.title.trim(),
            p_when_text: memory.whenText.trim() || null,
            p_location: memory.location.trim() || null,
            p_description: memory.description.trim(),
            p_dog_behavior: null,
          },
        );
        if (memoryError || !memoryId)
          throw memoryError || new Error("思い出を保存できませんでした。");
        memoryIds.set(memory.clientKey, memoryId as string);
      }

      setUploadProgress(70);
      const { data: promotedAssets, error: promotionError } =
        await supabase.rpc("promote_story_draft_assets", {
          p_draft_id: draftId,
          p_order_id: orderId,
        });
      if (promotionError) throw promotionError;
      const promoted = (promotedAssets ?? []) as Array<{
        client_key: string;
        asset_id: string;
      }>;
      if (promoted.length !== photoFiles.length)
        throw new Error("自動保存した写真をすべて確認できませんでした。");
      const assetIdByPhotoKey = new Map(
        promoted.map((photo) => [photo.client_key, photo.asset_id]),
      );
      const requiredAssetId = (photoKey: string) => {
        const id = assetIdByPhotoKey.get(photoKey);
        if (!id) throw new Error("選んだ写真を確認できませんでした。");
        return id;
      };

      for (const memory of draft.memories) {
        const memoryId = memoryIds.get(memory.clientKey);
        if (!memoryId) throw new Error("思い出を確認できませんでした。");
        const { error: linkError } = await supabase.rpc(
          "assign_memory_photos",
          {
            p_order_id: orderId,
            p_memory_id: memoryId,
            p_asset_ids: memory.photoKeys.map(requiredAssetId),
          },
        );
        if (linkError) throw linkError;
      }

      const { error: productionError } = await supabase.rpc(
        "save_order_production_fields",
        {
          p_order_id: orderId,
          p_data: {
            ai_reconstruction_acknowledged: draft.aiReconstructionAcknowledged,
          },
        },
      );
      if (productionError) throw productionError;

      const { error: submitError } = await supabase.rpc("submit_memory_order", {
        p_order_id: orderId,
      });
      if (submitError) throw submitError;
      setUploadProgress(100);
      const { error: completeDraftError } = await supabase.rpc(
        "complete_story_draft",
        {
          p_draft_id: draftId,
          p_order_id: orderId,
        },
      );
      if (completeDraftError) console.error(completeDraftError);
      await notifyAdminFromCustomer(orderId, "order_submitted", orderId);
      window.localStorage.removeItem("kimi-film-draft");
      window.localStorage.removeItem(`wan-memory-story-draft-${user.id}`);
      window.localStorage.removeItem("wan-memory-pending-order-id");
      router.push(`/studio?received=1&order=${orderId}`);
    } catch (caught) {
      console.error(caught);
      const message =
        caught instanceof Error && /[ぁ-んァ-ヶ一-龠]/.test(caught.message)
          ? caught.message
          : "受付を完了できませんでした。通信状態をご確認のうえ、もう一度お試しください。";
      setError(message);
      setSubmitting(false);
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
  };

  if (!hydrated || authLoading || !user)
    return <div className="wizard-loading">思い出の続きを準備しています…</div>;

  return (
    <main className="wizard-page">
      <header className="wizard-header">
        <Link className="brand" href="/" aria-label="WAN MEMORY トップへ">
          <span className="brand-mark" aria-hidden="true">
            WM
          </span>
          <span className="brand-type">
            WAN MEMORY<small>MOVING STORYBOOKS FOR YOUR DOG</small>
          </span>
        </Link>
        <div className={`save-status ${saveStatus}`} aria-live="polite">
          <span
            className={saveStatus === "saved" ? "save-dot active" : "save-dot"}
          />
          {saveStatus === "saving"
            ? "自動保存中…"
            : saveStatus === "saved"
              ? "写真と入力内容を保存しました"
              : saveStatus === "error"
                ? "保存できません。通信をご確認ください"
                : "入力内容は自動保存されます"}
        </div>
        <Link className="wizard-close" href="/" aria-label="入力を閉じる">
          ×
        </Link>
      </header>
      <div className="wizard-progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="wizard-layout">
        <aside className="wizard-side">
          <p>YOUR STORY</p>
          <ol>
            {steps.map((label, index) => (
              <li
                className={
                  index === step ? "active" : index < step ? "done" : ""
                }
                key={label}
              >
                <span>{index < step ? "✓" : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <blockquote>
            「きれいに書こうとしなくて大丈夫です。覚えているままを聞かせてください。」
          </blockquote>
        </aside>

        <section className="wizard-main" aria-labelledby="step-title">
          {restored && (
            <aside className="draft-restored-notice" role="status">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>前回の続きから再開しました。</strong>
                <small>入力内容と写真は保存されています。</small>
              </div>
              <button
                type="button"
                onClick={() => setRestored(false)}
                aria-label="再開のお知らせを閉じる"
              >
                ×
              </button>
            </aside>
          )}
          <div className="step-count">
            STEP {String(step + 1).padStart(2, "0")} /{" "}
            {String(steps.length).padStart(2, "0")}{" "}
            <strong>{steps[step]}</strong>
          </div>
          {step === 0 && (
            <div className="wizard-panel">
              <p className="eyebrow">ABOUT YOUR DOG</p>
              <h1 id="step-title">その子のことを教えてください。</h1>
              <p className="step-lead">
                「必須」と表示された項目をすべて入力すると、次のステップへ進めます。
              </p>
              <div className="form-grid">
                <label>
                  <span>
                    お名前 <em>必須</em>
                  </span>
                  <input
                    required
                    value={draft.petName}
                    onChange={(event) => update("petName", event.target.value)}
                    placeholder="例：ひなた"
                  />
                </label>
                <label>
                  <span>
                    お名前の読み方 <small>任意</small>
                  </span>
                  <input
                    value={draft.nameKana}
                    onChange={(event) => update("nameKana", event.target.value)}
                    placeholder="例：ひなた"
                  />
                </label>
                <label>
                  <span>
                    犬種 <em>必須</em>
                  </span>
                  <input
                    required
                    value={draft.breed}
                    onChange={(event) => update("breed", event.target.value)}
                    placeholder="例：柴犬"
                  />
                </label>
                <label>
                  <span>
                    年齢 <em>必須</em>
                  </span>
                  <input
                    required
                    value={draft.age}
                    onChange={(event) => update("age", event.target.value)}
                    placeholder="例：4歳 / 推定3歳"
                  />
                </label>
              </div>
              <fieldset className="chip-field">
                <legend>
                  どんな性格ですか？ <small>1つ以上・必須</small>
                </legend>
                <div>
                  {personalities.map((personality) => (
                    <button
                      type="button"
                      className={
                        draft.personality.includes(personality)
                          ? "chip selected"
                          : "chip"
                      }
                      onClick={() => togglePersonality(personality)}
                      key={personality}
                    >
                      {personality}
                      <span aria-hidden="true">＋</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 1 && (
            <div className="wizard-panel">
              <p className="eyebrow">STORIES & PHOTOS</p>
              <h1 id="step-title">物語にしたい日と、その日の一枚。</h1>
              <p className="step-lead">
                五つの思い出が、その子だけの物語になります。いちばん心に浮かぶ出来事から、最初の一場面をつくっていきましょう。
              </p>
              <aside
                className={
                  completedMemoryCount > 0
                    ? "first-memory-start complete"
                    : "first-memory-start"
                }
                aria-live="polite"
              >
                <div className="first-memory-start-copy">
                  <span>{completedMemoryCount > 0 ? "FIRST MEMORY SAVED" : "START WITH ONE MEMORY"}</span>
                  <strong>
                    {completedMemoryCount > 0
                      ? "いいスタートです。次の思い出へ進みましょう。"
                      : "最初の一場面から、物語を始めましょう。"}
                  </strong>
                  <p>
                    {completedMemoryCount > 0
                      ? `五つのうち${completedMemoryCount}つが完成しました。思い出が重なるたび、物語の輪郭が見えてきます。`
                      : "まず写真を1枚選び、写真を見ながらタイトルと覚えていることを書いてみましょう。"}
                  </p>
                  {completedMemoryCount > 0 && (
                    <Link className="first-memory-save-exit" href="/">
                      ここまでを保存して、あとで続ける
                    </Link>
                  )}
                </div>
                <div className="first-memory-progress" aria-label={`思い出 ${completedMemoryCount} / ${draft.memories.length} 完了`}>
                  <strong>{completedMemoryCount}</strong>
                  <span>/ {draft.memories.length} 完了</span>
                  <i><b style={{ width: `${(completedMemoryCount / draft.memories.length) * 100}%` }} /></i>
                </div>
              </aside>
              {photoSelectionNotice && (
                <aside className="photo-selection-feedback" role="status">
                  <strong>写真を更新しました。</strong>
                  <span>{photoSelectionNotice}</span>
                </aside>
              )}
              <details
                className="memory-writing-guide"
              >
                <summary>
                  <span><small>WRITING GUIDE</small><strong>書き方に迷ったら、例を見る</strong></span>
                  <i aria-hidden="true">＋</i>
                </summary>
                <div className="memory-writing-guide-content">
                  <ol>
                  <li>
                    <span>01</span>
                    <div>
                      <strong>ひとつの出来事に絞る</strong>
                      <p>
                        「旅行」だけではなく「海辺で初めて波を見た日」のように、ひとつの出来事として教えてください。そこから複数の場面をご提案します。
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <strong>その子らしい反応を書く</strong>
                      <p>
                        走った、立ち止まった、少し怖がったなど、ご家族が覚えている表情やしぐさを含めてください。
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <strong>その日の気持ちを添える</strong>
                      <p>
                        うれしかった、笑ってしまった、成長を感じた。ご家族の気持ちが物語の文章になります。
                      </p>
                    </div>
                  </li>
                  </ol>
                  <p>
                    例：「去年の春、家族になって初めて桜の道を歩きました。ミルは舞う花びらを見上げ、知らない季節を一つずつ覚えているようでした。」
                  </p>
                </div>
              </details>
              <div className="memory-entry-list">
                {draft.memories.map((memory, index) => {
                  if (!showAllMemoryCards && index > 0) return null;
                  const complete = isMemoryReady(memory);
                  const expanded = activeMemoryKey === memory.clientKey;
                  return (
                    <article
                      className={`memory-entry-card${complete ? " complete" : ""}`}
                      key={memory.clientKey}
                      ref={(el) => {
                        memoryCardRefs.current[memory.clientKey] = el;
                      }}
                    >
                      <button
                        type="button"
                        className="memory-entry-toggle"
                        aria-expanded={expanded}
                        aria-controls={`memory-entry-content-${memory.clientKey}`}
                        onClick={() => {
                          const opening = activeMemoryKey !== memory.clientKey;
                          setActiveMemoryKey((current) =>
                            current === memory.clientKey
                              ? ""
                              : memory.clientKey,
                          );
                          if (opening) {
                            window.requestAnimationFrame(() => {
                              memoryCardRefs.current[
                                memory.clientKey
                              ]?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                            });
                          }
                        }}
                      >
                        <span className="memory-entry-toggle-copy">
                          <span>
                            MEMORY {String(index + 1).padStart(2, "0")} /{" "}
                            {draft.memories.length}
                          </span>
                          <strong>
                            {memory.title.trim() || `思い出 ${index + 1}`}
                          </strong>
                        </span>
                        <span className="memory-entry-status">
                          {complete
                            ? "入力完了 ✓"
                            : expanded
                              ? "入力中"
                              : "入力する"}
                        </span>
                        <span
                          className={
                            expanded
                              ? "memory-entry-chevron open"
                              : "memory-entry-chevron"
                          }
                          aria-hidden="true"
                        >
                          ⌄
                        </span>
                      </button>
                      {expanded && (
                        <div
                          className="memory-entry-content"
                          id={`memory-entry-content-${memory.clientKey}`}
                        >
                          <div className="memory-entry-fields">
                            <label className="wide">
                              <span>
                                思い出のタイトル <em>必須</em>
                              </span>
                              <input
                                required
                                value={memory.title}
                                maxLength={80}
                                onChange={(event) =>
                                  updateMemory(
                                    memory.clientKey,
                                    "title",
                                    event.target.value,
                                  )
                                }
                                placeholder="例：はじめて海を見た日"
                              />
                            </label>
                            <label>
                              <span>
                                いつ頃ですか？ <small>任意</small>
                              </span>
                              <input
                                value={memory.whenText}
                                maxLength={120}
                                onChange={(event) =>
                                  updateMemory(
                                    memory.clientKey,
                                    "whenText",
                                    event.target.value,
                                  )
                                }
                                placeholder="例：2025年の春 / 3歳の頃"
                              />
                            </label>
                            <label>
                              <span>
                                どこでの思い出ですか？ <small>任意</small>
                              </span>
                              <input
                                value={memory.location}
                                maxLength={120}
                                onChange={(event) =>
                                  updateMemory(
                                    memory.clientKey,
                                    "location",
                                    event.target.value,
                                  )
                                }
                                placeholder="例：いつもの公園、家のリビング"
                              />
                            </label>
                            <label className="wide">
                              <span>
                                そのときのことを詳しく教えてください{" "}
                                <em>必須</em>
                              </span>
                              <textarea
                                required
                                rows={6}
                                maxLength={2000}
                                value={memory.description}
                                onChange={(event) =>
                                  updateMemory(
                                    memory.clientKey,
                                    "description",
                                    event.target.value,
                                  )
                                }
                                placeholder="誰と、どんな時間を過ごし、何が心に残っていますか？ その子の表情やしぐさ（走った、振り返った、首をかしげたなど）も一緒に書いていただくと、場面づくりの参考になります。"
                              />
                              <small
                                className={
                                  memory.description.trim().length > 0
                                    ? "field-count complete"
                                    : "field-count"
                                }
                              >
                                {memory.description.trim().length}文字
                              </small>
                            </label>
                          </div>
                          <fieldset className="memory-photo-linker">
                            <legend>
                              この物語の場面写真 <em>1枚必須・最大3枚</em>
                            </legend>
                            <p>
                              先に写真を選ぶと、その日のことを思い出しながら書きやすくなります。最終的にどの写真を制作の基準にするかは、担当者がすべて確認して選びます。
                            </p>
                            <div className="memory-photo-grid">
                              {memory.photoKeys.map((photoKey, photoIndex) => {
                                const photo = photoByKey.get(photoKey);
                                if (!photo) return null;
                                return (
                                  <article
                                    className={`memory-photo-item ${photo.status}`}
                                    key={photoKey}
                                  >
                                    <button
                                      type="button"
                                      className="memory-photo-thumb"
                                      onClick={() =>
                                        setPreviewPhotoKey(photoKey)
                                      }
                                    >
                                      <img
                                        src={photo.previewUrl}
                                        alt={`${memory.title.trim() || `思い出 ${index + 1}`}の写真 ${photoIndex + 1}`}
                                        loading="lazy"
                                      />
                                      <span>大きく見る</span>
                                    </button>
                                    <div>
                                      <strong className="memory-photo-role">
                                        写真 {photoIndex + 1}
                                      </strong>
                                      {photo.status === "uploading" && (
                                        <em className="photo-save-state">
                                          保存中…
                                        </em>
                                      )}
                                      {photo.status === "saved" && (
                                        <em className="photo-save-state saved">
                                          保存済み ✓
                                        </em>
                                      )}
                                      {photo.status === "error" && (
                                        <button
                                          type="button"
                                          className="photo-retry-button"
                                          onClick={() => retryPhoto(photoKey)}
                                        >
                                          再試行
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        disabled={photo.status === "uploading"}
                                        onClick={() =>
                                          void removePhoto(photoKey)
                                        }
                                      >
                                        削除
                                      </button>
                                    </div>
                                  </article>
                                );
                              })}
                              {memory.photoKeys.length <
                                MAX_PHOTOS_PER_MEMORY && (
                                <button
                                  type="button"
                                  className="memory-photo-add"
                                  onClick={() =>
                                    openPhotoInput(
                                      `memory-photo-input-${memory.clientKey}`,
                                    )
                                  }
                                >
                                  <span
                                    className="upload-mark"
                                    aria-hidden="true"
                                  >
                                    ＋
                                  </span>
                                  <strong>写真を追加</strong>
                                  <small>
                                    {memory.photoKeys.length === 0
                                      ? "まず1枚だけ選んでください"
                                      : "別の表情や場面も追加できます"}
                                  </small>
                                </button>
                              )}
                            </div>
                            <input
                              id={`memory-photo-input-${memory.clientKey}`}
                              className="reference-slot-input"
                              type="file"
                              accept={PHOTO_INPUT_ACCEPT}
                              multiple
                              onChange={(event) =>
                                handleMemoryPhotoUpload(event, memory.clientKey)
                              }
                            />
                            <strong className="memory-photo-count">
                              {memory.photoKeys.length} /{" "}
                              {MAX_PHOTOS_PER_MEMORY}枚
                            </strong>
                          </fieldset>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="memory-entry-add">
                <p>
                  完成映像は、はじまり・5つの物語・おわりのメッセージで構成します。
                  <br />
                  入力できた物語：
                  {completedMemoryCount} /{" "}
                  {draft.memories.length}項目 · 写真{totalLinkedPhotoCount}枚
                  <br />
                  {allMemoryEntriesComplete
                    ? "すべて入力できました。このまま確認へ進めます。"
                    : "各物語の文章と写真1枚がそろうと入力完了になります。書きやすいものから進めてください。"}
                </p>
              </div>
              <div className="stacked-fields memory-ending-fields">
                <label>
                  <span>
                    その子へ伝えたいこと <em>必須</em>
                  </span>
                  <textarea
                    required
                    rows={3}
                    value={draft.message}
                    onChange={(event) => update("message", event.target.value)}
                    placeholder="映像の最後に残したい言葉"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-panel">
              <p className="eyebrow">REVIEW</p>
              <h1 id="step-title">ありがとうございます。</h1>
              <p className="step-lead">
                まずは相談受付としてお預かりします。決済は内容と納期をご確認いただいた後です。
              </p>
              <div className="review-card">
                <div className="review-title">
                  <span className="brand-mark" aria-hidden="true">
                    WM
                  </span>
                  <div>
                    <strong>{draft.petName || "愛犬"}ちゃんの動く絵本</strong>
                    <small>
                      {FIXED_FILM_PURPOSE_LABEL}・{FIXED_FILM_STYLE}
                    </small>
                  </div>
                </div>
                <section className="review-section">
                  <header>
                    <h2>基本情報</h2>
                    <button type="button" onClick={() => goToStep(0)}>
                      修正する
                    </button>
                  </header>
                  <dl>
                    <div>
                      <dt>お名前</dt>
                      <dd>{draft.petName || "未入力"}</dd>
                    </div>
                    <div>
                      <dt>犬種・年齢</dt>
                      <dd>
                        {[draft.breed, draft.age].filter(Boolean).join(" / ") ||
                          "未入力"}
                      </dd>
                    </div>
                    <div>
                      <dt>性格</dt>
                      <dd>{draft.personality.join("、") || "未入力"}</dd>
                    </div>
                    <div>
                      <dt>映像の目的</dt>
                      <dd>{FIXED_FILM_PURPOSE_LABEL}</dd>
                    </div>
                  </dl>
                </section>
                <section className="review-section">
                  <header>
                    <h2>物語と場面写真</h2>
                    <button type="button" onClick={() => goToStep(1)}>
                      修正する
                    </button>
                  </header>
                  <div className="review-memory-list">
                    {draft.memories.map((memory, index) => (
                      <article key={memory.clientKey}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <strong>{memory.title || "タイトル未入力"}</strong>
                          <div className="review-memory-photos">
                            {memory.photoKeys.map((photoKey, photoIndex) => {
                              const photo = photoByKey.get(photoKey);
                              return photo ? (
                                <img
                                  src={photo.previewUrl}
                                  alt={`${memory.title || `物語 ${index + 1}`}の写真 ${photoIndex + 1}`}
                                  key={photoKey}
                                />
                              ) : null;
                            })}
                          </div>
                          <p>
                            {memory.description || "詳しい内容が未入力です。"}
                          </p>
                          <small>
                            {memory.whenText || "時期未入力"} ·{" "}
                            {memory.location || "場所未入力"} · 写真
                            {memory.photoKeys.length}枚
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="review-section">
                  <header>
                    <h2>仕上がり</h2>
                  </header>
                  <dl>
                    <div>
                      <dt>映像の仕様</dt>
                      <dd>
                        約40秒・{FIXED_ASPECT_RATIO}・{FIXED_FILM_STYLE}
                        <br />
                        BGMと場面ごとの物語字幕は担当ディレクターが整えます
                      </dd>
                    </div>
                    <div>
                      <dt>プラン</dt>
                      <dd>うちの子の動く絵本</dd>
                    </div>
                    <div>
                      <dt>料金</dt>
                      <dd className="review-monitor-price">
                        <strong>
                          初期{MEMORY_FILM_PRICING.launchLimit}組限定 モニター価格 ¥
                          {formatYen(MEMORY_FILM_PRICING.launchPrice)}（税込）
                        </strong>
                        <small>
                          必要な思い出と写真の送信が完了した時点で確定・モニター受付終了後は
                          ¥{formatYen(MEMORY_FILM_PRICING.regularPrice)}（税込）
                        </small>
                      </dd>
                    </div>
                    <div>
                      <dt>物語案</dt>
                      <dd>2案から1案を選択</dd>
                    </div>
                    <div>
                      <dt>専用サイト</dt>
                      <dd>プランに含まれます</dd>
                    </div>
                  </dl>
                </section>
              </div>
              <aside className="review-payment-summary">
                <strong>物語案を選んだあとにお支払い</strong>
                <p>
                  この送信後、担当者が2つの物語案をご提案します。1案を選び、確定料金・予定納期・キャンセル条件をご確認いただくと、そのままカード決済へ進めます。必要な素材と決済の確認後、通常10〜14営業日でオンライン納品します。
                </p>
                <div>
                  <Link href="/legal" target="_blank">
                    販売条件・キャンセルについて
                  </Link>
                  <Link href="/terms" target="_blank">
                    利用規約
                  </Link>
                  <Link href="/privacy" target="_blank">
                    プライバシーポリシー
                  </Link>
                </div>
              </aside>
              <div className="consent-stack">
                <label className="consent-box">
                  <input
                    type="checkbox"
                    checked={draft.termsConsent}
                    onChange={(event) =>
                      update("termsConsent", event.target.checked)
                    }
                  />
                  <span>
                    <strong>
                      利用規約とプライバシーポリシーに同意します <em>必須</em>
                    </strong>
                    <small>
                      <Link href="/terms" target="_blank">
                        利用規約
                      </Link>
                      （{CONSENT_VERSIONS.terms}）と
                      <Link href="/privacy" target="_blank">
                        プライバシーポリシー
                      </Link>
                      （{CONSENT_VERSIONS.privacy}）を確認しました。
                    </small>
                  </span>
                </label>
                <label className="consent-box">
                  <input
                    type="checkbox"
                    checked={draft.photoRightsConsent}
                    onChange={(event) =>
                      update("photoRightsConsent", event.target.checked)
                    }
                  />
                  <span>
                    <strong>
                      写真の使用権限と人物の取り扱いについて確認しました{" "}
                      <em>必須</em>
                    </strong>
                    <small>
                      提出する写真について、本サービスの映像制作に使用する権限を持っています。人物が写っている場合は、その方（未成年者の場合は保護者）の了解を得ており、人物のお顔は映像に使用・生成せず、後ろ姿などお顔が分からない形でのみ扱うことを確認しました。確認文版：
                      {CONSENT_VERSIONS.photoRights}
                    </small>
                  </span>
                </label>
                <label className="consent-box">
                  <input
                    type="checkbox"
                    checked={draft.externalAiConsent}
                    onChange={(event) =>
                      update("externalAiConsent", event.target.checked)
                    }
                  />
                  <span>
                    <strong>
                      外部AIサービスの利用を確認しました <em>必須</em>
                    </strong>
                    <small>
                      映像制作のため、写真や制作情報が外部AIサービスで処理される場合があります。WAN
                      MEMORYが独自のAIモデル学習や広告・ポートフォリオ公開に使用することはありません。外部サービスでのデータの取り扱いは各サービスの条件に基づきます。案内版：
                      {CONSENT_VERSIONS.aiNotice}
                    </small>
                  </span>
                </label>
                <label className="consent-box important">
                  <input
                    type="checkbox"
                    checked={draft.aiReconstructionAcknowledged}
                    onChange={(event) =>
                      update(
                        "aiReconstructionAcknowledged",
                        event.target.checked,
                      )
                    }
                  />
                  <span>
                    <strong>
                      仕上がりの表現について確認しました <em>必須</em>
                    </strong>
                    <small>
                      元写真をそのまま動かす実写再現ではなく、愛犬の特徴とエピソードをもとに、水彩とガッシュの絵本として新しく描かれます。写真との完全な一致ではなく、同じ作品内でのキャラクターらしさと物語性を大切にする表現であることを確認しました。
                    </small>
                  </span>
                </label>
              </div>
              {missingFields.length > 0 ? (
                <aside
                  className="missing-fields-panel"
                  role="status"
                  aria-labelledby="missing-fields-title"
                >
                  <p className="eyebrow">REQUIRED ITEMS</p>
                  <h2 id="missing-fields-title">
                    あと{missingFields.length}項目の入力が必要です。
                  </h2>
                  <p>
                    項目を選ぶと入力する画面へ戻れます。すべて入力すると、ご相談を送信できます。
                  </p>
                  <ul>
                    {missingFields.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => goToStep(item.step)}
                        >
                          <span>{steps[item.step]}</span>
                          <strong>{item.label}</strong>
                          <em>入力する →</em>
                        </button>
                      </li>
                    ))}
                  </ul>
                </aside>
              ) : (
                <aside className="ready-to-submit" role="status">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>必要な項目がすべて揃いました。</strong>
                    <small>下のボタンからご相談を送信できます。</small>
                  </div>
                </aside>
              )}
            </div>
          )}

          {[1, 2, 3].includes(step) &&
            (currentStepMissingFields.length > 0 ? (
              <aside
                className={
                  stepValidationAttempted
                    ? "step-required-panel attempted"
                    : "step-required-panel"
                }
                id="step-required-status"
                role="status"
                aria-live="polite"
              >
                <strong>
                  このステップは、あと{currentStepMissingFields.length}
                  項目の入力が必要です。
                </strong>
                <span>「必須」の内容をすべて入力すると、次へ進めます。</span>
                <ul>
                  {currentStepMissingFields.map((item) => (
                    <li key={item.key}>{item.label}</li>
                  ))}
                </ul>
              </aside>
            ) : (
              <aside
                className="step-ready-panel"
                id="step-required-status"
                role="status"
              >
                <span aria-hidden="true">✓</span>
                <strong>
                  このステップの必須項目が揃いました。次へ進めます。
                </strong>
              </aside>
            ))}
          {error && (
            <div
              className="form-error"
              role="alert"
              tabIndex={-1}
              ref={errorSummaryRef}
            >
              <span>{error}</span>
            </div>
          )}
          {submitting && (
            <div className="submit-progress" role="status">
              <span
                style={{ width: `${totalPhotoCount ? uploadProgress : 100}%` }}
              />
              <p>
                {totalPhotoCount
                  ? `思い出と写真を安全に送信しています… ${uploadProgress}%`
                  : "ご相談を受け付けています…"}
              </p>
            </div>
          )}
          <div className="wizard-actions">
            {step > 0 ? (
              <button
                className="button button-ghost"
                type="button"
                disabled={submitting}
                onClick={() => goToStep(step - 1)}
              >
                ← 戻る
              </button>
            ) : (
              <span />
            )}
            {step < steps.length - 1 ? (
              <button
                className="button button-primary"
                type="button"
                aria-describedby={
                  [0, 1, 2].includes(step) ? "step-required-status" : undefined
                }
                onClick={goNext}
              >
                次へ進む →
              </button>
            ) : (
              <button
                className="button button-primary"
                type="button"
                disabled={submitting}
                onClick={submit}
              >
                {submitting
                  ? "送信中…"
                  : missingFields.length
                    ? `未入力${missingFields.length}項目を確認する →`
                    : "相談を受け付ける →"}
              </button>
            )}
          </div>
        </section>
      </div>
      {previewPhoto && (
        <div
          className="photo-preview-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewPhotoKey("");
          }}
        >
          <section
            className="photo-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="写真の拡大表示"
            ref={photoPreviewDialogRef}
          >
            <button
              type="button"
              onClick={() => setPreviewPhotoKey("")}
              aria-label="拡大表示を閉じる"
            >
              ×
            </button>
            <img
              src={previewPhoto.previewUrl}
              alt="選択した愛犬の写真を拡大表示"
            />
            <small>{previewPhoto.originalName}</small>
          </section>
        </div>
      )}
      <PhotoUploadGuideDialog
        open={Boolean(pendingPhotoInputId)}
        onClose={() => setPendingPhotoInputId("")}
        onContinue={continueToFirstPhoto}
      />
    </main>
  );
}
