# LINE Webhook セットアップガイド

## 概要
LINE botに送信されたメッセージをGoogle Spreadsheetに自動保存するwebhookシステムです。

## システム構成
- **Webhook エンドポイント**: `/api/line-webhook` (Vercel上のNext.js)
- **データ保存先**: Google Spreadsheet (Google Apps Script経由)
- **認証**: LINE Channel Access Token & Channel Secret

## セットアップ手順

### 1. LINE Developers設定

1. [LINE Developers Console](https://developers.line.biz/) にアクセス
2. Messaging API チャンネルを作成または選択
3. 以下の情報を取得:
   - Channel Access Token (長期)
   - Channel Secret

4. Webhook URLを設定:
   ```
   https://[your-vercel-domain]/api/line-webhook
   ```

5. Webhookを有効化

### 2. 環境変数の設定

#### ローカル開発環境
`frontend/.env.local` ファイルに以下を設定:
```env
NEXT_PUBLIC_GAS_URL=https://script.google.com/macros/s/[YOUR_GAS_DEPLOYMENT_ID]/exec
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
```

#### Vercel環境
Vercelダッシュボードで環境変数を設定:
1. プロジェクトのSettings → Environment Variables
2. 上記の3つの環境変数を追加

### 3. Google Apps Script設定

1. Google Apps Scriptプロジェクトにアクセス
2. `gas/Code.gs` をデプロイ
3. Script Propertiesに以下を追加:
   - `SPREADSHEET_ID`: 保存先のSpreadsheet ID
   - `LINE_WEBHOOK_SHEET_NAME`: LINEメッセージ保存用シート名 (デフォルト: LINE_Messages)

### 4. デプロイ

```bash
# GASのデプロイ
npm run deploy:gas

# Vercelへのデプロイ
vercel --prod
```

## データ構造

### Spreadsheet カラム
| カラム | 説明 |
|--------|------|
| Timestamp | メッセージ受信日時 |
| User ID | LINE User ID |
| Display Name | ユーザー表示名 |
| Message | メッセージ内容 |
| Date | 生データの日時 |

## 動作確認

1. LINE botにメッセージを送信
2. botから「メッセージを記録しました✅」の返信を確認
3. Google Spreadsheetでデータが保存されていることを確認

## トラブルシューティング

### エラー: Invalid signature
- LINE_CHANNEL_SECRETが正しく設定されているか確認

### エラー: GAS_URL not configured
- NEXT_PUBLIC_GAS_URLが設定されているか確認
- GASがデプロイされているか確認

### メッセージが保存されない
- GASのScript PropertiesでSPREADSHEET_IDが設定されているか確認
- SpreadsheetへのアクセスGAS許可があるか確認

## API仕様

### エンドポイント
`POST /api/line-webhook`

### リクエストヘッダー
- `X-Line-Signature`: LINE署名検証用

### レスポンス
- 成功: `200 OK`
- エラー: `401 Unauthorized` (署名不正), `500 Internal Server Error`