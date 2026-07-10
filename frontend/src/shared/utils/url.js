/**
 * URL参数管理工具
 * 处理分析页面的URL参数编码、解码和验证
 */
import { validateETFCode } from "./validation";

// 参数映射表 - 中文到英文的映射
export const PARAM_MAPPINGS = {
  gridType: {
    等比: "geometric",
    等差: "arithmetic",
  },
  riskPreference: {
    低频: "conservative",
    均衡: "balanced",
    高频: "aggressive",
  },
};

// 反向映射表 - 英文到中文的映射
export const REVERSE_PARAM_MAPPINGS = {
  gridType: {
    geometric: "等比",
    arithmetic: "等差",
  },
  riskPreference: {
    conservative: "低频",
    balanced: "均衡",
    aggressive: "高频",
  },
};

// 默认参数值
export const DEFAULT_PARAMS = {
  capital: "10000",
  grid: "geometric", // 对应"等比"
  risk: "balanced", // 对应"均衡"
  adjustment: "1.0", // 调节系数默认值
  strategyMode: "normal", // 策略模式：normal/recovery
  strategyType: "normal", // 策略类型：normal/recovery（与strategyMode一致）
  existingPosition: "10000", // 解套模式：现有持仓数量
  existingCost: "1.500", // 解套模式：现有持仓成本
  newCapital: "50000", // 解套模式：新投入资金
};

/**
 * 将分析参数编码为URL查询参数
 * @param {Object} params - 分析参数对象
 * @returns {URLSearchParams} URL查询参数对象
 */
export const encodeAnalysisParams = (params) => {
  const searchParams = new URLSearchParams();

  // 策略模式参数（strategyMode和strategyType保持一致）
  const strategyType = params.strategyType || params.strategyMode;
  if (strategyType !== undefined && strategyType !== null) {
    searchParams.set("mode", strategyType);
    searchParams.set("type", strategyType);
  }

  // 资金参数（普通模式）
  if (params.totalCapital !== undefined && params.totalCapital !== null) {
    searchParams.set("capital", params.totalCapital.toString());
  }

  // 解套模式参数
  if (params.existingPosition !== undefined && params.existingPosition !== null) {
    searchParams.set("pos", params.existingPosition.toString());
  }
  if (params.existingCost !== undefined && params.existingCost !== null) {
    searchParams.set("cost", params.existingCost.toString());
  }
  if (params.newCapital !== undefined && params.newCapital !== null) {
    searchParams.set("newCap", params.newCapital.toString());
  }
  if (params.targetRecoveryDays !== undefined && params.targetRecoveryDays !== null) {
    searchParams.set("recoveryDays", params.targetRecoveryDays.toString());
  }

  // 网格类型参数
  if (params.gridType) {
    const encodedGrid =
      PARAM_MAPPINGS.gridType[params.gridType] || params.gridType;
    searchParams.set("grid", encodedGrid);
  }

  // 频率偏好参数
  if (params.riskPreference) {
    const encodedRisk =
      PARAM_MAPPINGS.riskPreference[params.riskPreference] ||
      params.riskPreference;
    searchParams.set("risk", encodedRisk);
  }

  // 调节系数参数
  if (params.adjustmentCoefficient !== undefined && params.adjustmentCoefficient !== null) {
    searchParams.set("adjustment", params.adjustmentCoefficient.toString());
  }

  return searchParams;
};

/**
 * 从URL查询参数解码分析参数
 * @param {URLSearchParams} searchParams - URL查询参数对象
 * @returns {Object} 解码后的分析参数对象
 */
export const decodeAnalysisParams = (searchParams) => {
  const params = {};

  // 解析策略模式参数
  const mode = searchParams.get("mode");
  const type = searchParams.get("type");
  const strategyType = type || mode;
  if (strategyType) {
    params.strategyMode = strategyType;
    params.strategyType = strategyType;
  }

  // 解析资金参数（普通模式）
  const capital = searchParams.get("capital");
  if (capital) {
    const capitalNum = parseFloat(capital);
    if (!isNaN(capitalNum) && capitalNum >= 1000 && capitalNum <= 1000000) {
      params.totalCapital = capitalNum;
    }
  }

  // 解析解套模式参数
  const pos = searchParams.get("pos");
  if (pos) {
    const posNum = parseInt(pos);
    if (!isNaN(posNum) && posNum > 0) {
      params.existingPosition = posNum;
    }
  }

  const cost = searchParams.get("cost");
  if (cost) {
    const costNum = parseFloat(cost);
    if (!isNaN(costNum) && costNum > 0) {
      params.existingCost = costNum;
    }
  }

  const newCap = searchParams.get("newCap");
  if (newCap) {
    const newCapNum = parseFloat(newCap);
    if (!isNaN(newCapNum) && newCapNum >= 1000 && newCapNum <= 1000000) {
      params.newCapital = newCapNum;
    }
  }

  const recoveryDays = searchParams.get("recoveryDays");
  if (recoveryDays) {
    const recoveryDaysNum = parseInt(recoveryDays);
    if (!isNaN(recoveryDaysNum) && recoveryDaysNum > 0 && recoveryDaysNum <= 730) {
      params.targetRecoveryDays = recoveryDaysNum;
    }
  }

  // 解析网格类型参数
  const grid = searchParams.get("grid");
  if (grid) {
    params.gridType = REVERSE_PARAM_MAPPINGS.gridType[grid] || grid;
  }

  // 解析频率偏好参数
  const risk = searchParams.get("risk");
  if (risk) {
    params.riskPreference = REVERSE_PARAM_MAPPINGS.riskPreference[risk] || risk;
  }

  // 解析调节系数参数
  const adjustment = searchParams.get("adjustment");
  if (adjustment !== null) {
    const adjustmentNum = parseFloat(adjustment);
    if (!isNaN(adjustmentNum) && adjustmentNum >= 0.0 && adjustmentNum <= 2.0) {
      params.adjustmentCoefficient = adjustmentNum;
    }
  }

  return params;
};

/**
 * 验证分析参数完整性
 * @param {Object} params - 分析参数对象
 * @returns {Object} 验证结果和补全后的参数
 */
export const validateAndCompleteParams = (params) => {
  const result = {
    isValid: true,
    errors: [],
    params: { ...params },
  };

  // 验证并补全策略模式参数
  if (!params.strategyMode) {
    result.params.strategyMode = DEFAULT_PARAMS.strategyMode;
    result.params.strategyType = DEFAULT_PARAMS.strategyType;
  } else if (!["normal", "recovery"].includes(params.strategyMode)) {
    result.errors.push("策略模式参数无效");
    result.params.strategyMode = DEFAULT_PARAMS.strategyMode;
    result.params.strategyType = DEFAULT_PARAMS.strategyType;
  } else {
    // 确保 strategyType 和 strategyMode 保持一致
    result.params.strategyType = params.strategyMode;
  }

  // 验证并补全资金参数（普通模式）
  if (params.strategyMode !== "recovery") {
    if (params.totalCapital === undefined || params.totalCapital === null) {
      result.params.totalCapital = parseFloat(DEFAULT_PARAMS.capital);
    } else {
      const capital = parseFloat(params.totalCapital);
      if (isNaN(capital) || capital < 1000 || capital > 1000000) {
        result.errors.push("投资金额应在1千-100万之间");
        result.params.totalCapital = parseFloat(DEFAULT_PARAMS.capital);
      }
    }
  }

  // 验证并补全解套模式参数
  if (params.strategyMode === "recovery") {
    // 持仓数量
    if (params.existingPosition === undefined || params.existingPosition === null) {
      result.params.existingPosition = parseInt(DEFAULT_PARAMS.existingPosition);
    } else {
      const pos = parseInt(params.existingPosition);
      if (isNaN(pos) || pos <= 0) {
        result.errors.push("持仓数量必须大于0");
        result.params.existingPosition = parseInt(DEFAULT_PARAMS.existingPosition);
      }
    }

    // 持仓成本
    if (params.existingCost === undefined || params.existingCost === null) {
      result.params.existingCost = parseFloat(DEFAULT_PARAMS.existingCost);
    } else {
      const cost = parseFloat(params.existingCost);
      if (isNaN(cost) || cost <= 0) {
        result.errors.push("持仓成本必须大于0");
        result.params.existingCost = parseFloat(DEFAULT_PARAMS.existingCost);
      }
    }

    // 新投入资金
    if (params.newCapital === undefined || params.newCapital === null) {
      result.params.newCapital = parseFloat(DEFAULT_PARAMS.newCapital);
    } else {
      const newCap = parseFloat(params.newCapital);
      if (isNaN(newCap) || newCap < 1000 || newCap > 1000000) {
        result.errors.push("新投入资金应在1千-100万之间");
        result.params.newCapital = parseFloat(DEFAULT_PARAMS.newCapital);
      }
    }

    // 目标回本天数
    if (params.targetRecoveryDays === undefined || params.targetRecoveryDays === null) {
      result.params.targetRecoveryDays = parseInt(DEFAULT_PARAMS.targetRecoveryDays || 60);
    } else {
      const recoveryDays = parseInt(params.targetRecoveryDays);
      if (isNaN(recoveryDays) || recoveryDays <= 0 || recoveryDays > 730) {
        result.errors.push("目标回本天数应在1-730天之间");
        result.params.targetRecoveryDays = parseInt(DEFAULT_PARAMS.targetRecoveryDays || 60);
      }
    }
  }

  // 验证并补全网格类型参数
  if (!params.gridType) {
    result.params.gridType =
      REVERSE_PARAM_MAPPINGS.gridType[DEFAULT_PARAMS.grid];
  } else if (!["等比", "等差"].includes(params.gridType)) {
    result.errors.push("网格类型参数无效");
    result.params.gridType =
      REVERSE_PARAM_MAPPINGS.gridType[DEFAULT_PARAMS.grid];
  }

  // 验证并补全频率偏好参数
  if (!params.riskPreference) {
    result.params.riskPreference =
      REVERSE_PARAM_MAPPINGS.riskPreference[DEFAULT_PARAMS.risk];
  } else if (!["低频", "均衡", "高频"].includes(params.riskPreference)) {
    result.errors.push("频率偏好参数无效");
    result.params.riskPreference =
      REVERSE_PARAM_MAPPINGS.riskPreference[DEFAULT_PARAMS.risk];
  }

  // 验证并补全调节系数参数
  if (params.adjustmentCoefficient === undefined || params.adjustmentCoefficient === null) {
    result.params.adjustmentCoefficient = parseFloat(DEFAULT_PARAMS.adjustment);
  } else {
    const adjustment = parseFloat(params.adjustmentCoefficient);
    if (isNaN(adjustment) || adjustment < 0.0 || adjustment > 2.0) {
      result.errors.push("调节系数应在0.0-2.0之间");
      result.params.adjustmentCoefficient = parseFloat(DEFAULT_PARAMS.adjustment);
    }
  }

  return result;
};

/**
 * 生成分析页面URL
 * @param {string} etfCode - ETF代码
 * @param {Object} params - 分析参数
 * @returns {string} 完整的分析页面URL
 */
export const generateAnalysisURL = (etfCode, params) => {
  const searchParams = encodeAnalysisParams(params);
  const baseUrl = `${window.location.origin}/analysis/${etfCode}`;
  return `${baseUrl}?${searchParams.toString()}`;
};

/**
 * 解析当前URL获取分析参数
 * @param {string} pathname - 路径名
 * @param {string} search - 查询字符串
 * @returns {Object} 解析结果
 */
export const parseAnalysisURL = (pathname, search) => {
  const result = {
    etfCode: null,
    params: {},
    isValid: false,
  };

  // 解析ETF代码
  const pathMatch = pathname.match(/^\/analysis\/([a-zA-Z0-9]{2,6})$/);
  if (pathMatch) {
    result.etfCode = pathMatch[1];
  }

  // 解析查询参数
  const searchParams = new URLSearchParams(search);
  result.params = decodeAnalysisParams(searchParams);

  // 验证ETF代码
  if (validateETFCode(result.etfCode)) {
    result.isValid = true;
  }

  return result;
};
