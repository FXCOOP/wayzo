const AFF = {
  bookingAid: process.env.BOOKING_AID || process.env.AFF_BOOKING_AID || '',
  gygPid:     process.env.GYG_PID     || process.env.AFF_GYG_PID     || '',
  kayakAid:   process.env.KAYAK_AID   || process.env.AFF_KAYAK_AID   || '',
};

// Enhanced image generation with better fallbacks
function generateDestinationImage(destination = '', category = '') {
  const dest = encodeURIComponent(destination.trim());
  const cat = category ? `,${encodeURIComponent(category)}` : '';
  
  // Primary: Unsplash with destination-specific search
  const unsplashUrl = `https://source.unsplash.com/featured/800x600/?${dest}${cat}`;
  
  // Fallback: Pexels API (if you have API key)
  const pexelsUrl = process.env.PEXELS_API_KEY 
    ? `https://api.pexels.com/v1/search?query=${dest}${cat}&per_page=1`
    : null;
  
  // Ultimate fallback: Generic travel image
  const fallbackUrl = `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop`;
  
  return {
    primary: unsplashUrl,
    fallback: fallbackUrl,
    alt: `${destination} ${category || 'travel'} photo`
  };
}

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
    image:     (term, category) => generateDestinationImage(term || dest, category),
  };
}

export function linkifyTokens(markdown = '', dest = '') {
  const aff = affiliatesFor(dest);
  
  return (markdown || '')
    .replace(/\[(Map)\]\(map:([^)]+)\)/gi,        (_m, _t, q) => `[Map](${aff.maps(q.trim())})`)
    .replace(/\[(Book)\]\(book:([^)]+)\)/gi,      (_m, _t, q) => `[Book](${aff.hotels(q.trim())})`)
    .replace(/\[(Tickets)\]\(tickets:([^)]+)\)/gi,(_m, _t, q) => `[Tickets](${aff.activities(q.trim())})`)
    .replace(/\[(Reviews)\]\(reviews:([^)]+)\)/gi,(_m, _t, q) => `[Reviews](${aff.reviews(q.trim())})`)
    .replace(/!\[([^\]]*)\]\(image:([^)]+)\)/gi,  (_m, alt, q) => {
      const imgData = aff.image(q.trim());
      return `![${alt || imgData.alt}](${imgData.primary})`;
    });
}

// New function for contextual widget placement
export function generateContextualWidgets(section, destination = '') {
  const widgets = {
    'accommodation': {
      title: '🏨 Book Your Stay',
      widgets: [
        {
          type: 'hotel',
          title: 'Hotel Booking',
          description: 'Find the perfect accommodation',
          script: `https://tpwdgt.com/content?currency=usd&trs=455192&shmarker=634822&show_hotels=true&powered_by=true&locale=en&searchUrl=www.aviasales.com%2Fsearch&primary_override=%2332a8dd&color_button=%2355a539&color_icons=%2332a8dd&secondary=%23FFFFFF&dark=%23262626&light=%23FFFFFF&special=%23C4C4C4&color_focused=%2332a8dd&border_radius=5&plain=false&promo_id=7873&campaign_id=101`
        }
      ]
    },
    'transportation': {
      title: '🚗 Get Around',
      widgets: [
        {
          type: 'car',
          title: 'Car Rentals',
          description: 'Rent a car for your trip',
          script: `https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&powered_by=true&border_radius=5&plain=true&show_logo=true&color_background=%23ffca28&color_button=%2355a539&color_text=%23000000&color_input_text=%23000000&color_button_text=%23ffffff&promo_id=4480&campaign_id=10`
        },
        {
          type: 'transfer',
          title: 'Airport Transfers',
          description: 'Book reliable airport pickup',
          script: `https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&show_header=true&powered_by=true&campaign_id=627&promo_id=8951`
        }
      ]
    },
    'activities': {
      title: '🎫 Book Activities',
      widgets: [
        {
          type: 'activities',
          title: 'Tours & Activities',
          description: 'Discover local experiences',
          script: `https://tpwdgt.com/content?currency=usd&trs=455192&shmarker=634822&show_hotels=true&powered_by=true&locale=en&searchUrl=www.aviasales.com%2Fsearch&primary_override=%2332a8dd&color_button=%2355a539&color_icons=%2332a8dd&secondary=%23FFFFFF&dark=%23262626&light=%23FFFFFF&special=%23C4C4C4&color_focused=%2332a8dd&border_radius=5&plain=false&promo_id=7879&campaign_id=100`
        }
      ]
    },
    'connectivity': {
      title: '📱 Stay Connected',
      widgets: [
        {
          type: 'esim',
          title: 'eSIM',
          description: 'Get instant internet access worldwide',
          script: `https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&powered_by=true&color_button=%23f2685f&color_focused=%23f2685f&secondary=%23FFFFFF&dark=%2311100f&light=%23FFFFFF&special=%23C4C4C4&border_radius=5&plain=false&no_labels=true&promo_id=8588&campaign_id=541`
        }
      ]
    }
  };
  
  return widgets[section] || null;
}
