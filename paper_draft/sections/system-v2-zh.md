# Section 5: GroundingKit

Section 4 定义了协同写作的协调设计空间——Awareness 和 Negotiation 的维度及其选项空间。本节介绍 GroundingKit，一个基于该设计空间构建的开放系统。GroundingKit 不是设计空间的某一种固定实现，而是提供了一个开放的架构，让开发者可以贡献新的感知能力和协调方式，让团队可以从中选择和配置自己的协调 pipeline。

GroundingKit 由三层组成：**Foundation**（BNA 表征 + UI 基础设施）、**Protocol**（开发者通过协议扩展感知和协商能力）、**Team Configuration**（团队选择和配置协调 pipeline）。


## 5.1 Foundation

### Living Outline as BNA

GroundingKit 采用 living outline 作为 BNA 的具体形式：一个结构化的、持续演化的 outline，每个节点承载意图描述、依赖标注和归属信息。Living outline 满足 Section 4.1 定义的五个条件：

- **C1（意图单元）**：每个 outline 节点描述一个意图——比具体文字更抽象，但比标题更具体。不同写作者可以用不同方式实现同一个意图。
- **C2（依赖结构）**：outline 支持节点之间的类型化依赖（depends-on, supports, must-be-consistent），以及层级结构（section 包含 sub-intents）。
- **C3（归属）**：每个节点有明确的负责人。
- **C4（可追踪）**：系统持续计算写作和意图之间的对应关系，在任何时刻都可以回答"这个意图被落实了吗"。
- **C5（可协商）**：outline 是团队协商的场所——对意图、依赖、归属的任何修改都通过协调流程进行。

在写作过程中维护 living outline 的过程本身就是在推动协商的边界：写作者不断更新自己对意图的理解，outline 不断演化以反映团队的最新共识。

### Data Model

GroundingKit 将协商空间抽象为一个统一的数据模型。这是所有 function 的唯一输入接口——一个 function 能看到文档的完整当前状态和交互历史。数据模型分两层：**结构层**（文档的静态结构）和**交互层**（协调流程的动态状态）。

**结构层——BNA + Writing**

结构层直接对应 Section 4.1 定义的协商空间：

```
BNA 层:
  IntentItem {
    id, content              // 意图描述
    parentId                 // 层级结构（section → sub-intents）
    createdBy, modifiedBy    // 谁创建、谁最后改
    changeStatus             // stable / proposed / disputed
  }
  Dependency {
    fromId, toId             // 哪两个 IntentItem 之间
    type                     // depends-on / must-be-consistent / builds-upon
    source                   // manual / ai-suggested / ai-confirmed
  }

Writing 层:
  Section {
    intentId                 // 绑定哪个 IntentItem
    assignee                 // 负责人
    content                  // 写作内容
    paragraphs: Paragraph[] {
      text                   // 段落文本
      author                 // 谁写的
      lastEditBy             // 谁最后改的
      editedAt               // 最后编辑时间
    }
  }
```

IntentItem 和 Section 通过 `section.intentId` 直接绑定——这是协商空间中 BNA → Writing 关系的具体表达。归属（assignee）是 Section 的属性，不是独立的表。BNA 层是可替换的：living outline 中 IntentItem 是层级节点，argument map 中是 claim/evidence 节点，但接口不变。Writing 层固定——始终是和 IntentItem 对应的 Section。

**交互层——协调流程的动态状态**

除了文档结构，function 还需要知道协调流程中发生了什么——之前的 function 输出了什么结果、当前有没有进行中的提议、历史决议是什么。交互层暴露这些数据：

```
FunctionResult {
  functionId               // 哪个 function 产生的
  targetId                 // 作用于哪个 IntentItem / Section
  output                   // 输出数据（如 drift 分析结果）
  timestamp
}

Proposal {
  intentId                 // 针对哪个 IntentItem
  type                     // modify / add / delete / reassign
  proposedBy               // 谁发起的
  status                   // pending / approved / rejected
  votes: Vote[] {
    userId, action, comment, timestamp
  }
  attachedResults          // 自动附加的 function 结果（如 impact 分析）
  resolvedAt
}
```

一个 function 运行时能看到：文档当前结构 + 之前其他 function 的结果 + 当前协商状态。例如：assess-impact 运行时可以读取 check-drift 之前的输出，不需要重新计算偏离度；Gate 的 threshold 判断可以基于多个 function result 的组合；Decision History 维度通过查询历史 Proposal 实现。

系统负责在调用 function 前组装完整的数据——开发者不需要关心数据如何从实时协作状态中构建。

### View Layer

View 层在数据模型之上暴露一组声明式的渲染接口。开发者不需要接触底层数据或编写 UI 代码——只需声明"在哪个数据对象上显示什么类型的 UI"，系统负责渲染。

协商空间由 BNA 和 Writing 构成，系统因此有两个核心 view 和一个全局 panel：

- **Outline View**（左）：渲染 BNA。当前实例是 living outline；换成 argument map 就变成论证图。开发者的声明不变，渲染方式由 BNA adapter 决定。
- **Writing View**（右）：渲染写作内容。段落化的编辑器，和 Outline View 中的 IntentItem 存在绑定关系。
- **Panel**：全局展示空间，预置一系列槽位，承载分析结果、diff 对比、投票界面、跨对象的汇总信息。

每个 View 内置了一组预设的 **UI 组件**，每个组件有开放的**槽位**（slot）供开发者填充数据。类似调用 UI 库的 Card 组件——Card 的布局和样式已经预设好，开发者只需要定义 title、content、actions 等槽位的内容。

每种实体的 UI 能力由实体本身的性质决定。系统基于实体类型提供底层渲染能力，更复杂的组件（如投票界面、讨论 thread）在这些能力之上构建。

**IntentItem**（列表/树形条目）——可以在条目旁、条目下方操作：

| 能力 | 槽位 | 说明 |
| --- | --- | --- |
| Indicator | icon, value, color | 条目旁的状态标记（图标、数值、颜色） |
| Expandable | content | 条目下方可展开的内容区域（放分析结果、diff、任何自定义内容） |
| Actions | buttons[], menu | 条目上的操作入口（按钮、菜单） |

**Paragraph**（文字内容）——可以在文字内部、文字旁边操作：

| 能力 | 槽位 | 说明 |
| --- | --- | --- |
| Inline | range, style, tooltip | 文字内部：高亮、划线、标记、badge |
| Side | anchor, content | 文字旁边：comment、annotation、side note |
| Block | position, content | 段落上方/下方：banner、提示条 |

**Dependency**（连线）——可以在连线上操作：

| 能力 | 槽位 | 说明 |
| --- | --- | --- |
| State | style, color, label | 连线的视觉状态（正常/警告/冲突） |

**Panel**（全局容器）——可以承载任意组件：

| 能力 | 槽位 | 说明 |
| --- | --- | --- |
| Card | title, content, footer | 通用卡片容器 |
| Widget | content | 自由渲染区域（开发者完全控制内容） |

基于这些底层能力，我们构建了一组常用的高层组件（如 ResultList、DiffView、VoteWidget、CommentThread），作为内置 function 的渲染实现。开发者也可以用同样的底层能力构建自己的自定义组件。

开发者不需要知道 IntentItem 在当前 BNA 中长什么样——系统根据 BNA adapter 自动渲染。底层能力和槽位是开放的，未来可以扩展。

## 5.2 Protocol

GroundingKit 通过两个声明式 protocol 让开发者贡献新能力：**Awareness Protocol** 对应 Section 4.2.1 的感知维度，**Negotiation Protocol** 对应 Section 4.2.2 的协商维度。

### Awareness Protocol

一个 awareness function 声明四个字段：

| 字段 | 说明 |
| --- | --- |
| **Target** | 作用于协商空间中的什么位置——IntentItem、Section、Dependency、或整个 Document |
| **Trigger** | 什么时候运行——ambient（持续监测）、on-action（特定事件触发）、on-demand（手动请求）、post-resolve（决议后重新计算） |
| **Executor** | 怎么检测——prompt（AI 模型 + 配置参数）或 local（本地函数 + 配置参数） |
| **Display** | 结果渲染到哪里——声明实体类型 + 底层能力 + 槽位数据绑定 |

### Negotiation Protocol

一个 negotiation path 声明三组字段，对应 Propose → Deliberate → Resolve：

| 阶段 | 字段 | 说明 |
| --- | --- | --- |
| **Propose** | Initiation | 谁/什么可以发起——writer、system-suggested、owner-only |
| | Scope | 可以提议什么——修改意图、添加/删除意图、调整依赖、重新归属 |
| | Framing | 提议附带什么——自动附加哪些 awareness function 的结果作为上下文 |
| **Deliberate** | Participation | 谁参与——依赖链相关方、所有 owner、全体 |
| | Mechanism | 用什么方式——voting、discussion、silent-approval |
| | Response | 怎么回应——approve、reject、counter-propose、defer |
| **Resolve** | Criteria | 什么算达成——unanimous、majority、stakeholder、proposer |
| | Fallback | 没达成怎么办——维持原状、超时自动生效、升级讨论 |
| | Outcome | 怎么生效——更新 BNA、通知相关方、触发 awareness 重新计算 |

### How It Works

通过 `registerFunction()` 注册一个 function 后，系统自动完成集成——类似于安装一个插件：

1. **注册**：function 声明 target、trigger、executor、output、display。注册后系统知道这个 function 的存在。
2. **触发**：系统根据 trigger 字段在正确的时机调用 function——ambient 时持续监测文档变化，on-action 时在特定事件（如提交提议）后触发，on-demand 时由用户手动请求。
3. **执行**：系统传入当前文档数据（IntentItem + Section + Dependency + 交互层数据）。对于 prompt executor，系统将数据和用户配置注入提示词，调用 AI API，解析返回结果到 output schema。对于 local executor，直接运行函数。
4. **渲染**：系统根据 display 声明，将 output 数据绑定到对应实体的 UI 槽位——不需要开发者编写任何 UI 代码。
5. **存储**：output 存入交互层的 FunctionResult，后续 function 可以读取（如 assess-impact 可以读取 check-drift 的结果）。

Negotiation path 的注册类似：声明 Propose/Deliberate/Resolve 的配置后，系统自动提供对应的 UI（提议表单、投票界面、讨论 thread）和决议逻辑。

### Examples

以下两个例子展示通过 protocol 定义能力的完整声明。

**例 1：Drift detection（AI）**

```typescript
registerFunction({
  id: 'check-drift',
  target: 'section',
  trigger: 'ambient',

  executor: {
    type: 'prompt',
    system: `Compare writing against assigned intent. For each sentence,
             classify alignment. Return coverage and per-sentence results.`,
    config: {
      // 用户可以输入自定义的检查重点，注入到 prompt 中
      focusPrompt: { type: 'fill', default: 'Check argument structure and evidence coverage',
                     label: 'What should the checker focus on?' }
    }
  },

  output: {
    coverage: 'number',
    coverageLevel: 'string',        // covered / partial / deviated
    sentences: [{
      range: { from: 'number', to: 'number' },
      alignment: 'string',          // covered / deviated / orphan
      intentId: 'string | null',
      explanation: 'string'
    }]
  },

  display: [
    { on: 'Paragraph', ability: 'Inline',
      forEach: '{{output.sentences}}',
      slots: { range: '{{item.range}}', style: '{{item.alignment}}',
               tooltip: '{{item.explanation}}' } },
    { on: 'IntentItem', ability: 'Indicator',
      slots: { value: '{{output.coverage}}', color: '{{output.coverageLevel}}' } }
  ]
})
```

Config 中的 `focusPrompt`（type: fill）让团队输入自定义的检查重点——这段文本会被注入到 AI 的 prompt 中，改变检测的关注点。

**例 2：Heading consistency（非 AI）**

```typescript
registerFunction({
  id: 'check-heading-consistency',
  target: 'section',
  trigger: 'ambient',

  executor: {
    type: 'local',
    fn: (section, intent) => {
      const heading = section.paragraphs[0]?.text ?? ''
      const match = heading.toLowerCase().includes(intent.content.toLowerCase())
      return { heading, intentContent: intent.content, consistent: match }
    }
  },

  output: {
    heading: 'string',
    intentContent: 'string',
    consistent: 'boolean'
  },

  display: [
    { on: 'IntentItem', ability: 'Indicator',
      when: '{{!output.consistent}}',
      slots: { icon: 'warning', color: 'yellow' } },
    { on: 'Paragraph', ability: 'Side',
      when: '{{!output.consistent}}',
      slots: { anchor: 'first',
               content: 'Heading does not match intent: "{{output.intentContent}}"' } }
  ]
})
```

### Built-in Capabilities

Section 4 定义了协商空间中的关系（Writing ↔ Intent, Writing ↔ BNA, Writing ↔ Others, BNA 内部依赖）和协调循环的各个阶段（Awareness → Gate → Propose → Deliberate → Resolve）。基于这个设计空间，我们预定义了两类能力：**Awareness Functions**（认知支撑能力）和 **Negotiation Paths**（协商流程规则）。

#### Awareness Functions

Awareness Function 是帮助写作者和团队感知、理解和评估协商空间中关系变化的认知支撑能力。它们不局限于 Gate 之前——在协调循环的任何阶段，只要需要理解关系状态，都可以被触发。一个 Awareness Function 可以被挂载到写作操作上（修改 intent、写完一段话、新开一段话），也可以被挂载到 Negotiation Path 的节点上（Deliberate 时辅助参与者决策）。

我们基于 Section 4 的四种关系，预定义了以下 function。按它们支撑的认知需求组织：

**感知关系状态**——帮助写作者持续理解自己在协商空间中的位置。

- **check-drift**（Writing ↔ Intent, Writing ↔ BNA）：写作时持续运行，检测写作是否覆盖意图、是否和团队方向一致。在 Writing View 高亮偏离句子，在 Outline View 显示覆盖率。这是写作者最基本的认知需求——我写的东西和团队共识是什么关系？
- **check-cross-consistency**（Writing ↔ Others）：写作时持续运行，检测我的写作和依赖链上其他人的写作是否一致。当 Alice 修改了 Introduction 中的研究问题表述，这个 function 会提醒 Bob 他的 Method section 可能需要调整。
- **discover-dependencies**（BNA 内部依赖）：在 Setup 阶段和 outline 变更时运行，分析 outline 结构，发现隐性的依赖关系并建议显式标注。

**评估影响**——帮助写作者理解一个潜在改变的后果，为 Gate 判断提供数据。

- **assess-change-impact**（Scope, Severity, Propagation）：当写作者考虑修改或删除一个意图时，评估影响范围——波及哪些 section、影响多大、通过依赖链传播多远。这个 function 的输出直接喂给 Gate threshold 判断。
- **preview-change-on-writing**（Propagation）：将一个潜在修改 project 到受影响的 section，用 diff 展示写作会怎么变化。写作者用它评估"我要不要提议"；参与者在 Deliberate 时用它理解"这个提议对我意味着什么"——同一个 function 在不同阶段服务于不同的认知需求。

**辅助协商过程**——在 Propose、Deliberate、Resolve 阶段提供认知支撑。

- **suggest-intent-for-orphan**：写作者发现自己写了意图之外的内容时，建议为它创建新的 IntentItem，帮助发起有上下文的提议。
- **frame-proposal**：发起提议时自动组织上下文——附加影响分析、关联历史决议、列出受影响方。
- **preview-alternatives**：Deliberate 阶段，参与者探索 counter-propose 时，并排比较多个方案对写作的影响。
- **preview-resolution-effect**：Resolve 阶段，预览接受提议后 BNA 和写作的最终状态。

#### Negotiation Paths

Negotiation Path 定义协商的流程规则——谁参与、怎么审议、什么算达成。每个 Path 默认挂载了一组 Awareness Function，在流程的关键节点自动提供认知支撑。团队可以选择启用或关闭这些默认挂载，以避免过度检测。

| Path | Mechanism | Criteria | 默认挂载的 Function |
| --- | --- | --- | --- |
| Inform | 通知 | immediate | assess-change-impact（自动附加影响摘要） |
| Ask for Input | 征求意见 | single-approval | assess-change-impact + preview-change-on-writing |
| Team Vote | 投票 | threshold (majority) | frame-proposal + preview-change-on-writing + preview-resolution-effect |
| Discussion | 异步讨论 | proposer-closes | frame-proposal + preview-alternatives |

例如：Team Vote 路径默认在 Propose 时运行 frame-proposal（自动组织上下文），在 Deliberate 时运行 preview-change-on-writing（让投票者看到影响），在 Resolve 前运行 preview-resolution-effect（让团队预览决议后状态）。团队可以关闭其中任何一个——比如小团队可能觉得 preview-resolution-effect 不必要，直接关掉。

所有能力通过 protocol 注册而非硬编码。未来社区可以贡献新的 Awareness Function 和 Negotiation Path，团队从不断增长的能力池中选择。


## 5.3 Team Interface

### Setup：定义团队的协调 Pipeline

写作开始前，团队通过 Setup 界面定义自己的协调 pipeline——选择启用哪些能力、配置 Gate 规则、选择 Negotiation Path。这个过程类似于团队在为自己制定协作的 MetaRule。

Setup 的主界面围绕预定义的能力展开一组引导问题：

**关于 Awareness（感知什么）：**
- 是否启用 check-drift？如果启用，检查时重点关注什么？（→ 配置 focusPrompt）
- 是否启用 check-cross-consistency？（→ 是否需要跨 section 一致性检测）
- 是否启用 discover-dependencies？（→ 是否需要系统帮忙发现隐性依赖）

**关于 Gate（什么时候触发协商）：**
- 什么程度的偏离需要通知团队？（→ 配置 Severity threshold）
- 影响到其他人时自动触发还是手动决定？（→ 配置 Scope threshold + Agency）

**关于 Negotiation（怎么协商）：**
- 修改意图时用什么方式决定？（→ 选择 Path：Inform / Ask for Input / Team Vote / Discussion）
- 谁参与决定？（→ 配置 Participation）
- 多久没有回应算超时？（→ 配置 timeout）

回答完成后，系统生成一个可视化的协调 pipeline——从 Awareness 到 Gate 到 Negotiation 的完整流程，标明每个节点启用了什么 Function 和 Path。团队可以在 pipeline 图上进一步修改任何配置。

[Figure: Setup 界面——左侧引导问题，右侧生成的协调 pipeline 图（可编辑）]

### Writing & Coordination Interface

进入写作后，所有界面根据团队配置的 pipeline 自适应加载——启用了哪些 Function 决定了 Outline View 和 Writing View 上显示什么标注，选择了哪个 Path 决定了协商界面提供什么交互（投票 / 讨论 / 静默同意）。团队看到的界面是他们在 Setup 中定义的 pipeline 的直接体现。

### 配置举例

以下两个例子展示不同团队如何通过 Setup 定义完全不同的协调 pipeline。

**例 1：两人同步合写博客。**

Setup 回答：check-drift 启用（focusPrompt: "check overall argument flow"）/ cross-consistency 关闭 / Gate: 只在 fundamental 时触发 / Path: Inform / Participation: all

生成的 pipeline：

```
Writing → check-drift (ambient, loose)
       → Gate: severity ≥ fundamental
       → Inform (通知对方，无需回应)
       → 口头沟通解决
```

效果：轻量感知，宽松 gate，大部分改动在个人空间解决。Outline View 只显示基本覆盖率，Writing View 只在方向性偏离时高亮。

**例 2：五人异步合写学术论文。**

Setup 回答：check-drift 启用（focusPrompt: "check argument structure and evidence alignment"）/ cross-consistency 启用 / discover-dependencies 启用 / Gate: local + specific 就触发 / Path: Team Vote (majority, 48h timeout) / Participation: 依赖链相关方

生成的 pipeline：

```
Writing → check-drift (ambient, strict) + check-cross-consistency (ambient)
       → Gate: severity ≥ local AND scope ≥ specific
       → Team Vote
           Propose: frame-proposal (自动附加影响分析)
           Deliberate: preview-change-on-writing (diff) + preview-alternatives
           Resolve: majority, 48h timeout, preview-resolution-effect
       → 更新 BNA → 触发 awareness 重新计算
```

效果：细粒度感知，严格 gate，正式投票流程。Outline View 显示覆盖率 + 依赖状态 + 变更标记，Writing View 显示对齐高亮 + 一致性警告，Deliberate 时自动展示 diff 和方案对比。

[Figure: 两个团队的 pipeline 对比图——左边轻量（两个节点），右边完整（多个节点和分支）]
