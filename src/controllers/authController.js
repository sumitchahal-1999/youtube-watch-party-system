import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function createToken(user) {
  const expiresIn = process.env.JWT_EXPIRES_IN || "24h";
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn,
  });

  return { token, tokenType: "Bearer", expiresIn };
}

const signup = asyncHandler(async (request, response) => {
  const { name, email, password } = request.body || {};

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    !name.trim() ||
    !email.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    password.length < 8
  ) {
    return response.status(400).json({
      error:
        "Name, a valid email, and a password of at least 8 characters are required.",
    });
  }

  const user = new User({ name: name.trim(), email: email.trim(), password });
  await user.save();

  return response
    .status(201)
    .json({ user: publicUser(user), ...createToken(user) });
});

const signin = asyncHandler(async (request, response) => {
  const { email, password } = request.body || {};

  if (typeof email !== "string" || typeof password !== "string") {
    return response
      .status(400)
      .json({ error: "Email and password are required." });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    "+password",
  );
  if (!user || !(await user.comparePassword(password))) {
    return response.status(401).json({ error: "Invalid email or password." });
  }

  return response
    .status(200)
    .json({ user: publicUser(user), ...createToken(user) });
});

const signout = asyncHandler(async (request, response) => {
  return response.status(204).end();
});

const getCurrentUser = asyncHandler(async (request, response) => {
  const user = await User.findById(request.userId);

  if (!user) {
    return response.status(401).json({ error: "Authentication required." });
  }

  return response.status(200).json({ user: publicUser(user) });
});

export { signup, signin, signout, getCurrentUser };
