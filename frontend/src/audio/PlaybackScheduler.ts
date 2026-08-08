export interface PlaybackTarget {
  input: AudioNode;
  source: AudioBufferSourceNode | null;
  playing: boolean;
  activationPlayed: boolean;
  onPlaybackEnded?: () => void;
}

export class PlaybackScheduler {
  constructor(readonly context: BaseAudioContext) {}
  start(target: PlaybackTarget, buffer: AudioBuffer, loop: boolean, when: number): boolean {
    if (target.playing || (!loop && target.activationPlayed)) return false;
    const source = this.context.createBufferSource();
    source.buffer = buffer; source.loop = loop; source.connect(target.input);
    target.source = source; target.playing = true; target.activationPlayed = true;
    source.onended = () => { if (target.source === source) { target.source = null; target.playing = false; target.onPlaybackEnded?.(); } source.disconnect(); };
    source.start(Math.max(when, this.context.currentTime));
    return true;
  }
  stop(target: PlaybackTarget, when: number): void {
    const source = target.source; target.source = null; target.playing = false;
    if (!source) return;
    source.onended = null;
    try { source.stop(Math.max(when, this.context.currentTime)); } catch { /* already ended */ }
    source.disconnect();
  }
  resetActivation(target: PlaybackTarget): void { target.activationPlayed = false; }
  dispose(targets: Iterable<PlaybackTarget>): void { for (const target of targets) this.stop(target, this.context.currentTime); }
}
