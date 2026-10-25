import type { PricingConfig } from '@my-project/shared';
// Initial values supplied in the user's v7 HTML; subsequent changes live in MySQL versions.
export const initialPricingConfig: PricingConfig = {
 currency:'VND', distanceRates:[
  {km:50,light:4515000,medium:6321000,heavy:8579000}, {km:150,light:7245000,medium:10143000,heavy:13766000},
  {km:300,light:11340000,medium:15876000,heavy:21546000}, {km:600,light:17640000,medium:24696000,heavy:33516000},
  {km:1000,light:23940000,medium:33516000,heavy:45486000}, {km:1500,light:31815000,medium:44541000,heavy:60449000}],
 fees:{crewPerDay:1890000,fuelPer100Km:992000,extraStallPerHorse:1500000,premiumFeedPerHorse:300000,sportFeedPerHorse:500000,water2hPerHorse:50000,water1hPerHorse:100000,internationalPerTrip:300000},
 insurance:{THOROUGHBRED:20000000,ARABIAN:16000000,QUARTER_HORSE:12000000,WARMBLOOD:18000000,APPALOOSA:10000000,OTHER:8000000},depositPercent:30,quoteValidityHours:24,
};
