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
  webpack(config) {
    // pdfjs-dist (PDF exam import) can use node-canvas on a server; the browser never needs it.
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
