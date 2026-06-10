import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { APP_NAME, APP_DOMAIN } from '../lib/brand'

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-100/50 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-brand-50 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-sm font-medium mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          {APP_NAME} Cloud
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 max-w-4xl mx-auto leading-tight animate-slide-up">
          Build Databases As Spreadsheets{' '}
          <span className="text-gradient">No-Coding Required</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {APP_NAME} lets you build no-code database solutions with the ease of spreadsheets.
          Bring your own database or choose ours. Millions of rows? Not a problem.
          Your data. Your rules. You are in control.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-16 mx-auto max-w-5xl">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-3 text-xs text-gray-400 font-mono">app.{APP_DOMAIN}/projects/sales-crm</span>
            </div>
            <div className="p-1">
              <SpreadsheetPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SpreadsheetPreview() {
  const headers = ['Name', 'Company', 'Status', 'Revenue', 'Last Contact']
  const rows = [
    ['Sarah Chen', 'Acme Corp', 'Active', '$42,000', 'Jun 2, 2026'],
    ['Marcus Webb', 'NovaTech', 'Lead', '$18,500', 'Jun 5, 2026'],
    ['Elena Rossi', 'BrightPath', 'Active', '$67,200', 'Jun 7, 2026'],
    ['James Park', 'CloudNine', 'Churned', '$0', 'May 28, 2026'],
    ['Aisha Patel', 'DataFlow', 'Active', '$31,800', 'Jun 8, 2026'],
  ]
  const statusColors: Record<string, string> = {
    Active: 'bg-green-100 text-green-700',
    Lead: 'bg-blue-100 text-blue-700',
    Churned: 'bg-red-100 text-red-700',
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-gray-100 hover:bg-brand-50/30 transition-colors">
              {row.map((cell, i) => (
                <td key={i} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                  {i === 2 ? (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[cell]}`}>
                      {cell}
                    </span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
