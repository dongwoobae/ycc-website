import type { NextConfig } from "next";

function remotePatternFromEnv(value: string | undefined) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return {
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
      hostname: url.hostname,
      port: url.port,
      pathname: '/**',
    }
  } catch {
    return undefined
  }
}

const r2PublicPattern = remotePatternFromEnv(process.env.R2_PUBLIC_URL)

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  // Vercel 함수 번들에 sharp 리눅스 네이티브 바이너리가 누락되면 sharp 가 경고 없이
  // WASM 으로 폴백한다(느리고, SharedArrayBuffer 출력이 R2 업로드를 깨뜨림). 강제 포함한다.
  outputFileTracingIncludes: {
    '/**': [
      './node_modules/@img/sharp-linux-x64/**',
      './node_modules/@img/sharp-libvips-linux-x64/**',
    ],
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      ...(r2PublicPattern ? [r2PublicPattern] : []),
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/contact',
        destination: '/newfamily#visit',
        permanent: true,
      },
      {
        source: '/about/visit',
        destination: '/newfamily#visit',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
