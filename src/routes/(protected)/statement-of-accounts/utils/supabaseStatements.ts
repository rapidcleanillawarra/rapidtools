import { supabase } from '$lib/supabase';
import type { StatementAccount } from '../statementAccounts';

interface StatementOfAccountsDbRecord {
	id: number;
	customer_username: string;
}

interface StatementStatusRow {
	customer_username: string;
	last_sent: string | null;
	last_check: string | null;
	last_file_generation: string | null;
	statement_of_accounts_pdf_files:
		| { onedrive_id: string | null }
		| Array<{ onedrive_id: string | null }>
		| null;
}

export interface GeneratedStatementDocumentInfo {
	file_name: string;
	folder_path: string;
	created_at?: string;
	created_by: string;
	onedrive_id: string;
	customer_username: string;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += chunkSize) {
		chunks.push(items.slice(i, i + chunkSize));
	}
	return chunks;
}

export async function enrichAccountsWithSoaStatus(
	accounts: StatementAccount[]
): Promise<StatementAccount[]> {
	try {
		if (accounts.length === 0) return accounts;

		const usernames = accounts.map((a) => a.username);
		const chunks = chunkArray(usernames, 500);

		const results = await Promise.all(
			chunks.map((chunk) =>
				supabase
					.from('statement_of_accounts')
					.select(
						`
						customer_username,
						last_sent,
						last_check,
						last_file_generation,
						statement_of_accounts_pdf_files (
							onedrive_id
						)
					`
					)
					.in('customer_username', chunk)
			)
		);

		const allRows: StatementStatusRow[] = [];
		for (const result of results) {
			if (result.error) throw result.error;
			if (result.data) allRows.push(...(result.data as StatementStatusRow[]));
		}

		const statusMap = new Map(allRows.map((item) => [item.customer_username, item]));

		return accounts.map((account) => {
			const status = statusMap.get(account.username);
			if (!status) return account;

			const pdfFile = status.statement_of_accounts_pdf_files;
			const oneDriveId = Array.isArray(pdfFile)
				? pdfFile[0]?.onedrive_id
				: (pdfFile as { onedrive_id: string | null } | null)?.onedrive_id;

			return {
				...account,
				lastSent: status.last_sent,
				lastCheck: status.last_check,
				lastFileGeneration: status.last_file_generation,
				oneDriveId: oneDriveId || null
			};
		});
	} catch (err) {
		console.error('Error fetching statement status:', err);
		return accounts;
	}
}

export async function syncAccountsToSupabase(
	accounts: StatementAccount[]
): Promise<{ updates: number; inserts: number }> {
	const timestamp = new Date().toISOString();
	const currentApiUsernames = new Set(accounts.map((a) => a.username));

	const { data: allDbRecords, error: fetchError } = await supabase
		.from('statement_of_accounts')
		.select('id, customer_username');

	if (fetchError) throw fetchError;

	const updates: Array<{
		id: number;
		customer_username: string;
		exists_in_statements_list: boolean;
		last_check: string;
	}> = [];
	const inserts: Array<{
		customer_username: string;
		exists_in_statements_list: boolean;
		last_check: string;
	}> = [];

	const processedUsernames = new Set<string>();

	if (allDbRecords) {
		for (const record of allDbRecords as StatementOfAccountsDbRecord[]) {
			updates.push({
				id: record.id,
				customer_username: record.customer_username,
				exists_in_statements_list: currentApiUsernames.has(record.customer_username),
				last_check: timestamp
			});
			processedUsernames.add(record.customer_username);
		}
	}

	for (const account of accounts) {
		if (!processedUsernames.has(account.username)) {
			inserts.push({
				customer_username: account.username,
				exists_in_statements_list: true,
				last_check: timestamp
			});
			processedUsernames.add(account.username);
		}
	}

	if (updates.length === 0 && inserts.length === 0) {
		return { updates: 0, inserts: 0 };
	}

	const promises = [];
	if (updates.length > 0) promises.push(supabase.from('statement_of_accounts').upsert(updates));
	if (inserts.length > 0) promises.push(supabase.from('statement_of_accounts').insert(inserts));

	const results = await Promise.all(promises);
	for (const result of results) {
		if (result.error) throw result.error;
	}

	return { updates: updates.length, inserts: inserts.length };
}

export async function recordGeneratedStatementPdfFile(
	generationResponse: GeneratedStatementDocumentInfo
): Promise<{
	pdfFile?: { id: number; created_at: string };
	pdfError?: unknown;
	accountError?: unknown;
}> {
	const { data: pdfFile, error: pdfError } = await supabase
		.from('statement_of_accounts_pdf_files')
		.insert({
			file_name: generationResponse.file_name,
			folder_path: generationResponse.folder_path,
			created_at: generationResponse.created_at || new Date().toISOString(),
			created_by: generationResponse.created_by,
			onedrive_id: generationResponse.onedrive_id,
			customer_username: generationResponse.customer_username
		})
		.select()
		.single();

	if (pdfError) return { pdfError };

	const { error: accountError } = await supabase
		.from('statement_of_accounts')
		.update({
			last_file_generation: (pdfFile as any)?.created_at,
			statement_of_accounts_pdf_files_id: (pdfFile as any)?.id
		})
		.eq('customer_username', generationResponse.customer_username);

	return { pdfFile: pdfFile as any, accountError };
}
