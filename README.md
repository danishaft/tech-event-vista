<div align="center">
    <img alt="Logo" src="public/logo-full.svg" width="100" />
</div>

<h1 align="center">
    Tech Event Vista
</h1>

<p align="center">
   Discover tech events from multiple platforms with real-time scraping and intelligent search
</p>

<!-- TODO: Add main screenshot/video here showing the app interface -->
<!-- Example: <img src="docs/main-screenshot.png" alt="Tech Event Vista UI" /> -->

## How It Works

1. **Search**: Enter a query to search for tech events
2. **Database Check**: System first checks the database for existing results
3. **Live Scraping**: If no results found, creates a scraping job to fetch events from Luma and Eventbrite
4. **Real-Time Updates**: Frontend polls job status every 3 seconds until completion
5. **Results**: View filtered events with details, pricing, and registration links
6. **Daily Updates**: Automated cron jobs refresh event data daily at 6 AM UTC

<!-- TODO: Add screenshots showing the search flow, results page, and event details -->
<!-- Example: 
![Search Interface](docs/search.png)
![Event Results](docs/results.png)
![Event Details](docs/event-details.png)
-->

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Neon account)
- Redis instance (or Upstash account)

### Frontend Setup

```bash
npm install

npm run dev
```

### Backend Setup

```bash
# Set up environment variables
cp .env.example .env
# Edit .env with your database and Redis URLs

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Start the worker (in a separate terminal)
npm run worker
```

## Self-Hosting

### Using Docker (Recommended)

The easiest way to self-host is using Docker Compose:

```bash
# Start all services (app, database, redis, worker)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

This will start:
- **Next.js app** on port 3000
- **PostgreSQL** on port 5432
- **Redis** on port 6380
- **BullMQ worker** process

### Environment Variables

Create a `.env` file with the following:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/tech_events"

# Redis (for BullMQ job queue)
REDIS_URL="redis://localhost:6379"

# Upstash Redis (for caching - optional)
UPSTASH_REDIS_REST_URL="your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Puppeteer (for Docker)
PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"
```

### Manual Setup

1. **Install dependencies**

```bash
npm install
```

2. **Set up database**

```bash
npx prisma generate
npx prisma db push
```

3. **Start the application**

```bash
# Terminal 1: Start Next.js app
npm run dev

# Terminal 2: Start BullMQ worker
npm run worker
```

4. **Build for production**

```bash
npm run build
npm start
```

<!-- TODO: Add architecture diagram or system overview screenshot -->
<!-- Example: <img src="docs/architecture.png" alt="System Architecture" /> -->

## Architecture

### Frontend

- **Next.js 15**: Full-stack framework with App Router
- **TypeScript**: Type-safe development
- **React Query**: Server state management
- **Tailwind CSS**: Utility-first styling

### Backend

- **BullMQ**: Job queue for asynchronous scraping
- **Redis**: Queue management and caching
- **Puppeteer**: Web scraping with stealth capabilities
- **Prisma**: Type-safe database ORM
- **PostgreSQL**: Database storage

## License

MIT
