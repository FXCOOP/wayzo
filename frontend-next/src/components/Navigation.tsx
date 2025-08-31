import { motion } from 'framer-motion'
import { SparklesIcon, GlobeAltIcon } from '@heroicons/react/24/solid'

export function Navigation() {
  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Enhanced Brand */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-r from-primary-500 via-emerald-500 to-purple-500 rounded-xl flex items-center justify-center shadow-md">
                <GlobeAltIcon className="w-6 h-6 text-white" />
              </div>
              <motion.div
                animate={{ 
                  rotate: [0, 360],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-accent-orange rounded-full flex items-center justify-center"
              >
                <SparklesIcon className="w-2 h-2 text-white" />
              </motion.div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Wayzo</h1>
              <p className="text-xs text-slate-500 -mt-1">AI Travel Planner</p>
            </div>
          </motion.div>

          {/* Enhanced Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <motion.a 
              whileHover={{ scale: 1.05 }}
              href="#features" 
              className="text-sm font-medium text-slate-700 hover:text-primary-600 transition-colors duration-200"
            >
              Features
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.05 }}
              href="#pricing" 
              className="text-sm font-medium text-slate-700 hover:text-primary-600 transition-colors duration-200"
            >
              Pricing
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.05 }}
              href="#about" 
              className="text-sm font-medium text-slate-700 hover:text-primary-600 transition-colors duration-200"
            >
              About
            </motion.a>
          </div>

          {/* Enhanced CTA Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-r from-primary-600 to-emerald-600 text-white px-6 py-2 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-200"
          >
            Get Started
          </motion.button>
        </div>
      </div>
    </motion.nav>
  )
}