export function normalizeBudget(value = '', _currency = 'USD') {
  const n = String(value).replace(/[^\d.,]/g, '').replace(/,/g, '');
  const parsed = parseFloat(n);

  // If we get a valid positive number, use it
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  // If budget is 0 or invalid, provide reasonable defaults based on currency
  console.log('⚠️ Budget was 0 or invalid, providing default budget');
  const defaults = {
    'USD': 1500,
    'EUR': 1400,
    'GBP': 1200,
    'CAD': 1900,
    'AUD': 2000,
    'JPY': 180000,
    'INR': 120000
  };

  const defaultBudget = defaults[_currency] || defaults['USD'];
  console.log(`💰 Using default budget: ${defaultBudget} ${_currency}`);
  return defaultBudget;
}
export function computeBudget(total = 0, days = 1, style = 'mid', travelers = 2) {
  let t = Number(total) || 0;

  // If budget is 0, use a reasonable default based on style and days
  if (t <= 0) {
    const dailyDefaults = {
      'luxury': 300,
      'mid': 150,
      'budget': 80
    };
    const dailyDefault = dailyDefaults[style] || dailyDefaults['mid'];
    t = dailyDefault * Math.max(1, days) * Math.max(1, travelers);
    console.log(`💰 Using computed default budget: ${t} for ${days} days, ${travelers} travelers, ${style} style`);
  }

  const d = Math.max(1, Number(days) || 1);
  const perDay = t / d;
  const split =
    style === 'luxury' ? { stay: 0.55, food: 0.22, act: 0.18, transit: 0.05 } :
    style === 'budget' ? { stay: 0.38, food: 0.27, act: 0.20, transit: 0.15 } :
                         { stay: 0.47, food: 0.25, act: 0.18, transit: 0.10 };
  const round = (x) => Math.round(x);
  return {
    stay:    { perDay: round(perDay * split.stay),                            total: round(t * split.stay) },
    food:    { perDay: round((perDay * split.food) / Math.max(1, travelers)), total: round(t * split.food) },
    act:     { perDay: round(perDay * split.act),                             total: round(t * split.act) },
    transit: { perDay: round(perDay * split.transit),                         total: round(t * split.transit) },
  };
}
