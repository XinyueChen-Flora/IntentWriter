import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/middleware";

type Dependency = {
  id: string;
  fromIntentId: string;
  toIntentId: string;
  label: string;
  relationshipType: string;
};

type IntentInfo = {
  id: string;
  content: string;
  parentId?: string | null;
};

/**
 * Analyze the impact of removing/modifying an intent from the outline.
 * Uses AI to assess how this change affects related sections.
 */
export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const {
    intentId,
    intentContent,
    rootIntentId,
    rootIntentContent,
    dependencies = [],
    allIntents = [],
    writingContents = {},  // Map of sectionId -> writing content
  } = body as {
    intentId: string;
    intentContent: string;
    rootIntentId: string;
    rootIntentContent?: string;
    dependencies: Dependency[];
    allIntents: IntentInfo[];
    writingContents?: Record<string, string>;
  };

  // Get all IDs in our section
  const idsInOurSection = new Set<string>([rootIntentId]);
  allIntents
    .filter(i => i.parentId === rootIntentId)
    .forEach(i => idsInOurSection.add(i.id));

  // Find dependencies that link our section to other sections
  const crossSectionDeps = dependencies.filter((d: Dependency) => {
    const fromInOurs = idsInOurSection.has(d.fromIntentId);
    const toInOurs = idsInOurSection.has(d.toIntentId);
    // Only keep deps that cross section boundaries
    return (fromInOurs && !toInOurs) || (!fromInOurs && toInOurs);
  });

  // If no cross-section dependencies, return empty
  if (crossSectionDeps.length === 0) {
    return NextResponse.json({
      intentId,
      rootIntentId,
      impacts: [],
      message: "No cross-section dependencies found.",
    });
  }

  // Find related sections
  const relatedSectionIds = new Set<string>();
  for (const dep of crossSectionDeps) {
    const relatedId = idsInOurSection.has(dep.fromIntentId) ? dep.toIntentId : dep.fromIntentId;
    const relatedIntent = allIntents.find(i => i.id === relatedId);
    if (relatedIntent) {
      // Get root section ID
      const rootId = relatedIntent.parentId || relatedIntent.id;
      relatedSectionIds.add(rootId);
    }
  }

  // Build related sections data
  const relatedSections = Array.from(relatedSectionIds).map(sectionId => {
    const section = allIntents.find(i => i.id === sectionId);
    const children = allIntents
      .filter(i => i.parentId === sectionId)
      .map((c, idx) => ({ id: c.id, content: c.content, position: idx }));

    // Find relevant dependency
    const dep = crossSectionDeps.find(d =>
      d.fromIntentId === sectionId || d.toIntentId === sectionId ||
      children.some(c => c.id === d.fromIntentId || c.id === d.toIntentId)
    );

    return {
      id: sectionId,
      intentContent: section?.content || 'Unknown',
      childIntents: children,
      writingContent: writingContents[sectionId] || '',
      relationship: dep?.label || 'related',
    };
  });

  // Call AI to assess impact
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback to simple analysis without AI
    const impacts = relatedSections.map(s => ({
      sectionId: s.id,
      sectionTitle: s.intentContent.slice(0, 50),
      impactLevel: 'minor' as const,
      reason: `Has "${s.relationship}" relationship with this section`,
    }));
    return NextResponse.json({ intentId, rootIntentId, impacts });
  }

  const systemPrompt = `You analyze how removing an intent from one section might impact related sections.

## Task
Given:
- An intent that will be REMOVED from section A
- Related sections that have dependencies with section A

Determine for each related section:
1. Will removing this intent break any logical dependencies?
2. What is the impact level? (none/minor/significant)
3. Why?

## Output Format (JSON only, no markdown)
{
  "impacts": [
    {
      "sectionId": "id",
      "sectionTitle": "title (max 50 chars)",
      "impactLevel": "none" | "minor" | "significant",
      "reason": "Brief explanation (1 sentence, max 80 chars)"
    }
  ]
}

## Impact Levels
- "none": Removal has no effect on this section
- "minor": Minor inconsistency, section still makes sense
- "significant": Logical dependency broken, section may need updates

Be conservative - only mark "significant" for real logical breaks.`;

  const userPrompt = `## Intent to be REMOVED
Section: "${rootIntentContent || 'Unknown'}"
Intent: "${intentContent}"

## Related Sections
${relatedSections.map((s, i) => `
${i + 1}. "${s.intentContent}" (relationship: ${s.relationship})
   Children: ${s.childIntents.map(c => c.content).join(', ') || 'none'}
`).join('\n')}

Analyze impact of removing the intent.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error("AI API failed");
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any;
    try {
      const jsonStr = content.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "");
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { impacts: [] };
    }

    const impacts = Array.isArray(parsed.impacts)
      ? parsed.impacts.map((i: any) => ({
          sectionId: i.sectionId || '',
          sectionTitle: (i.sectionTitle || '').slice(0, 50),
          impactLevel: ['none', 'minor', 'significant'].includes(i.impactLevel)
            ? i.impactLevel
            : 'minor',
          reason: (i.reason || '').slice(0, 100),
        }))
      : [];

    return NextResponse.json({
      intentId,
      rootIntentId,
      impacts,
      message: impacts.length > 0
        ? `AI analyzed ${impacts.length} related section(s).`
        : "No significant impacts found.",
    });
  } catch (error) {
    console.error("AI impact assessment failed:", error);
    // Fallback
    const impacts = relatedSections.map(s => ({
      sectionId: s.id,
      sectionTitle: s.intentContent.slice(0, 50),
      impactLevel: 'minor' as const,
      reason: `Has "${s.relationship}" relationship`,
    }));
    return NextResponse.json({ intentId, rootIntentId, impacts });
  }
});
