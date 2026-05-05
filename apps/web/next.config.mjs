/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiOrigin =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      (process.env.NODE_ENV === 'production' ? 'http://api:3002' : 'http://localhost:3002');
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
