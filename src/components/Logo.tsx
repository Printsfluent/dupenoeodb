import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { APP_NAME } from '../lib/brand'

interface LogoProps {
  to?: string
  light?: boolean
  compact?: boolean
}

export default function Logo({ to = '/', light = false, compact = false }: LogoProps) {
  const content = (
    <>
      <BrandLogo size={32} className="shrink-0" />
      {!compact && (
        <span className={`text-lg font-bold tracking-tight ${light ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          {APP_NAME}
        </span>
      )}
    </>
  )

  if (to) {
    return (
      <Link to={to} className="flex items-center gap-2.5">
        {content}
      </Link>
    )
  }

  return <div className="flex items-center gap-2.5">{content}</div>
}
