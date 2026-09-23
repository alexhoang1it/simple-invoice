import { createContext, useContext } from 'react';

export type ToastTone = 'good' | 'bad';

export interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
}

export interface ToastApi {
  say: (tone: ToastTone, text: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToasts(): ToastApi {
  const api = useContext(ToastContext);

  if (!api) throw new Error('useToasts must be used inside <Toasts>');

  return api;
}
