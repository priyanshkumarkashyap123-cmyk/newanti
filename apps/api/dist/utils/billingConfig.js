function resolveRazorpayPlanId(explicitPlanId, planType, env) {
  if (explicitPlanId) return explicitPlanId;
  const selected = planType === "yearly" ? env.proYearly : env.proMonthly;
  return selected && selected.trim().length > 0 ? selected : null;
}
export {
  resolveRazorpayPlanId
};
//# sourceMappingURL=billingConfig.js.map
