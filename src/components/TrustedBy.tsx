const companies = [
  'TechFlow', 'Meridian', 'CloudStack', 'DataPulse', 'NexGen',
  'Orbital', 'Vertex', 'Synthwave', 'BluePeak', 'CoreLogic',
]

export default function TrustedBy() {
  return (
    <section className="py-16 border-y border-gray-100 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-10">
          Trusted by 35,000+ Organisations
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {companies.map((name) => (
            <div
              key={name}
              className="text-lg font-bold text-gray-300 hover:text-gray-400 transition-colors select-none"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
