import { useState } from 'react'
import { Table2, Columns3, Image, FileInput, Calendar } from 'lucide-react'

const views = [
  {
    id: 'grid',
    icon: Table2,
    label: 'Grid View',
    title: 'A Versatile Tool for Effortless Data Organization, Sorting, and Filtering',
    preview: 'grid',
  },
  {
    id: 'kanban',
    icon: Columns3,
    label: 'Kanban View',
    title: 'Visualise, Organise, and Streamline Your Workflows with Ease',
    preview: 'kanban',
  },
  {
    id: 'gallery',
    icon: Image,
    label: 'Gallery View',
    title: 'Transform Your Data into Engaging Visual Stories and Presentations',
    preview: 'gallery',
  },
  {
    id: 'form',
    icon: FileInput,
    label: 'Form View',
    title: 'Simplify Data Entry and Updates, Making Information Management a Breeze',
    preview: 'form',
  },
  {
    id: 'calendar',
    icon: Calendar,
    label: 'Calendar View',
    title: 'View records on a calendar using Date and Date Time field types.',
    preview: 'calendar',
  },
]

export default function ViewsSection() {
  const [active, setActive] = useState('grid')
  const current = views.find((v) => v.id === active)!

  return (
    <section id="views" className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Versatile views for your data
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Adapt your data to a view that suits you. We recognise not everyone is a tech guru,
            so we provide pre-crafted views for your data.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {views.map((view) => {
            const Icon = view.icon
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActive(view.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active === view.id
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-200 hover:text-brand-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {view.label}
              </button>
            )
          })}
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">{current.label}</h3>
            <p className="text-gray-600 leading-relaxed">{current.title}</p>
          </div>
          <ViewPreview type={current.preview} />
        </div>
      </div>
    </section>
  )
}

function ViewPreview({ type }: { type: string }) {
  if (type === 'kanban') {
    const columns = [
      { title: 'To Do', color: 'border-gray-300', items: ['Design mockups', 'Write API docs'] },
      { title: 'In Progress', color: 'border-blue-400', items: ['Build auth flow', 'Set up CI/CD'] },
      { title: 'Done', color: 'border-green-400', items: ['Project setup', 'Database schema'] },
    ]
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg flex gap-3 overflow-x-auto">
        {columns.map((col) => (
          <div key={col.title} className={`flex-1 min-w-[140px] rounded-xl border-t-4 ${col.color} bg-gray-50 p-3`}>
            <p className="text-xs font-semibold text-gray-500 mb-3">{col.title}</p>
            {col.items.map((item) => (
              <div key={item} className="bg-white rounded-lg p-2.5 mb-2 text-xs text-gray-700 shadow-sm border border-gray-100">
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (type === 'gallery') {
    const cards = [
      { title: 'Product A', color: 'bg-blue-100' },
      { title: 'Product B', color: 'bg-purple-100' },
      { title: 'Product C', color: 'bg-green-100' },
      { title: 'Product D', color: 'bg-orange-100' },
    ]
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl overflow-hidden border border-gray-100">
            <div className={`h-20 ${card.color}`} />
            <div className="p-3">
              <p className="text-sm font-medium text-gray-800">{card.title}</p>
              <p className="text-xs text-gray-400 mt-1">In stock: 42 units</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'form') {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500">Full Name</label>
          <div className="mt-1 h-9 rounded-lg border border-gray-200 bg-gray-50" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Email Address</label>
          <div className="mt-1 h-9 rounded-lg border border-gray-200 bg-gray-50" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Department</label>
          <div className="mt-1 h-9 rounded-lg border border-gray-200 bg-gray-50" />
        </div>
        <div className="h-9 rounded-lg bg-brand-500 flex items-center justify-center text-white text-sm font-medium">
          Submit
        </div>
      </div>
    )
  }

  if (type === 'calendar') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {days.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 28 }, (_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs ${
                [3, 8, 15, 22].includes(i)
                  ? 'bg-brand-100 text-brand-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const headers = ['Task', 'Owner', 'Priority', 'Due Date']
  const rows = [
    ['Launch campaign', 'Alex', 'High', 'Jun 12'],
    ['Review designs', 'Sam', 'Medium', 'Jun 14'],
    ['Deploy v2.0', 'Jordan', 'High', 'Jun 18'],
  ]
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-gray-100">
              {row.map((cell, i) => (
                <td key={i} className="px-4 py-2.5 text-gray-700 text-xs">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
