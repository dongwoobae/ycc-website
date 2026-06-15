import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
