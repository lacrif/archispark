import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@workspace/ui"],

  async rewrites() {
    const apiUrl = process.env.ARCHIMATE_API_URL;

    // Production (Docker + Caddy) : ARCHIMATE_API_URL="" → aucun rewrite
    // Caddy gère /api/* et /auth/* en amont de Next.js.
    if (!apiUrl) return [];

    // Développement (pnpm dev) : proxy local vers l'API Express sur :3000
    const target = apiUrl || "http://localhost:3000";
    return [
      { source: "/api/:path*",  destination: `${target}/:path*`       },
      { source: "/auth/:path*", destination: `${target}/auth/:path*`  },
    ];
  },
};

export default nextConfig;
