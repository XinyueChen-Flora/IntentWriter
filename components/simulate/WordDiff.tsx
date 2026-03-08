"use client";

// Simple word-level diff using LCS (longest common subsequence)

type DiffSegment = {
  type: 'equal' | 'added' | 'removed';
  text: string;
};

function tokenize(text: string): string[] {
  // Split into words and whitespace, preserving whitespace
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

  const segments: DiffSegment[] = [];
  let i = oldTokens.length;
  let j = newTokens.length;

  // Backtrack to find the diff
  const ops: Array<{ type: 'equal' | 'added' | 'removed'; token: string }> = [];
  while (i > 0 && j > 0) {
    if (oldTokens[i - 1] === newTokens[j - 1]) {
      ops.push({ type: 'equal', token: oldTokens[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: 'removed', token: oldTokens[i - 1] });
      i--;
    } else {
      ops.push({ type: 'added', token: newTokens[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    ops.push({ type: 'removed', token: oldTokens[i - 1] });
    i--;
  }
  while (j > 0) {
    ops.push({ type: 'added', token: newTokens[j - 1] });
    j--;
  }

  ops.reverse();

  // Merge consecutive ops of the same type
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

export function WordDiff({ oldText, newText, className }: {
  oldText: string;
  newText: string;
  className?: string;
}) {
  // If texts are identical, just show the text
  if (oldText === newText) {
    return <span className={className}>{newText}</span>;
  }

  const segments = computeDiff(oldText, newText);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'equal') {
          return <span key={i}>{seg.text}</span>;
        }
        if (seg.type === 'removed') {
          return (
            <span key={i} className="line-through text-muted-foreground/50 bg-muted/40 rounded-sm">
              {seg.text}
            </span>
          );
        }
        // added
        return (
          <span key={i} className="text-primary font-medium underline decoration-primary/30 underline-offset-2 rounded-sm">
            {seg.text}
          </span>
        );
      })}
    </span>
  );
}
