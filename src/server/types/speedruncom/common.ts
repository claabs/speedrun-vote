export interface SingleResponse<T> {
  data: T;
}

export interface PagedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface Pagination {
  offset: number;
  max: number;
  size: number;
  links: Link[];
}

export interface Link {
  rel: string;
  uri: string;
}
