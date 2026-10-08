import { t } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { useGame, TRAINING_DONE } from '../../store/game';
import { content as shippedContent } from '../../data';
import type { Content, TipDef, TipId } from '../../engine/content';
import type { GameState } from '../../engine/state';
import { findDepartment } from '../../engine/content';
import { canAfford, maxAffordable, nextMilestone, upgradeCost, upgradeLevel } from '../../engine/economy';
import { canAudit } from '../../engine/prestige';
import { dupesForNextStar, MAX_STARS, PITY_SENIOR, PULL_COST, TEN_PULL_COST } from '../../engine/gacha';
import { CoachMark } from '../components/CoachMark';
import type { TabId } from '../components/TabBar';

export interface TipContext {
  tab: TabId;
  /** The first Backlog Report of this session has been opened and closed. */
  offlineClosed: boolean;
}

export interface ShownTip { id: TipId; target: string; title: string; text: string }

function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

/**
 * Whether a tip is relevant right now, and the values its text needs. Returns null when it is
 * not; each branch is the "first relevance" moment named in the tip's own copy.
 */
function relevant(id: TipId, s: GameState, content: Content, ctx: TipContext): Record<string, string | number> | null {
  const office = ctx.tab === 'office';
  const dept = office ? findDepartment(content, s.activeDept) : null;
  const lead = dept?.staff[0];
  const leadOwned = lead ? s.staff[lead.id] ?? 0 : 0;
  switch (id) {
    case 'speed-bar':
      return office && leadOwned > 0 ? {} : null;
    case 'staff-milestone':
      return office && leadOwned > 0 && s.stats.staffHired >= 2 ? { next: nextMilestone(leadOwned) } : null;
    case 'buy-mode':
      return office && dept!.staff.some((st) => maxAffordable(st, s.staff[st.id] ?? 0, s.kc) >= 2) ? {} : null;
    case 'upgrades': {
      const u = dept?.upgrades[0];
      if (!u) return null;
      const level = upgradeLevel(s, u.id);
      return level < u.maxLevel && canAfford(upgradeCost(u, level), s.kc) ? {} : null;
    }
    case 'offline':
      return ctx.offlineClosed ? {} : null;
    case 'dept-unlock':
      return office && s.deptsUnlocked.length > 1 ? {} : null;
    case 'personnel-intro':
      return ctx.tab === 'personnel' ? { pull: PULL_COST, ten: TEN_PULL_COST, pity: PITY_SENIOR, free: t('tips.freePull') } : null;
    case 'equip':
      return ctx.tab === 'personnel' && s.stats.pulls > 0 ? {} : null;
    case 'stars': {
      if (ctx.tab !== 'personnel') return null;
      for (const [cardId, stars] of Object.entries(s.cards)) {
        const shards = s.cardShards[cardId] ?? 0;
        if (stars < 2 && shards === 0) continue;
        const card = content.cards.find((c) => c.id === cardId);
        if (!card) continue;
        const need = stars >= MAX_STARS ? 0 : dupesForNextStar(card.rarity, stars) - shards;
        return { card: card.name, need };
      }
      return null;
    }
    case 'tasks-intro':
      return ctx.tab === 'tasks' ? {} : null;
    case 'ledger-intro':
      return ctx.tab === 'ledger' || canAudit(s) ? {} : null;
  }
}

/** The first unseen tip, in content order, that is relevant now; null if none is. */
export function pickTip(state: GameState, content: Content, ctx: TipContext): ShownTip | null {
  if (!state.onboarding.memosSeen || state.onboarding.trainingStep < TRAINING_DONE) return null;
  for (const tip of content.onboarding.tips as TipDef[]) {
    if (state.onboarding.tipsSeen.includes(tip.id)) continue;
    const values = relevant(tip.id, state, content, ctx);
    if (values) return { id: tip.id, target: tip.target, title: tip.title, text: fill(tip.text, values) };
  }
  return null;
}

/** Any dialog on screen (a report, a ceremony, a card sheet, Settings) or the intro cutscene. */
const MODAL_SELECTOR = '.modal-backdrop, .intro';

/** Whether a modal is open, kept current by watching the DOM rather than every store flag. */
function useModalOpen(): boolean {
  const [open, setOpen] = useState(() => !!document.querySelector(MODAL_SELECTOR));
  useEffect(() => {
    const check = () => setOpen(!!document.querySelector(MODAL_SELECTOR));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return open;
}

/**
 * One-time beginner tips: coach marks that appear on first relevance, one at a time, only
 * after Training and never over another dialog. Read or skipped, a tip is marked seen.
 */
export function Tips({ tab }: { tab: TabId }) {
  const modalOpen = useModalOpen();
  const pendingOffline = useGame((s) => s.pendingOffline);
  const markTipSeen = useGame((s) => s.markTipSeen);
  const [offlineClosed, setOfflineClosed] = useState(false);
  const sawReport = useRef(false);
  useEffect(() => {
    if (pendingOffline) sawReport.current = true;
    else if (sawReport.current) setOfflineClosed(true);
  }, [pendingOffline]);
  // Selected as a string so the tick loop re-renders this only when the tip itself changes.
  const key = useGame((s) => JSON.stringify(pickTip(s.state, shippedContent, { tab, offlineClosed })));
  const tip = JSON.parse(key) as ShownTip | null;
  if (!tip || modalOpen) return null;
  const done = () => markTipSeen(tip.id);
  return (
    <CoachMark key={tip.id} target={tip.target} title={tip.title} text={tip.text} label={t('tips.label')} onSkip={done}>
      <button className="btn btn-primary" onClick={done}>{t('tips.gotIt')}</button>
    </CoachMark>
  );
}
