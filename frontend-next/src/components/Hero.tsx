import { motion } from 'framer-motion'
import { SparklesIcon, GlobeAltIcon, MapIcon } from '@heroicons/react/24/solid'

export function Hero() {
  return (
    <header className="relative overflow-hidden min-h-screen flex items-center">
      {/* Enhanced Background Effects */}
      <div className="absolute inset-0 bg-gradient-hero opacity-5" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(16,185,129,0.15),transparent_60%)]" />
      
      {/* Floating Elements */}
      <motion.div 
        animate={{ 
          y: [0, -20, 0],
          rotate: [0, 5, 0]
        }}
        transition={{ 
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-20 left-10 w-20 h-20 bg-primary-100 rounded-full opacity-20 blur-xl"
      />
      <motion.div 
        animate={{ 
          y: [0, 20, 0],
          rotate: [0, -5, 0]
        }}
        transition={{ 
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
        className="absolute bottom-20 right-10 w-32 h-32 bg-emerald-100 rounded-full opacity-20 blur-xl"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8, ease: "easeOut" }} 
            className="flex-1"
          >
            {/* Enhanced Badge */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white/80 glass shadow-soft mb-6"
            >
              <SparklesIcon className="w-4 h-4 text-accent-purple animate-pulse" />
              <span className="text-sm font-medium text-slate-700">AI-Powered Trip Planning</span>
            </motion.div>

            {/* Enhanced Title */}
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 mb-6"
            >
              Plan unforgettable trips in{' '}
              <span className="text-gradient">minutes</span>
            </motion.h1>

            {/* Enhanced Description */}
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-slate-600 text-lg sm:text-xl max-w-2xl mb-8 leading-relaxed"
            >
              Personalized itineraries with routes, hotels, activities, and budgets. 
              Beautifully designed and ready to share with your travel companions.
            </motion.p>

            {/* Enhanced Feature List */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="flex flex-wrap gap-4 mb-8"
            >
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <GlobeAltIcon className="w-4 h-4 text-primary-600" />
                <span>Global Destinations</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapIcon className="w-4 h-4 text-emerald-600" />
                <span>Smart Routing</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <SparklesIcon className="w-4 h-4 text-accent-purple" />
                <span>AI-Powered</span>
              </div>
            </motion.div>

            {/* Enhanced CTA Buttons */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary"
              >
                Start Planning Now
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-secondary"
              >
                View Demo Trip
              </motion.button>
            </motion.div>

            {/* Enhanced Trust Indicators */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="mt-8 text-sm text-slate-500"
            >
              <p>✨ No app required • 📱 Mobile-first • 📄 PDF export</p>
            </motion.div>
          </motion.div>

          {/* Enhanced Image Section */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, x: 20 }} 
            animate={{ opacity: 1, scale: 1, x: 0 }} 
            transition={{ duration: 0.8, delay: 0.4 }} 
            className="flex-1 w-full"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-strong gradient-border">
              <motion.img 
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
                src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1400&auto=format&fit=crop" 
                alt="Scenic mountains and lake" 
                className="w-full h-64 sm:h-80 object-cover"
              />
              
              {/* Floating Card Overlay */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1 }}
                className="absolute bottom-4 left-4 right-4 bg-white/90 glass rounded-xl p-4 shadow-medium"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full flex items-center justify-center">
                    <SparklesIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">AI Generated</div>
                    <div className="text-sm text-slate-600">Personalized itinerary</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  )
}

