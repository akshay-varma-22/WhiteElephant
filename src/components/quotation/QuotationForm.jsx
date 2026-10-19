import { useCallback, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, LoaderCircle, RotateCcw, Send } from 'lucide-react';
import { HONEYPOT_FIELD, LIMITS } from '../../../shared/quotation-options.js';
import { FIELD_ORDER, validateQuotation } from '../../../shared/quotation-validation.js';
import { BUSINESS, SITE } from '../../config/site.js';
import { SubmitError, submitQuotation } from '../../lib/submitQuotation.js';
import { TextField } from './fields.jsx';
import Turnstile from './Turnstile.jsx';

const FIELD_LABELS = {
  name: 'Full name',
  phone: 'Mobile number',
  email: 'Email address',
};

const newSubmissionId = () =>
  globalThis.crypto?.randomUUID?.() ?? `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const initialForm = () => ({
  name: '',
  phone: '',
  email: '',
  [HONEYPOT_FIELD]: '',
});

const phoneLinks = BUSINESS.phones;

function formErrorMessage(kind) {
  switch (kind) {
    case 'network':
      return 'We couldn’t reach our server. Please check your internet connection and try again. Everything you entered is still here.';
    case 'rate_limited':
      return 'You have sent several requests in a short time. Please wait a few minutes and try again, or contact us directly.';
    case 'captcha':
      return 'We couldn’t verify that you are human. Please complete the check below and send your request again.';
    default:
      return 'Sorry, we couldn’t send your enquiry just now. Everything you entered is still here, so please try again in a moment.';
  }
}

/**
 * The quotation form: name, mobile number and email, all required.
 * Validation uses the same module as the server; the server's answer is the final word.
 *
 * `embedded` drops the card styling (border, shadow, padding) and stacks the fields in one column, for use inside the
 * quotation popup. `onSuccess` runs once the server has confirmed the enquiry; `onReset` runs when the visitor starts another.
 */
export default function QuotationForm({ fetchImpl, turnstileSiteKey = SITE.turnstileSiteKey, embedded = false, onSuccess, onReset }) {
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');

  const submittingRef = useRef(false); // synchronous guard: state updates are async, double clicks are not
  const submissionIdRef = useRef(newSubmissionId());
  const turnstileRef = useRef(null);
  const successHeadingRef = useRef(null);

  /* ---- validation (same module the server uses) ---- */
  const result = useMemo(() => validateQuotation(form), [form]);

  const visibleErrors = useMemo(() => {
    const out = {};
    for (const field of FIELD_ORDER) {
      const msg = serverErrors[field] ?? ((attempted || touched[field]) ? result.errors[field] : undefined);
      if (msg) out[field] = msg;
    }
    return out;
  }, [serverErrors, attempted, touched, result]);

  const setField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setServerErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);
  const touch = useCallback((name) => setTouched((t) => (t[name] ? t : { ...t, [name]: true })), []);

  const focusField = (name) => {
    const el = document.getElementById(`field-${name}`);
    if (el) el.focus();
  };

  /* ---- submit ---- */
  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return; // duplicate click / double Enter
    setAttempted(true);
    setFormError(null);

    const check = validateQuotation(form);
    if (!check.valid) {
      const first = FIELD_ORDER.find((f) => check.errors[f]);
      setAnnouncement(`There ${Object.keys(check.errors).length === 1 ? 'is 1 problem' : `are ${Object.keys(check.errors).length} problems`} with the form. Please review the highlighted fields.`);
      if (first) focusField(first);
      return;
    }
    if (turnstileSiteKey && !captchaToken) {
      setFormError({ kind: 'captcha' });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { reference, demo } = await submitQuotation(
        { ...form, submissionId: submissionIdRef.current, turnstileToken: captchaToken || undefined },
        { fetchImpl },
      );
      setSuccess({ name: check.values.name, reference, demo });
      onSuccess?.();
      setTimeout(() => successHeadingRef.current?.focus(), 50);
    } catch (err) {
      const error = err instanceof SubmitError ? err : new SubmitError('server');
      if (error.kind === 'validation' && error.errors) {
        setServerErrors(error.errors);
        const first = FIELD_ORDER.find((f) => error.errors[f]);
        if (first) focusField(first);
      } else {
        setFormError({ kind: error.kind });
      }
    } finally {
      // Captcha tokens are single-use: always request a fresh one before the next attempt.
      turnstileRef.current?.reset();
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function startAnother() {
    setForm(initialForm());
    setTouched({});
    setServerErrors({});
    setAttempted(false);
    setFormError(null);
    setSuccess(null);
    submissionIdRef.current = newSubmissionId();
    onReset?.();
  }

  /* ---- derived UI state ---- */
  const errorEntries = FIELD_ORDER.filter((f) => visibleErrors[f]);
  const showSummary = errorEntries.length > 0 && (attempted || Object.values(serverErrors).some(Boolean));

  /* ---- success view ---- */
  if (success) {
    return (
      <div
        className={embedded ? 'py-4 text-center' : 'border border-line bg-white p-8 text-center sm:p-12'}
        data-testid="quotation-success"
      >
        <CircleCheck aria-hidden="true" className="mx-auto h-14 w-14 text-success" strokeWidth={1.4} />
        {success.demo && (
          <p
            role="note"
            data-testid="demo-notice"
            className="mx-auto mb-6 max-w-md border border-gold bg-cream px-4 py-3 text-left text-sm text-brown"
          >
            <strong className="font-medium">Preview mode.</strong> This site is running against a test inbox on this computer, so
            no real email was sent. Real delivery starts once the email service is connected (see docs/DEPLOYMENT.md).
          </p>
        )}
        <h3 ref={successHeadingRef} tabIndex={-1} className="mt-5 font-serif text-3xl focus:outline-none sm:text-4xl">
          Thank you, {success.name.split(' ')[0]}
        </h3>
        <p role="status" className="mx-auto mt-4 max-w-md text-stone">
          Your enquiry has been sent to White Elephant Creative Studio. Our team will review your details and get in touch to
          discuss the next steps.
        </p>
        {success.reference && (
          <p className="mt-4 text-sm text-stone">
            Reference: <strong className="font-semibold tracking-wider text-charcoal">{success.reference}</strong>
          </p>
        )}
        <p className="mx-auto mt-4 max-w-md text-sm text-stone">
          Prefer to talk sooner? Call{' '}
          {phoneLinks.map((p, i) => (
            <span key={p.e164}>
              {i > 0 && ' or '}
              <a className="font-medium text-bronze underline underline-offset-2" href={`tel:${p.e164}`}>
                {p.display}
              </a>
            </span>
          ))}
          .
        </p>
        <button type="button" onClick={startAnother} className="btn btn-outline mt-8">
          <RotateCcw aria-hidden="true" className="h-4 w-4" /> Send another enquiry
        </button>
      </div>
    );
  }

  /* ---- form view ---- */
  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={submitting}
      aria-label="Get a free quotation"
      className={embedded ? 'relative' : 'relative border border-line bg-white p-6 shadow-soft sm:p-10'}
      data-testid="quotation-form"
    >
      <div role="status" aria-live="polite" className="sr-only" data-testid="live-region">
        {announcement}
        {submitting ? ' Sending your enquiry, please wait.' : ''}
      </div>

      {showSummary && (
        <div
          role="alert"
          className={`border border-error/40 bg-error/[0.05] text-[0.95rem] ${embedded ? 'mb-4 px-3 py-2.5' : 'mb-8 p-4'}`}
          data-testid="error-summary"
        >
          <p className="flex items-center gap-2 font-medium text-error">
            <CircleAlert aria-hidden="true" className="h-5 w-5" />{' '}
            {embedded ? 'Please check the highlighted fields.' : 'Please check the following:'}
          </p>
          {/* In the popup every problem is already written under its own field, so the list is only for screen readers (as plain text). */}
          <ul className={embedded ? 'sr-only' : 'mt-2 list-disc space-y-1 pl-9'}>
            {errorEntries.map((f) => (
              <li key={f}>
                {embedded ? (
                  FIELD_LABELS[f]
                ) : (
                  <a
                    href={`#field-${f}`}
                    className="underline underline-offset-2"
                    onClick={(e) => {
                      e.preventDefault();
                      focusField(f);
                    }}
                  >
                    {FIELD_LABELS[f]}
                  </a>
                )}
                : {visibleErrors[f]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Honeypot: invisible to people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label>
          Company website (leave this field empty)
          <input
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
            value={form[HONEYPOT_FIELD]}
            onChange={(e) => setField(HONEYPOT_FIELD, e.target.value)}
          />
        </label>
      </div>

      <div className={embedded ? 'grid gap-3.5' : 'grid gap-5 sm:grid-cols-2'}>
        <TextField
          name="name"
          label="Full name"
          required
          autoComplete="name"
          placeholder="Please enter your name"
          value={form.name}
          onChange={setField}
          onBlur={touch}
          error={visibleErrors.name}
          maxLength={LIMITS.nameMax + 20}
        />
        <TextField
          name="phone"
          label="Mobile number"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Please enter your mobile number"
          value={form.phone}
          onChange={setField}
          onBlur={touch}
          error={visibleErrors.phone}
          hint={
            embedded
              ? 'Outside India? Include your country code, for example +44.'
              : 'Indian mobile numbers (with or without +91) and international numbers with a country code are accepted.'
          }
        />
        <TextField
          name="email"
          label="Email address"
          required
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Please enter your email"
          value={form.email}
          onChange={setField}
          onBlur={touch}
          error={visibleErrors.email}
          className={embedded ? '' : 'sm:col-span-2'}
        />
      </div>

      {turnstileSiteKey && (
        <div className="mt-6">
          <Turnstile
            ref={turnstileRef}
            siteKey={turnstileSiteKey}
            onToken={setCaptchaToken}
            onError={() => setFormError({ kind: 'captcha' })}
          />
        </div>
      )}

      {formError && (
        <div role="alert" className="mt-6 border border-error/40 bg-error/[0.05] p-4 text-[0.95rem]" data-testid="form-error">
          <p className="flex items-start gap-2 font-medium text-error">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{formErrorMessage(formError.kind)}</span>
          </p>
          {formError.kind !== 'captcha' && (
            <p className="mt-2 pl-7 text-charcoal">
              You can also call{' '}
              {phoneLinks.map((p, i) => (
                <span key={p.e164}>
                  {i > 0 && ' or '}
                  <a className="font-medium underline underline-offset-2" href={`tel:${p.e164}`}>
                    {p.display}
                  </a>
                </span>
              ))}{' '}
              or email{' '}
              <a className="font-medium underline underline-offset-2" href={`mailto:${BUSINESS.email}`}>
                {BUSINESS.email}
              </a>
              .
            </p>
          )}
        </div>
      )}

      <div className={embedded ? 'mt-5' : 'mt-8 flex flex-col gap-4 sm:flex-row sm:items-center'}>
        <button
          type="submit"
          disabled={submitting}
          // Pressing the button would first blur the field being edited, whose error message then appears and pushes this
          // button down before the click completes, so the first click was lost. Keeping focus where it is avoids that.
          onMouseDown={(e) => e.preventDefault()}
          className={`btn btn-primary disabled:cursor-wait disabled:opacity-80 ${embedded ? 'w-full' : 'min-w-[16rem]'}`}
        >
          {submitting ? (
            <>
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send aria-hidden="true" className="h-4 w-4" /> Request free quotation
            </>
          )}
        </button>
        {!embedded && (
          <p className="text-[0.82rem] text-stone">
            <span aria-hidden="true" className="text-error">
              *
            </span>{' '}
            Required fields
          </p>
        )}
      </div>
      <p className={embedded ? 'mt-3 text-[0.8rem] leading-snug text-stone' : 'mt-5 text-[0.82rem] leading-relaxed text-stone'}>
        {embedded && (
          <>
            <span aria-hidden="true" className="text-error">
              *
            </span>{' '}
            Required.{' '}
          </>
        )}
        We’ll only use your details to contact you about your enquiry.
      </p>
    </form>
  );
}
