import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise;

function loadScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT_SRC;
    el.async = true;
    el.onload = () => resolve(window.turnstile);
    el.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('turnstile failed to load'));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

/**
 * Optional Cloudflare Turnstile widget. Rendered only when a site key is configured
 * (VITE_TURNSTILE_SITE_KEY). Tokens are single-use, so the parent calls reset() after every attempt.
 */
const Turnstile = forwardRef(function Turnstile({ siteKey, onToken, onError }, ref) {
  const container = useRef(null);
  const widgetId = useRef(null);

  useImperativeHandle(ref, () => ({
    reset() {
      onToken('');
      if (widgetId.current != null && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        widgetId.current = turnstile.render(container.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => {
            onToken('');
            onError?.();
          },
        });
      })
      .catch(() => onError?.());
    return () => {
      cancelled = true;
      if (widgetId.current != null && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={container} className="min-h-[65px]" data-testid="turnstile" />;
});

export default Turnstile;
