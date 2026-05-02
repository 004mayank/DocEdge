/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Same-origin API proxy:
    // Browser calls http://localhost:3000/api/*
    // Next server (inside Docker) forwards to the API service.
    return [
      {
        source: '/api/:path*',
        destination: 'http://api:3001/:path*',
      },
    ];
  },
};

export default nextConfig;
