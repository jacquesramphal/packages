// Stateline for React 17+, by Jacques Ramphal. MIT.
// https://ramphal.design/doc/make-it-pop
//
//   import { StatelineField, StatelineCheckbox } from '@jacquesramphal/stateline/react';
//
// Plain createElement, so there's nothing to compile. Each component renders
// a real form element, enhances it after mount and cleans up on unmount.
// Works as a client component in Next ('use client' is set below).
'use client';
import * as React from 'react';
import { createElement as h, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Stateline from './stateline.js';

let uid = 0;
// useId (React 18+) keeps server and client ids the same; 17 gets a counter.
const useId = React.useId || (() => useState(() => `${++uid}`)[0]);
function useStableId(given, prefix) {
  const id = useId();
  return given || `${prefix}-${String(id).replace(/:/g, '')}`;
}

// The latest value of a prop, readable from inside a callback made once.
function useLatest(value) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

const ARROW = h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M5 12h14M13 6l6 6-6 6' }));

export const StatelineField = forwardRef(function StatelineField(props, ref) {
  const {
    value, defaultValue, onValueChange, onStateChange, onSubmit,
    id: givenId, label = 'Email address', name = 'email', type = 'email',
    placeholder = 'you@example.com', autoComplete = 'email', required = true, disabled = false,
    buttonLabel = 'Subscribe', arrow = true, hint = '', action, method = 'post',
    messages, suggest = true, look = 'essay', options, unstyled = false, className,
  } = props;
  const id = useStableId(givenId, 'stateline');
  const form = useRef(null);
  const box = useRef(null);
  const input = useRef(null);
  const message = useRef(null);
  const made = useRef(null);
  const latest = useLatest({ onSubmit, onStateChange, onValueChange, suggest, value });

  // Re-enhance only when a setting really changes, not on every render.
  const settings = JSON.stringify([look, typeof suggest === 'function' ? 'fn' : suggest, !!onSubmit, options, messages]);
  useEffect(() => {
    if (!unstyled) Stateline.addStyles();
    made.current = Stateline.field(form.current, {
      ...options,
      look,
      suggest: typeof suggest === 'function' ? (v) => latest.current.suggest(v) : suggest,
      messages,
      input: input.current,
      box: box.current,
      message: message.current,
      onSubmit: onSubmit ? (...args) => latest.current.onSubmit(...args) : undefined,
      // Deferred to a task: the state changes inside the input's own event,
      // and a parent re-rendering right then would reset a controlled value
      // before React's onChange has read the keystroke.
      onState: (state) => setTimeout(() => {
        // A send clears the input; keep a controlled value in step.
        if (state === 'sent' && latest.current.value && latest.current.onValueChange) latest.current.onValueChange('');
        if (latest.current.onStateChange) latest.current.onStateChange(state);
      }, 0),
    });
    return () => { made.current.destroy(); made.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, unstyled]);

  useImperativeHandle(ref, () => ({
    set: (state) => made.current && made.current.set(state),
    get form() { return form.current; },
    get input() { return input.current; },
  }), []);

  const controlled = value !== undefined;
  return h('form', { ref: form, className: ['stateline-field', className].filter(Boolean).join(' '), action, method },
    h('label', { className: 'stateline-field__label', htmlFor: id }, label),
    h('div', { ref: box, className: 'stateline-box' },
      h('input', {
        ref: input,
        id,
        className: 'stateline-field__input',
        name, type, placeholder, autoComplete, required, disabled,
        'aria-describedby': `${id}-msg`,
        ...(controlled ? { value } : { defaultValue }),
        onChange: (e) => { if (onValueChange) onValueChange(e.target.value); },
      }),
      h('button', {
        className: 'stateline-field__send',
        type: 'submit',
        disabled,
        'aria-label': arrow ? buttonLabel : undefined,
      }, arrow ? ARROW : buttonLabel),
    ),
    // Stateline writes the messages here, so React never renders into it.
    h('p', { ref: message, id: `${id}-msg`, className: 'stateline-field__message', role: 'status', 'aria-live': 'polite', suppressHydrationWarning: true }),
    hint ? h('p', { className: 'stateline-field__hint' }, hint) : null,
  );
});

export const StatelineCheckbox = forwardRef(function StatelineCheckbox(props, ref) {
  const {
    checked, defaultChecked, onCheckedChange, onChange,
    id: givenId, label, children, name, value = 'on', required = false, disabled = false,
    state = 'rest', size = 24, line = 2, unstyled = false, className,
  } = props;
  const id = useStableId(givenId, 'stateline-check');
  const input = useRef(null);
  const made = useRef(null);

  useEffect(() => {
    if (!unstyled) Stateline.addStyles();
    made.current = Stateline.checkbox(input.current, { size, line });
    if (state === 'error') made.current.set('error');
    return () => { made.current.destroy(); made.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, line, unstyled]);
  useEffect(() => { if (made.current) made.current.set(state); }, [state]);
  // Set from outside (a reset, another control): React sets .checked
  // without an event, so play the tick or the rub-out here.
  const lastChecked = useRef(checked);
  useEffect(() => {
    if (checked === undefined || checked === lastChecked.current) return;
    lastChecked.current = checked;
    if (input.current) input.current.dispatchEvent(new Event('change'));
  }, [checked]);

  useImperativeHandle(ref, () => ({ set: (s) => made.current && made.current.set(s), get input() { return input.current; } }), []);

  const controlled = checked !== undefined;
  return h('label', { className: ['stateline-check', className].filter(Boolean).join(' '), htmlFor: id },
    h('input', {
      ref: input,
      id,
      type: 'checkbox',
      name, value, required, disabled,
      ...(controlled ? { checked } : { defaultChecked }),
      onChange: (e) => {
        // A click already played the motion; don't play it again when the
        // parent hands the new value back.
        lastChecked.current = e.target.checked;
        if (onCheckedChange) onCheckedChange(e.target.checked);
        if (onChange) onChange(e);
      },
    }),
    h('span', { className: 'stateline-check__label' }, children != null ? children : label),
  );
});

export default { StatelineField, StatelineCheckbox };
