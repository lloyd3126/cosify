import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.nien.cc" },
      { protocol: "https", hostname: "r2.nien.cc" },
      { protocol: "https", hostname: "nien.cc" }, // 用於重導向的 cdn-cgi/image 路徑
    ],
    localPatterns: [
      {
        pathname: "/api/r2/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
