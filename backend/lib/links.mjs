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
    activities:(term) => `https://www.getyourguide.com/s/?q=${encodeURIComponent(term || dest)}&partner_id=PUHVJ53`,
    cars:      ()      => `https://www.rentalcars.com/SearchResults.do?destination=${q}`,
    insurance: ()      => `https://www.worldnomads.com/`,
    reviews:   (term) => `https://www.tripadvisor.com/Search?q=${encodeURIComponent(term || dest)}`,
    image:     (term) => {
      // Enhanced image processing with better query formatting
      const query = encodeURIComponent(term || dest);
      
      // Use Unsplash with better query formatting
      const unsplashUrl = `https://source.unsplash.com/400x300/?${query}`;
      
      console.log('Image query:', term, '→', unsplashUrl);
      return unsplashUrl;
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
    .replace(/\[(Book)\]\(book:([^)]+)\)/gi,      (_m, _t, q) => `[Book](#hotel-widget)`)
    .replace(/\[(Tickets)\]\(tickets:([^)]+)\)/gi,(_m, _t, q) => `[Tickets](${aff.activities(q.trim())})`)
    .replace(/\[(Reviews)\]\(reviews:([^)]+)\)/gi,(_m, _t, q) => `[Reviews](${aff.activities(q.trim())})`)
    .replace(/\[(Car Rentals)\]\(car:([^)]+)\)/gi, (_m, _t, q) => `[Car Rentals](#car-widget)`)
    .replace(/\[(Airport Transfers)\]\(airport:([^)]+)\)/gi, (_m, _t, q) => `[Airport Transfers](#airport-widget)`)
    .replace(/\[(Flight Information)\]\(flight:([^)]+)\)/gi, (_m, _t, q) => `Flight Information`)
    .replace(/!\[([^\]]*)\]\(image:([^)]+)\)/gi,  (_m, alt, q) => {
      // REMOVE IMAGES: Return empty string instead of image tag
      console.log('Removing image token:', { alt, query: q.trim() });
      return '';
    });
  
  console.log('Processed markdown length:', processed.length);
  console.log('Final processed markdown preview:', processed.substring(0, 500));
  return processed;
}
