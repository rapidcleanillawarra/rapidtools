import { writable } from 'svelte/store';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
  icon?: string;
  title?: string;
}

export const toasts = writable<Toast[]>([]);

let toastId = 0;

function addToast(message: string, type: 'success' | 'error' | 'info' | 'warning', duration = 5000, title?: string, icon?: string) {
  const id = `toast-${toastId++}`;
  const toast: Toast = { id, message, type, duration, title, icon };
  
  toasts.update(allToasts => [...allToasts, toast]);
  
  // Auto-remove after duration
  setTimeout(() => {
    removeToast(id);
  }, duration);
  
  return id;
}

function removeToast(id: string) {
  toasts.update(allToasts => allToasts.filter(toast => toast.id !== id));
}

export const toastSuccess = (message: string, title?: string) => {
  return addToast(message, 'success', 5000, title, '✅');
};

export const toastError = (message: string, title?: string) => {
  return addToast(message, 'error', 7000, title, '❌');
};

export const toastInfo = (message: string, title?: string) => {
  return addToast(message, 'info', 4000, title, 'ℹ️');
};

export const toastWarning = (message: string, title?: string) => {
  return addToast(message, 'warning', 6000, title, '⚠️');
};

export { removeToast }; 