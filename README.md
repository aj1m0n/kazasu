# Script Properties 設定の手順

## 前提条件
1. `clasp` がインストールされていること
2. Google Cloud Platformで適切なプロジェクトが設定されていること
3. Google Apps Script APIが有効になっていること

## 設定手順

### 1. Googleへの認証
```
npx clasp login
```

### 2. Apps Script APIを有効にする
以下のURLにアクセスしてApps Script APIを有効にしてください：
https://script.google.com/home/usersettings

「Google Apps Script API」をONにします。

### 3. Google Cloud Platformでの設定
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. このGASプロジェクトに関連付けられているプロジェクトを選択
3. 「APIとサービス」 > 「有効なAPIとサービス」に移動
4. 「+APIとサービスを有効化」をクリック
5. 「Apps Script API」を検索して有効化

## プロパティの設定方法

1. [Google Apps Script](https://script.google.com/)でプロジェクトを開きます。
2. 左側の歯車アイコン（プロジェクトの設定）をクリックします。
3. 「スクリプト プロパティ」セクションで必要なプロパティを追加し、値を入力します。
   - SPREADSHEET_ID
   - SHEET_NAME

### 5. GASをデプロイ
```bash
npm run deploy:gas
```

## フロントエンド（Next.js）の使用方法

QRコードを読み取り、スプレッドシートを更新するフロントエンドアプリケーションについては、[フロントエンドのREADME](./frontend/README.md)を参照してください。

### クイックスタート

1. 依存関係をインストール:
```bash
npm install
```

2. 開発サーバーを起動:
```bash
npm run dev
```

3. ブラウザで http://localhost:3000 を開きます。

> **注意**: 実行時に `[DEP0060] DeprecationWarning` が表示されることがありますが、これは一部の依存パッケージが非推奨APIを使用していることによるものです。アプリケーションの動作には影響しません。
