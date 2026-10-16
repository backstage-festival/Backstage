# Backstage

Offline-first festival companion app for young festival-goers (16–20).
All event data is downloaded in advance, so the app works without mobile coverage:
event map, lineup planner, crew chat with an offline queue, compass back to your tent
and public transport home (ZTM Gdańsk / TRISTAR).

## Tech stack

Expo (React Native) · TypeScript · Expo Router · Zustand · expo-sqlite ·
expo-location · Leaflet in WebView · Animated · bcryptjs + expo-crypto · Jest

## Getting started

```bash
npm install
npx expo start          # same Wi-Fi as your phone
npx expo start --tunnel # if the phone cannot connect
```

Scan the QR code with Expo Go.

## Scripts

| Command             | Description          |
| ------------------- | -------------------- |
| `npm start`         | Start the dev server |
| `npm test`          | Run unit tests       |
| `npm run typecheck` | TypeScript check     |
| `npm run lint`      | Lint the code        |

## Project structure

```text
src/
├─ app/              screens and layouts (Expo Router)
├─ components/       reusable UI components
├─ store/            Zustand stores
├─ domain/           entities, repository interfaces, business rules
├─ use-cases/        application logic
├─ di/               dependency wiring
└─ infrastructure/   storage, api, auth, location, network, map
assets/map/          offline map assets
```

## Team

| Role                           | Member               |
| ------------------------------ | -------------------- |
| Domain & QA Lead (team leader) | Marceli Duraziński   |
| Data & Security Lead           | Dominik Warykowski   |
| UI & State Lead                | Jakub Dampc          |
| Hardware & DevOps Lead         | Przemysław Bladowski |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
