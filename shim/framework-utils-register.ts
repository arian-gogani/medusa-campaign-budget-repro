// Shim for "@medusajs/framework/utils" as promotion-module.ts imports it.
//
// Everything that `registerUsage` actually executes is re-exported from the
// real medusa source files in the clone, including the four real decorators
// that wrap the method. Only two exports are stand-ins, and neither is on the
// code path under test:
//
//   MedusaService    - the real factory builds CRUD methods from mikro-orm
//                      entity metadata. registerUsage calls none of them; it
//                      goes through this.promotionService_,
//                      this.campaignBudgetService_,
//                      this.campaignBudgetUsageService_ and
//                      this.listActivePromotions_. The stand-in base class also
//                      carries a no-op `emitEvents_` so the real @EmitEvents()
//                      decorator finds one, which is what the real
//                      MedusaService supplies.
//   toMikroORMEntity - called once in promotion-module.ts, at line 1629 inside
//                      updateApplicationMethods_, which registerUsage never
//                      reaches.

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
export { arrayDifference } from "../../hunt/medusa/packages/core/utils/src/common/array-difference"
export { deduplicate } from "../../hunt/medusa/packages/core/utils/src/common/deduplicate"
export { transformPropertiesToBigNumber } from "../../hunt/medusa/packages/core/utils/src/totals/transform-properties-to-bignumber"

import { MedusaContext as MedusaContextDecorator } from "../../hunt/medusa/packages/core/utils/src/modules-sdk/decorators/context-parameter"

// The real decorator stack, unmodified, from the files that define it.
export { EmitEvents } from "../../hunt/medusa/packages/core/utils/src/modules-sdk/decorators/emit-events"
export { InjectManager } from "../../hunt/medusa/packages/core/utils/src/modules-sdk/decorators/inject-manager"
export { InjectTransactionManager } from "../../hunt/medusa/packages/core/utils/src/modules-sdk/decorators/inject-transaction-manager"
export {
  MedusaContext,
  MedusaContextType,
} from "../../hunt/medusa/packages/core/utils/src/modules-sdk/decorators/context-parameter"

export const toMikroORMEntity = (x: any) => x

export function MedusaService(_models: Record<string, unknown>): any {
  class MedusaServiceStandIn {
    async emitEvents_(_messages: unknown) {}
    async seedContextIndex_(_a?: unknown, _b?: unknown, _ctx?: unknown) {}
  }
  // The real factory seeds MedusaContextIndex_ on the generated prototype the
  // same way, at packages/core/utils/src/modules-sdk/medusa-service.ts:158:
  //   MedusaContext()(klassPrototype, methodName, contextIndex)
  // PromotionModuleService.prototype inherits it, which is what lets
  // @InjectManager() on `listActivePromotions` (which declares no
  // @MedusaContext parameter of its own) pass its own guard.
  MedusaContextDecorator()(
    MedusaServiceStandIn.prototype as any,
    "seedContextIndex_",
    2
  )
  return MedusaServiceStandIn
}
export { flattenObjectToKeyValuePairs } from "../../hunt/medusa/packages/core/utils/src/common/flatten-object-to-key-value-pairs"
