import { asyncHandler, requestOrganizationId, requestPagination, requestResourceId, requestUserId } from "../shared/module.helpers.js";
import resMessage from "../../utils/resMes.js";
import { createInvoice, deleteInvoice, getInvoice, listInvoices, updateInvoice } from "./invoice.service.js";
export const listInvoicesController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Invoices retrieved successfully", await listInvoices(requestUserId(req), requestOrganizationId(req), requestPagination(req)))));
export const getInvoiceController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Invoice retrieved successfully", await getInvoice(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "invoiceId")))));
export const createInvoiceController = asyncHandler(async (req, res) => res.status(201).json(resMessage(true, "Invoice created successfully", await createInvoice(requestUserId(req), requestOrganizationId(req), req.body))));
export const updateInvoiceController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Invoice updated successfully", await updateInvoice(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "invoiceId"), req.body))));
export const deleteInvoiceController = asyncHandler(async (req, res) => { await deleteInvoice(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "invoiceId")); res.status(200).json(resMessage(true, "Invoice deleted successfully")); });
