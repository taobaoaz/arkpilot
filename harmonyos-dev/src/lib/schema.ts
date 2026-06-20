// src/lib/schema.ts
import { z } from "zod";

export const serialSchema = z
  .string()
  .min(1)
  .describe("目标设备序列号(如 127.0.0.1:5555 或真机 SN)");
export const timeoutSchema = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("超时毫秒数");
export const overwriteSchema = z
  .boolean()
  .default(false)
  .describe("是否覆盖已存在文件");
export const rootSchema = z
  .string()
  .optional()
  .describe("工程根目录,默认自动发现");
