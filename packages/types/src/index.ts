export interface User {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  role: 'USER' | 'ADMIN';
}
export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'DONE';
export interface Project {
  id: string;
  organizationId: string;
  ownerId: number;
  title: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}
export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}
export interface OrganizationMembership {
  organizationId: string;
  userId: number;
  role: OrganizationRole;
  organization: Organization;
}
export interface Member {
  organizationId: string;
  userId: number;
  role: OrganizationRole;
  user: Pick<User, 'id' | 'name' | 'email'>;
}
export interface TaskComment {
  id: string;
  body: string;
  authorId: number;
  createdAt: string;
  author: { id: number; name: string | null };
}
export interface Task {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  status: 'TODO' | 'ACTIVE' | 'DONE';
  assigneeId: number | null;
  dueAt: string | null;
  comments: TaskComment[];
}
export interface Invitation {
  id: string;
  email: string;
  role: Exclude<OrganizationRole, 'OWNER'>;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}
export interface AuditRecord {
  id: string;
  actorId: number;
  action: string;
  objectId: string;
  requestId: string;
  details: Record<string, unknown>;
  createdAt: string;
}
export interface ApiResponse<T> {
  data: T;
}
export interface ApiError {
  error: { code: string; message: string; requestId: string };
}
export interface Health {
  status: 'ok';
  uptime: number;
  timestamp: string;
}
