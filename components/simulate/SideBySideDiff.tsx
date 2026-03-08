"use client";

// Side-by-side diff: left shows removed text highlighted, right shows added text highlighted.
// Shared/unchanged text appears normally on both sides.

type DiffSegment = {
  type: 'equal' | 'added' | 'removed';
  text: string;
};

function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) || [];
}

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

function computeDiff(oldText: string, newText: string): DiffSegment[] {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);
  const dp = lcs(oldTokens, newTokens);

  const ops: Array<{ type: 'equal' | 'added' | 'removed'; token: string }> = [];
  let i = oldTokens.length;
  let j = newTokens.length;

  while (i > 0 && j > 0) {
    if (oldTokens[i - 1] === newTokens[j - 1]) {
      ops.push({ type: 'equal', token: oldTokens[i - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: 'removed', token: oldTokens[i - 1] });
      i--;
    } else {
      ops.push({ type: 'added', token: newTokens[j - 1] });
      j--;
    }
  }
  while (i > 0) { ops.push({ type: 'removed', token: oldTokens[i - 1] }); i--; }
  while (j > 0) { ops.push({ type: 'added', token: newTokens[j - 1] }); j--; }

  ops.reverse();

  // Merge consecutive same-type segments
  const segments: DiffSegment[] = [];
  for (const op of ops) {
    const last = segments[segments.length - 1];
    if (last && last.type === op.type) {
      last.text += op.token;
    } else {
      segments.push({ type: op.type, text: op.token });
    }
  }
  return segments;
}

export function SideBySideDiff({
  oldText,
  newText,
  className,
  padded,
}: {
  oldText: string;
  newText: string;
  className?: string;
  padded?: boolean;
}) {
  if (oldText === newText) {
    return (
      <div className="flex gap-2">
        <div className={`flex-1 min-w-0 ${className}`}>{oldText}</div>
        <div className={`flex-1 min-w-0 ${className}`}>{newText}</div>
      </div>
    );
  }

  const segments = computeDiff(oldText, newText);

  // Left side: show equal + removed (highlight removed)
  const leftParts = segments.filter(s => s.type !== 'added');
  // Right side: show equal + added (highlight added)
  const rightParts = segments.filter(s => s.type !== 'removed');

  const outerPadding = padded ? 'p-4' : '';

  return (
    <div className={`flex gap-2 ${outerPadding}`}>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Current</div>
        <div className={`rounded-md p-2.5 bg-muted/15 border border-border/50 ${className}`}>
          {leftParts.map((seg, i) => {
            if (seg.type === 'equal') return <span key={i}>{seg.text}</span>;
            // removed — visible strikethrough with tinted background
            return (
              <span key={i} className="bg-primary/[0.06] text-foreground/50 line-through decoration-primary/40 decoration-2 rounded-sm">
                {seg.text}
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">After Changes</div>
        <div className={`rounded-md p-2.5 bg-muted/15 border border-primary/20 ${className}`}>
          {rightParts.map((seg, i) => {
            if (seg.type === 'equal') return <span key={i}>{seg.text}</span>;
            // added — warm primary underline highlight
            return (
              <span key={i} className="text-primary font-medium underline decoration-primary/40 decoration-2 underline-offset-2">
                {seg.text}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
