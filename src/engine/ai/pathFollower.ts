/** Turns a NavGrid path into a per-frame move intent, with re-planning and stuck recovery. */
import type { AgentState } from '../core/world';
import type { NavGrid } from './navgrid';
import type { XZ } from '../environment/types';
import { world } from '../core/world';

export class PathFollower {
  path: XZ[] = [];
  index = 0;
  target: XZ | null = null;
  private lastPlan = -10;
  private lastProgress = 0;
  private bestDist = Infinity;
  failed = false;

  clear() {
    this.path = [];
    this.index = 0;
    this.target = null;
  }

  /**
   * Steer toward `goal`. Returns remaining straight-line distance to the goal.
   * `replan` seconds controls how often a moving goal is re-pathed.
   */
  steer(self: AgentState, nav: NavGrid, goal: XZ, replan = 0.5, arriveRadius = 0.5): number {
    const now = world.time;
    const moved = !this.target || Math.hypot(goal[0] - this.target[0], goal[1] - this.target[1]) > 0.75;
    if (moved && now - this.lastPlan > replan) this.plan(self, nav, goal);
    else if (!this.path.length && now - this.lastPlan > 1) this.plan(self, nav, goal);
    const dGoal = Math.hypot(goal[0] - self.position.x, goal[1] - self.position.z);
    if (dGoal < arriveRadius) {
      self.intent.moveX = 0;
      self.intent.moveZ = 0;
      return dGoal;
    }
    let wp: XZ | undefined = this.path[this.index];
    while (wp && Math.hypot(wp[0] - self.position.x, wp[1] - self.position.z) < Math.max(0.35, self.radius * 1.2) && this.index < this.path.length - 1) {
      this.index++;
      wp = this.path[this.index];
    }
    if (!wp) wp = goal;
    const dx = wp[0] - self.position.x;
    const dz = wp[1] - self.position.z;
    const d = Math.hypot(dx, dz) || 1;
    self.intent.moveX = dx / d;
    self.intent.moveZ = dz / d;
    // Stuck detection: no progress toward goal for a while -> hop and re-plan.
    if (dGoal < this.bestDist - 0.25) {
      this.bestDist = dGoal;
      this.lastProgress = now;
    } else if (now - this.lastProgress > 1.1) {
      self.intent.jump = true;
      this.lastProgress = now;
      this.bestDist = dGoal;
      this.plan(self, nav, goal);
    }
    return dGoal;
  }

  private plan(self: AgentState, nav: NavGrid, goal: XZ) {
    this.lastPlan = world.time;
    this.target = [goal[0], goal[1]];
    const p = nav.findPath([self.position.x, self.position.z], goal);
    this.failed = !p;
    this.path = p ?? [goal];
    this.index = this.path.length > 1 ? 1 : 0;
    this.bestDist = Infinity;
    this.lastProgress = world.time;
  }
}
