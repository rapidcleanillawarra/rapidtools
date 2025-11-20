import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
	plugins: [
		tailwindcss(), 
		sveltekit(),
		{
			name: 'copy-tinymce-skins',
			closeBundle() {
				const tinymceSkinsSrc = 'node_modules/tinymce/skins';
				const tinymceSkinsTarget = 'static/tinymce/skins';
				
				if (fs.existsSync(tinymceSkinsSrc)) {
					fs.cpSync(tinymceSkinsSrc, tinymceSkinsTarget, { recursive: true });
				}
			}
		}
	],
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
	},
	optimizeDeps: {
		include: ['tinymce']
	}
});
