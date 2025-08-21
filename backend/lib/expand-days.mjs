export function ensureDaySections(md = '', nDays = 1, startISO = '') {
  const count = (md.match(/^\s*###\s*Day\s+\d+/gmi) || []).length;
  if (count >= nDays) return md;
  const parts = [];
  for (let i = count + 1; i <= nDays; i++) {
    const date = startISO ? addDaysISO(startISO, i - 1) : '';
    parts.push(`
### Day ${i} ${date ? `— Open Exploration (${date})` : ''}
- **Morning:** Neighborhood warm-up walk. [Map](map:day ${i} walking loop) — Easy loop to get oriented.
- **Afternoon:** Local market + museum. [Reviews](reviews:day ${i} market) · [Tickets](tickets:day ${i} museum)
- **Evening:** Sunset viewpoint & dinner. [Map](map:day ${i} viewpoint) · [Book](book:day ${i} dinner)
`.trim());
  }
  return (md || '').trim() + '\n\n' + parts.join('\n\n');
}
export function expandDays(base = [], _payload = {}) {
  return base.map((d, i) => ({ day: d.day ?? (i + 1), title: d.title || `Day ${i + 1}` }));
}
function addDaysISO(iso, plus) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + plus);
  return d.toISOString().slice(0, 10);
}
