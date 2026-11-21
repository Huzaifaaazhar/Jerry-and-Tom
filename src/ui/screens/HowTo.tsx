import { useGame } from '@engine/core/store';
import { audio } from '@engine/audio/audio';
import { Arrow } from '../components/Icons';

const ROWS: [string, string][] = [
  ['W A S D', 'Move (camera-relative)'],
  ['Mouse', 'Look around - click the game to capture the mouse'],
  ['Wheel', 'Zoom the camera'],
  ['Space', 'Jump - onto sofas, beds, tables and counters'],
  ['Shift', 'Sprint (uses stamina)'],
  ['Ctrl or C', 'Sneak - quiet steps, harder to spot'],
  ['E', 'Interact: doors, hide, search, knock things over, grab'],
  ['Q', 'Drop your trap item (mousetrap or banana peel)'],
  ['F', 'Ability: pounce (cat) or taunt (mouse)'],
  ['Esc or P', 'Pause'],
];

export function HowTo() {
  const goTo = useGame((s) => s.goTo);
  return (
    <main className="screen picker">
      <div className="iris iris-dim" aria-hidden="true" />
      <header className="picker-head">
        <button className="btn btn-icon" aria-label="Back to main menu" onClick={() => (audio.play('uiBack'), goTo('menu'))}>
          <Arrow />
        </button>
        <h2 className="title-card">How to play</h2>
      </header>
      <div className="howto">
        <section className="panel">
          <h3>Keyboard and mouse</h3>
          <dl className="keys">
            {ROWS.map(([k, v]) => (
              <div key={k}>
                <dt>
                  {k.split(' ').map((p) => (
                    <kbd key={p}>{p}</kbd>
                  ))}
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="panel">
          <h3>Touch and gamepad</h3>
          <p>On a phone or tablet, drag the left stick to move and swipe the right side of the screen to look. Buttons on the right jump, grab, sprint, drop traps and use your ability.</p>
          <p>Gamepads work too: left stick moves, right stick looks, A jumps, X interacts, B drops a trap, Y uses your ability, triggers sprint and sneak.</p>
          <h3>Cartoon rules</h3>
          <p>Mice fit through mouse holes, pet flaps and under beds. Cats open doors and can search any hiding place. Loud crashes wake the bulldog - and he only has a grudge against cats.</p>
        </section>
      </div>
    </main>
  );
}
