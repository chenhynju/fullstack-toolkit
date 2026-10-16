// 前后端共享类型（API 契约）：改这里，前后端同时编译报错，杜绝接口对不上
export interface User {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface Health {
  status: 'ok';
  uptime: number;
  timestamp: string;
}
