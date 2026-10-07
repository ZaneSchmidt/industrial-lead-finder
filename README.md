# Industrial Lead Finder — Version 2

Mobile-friendly lead finder for machining, welding, fabrication and related industrial businesses.

## Included
- Location / ZIP search
- 5/10/25/50/100 mile radius
- Process filters
- Google Places API (New) search
- De-duplicated results
- Distance and lead score
- Phone and website buttons
- Mobile-first interface

## Run
1. Install Node.js 18+.
2. Enable Places API (New) and Geocoding API in Google Maps Platform.
3. Copy `.env.example` to `.env` and put your Google API key in it.
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

The Google API key stays on the backend and is not placed in the browser.
