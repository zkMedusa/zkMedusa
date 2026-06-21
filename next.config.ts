import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@aztec/bb.js", "@streamflow/staking", "@streamflow/common"],
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
