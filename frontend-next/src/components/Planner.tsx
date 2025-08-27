import { useState } from 'react'
import { TripFormWizard } from './form/TripFormWizard'
import { ItineraryAccordion } from './trip/ItineraryAccordion'
import { LoadingOverlay } from './ui/LoadingOverlay'
import { useApp } from '../context/AppContext'

export function Planner() {
  const { state } = useApp()
  const [tab, setTab] = useState<'plan' | 'itinerary'>('plan')

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-card p-6">
          <TripFormWizard onSwitchTab={() => setTab('itinerary')} />
        </div>

        <div className="bg-white rounded-2xl shadow-card p-6 min-h-[400px]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Your Itinerary</h2>
            <div className="flex gap-2">
              <button onClick={() => setTab('plan')} className={`text-sm px-3 py-1.5 rounded-full ${tab === 'plan' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Plan</button>
              <button onClick={() => setTab('itinerary')} className={`text-sm px-3 py-1.5 rounded-full ${tab === 'itinerary' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Itinerary</button>
            </div>
          </div>
          <div className="mt-4">
            {state.itinerary ? (
              <ItineraryAccordion itinerary={state.itinerary} />
            ) : (
              <p className="text-slate-600">No itinerary yet. Generate a preview or full plan to see details here.</p>
            )}
          </div>
        </div>
      </div>

      <LoadingOverlay />
    </section>
  )
}

