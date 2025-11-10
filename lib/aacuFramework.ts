/**
 * AAC&U VALUE Rubrics - Written Communication Framework
 * Based on Association of American Colleges & Universities standards
 */

export type AACUDimension =
  | "context-purpose"
  | "content-development"
  | "genre-conventions"
  | "sources-evidence"
  | "syntax-mechanics";

export interface AACUDimensionInfo {
  id: AACUDimension;
  name: string;
  description: string;
  levels: {
    level: number;
    title: string;
    description: string;
  }[];
  keywords: string[]; // Keywords to help match uploaded rubrics
}

export const AACU_DIMENSIONS: Record<AACUDimension, AACUDimensionInfo> = {
  "context-purpose": {
    id: "context-purpose",
    name: "Context & Purpose for Writing",
    description: "Understanding and addressing the writing situation, including context, audience, and purpose",
    levels: [
      {
        level: 4,
        title: "Capstone",
        description: "Demonstrates a thorough understanding of context, audience, and purpose that is responsive to the assigned task and focuses all elements of the work"
      },
      {
        level: 3,
        title: "Milestones",
        description: "Demonstrates adequate consideration of context, audience, and purpose and a clear focus on the assigned task"
      },
      {
        level: 2,
        title: "Milestones",
        description: "Demonstrates awareness of context, audience, purpose, and to the assigned task(s)"
      },
      {
        level: 1,
        title: "Benchmark",
        description: "Demonstrates minimal attention to context, audience, purpose, and to the assigned task(s)"
      }
    ],
    keywords: ["audience", "purpose", "context", "rhetorical situation", "assignment", "task", "situation", "reader"]
  },

  "content-development": {
    id: "content-development",
    name: "Content Development",
    description: "Using appropriate, relevant, and compelling content to explore ideas and develop the topic",
    levels: [
      {
        level: 4,
        title: "Capstone",
        description: "Uses appropriate, relevant, and compelling content to illustrate mastery of the subject, conveying the writer's understanding, and shaping the whole work"
      },
      {
        level: 3,
        title: "Milestones",
        description: "Uses appropriate, relevant, and compelling content to explore ideas within the context of the discipline and shape the whole work"
      },
      {
        level: 2,
        title: "Milestones",
        description: "Uses appropriate and relevant content to develop and explore ideas through most of the work"
      },
      {
        level: 1,
        title: "Benchmark",
        description: "Uses appropriate and relevant content to develop simple ideas in some parts of the work"
      }
    ],
    keywords: ["content", "ideas", "development", "topic", "thesis", "argument", "claims", "evidence", "examples", "depth", "complexity"]
  },

  "genre-conventions": {
    id: "genre-conventions",
    name: "Genre & Disciplinary Conventions",
    description: "Following the formal and informal rules inherent in the expectations for writing in particular forms and/or academic fields",
    levels: [
      {
        level: 4,
        title: "Capstone",
        description: "Demonstrates detailed attention to and successful execution of a wide range of conventions particular to a specific discipline and/or writing task(s)"
      },
      {
        level: 3,
        title: "Milestones",
        description: "Follows expectations appropriate to a specific discipline and/or writing task(s) for basic organization, content, and presentation"
      },
      {
        level: 2,
        title: "Milestones",
        description: "Follows expectations appropriate to a specific discipline and/or writing task(s) for basic organization, content, and presentation"
      },
      {
        level: 1,
        title: "Benchmark",
        description: "Attempts to use a consistent system for basic organization and presentation"
      }
    ],
    keywords: ["genre", "format", "structure", "organization", "conventions", "style", "citation", "formatting", "layout", "discipline", "academic"]
  },

  "sources-evidence": {
    id: "sources-evidence",
    name: "Sources & Evidence",
    description: "Using and crediting high-quality, credible, relevant sources to support ideas",
    levels: [
      {
        level: 4,
        title: "Capstone",
        description: "Demonstrates skillful use of high-quality, credible, relevant sources to develop ideas that are appropriate for the discipline and genre of the writing"
      },
      {
        level: 3,
        title: "Milestones",
        description: "Demonstrates consistent use of credible, relevant sources to support ideas that are situated within the discipline and genre of the writing"
      },
      {
        level: 2,
        title: "Milestones",
        description: "Demonstrates an attempt to use credible and/or relevant sources to support ideas that are appropriate for the discipline and genre of the writing"
      },
      {
        level: 1,
        title: "Benchmark",
        description: "Demonstrates an attempt to use sources to support ideas in the writing"
      }
    ],
    keywords: ["sources", "evidence", "citations", "references", "research", "credibility", "relevance", "support", "quotes", "integration", "synthesis"]
  },

  "syntax-mechanics": {
    id: "syntax-mechanics",
    name: "Control of Syntax & Mechanics",
    description: "Using language that skillfully communicates meaning with clarity and fluency, and with few errors",
    levels: [
      {
        level: 4,
        title: "Capstone",
        description: "Uses graceful language that skillfully communicates meaning to readers with clarity and fluency, and is virtually error-free"
      },
      {
        level: 3,
        title: "Milestones",
        description: "Uses straightforward language that generally conveys meaning to readers. The language in the portfolio has few errors"
      },
      {
        level: 2,
        title: "Milestones",
        description: "Uses language that generally conveys meaning to readers with clarity, although writing may include some errors"
      },
      {
        level: 1,
        title: "Benchmark",
        description: "Uses language that sometimes impedes meaning because of errors in usage"
      }
    ],
    keywords: ["grammar", "syntax", "mechanics", "punctuation", "spelling", "sentence", "clarity", "fluency", "errors", "language", "writing quality"]
  }
};

/**
 * Get all AAC&U dimensions
 */
export function getAllDimensions(): AACUDimensionInfo[] {
  return Object.values(AACU_DIMENSIONS);
}

/**
 * Get a specific dimension by ID
 */
export function getDimension(id: AACUDimension): AACUDimensionInfo | undefined {
  return AACU_DIMENSIONS[id];
}

/**
 * Match rubric text to AAC&U dimensions using keyword matching
 * Returns dimensions sorted by relevance score
 */
export function matchRubricToDimensions(rubricText: string): Array<{
  dimension: AACUDimension;
  score: number;
  matchedKeywords: string[];
}> {
  const normalizedText = rubricText.toLowerCase();
  const results: Array<{
    dimension: AACUDimension;
    score: number;
    matchedKeywords: string[];
  }> = [];

  Object.values(AACU_DIMENSIONS).forEach(dim => {
    const matchedKeywords: string[] = [];
    let score = 0;

    dim.keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = normalizedText.match(regex);
      if (matches) {
        matchedKeywords.push(keyword);
        score += matches.length;
      }
    });

    if (score > 0) {
      results.push({
        dimension: dim.id,
        score,
        matchedKeywords
      });
    }
  });

  return results.sort((a, b) => b.score - a.score);
}
