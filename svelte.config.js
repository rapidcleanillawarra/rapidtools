import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Derive base/assets automatically for GitHub Pages while allowing overrides.
const repoParts = (process.env.GITHUB_REPOSITORY || '').split('/');
const repoOwner = repoParts[0] || 'rapidcleanillawarra';
const repoName = repoParts[1] || 'rapidtools';
const isProd = process.env.NODE_ENV === 'production';
const basePath = process.env.BASE_PATH ?? (isProd ? `/${repoName}` : '');
const assetsPath =
	process.env.ASSETS_PATH ?? (isProd ? `https://${repoOwner}.github.io/${repoName}` : '');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html',
			precompress: false,
			strict: true
		}),
		paths: {
			base: basePath,
			assets: assetsPath
		},
		prerender: {
			handleHttpError: ({ path, referrer, message }) => {
				// ignore 404s during prerendering
				if (message.includes('404')) {
					return;
				}
				// otherwise fail the build
				throw new Error(message);
			}
		},
		appDir: 'app'
	}
};

export default config;
