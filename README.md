# KitchenReady

[![CI](https://github.com/sstech02/KitchenReady/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sstech02/KitchenReady/actions/workflows/ci.yml)

You arrive for a kitchen shift with a clipboard full of half-finished prep notes, scattered handover details, and a scramble to figure out what is done, what still needs attention, and what should happen next. KitchenReady was built to replace that friction with a single place for prep tracking, recipe scaling, shift handovers, and team coordination.

Instead of digging through paper lists and matching recipes by memory, KitchenReady helps restaurants keep prep organized, hand off shifts clearly, scale recipes accurately, and manage who can do what across each dashboard.

Live Link: https://kitchen-ready.vercel.app/

## Screenshots


## Features

### 🔐 Authentication
- Email/password login and signup
- Google OAuth integration
- Password reset functionality
- Multi-dashboard access with role-based permissions

### 📋 Prep Item Management
- Track prep items with status: To-Do, In Progress, Done, Discarded
- Quantity tracking (on-hand, par-level, target)
- Priority assignment
- Visual progress bar showing completion status
- Real-time status updates

### 📐 Recipe Scaler
- View all recipes in an interactive list
- Drag-to-reorder recipes
- Input custom yield amounts
- Display scaled ingredient quantities
- Auto-generate guide and video search links
- Admin-managed recipe guide and video URLs

### 📞 Shift Handover
- Record handover notes between shifts
- Business date selection
- Shift type tracking (AM/PM/Overnight)
- Capture low-stock items and blockers
- View handover history with filtering
- Digital sign-off for accountability

### 👥 Team Management
- Create and manage multiple dashboards (teams)
- Invite team members via email
- Assign roles: Viewer, Operator, Lead, Admin
- Role-based feature access control
- Team member removal and role updates

### 🛠️ Admin Panel
- **Prep Items**: Add, edit, delete prep items; manage quantities and priorities
- **Recipe Links**: Manage guide and video URLs for all recipes
- Admin-only dashboard access

### 🎨 User Experience
- Responsive design (mobile-first, 375px+)
- Dark mode support
- Status-based color coding
- Glassmorphism UI design
- Smooth animations and transitions
- Accessible form controls

### ✅ Quality Assurance
- 15+ Jest unit tests
- TypeScript strict type checking
- GitHub Actions CI/CD pipeline
- Production build optimization (308ms)

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Development

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

This command starts both the Vite frontend (port 5174) and the Express API server (port 4000) together.

**Note**: If you sign in with a new email that has no dashboard membership, the API automatically enrolls you in the default demo dashboard so you can immediately start working with prep items and recipes.

3. View the app:

Open [http://localhost:5174](http://localhost:5174) in your browser.

### Production Build

```bash
npm run build
```

Outputs an optimized production bundle to `dist/`.

### Testing

Run the Jest test suite:

```bash
npm test -- --runInBand --watchAll=false
```

Tests include:
- Recipe scaling calculations
- Ingredient rounding and clamping
- Component rendering

## Project Structure

```
src/
  components/          # React components
    AdminPrepPanel.tsx           # Prep item management
    AdminRecipePanel.tsx         # Recipe link management
    DashboardMembersPanel.tsx    # Team member management
    HandoverHistory.tsx          # Handover record viewing
    PrepItem.tsx                 # Individual prep item display
    RecipeDetailView.tsx         # Recipe scaling interface
    RecipeListView.tsx           # Recipe list with reordering
    ShiftHandoverForm.tsx        # Handover note submission
  models/              # TypeScript interfaces
  services/            # API & Firebase integration
  store/               # Zustand state management
  utils/               # Utility functions (recipe scaler)
  App.tsx              # Main application component
  App.css              # Responsive styling

api/
  server.js            # Express REST API
  data.js              # Sample data
  *.json               # Persistent JSON stores
```

## Architecture

### Frontend Stack
- **React 19.2** with TypeScript 5.x
- **Vite 8.0** for fast development & optimized builds
- **Zustand** for global state (prep items)
- **Firebase** for authentication
- **CSS Grid/Flexbox** for responsive layouts
- **Jest 30.4** for unit testing

### Backend Stack
- **Express 5.2** REST API
- **JSON file persistence** (recipes, prep items, handovers, dashboards)
- **Middleware**: User authentication, dashboard context, role authorization
- **Smart recipe matching**: Auto-assigns recipes to prep items via token-based scoring

## Environment Variables

Required Firebase configuration (in `.env`):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## API Endpoints

All endpoints require `x-user-email` and `x-dashboard-id` headers.

- `GET /api/prep-items` - List prep items
- `POST /api/prep-items` - Create prep item
- `PUT /api/prep-items/:id` - Update prep item
- `GET /api/recipes` - List recipes
- `POST /api/recipes` - Create recipe
- `PUT /api/recipes/:id` - Update recipe (admin)
- `DELETE /api/recipes/:id` - Delete recipe (admin)
- `GET /api/handovers` - List shift handovers
- `POST /api/handovers` - Record handover
- `GET /api/dashboards` - List accessible dashboards
- `POST /api/dashboards` - Create dashboard (admin)
- `GET /api/admin-accounts` - List dashboard members (admin)
- `POST /api/admin-accounts` - Invite member (admin)
- `PUT /api/admin-accounts/:id` - Update member role (admin)
- `DELETE /api/admin-accounts/:id` - Remove member (admin)

## Deployment

For comprehensive deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Supported platforms:
- Railway
- Render
- Vercel
- Docker

## Requirements Verification

All 12+ application requirements have been verified complete. See [REQUIREMENTS_CHECKLIST.md](./REQUIREMENTS_CHECKLIST.md) for detailed evidence.

## License

MIT
