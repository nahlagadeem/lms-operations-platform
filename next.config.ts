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
      {
        source: "/project-structure",
        destination: "/pos",
        permanent: true,
      },
      {
        source: "/project-structure/scopes/:id",
        destination: "/pos/:id",
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
