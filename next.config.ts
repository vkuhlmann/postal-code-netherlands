import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Set basePath for GitHub Pages (will be repository name)
  basePath: process.env.NODE_ENV === 'production' ? '/postal-code-netherlands' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/postal-code-netherlands' : '',
};

export default nextConfig;
