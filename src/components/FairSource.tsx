const stats = [
  { value: '2M+', label: 'Docker Downloads' },
  { value: '18K+', label: 'GitHub Stars' },
  { value: '12K+', label: 'Community Members' },
  { value: '100%', label: 'Fair Source No-Code' },
]

export default function FairSource() {
  return (
    <section className="py-20 sm:py-28 bg-brand-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Fair Source Advantage
          </h2>
          <p className="mt-4 text-lg text-brand-200">
            Join a community-driven solution with millions of downloads,
            used by thousands of organisations worldwide.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-8 rounded-2xl bg-white/5 border border-white/10"
            >
              <div className="text-4xl sm:text-5xl font-extrabold text-brand-300 mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-brand-200 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
