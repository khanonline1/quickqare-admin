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

// `permission`, when set, hides the nav item unless the signed-in admin's
// permissions include it. The backend is the real gate; this just avoids
// showing a control the API will reject.
export type NavItem = { key: string; label: string; permission?: string };
