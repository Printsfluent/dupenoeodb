import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { APP_NAME } from '../lib/brand'

const links = [
  { label: 'Product', href: '#views' },
  { label: 'Features', href: '#features' },
  { label: 'Use Cases', href: '#usecases' },
  { label: `Why ${APP_NAME}`, href: '#why' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo to="/" />

          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <Link
                to="/app"
                className="text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors px-5 py-2.5 rounded-lg"
              >
                Go to App
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors px-4 py-2"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors px-5 py-2.5 rounded-lg"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-gray-600 dark:text-gray-300"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-4 space-y-3">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="block text-sm font-medium text-gray-600 dark:text-gray-300 py-2"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2 border-t border-gray-100 dark:border-gray-800">
            <ThemeToggle />
            {user ? (
              <Link to="/app" className="text-sm font-semibold text-white bg-brand-500 px-5 py-2.5 rounded-lg text-center">
                Go to App
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-gray-600 py-2">Sign in</Link>
                <Link to="/signup" className="text-sm font-semibold text-white bg-brand-500 px-5 py-2.5 rounded-lg text-center">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
