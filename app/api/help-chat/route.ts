import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      question,
      questionType,
      selectedText,
      intentContent,
      chatHistory,
    } = body;

    if (!question) {
      return NextResponse.json(
        { error: "Missing required field: question" },
        { status: 400 }
      );
    }

    const response = await getAISuggestion({
      question,
      questionType,
      selectedText,
      intentContent,
      chatHistory: chatHistory || [],
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Help Chat] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function getAISuggestion({
  question,
  questionType,
  selectedText,
  intentContent,
  chatHistory,
}: {
  question: string;
  questionType?: string;
  selectedText?: string;
  intentContent?: string;
  chatHistory: ChatMessage[];
}) {
  try {
    // Build context
    let context = "";
    if (selectedText) {
      context += `\nSelected text: "${selectedText}"`;
    }
    if (intentContent) {
      context += `\nCurrent intent/section: "${intentContent}"`;
    }

    // Build messages array
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: `You are a helpful writing assistant for collaborative academic/professional writing.
A writer has a question about their work and you've determined this can be resolved without team input.

Your role:
1. Give practical, specific advice based on their question
2. Be concise but helpful (2-4 sentences for initial response)
3. If they ask follow-up questions, continue to help
4. Focus on actionable suggestions they can implement immediately

Question types and how to help:
- "choose-between": Help them weigh pros/cons, suggest which option fits better
- "add-remove": Advise on whether the content adds value or is redundant
- "how-much": Guide on appropriate depth/detail level
- "terminology": Suggest the more appropriate term and why
- "placement": Recommend logical placement in the document
- "other": Provide general writing guidance

Keep responses friendly but professional. Use "you" to address the writer directly.`,
      },
    ];

    // Add initial context as first user message if this is the start
    if (chatHistory.length === 0) {
      messages.push({
        role: "user",
        content: `${context ? `Context:${context}\n\n` : ""}Question: ${question}`,
      });
    } else {
      // Add the initial question with context
      messages.push({
        role: "user",
        content: `${context ? `Context:${context}\n\n` : ""}Question: ${question}`,
      });

      // Add chat history
      chatHistory.forEach((msg) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 300,
    });

    const suggestion = completion.choices[0].message.content || "I couldn't generate a suggestion. Please try rephrasing your question.";

    console.log("[Help Chat] AI suggestion:", suggestion.substring(0, 100));

    return {
      suggestion,
      success: true,
    };
  } catch (error) {
    console.error("[OpenAI] Help chat failed:", error);
    return {
      suggestion: "Sorry, I couldn't process your question right now. Please try again.",
      success: false,
    };
  }
}
