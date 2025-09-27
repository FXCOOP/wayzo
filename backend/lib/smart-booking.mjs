// Smart Booking Intelligence System
// Provides context-aware booking recommendations based on local factors

// Local holidays and events database
const HOLIDAYS_AND_EVENTS = {
  // Major global destinations with specific holiday patterns
  'france': {
    holidays: [
      { name: 'Christmas', dates: ['12-25'], closures: ['museums', 'shops'], crowds: 'low' },
      { name: 'New Year', dates: ['01-01'], closures: ['museums', 'government'], crowds: 'low' },
      { name: 'Easter Monday', dates: ['easter+1'], closures: ['museums'], crowds: 'medium' },
      { name: 'May Day', dates: ['05-01'], closures: ['shops', 'museums'], crowds: 'low' },
      { name: 'Bastille Day', dates: ['07-14'], events: ['fireworks', 'parades'], crowds: 'very_high' },
      { name: 'Assumption', dates: ['08-15'], closures: ['museums'], crowds: 'medium' }
    ],
    events: [
      { name: 'Fashion Week', period: 'Sep-Oct', location: 'Paris', impact: 'hotel_surge', crowds: 'high' },
      { name: 'Cannes Film Festival', period: 'May', location: 'Cannes', impact: 'hotel_surge', crowds: 'very_high' },
      { name: 'Summer Olympics', period: 'Jul-Aug', year: '2024', location: 'Paris', impact: 'transport_chaos', crowds: 'extreme' }
    ]
  },
  'italy': {
    holidays: [
      { name: 'Ferragosto', dates: ['08-15'], closures: ['shops', 'restaurants'], crowds: 'low', note: 'Many locals on vacation' },
      { name: 'Christmas', dates: ['12-25'], closures: ['museums', 'shops'], crowds: 'low' },
      { name: 'Liberation Day', dates: ['04-25'], closures: ['museums'], crowds: 'medium' },
      { name: 'Republic Day', dates: ['06-02'], events: ['parades'], crowds: 'medium' }
    ],
    events: [
      { name: 'Venice Carnival', period: 'Feb-Mar', location: 'Venice', crowds: 'extreme', note: 'Book accommodation months ahead' },
      { name: 'Rome Marathon', period: 'Mar', location: 'Rome', impact: 'transport_disruption', crowds: 'high' }
    ]
  },
  'spain': {
    holidays: [
      { name: 'Three Kings Day', dates: ['01-06'], closures: ['shops'], crowds: 'medium' },
      { name: 'Labor Day', dates: ['05-01'], closures: ['museums'], crowds: 'low' },
      { name: 'National Day', dates: ['10-12'], events: ['parades'], crowds: 'medium' },
      { name: 'All Saints Day', dates: ['11-01'], closures: ['shops'], crowds: 'low' }
    ],
    events: [
      { name: 'Running of Bulls', period: 'Jul 6-14', location: 'Pamplona', crowds: 'extreme', note: 'Dangerous event - book early' },
      { name: 'La Tomatina', period: 'Aug', location: 'Valencia', crowds: 'very_high', note: 'Messy festival' },
      { name: 'Semana Santa', period: 'Easter Week', location: 'Seville', crowds: 'extreme', impact: 'hotel_surge' }
    ]
  },
  'germany': {
    holidays: [
      { name: 'Christmas Markets', period: 'Nov-Dec', crowds: 'very_high', note: 'Book early for December visits' },
      { name: 'Oktoberfest', period: 'Sep-Oct', location: 'Munich', crowds: 'extreme', impact: 'hotel_surge' },
      { name: 'Unity Day', dates: ['10-03'], closures: ['government'], crowds: 'medium' }
    ]
  },
  'japan': {
    holidays: [
      { name: 'Cherry Blossom', period: 'Mar-May', crowds: 'extreme', note: 'Peak tourism season' },
      { name: 'Golden Week', period: 'Apr 29-May 5', crowds: 'extreme', impact: 'transport_chaos' },
      { name: 'Obon', period: 'Aug 13-16', crowds: 'high', note: 'Family holiday period' },
      { name: 'New Year', period: 'Dec 29-Jan 3', closures: ['shops', 'restaurants'], crowds: 'low' }
    ]
  },
  'thailand': {
    holidays: [
      { name: 'Songkran', period: 'Apr 13-15', crowds: 'very_high', note: 'Water festival - everything gets wet' },
      { name: 'Loy Krathong', period: 'Nov', crowds: 'high', events: ['lanterns', 'water_ceremonies'] },
      { name: 'Chinese New Year', period: 'Jan-Feb', crowds: 'high', impact: 'shop_closures' }
    ]
  }
};

// Peak hours and crowd patterns
const CROWD_PATTERNS = {
  museums: {
    peak_hours: ['10:00-12:00', '14:00-16:00'],
    best_times: ['08:00-10:00', '16:00-18:00'],
    weekend_surge: 1.5,
    holiday_surge: 2.0
  },
  restaurants: {
    lunch_peak: ['12:00-14:00'],
    dinner_peak: ['19:00-21:00'],
    best_times: ['11:30-12:00', '18:30-19:00', '21:30-22:00'],
    weekend_surge: 1.3
  },
  activities: {
    morning_preferred: ['tours', 'outdoor', 'cycling'],
    afternoon_preferred: ['boat_trips', 'walking'],
    evening_preferred: ['shows', 'nightlife'],
    weather_dependent: ['outdoor', 'walking', 'cycling', 'boat_trips']
  },
  transport: {
    rush_hours: ['07:00-09:00', '17:00-19:00'],
    best_times: ['09:30-16:30', '19:30-22:00'],
    weekend_different: true
  }
};

// Weather impact on activities
const WEATHER_IMPACT = {
  rain: {
    avoid: ['outdoor_tours', 'walking_tours', 'cycling', 'boat_trips'],
    recommend: ['museums', 'indoor_activities', 'shopping', 'restaurants'],
    note: 'Perfect day for indoor cultural activities'
  },
  hot: {
    avoid: ['midday_outdoor', 'walking_tours_noon'],
    recommend: ['early_morning_tours', 'air_conditioned_venues', 'swimming'],
    note: 'Start early or seek air-conditioned venues'
  },
  cold: {
    avoid: ['boat_trips', 'outdoor_dining'],
    recommend: ['heated_venues', 'hot_drinks', 'indoor_markets'],
    note: 'Warm venues and hot beverages recommended'
  }
};

// Generate smart booking recommendations
export function generateBookingRecommendations(destination, activityType, date, timeSlot, groupSize = 2) {
  const recommendations = [];
  const warnings = [];
  const opportunities = [];

  // Check for local holidays and events
  const holidayInfo = checkHolidaysAndEvents(destination, date);
  if (holidayInfo.length > 0) {
    holidayInfo.forEach(info => {
      if (info.closures && info.closures.includes(activityType)) {
        warnings.push(`⚠️ ${info.name}: Many ${activityType} may be closed`);
      }
      if (info.crowds === 'very_high' || info.crowds === 'extreme') {
        warnings.push(`🚨 ${info.name}: Expect huge crowds - book well in advance`);
      }
      if (info.events) {
        opportunities.push(`🎉 ${info.name}: Special events happening - unique experience`);
      }
    });
  }

  // Check crowd patterns
  const crowdInfo = analyzeCrowdPatterns(activityType, date, timeSlot);
  if (crowdInfo && crowdInfo.recommendation) {
    recommendations.push(crowdInfo.recommendation);
  }

  // Group size optimizations
  const groupInfo = analyzeGroupSize(activityType, groupSize);
  if (groupInfo) {
    recommendations.push(groupInfo);
  }

  // Time-based recommendations
  const timeInfo = analyzeTimeSlot(activityType, timeSlot, date);
  if (timeInfo) {
    recommendations.push(timeInfo);
  }

  return {
    recommendations,
    warnings,
    opportunities,
    priority: calculatePriority(warnings, opportunities),
    urgency: calculateUrgency(warnings, crowdInfo)
  };
}

function checkHolidaysAndEvents(destination, date) {
  // Extract country from destination
  const dest = destination.toLowerCase();
  let country = '';

  if (dest.includes('france') || dest.includes('paris')) country = 'france';
  else if (dest.includes('italy') || dest.includes('rome') || dest.includes('venice')) country = 'italy';
  else if (dest.includes('spain') || dest.includes('madrid')) country = 'spain';
  else if (dest.includes('germany') || dest.includes('munich') || dest.includes('berlin')) country = 'germany';
  else if (dest.includes('japan') || dest.includes('tokyo')) country = 'japan';
  else if (dest.includes('thailand') || dest.includes('bangkok')) country = 'thailand';

  const holidayData = HOLIDAYS_AND_EVENTS[country];
  const results = [];

  if (!holidayData) return results;

  const targetDate = new Date(date);
  const month = targetDate.getMonth() + 1;
  const day = targetDate.getDate();
  const dateString = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  // Check holidays
  holidayData.holidays?.forEach(holiday => {
    if (holiday.dates && holiday.dates.includes(dateString)) {
      results.push(holiday);
    } else if (holiday.period && isInPeriod(targetDate, holiday.period)) {
      results.push(holiday);
    }
  });

  // Check events
  holidayData.events?.forEach(event => {
    if (isInPeriod(targetDate, event.period)) {
      // Check if location matches or if it's a country-wide event
      if (!event.location || destination.toLowerCase().includes(event.location.toLowerCase())) {
        results.push(event);
      }
    }
  });

  return results;
}

function analyzeCrowdPatterns(activityType, date, timeSlot) {
  const pattern = CROWD_PATTERNS[activityType];
  if (!pattern) return null;

  const dayOfWeek = new Date(date).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const time = timeSlot.split('-')[0];

  if (pattern.peak_hours?.some(peak => isTimeInRange(time, peak))) {
    if (isWeekend && pattern.weekend_surge) {
      return {
        recommendation: `🕐 Peak time + weekend: Expect ${Math.round(pattern.weekend_surge * 100)}% more crowds. Consider booking early morning or late afternoon.`
      };
    }
    return {
      recommendation: `⏰ Peak visiting time. Book in advance or consider ${pattern.best_times?.[0] || 'earlier/later'} for shorter waits.`
    };
  }

  if (pattern.best_times?.some(best => isTimeInRange(time, best))) {
    return {
      recommendation: `✨ Perfect timing! You've chosen an optimal time with typically shorter lines.`
    };
  }

  return null;
}

function analyzeGroupSize(activityType, groupSize) {
  if (groupSize >= 8) {
    return `👥 Large group (${groupSize}): Call ahead for group rates and reservations. Many venues offer discounts for 8+ people.`;
  }
  if (groupSize >= 6 && activityType === 'restaurants') {
    return `🍽️ Party of ${groupSize}: Restaurant reservations highly recommended. Consider booking 2-3 days ahead.`;
  }
  if (groupSize === 1 && activityType === 'activities') {
    return `🚶 Solo traveler: Some tours offer single-person discounts. Check for walking tours or photography tours.`;
  }
  return null;
}

function analyzeTimeSlot(activityType, timeSlot, date) {
  const dayOfWeek = new Date(date).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const time = timeSlot.split('-')[0];
  const hour = parseInt(time.split(':')[0]);

  if (activityType === 'restaurants') {
    if (hour >= 12 && hour <= 14) {
      return `🍽️ Lunch time: Consider booking ahead, especially on ${isWeekend ? 'weekends' : 'weekdays'}. Prix fixe menus often available.`;
    }
    if (hour >= 19 && hour <= 21) {
      return `🌆 Prime dinner time: Reservations essential. Book 24-48 hours ahead for popular restaurants.`;
    }
  }

  if (activityType === 'museums' && hour < 10) {
    return `🎨 Early bird advantage: First admission slots often have shorter lines and better photo opportunities.`;
  }

  if (activityType === 'transport' && (hour >= 7 && hour <= 9 || hour >= 17 && hour <= 19)) {
    return `🚇 Rush hour: Public transport will be crowded. Consider taxi/ride-share or adjust timing by 30-60 minutes.`;
  }

  return null;
}

function calculatePriority(warnings, opportunities) {
  if (warnings.length >= 2) return 'high';
  if (opportunities.length >= 1) return 'medium';
  return 'low';
}

function calculateUrgency(warnings, crowdInfo) {
  const hasHighCrowdWarning = warnings.some(w => w.includes('🚨') || w.includes('extreme'));
  const hasPeakTimeWarning = crowdInfo && crowdInfo.recommendation && crowdInfo.recommendation.includes('Peak time');

  if (hasHighCrowdWarning) return 'urgent';
  if (hasPeakTimeWarning) return 'moderate';
  return 'normal';
}

function isTimeInRange(time, range) {
  const [startTime, endTime] = range.split('-');
  return time >= startTime && time <= endTime;
}

function isInPeriod(date, period) {
  if (!period) return false;

  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Handle month ranges like "Sep-Oct"
  if (period.includes('-')) {
    const [start, end] = period.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startMonth = monthNames.indexOf(start) + 1;
    const endMonth = monthNames.indexOf(end) + 1;

    if (startMonth && endMonth) {
      return month >= startMonth && month <= endMonth;
    }
  }

  // Handle specific dates like "Apr 13-15"
  if (period.includes(' ')) {
    const parts = period.split(' ');
    const monthName = parts[0];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const targetMonth = monthNames.indexOf(monthName) + 1;

    if (targetMonth === month) {
      if (parts[1].includes('-')) {
        const [startDay, endDay] = parts[1].split('-').map(Number);
        return day >= startDay && day <= endDay;
      }
    }
  }

  return false;
}

// Export weather impact data for use in AI prompts
export { WEATHER_IMPACT, CROWD_PATTERNS, HOLIDAYS_AND_EVENTS };