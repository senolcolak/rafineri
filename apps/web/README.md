# Rafineri Web

Next.js frontend for the Rafineri fact verification platform.

## Features

- **Responsive Layout**: Sticky top bar, collapsible sidebar, and adaptive main feed
- **Story Feed**: List/grid views with infinite scroll
- **Filters**: Label filters, category filters, source toggles
- **Story Detail**: Claims, evidence, and timeline views
- **Mock Data**: Works out of the box with mock data for development

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- TanStack Query (React Query)
- Zustand (State management)

## Getting Started

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start the development server
cd apps/web
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_USE_MOCK=true  # Use mock data instead of real API
```

## Project Structure

```
src/
  app/              # Next.js App Router pages
  components/       # React components
    feed/           # Feed-related components
    layout/         # Layout components (TopBar, Sidebar)
    story/          # Story components (StoryCard, StoryDetail)
    ui/             # Reusable UI components
  hooks/            # Custom React hooks
  lib/              # Utility functions and API client
  store/            # Zustand stores
  types/            # TypeScript type definitions
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking
