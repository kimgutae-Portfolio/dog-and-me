# WAN MEMORY — Connected MVP

愛犬の写真とエピソードから、実写映画のような思い出映像を注文できるサービスの1次開発版です。

このリポジトリでは「会員登録 → 思い出と写真の提出 → 素材確認 → コンセプト2案 → 1案選択 → 制作・修正 → 映画と専用サイトの納品」までをSupabaseへ接続しています。映像制作そのものは品質を優先して手動で行い、運営画面から完成映像を納品します。

## 1次版でできること

- 日本語のブランドランディングページ
- 料金・制作フロー・FAQの確認
- 5ステップのストーリー入力
- メールアドレス・パスワードの会員登録とログイン
- 顧客ごとの注文、進行状態、料金、コンセプト、修正依頼、メッセージの保存
- private Storageへの写真アップロード（HEICはJPGへ変換）
- 制作中も継続できる写真追加
- 顧客専用制作室と運営管理画面
- 完成映像の手動アップロードと専用メモリーサイトへの納品
- 写真使用権限、人物・未成年者の有無と表現方法、写っている方・保護者の同意、外部制作サービス処理を注文ごとに記録
- 上記の同意証跡、入金確認、未対応修正、顧客最終承認をDB側でも検証
- 顧客が確認映像を確定した日時と対象映像の監査記録
- 7日間未完了の相談と部分アップロード写真の自動整理
- 先着10件 ¥24,800、その後 ¥29,800のデータベース側自動判定
- レスポンシブ・キーボード操作・reduce motion対応
- ヘルスチェック API (`/api/health`)

## 起動

Node.js 22.13 以上を推奨します。

```bash
npm ci
npm run dev
```

本番ビルドとテスト:

```bash
npm run build
npm test
```

## 主要ページ

- `/` — ランディング
- `/story` — 思い出入力ウィザード
- `/auth` — 会員登録・ログイン
- `/studio` — 顧客専用制作室
- `/admin` — 運営管理
- `/film/{orderId}` — ログインが必要な専用メモリーサイト
- `/api/health` — 稼働確認

## Supabaseの準備

`.env` に次を設定します。

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

`supabase/migrations`をファイル名順に適用すると、テーブル、RLS、注文作成RPC、private bucket、人物写真を含む同意証跡、承認・決済ゲートが作成されます。`202607210002_operations_lockdown.sql`は互換用の空マイグレーションで、旧管理画面を先にロックしません。

最初の管理者は会員登録後、Supabase SQL Editorから次を一度だけ実行します。通常のログインユーザーやブラウザからは実行できず、以後の役割変更は既存管理者またはプロジェクト所有者の信頼済みSQLセッションだけが行えます。SQL Editorからの復旧操作も`security_events`へ記録されます。

```sql
select public.bootstrap_first_admin('owner@example.com');
```

安全な本番反映順序:

1. `supabase/migrations`をすべて適用
2. このWebアプリをデプロイし、管理者ログインとRPC更新を確認
3. `supabase/post_deploy/operations_lockdown_after_admin_deploy.sql`をSQL Editorで適用
4. テスト注文で入金確認 → 制作 → 確認映像 → 顧客確定 → 最終納品を確認

詳細な本番確認項目は[`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md)を使用します。

VercelのCronは毎日03:00（JST）に未完了相談を整理します。`SUPABASE_SERVICE_ROLE_KEY`と十分に長い`CRON_SECRET`はVercelのサーバー環境変数にのみ登録し、`NEXT_PUBLIC_`を付けないでください。

## 1次運用で手動の部分

- Runwayでの映像制作
- 料金案内と入金確認
- 完成映像の管理画面アップロード
- メール通知

Stripe決済とAI生成APIの自動化は、初期10件の実制作時間と原価を確認した後に接続します。
