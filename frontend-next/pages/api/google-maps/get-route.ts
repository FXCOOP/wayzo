import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { waypoints = [] } = req.body || {}

  // Mock a simple route distance/time
  const totalKm = Math.max(waypoints.length - 1, 1) * 5
  const durationMin = totalKm * 3

  res.status(200).json({
    distanceKm: totalKm,
    durationMin,
    polyline: null,
  })
}

