const AFF = {
  bookingAid: process.env.BOOKING_AID || process.env.AFF_BOOKING_AID || '',
  gygPid:     process.env.GYG_PID     || process.env.AFF_GYG_PID     || '',
  kayakAid:   process.env.KAYAK_AID   || process.env.AFF_KAYAK_AID   || '',
};

// Improved image sources with fallbacks
const IMAGE_SOURCES = [
  (query) => `https://source.unsplash.com/featured/800x600/?${encodeURIComponent(query)}`,
  (query) => `https://picsum.photos/800/600?random=${encodeURIComponent(query)}`,
  (query) => `https://via.placeholder.com/800x600/4F46E5/FFFFFF?text=${encodeURIComponent(query)}`
];

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
    image:     (term) => IMAGE_SOURCES[0](term || dest), // Use primary source
  };
}

export function linkifyTokens(markdown = '', dest = '') {
  const aff = affiliatesFor(dest);
  
  // Process markdown and convert tokens to actual URLs
  let processed = (markdown || '')
    .replace(/\[(Map)\]\(map:([^)]+)\)/gi,        (_m, _t, q) => `[Map](${aff.maps(q.trim())})`)
    .replace(/\[(Book)\]\(book:([^)]+)\)/gi,      (_m, _t, q) => `[Book](${aff.hotels(q.trim())})`)
    .replace(/\[(Tickets)\]\(tickets:([^)]+)\)/gi,(_m, _t, q) => `[Tickets](${aff.activities(q.trim())})`)
    .replace(/\[(Reviews)\]\(reviews:([^)]+)\)/gi,(_m, _t, q) => `[Reviews](${aff.reviews(q.trim())})`)
    .replace(/!\[([^\]]*)\]\(image:([^)]+)\)/gi,  (_m, alt, q) => {
      const query = q.trim();
      // Create image with fallback handling
      return `<img src="${aff.image(query)}" alt="${alt || 'Photo'}" loading="lazy" onerror="this.onerror=null; this.src='${IMAGE_SOURCES[1](query)}';" style="max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0;" />`;
    });
  
  return processed;
}
