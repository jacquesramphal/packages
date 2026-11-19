// Stateline for Vue 3, by Jacques Ramphal. MIT.
// https://ramphal.design/doc/make-it-pop
//
//   import { StatelineField, StatelineCheckbox } from '@jacquesramphal/stateline/vue';
//
// Plain render functions, so there's nothing to compile. Each component
// renders a real form element, enhances it on mount and cleans up on unmount.
import * as Vue from 'vue';
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Stateline from './stateline.js';

let uid = 0;
// useId (Vue 3.5+) keeps server and client ids the same; older Vue gets a counter.
const nextId = (prefix) => `${prefix}-${Vue.useId ? Vue.useId() : ++uid}`;

const ARROW = () => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [h('path', { d: 'M5 12h14M13 6l6 6-6 6' })]);

export const StatelineField = defineComponent({
  name: 'StatelineField',
  props: {
    modelValue: { type: String, default: '' },
    id: { type: String, default: undefined },
    label: { type: String, default: 'Email address' },
    name: { type: String, default: 'email' },
    type: { type: String, default: 'email' },
    placeholder: { type: String, default: 'you@example.com' },
    autocomplete: { type: String, default: 'email' },
    required: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    buttonLabel: { type: String, default: 'Subscribe' },
    arrow: { type: Boolean, default: true },
    hint: { type: String, default: '' },
    action: { type: String, default: undefined },
    method: { type: String, default: 'post' },
    messages: { type: Object, default: undefined },
    suggest: { type: [Boolean, Function], default: true },
    look: { type: String, default: 'essay' },
    options: { type: Object, default: () => ({}) },
    onSubmit: { type: Function, default: undefined },
    unstyled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'state'],
  setup(props, { emit, expose }) {
    const form = ref(null);
    const box = ref(null);
    const input = ref(null);
    const message = ref(null);
    const id = props.id || nextId('stateline');
    let made = null;

    const mount = () => {
      if (!props.unstyled) Stateline.addStyles();
      made = Stateline.field(form.value, {
        ...props.options,
        look: props.look,
        // Functions are read when they're called, so a new one each render
        // doesn't re-enhance the field.
        suggest: typeof props.suggest === 'function' ? (v) => props.suggest(v) : props.suggest,
        messages: props.messages,
        input: input.value,
        box: box.value,
        message: message.value,
        onSubmit: props.onSubmit ? (...args) => props.onSubmit(...args) : undefined,
        // Deferred a tick, so a parent reacting to the state never re-renders
        // in the middle of the input's own event.
        onState: (state) => setTimeout(() => {
          // A send clears the input; keep v-model in step.
          if (state === 'sent' && props.modelValue) emit('update:modelValue', '');
          emit('state', state);
        }, 0),
      });
    };
    const unmount = () => { if (made) { made.destroy(); made = null; } };
    onMounted(mount);
    onBeforeUnmount(unmount);
    // Re-enhance only when a setting really changes, not when the parent
    // re-renders with an equal object.
    const settings = () => JSON.stringify([props.look, typeof props.suggest === 'function' ? 'fn' : props.suggest, !!props.onSubmit, props.options, props.messages]);
    watch(settings, () => { unmount(); mount(); });

    expose({ set: (state) => made && made.set(state), get field() { return made; } });

    return () => h('form', { ref: form, class: 'stateline-field', action: props.action, method: props.method }, [
      h('label', { class: 'stateline-field__label', for: id }, props.label),
      h('div', { ref: box, class: 'stateline-box' }, [
        h('input', {
          ref: input,
          id,
          class: 'stateline-field__input',
          name: props.name,
          type: props.type,
          placeholder: props.placeholder,
          autocomplete: props.autocomplete,
          required: props.required,
          disabled: props.disabled,
          value: props.modelValue,
          'aria-describedby': `${id}-msg`,
          onInput: (e) => emit('update:modelValue', e.target.value),
        }),
        h('button', {
          class: 'stateline-field__send',
          type: 'submit',
          disabled: props.disabled,
          'aria-label': props.arrow ? props.buttonLabel : undefined,
        }, props.arrow ? [ARROW()] : props.buttonLabel),
      ]),
      // Stateline writes the messages here; Vue leaves it alone.
      h('p', { ref: message, id: `${id}-msg`, class: 'stateline-field__message', role: 'status', 'aria-live': 'polite' }),
      props.hint ? h('p', { class: 'stateline-field__hint' }, props.hint) : null,
    ]);
  },
});

export const StatelineCheckbox = defineComponent({
  name: 'StatelineCheckbox',
  props: {
    modelValue: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    label: { type: String, default: '' },
    name: { type: String, default: undefined },
    value: { type: String, default: 'on' },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    state: { type: String, default: 'rest' },
    size: { type: Number, default: 24 },
    line: { type: Number, default: 2 },
    unstyled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    const input = ref(null);
    const id = props.id || nextId('stateline-check');
    let made = null;

    const mount = () => {
      if (!props.unstyled) Stateline.addStyles();
      made = Stateline.checkbox(input.value, { size: props.size, line: props.line });
      if (props.state === 'error') made.set('error');
    };
    const unmount = () => { if (made) { made.destroy(); made = null; } };
    onMounted(mount);
    onBeforeUnmount(unmount);
    watch(() => [props.size, props.line], () => { unmount(); mount(); });
    watch(() => props.state, (s) => made && made.set(s));
    // Set from outside: tick or rub out with the motion, as if clicked.
    watch(() => props.modelValue, (v) => {
      const el = input.value;
      if (el && el.checked !== v) { el.checked = v; el.dispatchEvent(new Event('change')); }
    });

    return () => h('label', { class: 'stateline-check', for: id }, [
      h('input', {
        ref: input,
        id,
        type: 'checkbox',
        name: props.name,
        value: props.value,
        checked: props.modelValue,
        required: props.required,
        disabled: props.disabled,
        onChange: (e) => { emit('update:modelValue', e.target.checked); emit('change', e); },
      }),
      h('span', { class: 'stateline-check__label' }, slots.default ? slots.default() : props.label),
    ]);
  },
});

export default { StatelineField, StatelineCheckbox };
