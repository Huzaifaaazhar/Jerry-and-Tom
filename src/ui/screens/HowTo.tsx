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
  ['E or Click', 'Interact: doors, hide, search, knock things over, grab'],
  ['Q', 'Drop your trap item (mousetrap or banana peel)'],
  ['F or Right-click', 'Ability: pounce (cat) or taunt (mouse)'],
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
                  {k.split(' or ').map((alt, i) => (
                    <span key={alt} className="key-alt">
                      {i > 0 && <span className="key-or">or</span>}
                      {alt.split(' ').map((p) => (
                        <kbd key={p}>{p}</kbd>
                      ))}
                    </span>
                  ))}
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="panel">
          <h3>Touch and gamepad</h3>
          <p>On a phone or tablet, drag anywhere on the left to move - push further to run - and tap Sneak above the stick to tiptoe. Swipe the right side to look. Your right thumb has four buttons: Jump, an action button that changes to whatever you can do right now (Hide, Grab, Open door…), your ability and your trap.</p>
          <p>Gamepads work too: left stick moves, right stick looks, A jumps, X interacts, B drops a trap, Y uses your ability, triggers sprint and sneak.</p>
          <h3>Cartoon rules</h3>
          <p>Mice fit through mouse holes, pet flaps and under beds. Cats open doors and can search any hiding place. Loud crashes wake the bulldog - and he only has a grudge against cats.</p>
        </section>
      </div>
    </main>
  );
}
