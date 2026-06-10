import { useState } from 'react'
import { Send } from 'lucide-react'

export default function Newsletter() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email.includes('@')) {
      setStatus('success')
      setEmail('')
    } else {
      setStatus('error')
    }
  }

  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
          Subscribe to our Newsletter
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          Watch out for feature updates, pricing changes, and more!
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setStatus('idle') }}
            placeholder="Enter your email"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors"
          >
            Subscribe
            <Send className="w-4 h-4" />
          </button>
        </form>

        {status === 'success' && (
          <p className="mt-4 text-sm text-green-600 font-medium">
            Thank you! Your submission has been received!
          </p>
        )}
        {status === 'error' && (
          <p className="mt-4 text-sm text-red-600 font-medium">
            Oops! Something went wrong while submitting the form.
          </p>
        )}
      </div>
    </section>
  )
}
