import { json, requireAccess, type AdminEnv } from '../../_shared/admin';

// Covered by the same Access application as /admin and /admin/*.
// No D1/R2 access, identity details or JWT are returned to the public client.
export const onRequestGet: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = await requireAccess(request, env);
  if (!access.ok) return json({ authenticated: false }, access.response.status);
  return json({ authenticated: true, expiresAt: access.expiresAt });
};
