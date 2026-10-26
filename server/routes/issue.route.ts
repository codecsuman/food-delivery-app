import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import {
  createIssue,
  getMyIssues,
  getRestaurantIssues,
  updateIssueStatus,
} from "../controller/issue.controller.js";
import { validate } from "../middlewares/validate.js";
import {
  createIssueSchema,
  updateIssueStatusSchema,
  issueIdParamSchema,
  issueListQuerySchema,
  restaurantIdParamSchema,
} from "../schemas/validation.js";

const router = express.Router();

// Report a problem with one of my orders (customer)
router.post("/", isAuthenticated, validate(createIssueSchema), createIssue);

// My reported issues (customer)
router.get(
  "/my",
  isAuthenticated,
  validate(issueListQuerySchema, "query"),
  getMyIssues,
);

// Issues for one of my restaurants (owner; ownership checked in controller)
router.get(
  "/restaurant/:restaurantId",
  isAuthenticated,
  validate(restaurantIdParamSchema, "params"),
  validate(issueListQuerySchema, "query"),
  getRestaurantIssues,
);

// Move an issue through review (owner/admin; ownership checked in controller)
router.patch(
  "/:issueId/status",
  isAuthenticated,
  validate(updateIssueStatusSchema),
  validate(issueIdParamSchema, "params"),
  updateIssueStatus,
);

export default router;
