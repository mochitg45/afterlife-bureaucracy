import { useEffect, useState } from 'react';
import { useGame } from '../../store/game';
import { Modal } from '../components/Modal';
import { VoucherIcon } from '../icons/Currency';
import { REFERRAL_TIERS, SHARE_REWARD, nextTier } from '../../engine/referral';
import { referralLink } from '../../platform/referral';

const UNREACHABLE = "Couldn't reach the referral office, try later.";

/**
 * Invite friends and share. The count of genuine friends (installed from this player's link,
 * then filed their first Annual Audit) comes from the server; the rewards are paid locally.
 */
export function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const info = useGame((s) => s.referralInfo);
  const referral = useGame((s) => s.state.referral);
  const refreshReferral = useGame((s) => s.refreshReferral);
  const shareInvite = useGame((s) => s.shareInvite);
  const claimReferralTier = useGame((s) => s.claimReferralTier);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (open) void refreshReferral();
  }, [open, refreshReferral]);

  const ready = info.status === 'ready' && info.code !== null;
  const next = nextTier(info.joined);
  const pct = next ? (info.joined / next.friends) * 100 : 100;

  const onShare = async () => {
    const ok = await shareInvite();
    setStatus(ok ? '' : 'Nothing was shared.');
  };

  const onCopy = async () => {
    if (!info.code) return;
    try {
      await navigator.clipboard.writeText(referralLink(info.code));
      setStatus('Link copied.');
    } catch {
      setStatus('The clipboard refused. Use Share instead.');
    }
  };

  return (
    <Modal open={open} title="Invite friends" onClose={onClose}>
      <p className="sub">
        A friend counts after they install from your link and file their first Annual Audit.
      </p>
      {info.status === 'error' && <p className="sub warn" role="status">{UNREACHABLE}</p>}
      {info.status === 'loading' && <p className="sub" role="status">Calling the referral office...</p>}
      <p className="sub" role="status" aria-live="polite">{status}</p>

      <div className="modal-actions">
        <button className="btn btn-primary" disabled={!ready} onClick={() => void onShare()}>
          Share the game
          {!referral.shareRewarded && <> · +{SHARE_REWARD} <VoucherIcon size={14} /><span className="visually-hidden">vouchers</span> (once)</>}
        </button>
      </div>

      <p className="sub">Your code</p>
      <p className="mono">{info.code ?? '--------'}</p>
      <div className="modal-actions">
        <button className="btn" disabled={!ready} onClick={() => void onCopy()}>Copy link</button>
      </div>

      <p className="sub">
        Genuine friends: <span className="mono">{info.joined}</span>
        {next ? <> · next reward at {next.friends}</> : ' · all rewards reached'}
      </p>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={next?.friends ?? info.joined} aria-valuenow={info.joined}>
        <div className="bar-fill" style={{ width: Math.min(100, pct) + '%' }} />
      </div>

      {REFERRAL_TIERS.map((t) => {
        const taken = referral.claimedTiers.includes(t.friends);
        return (
          <div key={t.friends} className="daily-meta">
            <span className="mono sub">
              {t.friends} friends · +{t.vouchers} <VoucherIcon size={14} /><span className="visually-hidden">vouchers</span>
            </span>
            {taken ? (
              <span className="mono claimed-label">Claimed</span>
            ) : (
              <button
                className="btn btn-primary"
                aria-label={`Claim ${t.friends} friends reward`}
                disabled={info.joined < t.friends}
                onClick={() => claimReferralTier(t.friends)}
              >
                Claim
              </button>
            )}
          </div>
        );
      })}

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
