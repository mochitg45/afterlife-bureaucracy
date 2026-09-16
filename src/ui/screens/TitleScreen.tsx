import { useState } from 'react';
import { useGame } from '../../store/game';
import { Character } from '../characters/Character';
import { StampSeal } from '../components/StampButton';
import { APP_VERSION, PRIVACY_URL } from '../../version';

/**
 * The front door, shown on every cold boot. One tap gets a player to their desk; the
 * Play Games sign-in is the other door, and it only exists where there is a cloud slot to
 * sign into — on the web and on iOS the button would be a promise the platform cannot keep.
 *
 * A successful sign-in enters the office itself: `signInCloud` has already run the sync by
 * the time it answers, so the desk behind the title screen is the one the cloud agreed on.
 */
export function TitleScreen({ onEnter, onGoToOdds }: { onEnter: () => void; onGoToOdds: () => void }) {
  const available = useGame((s) => s.cloud.available);
  const signedIn = useGame((s) => s.cloud.signedIn);
  const signInCloud = useGame((s) => s.signInCloud);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const showSignIn = available && !signedIn;

  const onSignIn = async () => {
    setStatus('');
    setBusy(true);
    let result: Awaited<ReturnType<typeof signInCloud>>;
    try {
      result = await signInCloud();
    } finally {
      setBusy(false);
    }
    if (result === 'ok') {
      onEnter();
      return;
    }
    setStatus(result === 'cancelled' ? 'Sign-in cancelled.' : 'Play Games is not available on this device.');
  };

  return (
    <section className="screen title-paper">
      <div className="title-wrap">
        <h1 className="title-name">Afterlife Bureaucracy Inc.</h1>
        <p className="sub title-tagline">Please take a number.</p>
        <div className="title-cast">
          <Character id="dave" mood="ok" size={96} />
          <StampSeal className="title-seal pulse" />
          <Character id="seraphine" mood="ok" size={96} />
        </div>
        {signedIn && <p className="chip title-chip">Clocked in with Play Games</p>}
        <p className="sub title-status" role="status" aria-live="polite">{status}</p>
        <div className="title-actions">
          {showSignIn && (
            <button className="btn btn-primary" disabled={busy} onClick={() => void onSignIn()}>
              Sign in with Google Play Games
            </button>
          )}
          <button className={'btn' + (showSignIn ? '' : ' btn-primary')} onClick={onEnter}>
            {showSignIn ? 'Clock in without signing in' : 'Clock in'}
          </button>
        </div>
        <div className="sub title-footer">
          <span className="mono">v{APP_VERSION}</span>
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy</a>
          <button className="link" onClick={onGoToOdds}>Odds</button>
        </div>
      </div>
    </section>
  );
}
