/**
 * GameSession: boots an episode into a running match. Creates agents from the episode cast, builds
 * navigation grids, AI brains and the mission runtime, then runs the per-frame simulation pipeline:
 *   input -> player intent -> AI brains -> abilities -> movement -> (physics) -> rules -> mission.
 * Nothing in here is episode-specific: everything comes from the EpisodeDefinition.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Physics, useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import type { EpisodeDefinition, EpisodeAction, MetricName } from '../episode/types';
import { getEnvironment } from '../episode/registry';
import { EpisodeRuntime } from '../episode/runtime';
import { world, type AgentState } from '../core/world';
import { useGame } from '../core/store';
import { GRAVITY } from '../core/physics';
import { getCharacter } from '../characters/registry';
import type { CharacterDefinition } from '../characters/types';
import { EnvironmentView } from '../environment/EnvironmentView';
import { collectObstacleBoxes } from '../environment/collect';
import { NavGrid } from '../ai/navgrid';
import type { Brain, BrainContext, NpcOptions } from '../ai/brain';
import { HunterBrain } from '../ai/brains/hunterBrain';
import { PreyBrain } from '../ai/brains/preyBrain';
import { GuardianBrain } from '../ai/brains/guardianBrain';
import { canSee } from '../ai/perception';
import { interactions } from '../interaction/registry';
import { unhideAgent } from '../interaction/hiding';
import { useItems } from '../interaction/items';
import { updateInput, resetInput } from '../input/input';
import { updatePlayerIntent, playerExpression } from '../controller/player';
import { processAbilities, processRules } from '../controller/rules';
import { stepMovement } from '../controller/movement';
import { ThirdPersonCamera, cameraState, addTrauma } from '../camera/ThirdPersonCamera';
import { AgentBody } from './AgentBody';
import { Pickups, Traps, ZoneMarker } from '../episode/content';
import { audio, type SoundId } from '../audio/audio';
import { seededRandom } from '../core/math';
import { roomAt } from '../environment/geometry';
import { playCutscene, stopCutscene, updateCutscene, cutsceneActive } from './cutscene';

interface Npc {
  agent: AgentState;
  def: CharacterDefinition;
  brain: Brain;
  options: NpcOptions;
  size: 'small' | 'large';
}

interface Setup {
  agents: { agent: AgentState; def: CharacterDefinition }[];
  npcs: Npc[];
  runtime: EpisodeRuntime;
  navs: { small: NavGrid; large: NavGrid };
  removed: Set<string>;
  rng: () => number;
  /** Live measurements shared with the runtime's metric objectives and the HUD. */
  metrics: { lastSpotted: number; hiddenSince: number | null; seesOpponent: boolean; lastPreyClue: THREE.Vector3 | null; lastClueAt: number };
}

const SMALL = { id: 'small', radius: 0.12, height: 0.56 };
const LARGE = { id: 'large', radius: 0.46, height: 1.5 };

export function GameSession({ episode, playerCharacterId, runId }: { episode: EpisodeDefinition; playerCharacterId: string; runId: number }) {
  const env = getEnvironment(episode.environment);
  const lighting = env.lighting[episode.lighting] ?? Object.values(env.lighting)[0];
  const physicsRef = useRef<ReturnType<typeof useRapier> | null>(null);
  const musicBoost = useRef({ level: 0, until: 0 });
  const setupRef = useRef<Setup | null>(null);

  const ctxFor = (n: Npc, dt = 0): BrainContext => {
    const ph = physicsRef.current!;
    const s = setupRef.current!;
    return { self: n.agent, def: n.def, nav: s.navs[n.size], navs: s.navs, env, physics: { world: ph.world, rapier: ph.rapier }, dt, options: n.options, rng: s.rng };
  };

  const runAction = (a: EpisodeAction) => {
    const store = useGame.getState();
    const s = setupRef.current;
    switch (a.type) {
      case 'toast':
        store.pushToast(a.text, a.tone ?? 'info', 3.4);
        break;
      case 'wake':
        for (const n of s?.npcs ?? []) if (n.agent.characterId === a.characterId) n.brain.command?.({ type: 'wake' }, ctxFor(n));
        break;
      case 'npc':
        for (const n of s?.npcs ?? []) if (n.agent.characterId === a.characterId) n.brain.command?.(a.command, ctxFor(n));
        break;
      case 'teleport': {
        const ag = world.agents.get(a.characterId);
        if (ag?.body) {
          if (ag.status.hiddenIn) unhideAgent(ag);
          const def = getCharacter(ag.characterId);
          const p = { x: a.position[0], y: a.position[1] + def.body.halfHeight + def.body.radius + 0.05, z: a.position[2] };
          ag.body.setTranslation(p, true);
          ag.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          ag.position.set(p.x, p.y, p.z);
          if (a.facing !== undefined) ag.facing = a.facing;
        }
        break;
      }
      case 'cutscene':
        playCutscene(a.shots);
        break;
      case 'noise':
        world.emitNoise(a.position, a.radius, a.kind ?? 'crash');
        if ((a.kind ?? 'crash') === 'crash') audio.play('crash');
        break;
      case 'showPickups':
        useItems.getState().revealGroup(a.group);
        break;
      case 'music':
        musicBoost.current = { level: a.intensity, until: world.time + 8 };
        break;
      case 'shake':
        addTrauma(a.amount);
        break;
      case 'door':
        interactions.doors.get(a.doorId)?.setOpen(a.open);
        break;
      case 'grant': {
        const p = world.player;
        if (p) p.charges[a.item] = (p.charges[a.item] ?? 0) + a.count;
        break;
      }
      case 'sound':
        audio.play(a.id as SoundId);
        break;
    }
  };

  const setup = useMemo<Setup>(() => {
    world.reset();
    interactions.reset();
    useItems.getState().reset();
    resetInput();
    stopCutscene();
    cameraState.cinematic = null;
    cameraState.trauma = 0;
    const side = episode.sides[playerCharacterId];
    const removed = new Set<string>();
    const boxes = collectObstacleBoxes(env, episode.extraProps, removed);
    const navs = { small: new NavGrid(env.bounds, 0.25, SMALL, boxes), large: new NavGrid(env.bounds, 0.25, LARGE, boxes) };
    const agents: Setup['agents'] = [];
    const npcs: Npc[] = [];
    const rng = seededRandom(runId * 7919 + 13);
    for (const entry of episode.cast) {
      const def = getCharacter(entry.characterId);
      const isPlayer = entry.characterId === playerCharacterId;
      const charges = isPlayer && side.charges ? side.charges : def.trap ? { [def.trap.kind]: def.trap.charges } : {};
      const agent = world.addAgent({
        id: entry.characterId,
        characterId: entry.characterId,
        archetype: def.archetype,
        isPlayer,
        height: def.body.halfHeight * 2 + def.body.radius * 2,
        radius: def.body.radius,
        spawn: { position: entry.spawn.position, facing: entry.spawn.facing ?? 0 },
        charges,
      });
      agents.push({ agent, def });
      if (!isPlayer) {
        const options: NpcOptions = { ...(entry.npc ?? {}), ...(entry.playable ? side.opponentAi : {}) };
        const brain = def.archetype === 'hunter' ? new HunterBrain() : def.archetype === 'prey' ? new PreyBrain() : new GuardianBrain();
        npcs.push({ agent, def, brain, options, size: def.body.radius <= 0.22 ? 'small' : 'large' });
      }
    }
    useItems.getState().setPickups(episode.pickups.map((p) => ({ ...p, collected: false, hidden: !!p.group })));
    for (const [i, h] of (episode.hazards ?? []).entries()) {
      useItems.getState().addTrap({ id: `hazard-${i}`, kind: h.kind, position: h.position, ownerId: 'environment', placedAt: -99, sprung: false, persistent: true });
    }
    const player = world.player!;
    cameraState.yaw = player.facing + Math.PI;
    cameraState.pitch = 0.36;
    cameraState.zoom = 1;
    const metrics: Setup['metrics'] = { lastSpotted: 0, hiddenSince: null, seesOpponent: false, lastPreyClue: null, lastClueAt: -99 };
    const runtime = new EpisodeRuntime(episode, playerCharacterId, {
      whoIs: (id) => {
        const a = world.agents.get(id);
        if (!a) return { who: 'npc', characterId: id };
        if (a.isPlayer) return { who: 'player', characterId: a.characterId };
        const playable = episode.cast.find((c) => c.characterId === a.characterId)?.playable;
        return { who: playable ? 'opponent' : 'npc', characterId: a.characterId };
      },
      onAction: (a) => runAction(a),
      metric: (name: MetricName) => {
        if (name === 'unseen') return world.time - metrics.lastSpotted;
        if (name === 'hiddenSeconds') return metrics.hiddenSince === null ? 0 : world.time - metrics.hiddenSince;
        return metrics.seesOpponent ? 1 : 0;
      },
      inZone: (zoneId) => {
        const z = env.zones.find((zz) => zz.id === zoneId);
        const p = world.player;
        return !!z && !!p && Math.hypot(p.position.x - z.center[0], p.position.z - z.center[2]) < z.radius;
      },
      onStage: (st, index) => {
        const store = useGame.getState();
        store.showBanner({ index, total: runtime.stages.length, title: st.title, brief: st.brief });
        if (index > 0) audio.play('win', { gain: 0.35 });
        metrics.lastSpotted = world.time;
      },
    });
    const s: Setup = { agents, npcs, runtime, navs, removed, rng, metrics };
    setupRef.current = s;
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode, playerCharacterId, runId]);

  // Event reactions: mission runtime, toasts, nav rebuilds
  useEffect(() => {
    const store = useGame.getState();
    const name = (id: string) => (world.agents.get(id) ? getCharacter(world.agents.get(id)!.characterId).name : id);
    const off = world.events.onAny((e) => {
      setup.runtime.handleEvent(e);
      const isP = (id: string) => id === world.playerId;
      switch (e.type) {
        case 'caught':
          store.pushToast(isP(e.targetId) ? `Caught by ${name(e.catcherId)}!` : `Gotcha! ${name(e.targetId)} caught!`, isP(e.targetId) ? 'bad' : 'good');
          break;
        case 'slipped':
          store.pushToast(`${name(e.agentId)} slipped!`, 'gag', 2);
          break;
        case 'trapped':
          if (e.trapKind === 'mousetrap') store.pushToast(`SNAP! ${name(e.agentId)} stepped in a mousetrap`, 'gag');
          if (e.trapKind === 'rake') store.pushToast(`THWACK! ${name(e.agentId)} stepped on a rake`, 'gag');
          break;
        case 'pummeled':
          store.pushToast(`${name(e.byId)} gave ${name(e.agentId)} a walloping!`, isP(e.agentId) ? 'bad' : 'gag');
          break;
        case 'splat':
          store.pushToast(e.cause === 'door' ? `SLAM! ${name(e.agentId)} met the door` : e.cause === 'wall' ? `SPLAT! ${name(e.agentId)} hit the wall` : `KER-SPLAT!`, 'gag', 2);
          break;
        case 'bonked':
          if (e.byObject !== 'rake') store.pushToast(`BONK! Right on ${name(e.agentId)}'s head`, 'gag', 2);
          break;
        case 'nearMiss':
          store.pushToast('Missed by a whisker!', isP(e.agentId) ? 'good' : 'bad', 1.8);
          world.flashExpression(world.agents.get(e.agentId)!, 'smug', 1.2);
          break;
        case 'npcState':
          if (e.state === 'backfire') store.pushToast(`${name(e.agentId)} stepped in their own trap!`, 'gag');
          break;
        case 'knocked':
          store.pushToast('CRASH!', 'gag', 1.4);
          break;
        case 'broken':
          setup.removed.add(e.objectId);
          rebuildNav();
          store.pushToast('The barricade is down!', 'good', 2);
          break;
        case 'unhide':
          if (e.flushed && isP(e.agentId)) store.pushToast('Found you! Run!', 'bad');
          break;
        case 'searched':
          if (!e.found && isP(e.agentId)) store.pushToast('Nobody in there.', 'info', 1.6);
          if (e.found && isP(e.agentId)) store.pushToast('There you are!', 'good', 1.6);
          break;
        case 'pickup':
          if (isP(e.agentId)) store.pushToast(`Got the ${e.itemType}!`, 'good', 1.4);
          break;
      }
    });
    function rebuildNav() {
      const boxes = collectObstacleBoxes(env, episode.extraProps, setup.removed);
      setup.navs.small = new NavGrid(env.bounds, 0.25, SMALL, boxes);
      setup.navs.large = new NavGrid(env.bounds, 0.25, LARGE, boxes);
    }
    audio.startMusic(episode.audio.music);
    for (const [id, url] of Object.entries(episode.audio.sounds ?? {})) audio.registerSoundFile(id, url);
    if (episode.intro?.shots.length) playCutscene(episode.intro.shots);
    const side = setup.runtime.side;
    if (!side.stages?.length) store.pushToast(side.brief, 'info', 5);
    if (episode.intro?.text) store.pushToast(episode.intro.text, 'gag', 4);
    return () => {
      off();
      audio.stopMusic();
      stopCutscene();
    };
  }, [setup, episode, env]);

  const paused = useGame((s) => s.paused);
  useEffect(() => {
    world.paused = paused;
  }, [paused]);

  const reachObjectives = useMemo(
    () => [...setup.runtime.side.objectives, ...(setup.runtime.side.stages ?? []).flatMap((s) => s.objectives)].flatMap((o) => (o.type === 'reach' ? [o] : [])),
    [setup],
  );

  return (
    <Physics gravity={GRAVITY} paused={paused} updatePriority={-1} timeStep={1 / 60}>
      <EnvironmentView env={env} lighting={lighting} extraProps={episode.extraProps} />
      {setup.agents.map(({ agent, def }) => (
        <AgentBody key={`${runId}-${agent.id}`} agent={agent} def={def} />
      ))}
      <Pickups />
      <Traps />
      {reachObjectives.map((o, i) => {
        const z = env.zones.find((zz) => zz.id === o.zoneId);
        return z ? <ZoneMarker key={`${o.id}-${i}`} zone={z} objectiveId={o.id} after={o.after ?? []} /> : null;
      })}
      <Simulation setup={setup} env={env} physicsRef={physicsRef} musicBoost={musicBoost} episode={episode} ctxFor={ctxFor} />
      <ThirdPersonCamera />
    </Physics>
  );
}

function Simulation({
  setup,
  env,
  physicsRef,
  musicBoost,
  episode,
  ctxFor,
}: {
  setup: Setup;
  env: ReturnType<typeof getEnvironment>;
  physicsRef: React.MutableRefObject<ReturnType<typeof useRapier> | null>;
  musicBoost: React.MutableRefObject<{ level: number; until: number }>;
  episode: EpisodeDefinition;
  ctxFor: (n: Npc, dt?: number) => BrainContext;
}) {
  const rapier = useRapier();
  physicsRef.current = rapier;
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const g = (window as unknown as { __GAME__: Record<string, unknown> }).__GAME__;
    g.renderer = gl;
    g.runtime = setup.runtime;
    g.npcCommand = (characterId: string, command: never) => {
      for (const n of setup.npcs) if (n.agent.characterId === characterId) n.brain.command?.(command, ctxFor(n));
    };
  }, [gl, setup, ctxFor]);
  const hudTimer = useRef(0);
  const ending = useRef<{ at: number; done: boolean } | null>(null);
  const prompt = useRef<string | null>(null);
  const resultReason = useRef('');

  useFrame((_, rawDt) => {
    const store = useGame.getState();
    store.pruneToasts();
    if (world.paused) return;
    // Keep the game clock in step with Rapier's accumulator (which clamps at 0.5s).
    const dt = Math.min(rawDt, 0.25);
    world.time += dt;
    updateInput(dt);
    const player = world.player;
    const phys = { world: rapier.world, rapier: rapier.rapier };
    const holding = world.cutscene || world.finished;

    if (world.cutscene) updateCutscene(dt);
    if (player && !holding) {
      prompt.current = updatePlayerIntent(player);
      playerExpression(player);
    } else if (player) {
      player.intent.moveX = player.intent.moveZ = 0;
      player.intent.sprint = player.intent.sneak = false;
    }
    for (const n of setup.npcs) {
      if (holding) {
        n.agent.intent.moveX = n.agent.intent.moveZ = 0;
        n.agent.intent.sprint = false;
        continue;
      }
      n.brain.update(ctxFor(n, dt));
    }
    for (const { agent, def } of setup.agents) {
      if (!holding) processAbilities(agent, def);
      stepMovement(agent, def, dt, rapier.world, rapier.rapier);
      agent.intent.jump = false;
    }
    if (!world.cutscene) processRules(env, (a) => respawn(a));
    world.pruneNoises();
    if (player) measure(player, phys);

    // Mission runtime & ending sequence
    if (!world.finished && !world.cutscene) {
      const out = setup.runtime.tick(dt);
      if (out) beginEnding(out.outcome, out.reason);
    } else if (ending.current && !ending.current.done && world.time > ending.current.at) {
      ending.current.done = true;
      finishMatch();
    }

    const chase = chaseLevel();
    const boost = musicBoost.current.until > world.time ? musicBoost.current.level : 0;
    audio.setMusicIntensity(Math.max(chase, boost));

    hudTimer.current -= dt;
    if (hudTimer.current <= 0 && player) {
      hudTimer.current = 0.1;
      publishHud(player, chase);
    }
  }, -2);

  function measure(player: AgentState, phys: { world: typeof rapier.world; rapier: typeof rapier.rapier }) {
    const m = setup.metrics;
    // Prey player: is any AI hunter looking at me?
    if (player.archetype === 'prey') {
      for (const n of setup.npcs) {
        if (n.agent.archetype !== 'hunter') continue;
        if (n.agent.aiState === 'sleep') continue;
        if (canSee(phys, n.agent, n.def, player)) m.lastSpotted = world.time;
      }
      if (player.status.hiddenIn) m.hiddenSince ??= world.time;
      else m.hiddenSince = null;
    }
    // Hunter player: can I see the prey / where did I last notice it?
    if (player.archetype === 'hunter') {
      const def = getCharacter(player.characterId);
      const prey = [...world.agents.values()].find((a) => a.archetype === 'prey');
      m.seesOpponent = !!prey && canSee(phys, player, def, prey);
      if (prey && m.seesOpponent) {
        m.lastPreyClue = prey.position.clone();
        m.lastClueAt = world.time;
      }
      for (const n of world.noises) {
        const src = n.sourceId ? world.agents.get(n.sourceId) : undefined;
        if (src?.archetype === 'prey' && world.time - n.time < 0.1 && n.position.distanceTo(player.position) < n.radius * 2.2) {
          m.lastPreyClue = n.position.clone();
          m.lastClueAt = world.time;
        }
      }
    }
  }

  function publishHud(player: AgentState, chase: number) {
    const store = useGame.getState();
    const rt = setup.runtime;
    const side = rt.side;
    const m = setup.metrics;
    const caughtRule = side.lose.find((l) => l.type === 'count' && l.who === 'player');
    const room = roomAt(env.rooms, player.position.x, player.position.z);
    let detection: 'hidden' | 'safe' | 'heard' | 'seen' | null = null;
    let scent: { angle: number; fresh: number } | null = null;
    if (player.archetype === 'prey') {
      const hunterState = setup.npcs.find((n) => n.agent.archetype === 'hunter')?.agent.aiState ?? '';
      if (player.status.hiddenIn) detection = 'hidden';
      else if (world.time - m.lastSpotted < 0.6) detection = 'seen';
      else if (['investigate', 'search', 'intercept', 'chase', 'enraged'].includes(hunterState)) detection = 'heard';
      else detection = 'safe';
    } else if (player.archetype === 'hunter' && m.lastPreyClue && world.time - m.lastClueAt < 10) {
      const dx = m.lastPreyClue.x - player.position.x;
      const dz = m.lastPreyClue.z - player.position.z;
      if (Math.hypot(dx, dz) > 1.5) {
        const rel = Math.atan2(dx, dz) - (cameraState.yaw + Math.PI);
        scent = { angle: (-rel * 180) / Math.PI, fresh: 1 - (world.time - m.lastClueAt) / 10 };
      }
    }
    const info = rt.stageInfo();
    store.setHud({
      timeLeft: info?.timeLeft ?? rt.timeLeft,
      objectives: rt.objectiveViews(),
      prompt: world.finished || world.cutscene ? null : prompt.current,
      stamina: player.stamina,
      charges: { ...player.charges },
      chase,
      hidden: !!player.status.hiddenIn,
      stunned: world.isStunned(player),
      room: room?.name ?? null,
      lives: caughtRule && caughtRule.type === 'count' ? { current: caughtRule.max - rt.count(caughtRule.event, 'player'), max: caughtRule.max } : null,
      stage: info ? { index: info.index, total: info.total, title: info.title, brief: info.brief, timeLeft: info.timeLeft } : null,
      detection,
      scent,
      role: player.archetype,
    });
  }

  function chaseLevel() {
    let level = 0;
    for (const a of world.agents.values()) {
      if (a.isPlayer) continue;
      if (a.aiState === 'chase' || a.aiState === 'enraged' || a.aiState === 'flee' || a.aiState === 'runHome') {
        const p = world.player;
        const d = p ? a.position.distanceTo(p.position) : 99;
        level = Math.max(level, d < 14 ? 1 : 0.4);
      }
    }
    return level;
  }

  function respawn(a: AgentState) {
    const entry = episode.cast.find((c) => c.characterId === a.characterId);
    const stage = setup.runtime.currentStage;
    const sp = (a.isPlayer ? stage?.checkpoint : stage?.opponentRespawn) ?? entry?.respawn ?? entry?.spawn;
    if (!sp || !a.body) return;
    const def = getCharacter(a.characterId);
    const p = { x: sp.position[0], y: sp.position[1] + def.body.halfHeight + def.body.radius + 0.05, z: sp.position[2] };
    a.body.setTranslation(p, true);
    a.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    a.position.set(p.x, p.y, p.z);
    a.facing = sp.facing ?? 0;
    world.flashExpression(a, 'smug', 1.5);
    if (a.isPlayer) setup.metrics.lastSpotted = world.time;
  }

  function beginEnding(outcome: 'win' | 'lose', reason: string) {
    world.finished = true;
    stopCutscene();
    const player = world.player!;
    const opponent = [...world.agents.values()].find((a) => !a.isPlayer && episode.cast.find((c) => c.characterId === a.characterId)?.playable);
    const winner = outcome === 'win' ? player : opponent ?? player;
    const loser = outcome === 'win' ? opponent : player;
    for (const a of [player, opponent]) if (a?.status.hiddenIn) unhideAgent(a);
    world.playOneShot(winner, winner.archetype === 'prey' ? 'laugh' : 'celebrate', 99);
    world.flashExpression(winner, 'happy', 99);
    if (loser) {
      world.playOneShot(loser, 'defeat', 99);
      world.flashExpression(loser, 'sad', 99);
    }
    const focus = (winner.visual ? winner.visual.getWorldPosition(new THREE.Vector3()) : winner.position.clone()).add(new THREE.Vector3(0, 0.6, 0));
    cameraState.cinematic = { target: focus, orbitSpeed: 0.35, distance: 4.5, height: 2.2 };
    useGame.getState().setCutscene({ caption: outcome === 'win' ? 'And… scene!' : reason, skippable: false });
    audio.play(outcome === 'win' ? 'win' : 'lose');
    audio.setMusicIntensity(0);
    if (document.pointerLockElement) document.exitPointerLock();
    ending.current = { at: world.time + 3.4, done: false };
    resultReason.current = reason;
  }

  function finishMatch() {
    const store = useGame.getState();
    store.setCutscene(null);
    const rt = setup.runtime;
    const out = rt.result!;
    const card = (out.outcome === 'win' ? episode.ending.win : episode.ending.lose)[rt.playerCharacterId];
    const minutes = Math.floor(rt.elapsed / 60);
    const secs = Math.floor(rt.elapsed % 60).toString().padStart(2, '0');
    const done = rt.stagesCompleted();
    const stats = [
      { label: 'Time', value: `${minutes}:${secs}` },
      ...(rt.stages.length
        ? [{ label: 'Missions', value: `${done} / ${rt.stages.length}` }]
        : rt.side.objectives.filter((o) => !o.optional).map((o) => {
            const p = rt.progress(o);
            return { label: o.label, value: o.type === 'reach' ? (p.progress ? 'Done' : 'Not yet') : `${p.progress} / ${p.target}` };
          })),
    ];
    const caughtRule = rt.side.lose.find((l) => l.type === 'count' && l.who === 'player');
    if (caughtRule && caughtRule.type === 'count') stats.push({ label: caughtRule.event === 'caught' ? 'Times caught' : 'Times walloped', value: `${rt.count(caughtRule.event, 'player')}` });
    store.finish({
      outcome: out.outcome,
      title: card?.title ?? (out.outcome === 'win' ? 'You win!' : 'Better luck next time'),
      caption: out.outcome === 'lose' ? `${resultReason.current} ${card?.caption ?? ''}`.trim() : card?.caption ?? resultReason.current,
      stats,
      bonus: rt.bonusSummary(),
      stages: rt.stages.map((s, i) => ({ title: s.title, done: i < done })),
    });
  }

  useEffect(() => () => void (cutsceneActive() && stopCutscene()), []);
  return null;
}

// Debug / test hook: lets Playwright inspect the simulation.
if (typeof window !== 'undefined') {
  (window as unknown as { __GAME__: unknown }).__GAME__ = { world, interactions, useItems, useGame, cameraState };
}
