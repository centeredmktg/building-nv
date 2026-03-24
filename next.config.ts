import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
