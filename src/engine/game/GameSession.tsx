/**
 * GameSession: boots an episode into a running match. Creates agents from the episode cast, builds
 * navigation grids, AI brains and the mission runtime, then runs the per-frame simulation pipeline:
 *   input -> player intent -> AI brains -> abilities -> movement -> (physics) -> rules -> mission.
 * Nothing in here is episode-specific: everything comes from the EpisodeDefinition.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Physics, useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import type { EpisodeDefinition, EpisodeAction } from '../episode/types';
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
import type { Brain, NpcOptions } from '../ai/brain';
import { HunterBrain } from '../ai/brains/hunterBrain';
import { PreyBrain } from '../ai/brains/preyBrain';
import { GuardianBrain } from '../ai/brains/guardianBrain';
import { interactions } from '../interaction/registry';
import { useItems } from '../interaction/items';
import { updateInput, resetInput } from '../input/input';
import { updatePlayerIntent, playerExpression } from '../controller/player';
import { processAbilities, processRules } from '../controller/rules';
import { stepMovement } from '../controller/movement';
import { ThirdPersonCamera, cameraState, addTrauma } from '../camera/ThirdPersonCamera';
import { AgentBody } from './AgentBody';
import { Pickups, Traps, ZoneMarker } from '../episode/content';
import { audio } from '../audio/audio';
import { seededRandom } from '../core/math';
import { roomAt } from '../environment/geometry';

interface Npc {
  agent: AgentState;
  def: CharacterDefinition;
  brain: Brain;
  options: NpcOptions;
  nav: NavGrid;
}

export function GameSession({ episode, playerCharacterId, runId }: { episode: EpisodeDefinition; playerCharacterId: string; runId: number }) {
  const env = getEnvironment(episode.environment);
  const lighting = env.lighting[episode.lighting] ?? Object.values(env.lighting)[0];

  const setup = useMemo(() => {
    world.reset();
    interactions.reset();
    useItems.getState().reset();
    resetInput();
    cameraState.cinematic = null;
    cameraState.trauma = 0;
    const side = episode.sides[playerCharacterId];
    const boxes = collectObstacleBoxes(env, episode.extraProps);
    const small = new NavGrid(env.bounds, 0.25, { id: 'small', radius: 0.12, height: 0.56 }, boxes);
    const large = new NavGrid(env.bounds, 0.25, { id: 'large', radius: 0.46, height: 1.5 }, boxes);
    const agents: { agent: AgentState; def: CharacterDefinition }[] = [];
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
        npcs.push({ agent, def, brain, options, nav: def.body.radius <= 0.22 ? small : large });
      }
    }
    useItems.getState().setPickups(episode.pickups.map((p) => ({ ...p, collected: false })));
    const player = world.player!;
    cameraState.yaw = player.facing + Math.PI;
    cameraState.pitch = 0.36;
    cameraState.zoom = 1;
    const runtime = new EpisodeRuntime(episode, playerCharacterId, {
      whoIs: (id) => {
        const a = world.agents.get(id);
        if (!a) return { who: 'npc', characterId: id };
        if (a.isPlayer) return { who: 'player', characterId: a.characterId };
        const playable = episode.cast.find((c) => c.characterId === a.characterId)?.playable;
        return { who: playable ? 'opponent' : 'npc', characterId: a.characterId };
      },
      onAction: (a) => runAction(a),
    });
    return { agents, npcs, runtime, small, large, rng };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode, playerCharacterId, runId]);

  function runAction(a: EpisodeAction) {
    const store = useGame.getState();
    switch (a.type) {
      case 'toast':
        store.pushToast(a.text, a.tone ?? 'info', 3.2);
        break;
      case 'wake':
        for (const n of setup?.npcs ?? []) if (n.agent.characterId === a.characterId && n.brain instanceof GuardianBrain) n.brain.wake(ctxFor(n));
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
        audio.play(a.id as never);
        break;
    }
  }
  const musicBoost = useRef({ level: 0, until: 0 });
  const physicsRef = useRef<ReturnType<typeof useRapier> | null>(null);
  function ctxFor(n: Npc) {
    const ph = physicsRef.current!;
    return { self: n.agent, def: n.def, nav: n.nav, env, physics: { world: ph.world, rapier: ph.rapier }, dt: 0, options: n.options, rng: setup.rng };
  }

  // Event reactions: mission runtime, toasts, ending
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
          store.pushToast(`${name(e.agentId)} slipped on a banana peel!`, 'gag');
          break;
        case 'trapped':
          if (e.trapKind !== 'bananaPeel') store.pushToast(`SNAP! ${name(e.agentId)} stepped in a trap`, 'gag');
          break;
        case 'pummeled':
          store.pushToast(`${name(e.byId)} gave ${name(e.agentId)} a walloping!`, isP(e.agentId) ? 'bad' : 'gag');
          break;
        case 'knocked':
          store.pushToast('CRASH! That woke someone up…', 'gag', 2);
          break;
        case 'unhide':
          if (e.flushed && isP(e.agentId)) store.pushToast('Found you! Run!', 'bad');
          break;
        case 'searched':
          if (!e.found && isP(e.agentId)) store.pushToast('Nobody in there.', 'info', 1.6);
          break;
        case 'pickup':
          if (isP(e.agentId)) store.pushToast(`Got a ${e.itemType}!`, 'good', 1.4);
          break;
      }
    });
    audio.startMusic(episode.audio.music);
    for (const [id, url] of Object.entries(episode.audio.sounds ?? {})) audio.registerSoundFile(id, url);
    const side = setup.runtime.side;
    store.pushToast(side.brief, 'info', 5);
    if (episode.intro?.text) store.pushToast(episode.intro.text, 'gag', 4);
    return () => {
      off();
      audio.stopMusic();
    };
  }, [setup, episode]);

  const paused = useGame((s) => s.paused);
  useEffect(() => {
    world.paused = paused;
  }, [paused]);

  const reachObjectives = useMemo(() => setup.runtime.side.objectives.flatMap((o) => (o.type === 'reach' ? [o] : [])), [setup]);

  return (
    <Physics gravity={GRAVITY} paused={paused} updatePriority={-1} timeStep={1 / 60}>
      <EnvironmentView env={env} lighting={lighting} extraProps={episode.extraProps} />
      {setup.agents.map(({ agent, def }) => (
        <AgentBody key={`${runId}-${agent.id}`} agent={agent} def={def} />
      ))}
      <Pickups />
      <Traps />
      {reachObjectives.map((o) => {
        const z = env.zones.find((zz) => zz.id === o.zoneId);
        return z ? <ZoneMarker key={o.id} zone={z} objectiveId={o.id} after={o.after ?? []} /> : null;
      })}
      <Simulation setup={setup} env={env} physicsRef={physicsRef} musicBoost={musicBoost} episode={episode} />
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
}: {
  setup: { agents: { agent: AgentState; def: CharacterDefinition }[]; npcs: Npc[]; runtime: EpisodeRuntime; rng: () => number };
  env: ReturnType<typeof getEnvironment>;
  physicsRef: React.MutableRefObject<ReturnType<typeof useRapier> | null>;
  musicBoost: React.MutableRefObject<{ level: number; until: number }>;
  episode: EpisodeDefinition;
}) {
  const rapier = useRapier();
  physicsRef.current = rapier;
  const hudTimer = useRef(0);
  const ending = useRef<{ at: number; done: boolean } | null>(null);
  const prompt = useRef<string | null>(null);

  useFrame((_, rawDt) => {
    const store = useGame.getState();
    store.pruneToasts();
    if (world.paused) return;
    const dt = Math.min(rawDt, 1 / 20);
    world.time += dt;
    updateInput(dt);
    const player = world.player;
    const phys = { world: rapier.world, rapier: rapier.rapier };

    if (player && !world.finished) {
      prompt.current = updatePlayerIntent(player);
      playerExpression(player);
    } else if (player) {
      player.intent.moveX = player.intent.moveZ = 0;
    }
    for (const n of setup.npcs) {
      n.brain.update({ self: n.agent, def: n.def, nav: n.nav, env, physics: phys, dt, options: n.options, rng: setup.rng });
      if (world.finished) n.agent.intent.moveX = n.agent.intent.moveZ = 0;
    }
    for (const { agent, def } of setup.agents) {
      processAbilities(agent, def);
      stepMovement(agent, def, dt, rapier.world, rapier.rapier);
      agent.intent.jump = false;
    }
    processRules(env, (a) => respawn(a, episode));
    world.pruneNoises();

    // Mission runtime & ending sequence
    if (!world.finished) {
      const out = setup.runtime.tick(dt);
      if (out) beginEnding(out.outcome, out.reason);
    } else if (ending.current && !ending.current.done && world.time > ending.current.at) {
      ending.current.done = true;
      finishMatch();
    }

    // Music intensity follows the chase.
    const chase = chaseLevel();
    const boost = musicBoost.current.until > world.time ? musicBoost.current.level : 0;
    audio.setMusicIntensity(Math.max(chase, boost));

    hudTimer.current -= dt;
    if (hudTimer.current <= 0 && player) {
      hudTimer.current = 0.1;
      const side = setup.runtime.side;
      const caughtRule = side.lose.find((l) => l.type === 'count' && l.who === 'player');
      const room = roomAt(env.rooms, player.position.x, player.position.z);
      store.setHud({
        timeLeft: setup.runtime.timeLeft,
        objectives: setup.runtime.objectiveViews(),
        prompt: world.finished ? null : prompt.current,
        stamina: player.stamina,
        charges: { ...player.charges },
        chase,
        hidden: !!player.status.hiddenIn,
        stunned: world.isStunned(player),
        room: room?.name ?? null,
        lives: caughtRule && caughtRule.type === 'count' ? { current: caughtRule.max - setup.runtime.count(caughtRule.event, 'player'), max: caughtRule.max } : null,
      });
    }
  }, -2);

  function chaseLevel() {
    let level = 0;
    for (const a of world.agents.values()) {
      if (a.isPlayer) continue;
      if (a.aiState === 'chase' || a.aiState === 'enraged' || a.aiState === 'flee') {
        const p = world.player;
        const d = p ? a.position.distanceTo(p.position) : 99;
        level = Math.max(level, d < 14 ? 1 : 0.4);
      }
    }
    return level;
  }

  function beginEnding(outcome: 'win' | 'lose', reason: string) {
    world.finished = true;
    const player = world.player!;
    const opponent = [...world.agents.values()].find((a) => !a.isPlayer && episode.cast.find((c) => c.characterId === a.characterId)?.playable);
    const winner = outcome === 'win' ? player : opponent ?? player;
    const loser = outcome === 'win' ? opponent : player;
    if (player.status.hiddenIn) {
      // pop out for the curtain call
      import('../interaction/hiding').then((m) => m.unhideAgent(player));
    }
    world.playOneShot(winner, winner.archetype === 'prey' ? 'laugh' : 'celebrate', 99);
    world.flashExpression(winner, 'happy', 99);
    if (loser) {
      world.playOneShot(loser, 'defeat', 99);
      world.flashExpression(loser, 'sad', 99);
    }
    const focus = (winner.visual ? winner.visual.getWorldPosition(new THREE.Vector3()) : winner.position.clone()).add(new THREE.Vector3(0, 0.6, 0));
    cameraState.cinematic = { target: focus, orbitSpeed: 0.35, distance: 4.5, height: 2.2 };
    audio.play(outcome === 'win' ? 'win' : 'lose');
    audio.setMusicIntensity(0);
    if (document.pointerLockElement) document.exitPointerLock();
    ending.current = { at: world.time + 3.2, done: false };
    resultReason.current = reason;
  }
  const resultReason = useRef('');

  function finishMatch() {
    const store = useGame.getState();
    const rt = setup.runtime;
    const out = rt.result!;
    const card = (out.outcome === 'win' ? episode.ending.win : episode.ending.lose)[rt.playerCharacterId];
    const minutes = Math.floor(rt.elapsed / 60);
    const secs = Math.floor(rt.elapsed % 60).toString().padStart(2, '0');
    const stats = [
      { label: 'Time', value: `${minutes}:${secs}` },
      ...rt.side.objectives.filter((o) => !o.optional).map((o) => {
        const p = rt.progress(o);
        return { label: o.label, value: o.type === 'reach' ? (p.progress ? 'Done' : 'Not yet') : `${p.progress} / ${p.target}` };
      }),
    ];
    store.finish({
      outcome: out.outcome,
      title: card?.title ?? (out.outcome === 'win' ? 'You win!' : 'Better luck next time'),
      caption: card?.caption ?? resultReason.current,
      stats,
      bonus: rt.bonusSummary(),
    });
  }

  return null;
}

function respawn(a: AgentState, episode: EpisodeDefinition) {
  const entry = episode.cast.find((c) => c.characterId === a.characterId);
  const sp = entry?.respawn ?? entry?.spawn;
  if (!sp || !a.body) return;
  const def = getCharacter(a.characterId);
  const p = { x: sp.position[0], y: sp.position[1] + def.body.halfHeight + def.body.radius + 0.05, z: sp.position[2] };
  a.body.setTranslation(p, true);
  a.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  a.position.set(p.x, p.y, p.z);
  a.facing = sp.facing ?? 0;
  world.flashExpression(a, 'smug', 1.5);
}

// Debug / test hook: lets Playwright inspect the simulation.
if (typeof window !== 'undefined') {
  (window as unknown as { __GAME__: unknown }).__GAME__ = { world, interactions, useItems, useGame, cameraState };
}
