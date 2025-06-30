import { writable } from 'svelte/store';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration: number;
}

export const toasts = writable<Toast[]>([]);

let toastId = 0;

function addToast(message: string, type: 'success' | 'error' | 'info', duration = 5000) {
  const id = `toast-${toastId++}`;
  const toast: Toast = { id, message, type, duration };
  
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

export const toastSuccess = (message: string) => {
  return addToast(message, 'success');
};

export const toastError = (message: string) => {
  return addToast(message, 'error');
};

export const toastInfo = (message: string) => {
  return addToast(message, 'info');
};

export { removeToast }; 