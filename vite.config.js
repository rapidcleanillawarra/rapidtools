import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	css: {
		postcss: './postcss.config.js'
	},
	optimizeDeps: {
		
	},
	assetsInclude: ['**/*.svg'],
	build: {
		rollupOptions: {
			output: {
				assetFileNames: (assetInfo) => {
					if (assetInfo.name && assetInfo.name.endsWith('.svg')) {
						return 'images/[name].[ext]';
					}
					return 'assets/[name]-[hash].[ext]';
				}
			}
		}
	}
}); 