import Logo from './Logo'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 border border-white rounded-2xl rotate-12" />
          <div className="absolute bottom-20 right-10 w-48 h-48 border border-white rounded-2xl -rotate-6" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 border border-white rounded-xl rotate-45" />
        </div>
        <Logo to="/" light />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white leading-tight">
            Your data.<br />Your spreadsheets.<br />Your control.
          </h2>
          <p className="mt-4 text-brand-100 text-lg max-w-md">
            Build powerful no-code databases with the simplicity of a spreadsheet.
            Start free, scale to millions of rows.
          </p>
        </div>
        <p className="text-brand-200 text-sm relative z-10">
          Trusted by teams worldwide
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 bg-white">
        <div className="lg:hidden mb-8">
          <Logo to="/" />
        </div>
        <div className="w-full max-w-md mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h1>
          <p className="mt-2 text-gray-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-6 text-center text-sm text-gray-600">{footer}</p>
        </div>
      </div>
    </div>
  )
}
