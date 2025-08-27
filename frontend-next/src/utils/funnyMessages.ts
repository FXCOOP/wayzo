const MESSAGES = [
  'Consulting the travel elves for epic adventures...',
  'Brewing the perfect itinerary potion...',
  'Asking AI if pineapple on pizza is a valid meal option...',
  'Plotting your escape from reality...',
  'Convincing the maps not to send you in circles...',
  'Gathering wanderlust vibes from around the globe...',
  'Negotiating with hotel pillows for extra fluff...',
  'Double-checking if llamas are allowed on the tour...',
  'Teaching compasses to point to fun...',
  'Googling where the sun sets the prettiest...',
  'Packing extra snacks for the algorithm...',
  'Whispering to the waves for insider tips...',
  'Sharpening hiking boots virtually...',
  'Telling clouds to behave during your trip...',
  'Assembling an army of recommendations...'
]

export const funnyMessages = {
  random: () => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
}

