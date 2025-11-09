# Intent Writer

A real-time collaborative writing platform with intent alignment awareness. Features dual-panel editing with writing blocks on the left and intent blocks on the right, enabling structured collaborative writing with explicit intent tracking.

## Features

- **Real-time Collaboration**: Multiple users can edit simultaneously with instant synchronization
- **Dual-Panel Interface**:
  - Left panel: Writing editor with rich text blocks
  - Right panel: Intent panel for tracking writing goals and objectives
- **Block Linking**: Link writing blocks to intent blocks for better alignment
- **User Authentication**: Secure registration and login with Supabase
- **Document Management**: Create, view, and delete collaborative documents
- **Conflict-free Sync**: Powered by PartyKit + Yjs CRDT technology
- **AI-Powered Alignment**: OpenAI GPT-4 analyzes writing-intent alignment

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Real-time Sync**: PartyKit (WebSocket) + Yjs (CRDT for rich text)
- **Rich Text Editor**: BlockNote with collaborative editing
- **Authentication & Database**: Supabase
- **AI Analysis**: OpenAI GPT-4o-mini
- **Deployment**: Vercel (Next.js) + PartyKit Cloud

## Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier available)
- A PartyKit account (free tier available)
- OpenAI API key (optional, for alignment analysis)

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

# OpenAI (optional - for alignment analysis)
OPENAI_API_KEY=sk-xxxxx
```

Replace the `xxxxx` values with your actual keys from step 2.

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
4. You'll be automatically redirected to the collaborative editor

### Using the Editor

**Writing Blocks (Left Panel)**:
- Click "+ Add Writing Block" to create a new writing space
- Type your content in the textarea
- Click "🔗 Link" to connect the writing block to an intent block
- Click "Delete" to remove a block

**Intent Blocks (Right Panel)**:
- Click "+ Add Intent" to create a new intent block
- Describe your writing goal or objective
- See which writing blocks are linked to each intent
- Linked blocks show the number of connections

**Collaboration**:
- Share the room URL with collaborators
- All changes sync in real-time
- Each user sees updates instantly

### Linking Blocks

1. Create both a writing block and an intent block
2. In the writing block, click "🔗 Link"
3. Select the intent block from the dropdown
4. The blocks are now connected
5. The intent block shows all linked writing blocks

## Project Structure

```
IntentWriter/
├── app/
│   ├── auth/
│   │   ├── login/         # Login page
│   │   └── register/      # Registration page
│   ├── dashboard/         # Document list and management
│   ├── room/[id]/         # Collaborative editing room
│   ├── api/
│   │   ├── check-alignment/    # AI alignment analysis
│   │   ├── backup-document/    # Supabase backup
│   │   └── restore-document/   # Restore from backup
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/
│   ├── CollaborativeEditor.tsx  # Main editor orchestrator
│   ├── WritingEditor.tsx        # Left panel: BlockNote editors
│   ├── IntentPanel.tsx          # Right panel: intent hierarchy
│   └── SharedRulesPanel.tsx     # Shared writing rules
├── party/
│   └── server.ts          # PartyKit WebSocket server
├── lib/
│   ├── partykit.ts        # PartyKit client hooks
│   ├── markdownParser.ts  # Markdown import utility
│   └── supabase/          # Supabase client utilities
├── supabase/
│   ├── schema.sql         # Database schema
│   └── migrations/        # Database migrations
├── partykit.json          # PartyKit configuration
└── middleware.ts          # Auth middleware
```

## Deployment

### 1. Deploy PartyKit Server

First, deploy your PartyKit server:

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
4. Deploy!

### Important Notes

- **Do not** include `https://` in `NEXT_PUBLIC_PARTYKIT_HOST`
- PartyKit handles WebSocket connections and data persistence
- Supabase provides backup storage and authentication
- See `DEPLOYMENT.md` for detailed deployment guide

## Key Features Implemented

- ✅ **Hierarchical Intent Structure**: Nested intents with indent/outdent controls
- ✅ **AI Alignment Analysis**: GPT-4 analyzes writing-intent alignment in real-time
- ✅ **Markdown Import**: Bulk import intent structures from markdown
- ✅ **Shared Writing Rules**: Collaborative rule management with version history
- ✅ **Assignment System**: Assign intents to specific team members
- ✅ **Auto-backup**: Dual storage (PartyKit + Supabase) for reliability

## Future Enhancements

- **Export**: PDF, Word, Markdown export options
- **Version History**: Browse and restore previous document versions
- **Comments & Mentions**: In-editor collaboration tools
- **Intent Templates**: Pre-built intent structures for common writing tasks

## Troubleshooting

### "Cannot find module" errors
Run `npm install` again to ensure all dependencies are installed.

### Database errors
Make sure you've run the SQL schema and migrations in your Supabase dashboard.

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

## Contributing

This is an open-source project. Feel free to submit issues and enhancement requests!

## License

MIT License
