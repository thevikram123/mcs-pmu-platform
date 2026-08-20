import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';

import Shell from './components/Shell';
import { useAuth } from './store/auth';
import Login from './pages/Login';
import Home from './pages/Home';
import Overview from './pages/Overview';
import Explorer from './pages/Explorer';
import Simulator from './pages/Simulator';
import Jcr from './pages/Jcr';
import Milestones from './pages/Milestones';
import Scenarios from './pages/Scenarios';

function Guard({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    // HashRouter: GitHub Pages has no rewrite rules, so path routing would 404
    // on any deep link or refresh.
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <Guard>
              <Shell />
            </Guard>
          }
        >
          <Route index element={<Home />} />
          <Route path="overview" element={<Overview />} />
          <Route path="explorer" element={<Explorer />} />
          <Route path="simulator" element={<Simulator />} />
          <Route path="milestones" element={<Milestones />} />
          <Route path="jcr" element={<Jcr />} />
          <Route path="scenarios" element={<Scenarios />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
