/**
 * Cloudflare R2 client (S3-compatible).
 * When R2 env vars are missing, callers should fall back to local disk.
 */
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

let client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME."
    );
  }
  if (!client) {
    const accountId = process.env.R2_ACCOUNT_ID!;
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export function getBucket(): string {
  return process.env.R2_BUCKET_NAME || "";
}

/** Public base URL for objects (custom domain or r2.dev). No trailing slash. */
export function getR2PublicBase(): string {
  const base = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
  return base;
}

export function publicUrlForKey(key: string): string {
  const base = getR2PublicBase();
  if (!base) {
    return `/${key}`;
  }
  return `${base}/${key.replace(/^\//, "")}`;
}

async function streamToString(
  body: ReadableStream | NodeJS.ReadableStream | Blob | undefined
): Promise<string> {
  if (!body) return "";
  if (typeof (body as Blob).text === "function") {
    return (body as Blob).text();
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function r2GetJson<T>(key: string): Promise<T | null> {
  try {
    const res = await getR2Client().send(
      new GetObjectCommand({ Bucket: getBucket(), Key: key })
    );
    const text = await streamToString(res.Body as never);
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (e: unknown) {
    const name = e && typeof e === "object" && "name" in e ? (e as { name: string }).name : "";
    const status =
      e && typeof e === "object" && "$metadata" in e
        ? (e as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode
        : undefined;
    if (name === "NoSuchKey" || status === 404) return null;
    throw e;
  }
}

export async function r2PutJson(key: string, data: unknown): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-store",
    })
  );
}

export async function r2PutBytes(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

export async function r2Delete(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
  );
}

export async function r2Exists(key: string): Promise<boolean> {
  try {
    await getR2Client().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key })
    );
    return true;
  } catch {
    return false;
  }
}
