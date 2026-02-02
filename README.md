# IntentWriter

A real-time collaborative writing platform with AI-powered intent alignment analysis. IntentWriter helps teams maintain alignment between written content and stated intentions through a dual-panel interface, hierarchical intent structures, and intelligent coverage tracking.

## Core Concept

IntentWriter addresses the challenge of **intent-driven collaborative writing**:
- Teams often have writing goals/intents but diverge during execution
- No clear mechanism to link written content back to stated intentions
- Difficult to track which intentions are covered, partially addressed, or missing

The solution provides:
- **Dual-panel interface**: Writing blocks (left) linked to intent blocks (right)
- **AI-powered alignment analysis**: Real-time feedback on coverage status
- **Hierarchical intent management**: Nested intent structures with parent-child relationships
- **Shared writing rules**: Collaborative rubric management
- **Real-time collaboration**: Conflict-free synchronization across users

## Features

### Dual-Panel Editor Interface

**Left Panel - Writing Editor**
- BlockNote-based rich text editor for each writing block
- Multiple independent writing blocks that can be created/edited/deleted
- Real-time collaboration via Yjs CRDT
- Visual highlighting showing alignment status with intent blocks
- Each writing block can be linked to a specific intent block

**Right Panel - Intent Panel**
- Hierarchical intent structure with unlimited nesting levels
- Indent/outdent operations to manage hierarchy
- Drag-and-drop reordering
- Collapse/expand tree nodes
- Visual coverage indicators:
  - `covered` - fully addressed in writing
  - `partial` - some aspects addressed
  - `misaligned` - addressed but incorrectly
  - `missing-skipped` - skipped when later intents have content
  - `missing-not-started` - not yet addressed
  - `extra` - AI-suggested intent for content not in outline

### AI-Powered Alignment Analysis

- **GPT-4o Integration** - Analyzes writing against intent structure
- **Detailed Output**:
  - Overall alignment score (0-100)
  - Per-intent coverage status
  - Writing segments mapped to specific intents
  - Identified covered/missing/extra aspects
  - Suggestions for improvement
  - Order mismatch detection
- **Suggested Intents** - AI proposes new intents for content not in the outline
- **Real-time Feedback** - Analysis updates as writing changes

### Hierarchical Intent Management

- Unlimited nesting with parent-child relationships
- Position tracking (level 0=root, 1=child, 2=grandchild, etc.)
- Intent tags for metadata/classifications
- Assignment system for team member responsibility
- Collapsible tree navigation

### Shared Writing Rules/Rubrics

- Create writing rules with description, rationale, and examples
- Track editing history with version tracing
- AAC&U Framework integration for academic writing rubrics:
  - Context & Purpose
  - Content Development
  - Genre Conventions
  - Sources & Evidence
  - Syntax & Mechanics
- Rubric upload and parsing

### Real-time Collaboration

- Online user tracking with presence indicators
- Conflict-free synchronization via Yjs CRDT
- WebSocket communication through PartyKit
- User identification with names and avatars
- Automatic backup to dual storage (PartyKit + Supabase)

### Document Management

- Create, view, and delete documents from dashboard
- Share document links with collaborators
- Track document ownership and collaboration access
- Sort by last updated

### Data Import/Export

- Markdown import to convert outline format into intent hierarchy
- Supports:
  - Markdown headings (# to ######)
  - Numbered lists (1. Item)
  - Bullet lists (* or - Item)
  - Indentation for hierarchy
  - Intent tags ([intent]: metadata)

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS |
| **Rich Text Editor** | BlockNote 0.41.1 with collaborative editing |
| **Real-time Sync** | PartyKit 0.0.115 (WebSocket) + Yjs 13.6.27 (CRDT) |
| **UI Components** | Radix UI primitives, Lucide Icons |
| **Drag & Drop** | dnd-kit |
| **Authentication & Database** | Supabase (PostgreSQL, Auth, Storage) |
| **AI Analysis** | OpenAI GPT-4o |
| **Markdown** | react-markdown, remark-gfm |

## Project Structure

```
IntentWriter/
├── app/
│   ├── page.tsx                 # Home page (login/register landing)
│   ├── layout.tsx               # Root layout
│   ├── globals.css              # Global styles
│   ├── auth/
│   │   ├── login/page.tsx       # Login page
│   │   ├── register/page.tsx    # Registration page
│   │   └── callback/route.ts    # OAuth callback handler
│   ├── dashboard/
│   │   ├── page.tsx             # Dashboard (server component)
│   │   └── DashboardClient.tsx  # Dashboard UI (client component)
│   ├── room/[id]/
│   │   ├── page.tsx             # Room page with auth check
│   │   └── Room.tsx             # Room wrapper with Suspense
│   └── api/
│       ├── check-alignment/route.ts     # AI alignment analysis
│       ├── backup-document/route.ts     # Backup to Supabase
│       ├── restore-document/route.ts    # Restore from backup
│       └── analyze-rubric/route.ts      # Rubric parsing
├── components/
│   ├── editor/
│   │   ├── CollaborativeEditor.tsx      # Main orchestrator (~900 lines)
│   │   ├── WritingEditor.tsx            # BlockNote editors & alignment UI (~1400 lines)
│   │   └── ImportMarkdownDialog.tsx     # Markdown import dialog
│   ├── intent/
│   │   ├── IntentPanel.tsx              # Intent hierarchy display (~1200 lines)
│   │   ├── SharedRulesPanel.tsx         # Shared writing rules management
│   │   └── hooks/
│   │       ├── useIntentHierarchy.ts    # Tree structure & navigation
│   │       ├── useIntentDragDrop.ts     # Drag-and-drop logic
│   │       ├── useIntentCoverage.ts     # Coverage status management
│   │       └── useIntentSuggestions.ts  # AI suggestion handling
│   ├── user/
│   │   └── UserAvatar.tsx               # User profile avatar
│   ├── common/
│   │   └── LinkifyWarningSuppress.tsx   # Warning suppression utility
│   └── ui/                              # Radix UI components
│       ├── button.tsx, input.tsx, card.tsx, dialog.tsx, etc.
├── lib/
│   ├── partykit.ts                      # PartyKit client hook (useRoom)
│   ├── aacuFramework.ts                 # AAC&U Writing rubrics framework
│   ├── markdownParser.ts                # Markdown to intent hierarchy parser
│   ├── utils.ts                         # Utility functions
│   └── supabase/
│       ├── client.ts                    # Client-side Supabase instance
│       ├── server.ts                    # Server-side Supabase instance
│       └── middleware.ts                # Auth middleware
├── party/
│   └── server.ts                        # PartyKit WebSocket server
├── supabase/
│   └── schema.sql                       # Database schema
├── middleware.ts                        # Next.js auth middleware
├── partykit.json                        # PartyKit configuration
└── package.json                         # Dependencies
```

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier available)
- PartyKit account (free tier available)
- OpenAI API key (for alignment analysis)

## Setup Instructions

### 1. Clone and Install

```bash
cd IntentWriter
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned
3. Go to **SQL Editor** in your Supabase dashboard
4. Copy the contents of `supabase/schema.sql` and execute it
5. Go to **Settings** → **API** and copy:
   - Project URL
   - `anon` public key

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# PartyKit (for local development)
NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx

# OpenAI (for alignment analysis)
OPENAI_API_KEY=sk-xxxxx
```

### 4. Run the Development Server

You need to run **both** Next.js and PartyKit servers:

**Option A: Run both simultaneously**
```bash
npm run dev:all
```

**Option B: Run in separate terminals**
```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: PartyKit
npm run partykit
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### Creating an Account

1. Navigate to the home page
2. Click "Register"
3. Fill in your name, email, and password
4. After registration, log in with your credentials

### Creating a Document

1. After logging in, you'll see the dashboard
2. Enter a document title in the "Create New Document" form
3. Click "Create"
4. You'll be redirected to the collaborative editor

### Using the Editor

**Writing Blocks (Left Panel)**
- Click "+ Add Writing Block" to create a new writing space
- Use the rich text editor to format your content
- Click "Link" to connect the writing block to an intent block
- Visual indicators show alignment status with linked intents

**Intent Blocks (Right Panel)**
- Click "+ Add Intent" to create a new intent
- Use Tab/Shift+Tab or indent buttons to create hierarchy
- Drag and drop to reorder intents
- Click the expand/collapse icons to navigate the tree
- Coverage status shows alignment with writing content

**AI Alignment Analysis**
- Click "Check Alignment" to trigger AI analysis
- View overall score and per-intent coverage status
- Review AI suggestions for additional intents
- Accept or reject suggested intents

**Shared Rules**
- Open the Rules panel to view/add writing rules
- Each rule includes description, rationale, and examples
- Rules are shared across all collaborators

**Collaboration**
- Share the room URL with collaborators
- All changes sync in real-time
- Online users are displayed in the header

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/check-alignment` | POST | AI-powered alignment analysis |
| `/api/backup-document` | POST | Save state to Supabase |
| `/api/restore-document` | POST | Restore from backup |
| `/api/analyze-rubric` | POST | Parse rubric text into rules |

## Deployment

### 1. Deploy PartyKit Server

```bash
npm run partykit:deploy
```

You'll get a URL like: `https://intent-writer.your-username.partykit.dev`

### 2. Deploy Next.js to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables in Vercel dashboard:
   ```
   NEXT_PUBLIC_PARTYKIT_HOST=intent-writer.your-username.partykit.dev
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
   OPENAI_API_KEY=sk-xxxxx
   ```
4. Deploy

**Important**: Do not include `https://` in `NEXT_PUBLIC_PARTYKIT_HOST`

## Troubleshooting

### "Cannot find module" errors
Run `npm install` again to ensure all dependencies are installed.

### Database errors
Make sure you've run the SQL schema in your Supabase dashboard.

### Real-time sync not working
1. Verify PartyKit server is running (`npm run partykit`)
2. Check `NEXT_PUBLIC_PARTYKIT_HOST` in `.env.local`
3. For production, ensure PartyKit is deployed

### WebSocket connection failed
- Local: Make sure PartyKit dev server is running on port 1999
- Production: Verify PartyKit host URL is correct (no `https://` prefix)

### Authentication not working
Check that your Supabase URL and anon key are correct.

### AI alignment not working
Verify your OpenAI API key is set in `.env.local` or Vercel environment variables.

## License

MIT License
