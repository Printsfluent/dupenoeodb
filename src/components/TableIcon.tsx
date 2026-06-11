import { Table2 } from 'lucide-react'
import { getSocialLogoUrl, parseTableIcon } from '../lib/tableIcons'

interface TableIconProps {
  icon?: string | null
  size?: 'xs' | 'sm' | 'md'
  className?: string
  fallbackClassName?: string
}

const sizeClasses = {
  xs: 'w-3.5 h-3.5 text-xs',
  sm: 'w-4 h-4 text-sm',
  md: 'w-5 h-5 text-base',
}

const imageSizes = {
  xs: 14,
  sm: 16,
  md: 20,
}

export default function TableIcon({
  icon,
  size = 'sm',
  className = '',
  fallbackClassName = 'text-app-faint',
}: TableIconProps) {
  const parsed = parseTableIcon(icon)
  const sizeClass = sizeClasses[size]

  if (parsed.type === 'emoji') {
    return (
      <span className={`inline-flex items-center justify-center shrink-0 leading-none ${sizeClass} ${className}`}>
        {parsed.value}
      </span>
    )
  }

  if (parsed.type === 'social') {
    return (
      <img
        src={getSocialLogoUrl(parsed.id)}
        alt=""
        width={imageSizes[size]}
        height={imageSizes[size]}
        className={`shrink-0 rounded-sm object-contain ${sizeClass} ${className}`}
        loading="lazy"
      />
    )
  }

  return <Table2 className={`shrink-0 ${sizeClass} ${fallbackClassName} ${className}`} />
}
