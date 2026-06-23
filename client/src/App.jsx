import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Sidebar } from './components/Sidebar.jsx';
import { Icon } from './components/icons.jsx';
import { ToastProvider } from './components/ui.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { ScanPage } from './pages/Scan.jsx';
import { ProtectPage } from './pages/Protect.jsx';
import { KeysPage } from './pages/Keys.jsx';
import { RoadmapPage } from './pages/Roadmap.jsx';

const TITLES = {
  dashboard: ['Dashboard', 'Overview & security posture'],
  scan: ['Scan', 'Find quantum-vulnerable & weak cryptography'],
  protect: ['Protect', 'Quantum-resistant file packaging'],
  keys: ['Key Upgrade', 'Generate post-quantum-ready keys'],
  roadmap: ['Migration Roadmap', 'Phased remediation plan'],
};

export default function App() {
  const [route, setRoute] = useState('dashboard');
  const [scan, setScan] = useState(null); // shared scan result
  const [online, setOnline] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('qs-theme') || 'dark');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('qs-collapsed') === '1');

  // Apply + persist theme on <html>.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qs-theme', theme);
  }, [theme]);

  useEffect(() => { localStorage.setItem('qs-collapsed', collapsed ? '1' : '0'); }, [collapsed]);

  useEffect(() => {
    let alive = true;
    const ping = () => api.health().then(() => alive && setOnline(true)).catch(() => alive && setOnline(false));
    ping();
    const id = setInterval(ping, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const goTo = (r) => { setRoute(r); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const [title, crumb] = TITLES[route];

  return (
    <ToastProvider>
      <div className={`app ${collapsed ? 'collapsed' : ''}`}>
        <Sidebar
          route={route}
          setRoute={goTo}
          online={online}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
        <div className="main">
          <header className="topbar">
            <div>
              <h1>{title}</h1>
              <div className="crumb">QuantumShield · {crumb}</div>
            </div>
            <div className="topbar-actions">
              <div className={`status-pill ${online === false ? 'offline' : ''}`}>
                <span className="live" />
                {online === null ? 'Connecting…' : online ? 'Backend online' : 'Backend offline — start the server'}
              </div>
              <button
                className="icon-btn"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                aria-label="Toggle theme"
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
              </button>
            </div>
          </header>
          <main className="content">
            {route === 'dashboard' && <Dashboard result={scan} goTo={goTo} />}
            {route === 'scan' && <ScanPage result={scan} onResult={setScan} goTo={goTo} />}
            {route === 'protect' && <ProtectPage />}
            {route === 'keys' && <KeysPage />}
            {route === 'roadmap' && <RoadmapPage result={scan} goTo={goTo} />}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
