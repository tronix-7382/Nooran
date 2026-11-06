import { asyncHandler, requestOrganizationId, requestPagination, requestResourceId, requestUserId } from "../shared/module.helpers.js";
import resMessage from "../../utils/resMes.js";
import { addMember, deactivateMember, listMembers, transferOwnership, updateMember } from "./member.service.js";
export const listMembersController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Organization members retrieved successfully", await listMembers(requestUserId(req), requestOrganizationId(req), requestPagination(req)))));
export const addMemberController = asyncHandler(async (req, res) => res.status(201).json(resMessage(true, "Organization member added successfully", await addMember(requestUserId(req), requestOrganizationId(req), req.body.email))));
export const updateMemberController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Organization member updated successfully", await updateMember(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "memberId"), req.body))));
export const deactivateMemberController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Organization member deactivated successfully", await deactivateMember(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "memberId")))));
export const transferOwnershipController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Organization ownership transferred successfully", await transferOwnership(requestUserId(req), requestOrganizationId(req), req.body.memberId))));
