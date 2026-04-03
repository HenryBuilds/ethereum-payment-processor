import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
    resolveAlias: {
      "@server/types": path.resolve(__dirname, "../src/types.ts"),
    },
  },
  webpack: (config) => {
    config.resolve.alias["@server/types"] = path.resolve(__dirname, "../src/types.ts");
    return config;
  },
};

export default nextConfig;
