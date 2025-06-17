import type { NextConfig } from "next";
import { env } from "process";

const nextConfig: NextConfig = {
  output: "export", // Ensure this line is present
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: [env.REPLIT_DOMAINS?.split(",")[0] || ""],
};

module.exports = nextConfig;
