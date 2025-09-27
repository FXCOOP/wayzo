// Test Smart Booking Intelligence System
import { generateBookingRecommendations } from './lib/smart-booking.mjs';

console.log('🧪 Testing Smart Booking Intelligence System\n');

// Test 1: Bastille Day in Paris (Major Holiday)
console.log('📍 Test 1: Paris during Bastille Day');
const parisJuly14 = generateBookingRecommendations('Paris, France', 'museums', '2024-07-14', '10:00-12:00', 2);
console.log('Warnings:', parisJuly14.warnings);
console.log('Opportunities:', parisJuly14.opportunities);
console.log('Recommendations:', parisJuly14.recommendations);
console.log('Priority:', parisJuly14.priority, '| Urgency:', parisJuly14.urgency);
console.log('---');

// Test 2: Venice during Carnival (Extreme crowds)
console.log('📍 Test 2: Venice during Carnival');
const veniceCarnival = generateBookingRecommendations('Venice, Italy', 'activities', '2024-02-15', '14:00-17:00', 4);
console.log('Warnings:', veniceCarnival.warnings);
console.log('Opportunities:', veniceCarnival.opportunities);
console.log('Priority:', veniceCarnival.priority, '| Urgency:', veniceCarnival.urgency);
console.log('---');

// Test 3: Tokyo during Cherry Blossom Season
console.log('📍 Test 3: Tokyo during Cherry Blossom');
const tokyoSakura = generateBookingRecommendations('Tokyo, Japan', 'museums', '2024-04-10', '09:00-12:00', 1);
console.log('Warnings:', tokyoSakura.warnings);
console.log('Opportunities:', tokyoSakura.opportunities);
console.log('Priority:', tokyoSakura.priority, '| Urgency:', tokyoSakura.urgency);
console.log('---');

// Test 4: Munich during Oktoberfest
console.log('📍 Test 4: Munich during Oktoberfest');
const munichOktoberfest = generateBookingRecommendations('Munich, Germany', 'restaurants', '2024-09-25', '19:00-21:00', 6);
console.log('Warnings:', munichOktoberfest.warnings);
console.log('Opportunities:', munichOktoberfest.opportunities);
console.log('Recommendations:', munichOktoberfest.recommendations);
console.log('Priority:', munichOktoberfest.priority, '| Urgency:', munichOktoberfest.urgency);
console.log('---');

// Test 5: Thailand during Songkran (Water Festival)
console.log('📍 Test 5: Thailand during Songkran');
const thailandSongkran = generateBookingRecommendations('Bangkok, Thailand', 'activities', '2024-04-14', '12:00-17:00', 3);
console.log('Warnings:', thailandSongkran.warnings);
console.log('Opportunities:', thailandSongkran.opportunities);
console.log('Priority:', thailandSongkran.priority, '| Urgency:', thailandSongkran.urgency);
console.log('---');

// Test 6: Normal Day in Spain (No special events)
console.log('📍 Test 6: Madrid on normal day');
const madridNormal = generateBookingRecommendations('Madrid, Spain', 'museums', '2024-03-15', '10:00-12:00', 2);
console.log('Warnings:', madridNormal.warnings);
console.log('Opportunities:', madridNormal.opportunities);
console.log('Recommendations:', madridNormal.recommendations);
console.log('Priority:', madridNormal.priority, '| Urgency:', madridNormal.urgency);
console.log('---');

// Test 7: Large Group Restaurant Booking
console.log('📍 Test 7: Large group restaurant booking');
const largeGroupRestaurant = generateBookingRecommendations('Rome, Italy', 'restaurants', '2024-06-20', '20:00-22:00', 10);
console.log('Recommendations:', largeGroupRestaurant.recommendations);
console.log('Priority:', largeGroupRestaurant.priority);
console.log('---');

// Test 8: Rush Hour Transport
console.log('📍 Test 8: Rush hour transport');
const rushHourTransport = generateBookingRecommendations('London, UK', 'transport', '2024-05-15', '08:00-09:00', 2);
console.log('Recommendations:', rushHourTransport.recommendations);
console.log('---');

console.log('✅ Smart Booking Intelligence Test Complete!');