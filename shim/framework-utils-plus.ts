// framework-utils.ts plus ProductStatus. The Admin API validator barrel that
// campaigns/validators.ts imports from reaches common-validators/products,
// which needs ProductStatus. Used only by build-validator.cjs. Every export is
// still re-exported from the real medusa source files in the clone.
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

export { ProductStatus } from "../../hunt/medusa/packages/core/utils/src/product/enums"
