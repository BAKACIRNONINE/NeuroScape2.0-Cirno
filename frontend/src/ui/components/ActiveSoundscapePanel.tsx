import { useStore } from 'zustand';
import { runtimeStore } from '../../runtime/RuntimeStore.js';

export function ActiveSoundscapePanel() {
  const world = useStore(runtimeStore, (state) => state.runtimeWorldState);
  const groups = [{ name: 'Ambient', values: world?.ambient ?? [] }, { name: 'Action', values: world?.action ?? [] }, { name: 'Event', values: world?.event ?? [] }];
  return <section className="glass-panel data-panel"><h2>Active Soundscape</h2>{groups.map((group) => <div className="sound-group" key={group.name}><h3>{group.name}</h3><div className="sound-pills">{group.values.length ? group.values.map((sound) => <span className={sound.active ? 'sound-pill sound-pill--active' : 'sound-pill'} key={sound.id} title={sound.assetId}>{sound.assetId}<small>{'lifecycle' in sound ? sound.lifecycle : sound.active ? 'active' : 'inactive'}</small></span>) : <span className="empty-state">Unavailable</span>}</div></div>)}</section>;
}
