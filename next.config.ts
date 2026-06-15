import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
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
