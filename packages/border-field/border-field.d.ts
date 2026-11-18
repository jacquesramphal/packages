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

  /** 'wave' is a ripple that only runs right; 'cloud' bumps all round. */
  typing?: 'follow' | 'jiggle' | 'ripple' | 'wave' | 'cloud';
  followAmp?: number;
  followWidth?: number;
  followKick?: number;
  followEase?: number;
  jiggleKick?: number;
  rippleAmp?: number;
  rippleSpeed?: number;
  /** Ripple: 'both' ways from the caret, or 'forward' (what typing 'wave' does). */
  rippleWay?: 'both' | 'forward';
  cloudSize?: number;
  cloudAmp?: number;
  cloudKick?: number;

  /** 'orbit' is one wave circling the field. */
  loading?: 'wave' | 'spinner' | 'orbit';
  waveAmp?: number;
  waveLength?: number;
  waveSpeed?: number;
  /** A share of the perimeter, 0 to 1. */
  spinLength?: number;
  /** Laps a second. */
  spinSpeed?: number;
  /** Orbit: share of the perimeter the wave covers. */
  orbitPacket?: number;
  /** Orbit: seconds per lap. */
  orbitLap?: number;

  /** 'spring' overshoots and settles; 'drawn' hits at full size and settles smaller. */
  error?: 'jagged' | 'pulse' | 'spring' | 'drawn';
  jagAmp?: number;
  jagLength?: number;
  pulseAmp?: number;
  pulseRate?: number;
  shake?: boolean;
  springRate?: number;
  springBounce?: number;
  drawnHit?: number;
  drawnRest?: number;
  drawnSettle?: number;
  /** Editing after an error drops the teeth but keeps the line red until it's valid. */
  soften?: boolean;
  /** px the border swells when an error lands, then springs back in. */
  errorBounce?: number;

  /** 'pieces': the outline flies apart and draws back; 'ticks': it turns into ticks and closes. */
  success?: 'sunburst' | 'confetti' | 'both' | 'pieces' | 'ticks';
  rayLength?: number;
  raySpacing?: number;
  confettiSpacing?: number;
  pieceLength?: number;
  flyFar?: number;
  fall?: number;
  spin?: number;
  flyTime?: number;
  redrawAt?: number;
  ticksHold?: number;
  ticksDrift?: number;
  /** px the outline breathes out and back once it's whole after a send. */
  settle?: number;

  /** 1: every tooth, bump and piece alike. 0: hand-drawn. */
  uniformity?: number;
  /** Seconds, roughly, for the last state's shape to spring away. */
  handoff?: number;
  handoffBounce?: number;
  /** Seconds' beat before a new state starts. */
  stateDelay?: number;
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
  /** The address is valid again: drop the red a softened error kept. */
  valid(): void;
  /** Draw the outline in from nothing. */
  drawIn(): void;
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
