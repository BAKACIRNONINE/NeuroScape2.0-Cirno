import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SummaryPage } from '../src/ui/pages/SummaryPage.js';
import { recordedSession } from './recordingFixtures.js';
describe('SummaryPage', () => {
  it('renders real recording metrics, timelines, reflection, print, export, and replay actions', () => { const html = renderToStaticMarkup(<SummaryPage recording={recordedSession()} />); expect(html).toContain('76%'); expect(html).toContain('Arousal'); expect(html).not.toContain('Relaxation'); expect(html).toContain('Actual recorded listener path'); expect(html).toContain('ambient.wind'); expect(html).toContain('Move gradually toward running water.'); expect(html).toContain('Export Recording'); expect(html).toContain('Print'); expect(html).toContain('Replay Session'); expect(html).not.toContain('caused'); });
  it('shows missing recording data neutrally', () => { expect(renderToStaticMarkup(<SummaryPage recording={null} />)).toContain('No accepted session recording is available.'); });
});
