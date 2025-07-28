import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  basePath: '',
  env: {
    NEXT_PUBLIC_BASE_PATH: '',
  },
  trailingSlash: true,
};

export default nextConfig;
