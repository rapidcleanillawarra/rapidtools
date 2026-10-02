import { supabase } from '$lib/supabase';
import pmDefault from './defaultTemplates/preventative_maintenance.json';
import wfDefault from './defaultTemplates/washroom_fitout.json';

export interface BrochureTemplate {
	slug: string;
	title: string;
	html: string;
	css: string;
	js: string;
	is_active: boolean;
	updated_at?: string;
	created_at?: string;
}

export interface BrochureTemplateVersion {
	id: string;
	slug: string;
	version_number: number;
	label: string;
	html: string;
	css: string;
	js: string;
	created_at: string;
	created_by?: string;
}

const DEFAULT_TEMPLATES: Record<string, Omit<BrochureTemplate, 'is_active'>> = {
	preventative_maintenance: pmDefault,
	washroom_fitout: wfDefault
};

/** Get the built-in default template for a given brochure slug. */
export function getDefaultBrochureTemplate(slug: string): BrochureTemplate {
	const fallback = DEFAULT_TEMPLATES[slug];
	if (fallback) {
		return {
			slug: fallback.slug,
			title: fallback.title,
			html: fallback.html,
			css: fallback.css,
			js: fallback.js,
			is_active: false
		};
	}
	return {
		slug,
		title: slug.replace(/_/g, ' '),
		html: '<div class="brochure">\n  <section class="page">\n    <h1>Brochure</h1>\n  </section>\n</div>',
		css: '.brochure { font-family: sans-serif; }',
		js: '',
		is_active: false
	};
}

/** Load custom brochure template from Supabase. */
export async function loadBrochureTemplate(slug: string): Promise<{
	template: BrochureTemplate | null;
	error: string | null;
}> {
	try {
		const { data, error } = await supabase
			.from('brochure_templates')
			.select('slug, title, html, css, js, is_active, updated_at, created_at')
			.eq('slug', slug)
			.maybeSingle();

		if (error) {
			return { template: null, error: error.message };
		}

		if (!data) {
			return { template: null, error: null };
		}

		return {
			template: {
				slug: data.slug,
				title: data.title ?? slug,
				html: data.html ?? '',
				css: data.css ?? '',
				js: data.js ?? '',
				is_active: data.is_active ?? true,
				updated_at: data.updated_at,
				created_at: data.created_at
			},
			error: null
		};
	} catch (err: any) {
		return { template: null, error: err?.message || 'Failed to fetch brochure template' };
	}
}

/** Save or update brochure template in Supabase, with automatic version tracking. */
export async function saveBrochureTemplate(
	template: BrochureTemplate,
	options?: {
		createVersion?: boolean;
		versionLabel?: string;
	}
): Promise<{ error: string | null; version?: BrochureTemplateVersion | null }> {
	try {
		const { error } = await supabase.from('brochure_templates').upsert(
			{
				slug: template.slug,
				title: template.title,
				html: template.html,
				css: template.css,
				js: template.js,
				is_active: template.is_active,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'slug' }
		);

		if (error) {
			return { error: error.message };
		}

		let createdVersion: BrochureTemplateVersion | null = null;
		if (options?.createVersion !== false) {
			const verRes = await saveBrochureTemplateVersion({
				slug: template.slug,
				html: template.html,
				css: template.css,
				js: template.js,
				label: options?.versionLabel || 'Saved changes'
			});
			if (verRes.version) {
				createdVersion = verRes.version;
			}
		}

		return { error: null, version: createdVersion };
	} catch (err: any) {
		return { error: err?.message || 'Failed to save brochure template' };
	}
}

/** Retrieve all historical versions for a brochure template. */
export async function listBrochureTemplateVersions(slug: string): Promise<{
	versions: BrochureTemplateVersion[];
	error: string | null;
}> {
	try {
		// 1. Try Supabase
		const { data, error } = await supabase
			.from('brochure_template_versions')
			.select('id, slug, version_number, label, html, css, js, created_at, created_by')
			.eq('slug', slug)
			.order('version_number', { ascending: false });

		if (!error && data && data.length > 0) {
			const versions: BrochureTemplateVersion[] = data.map((row) => ({
				id: row.id,
				slug: row.slug,
				version_number: row.version_number,
				label: row.label || `Version ${row.version_number}`,
				html: row.html ?? '',
				css: row.css ?? '',
				js: row.js ?? '',
				created_at: row.created_at,
				created_by: row.created_by
			}));

			// Cache locally
			if (typeof localStorage !== 'undefined') {
				try {
					localStorage.setItem(`brochure_versions_${slug}`, JSON.stringify(versions));
				} catch {}
			}

			return { versions, error: null };
		}

		// 2. Fallback to localStorage if table not found or Supabase returns empty
		if (typeof localStorage !== 'undefined') {
			try {
				const cached = localStorage.getItem(`brochure_versions_${slug}`);
				if (cached) {
					const parsed = JSON.parse(cached) as BrochureTemplateVersion[];
					if (parsed && parsed.length > 0) {
						return { versions: parsed, error: null };
					}
				}
			} catch {}
		}

		// 3. If no versions exist yet, seed a baseline version from built-in template
		const fallback = getDefaultBrochureTemplate(slug);
		const baselineVersion: BrochureTemplateVersion = {
			id: `baseline_${slug}`,
			slug,
			version_number: 1,
			label: 'Initial built-in baseline',
			html: fallback.html,
			css: fallback.css,
			js: fallback.js,
			created_at: new Date(Date.now() - 86400000).toISOString()
		};

		return { versions: [baselineVersion], error: null };
	} catch (err: any) {
		// Graceful localStorage fallback on network or setup error
		if (typeof localStorage !== 'undefined') {
			try {
				const cached = localStorage.getItem(`brochure_versions_${slug}`);
				if (cached) {
					return { versions: JSON.parse(cached), error: null };
				}
			} catch {}
		}
		const fallback = getDefaultBrochureTemplate(slug);
		return {
			versions: [
				{
					id: `baseline_${slug}`,
					slug,
					version_number: 1,
					label: 'Initial built-in baseline',
					html: fallback.html,
					css: fallback.css,
					js: fallback.js,
					created_at: new Date().toISOString()
				}
			],
			error: null
		};
	}
}

/** Save a new version snapshot of a brochure template. */
export async function saveBrochureTemplateVersion(params: {
	slug: string;
	html: string;
	css?: string;
	js?: string;
	label?: string;
	version_number?: number;
}): Promise<{ version: BrochureTemplateVersion | null; error: string | null }> {
	const { slug, html, css = '', js = '', label } = params;

	// Calculate next version number
	let nextVer = params.version_number;
	if (!nextVer) {
		const existing = await listBrochureTemplateVersions(slug);
		const maxVer = existing.versions.reduce((max, v) => Math.max(max, v.version_number), 0);
		nextVer = maxVer + 1;
	}

	const newVersion: BrochureTemplateVersion = {
		id:
			typeof crypto !== 'undefined' && crypto.randomUUID
				? crypto.randomUUID()
				: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		slug,
		version_number: nextVer,
		label: label || `Version ${nextVer}`,
		html,
		css,
		js,
		created_at: new Date().toISOString()
	};

	try {
		// Attempt Supabase insert
		const { data, error } = await supabase
			.from('brochure_template_versions')
			.insert({
				id: newVersion.id,
				slug: newVersion.slug,
				version_number: newVersion.version_number,
				label: newVersion.label,
				html: newVersion.html,
				css: newVersion.css,
				js: newVersion.js,
				created_at: newVersion.created_at
			})
			.select()
			.maybeSingle();

		if (data?.id) {
			newVersion.id = data.id;
		}

		// Always mirror in localStorage for offline resiliency
		if (typeof localStorage !== 'undefined') {
			try {
				const cached = localStorage.getItem(`brochure_versions_${slug}`);
				const list: BrochureTemplateVersion[] = cached ? JSON.parse(cached) : [];
				const updated = [newVersion, ...list.filter((v) => v.id !== newVersion.id)];
				localStorage.setItem(`brochure_versions_${slug}`, JSON.stringify(updated));
			} catch {}
		}

		return { version: newVersion, error: null };
	} catch (err: any) {
		// Fallback to localStorage if Supabase table has not been migrated yet
		if (typeof localStorage !== 'undefined') {
			try {
				const cached = localStorage.getItem(`brochure_versions_${slug}`);
				const list: BrochureTemplateVersion[] = cached ? JSON.parse(cached) : [];
				const updated = [newVersion, ...list.filter((v) => v.id !== newVersion.id)];
				localStorage.setItem(`brochure_versions_${slug}`, JSON.stringify(updated));
				return { version: newVersion, error: null };
			} catch (localErr: any) {
				return { version: null, error: localErr?.message || 'Storage error' };
			}
		}
		return { version: null, error: err?.message || 'Failed to save version' };
	}
}

/** Delete a specific brochure version. */
export async function deleteBrochureTemplateVersion(
	id: string,
	slug: string
): Promise<{ error: string | null }> {
	try {
		// Remove from Supabase
		await supabase.from('brochure_template_versions').delete().eq('id', id);

		// Remove from localStorage
		if (typeof localStorage !== 'undefined') {
			try {
				const cached = localStorage.getItem(`brochure_versions_${slug}`);
				if (cached) {
					const list: BrochureTemplateVersion[] = JSON.parse(cached);
					const filtered = list.filter((v) => v.id !== id);
					localStorage.setItem(`brochure_versions_${slug}`, JSON.stringify(filtered));
				}
			} catch {}
		}

		return { error: null };
	} catch (err: any) {
		return { error: err?.message || 'Failed to delete version' };
	}
}

/** Delete custom template from Supabase, reverting brochure back to default. */
export async function resetBrochureTemplate(slug: string): Promise<{ error: string | null }> {
	try {
		const { error } = await supabase.from('brochure_templates').delete().eq('slug', slug);
		return { error: error?.message ?? null };
	} catch (err: any) {
		return { error: err?.message || 'Failed to reset brochure template' };
	}
}

/** Build a standalone, print-ready HTML document string from template fields. */
export function buildBrochureHtmlDocument(template: {
	html: string;
	css: string;
	js?: string;
	title?: string;
}): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(template.title || 'Brochure')}</title>
  <style>
    /* Reset & base page formatting */
    html, body {
      margin: 0;
      padding: 0;
      background: #d8dcd5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: A4 portrait;
      margin: 0;
    }
    @media print {
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }
    ${template.css}
  </style>
</head>
<body>
  ${(template.html || '')
		.replace(/(['"])\{base\}\//g, '$1/')
		.replace(/\{base\}\//g, '/')
		.replace(/\{base\}/g, '')}
  ${template.js?.trim() ? `<script>\n${template.js}\n</script>` : ''}
</body>
</html>`;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export interface BrochureTemplateSummary {
	slug: string;
	title: string;
	is_custom: boolean;
	is_active: boolean;
	updated_at?: string;
}

/** List all available brochure templates (combining built-in and Supabase entries) */
export async function listAllBrochureTemplates(): Promise<{
	templates: BrochureTemplateSummary[];
	error: string | null;
}> {
	try {
		const { data, error } = await supabase
			.from('brochure_templates')
			.select('slug, title, is_active, updated_at')
			.order('title', { ascending: true });

		const customMap = new Map<string, any>();
		if (data) {
			for (const row of data) {
				customMap.set(row.slug, row);
			}
		}

		const summaries: BrochureTemplateSummary[] = [
			{
				slug: 'preventative_maintenance',
				title: 'Preventative Maintenance',
				is_custom: customMap.has('preventative_maintenance'),
				is_active: customMap.get('preventative_maintenance')?.is_active ?? false,
				updated_at: customMap.get('preventative_maintenance')?.updated_at
			},
			{
				slug: 'washroom_fitout',
				title: 'Washroom Fitout',
				is_custom: customMap.has('washroom_fitout'),
				is_active: customMap.get('washroom_fitout')?.is_active ?? false,
				updated_at: customMap.get('washroom_fitout')?.updated_at
			}
		];

		// Include any extra custom templates not in the built-in list
		if (data) {
			for (const row of data) {
				if (row.slug !== 'preventative_maintenance' && row.slug !== 'washroom_fitout') {
					summaries.push({
						slug: row.slug,
						title: row.title || row.slug,
						is_custom: true,
						is_active: row.is_active ?? true,
						updated_at: row.updated_at
					});
				}
			}
		}

		return { templates: summaries, error: error?.message ?? null };
	} catch (err: any) {
		return {
			templates: [
				{
					slug: 'preventative_maintenance',
					title: 'Preventative Maintenance',
					is_custom: false,
					is_active: false
				},
				{
					slug: 'washroom_fitout',
					title: 'Washroom Fitout',
					is_custom: false,
					is_active: false
				}
			],
			error: err?.message || null
		};
	}
}
