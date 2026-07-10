# ETF动态网格策略 - 技术实现方案[📋 **待开发**]

## 一、功能概述

### 1.1 需求背景

当前系统采用**静态网格**策略，网格步长在分析时基于ATR计算后固定不变。但市场波动率是持续变化的：

| 场景 | 静态网格问题 | 影响 |
|------|------------|------|
| **波动率上升** | 步长太小，频繁触发交易 | 利润微薄，手续费侵蚀收益 |
| **波动率下降** | 步长太大，网格不触发 | 资金闲置，错失交易机会 |
| **价格单边趋势** | 网格区间固定，价格脱离区间 | 满仓被套或空仓踏空 |

动态网格策略旨在让网格参数（步长、区间）随市场状况动态调整，提高策略适应性和收益效率。

### 1.2 动态网格的三种方向

| 方向 | 核心逻辑 | 优点 | 缺点 | 优先级 |
|------|---------|------|------|--------|
| **波动率自适应** | 根据滚动ATR动态调整步长 | 与现有ATR逻辑契合，改动最小 | 仅解决步长问题，不解决区间漂移 | ⭐⭐⭐ |
| **价格追踪** | 网格中心随价格趋势移动 | 解决区间漂移问题 | 需要判断趋势方向，可能追涨杀跌 | ⭐⭐ |
| **市场状态切换** | 趋势市收窄网格/震荡市放宽网格 | 适应不同市场状态 | 需要复杂的状态识别算法 | ⭐ |

### 1.3 MVP策略：波动率自适应

优先实现**波动率自适应**方案，理由：
1. 与现有ATR计算逻辑最契合，改动最小
2. 解决最核心痛点：波动率变化导致步长不合适
3. 验证动态网格的可行性和收益提升效果

---

## 二、技术架构分析

### 2.1 当前架构

```
┌─────────────────────────────────────────┐
│           BacktestEngine                │
│  ┌───────────────────────────────────┐  │
│  │         TradingLogic              │  │
│  │  step_size (固定)                 │  │
│  │  step_ratio (固定)                │  │
│  │  single_quantity (固定)           │  │
│  └───────────────────────────────────┘  │
│           ▲                             │
│           │ 参数在初始化时固定          │
└───────────┴─────────────────────────────┘
```

**关键问题**：`TradingLogic` 的参数在 `__init__` 时提取后就固定了，回测循环中无法修改。

### 2.2 改造后架构

```
┌─────────────────────────────────────────┐
│           BacktestEngine                │
│  ┌───────────────────────────────────┐  │
│  │         TradingLogic              │  │
│  │  step_size (可动态更新)           │  │
│  │  step_ratio (可动态更新)          │  │
│  │  single_quantity (可动态更新)     │  │
│  └───────────────────────────────────┘  │
│           ▲                             │
│           │ update_grid_params()       │
└───────────┴─────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│      DynamicGridUpdater (新增)          │
│  - 滚动ATR计算                          │
│  - 参数更新决策                          │
│  - 更新频率控制                          │
└─────────────────────────────────────────┘
```

---

## 三、核心设计

### 3.1 波动率自适应算法

**核心公式**：

```
动态步长比例 = 滚动ATR × 调整系数 × 波动率因子

其中：
- 滚动ATR：使用最近N日（默认20日）的ATR值
- 调整系数：用户设定的风险偏好参数（0.5~2.0）
- 波动率因子：基于波动率分位数的放大/缩小系数
```

**波动率因子计算**：

```
波动率分位数 = 当前ATR在过去M日（默认120日）中的分位数排名
波动率因子 = 0.7 + 0.6 × 波动率分位数  (范围：0.7~1.3)

说明：
- 波动率处于低位（分位数<0.3）：因子≈0.9，步长缩小
- 波动率处于中位（分位数0.3~0.7）：因子≈1.0，步长正常
- 波动率处于高位（分位数>0.7）：因子≈1.2，步长放大
```

### 3.2 更新频率控制

| 更新频率 | 适用场景 | 优缺点 |
|---------|---------|--------|
| **每日更新** | 高波动标的 | 响应快，但手续费增加 |
| **每周更新** | 中等波动标的 | 平衡响应和成本 |
| **每月更新** | 低波动标的 | 成本低，但响应慢 |

**默认策略**：每周更新（5个交易日）

### 3.3 参数更新约束

为防止参数剧烈波动，添加约束：

| 参数 | 单次最大变化幅度 | 合理范围 |
|------|----------------|---------|
| 步长比例 | ±20% | 0.5%~5% |
| 单笔数量 | ±30% | 100股~10000股 |
| 网格区间 | ±15% | 基于当前价格 |

---

## 四、后端修改方案

### 4.1 修改范围总览

| 模块 | 修改方式 | 影响程度 | 说明 |
|------|---------|---------|------|
| `trading_logic.py` | 添加方法 | 🟢 低 | 添加 `update_grid_params()` 方法 |
| `engine.py` | 修改循环逻辑 | 🟡 中 | 在回测循环中添加参数更新调用 |
| `optimizer.py` | 新增方法 | 🟢 低 | 添加 `calculate_rolling_atr()` 方法 |
| `etf_analysis_service.py` | 修改方法 | 🟡 中 | 添加动态网格参数配置 |
| `grid_routes.py` | 修改接口 | 🟢 低 | 添加动态网格模式参数 |

### 4.2 详细修改方案

#### 4.2.1 修改 `trading_logic.py`

**文件路径**：`backend/app/algorithms/backtest/trading_logic.py`

```python
class TradingLogic:
    """网格交易逻辑"""
    
    def __init__(self, grid_config: dict, fee_calculator: FeeCalculator, 
                 country: str = 'CHN', slippage_rate: float = 0.001):
        self.grid_config = grid_config
        self.fee_calc = fee_calculator
        self.grid_type = grid_config['type']
        self.step_size = grid_config.get('step_size', 0)
        self.step_ratio = grid_config.get('step_ratio', 0)
        self.single_quantity = grid_config['single_trade_quantity']
        self.slippage_rate = slippage_rate
        self.min_trade_unit = 1 if country == 'USA' else 100
        
        # [DYNAMIC_GRID] 新增：参数约束
        self.min_step_ratio = 0.005  # 最小步长0.5%
        self.max_step_ratio = 0.05   # 最大步长5%
        self.max_change_ratio = 0.2  # 单次最大变化20%
    
    # [DYNAMIC_GRID] 新增：动态更新网格参数
    def update_grid_params(self, new_step_size=None, new_step_ratio=None, 
                          new_single_quantity=None):
        """
        动态更新网格参数
        
        Args:
            new_step_size: 新的等差步长（可选）
            new_step_ratio: 新的等比步长比例（可选）
            new_single_quantity: 新的单笔交易数量（可选）
        """
        # 更新步长比例（带约束）
        if new_step_ratio is not None:
            # 限制单次变化幅度
            if self.step_ratio > 0:
                change_ratio = new_step_ratio / self.step_ratio
                if change_ratio > 1 + self.max_change_ratio:
                    new_step_ratio = self.step_ratio * (1 + self.max_change_ratio)
                elif change_ratio < 1 - self.max_change_ratio:
                    new_step_ratio = self.step_ratio * (1 - self.max_change_ratio)
            # 限制范围
            new_step_ratio = max(self.min_step_ratio, min(self.max_step_ratio, new_step_ratio))
            self.step_ratio = new_step_ratio
        
        # 更新步长（等差）
        if new_step_size is not None:
            self.step_size = new_step_size
        
        # 更新单笔数量
        if new_single_quantity is not None:
            self.single_quantity = int(max(
                self.min_trade_unit,
                min(self.single_quantity * 2, new_single_quantity)
            ))
```

#### 4.2.2 修改 `engine.py`

**文件路径**：`backend/app/algorithms/backtest/engine.py`

```python
class BacktestEngine:
    """回测引擎核心"""
    
    def __init__(self, grid_strategy: dict, backtest_config: BacktestConfig, 
                 country: str = 'CHN', dynamic_grid_config: dict = None):
        self.grid_strategy = grid_strategy
        self.config = backtest_config
        self.country = country
        
        # [DYNAMIC_GRID] 新增：动态网格配置
        self.dynamic_grid_enabled = dynamic_grid_config.get('enabled', False) if dynamic_grid_config else False
        self.update_frequency = dynamic_grid_config.get('update_frequency', 5) if dynamic_grid_config else 5  # 每5个交易日更新一次
        
        # 初始化手续费计算器
        self.fee_calc = FeeCalculator(
            commission_rate=backtest_config.commission_rate,
            min_commission=backtest_config.min_commission
        )
        
        # 初始化交易逻辑
        self.trading_logic = TradingLogic(
            grid_config=grid_strategy['grid_config'],
            fee_calculator=self.fee_calc,
            country=country,
            slippage_rate=backtest_config.slippage_rate
        )
        
        # 状态追踪
        self.state: BacktestState = None
        self.trade_records: List[TradeRecord] = []
        self.equity_curve: List[Dict] = []
        
        # [DYNAMIC_GRID] 新增：参数更新记录
        self.grid_param_history: List[Dict] = []
    
    def run(self, kline_data: List[KBar]) -> Dict:
        """执行回测"""
        if not kline_data:
            raise ValueError("K线数据为空")
        
        # 1. 获取资金配置
        fund_alloc = self.grid_strategy['fund_allocation']
        total_capital = fund_alloc['base_position_amount'] + fund_alloc['grid_trading_amount']
        
        # 2. 执行初始底仓购买
        first_kbar = kline_data[0]
        self.state, initial_trade = self.trading_logic.execute_initial_position(
            first_kbar=first_kbar,
            base_position_amount=fund_alloc['base_position_amount'],
            total_capital=total_capital,
            strategy_base_price=self.grid_strategy['current_price'],
            price_lower=self.grid_strategy['price_range']['lower'],
            price_upper=self.grid_strategy['price_range']['upper']
        )
        
        if initial_trade:
            self.trade_records.append(initial_trade)
        
        # 3. 逐K线扫描交易
        for i, kbar in enumerate(kline_data):
            # [DYNAMIC_GRID] 定期更新网格参数
            if self.dynamic_grid_enabled and i > 0 and i % self.update_frequency == 0:
                self._update_grid_params_dynamically(kline_data[:i+1], i)
            
            # 更新总资产
            self.state.total_asset = self.state.cash + self.state.position * kbar.close
            self.state.peak_asset = max(self.state.peak_asset, self.state.total_asset)
            
            # 记录资产曲线
            self._record_equity_point(kbar.time, kbar.close)
            
            # 检查并执行交易
            new_state, trade_record = self.trading_logic.check_and_execute(
                self.state, kbar
            )
            
            if trade_record:
                trade_record.time = kbar.time
                self.trade_records.append(trade_record)
                self.state = new_state
        
        # 4. 返回回测结果
        return self._generate_result(kline_data)
    
    # [DYNAMIC_GRID] 新增：动态更新网格参数
    def _update_grid_params_dynamically(self, kline_data: List[KBar], current_index: int):
        """
        根据滚动ATR动态更新网格参数
        
        Args:
            kline_data: 当前已处理的K线数据
            current_index: 当前K线索引
        """
        from app.algorithms.grid.optimizer import GridOptimizer
        
        # 计算滚动ATR
        atr_values = GridOptimizer.calculate_atr_values([
            {'high': k.high, 'low': k.low, 'close': k.close} 
            for k in kline_data
        ])
        
        if len(atr_values) >= 20:
            # 使用最近20日ATR的均值
            rolling_atr = sum(atr_values[-20:]) / 20
            current_price = kline_data[-1].close
            
            # 计算波动率分位数（基于过去120日）
            lookback_atr = atr_values[-120:] if len(atr_values) >= 120 else atr_values
            atr_quantile = sum(1 for a in lookback_atr if a <= rolling_atr) / len(lookback_atr)
            
            # 计算波动率因子（0.7~1.3）
            volatility_factor = 0.7 + 0.6 * atr_quantile
            
            # 计算新的步长比例
            base_step_ratio = self.grid_strategy['grid_config'].get('step_ratio', 0.02)
            new_step_ratio = base_step_ratio * volatility_factor
            
            # 更新参数
            self.trading_logic.update_grid_params(new_step_ratio=new_step_ratio)
            
            # 记录参数变化
            self.grid_param_history.append({
                'time': kline_data[-1].time,
                'step_ratio': self.trading_logic.step_ratio,
                'atr_value': rolling_atr,
                'volatility_factor': volatility_factor,
                'atr_quantile': atr_quantile
            })
    
    def _generate_result(self, kline_data: List[KBar]) -> Dict:
        """生成回测结果"""
        result = {
            'trade_records': self.trade_records,
            'equity_curve': self.equity_curve,
            'final_state': {
                'cash': self.state.cash,
                'position': self.state.position,
                'total_asset': self.state.total_asset
            },
            'kline_data': kline_data
        }
        
        # [DYNAMIC_GRID] 添加参数更新历史
        if self.dynamic_grid_enabled:
            result['grid_param_history'] = self.grid_param_history
        
        return result
```

#### 4.2.3 修改 `optimizer.py`

**文件路径**：`backend/app/algorithms/grid/optimizer.py`

```python
class GridOptimizer:
    """网格优化器"""
    
    # [DYNAMIC_GRID] 新增：计算ATR值列表
    @staticmethod
    def calculate_atr_values(kline_list: List[dict]) -> List[float]:
        """
        计算K线数据的ATR值列表
        
        Args:
            kline_list: K线数据列表，每个元素包含 high, low, close
            
        Returns:
            ATR值列表
        """
        atr_values = []
        
        for i in range(len(kline_list)):
            if i == 0:
                # 第一个K线的ATR = 当日振幅
                atr = kline_list[i]['high'] - kline_list[i]['low']
            else:
                # 真实波动幅度
                tr1 = kline_list[i]['high'] - kline_list[i]['low']
                tr2 = abs(kline_list[i]['high'] - kline_list[i-1]['close'])
                tr3 = abs(kline_list[i]['low'] - kline_list[i-1]['close'])
                tr = max(tr1, tr2, tr3)
                
                # 平滑计算（默认14日）
                atr = (atr_values[-1] * 13 + tr) / 14
            
            atr_values.append(atr)
        
        return atr_values
```

#### 4.2.4 修改 `etf_analysis_service.py`

**文件路径**：`backend/app/services/etf_analysis_service.py`

```python
def analyze_grid_strategy(self, etf_code: str, total_capital: float,
                          grid_type: str = '等比', risk_preference: str = '均衡',
                          adjustment_coefficient: float = 1.0,
                          dynamic_grid_enabled: bool = False,
                          dynamic_grid_frequency: int = 5) -> Dict:
    """
    网格策略分析入口
    
    Args:
        dynamic_grid_enabled: 是否启用动态网格
        dynamic_grid_frequency: 参数更新频率（交易日数）
    """
    pass
```

#### 4.2.5 修改 `grid_routes.py`

**文件路径**：`backend/app/routes/grid_routes.py`

```python
@bp.route('/analyze', methods=['POST'])
def analyze_grid_strategy():
    """网格策略分析"""
    data = request.get_json()
    
    # [DYNAMIC_GRID] 获取动态网格参数
    dynamic_grid_enabled = data.get('dynamicGridEnabled', False)
    dynamic_grid_frequency = data.get('dynamicGridFrequency', 5)
    
    # 传递给服务层
    result = analysis_service.analyze_grid_strategy(
        etf_code=data['etfCode'],
        total_capital=data['totalCapital'],
        grid_type=data.get('gridType', '等比'),
        risk_preference=data.get('riskPreference', '均衡'),
        adjustment_coefficient=data.get('adjustmentCoefficient', 1.0),
        dynamic_grid_enabled=dynamic_grid_enabled,
        dynamic_grid_frequency=dynamic_grid_frequency
    )
    
    return jsonify(result)
```

---

## 五、前端修改方案

### 5.1 参数表单

在 `ParameterForm.jsx` 中添加动态网格选项：

```
┌─────────────────────────────────────────┐
│  ⚙️ 策略参数设置                          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 网格类型:  ○ 等差   ● 等比        │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ ☐ 启用动态网格                      │  │
│  │   更新频率: ▼ 每周                  │  │
│  │   波动率敏感度: ▼ 中等              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [开始分析策略]                          │
└─────────────────────────────────────────┘
```

### 5.2 结果展示

在策略报告中添加动态网格参数变化图表：

```
┌─────────────────────────────────────────┐
│  📊 动态网格参数变化                      │
│                                         │
│  步长比例: ▁▂▃▄▅▆▇█  (0.5% ~ 2.5%)      │
│  ATR值:    ▁▂▃▄▅▆▇█  (0.02 ~ 0.08)      │
│                                         │
│  更新次数: 12次                          │
│  平均步长: 1.2%                          │
│  最大步长: 2.1%                          │
│  最小步长: 0.8%                          │
└─────────────────────────────────────────┘
```

### 5.3 URL参数

添加动态网格相关参数：

| 参数名 | 说明 | 默认值 |
|--------|------|--------|
| `dynamic` | 是否启用动态网格 | `false` |
| `dynFreq` | 更新频率（1/5/20） | `5` |

---

## 六、API接口设计

### 6.1 策略分析接口

**POST** `/api/grid/analyze`

请求体（新增字段）：
```json
{
    "etfCode": "510300",
    "totalCapital": 100000,
    "gridType": "等比",
    "riskPreference": "均衡",
    "adjustmentCoefficient": 1.0,
    "dynamicGridEnabled": true,
    "dynamicGridFrequency": 5
}
```

### 6.2 回测接口

**POST** `/api/grid/backtest`

响应体（新增字段）：
```json
{
    "success": true,
    "data": {
        "backtest_result": {
            "trade_records": [...],
            "equity_curve": [...],
            "grid_param_history": [
                {
                    "time": "2024-01-08",
                    "step_ratio": 0.015,
                    "atr_value": 0.035,
                    "volatility_factor": 1.1,
                    "atr_quantile": 0.75
                }
            ]
        }
    }
}
```

---

## 七、实施路线图

### 7.1 实施顺序（风险最低路径）

```
第1步：修改 optimizer.py 添加 calculate_atr_values() 方法（低风险）
       ↓
第2步：修改 trading_logic.py 添加 update_grid_params() 方法（低风险）
       ↓
第3步：修改 engine.py 添加动态参数更新逻辑（中风险）
       ↓
第4步：修改 etf_analysis_service.py 添加动态网格参数传递（低风险）
       ↓
第5步：修改 grid_routes.py 添加 API 参数（低风险）
       ↓
第6步：前端添加动态网格选项（低风险）
       ↓
第7步：前端添加参数变化图表展示（低风险）
       ↓
第8步：回测验证效果（中风险）
```

### 7.2 风险评估

| 风险类型 | 等级 | 说明 | 缓解措施 |
|---------|------|------|---------|
| 代码兼容性 | 🟢 低 | 新增方法不修改现有逻辑 | 保持原有接口不变 |
| API 兼容性 | 🟢 低 | 新增可选参数 | 不影响现有调用 |
| 回测准确性 | 🟡 中 | 动态参数可能影响回测结果 | 添加参数约束，限制变化幅度 |
| 性能影响 | 🟢 低 | 滚动ATR计算增加少量开销 | 仅在更新时点计算 |
| 前端兼容性 | 🟢 低 | 新增组件，不修改现有组件 | 通过功能开关控制显示 |

---

## 八、核心设计原则

1. **向后兼容**：动态网格为可选功能，不影响现有静态网格策略
2. **参数约束**：限制参数变化幅度，防止剧烈波动
3. **可配置性**：更新频率、敏感度等参数可配置
4. **透明性**：记录参数变化历史，便于分析和调试
5. **渐进式部署**：先实现波动率自适应，再扩展其他方向

---

## 九、预期效果

- **对现有用户**：无任何影响，默认使用静态网格
- **对新功能用户**：通过勾选启用动态网格，获得更好的自适应能力
- **收益提升**：在波动率变化较大的市场环境中，动态网格有望提升5-15%的年化收益
- **风险控制**：参数约束机制避免过度交易和资金损失

---

## 十、回滚机制与安全标志

### 10.1 全局功能开关

**文件路径**：`backend/app/config/config.yaml`

```yaml
features:
  dynamic_grid:
    enabled: true  # 设置为 false 可禁用动态网格
```

**文件路径**：`frontend/src/shared/constants/config.js`

```javascript
export const FEATURE_FLAGS = {
  DYNAMIC_GRID_ENABLED: true,
};
```

### 10.2 各模块回滚说明

| 模块 | 修改方式 | 回滚方法 |
|------|---------|---------|
| `trading_logic.py` | 添加方法 | 删除 `update_grid_params()` 方法 |
| `engine.py` | 修改循环逻辑 | 删除动态参数更新代码，恢复原循环 |
| `optimizer.py` | 新增方法 | 删除 `calculate_atr_values()` 方法 |
| `etf_analysis_service.py` | 修改方法 | 删除动态网格参数，恢复原签名 |
| `grid_routes.py` | 修改接口 | 删除动态网格相关参数 |

### 10.3 修改标记规范

所有新增代码需添加统一的标记注释：

```python
# [DYNAMIC_GRID] 新增：动态网格参数更新方法
def update_grid_params(self, ...):
    pass
```

```javascript
// [DYNAMIC_GRID] 新增：动态网格选项
<Checkbox checked={dynamicGridEnabled} onChange={...} />
```

---

*文档版本：v1.0*
*生成时间：2026-07-10*
*状态：待开发*
*修订说明：初始设计方案*
