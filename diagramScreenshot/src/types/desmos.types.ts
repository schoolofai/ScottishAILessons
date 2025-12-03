/**
 * Desmos Calculator type definitions
 * Based on Desmos API v1.11
 * https://www.desmos.com/api/v1.11/docs/index.html
 */

/**
 * Desmos expression types
 */
export interface DesmosExpression {
  id?: string;
  latex?: string;
  color?: string;
  hidden?: boolean;
  secret?: boolean;
  lineStyle?: 'SOLID' | 'DASHED' | 'DOTTED';
  lineWidth?: number;
  lineOpacity?: number;
  pointStyle?: 'POINT' | 'OPEN' | 'CROSS';
  pointSize?: number;
  pointOpacity?: number;
  fillOpacity?: number;
  label?: string;
  showLabel?: boolean;
  labelSize?: 'small' | 'medium' | 'large';
  labelOrientation?: 'default' | 'center' | 'center_auto' | 'auto_center' | 'above' | 'above_left' | 'above_right' | 'below' | 'below_left' | 'below_right' | 'left' | 'right';
  dragMode?: 'NONE' | 'X' | 'Y' | 'XY' | 'AUTO';
  domain?: { min: string; max: string };
  cdf?: { show: boolean; min?: string; max?: string };
  // Parametric/polar specific
  parametricDomain?: { min: string; max: string };
  polarDomain?: { min: string; max: string };
  // Slider specific
  slider?: {
    hardMin?: boolean;
    hardMax?: boolean;
    min?: string;
    max?: string;
    step?: string;
    animationPeriod?: number;
    loopMode?: 'LOOP_FORWARD_REVERSE' | 'LOOP_FORWARD' | 'PLAY_ONCE' | 'PLAY_INDEFINITELY';
    playDirection?: number;
    isPlaying?: boolean;
  };
}

/**
 * Desmos table column
 */
export interface DesmosTableColumn {
  latex: string;
  values?: string[];
  hidden?: boolean;
  color?: string;
  lineStyle?: 'SOLID' | 'DASHED' | 'DOTTED';
  lineWidth?: number;
  lineOpacity?: number;
  pointStyle?: 'POINT' | 'OPEN' | 'CROSS';
  pointSize?: number;
  pointOpacity?: number;
  dragMode?: 'NONE' | 'X' | 'Y' | 'XY' | 'AUTO';
}

/**
 * Desmos table
 */
export interface DesmosTable {
  id?: string;
  type: 'table';
  columns: DesmosTableColumn[];
}

/**
 * Desmos folder
 */
export interface DesmosFolder {
  id?: string;
  type: 'folder';
  title?: string;
  collapsed?: boolean;
  hidden?: boolean;
  secret?: boolean;
}

/**
 * Desmos text/note
 */
export interface DesmosText {
  id?: string;
  type: 'text';
  text?: string;
  hidden?: boolean;
  secret?: boolean;
}

/**
 * Desmos image
 */
export interface DesmosImage {
  id?: string;
  type: 'image';
  image_url: string;
  name?: string;
  width?: string;
  height?: string;
  center?: string;
  angle?: string;
  opacity?: string;
  foreground?: boolean;
  draggable?: boolean;
  hidden?: boolean;
  secret?: boolean;
}

/**
 * Union type for all Desmos expression types
 */
export type DesmosExpressionItem =
  | (DesmosExpression & { type?: 'expression' })
  | DesmosTable
  | DesmosFolder
  | DesmosText
  | DesmosImage;

/**
 * Desmos graph state
 */
export interface DesmosGraphState {
  version?: number;
  randomSeed?: string;
  graph?: {
    viewport?: {
      xmin?: number;
      xmax?: number;
      ymin?: number;
      ymax?: number;
    };
    xAxisMinorSubdivisions?: number;
    yAxisMinorSubdivisions?: number;
    xAxisArrowMode?: 'NONE' | 'POSITIVE' | 'BOTH';
    yAxisArrowMode?: 'NONE' | 'POSITIVE' | 'BOTH';
    xAxisLabel?: string;
    yAxisLabel?: string;
    xAxisStep?: number;
    yAxisStep?: number;
    xAxisNumbers?: boolean;
    yAxisNumbers?: boolean;
    polarMode?: boolean;
    polarNumbers?: boolean;
    degreeMode?: boolean;
    showGrid?: boolean;
    showXAxis?: boolean;
    showYAxis?: boolean;
    squareAxes?: boolean;
    restrictGridToFirstQuadrant?: boolean;
    polarGrid?: boolean;
    userLockedViewport?: boolean;
  };
  expressions?: {
    list: DesmosExpressionItem[];
    ticker?: {
      handlerLatex?: string;
      minStepLatex?: string;
      playing?: boolean;
      open?: boolean;
    };
  };
}

/**
 * Calculator settings for initialization
 */
export interface DesmosCalculatorSettings {
  keypad?: boolean;
  graphpaper?: boolean;
  expressions?: boolean;
  settingsMenu?: boolean;
  zoomButtons?: boolean;
  expressionsTopbar?: boolean;
  pointsOfInterest?: boolean;
  trace?: boolean;
  border?: boolean;
  lockViewport?: boolean;
  expressionsCollapsed?: boolean;
  administerSecretFolders?: boolean;
  images?: boolean;
  folders?: boolean;
  notes?: boolean;
  sliders?: boolean;
  links?: boolean;
  qwertyKeyboard?: boolean;
  restrictedFunctions?: boolean;
  forceEnableGeometryFunctions?: boolean;
  pasteGraphLink?: boolean;
  pasteTableData?: boolean;
  clearIntoDegreeMode?: boolean;
  autosize?: boolean;
  plotSingleVariableImplicitEquations?: boolean;
  plotImplicits?: boolean;
  plotInequalities?: boolean;
  colors?: Record<string, string>;
  invertedColors?: boolean;
  fontSize?: number;
  language?: string;
  projectorMode?: boolean;
  brailleMode?: 'none' | 'nemeth' | 'ueb';
  sixKeyInput?: boolean;
  brailleControls?: boolean;
  zoomFit?: boolean;
  forceLogModeRegressions?: boolean;
  actions?: boolean;
  // For static rendering
  decimalToFraction?: boolean;
  backgroundColor?: string;
}

/**
 * Desmos render request
 */
export interface DesmosRenderRequest {
  /**
   * Graph state containing expressions and settings
   */
  state: DesmosGraphState;

  /**
   * Calculator settings (optional overrides)
   */
  settings?: DesmosCalculatorSettings;

  /**
   * Render options
   */
  options?: {
    width?: number;
    height?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
    scale?: number;
    timeout?: number;
    returnFormat?: 'base64' | 'binary';
  };
}

/**
 * Simplified expression input for common use cases
 */
export interface SimpleDesmosExpression {
  latex: string;
  color?: string;
  hidden?: boolean;
  lineStyle?: 'SOLID' | 'DASHED' | 'DOTTED';
  lineWidth?: number;
  label?: string;
  showLabel?: boolean;
}

/**
 * Simplified render request for common use cases
 */
export interface SimpleDesmosRenderRequest {
  /**
   * Array of LaTeX expressions to graph
   */
  expressions: SimpleDesmosExpression[];

  /**
   * Viewport bounds (optional)
   */
  viewport?: {
    xmin?: number;
    xmax?: number;
    ymin?: number;
    ymax?: number;
  };

  /**
   * Graph settings
   */
  settings?: {
    showGrid?: boolean;
    showXAxis?: boolean;
    showYAxis?: boolean;
    degreeMode?: boolean;
    polarMode?: boolean;
  };

  /**
   * Render options
   */
  options?: {
    width?: number;
    height?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
    scale?: number;
    timeout?: number;
  };
}
