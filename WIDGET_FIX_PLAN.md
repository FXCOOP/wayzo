# Widget Pre-fill Fix Plan

## Original User Request
Add URL parameters to Travelpayouts widgets so they pre-fill with trip data.

## Changes to Make (ONLY these, nothing else):

### 1. Airport Transfer Widget
- ADD: `&city=CityName` to script URL
- Example: `&city=Berlin`

### 2. eSIM Widget
- CONVERT: Static script to function
- ADD: `&country=CountryName` to script URL
- Example: `&country=Germany`

### 3. Car Rental Widget
- ADD: `&default_pick_up_location=Location&default_drop_off_location=Location` to script URL
- Example: `&default_pick_up_location=Berlin%20Airport`

### 4. Flight Search Widget
- ADD: `&origin=CODE&destination=CODE` to script URL with airport codes
- Example: `&origin=TLV&destination=BER`

### 5. Hotel Booking Widget
- ADD: `&destination=City%2C%20Country&check_in=date&check_out=date&guests=number` to script URL
- Example: `&destination=Berlin%2C%20Germany&check_in=2025-10-10&check_out=2025-10-24&guests=2`

## Helper Functions Needed
- `getCountryFromDestination(destination)` - Maps destination to country name
- `getAirportCode(city)` - Maps city to IATA airport code

## DO NOT TOUCH:
- AI prompts in server.mjs
- Link processing in links.mjs
- Any existing report content or styling
