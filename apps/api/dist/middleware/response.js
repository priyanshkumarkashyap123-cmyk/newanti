function attachResponseHelpers(req, res, next) {
  const requestId = res.locals["requestId"] ?? req.get("x-request-id") ?? "unknown";
  res.ok = function(data, status = 200) {
    const envelope = {
      success: true,
      data,
      requestId,
      ts: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.status(status).json(envelope);
  };
  res.fail = function(code, message, status = 500) {
    const envelope = {
      success: false,
      error: { code, message },
      requestId,
      ts: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.status(status).json(envelope);
  };
  next();
}
export {
  attachResponseHelpers
};
//# sourceMappingURL=response.js.map
