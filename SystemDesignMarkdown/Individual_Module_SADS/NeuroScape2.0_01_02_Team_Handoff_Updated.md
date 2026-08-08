# NeuroScape 01 / 02 模块协作说明

## 1. 我们整个系统到底在做什么？

NeuroScape 是一个根据用户脑电状态，实时改变空间声音环境的冥想系统。

可以把整个系统想成四个人在合作：

``` text
Muse EEG
   ↓
01：看懂用户现在的状态
   ↓
NeuroState
   ↓
02：决定这个声音世界接下来应该怎么变化
   ↓
SceneJourneyPlan
   ↓
03：把计划变成连续、真实的空间运动和声音状态
   ↓
RuntimeWorldState
   ↓
04：在浏览器里真正播放 HRTF 空间音频，并显示 3D 场景和 UI
```

最简单来说：

> **01 负责判断"用户现在怎么样"。**\
> **02 负责决定"世界接下来应该怎么样"。**\
> **03 负责把这个决定变成可以实时执行的运动和声音状态。**\
> **04 负责让用户真正看到、听到这个世界。**

我们现在已经把 03 和 04 的主体搭好了。

所以你们做 01 和 02
时，最重要的不是考虑后面怎么播放声音，而是稳定地输出后面系统需要的数据。

------------------------------------------------------------------------

## 2. Module 01 --- Neuro State Interpreter

Module 01 要回答：

> **"根据这一段 EEG，用户现在处于什么样的神经状态？"**

输入是 Muse 的 EEG 数据，比如
Delta、Theta、Alpha、Beta、Gamma，也可以根据需要使用 PPG、Heart
Rate、signal quality 和 previous state。

01 内部怎么处理，可以由你们自己设计，例如：

``` text
EEG
↓
signal quality check
↓
artifact handling
↓
windowing
↓
feature extraction
↓
state estimation
↓
trend estimation
↓
confidence estimation
```

但是后面的系统不需要知道这些内部过程。

### 01 最后需要给我的东西

最后请统一输出一个 `NeuroState`：

``` ts
interface NeuroState {
  timestampMs: number;

  arousal: {
    value: number;
    trend: "increasing" | "decreasing" | "stable";
  };

  confidence: number;

  historySummary?: string;
}
```

可以理解成：

-   -   Neuro Arousal = 当前神经唤醒程度
-   Confidence = 这一次判断有多可信
-   Trend = 最近是在上升、下降还是保持稳定

例如：

``` json
{
  "timestampMs": 120000,
  "attention": {
    "value": 0.62,
    "trend": "decreasing"
  },
  "arousal": {
    "value": 0.41,
    "trend": "stable"
  },
  "stability": 0.78,
  "confidence": 0.91,
  "historySummary": "Attention has gradually declined during the last two minutes while arousal remains stable."
}
```

### 一个很重要的原则

01 把 EEG 解释完以后，再交给后面。

不希望出现：

``` text
raw EEG → 02 LLM 自己猜
```

或者：

``` text
theta/beta ratio → frontend 再自己算 attention
```

我们希望责任关系是：

``` text
Muse EEG
   ↓
01
   ↓
已经解释好的 NeuroState
   ↓
02
```

------------------------------------------------------------------------

## 3. Module 02 --- Scene Journey Planner

Module 02 要回答：

> **"知道用户现在的状态之后，这个虚拟声音世界接下来应该怎么发展？"**

02 是整个系统主要的 LLM reasoning 模块。

它不是直接播放声音，更像一个"导演 / 场景规划师"。

### 02 会拿到什么信息？

02 主要可以看到五类信息：

1.  `NeuroState`：用户现在怎么样\
2.  `Current Journey Context`：用户现在走到哪里了\
3.  `Scene Graph`：这个虚拟世界有哪些地方、哪些地方之间可以走\
4.  `Sound Library`：我们有哪些声音可以使用\
5.  `Adaptation History`：前面已经做过哪些调整

例如 Scene Graph 可能是：

``` text
forest_entry
    ↓
clearing
    ↓
stream_bank
    ↓
waterfall
```

Sound Library 可能告诉 LLM：

``` text
forest_wind
类型：ambient
作用：稳定背景环境

stream_water
类型：ambient
作用：持续空间锚点

bird_call
类型：event
作用：稀疏的方向性注意提示

footsteps
类型：action
作用：表现用户虚拟行走
```

------------------------------------------------------------------------

## 4. 02 应该怎么思考？

比如 01 告诉 02：

``` text
Neuro Arousal: 0.41, stable
```

02 可以进行这样的 reasoning：

``` text
当前 Neuro Arousal 保持稳定

但 arousal 没有明显升高，
整体状态还是比较稳定

↓

不需要做很大的环境变化

↓

可以增加一个温和的方向性声音，
帮助重新建立注意锚点

↓

让用户慢慢向 stream_bank 前进

↓

保持 forest ambience，
逐渐提高 stream 的存在感，
加入一个稀疏 bird event
```

这就是 02 最核心的工作。

------------------------------------------------------------------------

## 5. 02 最后需要给我的东西

02 最终统一输出 `SceneJourneyPlan`。

它不是逐帧控制命令，而是一份：

> **"接下来几十秒世界应该怎么发展"的计划。**

概念上包括：

``` text
SceneJourneyPlan

├── 为什么要调整
├── 用户接下来往哪里走
├── Ambient 怎么变化
├── Action 怎么变化
├── Event 怎么变化
└── 整体变化应该多快、多平滑
```

例如：

``` json
{
  "planId": "plan-003",
  "planningHorizonSec": 30,
  "reasoningSummary": "Attention is gradually decreasing while arousal remains stable. A gentle directional anchor may help restore engagement without creating a disruptive scene change.",
  "userJourney": {
    "waypoints": [
      {
        "semanticLocation": "clearing",
        "timeMs": 0
      },
      {
        "semanticLocation": "stream_bank",
        "timeMs": 30000
      }
    ]
  },
  "soundscape": {
    "ambient": [
      {
        "id": "forest-wind",
        "assetId": "forest_wind",
        "semanticLocation": "clearing",
        "gain": 0.45,
        "active": true
      },
      {
        "id": "stream",
        "assetId": "stream_water",
        "semanticLocation": "stream_bank",
        "gain": 0.65,
        "active": true
      }
    ],
    "action": [
      {
        "id": "footsteps",
        "assetId": "grass_footsteps",
        "attachment": "feet",
        "relativePosition": [0, -1.4, 0.1],
        "gain": 0.35,
        "active": true
      }
    ],
    "event": [
      {
        "id": "bird-01",
        "assetId": "bird_call",
        "semanticLocation": "stream_bank",
        "startTimeMs": 12000,
        "durationMs": 5000,
        "gain": 0.4
      }
    ]
  },
  "transitionPolicy": {
    "durationMs": 5000,
    "curve": "smoothstep"
  }
}
```

具体字段最后我们可以根据现在代码里的 TypeScript contract
一起对齐。最重要的是先理解它表达的意思。

------------------------------------------------------------------------

## 6. 02 不需要做什么？

02 不需要计算：

-   `stream_bank` 到底是 `[4.2, 0, -12.5]`
-   listener 下一帧在哪里
-   bird 每 16ms 在哪里
-   azimuth / elevation
-   HRTF 怎么渲染
-   Three.js 怎么移动
-   fade 每一帧应该是多少

例如 02 只需要说：

``` text
从 clearing 慢慢走向 stream_bank
```

03 会自动把它变成：

``` text
clearing
↓
真实世界坐标
↓
连续轨迹
↓
position / velocity / orientation
```

所以：

> **02 负责语义世界。**\
> **03 负责数字世界。**

------------------------------------------------------------------------

## 7. 为什么不让 LLM 直接输出坐标？

因为 LLM 更新比较慢，而且它擅长的是 reasoning，不适合负责 60 FPS
的实时运动。

所以我们刻意把系统拆开：

``` text
02 LLM：
“接下来去 stream_bank”

↓

03 Runtime：
根据当前真实位置，平滑地走过去
```

这样即使 LLM 很久才更新一次计划，用户听到的空间世界还是可以连续运行。

------------------------------------------------------------------------

## 8. Ambient / Action / Event 是什么意思？

### Ambient

环境背景声音，例如：

-   forest wind
-   ocean waves
-   stream
-   waterfall
-   rain

通常持续比较久。

其中可能有：

``` text
Global Ambient
整个环境都存在

Localized Ambient
固定在世界里的某个位置
```

### Action

跟用户自己有关的声音，例如：

-   footsteps
-   breathing
-   clothing movement

这些声音会跟着用户的位置一起移动。

### Event

短暂出现、可以独立移动的声音对象，例如：

-   bird
-   insect
-   falling leaves
-   distant animal call

这些事件可以有自己的出现时间、持续时间和路径。

------------------------------------------------------------------------

## 9. 02 只需要选择和规划，不需要执行

比如 02 可以说：

``` text
“12 秒后，在 stream_bank 附近加入一个 bird_call，持续 5 秒。”
```

后面系统会负责：

``` text
03
↓
bird 什么时候 spawn
↓
怎么移动
↓
什么时候 fade
↓
什么时候 remove

04
↓
真正播放声音
↓
HRTF
↓
耳机
```

所以 02 不需要知道浏览器和 Audio API 怎么实现。

------------------------------------------------------------------------

## 10. 我们最终怎么对接？

你们最终只需要保证两个接口稳定。

### 01 输出

``` text
NeuroState
```

回答：

> 用户现在怎么样？

### 02 输出

``` text
SceneJourneyPlan
```

回答：

> 世界接下来应该怎么样？

然后我负责的 03 / 04 会接着完成：

``` text
SceneJourneyPlan
      ↓
03 Runtime Scene Controller
      ↓
RuntimeWorldState
      ↓
04 Web Runtime
      ↓
Three.js + HRTF + UI
```

------------------------------------------------------------------------

## 11. 最后一句话总结我们的分工

如果只记四句话：

``` text
01：
看懂脑电。
“用户现在怎么样？”

02：
做场景决策。
“世界接下来应该怎么变化？”

03：
执行这个决策。
“怎么平滑、连续地把变化真正跑起来？”

04：
呈现这个世界。
“怎么让用户真正看到和听到它？”
```

------------------------------------------------------------------------

## 12. 你们交给我的最终成果

### 负责 01 的同学

希望最终给我：

1.  能持续接收 Muse 数据的 Neuro State Interpreter
2.  稳定输出 `NeuroState`
3.  说明 Neuro Arousal / Confidence 分别是怎么计算的
4.  有基本测试或 example output

### 负责 02 的同学

希望最终给我：

1.  能读取 `NeuroState` 的 Scene Journey Planner
2.  能读取 Scene Graph
3.  能读取 Sound Library
4.  能结合历史状态做 LLM reasoning
5.  稳定输出 `SceneJourneyPlan`
6.  输出必须是 structured JSON，不要只是自然语言
7.  有几组测试场景，例如 不同 Neuro Arousal
    变化趋势（升高、降低、稳定）时 Planner 分别怎么调整

------------------------------------------------------------------------

## 13. 最重要的协作原则

我们最好把模块之间当成 API。

你们不需要知道我的 03 / 04 内部具体怎么写，我也不需要知道你们 01 / 02
内部每一个算法怎么实现。

只要：

``` text
01
稳定输出 NeuroState

02
稳定输出 SceneJourneyPlan

03 / 04
稳定消费这两个结果
```

整个系统就可以独立开发，最后再接起来。

这也是目前 NeuroScape2.0 架构最重要的设计原则：

> **reasoning 和 real-time execution 分开。**
