import jwt from "jsonwebtoken";

function requireAuthentication(request, response, next) {
  const authorization = request.get("authorization");
  const match = authorization && authorization.match(/^Bearer\s+([^\s]+)$/i);

  if (!match) {
    return response.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (typeof payload !== "object" || typeof payload.sub !== "string") {
      return response.status(401).json({ error: "Authentication required." });
    }

    request.userId = payload.sub;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return response.status(401).json({ error: "Authentication required." });
    }

    return next(error);
  }
}

export default requireAuthentication;
