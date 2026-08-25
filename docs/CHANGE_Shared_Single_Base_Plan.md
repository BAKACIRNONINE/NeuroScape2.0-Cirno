# NeuroScape 单一共享 Base Plan 变更记录

## 变更目的

为了更直接地比较 Adaptive 与 Non-Adaptive 条件，本次修改取消 Base Plan A/B。两个条件现在从完全相同的声音时间线开始：

```text
Non-Adaptive = Shared Base Plan
Adaptive     = Shared Base Plan + 成功通过验证并在 runtime 执行的 patches
```

因此，两种条件之间的声音差异不再来自预生成 Base Plan 本身，而只来自 Adaptive 条件中实际成功执行的调整。

## 新 Base Plan

新计划 ID：`forest_base`

版本：`base_plan_v3`

分配规则：`shared_base_v1`

十分钟基础时间线：

| 时间       | 类型    | 音源                    | 参数                            |
| ---------- | ------- | ----------------------- | ------------------------------- |
| 0–600 秒   | Ambient | `forest_ambient_bed_01` | global，gain `0.38`             |
| 155–163 秒 | Event   | `forest_bird_far_01`    | forest_entry，gain `0.24`，8 秒 |
| 350–358 秒 | Event   | `forest_bird_far_02`    | stream_bank，gain `0.20`，8 秒  |

两次鸟叫分别使用不同变体和不同空间位置，形成轻微的前后段层次，同时保持低密度并为 Adaptive patch 预留 headroom。Base Plan 不再预置树叶、水滴、猫头鹰、action/body-anchor 或第二条 ambient。Adaptive planner 仍可在 eligibility、complexity、salience、freeze buffer 和 runtime validation 允许时，对未来时间线执行受约束的 patch。

## 代码修改

### Base Plan 定义

文件：`packages/adaptive-planner/src/base-plan.ts`

- `BaseScenePlan.planId` 从 `forest_A | forest_B` 改为 `forest_base`。
- `createMatchedForestBasePlans` 替换为 `createForestBasePlan`。
- 删除 A/B matching validator 和 participant parity 分配。
- `assignMatchedBasePlans` 替换为 `assignSharedBasePlan`。
- Adaptive 与 Non-Adaptive 的 assignment 均返回同一个 `basePlanId`。
- Base Plan 版本升级为 `base_plan_v3`，避免与既有 A/B session 混淆。
- Assignment rule 升级为 `shared_base_v1`。

### Runtime integration

文件：`frontend/src/integration/AdaptiveIntegrationHarness.ts`

- 两种 condition 均直接调用 `createForestBasePlan`。
- 不再根据 condition 或 participant ID 查找 A/B plan。
- Adaptive 仍创建 planner；Non-Adaptive 仍只执行固定 Base Plan，不调用 Decision 1/2。

### Session metadata

文件：`frontend/src/app/App.tsx`

- 新 session 的 `basePlanId` 统一记录为 `forest_base`。
- 不再为新 session 写入 `pairedBasePlanId`，因为不存在另一份配对计划。
- `conditionOrder` 继续记录实验顺序，与共享 Base Plan 不冲突。
- `assignmentRuleVersion` 记录为 `shared_base_v1`。

### 配置与测试

文件：

- `packages/adaptive-planner/src/config.ts`
- `packages/adaptive-planner/tests/base-plan-patching.test.ts`
- `packages/adaptive-planner/tests/adaptive-planner.test.ts`

删除不再使用的 `basePlanMatchTolerance`。测试现在验证：

- 共享计划时长为 600 秒；
- 恰好包含 1 个 ambient 和 2 个低密度 bird events；
- 不包含 action/body-anchor；
- 两种实验条件使用同一 `forest_base`；
- Adaptive future patch、runtime acknowledgement 和失败隔离仍正常工作。

## 对实验数据的影响

旧数据中的 `forest_A`、`forest_B` 和 `matched_ab_v1` 应保留原样，不应回写为新计划。分析时建议以以下字段区分 protocol：

| 数据批次           | Base Plan version | Assignment rule  |
| ------------------ | ----------------- | ---------------- |
| 旧 A/B session     | `base_plan_v2`    | `matched_ab_v1`  |
| 新共享计划 session | `base_plan_v3`    | `shared_base_v1` |

新旧 session 不应仅按 `adaptive/non-adaptive` 标签直接合并。新设计提高了条件间基础音轨的一致性，但基础声景也比旧 A/B 版本更稀疏，可能改变 stasis pressure 触发频率和 Adaptive patch 数量。

## 验证

变更完成后执行：

```text
npm run build
npm run test --workspace @neuroscape/adaptive-planner
npm run test --workspace @neuroscape/runtime-scene-controller
npm run test --workspace @neuroscape/frontend
```

最终验证结果记录在本次交付说明中。
