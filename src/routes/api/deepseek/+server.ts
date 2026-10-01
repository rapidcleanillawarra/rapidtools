import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			messages,
			model = 'deepseek-chat',
			temperature = 0.3,
			max_tokens = 8192,
			apiKey: clientApiKey,
			stream = false
		} = body;

		// Use client-provided key or server environment key
		const apiKey =
			clientApiKey ||
			process.env.DEEPSEEK_API_KEY ||
			process.env.VITE_DEEPSEEK_API_KEY;

		if (!apiKey) {
			throw error(400, 'DeepSeek API key is required. Please provide it in settings or set DEEPSEEK_API_KEY in your environment.');
		}

		if (!messages || !Array.isArray(messages)) {
			throw error(400, 'Messages array is required.');
		}

		const response = await fetch(DEEPSEEK_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey.trim()}`
			},
			body: JSON.stringify({
				model,
				messages,
				temperature,
				max_tokens,
				stream
			})
		});

		if (!response.ok) {
			const errText = await response.text();
			let parsedErr: any;
			try {
				parsedErr = JSON.parse(errText);
			} catch {
				parsedErr = { error: { message: errText } };
			}
			const message =
				parsedErr?.error?.message ||
				parsedErr?.message ||
				`DeepSeek API error: ${response.status} ${response.statusText}`;
			throw error(response.status, message);
		}

		if (stream && response.body) {
			return new Response(response.body, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive'
				}
			});
		}

		const data = await response.json();
		return json(data);
	} catch (err: any) {
		console.error('DeepSeek proxy error:', err);
		const status = err?.status || 500;
		const message = err?.body?.message || err?.message || 'Internal Server Error';
		throw error(status, message);
	}
};
