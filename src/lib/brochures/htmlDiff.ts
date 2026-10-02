/**
 * Lightweight line-by-line diff algorithm for comparing HTML content between versions.
 */

export interface DiffLine {
	type: 'added' | 'removed' | 'unchanged';
	text: string;
	oldLineNo?: number;
	newLineNo?: number;
}

export interface DiffResult {
	lines: DiffLine[];
	additions: number;
	deletions: number;
	unchanged: number;
}

/**
 * Computes a line-by-line diff between two text strings using dynamic programming LCS.
 */
export function computeHtmlDiff(oldText: string, newText: string): DiffResult {
	const oldLines = oldText ? oldText.split(/\r?\n/) : [];
	const newLines = newText ? newText.split(/\r?\n/) : [];

	const n = oldLines.length;
	const m = newLines.length;

	// For very large content, optimize line comparisons by hashing strings to integers
	const lineToId = new Map<string, number>();
	let nextId = 1;
	const getId = (line: string) => {
		let id = lineToId.get(line);
		if (!id) {
			id = nextId++;
			lineToId.set(line, id);
		}
		return id;
	};

	const oldIds = oldLines.map(getId);
	const newIds = newLines.map(getId);

	// Compute LCS length table
	// We can use a flat Uint16Array or standard 2D array
	const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

	for (let i = 1; i <= n; i++) {
		for (let j = 1; j <= m; j++) {
			if (oldIds[i - 1] === newIds[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	// Backtrack to reconstruct the diff
	const diffLines: DiffLine[] = [];
	let i = n;
	let j = m;
	let additions = 0;
	let deletions = 0;
	let unchanged = 0;

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && oldIds[i - 1] === newIds[j - 1]) {
			diffLines.unshift({
				type: 'unchanged',
				text: oldLines[i - 1],
				oldLineNo: i,
				newLineNo: j
			});
			unchanged++;
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			diffLines.unshift({
				type: 'added',
				text: newLines[j - 1],
				newLineNo: j
			});
			additions++;
			j--;
		} else if (i > 0) {
			diffLines.unshift({
				type: 'removed',
				text: oldLines[i - 1],
				oldLineNo: i
			});
			deletions++;
			i--;
		}
	}

	return {
		lines: diffLines,
		additions,
		deletions,
		unchanged
	};
}
