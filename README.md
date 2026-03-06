# Orion System

A helpdesk and ticketing platform built for modern teams. Orion System streamlines support workflows, ticket management, and team collaboration in a clean, responsive interface.

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **UI:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Deployment:** Vercel

## Features

- Ticket creation and management
- Role-based access control
- Real-time updates
- Dashboard with analytics
- Responsive design

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```sh
git clone https://github.com/bysamdev/orion-system-main-alpha.git
cd orion-system-main-alpha
npm install
npm run dev
```

### Environment Variables

Create a `.env` file at the root with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## License

MIT
