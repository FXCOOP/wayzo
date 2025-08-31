import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { funnyMessages } from '../../utils/funnyMessages'

export function LoadingOverlay() {
  const { state } = useApp()
  const [message, setMessage] = useState(state.loadingMessage || funnyMessages.random())
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!state.loading) return
    setMessage(state.loadingMessage || funnyMessages.random())
    setProgress(0)
    
    const messageInterval = setInterval(() => {
      setMessage(funnyMessages.random())
    }, 3000)
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 15
      })
    }, 500)
    
    return () => {
      clearInterval(messageInterval)
      clearInterval(progressInterval)
    }
  }, [state.loading, state.loadingMessage])

  if (!state.loading) return null

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-md"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md mx-auto p-8 rounded-2xl shadow-strong bg-white text-center relative overflow-hidden"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-emerald-50 opacity-50" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 via-emerald-500 to-purple-500" />
          
          {/* Content */}
          <div className="relative z-10">
            {/* Enhanced Spinner */}
            <div className="relative mb-6">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 mx-auto border-4 border-primary-200 border-t-primary-600 rounded-full"
              />
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 w-16 h-16 mx-auto border-4 border-emerald-200 border-t-emerald-600 rounded-full"
              />
            </div>

            {/* Enhanced Title */}
            <motion.h3 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl font-bold text-slate-900 mb-3"
            >
              Working magic...
            </motion.h3>

            {/* Enhanced Message */}
            <motion.div 
              key={message}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-slate-600 mb-6 min-h-[3rem] flex items-center justify-center"
            >
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, 0]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-2 h-2 bg-primary-500 rounded-full"
                />
                <span className="text-sm">{message}</span>
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, -5, 0]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5
                  }}
                  className="w-2 h-2 bg-emerald-500 rounded-full"
                />
              </div>
            </motion.div>

            {/* Enhanced Progress Bar */}
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Processing...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-2 bg-gradient-to-r from-primary-500 via-emerald-500 to-purple-500 rounded-full relative"
                >
                  <motion.div 
                    animate={{ 
                      x: [0, 100, 0],
                      opacity: [0, 1, 0]
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute inset-0 bg-white/30 rounded-full"
                  />
                </motion.div>
              </div>
            </div>

            {/* Enhanced Features */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 pt-4 border-t border-slate-200"
            >
              <div className="flex justify-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary-500 rounded-full" />
                  <span>AI Planning</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span>Route Optimization</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span>Budget Analysis</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Floating Elements */}
          <motion.div 
            animate={{ 
              y: [0, -10, 0],
              rotate: [0, 5, 0]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-4 right-4 w-3 h-3 bg-primary-300 rounded-full opacity-50"
          />
          <motion.div 
            animate={{ 
              y: [0, 10, 0],
              rotate: [0, -5, 0]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
            className="absolute bottom-4 left-4 w-2 h-2 bg-emerald-300 rounded-full opacity-50"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

