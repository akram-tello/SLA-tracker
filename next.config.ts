import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  basePath: '/order-sla',
  env: {
    NEXT_PUBLIC_BASE_PATH: '/order-sla',
  },
  trailingSlash: true,
};

export default nextConfig;
