// Comprehensive Smart Booking Intelligence Test
import { generateBookingRecommendations } from './lib/smart-booking.mjs';

console.log('🌍 COMPREHENSIVE DESTINATION TESTING');
console.log('=====================================');

const testDestinations = [
  // Supported destinations with data
  { dest: 'Paris, France', date: '2024-07-14', expected: 'Bastille Day warnings' },
  { dest: 'Venice, Italy', date: '2024-02-15', expected: 'Carnival warnings' },
  { dest: 'Tokyo, Japan', date: '2024-04-10', expected: 'Cherry Blossom warnings' },
  { dest: 'Munich, Germany', date: '2024-09-25', expected: 'Oktoberfest warnings' },
  { dest: 'Bangkok, Thailand', date: '2024-04-14', expected: 'Songkran warnings' },
  { dest: 'Madrid, Spain', date: '2024-07-10', expected: 'Normal period' },
  { dest: 'Tyrol, Austria', date: '2025-09-30', expected: 'Autumn season notes' },

  // Unsupported destinations (should handle gracefully)
  { dest: 'Sydney, Australia', date: '2024-12-25', expected: 'No specific data' },
  { dest: 'New York, USA', date: '2024-07-04', expected: 'No specific data' },
  { dest: 'Cairo, Egypt', date: '2024-12-25', expected: 'No specific data' },
  { dest: 'Random City, Unknown Country', date: '2024-06-15', expected: 'No specific data' }
];

for (const test of testDestinations) {
  console.log(`\n📍 Testing: ${test.dest}`);
  console.log(`📅 Date: ${test.date}`);
  console.log(`🎯 Expected: ${test.expected}`);

  const result = generateBookingRecommendations(test.dest, 'general', test.date, '10:00-12:00', 2);

  const hasWarnings = result.warnings.length > 0;
  const hasOpportunities = result.opportunities.length > 0;
  const hasRecommendations = result.recommendations.length > 0;

  if (hasWarnings) {
    console.log('⚠️  Warnings Found:');
    result.warnings.forEach(w => console.log('   ' + w));
  }
  if (hasOpportunities) {
    console.log('🎉 Opportunities Found:');
    result.opportunities.forEach(o => console.log('   ' + o));
  }
  if (hasRecommendations) {
    console.log('💡 Tips Found:');
    result.recommendations.forEach(r => console.log('   ' + r));
  }

  if (!hasWarnings && !hasOpportunities && !hasRecommendations) {
    console.log('✅ No specific recommendations (graceful handling)');
  }

  console.log(`📊 Priority: ${result.priority} | Urgency: ${result.urgency}`);
}

console.log('\n🧪 INTEGRATION TEST - AI Context Generation:');
console.log('=============================================');

function generateSmartBookingContext(destination, startDate, groupSize) {
  const recommendations = generateBookingRecommendations(destination, 'general', startDate, '10:00-12:00', groupSize);
  let context = '';
  if (recommendations.warnings.length > 0) {
    context += '\n**🚨 IMPORTANT BOOKING ALERTS:**\n';
    recommendations.warnings.forEach(warning => context += '- ' + warning + '\n');
  }
  if (recommendations.opportunities.length > 0) {
    context += '\n**🎉 SPECIAL EVENTS DURING YOUR VISIT:**\n';
    recommendations.opportunities.forEach(opportunity => context += '- ' + opportunity + '\n');
  }
  if (recommendations.recommendations.length > 0) {
    context += '\n**💡 SMART BOOKING TIPS:**\n';
    recommendations.recommendations.forEach(rec => context += '- ' + rec + '\n');
  }
  return context;
}

// Test AI context generation for key scenarios
const aiTests = [
  { dest: 'Paris, France', date: '2024-07-14' },
  { dest: 'Random City, Country', date: '2024-06-15' }
];

for (const test of aiTests) {
  console.log(`\n🤖 AI Context for ${test.dest}:`);
  const context = generateSmartBookingContext(test.dest, test.date, 2);
  if (context) {
    console.log(context);
  } else {
    console.log('(Empty context - no specific recommendations)');
  }
}

console.log('\n✅ COMPREHENSIVE TEST COMPLETE!');