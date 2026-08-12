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
  polyimide: SweptSolidGeometry
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
  const polyimidePath = trimPath(
    path,
    resolved.options.exposedContactLength,
    resolved.options.exposedContactLength,
  )
  const polyimideFrames = createCableFrames(polyimidePath, resolved.options.up)
  const width =
    (definition.wireCount - 1) * definition.pitch +
    resolved.options.conductorWidth +
    resolved.options.edgeMargin * 2

  const polyimide = createSweptSolid(
    polyimideFrames,
    width,
    resolved.options.polyimideThickness,
    0,
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
        Math.max(definition.pitch * 2, 0.5),
      )
    },
  )

  return {
    path,
    polyimide,
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
