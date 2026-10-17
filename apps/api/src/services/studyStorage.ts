import { randomUUID } from "node:crypto";
import path from "node:path";
import { env } from "../env";

/**
 * Uploads a lesson picture to Supabase Storage (public bucket) and returns its public URL.
 * Plain REST calls, so no extra SDK is needed.
 */
export async function uploadStudyMedia(buffer: Buffer, mimeType: string, originalName: string, folder: string) {
  const { url, serviceKey, studyBucket } = env.supabase;
  if (!url || !serviceKey) {
    throw new StudyStorageError("SUPABASE_URL / SUPABASE_SERVICE_KEY are not set on the API");
  }
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin";
  const objectPath = `${folder}/${randomUUID()}${ext}`;
  const res = await fetch(`${url}/storage/v1/object/${studyBucket}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": mimeType,
      // Pictures never change once uploaded, so browsers and CDN may keep them a year.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    throw new StudyStorageError(`Supabase upload failed (${res.status}): ${await res.text()}`);
  }
  return `${url}/storage/v1/object/public/${studyBucket}/${objectPath}`;
}

export class StudyStorageError extends Error {}
