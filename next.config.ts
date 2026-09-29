import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/sites/:id", destination: "/app/streams/:id", permanent: true },
      { source: "/check", destination: "/app/check", permanent: true },
      { source: "/clinic", destination: "/app/clinic", permanent: true },
      { source: "/data", destination: "/app/data", permanent: true },
      { source: "/login", destination: "/signin", permanent: true },
    ];
  },
};

export default nextConfig;
