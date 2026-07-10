import React, { useState, useEffect } from "react";
import { Settings, ChevronDown, ChevronUp } from "lucide-react";
import { usePersistedState } from "@shared/hooks";
import { validateETFCode, validateCapital } from "@shared/utils/validation";
import { checkDisclaimerStatus, acceptDisclaimer } from "@shared/utils/disclaimer";
import ETFSelector from "@features/etf/components/ETFSelector";
import CapitalInput from "./CapitalInput";
import GridTypeSelector from "./GridTypeSelector";
import RiskSelector from "./RiskSelector";
import AdjustmentCoefficientSlider from "./AdjustmentCoefficientSlider";
import DisclaimerModal from "./DisclaimerModal";

/**
 * 参数表单容器组件
 * 负责协调各个输入组件和表单验证
 */
const ParameterForm = ({ onAnalysis, loading, initialValues }) => {
  // 状态管理
  const [etfCode, setEtfCode] = usePersistedState(
    "etfCode",
    initialValues?.etfCode || "510300",
  );
  const [totalCapital, setTotalCapital] = usePersistedState(
    "totalCapital",
    initialValues?.totalCapital?.toString() || "10000",
  );
  const [gridType, setGridType] = usePersistedState(
    "gridType",
    initialValues?.gridType || "等比",
  );
  const [riskPreference, setRiskPreference] = usePersistedState(
    "riskPreference",
    initialValues?.riskPreference || "均衡",
  );
  const [adjustmentCoefficient, setAdjustmentCoefficient] = usePersistedState(
    "adjustmentCoefficient",
    initialValues?.adjustmentCoefficient || 1.0,
  );

  // [RECOVERY_STRATEGY] 新增：策略模式状态（暂不开放，默认普通模式）
  const [strategyMode, setStrategyMode] = usePersistedState(
    "strategyMode",
    "normal",
  );
  const [existingPosition, setExistingPosition] = usePersistedState(
    "existingPosition",
    initialValues?.existingPosition?.toString() || "10000",
  );
  const [existingCost, setExistingCost] = usePersistedState(
    "existingCost",
    initialValues?.existingCost?.toString() || "1.500",
  );
  const [newCapital, setNewCapital] = usePersistedState(
    "newCapital",
    initialValues?.newCapital?.toString() || "50000",
  );
  const [targetRecoveryDays, setTargetRecoveryDays] = usePersistedState(
    "targetRecoveryDays",
    initialValues?.targetRecoveryDays?.toString() || "60",
  );
  const [recoveryPanelExpanded, setRecoveryPanelExpanded] = useState(true);

  const [popularETFs, setPopularETFs] = useState([]);
  const [capitalPresets, setCapitalPresets] = useState([]);
  const [etfInfo, setEtfInfo] = useState(null);
  const [etfLoading, setEtfLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // 当初始值变化时更新状态（只在首次加载时使用initialValues，之后保留用户输入）
  useEffect(() => {
    if (initialValues && !initialized) {
      if (initialValues.etfCode) {
        setEtfCode(initialValues.etfCode);
      }
      if (initialValues.totalCapital) {
        setTotalCapital(initialValues.totalCapital.toString());
      }
      if (initialValues.gridType) {
        setGridType(initialValues.gridType);
      }
      if (initialValues.riskPreference) {
        setRiskPreference(initialValues.riskPreference);
      }
      if (initialValues.adjustmentCoefficient) {
        setAdjustmentCoefficient(initialValues.adjustmentCoefficient);
      }
      // [RECOVERY_STRATEGY] 新增：解套模式初始值
      if (initialValues.strategyMode) {
        setStrategyMode(initialValues.strategyMode);
      }
      if (initialValues.existingPosition) {
        setExistingPosition(initialValues.existingPosition.toString());
      }
      if (initialValues.existingCost) {
        setExistingCost(initialValues.existingCost.toString());
      }
      if (initialValues.newCapital) {
        setNewCapital(initialValues.newCapital.toString());
      }
      if (initialValues.targetRecoveryDays) {
        setTargetRecoveryDays(initialValues.targetRecoveryDays.toString());
      }
      setInitialized(true);
    }
  }, [
    initialValues,
    initialized,
    setEtfCode,
    setTotalCapital,
    setGridType,
    setRiskPreference,
    setAdjustmentCoefficient,
    setStrategyMode,
    setExistingPosition,
    setExistingCost,
    setNewCapital,
    setTargetRecoveryDays,
  ]);

  // 获取热门ETF列表
  useEffect(() => {
    fetch("/api/info/popular")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPopularETFs(data.data);
        }
      })
      .catch((err) => console.error("获取热门ETF失败:", err));
  }, []);

  // 获取资金预设
  useEffect(() => {
    fetch("/api/info/capital")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCapitalPresets(data.data);
        }
      })
      .catch((err) => console.error("获取资金预设失败:", err));
  }, []);

  // ETF代码变化时获取基础信息
  useEffect(() => {
    if (etfCode && etfCode.length >= 2) {
      setEtfLoading(true);
      setEtfInfo(null);

      fetch(`/api/info/${etfCode}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setEtfInfo(data.data);
            setErrors((prev) => ({ ...prev, etfCode: "" }));
          } else {
            setEtfInfo(null);
            setErrors((prev) => ({ ...prev, etfCode: data.error }));
          }
        })
        .catch((err) => {
          setEtfInfo(null);
          setErrors((prev) => ({ ...prev, etfCode: "获取标的信息失败" }));
        })
        .finally(() => {
          setEtfLoading(false);
        });
    } else {
      setEtfInfo(null);
      setEtfLoading(false);
    }
  }, [etfCode]);

  // 表单验证
  const validateForm = () => {
    const newErrors = {};

    if (!validateETFCode(etfCode)) {
      newErrors.etfCode = "请输入标的代码（支持A股/港股/美股，无需交易所符号）";
    }

    if (strategyMode === "normal") {
      const capitalValidation = validateCapital(parseFloat(totalCapital));
      if (!capitalValidation.isValid) {
        newErrors.totalCapital = capitalValidation.error;
      }
    } else {
      // [RECOVERY_STRATEGY] 解套模式验证
      const pos = parseInt(existingPosition);
      if (!pos || pos <= 0) {
        newErrors.existingPosition = "持仓数量必须大于0";
      }

      const cost = parseFloat(existingCost);
      if (!cost || cost <= 0) {
        newErrors.existingCost = "持仓成本必须大于0";
      }

      const newCap = parseFloat(newCapital);
      if (!newCap || isNaN(newCap)) {
        newErrors.newCapital = "请输入有效的新投入资金";
      } else if (newCap < 1000) {
        newErrors.newCapital = "新投入资金不能少于1000元";
      }

      const recoveryDays = parseInt(targetRecoveryDays);
      if (!recoveryDays || isNaN(recoveryDays) || recoveryDays <= 0) {
        newErrors.targetRecoveryDays = "目标回本天数必须大于0";
      } else if (recoveryDays > 730) {
        newErrors.targetRecoveryDays = "目标回本天数不能超过2年";
      }

      // 检查是否处于套牢状态
      if (etfInfo && cost > 0 && etfInfo.current_price > 0) {
        if (cost <= etfInfo.current_price) {
          newErrors.existingCost = "当前未处于套牢状态（成本价 ≤ 当前价）";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 表单提交
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    let formData;
    if (strategyMode === "normal") {
      formData = {
        etfCode,
        totalCapital: parseFloat(totalCapital),
        gridType,
        riskPreference,
        adjustmentCoefficient: parseFloat(adjustmentCoefficient),
        strategyType: "normal",
        strategyMode: "normal",
      };
    } else {
      // [RECOVERY_STRATEGY] 解套模式提交数据
      formData = {
        etfCode,
        existingPosition: parseInt(existingPosition),
        existingCost: parseFloat(existingCost),
        newCapital: parseFloat(newCapital),
        targetRecoveryDays: parseInt(targetRecoveryDays),
        gridType,
        riskPreference,
        adjustmentCoefficient: parseFloat(adjustmentCoefficient),
        strategyType: "recovery",
        strategyMode: "recovery",
      };
    }

    // 检查用户是否需要重新确认免责声明
    if (!checkDisclaimerStatus()) {
      // 未确认或已过期，显示免责声明弹窗
      setPendingFormData(formData);
      setShowDisclaimer(true);
      return;
    }

    // 已同意且未过期，直接执行分析
    onAnalysis(formData);
  };

  // 处理免责声明同意
  const handleDisclaimerAccept = () => {
    // 记录用户已同意免责声明
    acceptDisclaimer();
    setShowDisclaimer(false);
    
    // 执行之前暂存的表单提交
    if (pendingFormData) {
      onAnalysis(pendingFormData);
      setPendingFormData(null);
    }
  };

  // 处理免责声明取消
  const handleDisclaimerCancel = () => {
    setShowDisclaimer(false);
    setPendingFormData(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Settings className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">策略参数设置</h2>
          <p className="text-sm text-gray-600">
            请填写您的投资偏好，系统将为您量身定制网格交易策略
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* [RECOVERY_STRATEGY] 策略模式切换（暂不开放）
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">策略模式</label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="strategyMode"
                value="normal"
                checked={strategyMode === "normal"}
                onChange={(e) => setStrategyMode(e.target.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">普通网格</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="strategyMode"
                value="recovery"
                checked={strategyMode === "recovery"}
                onChange={(e) => setStrategyMode(e.target.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-blue-600">解套回本</span>
            </label>
          </div>
          {strategyMode === "recovery" && (
            <p className="mt-2 text-xs text-gray-500">
              适用于持仓套牢场景，通过非对称网格配置快速摊低成本
            </p>
          )}
        </div> */}

        <ETFSelector
          value={etfCode}
          onChange={setEtfCode}
          error={errors.etfCode}
          popularETFs={popularETFs}
          etfInfo={etfInfo}
          loading={etfLoading}
        />

        {/* 普通模式：投资金额 */}
        {strategyMode === "normal" && (
          <CapitalInput
            value={totalCapital}
            onChange={setTotalCapital}
            error={errors.totalCapital}
            presets={capitalPresets}
          />
        )}

        {/* [RECOVERY_STRATEGY] 新增：解套模式输入面板 */}
        {strategyMode === "recovery" && (
          <div className="space-y-4">
            {/* 展开/收起按钮 */}
            <button
              type="button"
              onClick={() => setRecoveryPanelExpanded(!recoveryPanelExpanded)}
              className="flex items-center justify-between w-full text-left px-4 py-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span className="font-medium text-blue-700">解套模式设置</span>
              {recoveryPanelExpanded ? (
                <ChevronUp className="w-5 h-5 text-blue-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-blue-600" />
              )}
            </button>

            {recoveryPanelExpanded && (
              <div className="space-y-4 pl-2">
                {/* 现有持仓信息 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    现有持仓信息
                  </h3>
                  
                  {/* 持仓数量 */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">持仓数量（股）</label>
                    <input
                      type="number"
                      value={existingPosition}
                      onChange={(e) => setExistingPosition(e.target.value)}
                      placeholder="请输入持仓数量"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.existingPosition ? "border-red-500" : "border-gray-300"
                      }`}
                    />
                    {errors.existingPosition && (
                      <p className="mt-1 text-xs text-red-500">{errors.existingPosition}</p>
                    )}
                  </div>

                  {/* 持仓成本 */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">持仓成本（元）</label>
                    <input
                      type="number"
                      value={existingCost}
                      onChange={(e) => setExistingCost(e.target.value)}
                      placeholder="请输入持仓成本价"
                      step="0.001"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.existingCost ? "border-red-500" : "border-gray-300"
                      }`}
                    />
                    {errors.existingCost && (
                      <p className="mt-1 text-xs text-red-500">{errors.existingCost}</p>
                    )}
                  </div>

                  {/* 当前价格和浮亏显示 */}
                  {etfInfo && (
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">当前价格</span>
                        <span className="font-medium text-gray-900">¥{etfInfo.current_price?.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">浮亏</span>
                        <span className="font-medium text-red-600">
                          {(() => {
                            const cost = parseFloat(existingCost);
                            const pos = parseInt(existingPosition);
                            if (cost > 0 && pos > 0 && etfInfo.current_price) {
                              const loss = (etfInfo.current_price - cost) * pos;
                              const lossRatio = (etfInfo.current_price - cost) / cost;
                              return `¥${loss.toFixed(2)} (${lossRatio.toFixed(2)}%)`;
                            }
                            return "-";
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 新投入资金 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    新投入资金（元）
                  </h3>
                  <input
                    type="number"
                    value={newCapital}
                    onChange={(e) => setNewCapital(e.target.value)}
                    placeholder="请输入追加资金"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.newCapital ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.newCapital && (
                    <p className="mt-1 text-xs text-red-500">{errors.newCapital}</p>
                  )}
                </div>

                {/* 目标回本天数 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                    目标回本天数（天）
                  </h3>
                  <input
                    type="number"
                    value={targetRecoveryDays}
                    onChange={(e) => setTargetRecoveryDays(e.target.value)}
                    placeholder="请输入目标回本天数"
                    min="1"
                    max="730"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.targetRecoveryDays ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.targetRecoveryDays && (
                    <p className="mt-1 text-xs text-red-500">{errors.targetRecoveryDays}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">系统将根据您的目标天数自动调整策略配置</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 提交按钮 */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                正在分析策略...
              </div>
            ) : (
              strategyMode === "recovery" ? "开始分析回本策略" : "开始分析策略"
            )}
          </button>
        </div>

        {/* 分隔线 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">更多设置</span>
          </div>
        </div>

        <GridTypeSelector value={gridType} onChange={setGridType} />
        <RiskSelector value={riskPreference} onChange={setRiskPreference} />
        <AdjustmentCoefficientSlider
          value={adjustmentCoefficient}
          onChange={setAdjustmentCoefficient}
        />
      </form>

      {/* 免责声明弹窗 */}
      <DisclaimerModal
        isOpen={showDisclaimer}
        onAccept={handleDisclaimerAccept}
        onCancel={handleDisclaimerCancel}
      />
    </div>
  );
};

export default ParameterForm;
