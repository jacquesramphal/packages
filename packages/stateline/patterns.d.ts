// Types for @jacquesramphal/stateline/patterns, by Jacques Ramphal. MIT.

export type PatternName =
  | 'travellers' | 'school' | 'horizon' | 'horizons' | 'islands'
  | 'strands' | 'waves' | 'pieces' | 'contours' | 'lattice' | 'patchwork' | 'loops';

export type PresetName = 'calm' | 'lively' | 'fish' | 'chase' | 'wrinkle' | 'beside' | 'mixed' | 'big';

export interface ClearOptions {
  side?: 'left' | 'right' | 'top' | 'bottom';
  /** Share of the width (or height) kept empty, 0 to 1. Default 0.42. */
  size?: number;
  /** Share over which the lines fade back in. Default 0.14; 0 is a hard edge with no fade. */
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
  /** Line width in px, the same for every line. Default 2. */
  stroke?: number;
  /** Size of the moves: height, wavelength and length together. */
  scale?: number;
  /** Wavelength only: the same size, tighter (above 1) or looser (below 1). */
  frequency?: number;
  /** Variety: each squiggle its own height and its own wavelength, 0 to 1. Lengths and the stroke stay the same. Islands defaults to 0.6. */
  variance?: number;
  pointer?: 'none' | 'chase' | 'avoid' | 'rub' | 'wrinkle';
  /** px. */
  pointerRadius?: number;
  /** React to a hovering touch pointer as well as a mouse. Pressing and dragging a finger always works. Default false. */
  pointerOnTouch?: boolean;
  /** A tap or click sends out a ripple that clears the lines. Default true. */
  ripple?: boolean;
  /** Finger drags: 'horizontal' (default; the page still scrolls up and down), true (every direction, for full-screen use), or false. */
  drag?: 'horizontal' | boolean;
  /** Keep part empty for text: a side, or { side, size, feather }. */
  clear?: 'left' | 'right' | 'top' | 'bottom' | ClearOptions | null;
  /** Flow round shapes: 'text' (each line of text inside the element), a selector, or elements. Works with clear. */
  avoid?: 'text' | string | Element | Element[] | null;
  /** px kept round each shape. Default 14. */
  avoidPadding?: number;
  /** 'break' (default): lines stop at a shape and pick up past it. 'bend': they bend round it. */
  avoidStyle?: 'break' | 'bend';
  /** Lattice: degrees each family of lines leans either way. Default 30. */
  angle?: number;
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
