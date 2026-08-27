# 施設間バイト募集アプリ

長嶺・京町台・花園の3施設間で社内バイト募集・応募を行う Google Apps Script Webアプリです。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `Code.gs` | doGet、HTML include、クライアント向けAPI |
| `Config.gs` | 定数・施設マスタ参照ヘルパー |
| `SheetRepository.gs` | スプレッドシート読み書き |
| `SlotService.gs` | 募集枠の作成・取得 |
| `ApplicationService.gs` | 応募・承認・否認・削除 |
| `ChatNotify.gs` | Google Chat Webhook 通知 |
| `Utils.gs` | 日付フォーマット、UUID、共通レスポンス |
| `admin.html` / `admin.css.html` / `admin.js.html` | 管理者画面 |
| `staff.html` / `staff.css.html` / `staff.js.html` | スタッフ画面 |
| `index.html` | パラメータ未指定時の案内画面 |
| `appsscript.json` | GAS プロジェクト設定 |

## GAS への反映手順

### 方法A: スプレッドシートから直接（推奨・初回）

1. 既存のスプレッドシートを開く（6シート構成済み）
2. **拡張機能 → Apps Script** を開く
3. 左のファイル一覧で既存の `Code.gs` 等を削除し、本リポジトリの各 `.gs` / `.html` ファイルの内容をコピー＆ペースト
   - HTMLファイルは `admin.css.html` のように拡張子 `.html` で作成（GAS上では `admin.css` として include される）
4. **プロジェクトの設定 → スクリプト プロパティ** に以下を追加:
   - キー: `CHAT_WEBHOOK_URL`
   - 値: Google Chat Webhook URL
5. **デプロイ → 新しいデプロイ → ウェブアプリ**
   - 実行ユーザー: 自分
   - アクセス: **全員**（組織内URL共有のため）
6. デプロイURLを控える

### 方法B: clasp を使う場合

```bash
npm install -g @google/clasp
clasp login
clasp create --type sheets --title "施設間バイト募集" --rootDir .
# または既存プロジェクトに紐付け: clasp clone <SCRIPT_ID>
clasp push
clasp deploy --description "初回デプロイ"
```

## URL

デプロイ後のベースURLを `{URL}` とすると:

| 画面 | URL |
|------|-----|
| 管理者 | `{URL}?page=admin` |
| スタッフ（長嶺） | `{URL}?facility=NAGAMINE` |
| スタッフ（京町台） | `{URL}?facility=KYOMACHIDAI` |
| スタッフ（花園） | `{URL}?facility=HANAZONO` |
| 案内 | `{URL}` |

## 主な仕様

- 募集方向: 長嶺↔京町台、長嶺↔花園のみ（京町台↔花園は不可）
- 応募時: ステータス「承認待ち」、仮押さえ+1
- 承認: 仮押さえ-1、承認済+1
- 否認/削除: 人数を適切に戻し、枠を再表示
- 同一日重複応募禁止（所属施設+氏名+勤務日）
- LockService による同時応募排他制御
- データの物理削除なし（履歴保持）

## スプレッドシート前提

以下のシート名・列構成が必要です（仕様書参照）。施設マスタ・職種マスタ・勤務区分マスタに初期データが入っていること。
