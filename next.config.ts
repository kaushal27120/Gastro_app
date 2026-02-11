import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ignore TypeScript Errors during build (e.g. "any" types)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ignore ESLint Errors during build (e.g. unused variables)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;