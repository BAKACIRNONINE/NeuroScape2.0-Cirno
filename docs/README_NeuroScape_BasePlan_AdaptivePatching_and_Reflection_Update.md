# NeuroScape 系统修改说明：Matched Base Plans、Adaptive Patching 与 Reflection Memory

## 1. 文档目的

请在当前 NeuroScape 代码基础上完成两项相互关联的系统更新：

1. **重构 Adaptive 与 Non-Adaptive 的场景生成逻辑**  
   两个条件都应从完整、连贯、但刻意克制的十分钟 Base Scene Plan 出发。Non-Adaptive 原样执行其 Base Plan；Adaptive 不再逐窗口从零生成下一段场景，而是在其 Base Plan 持续运行的基础上，根据 EEG 对尚未播放的未来内容做受约束的局部 patch。

2. **为 LLM adaptation 加入结构化 Reflection**  
   每次 adaptation 前声明 provisional hypothesis；系统在足够的 post-adaptation observation 后，用代码评估 observed response，并保存为 session-local adaptation memory。后续 Decision 1 和 Decision 2 可以参考相关历史，但不得把时间上的先后误写成因果证明，也不得新增一个不受约束的 Reflection LLM 调用。

本次修改必须同时保证：

- 声景连续、克制、适合冥想；
- Adaptive 不是在复杂 Base Plan 上不断叠加更多声音；
- Non-Adaptive 不是故意贫乏或静止的弱对照；
- 两个 condition 的基础 richness、density、layer usage 与总体 progression 尽可能匹配；
- LLM latency 不阻塞声音播放；
- 不同 prompt/module 的职责互不冲突；
- 模型失败、超时或非法输出时，系统继续安全执行 coherent Base Plan。

---

## 2. 与前一轮系统修改的关系

如果 repository 已经按照 `README_NeuroScape_Reference_Score_and_Decision1_Update.md` 修改，请复用其中的：

- unbounded `relative_position`；
- raw/log-TBR deltas；
- trajectory、slope 与 variability；
- calibration quality 与 measurement confidence；
- code-level eligibility gate；
- Decision 1 intents；
- `max_meaningful_stasis_sec`；
- Decision 1 严格 JSON schema。

本 README 不应重新引入：

- clipped 0–1 Focus/Mind-Wandering percentage；
- calibration extrema/boundary language；
- 由 Decision 2 重新判断是否需要 adaptation 的逻辑；
- sustained Focus 自动映射为永久 `maintain`。

如果前一轮修改尚未实现，请先列出依赖项，并以兼容方式完成本任务，不要创建第二套相互竞争的 state representation 或 Decision 1 pipeline。

---

## 3. 开始修改前：先检查实际 repository

在写代码前，请先定位并概括：

- 当前十分钟 Non-Adaptive 场景如何生成、保存和播放；
- 当前 Adaptive 是否逐次生成约一分钟 scene/segment；
- EEG window 长度与 update interval；
- Decision 1 与 Decision 2 的 prompt、schema、调用位置和模型配置；
- Scene Knowledge Base 与 sound asset metadata；
- Unity scene state、active source、transition 和 playback queue 的管理方式；
- 当前 session history、adaptation logs 与时间戳；
- cooldown、session phase、transition-in-progress、session-ending 等硬约束；
- 当前 timeout、retry、schema validation 和 fallback；
- 当前实验条件分配与 counterbalancing 逻辑。

实施前先输出：

1. 将修改的实际文件清单；
2. 每个文件的修改目的；
3. 当前架构与本文术语的映射；
4. 可能影响既有实验数据或 protocol 的兼容性问题；
5. 分阶段实现计划。

不要假设本文示例字段名、目录或文件名与 repository 完全一致。优先保留现有架构与命名，但实现行为必须满足本文验收标准。

---

# Part A：Matched Base Scene Plans

## 4. 核心原则

### 4.1 两个条件共享同一种规划范式

必须停止以下不对称比较：

```text
Non-Adaptive：一次性规划完整十分钟
Adaptive：每个窗口从零生成下一分钟
```

改为：

```text
Non-Adaptive：执行完整十分钟 Base Plan
Adaptive：执行匹配的完整十分钟 Base Plan + EEG-informed patches
```

这样条件之间的主要区别才是 adaptation，而不是 global planning 与 fragmented local generation 的差异。

### 4.2 Base Plan 必须完整，但不能过度复杂

“完整十分钟计划”不等于“十分钟里填满大量不同声音”。Base Plan 的目标是：

> Coherent, gently evolving, intentionally restrained, and adaptation-ready.

Base Plan 应当：

- 有完整的 temporal arc；
- 有稳定的 ambient identity；
- 有少量、分布合理的 event/action；
- 有平缓的空间和 texture 演化；
- 避免长时间完全静止；
- 避免持续多声源堆叠；
- 预留 complexity/salience headroom；
- 即使没有 adaptation，也能形成合格、和谐的 meditation soundscape。

Base Plan 不应当：

- 为了让 Non-Adaptive 显得丰富而频繁加入声音；
- 在每个时间段都同时使用 ambient、event 和 body anchor；
- 把 event/action budget 在预生成阶段全部用完；
- 让 Adaptive 只能通过继续叠加声音才能表现 adaptation；
- 故意把 Non-Adaptive 做得单调，作为容易被 Adaptive 战胜的弱对照。

### 4.3 Adaptive 不等于 additive

Adaptive patch 应优先使用：

```text
KEEP
ADJUST
RESCHEDULE
REPLACE
SUPPRESS
```

只有 complexity budget、salience budget 和 concurrent-source headroom 允许时，才使用：

```text
INSERT
```

核心原则：

> Adaptation should redistribute, reshape, substitute, delay, simplify, or occasionally enrich the scheduled soundscape. It should not default to adding more sound.

---

## 5. Base Plan A/B 与 counterbalancing

### 5.1 生成两份 matched plans

对于同一 environment/scene family，生成两份 Base Plan：

```text
Base Plan A
Base Plan B
```

两份计划不应逐秒完全相同，以降低 within-subject 重复体验；但必须共享相同的 `BasePlanProfile`，在结构和复杂度上匹配。

建议 profile：

```json
{
  "duration_sec": 600,
  "scene_family": "forest",
  "arc_template": [
    "settling",
    "deepening",
    "sustaining",
    "closing"
  ],
  "complexity_envelope_id": "meditation_restrained_v1",
  "ambient_layer_range": "CONFIG",
  "event_budget_total": "CONFIG_TBD_PILOT",
  "body_anchor_budget_total": "CONFIG_TBD_PILOT",
  "max_concurrent_sources": "CONFIG_TBD_PILOT",
  "max_salience_load": "CONFIG_TBD_PILOT",
  "reserved_adaptation_headroom": "CONFIG_TBD_PILOT"
}
```

具体数值必须进入集中配置，不能作为 magic number 散落在 prompt 或业务代码中。已有 pilot 参数应优先复用；新增阈值标记 `TBD_PILOT`。

### 5.2 A/B 必须匹配的属性

至少验证：

- duration；
- arc phase 数量与时间范围；
- ambient layer 数量范围；
- total event count/budget；
- total body-anchor count/budget；
- concurrent-source distribution；
- salience-load distribution；
- transition count 与 transition duration；
- spatial movement count/type；
- silence/low-density interval 分布；
- asset-family repetition；
- closing phase 的刺激强度。

允许 A/B 在具体 asset、具体事件时间和空间轨迹上不同，但不能一份明显比另一份丰富、响亮、密集或多变。

### 5.3 条件分配

支持 counterbalanced assignment，例如：

```text
Group 1:
Non-Adaptive = Plan A
Adaptive = Plan B + patches

Group 2:
Non-Adaptive = Plan B
Adaptive = Plan A + patches
```

记录：

```json
{
  "participant_id": "...",
  "condition_order": ["non_adaptive", "adaptive"],
  "non_adaptive_base_plan_id": "forest_A",
  "adaptive_base_plan_id": "forest_B",
  "assignment_rule_version": "matched_ab_v1"
}
```

如果现有实验 protocol 只支持一份 Base Plan，也应先实现单计划兼容模式，但架构要允许后续启用 A/B matched plans。

---

## 6. Base Plan schema

完整 Base Plan 至少包含：

```json
{
  "plan_id": "forest_A",
  "version": "base_plan_v2",
  "duration_sec": 600,
  "profile_id": "forest_restrained_v1",
  "global_constraints": {
    "max_concurrent_sources": 3,
    "max_salience_load": 1.0,
    "reserved_adaptation_headroom": 0.25
  },
  "phases": [
    {
      "phase_id": "settling",
      "start_sec": 0,
      "end_sec": 120,
      "target_density": "low",
      "adaptation_flexibility": "low"
    }
  ],
  "scheduled_elements": [
    {
      "element_id": "ambient_stream_01",
      "asset_id": "stream_soft_02",
      "layer": "ambient",
      "start_sec": 0,
      "end_sec": 260,
      "gain": 0.35,
      "salience": "minimal",
      "spatial_behavior": "stationary_distant",
      "adaptability": {
        "adjustable": true,
        "replaceable": true,
        "suppressible": false
      }
    }
  ]
}
```

示例数值不应直接视为最终阈值。请映射到现有 Unity/audio schema。

---

## 7. Non-Adaptive execution

Non-Adaptive condition：

- 加载分配到的完整 Base Plan；
- 按 timeline 原样执行；
- 不调用 Decision 1/Decision 2 改变声音；
- EEG 可以记录，但不能影响 playback；
- 不应用 adaptive patch；
- 记录实际播放与失败事件，便于验证条件 fidelity。

Non-Adaptive 允许技术级 fallback，例如 asset load 失败时静默跳过或使用预定义兼容替代，但不能依据 EEG 或参与者状态变化。

---

# Part B：Adaptive 作为受约束的 Base-Plan Patching

## 8. Adaptive runtime

Adaptive condition：

1. 加载其完整 Base Plan；
2. Base Plan 持续正常播放；
3. EEG 按当前 sliding window/update interval 更新；
4. code eligibility gate 判断是否允许 Decision 1；
5. Decision 1 输出 `adapt` 或 `maintain`；
6. `maintain` 时继续执行原定 Base Plan，不冻结当前声景；
7. `adapt` 时调用 Decision 2；
8. Decision 2 只生成未来局部 patch；
9. validator 检查时间、资源、transition、complexity 和 salience；
10. 合法 patch 异步进入 Unity queue；
11. Base Plan 加已批准 patch 构成实际 runtime timeline。

### 8.1 `maintain` 的新定义

所有 prompt、代码注释和日志必须明确：

> `maintain` means preserving the currently scheduled Base Plan evolution. It does not mean freezing the soundscape, repeating the current state, or suppressing scheduled future events.

### 8.2 不允许重新生成整个下一段

Decision 2 不得输出一份从零开始的完整一分钟 scene。它只能对 `upcoming_base_horizon` 输出 patch operations。

允许操作：

```text
KEEP
ADJUST
RESCHEDULE
REPLACE
SUPPRESS
INSERT
```

含义：

| Operation | 含义 |
|---|---|
| `KEEP` | 明确保留关键 scheduled element |
| `ADJUST` | 调整 gain、width、distance、movement、duration 等 |
| `RESCHEDULE` | 在合法 future horizon 内提前或延后 |
| `REPLACE` | 用同 role/compatible family 的 asset 替换 |
| `SUPPRESS` | 暂停或取消尚未开始的 scheduled element |
| `INSERT` | 在预算允许时加入新的低显著度 element |

默认优先级：

```text
KEEP / ADJUST / RESCHEDULE / REPLACE / SUPPRESS
before
INSERT
```

---

## 9. Receding horizon、freeze buffer 与不可变历史

分离以下概念：

- `eeg_window_sec`：EEG 聚合窗口；
- `decision_interval_sec`：Decision checkpoint 间隔；
- `patch_horizon_sec`：Decision 2 可以查看/修改的未来范围；
- `execution_freeze_buffer_sec`：已经接近播放、不可再修改的 future buffer；
- `transition_duration_sec`：音频变化真正完成所需时间。

规则：

- 已播放内容永远 immutable；
- freeze buffer 内已排队内容默认 immutable；
- Decision 2 只修改 freeze buffer 之后、patch horizon 之内的内容；
- 不得追溯修改历史或伪造已发生的 scene state；
- patch 只能基于成功应用后的 runtime state 继续构建；
- failed/rejected patch 不得写成已执行 adaptation。

所有时间参数进入配置，并根据当前系统 latency 与 Unity queue 行为设置。

---

## 10. Complexity 与 salience budget

### 10.1 必须由代码验证，而非只依赖 prompt

增加统一的 projected-scene validator。至少计算：

```text
projected_concurrent_sources
projected_ambient_layers
projected_event_rate
projected_body_anchor_rate
projected_salience_load
projected_transition_overlap
recent_asset_repetition
cumulative_patch_count
```

示例：

```python
projection = project_runtime_scene(
    base_plan=base_plan,
    accepted_patches=patch_history,
    proposed_patch=decision_2.patch,
)

violations = validate_complexity_envelope(
    projection=projection,
    profile=base_plan.complexity_profile,
)
```

### 10.2 INSERT 规则

只有满足以下条件才允许 `INSERT`：

- concurrent-source headroom 足够；
- salience headroom 足够；
- event/action frequency limit 未达到；
- 没有不兼容 sound combination；
- 没有 overlapping salient transition；
- 当前 phase 允许相应 layer；
- recent history 中没有同类 asset 过度重复；
- patch 的 expected benefit 明确；
- 无更小的 ADJUST/REPLACE/RESCHEDULE 操作可实现相同 intent。

如果 INSERT 超预算，validator 不应让 LLM 反复重试无限添加。优先：

1. 将 INSERT 转为 REPLACE；或
2. 要求同时 SUPPRESS 一个低优先级 future element；或
3. 拒绝 patch 并继续 Base Plan。

### 10.3 Adaptive 可以变得更简单

根据 state 与 intent，合法 adaptation 包括：

- 减少 foreground event；
- 延后 body anchor；
- 降低 ambient density；
- 缩小空间运动范围；
- 延长稳定 ambient；
- 抑制即将出现的高显著度事件。

不得将“发生 adaptation”与“加入更多声音”等同。

---

## 11. Decision 2 输入与输出

### 11.1 输入只包含必要 context

Decision 2 不应收到完整十分钟计划、全部 EEG samples、全部历史日志或整个 asset library。代码应先选择和压缩：

```json
{
  "decision_1": {
    "intent": "support_grounding",
    "salience": "low"
  },
  "current_state_summary": {},
  "active_runtime_scene": {},
  "upcoming_base_horizon": {},
  "existing_future_patches": [],
  "compatible_candidate_assets": [],
  "complexity_headroom": {},
  "relevant_prior_outcomes": [],
  "hard_constraints": {}
}
```

### 11.2 Decision 2 不可推翻 Decision 1

Decision 2：

- 接受 Decision 1 的 intent；
- 决定如何最小充分地实现；
- 可以在无合法 patch 时返回 `NO_SAFE_PATCH`；
- 不得改成新的 intent；
- 不得重新判断用户是否 Focus/Mind-Wandering；
- 不得决定当前本来就不需要 adaptation；
- 不得修改 hard eligibility policy。

### 11.3 建议输出 schema

```json
{
  "adaptation_id": "adapt_004",
  "status": "PATCH_PROPOSED | NO_SAFE_PATCH",
  "intent": "support_grounding",
  "patch_operations": [
    {
      "operation": "REPLACE",
      "target_element_id": "future_event_03",
      "replacement_asset_id": "soft_footstep_01",
      "effective_start_sec": 214,
      "transition_sec": 8
    }
  ],
  "preserved_elements": ["ambient_stream_01"],
  "complexity_projection": {
    "concurrent_sources_after": 2,
    "salience_load_after": 0.52,
    "uses_reserved_headroom": false
  },
  "adaptation_hypothesis": {
    "mechanism_code": "BODY_ANCHOR_GROUNDING",
    "expected_response_code": "REDUCE_VARIABILITY_OR_HALT_DECLINE",
    "target_time_horizon": "CONFIGURED_POST_ADAPTATION_WINDOW",
    "failure_signal_code": "CONTINUED_DECLINE_WITH_VALID_SIGNAL"
  },
  "reflection_used": {
    "prior_adaptation_ids": ["adapt_002"],
    "lesson_code": "AVOID_REPEAT_AMBIENT_DENSITY_INCREASE",
    "lesson_confidence": "medium"
  },
  "reason_codes": [
    "MINIMAL_SUFFICIENT_PATCH",
    "PRESERVE_BASE_CONTINUITY"
  ]
}
```

使用 strict schema validation。自然语言 `reason` 最多一条短句；优先使用 enums/reason codes。

---

# Part C：Reflection 与 Adaptation Outcome Memory

## 12. Reflection 的正确定位

Reflection 不应实现为第三个自由推理 LLM：

```text
Decision 1 LLM
→ Decision 2 LLM
→ Reflection LLM
```

应实现为：

```text
Decision 2 声明 hypothesis
→ Unity 执行 patch
→ 代码等待可评价 observation window
→ 代码计算 observed response
→ 写入 adaptation memory
→ 后续 Decision 1/2 读取短摘要
```

这样可以降低 latency、成本、prompt 冲突与因果过度解释。

---

## 13. Adaptation lifecycle state machine

每个 adaptation 应具有 lifecycle：

```text
PROPOSED
VALIDATED
QUEUED
APPLYING
APPLIED
WAITING_FOR_OBSERVATION
PROVISIONALLY_EVALUATED
UPDATED_EVALUATION
REJECTED
FAILED
```

规则：

- 只有 `APPLIED` 后才能进入 outcome evaluation；
- `REJECTED/FAILED` 不能被当作 intervention；
- transition 完成前保持 `WAITING_FOR_OBSERVATION`；
- observation window 未满足时返回 `not_yet_observable`；
- 后续有效 window 可以更新 provisional outcome；
- 所有状态变更必须带 timestamp。

---

## 14. Hypothesis record

Decision 2 每次 patch 必须保存：

```json
{
  "adaptation_id": "adapt_004",
  "context_before": {
    "relative_position": 0.62,
    "trajectory": "declining",
    "slope": -0.14,
    "variability": 0.18,
    "signal_quality": "good",
    "measurement_confidence": "medium",
    "scene_density": "medium",
    "active_layers": ["ambient"]
  },
  "action_signature": {
    "intent": "support_grounding",
    "layer": "body_anchor",
    "operation": "REPLACE",
    "asset_family": "footstep",
    "salience": "low",
    "scene_phase": "sustaining"
  },
  "hypothesis": {
    "mechanism_code": "BODY_ANCHOR_GROUNDING",
    "expected_response_code": "REDUCE_VARIABILITY_OR_HALT_DECLINE",
    "failure_signal_code": "CONTINUED_DECLINE_WITH_VALID_SIGNAL"
  }
}
```

Hypothesis 是 provisional prediction，不是已验证机制。

---

## 15. Observation timing 与 overlapping EEG windows

当前论文描述使用 overlapping 60-second EEG windows，并约每 40 秒更新。实际代码若不同，以代码配置为准。

Outcome evaluator 必须计算每个 post-adaptation window 中 adaptation 前数据的比例。

例如 adaptation 在 `t` 完成：

- `t + 40s` 的 60s window 仍可能包含约 20s adaptation 前数据；
- `t + 80s` 的 window 才可能完全位于 adaptation 后。

因此：

- 第一个 checkpoint 不应自动评价 success/failure；
- observation eligibility 由 window overlap、transition completion 和 signal quality 共同决定；
- 评价时间不得仅依赖 LLM 自己声明的时间；
- 具体 delay 由代码依据配置计算。

建议字段：

```json
{
  "window_start": 220,
  "window_end": 280,
  "adaptation_applied_at": 205,
  "pre_adaptation_overlap_sec": 0,
  "transition_completed_at": 213,
  "eligible_for_evaluation": true
}
```

---

## 16. Outcome evaluator

Outcome evaluator 优先由 deterministic code 完成。输入：

- pre-adaptation state/trajectory；
- hypothesis expected response；
- post-adaptation state/trajectory；
- signal quality；
- calibration confidence；
- window overlap；
- transition status；
- concurrent base-plan changes；
- concurrent patches；
- patch application status。

输出：

```json
{
  "adaptation_id": "adapt_004",
  "observed_response": "aligned_with_hypothesis | opposed_to_hypothesis | no_clear_change | inconclusive | not_yet_observable",
  "outcome_confidence": "high | medium | low | unavailable",
  "reason_codes": [
    "DECLINE_HALTED",
    "VALID_SIGNAL",
    "FULLY_POST_ADAPTATION_WINDOW"
  ],
  "causal_claim_allowed": false,
  "evaluation_version": "outcome_v1"
}
```

只要存在以下情况，优先降低 confidence 或标记 `inconclusive`：

- signal quality 差；
- calibration unusable/low confidence；
- observation window 大量包含 intervention 前数据；
- transition 尚未完成；
- patch 未成功应用；
- 同期存在其他显著 base-plan change；
- 同期应用多个无法区分的 patches；
- session 即将结束，缺少观察数据；
- state trajectory 高度 volatile。

禁止输出 `proven_effective`、`caused_improvement` 等标签。

---

## 17. Session-local adaptation memory

### 17.1 Memory unit

保存结构化 case：

```json
{
  "adaptation_id": "adapt_004",
  "context_signature": {
    "position_band": "intermediate",
    "trajectory": "declining",
    "stability": "medium",
    "scene_density": "medium",
    "scene_phase": "sustaining"
  },
  "action_signature": {
    "intent": "support_grounding",
    "layer": "body_anchor",
    "operation": "REPLACE",
    "asset_family": "footstep",
    "salience": "low"
  },
  "outcome": {
    "observed_response": "aligned_with_hypothesis",
    "confidence": "medium",
    "evidence_count": 1
  }
}
```

### 17.2 不从一次 observation 过度泛化

规则：

- 单次 `opposed`：降低相同 strategy 的短期优先级，不永久 blacklist 整个 layer/family；
- 单次 `aligned`：允许作为弱正向 precedent，不标记为有效治疗；
- `inconclusive`：不得驱动 strategy preference；
- 只有多次相似 context 下方向一致，才创建 generalized lesson；
- generalized lesson 必须带 `evidence_count` 和 confidence；
- 当前 session 结束后默认不形成跨用户、跨 session 的永久模型，除非另有明确研究设计和数据治理方案。

### 17.3 Relevant memory retrieval

不要向 LLM 发送完整 memory。代码根据以下相似度选择最多 2–3 条：

- intent；
- trajectory；
- layer/operation；
- scene density；
- scene phase；
- salience；
- asset family。

优先返回：

- 最近且高 confidence；
- 与当前 context 最相似；
- 能避免立即重复 counterproductive strategy；
- 能解释当前为何 preserve recovery。

---

## 18. Reflection 如何影响 Decision 1

Decision 1 可读取：

```json
{
  "last_adaptation": {
    "status": "PROVISIONALLY_EVALUATED",
    "observed_response": "aligned_with_hypothesis",
    "confidence": "medium",
    "seconds_since_applied": 92
  }
}
```

Decision 1 应利用它：

- 上一次 adaptation 尚不可评价时，避免过早叠加新 intervention；
- 出现 provisional recovery 时，考虑 `preserve_recovery`；
- 上一次可能 counterproductive 时，允许再次 adapt，但不得假装已证明原因；
- 连续 adaptations 过密时保持 Base Plan；
- 不得由 Reflection 模块直接覆盖 hard eligibility gate。

---

## 19. Reflection 如何影响 Decision 2

Decision 2 prompt 应包含以下原则：

```text
Treat each adaptation as a provisional hypothesis rather than a proven intervention.
Use only the supplied structured prior outcomes.
Prefer strategies whose observed responses were repeatedly aligned with their hypotheses in similar contexts.
Avoid immediately repeating a strategy that produced an opposed response with adequate signal quality, unless the current context materially differs.
Do not generalize from a single inconclusive outcome.
Do not infer causality from temporal sequence alone.
When a prior strategy was opposed, change the layer, operation, salience, timing, spatial behavior, or asset family only when doing so remains consistent with Decision 1's intent.
```

Decision 2 不得输出长篇自由 reflection。只返回：

- 使用了哪些 prior case IDs；
- 一个 `lesson_code`；
- lesson confidence；
- 当前 patch 与此前策略有何结构化差异。

---

# Part D：Prompt 一致性、Latency 与稳定性

## 20. Single source of truth 与职责边界

建立一份集中 policy/config，避免相同规则在多个 prompt 中出现不同版本。

| 模块 | 决策权限 |
|---|---|
| Code gate | 是否允许调用、cooldown、transition、phase、data sufficiency |
| Outcome evaluator | observed response 与 confidence |
| Decision 1 | adapt/maintain、intent、salience |
| Decision 2 | 在给定 intent 下选择合法的最小 patch |
| Patch validator | schema、时间、asset、complexity、salience 和 transition 合法性 |
| Unity/runtime | 执行已批准 plan/patch，返回真实 application status |

明确禁止：

- Decision 2 推翻 Decision 1；
- Outcome evaluator 决定下一次 action；
- prompt 中同时出现“必须变化”和“稳定时绝不变化”的冲突规则；
- LLM 自己覆盖 cooldown 或 transition；
- validator 自动创造未经 Decision 2 提议的新显著声音。

---

## 21. 模型与 reasoning 配置

模型 ID、reasoning effort、timeout、token ceiling 必须配置化，不要硬编码到 prompt。

建议角色：

```yaml
llm:
  base_plan:
    model: CONFIG
    reasoning_effort: medium
    realtime: false

  decision_1:
    model: CONFIG_FAST
    reasoning_effort: low

  decision_2_default:
    model: CONFIG_BALANCED
    reasoning_effort: low

  decision_2_escalated:
    model: CONFIG_BALANCED
    reasoning_effort: medium
```

不要在本任务中未经 benchmark 直接降级为某个旧模型。代码应支持替换模型，并在 replay evaluation 后决定最终配置。

### 21.1 Decision 2 escalation 条件

默认使用 low reasoning。仅在以下情况考虑 medium：

- prior outcomes 冲突；
- 相似策略出现 reliable `opposed`；
- patch 同时协调多个 layer；
- 接近 complexity/salience limit；
- base plan 即将 transition 到新 phase；
- compatible assets/constraints 存在明显冲突；
- low-reasoning 输出通过 schema 但未通过 semantic validator。

实现 deterministic `assess_patch_complexity()`，不要让模型自行决定自己需要多少 reasoning。

---

## 22. Context compression

减少 LLM 输入：

- 只传当前 state summary 与最近少量 trajectory points；
- 只传 upcoming patch horizon，不传完整十分钟 plan；
- 只传 compatible candidate assets；
- 只传 2–3 条 relevant memory；
- 只传当前 active scene 和 future queued elements；
- 静态规则放在稳定 prompt prefix；
- 不重复 Scene Knowledge Base 的完整描述；
- 不发送 raw EEG samples；
- 不发送完整 session transcript/log。

---

## 23. Output control

使用 strict structured output，禁止要求 chain-of-thought 或长篇解释。

输出 token ceiling 作为安全上限而非主要 latency 工具。配置应允许：

- Decision 1 输出短 JSON；
- Decision 2 输出有限 patch operations；
- reasoning model 有足够空间完成有效 JSON；
- 遇到 `incomplete` 时安全 fallback，而不是无限 retry。

记录：

```text
input tokens
reasoning tokens（如果 API 返回）
visible output tokens
completion status
schema validity
retry count
latency_ms
```

---

## 24. Asynchronous, non-blocking runtime

LLM reasoning 不得暂停或清空声音。

```text
Base Plan 持续播放
→ 后台发起 Decision 1/2
→ 在 future patch deadline 前返回
→ validator
→ queue patch
```

如果推理未在 deadline 前完成：

- 取消或忽略过期结果；
- 继续 Base Plan；
- 记录 timeout；
- 不立即以更复杂模型重复调用；
- 下一 checkpoint 再重新判断。

需要防止 stale response：LLM 返回时必须校验：

- decision request ID；
- base-plan version；
- current phase；
- patch horizon 是否仍在未来；
- active scene 是否发生重大变化；
- 是否已有更新的 decision。

过期响应不得应用。

---

## 25. Failure fallback

以下情况统一安全 fallback 到继续执行 Base Plan：

- LLM timeout；
- network/API error；
- incomplete output；
- schema invalid；
- semantic constraint violation；
- complexity/salience 超预算；
- asset 不存在；
- Unity reject；
- patch 已过期；
- concurrent adaptation conflict。

Fallback 不得：

- 清空 scene；
- 回退到上一分钟无限循环；
- 临时生成无约束声音；
- 把失败的 patch 记为有效 intervention；
- 阻塞正在运行的 Base Plan。

---

# Part E：Logging、测试与验收

## 26. Logging

### 26.1 Base-plan fidelity

记录：

```text
participant/session/condition
base_plan_id/version/profile
condition assignment
scheduled element timeline
actual playback timeline
asset failures/fallbacks
base-plan complexity metrics
```

### 26.2 Adaptive decision trace

记录：

```text
checkpoint timestamp
state/trajectory/confidence summary
eligibility gate result
Decision 1 output
Decision 2 request/response
reasoning effort/model config
patch operations
validator result
projected complexity
Unity application status
actual application timestamp
timeout/stale/fallback
```

### 26.3 Reflection trace

记录：

```text
adaptation ID
hypothesis
context/action signature
observation eligibility
pre/post window timing
signal quality
observed response
outcome confidence
reason codes
memory retrieval IDs
generalized lesson evidence count
```

增加版本字段：

```text
base_plan_version
patch_policy_version
decision_1_prompt_version
decision_2_prompt_version
outcome_evaluator_version
memory_policy_version
```

---

## 27. 必须新增的测试

### 27.1 Base Plan A/B matching

测试：

- 两份计划均为完整 600 秒；
- arc phase 匹配；
- complexity metrics 在配置容差内匹配；
- 没有一份显著更密集或更高 salience；
- 两份计划具体 asset/timing 不完全相同；
- 均保留 adaptation headroom；
- 均可独立形成 coherent Non-Adaptive experience。

### 27.2 Maintain behavior

给定连续多个 `maintain`：

- Base Plan 继续正常演化；
- scheduled future events 不被意外取消；
- 不出现当前 ambient 无限冻结；
- 不调用 Decision 2。

### 27.3 Patch operations

逐一测试：

- ADJUST；
- RESCHEDULE；
- REPLACE；
- SUPPRESS；
- INSERT；
- NO_SAFE_PATCH。

确保 patch：

- 不修改历史；
- 不修改 freeze buffer；
- 只作用于 future horizon；

- application status 与 memory 一致。

### 27.4 Complexity regression

测试：

1. Base Plan 已接近 concurrent-source limit，Decision 2 提议 INSERT；  
   应拒绝、替换或要求 suppress，不得继续叠加。

2. Adaptive 连续三次提议新增 event；  
   frequency/salience/cumulative budget 必须阻止过密声音。

3. 状态不稳定且当前声景过密；  
   应允许 SUPPRESS/ADJUST，不能只会新增 body/event。

4. Non-Adaptive Base Plan 本身过于复杂；  
   plan validator 必须在 session 前拒绝，而不是把问题留给 Adaptive 修复。

### 27.5 Observation timing

在 60s window / 40s update 示例下测试：

- 第一个 post-adaptation checkpoint 包含 pre-adaptation data 时为 `not_yet_observable` 或 low confidence；
- fully post-adaptation window 才进入 provisional evaluation；
- transition 未完成不得评价；
- failed patch 不得评价。

### 27.6 Reflection outcome

覆盖：

- aligned；
- opposed；
- no clear change；
- inconclusive；
- invalid signal；
- concurrent base-plan change；
- repeated aligned evidence；
- single opposed 不永久 blacklist；
- inconclusive 不形成 lesson。

### 27.7 Prompt consistency

测试：

- Decision 2 不修改 Decision 1 intent；
- Decision 2 不重新判断 adapt/maintain；
- Reflection 不直接选择下一 action；
- hard gate 无法被 LLM 覆盖；
- `maintain` 表示继续 Base Plan；
- `NO_SAFE_PATCH` 安全回退 Base Plan。

### 27.8 Async/latency/failure

模拟：

- Decision 1 timeout；
- Decision 2 timeout；
- stale response；
- schema incomplete；
- network error；
- Unity reject；
- newer decision supersedes older request。

所有情况下声音不中断，Base Plan 持续执行。

---

## 28. Offline replay benchmark

使用已有 pilot checkpoint/log 构建 replay dataset。对候选模型与 reasoning 配置比较：

```text
p50/p95 latency
schema validity
retry rate
policy compliance
Decision 1/2 role consistency
patch coherence
complexity violations
reflection use
unnecessary INSERT rate
NO_SAFE_PATCH rate
estimated cost
```

不要仅以模型新旧决定最终配置。选择满足质量下限、稳定性要求和实时 deadline 的最快配置。

---

## 29. 验收标准

### Base Plan 与实验条件

- [ ] Non-Adaptive 与 Adaptive 均从完整十分钟 Base Plan 出发；
- [ ] 支持 matched Base Plan A/B 与 counterbalanced assignment；
- [ ] Base Plan coherent 但刻意克制，并保留 adaptation headroom；
- [ ] Non-Adaptive 原样执行其计划；
- [ ] Adaptive 不再逐窗口从零生成完整场景；
- [ ] `maintain` 时 Base Plan 继续自然演化。

### Adaptive patching

- [ ] Decision 2 只输出 future local patch；
- [ ] 优先 ADJUST/RESCHEDULE/REPLACE/SUPPRESS，而非 INSERT；
- [ ] complexity/salience budget 由代码验证；
- [ ] Adaptive 可以简化声景，不等于不断新增声音；
- [ ] past 与 freeze buffer 不可修改；
- [ ] rejected/failed patch 不进入有效 adaptation history。

### Reflection

- [ ] 每次 adaptation 保存 provisional hypothesis；
- [ ] outcome evaluation 由结构化代码完成；
- [ ] overlapping window 与 transition 被正确处理；
- [ ] outcome 只标记 aligned/opposed/inconclusive 等 observed response；
- [ ] 不输出因果证明；
- [ ] memory 是 session-local、confidence-aware；
- [ ] 单次 observation 不被过度泛化；
- [ ] Decision 1 和 Decision 2 只读取短结构化 memory。

### 稳定性与 latency

- [ ] 模块职责不冲突；
- [ ] Reflection 不新增第三个实时 LLM 调用；
- [ ] LLM reasoning 异步运行，不阻塞 Base Plan；
- [ ] stale response 不会应用；
- [ ] timeout/invalid output/validator failure 均安全回退 Base Plan；
- [ ] model/reasoning/token/timeout 参数可配置；
- [ ] Decision 2 默认 low reasoning，复杂案例才升级；
- [ ] 日志可以重建完整 decision/patch/outcome timeline。

---

## 30. Codex 完成后必须返回

完成实现后，请提供：

1. 实际修改文件清单；
2. 旧架构与新架构的数据流对照；
3. Base Plan A/B profile 与 matching validator；
4. Non-Adaptive/Adaptive condition assignment 示例；
5. Decision 2 新 prompt 与 schema 的位置；
6. complexity/salience validator 的实现位置；
7. adaptation lifecycle、outcome evaluator 与 memory 的实现位置；
8. async timeout/stale-response fallback 的实现位置；
9. 新增测试及完整测试结果；
10. 仍为 `TBD_PILOT` 的所有阈值；
11. 一段模拟十分钟日志，证明：
    - Base Plan 持续演化；
    - maintain 不冻结场景；
    - adaptive patch 没有不断叠加声音；
    - complexity budget 有效；
    - reflection 能避免立即重复疑似 counterproductive 的策略；
    - LLM timeout 时播放不中断。

---

## 31. 最终设计原则

> The adaptive condition should not generate a new soundscape from scratch at every EEG checkpoint. Both conditions should begin from complete, matched, and intentionally restrained base plans. The non-adaptive condition executes its plan unchanged, while the adaptive condition applies minimal, future-facing, EEG-informed patches within explicit complexity and salience budgets. Adaptation is not synonymous with adding sound. Each patch is treated as a provisional hypothesis whose subsequent observed response is evaluated conservatively and stored as session-local memory. Reflection informs later decisions without introducing causal overclaiming, prompt-role conflicts, blocking latency, or an additional real-time LLM call.
