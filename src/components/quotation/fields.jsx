import { CircleAlert } from 'lucide-react';

/** Shared bits: required marker and error line. */
export const Required = () => (
  <>
    <span aria-hidden="true" className="ml-0.5 text-error">
      *
    </span>
    <span className="sr-only"> (required)</span>
  </>
);

export function ErrorText({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="error-text">
      <CircleAlert aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Labelled single-line control. Wires label, hint and error to the input for assistive tech.
 */
export function TextField({
  name,
  label,
  required = false,
  optionalNote,
  hint,
  error,
  value,
  onChange,
  onBlur,
  type = 'text',
  as = 'input',
  className = '',
  ...rest
}) {
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const Control = as;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required ? <Required /> : optionalNote ? <span className="ml-1.5 font-normal text-stone">{optionalNote}</span> : null}
      </label>
      <Control
        id={id}
        name={name}
        type={as === 'input' ? type : undefined}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        onBlur={() => onBlur?.(name)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        className="input"
        {...rest}
      />
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
      <ErrorText id={errId}>{error}</ErrorText>
    </div>
  );
}
