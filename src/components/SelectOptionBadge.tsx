import { ChevronDown } from 'lucide-react'
import { getSelectBadgeStyle } from '../lib/selectOptions'
import { useTheme } from '../context/ThemeContext'

interface SelectOptionBadgeProps {
  label: string
  color: string
  dark?: boolean
  compact?: boolean
}

export default function SelectOptionBadge({
  label,
  color,
  dark: darkProp,
  compact = false,
}: SelectOptionBadgeProps) {
  const { theme } = useTheme()
  const dark = darkProp ?? theme === 'dark'
  const style = getSelectBadgeStyle(color, dark)

  if (!label) {
    return (
      <span
        className={`inline-block rounded ${compact ? 'w-4 h-4' : 'w-5 h-5'}`}
        style={{ backgroundColor: style.text, border: `1px solid ${style.border}` }}
      />
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      <ChevronDown className={compact ? 'w-2.5 h-2.5 opacity-70' : 'w-3 h-3 opacity-70'} />
      {label}
    </span>
  )
}
