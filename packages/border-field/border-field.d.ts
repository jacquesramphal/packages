export type BorderFieldState = 'rest' | 'typing' | 'loading' | 'error' | 'sent';

export interface BorderFieldParams {
  /** Line width in px. */
  stroke?: number;
  /** Corner radius in px. */
  radius?: number;
  /** Added to the line width while the field has focus. 0 turns it off. */
  focusStroke?: number;
  /** How hard the state shapes pull toward their target. */
  stiffness?: number;
  /** How quickly they stop wobbling. */
  damping?: number;

  typing?: 'follow' | 'jiggle' | 'ripple';
  followAmp?: number;
  followWidth?: number;
  followKick?: number;
  followEase?: number;
  jiggleKick?: number;
  rippleAmp?: number;
  rippleSpeed?: number;

  loading?: 'wave' | 'spinner';
  waveAmp?: number;
  waveLength?: number;
  waveSpeed?: number;
  /** A share of the perimeter, 0 to 1. */
  spinLength?: number;
  /** Laps a second. */
  spinSpeed?: number;

  error?: 'jagged' | 'pulse';
  jagAmp?: number;
  jagLength?: number;
  pulseAmp?: number;
  pulseRate?: number;
  shake?: boolean;

  success?: 'sunburst' | 'confetti' | 'both';
  rayLength?: number;
  raySpacing?: number;
  confettiSpacing?: number;
}

export interface BorderFieldCreateOptions extends BorderFieldParams {
  /** The element the outline is drawn round. Defaults to root's .box, then root. */
  box?: HTMLElement;
}

export interface BorderFieldEngine {
  /** Live: change a value and the next frame uses it. */
  params: Required<BorderFieldParams>;
  readonly state: BorderFieldState;
  set(state: BorderFieldState): void;
  /** Where the caret is, in px from the left of the box. */
  caret(x: number): void;
  /** A keystroke, optionally at x. */
  key(x?: number): void;
  focus(on: boolean): void;
  stop(): void;
}

export interface BorderFieldMessages {
  /** Shown when the field is submitted empty. */
  empty?: string;
  /** Shown when it's invalid. Empty uses the browser's validationMessage. */
  invalid?: string;
  sending?: string;
  sent?: string;
  failed?: string;
}

export interface BorderFieldEnhanceOptions extends BorderFieldCreateOptions {
  /** The field to watch. Defaults to the form's first text-like input. */
  input?: HTMLInputElement | HTMLTextAreaElement;
  /** Where messages go. Defaults to the input's aria-describedby target. */
  message?: HTMLElement;
  messages?: BorderFieldMessages;
  /**
   * Send it yourself. Resolve for sent, reject for failed. Without it the
   * form submits natively once it's valid.
   */
  onSubmit?: (
    value: string,
    context: { form: HTMLFormElement; input: HTMLInputElement | HTMLTextAreaElement; field: BorderFieldEngine },
  ) => unknown | Promise<unknown>;
  /** Ms after sent before it goes back to rest. 0 stays sent. Default 2600. */
  resetAfter?: number;
}

export interface BorderFieldEnhanced {
  field: BorderFieldEngine;
  set(state: BorderFieldState): void;
  /** Removes the outline and every listener, and gives the form back its own validation. */
  destroy(): void;
}

declare const BorderField: {
  create(root: HTMLElement, options?: BorderFieldCreateOptions): BorderFieldEngine;
  enhance(form: HTMLFormElement, options?: BorderFieldEnhanceOptions): BorderFieldEnhanced;
  DEFAULTS: Required<BorderFieldParams>;
  caretX(input: HTMLInputElement | HTMLTextAreaElement, box: HTMLElement): number;
};

export default BorderField;
export as namespace BorderField;
