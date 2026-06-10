import { getInitials } from '../lib/colors'

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
} as const

interface UserAvatarProps {
  name: string
  emoji?: string
  size?: keyof typeof sizeClasses
  color?: string
  className?: string
}

export default function UserAvatar({
  name,
  emoji,
  size = 'md',
  color = '#f97316',
  className = '',
}: UserAvatarProps) {
  const sizeClass = sizeClasses[size]

  if (emoji) {
    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center shrink-0 bg-[#2a2a2a] ${className}`}
        aria-hidden
      >
        <span className="leading-none select-none">{emoji}</span>
      </div>
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white shrink-0 ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {getInitials(name)}
    </div>
  )
}
