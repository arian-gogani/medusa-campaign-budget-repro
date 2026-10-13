// Shim for the "@medusajs/framework/utils" subpath used by the promotion module.
// Every export is re-exported from the real medusa source files in the clone.
const M = "unused"
export {
  ApplicationMethodAllocation,
  ApplicationMethodTargetType,
  ApplicationMethodType,
  CampaignBudgetType,
  ComputedActions,
  PromotionRuleOperator,
  PromotionStatus,
  PromotionType,
} from "../../hunt/medusa/packages/core/utils/src/promotion/index"
export { MathBN } from "../../hunt/medusa/packages/core/utils/src/totals/math"
export {
  BigNumber,
  MEDUSA_EPSILON,
} from "../../hunt/medusa/packages/core/utils/src/totals/big-number"
export {
  calculateAdjustmentAmountFromPromotion,
  getPromotionValue,
  getApplicableQuantity,
} from "../../hunt/medusa/packages/core/utils/src/totals/promotion/index"
export { calculateAdjustmentTotal } from "../../hunt/medusa/packages/core/utils/src/totals/adjustment/index"
export { MedusaError } from "../../hunt/medusa/packages/core/utils/src/common/errors"
export { isPresent } from "../../hunt/medusa/packages/core/utils/src/common/is-present"
export { isString } from "../../hunt/medusa/packages/core/utils/src/common/is-string"
export { isDefined } from "../../hunt/medusa/packages/core/utils/src/common/is-defined"
export { pickValueFromObject } from "../../hunt/medusa/packages/core/utils/src/common/pick-value-from-object"
