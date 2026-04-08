export type ApiMeta = {
  pagination?: { page: number; pageSize: number; total: number };
  requestId?: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
  meta: ApiMeta;
};

export type Tokens = { accessToken: string; refreshToken: string };

export type AdminUser = { id: string; email: string; role: string; permissions: string[] };

export type ChallengeResponse = {
  twoFaRequired: boolean;
  challengeToken: string;
  challengeExpiresAt: string;
  devCode?: string;
};

export type NavItem = { key: string; label: string };
