/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  experimental: {
    // pg and the Solana libs stay server-side only
    serverComponentsExternalPackages: ["pg"],
  },
};

export default nextConfig;
