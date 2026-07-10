# 删除解套回本网格策略 - 执行方案

## 一、删除概述

由于解套回本网格策略的核心计算逻辑存在概念混淆（回本概率计算、步长调整因果链等问题），且暂不向用户开放，决定删除该功能的所有相关代码，以保持代码库的简洁和可维护性。

**删除目标**：移除所有 `[RECOVERY_STRATEGY]` 标记的代码，确保普通网格功能不受影响。

---

## 二、删除文件列表

### 2.1 后端文件

| 文件路径 | 删除方式 | 说明 |
|---------|---------|------|
| `backend/app/algorithms/grid/recovery_strategy.py` | **完全删除** | 解套策略核心逻辑文件，无其他依赖 |

### 2.2 前端文件

| 文件路径 | 删除方式 | 说明 |
|---------|---------|------|
| 无 | - | 前端无单独文件，均为代码片段 |

---

## 三、修改文件列表

### 3.1 后端文件

#### 3.1.1 `backend/app/services/etf_analysis_service.py`

**删除内容**：
1. 第16行：`from app.algorithms.grid.recovery_strategy import RecoveryGridStrategy`
2. 第454-554行：`analyze_recovery_strategy()` 方法（约100行）
3. 第555-600+行：`_generate_recovery_strategy_rationale()` 方法（约50行）

**验证**：确保 `analyze_grid_strategy()` 方法不受影响

#### 3.1.2 `backend/app/routes/grid_routes.py`

**删除内容**：
1. 第72-154行：`/analyze/recovery` 路由（约82行）

**验证**：确保 `/analyze` 和 `/backtest` 路由正常

#### 3.1.3 `backend/app/algorithms/grid/optimizer.py`

**删除内容**：
1. 第498-505+行：`calculate_recovery_step_sizes()` 方法（约7行）

**验证**：确保其他 `calculate_*` 方法不受影响

### 3.2 前端文件

#### 3.2.1 `frontend/src/features/analysis/components/ParameterForm.jsx`

**删除内容**：
1. 第40-43行：`strategyMode` 状态定义
2. 第90-93行：解套模式初始值设置
3. 第191-197行：解套模式验证逻辑
4. 第248-261行：解套模式提交数据
5. 第309-339行：策略模式切换组件（已注释）
6. 第362-508行：解套模式输入面板
7. 第509行：条件按钮文字

**保留内容**：无

#### 3.2.2 `frontend/src/shared/utils/url.js`

**删除内容**：
1. 第39-43行：DEFAULT_PARAMS 中的解套模式参数
2. 第76-78行：编码 `recoveryDays` 参数
3. 第154-160行：解码 `recoveryDays` 参数
4. 第202-205行：策略模式验证
5. 第212-217行：策略模式判断（保留普通模式逻辑）
6. 第225-267行：解套模式参数验证

**保留内容**：普通网格的参数编码/解码/验证逻辑

#### 3.2.3 `frontend/src/shared/services/api.js`

**删除内容**：
1. 第70-73行：解套模式接口调用判断

**修改后**：
```javascript
analyzeGridStrategy(parameters) {
  return this.post("/grid/analyze", parameters);
}
```

#### 3.2.4 `frontend/src/features/analysis/components/ReportCards/GridParametersCard.jsx`

**删除内容**：
1. 第43-54行：解套模式字段解构
2. 第78-137行：回本策略分析卡片
3. 第156-172行：解套模式总资金显示
4. 第315-320+行：非对称网格配置显示

**验证**：确保普通网格的参数卡片正常显示

#### 3.2.5 `frontend/src/pages/AnalysisPage/AnalysisPage.jsx`

**删除内容**：
1. 第222-225行：`isRecovery` 判断和 `capitalDesc` 计算
2. 第303-310行：解套模式参数显示
3. 第337-344行：解套模式参数摘要

**验证**：确保普通模式的参数显示正常

#### 3.2.6 `frontend/src/features/analysis/components/ReportTabs.jsx`

**修改内容**：
1. 第45-62行：移除策略类型判断，恢复为固定标签数组

**修改后**：
```javascript
const tabs = [
  { id: "overview", label: "概览", icon: <Eye className="w-4 h-4" /> },
  { id: "suitability", label: "适宜度评估", icon: <ThermometerSun className="w-4 h-4" /> },
  { id: "strategy", label: "网格策略", icon: <Grid3X3 className="w-4 h-4" /> },
  { id: "backtest", label: "回测分析", icon: <TrendingUp className="w-4 h-4" /> },
];
```

---

## 四、执行步骤（风险最低路径）

### 步骤1：删除后端独立文件
```bash
rm backend/app/algorithms/grid/recovery_strategy.py
```

### 步骤2：修改后端代码文件
1. 修改 `etf_analysis_service.py`：删除解套相关方法和导入
2. 修改 `grid_routes.py`：删除 `/analyze/recovery` 路由
3. 修改 `optimizer.py`：删除 `calculate_recovery_step_sizes()` 方法

### 步骤3：修改前端代码文件
1. 修改 `ParameterForm.jsx`：删除解套模式相关代码
2. 修改 `url.js`：删除解套模式参数处理
3. 修改 `api.js`：简化接口调用
4. 修改 `GridParametersCard.jsx`：删除解套模式显示
5. 修改 `AnalysisPage.jsx`：删除解套模式参数显示
6. 修改 `ReportTabs.jsx`：恢复固定标签

### 步骤4：验证后端
```bash
cd backend
python -m pytest tests/ -v
```

### 步骤5：验证前端
```bash
cd frontend
npm run lint
npm run build
```

### 步骤6：集成测试
启动完整应用，验证：
1. 普通网格分析功能正常
2. 回测功能正常
3. URL参数解析正常

---

## 五、风险评估

| 风险类型 | 等级 | 说明 | 缓解措施 |
|---------|------|------|---------|
| 代码兼容性 | 🟢 低 | 删除独立文件，不修改核心逻辑 | 先删除独立文件，再逐步修改其他文件 |
| API 兼容性 | 🟢 低 | 删除新增路由，不修改现有接口 | 确保 `/analyze` 和 `/backtest` 接口不变 |
| 前端兼容性 | 🟡 中 | 多处代码修改，可能遗漏 | 按文件逐个修改，每修改一个验证一个 |
| 数据迁移 | 🟢 低 | 无数据库修改 | 无需数据迁移 |
| 功能回归 | 🟡 中 | 可能影响普通网格功能 | 修改后运行完整测试套件 |

---

## 六、回滚方案

如果删除后出现问题，按以下步骤回滚：

1. **恢复后端文件**：
   - 从版本控制恢复 `recovery_strategy.py`
   - 恢复 `etf_analysis_service.py`、`grid_routes.py`、`optimizer.py` 中的删除代码

2. **恢复前端文件**：
   - 从版本控制恢复各文件中的删除代码

3. **验证**：
   - 运行测试套件验证恢复成功

---

## 七、验证清单

删除完成后，验证以下功能：

- [ ] 普通网格分析功能正常
- [ ] 回测功能正常
- [ ] URL参数解析正常（仅保留普通模式参数）
- [ ] 参数表单正常
- [ ] 策略报告显示正常
- [ ] 响应式布局正常
- [ ] 后端测试全部通过
- [ ] 前端构建成功

---

## 八、修改标记规范

所有删除操作基于 `[RECOVERY_STRATEGY]` 标记进行，删除后确保：

1. 无残留的 `[RECOVERY_STRATEGY]` 注释
2. 无残留的解套模式相关代码
3. 无未使用的导入（删除后运行 lint 检查）
4. 所有测试通过

---

*文档版本：v1.0*
*生成时间：2026-07-10*
*状态：待执行*
