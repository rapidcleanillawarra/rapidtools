/**
 * Generic async error handler for consistent error management
 * Optimized for SPA deployment (GitHub Pages)
 */
export async function handleAsync<T>(
  fn: () => Promise<T>,
  errorMessage: string
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error) {
    console.error(errorMessage, error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : errorMessage 
    };
  }
}

/**
 * Safe async function wrapper with toast notification
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  options: {
    errorMessage?: string;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
  } = {}
): Promise<T | null> {
  try {
    const data = await fn();
    options.onSuccess?.(data);
    return data;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : options.errorMessage || 'An error occurred';
    console.error(errorMsg, error);
    options.onError?.(errorMsg);
    return null;
  }
}

