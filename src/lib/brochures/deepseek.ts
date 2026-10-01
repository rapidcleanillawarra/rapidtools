/**
 * DeepSeek AI Client & Utility Library for Brochure HTML/CSS/JS editing
 */

export interface DeepSeekConfig {
	apiKey: string;
	model: 'deepseek-chat' | 'deepseek-reasoner' | string;
	temperature: number;
}

export interface DeepSeekMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface ExtractedCodeChanges {
	explanation: string;
	html?: string;
	css?: string;
	js?: string;
	hasChanges: boolean;
}

const STORAGE_KEY_API_KEY = 'deepseek_api_key';
const STORAGE_KEY_MODEL = 'deepseek_model';
const STORAGE_KEY_TEMPERATURE = 'deepseek_temperature';

const DIRECT_API_URL = 'https://api.deepseek.com/chat/completions';
const LOCAL_PROXY_URL = '/api/deepseek';

export function getStoredDeepSeekApiKey(): string {
	if (typeof window === 'undefined') return '';
	try {
		const local = localStorage.getItem(STORAGE_KEY_API_KEY);
		if (local && local.trim()) return local.trim();
	} catch {
		// ignore localStorage errors
	}
	const envKey = (import.meta as any).env?.VITE_DEEPSEEK_API_KEY;
	return envKey ? String(envKey).trim() : '';
}

export function setStoredDeepSeekApiKey(key: string): void {
	if (typeof window === 'undefined') return;
	try {
		if (key.trim()) {
			localStorage.setItem(STORAGE_KEY_API_KEY, key.trim());
		} else {
			localStorage.removeItem(STORAGE_KEY_API_KEY);
		}
	} catch {
		// ignore
	}
}

export function getStoredDeepSeekModel(): string {
	if (typeof window === 'undefined') return 'deepseek-chat';
	try {
		return localStorage.getItem(STORAGE_KEY_MODEL) || 'deepseek-chat';
	} catch {
		return 'deepseek-chat';
	}
}

export function setStoredDeepSeekModel(model: string): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY_MODEL, model);
	} catch {
		// ignore
	}
}

export function getStoredDeepSeekTemperature(): number {
	if (typeof window === 'undefined') return 0.3;
	try {
		const saved = localStorage.getItem(STORAGE_KEY_TEMPERATURE);
		return saved ? parseFloat(saved) : 0.3;
	} catch {
		return 0.3;
	}
}

export function setStoredDeepSeekTemperature(temp: number): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY_TEMPERATURE, String(temp));
	} catch {
		// ignore
	}
}

/** Build system instructions for brochure HTML/CSS/JS editing */
export function buildBrochureSystemPrompt(title: string, slug: string): string {
	return `You are an expert web designer and front-end developer for RapidClean Illawarra (a leading commercial cleaning equipment and chemical supplies provider in NSW, Australia).
You are editing a print-ready, professional multi-page brochure titled "${title}" (slug: "${slug}").

TECHNICAL BROCHURE SPECIFICATIONS:
1. Multi-Page Architecture:
   - The document consists of multiple pages wrapped in \`<section class="page ...">\`.
   - Each page is designed for A4 portrait: 210mm wide x 297mm high with \`page-break-after: always;\`.
   - In CSS, \`@page { size: A4 portrait; margin: 0; }\` and \`@media print { ... }\` rules preserve true print formatting.
2. RapidClean Brand Identity:
   - Primary Green: #78be20
   - Deep Accent Green: #2f6f2f
   - Dark Text/Backgrounds: #11181f, #1f2933
   - Muted Gray: #5f6b76
   - Light Background: #f4f8f1, #ffffff
   - Professional, corporate, crisp, high readability.
3. Assets & Images:
   - Image paths use absolute URLs or local brochure asset paths such as \`/brochures/shared/company_logo_white.png\`, etc.
   - Do not break existing working image URLs or structure unless instructed.

OUTPUT FORMAT REQUIREMENTS:
When answering the user's request:
1. Explain what modifications you made in clear, concise bullet points first.
2. If your changes require HTML updates, provide the updated HTML in a single markdown block:
\`\`\`html
<!-- complete or updated HTML markup -->
\`\`\`
3. If your changes require CSS updates, provide the updated CSS in a single markdown block:
\`\`\`css
/* complete or updated CSS styles */
\`\`\`
4. If your changes require JavaScript updates, provide the updated JS in a single markdown block:
\`\`\`js
// complete or updated JavaScript code
\`\`\`
5. CRITICAL EFFICIENCY RULE:
   - ONLY include a code block for the language that you actually changed!
   - For example, if the user asks to "Change button colors to orange" or "Fix page margins", ONLY output a \`\`\`css block. DO NOT re-output the entire HTML.
   - If the user asks to "Change the phone number on page 1", you only need to output the HTML.
   - If you output a full file, make sure it is complete so the user can directly apply it.`;
}

/** Extract code blocks (html, css, js) and clean text explanation from DeepSeek output */
export function extractCodeBlocks(markdown: string): ExtractedCodeChanges {
	let html: string | undefined;
	let css: string | undefined;
	let js: string | undefined;

	// Regex to match ```html ... ```
	const htmlMatch = markdown.match(/```(?:html|htm)\s*\n([\s\S]*?)\n```/i);
	if (htmlMatch) {
		html = htmlMatch[1].trim();
	}

	// Regex to match ```css ... ```
	const cssMatch = markdown.match(/```css\s*\n([\s\S]*?)\n```/i);
	if (cssMatch) {
		css = cssMatch[1].trim();
	}

	// Regex to match ```js ... ``` or ```javascript ... ```
	const jsMatch = markdown.match(/```(?:javascript|js)\s*\n([\s\S]*?)\n```/i);
	if (jsMatch) {
		js = jsMatch[1].trim();
	}

	// Strip out code blocks from the explanation text
	const explanation = markdown
		.replace(/```(?:html|htm)\s*\n[\s\S]*?\n```/gi, '')
		.replace(/```css\s*\n[\s\S]*?\n```/gi, '')
		.replace(/```(?:javascript|js)\s*\n[\s\S]*?\n```/gi, '')
		.trim();

	const hasChanges = Boolean(html !== undefined || css !== undefined || js !== undefined);

	return {
		explanation: explanation || 'Updated code as requested.',
		html,
		css,
		js,
		hasChanges
	};
}

/** Test DeepSeek API connection with a brief verification call */
export async function testDeepSeekConnection(
	apiKey: string,
	model = 'deepseek-chat'
): Promise<{ ok: boolean; message: string }> {
	const key = apiKey.trim();
	if (!key) {
		return { ok: false, message: 'Please enter a DeepSeek API key.' };
	}

	try {
		// Attempt direct call to DeepSeek API
		const response = await fetch(DIRECT_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${key}`
			},
			body: JSON.stringify({
				model,
				messages: [{ role: 'user', content: 'Respond with "OK".' }],
				max_tokens: 5,
				temperature: 0.1
			})
		});

		if (!response.ok) {
			const errText = await response.text();
			let detail = `Error ${response.status}: ${response.statusText}`;
			try {
				const json = JSON.parse(errText);
				if (json?.error?.message) detail = json.error.message;
			} catch {
				// use errText if short
				if (errText.length < 200) detail = errText;
			}
			return { ok: false, message: detail };
		}

		return { ok: true, message: `Connected successfully to DeepSeek (${model})!` };
	} catch (err: any) {
		return { ok: false, message: err?.message || 'Failed to connect to DeepSeek API.' };
	}
}

/**
 * Send a prompt to DeepSeek API, handling proxy fallback and context assembly
 */
export async function askDeepSeekBrochure({
	prompt,
	history = [],
	currentHtml,
	currentCss,
	currentJs,
	brochureTitle,
	brochureSlug,
	includeCodeContext = true,
	config
}: {
	prompt: string;
	history?: DeepSeekMessage[];
	currentHtml: string;
	currentCss: string;
	currentJs: string;
	brochureTitle: string;
	brochureSlug: string;
	includeCodeContext?: boolean;
	config?: Partial<DeepSeekConfig>;
}): Promise<{
	reply: string;
	extracted: ExtractedCodeChanges;
	error?: string;
}> {
	const apiKey = config?.apiKey || getStoredDeepSeekApiKey();
	const model = config?.model || getStoredDeepSeekModel();
	const temperature = config?.temperature ?? getStoredDeepSeekTemperature();

	if (!apiKey) {
		return {
			reply: '',
			extracted: { explanation: '', hasChanges: false },
			error: 'No DeepSeek API key found. Please set your API key in Settings.'
		};
	}

	const systemPrompt = buildBrochureSystemPrompt(brochureTitle, brochureSlug);

	const messages: DeepSeekMessage[] = [
		{ role: 'system', content: systemPrompt },
		...history
	];

	// Construct user message with current code context if requested
	let userContent = prompt.trim();
	if (includeCodeContext) {
		userContent += `\n\n--- CURRENT BROCHURE SOURCE CODE ---\n\n`;
		if (currentHtml) {
			userContent += `\`\`\`html\n${currentHtml}\n\`\`\`\n\n`;
		}
		if (currentCss) {
			userContent += `\`\`\`css\n${currentCss}\n\`\`\`\n\n`;
		}
		if (currentJs && currentJs.trim()) {
			userContent += `\`\`\`js\n${currentJs}\n\`\`\`\n\n`;
		}
		userContent += `--- END OF SOURCE CODE ---`;
	}

	messages.push({ role: 'user', content: userContent });

	try {
		// First attempt direct call to DeepSeek
		let response: Response;
		try {
			response = await fetch(DIRECT_API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey.trim()}`
				},
				body: JSON.stringify({
					model,
					messages,
					temperature,
					max_tokens: 8192
				})
			});
		} catch (corsOrNetworkErr) {
			// Direct browser call failed (e.g. CORS or network), try local proxy
			response = await fetch(LOCAL_PROXY_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					apiKey: apiKey.trim(),
					model,
					messages,
					temperature,
					max_tokens: 8192
				})
			});
		}

		if (!response.ok) {
			const errText = await response.text();
			let detail = `DeepSeek Error (${response.status}): ${response.statusText}`;
			try {
				const json = JSON.parse(errText);
				if (json?.error?.message) detail = json.error.message;
			} catch {
				if (errText.length < 200) detail = errText;
			}
			return {
				reply: '',
				extracted: { explanation: '', hasChanges: false },
				error: detail
			};
		}

		const data = await response.json();
		const reply = data?.choices?.[0]?.message?.content || '';
		const extracted = extractCodeBlocks(reply);

		return { reply, extracted };
	} catch (err: any) {
		return {
			reply: '',
			extracted: { explanation: '', hasChanges: false },
			error: err?.message || 'Failed to communicate with DeepSeek API'
		};
	}
}
