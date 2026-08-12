import type { Manifold } from "manifold-3d"

export interface Point3D {
  x: number
  y: number
  z: number
}

export type Point3DInput = Point3D | readonly [number, number, number]

export interface FpcCableDefinition {
  /** Center of the first exposed contact. */
  start: Point3DInput
  /** Center of the last exposed contact. */
  end: Point3DInput
  /** Number of parallel copper conductors. */
  wireCount: number
  /** Center-to-center conductor pitch, in the same units as the points. */
  pitch: number
  /** Ordered points the cable centerline must pass through. */
  navPoints?: readonly Point3DInput[]
}

export interface FpcCableOptions {
  /** Overall substrate/copper/coverlay stack thickness. Defaults to 0.18. */
  polyimideThickness?: number
  /** Copper conductor thickness. Defaults to 0.035. */
  copperThickness?: number
  /** Copper conductor width. Defaults to 52% of pitch. */
  conductorWidth?: number
  /** Polyimide outside each edge conductor. Defaults to 35% of pitch. */
  edgeMargin?: number
  /** Uncovered copper length at both ends. Defaults to 2.4 times pitch. */
  exposedContactLength?: number
  /** Curve samples per span between required points. Defaults to 12. */
  samplesPerSpan?: number
  /** Preferred positive thickness direction. Defaults to +Z. */
  up?: Point3DInput
}

export interface ResolvedFpcCableOptions {
  polyimideThickness: number
  copperThickness: number
  conductorWidth: number
  edgeMargin: number
  exposedContactLength: number
  samplesPerSpan: number
  up: Point3D
}

export interface FpcCableDimensions {
  width: number
  thickness: number
  conductorWidth: number
  copperThickness: number
  centerlineLength: number
}

export interface FpcCableManifoldModel {
  /** Full substrate and retracted top coverlay, represented as one manifold. */
  polyimide: Manifold
  /** One solid for each copper conductor, ordered across the cable. */
  conductors: Manifold[]
  /** Boolean union of the complete multi-solid cable assembly. */
  combined: Manifold
  dimensions: FpcCableDimensions
  /** Release all WASM objects owned by this model. */
  dispose(): void
}

export interface FpcCableGltfAsset {
  /** Self-contained glTF 2.0 JSON with an embedded binary buffer and textures. */
  json: string
  /** UTF-8 bytes of `json`, convenient for file and HTTP APIs. */
  bytes: Uint8Array
  dimensions: FpcCableDimensions
}

export interface FpcCableAssetOptions extends FpcCableOptions {
  /** RGBA color multiplied with the procedural amber polyimide texture. */
  polyimideColor?: readonly [number, number, number, number]
  /** RGBA color multiplied with the procedural brushed-copper texture. */
  copperColor?: readonly [number, number, number, number]
}
