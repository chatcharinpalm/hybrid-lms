/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // The site's own /api/* is forwarded to the API server, so students and
    // staff only ever see one domain. Set API_ORIGIN on Vercel (e.g.
    // https://hybrid-lms-api.up.railway.app); local dev falls back to :4000.
    const apiOrigin = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
