import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
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
    <form onSubmit={handleSubmit(onFull)} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Trip Details</h2>
        <div className="text-sm text-slate-600">Step {step} of 3</div>
      </div>

      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Destination</label>
            <input className="mt-1 w-full rounded-md border-slate-300" placeholder="e.g., Kyoto, Japan" {...register('destination')} />
            {errors.destination && typeof errors.destination.message === 'string' && (
              <p className="text-sm text-red-600 mt-1">{errors.destination.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Currency</label>
            <select className="mt-1 w-full rounded-md border-slate-300" {...register('currency')}>
              {['USD','EUR','GBP','JPY','IDR','AUD','CAD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Start Date</label>
            <input type="date" className="mt-1 w-full rounded-md border-slate-300" {...register('startDate')} />
            {errors.startDate && typeof errors.startDate.message === 'string' && (
              <p className="text-sm text-red-600 mt-1">{errors.startDate.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">End Date</label>
            <input type="date" className="mt-1 w-full rounded-md border-slate-300" {...register('endDate')} />
            {errors.endDate && typeof errors.endDate.message === 'string' && (
              <p className="text-sm text-red-600 mt-1">{errors.endDate.message}</p>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Budget</label>
            <input type="number" className="mt-1 w-full rounded-md border-slate-300" {...register('budget', { valueAsNumber: true })} />
            {errors.budget && typeof errors.budget.message === 'string' && (
              <p className="text-sm text-red-600 mt-1">{errors.budget.message}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Adults</label>
              <input type="number" className="mt-1 w-full rounded-md border-slate-300" {...register('adults', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Children</label>
              <input type="number" className="mt-1 w-full rounded-md border-slate-300" {...register('children', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Pets</label>
              <input type="number" className="mt-1 w-full rounded-md border-slate-300" {...register('pets', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Trip Style</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {stylesPresets.map(s => {
                const active = values.styles?.includes(s)
                return (
                  <button type="button" key={s} onClick={() => {
                    const next = active ? values.styles.filter(x => x !== s) : [...(values.styles || []), s]
                    setValue('styles', next)
                  }} className={`px-3 py-1.5 rounded-full text-sm border ${active ? 'bg-primary-600 text-white border-primary-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Dietary Needs</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {dietaryPresets.map(s => {
                const active = values.dietary?.includes(s)
                return (
                  <button type="button" key={s} onClick={() => {
                    const next = active ? values.dietary.filter(x => x !== s) : [...(values.dietary || []), s]
                    setValue('dietary', next)
                  }} className={`px-3 py-1.5 rounded-full text-sm border ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input className="mt-1 w-full rounded-md border-slate-300" placeholder="e.g., Anniversary Getaway" {...register('title')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Special Requests</label>
            <textarea className="mt-1 w-full rounded-md border-slate-300" rows={4} placeholder="Anything we should consider?" {...register('special')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Attach Image or PDF (optional)</label>
            <input type="file" className="mt-1 w-full text-sm" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="space-x-2">
          <button type="button" disabled={step === 1} onClick={() => setStep(s => Math.max(1, s - 1))} className="px-4 py-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40">Back</button>
          {step < 3 ? (
            <button type="button" onClick={() => setStep(s => Math.min(3, s + 1))} className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 shadow">
              Next
            </button>
          ) : (
            <>
              <button type="button" onClick={handleSubmit(onPreview)} className="px-4 py-2 rounded-md bg-accent.orange text-white hover:bg-orange-600 shadow">Generate Preview</button>
              <button type="submit" className="px-4 py-2 rounded-md bg-accent.purple text-white hover:bg-purple-700 shadow">Generate Full Plan (AI)</button>
            </>
          )}
        </div>
        <div className="text-sm text-slate-500">We personalize with AI. Privacy-first.</div>
      </div>
    </form>
  )
}

