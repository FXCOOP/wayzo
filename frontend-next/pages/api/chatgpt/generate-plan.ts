import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = req.body || {}

  // Mocked AI response for initial scaffolding
  const mock = {
    summary: {
      destination: form.destination || 'Bali, Indonesia',
      totalNights: 5,
      budget: form.budget || 2000,
      currency: form.currency || 'USD',
    },
    days: Array.from({ length: 5 }).map((_, i) => ({
      day: i + 1,
      title: `Day ${i + 1}: Explore and Relax`,
      activities: [
        { time: '09:00', title: 'Breakfast at local cafe', cost: 15, type: 'meal' },
        { time: '11:00', title: 'Beach time and snorkeling', cost: 40, type: 'activity' },
        { time: '14:00', title: 'Lunch near the shore', cost: 20, type: 'meal' },
        { time: '18:00', title: 'Sunset hike + dinner', cost: 35, type: 'activity' },
      ],
      hotels: [{ name: 'Seaside Retreat', pricePerNight: 120, rating: 4.5, link: 'https://booking.com' }],
      route: {
        waypoints: [
          { name: 'Hotel', lat: -8.409518, lng: 115.188919 },
          { name: 'Beach', lat: -8.7, lng: 115.17 },
        ],
      },
    })),
    totals: {
      lodging: 600,
      activities: 350,
      meals: 250,
      transport: 150,
      total: 1350,
    },
  }

  return res.status(200).json(mock)
}

