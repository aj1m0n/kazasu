# Kazasu Frontend

QRコードを読み取り、Google Apps Scriptを使ってGoogle スプレッドシートを更新するウェブアプリケーションのフロントエンドです。

## 機能

- QRコードの読み取り
- 読み取ったIDをGoogle Apps Scriptに送信
- 手動でIDを入力して処理する機能

## 技術スタック

- [Next.js](https://nextjs.org/) - Reactフレームワーク
- [TypeScript](https://www.typescriptlang.org/) - 型付きJavaScript
- [Tailwind CSS](https://tailwindcss.com/) - ユーティリティ・ファーストCSSフレームワーク
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) - QRコード読み取りライブラリ
- [Axios](https://axios-http.com/) - HTTPクライアント

## 開発方法

> **注意**: 依存関係は現在、親ディレクトリ（プロジェクトルート）で管理されています。以下の手順は親ディレクトリから実行してください。

1. 親ディレクトリで依存パッケージをインストール:

```bash
# プロジェクトルートディレクトリで実行
npm install
```

2. 親ディレクトリに `.env.local` ファイルを作成:

```bash
# プロジェクトルートディレクトリで実行
cp .env.local.example .env.local
```

3. `.env.local` を編集して、`NEXT_PUBLIC_GAS_URL`に適切なGoogle Apps ScriptのWebアプリケーションURLを設定します。

4. 親ディレクトリから開発サーバーを起動:

```bash
# プロジェクトルートディレクトリで実行
npm run dev
```

5. ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## ビルドと本番デプロイ

1. 親ディレクトリからアプリケーションをビルド:

```bash
# プロジェクトルートディレクトリで実行
npm run build
```

2. 親ディレクトリから本番用サーバーを起動:

```bash
# プロジェクトルートディレクトリで実行
npm run start
```

## カスタマイズ

- `src/pages/index.tsx` - メインのアプリケーションロジックとUIを含むホームページ
- `src/styles/globals.css` - グローバルスタイル定義
