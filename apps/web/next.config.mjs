/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Docker: API container is at http://api:3002. Local dev: http://localhost:3002.
    const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://localhost:3002';
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
