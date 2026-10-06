import { t } from '../../i18n';
import { useEffect, useState } from 'react';
import { useGame } from '../../store/game';
import { Modal } from '../components/Modal';
import { VoucherIcon } from '../icons/Currency';
import { REFERRAL_TIERS, SHARE_REWARD, nextTier } from '../../engine/referral';
import { referralLink } from '../../platform/referral';


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
    setStatus(ok ? '' : t('invite.none'));
  };

  const onCopy = async () => {
    if (!info.code) return;
    try {
      await navigator.clipboard.writeText(referralLink(info.code));
      setStatus(t('invite.copied'));
    } catch {
      setStatus(t('invite.clipboard'));
    }
  };

  return (
    <Modal open={open} title={t('invite.title')} onClose={onClose}>
      <p className="sub">
        {t('invite.rule')}
      </p>
      {info.status === 'error' && <p className="sub warn" role="status">{t('invite.unreachable')}</p>}
      {info.status === 'loading' && <p className="sub" role="status">{t('invite.loading')}</p>}
      <p className="sub" role="status" aria-live="polite">{status}</p>

      <div className="modal-actions">
        <button className="btn btn-primary" disabled={!ready} onClick={() => void onShare()}>
          {t('invite.share')}
          {!referral.shareRewarded && <> {t('invite.shareBonus', { n: SHARE_REWARD })} <VoucherIcon size={14} /><span className="visually-hidden">{t('invite.vouchers')}</span> {t('invite.once')}</>}
        </button>
      </div>

      <p className="sub">{t('invite.code')}</p>
      <p className="mono">{info.code ?? '--------'}</p>
      <div className="modal-actions">
        <button className="btn" disabled={!ready} onClick={() => void onCopy()}>{t('invite.copy')}</button>
      </div>

      <p className="sub">
        {t('invite.friends')} <span className="mono">{info.joined}</span>
        {' '}{next ? t('invite.next', { n: next.friends }) : t('invite.allReached')}
      </p>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={next?.friends ?? info.joined} aria-valuenow={info.joined}>
        <div className="bar-fill" style={{ width: Math.min(100, pct) + '%' }} />
      </div>

      {REFERRAL_TIERS.map((tier) => {
        const taken = referral.claimedTiers.includes(tier.friends);
        return (
          <div key={tier.friends} className="daily-meta">
            <span className="mono sub">
              {t('invite.tier', { n: tier.friends, v: tier.vouchers })} <VoucherIcon size={14} /><span className="visually-hidden">{t('invite.vouchers')}</span>
            </span>
            {taken ? (
              <span className="mono claimed-label">{t('invite.claimed')}</span>
            ) : (
              <button
                className="btn btn-primary"
                aria-label={t('invite.claimAria', { n: tier.friends })}
                disabled={info.joined < tier.friends}
                onClick={() => claimReferralTier(tier.friends)}
              >
                {t('invite.claim')}
              </button>
            )}
          </div>
        );
      })}

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('invite.close')}</button>
      </div>
    </Modal>
  );
}
