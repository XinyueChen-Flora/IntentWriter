"use client";

import { useState } from "react";
import type { RuleBlock, EditingTraceEntry } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronDown, ChevronRight, Edit2, Check, X, Upload, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AACU_DIMENSIONS, type AACUDimension } from "@/lib/aacuFramework";

type SharedRulesPanelProps = {
  rules: RuleBlock[];
  addRule: (rule: RuleBlock) => void;
  updateRule: (ruleId: string, updates: Partial<RuleBlock>) => void;
  deleteRule: (ruleId: string) => void;
  currentUser: User;
};

export default function SharedRulesPanel({
  rules,
  addRule,
  updateRule,
  deleteRule,
  currentUser,
}: SharedRulesPanelProps) {
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [expandedDimensions, setExpandedDimensions] = useState<Set<AACUDimension>>(new Set());

  // Rubric upload state
  const [isUploadingRubric, setIsUploadingRubric] = useState(false);
  const [rubricText, setRubricText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);

  // Form state for new rule
  const [newRuleContent, setNewRuleContent] = useState("");
  const [newRuleRationale, setNewRuleRationale] = useState("");
  const [newRuleExamples, setNewRuleExamples] = useState<string[]>([""]);

  // Form state for editing rule
  const [editContent, setEditContent] = useState("");
  const [editRationale, setEditRationale] = useState("");
  const [editExamples, setEditExamples] = useState<string[]>([]);

  const handleAddRule = () => {
    if (!newRuleContent.trim()) return;

    // Calculate safe position
    let maxPosition = -1;
    if (rules.length > 0) {
      const positions = rules.map(r => r.position).filter(p => typeof p === 'number' && !isNaN(p));
      if (positions.length > 0) {
        maxPosition = Math.max(...positions);
      }
    }

    const userName = currentUser.user_metadata?.name ||
                    currentUser.user_metadata?.full_name ||
                    currentUser.email?.split('@')[0] ||
                    undefined;
    const userEmail = currentUser.email || undefined;

    const newRule: RuleBlock = {
      id: `rule-${Date.now()}-${Math.random()}`,
      content: newRuleContent.trim(),
      rationale: newRuleRationale.trim(),
      examples: newRuleExamples.filter(e => e.trim() !== ""),
      editingTrace: [], // Empty for now, will be populated when extracted from real editing
      createdBy: currentUser.id,
      createdByName: userName,
      createdByEmail: userEmail,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      position: maxPosition + 1,
    };

    addRule(newRule);

    // Reset form
    setNewRuleContent("");
    setNewRuleRationale("");
    setNewRuleExamples([""]);
    setIsAddingRule(false);
  };

  const handleStartEdit = (rule: RuleBlock) => {
    setEditingRuleId(rule.id);
    setEditContent(rule.content);
    setEditRationale(rule.rationale);
    setEditExamples([...rule.examples]);
  };

  const handleSaveEdit = (ruleId: string) => {
    updateRule(ruleId, {
      content: editContent.trim(),
      rationale: editRationale.trim(),
      examples: editExamples.filter(e => e.trim() !== ""),
      updatedAt: Date.now(),
    });
    setEditingRuleId(null);
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setEditContent("");
    setEditRationale("");
    setEditExamples([]);
  };

  const handleAnalyzeRubric = async () => {
    if (!rubricText.trim()) {
      setAnalysisError("Please enter rubric text");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisSummary(null);

    try {
      const userName = currentUser.user_metadata?.name ||
                      currentUser.user_metadata?.full_name ||
                      currentUser.email?.split('@')[0] ||
                      'User';
      const userEmail = currentUser.email || '';

      const response = await fetch('/api/analyze-rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rubricText: rubricText.trim(),
          userId: currentUser.id,
          userName,
          userEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze rubric');
      }

      const result = await response.json();

      // Add all generated rules
      result.rules.forEach((rule: RuleBlock) => {
        addRule(rule);
      });

      setAnalysisSummary(result.summary);
      setRubricText(""); // Clear the form
      setIsUploadingRubric(false); // Close the upload form

      // Auto-expand all dimensions that have rules
      const newExpandedDimensions = new Set<AACUDimension>();
      result.rules.forEach((rule: RuleBlock) => {
        if (rule.dimension) {
          newExpandedDimensions.add(rule.dimension);
        }
      });
      setExpandedDimensions(newExpandedDimensions);

    } catch (error) {
      console.error('[Rubric Analysis] Error:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleDimension = (dimension: AACUDimension) => {
    setExpandedDimensions(prev => {
      const next = new Set(prev);
      if (next.has(dimension)) {
        next.delete(dimension);
      } else {
        next.add(dimension);
      }
      return next;
    });
  };

  // Group rules by dimension
  const rulesByDimension = new Map<AACUDimension | 'uncategorized', RuleBlock[]>();
  rules.forEach(rule => {
    const key = rule.dimension || 'uncategorized';
    if (!rulesByDimension.has(key)) {
      rulesByDimension.set(key, []);
    }
    rulesByDimension.get(key)!.push(rule);
  });

  // Sort rules within each dimension by position
  rulesByDimension.forEach(rules => {
    rules.sort((a, b) => a.position - b.position);
  });

  const sortedRules = [...rules].sort((a, b) => a.position - b.position);

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header */}
      <div className="p-3 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Shared Writing Rules</h3>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsUploadingRubric(true)}
              className="h-7 text-xs"
            >
              <Upload className="h-3 w-3 mr-1" />
              Import Rubric
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingRule(true)}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Rule
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Course requirements organized by AAC&U dimensions
        </p>
      </div>

      {/* Rules List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Upload Rubric Form */}
        {isUploadingRubric && (
          <div className="p-3 border rounded-lg bg-background shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <h4 className="text-sm font-semibold">Import Course Rubric</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste your instructor&apos;s rubric below. AI will organize it by AAC&U dimensions (Context, Content, Genre, Sources, Writing Quality).
            </p>
            <Textarea
              placeholder="Paste your instructor's rubric here... (e.g., grading criteria, expectations, etc.)"
              value={rubricText}
              onChange={(e) => setRubricText(e.target.value)}
              className="text-sm min-h-[120px] resize-none"
            />
            {analysisError && (
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
                <span className="font-medium">Error: </span>
                {analysisError}
              </div>
            )}
            {analysisSummary && (
              <div className="p-2 bg-muted border rounded text-xs">
                <span className="font-medium">✓ </span>
                {analysisSummary}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsUploadingRubric(false);
                  setRubricText("");
                  setAnalysisError(null);
                  setAnalysisSummary(null);
                }}
                disabled={isAnalyzing}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleAnalyzeRubric}
                disabled={!rubricText.trim() || isAnalyzing}
                className="h-7 text-xs"
              >
                {isAnalyzing ? (
                  <>
                    <div className="h-3 w-3 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Organizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    Import & Organize
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Add New Rule Form */}
        {isAddingRule && (
          <div className="p-3 border rounded-lg bg-background shadow-sm space-y-2">
            <Input
              placeholder="Rule description (e.g., Use 'shared understanding' as core concept)"
              value={newRuleContent}
              onChange={(e) => setNewRuleContent(e.target.value)}
              className="text-sm"
            />
            <Textarea
              placeholder="Why is this rule important?"
              value={newRuleRationale}
              onChange={(e) => setNewRuleRationale(e.target.value)}
              className="text-sm min-h-[60px]"
            />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Examples:</label>
              {newRuleExamples.map((example, idx) => (
                <div key={idx} className="flex gap-1">
                  <Input
                    placeholder={`Example ${idx + 1}`}
                    value={example}
                    onChange={(e) => {
                      const updated = [...newRuleExamples];
                      updated[idx] = e.target.value;
                      setNewRuleExamples(updated);
                    }}
                    className="text-xs"
                  />
                  {idx === newRuleExamples.length - 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewRuleExamples([...newRuleExamples, ""])}
                      className="h-8 px-2"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAddingRule(false);
                  setNewRuleContent("");
                  setNewRuleRationale("");
                  setNewRuleExamples([""]);
                }}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleAddRule}
                disabled={!newRuleContent.trim()}
                className="h-7 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Add Rule
              </Button>
            </div>
          </div>
        )}

        {/* Existing Rules - Grouped by AAC&U Dimension */}
        {sortedRules.length === 0 && !isAddingRule && !isUploadingRubric ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No shared rules yet</p>
            <p className="text-xs mt-1">Upload a rubric or add rules manually</p>
          </div>
        ) : (
          <>
            {/* Rules grouped by AAC&U dimensions */}
            {Array.from(rulesByDimension.entries()).map(([dimensionKey, dimensionRules]) => {
              const dimension = dimensionKey !== 'uncategorized' ? AACU_DIMENSIONS[dimensionKey as AACUDimension] : null;
              const isExpanded = dimensionKey === 'uncategorized' || expandedDimensions.has(dimensionKey as AACUDimension);

              return (
                <div key={dimensionKey} className="space-y-1">
                  {/* Dimension Header */}
                  <button
                    onClick={() => {
                      if (dimensionKey !== 'uncategorized') {
                        toggleDimension(dimensionKey as AACUDimension);
                      }
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    {dimensionKey !== 'uncategorized' ? (
                      <>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 text-left">
                          <h4 className="text-xs font-semibold">{dimension?.name}</h4>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">{dimension?.description}</p>
                        </div>
                        <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded">
                          {dimensionRules.length}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <h4 className="text-xs font-semibold">Other Rules</h4>
                          <p className="text-[10px] text-muted-foreground">Manually added rules</p>
                        </div>
                        <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded">
                          {dimensionRules.length}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Rules in this dimension */}
                  {isExpanded && dimensionRules.map((rule) => {
            const isRuleExpanded = expandedRuleId === rule.id;
            const isEditing = editingRuleId === rule.id;

            return (
              <div
                key={rule.id}
                className="border rounded-lg bg-background shadow-sm overflow-hidden ml-2"
              >
                {/* Rule Header */}
                <div className="p-2 flex items-start gap-2">
                  <button
                    onClick={() => setExpandedRuleId(isRuleExpanded ? null : rule.id)}
                    className="mt-0.5"
                  >
                    {isRuleExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <Input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="text-sm font-medium"
                      />
                    ) : (
                      <h4 className="text-sm font-medium leading-tight">
                        {rule.content}
                      </h4>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      By {rule.createdByName || rule.createdByEmail || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveEdit(rule.id)}
                          className="h-6 w-6 p-0"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(rule)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRule(rule.id)}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isRuleExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t pt-3">
                    {/* Rationale */}
                    {isEditing ? (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Rationale:
                        </label>
                        <Textarea
                          value={editRationale}
                          onChange={(e) => setEditRationale(e.target.value)}
                          className="text-xs mt-1 min-h-[60px]"
                        />
                      </div>
                    ) : (
                      <div>
                        <h5 className="text-xs font-medium text-muted-foreground mb-1">
                          Why this matters:
                        </h5>
                        <div className="text-xs prose prose-xs max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {rule.rationale || "_No rationale provided_"}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Examples */}
                    {isEditing ? (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Examples:
                        </label>
                        {editExamples.map((example, idx) => (
                          <div key={idx} className="flex gap-1 mt-1">
                            <Input
                              placeholder={`Example ${idx + 1}`}
                              value={example}
                              onChange={(e) => {
                                const updated = [...editExamples];
                                updated[idx] = e.target.value;
                                setEditExamples(updated);
                              }}
                              className="text-xs"
                            />
                            {idx === editExamples.length - 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditExamples([...editExamples, ""])}
                                className="h-8 px-2"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : rule.examples.length > 0 ? (
                      <div>
                        <h5 className="text-xs font-medium text-muted-foreground mb-1">
                          Examples:
                        </h5>
                        <ul className="space-y-1">
                          {rule.examples.map((example, idx) => (
                            <li
                              key={idx}
                              className="text-xs bg-muted/50 p-2 rounded border-l-2 border-primary/30"
                            >
                              {example}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {/* Editing Trace */}
                    {!isEditing && rule.editingTrace.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-muted-foreground mb-1">
                          Editing trace:
                        </h5>
                        <div className="space-y-1">
                          {rule.editingTrace.map((trace, idx) => (
                            <div
                              key={idx}
                              className="text-xs bg-muted/50 p-2 rounded border-l-2 border-amber-500/30"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">Version {trace.version}</span>
                                <span className="text-muted-foreground">
                                  {new Date(trace.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-foreground/80">{trace.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
