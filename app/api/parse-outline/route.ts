import { NextResponse } from "next/server";
import { withErrorHandler, requireAuth, isErrorResponse } from "@/lib/api/middleware";

interface ParsedSection {
  content: string;
  children: string[];
}

export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { markdown } = await request.json();

  if (!markdown || typeof markdown !== "string") {
    return NextResponse.json({ error: "Missing markdown content" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  const systemPrompt = `You are a writing outline parser. Given some text (markdown, notes, or any format), extract a hierarchical outline structure.

Rules:
1. Identify major sections (top-level topics)
2. Under each section, extract key points or sub-topics
3. Keep each item concise (1-2 sentences max)
4. Preserve the user's original wording as much as possible
5. If the text is already well-structured, preserve that structure
6. If it's unstructured notes, organize them logically
7. Aim for 2-6 sections, each with 2-5 points

Return a JSON array of sections. Each section has:
- "content": The section title/description
- "children": Array of strings, each being a point under this section

Example output:
[
  {
    "content": "Introduction",
    "children": ["Hook - grab reader attention", "Thesis statement", "Overview of main points"]
  },
  {
    "content": "Background",
    "children": ["Historical context", "Current state of research"]
  }
]

IMPORTANT: Return ONLY the JSON array, no markdown formatting, no explanation.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse this into an outline structure:\n\n${markdown}` },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API error:", error);
      return NextResponse.json({ error: "AI processing failed" }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    // Parse the JSON response
    let parsed: ParsedSection[];
    try {
      // Clean up potential markdown formatting
      let jsonText = content.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      // Try to extract JSON array if wrapped in other text
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", parseErr instanceof Error ? parseErr.message : parseErr, "\nContent:", content?.substring(0, 200));
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Validate structure
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid response structure" }, { status: 500 });
    }

    return NextResponse.json({ sections: parsed });
  } catch (error) {
    console.error("AI parsing error:", error);
    return NextResponse.json({ error: "AI processing failed" }, { status: 500 });
  }
});
