# WAN MEMORY 출시 체크리스트

아래 순서를 모두 통과하기 전에는 공개 신청 버튼을 활성화하지 않습니다.

## 1. 데이터베이스 준비

- 신청 접수는 계속 「準備中」으로 유지하고, 배포 작업 중 신규 주문을 받지 않는다.
- 운영 DB 백업 또는 복구 지점을 생성한다.
- 마이그레이션은 **`supabase db push`로만 적용한다.** 먼저 `supabase db push --dry-run`으로 적용 대상을 확인한다.
  - SQL Editor에 직접 붙여넣지 않는다. 직접 실행하면 `supabase_migrations.schema_migrations` 이력이 남지 않아, 다음 `db push`가 이미 적용된 파일을 다시 실행하려 한다.
  - 부득이하게 직접 실행했다면 `supabase migration repair --status applied <버전>`으로 이력을 맞춘 뒤, `supabase migration list`에서 Local과 Remote가 일치하는지 확인한다.
- `202607220001_appearance_photo_review.sql` 적용 후 `orders`에 대표 얼굴·전신·선택 시기·사진 분석 상태 컬럼과 관련 RPC가 생성됐는지 확인한다.
- `202607250001`〜`202607250003` 적용 후 다음을 확인한다: `orders.status`에 `stills_review` 허용, `assets.category`에 `scene_still` 허용, `order_memories.dog_behavior`가 nullable, `order_has_current_consents`가 통합 동의 버전(`2026-07-25-photo-people-v2`)을 요구.
- SQL Editor에서 `select public.bootstrap_first_admin('ggutae0@gmail.com');`를 실행한다. 이미 관리자가 있으면 실패하는 것이 정상이다.
- `profiles`에서 정상 로그인할 관리자 1명 이상을 확인한다.
- `security_events`에 역할 변경 기록이 남았는지 확인한다.

## 2. Vercel 환경변수

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용, `NEXT_PUBLIC_` 금지
- `STRIPE_SECRET_KEY` — Stripe 서버 전용 비밀 키, `NEXT_PUBLIC_` 금지
- `STRIPE_WEBHOOK_SECRET` — 운영 Webhook 엔드포인트의 서명 비밀
- `CRON_SECRET` — 충분히 긴 무작위 문자열
- Google Search Console은 Cloudflare DNS의 TXT 레코드로 도메인 소유권을 인증한다. HTML 메타 태그용 환경변수는 사용하지 않는다.

## 3. 앱 배포와 권한 잠금

- 새 앱을 먼저 배포한다.
- 관리자 화면에서 주문 조회와 RPC 기반 상태 저장이 정상인지 확인한다.
- 그 뒤에만 `supabase/post_deploy/operations_lockdown_after_admin_deploy.sql`을 적용한다.
- 잠금 후 관리자 상태 저장, 메시지 처리, 수정 처리, 영상 등록을 다시 확인한다.

## 4. 출시 전 운영 E2E

테스트 고객 계정과 소용량 테스트 파일로 아래를 한 번 끝까지 진행한다.

1. 필수 내용, 사진 5장, 인물·미성년자 여부와 표현 방식, 분리된 필수 동의로 상담을 접수한다.
2. 사진을 한 번만 올린 뒤 대표 얼굴 1장, 대표 전신 1장, 선택 시 옆모습·꼬리 1장과 각 추억 사진을 기존 썸네일에서 지정한다.
3. 외형 적용 방식을 3가지 모두 시험하고, 특정 시기를 선택했을 때만 설명과 기준 사진 1~3장이 필수가 되는지 확인한다.
4. 변하지 않아야 할 특징이 최대 3개로 제한되고, 실사풍 영상 재구성 확인 없이는 접수되지 않는지 확인한다.
5. 약관·개인정보, 사진 사용 권한, 외부 제작 서비스 동의 시각과 각 확인문 버전이 주문에 저장됐는지 확인한다.
6. 인물이 있는 주문은 인물 동의가, 미성년자가 있는 주문은 보호자 동의가 없으면 접수와 제작이 거절되는지 확인한다.
7. 관리자에서 대표 사진과 추억별 연결 사진을 검토하고 `승인` 전에는 영상 구성안 공개·제작 상태 전환·제작용 JSON 복사가 모두 거절되는지 확인한다.
8. 사진 보완 요청 후 고객이 사진을 수정하면 분석 상태가 다시 검토 대기로 돌아가는지 확인하고, 최종 승인 시각과 승인 운영자가 기록되는지 확인한다.
9. 고객의 구성안 선택과 현재 동의 기록 전에는 관리자가 Stripe 결제를 안내할 수 없는지 확인한다.
10. 관리자가 「お支払いをご案内」를 저장하면 고객 제작실에 결제 버튼이 표시되고 안내 메일이 도착하는지 확인한다.
11. Stripe 테스트 Checkout의 성공·취소를 각각 확인하고, 성공 Webhook 후에만 `payment_status=paid`가 되는지 확인한다.
12. 금액이 브라우저 입력값이 아니라 주문의 `quoted_price`와 일치하는지, 같은 주문에서 중복 결제가 생성되지 않는지 확인한다.
13. Stripe 테스트 환불 후 `payment_status=refunded`와 주문 이벤트가 기록되는지 확인한다.
14. 입금 확인 전에는 `stills_review`, `production`과 확인 영상 업로드가 거절되는지 확인한다.
15. 입금 확인 후 장면 이미지를 공개하고 고객 승인을 받는다.
16. 확인 영상을 공개하고 고객이 수정 요청을 보낸다.
17. 미처리 수정이 남은 상태에서 고객 확정과 최종 납품이 모두 거절되는지 확인한다.
18. 수정 영상을 공개한 후 요청을 처리 완료로 바꾼다.
19. 고객이 「この映像で確定する」를 누르고, 확정 시각과 대상 영상 ID를 확인한다.
20. 최종 영상을 등록하고 납품한다.
21. 최종 영상 등록 뒤 납품만 실패시키는 테스트를 해, 등록된 영상을 재사용할 수 있는지 확인한다.
22. 고객 전용 사이트와 전용 URL이 정상이고 검색 제외 상태인지 확인한다.

## 5. 운영 화면 점검

- 전체 주문 목록에서 미처리 메시지·수정 배지가 보인다.
- 「未対応あり」 필터로 놓친 요청을 한 번에 볼 수 있다.
- 고객 화면 미리보기에서 선택·업로드·메시지·수정·승인·공유 설정이 모두 읽기 전용이다.
- 고객 확정 전, 미처리 수정 존재, 미입금, 현재 동의 없음 중 하나라도 있으면 최종 납품 버튼이 비활성화된다.

## 6. 자동 정리 확인

- Vercel Cron `/api/cron/cleanup-drafts`가 매일 18:00 UTC（03:00 JST）로 등록됐는지 확인한다.
- `Authorization: Bearer $CRON_SECRET` 없이 호출하면 401인지 확인한다.
- 7일이 지난 테스트 초안에서 주문이 취소 처리되고, 자유 입력 내용·사진·Storage의 고아 파일이 삭제되는지 확인한다.
- Cron 응답의 `failed`가 비어 있는지 운영 로그에서 확인한다.

## 출시 판정

- 위 E2E를 운영 Supabase와 실제 Vercel 배포에서 완료
- 치명적 오류 0건
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build:vercel` 통과
- 운영자가 입금 확인, 수정 처리, 고객 확정, 납품 재시도 절차를 직접 수행 가능

하나라도 확인되지 않으면 신청 접수는 계속 「準備中」으로 유지합니다.
