import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const imageUrl = url.searchParams.get('url');

    if (!imageUrl) {
      throw error(400, 'Missing image URL parameter');
    }

    // Validate that the URL is from our Supabase storage
    if (!imageUrl.includes('supabase.co/storage/v1/object/public/workshop-photos/')) {
      throw error(403, 'Invalid image URL');
    }

    // Fetch the image from Supabase
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw error(response.status, 'Failed to fetch image');
    }

    // Return the image with proper headers
    const imageBlob = await response.blob();

    return new Response(imageBlob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (err) {
    console.error('Image proxy error:', err);
    throw error(500, 'Failed to proxy image');
  }
};
