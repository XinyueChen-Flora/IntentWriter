# IntentWriter

A real-time collaborative writing platform with AI-powered intent alignment analysis. IntentWriter helps teams maintain alignment between written content and stated intentions through a dual-panel interface, hierarchical intent structures, and intelligent drift detection.

## Core Concept

IntentWriter addresses the challenge of **intent-driven collaborative writing**:
- Teams often have writing goals/intents but diverge during execution
- No clear mechanism to link written content back to stated intentions
- Difficult to track which intentions are covered, partially addressed, or missing

The solution provides:
- **Two-phase workflow**: Setup (outline, assign, relate) → Writing (draft with AI feedback)
- **Dual-panel interface**: Writing editor (left) linked to intent outline (right)
- **AI-powered drift detection**: Real-time coverage analysis with sentence-level mapping
- **Cross-section dependency tracking**: Bidirectional relationships with conflict detection
- **Real-time collaboration**: Conflict-free synchronization via Yjs CRDT

## Features

### Two-Phase Workflow

**Phase 1 — Setup**

A three-tab interface for preparing the writing structure before drafting begins:

1. **Outline Tab**: Create and organize a hierarchical intent structure
   - Add/edit/delete intent blocks with unlimited nesting
   - Indent/outdent (Tab/Shift+Tab) to manage hierarchy
   - Drag-and-drop reordering via dnd-kit
   - Collapse/expand tree nodes
   - Import from Markdown or unstructured text (AI-powered parsing)

2. **Assign Tab**: Assign sections to team members
   - Dropdown selector with collaborator list
   - Progress indicator showing assignment completion

3. **Relationships Tab**: Define dependencies between sections
   - AI-suggested dependencies via `/api/detect-dependencies`
   - Manual relationship creation with drag-to-connect UI
   - Relationship types: `depends-on`, `must-be-consistent`, `builds-upon`, `contrasts-with`, `supports`
   - Visual SVG lines with color-coded labels and conflict indicators
   - Side panel listing all relationships with confirm/edit/delete actions

Clicking **"Start Writing"** creates a baseline snapshot and transitions to Phase 2.

**Phase 2 — Writing**

Each root-level intent section gets its own TipTap collaborative editor:

- Rich text editing with bold, italic, lists, headings, blockquotes, code blocks
- Real-time collaboration via Yjs CRDT through PartyKit
- AI-powered drift detection per section
- In-editor visual feedback (sentence highlighting, inline widgets)

### AI-Powered Drift Detection

Triggered per section via the "Check Alignment" button:

- **Coverage analysis**: Each intent is classified as `covered`, `partial`, or `missing`
- **Sentence mapping**: Writing sentences are anchored to specific intents (with start/end text markers)
- **Dependency conflict detection**: Identifies contradictions between related sections
- **Cross-section impact assessment**: Shows how changes in one section affect dependent sections
- **Gap suggestions**: AI generates suggested content for missing/partial intents, with simulated insertion position

**In-Editor Visual Feedback** (via TipTap highlight plugin):
- Green highlight = sentence supports an intent (covered)
- Orange highlight = partial coverage
- Yellow highlight = orphan sentence (not mapped to any intent)
- Red highlight = dependency conflict
- Inline widgets: missing intent indicators, AI-suggested content badges, simulated writing previews

### Intent Outline Management

- Hierarchical structure with `parentId`, `level`, `position` tracking
- Change tracking: `added`, `proposed`, `modified`, `removed` statuses
- Proposal system: intents can be `pending` / `approved` / `rejected`
- Coverage icons in outline view reflecting drift detection results
- AI badge for intents with suggested content

### Diff & Impact Preview

- **Inline diff view**: Side-by-side comparison of current vs. simulated outline changes
- **Section impact cards**: Shows how proposed changes affect other sections
- **Impact levels**: `none`, `minor`, `significant`

### Real-time Collaboration

- WebSocket communication through PartyKit
- Yjs CRDT for conflict-free text synchronization
- Online user tracking with presence indicators and avatars
- User identification with names and colors
- Automatic backup to Supabase (triggered after inactivity)

### Document & Team Management

- Create, view, and delete documents from dashboard
- Invite collaborators by email (via Resend)
- Accept invitations via token-based invite links (`/invite/[token]`)
- Manage collaborators in share dialog (add/remove)
- Track document ownership and access control

### Data Import

- Markdown import to convert outline format into intent hierarchy
- AI-powered parsing of unstructured text into structured outline via `/api/parse-outline`
- Supports: Markdown headings, numbered/bullet lists, indentation

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS |
| **Rich Text Editor** | TipTap 3.20 with y-prosemirror for collaborative editing |
| **Real-time Sync** | PartyKit 0.0.115 (WebSocket) + Yjs 13.6.27 (CRDT) |
| **UI Components** | Radix UI primitives, Lucide Icons |
| **Drag & Drop** | dnd-kit |
| **Auth & Database** | Supabase (PostgreSQL + Auth) |
| **AI Analysis** | OpenAI GPT-4o |
| **Email** | Resend |
| **Markdown** | react-markdown, remark-gfm |

## Project Structure

```
IntentWriter/
├── app/
│   ├── page.tsx                    # Landing page (login/register)
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles
│   ├── auth/
│   │   ├── login/page.tsx          # Login page
│   │   ├── register/page.tsx       # Registration page
│   │   └── callback/route.ts      # OAuth callback handler
│   ├── dashboard/
│   │   └── page.tsx                # Dashboard (document list)
│   ├── invite/[token]/
│   │   └── page.tsx                # Invitation acceptance page
│   ├── room/[id]/
│   │   └── page.tsx                # Collaborative room
│   └── api/
│       ├── check-drift/            # AI drift detection & coverage analysis
│       ├── detect-dependencies/    # AI-suggested section relationships
│       ├── assess-impact/          # Cross-section impact evaluation
│       ├── generate-gap-suggestion/# AI content suggestions for gaps
│       ├── analyze-removal-impact/ # Impact analysis for intent removal
│       ├── parse-outline/          # AI text → structured outline
│       ├── create-baseline/        # Snapshot intents at phase transition
│       ├── backup-document/        # Save state to Supabase
│       ├── restore-document/       # Restore from backup
│       ├── document-members/       # List collaborators
│       ├── invite/                 # Send invitation email
│       │   └── accept/             # Accept invitation
│       ├── remove-collaborator/    # Remove collaborator access
│       └── delete-document/        # Delete document
├── components/
│   ├── room/
│   │   └── RoomShell.tsx           # Main layout (header, phase indicator, panels)
│   │   └── hooks/
│   │       ├── useBackup.ts        # Auto-backup after inactivity
│   │       └── useDocumentMembers.ts
│   ├── intent/
│   │   ├── IntentPanel.tsx         # Intent panel orchestrator
│   │   ├── IntentPanelContext.tsx   # Shared state context
│   │   ├── IntentBlockCard.tsx     # Single intent block renderer
│   │   ├── ImportMarkdownDialog.tsx
│   │   ├── blocks/
│   │   │   ├── RootIntentBlock.tsx  # Section with writing editor
│   │   │   └── ChildIntentBlock.tsx # Subsection display
│   │   ├── hooks/
│   │   │   ├── useIntentHierarchy.ts
│   │   │   ├── useIntentDragDrop.ts
│   │   │   ├── useIntentBlockOperations.ts
│   │   │   ├── useDriftDetection.ts
│   │   │   ├── useImpactAssessment.ts
│   │   │   └── useDependencyLinks.ts
│   │   ├── diff/                   # Diff views & impact cards
│   │   ├── alignment/              # Alignment summary & icons
│   │   ├── relationship/           # Dependency creator & side panel
│   │   ├── onboarding/             # Setup guides
│   │   ├── setup/                  # Setup tab bars & instructions
│   │   └── ui/                     # Intent-specific UI components
│   ├── writing/
│   │   ├── TipTapEditor.tsx        # Collaborative TipTap editor
│   │   ├── plugins/
│   │   │   └── highlightPlugin.ts  # Sentence highlighting & decorations
│   │   ├── widgets/                # Inline editor widgets
│   │   └── utils/                  # Text range finder, exporters
│   ├── share/
│   │   └── ShareDialog.tsx         # Collaborator management dialog
│   ├── user/
│   │   └── UserAvatar.tsx          # User avatar with fallback
│   ├── common/
│   │   └── Logo.tsx
│   └── ui/                         # Radix UI primitives
├── lib/
│   ├── partykit.ts                 # useRoom hook & RoomState types
│   ├── types.ts                    # Core data models
│   ├── relationship-types.ts       # Dependency type definitions
│   ├── markdownParser.ts           # Markdown → intent hierarchy parser
│   ├── importIntents.ts            # Intent import utilities
│   ├── getUserColor.ts             # User color assignment
│   ├── email.ts                    # Resend email client
│   ├── utils.ts                    # General utilities
│   ├── api/
│   │   └── middleware.ts           # withErrorHandler, requireAuth, etc.
│   └── supabase/
│       ├── client.ts               # Browser Supabase client
│       ├── server.ts               # Server Supabase client + admin
│       └── middleware.ts           # Auth session middleware
├── party/
│   └── server.ts                   # PartyKit WebSocket server
├── supabase/
│   └── schema.sql                  # Database schema
├── middleware.ts                   # Next.js auth middleware
├── partykit.json                   # PartyKit configuration
└── package.json
```

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier available)
- PartyKit account (free tier available)
- OpenAI API key (for AI analysis)
- Resend API key (for email invitations, optional)

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
   - `service_role` secret key

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# PartyKit (for local development)
NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# OpenAI (for AI analysis)
OPENAI_API_KEY=sk-xxxxx

# Resend (for email invitations, optional)
RESEND_API_KEY=re_xxxxx
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

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/check-drift` | POST | AI-powered drift detection & coverage analysis |
| `/api/detect-dependencies` | POST | AI-suggested section relationships |
| `/api/assess-impact` | POST | Cross-section impact evaluation |
| `/api/generate-gap-suggestion` | POST | AI content suggestions for missing intents |
| `/api/analyze-removal-impact` | POST | Impact analysis for intent removal |
| `/api/parse-outline` | POST | AI text → structured outline |
| `/api/create-baseline` | POST | Save intent structure at phase transition |
| `/api/backup-document` | POST | Backup full state to Supabase |
| `/api/restore-document` | POST | Restore from latest backup |
| `/api/document-members` | GET | List document collaborators |
| `/api/invite` | POST | Send invitation email |
| `/api/invite/accept` | POST | Accept invitation token |
| `/api/remove-collaborator` | DELETE | Remove collaborator access |
| `/api/delete-document` | DELETE | Delete document |

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
   SUPABASE_SERVICE_ROLE_KEY=xxxxx
   OPENAI_API_KEY=sk-xxxxx
   RESEND_API_KEY=re_xxxxx
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

### AI analysis not working
Verify your OpenAI API key is set in `.env.local` or Vercel environment variables.

## License

MIT License
