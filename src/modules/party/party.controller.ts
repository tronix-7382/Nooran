import { asyncHandler, requestOrganizationId, requestPagination, requestResourceId, requestUserId } from "../shared/module.helpers.js";
import resMessage from "../../utils/resMes.js";
import { createParty, deleteParty, getParty, listParties, updateParty } from "./party.service.js";
export const listPartiesController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Parties retrieved successfully", await listParties(requestUserId(req), requestOrganizationId(req), requestPagination(req)))));
export const getPartyController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Party retrieved successfully", await getParty(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "partyId")))));
export const createPartyController = asyncHandler(async (req, res) => res.status(201).json(resMessage(true, "Party created successfully", await createParty(requestUserId(req), requestOrganizationId(req), req.body))));
export const updatePartyController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Party updated successfully", await updateParty(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "partyId"), req.body))));
export const deletePartyController = asyncHandler(async (req, res) => { await deleteParty(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "partyId")); res.status(200).json(resMessage(true, "Party deleted successfully")); });
