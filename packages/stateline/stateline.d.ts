// Types for @jacquesramphal/stateline, by Jacques Ramphal. MIT.
import type {
  BorderFieldEnhanceOptions,
  BorderFieldEnhanced,
} from '@jacquesramphal/border-field';

export type {
  BorderFieldEnhanceOptions,
  BorderFieldEnhanced,
  BorderFieldState,
  BorderFieldParams,
  BorderFieldMessages,
  BorderFieldEngine,
} from '@jacquesramphal/border-field';

export interface EmailSuggestion {
  /** The corrected address, ready to put back in the field. */
  address: string;
  local: string;
  domain: string;
}

export interface StatelineFieldOptions extends BorderFieldEnhanceOptions {
  /**
   * Ask "Did you mean …?" on send when the domain looks like a typo. The
   * first send stops and asks; sending again as typed goes through. On by
   * default. Pass a function to use your own suggester, or false to turn it off.
   */
  suggest?: boolean | ((value: string) => EmailSuggestion | null);
  /**
   * 'essay' (the default) is the look from the Make it pop essay, in
   * Stateline.DEFAULTS. 'plain' starts from border-field's own defaults.
   */
  look?: 'essay' | 'plain';
  /** Hears every state change: rest, typing, loading, error, sent. */
  onState?: (state: import('@jacquesramphal/border-field').BorderFieldState) => void;
}


export interface StatelineCheckboxOptions {
  /** Box size in px. Default 24. */
  size?: number;
  /** Line width in px. Default 2. */
  line?: number;
  /** Seed for the hand-drawn wobble. Defaults to one from the input's id or name. */
  seed?: number;
}

export interface StatelineCheckbox {
  input: HTMLInputElement;
  /** 'error' shows the jagged red box; anything else clears it. */
  set(state: 'error' | 'rest'): void;
  /** Puts the native checkbox back the way it was. */
  destroy(): void;
}

export interface Spring {
  x: number;
  v: number;
  target: number;
  k: number;
  damp: number;
  /** Advances by dt seconds; true while it's still moving. */
  step(dt: number): boolean;
}

declare const Stateline: {
  /** The border field: the outline is the field's state. */
  field(form: HTMLFormElement, options?: StatelineFieldOptions): BorderFieldEnhanced;
  /** A checkbox that draws its tick. Enhances the real input in place. */
  checkbox(input: HTMLInputElement, options?: StatelineCheckboxOptions): StatelineCheckbox;
  /** A likely typo in an email's domain, or null. String distance, no AI. */
  suggestEmail(value: string): EmailSuggestion | null;
  /** Enhances every input[type=checkbox][data-stateline] inside root (default: document). */
  enhance(root?: ParentNode): StatelineCheckbox[];
  spring(x: number, k?: number, damp?: number): Spring;
  /** Adds the default styles for the .stateline-field markup the Vue and React components render. */
  addStyles(): void;
  /** Sets an input's value the way typing does, so React and Vue hear it. */
  setValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void;
  /** The essay's look: what field() uses unless an option overrides it. */
  DEFAULTS: StatelineFieldOptions;
};

export default Stateline;
export as namespace Stateline;
