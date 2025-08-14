# Affiliate Links

Set your affiliate IDs in backend `.env`:
- `AFF_BOOKING_AID`
- `AFF_KAYAK_AFF`
- `AFF_GYG_PARTNER`
- `AFF_RENTALCARS_CODE`
- `AFF_WORLDNOMADS_AFF`

The backend auto-injects destination into links and stores them with each plan.

**Frontend Note**: `index.backend.html` replaces the quick links with the affiliate links returned by `/api/preview`.
