# Booking distance estimates

POST `/customer/route-distance` is restricted to customers. The strict body contains only `from` and `to`, each with country (VN/CN/TH), city and ward. No names, phone numbers, identity numbers or street/farm addresses are forwarded.

Photon resolves public localities; OSRM provides road distance in metres, rounded to integer kilometres. Ward matching falls back to the province/city and the UI identifies this lower precision. Historic administrative features are excluded. Identical coordinates, missing roads, provider failures and invalid distances return errors, never the previous/default 50 km. Road results are not truck clearance, border crossing approval or exact farm-to-farm measurements.

Providers default to `https://photon.komoot.io` and `https://router.project-osrm.org`. Override `ROUTE_GEOCODER_URL` and `ROUTE_ROUTER_URL` with compatible self-hosted/provider base URLs. Public endpoints are for modest usage and have no availability guarantee. The process serializes outbound calls at least 1.1 seconds apart, caps queued calls at 20, deduplicates pending requests and caches up to 1,000 successful lookups for 24 hours. For multiple API instances/high traffic use dedicated providers and shared rate limiting/cache.

Client requests are debounced and cancelled on changes. Pricing and submission require the matching distance result; stale responses cannot replace a newer route. The removed duration input does not change the existing provisional one-day pricing basis; dispatch/manager confirms duration and final price.

Sources: https://github.com/komoot/photon/blob/master/docs/api-v1.md and https://project-osrm.org/docs/v5.24.0/api/ . Attribution is displayed beside the distance.
