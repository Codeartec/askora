import { Navigate, useParams } from 'react-router-dom';

/** Redirects `/j/:code` → `/join?code=` for shorter QR payloads. */
export function JoinShortRedirect() {
  const { code } = useParams<{ code: string }>();
  const c = (code ?? '').trim();
  if (!c) return <Navigate to="/join" replace />;
  return <Navigate to={`/join?code=${encodeURIComponent(c.toUpperCase())}`} replace />;
}
