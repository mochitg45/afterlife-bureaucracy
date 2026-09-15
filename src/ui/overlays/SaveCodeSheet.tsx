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
      setStatus('Copied to the clipboard.');
    } catch {
      setStatus('The clipboard refused. Select the code and copy it by hand.');
    }
  };

  const onImport = async () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    const result = await importSaveCode(typed.trim());
    if (result === 'ok') {
      setStatus('Save imported.');
      onClose();
      return;
    }
    setStatus('That code could not be read. Your current save is untouched.');
  };

  return (
    <Modal open={open} title="Save code" onClose={onClose}>
      <p className="sub" role="status" aria-live="polite">{status}</p>

      <label className="label" htmlFor="save-code-export">Your save code</label>
      <textarea id="save-code-export" className="mono save-code" readOnly rows={4} value={code} />
      <div className="modal-actions">
        <button className="btn" onClick={() => void onCopy()}>Copy</button>
      </div>

      <label className="label" htmlFor="save-code-import">Paste a save code</label>
      <textarea
        id="save-code-import"
        className="mono save-code"
        rows={4}
        value={typed}
        onChange={(e) => { setTyped(e.target.value); setConfirming(false); }}
      />
      {confirming && <p className="sub warn">Importing replaces your current save. There is no undo.</p>}
      <div className="modal-actions">
        <button
          className={'btn ' + (confirming ? 'btn-primary' : '')}
          disabled={typed.trim().length === 0}
          onClick={() => void onImport()}
        >
          Import
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
