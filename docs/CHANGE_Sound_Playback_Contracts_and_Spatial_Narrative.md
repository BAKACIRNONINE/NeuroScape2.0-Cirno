# Sound Playback Contracts 与 Spatial Narrative 实施记录

## 1. 目标与架构边界

本次修改落实 `README_NeuroScape_Sound_Playback_Contracts_and_Spatial_Narrative_Update.md` 的核心 contract，继续使用现有数据流：

```text
Decision 1
→ deterministic density/candidate policy
→ Decision 2 SceneJourneyPlan patch
→ Module 03 RuntimeWorldState
→ frontend Web Audio/HRTF
```

没有新增平行的空间状态或坐标系统。`SceneJourneyPlan`、scene graph、`JourneyController` 与 `RuntimeWorldState` 仍是语义路径和数值空间的唯一权威。

## 2. Audio inventory audit

使用 `ffprobe` 检查了实际文件。所有目标文件均为 48 kHz。

| Asset ID                            | 实际路径                                             |    格式 | 声道 |    时长 |
| ----------------------------------- | ---------------------------------------------------- | ------: | ---: | ------: |
| `forest_soft_owl_far_01`            | `forest/event/forest_soft_owl_far_01.wav`            | PCM WAV |    2 |  5.000s |
| `forest_bird_far_01`                | `forest/event/forest_bird_far_01.wav`                | PCM WAV |    1 |  4.000s |
| `forest_bird_far_02`                | `forest/event/forest_bird_far_02.wav`                | PCM WAV |    1 |  4.000s |
| `forest_small_animal_rustle_far_01` | `forest/event/forest_small_animal_rustle_far_01.wav` | PCM WAV |    2 |  6.000s |
| `forest_insect_chirp_far_01`        | `forest/event/forest_insect_chirp_far_01.wav`        | PCM WAV |    2 |  7.000s |
| `forest_water_drop_far_01`          | `forest/event/forest_water_drop_far_01.wav`          | PCM WAV |    1 | 16.823s |
| `forest_stream_ambient_bed_01`      | `forest/ambient/forest_stream_ambient_bed_01.mp3`    |     MP3 |    2 | 20.040s |
| `forest_grass_footstep_01`          | `forest/action/forest_grass_footstep_01.wav`         | PCM WAV |    2 | 12.080s |
| `forest_body_slow_creek_steps_01`   | `forest/action/forest_body_slow_creek_steps_01.wav`  | PCM WAV |    2 |  8.000s |
| `body_slow_breath_01`               | `common/action/body_slow_breath_01.wav`              | PCM WAV |    2 | 18.000s |

文件均位于 `frontend/public/audio/` 下，并已通过 canonical `asset_ref` 被 manifest 加载。

## 3. Canonical playback contracts

权威位置：

- `packages/contracts/src/audio_library.json`
- `packages/contracts/src/audio-library.ts`

新增的可选 machine-readable 字段：

- `quality_tier`、`selection_weight`、family rank；
- `session_limits.max_appearances`；
- start-to-start 且严格排除等号的 `min_interval_sec_exclusive`；
- `gain_profile.max_safe_gain` 与 `quality_attenuation`；
- playback mode、repeat options、gap、envelope、loop strategy；
- location、locomotion 与 environmental-bond compatibility。

没有复制 `recommended_volume`；它仍是 requested gain 的唯一 authored 默认值，frontend 按以下方式解析：

```text
resolvedGain = min(
  requestedGain × qualityAttenuation,
  maxSafeGain
)
```

所有 gain 继续使用现有 linear `[0, 1]` scale。Ambient 的既有 `0.2` output multiplier 保留，未重复写入 metadata。

## 4. Asset-specific behavior

- Owl：一次 appearance 由 deterministic ID seed 解析为 2 或 3 次 internal repeats，gap 为 0.8s；3-repeat 支持 approach、recede 或 pass-by gain pattern；最大生命周期按 3×5s + 2×0.8s = 16.6s 进入 Decision 2 schema。
- Bird `_02`：同等条件排序高于 `_01`；最多 3 次/session；start-to-start 必须严格大于 60s。`_01` 保留为 secondary candidate。
- Rustle/insect：`limited_use`，低 selection weight，并在 browser runtime 强制 attenuation/max-safe gain。
- Water drop：真实 clip 为 16.823s，但仍保留“远处 water cue”语义，不宣称是完整 waterfall passage；使用 bounded one-shot envelope，并要求 stream/water context。
- Stream：继续使用已有 native loop 路径和 4s metadata fade；是否需要 dual-source crossfade 留待人工 loop-boundary QA。
- Grass/creek footsteps：只能用于 scene transition，且 attachment 必须为 `feet`；现有 `ActionController` velocity gate 保留。
- Breath：在 stationary grounding 中可用，attachment 必须为 `chest` 或 `body`。

## 5. Candidate policy 与 density guidance

实现位置：`packages/adaptive-planner/src/audio-retrieval.ts`

候选检索现在执行：

- exact/family cooldown；
- session appearance maximum；
- exclusive minimum interval；
- quality tier/selection weight/family rank；
- current semantic location；
- stream-water environmental bond；
- footstep/scene-transition compatibility；
- layer 与 Decision 1 locked intent compatibility。

新增 `OperationGuidance`。Low density 时 `INSERT` 排在首位；medium density 时 adjustment/reschedule/replace 优先；high density 时 suppress/simplify 优先。Density 只决定如何执行 locked intent，不能修改 Decision 1 的 intent、scope 或 salience。

## 6. Decision 1/2 输入与 prompt audit

Decision 1 输入不再包含完整 current plan 和最近六个完整 AttentionState，改为：当前 reasoning state、最多三个 trajectory 摘要、scene summary、最后一次 adaptation 和最多三个 reflection cases。

Decision 2 完全移除了 `eegState`，改为：

- locked Decision 1 output；
- phase/current location/reachable locations；
- compressed active scene；
- relevant upcoming horizon；
- deterministic operation guidance；
- restrictions、reflection cases 和 filtered candidates。

删除了固定的 “KEEP/ADJUST/... 永远优先于 INSERT” 指令，并加入 density-aware policy。

| 规则                              | 唯一权威 owner                          | 其他层职责                        |
| --------------------------------- | --------------------------------------- | --------------------------------- |
| 是否适应、intent、salience、scope | Decision 1                              | Decision 2 原样执行               |
| Density 与 operation preference   | deterministic code + Decision 2         | 不重新解释 EEG                    |
| Gain/repeat/fade/cooldown/limits  | canonical metadata + validators/runtime | LLM 只能选择合法候选              |
| 空间路径与数值位置                | SceneJourneyPlan + Module 03            | frontend 只消费 RuntimeWorldState |
| Outcome                           | deterministic Reflection                | 不覆盖 hard contract              |

## 7. Runtime execution

- `PlanValidator` 检查 canonical asset layer 和 water context，保留 legacy demo alias compatibility。
- `PlaybackScheduler` 支持 one-shot、native loop 和 2/3-repeat burst；internal repeat 不重置 activation identity。
- `GainManager` 支持 bounded multi-segment envelope、repeat-level gain sequence 和 early-release automation。
- `SourceManager` 从 canonical metadata 解析 playback mode、安全 gain、quality attenuation 和 deterministic repeat pattern。
- `HRTFRenderer` 未加入任何 semantic lookup，仍只消费 Module 03 数值位置，避免双重空间真值。

## 8. Timing contract

- Decision 1 与 Decision 2 默认 timeout 从 15s + 30s 收敛为 12s + 12s，串行 ceiling 为 24s，低于 40s checkpoint interval。
- OpenAI 模式仍由 integration harness fire-and-forget；Base Plan/runtime clock 不等待 LLM。
- request sequence 继续丢弃 stale Decision 1/2 response。
- Decision 2 只在 Decision 1=`adapt` 时调用。
- earliest effect 现在以 recorded provider latency 推算的 validation-completion session time为基准，再加 execution freeze buffer；不再只使用旧 checkpoint timestamp。
- provider 记录 Decision 1/2 client-observed latency 和 token usage。
- timeout/invalid output 继续安全保持 Base Plan；runtime application 仍使用前一轮实现的 two-phase acknowledgement。

真实 API p50/p95/max 没有在本次本地测试中伪造。需要使用实际研究环境/API key 跑 latency harness 后补充，尤其应验证网络抖动、timeout/incomplete/schema-failure rate。

## 9. Action root cause

审计确认 action assets、路径和 schema 原本都存在。低出现率的主要原因是：

1. `allowedLayers()` 过去仅对 `support-grounding` 开放 action；
2. feet action 在 stationary listener 下被 `ActionController` 正确停用；
3. action loop 如果没有明确退出容易触发 complexity/cooldown 排斥。

现在 scene transition 与适当的 gently-reorient 可以检索 action；但 footstep 仍必须伴随合法相邻 waypoint movement，避免为了提高出现率而破坏空间逻辑。

## 10. 示例 timeline

Stationary forest：

```text
forest ambient → bird event → owl burst → sparse forest
```

journey 不变，因此不插入 footsteps。

Embodied water transition：

```text
clearing
→ clearing→stream_bank journey + grass footsteps + emerging localized stream
→ stationary stream_bank
→ stream_bank→waterfall + creek steps
→ distant water cue with bounded envelope
→ return through stream_bank; water layers fade before forest-only state
```

High-density 示例：当 active/upcoming count 达到 high 时，operation guidance 首选 `SUPPRESS/RESCHEDULE/ADJUST`，patch validator 仍执行 concurrent-source 与 salience hard limits；合法单 asset 不能绕过总预算。

Sustained-focus 示例：Decision 1 可在 prolonged stasis 下输出 non-corrective `support_sustained_focus`；low-density guidance 可选择 temporary ambient/event INSERT，但 rationale 不得声称检测到 mind wandering。

## 11. 测试与仍需人工确认的项目

自动测试覆盖 metadata contract、bird rank/limit/exclusive interval、limited-use fields、density-aware operation policy、Decision 2 EEG removal、prompt conflict、action fallback、asset-layer/water validation、burst scheduling、one-shot envelope、two-phase runtime application及既有完整 runtime/frontend suites。

仍需人工 Audio QA：

- stream 的 native loop seam、click/gap；必要时再实现 dual-source crossfade；
- owl/bird 文件内部静音与 burst 听感；
- water-drop 是否适合作为 16.823s envelope cue，而非 waterfall；
- WAV transient、DC offset 和 headphones 下的 safe gain；
- `TBD_AUDIO_QA` attenuation、fade、gap；
- `TBD_PILOT` session limits、density thresholds、cooldowns 与 12s timeout budget；
- 真实 OpenAI latency/token/timeout/incomplete/schema-failure benchmark。
