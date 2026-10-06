import { t } from '../../i18n';
import { useMemo, useState } from 'react';
import { useGame } from '../../store/game';
import { Modal } from '../components/Modal';

/**
 * Manual save transfer: the v1.0 stand-in for Play Games Saved Games sync. Export hands the
 * player a code to keep; import replaces the running save, which is why it asks twice.
 */
export function SaveCodeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const exportSaveCode = useGame((s) => s.exportSaveCode);
  const importSaveCode = useGame((s) => s.importSaveCode);
  const [typed, setTyped] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState('');

  // Re-read only when the sheet opens: the code is a snapshot, not a live readout.
  const code = useMemo(() => (open ? exportSaveCode() : ''), [open, exportSaveCode]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setStatus(t('save.copied'));
    } catch {
      setStatus(t('save.clipboard'));
    }
  };

  const onImport = async () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    const result = await importSaveCode(typed.trim());
    if (result === 'ok') {
      setStatus(t('save.imported'));
      onClose();
      return;
    }
    setStatus(t('save.badCode'));
  };

  return (
    <Modal open={open} title={t('save.title')} onClose={onClose}>
      <p className="sub" role="status" aria-live="polite">{status}</p>

      <label className="label" htmlFor="save-code-export">{t('save.yours')}</label>
      <textarea id="save-code-export" className="mono save-code" readOnly rows={4} value={code} />
      <div className="modal-actions">
        <button className="btn" onClick={() => void onCopy()}>{t('save.copy')}</button>
      </div>

      <label className="label" htmlFor="save-code-import">{t('save.paste')}</label>
      <textarea
        id="save-code-import"
        className="mono save-code"
        rows={4}
        value={typed}
        onChange={(e) => { setTyped(e.target.value); setConfirming(false); }}
      />
      {confirming && <p className="sub warn">{t('save.warn')}</p>}
      <div className="modal-actions">
        <button
          className={'btn ' + (confirming ? 'btn-primary' : '')}
          disabled={typed.trim().length === 0}
          onClick={() => void onImport()}
        >
          {t('save.import')}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>{t('save.close')}</button>
      </div>
    </Modal>
  );
}
