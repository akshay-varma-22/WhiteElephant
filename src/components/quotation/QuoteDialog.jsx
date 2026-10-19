import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Phone, X } from 'lucide-react';
import { BUSINESS } from '../../config/site.js';
import QuotationForm from './QuotationForm.jsx';

const QuoteContext = createContext({ openQuote: () => {} });

/** `const { openQuote } = useQuote()`: opens the free-quotation popup from any button on the page. */
export const useQuote = () => useContext(QuoteContext);

const OLD_LINK_HASH = '#quotation';

/**
 * The free-quotation form as a popup (a native modal <dialog>: Escape closes it, focus stays inside it, the page behind
 * is not reachable, and focus goes back to the button that opened it).
 * Wrap the page in <QuoteProvider> and give any button `onClick={openQuote}`. A link to `#quotation` (the form used to be a
 * section with that id) still works: it opens the popup.
 */
export function QuoteProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false); // the enquiry has been sent: show the thank-you without the intro text
  const [formKey, setFormKey] = useState(0); // a new key gives the next visitor a fresh, empty form
  const dialogRef = useRef(null);
  const panelRef = useRef(null);
  const sentRef = useRef(false);

  const openQuote = useCallback(() => setOpen(true), []);
  const closeQuote = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const openFromLink = () => {
      if (window.location.hash !== OLD_LINK_HASH) return;
      window.history.replaceState(null, '', window.location.pathname + window.location.search); // so the link works again next time
      setOpen(true);
    };
    openFromLink();
    window.addEventListener('hashchange', openFromLink);
    return () => window.removeEventListener('hashchange', openFromLink);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // With a mouse or keyboard, start typing straight away. On a phone keep the keyboard down until the visitor taps a field.
      if (window.matchMedia('(pointer: fine)').matches) document.getElementById('field-name')?.focus();
      else panelRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    // Closing keeps what the visitor has typed (so an accidental close loses nothing), except that a sent enquiry, or a form
    // nothing was typed into, starts fresh next time: no thank-you screen, and no error left behind by the field that
    // was focused when the popup closed.
    const typed = [...(dialogRef.current?.querySelectorAll('form input:not([tabindex="-1"])') ?? [])].some((i) => i.value.trim());
    if (sentRef.current || !typed) {
      sentRef.current = false;
      setSent(false);
      setFormKey((k) => k + 1);
    }
  };

  const value = useMemo(() => ({ openQuote }), [openQuote]);

  return (
    <QuoteContext.Provider value={value}>
      {children}
      <dialog
        ref={dialogRef}
        aria-label="Request your free quotation"
        onClose={handleClose}
        onClick={(e) => e.target === dialogRef.current && closeQuote()}
        className="quote-dialog"
      >
        <div ref={panelRef} tabIndex={-1} className="quote-panel">
          <button type="button" onClick={closeQuote} aria-label="Close" className="quote-close">
            <X aria-hidden="true" strokeWidth={1.5} />
          </button>
          {!sent && (
            <>
              <h2 className="quote-title">Request your free quotation</h2>
              <p className="quote-intro">Leave your name, mobile number and email and our team will get in touch.</p>
            </>
          )}
          <div className="quote-body">
            <QuotationForm
              key={formKey}
              embedded
              onSuccess={() => {
                sentRef.current = true;
                setSent(true);
              }}
              onReset={() => {
                sentRef.current = false;
                setSent(false);
              }}
            />
          </div>
          {!sent && (
            <div className="quote-call">
              <p>Let’s connect?</p>
              <ul>
                {BUSINESS.phones.map((p) => (
                  <li key={p.e164}>
                    <a href={`tel:${p.e164}`}>
                      <Phone aria-hidden="true" className="h-4 w-4" />
                      {p.display}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </dialog>
    </QuoteContext.Provider>
  );
}
