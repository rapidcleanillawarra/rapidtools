import fs from 'node:fs';
import path from 'node:path';

function badgeSvg(num) {
	return `<svg class="section-badge" viewBox="0 0 34 34" width="9mm" height="9mm" aria-hidden="true">
		<circle cx="17" cy="17" r="15.5" fill="none" stroke="#78be20" stroke-width="2" />
		<text x="17" y="17" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="13.5" font-weight="700" fill="#5ea015">${num}</text>
	</svg>`;
}

// 1. Preventative Maintenance
const pmFile = fs.readFileSync('src/routes/(protected)/brochures/preventative_maintenance/+page.svelte', 'utf-8');
const pmLines = pmFile.split(/\r?\n/);

// Find brochure div start and end
let pmHtmlStart = pmLines.findIndex(l => l.includes('<div class="brochure"'));
let pmHtmlEnd = pmLines.findIndex((l, i) => i > pmHtmlStart && l.includes('<div class="brochure-toolbar">'));
while (pmHtmlEnd > 0 && !pmLines[pmHtmlEnd].trim().startsWith('</div>')) {
	pmHtmlEnd--;
}

let pmHtml = pmLines.slice(pmHtmlStart, pmHtmlEnd + 1).join('\n');
pmHtml = pmHtml
	.replace('bind:this={brochureEl}', '')
	.replace(/\{@render sectionBadge\('(\d+)'\)\}/g, (_, num) => badgeSvg(num))
	.replace(/\{images\.logo\}/g, '/brochures/shared/company_logo_white.png')
	.replace(/\{images\.cover_hero\}/g, '/brochures/preventative_maintenance/cover_hero.png')
	.replace(/\{images\.intro_image\}/g, '/brochures/preventative_maintenance/intro_image.png')
	.replace(/\{images\.approach_image\}/g, '/brochures/preventative_maintenance/approach_image.png')
	.replace(/\{images\.back_cover_hero\}/g, '/brochures/preventative_maintenance/back_cover_hero.jpg')
	.replace(/\{brandTag\}/g, 'contact@rapidcleanillawarra.com.au · (02) 4227 2833')
	.replace(/\{displayPhone\}/g, '(02) 4227 2833')
	.replace(/\{displayEmail\}/g, 'contact@rapidcleanillawarra.com.au')
	.replace(/\{address\}/g, '112a Industrial Road, Oak Flats NSW 2529')
	.replace(/class=\{?\['next-hero',\s*\{\s*'has-image':\s*Boolean\(images\.next_steps_image\)\s*\}\]\}?/, 'class="next-hero"')
	.replace(/style=\{images\.next_steps_image[\s\S]*?: undefined\}/, '')
	.replace(/\{#if !images\.next_steps_image\}\s*<span class="next-hero-placeholder">Image placeholder<\/span>\s*\{\/if\}/, '<span class="next-hero-placeholder">Image placeholder</span>')
	.replace(/onclick=\{[^}]+\}/g, '')
	.replace(/onkeydown=\{[^}]+\}/g, '')
	.replace(/(['"])\{base\}\//g, '$1/')
	.replace(/\{base\}\//g, '/')
	.replace(/\{base\}/g, '');

const pmStyleMatch = pmFile.match(/<style>([\s\S]*?)<\/style>/);
const pmCss = pmStyleMatch ? pmStyleMatch[1].trim() : '';

// 2. Washroom Fitout
const wfFile = fs.readFileSync('src/routes/(protected)/brochures/washroom_fitout/+page.svelte', 'utf-8');
const wfLines = wfFile.split(/\r?\n/);

let wfHtmlStart = wfLines.findIndex(l => l.includes('<div class="brochure"'));
let wfHtmlEnd = wfLines.findIndex((l, i) => i > wfHtmlStart && l.includes('<div class="brochure-toolbar">'));
while (wfHtmlEnd > 0 && !wfLines[wfHtmlEnd].trim().startsWith('</div>')) {
	wfHtmlEnd--;
}

let wfHtml = wfLines.slice(wfHtmlStart, wfHtmlEnd + 1).join('\n');
const soapIcon = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2048%2048%22%20fill%3D%22none%22%20stroke%3D%22%232f6f2f%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%2214%22%20y%3D%2217%22%20width%3D%2220%22%20height%3D%2225%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22M19%2017v-4h10v4%22%2F%3E%3Crect%20x%3D%2221%22%20y%3D%226%22%20width%3D%226%22%20height%3D%227%22%20rx%3D%221%22%2F%3E%3Cpath%20d%3D%22M27%209h7%22%2F%3E%3C%2Fsvg%3E';
const toiletIcon = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2048%2048%22%20fill%3D%22none%22%20stroke%3D%22%232f6f2f%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cellipse%20cx%3D%2222%22%20cy%3D%2215%22%20rx%3D%2213%22%20ry%3D%226%22%2F%3E%3Cpath%20d%3D%22M9%2015v15c0%203.3%205.8%206%2013%206s13-2.7%2013-6V15%22%2F%3E%3Cellipse%20cx%3D%2222%22%20cy%3D%2215%22%20rx%3D%224.5%22%20ry%3D%222%22%2F%3E%3Cpath%20d%3D%22M35%2024c4%200%204%209%200%209%22%2F%3E%3C%2Fsvg%3E';
const towelIcon = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2048%2048%22%20fill%3D%22none%22%20stroke%3D%22%232f6f2f%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%2211%22%20y%3D%228%22%20width%3D%2226%22%20height%3D%2223%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22M17%2015h14M17%2020h14%22%20opacity%3D%220.6%22%2F%3E%3Cpath%20d%3D%22M21%2031c0%205%206%204%206%209%22%2F%3E%3C%2Fsvg%3E';

wfHtml = wfHtml
	.replace('bind:this={brochureEl}', '')
	.replace(/\{@render sectionBadge\('(\d+)'\)\}/g, (_, num) => badgeSvg(num))
	.replace(/\{images\.logo\}/g, '/brochures/shared/company_logo_white.png')
	.replace(/\{images\.cover_hero\}/g, '/brochures/washroom_fitout/cover_hero.jpg')
	.replace(/\{images\.support_logo\}/g, '/brochures/shared/company_logo_black.png')
	.replace(/\{images\.product_soap\}/g, soapIcon)
	.replace(/\{images\.product_toilet\}/g, toiletIcon)
	.replace(/\{images\.product_towel\}/g, towelIcon)
	.replace(/\{brandTag\}/g, 'contact@rapidcleanillawarra.com.au · (02) 4227 2833')
	.replace(/\{displayPhone\}/g, '(02) 4227 2833')
	.replace(/\{displayEmail\}/g, 'contact@rapidcleanillawarra.com.au')
	.replace(/\{address\}/g, '112a Industrial Road, Oak Flats NSW 2529')
	.replace(/onclick=\{[^}]+\}/g, '')
	.replace(/onkeydown=\{[^}]+\}/g, '')
	.replace(/(['"])\{base\}\//g, '$1/')
	.replace(/\{base\}\//g, '/')
	.replace(/\{base\}/g, '');

const wfStyleMatch = wfFile.match(/<style>([\s\S]*?)<\/style>/);
const wfCss = wfStyleMatch ? wfStyleMatch[1].trim() : '';

const outputDir = path.resolve('src/lib/brochures/defaultTemplates');
if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(
	path.join(outputDir, 'preventative_maintenance.json'),
	JSON.stringify(
		{
			slug: 'preventative_maintenance',
			title: 'Preventative Maintenance',
			html: pmHtml,
			css: pmCss,
			js: '// Custom JavaScript for Preventative Maintenance brochure\nconsole.log("Preventative Maintenance Brochure loaded");'
		},
		null,
		2
	)
);

fs.writeFileSync(
	path.join(outputDir, 'washroom_fitout.json'),
	JSON.stringify(
		{
			slug: 'washroom_fitout',
			title: 'Washroom Fitout',
			html: wfHtml,
			css: wfCss,
			js: '// Custom JavaScript for Washroom Fitout brochure\nconsole.log("Washroom Fitout Brochure loaded");'
		},
		null,
		2
	)
);

console.log('Successfully generated default brochure templates!');
