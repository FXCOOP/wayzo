// Demo data script to test enhanced features
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
const db = new Database(path.join(__dirname, 'wayzo.sqlite'));

// Ensure table exists
db.exec(`CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL);`);

// Sample trip data
const sampleTrip = {
  id: 'demo-trip-001',
  data: {
    destination: 'Paris, France',
    start: '2024-05-15',
    end: '2024-05-20',
    budget: 2500,
    currency: 'EUR',
    adults: 2,
    children: 0,
    level: 'mid-range',
    diet: 'vegetarian',
    prefs: 'romantic, museums, walkable'
  },
  markdown: `# Paris Adventure - 5 Days

### Day 1 — Arrival & Montmartre (2024-05-15)

**Morning:**
- Arrive at Charles de Gaulle Airport
- Take RER B to Gare du Nord, then Metro to Pigalle
- Check into Hotel Particulier Montmartre
- Light lunch at Breizh Café for creative crêpes

**Afternoon:**
- Explore Montmartre district
- Visit Sacré-Cœur Basilica
- Stroll through Place du Tertre (artist square)
- Wander the cobblestone streets and vintage shops

**Evening:**
- Sunset drinks at La Consigne (rooftop bar)
- Dinner at Le Consulat (traditional French bistro)
- Optional: Moulin Rouge show (book in advance)

### Day 2 — Central Paris & Museums (2024-05-16)

**Morning:**
- Breakfast at Pierre Hermé (famous macarons)
- Visit the Louvre Museum (pre-booked tickets)
- See Mona Lisa, Venus de Milo, Winged Victory

**Afternoon:**
- Lunch at Loulou in Tuileries Garden
- Walk through Tuileries Garden to Place de la Concorde
- Stroll down Champs-Élysées
- Visit Arc de Triomphe (climb to top for views)

**Evening:**
- Seine River cruise at sunset
- Dinner at Le Comptoir du Relais (bistro)
- Night walk along the Seine

### Day 3 — Eiffel Tower & Latin Quarter (2024-05-17)

**Morning:**
- Early visit to Eiffel Tower (book elevator tickets)
- Coffee at Café de l'Homme with Eiffel Tower views
- Walk across Pont de Bir-Hakeim for photos

**Afternoon:**
- Lunch at L'Ami Jean (modern bistro)
- Metro to Latin Quarter
- Visit Panthéon
- Browse bookshops along Boulevard Saint-Michel
- Explore Jardin du Luxembourg

**Evening:**
- Aperitif at Harry's Bar (historic cocktail bar)
- Dinner at Le Procope (oldest café in Paris)
- Evening stroll through Saint-Germain-des-Prés

### Day 4 — Versailles Day Trip (2024-05-18)

**Morning:**
- Early train to Versailles (RER C line)
- Palace of Versailles tour (pre-booked)
- Explore the Hall of Mirrors
- Walk through the gardens

**Afternoon:**
- Lunch at La Flottille in Versailles park
- Visit Marie Antoinette's Estate
- Explore the Trianon palaces
- Return to Paris in late afternoon

**Evening:**
- Rest and refresh at hotel
- Dinner at Le Train Bleu (beautiful Belle Époque restaurant in Gare de Lyon)
- Optional: Evening Seine walk

### Day 5 — Markets & Departure (2024-05-19)

**Morning:**
- Visit Marché des Enfants Rouges (historic food market)
- Browse Le Marais district
- Coffee and pastries at Du Pain et des Idées

**Afternoon:**
- Last-minute shopping on Rue de Rivoli
- Lunch at L'As du Fallafel (famous falafel in Le Marais)
- Check out of hotel
- Departure to Charles de Gaulle Airport

**Budget Breakdown:**
- Accommodation: €800 (4 nights)
- Meals: €600
- Activities & Museums: €400
- Transportation: €200
- Shopping & Miscellaneous: €500
- **Total: €2,500**
`
};

// Insert sample data
const insertPlan = db.prepare(`
  INSERT OR REPLACE INTO plans (id, created_at, payload)
  VALUES (?, ?, ?)
`);

const payload = JSON.stringify({
  data: sampleTrip.data,
  markdown: sampleTrip.markdown
});

const now = new Date().toISOString();
insertPlan.run(sampleTrip.id, now, payload);

console.log('✅ Demo trip data inserted successfully!');
console.log(`📍 Trip ID: ${sampleTrip.id}`);
console.log(`🌍 Destination: ${sampleTrip.data.destination}`);
console.log(`📅 Dates: ${sampleTrip.data.start} to ${sampleTrip.data.end}`);
console.log(`💰 Budget: ${sampleTrip.data.budget} ${sampleTrip.data.currency}`);
console.log('');
console.log('🔗 Test URLs:');
console.log(`   Preview: http://localhost:10000/api/plan/${sampleTrip.id}/preview`);
console.log(`   PDF:     http://localhost:10000/api/plan/${sampleTrip.id}/pdf`);
console.log(`   Excel:   http://localhost:10000/api/plan/${sampleTrip.id}/excel`);
console.log(`   Calendar: http://localhost:10000/api/plan/${sampleTrip.id}/ics`);

db.close();