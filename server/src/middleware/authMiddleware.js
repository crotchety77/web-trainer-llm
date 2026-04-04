import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function authMiddleware(request, response, next) {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return response.status(401).json({ message: "Authorization token is required" });
  }

  const token = header.slice(7);

  try {
    request.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return response.status(401).json({ message: "Invalid or expired token" });
  }
}

export function optionalAuthMiddleware(request, response, next) {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    request.user = null;
    return next();
  }

  const token = header.slice(7);

  try {
    request.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    request.user = null;
    return next();
  }
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user) {
      return response.status(401).json({ message: "Authorization token is required" });
    }

    if (!roles.includes(request.user.role)) {
      return response.status(403).json({ message: "You do not have access to this action" });
    }

    return next();
  };
}
