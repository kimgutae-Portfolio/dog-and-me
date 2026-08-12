"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthProvider";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { hasCurrentConsent } from "../lib/consent";
import { APPLICATIONS_OPEN } from "../lib/site";
import { AdminPushCenter } from "./AdminPushCenter";
import type {
  FilmConcept,
  MemoryOrder,
  OrderAsset,
  OrderMemory,
  OrderMessage,
  PhotoAnalysisStatus,
  Profile,
  RenderProgressEvent,
  RevisionRequest,
  SecurityEvent,
} from "../lib/supabase/types";
import {
  getProductionFields,
  ORDER_STATUS_LABELS,
  SECURITY_EVENT_LABELS,
  type OrderStatus,
} from "../lib/supabase/types";

type ConceptDraft = {
  title: string;
  tone: string;
  summary: string;
  storyScenes: Record<string, string>;
};
type VideoMode = "review" | "final";
type AttentionCount = { messages: number; revisions: number };

const emptyConcept: ConceptDraft = {
  title: "",
  tone: "",
  summary: "",
  storyScenes: {},
};

type ConceptJsonRecord = Record<string, unknown>;

function asRecord(value: unknown): ConceptJsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ConceptJsonRecord)
    : null;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedText(value: string) {
  return value.toLocaleLowerCase().replace(/[\s「」『』。、・:：!?！？]/g, "");
}

function sceneCandidates(value: ConceptJsonRecord) {
  const candidates = [value.story_scenes, value.storyScenes, value.scenes, value.stories];
  return candidates.find((item) => Array.isArray(item)) as unknown[] | undefined;
}

function conceptCandidate(root: ConceptJsonRecord, slot: "A" | "B"): ConceptJsonRecord | null {
  const lower = slot.toLowerCase();
  const direct = root[`concept_${lower}`] ?? root[`concept${slot}`];
  const directRecord = asRecord(direct);
  if (directRecord) return directRecord;
  const concepts = root.concepts;
  if (Array.isArray(concepts)) {
    return asRecord(
      concepts.find((item) => {
        const record = asRecord(item);
        return asText(record?.slot).toUpperCase() === slot;
      }),
    );
  }
  if (asRecord(concepts)) {
    const record = concepts as ConceptJsonRecord;
    return asRecord(record[slot] ?? record[lower] ?? record[`concept_${lower}`]);
  }
  return null;
}

function conceptFromJson(value: unknown, memories: OrderMemory[], slot: "A" | "B") {
  const root = asRecord(value);
  if (!root) throw new Error("JSONのルートはオブジェクトにしてください。");
  const candidate = conceptCandidate(root, slot);
  if (!candidate) throw new Error(`構成案${slot}が見つかりません。concept_${slot.toLowerCase()}を確認してください。`);
  const title = asText(candidate.title ?? candidate.name);
  const tone = asText(candidate.tone ?? candidate.style);
  const summary = asText(candidate.summary ?? candidate.overview ?? candidate.outline);
  if (!title || !summary) throw new Error(`構成案${slot}のタイトルと概要が必要です。`);
  const scenes = sceneCandidates(candidate) ?? [];
  const storyScenes: Record<string, string> = {};
  memories.forEach((memory, index) => {
    const matchingScene = scenes
      .map(asRecord)
      .filter(Boolean)
      .find((scene) => {
        const number = Number(scene?.story_number ?? scene?.storyNumber ?? scene?.memory_number ?? scene?.number);
        const sceneTitle = asText(scene?.story_title ?? scene?.storyTitle ?? scene?.memory_title ?? scene?.title);
        return number === memory.sort_order || number === memory.sort_order + 1 ||
          (sceneTitle && normalizedText(sceneTitle) === normalizedText(memory.title));
      }) ?? asRecord(scenes[index]);
    const text = asText(
      matchingScene?.text ??
        matchingScene?.scene_text ??
        matchingScene?.story_text ??
        matchingScene?.description ??
        matchingScene?.scene,
    );
    if (!text) throw new Error(`構成案${slot}の物語${index + 1}の文章が見つかりません。`);
    storyScenes[memory.id] = text;
  });
  return { title, tone, summary, storyScenes } satisfies ConceptDraft;
}

function parseConceptJson(value: unknown, memories: OrderMemory[]) {
  if (memories.length !== 5) throw new Error("先に5つの物語を読み込んでください。");
  return {
    a: conceptFromJson(value, memories, "A"),
    b: conceptFromJson(value, memories, "B"),
  };
}
const STORYBOOK_STYLE_PROFILE = {
  id: "storybook_watercolor_v1",
  dog_treatment:
    "soft painted dog with natural proportions, restrained watercolor and gouache texture",
  background_treatment:
    "rich illustrated environment with visible paper texture and clear story-specific atmosphere",
  transition_treatment:
    "direct curved page turn from one approved story page to the next; no bridge background",
  avoid: [
    "photorealistic dog",
    "oversized anime eyes",
    "tear stains or invented coat markings",
    "film blur",
    "film grain",
    "heavy vignette",
    "letterbox",
    "embedded text",
  ],
} as const;
const MEMORY_STORYBOOK_PRODUCTION_PROTOCOL = {
  id: "MEMORY STORYBOOK PRODUCTION",
  version: "2.0",
  prompt_filename: "MEMORY_STORYBOOK_PRODUCTION_v2.txt",
  source_photo_policy:
    "Use customer photos as identity-locked references in their original aspect ratio. Preserve the same dog's face, proportions, coat, tail, and visible accessories; never pad, blur, crop, or send the raw photo directly to Runway.",
  page_image_policy:
    "Recompose only the scene, background, lighting, and painted treatment into a new 16:9 watercolor-and-gouache storybook page. The dog must remain recognizably the same dog as the primary reference.",
  story_pages: {
    count: 5,
    model: "gen4",
    duration_seconds: 5,
    expanded_story_duration_seconds: 10,
    expanded_story_count: 3,
    expanded_story_rule:
      "The three selected important stories are one continuous 10-second clip each; the remaining two stories are one continuous 5-second clip each.",
  },
  transition_video_count: 0,
  transition_page_count: 0,
} as const;
const CONCEPT_PROPOSAL_PROMPT = `WAN MEMORY STORY CONCEPT PROPOSAL v1.0

첨부한 order.json과 stories/01~05의 고객 원본 사진을 읽고 고객에게 제시할 구성안 A와 B를 작성해줘.

규칙
- 아직 그림, 이미지 생성 프롬프트, Runway 프롬프트를 만들지 않는다.
- 고객이 제공한 5개 이야기를 모두 포함한다.
- 고객이 제공하지 않은 사람, 장소, 사건, 감정을 사실처럼 추가하지 않는다.
- A안과 B안은 연결 방식과 감정의 흐름이 분명히 달라야 한다.
- 움직이는 수채·과슈 그림책을 전제로 한다.
- 고객에게 보여줄 내용은 자연스러운 일본어로 작성한다.
- JSON 외의 설명을 작성하지 않는다.

반환 형식
{
  "concept_a": {"title":"","tone":"","summary":"","story_scenes":[{"story_number":1,"story_title":"","text":""},{"story_number":2,"story_title":"","text":""},{"story_number":3,"story_title":"","text":""},{"story_number":4,"story_title":"","text":""},{"story_number":5,"story_title":"","text":""}]},
  "concept_b": {"title":"","tone":"","summary":"","story_scenes":[{"story_number":1,"story_title":"","text":""},{"story_number":2,"story_title":"","text":""},{"story_number":3,"story_title":"","text":""},{"story_number":4,"story_title":"","text":""},{"story_number":5,"story_title":"","text":""}]}
}`;

const STORYBOOK_IMAGE_PROMPT = `WAN MEMORY STORYBOOK PAGE PRODUCTION v2.0

첨부 자료
- order.json
- stories/01~05의 고객 원본 사진
- style_reference.png: 모든 페이지에 공통으로 적용할 화풍 기준 이미지

첨부한 order.json의 selected_concept와 stories/01~05의 고객 원본 사진을 읽고, 고객 확인용 그림책 페이지를 실제로 제작해줘.

style_reference.png는 화풍만 참고한다.
style_reference.png에 등장하는 강아지, 체형, 포즈, 목줄, 벚꽃, 꽃잎, 강, 산책로, 계절, 장소, 사물, 사건은 어떤 이야기에도 가져오지 않는다.

진행 방법
- 이야기 01부터 05까지 반드시 한 번에 한 이야기씩 순서대로 처리한다.
- 각 이야기의 primary 사진을 해당 장면의 강아지 정체성, 신체 비율, 액세서리, 중심 행동, 구도 기준으로 사용한다.
- support 사진은 primary와 충돌하지 않는 세부만 보충한다.
- style_reference.png는 색감, 수채 표현, 선묘, 종이 질감, 배경 묘사 방식에만 사용한다.
- 각 이야기마다 원본 사진을 직접 변형한 이미지가 아닌 새로운 16:9 그림책 페이지 이미지 1장을 제작한다.
- 원본 사진의 종횡비는 그대로 읽고, 크롭·패딩·블러 확장 없이 새로운 16:9 장면으로 재구성한다.
- 이번 단계에서는 Runway, Gen-4 또는 영상 생성 프롬프트를 작성하지 않는다.

입력 이미지 역할
- Image 1: primary reference
  - 강아지 정체성, 체형, 액세서리, 행동, 장면 구성의 최우선 기준
- Image 2~3: support reference
  - primary와 충돌하지 않는 세부만 참고
- style_reference.png: style-only reference
  - 화풍만 참고하고 내용이나 강아지 외형은 절대 복사하지 않음

강아지 정체성 규칙
- primary 사진에 나타난 동일한 강아지로 인식되어야 한다.
- 얼굴형, 자연스러운 눈 크기와 간격, 눈꺼풀, 시선, 귀의 형태와 위치를 유지한다.
- 주둥이의 길이와 폭, 코의 크기와 형태를 유지한다.
- 머리와 몸통의 비율을 유지한다.
- 몸통의 길이와 높이, 가슴에서 지면까지의 간격을 유지한다.
- 다리 길이, 팔꿈치 위치, 뒷다리 각도, 발 크기를 primary 사진과 동일하게 유지한다.
- 다리를 짧게 만들거나 머리를 크게 만들지 않는다.
- 털색, 털의 배치, 미용 길이, 곱슬기와 질감을 유지한다.
- 꼬리의 길이, 말림, 방향을 유지한다.
- 목줄, 하네스, 옷 등 보이는 액세서리의 형태와 색상을 유지한다.
- 액세서리에 있는 글자나 브랜드 표시는 재현하지 않는다.
- support 사진 때문에 primary의 외형이나 비율을 변경하지 않는다.

금지되는 강아지 표현
- 과장된 애니메이션 눈
- 지나치게 크거나 돌출된 눈
- primary보다 짧은 다리
- 과도하게 큰 머리
- 지나치게 둥글거나 뚱뚱해진 몸통
- 새로운 털 무늬
- 눈물자국
- 눈물이나 과장된 슬픔
- 공격적인 표정이나 이빨
- 다른 품종처럼 보이는 외형
- 지나친 실사 표현

공통 화풍 잠금 규칙
모든 페이지에 아래 화풍을 동일하게 적용한다.

- 밝고 맑은 일본 그림책풍 수채화
- 수채화 중심의 표현
- 과슈는 밝은 부분과 중요한 세부에만 제한적으로 사용
- 투명하게 겹쳐지는 수채 레이어
- 섬세한 연필선과 수채 선묘
- 털은 큰 덩어리보다 가늘고 자연스러운 여러 가닥으로 표현
- 얼굴과 눈, 코, 주둥이는 선명하지만 실사적이지 않게 표현
- 밝은 아이보리색 종이가 하이라이트 사이로 자연스럽게 보이게 표현
- 맑고 분리된 파스텔 색상
- 부드럽고 중립적인 그림자
- 작은 붓 터치로 장소의 깊이와 계절감을 섬세하게 표현
- 밝고 깨끗한 자연광
- 손으로 그린 듯한 정교하고 완성도 높은 그림책 일러스트
- 배경도 생략하지 말고 장소와 계절이 충분히 읽히도록 묘사
- 강아지는 배경과 같은 수채화 세계 안에 자연스럽게 어우러지게 표현

필수 스타일 문장
Luminous Japanese picture-book watercolor illustration, watercolor-dominant rendering with sparse restrained gouache accents, transparent layered washes, delicate pencil-and-watercolor contours, fine natural fur strands, pale warm-ivory paper highlights, clean pastel color separation, soft neutral shadows, detailed environmental depth, controlled small brushwork, gentle natural daylight, refined hand-painted storybook finish.

금지되는 화풍
- 두껍고 불투명한 과슈 덩어리
- 유화나 임파스토처럼 솟아 보이는 질감
- 털이 크고 각진 조각처럼 나뉘는 표현
- 반복되는 디지털 붓 도장 무늬
- 거칠고 뭉친 잔디 표현
- 이미지 전체를 덮는 노란색 또는 세피아 필터
- 탁하고 갈색으로 뭉친 색감
- 플라스틱 같은 3D 렌더링
- 평면적인 카툰 스타일
- 사진처럼 지나친 실사
- 필름 블러, 필름 그레인, 강한 비네팅
- 프레임, 테두리, 레터박스
- 스타일 기준 이미지의 강아지나 배경을 복사하는 것

장면 구성 규칙
- selected_concept의 해당 장면과 고객이 제공한 사실만 사용한다.
- 고객 사진에 없는 사람, 동물, 액세서리, 사물, 사건, 장소, 감정을 추가하지 않는다.
- 사진에 등장하는 요소라도 중심 행동에 필요하지 않으면 단순화할 수 있다.
- 한 페이지에는 하나의 중심 행동만 표현한다.
- 강아지의 중심 행동이 즉시 읽히는 구도를 사용한다.
- 작은 영상 움직임을 추가할 수 있도록 강아지 주변에 자연스러운 여백을 남긴다.
- 배경은 장소와 계절이 명확하게 읽혀야 한다.
- 원본 사진을 크롭하거나 블러 배경으로 확장하지 않는다.
- 새로운 16:9 장면으로 완전히 재구성한다.

사람 표현 규칙
- order.json의 people_policy를 반드시 확인하고 따른다.
- face_usage_policy가 faces_never_generated_or_used_back_views_only이면 사람의 얼굴을 생성하지 않는다.
- 이 경우 사람과 아기는 완전한 뒷모습 또는 얼굴이 완전히 가려진 방향으로만 표현한다.
- 원본에 없는 사람은 추가하지 않는다.

이미지 내 문자 금지
- story_caption을 이미지에 넣지 않는다.
- 자막, 제목, 글자, 숫자, 로고, 브랜드, 상품 라벨, 워터마크를 넣지 않는다.
- 원본 의상이나 액세서리에 글자가 있더라도 형태와 색상만 유지하고 글자는 제거한다.
- 글자처럼 보이는 임의의 기호도 만들지 않는다.

이야기별 제작 및 검수 절차
각 이야기는 다음 순서로 처리한다.

1. order.json에서 이야기 번호, 제목, selected_concept 장면, 시기, 장소, 고객 설명을 확인한다.
2. primary 사진을 원본 종횡비로 확인한다.
3. support 사진이 있으면 primary와 충돌하지 않는 세부만 확인한다.
4. style_reference.png의 화풍만 확인한다.
5. 새로운 16:9 그림책 페이지를 제작한다.
6. 제작된 이미지를 primary와 비교해 아래 항목을 검수한다.
   - 얼굴과 눈
   - 귀와 주둥이
   - 머리와 몸통 비율
   - 몸통 높이
   - 다리 길이와 발 크기
   - 털색과 미용 형태
   - 꼬리
   - 목줄, 하네스, 의상
   - 중심 행동과 구도
7. style_reference.png와 비교해 아래 항목을 검수한다.
   - 투명한 수채 레이어
   - 섬세한 선묘
   - 밝은 종이색
   - 깨끗한 파스텔 색상
   - 자연스러운 털 선
   - 충분한 배경 깊이
   - 두꺼운 과슈 또는 디지털 붓 덩어리가 없는지
8. 정체성이나 화풍이 맞지 않으면 다음 이야기로 넘어가지 말고 잘못된 부분만 교정한다.
9. 검수를 통과한 뒤 다음 이야기로 넘어간다.

story_caption 규칙
- 고객에게 이미지와 함께 보여줄 짧고 자연스러운 일본어 한 문장으로 작성한다.
- 나중에 영상 자막으로 그대로 사용할 수 있어야 한다.
- 약 25~50자 안으로 작성한다.
- selected_concept의 해당 장면과 고객이 제공한 사실만 사용한다.
- 고객이 제공하지 않은 사람, 장소, 사건, 행동, 감정을 추가하지 않는다.
- 다섯 문장이 하나의 이야기처럼 자연스럽게 이어지도록 감정의 흐름을 조정한다.
- story_caption은 이미지 안에 직접 넣지 않는다.

최종 반환
- 실제 16:9 그림책 페이지 이미지 5장
- 각 이미지의 story 번호
- order.json의 이야기 제목을 그대로 사용한 scene_title
- 일본어 story_caption
- 사용한 primary 및 support 파일
- primary 기준 정체성 유지 여부
- style_reference 기준 화풍 유지 여부
- 인물 얼굴 정책 준수 여부
- 이미지 안에 문자나 로고가 없는지 여부

각 이미지마다 다음 형식으로 반환한다.

{
  "story_number": 1,
  "scene_title": "order.json의 해당 이야기 제목",
  "story_caption": "고객 확인용 일본어 한 문장",
  "primary_used": "사용한 primary 파일명",
  "support_used": [],
  "identity_check": "passed",
  "style_check": "passed",
  "people_policy_check": "passed",
  "embedded_text_check": "passed"
}`;

const RUNWAY_PROMPT_REQUEST = `WAN MEMORY RUNWAY MOTION PROMPT PRODUCTION v3.2

첨부한 order.json과 approved-pages/의 고객 승인 완료 그림책 이미지 5장을 읽어줘. 이미지는 다시 만들거나 수정하지 않는다.

order.json의 expanded_stories에 지정된 중요한 이야기 3개는 각각 하나의 10초 Gen-4 프롬프트로 작성한다. 나머지 이야기 2개는 각각 하나의 5초 Gen-4 프롬프트로 작성한다. 총 5개의 이미지 투 비디오 프롬프트를 Runway가 명확하게 이해하도록 영어로 작성한다.

중요 이야기를 여러 take로 분리하지 않는다. 연결 배경 이미지와 연결 영상은 만들지 않는다.

중요 이야기의 10초 프롬프트 규칙
- expanded_stories로 지정된 중요한 이야기는 승인 이미지 한 장을 사용하여 하나의 연속된 10초 영상으로 만든다.
- 10초 영상 안에서 사건의 시작과 이어지는 마무리를 하나의 작은 연속 행동으로 보여준다.
- 서로 관계없는 두 행동을 나열하지 않는다.
- motion phase 2는 motion phase 1을 반복하거나 처음 상태로 되돌리지 않고 자연스럽게 이어받아야 한다.
- 두 phase 모두 동일한 승인 이미지의 구도, 강아지 정체성, 기존 진행 방향과 camera-facing facial view를 유지한다.
- 중간 전환, 컷, 디졸브 또는 페이지 넘김을 프롬프트에 넣지 않는다.
- 최종 편집에서는 서로 다른 이야기 사이에만 곡면 책장 넘김을 사용한다.

핵심 연출 목표
- 강아지가 실제로 살아 움직이는 영상으로 보이게 한다.
- 이미지 전체가 미끄러지거나 확대되는 PowerPoint식 움직임으로 만들지 않는다.
- 강아지의 실제 동작이 카메라 움직임이나 환경 움직임보다 분명하게 보여야 한다.
- 다섯 장면이 모두 같은 정지 자세처럼 보이지 않게 한다.
- 각 이야기의 고객 사실과 selected_concept 장면 문장을 강아지 행동의 원인으로 사용한다.
- 얼굴 정체성을 지키는 것과 강아지의 신체 움직임을 없애는 것을 혼동하지 않는다.
- 얼굴 특징과 카메라를 향한 얼굴 방향은 안정적으로 유지하되, 머리는 몸의 이동과 보행 리듬을 자연스럽게 따라가게 한다.
- 감정은 사람처럼 표정을 크게 바꾸거나 눈동자를 굴리는 방식이 아니라, 호흡, 귀 반응, 코의 움직임, 체중 이동, 앞발, 몸통, 꼬리의 움직임으로 표현한다.

승인 이미지 분석
각 이야기마다 먼저 자세(standing, walking, sitting, lying), 기존 진행 방향, 얼굴 각도(front, three-quarter, side), 실제로 보이는 다리·발·꼬리·목줄·옷의 범위, 움직일 수 있는 신체 부위, 배경 기준 요소를 분석한다.

실제 신체 움직임 설계
- 프롬프트에서는 정체성 고정보다 primary dog action을 먼저 설명한다.
- walking 또는 달리는 자세에서는 기존 진행 방향을 이어가며 뒷다리가 지면을 밀고 앞발과 뒷발이 차례로 착지하고 어깨·엉덩이·몸통이 연결된 보행 리듬을 만든다.
- 강아지가 걷거나 달릴 때 울타리, 길, 풀, 가구 등 배경 기준 요소에 대해 실제로 위치를 바꾼다.
- 앉거나 누운 자세에서는 걷기를 강제로 만들지 않고 가슴 호흡, 앞발 조정, 몸통 체중 이동, 편안한 자세 정돈을 사용한다.
- primary action 외 secondary motion은 최대 2개만 사용한다. 귀·털·꼬리·옷은 primary action이나 보이는 바람에 자연스럽게 반응시킨다.
- “tiny movement”, “almost still”, “barely moves”처럼 움직임을 지나치게 축소하는 표현을 사용하지 않는다.
- 고객이 제공하지 않은 사건이나 물체를 추가하지 않는다.

얼굴 방향 및 정체성 안정 규칙
- 승인 이미지의 얼굴 형태, 눈 크기와 간격, 눈꺼풀, 귀, 주둥이, 털 배치와 색상, 체형, 꼬리, 보이는 목줄과 옷을 유지한다.
- 승인 이미지의 camera-facing view를 영상 전체에서 유지한다. 머리는 몸의 이동과 보행 리듬을 따라가되 새로운 얼굴 면을 드러내지 않는다.
- 영어 prompt에는 다음처럼 짧게 작성한다: “The head moves naturally with the body while keeping the original camera-facing view. The same recognizable facial design remains consistent.”
- 눈동자만 좌우로 움직이거나 eye darting, eye rolling, wandering pupils, crossed eyes를 만들지 않는다. 눈 깜빡임은 필요한 이야기에서만 한 번 천천히 허용한다.
- 눈 확대, 눈꺼풀 변형, 과도한 반짝임, 새 눈물자국, 말하는 입, 갑작스러운 미소, 과장된 헐떡임을 만들지 않는다.

영상 길이별 동작 구성
중요 이야기 10초: 0.0~0.4초 자세 유지, 0.4~4.5초 motion phase 1, 4.5~8.8초 연결되는 motion phase 2, 8.8~10.0초 처음 상태로 되돌아가지 않는 자연스러운 감속과 안정.
일반 이야기 5초: 0.0~0.3초 자세 유지, 0.3~4.2초 primary action, 4.2~5.0초 자연스러운 감속과 안정.
모든 영상은 끊김 없는 single continuous shot이며, 첫 프레임을 오래 정지시키거나 처음 위치로 강제 복귀시키지 않는다.

카메라와 배경 규칙
- 5개 영상 모두 locked camera를 사용한다. push-in, lateral drift, pan, zoom, 회전, 흔들림을 사용하지 않는다.
- 카메라는 배경에 고정하고, 강아지가 움직일 때 정적인 배경은 함께 이동하지 않게 한다.
- environment motion은 승인 이미지에 실제로 보이는 꽃잎, 풀끝, 잔물결, 커튼 빛 등 국소 요소 하나만 사용한다.

영어 프롬프트 작성 원칙
1. 강아지의 primary action과 실제 이동량
2. 다리·발·어깨·엉덩이·몸통의 연결된 관절 움직임
3. 귀·털·꼬리·옷의 자연스러운 반응
4. 짧은 얼굴 방향 및 정체성 안정 문장
5. 배경 기준 요소에 대한 실제 위치 변화
6. 고정 카메라와 정적인 배경
7. “Single continuous shot” 또는 “Continuous natural action”으로 마무리

금지 사항
- 승인 이미지에 없는 사람, 동물, 사물, 액세서리, 사건 생성
- 강아지 얼굴·체형·털 무늬·꼬리·목줄·옷 변경, 신체 부위 생성·소실, 다리 교차, 꼬리·다리 복제, 얼굴 변형
- 첫 프레임을 영상 길이 내내 거의 그대로 유지하는 정지 영상
- primary action 없이 blink, 귀 움직임 또는 꼬리 흔들기만 수행하는 영상
- 이미지 전체가 미끄러지는 평면 이동으로 강아지 동작을 대신하는 연출

전체 5개 프롬프트 검수
- gen4_story_prompts 배열이 정확히 5개이고 이야기 1~5가 각각 한 번씩 포함되는가?
- expanded_stories 3개만 duration_seconds가 10이고 나머지 2개만 5인가?
- 하나의 이야기가 여러 take로 나뉘지 않았는가?
- 중요한 이야기의 motion phase 1과 2가 하나의 사건으로 자연스럽게 연결되는가?
- 각 행동이 승인 이미지의 자세와 보이는 신체 구조로 가능한가?
- 걷는 장면에 실제 다리 관절 운동과 배경 기준 위치 변화가 포함되는가?
- 앉거나 누운 장면에 단순 blink가 아닌 실제 몸통 또는 체중 움직임이 있는가?
- 얼굴 방향을 유지하면서 머리가 몸의 움직임을 자연스럽게 따라가는가?
- 고객 사실과 selected_concept가 행동과 환경 반응에 반영되는가?

반환 형식
{
  "gen4_story_prompts": [
    {
      "story_number": 1,
      "expanded_story": true,
      "chapter_role": "expanded | single",
      "title": "",
      "pose_assessment": "standing | walking | sitting | lying",
      "facial_view": "front | three-quarter | side",
      "story_beat": "",
      "primary_dog_action": "",
      "motion_phase_1": "",
      "motion_phase_2": "",
      "articulated_body_motion": "",
      "secondary_motions": [""],
      "environment_motion": "",
      "background_reference_for_position": "",
      "camera_motion": "locked",
      "identity_and_face_safety": "",
      "duration_seconds": 10,
      "prompt": ""
    }
  ]
}

일반 5초 이야기에서는 motion_phase_2를 빈 문자열로 반환한다. gen4_story_prompts 배열은 정확히 5개이며 expanded_stories 3개는 각각 하나의 10초 프롬프트, 나머지 2개는 각각 하나의 5초 프롬프트를 갖는다. JSON 외의 설명을 반환하지 않는다.`;

const WEBSITE_CHARACTER_PROMPT = `WAN MEMORY WEBSITE CHARACTER SPRITE PRODUCTION v1.1

역할
첨부한 order.json과 reference-photos의 고객 원본 사진을 기준으로, 이 강아지의 개인 홈페이지 안을 돌아다니며 말풍선으로 안내하는 투명 배경 캐릭터 프레임을 제작한다.

중요한 사용 정책
- 이 결과는 운영자가 개인 홈페이지에 직접 등록하는 내부 제작 자산이다.
- 고객 확인·수정·승인 단계로 보내지 않는다.
- 그림책 페이지나 영상의 고객 승인 상태와 관계없이 독립적으로 제작할 수 있다.
- 캐릭터는 홈페이지에서 작게 표시되므로 실루엣, 얼굴, 목걸이와 대표 특징이 명확해야 한다.

정체성 기준
- order.json의 character_identity와 reference_photos를 먼저 읽는다.
- 같은 강아지로 인식되도록 얼굴형, 눈 크기와 간격, 귀, 주둥이, 머리와 몸통 비율, 다리 길이, 털색과 미용 형태, 꼬리, 목줄·하네스·펜던트를 유지한다.
- 여러 사진이 충돌하면 order.json의 preferred_identity_photo_ids와 primary 역할 사진을 우선한다.
- 고객 사진에 없는 무늬, 액세서리, 옷, 표정 특징을 추가하지 않는다.

출력 규격
- 정확히 4열 × 3행, 총 12프레임의 단일 PNG 스프라이트 시트.
- 투명 배경 RGBA PNG. 배경, 바닥, 그림자, 테두리, 격자선, 라벨, 글자, 말풍선 없음.
- 투명 배경처럼 보이는 흰색·회색·체커보드 무늬를 그리지 말고 실제 알파 채널을 사용한다.
- 모든 셀의 크기와 캐릭터 기준선, 크기, 여백을 동일하게 유지한다.
- 각 셀을 서로 완전히 독립된 캔버스로 취급한다. 한 셀의 신체, 꼬리, 귀, 발, 털, 그림자, 움직임 선, 색상 잔상은 다른 셀로 절대 넘어가면 안 된다.
- 캐릭터의 모든 불투명 픽셀은 각 셀 중앙의 안전영역 안에 둔다. 셀의 상·하·좌·우 가장자리마다 셀 크기의 최소 8%를 완전 투명 여백으로 확보한다.
- 귀 끝, 꼬리 끝, 발끝과 수채화 번짐까지 안전영역 안에 포함한다. 셀 경계에 닿거나 잘린 털은 실패로 간주한다.
- 캐릭터 실루엣 바깥에는 반투명 회색·분홍·파랑·주황 픽셀이나 이전 배경색의 얇은 띠가 남지 않게 한다.
- 특히 2행의 앉기와 고개 갸웃한 앉기, 3행의 앞발 인사와 엎드려 쉬기는 좌우 셀 조각이 붙기 쉬우므로 귀·등·꼬리 주변을 확대 검수한다.

필수 경계 검수
- 완성 시트를 12개의 동일한 셀로 가상 분리해 각 셀을 단독으로 확인한다.
- 각 셀을 흰색, 검은색, 밝은 자홍색 배경 위에 각각 합성해 사각 조각, 색 테두리, 이웃 프레임 픽셀, 가짜 투명 배경이 보이지 않는지 검사한다.
- 한 픽셀이라도 셀 경계에 닿거나 다른 프레임 조각이 보이면 해당 프레임을 다시 정리한 뒤 최종 이미지를 반환한다.

프레임 순서 — 왼쪽에서 오른쪽
1행: 오른쪽을 향한 걷기 contact / down / passing / up
2행: 오른쪽을 향한 서 있기 / 앉기 / 고개 갸웃한 앉기 / 기쁜 표정과 작은 꼬리 흔들기
3행: 말하기 입 닫힘 / 말하기 입 열림 / 앞발 인사 / 엎드려 쉬기

스타일
- order.json의 website_character_style을 적용한다.
- 완성 그림책과 같은 밝고 맑은 일본 그림책풍 수채화.
- 자연스러운 신체 비율, 섬세한 털, 깨끗한 실루엣. 과장된 치비나 3D 표현 금지.
- 12프레임 모두 동일한 캐릭터 디자인과 액세서리를 유지한다.

납품
- website-character-sprite.png 한 장을 반환한다.
- 이미지와 함께 아래 JSON만 제공한다.
{
  "asset_type": "website_character_sprite",
  "layout": {"columns":4,"rows":3,"frame_count":12},
  "transparent_gutter_percent":8,
  "identity_check":"passed",
  "isolated_frame_preview_check":"passed",
  "black_white_magenta_background_check":"passed",
  "transparent_edge_check":"passed",
  "cross_cell_bleed_check":"passed",
  "customer_review_required":false
}`;
const statusOptions = Object.entries(ORDER_STATUS_LABELS) as Array<
  [OrderStatus, string]
>;
const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  awaiting_materials: ["awaiting_materials", "cancelled"],
  materials_submitted: [
    "materials_submitted",
    "reviewing_materials",
    "cancelled",
  ],
  reviewing_materials: ["reviewing_materials", "cancelled"],
  concepts_ready: ["concepts_ready", "reviewing_materials", "cancelled"],
  concept_selected: [
    "concept_selected",
    "concepts_ready",
    "stills_review",
    "cancelled",
  ],
  stills_review: ["stills_review", "concept_selected", "cancelled"],
  production: ["production", "concept_selected", "cancelled"],
  customer_review: ["customer_review", "production", "cancelled"],
  revision_requested: ["revision_requested", "production", "cancelled"],
  quality_check: [
    "quality_check",
    "production",
    "customer_review",
    "cancelled",
  ],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

function safeExtension(file: File) {
  return (
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "mp4"
  );
}

function safeArchiveSegment(value: string) {
  return (
    value
      .normalize("NFKC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "_")
      .replace(/[-_]{2,}/g, "_")
      .replace(/^[-_.]+|[-_.]+$/g, "")
      .slice(0, 80) || "file"
  );
}

function archivePhotoName(asset: OrderAsset, index: number, role: string) {
  const extension =
    asset.original_filename
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") ||
    (asset.mime_type === "image/jpeg"
      ? "jpg"
      : asset.mime_type
          .split("/")
          .pop()
          ?.replace(/[^a-z0-9]/g, "") || "bin");
  const stem = asset.original_filename.replace(/\.[^.]+$/, "");
  return `${String(index + 1).padStart(2, "0")}_${safeArchiveSegment(role)}_${safeArchiveSegment(stem)}.${extension}`;
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "—";
}

function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}

function peopleHandlingLabel(value: MemoryOrder["people_handling"]) {
  const labels: Record<
    Exclude<MemoryOrder["people_handling"], null>,
    string
  > = {
    not_applicable: "該当なし",
    dog_only_crop: "愛犬だけを切り抜いて使用",
    anonymous_person: "顔が分からない後ろ姿・手元・足元・シルエットで表現",
    original_still: "元の家族写真をAIで動かさず使用",
    consult: "担当者へ相談",
  };
  return value ? labels[value] : "未確認";
}

function photoAnalysisStatusLabel(value: PhotoAnalysisStatus) {
  const labels: Record<PhotoAnalysisStatus, string> = {
    not_started: "未着手",
    ai_analysis_complete: "確認準備済み",
    pending_operator_review: "運営確認待ち",
    approved: "運営承認済み",
    needs_customer_input: "お客様へ追加確認が必要",
  };
  return labels[value];
}

export function AdminStudio() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState<MemoryOrder[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [concepts, setConcepts] = useState<FilmConcept[]>([]);
  const [assets, setAssets] = useState<OrderAsset[]>([]);
  const [memories, setMemories] = useState<OrderMemory[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [conceptA, setConceptA] = useState<ConceptDraft>(emptyConcept);
  const [conceptB, setConceptB] = useState<ConceptDraft>(emptyConcept);
  const [conceptJsonDraft, setConceptJsonDraft] = useState("");
  const [conceptJsonStatus, setConceptJsonStatus] = useState("");
  const [status, setStatus] = useState<OrderStatus>("materials_submitted");
  const [paymentStatus, setPaymentStatus] =
    useState<MemoryOrder["payment_status"]>("pending");
  const [dueDate, setDueDate] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [productionWorkMinutes, setProductionWorkMinutes] = useState(0);
  const [runwayCreditsUsed, setRunwayCreditsUsed] = useState(0);
  const [runwayGenerationCount, setRunwayGenerationCount] = useState(0);
  const [runwayRetryCount, setRunwayRetryCount] = useState(0);
  const [productionLog, setProductionLog] = useState("");
  const [deliveryTitle, setDeliveryTitle] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [videoMode, setVideoMode] = useState<VideoMode>("review");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoChecked, setVideoChecked] = useState(false);
  const [videoInputKey, setVideoInputKey] = useState(0);
  const [customerInputPending, setCustomerInputPending] = useState(false);
  const [stillFiles, setStillFiles] = useState<Record<string, File | null>>(
    {},
  );
  const [stillCaptions, setStillCaptions] = useState<Record<string, string>>(
    {},
  );
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>(
    {},
  );
  const [stillInputKeys, setStillInputKeys] = useState<
    Record<string, number>
  >({});
  const [characterSpriteFile, setCharacterSpriteFile] = useState<File | null>(null);
  const [characterSpriteInputKey, setCharacterSpriteInputKey] = useState(0);
  const [clipInputKey, setClipInputKey] = useState(0);
  const [expandedStoryDraft, setExpandedStoryDraft] = useState<number[]>([]);
  const [bgmTracks, setBgmTracks] = useState<string[]>([]);
  const [renderAvailable, setRenderAvailable] = useState(false);
  const [filmTitle, setFilmTitle] = useState("");
  const [filmKicker, setFilmKicker] = useState("A MOVING STORYBOOK");
  const [filmEndingText, setFilmEndingText] = useState("");
  const [filmEndingMark, setFilmEndingMark] = useState("WAN MEMORY");
  const [filmBgm, setFilmBgm] = useState("");
  const filmLetterbox = false;
  const filmLetterboxPct = 0;
  const filmLook = false;
  // Kept out of the shared `saving` flag so a multi-minute render never freezes
  // the message composer or the status form (same reasoning as exportProgress).
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState("");
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [mfaFactors, setMfaFactors] = useState<
    { id: string; friendly_name?: string; status: string }[]
  >([]);
  const [mfaEnrollment, setMfaEnrollment] = useState<{
    factorId: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingBundle, setExportingBundle] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [deleteConfirmNumber, setDeleteConfirmNumber] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [filter, setFilter] = useState("all");
  const [attentionByOrder, setAttentionByOrder] = useState<
    Record<string, AttentionCount>
  >({});
  const messageComposerRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/admin");
  }, [authLoading, router, user]);

  const loadSecurity = useCallback(async () => {
    if (profile?.role !== "admin") return;
    const supabase = getSupabaseBrowserClient();
    const [eventsResult, factorsResult] = await Promise.all([
      supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.auth.mfa.listFactors(),
    ]);
    setSecurityEvents((eventsResult.data ?? []) as SecurityEvent[]);
    setMfaFactors(factorsResult.data?.totp ?? []);
  }, [profile?.role]);

  // Deferred to a macrotask for the same reason as the order-detail effect
  // below: loading synchronously inside the effect trips the cascading-render rule.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSecurity();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSecurity]);

  const startMfaEnrollment = async () => {
    setSaving(true);
    setError("");
    const { data, error: enrollError } =
      await getSupabaseBrowserClient().auth.mfa.enroll({ factorType: "totp" });
    if (enrollError || !data)
      setError("二段階認証の登録を開始できませんでした。");
    else
      setMfaEnrollment({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
    setSaving(false);
  };

  const confirmMfaEnrollment = async () => {
    if (!mfaEnrollment) return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: mfaEnrollment.factorId });
    if (challengeError || !challenge) {
      setError("認証コードを確認できませんでした。");
      setSaving(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaEnrollment.factorId,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    });
    if (verifyError) {
      setError("認証コードが正しくありません。アプリの表示をご確認ください。");
      setSaving(false);
      return;
    }
    setMfaEnrollment(null);
    setMfaCode("");
    setNotice(
      "二段階認証を有効にしました。次回のログインから認証コードが必要になります。",
    );
    await loadSecurity();
    setSaving(false);
  };

  const removeMfaFactor = async (factorId: string) => {
    if (
      !window.confirm(
        "二段階認証を解除しますか？ 管理画面の保護が弱くなります。",
      )
    )
      return;
    setSaving(true);
    setError("");
    const { error: unenrollError } =
      await getSupabaseBrowserClient().auth.mfa.unenroll({ factorId });
    if (unenrollError) setError("二段階認証を解除できませんでした。");
    else {
      setNotice("二段階認証を解除しました。");
      await loadSecurity();
    }
    setSaving(false);
  };

  // The render endpoint only answers in the operator's local environment; this
  // is also how the UI knows whether to offer assembly at all.
  useEffect(() => {
    if (profile?.role !== "admin") return;
    let cancelled = false;
    fetch("/api/admin/render")
      .then(
        (response) =>
          response.json() as Promise<{
            available?: boolean;
            tracks?: string[];
          }>,
      )
      .then((result) => {
        if (cancelled) return;
        setRenderAvailable(Boolean(result.available));
        setBgmTracks(result.tracks ?? []);
      })
      .catch(() => {
        if (!cancelled) setRenderAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.role]);

  const loadOrders = useCallback(async () => {
    if (!user || profile?.role !== "admin") return;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const [ordersResult, profilesResult, messageResult, revisionResult] =
      await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id,email,full_name,primary_pet_name,role"),
        supabase.from("messages").select("order_id").eq("status", "open"),
        supabase
          .from("revision_requests")
          .select("order_id")
          .eq("status", "open"),
      ]);
    if (ordersResult.error) setError("注文一覧を読み込めませんでした。");
    const loaded = (ordersResult.data ?? []) as MemoryOrder[];
    setOrders(loaded);
    setCustomers((profilesResult.data ?? []) as Profile[]);
    const attention: Record<string, AttentionCount> = {};
    const ensure = (orderId: string) =>
      (attention[orderId] ??= { messages: 0, revisions: 0 });
    for (const item of messageResult.data ?? [])
      ensure(item.order_id).messages += 1;
    for (const item of revisionResult.data ?? [])
      ensure(item.order_id).revisions += 1;
    setAttentionByOrder(attention);
    setSelectedOrderId((current) => current || loaded[0]?.id || "");
    setLoading(false);
  }, [profile?.role, user]);

  const loadDetails = useCallback(async (orderId: string) => {
    if (!orderId) return;
    const supabase = getSupabaseBrowserClient();
    const [
      conceptResult,
      assetResult,
      memoryResult,
      messageResult,
      revisionResult,
    ] = await Promise.all([
      supabase
        .from("concepts")
        .select("*")
        .eq("order_id", orderId)
        .order("slot"),
      supabase
        .from("assets")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_memories")
        .select("*")
        .eq("order_id", orderId)
        .order("sort_order"),
      supabase
        .from("messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at"),
      supabase
        .from("revision_requests")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
    ]);
    const loadedConcepts = (conceptResult.data ?? []) as FilmConcept[];
    const loadedAssets = (assetResult.data ?? []) as OrderAsset[];
    setConcepts(loadedConcepts);
    setAssets(loadedAssets);
    setCaptionDrafts(
      Object.fromEntries(
        loadedAssets
          .filter((asset) => asset.category === "scene_still")
          .map((asset) => [asset.id, asset.story_caption ?? ""]),
      ),
    );
    const loadedMemories = (memoryResult.data ?? []) as OrderMemory[];
    setMemories(loadedMemories);
    setMessages((messageResult.data ?? []) as OrderMessage[]);
    setRevisions((revisionResult.data ?? []) as RevisionRequest[]);
    const toDraft = (concept?: FilmConcept): ConceptDraft =>
      concept
        ? {
            title: concept.title,
            tone: concept.tone,
            summary: concept.summary,
            storyScenes: Object.fromEntries(
              loadedMemories.map((memory, index) => [
                memory.id,
                concept.story_scenes?.find(
                  (scene) => scene.memory_id === memory.id,
                )?.text ?? concept.scenes[index] ?? "",
              ]),
            ),
          }
        : {
            ...emptyConcept,
            storyScenes: Object.fromEntries(
              loadedMemories.map((memory) => [memory.id, ""]),
            ),
          };
    setConceptA(
      toDraft(loadedConcepts.find((concept) => concept.slot === "A")),
    );
    setConceptB(
      toDraft(loadedConcepts.find((concept) => concept.slot === "B")),
    );

    const signable = loadedAssets.filter(
      (asset) =>
        asset.category === "source_image" ||
        asset.category === "character_sprite" ||
        asset.category === "scene_still" ||
        asset.category === "render_clip" ||
        asset.category === "transition_clip" ||
        asset.category === "assembled_film" ||
        asset.category === "review_video" ||
        asset.category === "final_video",
    );
    const signed = await Promise.all(
      signable.map(async (asset) => {
        const { data } = await supabase.storage
          .from("order-assets")
          .createSignedUrl(asset.storage_path, 3600);
        return [asset.id, data?.signedUrl ?? ""] as const;
      }),
    );
    setAssetUrls(Object.fromEntries(signed));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (profile?.role === "admin") loadOrders();
      else if (!authLoading) setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, loadOrders, profile?.role]);

  const order = useMemo(
    () => orders.find((item) => item.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  useEffect(() => {
    if (!order?.id || profile?.role !== "admin") return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(
        `admin-order-messages-${order.id}-${Math.random().toString(36).slice(2)}`,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `order_id=eq.${order.id}`,
        },
        (payload) => {
          const incoming = payload.new as OrderMessage;
          setMessages((current) =>
            current.some((message) => message.id === incoming.id)
              ? current
              : [...current, incoming].sort((a, b) =>
                  a.created_at.localeCompare(b.created_at),
                ),
          );
        },
      )
      .subscribe();
    const refreshTimer = window.setInterval(async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at");
      if (data) setMessages(data as OrderMessage[]);
    }, 20000);
    return () => {
      window.clearInterval(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [order?.id, profile?.role]);

  const productionFields = useMemo(
    () => getProductionFields(order ?? {}),
    [order],
  );
  const customer = useMemo(
    () => customers.find((item) => item.id === order?.user_id),
    [customers, order?.user_id],
  );
  const sourceAssets = useMemo(
    () => assets.filter((asset) => asset.category === "source_image"),
    [assets],
  );
  const characterSprite = useMemo(
    () => assets.find((asset) => asset.category === "character_sprite") ?? null,
    [assets],
  );
  const selectedConcept = useMemo(
    () =>
      concepts.find(
        (concept) => concept.slot === order?.selected_concept_slot,
      ) ?? null,
    [concepts, order?.selected_concept_slot],
  );
  const sourceExportReady = Boolean(
    order &&
      memories.length === 5 &&
      sourceAssets.length >= 5 &&
      productionFields.photoAnalysisStatus === "approved",
  );
  const conceptExportReady = Boolean(
    sourceExportReady &&
      order &&
      !order.selected_concept_slot &&
      ["materials_submitted", "reviewing_materials", "concepts_ready"].includes(
        order.status,
      ),
  );
  const illustrationExportReady = Boolean(
    sourceExportReady &&
      selectedConcept &&
      order?.payment_status === "paid" &&
      !order.stills_approved_at,
  );
  const sceneStills = useMemo(
    () =>
      assets
        .filter((asset) => asset.category === "scene_still")
        .sort(
          (a, b) =>
            a.scene_sort_order - b.scene_sort_order ||
            a.created_at.localeCompare(b.created_at),
        ),
    [assets],
  );
  const allSceneCaptionsReady =
    memories.length === 5 &&
    sceneStills.length === memories.length &&
    sceneStills.every(
      (asset, index) =>
        asset.scene_sort_order === index && Boolean(asset.story_caption?.trim()),
    );
  const expandedStorySortOrders = useMemo(
    () =>
      Array.isArray(order?.expanded_story_sort_orders)
        ? [...order.expanded_story_sort_orders].sort((a, b) => a - b)
        : [],
    [order?.expanded_story_sort_orders],
  );
  const runwayExportReady = Boolean(
    sourceExportReady &&
      selectedConcept &&
      order?.payment_status === "paid" &&
      order?.stills_approved_at &&
      sceneStills.length === 5 &&
      allSceneCaptionsReady &&
      expandedStorySortOrders.length === 3,
  );
  const reviewVideos = useMemo(
    () => assets.filter((asset) => asset.category === "review_video"),
    [assets],
  );
  const finalVideos = useMemo(
    () => assets.filter((asset) => asset.category === "final_video"),
    [assets],
  );
  const renderClips = useMemo(
    () =>
      assets
        .filter((asset) => asset.category === "render_clip")
        .sort(
          (a, b) =>
            a.scene_sort_order - b.scene_sort_order ||
            (a.render_take ?? 1) - (b.render_take ?? 1) ||
            a.created_at.localeCompare(b.created_at),
        ),
    [assets],
  );
  const assembledFilms = useMemo(
    () =>
      assets
        .filter((asset) => asset.category === "assembled_film")
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [assets],
  );
  const clipByStillAndTake = useMemo(
    () =>
      new Map(
        renderClips.map((clip) => [
          `${clip.source_still_asset_id ?? ""}:${clip.render_take ?? 1}`,
          clip,
        ]),
      ),
    [renderClips],
  );
  const requiredRenderSlots = useMemo(
    () => sceneStills.map((still) => ({ still, take: 1 as const })),
    [sceneStills],
  );
  const allRenderClipsReady =
    sceneStills.length === 5 &&
    expandedStorySortOrders.length === 3 &&
    requiredRenderSlots.length === 5 &&
    requiredRenderSlots.every(({ still, take }) =>
      clipByStillAndTake.has(`${still.id}:${take}`),
    );
  const assemblyClipCount = requiredRenderSlots.filter(({ still, take }) =>
    clipByStillAndTake.has(`${still.id}:${take}`),
  ).length;
  const estimatedSeconds = 54;
  const openMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.sender_id === order?.user_id && message.status === "open",
      ),
    [messages, order?.user_id],
  );
  const openRevisions = useMemo(
    () => revisions.filter((revision) => revision.status === "open"),
    [revisions],
  );
  const selectableStatuses = order
    ? statusOptions.filter(([value]) => {
        if (!allowedTransitions[order.status].includes(value)) return false;
        if (
          value !== order.status &&
          [
            "stills_review",
            "production",
            "customer_review",
            "revision_requested",
            "quality_check",
          ].includes(value) &&
          order.payment_status !== "paid"
        )
          return false;
        if (
          value !== order.status &&
          [
            "concepts_ready",
            "concept_selected",
            "stills_review",
            "production",
            "customer_review",
            "revision_requested",
            "quality_check",
          ].includes(value) &&
          productionFields.photoAnalysisStatus !== "approved"
        )
          return false;
        return true;
      })
    : statusOptions;
  const consentCurrent = Boolean(order && hasCurrentConsent(order));
  const photoAnalysisApproved =
    productionFields.photoAnalysisStatus === "approved";
  const canManageStorySources = Boolean(
    order &&
      ["materials_submitted", "reviewing_materials"].includes(order.status) &&
      !photoAnalysisApproved,
  );
  const conceptPublishingStatusValid = Boolean(
    order &&
      ["materials_submitted", "reviewing_materials", "concepts_ready"].includes(
        order.status,
      ),
  );
  const canRequestPayment = Boolean(
    order &&
      order.status === "concept_selected" &&
      order.selected_concept_slot &&
      consentCurrent &&
      order.payment_status !== "paid" &&
      order.payment_status !== "refunded",
  );
  const canPrepareStills = Boolean(
    order &&
      photoAnalysisApproved &&
      order.payment_status === "paid" &&
      consentCurrent &&
      order.status === "concept_selected",
  );
  const canUploadReview = Boolean(
    order &&
      photoAnalysisApproved &&
      order.payment_status === "paid" &&
      consentCurrent &&
      ["production", "revision_requested", "customer_review"].includes(
        order.status,
      ),
  );
  const canUploadFinal = Boolean(
    order &&
      photoAnalysisApproved &&
      order.status === "quality_check" &&
      order.payment_status === "paid" &&
      consentCurrent &&
      order.customer_approved_at &&
      order.customer_approved_review_asset_id &&
      openRevisions.length === 0,
  );
  const canRenderFilm = Boolean(
    order &&
      photoAnalysisApproved &&
      order.payment_status === "paid" &&
      consentCurrent &&
      order.stills_approved_at &&
      ["production", "revision_requested"].includes(order.status),
  );

  useEffect(() => {
    if (!order) return;
    const timer = window.setTimeout(() => {
      setStatus(order.status);
      setPaymentStatus(order.payment_status);
      setDueDate(order.due_date ?? "");
      setAdminNotes(order.admin_notes ?? "");
      setProductionWorkMinutes(order.production_work_minutes ?? 0);
      setRunwayCreditsUsed(order.runway_credits_used ?? 0);
      setRunwayGenerationCount(order.runway_generation_count ?? 0);
      setRunwayRetryCount(order.runway_retry_count ?? 0);
      setProductionLog(order.production_log ?? "");
      setDeliveryTitle(`${order.pet_name}の動く絵本`);
      setDeliveryMessage(
        `${order.pet_name}ちゃんとの大切な時間を、一冊のような動く物語に仕上げました。`,
      );
      setVideoMode("review");
      setVideoFile(null);
      setVideoChecked(false);
      setVideoInputKey((current) => current + 1);
      setStillFiles({});
      setStillCaptions({});
      setStillInputKeys({});
      setClipInputKey((current) => current + 1);
      setExpandedStoryDraft(
        Array.isArray(order.expanded_story_sort_orders)
          ? [...order.expanded_story_sort_orders].sort((a, b) => a - b)
          : [],
      );
      setFilmTitle(`${order.pet_name}の、小さなものがたり`);
      // The customer's own words to their dog are the right starting point for
      // the ending card; the operator edits from there.
      setFilmEndingText(order.message_to_pet ?? "");
      setFilmBgm("");
      setRenderProgress("");
      setCustomerInputPending(false);
      loadDetails(order.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDetails, order]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (messageListRef.current)
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, selectedOrderId]);

  const hasAttention = (orderId: string) => {
    const count = attentionByOrder[orderId];
    return Boolean(count && count.messages + count.revisions > 0);
  };
  const visibleOrders =
    filter === "all"
      ? orders
      : filter === "attention"
        ? orders.filter((item) => hasAttention(item.id))
        : orders.filter((item) => item.status === filter);
  const totalAttention = Object.values(attentionByOrder).reduce(
    (total, count) => total + count.messages + count.revisions,
    0,
  );

  const selectOrder = (orderId: string) => {
    if (orderId !== selectedOrderId) {
      setMessageDraft("");
      setConceptJsonDraft("");
      setConceptJsonStatus("");
      setCancelReason("");
      setDeleteConfirmNumber("");
    }
    setSelectedOrderId(orderId);
  };

  const changeFilter = (nextFilter: string) => {
    setFilter(nextFilter);
    const nextOrders =
      nextFilter === "all"
        ? orders
        : nextFilter === "attention"
          ? orders.filter((item) => hasAttention(item.id))
          : orders.filter((item) => item.status === nextFilter);
    if (
      nextOrders.length &&
      !nextOrders.some((item) => item.id === selectedOrderId)
    )
      selectOrder(nextOrders[0].id);
    if (!nextOrders.length) selectOrder("");
  };

  const saveOrder = async () => {
    if (!order) return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const requestingPayment =
      order.payment_status !== "invoice_sent" &&
      paymentStatus === "invoice_sent";
    if (requestingPayment && !APPLICATIONS_OPEN) {
      setError("現在、お支払い受付は準備中のため案内を送信できません。");
      setSaving(false);
      return;
    }
    const { error: updateError } = await supabase.rpc("admin_update_order", {
      p_order_id: order.id,
      p_status: status,
      p_payment_status: paymentStatus,
      p_due_date: dueDate || null,
      p_admin_notes: adminNotes || null,
    });
    if (updateError) {
      setError(
        `進行状況を保存できませんでした。${
          updateError.message.includes("invalid order status transition")
            ? "許可されていない工程への移動です。"
            : updateError.message.includes(
                  "concept selection and current consent",
                )
              ? "構成案の選択と現在版の同意記録を確認してから、お支払いをご案内してください。"
              : updateError.message.includes("managed by Stripe")
                ? "入金・返金状態は決済結果から自動で反映されます。"
                : ""
        }`,
      );
    } else {
      let paymentEmailSent = false;
      if (requestingPayment) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (accessToken) {
          const response = await fetch("/api/admin/payment-request", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ orderId: order.id }),
          });
          const result = (await response.json().catch(() => ({}))) as {
            sent?: boolean;
          };
          paymentEmailSent = response.ok && result.sent === true;
        }
      }
      setNotice(
        requestingPayment
          ? paymentEmailSent
            ? "制作室へお支払いボタンを表示し、案内メールを送りました。"
            : "制作室へお支払いボタンを表示しました。メール通知は送信できなかったため、メッセージでもお知らせください。"
          : "進行状況を保存し、履歴へ記録しました。",
      );
      await loadOrders();
    }
    setSaving(false);
  };

  const saveProductionMetrics = async () => {
    if (!order) return;
    setSaving(true);
    setError("");
    const { error: metricsError } = await getSupabaseBrowserClient().rpc(
      "admin_save_production_metrics",
      {
        p_order_id: order.id,
        p_work_minutes: Math.max(0, Math.trunc(productionWorkMinutes || 0)),
        p_runway_credits: Math.max(0, Math.trunc(runwayCreditsUsed || 0)),
        p_generation_count: Math.max(0, Math.trunc(runwayGenerationCount || 0)),
        p_retry_count: Math.max(0, Math.trunc(runwayRetryCount || 0)),
        p_notes: productionLog.trim() || null,
      },
    );
    if (metricsError)
      setError("制作メモを保存できませんでした。入力内容をご確認ください。");
    else {
      setNotice(
        "制作時間・Runway使用量を記録しました。初期10組の原価検証に利用できます。",
      );
      await loadOrders();
    }
    setSaving(false);
  };

  const importConceptJson = (rawJson = conceptJsonDraft) => {
    if (!rawJson.trim()) {
      setError("構成案JSONを貼り付けてください。");
      return;
    }
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      const next = parseConceptJson(parsed, memories);
      setConceptA(next.a);
      setConceptB(next.b);
      setConceptJsonStatus("A・B案を5つの物語へ自動マッチしました。まだお客様には公開されていません。");
      setError("");
      setNotice("構成案JSONをフォームへ反映しました。内容を確認してから最後に公開してください。");
    } catch (caught) {
      setConceptJsonStatus("");
      setError(caught instanceof Error ? caught.message : "構成案JSONを読み込めませんでした。");
    }
  };

  const handleConceptJsonFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const rawJson = await file.text();
      setConceptJsonDraft(rawJson);
      importConceptJson(rawJson);
    } catch {
      setError("構成案JSONファイルを読み込めませんでした。");
    }
  };

  const notifyCustomerByMessage = async (orderId: string, body: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { saved: false, notificationSent: false };
    const response = await fetch("/api/admin/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ orderId, body }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as {
          saved?: boolean;
          notificationSent?: boolean;
        } | null)
      : null;
    return {
      saved: Boolean(response?.ok && result?.saved),
      notificationSent: Boolean(result?.notificationSent),
    };
  };

  const saveConcepts = async () => {
    if (!photoAnalysisApproved) {
      setError(
        "사진 분석에 대한 운영자 승인이 필요합니다. 승인 후 다음 제작 단계로 진행할 수 있습니다.",
      );
      return;
    }
    if (
      !order ||
      !conceptA.title.trim() ||
      !conceptA.summary.trim() ||
      !conceptB.title.trim() ||
      !conceptB.summary.trim()
    ) {
      setError("物語案A・Bのタイトルと概要を入力してください。");
      return;
    }
    if (
      memories.length !== 5 ||
      [conceptA, conceptB].some((concept) =>
        memories.some((memory) => !concept.storyScenes[memory.id]?.trim()),
      )
    ) {
      setError(
        "構成案A・Bそれぞれに、5つすべての物語の場面を入力してください。",
      );
      return;
    }
    if (!conceptPublishingStatusValid) {
      setError(
        `現在の工程「${ORDER_STATUS_LABELS[order.status]}」では物語案を公開できません。注文の進行状況をご確認ください。`,
      );
      return;
    }
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    if (order.status === "materials_submitted") {
      const { error: reviewStartError } = await supabase.rpc(
        "admin_update_order",
        {
          p_order_id: order.id,
          p_status: "reviewing_materials",
          p_payment_status: order.payment_status,
          p_due_date: order.due_date,
          p_admin_notes: order.admin_notes,
        },
      );
      if (reviewStartError) {
        setError(
          "写真とお話の確認工程を開始できませんでした。画面を更新して、もう一度お試しください。",
        );
        setSaving(false);
        return;
      }
    }
    const conceptsPayload = (
      [
        ["A", conceptA],
        ["B", conceptB],
      ] as const
    ).map(([slot, value]) => ({
      slot,
      title: value.title.trim(),
      tone: value.tone.trim(),
      summary: value.summary.trim(),
      story_scenes: memories.map((memory) => ({
        memory_id: memory.id,
        text: value.storyScenes[memory.id].trim(),
      })),
    }));
    const { error: conceptError } = await supabase.rpc(
      "admin_publish_concepts",
      { p_order_id: order.id, p_concepts: conceptsPayload },
    );
    if (conceptError)
      setError(
        conceptError.message.includes("current status")
          ? "注文の状態が別の画面で変更されました。画面を更新して、現在の工程をご確認ください。"
          : "2案を公開できませんでした。入力内容と現在の制作工程をご確認ください。",
      );
    else {
      const notification = await notifyCustomerByMessage(
        order.id,
        "物語案A・Bを公開しました。制作室で2案をご確認のうえ、進めたい案を1つ選択してください。",
      );
      setNotice(
        notification.saved
          ? notification.notificationSent
            ? "2つの物語案を公開し、お客様へメッセージとメールでお知らせしました。"
            : "2つの物語案を公開し、チャットへお知らせしました。メール通知は送れませんでした。"
          : "2つの物語案は公開しましたが、お客様へのチャット通知に失敗しました。手動でメッセージを送ってください。",
      );
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const buildProductionExport = () => {
    if (!order) return null;
    const orderedSourceAssets = [...sourceAssets].sort((a, b) => {
      const aMemory = memories.find((item) => item.id === a.memory_id);
      const bMemory = memories.find((item) => item.id === b.memory_id);
      return (
        (aMemory?.sort_order ?? 99) - (bMemory?.sort_order ?? 99) ||
        (a.memory_photo_sort_order ?? 99) -
          (b.memory_photo_sort_order ?? 99) ||
        a.album_sort_order - b.album_sort_order
      );
    });
    const archivePhotos = orderedSourceAssets.map((asset, index) => {
      const memory =
        memories.find((item) => item.id === asset.memory_id) ?? null;
      const photoPosition = asset.memory_photo_sort_order ?? 1;
      const roles = memory
        ? [
            "story_scene",
            photoPosition === 1 ? "primary_scene_source" : "supporting_reference",
          ]
        : ["additional_photo"];
      const archiveRole = memory
        ? `story_${String(memory.sort_order).padStart(2, "0")}_${
            photoPosition === 1 ? "primary" : `support_${photoPosition - 1}`
          }`
        : roles[0];
      const archiveFilename = archivePhotoName(asset, index, archiveRole);
      const storyFolder = memory
        ? `stories/${String(memory.sort_order).padStart(2, "0")}-${safeArchiveSegment(memory.title)}`
        : "additional";
      return {
        asset,
        archiveFilename,
        archivePath: `${storyFolder}/original/${archiveFilename}`,
        roles,
        memory,
        photoPosition,
      };
    });
    const sourcePhotos = archivePhotos.map(
      ({
        asset,
        archiveFilename,
        archivePath,
        roles,
        memory,
        photoPosition,
      }) => ({
        asset_id: asset.id,
        archive_filename: archiveFilename,
        archive_path: archivePath,
        original_filename: asset.original_filename,
        mime_type: asset.mime_type,
        file_size: asset.file_size,
        roles,
        story_photo_position: memory ? photoPosition : null,
        is_primary_scene_source: Boolean(memory && photoPosition === 1),
        memory: memory
          ? {
              number: memory.sort_order,
              title: memory.title,
            }
          : null,
      }),
    );
    const selectedStoryText = new Map(
      (selectedConcept?.story_scenes ?? []).map((scene) => [
        scene.memory_id,
        scene.text,
      ]),
    );
    const stories = memories.map((memory) => {
      const storyNumber = String(memory.sort_order).padStart(2, "0");
      const storyId = `story_${storyNumber}`;
      const storyPhotoDetails = sourcePhotos
        .filter((photo) => photo.memory?.number === memory.sort_order)
        .sort(
          (a, b) =>
            (a.story_photo_position ?? 99) -
            (b.story_photo_position ?? 99),
        )
        .map((photo) => ({
          asset_id: photo.asset_id,
          filename: photo.archive_filename,
          original_filename: photo.original_filename,
          role: photo.is_primary_scene_source
            ? "primary_scene_source"
            : "supporting_reference",
          position: photo.story_photo_position,
          archive_path: photo.archive_path,
        }));
      const expandedMotion = expandedStorySortOrders.includes(
        memory.sort_order - 1,
      );
      return {
        id: storyId,
        number: memory.sort_order,
        title: memory.title,
        caption:
          selectedStoryText.get(memory.id)?.trim() || memory.description,
        selected_concept_scene_text:
          selectedStoryText.get(memory.id)?.trim() || memory.description,
        when: memory.when_text,
        location: memory.location,
        description: memory.description,
        dog_behavior: memory.dog_behavior,
        photos: storyPhotoDetails.map((photo) => photo.filename),
        photo_details: storyPhotoDetails,
        main_motif: null,
        main_motif_instruction:
          "Derive one visual motif from this story without adding customer facts.",
        expanded_motion: expandedMotion,
        runway_clip_count: 1,
        output: {
          page_image_filename: `${storyId}.png`,
          runway_clip_filenames: [`${storyId}.mp4`],
          runway_model: "gen4",
          runway_duration_seconds: expandedMotion ? 10 : 5,
        },
      };
    });
    const transitions: never[] = [];
    const productionData = {
      schema_version: "wan-memory-storybook-production-export-3.0",
      exported_at: new Date().toISOString(),
      job: {
        id: order.order_number,
        pet_name: order.pet_name,
        name_kana: order.name_kana,
        breed: order.breed,
        age_text: order.age_text,
        purpose: order.purpose,
        workflow_stage:
          productionFields.photoAnalysisStatus === "approved"
            ? "story_sources_approved"
            : "story_sources_review",
      },
      style: {
        ...STORYBOOK_STYLE_PROFILE,
        customer_requested_style: order.style,
      },
      production_protocol: MEMORY_STORYBOOK_PRODUCTION_PROTOCOL,
      stories,
      transition_rules: {
        count: 0,
        page_turn_mode: "direct_curved_page_turn_between_story_clips",
        bridge_backgrounds_allowed: false,
        page_turn_duration_seconds: 0.95,
        text_is_added_after_video: true,
      },
      transitions,
      output_plan: {
        story_count: stories.length,
        expanded_story_count: expandedStorySortOrders.length,
        expanded_story_sort_orders: expandedStorySortOrders,
        runway_clip_count: stories.length,
        story_model: "gen4",
        story_duration_seconds: 5,
        expanded_story_duration_seconds: 10,
        total_story_video_seconds:
          stories.filter((story) => story.expanded_motion).length * 10 +
          stories.filter((story) => !story.expanded_motion).length * 5,
        story_duration_policy:
          "expanded_stories=10s single continuous clip; other_stories=5s single continuous clip",
        transition_count: 0,
        transition_video_count: 0,
        title_card_seconds: 3,
        ending_card_seconds: 7,
      },
      production_ref: order.order_number,
      workflow_stage:
        productionFields.photoAnalysisStatus === "approved"
          ? "story_sources_approved"
          : "story_sources_review",
      privacy_notice:
        "Account email, phone number, postal address, and customer profile name are not included. Customer-written story text may still contain personal information and must be handled only for this order.",
      story_source_rules: {
        story_count: memories.length,
        photos_per_story: "1-3",
        primary_source_rule:
          "The first photo in every story is the required composition and identity anchor for that story only.",
        supporting_source_rule:
          "Photos 2-3 are optional supporting references. Do not combine details that conflict with the primary source.",
        global_appearance_reference: false,
        operator_approved_at: productionFields.photoAnalysisApprovedAt,
      },
      source_photos: sourcePhotos,
      selected_concept: selectedConcept
        ? {
            slot: selectedConcept.slot,
            title: selectedConcept.title,
            tone: selectedConcept.tone,
            summary: selectedConcept.summary,
            scenes: selectedConcept.scenes,
            story_scenes: selectedConcept.story_scenes,
          }
        : null,
      memories: memories.map((memory) => ({
        number: memory.sort_order,
        title: memory.title,
        when: memory.when_text,
        location: memory.location,
        description: memory.description,
        dog_behavior: memory.dog_behavior,
        photos: sourcePhotos
          .filter((photo) => photo.memory?.number === memory.sort_order)
          .sort(
            (a, b) =>
              (a.story_photo_position ?? 99) -
              (b.story_photo_position ?? 99),
          )
          .map((photo) => ({
            asset_id: photo.asset_id,
            role: photo.is_primary_scene_source
              ? "primary_scene_source"
              : "supporting_reference",
            position: photo.story_photo_position,
            archive_path: photo.archive_path,
            original_filename: photo.original_filename,
          })),
      })),
      message_to_pet: order.message_to_pet,
      avoid_notes: order.avoid_notes,
      people_policy: {
        face_usage_policy: "faces_never_generated_or_used_back_views_only",
        contains_people: order.contains_people,
        people_handling: order.people_handling,
        contains_minors: order.contains_minors,
        external_ai_processing_allowed: Boolean(order.external_ai_consent_at),
      },
      additional_customer_requests: messages
        .filter((message) => message.sender_id === order.user_id)
        .map((message) => message.body),
      requested_gpt_output: {
        current_stage:
          "Read job, style, production_protocol, and stories first. Lock each story's primary dog identity to the original-aspect-ratio customer photos and create five new 16:9 storybook page images. Do not create bridge backgrounds or transition videos; the editor turns directly from one approved story page to the next.",
        required_sections: [
          "memory_storybook_production_checklist",
          "story_source_checklist",
          "story_page_image_plan",
          "gen4_scene_prompts",
          "missing_information_only_if_blocking",
          "people_photo_assessment",
        ],
      },
    };
    const manifest = {
      schema_version: "wan-memory-story-source-manifest-3.0",
      production_ref: order.order_number,
      story_count: memories.length,
      transition_count: 0,
      photo_count: sourcePhotos.length,
      stories: stories.map((story) => ({
        id: story.id,
        title: story.title,
        photos: story.photos,
      })),
      transitions: [],
      selected_concept: selectedConcept
        ? {
            slot: selectedConcept.slot,
            title: selectedConcept.title,
            tone: selectedConcept.tone,
            summary: selectedConcept.summary,
            story_scenes: selectedConcept.story_scenes,
          }
        : null,
      photos: sourcePhotos,
    };
    return { productionData, manifest, archivePhotos };
  };

  const saveOperatorZip = async (
    files: Record<string, Uint8Array>,
    filename: string,
  ) => {
    const { zip } = await import("fflate");
    const archive = await new Promise<Uint8Array>((resolve, reject) => {
      zip(files, { level: 0 }, (zipError, result) => {
        if (zipError) reject(zipError);
        else resolve(result);
      });
    });
    const archiveBuffer = archive.buffer.slice(
      archive.byteOffset,
      archive.byteOffset + archive.byteLength,
    ) as ArrayBuffer;
    const archiveUrl = URL.createObjectURL(
      new Blob([archiveBuffer], { type: "application/zip" }),
    );
    const link = document.createElement("a");
    link.href = archiveUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(archiveUrl), 1000);
  };

  const downloadSourceBundle = async (
    stage: "concept" | "illustration",
  ) => {
    const exportData = buildProductionExport();
    if (!order || !exportData || sourceAssets.length === 0) return;
    const ready = stage === "concept" ? conceptExportReady : illustrationExportReady;
    if (!ready) {
      setError(
        stage === "concept"
          ? "写真確認を完了し、お客様が物語案を選ぶ前の工程でダウンロードしてください。"
          : "お客様の物語案選択とお支払いを確認してからダウンロードしてください。",
      );
      return;
    }
    setExportingBundle(true);
    setExportProgress(`写真を準備しています（0/${sourceAssets.length}）`);
    setError("");
    try {
      const [{ strToU8 }, supabase] = await Promise.all([
        import("fflate"),
        Promise.resolve(getSupabaseBrowserClient()),
      ]);
      const suffix = stage === "concept" ? "01-concept-proposal" : "02-storybook-images";
      const root = `${safeArchiveSegment(order.order_number)}-${suffix}`;
      const prompt =
        stage === "concept" ? CONCEPT_PROPOSAL_PROMPT : STORYBOOK_IMAGE_PROMPT;
      const startHere =
        stage === "concept"
          ? [
              "STEP 1 · A/B物語案を作るデータです。",
              "1. order.jsonとstoriesフォルダを確認します。",
              "2. このZIPと02_PROMPT_CONCEPT_PROPOSAL.txtをCodexへ添付します。",
              "3. 返されたA/B案のタイトル・トーン・概要・5場面を管理画面へ入力します。",
              "4. この段階では画像やRunwayプロンプトを作りません。",
            ].join("\n")
          : [
              "STEP 2 · 顧客確認用の絵本ページを作るデータです。",
              "1. order.jsonのselected_conceptを確認します。",
              "2. Codexへorder.json、style_reference.png（画風基準画像・別途用意）、対象のstoryフォルダを添付し、01から05まで順番に制作します。",
              "3. 02_PROMPT_STORYBOOK_IMAGES.txtをそのまま依頼文として使います。",
              "4. 完成した5枚を管理画面へアップロードし、顧客確認へ公開します。",
              "5. この段階ではRunwayプロンプトを作りません。",
            ].join("\n");
      const orderJson =
        stage === "concept"
          ? {
              schema_version: "wan-memory-concept-proposal-input-1.0",
              exported_at: new Date().toISOString(),
              job: exportData.productionData.job,
              style: exportData.productionData.style,
              stories: exportData.productionData.stories,
              memories: exportData.productionData.memories,
              source_photos: exportData.productionData.source_photos,
              people_policy: exportData.productionData.people_policy,
              additional_customer_requests:
                exportData.productionData.additional_customer_requests,
              requested_output: "concept_a_and_b_for_admin_form",
            }
          : exportData.productionData;
      const files: Record<string, Uint8Array> = {
        [`${root}/01_START_HERE.txt`]: strToU8(startHere),
        [`${root}/02_PROMPT_${stage === "concept" ? "CONCEPT_PROPOSAL" : "STORYBOOK_IMAGES"}.txt`]:
          strToU8(prompt),
        [`${root}/order.json`]: strToU8(
          JSON.stringify(orderJson, null, 2),
        ),
        [`${root}/photo-manifest.json`]: strToU8(
          JSON.stringify(exportData.manifest, null, 2),
        ),
      };
      for (let index = 0; index < exportData.archivePhotos.length; index += 1) {
        const item = exportData.archivePhotos[index];
        setExportProgress(
          `写真を準備しています（${index + 1}/${sourceAssets.length}）`,
        );
        const { data, error: downloadError } = await supabase.storage
          .from("order-assets")
          .download(item.asset.storage_path);
        if (downloadError || !data)
          throw new Error(`${item.asset.original_filename} download failed`, {
            cause: downloadError,
          });
        files[`${root}/${item.archivePath}`] = new Uint8Array(
          await data.arrayBuffer(),
        );
      }
      setExportProgress("ZIPファイルを作成しています…");
      await saveOperatorZip(files, `${root}.zip`);
      setNotice(
        stage === "concept"
          ? "A/B物語案作成用のJSON・写真・依頼文をまとめました。"
          : "絵本ページ画像制作用の選択案・JSON・写真・依頼文をまとめました。",
      );
    } catch (bundleError) {
      console.error(bundleError);
      setError(
        "元写真の取得を完了できませんでした。通信状態を確認して、もう一度お試しください。",
      );
    } finally {
      setExportProgress("");
      setExportingBundle(false);
    }
  };

  const downloadCharacterBundle = async () => {
    const exportData = buildProductionExport();
    if (!order || !exportData || sourceAssets.length === 0) {
      setError("キャラクター制作には、注文情報と元写真が1枚以上必要です。");
      return;
    }
    setExportingBundle(true);
    setExportProgress(`キャラクター用写真を準備しています（0/${sourceAssets.length}）`);
    setError("");
    try {
      const [{ strToU8 }, supabase] = await Promise.all([
        import("fflate"),
        Promise.resolve(getSupabaseBrowserClient()),
      ]);
      const root = `${safeArchiveSegment(order.order_number)}-website-character`;
      const characterJson = {
        schema_version: "wan-memory-website-character-input-1.1",
        exported_at: new Date().toISOString(),
        job: {
          id: order.order_number,
          pet_name: order.pet_name,
          breed: order.breed,
          age_text: order.age_text,
          personality: order.personality,
        },
        website_character_style: {
          medium: "luminous Japanese picture-book watercolor",
          proportions: "natural dog proportions; readable at small website size",
          background: "transparent RGBA",
          layout: { columns: 4, rows: 3, frame_count: 12 },
          frame_safety: {
            transparent_gutter_percent: 8,
            keep_all_opaque_pixels_inside_safe_area: true,
            forbid_cross_cell_bleed: true,
            forbid_colored_edge_halo: true,
            forbid_fake_transparency_pattern: true,
          },
        },
        character_identity: {
          selected_appearance_description: productionFields.selectedAppearanceDescription,
          owner_locked_traits: productionFields.ownerLockedTraits,
          preferred_identity_photo_ids: productionFields.selectedAppearancePhotoIds,
          primary_face_photo_id: productionFields.primaryFacePhotoId,
          primary_body_photo_id: productionFields.primaryBodyPhotoId,
          side_tail_photo_id: productionFields.sideTailPhotoId,
        },
        reference_photos: exportData.productionData.source_photos.map((photo) => ({
          asset_id: photo.asset_id,
          filename: photo.archive_filename,
          archive_path: `reference-photos/${photo.archive_filename}`,
          roles: photo.roles,
        })),
        requested_output: {
          asset_type: "website_character_sprite",
          filename: "website-character-sprite.png",
          customer_review_required: false,
          admin_only: true,
          apply_to_private_website_automatically: true,
          required_checks: [
            "isolated_frame_preview",
            "black_background",
            "white_background",
            "magenta_background",
            "transparent_edge",
            "cross_cell_bleed",
          ],
        },
      };
      const files: Record<string, Uint8Array> = {
        [`${root}/01_START_HERE.txt`]: strToU8([
          "OPTIONAL · いつでも作れるホームページキャラクターです。",
          "1. order.jsonとreference-photosをCodexへ添付します。",
          "2. 02_PROMPT_WEBSITE_CHARACTER.txtをそのまま依頼文として使います。",
          "3. 返された4×3の透明PNGスプライトを管理画面へ登録します。",
          "4. 顧客確認には出さず、専用ホームページへ自動で反映されます。",
        ].join("\n")),
        [`${root}/02_PROMPT_WEBSITE_CHARACTER.txt`]: strToU8(WEBSITE_CHARACTER_PROMPT),
        [`${root}/order.json`]: strToU8(JSON.stringify(characterJson, null, 2)),
      };
      for (let index = 0; index < exportData.archivePhotos.length; index += 1) {
        const item = exportData.archivePhotos[index];
        setExportProgress(`キャラクター用写真を準備しています（${index + 1}/${sourceAssets.length}）`);
        const { data, error: downloadError } = await supabase.storage
          .from("order-assets")
          .download(item.asset.storage_path);
        if (downloadError || !data) throw downloadError ?? new Error("download failed");
        files[`${root}/reference-photos/${item.archiveFilename}`] = new Uint8Array(await data.arrayBuffer());
      }
      setExportProgress("キャラクター制作ZIPを作成しています…");
      await saveOperatorZip(files, `${root}.zip`);
      setNotice("ホームページキャラクター用のJSON・写真・専用プロンプトをまとめました。");
    } catch (bundleError) {
      console.error(bundleError);
      setError("キャラクター制作データを準備できませんでした。もう一度お試しください。");
    } finally {
      setExportProgress("");
      setExportingBundle(false);
    }
  };

  const uploadCharacterSprite = async () => {
    if (!order || !characterSpriteFile) return;
    if (!["image/png", "image/webp"].includes(characterSpriteFile.type)) {
      setError("キャラクター画像は透明PNGまたはWebPを選択してください。");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const extension = characterSpriteFile.type === "image/webp" ? "webp" : "png";
    const path = `admin/${order.id}/character/website-character-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("order-assets")
      .upload(path, characterSpriteFile, { contentType: characterSpriteFile.type, upsert: false });
    if (uploadError) {
      setError("キャラクタースプライトをアップロードできませんでした。");
      setSaving(false);
      return;
    }
    const { data, error: registerError } = await supabase.rpc("admin_register_character_sprite", {
      p_order_id: order.id,
      p_storage_path: path,
      p_original_filename: characterSpriteFile.name,
      p_mime_type: characterSpriteFile.type,
      p_file_size: characterSpriteFile.size,
    });
    if (registerError || !data) {
      await supabase.storage.from("order-assets").remove([path]);
      setError("キャラクタースプライトを登録できませんでした。");
      setSaving(false);
      return;
    }
    const replacedPath = (data as { replaced_storage_path?: string | null }).replaced_storage_path;
    if (replacedPath) await supabase.storage.from("order-assets").remove([replacedPath]);
    setCharacterSpriteFile(null);
    setCharacterSpriteInputKey((current) => current + 1);
    setNotice("キャラクターを登録しました。顧客確認を行わず、専用ホームページへ自動反映されます。");
    await loadDetails(order.id);
    setSaving(false);
  };

  const deleteCharacterSprite = async () => {
    if (!characterSprite || !order || !window.confirm("登録中のホームページキャラクターを削除しますか？")) return;
    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const { data: storagePath, error: deleteError } = await supabase.rpc("admin_delete_character_sprite", { p_asset_id: characterSprite.id });
    if (deleteError) setError("キャラクターを削除できませんでした。");
    else {
      if (storagePath) await supabase.storage.from("order-assets").remove([storagePath as string]);
      setNotice("ホームページキャラクターを削除しました。");
      await loadDetails(order.id);
    }
    setSaving(false);
  };

  const downloadRunwayBundle = async () => {
    const exportData = buildProductionExport();
    if (!order || !exportData || !runwayExportReady) {
      setError(
        "絵本ページの承認後、重要な物語を3つ選んで保存するとダウンロードできます。",
      );
      return;
    }
    setExportingBundle(true);
    setExportProgress(`承認画像を準備しています（0/${sceneStills.length}）`);
    setError("");
    try {
      const [{ strToU8 }, supabase] = await Promise.all([
        import("fflate"),
        Promise.resolve(getSupabaseBrowserClient()),
      ]);
      const root = `${safeArchiveSegment(order.order_number)}-03-runway-prompts`;
      const runwayData = {
        schema_version: "wan-memory-runway-prompt-input-3.2",
        exported_at: new Date().toISOString(),
        job: exportData.productionData.job,
        style: exportData.productionData.style,
        production_protocol: exportData.productionData.production_protocol,
        selected_concept: exportData.productionData.selected_concept,
        stories: exportData.productionData.stories,
        transition_rules: exportData.productionData.transition_rules,
        transitions: exportData.productionData.transitions,
        expanded_story_sort_orders: expandedStorySortOrders,
        expanded_stories: sceneStills
          .filter((still) =>
            expandedStorySortOrders.includes(still.scene_sort_order),
          )
          .map((still) => ({
            story_number: still.scene_sort_order + 1,
            title: still.scene_title,
            expanded_story: true,
            chapter_role: "expanded",
            clip_count: 1,
            duration_seconds: 10,
          })),
        output_plan: {
          story_count: 5,
          runway_clip_count: 5,
          expanded_story_count: 3,
          story_model: "gen4",
          story_duration_seconds: 5,
          expanded_story_duration_seconds: 10,
          total_story_video_seconds: 40,
          story_duration_policy:
            "expanded_stories=10s single continuous clip; other_stories=5s single continuous clip",
          transition_video_count: 0,
          transition_page_count: 0,
          final_editing:
            "Use one continuous clip per story. Do not split stories into takes. Use a direct curved page turn only between different stories. Do not create or insert bridge backgrounds or bridge videos.",
        },
        approved_at: order.stills_approved_at,
      };
      const files: Record<string, Uint8Array> = {
        [`${root}/01_START_HERE.txt`]: strToU8(
          [
            "STEP 3 · 顧客承認後のRunway制作データです。",
            "1. order.jsonとapproved-pagesの5枚をCodexへ添付します。",
            "2. 02_PROMPT_RUNWAY.txtをそのまま依頼文として使います。",
            "3. CodexがStory用Runwayプロンプトを合計5本作ります。重要な3物語は各10秒、残り2物語は各5秒です。接続背景や接続映像は作りません。",
            "4. 重要な物語も複数takeに分けず、1本の10秒動画の中で始まりから自然なまとまりまで続く一つの行動として設計します。",
            "5. Story 5本をGen-4で、重要な3本は10秒・残り2本は5秒で制作します。",
            "6. 完成した5本を管理画面の各物語1本スロットへ登録します。物語間のページめくりは自動編集されます。",
          ].join("\n"),
        ),
        [`${root}/02_PROMPT_RUNWAY.txt`]: strToU8(RUNWAY_PROMPT_REQUEST),
        [`${root}/order.json`]: strToU8(
          JSON.stringify(runwayData, null, 2),
        ),
      };
      for (let index = 0; index < sceneStills.length; index += 1) {
        const asset = sceneStills[index];
        setExportProgress(
          `承認画像を準備しています（${index + 1}/${sceneStills.length}）`,
        );
        const { data, error: downloadError } = await supabase.storage
          .from("order-assets")
          .download(asset.storage_path);
        if (downloadError || !data) throw downloadError ?? new Error("download failed");
        const filename = archivePhotoName(asset, index, "approved_story_page");
        files[`${root}/approved-pages/${filename}`] = new Uint8Array(
          await data.arrayBuffer(),
        );
      }
      setExportProgress("ZIPファイルを作成しています…");
      await saveOperatorZip(files, `${root}.zip`);
      setNotice("顧客承認済み画像・Runway依頼文・制作JSONをまとめました。");
    } catch (bundleError) {
      console.error(bundleError);
      setError("承認画像の取得を完了できませんでした。もう一度お試しください。");
    } finally {
      setExportProgress("");
      setExportingBundle(false);
    }
  };

  const changePhotoAnalysisStatus = async (nextStatus: PhotoAnalysisStatus) => {
    if (!order) return false;
    setSaving(true);
    setError("");
    const { error: statusError } = await getSupabaseBrowserClient().rpc(
      "admin_set_photo_analysis_status",
      {
        p_order_id: order.id,
        p_status: nextStatus,
      },
    );
    if (statusError) {
      setError(
        "写真確認の状態を変更できませんでした。現在の状態と入力内容をご確認ください。",
      );
      setSaving(false);
      return false;
    } else {
      setNotice(
        nextStatus === "approved"
          ? "物語ごとの基準写真を承認しました。次の制作工程へ進めます。"
          : "制作素材の確認状態を更新し、操作履歴へ記録しました。",
      );
      await loadOrders();
    }
    setSaving(false);
    return true;
  };

  const makeAdminStoryPhotoPrimary = async (
    memory: OrderMemory,
    asset: OrderAsset,
  ) => {
    if (!order || !canManageStorySources || saving) return;
    setSaving(true);
    setError("");
    const { error: primaryError } = await getSupabaseBrowserClient().rpc(
      "admin_set_memory_primary_photo",
      {
        p_order_id: order.id,
        p_memory_id: memory.id,
        p_asset_id: asset.id,
      },
    );
    if (primaryError) {
      setError(
        "基準写真を変更できませんでした。写真確認の承認状態をご確認ください。",
      );
    } else {
      setNotice(`「${memory.title}」の基準写真を変更しました。`);
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  // The status only moves to needs_customer_input when the message is actually
  // sent, so the customer never sees "追加確認が必要" before the explanation.
  const prepareCustomerInputMessage = () => {
    if (!order) return;
    setMessageDraft((current) =>
      current.trim()
        ? current
        : [
            "お写真とお申し込み内容を確認しました。",
            "制作を進める前に、追加で確認させていただきたいことがあります。",
            "",
            "【確認したい内容】",
            "",
          ].join("\n"),
    );
    setCustomerInputPending(true);
    setError("");
    window.requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1320px)").matches) {
        document
          .getElementById("admin-message")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      messageComposerRef.current?.focus();
    });
  };

  const cancelCustomerInputRequest = () => {
    setCustomerInputPending(false);
    setNotice(
      "追加確認の連絡を取りやめました。写真確認の状態は変わっていません。",
    );
  };

  const selectVideo = (event: ChangeEvent<HTMLInputElement>) => {
    setVideoFile(event.target.files?.[0] ?? null);
    setVideoChecked(false);
    setError("");
  };

  const clearVideo = () => {
    setVideoFile(null);
    setVideoChecked(false);
    setVideoInputKey((current) => current + 1);
  };

  const uploadVideo = async () => {
    if (!videoFile || !order || !videoChecked) return;
    if (
      (videoMode === "review" && !canUploadReview) ||
      (videoMode === "final" && !canUploadFinal)
    ) {
      setError(
        videoMode === "review"
          ? "確認映像は、映像制作または修正対応の工程で公開できます。"
          : "最終納品の前に、進行状況を『最終確認をしています』へ変更してください。",
      );
      return;
    }
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const category = videoMode === "review" ? "review_video" : "final_video";
    const folder = videoMode === "review" ? "review" : "delivery";
    const path = `${order.user_id}/${order.id}/${folder}/${category}-${crypto.randomUUID()}.${safeExtension(videoFile)}`;
    const mimeType = videoFile.type || "video/mp4";
    const { error: uploadError } = await supabase.storage
      .from("order-assets")
      .upload(path, videoFile, { contentType: mimeType, upsert: false });
    if (uploadError) {
      setError("映像をアップロードできませんでした。");
      setSaving(false);
      return;
    }

    const { data: assetId, error: assetError } = await supabase.rpc(
      "admin_register_video_asset",
      {
        p_order_id: order.id,
        p_category: category,
        p_storage_path: path,
        p_original_filename: videoFile.name,
        p_mime_type: mimeType,
        p_file_size: videoFile.size,
      },
    );
    if (assetError || !assetId) {
      await supabase.storage.from("order-assets").remove([path]);
      setError(
        "映像情報を登録できませんでした。現在の制作工程をご確認ください。",
      );
      setSaving(false);
      return;
    }

    if (videoMode === "final") {
      const { error: deliveryError } = await supabase.rpc(
        "admin_deliver_order",
        {
          p_order_id: order.id,
          p_asset_id: assetId,
          p_title: deliveryTitle.trim() || `${order.pet_name}の動く絵本`,
          p_customer_message: deliveryMessage.trim() || null,
        },
      );
      if (deliveryError) {
        clearVideo();
        await loadDetails(order.id);
        setError(
          "映像は登録済みですが、納品処理だけ完了できませんでした。下の「登録済み映像で納品を再試行」から再利用できます。",
        );
        setSaving(false);
        return;
      }
      setNotice("完成映像と専用サイトをお客様へ納品しました。");
    } else {
      setNotice(
        "完成前の確認映像を公開しました。注文は納品済みになっていません。",
      );
    }
    clearVideo();
    await Promise.all([loadOrders(), loadDetails(order.id)]);
    setSaving(false);
  };

  const retryDelivery = async (asset: OrderAsset) => {
    if (!order || !canUploadFinal) return;
    if (
      !window.confirm(
        `${order.pet_name}ちゃんへ「${asset.original_filename}」を最終納品しますか？`,
      )
    )
      return;
    setSaving(true);
    setError("");
    const { error: deliveryError } = await getSupabaseBrowserClient().rpc(
      "admin_deliver_order",
      {
        p_order_id: order.id,
        p_asset_id: asset.id,
        p_title: deliveryTitle.trim() || `${order.pet_name}の動く絵本`,
        p_customer_message: deliveryMessage.trim() || null,
      },
    );
    if (deliveryError)
      setError(
        "登録済み映像での納品を完了できませんでした。入金・顧客承認・未対応修正をご確認ください。",
      );
    else {
      setNotice("登録済みの完成映像を使って納品を完了しました。");
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const uploadSceneStill = async (
    memory: OrderMemory,
    sceneSortOrder: number,
  ) => {
    const stillFile = stillFiles[memory.id];
    if (!order || !stillFile || !canPrepareStills) return;
    const title = memory.title.trim();
    const caption = (stillCaptions[memory.id] ?? "").trim();
    if (!caption) {
      setError("この場面に表示する物語の文章を入力してください。");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const extension =
      stillFile.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${order.user_id}/${order.id}/stills/scene_still-${crypto.randomUUID()}.${extension}`;
    const mimeType = stillFile.type || "image/jpeg";
    const { error: uploadError } = await supabase.storage
      .from("order-assets")
      .upload(path, stillFile, { contentType: mimeType, upsert: false });
    if (uploadError) {
      setError("絵本ページをアップロードできませんでした。");
      setSaving(false);
      return;
    }
    const { data: stillAssetId, error: registerError } = await supabase.rpc(
      "admin_register_scene_still",
      {
        p_order_id: order.id,
        p_storage_path: path,
        p_original_filename: stillFile.name,
        p_mime_type: mimeType,
        p_file_size: stillFile.size,
        p_scene_title: title,
        p_scene_sort_order: sceneSortOrder,
      },
    );
    if (registerError || !stillAssetId) {
      await supabase.storage.from("order-assets").remove([path]);
      setError(
        "絵本ページを登録できませんでした。入金・同意・現在の工程をご確認ください。",
      );
      setSaving(false);
      return;
    }
    const { error: captionError } = await supabase.rpc(
      "admin_update_scene_caption",
      {
        p_asset_id: stillAssetId as string,
        p_story_caption: caption,
      },
    );
    if (captionError) {
      await supabase.rpc("admin_delete_scene_still", {
        p_asset_id: stillAssetId as string,
      });
      await supabase.storage.from("order-assets").remove([path]);
      setError("物語の文章を保存できませんでした。もう一度お試しください。");
      setSaving(false);
      return;
    }
    setStillFiles((current) => ({ ...current, [memory.id]: null }));
    setStillCaptions((current) => ({ ...current, [memory.id]: "" }));
    setStillInputKeys((current) => ({
      ...current,
      [memory.id]: (current[memory.id] ?? 0) + 1,
    }));
    setNotice(
      "絵本ページと文章を追加しました。公開ボタンを押すまでお客様には表示されません。",
    );
    await loadDetails(order.id);
    setSaving(false);
  };

  const saveSceneCaption = async (asset: OrderAsset) => {
    if (!canPrepareStills) return;
    const caption = (captionDrafts[asset.id] ?? "").trim();
    if (!caption) {
      setError("物語の文章を入力してください。");
      return;
    }
    setSaving(true);
    setError("");
    const { error: captionError } = await getSupabaseBrowserClient().rpc(
      "admin_update_scene_caption",
      { p_asset_id: asset.id, p_story_caption: caption },
    );
    if (captionError) setError("物語の文章を保存できませんでした。");
    else {
      setNotice("物語の文章を保存しました。");
      await loadDetails(asset.order_id);
    }
    setSaving(false);
  };

  const cancelOrder = async () => {
    if (!order || !cancelReason.trim()) return;
    if (
      !window.confirm(
        `${order.order_number} をキャンセルしますか？\nこの操作は取り消せません。`,
      )
    )
      return;
    setSaving(true);
    setError("");
    const { error: cancelError } = await getSupabaseBrowserClient().rpc(
      "admin_cancel_order",
      { p_order_id: order.id, p_reason: cancelReason.trim() },
    );
    if (cancelError) {
      setError(
        cancelError.message.includes("already cancelled")
          ? "この注文はすでにキャンセル済みです。"
          : cancelError.message.includes("no longer be cancelled")
            ? "納品済みの注文はキャンセルできません。"
            : "キャンセルできませんでした。",
      );
    } else {
      setCancelReason("");
      setNotice("注文をキャンセルしました。");
      await loadOrders();
      await loadDetails(order.id);
    }
    setSaving(false);
  };

  // Storage objects are removed after the rows, never before: a leftover file can
  // be cleaned up later, a row deleted against a failed purge cannot be restored.
  const removeStoragePaths = async (paths: unknown) => {
    // A `returns setof text` RPC comes back as a bare string array, but tolerate
    // the single-column-object shape too rather than silently skipping cleanup.
    const list = (Array.isArray(paths) ? paths : [])
      .map((row) => {
        if (typeof row === "string") return row;
        const value = Object.values(row ?? {}).find(
          (candidate) => typeof candidate === "string",
        );
        return typeof value === "string" ? value : "";
      })
      .filter(Boolean);
    if (list.length)
      await getSupabaseBrowserClient()
        .storage.from("order-assets")
        .remove(list);
    return list.length;
  };

  const purgeOrderFiles = async () => {
    if (!order) return;
    if (
      !window.confirm(
        `${order.order_number} のお客様の写真・映像をすべて削除しますか？\nこの操作は取り消せません。`,
      )
    )
      return;
    setSaving(true);
    setError("");
    const { data, error: purgeError } = await getSupabaseBrowserClient().rpc(
      "admin_purge_order_files",
      { p_order_id: order.id },
    );
    if (purgeError) {
      setError(
        purgeError.message.includes("cancel the order before")
          ? "先に注文をキャンセルしてください。"
          : "写真・映像を削除できませんでした。",
      );
    } else {
      const removed = await removeStoragePaths(data);
      setNotice(`お客様の写真・映像を${removed}件削除しました。`);
      await loadDetails(order.id);
    }
    setSaving(false);
  };

  const deleteOrder = async () => {
    if (!order || deleteConfirmNumber.trim() !== order.order_number) return;
    if (
      !window.confirm(
        `${order.order_number} を完全に削除しますか？\n写真・メッセージ・履歴もすべて消え、取り消せません。`,
      )
    )
      return;
    setSaving(true);
    setError("");
    const { data, error: deleteError } = await getSupabaseBrowserClient().rpc(
      "admin_delete_order",
      {
        p_order_id: order.id,
        p_reason: cancelReason.trim() || "顧客都合によるキャンセル",
      },
    );
    if (deleteError) {
      setError(
        deleteError.message.includes("payment history")
          ? "決済履歴がある注文は削除できません。写真・映像の削除をご利用ください。"
          : deleteError.message.includes("cancel the order before")
            ? "先に注文をキャンセルしてください。"
            : "注文を削除できませんでした。",
      );
      setSaving(false);
      return;
    }
    await removeStoragePaths(data);
    setDeleteConfirmNumber("");
    setCancelReason("");
    setNotice(`${order.order_number} を完全に削除しました。`);
    selectOrder("");
    await loadOrders();
    setSaving(false);
  };

  const deleteSceneStill = async (asset: OrderAsset) => {
    if (!order || !canPrepareStills) return;
    if (
      !window.confirm(
        `「${asset.scene_title ?? asset.original_filename}」を削除しますか？`,
      )
    )
      return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { data: storagePath, error: deleteError } = await supabase.rpc(
      "admin_delete_scene_still",
      { p_asset_id: asset.id },
    );
    if (deleteError) {
      setError("絵本ページを削除できませんでした。");
    } else {
      if (storagePath)
        await supabase.storage
          .from("order-assets")
          .remove([storagePath as string]);
      setNotice("絵本ページを削除しました。");
      await loadDetails(order.id);
    }
    setSaving(false);
  };

  const publishSceneStills = async () => {
    if (!order || !canPrepareStills || sceneStills.length === 0) return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { error: publishError } = await supabase.rpc(
      "admin_publish_scene_stills",
      { p_order_id: order.id },
    );
    if (publishError) {
      setError(
        "絵本ページを公開できませんでした。すべてのページに物語文があるか、入金・同意・現在の工程をご確認ください。",
      );
      setSaving(false);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        orderId: order.id,
        body: "絵本ページと物語の文章を公開しました。制作室で全ページをご確認のうえ、この内容で動画制作へ進めてよいかお知らせください。",
      }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as {
          saved?: boolean;
          notificationSent?: boolean;
        } | null)
      : null;
    setNotice(
      result?.notificationSent
        ? "絵本ページをお客様へ公開し、メールでお知らせしました。"
        : "絵本ページを公開しました。メール通知は送れなかったため、必要ならメッセージでお知らせください。",
    );
    await Promise.all([loadOrders(), loadDetails(order.id)]);
    setSaving(false);
  };

  const beginStillsRevision = async () => {
    if (!order || order.status !== "stills_review" || !order.stills_change_open)
      return;
    setSaving(true);
    setError("");
    const { error: revisionError } = await getSupabaseBrowserClient().rpc(
      "admin_begin_stills_revision",
      { p_order_id: order.id },
    );
    if (revisionError)
      setError(
        "絵本ページの調整を開始できませんでした。現在の工程をご確認ください。",
      );
    else {
      setNotice(
        "絵本ページの調整を開始しました。差し替え後に、もう一度公開してください。",
      );
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const toggleExpandedStory = (sortOrder: number) => {
    setError("");
    setExpandedStoryDraft((current) => {
      if (current.includes(sortOrder)) {
        return current.filter((value) => value !== sortOrder);
      }
      if (current.length >= 3) {
        setError("重要な物語は3つまで選択できます。");
        return current;
      }
      return [...current, sortOrder].sort((a, b) => a - b);
    });
  };

  const saveExpandedStories = async () => {
    if (!order || expandedStoryDraft.length !== 3 || saving) return;
    setSaving(true);
    setError("");
    const { error: saveError } = await getSupabaseBrowserClient().rpc(
      "admin_set_expanded_story_slots",
      {
        p_order_id: order.id,
        p_sort_orders: expandedStoryDraft,
      },
    );
    if (saveError) {
      setError(
        "重要な物語を保存できませんでした。選択状態を確認して、もう一度お試しください。",
      );
    } else {
      setNotice(
        "重要な物語3つを保存しました。選んだ物語はRunwayで10秒、その他は5秒の1本として制作します。",
      );
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const uploadRenderClip = async (
    still: OrderAsset,
    file: File,
  ) => {
    if (!order || !canRenderFilm) return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "mp4";
    // Operator namespace, never the customer's uid folder — see the note at the
    // top of supabase/migrations/202607280001_render_clips.sql.
    const path = `admin/${order.id}/clips/render_clip-${still.scene_sort_order + 1}-${crypto.randomUUID()}.${extension}`;
    const mimeType = file.type || "video/mp4";
    const { error: uploadError } = await supabase.storage
      .from("order-assets")
      .upload(path, file, { contentType: mimeType, upsert: false });
    if (uploadError) {
      setError("クリップをアップロードできませんでした。");
      setSaving(false);
      return;
    }
    const { error: registerError } = await supabase.rpc(
      "admin_register_story_render_clip",
      {
        p_order_id: order.id,
        p_storage_path: path,
        p_original_filename: file.name,
        p_mime_type: mimeType,
        p_file_size: file.size,
        p_still_asset_id: still.id,
        p_render_take: 1,
      },
    );
    if (registerError) {
      await supabase.storage.from("order-assets").remove([path]);
      setError(
        "クリップを登録できませんでした。お客様が承認した絵本ページかどうかご確認ください。",
      );
      setSaving(false);
      return;
    }
    setClipInputKey((current) => current + 1);
    setNotice(
      `「${still.scene_title ?? "場面"}」の動画を追加しました。`,
    );
    await loadDetails(order.id);
    setSaving(false);
  };

  const deleteRenderClip = async (asset: OrderAsset) => {
    if (!order || !canRenderFilm) return;
    if (
      !window.confirm(
        `「${asset.scene_title ?? asset.original_filename}」のクリップを削除しますか？`,
      )
    )
      return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { data: storagePath, error: deleteError } = await supabase.rpc(
      "admin_delete_render_clip",
      { p_asset_id: asset.id },
    );
    if (deleteError) {
      setError("クリップを削除できませんでした。");
    } else {
      if (storagePath)
        await supabase.storage
          .from("order-assets")
          .remove([storagePath as string]);
      setNotice("クリップを削除しました。");
      await loadDetails(order.id);
    }
    setSaving(false);
  };

  const startRender = async () => {
    if (!order || !canRenderFilm || rendering) return;
    if (!allRenderClipsReady) {
      setError(
        "重要な物語3つを選び、5つの物語クリップをすべて登録してください。",
      );
      return;
    }
    if (!filmTitle.trim()) {
      setError("映像のタイトルを入力してください。");
      return;
    }
    if (!filmEndingText.trim()) {
      setError("エンディングの文章を入力してください。");
      return;
    }

    setRendering(true);
    setError("");
    setRenderProgress("編集を準備しています…");
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const items = requiredRenderSlots.map(({ still, take }, index) => {
      const storyClip = clipByStillAndTake.get(`${still.id}:${take}`)!;
      return {
        clipAssetId: storyClip.id,
        role:
          index === 0
            ? ("intro" as const)
            : index === requiredRenderSlots.length - 1
              ? ("ending" as const)
              : ("memory" as const),
      };
    });

    try {
      const response = await fetch("/api/admin/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          items,
          title: filmTitle.trim(),
          kicker: filmKicker.trim(),
          endingText: filmEndingText.trim(),
          endingMark: filmEndingMark.trim(),
          bgmFile: filmBgm || null,
          letterboxPct: filmLetterbox ? filmLetterboxPct : 0,
          filmLook,
        }),
      });

      if (!response.ok || !response.body) {
        const detail = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(detail?.message ?? "編集を開始できませんでした。");
        setRenderProgress("");
        setRendering(false);
        return;
      }

      // The route streams newline-delimited JSON so the operator sees real
      // progress instead of a frozen button for several minutes.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as RenderProgressEvent;
          if (event.type === "progress") setRenderProgress(event.message);
          else if (event.type === "done") {
            setRenderProgress("");
            setNotice(
              `編集が完了しました（約${Math.round(event.durationSeconds)}秒 · ${(event.fileSize / 1024 / 1024).toFixed(1)} MB）。内容を確認してから公開してください。`,
            );
          } else if (event.type === "error") {
            failed = true;
            setError(event.message);
            setRenderProgress("");
          }
        }
      }
      if (!failed) await loadDetails(order.id);
    } catch {
      setError("編集中に接続が切れました。もう一度お試しください。");
      setRenderProgress("");
    }
    setRendering(false);
  };

  const promoteAssembledFilm = async (asset: OrderAsset) => {
    if (!order || !canUploadReview) return;
    if (
      !window.confirm(
        `${order.pet_name}ちゃんの確認映像としてお客様に公開します。よろしいですか？`,
      )
    )
      return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const previousPath = asset.storage_path;
    const newPath = `${order.user_id}/${order.id}/review/review_video-${crypto.randomUUID()}.mp4`;
    // Must physically leave the admin namespace before the customer can read it.
    const { error: moveError } = await supabase.storage
      .from("order-assets")
      .move(previousPath, newPath);
    if (moveError) {
      setError("映像を公開用の場所へ移動できませんでした。");
      setSaving(false);
      return;
    }
    const { error: promoteError } = await supabase.rpc(
      "admin_promote_assembled_film",
      {
        p_asset_id: asset.id,
        p_storage_path: newPath,
      },
    );
    if (promoteError) {
      await supabase.storage.from("order-assets").move(newPath, previousPath);
      setError(
        "確認映像として公開できませんでした。入金・同意・現在の工程をご確認ください。",
      );
      setSaving(false);
      return;
    }
    setNotice("確認映像としてお客様へ公開しました。");
    await Promise.all([loadOrders(), loadDetails(order.id)]);
    setSaving(false);
  };

  const resolveMessage = async (messageId: string) => {
    if (!order) return;
    setSaving(true);
    const { error: resolveError } = await getSupabaseBrowserClient().rpc(
      "admin_resolve_message",
      { p_message_id: messageId },
    );
    if (resolveError) setError("メッセージを対応済みにできませんでした。");
    else {
      setNotice("メッセージを対応済みにしました。");
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const resolveRevision = async (revisionId: string) => {
    if (!order) return;
    setSaving(true);
    const { error: resolveError } = await getSupabaseBrowserClient().rpc(
      "admin_resolve_revision",
      { p_revision_id: revisionId },
    );
    if (resolveError)
      setError(
        resolveError.message.includes("revised review video")
          ? "先に修正版を『完成前の確認映像』として公開してください。"
          : "修正依頼を対応済みにできませんでした。",
      );
    else {
      setNotice("修正依頼を対応済みにし、履歴へ記録しました。");
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order) return;
    const body = messageDraft.trim();
    if (!body) return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ orderId: order.id, body }),
    });
    const result = (await response.json().catch(() => null)) as {
      saved?: boolean;
      notificationSent?: boolean;
      error?: string;
      notificationReason?: string | null;
    } | null;
    if (!response.ok || !result?.saved) {
      setError(
        result?.error === "server_not_configured"
          ? "メッセージ機能の接続設定を確認できませんでした。VercelのSupabase環境変数をご確認ください。"
          : "メッセージを送信できませんでした。時間をおいてもう一度お試しください。",
      );
    } else {
      setMessageDraft("");
      const notifyNote = result.notificationSent
        ? "お客様へメッセージを送り、メールでお知らせしました。"
        : "メッセージは保存しましたが、メール通知を送れませんでした。Resendの設定・送信履歴をご確認ください。";
      if (customerInputPending) {
        const { error: statusError } = await supabase.rpc(
          "admin_set_photo_analysis_status",
          {
            p_order_id: order.id,
            p_status: "needs_customer_input",
          },
        );
        if (statusError) {
          setError(
            "メッセージは送信しましたが、写真確認の状態を「お客様へ追加確認が必要」へ変更できませんでした。現在の状態をご確認ください。",
          );
        } else {
          setNotice(
            `${notifyNote}あわせて写真確認の状態を「お客様へ追加確認が必要」へ変更しました。`,
          );
        }
        setCustomerInputPending(false);
        await loadOrders();
      } else {
        setNotice(notifyNote);
      }
      await loadDetails(order.id);
    }
    setSaving(false);
  };

  if (authLoading || loading)
    return <div className="wizard-loading">運営画面を準備しています…</div>;
  if (!user || profile?.role !== "admin")
    return (
      <main className="admin-denied">
        <p className="eyebrow">ADMIN ONLY</p>
        <h1>管理者権限が必要です。</h1>
        <p>管理者として登録されたアカウントでログインしてください。</p>
        <Link className="button button-primary" href="/studio">
          制作室へ戻る
        </Link>
      </main>
    );

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="brand" href="/">
          <span className="brand-mark">WM</span>
          <span className="brand-type">
            WAN MEMORY<small>PRODUCTION ADMIN</small>
          </span>
        </Link>
        <nav>
          <Link href="/studio">顧客制作室</Link>
          <span>{profile.full_name || profile.email}</span>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
          >
            ログアウト
          </button>
        </nav>
      </header>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <p className="eyebrow">ORDERS</p>
          <h1>制作管理</h1>
          {totalAttention > 0 && (
            <button
              type="button"
              className="admin-sidebar-total"
              onClick={() => changeFilter("attention")}
            >
              <strong>{totalAttention}件</strong>
              <span>対応が必要な連絡・修正</span>
            </button>
          )}
          <select
            aria-label="注文の状態で絞り込む"
            value={filter}
            onChange={(event) => changeFilter(event.target.value)}
          >
            <option value="all">すべての注文</option>
            <option value="attention">未対応あり（{totalAttention}件）</option>
            {statusOptions.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="admin-mobile-order-picker">
            <span>対応する注文</span>
            <select
              value={selectedOrderId}
              onChange={(event) => selectOrder(event.target.value)}
            >
              {visibleOrders.map((item) => {
                const attention = attentionByOrder[item.id];
                const count =
                  (attention?.messages ?? 0) + (attention?.revisions ?? 0);
                return (
                  <option value={item.id} key={item.id}>
                    {count ? `● ${count}件 · ` : ""}
                    {item.pet_name} · {ORDER_STATUS_LABELS[item.status]}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="admin-order-list">
            {visibleOrders.map((item) => {
              const attention = attentionByOrder[item.id];
              const count =
                (attention?.messages ?? 0) + (attention?.revisions ?? 0);
              return (
                <button
                  type="button"
                  className={item.id === selectedOrderId ? "active" : ""}
                  onClick={() => selectOrder(item.id)}
                  key={item.id}
                >
                  <span>
                    {ORDER_STATUS_LABELS[item.status]}
                    {count > 0 && (
                      <b className="admin-order-alert">未対応 {count}</b>
                    )}
                  </span>
                  <strong>{item.pet_name}</strong>
                  <small>
                    {item.order_number} · ¥
                    {new Intl.NumberFormat("ja-JP").format(item.quoted_price)}
                    （税込）
                  </small>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="admin-main">
          {notice && (
            <p className="studio-alert" role="status">
              {notice}
              <button type="button" onClick={() => setNotice("")}>
                ×
              </button>
            </p>
          )}
          {error && (
            <p className="studio-alert error" role="alert">
              {error}
              <button type="button" onClick={() => setError("")}>
                ×
              </button>
            </p>
          )}

          <details className="admin-security" id="admin-security">
            <summary>
              <span className="eyebrow">ACCOUNT SECURITY</span>
              <strong>アカウントの保護と操作ログ</strong>
              <span
                className={
                  mfaFactors.length
                    ? "admin-security-badge on"
                    : "admin-security-badge"
                }
              >
                {mfaFactors.length ? "二段階認証 有効" : "二段階認証 未設定"}
              </span>
            </summary>

            <div className="admin-security-body">
              <AdminPushCenter />
              <section>
                <h4>二段階認証（TOTP）</h4>
                {mfaFactors.length > 0 ? (
                  <>
                    <p className="admin-operation-note">
                      この管理アカウントは認証アプリで保護されています。
                    </p>
                    <ul className="admin-security-factors">
                      {mfaFactors.map((factor) => (
                        <li key={factor.id}>
                          <span>
                            {factor.friendly_name || "認証アプリ"}（
                            {factor.status === "verified" ? "有効" : "未確認"}）
                          </span>
                          <button
                            className="button button-outline"
                            type="button"
                            disabled={saving}
                            onClick={() => removeMfaFactor(factor.id)}
                          >
                            解除する
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : mfaEnrollment ? (
                  <>
                    <p className="admin-operation-note strong">
                      認証アプリ（Google Authenticator など）でこの QR
                      コードを読み取り、表示された 6
                      桁のコードを入力してください。
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="admin-security-qr"
                      src={mfaEnrollment.qr}
                      alt="二段階認証の QR コード"
                    />
                    <p className="admin-security-secret">
                      QR を読み取れない場合の設定キー：
                      <code>{mfaEnrollment.secret}</code>
                    </p>
                    <div className="admin-form-grid">
                      <label>
                        <span>認証コード</span>
                        <input
                          value={mfaCode}
                          onChange={(event) =>
                            setMfaCode(
                              event.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          inputMode="numeric"
                          placeholder="000000"
                          maxLength={6}
                        />
                      </label>
                    </div>
                    <div className="admin-still-actions">
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={saving || mfaCode.length !== 6}
                        onClick={confirmMfaEnrollment}
                      >
                        登録を完了する →
                      </button>
                      <button
                        className="button button-outline"
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setMfaEnrollment(null);
                          setMfaCode("");
                        }}
                      >
                        やめる
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="admin-operation-note warning">
                      二段階認証が未設定です。管理画面はお客様の個人情報を扱うため、有効化を強くおすすめします。
                    </p>
                    <div className="admin-still-actions">
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={saving}
                        onClick={startMfaEnrollment}
                      >
                        二段階認証を設定する →
                      </button>
                    </div>
                  </>
                )}
              </section>

              <section>
                <h4>操作ログ（直近100件）</h4>
                {securityEvents.length === 0 ? (
                  <p className="admin-empty-copy">
                    記録された操作はまだありません。
                  </p>
                ) : (
                  <div className="admin-security-log">
                    {securityEvents.map((event) => (
                      <article key={event.id}>
                        <span>
                          {SECURITY_EVENT_LABELS[event.event_type] ??
                            event.event_type}
                        </span>
                        <small>{formatDateTime(event.created_at)}</small>
                      </article>
                    ))}
                  </div>
                )}
                <p className="admin-operation-note">
                  ログイン成功・失敗、アカウントロック、権限変更を記録しています。10
                  回連続で失敗したアカウントは 30 分間ロックされます。
                </p>
              </section>
            </div>
          </details>

          {!order ? (
            <div className="admin-empty">
              <h2>注文はまだありません。</h2>
              <p>新しい相談が入るとこちらに表示されます。</p>
            </div>
          ) : (
            <>
              <div className="admin-title">
                <div>
                  <p className="eyebrow">{order.order_number}</p>
                  <h2>{order.pet_name}ちゃんの動く絵本</h2>
                  <span>
                    {customer?.full_name || customer?.email || order.user_id}
                  </span>
                </div>
                <Link
                  className="button button-outline"
                  href={`/studio?order=${order.id}&preview=1`}
                  target="_blank"
                  rel="noreferrer"
                >
                  顧客画面を閲覧
                </Link>
              </div>

              <div className="admin-workspace">
                <div className="admin-content">
                  <section
                    className="admin-card admin-photo-analysis"
                    id="admin-photo-analysis"
                  >
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">STORY SOURCE REVIEW</p>
                        <h3>物語ごとの制作素材チェック</h3>
                      </div>
                      <span
                        className={`photo-analysis-status ${productionFields.photoAnalysisStatus}`}
                      >
                        {photoAnalysisStatusLabel(
                          productionFields.photoAnalysisStatus,
                        )}
                      </span>
                    </div>
                    <div className="admin-reference-photo-grid">
                      {memories.map((memory) => {
                        const storyPhotos = sourceAssets
                          .filter((asset) => asset.memory_id === memory.id)
                          .sort(
                            (a, b) =>
                              (a.memory_photo_sort_order ?? 99) -
                              (b.memory_photo_sort_order ?? 99),
                          );
                        const primaryPhoto = storyPhotos[0] ?? null;
                        return (
                          <article key={memory.id}>
                            <strong>
                              STORY {String(memory.sort_order).padStart(2, "0")}
                            </strong>
                            {primaryPhoto && assetUrls[primaryPhoto.id] ? (
                              <a
                                href={assetUrls[primaryPhoto.id]}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <span
                                  className="admin-photo-thumb"
                                  role="img"
                                  aria-label={`${memory.title}の基準写真`}
                                  style={{
                                    backgroundImage: `url(${assetUrls[primaryPhoto.id]})`,
                                  }}
                                />
                              </a>
                            ) : (
                              <span className="admin-reference-empty">
                                基準写真なし
                              </span>
                            )}
                            <small>
                              {memory.title} · 基準1枚 + 補助
                              {Math.max(0, storyPhotos.length - 1)}枚
                            </small>
                          </article>
                        );
                      })}
                    </div>
                    <dl className="admin-story">
                      <div>
                        <dt>制作単位</dt>
                        <dd>{memories.length}物語 · 重要な3物語は2クリップ</dd>
                      </div>
                      <div>
                        <dt>写真の使い方</dt>
                        <dd>各物語の1枚目を基準にし、2〜3枚目は補助だけに使用</dd>
                      </div>
                      <div>
                        <dt>映像としての再構成の確認</dt>
                        <dd>
                          {productionFields.aiReconstructionAcknowledged
                            ? "確認済み"
                            : "未確認"}
                        </dd>
                      </div>
                      <div>
                        <dt>承認日時</dt>
                        <dd>
                          {formatDateTime(
                            productionFields.photoAnalysisApprovedAt,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>承認した運営者</dt>
                        <dd>
                          {productionFields.photoAnalysisApprovedBy
                            ? productionFields.photoAnalysisApprovedBy ===
                              user.id
                              ? profile?.email || user.id
                              : productionFields.photoAnalysisApprovedBy
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <div className="admin-photo-analysis-actions">
                      {productionFields.photoAnalysisStatus ===
                        "pending_operator_review" && (
                        <>
                          <button
                            className="button button-primary"
                            type="button"
                            disabled={saving || customerInputPending}
                            onClick={() =>
                              changePhotoAnalysisStatus("approved")
                            }
                          >
                            物語と写真を承認する →
                          </button>
                          <button
                            className="button button-outline"
                            type="button"
                            disabled={saving || customerInputPending}
                            onClick={prepareCustomerInputMessage}
                          >
                            お客様への確認が必要・連絡する
                          </button>
                        </>
                      )}
                      {productionFields.photoAnalysisStatus ===
                        "needs_customer_input" && (
                        <button
                          className="button button-outline"
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            changePhotoAnalysisStatus("pending_operator_review")
                          }
                        >
                          追加内容を確認待ちに戻す
                        </button>
                      )}
                      {productionFields.photoAnalysisStatus === "approved" && (
                        <button
                          className="button button-outline"
                          type="button"
                          disabled={saving || customerInputPending}
                          onClick={prepareCustomerInputMessage}
                        >
                          承認を取り消し、追加確認を連絡する
                        </button>
                      )}
                    </div>
                    {customerInputPending && (
                      <aside className="admin-operation-note strong">
                        <strong>まだ状態は変更していません。</strong>
                        <span>
                          右の「お客様との連絡」で確認したい内容を書き、メッセージを送信すると、そのタイミングで写真確認の状態を「お客様へ追加確認が必要」へ変更します。
                        </span>
                      </aside>
                    )}
                    {!photoAnalysisApproved && (
                      <aside className="admin-operation-note warning">
                        <strong>次の制作工程は停止中です。</strong>
                        <span>
                          すべての物語に基準写真があることを確認し、承認すると次の制作工程へ進めます。
                        </span>
                      </aside>
                    )}
                  </section>

                  <aside
                    className="admin-attention-summary"
                    aria-label="未対応項目"
                  >
                    <div>
                      <strong>{sourceAssets.length}</strong>
                      <span>お預かり写真</span>
                    </div>
                    <div className={openMessages.length ? "needs-action" : ""}>
                      <strong>{openMessages.length}</strong>
                      <span>未対応メッセージ</span>
                    </div>
                    <div className={openRevisions.length ? "needs-action" : ""}>
                      <strong>{openRevisions.length}</strong>
                      <span>未対応の修正</span>
                    </div>
                    <div>
                      <strong>
                        {order.revision_used}/{order.revision_limit}
                      </strong>
                      <span>使用済み修正回数</span>
                    </div>
                  </aside>

                  <nav className="admin-mobile-sections" aria-label="管理項目">
                    <a href="#admin-progress">進行</a>
                    <a href="#admin-story">内容</a>
                    <a href="#admin-photos">写真</a>
                    <a href="#admin-concepts">2案</a>
                    <a href="#admin-stills">場面</a>
                    <a href="#admin-render">編集</a>
                    <a href="#admin-revisions">修正</a>
                    <a href="#admin-video">映像</a>
                    <a href="#admin-message">連絡</a>
                    <a href="#admin-danger">取消</a>
                  </nav>

                  <section className="admin-card" id="admin-progress">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">PRODUCTION STATUS</p>
                        <h3>進行状況・入金・納期</h3>
                      </div>
                      <span>許可された次の工程だけを表示</span>
                    </div>
                    {order.payment_status === "pending" &&
                      !["delivered", "cancelled"].includes(order.status) && (
                        <aside className="admin-operation-note warning">
                          <strong>お支払いはまだご案内していません。</strong>
                          <span>
                            お客様が構成案を選び、現在版の同意記録が揃ったら、入金状態を「お支払いをご案内」にして保存してください。
                          </span>
                        </aside>
                      )}
                    {order.payment_status === "invoice_sent" && (
                      <aside className="admin-operation-note strong">
                        <strong>カード決済待ちです。</strong>
                        <span>
                          お客様の制作室に決済ボタンが表示されています。入金完了は自動で反映されます。
                        </span>
                      </aside>
                    )}
                    {order.payment_status === "paid" && (
                      <aside className="admin-operation-note strong">
                        <strong>お支払いを確認しました。</strong>
                        <span>
                          管理画面から手動変更せず、制作工程へ進めてください。
                        </span>
                      </aside>
                    )}
                    {order.payment_status === "refunded" && (
                      <aside className="admin-operation-note warning">
                        <strong>返金済みです。</strong>
                        <span>返金状態は自動で反映されています。</span>
                      </aside>
                    )}
                    {!consentCurrent &&
                      !["delivered", "cancelled"].includes(order.status) && (
                        <aside className="admin-operation-note warning">
                          <strong>現在版の同意記録が揃っていません。</strong>
                          <span>
                            お客様が制作室で利用規約・写真使用権限（人物の了解を含む）・外部制作サービスでの処理を確認するまで制作を開始できません。
                          </span>
                        </aside>
                      )}
                    {order.customer_approved_at && (
                      <aside className="admin-operation-note strong">
                        <strong>お客様が確認映像を確定済みです。</strong>
                        <span>
                          {formatDateTime(order.customer_approved_at)} ·
                          承認した確認映像ID{" "}
                          {order.customer_approved_review_asset_id}
                        </span>
                      </aside>
                    )}
                    <div className="admin-form-grid">
                      <label>
                        <span>現在の状態</span>
                        <select
                          value={status}
                          onChange={(event) =>
                            setStatus(event.target.value as OrderStatus)
                          }
                        >
                          {selectableStatuses.map(([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>入金状態</span>
                        <select
                          value={paymentStatus}
                          disabled={
                            order.payment_status === "paid" ||
                            order.payment_status === "refunded"
                          }
                          onChange={(event) =>
                            setPaymentStatus(
                              event.target
                                .value as MemoryOrder["payment_status"],
                            )
                          }
                        >
                          <option value="pending">ご案内前</option>
                          <option
                            value="invoice_sent"
                            disabled={
                              (!APPLICATIONS_OPEN || !canRequestPayment) &&
                              order.payment_status !== "invoice_sent"
                            }
                          >
                            お支払いをご案内
                          </option>
                          {order.payment_status === "paid" && (
                            <option value="paid">入金確認済み</option>
                          )}
                          {order.payment_status === "refunded" && (
                            <option value="refunded">返金済み</option>
                          )}
                        </select>
                        <small>
                          {!APPLICATIONS_OPEN
                            ? "現在、お支払い受付は準備中です。"
                            : order.payment_status === "pending" &&
                                !canRequestPayment
                              ? "構成案の選択と現在版の同意記録が揃うとご案内できます。"
                              : "入金・返金は決済結果から自動反映されます。"}
                        </small>
                      </label>
                      <label>
                        <span>予定完成日</span>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(event) => setDueDate(event.target.value)}
                        />
                      </label>
                      <label className="wide">
                        <span>運営メモ（顧客には非表示）</span>
                        <textarea
                          rows={3}
                          value={adminNotes}
                          onChange={(event) =>
                            setAdminNotes(event.target.value)
                          }
                        />
                      </label>
                    </div>
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={
                        saving ||
                        (!APPLICATIONS_OPEN &&
                          paymentStatus === "invoice_sent" &&
                          order.payment_status !== "invoice_sent") ||
                        (paymentStatus === "invoice_sent" &&
                          !canRequestPayment &&
                          order.payment_status !== "invoice_sent")
                      }
                      onClick={saveOrder}
                    >
                      {saving
                        ? "保存中…"
                        : !APPLICATIONS_OPEN &&
                            paymentStatus === "invoice_sent" &&
                            order.payment_status !== "invoice_sent"
                          ? "お支払い受付は準備中"
                          : paymentStatus === "invoice_sent" &&
                              order.payment_status !== "invoice_sent"
                            ? "お支払い案内を送る →"
                            : "進行状況を保存"}
                    </button>
                  </section>

                  <section className="admin-card" id="admin-story">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">PRODUCTION DOWNLOADS</p>
                        <h3>工程別のCodex制作データ</h3>
                      </div>
                    </div>
                    <p className="admin-export-intro">
                      STEP 1〜3は注文の進行に合わせて有効になります。ホームページキャラクターだけは、元写真があればどの工程でも制作・登録できます。
                    </p>
                    <div className="admin-stage-downloads">
                      <article className={conceptExportReady ? "ready" : "locked"}>
                        <header><span>STEP 1</span><strong>A/B物語案を作る</strong></header>
                        <p>写真確認後、顧客が案を選ぶ前に使用します。</p>
                        <small>内容：顧客エピソード、原本写真、フォーム形式の構成案プロンプト</small>
                        <button
                          className="button button-primary"
                          type="button"
                          disabled={saving || exportingBundle || !conceptExportReady}
                          onClick={() => void downloadSourceBundle("concept")}
                        >
                          {exportingBundle && conceptExportReady ? "準備中…" : "① 構成案作成データをダウンロード"}
                        </button>
                        {!conceptExportReady && <em>写真承認後・案選択前に有効</em>}
                      </article>
                      <article className={illustrationExportReady ? "ready" : "locked"}>
                        <header><span>STEP 2</span><strong>絵本ページを作る</strong></header>
                        <p>顧客のA/B案選択と決済完了後に使用します。</p>
                        <small>内容：選択案、5場面、原本写真、画像制作専用プロンプト</small>
                        <button
                          className="button button-primary"
                          type="button"
                          disabled={saving || exportingBundle || !illustrationExportReady}
                          onClick={() => void downloadSourceBundle("illustration")}
                        >
                          {exportingBundle && illustrationExportReady ? "準備中…" : "② 絵本画像制作データをダウンロード"}
                        </button>
                        {!illustrationExportReady && <em>案選択・決済完了後に有効</em>}
                      </article>
                      <article className={runwayExportReady ? "ready" : "locked"}>
                        <header><span>STEP 3</span><strong>Runway制作へ進む</strong></header>
                        <p>5枚の絵本ページを顧客が承認した後に使用します。</p>
                        <small>内容：承認画像5枚、重要な3物語の指定、Gen-4用プロンプト5本</small>
                        {order.stills_approved_at && sceneStills.length === 5 && (
                          <div className="admin-expanded-story-picker">
                            <strong>10秒にする重要な物語を3つ選択</strong>
                            <div>
                              {sceneStills.map((still) => {
                                const selected = expandedStoryDraft.includes(
                                  still.scene_sort_order,
                                );
                                return (
                                  <button
                                    key={`expanded-${still.id}`}
                                    type="button"
                                    className={selected ? "selected" : ""}
                                    aria-pressed={selected}
                                    disabled={saving || !canRenderFilm}
                                    onClick={() =>
                                      toggleExpandedStory(
                                        still.scene_sort_order,
                                      )
                                    }
                                  >
                                    <span>
                                      物語{still.scene_sort_order + 1}
                                    </span>
                                    {still.scene_title ?? "場面"}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              className="button button-outline"
                              type="button"
                              disabled={
                                saving ||
                                !canRenderFilm ||
                                expandedStoryDraft.length !== 3 ||
                                JSON.stringify(expandedStoryDraft) ===
                                  JSON.stringify(expandedStorySortOrders)
                              }
                              onClick={() => void saveExpandedStories()}
                            >
                              {saving
                                ? "保存中…"
                                : `重要な物語を保存（${expandedStoryDraft.length}/3）`}
                            </button>
                          </div>
                        )}
                        <button
                          className="button button-primary"
                          type="button"
                          disabled={saving || exportingBundle || !runwayExportReady}
                          onClick={() => void downloadRunwayBundle()}
                        >
                          {exportingBundle && runwayExportReady ? "準備中…" : "③ Runway制作データをダウンロード"}
                        </button>
                        {!runwayExportReady && (
                          <em>
                            顧客承認後、重要な物語3つを保存すると有効
                          </em>
                        )}
                      </article>
                      <article className={sourceAssets.length > 0 ? "ready anytime" : "locked anytime"}>
                        <header><span>OPTIONAL / ANYTIME</span><strong>ホームページキャラクター</strong></header>
                        <p>顧客確認に出さない、専用サイト用の歩くキャラクターを作ります。</p>
                        <small>内容：注文JSON、元写真、4×3透明スプライト専用プロンプト</small>
                        <button
                          className="button button-primary"
                          type="button"
                          disabled={saving || exportingBundle || sourceAssets.length === 0}
                          onClick={() => void downloadCharacterBundle()}
                        >
                          {exportingBundle && sourceAssets.length > 0 ? "準備中…" : "キャラクター制作データをダウンロード"}
                        </button>
                        {sourceAssets.length === 0 && <em>元写真の登録後に利用できます</em>}
                      </article>
                    </div>
                    <div className="admin-character-register">
                      <div>
                        <strong>完成したキャラクターを登録</strong>
                        <p>4列×3行・12フレームの透明PNG / WebP。顧客画面の承認対象には追加されません。</p>
                      </div>
                      {characterSprite && assetUrls[characterSprite.id] && (
                        <figure>
                          {/* eslint-disable-next-line @next/next/no-img-element -- Signed private storage URL is operator-only and expires. */}
                          <img src={assetUrls[characterSprite.id]} alt={`${order.pet_name}の登録済みホームページキャラクター`} />
                          <figcaption>登録済み · ホームページへ自動反映</figcaption>
                        </figure>
                      )}
                      <label className="admin-character-file">
                        <span>{characterSprite ? "新しいスプライトに差し替える" : "スプライトを選択"}</span>
                        <input
                          key={characterSpriteInputKey}
                          type="file"
                          accept="image/png,image/webp"
                          onChange={(event) => setCharacterSpriteFile(event.target.files?.[0] ?? null)}
                        />
                      </label>
                      <div className="admin-character-actions">
                        <button className="button button-primary" type="button" disabled={saving || !characterSpriteFile} onClick={() => void uploadCharacterSprite()}>
                          {saving ? "登録中…" : characterSprite ? "差し替えて反映" : "登録して反映"}
                        </button>
                        {characterSprite && <button className="button button-outline" type="button" disabled={saving} onClick={() => void deleteCharacterSprite()}>登録を解除</button>}
                      </div>
                    </div>
                    {exportProgress && (
                      <p className="admin-export-progress" role="status">
                        <span aria-hidden="true" />
                        {exportProgress}
                      </p>
                    )}
                    <dl className="admin-story">
                      <div>
                        <dt>映像の目的</dt>
                        <dd>{order.purpose}</dd>
                      </div>
                      <div>
                        <dt>犬種・年齢</dt>
                        <dd>
                          {order.breed} · {order.age_text || "未入力"}
                        </dd>
                      </div>
                      <div>
                        <dt>性格</dt>
                        <dd>{order.personality.join("、") || "未入力"}</dd>
                      </div>
                      <div>
                          <dt>物語の数</dt>
                        <dd>
                          {memories.length
                            ? `${memories.length}件`
                            : "旧形式の受付"}
                        </dd>
                      </div>
                      {memories.length === 0 && (
                        <>
                          <div>
                            <dt>はじめて会った日</dt>
                            <dd>{order.first_meeting || "未入力"}</dd>
                          </div>
                          <div>
                            <dt>いちばんの思い出</dt>
                            <dd>{order.favorite_memory || "未入力"}</dd>
                          </div>
                        </>
                      )}
                      <div>
                        <dt>伝えたい言葉</dt>
                        <dd>{order.message_to_pet || "未入力"}</dd>
                      </div>
                      {order.avoid_notes && (
                        <div>
                          <dt>入れたくないこと（旧形式）</dt>
                          <dd>{order.avoid_notes}</dd>
                        </div>
                      )}
                      <div>
                        <dt>人物写真の取り扱い</dt>
                        <dd>
                          {order.contains_people === null
                            ? "固定ポリシー：お顔は使用せず、後ろ姿などのみ"
                            : `旧形式の記録：${order.contains_people ? "人物あり" : "人物なし"} · ${peopleHandlingLabel(order.people_handling)} · 未成年者${order.contains_minors ? "あり" : "なし"}`}
                        </dd>
                      </div>
                      <div>
                        <dt>規約・Privacy同意</dt>
                        <dd>
                          {order.consented_at
                            ? `${formatDateTime(order.consented_at)} · 規約 ${order.terms_version} / Privacy ${order.privacy_version}`
                            : "同意記録なし"}
                        </dd>
                      </div>
                      <div>
                        <dt>写真使用権限・人物の了解</dt>
                        <dd>
                          {order.photo_rights_consented_at
                            ? `${formatDateTime(order.photo_rights_consented_at)} · ${order.photo_rights_consent_version}`
                            : "同意記録なし"}
                        </dd>
                      </div>
                      <div>
                        <dt>外部AI処理同意</dt>
                        <dd>
                          {order.external_ai_consent_at
                            ? `${formatDateTime(order.external_ai_consent_at)} · Notice ${order.ai_notice_version}`
                            : "同意記録なし"}
                        </dd>
                      </div>
                    </dl>
                    {memories.length > 0 && (
                      <div className="admin-memory-list">
                        {memories.map((memory) => {
                          const memoryPhotos = sourceAssets
                            .filter((asset) => asset.memory_id === memory.id)
                            .sort(
                              (a, b) =>
                                (a.memory_photo_sort_order ?? 99) -
                                (b.memory_photo_sort_order ?? 99),
                            );
                          return (
                            <article key={memory.id}>
                              <header>
                                <span>
                                  MEMORY{" "}
                                  {String(memory.sort_order).padStart(2, "0")}
                                </span>
                                <strong>{memory.title}</strong>
                                <small>{memoryPhotos.length}枚</small>
                              </header>
                              <dl>
                                <div>
                                  <dt>時期</dt>
                                  <dd>{memory.when_text || "指定なし"}</dd>
                                </div>
                                <div>
                                  <dt>場所</dt>
                                  <dd>{memory.location || "指定なし"}</dd>
                                </div>
                                <div>
                                  <dt>詳しい内容</dt>
                                  <dd>{memory.description}</dd>
                                </div>
                                {memory.dog_behavior && (
                                  <div>
                                    <dt>表情・動き（旧形式）</dt>
                                    <dd>{memory.dog_behavior}</dd>
                                  </div>
                                )}
                              </dl>
                              <div className="admin-memory-photos">
                                {memoryPhotos.map((asset) => (
                                  <article
                                    className={
                                      asset.memory_photo_sort_order === 1
                                        ? "primary"
                                        : ""
                                    }
                                    key={asset.id}
                                  >
                                    <a
                                      href={assetUrls[asset.id]}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {assetUrls[asset.id] ? (
                                        <span
                                          className="admin-photo-thumb"
                                          role="img"
                                          aria-label={`${memory.title}の写真`}
                                          style={{
                                            backgroundImage: `url(${assetUrls[asset.id]})`,
                                          }}
                                        />
                                      ) : (
                                        <span>読み込み中</span>
                                      )}
                                      <small>
                                        {asset.memory_photo_sort_order === 1
                                          ? "基準写真"
                                          : `補助写真 ${(asset.memory_photo_sort_order ?? 2) - 1}`} · {asset.original_filename}
                                      </small>
                                    </a>
                                    {canManageStorySources &&
                                      asset.memory_photo_sort_order !== 1 && (
                                        <button
                                          type="button"
                                          disabled={saving}
                                          onClick={() =>
                                            void makeAdminStoryPhotoPrimary(
                                              memory,
                                              asset,
                                            )
                                          }
                                        >
                                          基準写真に変更
                                        </button>
                                      )}
                                  </article>
                                ))}
                              </div>
                              <p className="admin-memory-check">
                                1枚目だけでこの物語の構図・季節・場所が分かるか確認します。補助写真は不足する特徴だけを見るために使います。
                              </p>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="admin-card" id="admin-photos">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">CUSTOMER PHOTOS</p>
                        <h3>写真一覧</h3>
                      </div>
                      <span>{sourceAssets.length}枚</span>
                    </div>
                    {sourceAssets.length ? (
                      <>
                        <div className="admin-photo-grid">
                          {sourceAssets.map((asset) => (
                            <a
                              href={assetUrls[asset.id]}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`${asset.original_filename}を大きく表示`}
                              key={asset.id}
                            >
                              {assetUrls[asset.id] ? (
                                <span
                                  className="admin-photo-thumb"
                                  role="img"
                                  aria-label={`${order.pet_name}ちゃんの提出写真`}
                                  style={{
                                    backgroundImage: `url(${assetUrls[asset.id]})`,
                                  }}
                                />
                              ) : (
                                <span>読み込み中</span>
                              )}
                              <small>
                                {asset.original_filename}
                                {asset.memory_id
                                  ? " · 思い出に紐付け済み"
                                  : " · 追加写真"}
                              </small>
                            </a>
                          ))}
                        </div>
                        <p className="admin-operation-note">
                          すべての写真は物語に紐づいています。追加をお願いするのは、その物語の制作に本当に必要な情報が足りない場合だけです。
                        </p>
                      </>
                    ) : (
                      <p className="admin-empty-copy">
                        写真はまだ登録されていません。各物語に最低1枚の場面写真が必要です。
                      </p>
                    )}
                  </section>

                  <section className="admin-card" id="admin-concepts">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">STORY DIRECTION DELIVERY</p>
                        <h3>物語案2案</h3>
                      </div>
                      <span>{concepts.length}/2 保存済み</span>
                    </div>
                    {order.selected_concept_slot ? (
                      <aside className="admin-operation-note strong">
                        <strong>
                          お客様が構成案 {order.selected_concept_slot}
                          を選択しました。
                        </strong>
                        <span>
                          {concepts.find(
                            (concept) =>
                              concept.slot === order.selected_concept_slot,
                          )?.title ?? ""}
                        </span>
                      </aside>
                    ) : (
                      concepts.length === 2 && (
                        <aside className="admin-operation-note">
                          まだお客様の選択待ちです。選択されるとここに表示されます。
                        </aside>
                      )
                    )}
                    {order.status === "materials_submitted" &&
                      photoAnalysisApproved && (
                        <aside className="admin-operation-note strong">
                          <strong>公開時に確認工程を自動で開始します。</strong>
                          <span>
                            物語案を公開すると、進行状況を「写真とお話を確認しています」から「物語案2案をご確認ください」へ順番に記録します。
                          </span>
                        </aside>
                      )}
                    {!conceptPublishingStatusValid && (
                      <aside className="admin-operation-note warning">
                        <strong>現在の工程では公開できません。</strong>
                        <span>
                          進行状況「{ORDER_STATUS_LABELS[order.status]}
                          」を確認してください。制作開始後に内容を変更する場合は、先に適切な工程へ戻す必要があります。
                        </span>
                      </aside>
                    )}
                    <div className="admin-concept-json-import">
                      <div className="admin-concept-json-import-head">
                        <div>
                          <strong>Codex에서 받은 구성안 JSON 불러오기</strong>
                          <small>
                            JSON을 붙여넣거나 파일을 선택하면 A·B안의 제목·톤·개요·5개 장면이 아래 폼에 자동으로 연결됩니다.
                          </small>
                        </div>
                        <label className="button button-secondary admin-concept-json-file">
                          JSON 파일 선택
                          <input type="file" accept="application/json,.json" onChange={handleConceptJsonFile} />
                        </label>
                      </div>
                      <textarea
                        rows={6}
                        value={conceptJsonDraft}
                        onChange={(event) => {
                          setConceptJsonDraft(event.target.value);
                          setConceptJsonStatus("");
                        }}
                        placeholder={'{"concept_a":{"title":"...","tone":"...","summary":"...","story_scenes":[...]},"concept_b":{...}}'}
                      />
                      <div className="admin-concept-json-actions">
                        <button className="button button-secondary" type="button" onClick={() => importConceptJson()} disabled={!conceptJsonDraft.trim() || saving}>
                          JSONを自動マッチする
                        </button>
                        {conceptJsonStatus && <span className="admin-operation-note strong">{conceptJsonStatus}</span>}
                      </div>
                    </div>
                    <div className="admin-concepts">
                      {(
                        [
                          ["A", conceptA, setConceptA],
                          ["B", conceptB, setConceptB],
                        ] as const
                      ).map(([slot, value, setter]) => (
                        <div
                          className={
                            order.selected_concept_slot === slot
                              ? "selected"
                              : ""
                          }
                          key={slot}
                        >
                          <strong>
                            構成案 {slot}
                            {order.selected_concept_slot === slot && (
                              <span className="admin-concept-selected-badge">
                                お客様が選択
                              </span>
                            )}
                          </strong>
                          <label>
                            <span>タイトル</span>
                            <input
                              value={value.title}
                              onChange={(event) =>
                                setter({ ...value, title: event.target.value })
                              }
                              placeholder={`${order.pet_name}と歩いた季節`}
                            />
                          </label>
                          <label>
                            <span>トーン</span>
                            <input
                              value={value.tone}
                              onChange={(event) =>
                                setter({ ...value, tone: event.target.value })
                              }
                              placeholder="やわらかな水彩とガッシュ、静かな春の余韻"
                            />
                          </label>
                          <label>
                            <span>概要</span>
                            <textarea
                              rows={4}
                              value={value.summary}
                              onChange={(event) =>
                                setter({
                                  ...value,
                                  summary: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>5つの物語の場面</span>
                            <small>
                              すべて入力すると公開できます。顧客が送った物語と必ず1対1で紐づきます。
                            </small>
                          </label>
                          <div className="admin-concept-story-scenes">
                            {memories.map((memory) => (
                              <label key={`${slot}-${memory.id}`}>
                                <span>
                                  MEMORY{" "}
                                  {String(memory.sort_order).padStart(2, "0")} ·{" "}
                                  {memory.title}
                                </span>
                                <textarea
                                  rows={3}
                                  value={value.storyScenes[memory.id] ?? ""}
                                  onChange={(event) =>
                                    setter({
                                      ...value,
                                      storyScenes: {
                                        ...value.storyScenes,
                                        [memory.id]: event.target.value,
                                      },
                                    })
                                  }
                                  placeholder="この物語をどのような絵本場面としてつなぐか入力"
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={
                        saving ||
                        !photoAnalysisApproved ||
                        !conceptPublishingStatusValid
                      }
                      onClick={saveConcepts}
                    >
                      物語案2案を顧客へ公開する →
                    </button>
                  </section>

                  <section className="admin-card" id="admin-stills">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">STORYBOOK PAGES</p>
                        <h3>絵本ページと文章の確認依頼</h3>
                      </div>
                      <span>
                        {sceneStills.length}枚 · 確認版{" "}
                        {order.stills_review_version} · 調整{" "}
                        {order.stills_revision_used}/
                        {order.stills_revision_limit}回
                      </span>
                    </div>
                    <aside className="admin-operation-note strong">
                      <strong>
                        動画化の前に、絵本ページと物語の文章をお客様へ確認してもらいます。
                      </strong>
                      <span>
                        各ページには短い物語文が必要です。この文章はお客様の確認画面に表示され、承認後は自動編集で映像の字幕になります。
                      </span>
                    </aside>
                    <ol className="admin-stills-flow" aria-label="絵本ページの確認フロー">
                      <li><strong>1</strong><span>管理者が画像と物語文を追加</span></li>
                      <li><strong>2</strong><span>「公開する」で顧客へ通知</span></li>
                      <li><strong>3</strong><span>顧客が承認または調整依頼</span></li>
                    </ol>
                    {order.status === "stills_review" &&
                    order.stills_change_open ? (
                      <aside className="admin-operation-note warning">
                        <strong>
                          お客様から絵本ページの調整依頼があります。
                        </strong>
                        <span>
                          先に調整作業を開始し、差し替え後に改めて公開してください。再公開するまでお客様は承認できません。
                        </span>
                        <button
                          className="button button-primary"
                          type="button"
                          disabled={saving}
                          onClick={beginStillsRevision}
                        >
                          調整を開始する →
                        </button>
                      </aside>
                    ) : order.status === "stills_review" ? (
                      <aside className="admin-operation-note strong">
                        <strong>お客様の確認待ちです。</strong>
                        <span>
                          公開済みの絵本ページと文章は、確認中に差し替えできません。
                        </span>
                      </aside>
                    ) : (
                      !canPrepareStills && (
                        <aside className="admin-operation-note warning">
                          <strong>絵本ページを管理できません。</strong>
                          <span>
                            {!photoAnalysisApproved
                              ? "先に物語ごとの制作素材を承認してください。"
                              : order.payment_status !== "paid"
                                ? "先に入金確認を保存してください。"
                                : !consentCurrent
                                  ? "お客様による現在版の同意記録が必要です。"
                                  : "物語案の選択後に管理できます。"}
                          </span>
                        </aside>
                      )
                    )}
                    {order.stills_approved_at && (
                      <aside className="admin-operation-note strong">
                        <strong>
                          お客様が絵本ページと文章を確定済みです。
                        </strong>
                        <span>
                          {formatDateTime(order.stills_approved_at)} · 確認版{" "}
                          {order.stills_approved_version ??
                            order.stills_review_version}{" "}
                          を承認済みです。映像制作へ進めてください。
                        </span>
                      </aside>
                    )}
                    {sceneStills.length > 0 && (
                      <div className="admin-photo-grid">
                        {sceneStills.map((asset) => (
                          <div className="admin-still-item" key={asset.id}>
                            {assetUrls[asset.id] ? (
                              <a
                                href={assetUrls[asset.id]}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <span
                                  className="admin-photo-thumb"
                                  role="img"
                                  aria-label={
                                    asset.scene_title ?? asset.original_filename
                                  }
                                  style={{
                                    backgroundImage: `url(${assetUrls[asset.id]})`,
                                  }}
                                />
                              </a>
                            ) : (
                              <span>読み込み中</span>
                            )}
                            <small>
                              {String(asset.scene_sort_order + 1).padStart(
                                2,
                                "0",
                              )}{" "}
                              · {asset.scene_title ?? asset.original_filename}
                            </small>
                            {canPrepareStills ? (
                              <label className="admin-scene-caption-editor">
                                <span>このページの物語文</span>
                                <textarea
                                  rows={3}
                                  maxLength={120}
                                  value={captionDrafts[asset.id] ?? ""}
                                  onChange={(event) =>
                                    setCaptionDrafts((current) => ({
                                      ...current,
                                      [asset.id]: event.target.value,
                                    }))
                                  }
                                />
                                <button
                                  className="button button-outline"
                                  type="button"
                                  disabled={
                                    saving ||
                                    !(captionDrafts[asset.id] ?? "").trim() ||
                                    (captionDrafts[asset.id] ?? "").trim() ===
                                      (asset.story_caption ?? "")
                                  }
                                  onClick={() => saveSceneCaption(asset)}
                                >
                                  文章を保存
                                </button>
                              </label>
                            ) : (
                              <p className="admin-scene-caption">
                                {asset.story_caption ?? "物語文なし"}
                              </p>
                            )}
                            {canPrepareStills && (
                              <button
                                className="button button-outline"
                                type="button"
                                disabled={saving}
                                onClick={() => deleteSceneStill(asset)}
                              >
                                削除
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {canPrepareStills && (
                      <div className="admin-still-upload-grid">
                        {memories.map((memory, index) => {
                          const registeredStill = sceneStills.find(
                            (asset) => asset.scene_sort_order === index,
                          );
                          const selectedFile = stillFiles[memory.id];
                          const caption = stillCaptions[memory.id] ?? "";
                          return (
                            <article
                              className={`admin-still-upload-card${
                                registeredStill ? " complete" : ""
                              }`}
                              key={memory.id}
                            >
                              <header>
                                <span>
                                  PAGE {String(index + 1).padStart(2, "0")}
                                </span>
                                <strong>{memory.title}</strong>
                                <small>
                                  {registeredStill ? "登録済み" : "未登録"}
                                </small>
                              </header>
                              {registeredStill ? (
                                <div className="admin-still-upload-complete">
                                  <p>
                                    画像と物語文を登録済みです。差し替える場合は、上の登録済みページを削除してください。
                                  </p>
                                  <span>
                                    {registeredStill.story_caption ??
                                      "物語文が未入力です。上の欄で保存してください。"}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <label>
                                    <span>画像ファイル（JPG / PNG / WebP）</span>
                                    <input
                                      key={stillInputKeys[memory.id] ?? 0}
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      disabled={saving}
                                      onChange={(event) =>
                                        setStillFiles((current) => ({
                                          ...current,
                                          [memory.id]:
                                            event.target.files?.[0] ?? null,
                                        }))
                                      }
                                    />
                                  </label>
                                  <label>
                                    <span>
                                      このページの物語文{" "}
                                      <small>お客様確認・映像字幕用</small>
                                    </span>
                                    <textarea
                                      rows={3}
                                      value={caption}
                                      maxLength={120}
                                      onChange={(event) =>
                                        setStillCaptions((current) => ({
                                          ...current,
                                          [memory.id]: event.target.value,
                                        }))
                                      }
                                      placeholder="画像制作時に返された日本語の一文を貼り付けてください。"
                                    />
                                  </label>
                                  <button
                                    className="button button-outline"
                                    type="button"
                                    disabled={
                                      saving ||
                                      !selectedFile ||
                                      !caption.trim()
                                    }
                                    onClick={() =>
                                      uploadSceneStill(memory, index)
                                    }
                                  >
                                    {saving
                                      ? "追加中…"
                                      : `ページ${index + 1}を追加`}
                                  </button>
                                </>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                    {canPrepareStills && (
                      <div className="admin-still-actions">
                        <button
                          className="button button-primary"
                          type="button"
                          disabled={saving || !allSceneCaptionsReady}
                          onClick={publishSceneStills}
                        >
                          絵本ページと文章を公開する →
                        </button>
                      </div>
                    )}
                    <p className="admin-operation-note">
                      お客様の調整依頼は再公開するまで承認を止めます。公開後にメッセージを「対応済み」にし、確認版ごとに承認記録を残します。
                    </p>
                  </section>

                  <section className="admin-card" id="admin-render">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">STORYBOOK ASSEMBLY</p>
                        <h3>映像の自動編集</h3>
                      </div>
                      <span>
                        {assemblyClipCount}/5本
                        {` · 完成約${estimatedSeconds}秒`}
                      </span>
                    </div>

                    {!renderAvailable && (
                      <aside className="admin-operation-note warning">
                        <strong>この環境では編集を実行できません。</strong>
                        <span>
                          映像の編集はローカルの制作環境でのみ動作します。ターミナルで{" "}
                          <code>npm run dev:operator</code> を実行し、localhost
                          の管理画面から操作してください。
                        </span>
                      </aside>
                    )}

                    {renderAvailable && (
                      <aside className="admin-operation-note strong">
                        <strong>
                          5つの物語へ、合計5本のクリップを追加します。
                        </strong>
                        <span>
                          重要な3物語は各10秒の1本で完結します。残り2物語は各5秒で、物語の間だけページをめくります。
                        </span>
                      </aside>
                    )}

                    {renderAvailable && !canRenderFilm && (
                      <aside className="admin-operation-note warning">
                        <strong>まだ編集を開始できません。</strong>
                        <span>
                          {!photoAnalysisApproved
                            ? "先に物語ごとの制作素材を承認してください。"
                            : order.payment_status !== "paid"
                              ? "先に入金確認を保存してください。"
                              : !consentCurrent
                                ? "お客様による現在版の同意記録が必要です。"
                                : !order.stills_approved_at
                                  ? "お客様が絵本ページと文章を承認するまで編集できません。"
                                  : "進行状況を「約1分の映像を制作しています」へ進めてください。"}
                        </span>
                      </aside>
                    )}

                    {renderAvailable && sceneStills.length > 0 && (
                      <>
                        <p className="admin-render-section-label">
                          STORY · Gen-4（重要3本は10秒・他2本は5秒、合計5本）
                        </p>
                        <div className="admin-render-clips">
                          {sceneStills.map((still) => {
                            const takes: Array<1> = [1];
                            return (
                              <article
                                key={still.id}
                                className="admin-render-clip"
                              >
                              {assetUrls[still.id] ? (
                                <span
                                  className="admin-photo-thumb"
                                  role="img"
                                  aria-label={still.scene_title ?? "絵本ページ"}
                                  style={{
                                    backgroundImage: `url(${assetUrls[still.id]})`,
                                  }}
                                />
                              ) : (
                                <span className="admin-photo-thumb">
                                  読み込み中
                                </span>
                              )}
                              <div>
                                <strong>
                                  {String(still.scene_sort_order + 1).padStart(
                                    2,
                                    "0",
                                  )}{" "}
                                  · {still.scene_title ?? "場面"}
                                </strong>
                                <div className="admin-story-takes">
                                  {takes.map((take) => {
                                    const clip = clipByStillAndTake.get(
                                      `${still.id}:${take}`,
                                    );
                                    return (
                                      <section
                                        key={`${still.id}-take-${take}`}
                                        className={clip ? "ready" : ""}
                                      >
                                        <span>
                                          {expandedStorySortOrders.includes(
                                            still.scene_sort_order,
                                          )
                                            ? "Gen-4 · 10秒で完結"
                                            : "Gen-4 · 5秒で完結"}
                                        </span>
                                        {clip ? (
                                          <>
                                            {assetUrls[clip.id] && (
                                              <video
                                                className="admin-render-preview"
                                                src={assetUrls[clip.id]}
                                                controls
                                                preload="metadata"
                                              />
                                            )}
                                            <button
                                              className="button button-outline"
                                              type="button"
                                              disabled={
                                                saving ||
                                                rendering ||
                                                !canRenderFilm
                                              }
                                              onClick={() =>
                                                deleteRenderClip(clip)
                                              }
                                            >
                                              このクリップを削除
                                            </button>
                                          </>
                                        ) : (
                                          <label
                                            className={
                                              saving ||
                                              rendering ||
                                              !canRenderFilm
                                                ? "admin-render-upload disabled"
                                                : "admin-render-upload"
                                            }
                                          >
                                            <input
                                              key={`${clipInputKey}-${take}`}
                                              type="file"
                                              accept="video/mp4,video/quicktime,video/webm"
                                              disabled={
                                                saving ||
                                                rendering ||
                                                !canRenderFilm
                                              }
                                              onChange={(event) => {
                                                const file =
                                                  event.target.files?.[0];
                                                if (file)
                                                  uploadRenderClip(still, file);
                                              }}
                                            />
                                            <span>
                                              動画を選ぶ
                                            </span>
                                          </label>
                                        )}
                                      </section>
                                    );
                                  })}
                                </div>
                              </div>
                              </article>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {renderAvailable && sceneStills.length === 0 && (
                      <p className="admin-empty-copy">
                        先に絵本ページと文章を登録し、お客様の承認を受けてください。
                      </p>
                    )}

                    {renderAvailable && canRenderFilm && (
                      <>
                        <div className="admin-form-grid">
                          <label>
                            <span>映像のタイトル</span>
                            <input
                              value={filmTitle}
                              onChange={(event) =>
                                setFilmTitle(event.target.value)
                              }
                              maxLength={80}
                              disabled={rendering}
                            />
                          </label>
                          <label>
                            <span>小見出し</span>
                            <input
                              value={filmKicker}
                              onChange={(event) =>
                                setFilmKicker(event.target.value)
                              }
                              maxLength={40}
                              disabled={rendering}
                            />
                          </label>
                          <label className="wide">
                            <span>
                              エンディングの文章{" "}
                              <small>改行がそのまま行になります</small>
                            </span>
                            <textarea
                              rows={4}
                              value={filmEndingText}
                              onChange={(event) =>
                                setFilmEndingText(event.target.value)
                              }
                              maxLength={600}
                              disabled={rendering}
                            />
                          </label>
                          <label>
                            <span>エンディングの署名</span>
                            <input
                              value={filmEndingMark}
                              onChange={(event) =>
                                setFilmEndingMark(event.target.value)
                              }
                              maxLength={40}
                              disabled={rendering}
                            />
                          </label>
                          <label>
                            <span>BGM</span>
                            <select
                              value={filmBgm}
                              onChange={(event) =>
                                setFilmBgm(event.target.value)
                              }
                              disabled={rendering}
                            >
                              <option value="">BGMなし</option>
                              {bgmTracks.map((track) => (
                                <option key={track} value={track}>
                                  {track}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <aside className="admin-operation-note">
                          各絵本ページに保存した物語文は、場面の長さに合わせて自動でフェード表示されます。動く絵本の色と紙の質感を保つため、シネマ調の黒帯・粒子加工は使用しません。
                        </aside>
                        <div className="admin-still-actions">
                          <button
                            className="button button-primary"
                            type="button"
                            disabled={
                              saving || rendering || !allRenderClipsReady
                            }
                            onClick={startRender}
                          >
                            {rendering ? "編集中…" : "編集を開始する →"}
                          </button>
                        </div>
                        {assemblyClipCount > 0 && !allRenderClipsReady && (
                          <p className="admin-operation-note">
                            5つの物語クリップ（重要な3本は10秒、その他2本は5秒）がすべて揃うと編集を開始できます。
                          </p>
                        )}
                        {renderProgress && (
                          <p className="admin-export-progress" role="status">
                            {renderProgress}
                          </p>
                        )}
                        {rendering && (
                          <p className="admin-operation-note">
                            編集中はこのタブを閉じないでください。数分かかります。
                          </p>
                        )}
                      </>
                    )}

                    {assembledFilms.length > 0 && (
                      <div className="admin-video-history">
                        <strong>編集された映像</strong>
                        {assembledFilms.map((asset) => (
                          <div className="admin-render-result" key={asset.id}>
                            {assetUrls[asset.id] ? (
                              <video
                                src={assetUrls[asset.id]}
                                controls
                                preload="metadata"
                              />
                            ) : (
                              <span>読み込み中</span>
                            )}
                            <div>
                              <small>
                                {formatDate(asset.created_at)} ·{" "}
                                {(asset.file_size / 1024 / 1024).toFixed(1)} MB
                              </small>
                              <button
                                className="button button-primary"
                                type="button"
                                disabled={
                                  saving || rendering || !canUploadReview
                                }
                                onClick={() => promoteAssembledFilm(asset)}
                              >
                                確認映像として公開する →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="admin-operation-note">
                      編集された映像はお客様には表示されません。内容を確認したうえで「確認映像として公開する」を押すと、お客様の制作室に表示され、進行状況が「完成前の映像をご確認ください」へ進みます。
                    </p>
                  </section>

                  <section className="admin-card" id="admin-revisions">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">REVISION REQUESTS</p>
                        <h3>修正依頼</h3>
                      </div>
                      <span>
                        {order.revision_used}/{order.revision_limit}回使用
                      </span>
                    </div>
                    {revisions.length ? (
                      <div className="admin-work-list">
                        {revisions.map((revision) => (
                          <article key={revision.id}>
                            <div>
                              <span
                                className={
                                  revision.status === "open"
                                    ? "work-status open"
                                    : "work-status"
                                }
                              >
                                {revision.status === "open"
                                  ? "対応が必要"
                                  : "対応済み"}
                              </span>
                              <small>{formatDate(revision.created_at)}</small>
                            </div>
                            <strong>{revision.category}</strong>
                            <p>{revision.body}</p>
                            {revision.status === "open" && (
                              <button
                                className="button button-outline"
                                type="button"
                                disabled={saving}
                                onClick={() => resolveRevision(revision.id)}
                              >
                                対応完了にする
                              </button>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="admin-empty-copy">
                        修正依頼はまだありません。
                      </p>
                    )}
                    <p className="admin-operation-note">
                      修正版を「完成前の確認映像」として公開してから、該当依頼を対応完了にしてください。上限はDBでも
                      {order.revision_limit}回に制限されています。
                    </p>
                  </section>

                  <section className="admin-card" id="admin-metrics">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">FIRST 10 METRICS</p>
                        <h3>制作コストの記録</h3>
                      </div>
                      <span>運営者のみ</span>
                    </div>
                    <p className="admin-operation-note">
                      最初の10組は、実制作にかかった時間とRunway使用量を残します。次の料金・制作枠を判断するための内部メモで、お客様には表示されません。
                    </p>
                    <div className="admin-form-grid">
                      <label>
                        <span>制作時間（分）</span>
                        <input
                          type="number"
                          min="0"
                          value={productionWorkMinutes}
                          onChange={(event) =>
                            setProductionWorkMinutes(Number(event.target.value))
                          }
                        />
                      </label>
                      <label>
                        <span>Runway使用クレジット</span>
                        <input
                          type="number"
                          min="0"
                          value={runwayCreditsUsed}
                          onChange={(event) =>
                            setRunwayCreditsUsed(Number(event.target.value))
                          }
                        />
                      </label>
                      <label>
                        <span>生成回数</span>
                        <input
                          type="number"
                          min="0"
                          value={runwayGenerationCount}
                          onChange={(event) =>
                            setRunwayGenerationCount(Number(event.target.value))
                          }
                        />
                      </label>
                      <label>
                        <span>再生成回数</span>
                        <input
                          type="number"
                          min="0"
                          value={runwayRetryCount}
                          onChange={(event) =>
                            setRunwayRetryCount(Number(event.target.value))
                          }
                        />
                      </label>
                      <label className="wide">
                        <span>制作メモ（任意）</span>
                        <textarea
                          rows={3}
                          maxLength={3000}
                          value={productionLog}
                          onChange={(event) =>
                            setProductionLog(event.target.value)
                          }
                          placeholder="例：外見テストを2回作成。リードの形を修正して3回目を採用。"
                        />
                      </label>
                    </div>
                    <button
                      className="button button-outline"
                      type="button"
                      disabled={saving}
                      onClick={saveProductionMetrics}
                    >
                      制作記録を保存
                    </button>
                  </section>

                  <section className="admin-card" id="admin-video">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">VIDEO WORKFLOW</p>
                        <h3>
                          {videoMode === "review"
                            ? "完成前の確認映像"
                            : "完成映像の最終納品"}
                        </h3>
                      </div>
                      <span>MP4 / MOV / WebM</span>
                    </div>
                    <div className="admin-video-tabs">
                      <button
                        type="button"
                        className={videoMode === "review" ? "active" : ""}
                        onClick={() => {
                          setVideoMode("review");
                          clearVideo();
                        }}
                      >
                        1. 顧客確認用
                      </button>
                      <button
                        type="button"
                        className={videoMode === "final" ? "active" : ""}
                        onClick={() => {
                          setVideoMode("final");
                          clearVideo();
                        }}
                      >
                        2. 最終納品
                      </button>
                    </div>
                    {videoMode === "review" ? (
                      <>
                        <aside className="admin-operation-note strong">
                          <strong>
                            このアップロードでは納品済みになりません。
                          </strong>
                          <span>
                            お客様の制作室に確認映像を表示し、状態を「完成前の映像をご確認ください」へ進めます。
                          </span>
                        </aside>
                        {!canUploadReview && (
                          <aside className="admin-operation-note warning">
                            <strong>確認映像を公開できません。</strong>
                            <span>
                              {order.payment_status !== "paid"
                                ? "先に入金確認を保存してください。"
                                : !consentCurrent
                                  ? "お客様による現在版の同意記録が必要です。"
                                  : "物語案の選択後、進行状況を「動く絵本を制作しています」へ進めてください。"}
                            </span>
                          </aside>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="admin-form-grid">
                          <label>
                            <span>完成映像のタイトル</span>
                            <input
                              value={deliveryTitle}
                              onChange={(event) =>
                                setDeliveryTitle(event.target.value)
                              }
                            />
                          </label>
                          <label className="wide">
                            <span>お客様へのメッセージ</span>
                            <textarea
                              rows={3}
                              value={deliveryMessage}
                              onChange={(event) =>
                                setDeliveryMessage(event.target.value)
                              }
                            />
                          </label>
                        </div>
                        {!canUploadFinal && (
                          <aside className="admin-operation-note warning">
                            <strong>まだ最終納品できません。</strong>
                            <span>
                              {order.payment_status !== "paid"
                                ? "入金確認が必要です。"
                                : !consentCurrent
                                  ? "現在版の同意記録が必要です。"
                                  : openRevisions.length
                                    ? "未対応の修正依頼をすべて解決してください。"
                                    : !order.customer_approved_at
                                      ? "お客様が確認映像の「この映像で確定する」を押すまでお待ちください。"
                                      : "お客様が承認した映像と制作工程を確認してください。"}
                            </span>
                          </aside>
                        )}
                      </>
                    )}
                    <label
                      className={
                        saving ||
                        (videoMode === "review"
                          ? !canUploadReview
                          : !canUploadFinal)
                          ? "admin-video-upload disabled"
                          : "admin-video-upload"
                      }
                    >
                      <input
                        key={videoInputKey}
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        disabled={
                          saving ||
                          (videoMode === "review"
                            ? !canUploadReview
                            : !canUploadFinal)
                        }
                        onChange={selectVideo}
                      />
                      <strong>
                        {videoFile
                          ? "別の映像を選ぶ"
                          : videoMode === "review"
                            ? "確認映像を選ぶ"
                            : "完成映像を選ぶ"}
                      </strong>
                      <small>
                        選択しただけでは公開・納品されません。次の確認欄で確定します。
                      </small>
                    </label>
                    {videoFile && (
                      <div
                        className="admin-delivery-review"
                        role="group"
                        aria-label="映像アップロードの最終確認"
                      >
                        <p className="eyebrow">UPLOAD CHECK</p>
                        <h4>
                          {videoMode === "review"
                            ? "まだ顧客へ公開されていません"
                            : "まだ納品されていません"}
                        </h4>
                        <dl>
                          <div>
                            <dt>お客様</dt>
                            <dd>
                              {order.pet_name}ちゃん ·{" "}
                              {customer?.full_name ||
                                customer?.email ||
                                "登録ユーザー"}
                            </dd>
                          </div>
                          <div>
                            <dt>ファイル</dt>
                            <dd>{videoFile.name}</dd>
                          </div>
                          <div>
                            <dt>サイズ</dt>
                            <dd>
                              {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                            </dd>
                          </div>
                          <div>
                            <dt>用途</dt>
                            <dd>
                              {videoMode === "review"
                                ? "完成前の顧客確認"
                                : "最終納品"}
                            </dd>
                          </div>
                        </dl>
                        <label className="admin-delivery-check">
                          <input
                            type="checkbox"
                            checked={videoChecked}
                            onChange={(event) =>
                              setVideoChecked(event.target.checked)
                            }
                          />
                          <span>お客様名・ファイル名・用途を確認しました</span>
                        </label>
                        <div>
                          <button
                            className="button button-outline"
                            type="button"
                            disabled={saving}
                            onClick={clearVideo}
                          >
                            選び直す
                          </button>
                          <button
                            className="button button-primary"
                            type="button"
                            disabled={
                              saving ||
                              !videoChecked ||
                              (videoMode === "review"
                                ? !canUploadReview
                                : !canUploadFinal)
                            }
                            onClick={uploadVideo}
                          >
                            {saving
                              ? "アップロード中…"
                              : videoMode === "review"
                                ? "確認映像として公開する →"
                                : "確認した内容で納品する →"}
                          </button>
                        </div>
                      </div>
                    )}
                    {reviewVideos.length > 0 && (
                      <div className="admin-video-history">
                        <strong>公開済みの確認映像</strong>
                        {reviewVideos.map((asset) => (
                          <a
                            href={assetUrls[asset.id]}
                            target="_blank"
                            rel="noreferrer"
                            key={asset.id}
                          >
                            {asset.original_filename}
                            <small>{formatDate(asset.created_at)}</small>
                          </a>
                        ))}
                      </div>
                    )}
                    {videoMode === "final" && finalVideos.length > 0 && (
                      <div className="admin-video-history">
                        <strong>登録済みの完成映像</strong>
                        {finalVideos.map((asset) => (
                          <div className="admin-video-retry" key={asset.id}>
                            <a
                              href={assetUrls[asset.id]}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {asset.original_filename}
                              <small>{formatDate(asset.created_at)}</small>
                            </a>
                            <button
                              className="button button-outline"
                              type="button"
                              disabled={saving || !canUploadFinal}
                              onClick={() => retryDelivery(asset)}
                            >
                              この映像で納品を再試行
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section
                    className="admin-card admin-danger-card"
                    id="admin-danger"
                  >
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">ORDER CANCELLATION</p>
                        <h3>キャンセル・データ削除</h3>
                      </div>
                      <span>取り消せない操作</span>
                    </div>

                    {order.status === "cancelled" ? (
                      <>
                        <aside className="admin-operation-note warning">
                          <strong>この注文はキャンセル済みです。</strong>
                          <span>
                            進行状況を元に戻すことはできません。お客様の写真・映像を消す場合は下の操作を使ってください。
                          </span>
                        </aside>

                        <div className="admin-danger-action">
                          <div>
                            <strong>お客様の写真・映像を削除する</strong>
                            <span>
                              お預かりした写真と映像をすべて消します。注文番号・金額・お支払い履歴は帳簿用に残ります。
                            </span>
                          </div>
                          <button
                            className="button button-outline"
                            type="button"
                            disabled={saving}
                            onClick={purgeOrderFiles}
                          >
                            写真・映像を削除する
                          </button>
                        </div>

                        <div className="admin-danger-action">
                          <div>
                            <strong>注文を完全に削除する</strong>
                            {order.payment_status === "pending" ? (
                              <span>
                                写真・メッセージ・履歴を含めてすべて消えます。確認のため注文番号
                                <code>{order.order_number}</code>
                                を入力してください。
                              </span>
                            ) : (
                              <span>
                                この注文にはお支払い履歴があるため、完全削除はできません。上の「写真・映像を削除する」をご利用ください。
                              </span>
                            )}
                          </div>
                          {order.payment_status === "pending" && (
                            <div className="admin-danger-confirm">
                              <input
                                value={deleteConfirmNumber}
                                onChange={(event) =>
                                  setDeleteConfirmNumber(event.target.value)
                                }
                                placeholder={order.order_number}
                                aria-label="確認用の注文番号"
                              />
                              <button
                                className="button button-danger"
                                type="button"
                                disabled={
                                  saving ||
                                  deleteConfirmNumber.trim() !==
                                    order.order_number
                                }
                                onClick={deleteOrder}
                              >
                                完全に削除する
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    ) : order.status === "delivered" ? (
                      <aside className="admin-operation-note warning">
                        <strong>納品済みの注文はキャンセルできません。</strong>
                        <span>
                          返金や取り消しが必要な場合は、決済側の対応とあわせてご検討ください。
                        </span>
                      </aside>
                    ) : (
                      <>
                        <aside className="admin-operation-note warning">
                          <strong>キャンセルすると元に戻せません。</strong>
                          <span>
                            制作は停止し、お客様の制作室でも進行できなくなります。写真などのデータはキャンセル後に別途削除できます。
                          </span>
                        </aside>
                        {order.payment_status === "paid" && (
                          <aside className="admin-operation-note warning">
                            <strong>お支払い済みの注文です。</strong>
                            <span>
                              返金はStripe側での対応が必要です。キャンセル操作では返金されません。
                            </span>
                          </aside>
                        )}
                        <label className="admin-danger-reason">
                          <span>キャンセル理由（記録に残ります）</span>
                          <textarea
                            rows={2}
                            value={cancelReason}
                            maxLength={500}
                            onChange={(event) =>
                              setCancelReason(event.target.value)
                            }
                            placeholder="例：お客様のご都合により取り消しのご依頼"
                          />
                        </label>
                        <button
                          className="button button-danger"
                          type="button"
                          disabled={saving || !cancelReason.trim()}
                          onClick={cancelOrder}
                        >
                          この注文をキャンセルする
                        </button>
                      </>
                    )}
                  </section>
                </div>
                <aside
                  className="admin-card admin-chat-panel"
                  id="admin-message"
                >
                  <div className="card-head">
                    <div>
                      <p className="eyebrow">MESSAGES</p>
                      <h3>お客様との連絡</h3>
                    </div>
                    <span>{openMessages.length}件 未対応</span>
                  </div>
                  <p className="admin-chat-guide">
                    ここから送った内容は制作室に保存され、お客様にはメールでも新着をお知らせします。
                  </p>
                  {customerInputPending && (
                    <aside className="admin-operation-note warning">
                      <strong>
                        送信すると「お客様へ追加確認が必要」へ変更します。
                      </strong>
                      <span>
                        確認したい内容を書いてから送信してください。まだ状態は変わっていません。
                        <button
                          type="button"
                          className="admin-inline-cancel"
                          onClick={cancelCustomerInputRequest}
                        >
                          この連絡を取りやめる
                        </button>
                      </span>
                    </aside>
                  )}
                  <div
                    className="admin-work-list admin-message-list"
                    ref={messageListRef}
                  >
                    {messages.length ? (
                      messages.map((message) => {
                        const fromCustomer =
                          message.sender_id === order.user_id;
                        return (
                          <article
                            className={fromCustomer ? "customer" : "admin"}
                            key={message.id}
                          >
                            <div>
                              <span
                                className={
                                  fromCustomer && message.status === "open"
                                    ? "work-status open"
                                    : "work-status"
                                }
                              >
                                {fromCustomer
                                  ? message.status === "open"
                                    ? "未対応"
                                    : "対応済み"
                                  : "運営から送信"}
                              </span>
                              <small>
                                {formatDateTime(message.created_at)}
                              </small>
                            </div>
                            <p>{message.body}</p>
                            {fromCustomer && message.status === "open" && (
                              <button
                                className="button button-outline"
                                type="button"
                                disabled={saving}
                                onClick={() => resolveMessage(message.id)}
                              >
                                対応済みにする
                              </button>
                            )}
                          </article>
                        );
                      })
                    ) : (
                      <p className="admin-empty-copy">
                        メッセージはまだありません。
                      </p>
                    )}
                  </div>
                  <form className="admin-message-form" onSubmit={sendMessage}>
                    <label>
                      <span>お客様へのメッセージ</span>
                      <textarea
                        ref={messageComposerRef}
                        name="body"
                        rows={5}
                        maxLength={3000}
                        value={messageDraft}
                        onChange={(event) =>
                          setMessageDraft(event.target.value)
                        }
                        placeholder="追加写真のお願い、確認事項、進行状況など"
                      />
                      <small>
                        メール本文には内容を載せず、制作室に新着があることだけをお知らせします。
                      </small>
                    </label>
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={saving || !messageDraft.trim()}
                    >
                      {saving
                        ? "送信中…"
                        : customerInputPending
                          ? "送信して追加確認へ変更する →"
                          : "メッセージを送る"}
                    </button>
                  </form>
                </aside>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
