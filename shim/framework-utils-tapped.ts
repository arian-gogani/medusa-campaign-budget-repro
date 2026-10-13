// INSTRUMENTED shim for "@medusajs/framework/utils".
// Identical to framework-utils-real.ts except that MathBN is wrapped in a tap
// that records the arguments every call receives and then delegates to the
// real MathBN from the clone. No arithmetic is reimplemented here.
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

import { MathBN as RealMathBN } from "../../hunt/medusa/packages/core/utils/src/totals/math"

export type TapEntry = { op: string; args: string[]; result: string }
export const TAP: { on: boolean; log: TapEntry[] } = { on: false, log: [] }

const show = (v: any): string => {
  if (v === null) return "null"
  if (v === undefined) return "undefined"
  if (typeof v === "object" && typeof v.toString === "function") {
    return v.toString()
  }
  return String(v)
}

const wrap = (op: string, fn: Function) =>
  function (this: any, ...args: any[]) {
    const result = fn.apply(RealMathBN, args)
    if (TAP.on) {
      TAP.log.push({
        op,
        args: args.map(show),
        result: show(result),
      })
    }
    return result
  }

const tapped: any = {}
const SKIP = new Set(["prototype", "name", "length"])
for (const key of Object.getOwnPropertyNames(RealMathBN)) {
  if (SKIP.has(key)) continue
  const v = (RealMathBN as any)[key]
  tapped[key] = typeof v === "function" ? wrap(key, v) : v
}

export const MathBN = tapped as typeof RealMathBN
