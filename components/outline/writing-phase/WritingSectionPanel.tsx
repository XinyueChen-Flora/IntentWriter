"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { IntentBlock, WritingBlock } from "@/lib/partykit";
import { Eye } from "lucide-react";
import TipTapEditor from "@/components/editor/TipTapEditor";
import { useIntentPanelContext } from "../IntentPanelContext";
import { PrimitiveRenderer } from "@/components/capability/PrimitiveRenderer";
import { getCoordinationPath } from "@/platform/coordination/protocol";
import { setResult as setInteractionResult } from "@/platform/interaction-store";
import type { ResolvedPrimitive } from "@/platform/primitives/resolver";
import { primitivesToCoverageMap } from "@/lib/primitive-to-tiptap";
import type { FunctionResult } from "@/platform/functions/protocol";
import { SenseRunner } from "@/components/protocol/SenseRunner";
import { GateRunner } from "@/components/protocol/GateRunner";
import { NegotiateRunner } from "@/components/protocol/NegotiateRunner";
import type { StepDispatch } from "@/platform/protocol-types";
import { getSenseProtocol } from "@/platform/sense/protocol";
import { getGate } from "@/platform/gate/protocol";

type WritingSectionPanelProps = {
  block: IntentBlock;
  sectionChildren: IntentBlock[];
};

export function WritingSectionPanel({ block, sectionChildren }: WritingSectionPanelProps) {
  const ctx = useIntentPanelContext();

  const [summaryHidden, setSummaryHidden] = useState(false);
  // Active sense protocol — when set, SenseRunner handles the flow
  const [activeSenseProtocolId, setActiveSenseProtocolId] = useState<string | null>(null);
  const [senseStartAtStep, setSenseStartAtStep] = useState<string | undefined>(undefined);
  const [senseContext, setSenseContext] = useState<Record<string, unknown>>({});
  const [senseActions, setSenseActions] = useState<import("@/platform/protocol-types").ProtocolAction[] | null>(null);
  const [senseRunning, setSenseRunning] = useState<string | null>(null);
  const [draftPanelDismissed, setDraftPanelDismissed] = useState(true);
  // Active gate — set after Sense exits to gate
  const [activeGateId, setActiveGateId] = useState<string | null>(null);
  const [gateActions, setGateActions] = useState<import("@/platform/protocol-types").ProtocolAction[] | null>(null);
  const [gateRunning, setGateRunning] = useState<string | null>(null);
  const activeGateDef = activeGateId ? getGate(activeGateId) : null;
  const gateRunnerRef = useRef<{ handleAction: (a: import("@/platform/protocol-types").ProtocolAction) => Promise<void> } | null>(null);
  const gateSelectedRouteRef = useRef<string | null>(null);
  // Draft items preserved from sense phase, passed through to negotiate
  const [negotiateConfig, setNegotiateConfig] = useState<Record<string, unknown>>({});
  const reasoningRef = useRef('');
  // Active negotiate protocol — set after Gate routes to a negotiate path
  const [activeNegotiateId, setActiveNegotiateId] = useState<string | null>(null);
  const [negotiateStage, setNegotiateStage] = useState<'propose' | 'deliberate' | 'resolve'>('propose');
  const activeNegotiateDef = activeNegotiateId ? getCoordinationPath(activeNegotiateId) : null;
  const senseRunnerRef = useRef<{ handleAction: (a: import("@/platform/protocol-types").ProtocolAction) => Promise<void> } | null>(null);
  const senseResultsRef = useRef<Map<string, import("@/platform/functions/protocol").FunctionResult>>(new Map());
  const activeSenseProtocol = activeSenseProtocolId ? getSenseProtocol(activeSenseProtocolId) : null;

  // Pipeline data — scoped to THIS section only
  const sectionPrimitives = ctx.getPrimitivesForSection(block.id);
  const matchedWritingBlock = ctx.intentToWritingMap.get(block.id);

  // ── Auto-detect pending proposals ──
  // Path 1: THIS is the source section with proposed changes (Discussion, Team Vote)
  //         → Thread visible to ALL users on this section
  // Path 2: THIS section is affected by someone else's Inform change
  //         → Notification visible to this section's owner only
  const pendingProposal = useMemo(() => {
    // Path 1: source section — any child has changeStatus='proposed'
    // Visible to everyone (proposer sees resolve, others see deliberate)
    const proposedChild = sectionChildren.find(
      c => c.changeStatus === 'proposed' && c.proposalId
    );
    if (proposedChild) {
      const isProposer = proposedChild.changeBy === ctx.currentUser.id;
      // Look up notification for this section (might be null for non-owners)
      const notifications = ctx.getSectionNotifications(block.id);
      const notification = notifications.find(n => n.proposalId === proposedChild.proposalId);
      return {
        proposalId: proposedChild.proposalId!,
        pathId: notification?.proposeType || 'discussion',
        proposedBy: proposedChild.changeByName || 'Someone',
        isProposer,
        notification: notification || null,
      };
    }

    // Path 2: affected section — Inform type, unacknowledged notification
    const notifications = ctx.getSectionNotifications(block.id);
    const unacked = notifications.find(n =>
      !n.acknowledged && n.notifyLevel !== 'skip'
      && n.sourceSectionId !== block.id  // not the source section (that's Path 1)
    );
    if (unacked) {
      return {
        proposalId: unacked.proposalId,
        pathId: unacked.proposeType || 'decided',
        proposedBy: unacked.proposedByName || 'Someone',
        isProposer: false,
        notification: unacked,
      };
    }

    return null;
  }, [sectionChildren, ctx.currentUser.id, block.id, ctx]);

  // Track which proposal has been handled (to prevent re-detection after acknowledge)
  const prevPendingRef = useRef<string | null>(null);

  // ── Respond to activeReview from context (triggered by ActionRequiredBar) ──
  useEffect(() => {
    if (ctx.activeReview && ctx.activeReview.sectionId === block.id && !activeNegotiateId) {
      const { pathId, proposalId, notification } = ctx.activeReview;
      const pathDef = getCoordinationPath(pathId);
      if (pathDef) {
        setActiveNegotiateId(pathId);
        setNegotiateStage('deliberate');
        setNegotiateConfig({
          proposalId,
          proposedBy: notification.proposedByName,
          notification,
        });
      }
      ctx.clearReview();
    }
  }, [ctx.activeReview, block.id, activeNegotiateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear previous sense protocol results before activating a new one
  const clearSenseResults = useCallback(() => {
    for (const fnId of senseResultsRef.current.keys()) {
      ctx.clearResult?.(fnId);
    }
    senseResultsRef.current.clear();
    setSenseActions(null);
    setSenseRunning(null);
  }, [ctx]);

  // ── Primitive action handler ──
  // ── Generic action router — dispatches to protocols, not hardcoded logic ──
  const handlePrimitiveAction = useCallback(async (action: string, primitive: ResolvedPrimitive) => {
    // Protocol routing: sense:protocolId:mode or coordination:action
    if (action.startsWith('sense:') && (action.includes(':writing') || action.includes(':intent'))) {
      // Extract protocol ID and mode from action: sense:protocolId:mode
    const parts = action.slice('sense:'.length).split(':');
    const protocolId = parts[0];
    const mode = parts[1]; // 'writing' or 'intent'
      const intentId = primitive.sourceItem?.id as string;
      const intentContent = primitive.sourceItem?.content as string || primitive.params.title;
      const coverageStatus = primitive.sourceItem?.coverageStatus as string || primitive.params.badge;
      // If protocol has a branch matching mode, use it; otherwise start from beginning
      const protocol = getSenseProtocol(protocolId);
      const branchStep = mode === 'writing' ? 'change-writing' : mode === 'intent' ? 'change-outline' : undefined;
      const hasStep = protocol?.steps.some(s => s.id === branchStep);
      clearSenseResults();
      setActiveSenseProtocolId(protocolId);
      setSenseStartAtStep(hasStep ? branchStep : undefined);
      setSenseContext({ intentId, intentContent, coverageStatus, action: mode === 'writing' ? 'writing' : 'intent' });
      setDraftPanelDismissed(false);
    } else if (action.startsWith('coordination:') || action === 'propose-change') {
      // Direct outline change — activate the propose-outline-change sense protocol
      const intentId = primitive.sourceItem?.id as string;
      const intentContent = primitive.sourceItem?.content as string || primitive.params.title;
      setActiveSenseProtocolId('propose-outline-change');
      setSenseStartAtStep(undefined);
      setSenseContext({ intentId, intentContent, action: 'intent' });
      setDraftPanelDismissed(false);
    }
    // Built-in actions (from sense protocol UI or outline)
    else if (action === 'sense:drift-impact-preview' || action === 'run-alignment-monitor') {
      // Activate the SenseRunner — it handles the entire step-by-step flow
      setActiveSenseProtocolId('drift-impact-preview');
      setSenseStartAtStep(undefined); // start from beginning
      setSenseContext({});
    } else if (action.startsWith('sense:')) {
      const protocolId = action.replace('sense:', '');
      ctx.runSenseProtocol(protocolId, { sectionId: block.id });
    } else if (action === 'add-to-outline') {
      const content = primitive.sourceItem?.content as string || primitive.params.title;
      const orphanStart = primitive.sourceItem?.start as string || primitive.params.startAnchor;
      if (content && orphanStart) {
        const newBlock = ctx.addBlock({ asChildOf: block.id });
        ctx.updateBlock(newBlock.id, content);
        ctx.markOrphanHandled(orphanStart);
      }
    } else if (action === 'update-draft') {
      // User edited items in draft-editor → store back to interaction store
      // so render-changes-summary can read the user's actual edits
      try {
        const updated = JSON.parse(primitive.params.value || '[]');
        setInteractionResult('render-draft', block.id, { draftItems: updated });
      } catch { /* ignore parse errors */ }
    } else if (action === 'set-reasoning') {
      // Store reasoning in interaction store so apply-proposal can read it
      reasoningRef.current = primitive.params.value || '';
      setInteractionResult('reasoning', block.id, { text: primitive.params.value || '' });
    } else if (action === 'set-reply') {
      // Store reply text in interaction store so submit-reply can read it
      setInteractionResult('reply', block.id, { text: primitive.params.value || '' });
    } else if (action.startsWith('select-route:')) {
      // Gate route selection — store the selected route for GateRunner
      const routeId = action.split(':')[1];
      gateSelectedRouteRef.current = routeId;
    } else if (action === 'dismiss') {
      // No-op
    }
  }, [block.id, ctx]);

  // Build intent coverage map from pipeline primitives
  const intentCoverageMap = useMemo(() => {
    const outlinePrims = sectionPrimitives['outline-node'];
    if (!outlinePrims || outlinePrims.length === 0) return undefined;
    return primitivesToCoverageMap(outlinePrims);
  }, [sectionPrimitives]);

  // Check for active coordination flow
  const hasActiveProposal = ctx.proposalDraft?.rootIntentId === block.id;

  // When openProposalDraft is called from outline menu, redirect to sense protocol
  const prevHasActiveProposalRef = useRef(false);
  useEffect(() => {
    if (hasActiveProposal && !prevHasActiveProposalRef.current && !activeSenseProtocolId && !activeNegotiateId) {
      const triggerId = ctx.proposalDraft?.triggerIntentId;
      const triggerBlock = triggerId ? [...sectionChildren, block].find(b => b.id === triggerId) : null;
      clearSenseResults();
      setActiveSenseProtocolId('propose-outline-change');
      setSenseStartAtStep(undefined);
      setSenseContext({
        intentId: triggerId || block.id,
        intentContent: triggerBlock?.content || block.content,
        action: 'intent',
      });
      setDraftPanelDismissed(false);
      ctx.setProposalDraft(null);
    }
    prevHasActiveProposalRef.current = hasActiveProposal;
  }, [hasActiveProposal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-section impact (separate channel, not mixed with regular primitives)
  const crossSectionImpact = ctx.getCrossSectionImpact(block.id);

  const sendCrossSectionPreview = useCallback((impacts: Array<{ sectionId?: string; impactLevel?: string; reason?: string; suggestedChanges?: Array<{ action: string; intentId?: string; content: string; reason: string }> }>) => {
    if (!impacts || impacts.length === 0) return;
    const sourceSection = block.content || 'Another section';
    for (const impact of impacts) {
      if (!impact.sectionId || impact.sectionId === block.id || impact.impactLevel === 'none') continue;
      const affectedChildren = ctx.blocks
        .filter(b => b.parentId === impact.sectionId)
        .sort((a, b) => a.position - b.position);
      const affectedRoot = ctx.blocks.find(b => b.id === impact.sectionId);
      const proposedItems = [
        ...(affectedRoot ? [{
          id: affectedRoot.id,
          content: affectedRoot.content,
          status: 'unchanged' as const,
        }] : []),
        ...affectedChildren.map(child => {
          const suggested = impact.suggestedChanges?.find(sc => sc.intentId === child.id);
          if (suggested?.action === 'modify') {
            return { id: child.id, content: suggested.content, originalContent: child.content, status: 'changed' as const, reason: suggested.reason };
          }
          if (suggested?.action === 'remove') {
            return { id: child.id, content: child.content, status: 'removed' as const, reason: suggested.reason };
          }
          return { id: child.id, content: child.content, status: 'unchanged' as const };
        }),
        ...(impact.suggestedChanges?.filter(sc => sc.action === 'add').map((sc, i) => ({
          id: `suggested-${i}`,
          content: sc.content,
          status: 'added' as const,
          reason: sc.reason,
        })) ?? []),
      ];
      ctx.injectResult?.('cross-section-impact', impact.sectionId, {
        functionId: 'cross-section-impact',
        data: { proposedItems, source: sourceSection, reason: impact.reason, impactLevel: impact.impactLevel },
        ui: [
          { type: 'banner', params: { title: `Impact from "${sourceSection}"`, message: impact.reason ?? '', severity: impact.impactLevel === 'significant' ? 'warning' : 'info' } },
          { type: 'outline-draft', params: { items: '{{proposedItems}}' } },
        ],
        computedAt: Date.now(),
      });
    }
  }, [block.content, block.id, ctx.blocks, ctx.injectResult]);

  const handleSenseDispatch = useCallback((dispatch: StepDispatch, result: FunctionResult) => {
    if (dispatch.type === 'cross-section') {
      const data = (result.data as Record<string, unknown>)?.[dispatch.collection];
      if (Array.isArray(data)) {
        sendCrossSectionPreview(data as Array<{ sectionId?: string; impactLevel?: string; reason?: string; suggestedChanges?: Array<{ action: string; intentId?: string; content: string; reason: string }> }>);
      }
    }
  }, [sendCrossSectionPreview]);


  return (
    <div className="flex-1 min-w-0 flex flex-row items-stretch">
      {/* ── Headless Sense Runner — executes steps, results go through pipeline ── */}
      {activeSenseProtocol && (
        <SenseRunner
          protocol={activeSenseProtocol}
          snapshot={ctx.documentSnapshot}
          sectionId={block.id}
          trigger="manual"
          startAtStep={senseStartAtStep}
          config={senseContext}
          onGateExit={() => {
            // Inject sense results into pipeline store (so gate can read them)
            for (const [fnId, result] of senseResultsRef.current) {
              ctx.injectResult?.(fnId, block.id, result);
            }
            // Clean up sense state
            setActiveSenseProtocolId(null);
            setSenseStartAtStep(undefined);
            setSenseContext({});
            setSenseActions(null);
            setSenseRunning(null);
            setDraftPanelDismissed(true);
            // Activate gate — or skip gate for fixed path
            const gateId = ctx.metaRule?.gateId || 'impact-based';
            if (gateId === 'fixed') {
              // Fixed path: skip gate, go directly to negotiate
              const fixedPath = ctx.metaRule?.defaultNegotiateProtocol || 'decided';
              ctx.clearAllResults(block.id);
              senseResultsRef.current.clear();
              setNegotiateConfig({});
              setActiveNegotiateId(fixedPath);
              setNegotiateStage('propose');
            } else {
              setActiveGateId(gateId);
            }
          }}
          onFunctionResult={(fnId, result) => {
            // All results go to pipeline — pipeline handles location-based rendering
            ctx.injectResult?.(fnId, block.id, result);
            senseResultsRef.current.set(fnId, result);
            if (fnId === 'assess-impact') {
              const impacts = (result.data && (result.data as Record<string, unknown>).impacts) as Array<{
                sectionId?: string;
                impactLevel?: string;
                reason?: string;
                suggestedChanges?: Array<{ action: string; intentId?: string; content: string; reason: string }>;
              }> | undefined;
              if (impacts && impacts.length > 0) {
                sendCrossSectionPreview(impacts);
              }
            }
          }}
          onActionsChanged={(actions) => {
            setSenseActions(actions);
          }}
          onRunningChanged={(running) => {
            setSenseRunning(running);
          }}
          onExecutorReady={(exec) => {
            senseRunnerRef.current = exec;
          }}
          onDispatch={handleSenseDispatch}
          onFinished={() => {
            setActiveSenseProtocolId(null);
            setSenseStartAtStep(undefined);
            setSenseContext({});
          }}
        />
      )}

      {/* ── Draft Panel (middle) — renders draft-panel location primitives ── */}
      {!draftPanelDismissed && (
        <div className="border rounded-lg overflow-hidden flex flex-col w-80 flex-shrink-0 bg-card">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
            <span className="text-sm font-medium">Preview</span>
            <button
              onClick={() => {
                setDraftPanelDismissed(true);
                setActiveSenseProtocolId(null);
                setSenseStartAtStep(undefined);
                setSenseContext({});
                setSenseActions(null);
                setSenseRunning(null);
                for (const fnId of senseResultsRef.current.keys()) {
                  ctx.clearResult?.(fnId);
                }
                senseResultsRef.current.clear();
              }}
              className="text-muted-foreground hover:text-foreground text-xs"
            >×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {(sectionPrimitives['draft-panel'] && sectionPrimitives['draft-panel'].length > 0) ? (
              <PrimitiveRenderer
                primitives={sectionPrimitives['draft-panel']}
                onAction={handlePrimitiveAction}
              />
            ) : (
              <div className="text-xs text-muted-foreground border rounded-md px-3 py-2">
                Follow the steps to preview this change.
              </div>
            )}
            {/* Loading indicator when function is running */}
            {senseRunning && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <div className="h-3.5 w-3.5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                Running {senseRunning}...
              </div>
            )}
            {senseActions && senseActions.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-2 border-t">
                {senseActions.map((action, i) => (
                  <button
                    key={action.id || action.label || i}
                    onClick={async () => {
                      const executor = senseRunnerRef.current;
                      if (executor) await executor.handleAction(action);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      action.gate
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : action.stop
                        ? 'text-muted-foreground hover:bg-muted'
                        : 'bg-background border-border hover:bg-accent'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Headless Gate Runner — evaluates routing, shows UI for manual gates ── */}
      {activeGateDef && (
        <>
          <GateRunner
            gate={activeGateDef}
            snapshot={ctx.documentSnapshot}
            sectionId={block.id}
            config={{ _gateRules: ctx.metaRule?.gateRules }}
            onRouteDecided={(route) => {
              const finalRoute = gateSelectedRouteRef.current || route;
              gateSelectedRouteRef.current = null;
              // Extract draft items from sense results before clearing
              const draftResult = senseResultsRef.current.get('render-draft')
                || senseResultsRef.current.get('generate-gap-suggestion');
              const draftItems = (draftResult?.data as Record<string, unknown>)?.draftItems;
              // Clean up gate state
              setActiveGateId(null);
              setGateActions(null);
              setGateRunning(null);
              // Clear pipeline UI results
              ctx.clearAllResults(block.id);
              senseResultsRef.current.clear();
              // Start negotiate phase with draft items passed through
              if (finalRoute !== 'personal') {
                setNegotiateConfig(draftItems ? { draftItems } : {});
                setActiveNegotiateId(finalRoute);
                setNegotiateStage('propose');
              }
            }}
            onDismiss={() => {
              setActiveGateId(null);
              setGateActions(null);
              setGateRunning(null);
              ctx.clearAllResults(block.id);
              senseResultsRef.current.clear();
            }}
            onActionsChanged={setGateActions}
            onRunningChanged={setGateRunning}
            onFunctionResult={(fnId, result) => {
              ctx.injectResult?.(fnId, block.id, result);
            }}
            onExecutorReady={(exec) => {
              gateRunnerRef.current = exec;
            }}
          />
          {/* Gate panel UI — shows when gate has actions or results */}
          {(gateActions || gateRunning || (sectionPrimitives['right-panel'] && sectionPrimitives['right-panel'].length > 0)) && (
            <div className="border rounded-lg overflow-hidden flex flex-col w-80 flex-shrink-0 bg-card">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
                <span className="text-sm font-medium">{activeGateDef.name}</span>
                <button
                  onClick={() => { setActiveGateId(null); setGateActions(null); setGateRunning(null); }}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {sectionPrimitives['right-panel'] && sectionPrimitives['right-panel'].length > 0 && (
                  <PrimitiveRenderer
                    primitives={sectionPrimitives['right-panel']}
                    onAction={handlePrimitiveAction}
                  />
                )}
                {gateRunning && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <div className="h-3.5 w-3.5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    Evaluating...
                  </div>
                )}
                {gateActions && gateActions.length > 0 && (
                  <div className="flex gap-2 flex-wrap pt-2 border-t">
                    {gateActions.map((action, i) => (
                      <button
                        key={action.id || action.label || i}
                        onClick={async () => {
                          if (gateRunnerRef.current) await gateRunnerRef.current.handleAction(action);
                        }}
                        className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                          action.gate
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : action.stop
                            ? 'text-muted-foreground hover:bg-muted'
                            : 'bg-background border-border hover:bg-accent'
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Negotiate Runner Side Panel — only for propose stage (drafting) ── */}
      {activeNegotiateDef && negotiateStage === 'propose' && (
        <div className="border rounded-lg overflow-hidden flex flex-col w-80 flex-shrink-0 bg-card">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
            <span className="text-sm font-medium">{activeNegotiateDef.name}</span>
            <button
              onClick={() => { setActiveNegotiateId(null); }}
              className="text-muted-foreground hover:text-foreground text-xs"
            >×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <NegotiateRunner
              protocol={activeNegotiateDef}
              stage={negotiateStage}
              userRole={negotiateStage === 'propose' ? 'proposer' : 'reviewer'}
              snapshot={ctx.documentSnapshot}
              sectionId={block.id}
              config={{
                ...(ctx.metaRule?.pathConfigs?.[activeNegotiateId || ''] || {}),
                ...negotiateConfig,
                userId: ctx.currentUser.id,
                userName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email || '',
                pathId: activeNegotiateId,
              }}
              onFunctionResult={() => {
                // Negotiate results stay inside NegotiateRunner — not injected into pipeline
              }}
              onAction={(action, prim) => handlePrimitiveAction(action, prim)}
              mutationExecutor={{
                updateBlockRaw: (id, updates) => ctx.updateIntentBlockRaw(id, updates),
                updateBlock: (id, content) => ctx.updateBlock(id, content),
                addBlock: (opts) => ctx.addBlock(opts),
                deleteBlock: (id) => ctx.deleteBlock(id),
              }}
              onActionSubmit={(actionId) => {
                const userRole = negotiateStage === 'propose' ? 'proposer' : 'reviewer';

                if (actionId === 'cancel') {
                  setActiveNegotiateId(null);
                  setNegotiateConfig({});
                  return;
                }

                // Reviewer: after any deliberate action (acknowledge, etc.), they're done
                if (userRole === 'reviewer') {
                  setActiveNegotiateId(null);
                  setNegotiateConfig({});
                  prevPendingRef.current = null;
                  ctx.refreshProposals();
                  return;
                }

                // Proposer: advance to the next applicable stage
                const stages: Array<'propose' | 'deliberate' | 'resolve'> = ['propose', 'deliberate', 'resolve'];
                const currentIdx = stages.indexOf(negotiateStage);
                let nextStage: typeof stages[number] | null = null;

                for (let i = currentIdx + 1; i < stages.length; i++) {
                  const stageDef = activeNegotiateDef?.[stages[i]];
                  const who = stageDef?.who || '';
                  if (who === 'system' || who === '' || who === 'proposer') {
                    nextStage = stages[i];
                    break;
                  }
                }

                if (nextStage) {
                  setNegotiateStage(nextStage);
                } else {
                  setActiveNegotiateId(null);
                  setNegotiateConfig({});
                  prevPendingRef.current = null;
                  ctx.refreshProposals();
                }
              }}
            />
          </div>
        </div>
      )}


      {/* Cross-section impact panel — shows when another section's proposal affects this one */}
      {crossSectionImpact && (
        <div className="border rounded-lg overflow-hidden flex flex-col w-80 flex-shrink-0 bg-card">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-amber-50">
            <span className="text-sm font-medium text-amber-700">Incoming Change</span>
            <button
              onClick={() => {
                // Clear the cross-section impact results
                ctx.injectResult('cross-section-impact', block.id, {
                  functionId: 'cross-section-impact',
                  data: {},
                  ui: [],
                  computedAt: Date.now(),
                });
              }}
              className="text-amber-600 hover:text-amber-800 text-xs"
            >×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <PrimitiveRenderer
              primitives={crossSectionImpact}
              onAction={handlePrimitiveAction}
            />
          </div>
        </div>
      )}


      <div className="flex-1 min-w-0 border rounded-lg bg-card overflow-hidden flex flex-col">
        {/* Sense protocol UI (check buttons) */}
        {ctx.senseProtocolUI.filter(p => p.location !== 'outline-node').length > 0 && (
          <div className="border-b px-3 py-2">
            <PrimitiveRenderer
              primitives={ctx.senseProtocolUI.filter(p => p.location !== 'outline-node')}
              onAction={handlePrimitiveAction}
            />
          </div>
        )}

        {/* Running indicator */}
        {ctx.runningFunctions.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b text-xs text-muted-foreground">
            <div className="h-3 w-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            <span>Analyzing...</span>
          </div>
        )}

        {/* Discussion/Vote panels are now rendered in the outline (RootIntentBlock) */}
        {/* Inform notifications for affected sections still show here */}
        {pendingProposal && !activeNegotiateId && pendingProposal.pathId === 'decided' && pendingProposal.notification && (
          <button
            onClick={() => {
              const pathDef = getCoordinationPath(pendingProposal.pathId);
              if (pathDef) {
                setActiveNegotiateId(pendingProposal.pathId);
                setNegotiateStage('deliberate');
                setNegotiateConfig({
                  proposalId: pendingProposal.proposalId,
                  proposedBy: pendingProposal.proposedBy,
                  notification: pendingProposal.notification,
                });
              }
            }}
            className="flex items-center gap-2 px-3 py-2 border-b bg-amber-50 hover:bg-amber-100 transition-colors text-left w-full"
          >
            <span className="text-amber-600 text-sm">⚠</span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-amber-800">
                {pendingProposal.proposedBy} changed {(pendingProposal.notification as any)?.sourceSectionName || 'a section'}
              </span>
              <span className="text-xs text-amber-600 ml-1">— tap to review</span>
            </div>
          </button>
        )}


        {/* Summary section — all results (global banners + panel items) in one collapsible block */}
        {(() => {
          const allResults = [
            ...(sectionPrimitives['global'] || []),
            ...(sectionPrimitives['right-panel'] || []),
          ];
          if (allResults.length === 0) return null;

          if (summaryHidden) {
            return (
              <button
                onClick={() => setSummaryHidden(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 border-b transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Show Summary</span>
              </button>
            );
          }

          return (
            <div className="border-b">
              <div className="flex items-center justify-end px-3 py-1">
                <button
                  onClick={() => setSummaryHidden(true)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Hide
                </button>
              </div>
              <div className="px-3 pb-2">
                <PrimitiveRenderer
                  primitives={allResults}
                  onAction={handlePrimitiveAction}
                />
              </div>
            </div>
          );
        })()}

        {/* Normal editor */}
        {matchedWritingBlock ? (
          <TipTapEditor
            intent={block}
            writingBlock={matchedWritingBlock}
            roomId={ctx.roomId}
            user={ctx.currentUser}
            writingBlocks={ctx.writingBlocks as WritingBlock[]}
            deleteWritingBlock={ctx.deleteWritingBlock}
            updateIntentBlock={ctx.updateIntentBlockRaw}
            onRegisterYjsExporter={ctx.onRegisterYjsExporter}
            onRegisterMarkdownExporter={ctx.onRegisterMarkdownExporter}
            onRegisterParagraphAttributionExporter={ctx.onRegisterParagraphAttributionExporter}
            editorPrimitives={sectionPrimitives['writing-editor']}
            hoveredIntentId={ctx.hoveredIntentForLink}
            pureWritingMode={summaryHidden}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
            Loading editor...
          </div>
        )}
      </div>

      {/* outline-node primitives are rendered ON the actual outline blocks, not here */}
    </div>
  );
}

