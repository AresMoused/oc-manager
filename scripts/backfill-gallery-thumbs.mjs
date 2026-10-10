/**
 * Optional Node backfill for OC Manager gallery thumbUrl fields stored in R2 app-data JSON.
 * Requires R2 env + sharp. Does NOT invent credentials.
 *
 *   npm i sharp
 *   node scripts/backfill-gallery-thumbs.mjs
 *
 * Walks data/users/*/app-data.json (and legacy data/app-data.json), downloads each
 * gallery image missing thumbUrl, uploads a WebP thumb under uploads/, writes thumbUrl back.
 */
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME;
const publicBase = String(process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
  throw new Error('Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL');
}

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch {
  throw new Error('Run npm i sharp first');
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const streamToString = async (body) => {
  if (!body) return '';
  if (typeof body.transformToString === 'function') return body.transformToString();
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
};

const getJson = async (key) => {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await streamToString(res.Body);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
};

const putJson = async (key, data) => {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'no-store',
  }));
};

const putBytes = async (key, body, contentType) => {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${publicBase}/${key}`;
};

const makeThumb = async (buffer) => sharp(buffer).rotate()
  .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 78 })
  .toBuffer();

const listUserDataKeys = async () => {
  const keys = [];
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'data/users/',
      ContinuationToken: token,
    }));
    for (const obj of res.Contents || []) {
      if (obj.Key?.endsWith('/app-data.json')) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
};

const processData = async (key, data) => {
  if (!data || !Array.isArray(data.characters)) return { updated: 0, failed: 0 };
  let updated = 0;
  let failed = 0;
  let dirty = false;
  for (const character of data.characters) {
    if (!Array.isArray(character.gallery)) continue;
    for (const img of character.gallery) {
      if (!img?.url || img.thumbUrl) continue;
      try {
        const response = await fetch(img.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const webp = await makeThumb(buffer);
        img.thumbUrl = await putBytes(`uploads/${randomUUID()}-thumb.webp`, webp, 'image/webp');
        updated += 1;
        dirty = true;
      } catch (error) {
        failed += 1;
        console.error(`${key} ${character.id} ${img.id}:`, error.message || error);
      }
    }
  }
  if (dirty) {
    data.updatedAt = new Date().toISOString();
    await putJson(key, data);
  }
  return { updated, failed };
};

const keys = ['data/app-data.json', ...(await listUserDataKeys())];
let totalUpdated = 0;
let totalFailed = 0;
for (const key of keys) {
  const data = await getJson(key);
  if (!data) continue;
  const { updated, failed } = await processData(key, data);
  totalUpdated += updated;
  totalFailed += failed;
  console.log(`${key}: +${updated} thumbs, ${failed} failed`);
}
console.log(`done: ${totalUpdated} thumbs, ${totalFailed} failed`);
