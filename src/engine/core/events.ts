/**
 * Typed gameplay event bus. Systems publish facts ("pickup collected", "cat slipped"),
 * the episode runtime and audio/UI layers subscribe. Keeps systems decoupled.
 */
import type { Vec3Tuple } from './math';

export type GameEvent =
  | { type: 'pickup'; agentId: string; pickupId: string; itemType: string }
  | { type: 'caught'; catcherId: string; targetId: string; position: Vec3Tuple }
  | { type: 'slipped'; agentId: string; position: Vec3Tuple }
  | { type: 'trapped'; agentId: string; trapKind: string; position: Vec3Tuple }
  | { type: 'pummeled'; agentId: string; byId: string; position: Vec3Tuple }
  | { type: 'trapPlaced'; agentId: string; trapKind: string; position: Vec3Tuple }
  | { type: 'noise'; position: Vec3Tuple; radius: number; sourceId?: string; kind: string }
  | { type: 'hide'; agentId: string; spotId: string }
  | { type: 'unhide'; agentId: string; spotId: string; flushed: boolean }
  | { type: 'searched'; agentId: string; spotId: string; found: boolean }
  | { type: 'door'; doorId: string; open: boolean; agentId?: string }
  | { type: 'knocked'; agentId: string; objectId: string; position: Vec3Tuple }
  | { type: 'enterRoom'; agentId: string; roomId: string }
  | { type: 'enterZone'; agentId: string; zoneId: string }
  | { type: 'spotted'; agentId: string; targetId: string }
  | { type: 'lostSight'; agentId: string; targetId: string }
  | { type: 'npcState'; agentId: string; state: string }
  | { type: 'jump'; agentId: string }
  | { type: 'land'; agentId: string; impact: number }
  | { type: 'taunt'; agentId: string; position: Vec3Tuple }
  | { type: 'pounce'; agentId: string }
  | { type: 'broken'; agentId: string; objectId: string; position: Vec3Tuple }
  | { type: 'bonked'; agentId: string; byObject: string; position: Vec3Tuple }
  | { type: 'splat'; agentId: string; cause: 'door' | 'wall' | 'fall'; position: Vec3Tuple }
  | { type: 'slam'; agentId: string; doorId: string }
  | { type: 'nearMiss'; agentId: string; hunterId: string; position: Vec3Tuple }
  | { type: 'stage'; index: number; id: string; title: string };

export type GameEventType = GameEvent['type'];
type Handler<T extends GameEventType> = (e: Extract<GameEvent, { type: T }>) => void;

export class EventBus {
  private handlers = new Map<string, Set<(e: GameEvent) => void>>();
  private any = new Set<(e: GameEvent) => void>();

  on<T extends GameEventType>(type: T, handler: Handler<T>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(handler as (e: GameEvent) => void);
    return () => set!.delete(handler as (e: GameEvent) => void);
  }
  onAny(handler: (e: GameEvent) => void) {
    this.any.add(handler);
    return () => this.any.delete(handler);
  }
  emit(e: GameEvent) {
    this.handlers.get(e.type)?.forEach((h) => h(e));
    this.any.forEach((h) => h(e));
  }
  clear() {
    this.handlers.clear();
    this.any.clear();
  }
}
