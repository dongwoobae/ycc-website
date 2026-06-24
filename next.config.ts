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
  images: {
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
        destination: '/about/visit',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
