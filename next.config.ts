import type { NextConfig } from "next";

// A fully static site: the browser talks to statsapi.mlb.com directly.
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
