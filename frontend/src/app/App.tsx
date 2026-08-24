import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { liveRuntimeClient } from '../network/liveRuntime.js';
import { runtimeStore } from '../runtime/RuntimeStore.js';
import {
  HomePage,
  type AdaptiveSessionIntent,
  type SessionIntent,
} from '../ui/pages/HomePage.js';
import { LoadingPage } from '../ui/pages/LoadingPage.js';
import { PreviewPage } from '../ui/pages/PreviewPage.js';
import { SessionPage } from '../ui/pages/SessionPage.js';
import { SummaryPage } from '../ui/pages/SummaryPage.js';
import {
  recordingStore,
  sessionRecorder,
} from '../recording/recordingStore.js';
import {
  integrationHarness,
  longIntegrationHarness,
  spatialDiagnosticHarness,
} from '../integration/IntegrationHarness.js';
import { adaptiveIntegrationHarness } from '../integration/AdaptiveIntegrationHarness.js';
import { audioEngine } from '../audio/AudioEngine.js';
import {
  createStudyArtifactBundle,
  saveBundleToBackend,
} from '../study/StudyArtifacts.js';
import { studyArtifactStore } from '../study/studyArtifactStore.js';
import { liveSessionId } from '../network/liveRuntime.js';

type Page = 'home' | 'loading' | 'preview' | 'session' | 'summary';
export function App() {
  const finalizing = useRef(false);
  const audioCaptureError = useRef<string | null>(null);
  const [page, setPage] = useState<Page>('home');
  const [mode, setMode] = useState<
    'live' | 'adaptive' | 'demo' | 'long-demo' | 'diagnostic' | 'replay'
  >('live');
  const sessionStatus = useStore(
    runtimeStore,
    (state) => state.sessionRuntime.status,
  );
  // Live commands connect lazily. Home, demo, and replay modes do not require a backend.
  useEffect(
    () => () => {
      liveRuntimeClient.disconnect();
      adaptiveIntegrationHarness.end(false);
      integrationHarness.end(false);
      longIntegrationHarness.end(false);
      spatialDiagnosticHarness.end(false);
    },
    [],
  );
  useEffect(() => {
    if (page === 'loading' && sessionStatus === 'preview') setPage('preview');
    if (sessionStatus === 'running') setPage('session');
    if (
      sessionStatus === 'ended' &&
      sessionRecorder.active &&
      !finalizing.current
    ) {
      finalizing.current = true;
      void (async () => {
        let audio = null;
        try {
          audio = await audioEngine.stopRecording();
        } catch (error) {
          audioCaptureError.current =
            error instanceof Error ? error.message : String(error);
          console.error(
            'Master-audio finalization failed; study data will still be saved.',
            error,
          );
        }
        const recording = recordingStore.stop();
        if (recording?.metadata.participantId) {
          const bundle = createStudyArtifactBundle(
            recording,
            audio,
            audioCaptureError.current ? [audioCaptureError.current] : [],
          );
          studyArtifactStore.setBundle(bundle);
          setPage('summary');
          studyArtifactStore.setBackend({ status: 'saving' });
          try {
            const directory = await saveBundleToBackend(bundle);
            studyArtifactStore.setBackend({ status: 'saved', directory });
          } catch (error) {
            studyArtifactStore.setBackend({
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } else setPage('summary');
        finalizing.current = false;
      })();
    }
  }, [page, sessionStatus]);
  const start = (intent: SessionIntent) => {
    setMode('live');
    recordingStore.start({
      sessionId: liveSessionId,
      userPrompt: intent.worldDescription,
      eegMode: intent.eegSource,
      startedAtIso: new Date().toISOString(),
    });
    liveRuntimeClient.sendCommand({ command: 'startSession', ...intent });
    setPage('loading');
  };
  const startDemo = () => {
    liveRuntimeClient.disconnect();
    setMode('demo');
    recordingStore.start({
      sessionId: `demo-${Date.now()}`,
      userPrompt: 'Deterministic forest integration scenario',
      eegMode: 'recorded',
      startedAtIso: new Date().toISOString(),
    });
    integrationHarness.start();
    setPage('session');
  };
  const startAdaptive = async (intent: AdaptiveSessionIntent) => {
    if (intent.plannerMode === 'openai') {
      try {
        const response = await fetch('/api/llm/health');
        const health = (await response.json()) as { configured?: boolean };
        if (!response.ok || !health.configured) {
          window.alert(
            'OpenAI planner is not configured. Add OPENAI_API_KEY to the repository-root .env file and restart npm run dev, or choose Offline mock.',
          );
          return;
        }
      } catch {
        window.alert(
          'The local OpenAI planner service is unavailable. Restart npm run dev or choose Offline mock.',
        );
        return;
      }
    }
    liveRuntimeClient.disconnect();
    setMode('adaptive');
    studyArtifactStore.reset();
    audioCaptureError.current = null;
    const sessionId = `session-${new Date().toISOString().replaceAll(/\D/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
    recordingStore.start({
      sessionId,
      participantId: intent.participantId,
      runMode: intent.runMode,
      plannerMode: intent.plannerMode,
      userPrompt: `10-minute Module 01/02 adaptive replay · ${intent.plannerMode}`,
      eegMode: 'recorded',
      startedAtIso: new Date().toISOString(),
    });
    adaptiveIntegrationHarness.start({
      sessionId,
      runMode: intent.runMode,
      plannerMode: intent.plannerMode,
    });
    setPage('session');
    void audioEngine.startRecording().catch((error) => {
      audioCaptureError.current =
        error instanceof Error ? error.message : String(error);
      console.error('Audio capture unavailable; session will continue.', error);
    });
  };
  const startLongDemo = () => {
    liveRuntimeClient.disconnect();
    setMode('long-demo');
    recordingStore.start({
      sessionId: `long-demo-${Date.now()}`,
      userPrompt: 'Long forest perceptual validation scenario',
      eegMode: 'recorded',
      startedAtIso: new Date().toISOString(),
    });
    longIntegrationHarness.start();
    setPage('session');
  };
  const startSpatialDiagnostic = () => {
    liveRuntimeClient.disconnect();
    setMode('diagnostic');
    recordingStore.start({
      sessionId: `diagnostic-${Date.now()}`,
      userPrompt: 'Spatial event HRTF diagnostic scenario',
      eegMode: 'recorded',
      startedAtIso: new Date().toISOString(),
    });
    spatialDiagnosticHarness.start();
    setPage('session');
  };
  if (page === 'home')
    return (
      <HomePage
        onStart={start}
        onAdaptiveDemo={startAdaptive}
        onDemo={startDemo}
        onLongDemo={startLongDemo}
        onSpatialDiagnostic={startSpatialDiagnostic}
      />
    );
  if (page === 'loading') return <LoadingPage />;
  if (page === 'preview')
    return (
      <PreviewPage
        onEnter={() => {
          liveRuntimeClient.sendCommand({ command: 'resumeSession' });
          setPage('session');
        }}
      />
    );
  if (page === 'summary')
    return (
      <SummaryPage
        onReplay={() => {
          setMode('replay');
          setPage('session');
        }}
      />
    );
  return <SessionPage mode={mode} />;
}
