function errorHandler(error, _request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  if (error.name === "ValidationError") {
    return response.status(400).json({ error: error.message });
  }

  if (error.code === 11000) {
    return response
      .status(409)
      .json({ error: "An account with this email already exists." });
  }

  if (error.name === "CastError") {
    return response.status(400).json({ error: "Invalid value." });
  }

  if (error.type === "entity.parse.failed") {
    return response.status(400).json({ error: "Invalid JSON request body." });
  }

  console.error(error);
  return response.status(500).json({ error: "Internal server error." });
}

export default errorHandler;
