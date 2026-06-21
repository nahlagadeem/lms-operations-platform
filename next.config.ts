import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/course-runs",
        destination: "/trainings",
        permanent: true,
      },
      {
        source: "/course-runs/:path*",
        destination: "/trainings/:path*",
        permanent: true,
      },
      {
        source: "/providers",
        destination: "/vendors",
        permanent: true,
      },
    ];
  },
  experimental: {
    proxyClientMaxBodySize: "25mb",
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
