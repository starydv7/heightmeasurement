# Height Measurement App (Expo)

React Native + Expo starter project for estimating height from image measurements.

## Features

- Clean `src/` architecture with separated screens, components, services, and utilities
- Height estimation logic using reference object ratio
- Expo Application Services (EAS) build profiles for development, preview, and production

## Project Structure

- `App.tsx` - app entry point
- `src/screens` - screen-level UI
- `src/components` - reusable UI components
- `src/services` - business logic and calculations
- `src/utils` - shared helper functions
- `src/types` - TypeScript model types
- `src/constants` - theme and constants
- `app.json` - Expo app configuration
- `eas.json` - EAS build profiles

## Run Locally

```bash
npm install
npm run start
```

## Build Commands

- Android preview: `npm run build:android:preview`
- iOS preview: `npm run build:ios:preview`
- Android production: `npm run build:android:production`
- iOS production: `npm run build:ios:production`

## Notes

Update these identifiers in `app.json` before store release:

- `expo.android.package`
- `expo.ios.bundleIdentifier`
