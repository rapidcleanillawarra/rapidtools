import { XeroClient } from 'xero-node';
import crypto from 'crypto';

// Xero OAuth2 configuration
export const XERO_CONFIG = {
    clientId: import.meta.env.VITE_XERO_CLIENT_ID,
    clientSecret: import.meta.env.VITE_XERO_CLIENT_SECRET,
    redirectUri: import.meta.env.VITE_XERO_REDIRECT_URI,
    scopes: [
        'offline_access',
        'accounting.transactions',
        'accounting.settings',
        'accounting.contacts'
    ]
};

// Initialize Xero client
export const xeroClient = new XeroClient({
    clientId: XERO_CONFIG.clientId,
    clientSecret: XERO_CONFIG.clientSecret,
    redirectUris: [XERO_CONFIG.redirectUri],
    scopes: XERO_CONFIG.scopes,
    state: 'random-state' // You might want to generate this dynamically
});

// Generate PKCE challenge and verifier
export async function generatePKCEChallenge() {
    const verifier = generateRandomString(128);
    const challenge = generateCodeChallenge(verifier);
    return { verifier, challenge };
}

// Helper function to generate random string
function generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

// Helper function to generate code challenge
function generateCodeChallenge(verifier: string): string {
    return crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
} 