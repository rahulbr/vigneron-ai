Welcome to the NextJS base template bootstrapped using the `create-next-app`. This template supports TypeScript, but you can use normal JavaScript as well.

## Getting Started

Hit the run button to start the development server.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on `/api/hello`. This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Productionizing your Next App

To make your next App run smoothly in production make sure to deploy your project with [Repl Deployments](https://docs.replit.com/hosting/deployments/about-deployments)!

You can also produce a production build by running `npm run build` and [changing the run command](https://docs.replit.com/programming-ide/configuring-repl#run) to `npm run start`.
# Vigneron.AI - Professional Vineyard Management

## Environment Variables Required

Add these to your Replit Secrets:

### Weather APIs
- `NEXT_PUBLIC_WEATHER_API_KEY` - Get from [WeatherAPI.com](https://www.weatherapi.com/) (free tier available)

### Google Maps
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Get from [Google Cloud Console](https://console.cloud.google.com/)

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Weather Data Sources

- **US Locations**: NOAA (National Oceanic and Atmospheric Administration) - Official US weather data
- **Global Locations**: WeatherAPI.com - Comprehensive global weather data
- **Geocoding**: Google Maps API - Convert addresses to coordinates

## Features

- Real-time weather data from official sources
- Growing Degree Day (GDD) calculations
- Phenology event tracking
- Multi-vineyard management
- Historical weather analysis
- User authentication via Supabase
