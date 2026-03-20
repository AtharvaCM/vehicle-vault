import { toast } from 'sonner';

type ToastPayload = {
  title: string;
  description?: string;
};

export const appToast = {
  success({ title, description }: ToastPayload) {
    toast.success(title, { description });
  },
  error({ title, description }: ToastPayload) {
    toast.error(title, { description });
  },
  info({ title, description }: ToastPayload) {
    toast(title, { description });
  },
};
