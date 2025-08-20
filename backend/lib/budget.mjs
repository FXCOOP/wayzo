// backend/lib/budget.mjs
export function normalizeBudget(value = "", _currency = "USD") {
  const n = String(value).replace(/[^\d.,]/g, "").replace(/,/g, "");
  const parsed = parseFloat(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function computeBudget(total = 0, days = 1, style = "mid", travelers = 2) {
  const t = Math.max(1, Number(total) || 0);
  const d = Math.max(1, Number(days) || 1);
  const perDay = t / d;

  const split =
    style === "luxury" ? { stay: 0.55, food: 0.22, act: 0.18, transit: 0.05 } :
    style === "budget" ? { stay: 0.38, food: 0.27, act: 0.20, transit: 0.15 } :
                         { stay: 0.47, food: 0.25, act: 0.18, transit: 0.10 };

  const round = (x) => Math.round(x);

  return {
    stay:    { perDay: round(perDay * split.stay),                    total: round(t * split.stay) },
    food:    { perDay: round((perDay * split.food) / Math.max(1, travelers)), total: round(t * split.food) },
    act:     { perDay: round(perDay * split.act),                     total: round(t * split.act) },
    transit: { perDay: round(perDay * split.transit),                 total: round(t * split.transit) },
  };
}
