import { createContext, useContext, useMemo, useReducer } from 'react'

export type TripForm = {
  destination: string
  startDate: string | null
  endDate: string | null
  currency: string
  budget: number
  adults: number
  children: number
  pets: number
  styles: string[]
  dietary: string[]
  title: string
  special: string
}

export type Itinerary = any

type State = {
  form: TripForm
  itinerary: Itinerary | null
  loading: boolean
  loadingMessage: string | null
}

type Action =
  | { type: 'update_form'; payload: Partial<TripForm> }
  | { type: 'set_itinerary'; payload: Itinerary | null }
  | { type: 'set_loading'; payload: { loading: boolean; message?: string | null } }

const initialState: State = {
  form: {
    destination: '',
    startDate: null,
    endDate: null,
    currency: 'USD',
    budget: 2000,
    adults: 2,
    children: 0,
    pets: 0,
    styles: [],
    dietary: [],
    title: '',
    special: '',
  },
  itinerary: null,
  loading: false,
  loadingMessage: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'update_form':
      return { ...state, form: { ...state.form, ...action.payload } }
    case 'set_itinerary':
      return { ...state, itinerary: action.payload }
    case 'set_loading':
      return { ...state, loading: action.payload.loading, loadingMessage: action.payload.message ?? null }
    default:
      return state
  }
}

const AppContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

