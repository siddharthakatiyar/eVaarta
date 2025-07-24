import type { NextConfig } from "next";
import { devCspHeader } from "./src/lib/csp";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,
  async headers() {
    return devCspHeader ? [{ source: "/(.*)", headers: [devCspHeader] }] : [];
  },
};

export default nextConfig;
