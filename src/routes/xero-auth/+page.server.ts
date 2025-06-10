import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { xeroClient, generatePKCEChallenge } from '$lib/xero';

export const actions = {
    default: async ({ cookies }: RequestEvent) => {
        try {
            // Generate PKCE challenge and verifier
            const { verifier, challenge } = await generatePKCEChallenge();
            
            // Store the verifier in a cookie for later use
            cookies.set('xero_code_verifier', verifier, {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 10 // 10 minutes
            });

            // Generate the authorization URL
            const authUrl = await xeroClient.buildConsentUrl();

            // Add PKCE parameters to the URL
            const urlWithPKCE = new URL(authUrl);
            urlWithPKCE.searchParams.append('code_challenge', challenge);
            urlWithPKCE.searchParams.append('code_challenge_method', 'S256');

            // Redirect to Xero's authorization page
            throw redirect(302, urlWithPKCE.toString());
        } catch (error) {
            console.error('Error initiating Xero auth:', error);
            throw error;
        }
    }
}; 