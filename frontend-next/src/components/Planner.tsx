import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TripFormWizard } from './form/TripFormWizard'
import { ItineraryAccordion } from './trip/ItineraryAccordion'
import { LoadingOverlay } from './ui/LoadingOverlay'
import { useApp } from '../context/AppContext'
import { 
  MapIcon, 
  DocumentTextIcon, 
  SparklesIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

export function Planner() {
  const { state } = useApp()
  const [tab, setTab] = useState<'plan' | 'itinerary'>('plan')

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
      {/* Enhanced Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl font-bold text-slate-900 mb-4">
          Plan Your Perfect Trip
        </h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Tell us about your dream destination and we'll create a personalized itinerary 
          with AI-powered recommendations, smart routing, and budget optimization.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enhanced Form Card */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden card-hover"
        >
          <div className="bg-gradient-to-r from-primary-50 to-emerald-50 p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full flex items-center justify-center">
                <MapIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Trip Details</h3>
                <p className="text-sm text-slate-600">Fill in your preferences</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <TripFormWizard onSwitchTab={() => setTab('itinerary')} />
          </div>
        </motion.div>

        {/* Enhanced Itinerary Card */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden card-hover min-h-[600px]"
        >
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Your Itinerary</h3>
                  <p className="text-sm text-slate-600">AI-generated travel plan</p>
                </div>
              </div>
              
              {/* Enhanced Tab Switcher */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <motion.button 
                  onClick={() => setTab('plan')} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    tab === 'plan' 
                      ? 'bg-white text-slate-900 shadow-soft' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MapIcon className="w-4 h-4" />
                  Plan
                </motion.button>
                <motion.button 
                  onClick={() => setTab('itinerary')} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    tab === 'itinerary' 
                      ? 'bg-white text-slate-900 shadow-soft' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  Itinerary
                </motion.button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <AnimatePresence mode="wait">
              {state.itinerary ? (
                <motion.div
                  key="itinerary"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <ItineraryAccordion itinerary={state.itinerary} />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <SparklesIcon className="w-8 h-8 text-slate-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-2">
                    Ready to Plan Your Adventure?
                  </h4>
                  <p className="text-slate-600 mb-6 max-w-sm mx-auto">
                    Fill in your trip details on the left and we'll generate a personalized 
                    itinerary with AI-powered recommendations.
                  </p>
                  
                  {/* Feature Highlights */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <MapIcon className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="text-sm font-medium text-slate-900">Smart Routing</div>
                      <div className="text-xs text-slate-500">Optimized paths</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <DocumentTextIcon className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-sm font-medium text-slate-900">AI Planning</div>
                      <div className="text-xs text-slate-500">Personalized tips</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <SparklesIcon className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="text-sm font-medium text-slate-900">Budget Smart</div>
                      <div className="text-xs text-slate-500">Cost optimization</div>
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTab('plan')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 shadow-md transition-all duration-200"
                  >
                    Start Planning
                    <ArrowRightIcon className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Enhanced Loading Overlay */}
      <LoadingOverlay />
    </section>
  )
}

