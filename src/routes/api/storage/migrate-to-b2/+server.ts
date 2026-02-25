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

function normalizeToStringArray(value: string[] | string | null | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export const POST: RequestHandler = async () => {
  if (!isB2Configured()) {
    return json(
      { error: 'Cold storage (B2) is not configured.', migrated: 0, skipped: 0, errors: [] },
      { status: 503 }
    );
  }

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
  let migrated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const workshop of list) {
    const photoUrls = normalizeToStringArray(workshop.photo_urls);
    const fileUrls = normalizeToStringArray(workshop.file_urls);
    const hasSupabasePhotos = photoUrls.some(isSupabasePhotoUrl);
    const hasSupabaseFiles = fileUrls.some(isSupabaseFileUrl);

    if (!hasSupabasePhotos && !hasSupabaseFiles) {
      skipped += 1;
      continue;
    }

    const workOrder = (workshop.clients_work_order || 'workshop').replace(/[^a-zA-Z0-9._-]/g, '_');
    const baseTimestamp = Date.now();
    const newPhotoUrls: string[] = [];
    const newFileUrls: string[] = [];

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
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const sanitized = path.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `${WORKSHOP_PHOTOS_PREFIX}/${workOrder}_${baseTimestamp}_p${i + 1}_${sanitized}`;
        const { url: b2Url } = await uploadToB2(key, buffer, contentType);
        newPhotoUrls.push(b2Url);
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
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') || 'application/octet-stream';
        const sanitized = path.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `${WORKSHOP_FILES_PREFIX}/${workOrder}_${baseTimestamp}_f${i + 1}_${sanitized}`;
        const { url: b2Url } = await uploadToB2(key, buffer, contentType);
        newFileUrls.push(b2Url);
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
    } else {
      migrated += 1;
    }
  }

  return json({ migrated, skipped, errors });
};
