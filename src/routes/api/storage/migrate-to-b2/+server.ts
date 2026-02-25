import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isB2Configured, uploadToB2 } from '$lib/server/b2';
import { supabase } from '$lib/supabase';

const WORKSHOP_PHOTOS_PREFIX = 'workshop-photos';
const WORKSHOP_FILES_PREFIX = 'workshop-files';

const SUPABASE_PHOTOS_MARKER = '/storage/v1/object/public/workshop-photos/';
const SUPABASE_FILES_MARKER = '/storage/v1/object/public/workshop-files/';

function isSupabasePhotoUrl(url: string): boolean {
  return typeof url === 'string' && url.includes('supabase.co') && url.includes(SUPABASE_PHOTOS_MARKER);
}

function isSupabaseFileUrl(url: string): boolean {
  return typeof url === 'string' && url.includes('supabase.co') && url.includes(SUPABASE_FILES_MARKER);
}

function parsePathFromSupabaseUrl(url: string, marker: string): string | null {
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split('?')[0];
  return path || null;
}

/** Flatten nested arrays and ensure we only have URL strings (never pass an array to fetch). */
function flattenUrls(value: string[] | string | unknown[] | unknown | null | undefined): string[] {
  if (value == null) return [];
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      out.push(item);
    } else if (Array.isArray(item)) {
      out.push(...flattenUrls(item));
    }
  }
  return out;
}

function emitLine(controller: ReadableStreamDefaultController, obj: object) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + '\n'));
}

export const POST: RequestHandler = async ({ request }) => {
  if (!isB2Configured()) {
    return json(
      { error: 'Cold storage (B2) is not configured.', migrated: 0, skipped: 0, errors: [] },
      { status: 503 }
    );
  }

  const accept = request.headers.get('accept') ?? '';
  const streamProgress = accept.includes('application/x-ndjson');

  const { data: workshops, error: fetchError } = await supabase
    .from('workshop')
    .select('id, clients_work_order, photo_urls, file_urls, backup_files')
    .in('status', ['completed', 'to_be_scrapped'])
    .is('backup_files', null)
    .limit(5); // TODO: remove limit after testing

  if (fetchError) {
    return json(
      { error: fetchError.message, migrated: 0, skipped: 0, errors: [fetchError.message] },
      { status: 500 }
    );
  }

  const list = workshops ?? [];

  if (!streamProgress) {
    // Non-streaming: original behavior, single JSON at the end
    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const workshop of list) {
      const result = await processOneWorkshop(workshop, () => {});
      if (result.migrated) migrated += 1;
      if (result.skipped) skipped += 1;
      errors.push(...result.errors);
    }
    return json({ migrated, skipped, errors });
  }

  // Streaming response: NDJSON progress events
  const stream = new ReadableStream({
    async start(controller) {
      let migrated = 0;
      let skipped = 0;
      const errors: string[] = [];

      try {
        for (let wi = 0; wi < list.length; wi++) {
          const workshop = list[wi];
          const photoUrls = flattenUrls(workshop.photo_urls);
          const fileUrls = flattenUrls(workshop.file_urls);
          const hasSupabasePhotos = photoUrls.some(isSupabasePhotoUrl);
          const hasSupabaseFiles = fileUrls.some(isSupabaseFileUrl);
          const workOrder = (workshop.clients_work_order || 'workshop').replace(/[^a-zA-Z0-9._-]/g, '_');
          const totalPhotos = photoUrls.filter(isSupabasePhotoUrl).length;
          const totalFiles = fileUrls.filter(isSupabaseFileUrl).length;

          if (!hasSupabasePhotos && !hasSupabaseFiles) {
            skipped += 1;
            emitLine(controller, { type: 'workshop_skip', workshopId: workshop.id, workOrder });
            continue;
          }

          emitLine(controller, {
            type: 'workshop_start',
            workshopIndex: wi + 1,
            totalWorkshops: list.length,
            workshopId: workshop.id,
            workOrder,
            totalPhotos,
            totalFiles
          });

          const result = await processOneWorkshop(workshop, (event) => emitLine(controller, event));
          if (result.migrated) migrated += 1;
          if (result.skipped) skipped += 1;
          errors.push(...result.errors);
          emitLine(controller, {
            type: 'workshop_done',
            workshopId: workshop.id,
            workOrder,
            success: result.migrated,
            errors: result.errors
          });
        }
        emitLine(controller, { type: 'done', migrated, skipped, errors });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        emitLine(controller, { type: 'error', error: msg });
        emitLine(controller, { type: 'done', migrated: 0, skipped: 0, errors: [msg] });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-store'
    }
  });
};

async function processOneWorkshop(
  workshop: { id: string; clients_work_order: string | null; photo_urls: string[] | string | null; file_urls: string[] | string | null; backup_files: unknown },
  onProgress: (event: object) => void
): Promise<{ migrated: boolean; skipped: boolean; errors: string[] }> {
  const photoUrls = flattenUrls(workshop.photo_urls);
  const fileUrls = flattenUrls(workshop.file_urls);
  const hasSupabasePhotos = photoUrls.some(isSupabasePhotoUrl);
  const hasSupabaseFiles = fileUrls.some(isSupabaseFileUrl);

  if (!hasSupabasePhotos && !hasSupabaseFiles) {
    return { migrated: false, skipped: true, errors: [] };
  }

  const workOrder = (workshop.clients_work_order || 'workshop').replace(/[^a-zA-Z0-9._-]/g, '_');
  const baseTimestamp = Date.now();
  const newPhotoUrls: string[] = [];
  const newFileUrls: string[] = [];
  const errors: string[] = [];

  const totalPhotosToTransfer = photoUrls.filter(isSupabasePhotoUrl).length;
  const totalFilesToTransfer = fileUrls.filter(isSupabaseFileUrl).length;
  let photoIndex = 0;
  let fileIndex = 0;

  for (let i = 0; i < photoUrls.length; i++) {
    const url = photoUrls[i];
    if (!isSupabasePhotoUrl(url)) {
      newPhotoUrls.push(url);
      continue;
    }
    const path = parsePathFromSupabaseUrl(url, SUPABASE_PHOTOS_MARKER);
    if (!path) {
      newPhotoUrls.push(url);
      continue;
    }
    const name = path.split('/').pop() ?? path;
    try {
      const { data: blob, error: downloadError } = await supabase.storage
        .from('workshop-photos')
        .download(path);
      if (downloadError || !blob) throw new Error(downloadError?.message ?? 'Download failed');
      const buffer = Buffer.from(await blob.arrayBuffer());
      const contentType = blob.type || 'image/jpeg';
      const sanitized = path.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `${WORKSHOP_PHOTOS_PREFIX}/${workOrder}_${baseTimestamp}_p${i + 1}_${sanitized}`;
      const { url: b2Url } = await uploadToB2(key, buffer, contentType);
      newPhotoUrls.push(b2Url);
      photoIndex += 1;
      onProgress({
        type: 'file',
        kind: 'photo',
        index: photoIndex,
        total: totalPhotosToTransfer,
        name
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Workshop ${workshop.id} photo ${i + 1}: ${msg}`);
      newPhotoUrls.push(url);
    }
  }

  for (let i = 0; i < fileUrls.length; i++) {
    const url = fileUrls[i];
    if (!isSupabaseFileUrl(url)) {
      newFileUrls.push(url);
      continue;
    }
    const path = parsePathFromSupabaseUrl(url, SUPABASE_FILES_MARKER);
    if (!path) {
      newFileUrls.push(url);
      continue;
    }
    const name = path.split('/').pop() ?? path;
    try {
      const { data: blob, error: downloadError } = await supabase.storage
        .from('workshop-files')
        .download(path);
      if (downloadError || !blob) throw new Error(downloadError?.message ?? 'Download failed');
      const buffer = Buffer.from(await blob.arrayBuffer());
      const contentType = blob.type || 'application/octet-stream';
      const sanitized = path.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `${WORKSHOP_FILES_PREFIX}/${workOrder}_${baseTimestamp}_f${i + 1}_${sanitized}`;
      const { url: b2Url } = await uploadToB2(key, buffer, contentType);
      newFileUrls.push(b2Url);
      fileIndex += 1;
      onProgress({
        type: 'file',
        kind: 'file',
        index: fileIndex,
        total: totalFilesToTransfer,
        name
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Workshop ${workshop.id} file ${i + 1}: ${msg}`);
      newFileUrls.push(url);
    }
  }

  const backupFiles = {
    migratedAt: new Date().toISOString(),
    photoUrls: newPhotoUrls,
    fileUrls: newFileUrls
  };

  const { error: updateError } = await supabase
    .from('workshop')
    .update({
      backup_files: backupFiles,
      photo_urls: newPhotoUrls,
      file_urls: newFileUrls,
      updated_at: new Date().toISOString()
    })
    .eq('id', workshop.id);

  if (updateError) {
    errors.push(`Workshop ${workshop.id} update: ${updateError.message}`);
    return { migrated: false, skipped: false, errors };
  }
  return { migrated: true, skipped: false, errors };
}
