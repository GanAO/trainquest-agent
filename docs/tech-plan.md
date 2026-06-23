# 健身 RPG — Codex 技术实现方案

由 GPT 5.5 (Codex ECC) 生成，基于需求文档 trainquest-agent-requirements.md。

---

## 1. 项目结构

```
trainquest-agent/
  package.json
  tsconfig.json
  vite.config.ts

  data/
    profile.json              # 用户身体数据、目标、角色定制
    workouts.json             # 标准训练记录列表
    attributes.json           # 7 个属性的等级、经验、累计贡献
    muscle-map.json           # 动作到肌群映射，可编辑
    achievements.json         # 成就定义 + 解锁状态
    app-meta.json             # 数据版本、最近更新时间

  server/
    package.json
    tsconfig.json
    src/
      index.ts                # Express 启动入口
      app.ts                  # Express app
      routes/
        workouts.ts
        profile.ts
        attributes.ts
        muscleMap.ts
        achievements.ts
        dashboard.ts
        export.ts
      services/
        workoutService.ts     # 训练写入、经验计算入口
        attributeService.ts   # 等级/经验计算
        achievementEngine.ts  # 成就检测
        dashboardService.ts   # 图表数据聚合
      repositories/
        jsonStore.ts          # JSON 文件读写、原子写
        workoutRepo.ts
        profileRepo.ts
        configRepo.ts
      domain/
        types.ts              # 共享领域类型
        formulas.ts           # 经验、等级、训练量公式
        defaults.ts           # 默认肌肉映射、默认成就
      adapters/
        manualAdapter.ts      # 手动录入转标准训练记录
        chatAdapter.ts      # P1 预留空接口
      utils/
        date.ts
        validation.ts

  src/
    main.tsx
    App.tsx
    api/
      client.ts
      workouts.ts
      profile.ts
      dashboard.ts
      achievements.ts
    routes/
      RecordPage.tsx
      CharacterPage.tsx
      DataPage.tsx
      SettingsPage.tsx
    components/
      layout/
        MobileShell.tsx
        BottomTabs.tsx
      record/
        WorkoutForm.tsx
        ExerciseRow.tsx
        ExercisePicker.tsx
        TodaySummary.tsx
        WorkoutHistory.tsx
      character/
        PixelAvatarCanvas.tsx
        AttributePanel.tsx
        AttributeBar.tsx
      dashboard/
        WeightTrendChart.tsx
        TrainingHeatmap.tsx
        MuscleDistributionChart.tsx
        GoalProgress.tsx
      settings/
        ProfileForm.tsx
        MuscleMapEditor.tsx
        AchievementList.tsx
        DataExportButton.tsx
      achievements/
        AchievementToast.tsx
        AchievementOverlay.tsx
    domain/
      types.ts
      constants.ts
    styles/
      index.css
```

---

## 2. 数据模型设计

### profile.json
```json
{
  "version": 1,
  "body": {
    "heightCm": 175,
    "currentWeightKg": 78,
    "weightLogs": [{ "date": "2026-06-05", "weightKg": 78 }]
  },
  "goal": {
    "type": "lose_weight",
    "targetWeightKg": 72,
    "targetDate": "2026-12-31"
  },
  "avatar": {
    "skinTone": "medium",
    "hairStyle": "short",
    "hairColor": "#2a1d16",
    "shirtColor": "#3b82f6",
    "shortsColor": "#111827"
  }
}
```

### workouts.json
```json
{
  "version": 1,
  "items": [{
    "id": "w_20260605_001",
    "source": "manual",
    "date": "2026-06-05",
    "duration": 45,
    "feeling": "good",
    "exercises": [{
      "id": "e_001",
      "name": "卧推",
      "type": "strength",
      "sets": 3,
      "reps": 10,
      "weight": 60,
      "unit": "kg",
      "note": ""
    }],
    "createdAt": "2026-06-05T12:00:00.000Z",
    "updatedAt": "2026-06-05T12:00:00.000Z"
  }]
}
```

### muscle-map.json
```json
{
  "version": 1,
  "items": [
    {
      "exerciseName": "卧推",
      "aliases": ["杠铃卧推", "bench press"],
      "type": "strength",
      "primary": ["chest"],
      "secondary": ["arms", "shoulders"],
      "enabled": true,
      "custom": false
    }
  ]
}
```

### 属性枚举
```ts
type AttributeKey = "chest" | "shoulders" | "back" | "legs" | "arms" | "core" | "cardio";
```

### attributes.json
```json
{
  "version": 1,
  "items": {
    "chest": { "level": 1, "xp": 0, "totalXp": 0, "lastChangedAt": null }
  },
  "lastWorkoutIdApplied": null
}
```

### achievements.json
```json
{
  "version": 1,
  "definitions": [{
    "id": "habit_week_3",
    "type": "habit",
    "name": "每周 3 练",
    "description": "自然周内完成 3 次训练",
    "icon": "calendar-3",
    "condition": { "kind": "weekly_workout_count", "minCount": 3 },
    "enabled": true
  }],
  "unlocked": []
}
```

---

## 3. API 设计

Base URL: `http://localhost:3001/api`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/workouts?from&to | 训练列表（按日期倒序） |
| GET | /api/workouts/:id | 单条训练 |
| POST | /api/workouts | 创建训练（校验→匹配肌群→计算经验→写JSON→更新属性→检测成就） |
| DELETE | /api/workouts/:id | 删除训练（P0 可选） |
| GET | /api/attributes | 7 属性当前状态 |
| POST | /api/attributes/recalculate | 从 workouts 全量重算 |
| GET | /api/muscle-map | 动作映射表 |
| POST | /api/muscle-map | 新增映射 |
| PUT | /api/muscle-map/:name | 更新映射 |
| GET | /api/profile | 身体数据 |
| PUT | /api/profile | 更新身高/体重/目标 |
| POST | /api/profile/weight-logs | 新增体重记录 |
| GET | /api/achievements | 成就列表+解锁状态 |
| POST | /api/achievements/recalculate | 重新检测成就 |
| GET | /api/dashboard?from&to | 仪表盘聚合数据 |
| GET | /api/export | 导出全部 JSON |

---

## 4. 组件树

```
App → BrowserRouter → MobileShell
  /record    → WorkoutForm / TodaySummary / WorkoutHistory
  /character → PixelAvatarCanvas / AttributePanel(×7)
  /data      → WeightTrendChart / TrainingHeatmap / MuscleDistribution / GoalProgress
  /settings  → ProfileForm / MuscleMapEditor / AchievementList / DataExportButton
  BottomTabs
```

---

## 5. 像素角色 Canvas 渲染

- 逻辑画布：48×64，实际 CSS 显示：240×320（`image-rendering: pixelated`）
- 7 属性对应身体部位：chest→躯干宽，shoulders→肩宽，arms→手臂，legs→腿，core→腰线，cardio→速度线光环
- 等级分 5 档视觉阶段：Lv1-2 基础 → Lv3-7 轻微 → Lv8-14 明显 → Lv15-19 高级 → Lv20+ 满级
- 升级动画：700ms，角色 y 轴跳动 2px，部位周围金色像素星点

---

## 6. 属性加点公式

**力量训练：**
```ts
volume = sets × reps × weightKg
baseXp = volume / 10
```

**有氧训练：**
```ts
baseXp = durationMinutes × 6 + distanceKm × 20
```

**肌群分配：**
```
主要肌群 = baseXp × 1.0 / primary.length
次要肌群 = baseXp × 0.35 / secondary.length
单次上限 = 500
```

**等级门槛：**
```ts
xpRequired = 100 × level^1.35
// Lv1→2: 100, Lv2→3: 255, Lv3→4: 440, Lv4→5: 650
```

---

## 7. 成就引擎

三类检测：
- **习惯成就**：每周 3 练、月度铁人、稳定输出、欢迎回来 — 统计训练频率
- **突破成就**：单动作 PR — 比较当前重量 vs 历史最大；千吨俱乐部 — 累计训练量
- **目标成就**：减重/增肌 — 比较当前体重 vs 目标体重

P0 预置 15 个以内，每次写入训练后自动检测。

---

## 8. 仪表盘

- Recharts LineChart（体重趋势）
- Recharts BarChart（肌肉群分布）
- CSS Grid 热力图（训练频率，绿色渐变，不做红色）
- 原生 progress bar（目标进度）

---

## 9. P0 开发步骤（18 步）

1. 脚手架（Vite React TS + Express TS）
2. 领域类型定义
3. JSON 存储层（原子写入）
4. 默认数据初始化
5. 肌肉群映射服务（含 alias 归一化）
6. 经验/等级公式（优先写单测）
7. POST /api/workouts 核心闭环
8. 训练录入页（WorkoutForm）
9. 历史记录列表
10. 角色页（Canvas + 属性面板）
11. 属性驱动外观变化
12. 身体数据设置（ProfileForm）
13. 仪表盘 API
14. 数据页图表（折线+热力+分布+进度）
15. 肌肉映射编辑器
16. 成就基础列表+检测
17. 表单校验+错误处理
18. 端到端手测

最小闭环：训练录入 → JSON 写入 → 肌群匹配 → 属性加点 → 角色/面板更新 → 仪表盘更新
