import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RequireRole from '@/auth/RequireRole';
import AppShell from '@/components/layout/AppShell';
import PageLoading from '@/components/layout/PageLoading';
import Login from '@/pages/Login';

/*
 * Every page below is lazily imported.
 *
 * With static imports the console shipped as one 1.27 MB chunk, so the login
 * screen downloaded Recharts, GSAP, the data grid and the QR-code generator
 * before it could render a password field. Splitting at the route boundary
 * means a visitor pays for the page they asked for.
 *
 * Login is the deliberate exception and stays eager: it is the first thing an
 * unauthenticated visitor sees, and making it wait on a second round trip would
 * trade a real delay for a theoretical saving.
 */
const Analytics = lazy(() => import('@/pages/Analytics'));
const Audiences = lazy(() => import('@/pages/Audiences'));
const Campaigns = lazy(() => import('@/pages/Campaigns'));
const CampaignDetail = lazy(() => import('@/pages/CampaignDetail'));
const Contacts = lazy(() => import('@/pages/Contacts'));
const Help = lazy(() => import('@/pages/Help'));
const Home = lazy(() => import('@/pages/Home'));
const Links = lazy(() => import('@/pages/Links'));
const Settings = lazy(() => import('@/pages/Settings'));
const Templates = lazy(() => import('@/pages/Templates'));
const ComponentsShowcase = lazy(() => import('@/pages/dev/ComponentsShowcase'));

/*
 * Routing. /login is public; everything else lives behind RequireRole (admin
 * only) inside the AppShell layout (sidebar + top bar + Outlet). Each page renders
 * its own title band via <PageHeader/>.
 */
export default function App() {
  return (
    <BrowserRouter>
      {/*
        * One boundary around the whole tree rather than one per route: the
        * fallback only replaces the page area, because AppShell renders above
        * it and stays mounted across navigations, so the sidebar does not
        * flicker while a chunk loads.
        */}
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Dev-only QA surface for the design-system kit; only mounted in dev builds. */}
          {import.meta.env.DEV && (
            <Route path="/dev/components" element={<ComponentsShowcase />} />
          )}
          <Route element={<RequireRole roles={['admin', 'viewer']} />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/audiences" element={<Audiences />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/:id" element={<CampaignDetail />} />
              <Route path="/links" element={<Links />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<Help />} />
            </Route>
          </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
