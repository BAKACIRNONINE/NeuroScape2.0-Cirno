import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { liveRuntimeClient } from '../network/liveRuntime.js';
import { runtimeStore } from '../runtime/RuntimeStore.js';
import { HomePage, type SessionIntent } from '../ui/pages/HomePage.js';
import { LoadingPage } from '../ui/pages/LoadingPage.js';
import { PreviewPage } from '../ui/pages/PreviewPage.js';
import { SessionPage } from '../ui/pages/SessionPage.js';
import { SummaryPage } from '../ui/pages/SummaryPage.js';
import { recordingStore, sessionRecorder } from '../recording/recordingStore.js';
import { integrationHarness, longIntegrationHarness, spatialDiagnosticHarness } from '../integration/IntegrationHarness.js';

type Page = 'home' | 'loading' | 'preview' | 'session' | 'summary';
export function App() {
  const [page, setPage] = useState<Page>('home'); const [mode, setMode] = useState<'live' | 'demo' | 'long-demo' | 'diagnostic' | 'replay'>('live'); const sessionStatus = useStore(runtimeStore, (state) => state.sessionRuntime.status);
  // Live commands connect lazily. Home, demo, and replay modes do not require a backend.
  useEffect(() => () => { liveRuntimeClient.disconnect(); integrationHarness.end(false); longIntegrationHarness.end(false); spatialDiagnosticHarness.end(false); }, []);
  useEffect(() => { if (page === 'loading' && sessionStatus === 'preview') setPage('preview'); if (sessionStatus === 'running') setPage('session'); if (sessionStatus === 'ended' && sessionRecorder.active) { recordingStore.stop(); setPage('summary'); } }, [page, sessionStatus]);
  const start = (intent: SessionIntent) => { setMode('live'); recordingStore.start(intent.worldDescription, intent.eegSource); liveRuntimeClient.sendCommand({ command: 'startSession', ...intent }); setPage('loading'); };
  const startDemo = () => { liveRuntimeClient.disconnect(); setMode('demo'); recordingStore.start('Deterministic forest integration scenario','recorded'); integrationHarness.start(); setPage('session'); };
  const startLongDemo = () => { liveRuntimeClient.disconnect(); setMode('long-demo'); recordingStore.start('Long forest perceptual validation scenario','recorded'); longIntegrationHarness.start(); setPage('session'); };
  const startSpatialDiagnostic = () => { liveRuntimeClient.disconnect(); setMode('diagnostic'); recordingStore.start('Spatial event HRTF diagnostic scenario','recorded'); spatialDiagnosticHarness.start(); setPage('session'); };
  if (page === 'home') return <HomePage onStart={start} onDemo={startDemo} onLongDemo={startLongDemo} onSpatialDiagnostic={startSpatialDiagnostic} />;
  if (page === 'loading') return <LoadingPage />;
  if (page === 'preview') return <PreviewPage onEnter={() => { liveRuntimeClient.sendCommand({ command: 'resumeSession' }); setPage('session'); }} />;
  if (page === 'summary') return <SummaryPage onReplay={() => { setMode('replay'); setPage('session'); }} />;
  return <SessionPage mode={mode} />;
}
