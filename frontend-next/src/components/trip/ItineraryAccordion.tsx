import { Fragment } from 'react'
import { Disclosure, Transition } from '@headlessui/react'
import { ChevronDownIcon, MapPinIcon, BanknotesIcon } from '@heroicons/react/24/outline'

export function ItineraryAccordion({ itinerary }: { itinerary: any }) {
  if (!itinerary) return null
  const days = itinerary.days || []
  const totals = itinerary.totals || {}

  return (
    <div className="space-y-3">
      {days.map((d: any) => (
        <Disclosure key={d.day}>
          {({ open }) => (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <Disclosure.Button className="w-full flex items-center justify-between px-4 py-3 bg-slate-50">
                <div className="text-left">
                  <div className="text-sm text-slate-500">Day {d.day}</div>
                  <div className="font-medium text-slate-900">{d.title}</div>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} />
              </Disclosure.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 -translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Disclosure.Panel className="px-4 py-4 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-700 flex items-center gap-2"><MapPinIcon className="w-4 h-4" /> Route</div>
                    <div className="text-sm text-slate-600">Waypoints: {(d.route?.waypoints || []).map((w: any) => w.name).join(' → ')}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-700">Activities & Meals</div>
                    <ul className="mt-1 space-y-1">
                      {(d.activities || []).map((a: any, idx: number) => (
                        <li key={idx} className="flex items-center justify-between text-sm">
                          <span>{a.time} • {a.title}</span>
                          <span className="text-slate-500">${a.cost}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-700">Hotels</div>
                    <ul className="mt-1 space-y-1">
                      {(d.hotels || []).map((h: any, idx: number) => (
                        <li key={idx} className="text-sm">
                          <a href={h.link} target="_blank" className="text-primary-600 hover:underline">{h.name}</a> • ${h.pricePerNight}/night • {h.rating}★
                        </li>
                      ))}
                    </ul>
                  </div>
                </Disclosure.Panel>
              </Transition>
            </div>
          )}
        </Disclosure>
      ))}

      <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-slate-800 font-semibold"><BanknotesIcon className="w-5 h-5" /> Estimated Budget</div>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="p-2 rounded-lg bg-white shadow-sm border"><div className="text-slate-500">Lodging</div><div className="font-semibold">${totals.lodging || 0}</div></div>
          <div className="p-2 rounded-lg bg-white shadow-sm border"><div className="text-slate-500">Activities</div><div className="font-semibold">${totals.activities || 0}</div></div>
          <div className="p-2 rounded-lg bg-white shadow-sm border"><div className="text-slate-500">Meals</div><div className="font-semibold">${totals.meals || 0}</div></div>
          <div className="p-2 rounded-lg bg-white shadow-sm border"><div className="text-slate-500">Transport</div><div className="font-semibold">${totals.transport || 0}</div></div>
        </div>
        <div className="mt-3 text-right font-semibold">Total: ${totals.total || 0}</div>
      </div>
    </div>
  )
}

