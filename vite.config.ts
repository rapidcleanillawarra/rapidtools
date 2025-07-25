import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	base: process.env.NODE_ENV === 'production' ? '/rapidtools' : '/',
	build: {
		target: 'esnext',
		minify: 'esbuild',
		assetsDir: 'assets',
		rollupOptions: {
			output: {
				manualChunks: undefined
			}
		}
	}
});
