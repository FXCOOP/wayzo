import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { funnyMessages } from '../../utils/funnyMessages'

export function LoadingOverlay() {
  const { state } = useApp()
  const [message, setMessage] = useState(state.loadingMessage || funnyMessages.random())

  useEffect(() => {
    if (!state.loading) return
    setMessage(state.loadingMessage || funnyMessages.random())
    const id = setInterval(() => {
      setMessage(funnyMessages.random())
    }, 2500)
    return () => clearInterval(id)
  }, [state.loading, state.loadingMessage])

  if (!state.loading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur">
      <div className="w-full max-w-md mx-auto p-6 rounded-2xl shadow-card bg-white text-center">
        <div className="mx-auto h-12 w-12 mb-4 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <div className="text-lg font-semibold text-slate-900">Working magic...</div>
        <div className="mt-2 text-slate-600">{message}</div>
        <div className="mt-4 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div className="h-2 bg-primary-600 rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
        </div>
      </div>
      <style jsx>{`
        @keyframes progress { 0% { transform: translateX(-60%);} 50% { transform: translateX(10%);} 100% { transform: translateX(120%);} }
      `}</style>
    </div>
  )
}

