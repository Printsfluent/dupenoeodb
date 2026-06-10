import { Users, Kanban, Settings, Package } from 'lucide-react'

const cases = [
  {
    icon: Users,
    title: 'CRM',
    desc: 'Centralise customer interactions to enhance relationships and drive growth.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Kanban,
    title: 'Project Management',
    desc: 'Streamline task coordination to ensure timely completion across teams.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Settings,
    title: 'Operations',
    desc: 'Efficient operations management for seamlessly running businesses.',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    icon: Package,
    title: 'Inventory Management',
    desc: 'Effortlessly track, organise, and optimise your stock levels.',
    color: 'bg-green-50 text-green-600',
  },
]

export default function UseCases() {
  return (
    <section id="usecases" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Endless Use Cases
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            BaseFlow caters to every department in an organisation. Its versatility
            addresses a multitude of use cases seamlessly.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cases.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className="group p-6 rounded-2xl border border-gray-100 bg-white hover:shadow-lg hover:border-brand-100 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
