"""
套牢回本网格策略 - 非对称网格配置算法

策略核心原理：
- 下方区域（当前价以下）：密集网格，小步长，多买低价快速摊低成本
- 中部区域（当前价附近）：正常网格，保持流动性
- 上方区域（接近成本价）：稀疏网格，等待解套卖出
"""

import numpy as np
from typing import Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)


class RecoveryGridStrategy:
    """套牢回本网格策略"""

    def __init__(self, recovery_config: Dict):
        """
        初始化回本策略

        Args:
            recovery_config: 配置参数
                - existing_position: 现有持仓数量
                - existing_cost: 现有持仓成本价
                - new_capital: 新投入资金
                - target_recovery_days: 目标回本天数（可选）
                - max_additional_drawdown: 可接受的最大额外浮亏（可选）
        """
        self.existing_position = recovery_config.get('existing_position', 0)
        self.existing_cost = recovery_config.get('existing_cost', 0.0)
        self.new_capital = recovery_config.get('new_capital', 0.0)
        self.target_recovery_days = recovery_config.get('target_recovery_days', 60)
        self.max_additional_drawdown = recovery_config.get('max_additional_drawdown', 0.15)

    def calculate_recovery_grid(self, current_price: float, atr_ratio: float,
                                risk_preference: str, adjustment_coefficient: float = 1.0) -> Dict:
        """
        计算回本网格配置

        Args:
            current_price: 当前价格
            atr_ratio: ATR比率
            risk_preference: 风险偏好（低频/均衡/高频）
            adjustment_coefficient: 调节系数

        Returns:
            回本网格配置结果
        """
        try:
            if self.existing_position <= 0 or self.existing_cost <= 0:
                raise ValueError("现有持仓信息不完整")

            # 计算浮亏情况
            unrealized_loss = (current_price - self.existing_cost) * self.existing_position
            unrealized_loss_ratio = (current_price - self.existing_cost) / self.existing_cost

            # 计算总资金（原有持仓市值 + 新投入资金）
            existing_market_value = self.existing_position * current_price
            total_capital = existing_market_value + self.new_capital

            # 计算各区域步长配置
            step_config = self._calculate_asymmetric_steps(
                current_price, atr_ratio, risk_preference, adjustment_coefficient
            )

            # 计算价格区间
            price_lower, price_upper = self._calculate_price_range(
                current_price, step_config, atr_ratio
            )

            # 生成网格价格水平
            price_levels = self._generate_grid_levels(
                current_price, price_lower, price_upper, step_config
            )

            # 计算资金分配
            fund_allocation = self._calculate_fund_allocation(
                total_capital, existing_market_value, price_levels, current_price
            )

            # 计算回本指标
            recovery_metrics = self._calculate_recovery_metrics(
                current_price, atr_ratio, fund_allocation, price_levels
            )

            # 计算网格配置详情
            grid_config_detail = self._generate_grid_config_detail(
                price_levels, current_price, step_config
            )

            result = {
                'strategy_type': 'recovery',
                'current_price': current_price,
                'existing_position': self.existing_position,
                'existing_cost': self.existing_cost,
                'existing_market_value': round(existing_market_value, 2),
                'unrealized_loss': round(unrealized_loss, 2),
                'unrealized_loss_ratio': round(unrealized_loss_ratio, 4),
                'new_capital': self.new_capital,
                'total_capital': round(total_capital, 2),
                'price_range': {
                    'lower': round(price_lower, 3),
                    'upper': round(price_upper, 3),
                    'ratio': round((price_upper - price_lower) / current_price, 4)
                },
                'step_config': step_config,
                'grid_config': grid_config_detail,
                'price_levels': [round(p, 3) for p in price_levels],
                'fund_allocation': fund_allocation,
                'recovery_metrics': recovery_metrics
            }

            logger.info(f"回本网格策略计算完成: 现有持仓{self.existing_position}股, "
                       f"成本{self.existing_cost:.3f}, 当前价{current_price:.3f}, "
                       f"浮亏{unrealized_loss_ratio:.1%}, "
                       f"预期摊薄成本{recovery_metrics['expected_avg_cost']:.3f}")

            return result

        except Exception as e:
            logger.error(f"回本网格策略计算失败: {str(e)}")
            raise

    def _calculate_asymmetric_steps(self, current_price: float, atr_ratio: float,
                                    risk_preference: str, adjustment_coefficient: float) -> Dict:
        """
        计算非对称步长配置

        策略特点：
        - 下方密集区（当前价格以下）：小步长 = 正常步长 × 0.5，多买低价快速摊低成本
        - 中部正常区（当前价格附近）：正常步长，保持流动性
        - 上方稀疏区（接近成本价）：大步长 = 正常步长 × 1.5 ~ 2.0，等待解套卖出
        """
        # 基础风险系数（根据频率偏好）
        default_risk_multipliers = {
            '低频': 1.2,
            '均衡': 0.7,
            '高频': 0.3,
        }

        # 应用调节系数
        risk_multiplier = default_risk_multipliers.get(risk_preference, 0.7)
        diff_from_mid = risk_multiplier - 0.7
        adjusted_diff = diff_from_mid * adjustment_coefficient
        risk_multiplier = 0.7 + adjusted_diff

        # 计算基础步长
        atr_value = atr_ratio * current_price
        base_step_size = atr_value * risk_multiplier
        base_step_ratio = base_step_size / current_price

        # 计算各区域步长
        # 下方密集区：小步长，快速摊低成本
        lower_step_ratio = base_step_ratio * 0.5
        lower_step_size = lower_step_ratio * current_price

        # 中部正常区：正常步长
        middle_step_ratio = base_step_ratio
        middle_step_size = base_step_size

        # 上方稀疏区：大步长，等待解套
        # 根据套牢程度动态调整上方步长系数
        drawdown_ratio = (self.existing_cost - current_price) / self.existing_cost
        if drawdown_ratio > 0.2:
            upper_step_ratio = base_step_ratio * 2.0
        elif drawdown_ratio > 0.1:
            upper_step_ratio = base_step_ratio * 1.75
        else:
            upper_step_ratio = base_step_ratio * 1.5
        upper_step_size = upper_step_ratio * current_price

        # 计算区域边界
        # 中部区域范围：当前价 ± 2个基础步长
        middle_range = base_step_size * 2
        middle_lower = current_price - middle_range
        middle_upper = current_price + middle_range

        # 上方区域起点：接近成本价的80%位置
        cost_distance = self.existing_cost - current_price
        upper_start_ratio = 0.8
        upper_start_price = current_price + cost_distance * upper_start_ratio

        return {
            'base_step_size': round(base_step_size, 3),
            'base_step_ratio': round(base_step_ratio, 4),
            'lower': {
                'step_size': round(lower_step_size, 3),
                'step_ratio': round(lower_step_ratio, 4),
                'start_price': None,
                'end_price': middle_lower
            },
            'middle': {
                'step_size': round(middle_step_size, 3),
                'step_ratio': round(middle_step_ratio, 4),
                'start_price': middle_lower,
                'end_price': middle_upper
            },
            'upper': {
                'step_size': round(upper_step_size, 3),
                'step_ratio': round(upper_step_ratio, 4),
                'start_price': max(middle_upper, upper_start_price),
                'end_price': None
            },
            'region_boundaries': {
                'middle_lower': round(middle_lower, 3),
                'middle_upper': round(middle_upper, 3),
                'upper_start': round(max(middle_upper, upper_start_price), 3)
            }
        }

    def _calculate_price_range(self, current_price: float, step_config: Dict, atr_ratio: float) -> Tuple[float, float]:
        """
        计算价格区间

        下方边界：基于ATR和下方步长计算，确保有足够的买入网格
        上方边界：成本价 + 2个上方步长
        """
        # 下方边界：当前价 - 3倍ATR
        price_range_ratio = atr_ratio * 3
        price_lower = current_price * (1 - price_range_ratio)

        # 上方边界：成本价 + 2个上方步长，确保覆盖解套目标
        price_upper = self.existing_cost + step_config['upper']['step_size'] * 2

        # 确保区间合理
        if price_lower <= 0:
            price_lower = current_price * 0.8

        if price_upper <= current_price:
            price_upper = current_price * 1.3

        return price_lower, price_upper

    def _generate_grid_levels(self, current_price: float, price_lower: float,
                              price_upper: float, step_config: Dict) -> List[float]:
        """
        生成非对称网格价格水平

        根据三个区域的不同步长生成网格点
        """
        levels = []
        boundaries = step_config['region_boundaries']

        # 生成下方区域网格（从下往上）
        price = price_lower
        while price <= boundaries['middle_lower']:
            levels.append(price)
            price += step_config['lower']['step_size']

        # 生成中部区域网格
        price = boundaries['middle_lower']
        while price <= boundaries['middle_upper']:
            if not any(abs(p - price) < 0.0001 for p in levels):
                levels.append(price)
            price += step_config['middle']['step_size']

        # 生成上方区域网格
        price = boundaries['upper_start']
        while price <= price_upper:
            if not any(abs(p - price) < 0.0001 for p in levels):
                levels.append(price)
            price += step_config['upper']['step_size']

        # 添加成本价附近的卖出点
        if self.existing_cost not in levels:
            levels.append(self.existing_cost)

        # 添加当前价格点
        if not any(abs(p - current_price) < 0.0001 for p in levels):
            levels.append(current_price)

        # 排序并去重
        levels = sorted(list(set(levels)))

        return levels

    def _calculate_fund_allocation(self, total_capital: float, existing_market_value: float,
                                   price_levels: List[float], current_price: float) -> Dict:
        """
        计算资金分配（解套模式专属）

        原有持仓 + 新投入资金的综合分配
        """
        try:
            # 预留机动资金（5%）
            reserve_amount = total_capital * 0.05
            available_capital = total_capital - reserve_amount

            # 识别买入和卖出网格
            buy_levels = [price for price in price_levels if price < current_price]
            sell_levels = [price for price in price_levels if price > current_price]

            if not buy_levels or not sell_levels:
                return self._fallback_fund_allocation(total_capital, current_price)

            # 计算资金需求系数
            buy_price_sum = sum(buy_levels)
            sell_grid_count = len(sell_levels)
            fund_requirement_factor = buy_price_sum + sell_grid_count * current_price

            # 计算单笔股数（基于新投入资金）
            theoretical_shares = self.new_capital / fund_requirement_factor
            min_unit = 100
            shares_per_unit = int(theoretical_shares / min_unit)
            single_trade_quantity = max(min_unit, shares_per_unit * min_unit)

            # 计算底仓股数和资金（原有持仓 + 新底仓）
            base_position_shares = self.existing_position + sell_grid_count * single_trade_quantity
            base_position_amount = base_position_shares * current_price

            # 计算买入网格资金需求
            buy_grid_fund = sum(price * single_trade_quantity for price in buy_levels)

            # 验证资金安全性
            total_required_fund = base_position_amount + buy_grid_fund
            safety_ratio = total_required_fund / available_capital

            # 如果超出资金限制，调整单笔股数
            if safety_ratio > 1.0:
                adjustment_factor = 0.95 / safety_ratio
                adjusted_shares = int(single_trade_quantity * adjustment_factor / min_unit) * min_unit
                single_trade_quantity = max(min_unit, adjusted_shares)

                base_position_shares = self.existing_position + sell_grid_count * single_trade_quantity
                base_position_amount = base_position_shares * current_price
                buy_grid_fund = sum(price * single_trade_quantity for price in buy_levels)
                total_required_fund = base_position_amount + buy_grid_fund
                safety_ratio = total_required_fund / available_capital

            # 计算底仓比例
            base_position_ratio = base_position_amount / total_capital

            # 计算网格资金
            grid_trading_amount = available_capital - base_position_amount

            # 生成网格资金分配详情
            grid_funds = []
            for i, price in enumerate(price_levels):
                is_buy_level = price < current_price
                shares = single_trade_quantity if is_buy_level else 0
                actual_fund = shares * price

                grid_funds.append({
                    'level': i + 1,
                    'price': round(price, 3),
                    'allocated_fund': round(actual_fund, 2),
                    'shares': shares,
                    'actual_fund': round(actual_fund, 2),
                    'is_buy_level': is_buy_level
                })

            actual_buy_grids = sum(1 for gf in grid_funds if gf['is_buy_level'])
            actual_sell_grids = sum(1 for gf in grid_funds if not gf['is_buy_level'])

            grid_fund_utilization_rate = buy_grid_fund / grid_trading_amount if grid_trading_amount > 0 else 0

            if len(price_levels) > 1:
                avg_step = (price_levels[-1] - price_levels[0]) / len(price_levels)
                expected_profit_per_trade = single_trade_quantity * avg_step
            else:
                expected_profit_per_trade = 0

            return {
                'base_position_amount': round(base_position_amount, 2),
                'base_position_shares': base_position_shares,
                'grid_trading_amount': round(grid_trading_amount, 2),
                'reserve_amount': round(reserve_amount, 2),
                'grid_funds': grid_funds,
                'total_buy_grid_fund': round(buy_grid_fund, 2),
                'grid_fund_utilization_rate': round(grid_fund_utilization_rate, 4),
                'expected_profit_per_trade': round(expected_profit_per_trade, 2),
                'grid_count': len(grid_funds),
                'base_position_ratio': round(base_position_ratio, 4),
                'single_trade_quantity': single_trade_quantity,
                'buy_grid_fund': round(buy_grid_fund, 2),
                'buy_grid_safety_ratio': round(safety_ratio, 4),
                'extreme_case_safe': safety_ratio <= 1.0,
                'calculation_method': '回本策略资金分配算法',
                'algorithm_details': {
                    'buy_grids': actual_buy_grids,
                    'sell_grids': actual_sell_grids,
                    'base_position_shares': base_position_shares,
                    'fund_requirement_factor': round(fund_requirement_factor, 2),
                    'total_required_fund': round(total_required_fund, 2),
                    'existing_position': self.existing_position,
                    'existing_market_value': round(existing_market_value, 2)
                }
            }

        except Exception as e:
            logger.error(f"回本策略资金分配计算失败: {str(e)}")
            return self._fallback_fund_allocation(total_capital, current_price)

    def _fallback_fund_allocation(self, total_capital: float, current_price: float) -> Dict:
        """
        降级资金分配算法
        """
        reserve_amount = total_capital * 0.05
        base_position_amount = total_capital * 0.3
        base_position_shares = int(base_position_amount / current_price / 100) * 100
        base_position_amount = base_position_shares * current_price
        grid_trading_amount = total_capital - base_position_amount - reserve_amount

        return {
            'base_position_amount': round(base_position_amount, 2),
            'base_position_shares': base_position_shares,
            'grid_trading_amount': round(grid_trading_amount, 2),
            'reserve_amount': round(reserve_amount, 2),
            'grid_funds': [],
            'total_buy_grid_fund': 0,
            'grid_fund_utilization_rate': 0,
            'expected_profit_per_trade': 0,
            'grid_count': 0,
            'base_position_ratio': 0.3,
            'single_trade_quantity': 100,
            'buy_grid_fund': 0,
            'buy_grid_safety_ratio': 0,
            'extreme_case_safe': True,
            'calculation_method': '降级算法',
            'algorithm_details': {'fallback_reason': '回本策略资金分配算法失败'}
        }

    def _calculate_recovery_metrics(self, current_price: float, atr_ratio: float,
                                    fund_allocation: Dict, price_levels: List[float]) -> Dict:
        """
        计算回本指标

        Returns:
            - expected_avg_cost: 预期摊薄后成本
            - cost_reduction: 成本降低幅度
            - expected_recovery_days: 预期回本时间
            - max_expected_drawdown: 最大预期浮亏
            - recovery_probability: 回本概率
        """
        # 计算预期平均成本
        # 假设在所有买入网格都买入后的平均成本
        total_shares = fund_allocation['base_position_shares']
        total_cost = self.existing_position * self.existing_cost + fund_allocation['buy_grid_fund']
        expected_avg_cost = total_cost / total_shares if total_shares > 0 else self.existing_cost

        # 计算成本降低幅度
        cost_reduction = self.existing_cost - expected_avg_cost
        cost_reduction_ratio = cost_reduction / self.existing_cost

        # 计算预期回本时间
        # 基于历史波动率估算价格回到成本价的时间
        daily_volatility = atr_ratio * np.sqrt(252)
        required_return = cost_reduction_ratio

        if daily_volatility > 0:
            expected_recovery_days = int(np.ceil(required_return / (daily_volatility / np.sqrt(252))))
        else:
            expected_recovery_days = self.target_recovery_days

        # 计算最大预期浮亏
        # 假设价格跌到最低网格点
        min_price = min(price_levels) if price_levels else current_price * 0.9
        max_expected_drawdown = (min_price - expected_avg_cost) / expected_avg_cost

        # 计算回本概率
        # 基于历史波动特征估算
        recovery_probability = min(0.95, max(0.5, 1 - max_expected_drawdown * 2))

        return {
            'expected_avg_cost': round(expected_avg_cost, 3),
            'cost_reduction': round(cost_reduction, 3),
            'cost_reduction_ratio': round(cost_reduction_ratio, 4),
            'expected_recovery_days': expected_recovery_days,
            'max_expected_drawdown': round(max_expected_drawdown, 4),
            'recovery_probability': round(recovery_probability, 4)
        }

    def _generate_grid_config_detail(self, price_levels: List[float], current_price: float,
                                     step_config: Dict) -> Dict:
        """
        生成网格配置详情
        """
        boundaries = step_config['region_boundaries']

        # 统计各区域网格数量
        lower_grids = sum(1 for p in price_levels if p <= boundaries['middle_lower'])
        middle_grids = sum(1 for p in price_levels if boundaries['middle_lower'] < p <= boundaries['middle_upper'])
        upper_grids = sum(1 for p in price_levels if p > boundaries['middle_upper'])

        return {
            'count': len(price_levels),
            'type': '非对称网格',
            'single_trade_quantity': step_config.get('single_trade_quantity', 100),
            'region_counts': {
                'lower': lower_grids,
                'middle': middle_grids,
                'upper': upper_grids
            },
            'region_details': {
                'lower': {
                    'count': lower_grids,
                    'step_ratio': step_config['lower']['step_ratio'],
                    'description': '下方密集区：小步长，多买低价快速摊低成本'
                },
                'middle': {
                    'count': middle_grids,
                    'step_ratio': step_config['middle']['step_ratio'],
                    'description': '中部正常区：正常步长，保持流动性'
                },
                'upper': {
                    'count': upper_grids,
                    'step_ratio': step_config['upper']['step_ratio'],
                    'description': '上方稀疏区：大步长，等待解套卖出'
                }
            }
        }