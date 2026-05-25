export interface Post {
  id: number;
  title: string;
  body: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  post_id: number;
  author: string;
  body: string;
  created_at: string;
}

export interface CreatePostBody {
  title: string;
  body: string;
  author: string;
}

export interface UpdatePostBody {
  title?: string;
  body?: string;
  author?: string;
}

export interface CreateCommentBody {
  post_id: number;
  author: string;
  body: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
