import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoIcon } from "@/components/common/Logo";

function OutlineMockup() {
  return (
    <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
      <div className="h-8 bg-muted/50 flex items-center px-3 border-b">
        <span className="text-[10px] text-muted-foreground font-medium">Outline Panel</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="text-xs border-l-2 border-emerald-500 bg-emerald-50 pl-2.5 py-2 rounded-r">
          <span className="font-medium text-emerald-800">1. Introduction</span>
          <span className="text-emerald-600 block text-[10px] mt-0.5">Summarize problem context</span>
        </div>
        <div className="text-xs border-l-2 border-primary/60 bg-primary/5 pl-2.5 py-2 rounded-r">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">2. User Needs</span>
            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Updated</span>
          </div>
          <span className="text-muted-foreground block text-[10px] mt-0.5 line-through">Compare three approaches</span>
          <span className="text-foreground block text-[10px]">Argue for modular approach</span>
        </div>
        <div className="text-xs border-l-2 border-border pl-2.5 py-2 rounded-r bg-muted/30">
          <span className="font-medium text-muted-foreground">3. Breakpoints</span>
          <span className="text-muted-foreground/60 block text-[10px] mt-0.5">Waiting for section 2</span>
        </div>
      </div>
    </div>
  );
}

function DriftMockup() {
  return (
    <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
      <div className="h-8 bg-muted/50 flex items-center px-3 border-b">
        <span className="text-[10px] text-muted-foreground font-medium">Writing View</span>
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
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 flex gap-2 items-start">
          <span className="text-amber-500 text-sm leading-none mt-0.5">!</span>
          <div>
            <span className="text-[10px] font-semibold text-amber-800 block">Drift detected</span>
            <span className="text-[10px] text-amber-700">This section now advocates for one approach instead of comparing all three.</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="h-2 bg-muted/50 rounded w-full" />
          <div className="h-2 bg-muted/50 rounded w-9/12" />
        </div>
      </div>
    </div>
  );
}

function SimulationMockup() {
  return (
    <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
      <div className="h-8 bg-muted/50 flex items-center px-3 border-b">
        <span className="text-[10px] text-muted-foreground font-medium">Impact Preview</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
          <span className="text-[10px] font-semibold text-primary block">Your change</span>
          <span className="text-[10px] text-foreground">Section 2: Focus on modular approach only</span>
        </div>
        <div className="flex items-center justify-center">
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="text-muted-foreground/40">
            <path d="M8 0v16M3 12l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
            <span className="text-[10px] font-semibold text-red-700 block">Section 1 affected</span>
            <span className="text-[10px] text-red-600">Comparison framing no longer needed — intro must set up advocacy instead.</span>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
            <span className="text-[10px] font-semibold text-red-700 block">Section 3 affected</span>
            <span className="text-[10px] text-red-600">Implementation plan should focus exclusively on modular deployment.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    title: "Living Outline",
    description:
      "Your outline evolves with the writing. When someone changes what a section argues, the outline updates to match — not the other way around.",
    mockup: <OutlineMockup />,
  },
  {
    title: "Drift Detection",
    description:
      "Not all edits are equal. The system tells apart routine rewording from changes that reshape what a section is supposed to say, and flags what matters.",
    mockup: <DriftMockup />,
  },
  {
    title: "Impact Simulation",
    description:
      "Before you commit a change, see how it ripples across the document. AI simulates downstream consequences so the team can decide together.",
    mockup: <SimulationMockup />,
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
            <span className="text-primary font-bold tracking-tight text-xl" style={{ fontFamily: 'var(--font-brand)' }}>IntentWriter</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dev">Developer</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full px-5">
              <Link href="/auth/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#FEF9F3] pt-16 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-5xl sm:text-6xl tracking-tight leading-[1.1]" style={{ fontFamily: 'var(--font-display)' }}>
              A new way to
              <br />
              write together.
            </h1>
            <p className="text-muted-foreground leading-relaxed max-w-lg text-base">
              Teams align on an outline, then drift apart as they write.
              IntentWriter keeps the outline alive — tracking when edits
              reshape shared commitments and showing what that means
              for the rest of the document.
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

          {/* Hero mockup */}
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
              </div>
            </div>
            <div className="grid grid-cols-5">
              <div className="col-span-2 p-3 space-y-2 border-r bg-muted/20">
                <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Outline</div>
                <div className="space-y-1.5">
                  <div className="text-[10px] border-l-2 border-emerald-500 bg-emerald-50 pl-2 py-1.5 rounded-r font-medium text-emerald-800">Introduction</div>
                  <div className="text-[10px] border-l-2 border-amber-500 bg-amber-50 pl-2 py-1.5 rounded-r font-medium text-amber-800">User Needs</div>
                  <div className="text-[10px] border-l-2 border-border pl-2 py-1.5 rounded-r bg-muted/30 text-muted-foreground">Breakpoints</div>
                </div>
              </div>
              <div className="col-span-3 p-3 space-y-2">
                <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Writing</div>
                <div className="space-y-1">
                  <div className="h-1.5 bg-muted rounded w-full" />
                  <div className="h-1.5 bg-muted rounded w-4/5" />
                  <div className="h-1.5 bg-muted rounded w-11/12" />
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 bg-amber-200/60 rounded w-full" />
                  <div className="h-1.5 bg-amber-200/60 rounded w-9/12" />
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 bg-muted/40 rounded w-full" />
                  <div className="h-1.5 bg-muted/40 rounded w-7/12" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
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

      {/* Footer */}
      <footer className="border-t py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <LogoIcon size={18} />
            <span className="text-primary font-bold" style={{ fontFamily: 'var(--font-brand)' }}>IntentWriter</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
