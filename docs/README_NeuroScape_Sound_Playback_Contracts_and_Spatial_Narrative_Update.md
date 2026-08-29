# NeuroScape `debug` 分支实施说明：Sound Playback Contracts、Selection Policy 与 Spatial Coherence

> Repository baseline: `yujianing0210/NeuroScape2.0`, branch `debug`  
> Architecture verified against the repository before this document was updated.  
> 本文是给 Codex 的实施指令，不是概念提案；遇到本文示例与代码类型不一致时，以 `debug` 分支的真实 contract 为基线，并按本文指定的最小扩展方式实施。

## 1. 文档目的

请在当前 NeuroScape repository 中完成一轮声音选择与播放逻辑更新，使 ambient、event 和 action/body-anchor sounds 的出现、消失、重复、音量变化、空间运动和相互关系更加自然、克制且符合物理空间逻辑。

本任务包含三层修改：

1. **Asset-level playback contracts**  
   为指定音频建立代码强制执行的播放规则，包括重复次数、音量包络、fade、crossfade、最大出现次数、最小间隔和安全音量。

2. **Selection policy**  
   为 Decision 2 提供结构化的优先级、质量标记、使用频率、适用状态和候选过滤逻辑。LLM 负责选择意图和合适的声音角色，但不能绕过硬约束。

3. **Spatial coherence on the existing journey/runtime model**  
   使用现有 `SceneJourneyPlan.userJourney`、scene graph、`JourneyController` 和 `RuntimeWorldState` 维护声景中的语义位置、路径、移动和邻近环境，使 stream、waterfall、grass footsteps、creek steps 等声音形成合理联系；同时允许 bird、insect、rustle 等独立事件在 stationary 或 moving 状态下自然发生。不要另建一套平行的空间状态系统。

本任务必须与已有 Base Plan、Adaptive patching、Decision 1/Decision 2、Reflection memory、complexity/salience budget、Module 03 runtime controller 和浏览器 Web Audio/HRTF runtime 集成，不得创建一套独立且互相冲突的声音系统。

### 1.1 当前代码的权威架构边界（不得违反）

当前系统不是 Unity runtime。实现必须遵守以下数据流：

```text
Module 01 NeuroState + Module 02 SceneJourneyPlan
                    ↓
Module 03 Runtime Scene Controller
  - SceneGraph / SemanticLocationMapper
  - JourneyController
  - AmbientController / ActionController / EventController
  - TransitionController / PlanValidator
                    ↓
RuntimeWorldState（唯一权威的数值空间状态）
                    ↓
Frontend RuntimeStore → AudioEngine → SourceManager
                    ↓
PlaybackScheduler + GainManager + HRTFRenderer（Web Audio API）
                    ↓
browser binaural output
```

强制边界：

- Module 02/Adaptive Planner 只生成或 patch `SceneJourneyPlan`，不直接操纵 Web Audio nodes；
- Module 03 负责把 semantic `locationId`、journey waypoint 和 event trajectory 解析为数值 `worldPosition`、`velocity`、`gain`、`active/lifecycle`；
- `RuntimeWorldState` 是 frontend 唯一的空间真值；
- `HRTFRenderer` 使用 Web Audio `PannerNode`，`panningModel = 'HRTF'`；它只消费 listener-relative 数值位置，不推断森林、溪流或瀑布语义；
- `ThreeScene`/Three.js 只做 runtime state 可视化，不负责空间计算，也不得成为音频位置真值；
- frontend 不重新解释 EEG、不运行 Decision 2、不重建 semantic journey、不伪造 source movement；
- 精确的 buffer 启停、循环、repeat burst、Web Audio gain automation 属于 frontend audio execution；语义合法性、session policy 和空间轨迹属于 planner/shared contracts/Module 03。

---

## 2. 核心设计原则

### 2.1 Hard constraints 与 soft preferences 必须分开

**Hard constraints** 由代码、schema 和 runtime validator 强制执行：

- 每个 asset 的 fade/repeat/envelope；
- session maximum count；
- minimum interval；
- 允许的 gain range；
- loop/crossfade；
- compatible/incompatible context；
- required spatial transition；
- complexity 与 salience budget；
- freeze buffer 和 future patch horizon。

**Soft preferences** 可由候选排序和 LLM 参考：

- 哪个 bird asset 优先；
- 哪些质量较差的 asset 降低优先级；
- 哪种 grounding cue 更适合当前 context；
- 是否保持 stationary 或开始一个 movement transition；
- 在多个合法候选中选择哪一个。

不要把所有规则写进 prompt 后期待 LLM 自己记住。LLM 输出必须经过 deterministic resolver/validator，最终播放参数由代码生成。

### 2.2 Adaptation 不等于无节制添加，但 `INSERT` 不是末选项

不要使用全局固定的 operation 排序，例如永远要求：

```text
ADJUST / RESCHEDULE / REPLACE / SUPPRESS > INSERT
```

这个规则不适合当前极稀疏的 Base Plan。当前 `forest_base` 只有一个持续 ambient 和两个预设 event，并且通过 `reservedAdaptationHeadroom` 有意为 Adaptive condition 留出空间。如果始终优先修改或删除，Adaptive 只能反复操作少量已有元素，难以形成可感知的层次和变化。

Decision 2 应根据 current scene density、upcoming Base Plan horizon、complexity/salience headroom 和 adaptation intent 动态选择 operation：

| 当前/即将到来的声景状态 | 推荐 operation policy |
|---|---|
| `low density`，且有充足 headroom | `INSERT`、`ADJUST`、`COMPOSE` 都是一等选择；如果 intent 需要可感知变化，可以优先加入一个克制的新 layer/cue |
| `medium density` | 优先 `ADJUST / RESCHEDULE / REPLACE`；只有新增内容填补明确缺失角色且仍在预算内时才 `INSERT` |
| `high density` 或即将发生重叠 | 优先 `SUPPRESS / REMOVE / REDUCE / RESCHEDULE`，避免继续叠加 |
| `closing`、cooldown 或低置信度 | 保持或简化；不为了制造 Adaptive 效果强行添加 |

因此：

- 不要因为 Base Plan 中已经有 ambient，就禁止加入第二个短时、低显著度的 localized ambient；
- 不要因为未来几分钟有一个 bird event，就把当前所有 event insert 都视为重复；应检查真实时间重叠和 family cooldown；
- action/body anchor 被提高使用机会，不等于强制高频播放；
- journey cue 不得导致每次 scene change 都机械插入 footsteps；
- `INSERT` 后也可以由后续 patch 平滑 remove，使层次变化是暂时的，而不是不断累积。

### 2.3 Adaptive 的目标是 temporal richness，而不是 simultaneous density

允许 Adaptive condition 相比 Non-Adaptive Base Plan 在整个十分钟内表现出更多层次、更多变化和更丰富的空间演化。这是系统贡献的一部分，而不是需要完全消除的差异。

但必须区分：

- **Temporal richness**：不同时间段出现不同声源角色、空间关系和轻微 journey evolution；这是期望目标。
- **Simultaneous density**：同一时刻堆叠多个 ambient、event、action；这仍需严格限制。

期望结果可以是：

```text
forest bed
→ brief bird event
→ temporary breath/body anchor
→ return to sparse forest
→ grass movement + gradually emerging stream
→ stationary stream-bank soundscape
→ simplified closing
```

而不是：

```text
forest + stream + footsteps + breath + bird + owl + insect simultaneously
```

实现要求：

- Base Plan 是 coherent but sparse scaffold，而不是 Adaptive 的完整上限；
- Adaptive patch 应使用预留 headroom 形成有限、可撤回的局部 elaboration；
- 每次 patch 仍遵守最多一个 salient event、ambient/action 上限和总 salience budget；
- 在 sustained-focus 或状态稳定时，也可使用 `support-sustained-focus` 进行低显著度演化，不把 Focus 自动等同于永久 maintain；
- 当声景超过配置化的 `maxMeaningfulStasisSec`（若尚无则新增，数值标记 `TBD_PILOT`），Decision 1 应考虑一次最小 supportive evolution，但不得伪造 mind wandering；
- Adaptive 可以总体更丰富，但不应预设“每个 Adaptive session 必须比 Non-Adaptive 多播放固定数量的声音”。最终变化次数仍由状态、phase、confidence、cooldown 和安全预算决定。

### 2.4 Attention intent 与 density policy 的权威优先顺序

Attention reasoning 与 sound density 不处在同一个决策层级，不能让二者互相竞争。必须采用以下单向顺序：

```text
EEG / attention evidence + trend + confidence + stasis
→ deterministic eligibility gate
→ Decision 1: whether and why to adapt
   输出 intent + salience + scope + constraints
→ code computes scene density / headroom / legal operations
→ Decision 2: how to realize the locked Decision 1 intent
→ deterministic validation and runtime application
```

权威规则：

1. **Attention first**：Decision 1 依据 attention evidence、trajectory、confidence、phase、history 和 stasis，决定 `adapt/maintain` 以及目标；
2. **Density second**：只有当 Decision 1 已经决定 adaptation intent 后，density 才决定采用 `INSERT`、`ADJUST`、`REPLACE`、`SUPPRESS` 等哪种实现方式；
3. **Safety can constrain, not reinterpret**：complexity、cooldown、spatial legality 和 density 可以缩小可执行方案、降低 salience，或者返回 `NO_SAFE_PATCH`，但不能把 `support_grounding` 改成 `refresh_engagement`，也不能重新解释 EEG；
4. **Decision 2 cannot override Decision 1**：Decision 2 输出的 intent 必须与 Decision 1 完全一致；
5. **Density cannot independently trigger a corrective claim**：声景稀疏不能被解释为用户 mind wandering；长期 stasis 只能由 Decision 1 选择 non-corrective `support_sustained_focus` 或 `refresh_engagement`；
6. **Attention cannot override hard audio safety**：即使注意力证据强烈，也不能突破 source concurrency、salience、cooldown、asset contract 或 spatial validity。

示例：

- Decision 1 输出 `support_grounding`；low density 允许 Decision 2 `INSERT` 一个 temporary breath action；
- 同样的 `support_grounding` 发生在 high density 时，Decision 2 应先降低或替换现有 layer，再安全地实现 grounding，或返回 `NO_SAFE_PATCH`；
- density 不得让 Decision 2 把目标改成 scene transition，除非 Decision 1 已明确允许该 scope。

为彻底防止重复 reasoning，Decision 2 不应继续接收完整 `eegState`。它只需接收 Decision 1 的锁定输出、当前/未来声景摘要、density guidance、合法候选、restrictions 和相关 reflection cases。若 phase 等字段确实影响执行，传递离散摘要，不重新传递 raw attention features。

### 2.5 Physical bonding 很重要，但不应过度字面化

系统应维护声音之间的现实关联，例如：

```text
forest interior
→ grass footsteps / approaching movement
→ stream becomes gradually audible
→ stream bank or creek
→ optional creek steps / wading
→ waterfall becomes audible ahead
→ waterfall passes and recedes
→ return to stream or forest
```

但是：

- 并非每次 stream gain 变化都意味着用户移动；
- ambient texture 可以在 stationary 状态下自然变化；
- bird、owl、insect、rustle 等事件不依赖用户移动；
- 不要把声音环境强制变成连续步行故事；
- `listener_motion` 必须是明确选择的 narrative transition，而不是由任何 sound change 自动推断。

---

## 3. 开始修改前：repository 与 audio inventory audit

在修改代码之前，必须先检查并报告：

1. 所有目标 audio files 的实际路径、文件名、格式、duration、sample rate 和 channel count；
2. 目标 asset 是否已在 Scene Knowledge Base/JSON 中注册；
3. 当前 gain/volume 的单位和有效范围；
4. 当前 browser audio runtime 的 fade、loop、spatial movement 与 scheduling 实现，重点检查 `AudioEngine`、`SourceManager`、`PlaybackScheduler`、`GainManager`、`HRTFRenderer`；
5. 当前 event appearance count 和 cooldown 如何统计；
6. 当前 Decision 2 如何获得 candidate assets；
7. 当前 Base Plan/patch schema 是否支持 stable element IDs；
8. 当前 action sounds 几乎不出现的真实原因：候选过滤、Decision 1 goal-to-layer policy、prompt、priority、schema、role 名称、asset manifest、frontend load、compatibility、`ActionController` activation rule 还是 planner 输出；
9. 以下文件是否真实存在，并纠正任何命名差异：

```text
forest_soft_owl_far_01
forest_bird_far_01
forest_bird_far_02
forest_small_animal_rustle_far_01
forest_insect_chirp_far_01
forest_water_drop_far_01
forest_stream_ambient_bed_01
forest_grass_footstep_01
forest_body_slow_creek_steps_01
body_slow_breath_01
frontend/public/audio/common/action/body_slow_breath_01.wav
```

如果实际 asset ID 或路径不同，使用 repository 中的真实值，并在最终报告中给出映射。不要复制一份拼写近似的新 asset。

### 3.2 已确认的 repository baseline

以下内容已经在 `debug` 分支确认，Codex 应复核而不是重新猜测：

- canonical metadata：`packages/contracts/src/audio_library.json`；
- typed access：`packages/contracts/src/audio-library.ts`；
- Decision 2 retrieval/schema/validation：`packages/adaptive-planner/src/audio-retrieval.ts`；
- Base Plan：`packages/adaptive-planner/src/base-plan.ts`；
- semantic plan contract：`packages/contracts/src/scene-journey-plan.ts`；
- numeric runtime contract：`packages/contracts/src/runtime-world-state.ts`；
- Module 03 validation/resolution：`module-03-runtime-scene-controller/src/validation/PlanValidator.ts` 和 `controllers/*Controller.ts`；
- browser playback：`frontend/src/audio/*`。

现有关键行为：

- `SourceManager` 当前把 ambient 输出额外乘以 `AMBIENT_OUTPUT_GAIN = 0.2`；
- `SourceManager` 当前默认 ambient/action loop，event one-shot；
- `PlaybackScheduler` 当前只支持单 buffer source 的 start/stop/loop，不支持 burst repeats 或双 source crossfade；
- `GainManager` 当前只提供固定 40ms linear ramp，不支持 asset-specific multi-segment envelope；
- `EventController` 已负责 trajectory 插值、distance gain、activation/lifecycle 和 transition gain；
- `ActionController` 中 `attachment === 'feet'` 的 action 只有 listener velocity 大于 epsilon 才 active；
- `PlanValidator` 已检查 scene graph 邻接、gain、trajectory 与 transition policy，但尚未执行 asset-level session limits/playback contracts；
- Decision 2 schema 当前把 gain 锁定为 metadata 的 `recommended_volume`，把 event duration 锁定为 authored motion duration 或 `auto_delete_after_sec`。不要让 LLM 任意发明 gain/duration。

因此，实施时应扩展现有 shared metadata、validator/controller 和 browser scheduler，不要新建绕过这些组件的第二条播放链路。

当前 metadata 中与需求直接相关的差异：

| Asset | 当前 `debug` metadata | 本任务要求 |
|---|---|---|
| `forest_soft_owl_far_01` | `repeat_count=1`, motion `none`, priority `0.35` | 每 appearance 解析为 2/3-repeat burst，并有一致 motion/gain pattern |
| `forest_bird_far_01` | priority `0.85` | secondary/fallback |
| `forest_bird_far_02` | priority `0.65` | 同等合法时高于 `_01`；max 3/session；间隔严格大于 60s |
| `forest_water_drop_far_01` | 6s lifecycle、water-drop 描述 | 不可直接当作 12s+ waterfall；先完成素材/语义决策 |
| `forest_stream_ambient_bed_01` | loop=true，fade 4s/4s | runtime 实际执行 fade；是否需 crossfade 由 audio QA 决定 |
| grass/creek footsteps | action、loop=true | 用 feet attachment，并与真实 journey movement 绑定 |
| `body_slow_breath_01` | action、loop=true、priority `1.0` | stationary grounding 可选，使用 body/chest attachment |

### 3.3 必须检查 clip duration

特别验证：

- `forest_water_drop_far_01` duration 是否至少支持 6 秒 fade-in + 中段 sustain + 6 秒 fade-out；
- owl/bird clip 是否包含文件内部静音；
- stream clip 是否适合直接 loop，还是必须 crossfade loop；
- footsteps clip 是否已经包含多步；
- audio 文件开头/结尾是否存在 click、abrupt transient 或 DC offset。

如果 `forest_water_drop_far_01` 总时长不足 12 秒，不得静默压缩为错误 envelope。应报告 blocker，并选择以下兼容方案之一：

- 延长播放 instance 并保持中段；
- 使用可循环/可延展版本；
- 将 6 秒作为 target，按 clip duration 比例缩短，同时标记 deviation；
- 要求替换 asset。

未经检查不要假设所有 WAV 可以 seamless loop。

---

# Part A：统一 Sound Asset Metadata

## 4. 建立 machine-readable playback profile

不要创建独立且重复的 Scene Knowledge Base。扩展现有 canonical `packages/contracts/src/audio_library.json` 及 `AudioLibraryAsset` 类型，并让 planner、Module 03 和 frontend 都从这一个 source of truth 读取。现有字段 `fade_in_sec`、`fade_out_sec`、`repeat_count`、`repeat_interval_sec`、`priority`、`recommended_volume`、`default_motion` 必须复用；只为当前结构无法表达的规则新增可选字段。

建议在现有 asset object 中新增如下兼容字段（字段名可按 repository conventions 调整，但不得重复已有字段）：

```json
{
  "asset_id": "forest_soft_owl_far_01",
  "layer": "event",
  "quality_tier": "preferred | standard | limited_use",
  "selection_weight": 1.0,
  "session_limits": {
    "max_appearances": null,
    "min_interval_sec": null
  },
  "gain_profile": {
    "default_gain": "EXISTING_SCALE",
    "max_safe_gain": "EXISTING_SCALE",
    "quality_attenuation": 1.0
  },
  "playback_contract": {
    "mode": "single | burst | long_bed | one_shot_envelope",
    "repeat_count_options": [1],
    "inter_repeat_gap_sec": "CONFIG",
      "envelope_kind": "metadata_fade | proportional_one_shot | burst | crossfade_bed",
    "loop_crossfade_sec": 0,
    "requires_gain_motion": false
  },
  "narrative_compatibility": {
    "locations": [],
    "locomotion_states": [],
    "requires_related_active_family": null
  }
}
```

不要把 `default_gain` 另存为第二个真值；默认/推荐 gain 继续使用 `recommended_volume`。不要把 `role` 与现有 `layer` 混为两个互相矛盾的分类字段。

所有示例 gain 数值必须映射到当前系统的 linear gain `[0, 1]` scale，并考虑 `SourceManager` 对 ambient 的额外 `0.2` output multiplier。不得把 dB 值直接写入当前 gain 字段，也不得在不审查现有 ambient attenuation 的情况下再重复衰减。

## 5. 统计语义

统一定义：

- `appearance`：一次逻辑 activation/cluster；
- `internal_repeat`：同一次 appearance 内的重复；
- `session_count`：appearance 数，不把 owl 的 2–3 次 internal repeat 误算成 2–3 次 appearance；
- `min_interval_sec`：两次 appearance 的实际开始时间或结束到开始间隔，选择一种并全局一致；
- `active_instance`：`SourceManager` 中正在播放的 `ManagedSource` / `AudioBufferSourceNode`；
- `sound_family`：例如 bird、owl、stream、waterfall、footstep、breath。

日志和测试必须使用相同语义。

---

# Part B：指定 Asset Playback Contracts

## 6. `forest_soft_owl_far_01`

### 6.1 必须行为

每次被选择时：

- 形成一个 burst/cluster；
- 连续播放 2 次或 3 次；
- repeat count 只能是 2 或 3；
- 同一 burst 内 gain 必须单调变化；
- gain 方向必须与 spatial trajectory 一致。

### 6.2 Approach/recede mapping

```text
approaching listener:
gain_1 < gain_2 [< gain_3]
distance_1 > distance_2 [> distance_3]

receding from listener:
gain_1 > gain_2 [> gain_3]
distance_1 < distance_2 [< distance_3]
```

如果 trajectory 为 overhead passing，可以使用：

```text
2 repeats: approach → recede is not sufficiently expressive; prefer 3 repeats
3 repeats: lower → peak → lower
```

但这属于另一种明确的 `pass_by` pattern，不要把它混同于单调 approach/recede。

### 6.3 Runtime resolver

LLM 只输出：

```json
{
  "asset_id": "forest_soft_owl_far_01",
  "motion_intent": "approach | recede | pass_by"
}
```

代码决定：

- repeat count；
- 每次 gain；
- distance trajectory；
- inter-repeat gap；
- safe max gain；
- fade/crossfade。

选择 2/3 repeats 时应：

- 支持 deterministic random seed；
- 避免同一 session 每次完全相同；
- 不得超出 complexity/salience budget。

当前 owl metadata 的 lifecycle 只有 6 秒，而描述显示 clip 约 5 秒；2–3 次完整 repeat 加 gap 很可能超过 6 秒。实施时必须让 authored event duration 与解析后的 burst 总时长一致：

```text
burst_duration = repeat_count * playable_clip_duration
               + (repeat_count - 1) * inter_repeat_gap
               + required_release_tail
```

更新 `authoredEventDurationMs()`/Decision 2 schema，使它从 deterministic playback contract 得到合法 duration，或让 metadata 明确提供 burst lifecycle。不要让 frontend 在 Module 03 已将 event 标记 `finished` 后继续私自播放；也不要为了适配原 6 秒而截断第二/第三次 owl。

### 6.4 Session example

如果十分钟内出现两次 owl，可合法生成：

```text
Appearance 1: 2 repeats, receding, gain decreases
Appearance 2: 3 repeats, approaching or pass-by, gain changes consistently
```

这只是示例，不要求每个 session 必须出现两次。

---

## 7. `forest_bird_far_02` 与 `forest_bird_far_01`

### 7.1 Selection priority

在两者均合法、均与当前 context compatible、session limits 未达到的情况下：

```text
forest_bird_far_02 priority > forest_bird_far_01
```

实现为 candidate ranking/selection weight，而不是 hard ban `_01`。

当前 metadata 实际为 `_01.priority = 0.85`、`_02.priority = 0.65`，与本需求相反。必须调整 canonical metadata 或明确的 family ranking，使 `_02` 在其他条件相等时排在 `_01` 前；同时更新 deterministic retrieval test，避免 prompt 与代码排序互相矛盾。

### 7.2 `_02` session limits

`forest_bird_far_02`：

- 每个十分钟 session 最多 3 次 appearance；
- 相邻两次 appearance 的间隔必须严格大于 60 秒；
- 每次 appearance 的 gain 不能完全固定；
- gain variation 必须在安全范围内；
- variation 可以来自距离、飞行方向或轻微自然差异；
- 不得为了 volume variation 制造突兀 jump。

建议 metadata：

```json
{
  "session_limits": {
    "max_appearances": 3,
    "min_interval_sec_exclusive": 60
  },
  "selection_rank_within_family": 1,
  "requires_gain_motion": true
}
```

`forest_bird_far_01` 作为 secondary candidate，在 `_02` 因 cooldown/limit/context 不可选时仍可出现；它也必须遵守全局 bird-family frequency 和 repetition constraints。

---

## 8. Limited-use assets

目标：

```text
forest_small_animal_rustle_far_01
forest_insect_chirp_far_01
```

### 8.1 Quality flags

由于电子感、金属感或背景噪声较明显：

- `quality_tier = limited_use`；
- selection priority 低于其他合适 event；
- 设置 `quality_attenuation`；
- 强制较低 max gain；
- 避免与其他高频/金属感 asset 同时播放；
- 避免在低密度、非常安静的时刻以突出 foreground 方式出现；
- 仍保留低概率选择，不完全禁用。

### 8.2 不得仅用 prompt 说“调低音量”

runtime 必须执行：

```python
resolved_gain = min(
    requested_gain * quality_attenuation,
    asset.max_safe_gain,
    remaining_salience_headroom,
)
```

实际 attenuation 值配置化，并通过试听/pilot 确定。标记 `TBD_AUDIO_QA`。

---

## 9. `forest_water_drop_far_01`：必须先解决素材语义与时长冲突

### 9.1 语义

当前 canonical metadata 将它描述为 `Distant Forest Water Drop`，`auto_delete_after_sec = 6`，`default_motion.type = none`，并不是已验证的 waterfall bed。用户希望它表达“偶然经过瀑布”的产品意图，与当前 metadata 存在明确冲突。

Codex 必须先读取真实音频 duration 并试听/检查波形，然后在最终报告中选择并说明以下一种结果：

1. **推荐：替换/新增真实 waterfall asset**，保留 `forest_water_drop_far_01` 的 water-drop 语义；
2. 若真实 clip 确实是 waterfall 且 metadata 错误，则更正 label/description/tags/lifecycle，并使用新的明确 asset 版本或迁移说明；
3. 若必须继续使用当前约 6 秒 one-shot，则不得声称它是完整 waterfall passage，也不得强行套用 12 秒以上的 envelope；只将其作为远处 water cue，并使用按 clip 时长比例缩放的平滑包络。

不要在未更换素材的情况下，仅通过重复同一个 6 秒 water-drop clip 来伪造长瀑布；这很可能产生周期性和不自然的结果。

### 9.2 Gain envelope contract

对于经过试听验证、时长足够的 waterfall-like asset，每次 appearance 的目标包络为：

```text
first 6 sec: gain 0 → target peak, smooth fade-in
middle: hold target peak
last 6 sec: target peak → 0, smooth fade-out
```

当前 6 秒 `forest_water_drop_far_01` 无法同时满足 6 秒 fade-in、中段 sustain 和 6 秒 fade-out。若保留该素材，使用配置化比例包络（例如 fade-in 35%–40%、短 hold、fade-out 35%–40%，精确值标记 `TBD_AUDIO_QA`），且总时长不超过实际 buffer duration。

共同要求：

- envelope 使用平滑曲线，不使用突变 step；
- target peak 受 current salience budget 与 asset max gain 限制；
- fade 不得被 LLM 覆盖；
- frontend 必须使用 `AudioContext.currentTime` 和 `AudioParam` automation 执行；
- 提前 suppress 时也必须使用 graceful fade-out；
- 不得在 ending sample 处突然 stop。

扩展 `GainManager` 以支持 asset-specific envelope（cancel-and-hold/安全取消既有 automation、分段 ramp、early-release）。不要只依靠 Module 03 snapshot 间的 40ms ramp 来模拟 6 秒包络。

### 9.3 Narrative constraint

`forest_water_drop_far_01` 不应随机出现在没有水环境关联的 forest interior 中。至少满足其一：

- stream 当前 active；
- stream 在 recent narrative history 中 active，且 state 正在 `approaching_waterfall`；
- Base Plan 已明确安排从 stream/creek 进入 waterfall encounter；
- 作为远处声音出现时，stream/water context 已通过 narration state 建立。

如果 water sound 只是极远的 environmental event，可不强制用户步行，但仍必须存在 water-related spatial context。

---

## 10. `forest_stream_ambient_bed_01`

### 10.1 Ambient behavior

作为 ambient bed：

- duration 通常显著长于 event；
- 必须渐入和渐出；
- 需要多次 clip repetition 时，使用 crossfade/overlap smoothing；
- 不得在循环边界出现 click、gap 或明显重新开始；
- transition 到其他 ambient 时使用受约束 crossfade；
- stream gain/distance 可随 journey state 缓慢变化。

### 10.2 Loop/crossfade contract

优先顺序：

1. 如果 asset 本身被验证为 seamless loop，使用 validated loop points；
2. 否则使用双 audio-source crossfade；
3. 如果 clip 不适合循环，限制 duration 并安排兼容替代，而不是无限硬 loop。

建议 metadata：

```json
{
  "playback_contract": {
    "mode": "long_bed",
    "fade_in_sec": "CONFIG_TBD_AUDIO_QA",
    "fade_out_sec": "CONFIG_TBD_AUDIO_QA",
    "loop_strategy": "native_loop | crossfade_repeat | no_loop",
    "loop_crossfade_sec": "CONFIG_TBD_AUDIO_QA",
    "minimum_presence_sec": "CONFIG_TBD_PILOT"
  }
}
```

当前 `PlaybackScheduler` 只设置 `AudioBufferSourceNode.loop = true`，尚无双 source crossfade。只有在确认 native loop 边界不可接受后，才实现双 `AudioBufferSourceNode` overlap/crossfade；不要在没有试听验证时硬编码 crossfade 长度。

---

## 11. Action/body-anchor sounds

目标：

```text
forest_grass_footstep_01
forest_body_slow_creek_steps_01
body_slow_breath_01
```

### 11.1 先修复“不出现”的真实原因

在增加权重前，必须验证：

- role 是否为 `action`、`body_anchor` 还是其他名称；
- Decision 2 schema 是否允许该 role；
- asset path 是否可被 `audioAssetManifest` / `AudioAssetManager` 正确加载；
- candidate filtering 是否意外排除 common/action 路径；
- LLM prompt 是否只列 ambient/event；
- hard constraint 是否过严；
- selection weight 是否为 0/缺失；
- output validator 是否拒绝 action；
- `SourceManager` / `PlaybackScheduler` 是否实际支持相应 playback mode。

不要只提高 LLM prompt 权重而忽略路径或 schema bug。

当前代码已确认：三个目标 action 都存在于 canonical library，且 `body_slow_breath_01` 的 `asset_ref` 为 `common/action/body_slow_breath_01.wav`。更可能的逻辑原因包括：

- `allowedLayers()` 只有在 `support-grounding` 且 `allowBodyAnchor` 时开放 action；
- 当前 Decision 2 prompt 对不同 goal 的 layer policy 较强；
- `ActionController` 会在 `attachment: 'feet'` 且 listener 不移动时自动停用；
- action 是 looped source，若 patch 没有明确 removal/transition，可能被 complexity gate 排斥。

Codex 必须用 fixture/test 逐项验证，不能把上述推断直接当成唯一 root cause。

### 11.2 `body_slow_breath_01`

适合：

- strong MW-leaning evidence；
- sustained decline with adequate confidence；
- `support_grounding`；
- `gently_reorient_attention`，且显著 event 可能太突兀；
- 用户处于 stationary/settling context。

限制：

- 不能把 EEG operational estimate 当作 definitive mind wandering；
- calibration/measurement confidence 低时降低使用强度；
- 不与密集 footsteps 或其他高显著度 event 同时出现；
- 遵守 body-anchor cooldown；
- 不强制用户同步呼吸，除非研究设计明确要求；
- 在日志中记录为 grounding/breath cue，而非治疗性 intervention。

### 11.3 `forest_grass_footstep_01`

语义：

- listener 在 forest floor/grass 上移动；
- approach/leave stream 或 water feature；
- forest interior 中的短暂 embodied movement transition。

生成 plan 时必须使用 `attachment: 'feet'`，并与合法的 journey waypoint movement 同时存在；否则现有 `ActionController.shouldBeActive()` 会在 listener velocity 为零时将其停用。这是预期保护，不应通过删除 velocity gate 来“提高出现率”。

适合：

```text
stationary_forest → walking_on_grass
walking_on_grass → approaching_stream
leaving_stream → walking_on_grass → stationary_forest
```

### 11.4 `forest_body_slow_creek_steps_01`

语义：

- listener 位于浅水/creek 中缓慢移动；
- 必须已有 stream/creek context；
- 不应直接从 dry forest interior 无过渡出现。

同样使用 `attachment: 'feet'`。`body_slow_breath_01` 则应使用 `body` 或 `chest`，使其在 stationary grounding 中也能播放。

适合：

```text
stream_bank → entering_creek → wading_in_stream
wading_in_stream → leaving_creek → stream_bank
```

### 11.5 Action sounds 的优先级提高方式

提高机会应通过：

- 修复候选与 schema；
- 在符合 narrative + EEG intent 时增加 selection weight；
- 把 action/body anchor 纳入 compatible candidate set；
- 在长期未使用且当前适合时提供 diversity bonus；
- Reflection 中记录 action outcome；
- 不通过无条件 session minimum 强迫出现。

除非另有明确实验决定，不要规定“每十分钟至少必须出现一次 action”。

---

# Part C：在现有 Journey 与 RuntimeWorldState 上维护空间连贯性

## 12. 不新增平行的 `SpatialNarrativeState`

原先建议的新状态对象会与当前系统重复。实现必须优先复用：

- semantic location：`SceneJourneyPlan.userJourney.waypoints[].locationId`；
- 合法邻接：现有 `SceneGraph` 与 `PlanValidator`；
- listener movement：`JourneyController` 计算的 `ListenerState.velocity`；
- transition progress：`RuntimeWorldState.journey.currentSegmentIndex`、`remainingWaypoints`；
- current semantic location：`RuntimeWorldState.listener.semanticLocation`；
- event movement：`EventPlanItem.trajectory` → `EventController` → `EventState.worldPosition/velocity`；
- body/feet attachment：`ActionPlanItem.attachment` 与 `ActionController`。

只有确实无法从这些字段推导的 planner-only 语义，才允许以最小可选字段加入 `DecisionContext`，例如：

```ts
interface SpatialCoherenceContext {
  movementSurface?: 'grass' | 'creek';
  activeEnvironmentalBonds: Array<'stream_water_system'>;
  transitionIntent?: 'remain' | 'approach_stream' | 'approach_waterfall' | 'return';
}
```

该 context 不是现实定位，也不得写入 frontend 作为第二个空间真值；它只帮助 planner 验证下一段 semantic patch。若字段可以由 current/upcoming plan 推导，就不要持久化重复状态。

## 13. 使用现有 location IDs 与 graph

当前 planner/scene graph 使用的核心 location IDs 是：

```text
forest_entry ↔ clearing ↔ stream_bank ↔ waterfall
```

不要直接输出尚未注册的 `forest_interior`、`forest_path`、`approaching_stream`、`in_creek`、`waterfall_passage` 等 locationId。若研究确实需要新增地点，必须同时更新：

1. scene graph node 与 neighbor；
2. `SemanticLocationMapper` 数值坐标；
3. planner 的 `locationScene` / `locationNeighbors`；
4. fixtures、PlanValidator tests 和 runtime tests。

本轮默认不扩张 graph；“approaching”用相邻 waypoint 间正在移动来表示，“stationary”用 listener velocity 约为零表示。

## 14. Stationary 与 embodied transition

Stationary mode：journey 不变或当前位置 pause；ambient 可缓慢演化，bird/insect/rustle 可出现，不自动插入 footsteps。

Embodied transition：Decision 2 patch 明确增加合法相邻 journey waypoint；`JourneyController` 产生 listener velocity；只有这时 `attachment: 'feet'` 的 footsteps 才会在现有 `ActionController` 中 active。movement 必须有终点，不能通过重复延后 waypoint 让 listener 永久移动。

建议序列（是模板，不是每次强制）：

- `clearing → stream_bank`：可在 journey movement 期间激活 grass footsteps，同时让 localized stream 渐强；到达后 feet action 随 velocity 归零而停止；
- `stream_bank → waterfall`：必须已有 water bond，可使用 creek steps 或 grass footsteps之一，waterfall-like cue 逐渐出现；
- `waterfall → stream_bank → clearing`：water cue 平滑退场，forest ambient 恢复，不允许瞬间切断所有 water layers。

Bird/owl/insect/rustle 与 listener locomotion 独立；移动时仍可出现，但必须服从并发 source 与 salience budget。

---

# Part D：Decision 2、Module 03 与 Browser Runtime 的真实分工

## 15. 扩展现有 candidate retrieval，不另建 planner

在 `packages/adaptive-planner/src/audio-retrieval.ts` 的 `retrieveDecision2Candidates` 上扩展：

1. 保留现有 scene/layer、active asset、exact asset cooldown、family cooldown、tag 与 priority 过滤；
2. 加入 session appearance count、exclusive minimum interval、quality tier、environmental bond 与 action compatibility；
3. 继续应用 complexity/salience headroom 与 Reflection memory；
4. LLM 只能选择过滤后的 candidate；
5. selection limit 不能只靠 prompt，输出后仍由 `validateDecision2Selection` 和 patch validator 二次验证。

同时，在调用 Decision 2 前由代码计算一个可检查的 operation guidance，而不是让 LLM 仅凭文字猜测场景是否已经过密：

```ts
interface OperationGuidance {
  currentDensity: 'low' | 'medium' | 'high';
  upcomingDensity: 'low' | 'medium' | 'high';
  complexityHeadroom: number;
  salienceHeadroom: number;
  prolongedStasis: boolean;
  preferredOperations: Array<
    'KEEP' | 'ADJUST' | 'RESCHEDULE' | 'REPLACE' | 'SUPPRESS' | 'INSERT'
  >;
}
```

该 guidance 必须由现有 Base Plan、accepted future patches、source concurrency、salience 和 stasis history 计算。不要让 LLM 自己统计完整 timeline。低密度时不得默认把 `INSERT` 排在最后；高密度时也不得因为候选合法就继续添加。

当前 `allowedLayers()` 对多数 goal 只返回 ambient/event，只有 `support-grounding` 且 `allowBodyAnchor` 时会返回 action。这很可能是 grass/creek/breath action 很少出现的主要路径之一。Codex 必须用测试确认 root cause，并在不破坏 Decision 1 intent 边界的前提下调整 goal-to-layer mapping，例如让合适的 `gently-reorient` 或明确 journey transition 可以检索 action，但不要让所有 goal 都无条件开放 action。

## 16. Decision 2 输入：在现有 payload 上做最小扩展

现有 payload 已包含 `eegState`、`currentLocation`、`listenerReachableLocations`、`soundSourceLocationIds`、`activeRuntimeScene`、`upcomingBaseHorizon`、`relevantPriorOutcomes`、`restrictions` 和 `candidates`。本轮修改必须**移除 Decision 2 的完整 `eegState`**，避免 Decision 2 重新解释 attention evidence 或推翻 Decision 1。

Decision 2 的权威输入应收敛为：

```json
{
  "decision1": {
    "intent": "LOCKED",
    "salience": "LOCKED",
    "scope": "LOCKED",
    "constraintsForDecision2": []
  },
  "executionContext": {
    "phase": "adaptive",
    "currentLocation": "clearing",
    "reachableLocations": [],
    "activeSceneSummary": {},
    "upcomingHorizonSummary": [],
    "operationGuidance": {},
    "restrictions": {}
  },
  "relevantPriorOutcomes": [],
  "candidates": []
}
```

如果 Decision 2 需要知道“这是 grounding 还是 sustained-focus”，它从 locked intent 获取；如果需要知道能否添加，则从 operation guidance、restrictions 和 candidate set 获取。它不需要 raw TBR、relativePosition、trajectory、calibration quality 或完整 recent attention history。

不得再发送一套语义重复的完整世界状态。`activeRuntimeScene` 应压缩为 active element IDs、layer、gain、location 和 remaining lifecycle；`upcomingBaseHorizon` 只保留 patch horizon 内会影响本次决策的元素。

仅对 candidate 添加必要摘要：

```json
{
  "remainingSessionAppearances": 2,
  "cooldownRemainingSec": 0,
  "qualityTier": "preferred",
  "playbackContractSummary": "burst 2|3; gain follows motion",
  "compatibleEnvironmentalBonds": ["stream_water_system"]
}
```

只传当前有关的最多若干条，避免 prompt 变长。对应字段应加入 `Decision2Candidate`，从 canonical `audio_library.json` 映射而来。

## 17. Decision 2 输出：继续使用 `SoundscapePlanPatch`

不要用新的 `sound_choices` JSON 取代现有 strict schema。Decision 2 继续返回 repository 已实现的 future-facing patch：

- `journey`；
- `upsertAmbient` / `upsertAction` / `upsertEvent`；
- `removeIds`；
- `selectedAssetIds`；
- concise rationale / hypothesis。

现有 schema 已锁定 candidate asset ID、recommended gain 和 authored event duration，应保留。若 owl 需要 `motionIntent` 等当前 `EventPlanItem` 无法表达的语义，只能通过向 shared contract 增加**可选且受 enum 限制**的 playback/motion hint，或由 canonical metadata + deterministic seed 自动解析；不得允许任意 gain arrays、任意 duration 或任意 coordinates。

LLM 不得输出或覆盖：

- owl 具体 gain 数列和 repeat timing；
- water cue 的 sample-level envelope；
- stream crossfade implementation；
- max-safe gain；
- session count/cooldown enforcement；
- complexity hard limit。

## 18. Module 03 的职责

在现有组件上实施，不创建另一套 runtime：

- `PlanValidator`：校验 asset ID/layer、water bond、合法相邻 journey、event trajectory；
- `JourneyController`：唯一 listener path/movement resolver；
- `EventController`：event activation、trajectory、world position、velocity、lifecycle 和 runtime gain；
- `AmbientController`：global/localized ambient 的位置与 transition gain；
- `ActionController`：body attachment 与 feet/velocity activation；
- `TransitionController`：plan-level activation/removal/gain transition。

注意：asset session counts 属于 session/planner state，不应塞进无状态的单 plan structural validation 而丢失历史；应在 patch acceptance gate 中执行，再由 `PlanValidator` 做结构和空间合法性验证。

## 19. Browser audio execution 的职责

扩展当前 frontend audio classes：

- `PlaybackScheduler`：支持 one-shot、native loop、2/3-repeat burst；必要时支持受控的 dual-source crossfade；
- `GainManager`：支持 metadata fade、分段 envelope、repeat-level gain sequence、early-release；全部使用 Web Audio clock；
- `SourceManager`：根据 resolved playback profile 创建/回收 source，保持 activation identity，防止 event snapshot 更新导致重复触发；
- `HRTFRenderer`：继续只接受 `RuntimeWorldState` 数值位置并更新 `PannerNode`，不得加入 semantic location lookup；
- `AudioAssetManager` / manifest：继续负责 `assetId → URL → AudioBuffer`，不得复制一份路径映射。

空间强弱不要只靠 HRTF distance attenuation：当前 `HRTFRenderer.rolloffFactor = 0`，实际距离相关 gain 已由 Module 03 的 `gentleDistanceGain` 计算。owl approach/recede 等规则必须避免在 Module 03 和 frontend 同时做两次距离衰减。

## 20. 安全失败与 condition parity

任一阶段 validation/resolution 失败时：

- Adaptive 继续当前 Base Plan；
- Non-Adaptive 继续预生成 Base Plan；
- 不播放未验证 patch；
- 记录 reason code，不写成成功 adaptation；
- browser audio 不得因为 LLM timeout/invalid output 停止现有 sources。

Non-Adaptive 与 Adaptive 必须使用同一 canonical metadata 和 browser playback contracts。区别只在 Adaptive 可以 patch shared Base Plan；不能让两组因不同 fade/repeat engine 产生音质混淆。

---

# Part E：Prompt 一致性原则

## 21. Decision 2 prompt 必须包含

```text
Maintain a coherent spatial world, not just a collection of individually appropriate sounds.
Use the supplied currentLocation, listenerReachableLocations, active journey, upcoming Base Plan horizon, and environmental-bond summary to decide whether the listener remains stationary or undergoes a meaningful adjacent waypoint transition.
Do not imply listener movement unless a transition is explicitly selected.
Waterfall-like sounds require an established stream/water context.
Footsteps should support a physically meaningful transition and should not be inserted mechanically for every scene change.
Bird, owl, insect, leaf, and rustle events may occur independently of listener locomotion when compatible with the current environment.
Prefer minimal sufficient changes. Adaptation is not synonymous with adding sound.
Do not globally prefer editing existing sounds over insertion. The shared Base Plan is intentionally sparse and reserves adaptation headroom.
When current and upcoming density are low, the Decision 1 intent requires a perceptible change, and all budgets permit it, a restrained INSERT or cross-layer composition is valid and may be preferable to repeatedly modifying the same ambient source.
When density is medium, prefer adjustment, rescheduling, or replacement unless insertion fills a clearly missing role. When density is high or overlap is imminent, simplify, suppress, remove, or reschedule.
Optimize for temporal richness across the session, not simultaneous source density. A newly inserted layer should usually be temporary or explicitly removed when its role is complete.
Sustained focus does not automatically require maintain. After prolonged perceptual stasis, consider a minimal supportive evolution without claiming that mind wandering occurred.
All exact playback envelopes, repeats, gain limits, cooldowns, and session limits are enforced by shared metadata, validation, Module 03, and the browser audio runtime; select only from the supplied legal candidates.
```

不要在 prompt 中重复完整 asset contract。只给 LLM 当前候选和 contract summary，避免 prompt 变长和规则冲突。

当前 `audio-retrieval.ts` 中已有以下全局指令：

```text
Prefer KEEP, ADJUST, RESCHEDULE, REPLACE, or SUPPRESS before INSERT.
```

必须删除或替换这条固定排序，改为上面的 density-aware operation policy。否则新增文字会与旧指令同时存在，造成 prompt 内部“左右脑互搏”。`Prefer minimal sufficient changes` 可以保留，但其含义应是最小且足以产生目标体验的改动，而不是默认拒绝新 layer。

### 21.1 Mandatory prompt conflict audit

Codex 在完成实现后必须逐条审计 Decision 1 和 Decision 2 prompts，建立 instruction ownership table。每条规则只能有一个权威 owner：

| 规则类型 | 权威 owner | 其他层允许做什么 |
|---|---|---|
| 是否适应、attention intent、salience、scope | Decision 1 | Decision 2 只能原样执行，不能重判 |
| Density、operation preference、候选合法性 | deterministic code + Decision 2 | Decision 1 不选择 asset/operation |
| Gain、repeat、fade、cooldown、source limits | shared metadata + validator/runtime | LLM 只能从合法摘要中选择 |
| Outcome observation | deterministic Reflection | 只能作为 provisional memory，不能改变 hard rule |

必须检查并消除以下冲突模式：

- 同时出现“优先 INSERT”和“INSERT 永远最后”；
- 同时出现“sustained focus 可以演化”和“focus 必须 maintain”；
- Decision 1 允许某 scope，但 Decision 2 prompt 又无条件禁止；
- prompt 要求选择 action，但 `allowedLayers()` 或 output schema 不提供 action；
- prompt 要求某种 gain/duration，但 strict schema 锁定为另一个值；
- Reflection 建议重复某策略，但 cooldown/session limit 禁止；
- LLM 被要求计算 code 已经计算好的 density、cooldown 或时间重叠；
- Decision 2 重新读取 EEG 后生成与 Decision 1 不同的目标。

新增自动测试：对最终组装后的 prompt 做 literal/semantic policy assertions，并为每个 Decision 1 intent 构造至少一个 low/medium/high-density fixture，验证 prompt、candidate set、strict schema 和 validator 不互相否定。

### 21.2 Mandatory latency and timing audit

当前 `debug` baseline 已确认：

```text
checkpointIntervalMs       = 40,000
executionFreezeBufferMs    = 15,000
Decision 1 timeout         = 15,000
Decision 2 timeout         = 30,000
Decision 1 reasoning       = low
Decision 2 reasoning       = low or medium
Decision 1 max output      = 900 tokens
Decision 2 max output      = 2,000 tokens
```

Decision 1 与 Decision 2 当前串行执行，因此 adapt path 的 timeout ceiling 可达约 45 秒，已经大于 40 秒 checkpoint interval，也远大于从 checkpoint timestamp 计算的 15 秒 freeze buffer。这是必须修复的 timing risk。

必须实施以下 timing contract：

1. Base Plan audio 永远继续播放；任何 LLM 请求不得阻塞 audio clock、runtime update 或 UI；
2. Decision 2 只在 Decision 1 返回 `adapt` 时调用；maintain path 不产生第二次请求；
3. Reflection outcome evaluation 保持 deterministic，不新增第三次 LLM call；
4. 记录 `checkpointAt`、`decision1Started/CompletedAt`、`decision2Started/CompletedAt`、`validatedAt`、`appliedAt` 和各阶段 latency；
5. patch 的 earliest executable time 必须基于**规划/验证完成时的当前 session clock**计算：

```text
earliestEffectMs = max(
  proposedEffectiveStartMs,
  validationCompletedSessionMs + executionFreezeBufferMs
)
```

不得继续只使用旧 checkpoint timestamp 计算 freeze boundary；如果 patch horizon 已经过期，则 reschedule 到合法未来窗口或返回 `NO_SAFE_PATCH`；
6. 如果新的 checkpoint 已使旧请求 stale，必须取消/忽略旧响应；旧响应不能写入 history、memory 或 current plan；
7. Decision 1 timeout/invalid output → safe maintain；Decision 2 timeout/invalid output → `NO_SAFE_PATCH`，两者都不能抛出未处理异常导致 session 中断；
8. end-to-end planning budget 必须小于 checkpoint interval 减去安全余量。具体目标用 pilot benchmark 确定，但当前 15s+30s 不能直接作为可接受设计；
9. 优先通过减少 prompt/input、减少重复 reasoning、压缩 candidates 和使用 deterministic preprocessing 降低 latency；不要首先通过极低 token cap 让 structured output 戛然而止；
10. 保留 Decision 1 low reasoning；Decision 2 默认 low，仅在 code-detected complex patch（例如 scene transition、跨层冲突或 prior-outcome conflict）时使用 medium；不得让 LLM 自己决定是否升级 reasoning；
11. 对 Decision 1/2 分别记录 input/output/reasoning tokens、timeout rate、incomplete rate、schema-validation failure rate，以及 p50/p95/max latency；
12. 模型或 token 上限的任何降级必须先通过同一组 fixtures 比较合法输出率、intent fidelity、patch quality 和 latency，不得只凭“更快”替换。

Prompt/input 压缩要求：

- Decision 1 不发送完整 `currentPlan`；改为 code-generated scene summary、recent state trajectory summary、last relevant adaptation 和最多 3 条 outcome cases；
- Decision 1 不需要最近 6 个完整 `AttentionState` objects，只需 trend calculation 已得到的压缩字段和必要 recent trajectory；
- Decision 2 移除完整 `eegState` 和 recent EEG history；
- Decision 2 的 active scene/upcoming horizon 只保留 patch horizon 内相关元素；
- candidates 先由 code 排序/过滤，再按 layer 和 intent 传入最小合法集合，不默认发送每层 8 个完整 metadata object；
- 不请求 hidden chain-of-thought，只保留 concise rationale、reason codes 和 strict structured output。

验收时必须运行真实 API 或可重复的 latency harness，不能只做 unit test。至少覆盖：maintain、simple within-scene insert、adjust/replace、scene transition、timeout、stale response 和 invalid structured output。

## 22. 与 Reflection memory 的关系

Reflection 可以记录：

- action/body anchor 后 observed response；
- 某种 event 是否疑似造成波动；
- journey transition 是否过密；
- 同一 asset/family 是否应暂时降低优先级。

但 Reflection：

- 不能覆盖 hard asset contract；
- 不能使 `_02` 超过 session max；
- 不能取消 mandatory fade；
- 不能把单次 EEG response 解释为因果证明；
- 不能因为一次 opposed outcome 永久 blacklist 整个 sound family。

---

# Part F：Logging 与 Debug UI

## 23. Asset usage log

每次逻辑 appearance 记录：

```json
{
  "appearance_id": "appearance_021",
  "asset_id": "forest_soft_owl_far_01",
  "family": "owl",
  "role": "event",
  "selected_at": 188.2,
  "scheduled_start": 201.0,
  "actual_start": 201.1,
  "appearance_index_in_session": 2,
  "internal_repeat_count": 3,
  "motion_intent": "approach",
  "resolved_gain_sequence": ["..."],
  "location_before": "clearing",
  "location_after": "clearing",
  "selection_reason_codes": [],
  "contract_version": "sound_contract_v1",
  "application_status": "applied"
}
```

## 24. Narrative transition log

```json
{
  "transition_id": "transition_004",
  "from_location": "clearing",
  "to_location": "stream_bank",
  "locomotion": "walking_on_grass",
  "supporting_cues": [
    "forest_grass_footstep_01",
    "forest_stream_ambient_bed_01"
  ],
  "started_at": 174.0,
  "completed_at": 209.0,
  "valid": true
}
```

Debug UI 至少显示：

- current location/locomotion；
- transition in progress；
- active bonds；
- asset counts/cooldowns；
- current complexity/salience；
- rejected sound reason；
- active playback envelope。

Debug UI 仅供 researcher，不向 participant 显示 mental-state claims。

---

# Part G：测试

所有测试必须进入现有 Vitest/workspace 体系。完成后至少运行：

```bash
npm run build
npm run typecheck
npm test
npm run lint
npm run format:check
```

浏览器音频单元测试应使用可控的 Web Audio mock/fake clock 验证调度时间和 automation；不要用真实等待 6 秒或 60 秒的 flaky timer test。Module 03 测试应继续用 deterministic delta-time updates 验证 `RuntimeWorldState`。

## 25. Audio inventory tests

- [ ] 所有指定 asset 存在；
- [ ] metadata asset ID 与文件路径一致；
- [ ] duration/sample rate/channel 可读取；
- [ ] `body_slow_breath_01` common/action 路径可以加载；
- [ ] action role 不被 schema/filter 排除；
- [ ] water-drop duration 支持 envelope 或明确 fallback；
- [ ] stream loop strategy 通过 audio QA。

## 26. Owl tests

- [ ] 每 appearance 仅产生 2 或 3 repeats；
- [ ] approach gain/distance 单调正确；
- [ ] recede gain/distance 单调正确；
- [ ] pass-by 使用一致 pattern；
- [ ] repeats 不被错误统计为多个 appearances；
- [ ] safe gain 不超限；
- [ ] deterministic seed 可复现。

## 27. Bird tests

- [ ] `_02` 在同等合法条件下排序高于 `_01`；
- [ ] `_01` 仍可作为 fallback/secondary candidate；
- [ ] `_02` 第四次 appearance 被拒绝；
- [ ] 间隔等于 60 秒时按“严格超过 60 秒”规则拒绝；
- [ ] 间隔大于 60 秒时允许；
- [ ] gain 有平滑 variation；
- [ ] global bird-family budget 仍有效。

## 28. Limited-use tests

- [ ] rustle/insect 权重低于 preferred event；
- [ ] 仍有非零合法选择机会；
- [ ] runtime attenuation 生效；
- [ ] 不超出 lower max gain；
- [ ] 不与 incompatible metallic/high-frequency sound 堆叠。

## 29. Water/stream tests

- [ ] 已验证的长 waterfall asset 才使用 6 秒渐入/中段/6 秒渐出；
- [ ] 当前 6 秒 water-drop 若保留，使用不超过 buffer duration 的比例包络；
- [ ] metadata 语义、真实声音内容和 UI/论文称谓一致；
- [ ] early suppress 仍平滑退出；
- [ ] 无 stream/water context 时 waterfall plan 被拒绝；
- [ ] stream start/end 平滑；
- [ ] repeated stream 无明显 gap/click；
- [ ] loop/crossfade 不重复创建失控 audio sources。

## 30. Action tests

- [ ] breath 在符合 grounding context 时进入候选；
- [ ] breath 不因低 confidence EEG 被高强度强制播放；
- [ ] grass footsteps 以 `attachment: 'feet'` 支持 `clearing→stream_bank` transition，并只在 listener velocity 非零时 active；
- [ ] creek steps 只有在 water context 下合法；
- [ ] slow breath 使用 `body` 或 `chest` attachment，不依赖 listener movement；
- [ ] action cue 不与 salient event 过度叠加；
- [ ] action cooldown 生效；
- [ ] 修复后 action asset 在模拟 session 中能够实际播放。

## 31. Narrative tests

- [ ] stationary ambient evolution 不自动产生 footsteps；
- [ ] bird 可在 stationary 和 walking 两种状态出现；
- [ ] `clearing` 不能绕过 graph 直接跳到 `waterfall`；
- [ ] waterfall 需要 stream/water bond；
- [ ] `clearing→stream_bank` transition 顺序合理；
- [ ] leaving waterfall 不突然切断所有 water sound；
- [ ] journey transition 有开始和结束；
- [ ] listener 不会永久停留在 walking state；
- [ ] illegal transition 安全回退 Base Plan。

## 32. Complexity/stability tests

- [ ] 当前和 upcoming horizon 都是 low density 时，合法 `INSERT` 不会仅因“prefer modification”被拒绝；
- [ ] 稀疏 Base Plan 下，Decision 2 能生成一个临时的新 layer，并在角色完成后 remove，而不是永久累积；
- [ ] medium density 时优先调整/替换，除非新增内容填补明确缺失角色；
- [ ] Base Plan 已接近上限时 action/event INSERT 被拒绝或替换；
- [ ] 多个 individually legal sound 不能绕过 total salience budget；
- [ ] sustained-focus + prolonged stasis 可以触发低显著度 supportive evolution，而不生成 mind-wandering claim；
- [ ] Adaptive 的模拟十分钟 timeline 比 Base Plan 有更多 temporal variation，但 peak concurrent sources 和 peak salience 仍在 profile 上限内；
- [ ] timeout/invalid LLM output 不阻塞当前声音；
- [ ] rejected sound 不写入 applied history；
- [ ] stale Decision 2 response 不改变已经前进的 narrative state；
- [ ] Decision 2 无法重新解释 EEG 或改变 Decision 1 intent/scope/salience；
- [ ] 同一个 Decision 1 intent 在 low/medium/high density 下产生不同 operation preference，但目标保持一致；
- [ ] Decision 1 maintain 时不调用 Decision 2；
- [ ] Decision 1 timeout/invalid output 安全 maintain，Decision 2 timeout/invalid output 返回 `NO_SAFE_PATCH`；
- [ ] LLM failure 不停止 Base Plan、audio clock 或 runtime updates；
- [ ] patch earliest effect 使用 validation completion session time，而不是过期 checkpoint time；
- [ ] end-to-end latency 超过下一 checkpoint 时，旧请求会被取消或标记 stale，且不污染 history/reflection；
- [ ] prompt conflict fixtures 覆盖每种 Decision 1 intent 与 low/medium/high density；
- [ ] Non-Adaptive condition 仍按预生成 plan 执行，但所有 asset-level playback contracts 同样生效。

注意：Non-Adaptive 不使用 EEG 改变选择，但一旦预生成 plan 中使用指定 asset，仍必须遵守 fade、repeat、gain 和 interval contract。否则两个 condition 的音频质量不一致。

---

## 33. 验收标准

### Asset contracts

- [ ] 指定 asset 均有 machine-readable profile；
- [ ] hard playback behavior 由代码执行，不依赖 LLM 记忆；
- [ ] owl、bird、limited-use、water-drop、stream 规则全部通过测试；
- [ ] gain 使用现有 engine scale 并受 safe limits 控制。

### Spatial coherence

- [ ] semantic location 和合法路径由现有 plan/scene graph 维护；
- [ ] locomotion 从 `JourneyController`/listener velocity 推导，数值位置只来自 `RuntimeWorldState`；
- [ ] environmental bond 若新增，只作为 planner validation context，不成为第二套坐标状态；
- [ ] stream/waterfall/footsteps 具有物理上合理的关联；
- [ ] stationary 模式不被强制变成 walking journey；
- [ ] independent natural events 不与 locomotion 错误绑定；
- [ ] 非法空间跳跃被 validator 阻止。

### Action/body anchors

- [ ] 找到并修复 action sounds 过去不出现的真实原因；
- [ ] action 进入合适候选集并有更合理的使用机会；
- [ ] action 不被无条件强制出现；
- [ ] breath、grass footsteps 和 creek steps 各自遵守不同语义。

### System consistency

- [ ] 与 Base Plan/Adaptive patch/Reflection 集成；
- [ ] 不创建第二套冲突 policy；
- [ ] complexity/salience/cooldown 继续有效；
- [ ] Decision 2 只选择高层语义，runtime 负责具体播放；
- [ ] Decision 1 是 attention intent 的唯一权威，Decision 2 不接收完整 EEG state、不重新判断 attention；
- [ ] density 只决定如何实现 locked intent，不能替代或改写 intent；
- [ ] 最终 prompts 已通过 instruction ownership/conflict audit；
- [ ] latency harness 证明 maintain/simple/complex/timeout/stale paths 均不会阻塞音频；
- [ ] Non-Adaptive 和 Adaptive 使用相同 playback-quality contracts；
- [ ] LLM failure 时继续 coherent Base Plan。

### Adaptive richness

- [ ] 不再使用固定的“修改/删减永远优先于添加”规则；
- [ ] operation preference 会随 low/medium/high density 动态变化；
- [ ] 稀疏 Base Plan 的 reserved headroom 能被合法 Adaptive patch 使用；
- [ ] Adaptive richness 主要体现在十分钟内的阶段变化，而不是同时堆叠声音；
- [ ] 新增 layer 通常具有明确进入、持续和退出过程；
- [ ] `support-sustained-focus` 和 prolonged-stasis policy 能防止 Adaptive 在长期稳定 Focus 时退化为完全不变化；
- [ ] 不以固定声音数量保证 Adaptive 一定“更丰富”，避免将系统变成无条件加声器。

---

## 34. Codex 完成后必须返回

请提供：

1. 实际修改文件清单；
2. 所有指定 asset 的真实 ID、路径和 audio metadata；
3. action sounds 原先不出现的 root cause；
4. playback profile/schema 的实现位置；
5. shared contract、Module 03 resolution 与 browser playback execution 各自的实现位置；
6. 如何复用现有 `SceneJourneyPlan`、scene graph、`JourneyController` 与 `RuntimeWorldState`，以及是否新增了任何必要字段；
7. Decision 2 prompt/schema 的修改；
8. candidate filtering/ranking 的修改；
9. density-aware operation guidance 的实现，证明 low density 时 `INSERT` 是一等选择、high density 时会转向简化；
10. Decision 1 → operation guidance → Decision 2 的权威数据流，证明 density 不会改变 attention intent；
11. 最终 Decision 1/2 prompt 的 instruction ownership table、删除的冲突指令清单和 conflict-fixture 结果；
12. latency benchmark 报告：两阶段分别及 end-to-end 的 p50/p95/max、token usage、timeout/incomplete/schema-failure rate；
13. timeout、stale response、过期 freeze buffer 的处理方式，以及 patch 如何按 validation completion time 重新计算 earliest effect；
14. `PlaybackScheduler`、`GainManager`、`SourceManager`、Module 03 controllers 与 HRTF 数据流的修改；
15. 新增配置项和所有 `TBD_AUDIO_QA/TBD_PILOT`；
16. 测试命令和完整结果；
17. 至少两段模拟 timeline：
    - stationary forest，包含自然 bird/owl event，但不机械加入 footsteps；
    - forest→stream→creek/waterfall→forest journey，展示合理 footsteps、stream/waterfall envelope 和 narrative state changes；
18. 一段复杂度超限示例，证明系统会 suppress/replace/reject，而不是继续叠加声音；
19. 一段 sustained-focus + prolonged-stasis 示例，证明系统可做 subtle enrichment 而不伪造 mind wandering；
20. 仍需人工试听确认的项目。

---

## 35. 最终设计原则

> NeuroScape should maintain a coherent auditory world rather than selecting isolated sounds solely from the current EEG state. Decision 1 is the sole authority for whether and why to adapt from attention evidence; density and complexity are evaluated afterward to determine how that locked intent can be realized safely. Decision 2 must not reinterpret EEG or override Decision 1. Asset-specific playback behavior must be enforced deterministically through the shared audio library, plan validation, Module 03 numerical resolution, and the browser Web Audio runtime. `RuntimeWorldState` remains the only numerical spatial source of truth. Water, footsteps, and listener movement should form physically meaningful transitions when a journey is explicitly selected; independent natural events may occur regardless of locomotion. The system should remain restrained, continuous, latency-bounded, and meditation-appropriate. LLM planning must never block the Base Plan or audio clock, and temporal richness must not become simultaneous overload.
