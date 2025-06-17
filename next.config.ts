import type { NextConfig } from "next";
import { env } from "process";

const nextConfig: NextConfig = {
  allowedDevOrigins: [env.REPLIT_DOMAINS.split(",")[0]],
};

module.exports = nextConfig;
import type { NextConfig } from "next";
import { env } from "process";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [env.REPLIT_DOMAINS?.split(",")[0] || ""],
};

module.exports = nextConfig;
import type { NextConfig } from "next";
import { env } from "process";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
  allowedDevOrigins: [env.REPLIT_DOMAINS?.split(",")[0] || ""],
};

module.exports = nextConfig;
