import { asyncHandler, requestOrganizationId, requestPagination, requestResourceId, requestUserId } from "../shared/module.helpers.js";
import resMessage from "../../utils/resMes.js";
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from "./product.service.js";
export const listProductsController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Products retrieved successfully", await listProducts(requestUserId(req), requestOrganizationId(req), requestPagination(req)))));
export const getProductController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Product retrieved successfully", await getProduct(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "productId")))));
export const createProductController = asyncHandler(async (req, res) => res.status(201).json(resMessage(true, "Product created successfully", await createProduct(requestUserId(req), requestOrganizationId(req), req.body))));
export const updateProductController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Product updated successfully", await updateProduct(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "productId"), req.body))));
export const deleteProductController = asyncHandler(async (req, res) => { await deleteProduct(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "productId")); res.status(200).json(resMessage(true, "Product deleted successfully")); });
