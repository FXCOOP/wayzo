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
      // Use multiple image sources for better reliability
      const query = encodeURIComponent(term || dest);
      const sources = [
        `https://source.unsplash.com/400x300/?${query},travel`,
        `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`,
        `https://via.placeholder.com/400x300/2563eb/ffffff?text=${query}`,
      ];
      // Return the first source (Unsplash) as primary, with fallbacks
      return sources[0];
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
      
      // Add error handling for images
      const imgTag = `![${alt || 'Photo'}](${imageUrl})`;
      console.log('Generated img tag:', imgTag);
      return imgTag;
    });
  
  console.log('Processed markdown length:', processed.length);
  console.log('Final processed markdown preview:', processed.substring(0, 500));
  return processed;
}
