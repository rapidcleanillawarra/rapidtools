# Backblaze B2 storage setup

Workshop photos and files can be stored in **Backblaze B2** when configured. If B2 is not configured, the app falls back to **Supabase Storage**.

## 1. Create a B2 bucket

1. Log in to [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html).
2. Create a bucket (e.g. `rapidtools-workshop`).
3. Choose **Public** if you want direct public URLs for photos/files, or **Private** and use signed URLs later.
4. Note the bucket name and the **S3 endpoint** shown in bucket settings (e.g. `https://s3.us-west-004.backblazeb2.com`).

## 2. Create an application key

1. In B2, go to **App Keys** and create a new key.
2. Give it a name (e.g. `rapidtools-upload`).
3. Allow **Read and Write** access to your bucket.
4. Copy the **keyID** and **applicationKey** (shown once).

## 3. Environment variables

Add these to your `.env` (or server environment). **Do not commit the real key to git.**

```env
# Backblaze B2 (optional – omit to use Supabase storage)
B2_KEY_ID=your_key_id
B2_APPLICATION_KEY=your_application_key
B2_BUCKET_NAME=rapidtools-workshop
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004

# Public URL for uploaded files (required for public buckets)
# Use the bucket’s S3 endpoint URL, e.g.:
B2_PUBLIC_BASE_URL=https://yourbucket.s3.us-west-004.backblazeb2.com
```

- **B2_KEY_ID** – Application key ID from B2.
- **B2_APPLICATION_KEY** – Application key secret.
- **B2_BUCKET_NAME** – Bucket name.
- **B2_ENDPOINT** – S3-compatible endpoint (from bucket details).
- **B2_REGION** – Region in the endpoint (e.g. `us-west-004`).
- **B2_PUBLIC_BASE_URL** – Base URL for public file links. For a public bucket this is usually `https://<bucketName>.s3.<region>.backblazeb2.com`.

## Troubleshooting

- **"Malformed Access Key Id"** – Use an **Application Key** created under **App Keys** (with Read/Write access to the bucket). Do **not** use your account’s Master Application Key; the S3-Compatible API does not accept it. Also ensure `.env` has no extra spaces or quotes around the values (e.g. use `B2_KEY_ID=0115f434a6ce` not `B2_KEY_ID = "0115f434a6ce"`).
- **"Invalid URL"** – Set `B2_ENDPOINT` to a full URL, e.g. `https://s3.us-west-004.backblazeb2.com` (include `https://`).

## 4. Behaviour

- **Create/update workshop** with photos or files: the app calls `POST /api/storage/upload-workshop`.
- If B2 env vars are set, uploads go to B2 and the returned URLs are saved on the workshop.
- If B2 is not set (or the API returns 503), uploads use Supabase storage as before.

## 5. Static / serverless deploy

This app uses `adapter-static`. The upload API only runs when the SvelteKit server is running (e.g. `npm run dev` or `npm run preview`). For production with B2 you need a Node (or serverless) environment that runs the API routes (e.g. adapter-node, or a separate backend that implements the same upload flow).
