// Types for @jacquesramphal/stateline/react, by Jacques Ramphal. MIT.
import type { ForwardRefExoticComponent, ReactNode, RefAttributes, ChangeEvent } from 'react';
import type { BorderFieldMessages, BorderFieldParams, BorderFieldState } from '@jacquesramphal/border-field';
import type { EmailSuggestion } from './stateline';

export interface StatelineFieldProps {
  /** Controlled value. Leave out (or use defaultValue) for uncontrolled. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onStateChange?: (state: BorderFieldState) => void;
  /** Resolve for sent, reject for the error. Without it the form submits natively. */
  onSubmit?: (value: string) => unknown | Promise<unknown>;
  id?: string;
  label?: ReactNode;
  name?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  /** The send button's accessible name, or its text when arrow is false. */
  buttonLabel?: string;
  arrow?: boolean;
  hint?: ReactNode;
  action?: string;
  method?: string;
  messages?: BorderFieldMessages;
  suggest?: boolean | ((value: string) => EmailSuggestion | null);
  look?: 'essay' | 'plain';
  /** Any border-field option: typing, error, loading, success, stroke, radius… */
  options?: BorderFieldParams;
  /** Skip the default styles. */
  unstyled?: boolean;
  className?: string;
}

export interface StatelineFieldHandle {
  set(state: BorderFieldState): void;
  readonly form: HTMLFormElement | null;
  readonly input: HTMLInputElement | null;
}

export interface StatelineCheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  id?: string;
  label?: ReactNode;
  children?: ReactNode;
  name?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  state?: 'rest' | 'error';
  size?: number;
  line?: number;
  unstyled?: boolean;
  className?: string;
}

export interface StatelineCheckboxHandle {
  set(state: 'rest' | 'error'): void;
  readonly input: HTMLInputElement | null;
}

export declare const StatelineField: ForwardRefExoticComponent<StatelineFieldProps & RefAttributes<StatelineFieldHandle>>;
export declare const StatelineCheckbox: ForwardRefExoticComponent<StatelineCheckboxProps & RefAttributes<StatelineCheckboxHandle>>;
declare const _default: { StatelineField: typeof StatelineField; StatelineCheckbox: typeof StatelineCheckbox };
export default _default;
