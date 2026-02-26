# Alignment Detection 逻辑与流程

## 分析单位

**一个 Section** = (Root Intent + 所有 Sub-intents) 作为整体，与 **Writing 内容** 做对比。

---

## 分析步骤

```
Step 1: 句子映射
  Writing 的每个句子 → 映射到哪个 intent（或 beyond-outline）

Step 2: Per-intent 覆盖分析
  每个 intent（root + sub）→ covered / partial / missing / contradicted

Step 3: 整体判断
  (a) 这个 Outline 是否需要修改？
  (b) 与其他 section 的关系如何？
```

---

## 输出结构

```typescript
type AlignmentCheckResult = {
  // === Step 1: 句子映射（用于 UI 双向关联）===
  sentenceMapping: Array<{
    sentencePreview: string;
    intentId?: string;           // undefined = beyond outline
    relationship: 'supports' | 'contradicts';
  }>;

  // === Step 2: Per-intent 覆盖 ===
  intentCoverage: Array<{
    intentId: string;
    intentText: string;
    status: 'covered' | 'partial' | 'missing' | 'contradicted';
    gap?: string;  // partial/missing 时的说明
  }>;

  // === Step 3: 整体判断 ===

  // (a) Outline 是否需要修改？
  needsOutlineChange: boolean;

  // (b) 与其他 section 的关系
  dependencyConflicts?: Array<{
    relatedSectionId: string;
    relatedSectionTitle: string;
    description: string;
  }>;

  // === 总结 ===
  summary: string;
};
```

---

## 判断逻辑

### needsOutlineChange 的推导

```typescript
needsOutlineChange =
  intentCoverage.some(i => i.status === 'missing') ||      // 有 intent 没写到
  intentCoverage.some(i => i.status === 'contradicted') || // 写的和 intent 冲突
  sentenceMapping.some(s => s.intentId === undefined);     // 写了 outline 没有的内容
```

### 前端推导影响范围

```typescript
function deriveImpactScope(result: AlignmentCheckResult) {
  // Cross-Section Impact: 与其他 section 有冲突
  if (result.dependencyConflicts?.length > 0) {
    return 'cross-section-impact';
  }

  // Outline Impact: 需要修改 outline
  if (result.needsOutlineChange) {
    return 'outline-impact';
  }

  // Minor Drift: 有 partial
  const hasPartial = result.intentCoverage.some(i => i.status === 'partial');
  if (hasPartial) {
    return 'minor-drift';
  }

  // Aligned: 全部 covered
  return 'aligned';
}
```

---

## 展示方式

### 影响范围 → 状态指示器

| 影响范围 | 图标 | 颜色 | 说明 |
|---------|------|------|------|
| aligned | ✓ | 绿色 | 完全对齐 |
| minor-drift | ◐ | 黄色 | 有 partial，继续写就行 |
| outline-impact | ⚠ | 橙色 | 需要修改 outline |
| cross-section-impact | ● | 红色 | 影响其他 section |

### Per-intent 状态 → Intent 侧展示

| 状态 | 图标 | 交互 |
|------|------|------|
| covered | ✓ | Hover → Writing 高亮 |
| partial | ◐ | Hover → 显示 gap |
| missing | ○ | Hover → 显示 gap |
| contradicted | ✕ | Hover → Writing 冲突段落高亮 |

### 句子映射 → Writing 侧展示

| relationship | 背景色 | 交互 |
|--------------|-------|------|
| supports | 无 | Hover → Intent 高亮 |
| contradicts | 红色 | Hover → Intent 高亮 |
| beyond-outline | 黄色 | Click → 选项 |

---

## 触发方式

| 触发方式 | 时机 |
|---------|------|
| Enter 键 | 用户按下 Enter 完成一个段落 |
| 5 分钟 fallback | dirty section 超过 5 分钟未检测 |
| 手动 Check 按钮 | 用户点击 Writing 区域的 "Check" 按钮 |
| 全局 Check All | 用户点击 header 的 "Check All" 按钮 |
