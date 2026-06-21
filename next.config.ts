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
    "/api/staking/stats": [
      "./node_modules/@streamflow/staking/dist/**/*",
      "./node_modules/@streamflow/common/dist/**/*",
    ],
    "/api/staking/position": [
      "./node_modules/@streamflow/staking/dist/**/*",
      "./node_modules/@streamflow/common/dist/**/*",
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

    // wagmi's optional "tempo" connector does `import('accounts')`, an optional
    // dependency we don't use. Alias it to false so webpack doesn't fail to
    // resolve it (the connector's own try/catch handles the absence at runtime).
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      accounts: false,
    };

    return config;
  },
};

export default nextConfig;
