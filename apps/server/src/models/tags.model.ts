export interface TagWithCount {
  tagId: number;
  tagName: string;
  tagDescription: string;
  productCount: number;
}

export type TagListResponse = TagWithCount[];
