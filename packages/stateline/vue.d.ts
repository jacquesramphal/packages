// Types for @jacquesramphal/stateline/vue, by Jacques Ramphal. MIT.
import type { DefineComponent } from 'vue';
import type { BorderFieldMessages, BorderFieldParams, BorderFieldState } from '@jacquesramphal/border-field';
import type { EmailSuggestion } from './stateline';

export interface StatelineFieldProps {
  /** v-model */
  modelValue?: string;
  id?: string;
  label?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  autocomplete?: string;
  required?: boolean;
  disabled?: boolean;
  /** The send button's accessible name, or its text when arrow is false. */
  buttonLabel?: string;
  arrow?: boolean;
  hint?: string;
  action?: string;
  method?: string;
  messages?: BorderFieldMessages;
  suggest?: boolean | ((value: string) => EmailSuggestion | null);
  look?: 'essay' | 'plain';
  /** Any border-field option: typing, error, loading, success, stroke, radius… */
  options?: BorderFieldParams;
  /** Resolve for sent, reject for the error. Without it the form submits natively. */
  onSubmit?: (value: string) => unknown | Promise<unknown>;
  /** Skip the default styles. */
  unstyled?: boolean;
}

export interface StatelineCheckboxProps {
  /** v-model */
  modelValue?: boolean;
  id?: string;
  label?: string;
  name?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  state?: 'rest' | 'error';
  size?: number;
  line?: number;
  unstyled?: boolean;
}

export declare const StatelineField: DefineComponent<StatelineFieldProps, {}, {}, {}, {}, {}, {}, {
  'update:modelValue': (value: string) => void;
  state: (state: BorderFieldState) => void;
}>;
export declare const StatelineCheckbox: DefineComponent<StatelineCheckboxProps, {}, {}, {}, {}, {}, {}, {
  'update:modelValue': (checked: boolean) => void;
  change: (event: Event) => void;
}>;
declare const _default: { StatelineField: typeof StatelineField; StatelineCheckbox: typeof StatelineCheckbox };
export default _default;
