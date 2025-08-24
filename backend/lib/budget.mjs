<document filename="budget.mjs">
export function normalizeBudget(value = '', currency = 'USD') {
  const n = String(value).replace(/[^\d.,]/g, '').replace(/,/g, '');
  const parsed = parseFloat(n);
  return { amount: Number.isFinite(parsed) ? parsed : 0, currency };
}
export function computeBudget(total = 0, days = 1, style = 'mid', travelers = 2) {
  const t = Math.max(1, Number(total.amount) || 0);
  const d = Math.max(1, Number(days) || 1);
  const perDay = t / d;
  const split =
    style === 'luxury' ? { stay: 0.50, food: 0.22, act: 0.18, transit: 0.05, misc: 0.05 } :
    style === 'budget' ? { stay: 0.35, food: 0.27, act: 0.20, transit: 0.13, misc: 0.05 } :
                         { stay: 0.42, food: 0.25, act: 0.18, transit: 0.10, misc: 0.05 };
  const round = (x) => Math.round(x);
  return {
    stay:    { perDay: round(perDay * split.stay),                            total: round(t * split.stay) },
    food:    { perDay: round((perDay * split.food) / Math.max(1, travelers)), total: round(t * split.food) },
    act:     { perDay: round(perDay * split.act),                             total: round(t * split.act) },
    transit: { perDay: round(perDay * split.transit),                         total: round(t * split.transit) },
    misc:    { perDay: round(perDay * split.misc),                            total: round(t * split.misc) },
    currency: total.currency || 'USD'
  };
}
</document>