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
export type ToastPosition = 'left' | 'right'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  position: ToastPosition
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, position?: ToastPosition) => void
  success: (message: string, position?: ToastPosition) => void
  error: (message: string, position?: ToastPosition) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const push = useCallback((message: string, variant: ToastVariant = 'info', position: ToastPosition = 'right') => {
    const id = crypto.randomUUID()
    setToasts((items) => [...items, { id, message, variant, position }])
    window.setTimeout(() => dismiss(id), 3000)
  }, [dismiss])

  const value = useMemo(
    () => ({
      toast: push,
      success: (message: string, position?: ToastPosition) => push(message, 'success', position),
      error: (message: string, position?: ToastPosition) => push(message, 'error', position),
    }),
    [push],
  )

  function renderToasts(position: ToastPosition) {
    const items = toasts.filter((item) => item.position === position)
    if (items.length === 0) return null

    const anchor =
      position === 'left'
        ? 'fixed bottom-4 left-4 z-[300] flex flex-col gap-1.5 max-w-xs pointer-events-none'
        : 'fixed bottom-4 right-4 z-[300] flex flex-col gap-2 max-w-sm pointer-events-none'
    const compact = position === 'left'

    return (
      <div className={anchor}>
        {items.map((item) => {
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
              className={`pointer-events-auto flex items-center gap-2 rounded-lg border shadow-lg ${
                compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm rounded-xl shadow-xl'
              } ${tone}`}
            >
              <Icon className={`shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4 mt-0.5'}`} />
              <span className="flex-1">{item.message}</span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="p-0.5 opacity-70 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {renderToasts('left')}
      {renderToasts('right')}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
