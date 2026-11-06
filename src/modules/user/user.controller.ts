import resMessage from "../../utils/resMes.js";
import { AppError } from "../../utils/appError.js";
import { asyncHandler, requestPagination, requestResourceId, requestUserId } from "../shared/module.helpers.js";
import { deleteUser, getUser, listUsers, updateUser } from "./user.service.js";

export const listUsersController = asyncHandler(async (_req, res) => {
  res.status(200).json(resMessage(true, "Users retrieved successfully", await listUsers(requestPagination(_req))));
});

export const getUserController = asyncHandler(async (req, res) => {
  res.status(200).json(resMessage(true, "User retrieved successfully", await getUser(requestResourceId(req, "userId"))));
});

export const updateUserController = asyncHandler(async (req, res) => {
  res.status(200).json(resMessage(true, "User updated successfully", await updateUser(requestResourceId(req, "userId"), req.body)));
});

export const deleteUserController = asyncHandler(async (req, res) => {
  const userId = requestResourceId(req, "userId");
  if (requestUserId(req) === userId) throw new AppError("You cannot delete your own account", 400);
  await deleteUser(userId);
  res.status(200).json(resMessage(true, "User deleted successfully"));
});

export const getOwnUserController = asyncHandler(async (req, res) => {
  res.status(200).json(resMessage(true, "User retrieved successfully", await getUser(requestUserId(req))));
});

export const updateOwnUserController = asyncHandler(async (req, res) => {
  res.status(200).json(resMessage(true, "User updated successfully", await updateUser(requestUserId(req), req.body)));
});
