import { asyncHandler, requestOrganizationId, requestResourceId, requestUserId } from "../shared/module.helpers.js";
import resMessage from "../../utils/resMes.js";
import { getAccountLedger, getJournalEntry, listAccounts, listJournalEntries } from "./ledger.service.js";
export const listAccountsController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Accounts retrieved successfully", await listAccounts(requestUserId(req), requestOrganizationId(req)))));
export const listJournalEntriesController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Journal entries retrieved successfully", await listJournalEntries(requestUserId(req), requestOrganizationId(req)))));
export const getJournalEntryController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Journal entry retrieved successfully", await getJournalEntry(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "entryId")))));
export const getAccountLedgerController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Account ledger retrieved successfully", await getAccountLedger(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "accountId")))));
