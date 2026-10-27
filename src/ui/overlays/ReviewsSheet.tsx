import { useGame } from '../../store/game';
import { reviewTemplates } from '../../data';
import { reputationMult } from '../../engine/reviews';
import { Modal } from '../components/Modal';
import { ReviewStars as Stars } from '../components/ReviewStars';
import { t } from '../../i18n';
import './ReviewsSheet.css';

const byId = new Map(reviewTemplates.map((r) => [r.id, r]));

/** The review feed (latest 20) with the office's average-star Reputation meter. */
export function ReviewsSheet({ onClose }: { onClose: () => void }) {
  const rep = useGame((s) => s.state.reputation);
  const respond = useGame((s) => s.respondComplaint);
  const bonusPct = Math.round((reputationMult(rep.score) - 1) * 1000) / 10;
  const feed = rep.reviews.map((r) => ({ r, tpl: byId.get(r.id) })).filter((x) => x.tpl);
  return (
    <Modal open title={t('reviews.title')} className="reviews-sheet" onClose={onClose}>
      <div className="rep-meter">
        <div className="rep-score mono">{rep.score.toFixed(1)}</div>
        <div>
          <div className="label">{t('reviews.reputation')}</div>
          <Stars value={rep.score} size={20} />
        </div>
      </div>
      <p className="sub rep-bonus mono">{bonusPct > 0 ? t('reviews.bonus', { pct: bonusPct }) : t('reviews.bonusNone')}</p>
      <p className="sub">{t('reviews.hint')}</p>
      {feed.length === 0 && <p className="sub" role="status">{t('reviews.empty')}</p>}
      <ul className="review-list">
        {feed.map(({ r, tpl }) => (
          <li key={r.n} className={'review' + (r.complaint ? ' complaint' : '')}>
            <div className="review-head">
              <span aria-label={t('reviews.starsAria', { n: tpl!.stars })}><Stars value={tpl!.stars} size={13} /></span>
              <span className="review-who"><strong>{tpl!.who}</strong> <span className="sub mono">{tpl!.handle}</span></span>
            </div>
            <p className="review-text">{tpl!.text}</p>
            {r.complaint && r.reply === undefined && (
              <button className="btn btn-primary review-respond" onClick={() => respond(r.n)}>{t('reviews.respond')}</button>
            )}
            {r.complaint && r.reply !== undefined && (
              <p className="review-reply"><span className="label mono">{t('reviews.responded')}</span> {t(`reviews.reply.${r.reply}`)}</p>
            )}
          </li>
        ))}
      </ul>
      <button className="btn btn-ghost reviews-close" onClick={onClose}>{t('reviews.close')}</button>
    </Modal>
  );
}
