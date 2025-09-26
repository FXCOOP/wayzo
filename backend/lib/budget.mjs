export function normalizeBudget(value = '', _currency = 'USD') {
  const n = String(value).replace(/[^\d.,]/g, '').replace(/,/g, '');
  const parsed = parseFloat(n);

  // If we get a valid positive number, use it
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  // If no budget provided, return 0 to let computeBudget handle realistic calculation
  // This removes the hardcoded defaults and makes the AI calculate realistic budgets
  console.log('⚠️ No budget provided, will calculate realistic estimate');
  return 0;
}
export function computeBudget(total = 0, days = 1, style = 'mid', travelers = 2, destination = '', tripPurpose = 'leisure') {
  let t = Number(total) || 0;

  // If budget is 0, calculate realistic estimate based on destination, style, and activities
  if (t <= 0) {
    const baseDaily = calculateRealisticDailyBudget(style, destination, tripPurpose);
    t = baseDaily * Math.max(1, days) * Math.max(1, travelers);
    console.log(`💰 Calculated realistic budget: ${t} for ${days} days, ${travelers} travelers, ${style} style in ${destination}`);
  }

  const d = Math.max(1, Number(days) || 1);
  const perDay = t / d;

  // Add equipment costs for activity-based trips
  const equipmentCosts = calculateEquipmentCosts(destination, tripPurpose, travelers, days);

  // Adjust split to include equipment costs
  const split = calculateBudgetSplit(style, equipmentCosts.total > 0);

  const round = (x) => Math.round(x);
  return {
    stay:      { perDay: round(perDay * split.stay),                            total: round(t * split.stay) },
    food:      { perDay: round((perDay * split.food) / Math.max(1, travelers)), total: round(t * split.food) },
    act:       { perDay: round(perDay * split.act),                             total: round(t * split.act) },
    transit:   { perDay: round(perDay * split.transit),                         total: round(t * split.transit) },
    equipment: { perDay: round(equipmentCosts.total / d),                       total: equipmentCosts.total },
  };
}

// Calculate realistic daily budget based on destination and style
function calculateRealisticDailyBudget(style = 'mid', destination = '', tripPurpose = 'leisure') {
  // Base daily rates by style (per person)
  const baseDailyRates = {
    'luxury': 400,
    'mid': 200,
    'budget': 100
  };

  let baseRate = baseDailyRates[style] || baseDailyRates['mid'];

  // Adjust for destination (rough regional pricing)
  const regionMultiplier = getDestinationMultiplier(destination);
  baseRate *= regionMultiplier;

  // Adjust for trip purpose
  if (tripPurpose === 'business') {
    baseRate *= 1.3; // Business travel typically costs more
  } else if (tripPurpose === 'day-trip') {
    baseRate *= 0.7; // Day trips have lower accommodation costs
  }

  return Math.round(baseRate);
}

// Get destination pricing multiplier based on cost of living
function getDestinationMultiplier(destination = '') {
  const dest = destination.toLowerCase();

  // Expensive destinations
  if (dest.includes('switzerland') || dest.includes('norway') || dest.includes('iceland') ||
      dest.includes('singapore') || dest.includes('tokyo') || dest.includes('monaco') ||
      dest.includes('new york') || dest.includes('san francisco') || dest.includes('london')) {
    return 1.8;
  }

  // Moderate-expensive destinations
  if (dest.includes('france') || dest.includes('germany') || dest.includes('italy') ||
      dest.includes('spain') || dest.includes('australia') || dest.includes('japan') ||
      dest.includes('canada') || dest.includes('sweden') || dest.includes('denmark')) {
    return 1.4;
  }

  // Budget-friendly destinations
  if (dest.includes('thailand') || dest.includes('vietnam') || dest.includes('india') ||
      dest.includes('philippines') || dest.includes('mexico') || dest.includes('guatemala') ||
      dest.includes('nepal') || dest.includes('cambodia') || dest.includes('laos')) {
    return 0.6;
  }

  // Moderate destinations (Eastern Europe, parts of Asia, South America)
  if (dest.includes('poland') || dest.includes('hungary') || dest.includes('czech') ||
      dest.includes('bulgaria') || dest.includes('romania') || dest.includes('croatia') ||
      dest.includes('indonesia') || dest.includes('malaysia') || dest.includes('peru') ||
      dest.includes('colombia') || dest.includes('ecuador')) {
    return 0.8;
  }

  // Default multiplier
  return 1.2;
}

// Calculate equipment costs for activity-based trips
function calculateEquipmentCosts(destination = '', tripPurpose = 'leisure', travelers = 2, days = 1) {
  const dest = destination.toLowerCase();
  let equipmentCost = 0;

  // Ski equipment
  if (dest.includes('ski') || dest.includes('bansko') || dest.includes('alps') ||
      dest.includes('aspen') || dest.includes('whistler') || dest.includes('zermatt') ||
      dest.includes('chamonix') || dest.includes('st. moritz')) {
    equipmentCost += travelers * 50 * Math.min(days, 7); // $50 per person per day, max 7 days
  }

  // Diving equipment
  if (dest.includes('diving') || dest.includes('scuba') || dest.includes('maldives') ||
      dest.includes('great barrier reef') || dest.includes('red sea')) {
    equipmentCost += travelers * 40 * Math.min(days, 5); // $40 per person per day, max 5 days
  }

  // Hiking/climbing equipment
  if (dest.includes('himalaya') || dest.includes('everest') || dest.includes('kilimanjaro') ||
      dest.includes('andes') || dest.includes('trekking') || dest.includes('hiking')) {
    equipmentCost += travelers * 30 * Math.ceil(days / 3); // $30 per person per 3 days
  }

  // Water sports equipment
  if (dest.includes('surfing') || dest.includes('kayak') || dest.includes('hawaii') ||
      dest.includes('costa rica') || dest.includes('bali surfing')) {
    equipmentCost += travelers * 25 * Math.min(days, 5); // $25 per person per day, max 5 days
  }

  // Safari/photography equipment
  if (dest.includes('safari') || dest.includes('kenya') || dest.includes('tanzania') ||
      dest.includes('botswana') || dest.includes('south africa wildlife')) {
    equipmentCost += travelers * 20 * Math.ceil(days / 2); // $20 per person per 2 days
  }

  return {
    total: equipmentCost,
    description: equipmentCost > 0 ? getEquipmentDescription(dest) : ''
  };
}

// Get equipment description based on destination
function getEquipmentDescription(destination) {
  if (destination.includes('ski') || destination.includes('bansko') || destination.includes('alps')) {
    return 'Ski equipment rental (skis, boots, poles, helmets)';
  }
  if (destination.includes('diving') || destination.includes('scuba')) {
    return 'Diving equipment rental (gear, tanks, suits)';
  }
  if (destination.includes('himalaya') || destination.includes('trekking')) {
    return 'Trekking equipment rental (boots, poles, backpacks)';
  }
  if (destination.includes('surfing')) {
    return 'Water sports equipment rental (boards, wetsuits)';
  }
  if (destination.includes('safari')) {
    return 'Safari equipment rental (binoculars, cameras, gear)';
  }
  return 'Activity equipment rental';
}

// Calculate budget split based on style and whether equipment is needed
function calculateBudgetSplit(style = 'mid', hasEquipment = false) {
  let split;

  if (hasEquipment) {
    // Adjust percentages when equipment costs are involved
    split = style === 'luxury' ?
      { stay: 0.48, food: 0.20, act: 0.15, transit: 0.05, equipment: 0.12 } :
      style === 'budget' ?
      { stay: 0.32, food: 0.24, act: 0.18, transit: 0.13, equipment: 0.13 } :
      { stay: 0.42, food: 0.22, act: 0.16, transit: 0.09, equipment: 0.11 };
  } else {
    // Standard split without equipment
    split = style === 'luxury' ?
      { stay: 0.55, food: 0.22, act: 0.18, transit: 0.05, equipment: 0 } :
      style === 'budget' ?
      { stay: 0.38, food: 0.27, act: 0.20, transit: 0.15, equipment: 0 } :
      { stay: 0.47, food: 0.25, act: 0.18, transit: 0.10, equipment: 0 };
  }

  return split;
}
