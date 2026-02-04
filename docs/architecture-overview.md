# Architecture Overview

## 核心架构

系统有三个层次，对应三种关注范围：

```
Writing层（个人工作）
  │  作者日常的编辑，大部分是个人工作，不需要团队关注
  │
  │  当writing的变化大到影响intent →
  ▼
Intent层（共同基础）
  │  团队agreed的outline/意图结构
  │  变化 = common ground在变，团队需要aware
  │
  │  当intent的变化影响到其他人 →
  ▼
Team协商层（团队协调）
  │  讨论、决策、记录，达成新的agreement
  │  agreement达成后，baseline更新，新一轮循环开始
```

## Room的两个阶段

一个room有两个明确的阶段：

### Phase A: Outline Setup（写作前）

团队在开始写作前，先建立完整的intent结构作为共同基础。

**流程：**
```
1. 导入outline（markdown导入）或手动创建intent hierarchy
2. 组织层级关系（parent-child, indent/outdent）
3. 标注intent之间的依赖关系（手动画依赖线）
4. AI检测依赖 → 推荐额外的依赖关系
   - 层级约束：parent约束children的scope和方向（自动）
   - 顺序依赖：后面的section建立在前面的基础上（AI推断）
   - 论证依赖：一个claim依赖另一个claim成立（手动 + AI推荐）
   - 一致性约束：多处必须不矛盾（AI检测）
   - scope约束：一处定义的scope约束其他所有地方（AI检测）
5. 分配任务给team members
6. 团队确认 → "Agree & Start Writing" → 创建baseline v1
```

**Setup阶段的UI：**
- Writing editor不可用或弱化（还没开始写）
- Intent panel全屏焦点
- 侧边依赖线展示intent之间的关系：
  - 实线 = 手动标注的确认依赖
  - 虚线 = AI推荐的待确认依赖（点击accept变实线）

**依赖关系的展示（侧边依赖线）：**
```
  ● Thesis ─────────────────────┐
  ├── Body 1: Engagement ───┐   │
  ├── Body 2: Accessibility │   │
  ├── Body 3: Counter ◄─────┘   │  (Body 3 depends on Body 1)
  └── Conclusion ◄──────────────┘  (Conclusion depends on Thesis)
```

### Phase B: Collaborative Writing（写作中）

团队基于agreed的intent结构开始写作。从这一刻起，系统的drift检测和pipeline开始运行。

- Writing editor激活
- 系统开始ambient监测alignment（段落切换 / 每5分钟）
- 完整pipeline可用
- Intent可以更新但需要走pipeline流程

## Baseline Intent

系统维护一个**baseline intent** — 团队最近一次agreed的intent状态。所有"drift"和"delta"都相对于这个baseline来衡量。

Baseline包含：
- 每个intent block的内容
- Intent hierarchy的结构（层级关系）
- Intent之间的依赖关系
- 任务分配

Baseline不是固定的，通过循环持续演进：

```
初始agreement（baseline v1）
  → 作者写作，可能drift
  → 系统检测到drift越过intent边界
  → 团队协商，达成新agreement
  → baseline更新（v2）
  → 新循环开始
```

历史决策有权重：如果团队之前明确讨论过某个intent，后续违反该决策的变化应该被更积极地escalate。

## 一个核心操作

不管变化如何进入系统，核心操作是同一个：

```
Delta（来自任何来源）→ Simulation → 自适应展示
```

Delta的三个来源（三个入口）：

| 入口 | 场景 | Delta如何产生 |
|---|---|---|
| 系统检测 | 作者写着写着drift了，自己没意识到 | 系统对比当前状态和baseline |
| 用户预览 | 作者想改，先看看影响 | 用户提供假设性变化，系统生成假设性delta |
| 用户声明 | 作者已经改了，想告诉团队 | 系统对比修改前后的状态 |

三个入口进入同一条pipeline。Implicit检测到drift后，作者aware了，就转化为explicit — 后续流程和explicit入口完全一样。

## Staged Pipeline

系统在后台跑完整的评估链，ambient地展示结果。Delta的大小决定pipeline走多深：

```
Stage 1: AWARENESS（个人）
  Simulation评估delta的重要性（完整评估，包括是否影响他人）
  小delta → ambient颜色（绿/黄/橙/红） → 编码完整的评估结果
  用户可以点击进入详细交互 ↓

Stage 2: CROSS-LEVEL TRANSLATION（共同基础）
  Simulation在两个层面之间翻译
  Writing变化 → 提炼出intent层面的含义
  Intent变化 → 生成writing层面的具象
  只影响自己 → 作者review并apply → 到此为止
  影响其他人 → 继续 ↓

Stage 3: IMPACT & NEGOTIATION（团队）
  Simulation展示对所有人的影响（通过依赖关系级联）
  团队围绕具体的simulated结果进行协商
  达成agreement，记录决策，baseline更新
```

Ambient颜色编码了完整的评估结果：

| 颜色 | 含义 | 对应Stage |
|---|---|---|
| 绿 | Aligned，没有drift | — |
| 黄 | Minor drift，不需要行动 | Stage 1 |
| 橙 | Intent需要更新 | Stage 2 |
| 红 | 会影响其他人 | Stage 3 |

## Simulation的三重角色

同一个simulation能力，在不同stage承担不同角色：

- **Stage 1 — 评估者**：这个变化重要到需要越过intent边界吗？会影响其他人吗？
- **Stage 2 — 翻译者**：这个变化在另一个层面意味着什么？（writing→intent是提炼，intent→writing是生成）
- **Stage 3 — 协商素材**：这个变化对其他人具体意味着什么？通过依赖关系级联，生成具体的simulated结果作为讨论基础。

## 开发分期

**Phase 0**: Outline Setup
- Room阶段系统（setup → writing的切换）
- Intent依赖关系的数据模型和UI（侧边依赖线）
- 手动标注依赖 + AI推荐依赖
- "Agree & Start Writing" → 创建baseline v1

**Phase 1**: Ambient Drift Detection + 完整评估链
- 后台检测writing和intent之间的drift（段落切换 / 定时）
- 完整评估链：drift大小 → 是否越过intent边界 → 是否影响其他人
- Ambient颜色展示（绿/黄/橙/红）
- 两侧同步展示（writing panel + intent panel）

**Phase 2**: Cross-level Translation + 详细交互
- 用户点击ambient indicator → 进入详细视图
- Writing→Intent的提炼能力
- Intent→Writing的生成能力
- Highlight展示和proposed changes
- 统一的交互界面（三个入口汇聚点）

**Phase 3**: Impact & Negotiation
- 通过依赖关系级联影响传播
- Diff view和impact map
- 协商流程和决策记录
- Baseline更新循环
