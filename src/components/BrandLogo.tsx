import { useId } from 'react'

interface BrandLogoProps {
  size?: number
  className?: string
}

export default function BrandLogo({ size = 32, className = '' }: BrandLogoProps) {
  const gradId = useId()

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4f9cff" />
          <stop offset="1" stopColor="#1d6af1" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradId})`} />
      <path
        d="M9 10h6.5c2.2 0 3.5 1.2 3.5 2.8 0 1.1-.6 2-1.6 2.4 1.2.3 2.1 1.3 2.1 2.7 0 1.8-1.5 3.1-4 3.1H9V10z"
        fill="white"
        fillOpacity="0.95"
      />
      <path d="M12 13.2h3.2c.9 0 1.4-.4 1.4-1.1s-.5-1.1-1.4-1.1H12v2.2z" fill="#1d6af1" />
      <path d="M12 17.8h3.5c1 0 1.6-.5 1.6-1.2 0-.8-.6-1.2-1.6-1.2H12v2.4z" fill="#1d6af1" />
      <path
        d="M22.5 16c0-2.8 2.2-5 5-5"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
      <path
        d="M25.5 9.5l2 2.5-2 2.5"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.85"
      />
    </svg>
  )
}
