import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ES modules対応のためのディレクトリ取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_GAS_URL: process.env.NEXT_PUBLIC_GAS_URL
  },
  webpack: (config, { isServer, dev }) => {
    // HMRを改善するための設定
    if (dev && !isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000, // ファイル変更の監視間隔
        aggregateTimeout: 300, // 複数の変更をまとめる時間
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_GAS_URL || 'https://script.google.com/macros/s/your-script-id/exec/:path*'
      }
    ]
  }
};

export default nextConfig;
