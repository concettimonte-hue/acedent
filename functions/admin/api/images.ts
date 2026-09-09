import {
  cleanPublicBase,
  jpegDimensions,
  json,
  requireAccess,
  safeSegment,
  type AdminEnv,
} from '../../_shared/admin';

const IMAGE_LIMIT = 200_000;
const sizes = {
  before: { width: 1600, height: 1200 },
  after: { width: 1600, height: 1200 },
  thumbnail: { width: 800, height: 600 },
} as const;

export const onRequestPost: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = requireAccess(request);
  if (!access.ok) return access.response;
  if (!env.ACEDENT_DB || !env.ACEDENT_IMAGES) return json({ error: 'D1/R2 바인딩이 설정되지 않았습니다.' }, 503);

  try {
    const form = await request.formData();
    const file = form.get('file');
    const kind = form.get('kind');
    const uploadIdValue = form.get('uploadId');
    const uploadId = typeof uploadIdValue === 'string' ? uploadIdValue : '';
    const partIndex = Number(form.get('partIndex'));

    if (!(file instanceof File) || file.type !== 'image/jpeg') {
      return json({ error: 'JPEG 이미지만 업로드할 수 있습니다.' }, 400);
    }
    if (kind !== 'before' && kind !== 'after' && kind !== 'thumbnail') {
      return json({ error: '이미지 종류가 올바르지 않습니다.' }, 400);
    }
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(uploadId) || !Number.isInteger(partIndex) || partIndex < 0 || partIndex > 19) {
      return json({ error: '업로드 식별자가 올바르지 않습니다.' }, 400);
    }
    if (file.size > IMAGE_LIMIT) {
      return json({ error: '이미지는 200KB 이하여야 합니다.' }, 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const dimensions = jpegDimensions(bytes);
    const expected = sizes[kind];
    if (!dimensions || dimensions.width !== expected.width || dimensions.height !== expected.height) {
      return json({ error: `${kind} 이미지는 ${expected.width}×${expected.height}px이어야 합니다.` }, 400);
    }

    const nameValue = form.get('name');
    const fileSegment = safeSegment(typeof nameValue === 'string' ? nameValue : 'image') || 'image';
    const key = `works/${uploadId}/${String(partIndex + 1).padStart(2, '0')}-${fileSegment}-${kind}.jpg`;
    const now = new Date().toISOString();
    await env.ACEDENT_DB.prepare(
      `INSERT OR REPLACE INTO asset_cleanup_queue
       (object_key, work_slug, operation, status, attempts, max_attempts, last_error, created_at, updated_at)
       VALUES (?, ?, 'replace-asset', 'pending', 0, 3, NULL, ?, ?)`,
    ).bind(key, `upload-${uploadId}`, now, now).run();
    await env.ACEDENT_IMAGES.put(key, bytes, {
      httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: {
        uploadedBy: access.email,
        kind,
        width: String(dimensions.width),
        height: String(dimensions.height),
        bytes: String(file.size),
        uploadId,
        partIndex: String(partIndex),
      },
    });

    const url = `${cleanPublicBase(env.R2_PUBLIC_BASE_URL)}/${key}`;
    return json({ key, url, kind, ...dimensions, bytes: file.size }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.' }, 500);
  }
};
