import { Fragment } from 'react'
import { Disclosure, Transition } from '@headlessui/react'
import { motion } from 'framer-motion'
import { 
  ChevronDownIcon, 
  MapPinIcon, 
  BanknotesIcon, 
  ClockIcon,
  StarIcon,
  CalendarIcon,
  TruckIcon,
  CameraIcon
} from '@heroicons/react/24/outline'

export function ItineraryAccordion({ itinerary }: { itinerary: any }) {
  if (!itinerary) return null
  const days = itinerary.days || []
  const totals = itinerary.totals || {}

  return (
    <div className="space-y-4">
      {/* Enhanced Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary-50 to-emerald-50 rounded-xl p-4 border border-primary-100"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Your {days.length}-Day Adventure</h3>
            <p className="text-sm text-slate-600">AI-crafted itinerary ready for your journey</p>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Days */}
      {days.map((d: any, index: number) => (
        <motion.div
          key={d.day}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Disclosure>
            {({ open }) => (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-soft hover:shadow-medium transition-all duration-300">
                <Disclosure.Button className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 transition-all duration-200">
                  <div className="text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                        {d.day}
                      </div>
                      <div>
                        <div className="text-sm text-slate-500">Day {d.day}</div>
                        <div className="font-semibold text-slate-900">{d.title}</div>
                      </div>
                    </div>
                  </div>
                  <ChevronDownIcon className={`w-5 h-5 text-slate-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </Disclosure.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-300"
                  enterFrom="opacity-0 -translate-y-2"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-200"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Disclosure.Panel className="px-6 py-6 space-y-6 bg-white">
                    {/* Enhanced Route Section */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                        <MapPinIcon className="w-4 h-4 text-blue-600" />
                        Route
                      </div>
                      <div className="text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <TruckIcon className="w-4 h-4 text-blue-500" />
                          <span>Waypoints: {(d.route?.waypoints || []).map((w: any) => w.name).join(' → ')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Activities Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <ClockIcon className="w-4 h-4 text-emerald-600" />
                        Activities & Meals
                      </div>
                      <div className="space-y-3">
                        {(d.activities || []).map((a: any, idx: number) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors duration-200"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                                <CameraIcon className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">{a.title}</div>
                                <div className="text-sm text-slate-500">{a.time}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-slate-900">${a.cost}</div>
                              <div className="text-xs text-slate-500">per person</div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Enhanced Hotels Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <StarIcon className="w-4 h-4 text-amber-600" />
                        Accommodation
                      </div>
                      <div className="space-y-3">
                        {(d.hotels || []).map((h: any, idx: number) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-100 hover:shadow-soft transition-all duration-200"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <a 
                                  href={h.link} 
                                  target="_blank" 
                                  className="font-semibold text-slate-900 hover:text-primary-600 transition-colors duration-200"
                                >
                                  {h.name}
                                </a>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <StarIcon 
                                        key={i} 
                                        className={`w-3 h-3 ${i < h.rating ? 'text-amber-500 fill-current' : 'text-slate-300'}`} 
                                      />
                                    ))}
                                  </div>
                                  <span className="text-sm text-slate-600">({h.rating}/5)</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-slate-900">${h.pricePerNight}</div>
                                <div className="text-xs text-slate-500">per night</div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </Disclosure.Panel>
                </Transition>
              </div>
            )}
          </Disclosure>
        </motion.div>
      ))}

      {/* Enhanced Budget Summary */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: days.length * 0.1 }}
        className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100 shadow-soft"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center">
            <BanknotesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">Estimated Budget</div>
            <div className="text-sm text-slate-600">Breakdown of your trip costs</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="p-4 rounded-xl bg-white shadow-soft border border-emerald-100 text-center"
          >
            <div className="text-2xl font-bold text-emerald-600">${totals.lodging || 0}</div>
            <div className="text-sm text-slate-600">Lodging</div>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="p-4 rounded-xl bg-white shadow-soft border border-blue-100 text-center"
          >
            <div className="text-2xl font-bold text-blue-600">${totals.activities || 0}</div>
            <div className="text-sm text-slate-600">Activities</div>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="p-4 rounded-xl bg-white shadow-soft border border-amber-100 text-center"
          >
            <div className="text-2xl font-bold text-amber-600">${totals.meals || 0}</div>
            <div className="text-sm text-slate-600">Meals</div>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="p-4 rounded-xl bg-white shadow-soft border border-purple-100 text-center"
          >
            <div className="text-2xl font-bold text-purple-600">${totals.transport || 0}</div>
            <div className="text-sm text-slate-600">Transport</div>
          </motion.div>
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-emerald-200">
          <div className="text-lg font-semibold text-slate-900">Total Estimated Cost</div>
          <div className="text-2xl font-bold text-emerald-600">${totals.total || 0}</div>
        </div>
      </motion.div>
    </div>
  )
}

