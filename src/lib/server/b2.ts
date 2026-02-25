/**
 * Backblaze B2 storage (S3-compatible API).
 * Used only on the server. Configure via env: B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT, B2_PUBLIC_BASE_URL.
 */
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

const B2_KEY_ID = env.B2_KEY_ID?.trim() ?? '';
const B2_APPLICATION_KEY = env.B2_APPLICATION_KEY?.trim() ?? '';
const B2_BUCKET_NAME = env.B2_BUCKET_NAME?.trim() ?? '';
/** Endpoint must be a full URL (e.g. https://s3.us-west-004.backblazeb2.com). */
const B2_ENDPOINT_RAW = env.B2_ENDPOINT ?? 'https://s3.us-west-004.backblazeb2.com';
const B2_ENDPOINT = B2_ENDPOINT_RAW.startsWith('http://') || B2_ENDPOINT_RAW.startsWith('https://')
  ? B2_ENDPOINT_RAW
  : `https://${B2_ENDPOINT_RAW}`;
const B2_REGION = env.B2_REGION ?? 'us-west-004';
/** Public base URL for object links (e.g. https://yourbucket.s3.us-west-004.backblazeb2.com). No trailing slash. */
const B2_PUBLIC_BASE_URL = env.B2_PUBLIC_BASE_URL;

let _client: S3Client | null = null;

export function isB2Configured(): boolean {
  return !!(B2_KEY_ID && B2_APPLICATION_KEY && B2_BUCKET_NAME);
}

function getB2Client(): S3Client {
  if (!isB2Configured()) {
    throw new Error('B2 is not configured. Set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME.');
  }
  if (!_client) {
    _client = new S3Client({
      endpoint: B2_ENDPOINT,
      region: B2_REGION,
      credentials: {
        accessKeyId: B2_KEY_ID!,
        secretAccessKey: B2_APPLICATION_KEY!
      },
      forcePathStyle: true
    });
  }
  return _client;
}

/**
 * Get the public URL for an object key.
 * Uses B2_PUBLIC_BASE_URL if set, otherwise builds from bucket and region.
 */
export function getB2PublicUrl(key: string): string {
  const base = B2_PUBLIC_BASE_URL || `https://${B2_BUCKET_NAME}.s3.${B2_REGION}.backblazeb2.com`;
  return `${base.replace(/\/$/, '')}/${key}`;
}

export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Upload a file (Buffer) to B2 and return the public URL.
 */
export async function uploadToB2(
  key: string,
  body: Buffer,
  contentType?: string
): Promise<UploadResult> {
  const client = getB2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: contentType ?? 'application/octet-stream'
    })
  );
  const url = getB2PublicUrl(key);
  return { key, url };
}

/**
 * Test B2 connection by listing the bucket (max 0 keys).
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 */
export async function testB2Connection(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!isB2Configured()) {
    return { ok: false, error: 'B2 is not configured. Set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME.' };
  }
  try {
    const client = getB2Client();
    await client.send(
      new ListObjectsV2Command({
        Bucket: B2_BUCKET_NAME!,
        MaxKeys: 0
      })
    );
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
