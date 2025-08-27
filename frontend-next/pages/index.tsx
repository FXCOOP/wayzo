import Head from 'next/head'
import { Hero } from '../src/components/Hero'
import { Planner } from '../src/components/Planner'
import { AppProvider } from '../src/context/AppContext'

export default function HomePage() {
  return (
    <AppProvider>
      <Head>
        <title>Wayzo • AI Trip Planner</title>
      </Head>
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-emerald-50">
        <Hero />
        <Planner />
      </div>
    </AppProvider>
  )
}

