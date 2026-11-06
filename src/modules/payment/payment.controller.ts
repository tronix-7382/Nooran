import { asyncHandler, requestOrganizationId, requestPagination, requestResourceId, requestUserId } from "../shared/module.helpers.js";
import resMessage from "../../utils/resMes.js";
import { createPayment, listPayments, reversePayment } from "./payment.service.js";
export const listPaymentsController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Payments retrieved successfully", await listPayments(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "invoiceId"), requestPagination(req)))));
export const createPaymentController = asyncHandler(async (req, res) => res.status(201).json(resMessage(true, "Payment recorded successfully", await createPayment(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "invoiceId"), req.body))));
export const reversePaymentController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Payment reversed successfully", await reversePayment(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "paymentId"), req.body.reason))));
