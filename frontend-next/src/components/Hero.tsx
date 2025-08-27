import { motion } from 'framer-motion'
import { SparklesIcon } from '@heroicons/react/24/solid'

export function Hero() {
  return (
    <header className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero opacity-10" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.25),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(16,185,129,0.25),transparent_60%)]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-white/70 glass shadow-card">
              <SparklesIcon className="w-4 h-4 text-accent.purple" />
              <span className="text-xs font-medium text-slate-700">AI-Powered Trip Planning</span>
            </div>
            <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Plan unforgettable trips in minutes
            </h1>
            <p className="mt-3 text-slate-600 text-base sm:text-lg max-w-2xl">
              Personalized itineraries with routes, hotels, activities, and budgets. Beautifully designed and ready to share.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="flex-1 w-full">
            <div className="relative rounded-2xl overflow-hidden shadow-card gradient-border">
              <img src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1400&auto=format&fit=crop" alt="Scenic mountains and lake" className="w-full h-64 sm:h-80 object-cover" />
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  )
}

