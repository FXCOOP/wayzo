const AFF = {
  bookingAid: process.env.BOOKING_AID || process.env.AFF_BOOKING_AID || '',
  gygPid:     process.env.GYG_PID     || process.env.AFF_GYG_PID     || '',
  kayakAid:   process.env.KAYAK_AID   || process.env.AFF_KAYAK_AID   || '',
};
export function affiliatesFor(dest = '') {
  const q = encodeURIComponent(dest || '');
  const bookingAidParam = AFF.bookingAid ? `&aid=${AFF.bookingAid}` : '';
  const gygPidParam     = AFF.gygPid     ? `&partner_id=${AFF.gygPid}` : '';
  const kayakAidParam   = AFF.kayakAid   ? `&aid=${AFF.kayakAid}` : '';
  return {
    maps:      (term) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(term || dest)}`,
    flights:   ()      => `https://www.kayak.com/flights?search=${q}${kayakAidParam}`,
    hotels:    (term) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(term || dest)}${bookingAidParam}`,
    activities:(term) => `https://www.getyourguide.com/s/?q=${encodeURIComponent(term || dest)}${gygPidParam}`,
    cars:      ()      => `https://www.rentalcars.com/SearchResults.do?destination=${q}`,
    insurance: ()      => `https://www.worldnomads.com/`,
    reviews:   (term) => `https://www.tripadvisor.com/Search?q=${encodeURIComponent(term || dest)}`,
    image:     (term) => {
      // Use a simple gradient data URI for reliable image display
      const base = String(dest || '').trim();
      const q = String(term || '').trim();
      const combined = (q.toLowerCase().includes(base.toLowerCase()) || base === '') ? q : `${base} ${q}`;
      // Generate a consistent color based on the query
      const hash = combined.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      const hue = Math.abs(hash) % 360;
      const dataUri = `data:image/svg+xml;base64,${Buffer.from(`<svg width="800" height="500" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:hsl(${hue}, 70%, 60%);stop-opacity:1" /><stop offset="100%" style="stop-color:hsl(${hue + 30}, 70%, 40%);stop-opacity:1" /></linearGradient></defs><rect width="800" height="500" fill="url(#grad)" /><text x="400" y="250" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">${combined || 'Travel'}</text></svg>`).toString('base64')}`;
      console.log('Image query:', { dest: base, term: q, combined, hue, url: 'data:image/svg+xml...' });
      return dataUri;
    },
  };
}
export function linkifyTokens(markdown = '', dest = '') {
  const aff = affiliatesFor(dest);
  console.log('Processing markdown for destination:', dest);
  console.log('Image function:', aff.image);
  console.log('Original markdown length:', markdown.length);
  
  // Find all image tokens before processing
  const imageMatches = markdown.match(/!\[([^\]]*)\]\(image:([^)]+)\)/gi);
  console.log('Found image tokens:', imageMatches);
  
  const processed = (markdown || '')
    .replace(/\[(Map)\]\(map:([^)]+)\)/gi,        (_m, _t, q) => `[Map](${aff.maps(q.trim())})`)
    .replace(/\[(Book)\]\(book:([^)]+)\)/gi,      (_m, _t, q) => `[Book](${aff.hotels(q.trim())})`)
    .replace(/\[(Tickets)\]\(tickets:([^)]+)\)/gi,(_m, _t, q) => `[Tickets](${aff.activities(q.trim())})`)
    .replace(/\[(Reviews)\]\(reviews:([^)]+)\)/gi,(_m, _t, q) => `[Reviews](${aff.reviews(q.trim())})`)
    .replace(/!\[([^\]]*)\]\(image:([^)]+)\)/gi,  (_m, alt, q) => {
      const imageUrl = aff.image(q.trim());
      console.log('Processing image token:', { alt, query: q.trim(), generatedUrl: imageUrl });
      const safeAlt = (alt || 'Photo').replace(/"/g, '\\"');
      const fallback = `https://picsum.photos/800/500?random=${Math.floor(Math.random()*1000)}`;
      // Use HTML <img> to avoid markdown renderer quirks
      const imgHtml = `<img src="${imageUrl}" alt="${safeAlt}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}';this.style.opacity='0.85'" style="max-width:100%;height:auto;border-radius:12px;box-shadow:0 8px 25px rgba(0,0,0,0.15);margin:16px 0;object-fit:cover"/>`;
      console.log('Generated img html:', imgHtml.substring(0, 120));
      return imgHtml;
    });
  
  console.log('Processed markdown length:', processed.length);
  console.log('Final processed markdown preview:', processed.substring(0, 500));
  return processed;
}
