import express from "express";
import {
  signup,
  signin,
  signout,
  getCurrentUser,
} from "../controllers/authController.js";
import requireAuthentication from "../middleware/requireAuthentication.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.post("/signout", signout);
router.get("/me", requireAuthentication, getCurrentUser);

export default router;
