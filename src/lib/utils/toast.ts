import { toast } from '@zerodevx/svelte-toast';

export const toastSuccess = (message: string) => {
  toast.push(message, {
    theme: {
      '--toastBackground': '#22c55e',
      '--toastBarBackground': '#16a34a',
      '--toastColor': 'white',
      '--toastBarHeight': '0px'
    },
    duration: 5000
  });
};

export const toastError = (message: string) => {
  toast.push(message, {
    theme: {
      '--toastBackground': '#ef4444',
      '--toastBarBackground': '#dc2626',
      '--toastColor': 'white',
      '--toastBarHeight': '0px'
    },
    duration: 5000
  });
}; 