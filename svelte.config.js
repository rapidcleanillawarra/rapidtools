import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

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
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/rapidtools' : '',
			assets: process.env.NODE_ENV === 'production' ? 'https://rapidcleanillawarra.github.io/rapidtools' : ''
		},
		prerender: {
			handleHttpError: ({ path, referrer, message }) => {
				// ignore 404s during prerendering
				if (message.includes('404')) {
					return;
				}
				// otherwise fail the build
				throw new Error(message);
			},
			default: true,
			entries: ['*']
		},
		appDir: 'app',
		trailingSlash: 'always'
	}
};

export default config;
