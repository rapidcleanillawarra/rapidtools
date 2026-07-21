import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * GitHub Pages serves `/` from `index.html`, while adapter-static SPA mode
 * emits the client shell as the fallback (`404.html`). Copy it so the root
 * URL loads the app.
 */
const buildDir = join(process.cwd(), 'build');
const fallback = join(buildDir, '404.html');
const index = join(buildDir, 'index.html');

if (!existsSync(fallback)) {
	console.error('copy-spa-index: build/404.html not found. Did the Vite build succeed?');
	process.exit(1);
}

copyFileSync(fallback, index);
console.log('copy-spa-index: wrote build/index.html from build/404.html');
