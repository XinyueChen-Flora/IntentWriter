"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";
import type { DocumentSnapshot } from "@/platform/data-model";

// ─── Template filling ───
// Replaces {{nodes}}, {{writing}}, etc. with formatted snapshot data.

function formatNodes(snapshot: DocumentSnapshot): string {
  const sections = snapshot.nodes
    .filter(n => n.parentId === null)
    .sort((a, b) => a.position - b.position);

  return sections.map(section => {
    const children = snapshot.nodes
      .filter(n => n.parentId === section.id)
      .sort((a, b) => a.position - b.position);

    const childrenStr = children.length > 0
      ? children.map(c => `  - (id:${c.id}) ${c.content}`).join('\n')
      : '  (no children)';

    const assignee = snapshot.assignments.find(a => a.sectionId === section.id);
    const assigneeStr = assignee ? ` [assigned: ${assignee.assigneeName}]` : '';

    return `Section "${section.content}"${assigneeStr} (id:${section.id})\n${childrenStr}`;
  }).join('\n\n');
}

function formatWriting(snapshot: DocumentSnapshot): string {
  // Find section name for each writing entry
  return snapshot.writing.map(w => {
    const section = snapshot.nodes.find(n => n.id === w.sectionId);
    const sectionName = section?.content || w.sectionId;
    return `--- ${sectionName} (${w.wordCount} words) ---\n${w.text}`;
  }).join('\n\n');
}

function formatDependencies(snapshot: DocumentSnapshot): string {
  if (snapshot.dependencies.length === 0) return '(none)';
  return snapshot.dependencies.map(d => {
    const fromNode = snapshot.nodes.find(n => n.id === d.fromId);
    const toNode = snapshot.nodes.find(n => n.id === d.toId);
    const fromName = fromNode?.content || d.fromId;
    const toName = toNode?.content || d.toId;
    const dir = d.direction === 'bidirectional' ? '↔' : '→';
    return `"${fromName}" ${dir} "${toName}" (${d.type}: ${d.label})`;
  }).join('\n');
}

function formatAssignments(snapshot: DocumentSnapshot): string {
  return snapshot.assignments.map(a =>
    `Section [${a.sectionId}]: ${a.assigneeName}`
  ).join('\n');
}

function formatMembers(snapshot: DocumentSnapshot): string {
  return snapshot.members.map(m =>
    `${m.name} (${m.role})${m.email ? ` <${m.email}>` : ''}`
  ).join('\n');
}

function fillTemplate(
  template: string,
  snapshot: DocumentSnapshot,
  focus?: Record<string, unknown>,
  config?: Record<string, unknown>,
): string {
  return template
    .replace(/\{\{nodes\}\}/g, formatNodes(snapshot))
    .replace(/\{\{writing\}\}/g, formatWriting(snapshot))
    .replace(/\{\{dependencies\}\}/g, formatDependencies(snapshot))
    .replace(/\{\{assignments\}\}/g, formatAssignments(snapshot))
    .replace(/\{\{members\}\}/g, formatMembers(snapshot))
    .replace(/\{\{focus\}\}/g, focus ? JSON.stringify(focus, null, 2) : '(none)')
    .replace(/\{\{config\}\}/g, config ? JSON.stringify(config, null, 2) : '{}');
}

// ─── Route ───

type RunPromptRequest = {
  prompt: {
    system: string;
    user: string;
    model?: string;
    temperature?: number;
  };
  snapshot: DocumentSnapshot;
  focus?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;

  const body: RunPromptRequest = await request.json();
  const { prompt, snapshot, focus, config } = body;

  if (!prompt?.system || !prompt?.user) {
    return NextResponse.json({ error: "Missing prompt.system or prompt.user" }, { status: 400 });
  }
  if (!snapshot) {
    return NextResponse.json({ error: "Missing snapshot" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  // Fill template variables
  const filledUser = fillTemplate(prompt.user, snapshot, focus, config);

  // Wrap system prompt to enforce JSON output
  const systemWithJsonRule = `${prompt.system}\n\nIMPORTANT: Return ONLY valid JSON. No markdown fences, no explanation text.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: prompt.model || "gpt-4o",
      messages: [
        { role: "system", content: systemWithJsonRule },
        { role: "user", content: filledUser },
      ],
      temperature: prompt.temperature ?? 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[run-prompt] OpenAI error:", errorText);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }

  const aiResult = await response.json();
  const content = aiResult.choices?.[0]?.message?.content?.trim() || "{}";

  let parsed: Record<string, unknown>;
  try {
    const jsonStr = content.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "");
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error("[run-prompt] Failed to parse AI response:", content);
    return NextResponse.json({ error: "Failed to parse AI response as JSON" }, { status: 500 });
  }

  return NextResponse.json({ result: parsed });
});
