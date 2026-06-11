import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@aztec/bb.js"],
  outputFileTracingIncludes: {
    "/api/passport/issue": [
      "./node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/barretenberg-threads.wasm.gz",
      "./node_modules/@aztec/bb.js/dest/node-cjs/barretenberg_wasm/barretenberg-threads.wasm.gz",
      "./src/lib/passport/wasm/barretenberg-threads.wasm.gz",
    ],
  },
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    return config;
  },
};

export default nextConfig;
