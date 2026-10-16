import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true'
});

// 生产环境（如 Docker 网络内）可通过环境变量改写 API 地址
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui'],
  // 允许 127.0.0.1 直连 dev server（E2E 测试场景），消除 cross-origin 警告
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_URL}/api/:path*`
      }
    ];
  }
};

export default withBundleAnalyzer(nextConfig);
