import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { xeroClient } from '$lib/xero';

export const load = async ({ url, cookies }: RequestEvent) => {
    try {
        // Get the authorization code from the URL
        const code = url.searchParams.get('code');
        if (!code) {
            throw new Error('No authorization code received');
        }

        // Get the code verifier from the cookie
        const codeVerifier = cookies.get('xero_code_verifier');
        if (!codeVerifier) {
            throw new Error('No code verifier found');
        }

        // Exchange the code for tokens
        const tokenSet = await xeroClient.apiCallback(code);

        // Ensure we have valid tokens
        if (!tokenSet.access_token || !tokenSet.refresh_token) {
            throw new Error('Invalid token response from Xero');
        }

        // Store the tokens securely (you might want to store these in your database)
        // For now, we'll store them in cookies (not recommended for production)
        cookies.set('xero_access_token', tokenSet.access_token, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: tokenSet.expires_in || 3600 // Default to 1 hour if expires_in is not provided
        });

        cookies.set('xero_refresh_token', tokenSet.refresh_token, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30 // 30 days
        });

        // Clear the code verifier cookie
        cookies.delete('xero_code_verifier', { path: '/' });

        // Redirect to a success page or dashboard
        throw redirect(302, '/dashboard');
    } catch (error) {
        console.error('Error in Xero callback:', error);
        // Redirect to an error page
        throw redirect(302, '/xero-auth/error');
    }
}; 