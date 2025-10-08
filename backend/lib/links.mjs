const AFF = {
  bookingAid: process.env.BOOKING_AID || process.env.AFF_BOOKING_AID || '',
  gygPid:     process.env.GYG_PID     || process.env.AFF_GYG_PID     || '',
  kayakAid:   process.env.KAYAK_AID   || process.env.AFF_KAYAK_AID   || '',
};
export function affiliatesFor(dest = '') {
  const q = encodeURIComponent(dest || '');
  // Widget-based system - links point to widget anchors instead of external sites
  return {
    maps:      (term) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(term || dest)}`,
    flights:   ()      => `#flight-widget`, // Points to flight search widget
    hotels:    (term) => `#hotel-widget`,   // Points to hotel booking widget
    activities:(term) => `#gyg-widget`,     // Points to GetYourGuide activities widget
    cars:      ()      => `#car-widget`,    // Points to car rental widget
    transfers: ()      => `#airport-widget`, // Points to airport transfer widget
    insurance: ()      => `https://www.worldnomads.com/`, // Keep external for insurance
    reviews:   (term) => `https://www.tripadvisor.com/Search?q=${encodeURIComponent(term || dest)}`, // Keep external for reviews
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

  // CLEANUP: Remove AI mistakes before processing
  let cleaned = (markdown || '')
    // Remove visible anchor text that AI added by mistake
    .replace(/\(#hotel-widget\)/g, '')
    .replace(/\(#flight-widget\)/g, '')
    .replace(/\(#car-widget\)/g, '')
    .replace(/\(#gyg-widget\)/g, '')
    // Remove URLs that AI added to booking tokens
    .replace(/\[Book Entry Tickets\]\(https:\/\/www\.getyourguide\.com[^)]*\)/gi, '[Book Entry Tickets]')
    .replace(/\[Buy Tickets\]\(https:\/\/www\.getyourguide\.com[^)]*\)/gi, '[Buy Tickets]')
    .replace(/\[Book Experience\]\(https:\/\/www\.getyourguide\.com[^)]*\)/gi, '[Book Experience]')
    // Remove internal instruction text that leaked
    .replace(/CRITICAL FORMATTING REQUIREMENTS[^]*?(?=##|$)/gi, '')
    .replace(/INTERNAL INSTRUCTIONS[^]*?(?=##|$)/gi, '')
    // Remove "Restaurant Recommendations - Format..." instruction line
    .replace(/Restaurant Recommendations - Format for EACH restaurant:\s*\n\s*\n/gi, '')
    // Fix malformed Day 1 header (** ## Day -> ## Day)
    .replace(/\*\*\s*##\s*(Day \d+)/gi, '## $1');

  const processed = cleaned
    // Maps - keep external link for Google Maps
    .replace(/\[(Map)\]\(map:([^)]+)\)/gi,        (_m, _t, q) => `[Map](${aff.maps(q.trim())})`)
    // Fix standalone [Map] without protocol (AI mistake)
    .replace(/\[Map\](?!\()/gi, `[Map](${aff.maps(dest)})`)

    // Hotel/Accommodation links → Hotel Widget
    .replace(/\[(Book|Book Now|Book Hotel|Hotel)\]\(book:([^)]+)\)/gi,      (_m, _t, q) => `[Book Hotel](#hotel-widget)`)
    .replace(/\[(Book|Book Now|Book Hotel|Hotel)\]\(hotel:([^)]+)\)/gi,     (_m, _t, q) => `[Book Hotel](#hotel-widget)`)
    .replace(/\[(Book|Book Now|Book Hotel|Hotel)\]\(hotels:([^)]+)\)/gi,    (_m, _t, q) => `[Book Hotel](#hotel-widget)`)

    // Flight links → Flight Widget
    .replace(/\[(Book|Book Now|Flights|Flight)\]\(flight:([^)]+)\)/gi,      (_m, _t, q) => `[Book Flights](#flight-widget)`)
    .replace(/\[(Book|Book Now|Flights|Flight)\]\(flights:([^)]+)\)/gi,     (_m, _t, q) => `[Book Flights](#flight-widget)`)

    // Activity/Ticket links → GetYourGuide with partner ID (process tokens with colons first)
    .replace(/\[(Tickets|Book Tickets|Book Entry Tickets|Buy Tickets|Book Experience|Book|Book Now|Activities)\]\(tickets:([^)]+)\)/gi, (_m, _t, q) => `[Book Tickets](https://www.getyourguide.com/s/?q=${encodeURIComponent(dest + ' ' + q.trim())}&partner_id=PUHVJ53)`)
    .replace(/\[(Tickets|Book Tickets|Book Entry Tickets|Buy Tickets|Book Experience|Book|Book Now|Activities)\]\(activity:([^)]+)\)/gi,(_m, _t, q) => `[Book Tickets](https://www.getyourguide.com/s/?q=${encodeURIComponent(dest + ' ' + q.trim())}&partner_id=PUHVJ53)`)
    .replace(/\[(Tickets|Book Tickets|Book Entry Tickets|Buy Tickets|Book Experience|Book|Book Now|Activities)\]\(activities:([^)]+)\)/gi,(_m, _t, q) => `[Book Tickets](https://www.getyourguide.com/s/?q=${encodeURIComponent(dest + ' ' + q.trim())}&partner_id=PUHVJ53)`)

    // Standalone attraction booking tokens (no parentheses) → GetYourGuide
    .replace(/\[Book Entry Tickets\]/gi, `[Book Entry Tickets](https://www.getyourguide.com/s/?q=${encodeURIComponent(dest)}&partner_id=PUHVJ53)`)
    .replace(/\[Buy Tickets\]/gi, `[Buy Tickets](https://www.getyourguide.com/s/?q=${encodeURIComponent(dest)}&partner_id=PUHVJ53)`)
    .replace(/\[Book Experience\]/gi, `[Book Experience](https://www.getyourguide.com/s/?q=${encodeURIComponent(dest)}&partner_id=PUHVJ53)`)

    // Restaurant booking - REMOVED (no longer adding reservation links)
    // Restaurants should only have [Map] links now

    // Standalone [Book Now] in hotel sections → Hotel Widget
    .replace(/\[Book Now\]/gi, '[Book Now](#hotel-widget)')

    // Car rental links → Car Widget
    .replace(/\[(Car|Rent|Car Rental)\]\(car:([^)]+)\)/gi,                  (_m, _t, q) => `[Rent Car](#car-widget)`)
    .replace(/\[(Car|Rent|Car Rental)\]\(cars:([^)]+)\)/gi,                 (_m, _t, q) => `[Rent Car](#car-widget)`)

    // Airport transfer links → Airport Widget
    .replace(/\[(Transfer|Airport)\]\(transfer:([^)]+)\)/gi,                (_m, _t, q) => `[Airport Transfer](#airport-widget)`)
    .replace(/\[(Transfer|Airport)\]\(airport:([^)]+)\)/gi,                 (_m, _t, q) => `[Airport Transfer](#airport-widget)`)

    // Reviews - keep external
    .replace(/\[(Reviews)\]\(reviews:([^)]+)\)/gi,(_m, _t, q) => `[Reviews](${aff.reviews(q.trim())})`)

    // Images - remove completely
    .replace(/!\[([^\]]*)\]\(image:([^)]+)\)/gi,  (_m, alt, q) => {
      // REMOVE IMAGES: Return empty string instead of image tag
      console.log('Removing image token:', { alt, query: q.trim() });
      return '';
    });
  
  console.log('Processed markdown length:', processed.length);
  console.log('Final processed markdown preview:', processed.substring(0, 500));
  return processed;
}
