import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@metu/shared", "@metu/db"],
  // Standalone output lets us ship a minimal runtime image to Fly.io —
  // Next copies only the production files into `.next/standalone/` and
  // we COPY that from the builder stage.
  output: "standalone",
  // Monorepo hint: include files from the repo root so workspace packages
  // (`@metu/shared`, `@metu/db`) land in the standalone bundle.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
