import { useGame } from '@engine/core/store';
import { audio } from '@engine/audio/audio';
import { Logo } from '../components/Logo';
import { Stage } from '../components/Stage';

const CAST = [
  { id: 'brick', x: -2.1, z: -0.6, facing: 0.5 },
  { id: 'barnaby', x: 0.2, z: 0.1, facing: -0.25 },
  { id: 'pip', x: 1.75, z: 0.9, facing: -0.5 },
];

export function MainMenu() {
  const goTo = useGame((s) => s.goTo);
  const click = (fn: () => void) => () => {
    audio.unlock();
    audio.play('ui');
    fn();
  };
  return (
    <main className="screen menu">
      <div className="iris" aria-hidden="true" />
      <div className="menu-stage">
        <Stage cast={CAST} camera={[-2.4, 1.9, 7.4]} target={[-2.6, 0.7, 0]} />
      </div>
      <section className="menu-left">
        <Logo />
        <p className="menu-sub">A cartoon chase through one very messy house.</p>
        <nav className="menu-buttons" aria-label="Main menu">
          <button className="btn btn-primary btn-xl" onClick={click(() => goTo('episodes'))} autoFocus>
            Play
          </button>
          <button className="btn" onClick={click(() => goTo('howto'))}>
            How to play
          </button>
        </nav>
      </section>
      <footer className="menu-foot">Mouse and keyboard, gamepad or touch. Best with sound on.</footer>
    </main>
  );
}
