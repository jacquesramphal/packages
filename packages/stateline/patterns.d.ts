// Types for @jacquesramphal/stateline/patterns, by Jacques Ramphal. MIT.

export type PatternName =
  | 'travellers' | 'school' | 'linea' | 'lineaGroup' | 'lineaPattern'
  | 'strands' | 'waves' | 'pieces' | 'contours' | 'loops';

export type PresetName = 'calm' | 'lively' | 'fish' | 'chase' | 'wrinkle' | 'beside';

export interface ClearOptions {
  side?: 'left' | 'right' | 'top' | 'bottom';
  /** Share of the width (or height) kept empty, 0 to 1. Default 0.42. */
  size?: number;
  /** Share over which the lines fade back in. Default 0.14. */
  feather?: number;
}

export interface PatternOptions {
  pattern?: PatternName;
  /** Start from a preset; anything else you pass overrides it. */
  preset?: PresetName;
  /** Line colour. Default: the element's text colour, following the theme. */
  ink?: string | null;
  /** Fill behind the lines. Default: transparent. */
  bg?: string | null;
  speed?: number;
  /** Opacity of the lines, 0 to 1. */
  strength?: number;
  /** More or fewer lines. Also scaled by the area. */
  density?: number;
  /** Line width multiplier. */
  weight?: number;
  pointer?: 'none' | 'chase' | 'avoid' | 'rub' | 'wrinkle';
  /** px. */
  pointerRadius?: number;
  /** React to touch as well as a mouse. Default false. */
  pointerOnTouch?: boolean;
  /** Keep part empty for text: a side, or { side, size, feather }. */
  clear?: 'left' | 'right' | 'top' | 'bottom' | ClearOptions | null;
  /** Draw one frame and stop. Also on under prefers-reduced-motion. */
  still?: boolean;
  /** The moment a still shows, in seconds. */
  time?: number;
}

export interface SvgOptions extends PatternOptions {
  width?: number;
  height?: number;
}

export interface MountedPattern {
  readonly canvas: HTMLCanvasElement;
  readonly options: Required<PatternOptions>;
  set(options: PatternOptions): void;
  destroy(): void;
}

declare const StatelinePatterns: {
  /** Draws into a canvas, or adds one filling any element. */
  mount(target: HTMLCanvasElement | HTMLElement, options?: PatternOptions): MountedPattern;
  /** A still as an SVG string, for a CSS background or a file. Works in Node. */
  svg(pattern: PatternName, options?: SvgOptions): string;
  readonly LIST: Array<[PatternName, string]>;
  readonly DEFAULTS: Required<PatternOptions>;
  readonly PRESETS: Record<PresetName, PatternOptions>;
};

export default StatelinePatterns;
export as namespace StatelinePatterns;
