import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoIcon } from "@/components/common/Logo";

function CoordinationSpaceMockup() {
  return (
    <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
      <div className="h-8 bg-muted/50 flex items-center px-3 border-b">
        <span className="text-[10px] text-muted-foreground font-medium">Coordination Space</span>
      </div>
      <div className="grid grid-cols-2 divide-x">
        {/* BNA side */}
        <div className="p-3 space-y-2 bg-blue-50/30">
          <div className="text-[9px] font-semibold text-blue-600 uppercase tracking-widest">BNA — Shared Intent</div>
          <div className="space-y-1.5">
            <div className="text-[10px] border-l-2 border-blue-400 bg-blue-50 pl-2 py-1.5 rounded-r">
              <span className="font-medium text-blue-800">§1 Introduction</span>
              <span className="text-blue-500 text-[9px] ml-1">— Alice</span>
            </div>
            <div className="ml-3 border-l border-dashed border-blue-300 pl-2 py-0.5">
              <span className="text-[8px] text-blue-400">depends-on ↓</span>
            </div>
            <div className="text-[10px] border-l-2 border-blue-400 bg-blue-50 pl-2 py-1.5 rounded-r">
              <span className="font-medium text-blue-800">§2 Method</span>
              <span className="text-blue-500 text-[9px] ml-1">— Bob</span>
            </div>
            <div className="ml-3 border-l border-dashed border-blue-300 pl-2 py-0.5">
              <span className="text-[8px] text-blue-400">must-be-consistent ↓</span>
            </div>
            <div className="text-[10px] border-l-2 border-blue-400 bg-blue-50 pl-2 py-1.5 rounded-r">
              <span className="font-medium text-blue-800">§3 Evaluation</span>
              <span className="text-blue-500 text-[9px] ml-1">— Carol</span>
            </div>
          </div>
        </div>
        {/* Writing side */}
        <div className="p-3 space-y-2 bg-amber-50/20">
          <div className="text-[9px] font-semibold text-amber-600 uppercase tracking-widest">Writing — Individual</div>
          <div className="space-y-1.5">
            <div className="space-y-0.5 pl-2 border-l-2 border-emerald-300">
              <div className="h-1.5 bg-emerald-100 rounded w-full" />
              <div className="h-1.5 bg-emerald-100 rounded w-4/5" />
            </div>
            <div className="space-y-0.5 pl-2 border-l-2 border-amber-400">
              <div className="h-1.5 bg-amber-100 rounded w-full" />
              <div className="h-1.5 bg-amber-200 rounded w-9/12" />
              <div className="text-[8px] text-amber-600 mt-0.5">↑ drifted from intent</div>
            </div>
            <div className="space-y-0.5 pl-2 border-l-2 border-gray-200">
              <div className="h-1.5 bg-gray-100 rounded w-full" />
              <div className="h-1.5 bg-gray-100 rounded w-7/12" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SenseMockup() {
  return (
    <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
      <div className="h-8 bg-muted/50 flex items-center px-3 border-b">
        <span className="text-[10px] text-muted-foreground font-medium">Sense</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="space-y-1">
          <div className="h-2 bg-muted rounded w-full" />
          <div className="h-2 bg-muted rounded w-11/12" />
          <div className="h-2 bg-muted rounded w-4/5" />
        </div>
        <div className="space-y-1 border-l-2 border-amber-400 pl-2">
          <div className="h-2 bg-amber-100 rounded w-full" />
          <div className="h-2 bg-amber-100 rounded w-10/12" />
          <div className="h-2 bg-amber-100 rounded w-8/12" />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-amber-500 text-sm leading-none">⊘</span>
            <span className="text-[10px] font-semibold text-amber-800">Writing ↔ Intent: drifted</span>
          </div>
          <span className="text-[10px] text-amber-700 block">Your section now advocates for one approach instead of comparing alternatives.</span>
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-red-400 text-sm leading-none">⟁</span>
            <span className="text-[10px] text-red-700">Impact chain: §1 Introduction and §3 Evaluation may be affected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GateMockup() {
  return (
    <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
      <div className="h-8 bg-muted/50 flex items-center px-3 border-b">
        <span className="text-[10px] text-muted-foreground font-medium">Gate</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
          <span className="text-[10px] font-semibold text-primary block">Your change</span>
          <span className="text-[10px] text-foreground">§2 Method: Focus on modular approach only</span>
        </div>
        <div className="space-y-1.5 text-[10px]">
          <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30 rounded">
            <span className="text-muted-foreground">Impact severity</span>
            <span className="font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[9px]">directional</span>
          </div>
          <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30 rounded">
            <span className="text-muted-foreground">Cross-section scope</span>
            <span className="font-medium text-red-700 bg-red-50 px-1.5 py-0.5 rounded text-[9px]">2 sections affected</span>
          </div>
          <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30 rounded">
            <span className="text-muted-foreground">Team rule</span>
            <span className="font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px]">no violation</span>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 text-center">
          <span className="text-[10px] font-semibold text-red-700">⬆ Crosses boundary — escalate to team</span>
        </div>
      </div>
    </div>
  );
}

function NegotiateMockup() {
  return (
    <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
      <div className="h-8 bg-muted/50 flex items-center px-3 border-b">
        <span className="text-[10px] text-muted-foreground font-medium">Negotiate</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-primary">Proposal from Bob</span>
            <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">voting</span>
          </div>
          <span className="text-[10px] text-foreground block mt-1">Change §2 direction: compare → advocate modular</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-emerald-50 rounded border border-emerald-100">
            <div className="w-4 h-4 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-[8px]">A</div>
            <span className="text-[10px] text-emerald-700 font-medium">Alice approved</span>
            <span className="text-[9px] text-emerald-600 ml-auto">— &quot;Makes sense for our argument&quot;</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 rounded border border-amber-100">
            <div className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[8px]">C</div>
            <span className="text-[10px] text-amber-700 font-medium">Carol requested change</span>
            <span className="text-[9px] text-amber-600 ml-auto">— &quot;Evaluation needs updating too&quot;</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30 rounded">
          <span className="text-[10px] text-muted-foreground">Resolution</span>
          <div className="flex items-center gap-1">
            <div className="w-8 h-1.5 bg-emerald-400 rounded-l" />
            <div className="w-4 h-1.5 bg-amber-400" />
            <div className="w-4 h-1.5 bg-muted rounded-r" />
            <span className="text-[9px] text-muted-foreground ml-1">1/2 approved</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    title: "Coordination Space",
    description:
      "GroundingKit separates shared understanding from the document. A boundary negotiating artifact (BNA) externalizes team consensus — intent, dependencies, ownership — while individual writing happens in its own space. The relationships between them become explicit and trackable.",
    mockup: <CoordinationSpaceMockup />,
  },
  {
    title: "Sense",
    description:
      "Writers sense how their work relates to team consensus — whether writing aligns with intent, how changes propagate through dependency chains, and what impact they have on others' sections. Sensing happens in personal space, before any team involvement.",
    mockup: <SenseMockup />,
  },
  {
    title: "Gate",
    description:
      "When a change crosses the team's configured boundary — by severity, cross-section scope, or rule violation — the gate routes it to team negotiation. Teams define their own conditions for when individual work should involve the group.",
    mockup: <GateMockup />,
  },
  {
    title: "Negotiate",
    description:
      "The team processes the change together: framing the proposal, deliberating among affected parties, and reaching resolution. Different teams configure different paths — from quick informs to formal votes. The resolved change updates the BNA, triggering new sensing.",
    mockup: <NegotiateMockup />,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="bg-[#FEF9F3]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoIcon size={32} />
            <span className="text-primary font-bold tracking-tight text-xl" style={{ fontFamily: 'var(--font-brand)' }}>GroundingKit</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full px-5">
              <Link href="/dev">For Developers</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full px-5">
              <Link href="/auth/register">For Teams</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#FEF9F3] pt-16 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-5xl sm:text-6xl tracking-tight leading-[1.1]" style={{ fontFamily: 'var(--font-display)' }}>
              Coordination
              <br />
              infrastructure for
              <br />
              writing teams.
            </h1>
            <p className="text-muted-foreground leading-relaxed max-w-lg text-base">
              Writing teams need more than shared documents.
              GroundingKit provides a coordination space that separates
              shared intent from individual writing, a configurable pipeline
              (Sense → Gate → Negotiate) that governs how teams coordinate,
              and an open platform where new capabilities can be contributed.
            </p>
            <div className="pt-2">
              <Button asChild size="lg" className="rounded-full px-8 text-base">
                <Link href="/auth/register">
                  Get Started
                  <span className="ml-1">&raquo;</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Hero mockup — pipeline overview */}
          <div className="border rounded-2xl overflow-hidden shadow-md bg-white">
            <div className="h-9 bg-muted/50 flex items-center justify-between px-4 border-b">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-black/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-black/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-black/10" />
                </div>
                <span className="text-[10px] text-muted-foreground ml-1">Research Report</span>
              </div>
              <div className="flex gap-1">
                <div className="w-5 h-5 rounded-full bg-blue-100 border border-blue-200" />
                <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-200 -ml-1.5" />
                <div className="w-5 h-5 rounded-full bg-amber-100 border border-amber-200 -ml-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-5">
              {/* BNA panel */}
              <div className="col-span-2 p-3 space-y-2 border-r bg-blue-50/20">
                <div className="text-[9px] font-semibold text-blue-600 uppercase tracking-widest">Shared Intent (BNA)</div>
                <div className="space-y-1.5">
                  <div className="text-[10px] border-l-2 border-emerald-400 bg-emerald-50 pl-2 py-1.5 rounded-r font-medium text-emerald-800">Introduction</div>
                  <div className="text-[10px] border-l-2 border-amber-400 bg-amber-50 pl-2 py-1.5 rounded-r font-medium text-amber-800 flex items-center justify-between">
                    <span>Method</span>
                    <span className="text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded">⬆ escalated</span>
                  </div>
                  <div className="text-[10px] border-l-2 border-border pl-2 py-1.5 rounded-r bg-muted/30 text-muted-foreground">Evaluation</div>
                </div>
              </div>
              {/* Writing panel */}
              <div className="col-span-3 p-3 space-y-2">
                <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Writing</div>
                <div className="space-y-1">
                  <div className="h-1.5 bg-emerald-100 rounded w-full" />
                  <div className="h-1.5 bg-emerald-100 rounded w-4/5" />
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 bg-amber-200/60 rounded w-full" />
                  <div className="h-1.5 bg-amber-200/60 rounded w-9/12" />
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 bg-muted/40 rounded w-full" />
                  <div className="h-1.5 bg-muted/40 rounded w-7/12" />
                </div>
                {/* Pipeline indicator */}
                <div className="flex items-center gap-1 pt-1">
                  <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Sense</span>
                  <span className="text-[8px] text-muted-foreground">→</span>
                  <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Gate</span>
                  <span className="text-[8px] text-muted-foreground">→</span>
                  <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">Negotiate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features — pipeline steps */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-5xl mx-auto space-y-24">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`grid md:grid-cols-2 gap-12 items-center ${
                i % 2 === 1 ? "md:[direction:rtl] md:[&>*]:direction-ltr" : ""
              }`}
            >
              <div className="space-y-4">
                <span className="text-sm font-mono text-primary font-semibold">
                  0{i + 1}
                </span>
                <h3 className="text-3xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-[16px]">
                  {f.description}
                </p>
              </div>
              <div>{f.mockup}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Open Platform section */}
      <section className="bg-muted/30 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Open Platform</h2>
          <p className="text-muted-foreground leading-relaxed text-[16px]">
            GroundingKit defines a protocol at each pipeline step through which developers
            register new capabilities — what to sense, how to gate, what negotiation paths to offer.
            Built-in and community-contributed capabilities use the same protocol.
            Teams select from an ever-growing pool to configure their own coordination pipeline.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <LogoIcon size={18} />
            <span className="text-primary font-bold" style={{ fontFamily: 'var(--font-brand)' }}>GroundingKit</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
