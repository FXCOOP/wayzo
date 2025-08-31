import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MapPinIcon, 
  CalendarIcon, 
  CurrencyDollarIcon, 
  UsersIcon, 
  HeartIcon, 
  DocumentTextIcon,
  CheckIcon,
  ArrowRightIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'
import { useApp } from '../../context/AppContext'
import { funnyMessages } from '../../utils/funnyMessages'

const schema = z.object({
  destination: z.string().min(2, 'Enter a destination'),
  startDate: z.string().min(1, 'Start date required'),
  endDate: z.string().min(1, 'End date required'),
  currency: z.string().min(1),
  budget: z.coerce.number().min(100).max(100000),
  adults: z.coerce.number().min(1),
  children: z.coerce.number().min(0),
  pets: z.coerce.number().min(0),
  styles: z.array(z.string()).default([]),
  dietary: z.array(z.string()).default([]),
  title: z.string().optional().default(''),
  special: z.string().optional().default(''),
})

type FormValues = z.infer<typeof schema>

const stylesPresets = ['Adventure', 'Relaxation', 'Family', 'Romantic', 'Cultural', 'Nightlife', 'Foodie']
const dietaryPresets = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Kosher']

const stepConfig = [
  { id: 1, title: 'Destination & Dates', icon: MapPinIcon },
  { id: 2, title: 'Budget & Travelers', icon: UsersIcon },
  { id: 3, title: 'Preferences', icon: HeartIcon }
]

export function TripFormWizard({ onSwitchTab }: { onSwitchTab: () => void }) {
  const { state, dispatch } = useApp()
  const [step, setStep] = useState(1)
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: state.form as any,
  })

  const onPreview = async (data: FormValues) => {
    dispatch({ type: 'set_loading', payload: { loading: true, message: funnyMessages.random() } })
    dispatch({ type: 'update_form', payload: data })
    try {
      const res = await fetch('/api/chatgpt/generate-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, preview: true }) })
      const json = await res.json()
      dispatch({ type: 'set_itinerary', payload: json })
      onSwitchTab()
    } catch (e) {
      console.error(e)
      alert('Oops, the AI got lost—try again!')
    } finally {
      dispatch({ type: 'set_loading', payload: { loading: false } })
    }
  }

  const onFull = async (data: FormValues) => {
    dispatch({ type: 'set_loading', payload: { loading: true, message: funnyMessages.random() } })
    dispatch({ type: 'update_form', payload: data })
    try {
      const res = await fetch('/api/chatgpt/generate-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, preview: false }) })
      const json = await res.json()
      dispatch({ type: 'set_itinerary', payload: json })
      onSwitchTab()
    } catch (e) {
      console.error(e)
      alert('Oops, the AI tripped—retry!')
    } finally {
      dispatch({ type: 'set_loading', payload: { loading: false } })
    }
  }

  const values = watch()

  return (
    <div className="space-y-6">
      {/* Enhanced Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-900">Trip Details</h2>
          <div className="text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
            Step {step} of 3
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="flex items-center gap-4 mb-6">
          {stepConfig.map((stepItem, index) => {
            const Icon = stepItem.icon
            const isActive = step === stepItem.id
            const isCompleted = step > stepItem.id
            
            return (
              <div key={stepItem.id} className="flex items-center">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isActive ? 1.1 : 1,
                    backgroundColor: isCompleted ? '#10b981' : isActive ? '#3b82f6' : '#e2e8f0'
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    isCompleted ? 'text-white' : isActive ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </motion.div>
                {index < stepConfig.length - 1 && (
                  <div className={`w-16 h-1 mx-2 rounded-full transition-colors duration-300 ${
                    step > stepItem.id ? 'bg-emerald-500' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
        
        {/* Step Title */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-lg font-semibold text-slate-800"
        >
          {stepConfig[step - 1]?.title}
        </motion.div>
      </div>

      <form onSubmit={handleSubmit(onFull)} className="space-y-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-6"
            >
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4" />
                  Destination
                </label>
                <input 
                  className={`form-input ${errors.destination ? 'border-red-500 ring-red-500' : ''}`}
                  placeholder="e.g., Kyoto, Japan" 
                  {...register('destination')} 
                />
                {errors.destination && typeof errors.destination.message === 'string' && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-600 mt-1"
                  >
                    {errors.destination.message}
                  </motion.p>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CurrencyDollarIcon className="w-4 h-4" />
                  Currency
                </label>
                <select className="form-input" {...register('currency')}>
                  {['USD','EUR','GBP','JPY','IDR','AUD','CAD'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Start Date
                </label>
                <input 
                  type="date" 
                  className={`form-input ${errors.startDate ? 'border-red-500 ring-red-500' : ''}`}
                  {...register('startDate')} 
                />
                {errors.startDate && typeof errors.startDate.message === 'string' && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-600 mt-1"
                  >
                    {errors.startDate.message}
                  </motion.p>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  End Date
                </label>
                <input 
                  type="date" 
                  className={`form-input ${errors.endDate ? 'border-red-500 ring-red-500' : ''}`}
                  {...register('endDate')} 
                />
                {errors.endDate && typeof errors.endDate.message === 'string' && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-600 mt-1"
                  >
                    {errors.endDate.message}
                  </motion.p>
                )}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <CurrencyDollarIcon className="w-4 h-4" />
                    Budget
                  </label>
                  <input 
                    type="number" 
                    className={`form-input ${errors.budget ? 'border-red-500 ring-red-500' : ''}`}
                    placeholder="Enter your budget"
                    {...register('budget', { valueAsNumber: true })} 
                  />
                  {errors.budget && typeof errors.budget.message === 'string' && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-600 mt-1"
                    >
                      {errors.budget.message}
                    </motion.p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <UsersIcon className="w-4 h-4" />
                    Travelers
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Adults</label>
                      <input 
                        type="number" 
                        className="form-input text-center"
                        {...register('adults', { valueAsNumber: true })} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Children</label>
                      <input 
                        type="number" 
                        className="form-input text-center"
                        {...register('children', { valueAsNumber: true })} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Pets</label>
                      <input 
                        type="number" 
                        className="form-input text-center"
                        {...register('pets', { valueAsNumber: true })} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Trip Style</label>
                  <div className="flex flex-wrap gap-3">
                    {stylesPresets.map(s => {
                      const active = values.styles?.includes(s)
                      return (
                        <motion.button 
                          key={s} 
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const next = active ? values.styles.filter(x => x !== s) : [...(values.styles || []), s]
                            setValue('styles', next)
                          }} 
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
                            active 
                              ? 'bg-primary-600 text-white border-primary-600 shadow-md' 
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {s}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Dietary Needs</label>
                  <div className="flex flex-wrap gap-3">
                    {dietaryPresets.map(s => {
                      const active = values.dietary?.includes(s)
                      return (
                        <motion.button 
                          key={s} 
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const next = active ? values.dietary.filter(x => x !== s) : [...(values.dietary || []), s]
                            setValue('dietary', next)
                          }} 
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
                            active 
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {s}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <DocumentTextIcon className="w-4 h-4" />
                    Trip Title
                  </label>
                  <input 
                    className="form-input" 
                    placeholder="e.g., Anniversary Getaway" 
                    {...register('title')} 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <HeartIcon className="w-4 h-4" />
                    Special Requests
                  </label>
                  <textarea 
                    className="form-input" 
                    rows={4} 
                    placeholder="Anything we should consider? (accessibility, pet-friendly, etc.)" 
                    {...register('special')} 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Attach Image or PDF (optional)</label>
                  <input 
                    type="file" 
                    className="form-input file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" 
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Enhanced Navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-200">
          <div className="flex gap-3">
            <motion.button 
              type="button" 
              disabled={step === 1}
              whileHover={{ scale: step > 1 ? 1.05 : 1 }}
              whileTap={{ scale: step > 1 ? 0.95 : 1 }}
              onClick={() => setStep(s => Math.max(1, s - 1))} 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-medium transition-all duration-200 ${
                step > 1 
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-50' 
                  : 'border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back
            </motion.button>
            
            {step < 3 ? (
              <motion.button 
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setStep(s => Math.min(3, s + 1))} 
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 shadow-md transition-all duration-200"
              >
                Next
                <ArrowRightIcon className="w-4 h-4" />
              </motion.button>
            ) : (
              <div className="flex gap-3">
                <motion.button 
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSubmit(onPreview)} 
                  className="px-6 py-2 rounded-xl bg-accent-orange text-white font-semibold hover:bg-orange-600 shadow-md transition-all duration-200"
                >
                  Generate Preview
                </motion.button>
                <motion.button 
                  type="submit"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-2 rounded-xl bg-accent-purple text-white font-semibold hover:bg-purple-700 shadow-md transition-all duration-200"
                >
                  Generate Full Plan (AI)
                </motion.button>
              </div>
            )}
          </div>
          
          <div className="text-sm text-slate-500 bg-slate-50 px-3 py-1 rounded-full">
            We personalize with AI. Privacy-first.
          </div>
        </div>
      </form>
    </div>
  )
}

