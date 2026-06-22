// src/providers/appstore.types.ts

/** 单个应用的元数据。`url` 是唯一必有的定位字段。 */
export interface AppInfo {
  name: string;
  pkg?: string;
  appId?: string;
  dev?: string;
  category?: string;
  icon?: string;
  url: string;
}

/** AppGallery 分类。`id` 用于 list_by_category。 */
export interface Category {
  id: string;
  name: string;
}

/** 数据来源标记,如实反映抓取质量。 */
export interface SourceMeta {
  source: "online" | "cache" | "partial";
  note?: string;
  fetchedAt: string;
}

/** appstore_search 输入 */
export interface SearchInput {
  query: string;
  limit?: number;
  exact?: boolean;
}

/** appstore_search 输出 */
export interface SearchResult extends SourceMeta {
  ok: boolean;
  apps: AppInfo[];
}

/** appstore_categories 输出 */
export interface CategoriesResult extends SourceMeta {
  ok: boolean;
  categories: Category[];
}

/** appstore_list_by_category 输入 */
export interface ListByCategoryInput {
  category: string;
  page?: number;
  pageSize?: number;
}

/** appstore_list_by_category 输出 */
export interface ListResult extends SourceMeta {
  ok: boolean;
  apps: AppInfo[];
  page: number;
  pageSize: number;
  totalPages?: number;
}

/** appstore_detail 输入 */
export interface DetailInput {
  appId?: string;
  url?: string;
}

/** appstore_detail 输出 */
export interface DetailResult extends SourceMeta {
  ok: boolean;
  app: AppInfo | null;
}

/** appstore_check 输出 */
export interface CheckResult {
  ok: boolean;
  http: boolean;
  browser_fallback: boolean;
  note?: string;
}
