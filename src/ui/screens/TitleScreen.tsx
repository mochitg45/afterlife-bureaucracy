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
/** Google's four-colour G, as used on its standard sign-in button. */
function GoogleG() {
  return (
    <svg className="g-mark" viewBox="0 0 48 48" width={20} height={20} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.4 14.4 0 0 1 9.7 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

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
        {signedIn && <p className="btn-google title-chip"><GoogleG /><span>Signed in with Google</span></p>}
        <p className="sub title-status" role="status" aria-live="polite">{status}</p>
        <div className="title-actions">
          {showSignIn && (
            <button className="btn btn-google" disabled={busy} onClick={() => void onSignIn()}>
              <GoogleG />
              <span>Sign in with Google</span>
            </button>
          )}
          <button className={'btn' + (showSignIn ? '' : ' btn-primary')} onClick={onEnter}>
            {showSignIn ? 'Play as guest' : 'Clock in'}
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
