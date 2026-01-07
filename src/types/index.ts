

export type Tool = 'select' | 'pan' | 'draw' | 'erase' | 'rectangle' | 'circle' | 'triangle' | 'text' | 'arrow' | 'highlighter' | 'lasso' | 'line';

export type WheelAction = 'zoom' | 'pan';

export type GenerationMode = 'image' | 'video';

export interface Point {
  x: number;
  y: number;
}

interface CanvasElementBase {
  id: string;
  x: number;
  y: number;
  name?: string;
  isVisible?: boolean;
  isLocked?: boolean;
  parentId?: string;
}

export interface ImageElement extends CanvasElementBase {
  type: 'image';
  href: string; 
  width: number;
  height: number;
  mimeType: string;
  borderRadius?: number;
  // 0-100 scale; 100 means fully opaque
  opacity?: number;
  isGenerating?: boolean;
  isPlaceholder?: boolean;
  previewHref?: string;
  
  // Generation task info (persisted)
  genProvider?: 'Grsai' | 'WHATAI';
  genTaskId?: string;
  genStatus?: 'creating' | 'generating' | 'retrying' | 'pending' | 'timeout' | 'failed';
  genError?: string;
  genRetryDisabled?: boolean;
}

export interface VideoElement extends CanvasElementBase {
  type: 'video';
  href: string; // Blob URL
  width: number;
  height: number;
  mimeType: string;
}

export interface PathElement extends CanvasElementBase {
  type: 'path';
  points: Point[];
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity?: number;
}

export interface ShapeElement extends CanvasElementBase {
    type: 'shape';
    shapeType: 'rectangle' | 'circle' | 'triangle';
    width: number;
    height: number;
    strokeColor: string;
    strokeWidth: number;
    fillColor: string;
    borderRadius?: number;
    strokeDashArray?: [number, number];
}

export interface TextElement extends CanvasElementBase {
    type: 'text';
    text: string;
    fontSize: number;
    fontColor: string;
    width: number;
    height: number;
}

export interface ArrowElement extends CanvasElementBase {
    type: 'arrow';
    points: [Point, Point];
    strokeColor: string;
    strokeWidth: number;
}

export interface LineElement extends CanvasElementBase {
    type: 'line';
    points: [Point, Point];
    strokeColor: string;
    strokeWidth: number;
}

export interface GroupElement extends CanvasElementBase {
    type: 'group';
    width: number;
    height: number;
}


export type Element = ImageElement | PathElement | ShapeElement | TextElement | ArrowElement | LineElement | GroupElement | VideoElement;

export type HistoryV1 = Element[][];

export type HistoryEntryV2 =
  | { kind: 'snapshot'; elements: Element[] }
  | {
      kind: 'patch';
      added: Element[];
      removed: Element[];
      updated: Array<{ before: Element; after: Element }>;
      beforeOrder: string[];
      afterOrder: string[];
    };

export type HistoryV2 = HistoryEntryV2[];

export type BoardHistory = HistoryV1 | HistoryV2;

export interface UserEffect {
  id: string;
  name: string;
  value: string;
}

export interface Board {
  id: string;
  name: string;
  elements: Element[];
  history: BoardHistory;
  historyIndex: number;
  panOffset: Point;
  zoom: number;
  canvasBackgroundColor: string;
  updatedAt?: number;
}
