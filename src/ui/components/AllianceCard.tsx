import { useEffect, useState } from 'react';
import { useGame } from '../../store/game';
import { t } from '../../i18n';
import { VoucherIcon, SealIcon } from '../icons/Currency';
import { BoardSheet } from './BoardSheet';
import { ALLIANCE_MAX, ALLIANCE_TIERS, allianceWeek, claimedThisWeek } from '../../engine/alliance';
import { PLAY_URL } from '../../platform/referral';
import { pickSharer } from '../../platform/share';

const n = (x: number) => x.toLocaleString('en-US');

/**
 * Office Alliance on the Tasks screen: join or create a team of up to ten, stamp together for
 * three weekly reward tiers, and see the members and the weekly alliance ranking.
 */
export function AllianceCard() {
  const info = useGame((s) => s.allianceInfo);
  const saved = useGame((s) => s.state.alliance);
  const refresh = useGame((s) => s.refreshAlliance);
  const joinRandom = useGame((s) => s.joinRandomAlliance);
  const create = useGame((s) => s.createAlliance);
  const joinByCode = useGame((s) => s.joinAllianceByCode);
  const leave = useGame((s) => s.leaveAlliance);
  const claim = useGame((s) => s.claimAllianceTier);
  const membersView = useGame((s) => s.allianceMembersView);
  const loadMembers = useGame((s) => s.loadAllianceMembers);
  const rankingView = useGame((s) => s.allianceRankingView);
  const loadRanking = useGame((s) => s.loadAllianceRanking);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [sheet, setSheet] = useState<'members' | 'ranking' | null>(null);

  useEffect(() => {
    if (info.available) void refresh();
  }, [info.available, refresh]);

  if (!info.available) {
    return (
      <div className="card alliance" data-testid="alliance">
        <h3>{t('alliance.title')}</h3>
        <p className="sub">{t('alliance.offline')}</p>
      </div>
    );
  }

  const view = info.view;
  const week = allianceWeek(Date.now());
  const stamps = view && view.week === week ? view.stamps : 0;
  const taken = claimedThisWeek({ alliance: saved }, week);
  const next = ALLIANCE_TIERS.find((tier) => stamps < tier.stamps);
  const goal = next?.stamps ?? ALLIANCE_TIERS[ALLIANCE_TIERS.length - 1].stamps;

  const onJoin = async (kind: 'random' | 'create' | 'code') => {
    setStatus('');
    if (kind === 'code') {
      const r = await joinByCode(code);
      if (r !== 'ok') setStatus(t(r === 'invalid' ? 'alliance.invalidCode' : r === 'notfound' ? 'alliance.notFound' : r === 'full' ? 'alliance.full' : 'alliance.failed'));
      else setCode('');
      return;
    }
    if (!(await (kind === 'random' ? joinRandom() : create()))) setStatus(t('alliance.failed'));
  };

  const onLeave = async () => {
    if (!confirmLeave) return setConfirmLeave(true);
    setConfirmLeave(false);
    if (!(await leave())) setStatus(t('alliance.failed'));
  };

  const onCopy = async () => {
    if (!view?.code) return;
    try {
      await navigator.clipboard.writeText(view.code);
      setStatus(t('alliance.copied'));
    } catch {
      setStatus(t('invite.clipboard'));
    }
  };

  const onShare = async () => {
    if (!view?.code) return;
    const ok = await pickSharer().share(`${t('alliance.sharePitch', { code: view.code })}\n${PLAY_URL}`);
    if (!ok) setStatus(t('invite.none'));
  };

  return (
    <div className="card alliance" data-testid="alliance">
      <h3>{t('alliance.title')}</h3>
      {info.status === 'loading' && <p className="sub" role="status">{t('alliance.loading')}</p>}
      {info.status === 'error' && (
        <>
          <p className="sub warn" role="status">{t('alliance.offline')}</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => void refresh()}>{t('alliance.retry')}</button>
          </div>
        </>
      )}
      <p className="sub" role="status" aria-live="polite">{status}</p>

      {info.status === 'none' && (
        <>
          <p className="sub">{t('alliance.desc', { n: ALLIANCE_MAX })}</p>
          <div className="modal-actions">
            <button className="btn btn-primary" disabled={info.busy} onClick={() => void onJoin('random')}>{t('alliance.joinRandom')}</button>
            <button className="btn" disabled={info.busy} onClick={() => void onJoin('create')}>{t('alliance.create')}</button>
          </div>
          <label className="sub" htmlFor="alliance-code">{t('alliance.codeLabel')}</label>
          <div className="modal-actions">
            <input
              id="alliance-code"
              className="mono save-code alliance-code-input"
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABC234"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="btn" disabled={info.busy || code.trim().length !== 6} onClick={() => void onJoin('code')}>{t('alliance.joinCode')}</button>
          </div>
        </>
      )}

      {view && (
        <>
          <p className="alliance-name">
            <strong>{view.name}</strong> <span className="sub mono">{t('alliance.membersCount', { n: view.size, max: ALLIANCE_MAX })}</span>
          </p>
          {view.code && (
            <div className="daily-meta">
              <span className="sub">{t('alliance.codeLabel')} <span className="mono">{view.code}</span></span>
              <span className="modal-actions">
                <button className="btn btn-ghost" onClick={() => void onCopy()}>{t('alliance.copy')}</button>
                <button className="btn btn-ghost" onClick={() => void onShare()}>{t('alliance.share')}</button>
              </span>
            </div>
          )}
          <p className="sub">{t('alliance.week', { n: n(stamps), goal: n(goal) })}</p>
          <div className="bar" role="progressbar" aria-label={t('alliance.weekAria')} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(stamps, goal)}>
            <div className="bar-fill" style={{ width: Math.min(100, (stamps / goal) * 100) + '%' }} />
          </div>
          <p className="sub">{t('alliance.weekNote')}</p>
          {ALLIANCE_TIERS.map((tier, i) => {
            const done = taken.includes(i);
            return (
              <div key={i} className="daily-meta">
                <span className="mono sub">
                  {t('alliance.tier', { n: i + 1, stamps: n(tier.stamps) })}
                  {' '}<span className="amt">+{tier.vouchers} <VoucherIcon size={14} /><span className="visually-hidden">{t('invite.vouchers')}</span></span>
                  {tier.seals > 0 && <> <span className="amt">+{tier.seals} <SealIcon size={14} /><span className="visually-hidden">{t('event.seals')}</span></span></>}
                </span>
                {done
                  ? <span className="mono claimed-label">{t('invite.claimed')}</span>
                  : <button className="btn btn-primary" aria-label={t('alliance.claimAria', { n: i + 1 })} disabled={stamps < tier.stamps} onClick={() => claim(i)}>{t('invite.claim')}</button>}
              </div>
            );
          })}
          <div className="modal-actions">
            <button className="btn" onClick={() => setSheet('members')}>{t('alliance.members')}</button>
            <button className="btn" onClick={() => setSheet('ranking')}>{t('alliance.ranking')}</button>
            <button className="btn btn-ghost" disabled={info.busy} onClick={() => void onLeave()}>
              {confirmLeave ? t('alliance.leaveConfirm') : t('alliance.leave')}
            </button>
          </div>
        </>
      )}

      {sheet === 'members' && (
        <BoardSheet
          title={t('alliance.members')}
          view={membersView}
          load={loadMembers}
          unit={t('alliance.stampsUnit')}
          totalText={(total) => t('alliance.membersCount', { n: total, max: ALLIANCE_MAX })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'ranking' && (
        <BoardSheet
          title={t('alliance.ranking')}
          view={rankingView}
          load={loadRanking}
          unit={t('alliance.stampsUnit')}
          totalText={(total) => t('alliance.rankingTotal', { n: total })}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
