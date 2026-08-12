import {
  createCableFrames,
  resolveDefinition,
  sampleCablePath,
  trimPath,
} from "./path"
import { createSweptSolid, type SweptSolidGeometry } from "./sweep"
import type {
  FpcCableDefinition,
  FpcCableDimensions,
  FpcCableOptions,
  Point3D,
  ResolvedFpcCableOptions,
} from "./types"

export interface FpcCableGeometry {
  path: Point3D[]
  /** Full-length flexible backing beneath the conductors and exposed pads. */
  substrate: SweptSolidGeometry
  /** Top insulation retracted from both ends to expose the contact pads. */
  coverlay: SweptSolidGeometry
  conductors: SweptSolidGeometry[]
  dimensions: FpcCableDimensions
  options: ResolvedFpcCableOptions
}

export const createFpcCableGeometry = (
  definition: FpcCableDefinition,
  options: FpcCableOptions = {},
): FpcCableGeometry => {
  const resolved = resolveDefinition(definition, options)
  const path = sampleCablePath(
    resolved.requiredPoints,
    resolved.options.samplesPerSpan,
  )
  const frames = createCableFrames(path, resolved.options.up)
  const centerlineLength = frames.at(-1)!.distance
  const coverlayPath = trimPath(
    path,
    resolved.options.exposedContactLength,
    resolved.options.exposedContactLength,
  )
  const coverlayFrames = createCableFrames(coverlayPath, resolved.options.up)
  const width =
    (definition.wireCount - 1) * definition.pitch +
    resolved.options.conductorWidth +
    resolved.options.edgeMargin * 2

  const dielectricThickness =
    resolved.options.polyimideThickness - resolved.options.copperThickness
  const substrateThickness = dielectricThickness * 0.6
  const coverlayThickness = dielectricThickness - substrateThickness
  const substrateNormalOffset =
    -resolved.options.polyimideThickness / 2 + substrateThickness / 2
  const copperNormalOffset =
    -resolved.options.polyimideThickness / 2 +
    substrateThickness +
    resolved.options.copperThickness / 2
  const coverlayNormalOffset =
    resolved.options.polyimideThickness / 2 - coverlayThickness / 2

  const substrate = createSweptSolid(
    frames,
    width,
    substrateThickness,
    0,
    substrateNormalOffset,
    Math.max(definition.pitch * 3, 1),
  )
  const coverlay = createSweptSolid(
    coverlayFrames,
    width,
    coverlayThickness,
    0,
    coverlayNormalOffset,
    Math.max(definition.pitch * 3, 1),
  )
  const conductors = Array.from(
    { length: definition.wireCount },
    (_, index) => {
      const acrossOffset =
        (index - (definition.wireCount - 1) / 2) * definition.pitch
      return createSweptSolid(
        frames,
        resolved.options.conductorWidth,
        resolved.options.copperThickness,
        acrossOffset,
        copperNormalOffset,
        Math.max(definition.pitch * 2, 0.5),
      )
    },
  )

  return {
    path,
    substrate,
    coverlay,
    conductors,
    dimensions: {
      width,
      thickness: resolved.options.polyimideThickness,
      conductorWidth: resolved.options.conductorWidth,
      copperThickness: resolved.options.copperThickness,
      centerlineLength,
    },
    options: resolved.options,
  }
}
