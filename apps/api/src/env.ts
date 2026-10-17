import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  // Comma-separated for deploys that need both a prod and preview frontend
  // origin (e.g. "https://app.vercel.app,http://localhost:3000").
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map((o) => o.trim()),
  // Vercel functions can only write to /tmp (and it doesn't last): uploaded
  // course documents need real file storage before that feature is used there.
  uploadDir: process.env.UPLOAD_DIR ?? (process.env.VERCEL ? "/tmp/uploads" : "uploads"),
  // Study-lesson pictures live in a public Supabase Storage bucket. Read lazily
  // so the rest of the API still boots without them.
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    studyBucket: process.env.SUPABASE_STUDY_BUCKET ?? "study-media",
  },
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  },
};
