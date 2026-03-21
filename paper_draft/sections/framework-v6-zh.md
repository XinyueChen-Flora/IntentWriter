# Section 4: 协同写作的协调设计空间（v6）

我们提出将协同写作重新构想为一个围绕团队 shared understanding 进行协商的过程。当前的协同写作工具把写作本身作为协作的唯一媒介——所有的协调都发生在文字流中，通过 track changes、comments 和口头沟通。我们提出一种不同的结构：团队维护一个独立于写作的 shared understanding 表征（BNA），个人写作在这个 shared understanding 的框架内进行，当 shared understanding 需要变化时通过一个显式的 pipeline 来协商。

本节首先定义协同写作中的 BNA 及其与写作之间的关系（4.1），然后定义围绕这些关系的协调 pipeline 和设计空间（4.2）。


## 4.1 BNA 与协商空间

### 协同写作中的 BNA

Lee 的 Boundary Negotiating Artifact (BNA) 描述了一种在非常规协作中出现的现象：当没有预设标准时，参与者会创造 artifact 来建立和演化共识——这种 artifact 不是被动传递信息的载体，而是主动参与协商的工具。协同写作正是这种场景：每个项目都需要团队自行构建"我们要写什么"的共识，并在写作过程中持续维护它。

我们将 BNA 应用到协同写作中，定义它为团队 shared understanding 的外化结构——团队共同 follow 的、关于"要写什么"的共识表达。有了这个结构，写作行为不再只是文字编辑，而是获得了相对于团队共识的协调意义；隐性的跨 section 关系变得可追踪；协商可以发生在意图层面而不是文字层面；awareness 和 negotiation 有了具体的着力点。

要在协同写作中发挥这些作用，BNA 需要满足以下条件：

**C1: 由意图单元组成。** BNA 的基本单位是意图单元——每个意图单元表达团队对文档某一部分"应该传达什么"的共识。意图单元比具体写作更抽象，允许不同的实现方式，让团队可以在意图层面协商而不是在句子层面争论。

**C2: 有内部依赖结构。** 意图单元之间存在显式的依赖关系（depends-on, supports, must-be-consistent）。这些依赖在纯文字流中是隐性的——通过 BNA 变得可见，让跨 section 的影响可以被追踪。

**C3: 有归属。** 每个意图单元有明确的负责人。这让协调有了具体的对象——当一个意图需要讨论时，知道应该找谁。

**C4: 与 writing 可追踪。** BNA 和写作之间存在可追踪的对应关系。在任何时刻都可以回答"这个意图被落实了吗"。没有这种追踪，BNA 就只是一个死的清单。

**C5: 动态可协商。** BNA 不是写完就固定的计划，而是在写作过程中持续演化的 shared understanding。团队成员可以提议修改，但修改需要经过协商——这就是 pipeline 存在的原因。

### BNA 的具体形式

满足 C1-C5 的 BNA 可以有不同的具体形式。以下两个例子展示了意图单元、依赖和归属在不同写作场景下的具体样子。

**例 1：Living Outline。** 一个团队合写一篇学术论文。他们的 BNA 是一个 living outline，每个条目就是一个意图单元：

| 意图 | 内容 | 归属 |
| --- | --- | --- |
| I1 | Introduction: 用一个真实场景说明协作中的协调困难 | Alice |
| I2 | Research Question: 明确"如何为协同写作提供协调基础设施" | Alice |
| I3 | System Design: 说明为什么选择 living outline 作为共识的外化形式 | Bob |
| I4 | Evaluation: 部署研究的方法和发现 | Carol |

依赖关系：I3 depends-on I2（系统设计必须回应研究问题）；I4 must-be-consistent I3（评估必须与系统设计对应）。

这意味着：如果 Alice 修改了研究问题 I2 的表述，Bob 的系统设计 I3 可能需要调整——这种依赖在纯写作中不可见，但在 BNA 中被显式表达。

**例 2：Argument Map。** 一个团队合写一份政策建议报告。他们的 BNA 是一个论证图，每个节点是一个意图单元：

| 意图 | 内容 | 类型 | 归属 |
| --- | --- | --- | --- |
| C1 | AI 系统需要强制性的透明度要求 | claim | Alice |
| E1 | 欧盟 AI Act 的实施效果数据 | evidence | Bob |
| C2 | 过度透明会损害商业竞争力 | counter-claim | Carol |
| E2 | 技术公司的反馈调查 | evidence | Carol |

依赖关系：E1 supports C1；C2 challenges C1；E2 supports C2；C2 must-be-consistent C1（两个对立主张必须被同时回应）。

这意味着：如果 Alice 修改了主张 C1，Bob 的证据 E1 可能需要重新对齐；如果 Carol 的反驳 C2 被团队接受，C1 的写作需要相应调整。

两种形式不同，但都满足 C1-C5：由意图单元组成，有内部依赖，有归属，与 writing 可追踪，动态可协商。

[Figure: 两种 BNA 形式并排——左边 living outline，右边 argument map，展示意图单元、依赖连线、归属标注。]


### 协商空间

BNA、Writing、以及它们之间的依赖关系共同构成了协同写作的**协商空间**。这个空间是协调发生的基础。

BNA 是团队的 shared understanding——关于"写什么"的共识。Writing 是个人对这个共识的落实——在 shared understanding 框架内的自由实现。以前，这两者混在同一个文档里，个人创作和团队协调纠缠在一起。引入 BNA 后，shared understanding 有了独立的载体，writing 回归个人的实现空间。

协商空间中存在四种关系：

**BNA 内部**——意图之间的依赖。如上面例子中 I3 depends-on I2，E1 supports C1。这些依赖让文档的结构逻辑从隐性变为显性。

**BNA → Writing**——shared understanding 指导个人写作。每个意图单元定义了对应写作的期望。Bob 写系统设计时，他 follow 的是 I3 定义的意图，具体怎么写是他的自由。

**Writing → BNA**——写作反馈给 shared understanding。写作过程中，实际内容和意图的关系持续变化——写着写着可能偏离了意图，可能发现新角度，可能发现一个意图不再合适。

**Writing ↔ Writing**——通过 BNA 的间接关系。Alice 的 Introduction 和 Bob 的 Method 在文字流中看似独立，但因为 I3 depends-on I2，Alice 对研究问题的修改会波及 Bob 的系统设计。这种关系在纯写作中不可见，通过 BNA 变得可追踪。

这些关系的变化就是协调的触发点。有了可追踪的关系，才有可能在它们之上建立协调的 pipeline。

[Figure: 协商空间——左边 BNA（shared understanding），右边 Writing（个人落实），中间展示四种关系的实际连线。]


## 4.2 协调设计空间

4.1 定义了协同写作的协商空间：BNA 外化了团队共识，Writing 是个人的落实，四种关系将二者连接。当前工具没有这个空间——track changes 记录谁改了什么字，但没有人知道这些改动和团队共识是什么关系。

BNA 使协调成为可能的核心机制是：它让写作者可以在意图（抽象）和写作（具体）之间 navigate。写作者可以从自己的写作出发，理解它相对于意图的位置；也可以从意图出发，将修改 project 到写作中，看到它对自己和他人的具体影响。这种在抽象和具体之间的双向 navigation 是纯文字流中不存在的——它是 BNA 为协调提供的基础能力。

基于这个能力，我们定义围绕协商空间的协调设计空间（Figure X）。写作者在个人空间中写作，Awareness 持续感知写作与 BNA 之间的关系变化；当变化达到团队设定的 threshold 时，穿越 Gate 进入团队空间，通过 Negotiation 更新 BNA；更新后的 BNA 再次影响个人写作和 Awareness——形成持续的协调循环。这个循环中的每一步都有可配置的维度，团队根据自己的场景在这些维度上做选择，定义自己的协调 pipeline。

[Figure: 协调 Pipeline 循环图。上层：BNA（团队共识）+ Writing（个人写作）。下层循环：Writing（个人空间）→ Awareness（感知关系变化）→ Gate（threshold 判断）→ Negotiation（团队空间：Propose → Deliberate → Resolve）→ 更新 BNA → 回到 Writing。Gate 是 Awareness 和 Negotiation 之间的穿越条件，不是独立阶段。]

### 4.2.1 Awareness

BNA 外化了写作与团队共识之间原本隐性的关系，使写作者可以感知自己在协商空间中的位置。Awareness 的设计空间包含三组维度。

**When — 何时触发感知**

| 维度 | 设计问题 | 选项空间 |
| --- | --- | --- |
| Trigger | 什么触发感知 | 写作中持续监测（ambient）、写作者主动请求（on-demand）、保存或提交后（post-action）、他人变更触发（external） |
| Timing | 在写作行为前还是后 | 写之前检查意图对齐（pre-action）、写完后回顾偏离（post-action） |

**What — 感知到什么关系变化**

| 维度 | 设计问题 | 选项空间 |
| --- | --- | --- |
| Writing ↔ Intent | 我的写作和我负责的意图 | 覆盖（covered）、部分覆盖（partial）、偏离（deviated）、超出（extended）、意图外内容（orphan） |
| Writing ↔ BNA | 我的写作和团队整体共识 | 与团队方向一致、与其他意图产生张力、与团队方向偏离 |
| Writing ↔ Others | 我的写作和他人写作（通过依赖链） | 无关联、间接关联、存在潜在冲突、已产生矛盾 |
| Decision History | 过去的决议是否约束当前写作 | 无约束（unconstrained）、有历史决议约束（constrained） |

**Impact ★ Gate — 影响评估与穿越条件**

| 维度 | 设计问题 | 选项空间 |
| --- | --- | --- |
| Scope ★ | 这个变化影响谁 | 不影响任何人（none）、通过依赖链影响特定人（specific）、影响整个团队（team-wide） |
| Severity ★ | 影响有多大 | 措辞调整（cosmetic）、局部修改（local）、方向改变（directional）、根本性改变（fundamental） |
| Propagation | 修改如何通过依赖链传播 | 只影响自己的意图、波及直接相关方、波及多层依赖链 |
| Group Interest ★ | 团队是否需要/想要知道 | 需要知道（need-to-know）、想知道（want-to-know）、不在意（won't care）、不确定（unknown） |

标记 ★ 的维度共同构成 **Gate**：当 Scope、Severity、Group Interest 的组合达到团队设定的 threshold 时，gate 被触发。不同团队配置不同的 threshold——高信任小团队可能只在 fundamental + team-wide 时触发；高风险异步团队可能在 local + specific 时就触发。Gate 可以由写作者基于自己的判断主动穿越，也可以由系统在检测到超过 threshold 后自动发起。

### 4.2.2 Negotiation

穿越 gate 后，协商的对象是团队的 shared understanding。以下维度定义了 Negotiation 的设计空间：

**Propose——发起对 BNA 的修改。**

| 维度 | 设计问题 | 选项空间 |
| --- | --- | --- |
| Initiation | 谁/什么发起 | 写作者主动发起、系统检测到 threshold 后建议、意图 owner 发起 |
| Scope | 可以提议什么 | 修改意图内容、添加或删除意图、调整依赖关系、重新分配归属 |
| Framing | 提议附带什么信息 | 影响分析、依赖链上受影响方、writing 变化预览、与历史决议的关系 |

**Deliberate——受影响方审议。**

| 维度 | 设计问题 | 选项空间 |
| --- | --- | --- |
| Participation | 谁参与 | 依赖链上的直接相关方、所有意图 owner、全体成员 |
| Mechanism | 用什么方式 | 投票（voting）、异步讨论（threaded discussion）、同步会议（synchronous meeting）、静默同意（silent approval，超时即同意） |
| Visibility | 参与者看到什么 | 提议对各自意图和写作的影响、其他人的意见、历史类似决议 |
| Response | 怎么表达意见 | approve、reject、counter-propose、defer、request more info |

**Resolve——达成决议。**

| 维度 | 设计问题 | 选项空间 |
| --- | --- | --- |
| Criteria | 什么算达成 | 全体同意（unanimous）、多数通过（majority）、相关方同意（stakeholder）、提议者决定（proposer） |
| Fallback | 没达成怎么办 | 维持原状、升级讨论、设定截止时间后自动生效、拆分为多个小决议 |
| Outcome | 决议如何生效 | 更新 BNA、通知相关方、记录决议历史、触发相关方的 awareness |

### 4.2.3 用设计空间定义协调 Pipeline

以上维度定义了协同写作的协调设计空间。团队通过在这些维度上做选择，定义自己的协调 pipeline。以下两个例子展示同一个设计空间如何支撑完全不同的协调方式。

**例 1：两人同步合写一篇博客。** Alice 和 Bob 面对面头脑风暴，BNA 是一个简单的 living outline。

| 维度 | 配置 |
| --- | --- |
| Trigger | ambient——边写边感知 |
| Timing | pre-action——写之前就能看到意图状态 |
| Writing ↔ Intent | 只关注 covered / deviated |
| Gate threshold | 宽松——只在 fundamental + team-wide 时触发 |
| Group Interest | 默认 won't care，除非根本性改变 |
| Initiation | 写作者口头发起 |
| Mechanism | 同步讨论，当场决定 |
| Criteria | proposer-decides——提出者直接修改 outline |

两人信任度高、同步沟通，所以 awareness 轻量、gate 宽松、negotiation 即时。大部分改动在个人空间解决，只有方向性改变才穿越到团队空间。

**例 2：五人异步合写一篇学术论文。** 分布在三个时区，BNA 是结构化的 living outline，有显式依赖关系。

| 维度 | 配置 |
| --- | --- |
| Trigger | post-action——每次保存后检测偏离 |
| Timing | post-action——写完后回顾 |
| Writing ↔ Intent | 完整状态：covered / partial / deviated / extended / orphan |
| Writing ↔ Others | 通过依赖链检测潜在冲突 |
| Gate threshold | 严格——local + specific 就触发 |
| Group Interest | 默认 need-to-know，依赖链上的人必须知道 |
| Decision History | 检查历史决议约束 |
| Initiation | 系统检测到超过 threshold 后自动建议 |
| Mechanism | 异步投票（voting），设 48 小时截止 |
| Participation | 依赖链上的直接相关方 |
| Criteria | stakeholder——相关方同意即通过 |
| Fallback | 超时后维持原状，升级到全体讨论 |

异步、多人、高风险，所以 awareness 细粒度、gate 严格、negotiation 正式。系统主动感知偏离并建议发起协商，通过投票达成决议。

需要强调的是，Awareness 不仅发生在 Gate 之前。协商空间中的关系感知贯穿协调循环的每个阶段：写作时需要感知自己和意图的关系；探索改变时需要评估影响范围；Deliberate 时参与者需要理解提议对自己写作的影响；Resolve 后需要重新感知更新后的关系状态。Section 4.2.1 定义的 Awareness 维度（关系变化、影响范围、团队态度）在每个阶段都被需要——区别在于，Gate 之前它服务于"要不要穿越到团队空间"的判断，Gate 之后它服务于协商过程中的认知和决策。

这个设计空间是 AI-agnostic 的：没有 AI，团队可以手动检查 writing-intent 关系、手动判断影响、面对面协商；有了 AI，每个维度上的感知和判断成本大幅降低，但框架本身不依赖 AI。
