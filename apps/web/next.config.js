/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@rafineri/shared'],
  output: 'standalone',
  async rewrites() {
    // Skip rewrites during build to avoid connection errors
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: process.env.API_URL || 'http://localhost:3001/api/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
