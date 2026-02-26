# IntentWriter 开发计划

基于 FEATURE_SPEC.md 中的五个 Feature，按开发顺序拆解。

---

## 开发顺序总览

```
Phase 1: 基础视图
    ↓
Phase 2: 对齐检测
    ↓
Phase 3: 双向关联
    ↓
Phase 4: Gap 处理
    ↓
Phase 5: 完整 Simulation
    ↓
Phase 6: Proposal 系统
    ↓
Phase 7: Outline 更新
```

---

## Phase 1: 基础视图

**开发内容**：
- 左右两栏布局：左侧 Outline，右侧 Writing
- Outline 显示结构和要点列表
- Writing 区域可编辑

**完成后的效果**：
- 用户进入页面，看到左右分栏
- 左侧是之前定义的 Outline（只读展示）
- 右侧是写作区域，可以输入内容

**这一步解决的问题**：
- 建立基础的 UI 框架
- 让用户可以同时看到 Outline 和 Writing

---

## Phase 2: 对齐检测

**前置依赖**：Phase 1 完成

**开发内容**：
- 检测 Writing 与 Outline 的对应关系
- 给每个 Outline 要点标注状态：✓（已覆盖）/ ◐（部分覆盖）/ ○（未覆盖）
- 识别 Writing 中"超出 Outline"的内容
- 判断影响范围：Self Only / Outline Impact / Cross-Section Impact

**完成后的效果**：
- 用户写完内容后，点击"Check Alignment"
- Outline 中每个要点旁边出现状态图标
- 如果写了超出 Outline 的内容，会有提示

**这一步解决的问题**：
- 用户知道自己写了什么、没写什么
- 用户知道哪些内容超出了原有计划

---

## Phase 3: 双向关联

**前置依赖**：Phase 2 完成

**开发内容**：
- Hover Outline 要点 → Writing 中对应段落高亮
- Hover Writing 段落 → Outline 中对应要点高亮
- Gap（◐/○）状态时，显示缺失的具体说明

**完成后的效果**：
- 用户 hover 左侧某个 ✓ 要点，右侧对应的段落变色
- 用户 hover 右侧某个段落，左侧对应的要点变色
- 用户 hover ◐ 要点，看到"缺少关于 X 的内容"

**这一步解决的问题**：
- 用户可以直观看到 Outline 和 Writing 的对应关系
- 用户知道 Gap 具体是什么

---

## Phase 4: Gap 处理（Inline Simulation）

**前置依赖**：Phase 3 完成

**开发内容**：
- 点击 ◐/○ 要点时，显示两个选项
- "补充这个点"：右侧显示 simulated writing（如果补充会是什么样）
- "删除这个点"：左侧显示 simulated outline（如果删除会是什么样）

**完成后的效果**：
- 用户点击一个 ○ 要点
- 看到"补充这个点" / "删除这个点"两个按钮
- 点击"补充"，右侧 Writing 区域显示一个预览："如果补充，这里会添加..."
- 点击"删除"，左侧 Outline 中该要点显示删除线

**这一步解决的问题**：
- 用户可以快速决定：是补写内容，还是删掉这个要点
- 用户做决定前可以预览结果

---

## Phase 5: 完整 Simulation

**前置依赖**：Phase 4 完成

**开发内容**：
- Post-hoc 模式：基于已写的内容，生成 Simulated Outline
- Pre-hoc 模式：基于用户输入的 Intention，生成 Simulated Writing + Simulated Outline
- 显示对他人 Section 的影响（Cross-Section Impact）

**完成后的效果**：
- 用户写了超出 Outline 的内容，点击"Propose to Outline"
- 看到完整的 Simulated Outline：新增的要点高亮，受影响的其他 Section 标注
- 或者，用户输入一个想法"如果我们把 X 改成 Y..."
- 看到：你的 Writing 会变成... + 新的 Outline 会是... + 对他人的影响

**这一步解决的问题**：
- 用户在提出修改前，可以看到完整的影响
- 用户可以探索"如果这样改会怎样"

---

## Phase 6: Proposal 系统

**前置依赖**：Phase 5 完成

**开发内容**：
- 创建 Proposal：附带 Simulated Outline + 影响范围
- 发送给相关团队成员
- 响应 Proposal：Accept / Reject / Discuss / Counter-propose
- Counter-propose 时，生成新的 Simulated Outline

**完成后的效果**：
- 用户 A 创建一个 Proposal，B 和 C 收到通知
- B 打开 Proposal，看到 Simulated Outline
- B 可以选择 Accept / Reject / Discuss / Counter-propose
- 如果 B 选择 Counter-propose，输入自己的想法，生成新的 Simulation

**这一步解决的问题**：
- 团队成员可以异步协商修改
- 每个人都能看到修改的完整影响

---

## Phase 7: Outline 更新

**前置依赖**：Phase 6 完成

**开发内容**：
- Proposal 被 Accept 后，自动更新 Outline
- 记录变更历史：谁在什么时候改了什么
- 通知相关团队成员

**完成后的效果**：
- Proposal 被接受后，Outline 自动更新
- 用户可以查看 Outline 的变更历史
- 受影响的团队成员收到通知："Outline 已更新，你的 Section 可能需要调整"

**这一步解决的问题**：
- Outline 随着团队协商而演进
- 团队成员知道 Outline 发生了什么变化

---

## 里程碑总结

| 里程碑 | 完成的 Phase | 用户可以做的事情 |
|--------|-------------|-----------------|
| **M1** | Phase 1-2 | 写作 + 看到对齐状态 |
| **M2** | Phase 3-4 | 看到关联 + 处理 Gap |
| **M3** | Phase 5 | 预览完整影响 |
| **M4** | Phase 6-7 | 团队协商 + Outline 演进 |

---

## 当前状态

目前代码库中已有的能力：
- 基础的左右布局（部分完成）
- 对齐检测的 API（已实现，需要调整输出格式）
- 状态显示（已实现，需要调整为 ✓/◐/○ 格式）

建议从 **Phase 2 的调整** 开始，确保对齐检测的输出符合新的设计。
