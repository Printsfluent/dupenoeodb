import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const push = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID()
    setToasts((items) => [...items, { id, message, variant }])
    window.setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const value = useMemo(
    () => ({
      toast: push,
      success: (message: string) => push(message, 'success'),
      error: (message: string) => push(message, 'error'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((item) => {
          const Icon = item.variant === 'success' ? CheckCircle2 : item.variant === 'error' ? AlertCircle : Info
          const tone =
            item.variant === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-100'
              : item.variant === 'error'
                ? 'border-red-500/30 bg-red-950/90 text-red-100'
                : 'border-app-border bg-app-surface text-app-text'
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex items-start gap-2 px-4 py-3 rounded-xl border shadow-xl text-sm ${tone}`}
            >
              <Icon className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1">{item.message}</span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="p-0.5 opacity-70 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
