import { base } from '$app/paths';

/**
 * Generate a proxy URL for images to bypass CORS issues
 */
export function getProxyImageUrl(originalUrl: string): string {
  // Only proxy Supabase storage URLs
  if (!originalUrl.includes('supabase.co/storage/v1/object/public/workshop-photos/')) {
    return originalUrl;
  }

  // Encode the original URL and create proxy URL
  const encodedUrl = encodeURIComponent(originalUrl);
  return `${base}/api/images?url=${encodedUrl}`;
}

/**
 * Check if an image URL needs proxying
 */
export function needsProxy(url: string): boolean {
  return url.includes('supabase.co/storage/v1/object/public/workshop-photos/');
}
