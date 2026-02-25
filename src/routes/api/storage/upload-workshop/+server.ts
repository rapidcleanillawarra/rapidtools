import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isB2Configured, uploadToB2 } from '$lib/server/b2';

const WORKSHOP_PHOTOS_PREFIX = 'workshop-photos';
const WORKSHOP_FILES_PREFIX = 'workshop-files';

export const POST: RequestHandler = async ({ request }) => {
  if (!isB2Configured()) {
    return json({ fallback: 'supabase' }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw error(400, 'Invalid form data');
  }

  const workOrderRaw = formData.get('workOrder');
  const workOrder =
    typeof workOrderRaw === 'string' && workOrderRaw.trim()
      ? workOrderRaw.trim().replace(/[^a-zA-Z0-9._-]/g, '_')
      : `workshop_${Date.now().toString().slice(-6)}`;

  const photoUrls: string[] = [];
  const fileUrls: string[] = [];

  const photos = formData.getAll('photos').filter((f): f is File => f instanceof File);
  for (let i = 0; i < photos.length; i++) {
    const file = photos[i];
    const timestamp = Date.now() + Math.random() * 1000;
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${WORKSHOP_PHOTOS_PREFIX}/${workOrder}_${timestamp}_${i + 1}_${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadToB2(key, buffer, file.type || 'image/jpeg');
    photoUrls.push(url);
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const timestamp = Date.now() + Math.random() * 1000;
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${WORKSHOP_FILES_PREFIX}/${workOrder}_${timestamp}_${i + 1}_${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadToB2(key, buffer, file.type || 'application/octet-stream');
    fileUrls.push(url);
  }

  return json({ photoUrls, fileUrls });
};
