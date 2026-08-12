import type {
  FpcCableDefinition,
  FpcCableOptions,
  Point3D,
  ResolvedFpcCableOptions,
} from "./types"
import {
  add,
  cross,
  distance,
  dot,
  isFinitePoint,
  length,
  lerp,
  normalize,
  point,
  scale,
  subtract,
} from "./vector"

export interface CableFrame {
  center: Point3D
  tangent: Point3D
  across: Point3D
  normal: Point3D
  distance: number
}

const assertPositive = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite number greater than zero`)
  }
}

export const resolveDefinition = (
  definition: FpcCableDefinition,
  options: FpcCableOptions = {},
): {
  requiredPoints: Point3D[]
  options: ResolvedFpcCableOptions
} => {
  if (!Number.isInteger(definition.wireCount) || definition.wireCount < 1) {
    throw new Error("wireCount must be a positive integer")
  }
  assertPositive("pitch", definition.pitch)

  const requiredPoints = [
    point(definition.start),
    ...(definition.navPoints ?? []).map(point),
    point(definition.end),
  ]
  if (requiredPoints.some((requiredPoint) => !isFinitePoint(requiredPoint))) {
    throw new Error("start, end, and navPoints must contain finite coordinates")
  }
  for (let index = 1; index < requiredPoints.length; index += 1) {
    if (distance(requiredPoints[index - 1]!, requiredPoints[index]!) < 1e-6) {
      throw new Error(
        "Consecutive cable points must be at least 0.000001 apart",
      )
    }
  }

  const polyimideThickness = options.polyimideThickness ?? 0.18
  const copperThickness = options.copperThickness ?? 0.035
  const conductorWidth = options.conductorWidth ?? definition.pitch * 0.52
  const edgeMargin = options.edgeMargin ?? definition.pitch * 0.35
  const exposedContactLength =
    options.exposedContactLength ?? definition.pitch * 2.4
  const samplesPerSpan = options.samplesPerSpan ?? 12
  const up = point(options.up ?? [0, 0, 1])

  assertPositive("polyimideThickness", polyimideThickness)
  assertPositive("copperThickness", copperThickness)
  assertPositive("conductorWidth", conductorWidth)
  if (copperThickness >= polyimideThickness) {
    throw new Error("copperThickness must be smaller than polyimideThickness")
  }
  if (conductorWidth >= definition.pitch) {
    throw new Error("conductorWidth must be smaller than pitch")
  }
  if (!Number.isFinite(edgeMargin) || edgeMargin < 0) {
    throw new Error(
      "edgeMargin must be a finite number greater than or equal to zero",
    )
  }
  if (!Number.isFinite(exposedContactLength) || exposedContactLength < 0) {
    throw new Error(
      "exposedContactLength must be a finite number greater than or equal to zero",
    )
  }
  if (!Number.isInteger(samplesPerSpan) || samplesPerSpan < 1) {
    throw new Error("samplesPerSpan must be a positive integer")
  }
  if (!isFinitePoint(up) || length(up) < 1e-9) {
    throw new Error("up must be a finite, non-zero vector")
  }

  return {
    requiredPoints,
    options: {
      polyimideThickness,
      copperThickness,
      conductorWidth,
      edgeMargin,
      exposedContactLength,
      samplesPerSpan,
      up: normalize(up),
    },
  }
}

const timedLerp = (
  a: Point3D,
  b: Point3D,
  aTime: number,
  bTime: number,
  time: number,
): Point3D => {
  const span = bTime - aTime
  if (span < 1e-12) return a
  return lerp(a, b, (time - aTime) / span)
}

const sampleCentripetalSpan = (
  p0: Point3D,
  p1: Point3D,
  p2: Point3D,
  p3: Point3D,
  samples: number,
): Point3D[] => {
  const alpha = 0.5
  const t0 = 0
  const t1 = t0 + distance(p0, p1) ** alpha
  const t2 = t1 + distance(p1, p2) ** alpha
  const t3 = t2 + distance(p2, p3) ** alpha
  const result: Point3D[] = []

  for (let sampleIndex = 0; sampleIndex <= samples; sampleIndex += 1) {
    const time = t1 + ((t2 - t1) * sampleIndex) / samples
    const a1 = timedLerp(p0, p1, t0, t1, time)
    const a2 = timedLerp(p1, p2, t1, t2, time)
    const a3 = timedLerp(p2, p3, t2, t3, time)
    const b1 = timedLerp(a1, a2, t0, t2, time)
    const b2 = timedLerp(a2, a3, t1, t3, time)
    result.push(timedLerp(b1, b2, t1, t2, time))
  }
  return result
}

export const sampleCablePath = (
  requiredPoints: readonly Point3D[],
  samplesPerSpan: number,
): Point3D[] => {
  const path: Point3D[] = []
  for (let index = 0; index < requiredPoints.length - 1; index += 1) {
    const p1 = requiredPoints[index]!
    const p2 = requiredPoints[index + 1]!
    const p0 = requiredPoints[index - 1] ?? add(p1, subtract(p1, p2))
    const p3 = requiredPoints[index + 2] ?? add(p2, subtract(p2, p1))
    const span = sampleCentripetalSpan(p0, p1, p2, p3, samplesPerSpan)
    path.push(...(index === 0 ? span : span.slice(1)))
  }
  return path
}

const chooseAcross = (tangent: Point3D, preferredUp: Point3D): Point3D => {
  let across = cross(preferredUp, tangent)
  if (length(across) < 1e-8) across = cross({ x: 0, y: 1, z: 0 }, tangent)
  if (length(across) < 1e-8) across = cross({ x: 1, y: 0, z: 0 }, tangent)
  return normalize(across)
}

export const createCableFrames = (
  path: readonly Point3D[],
  preferredUp: Point3D,
): CableFrame[] => {
  const tangents = path.map((current, index) => {
    const before = path[Math.max(0, index - 1)]!
    const after = path[Math.min(path.length - 1, index + 1)]!
    return normalize(subtract(after, before))
  })
  const frames: CableFrame[] = []
  let cumulativeDistance = 0
  let previousAcross = chooseAcross(tangents[0]!, preferredUp)

  for (let index = 0; index < path.length; index += 1) {
    const tangent = tangents[index]!
    if (index > 0)
      cumulativeDistance += distance(path[index - 1]!, path[index]!)

    let across = previousAcross
    const projected = subtract(across, scale(tangent, dot(across, tangent)))
    across =
      length(projected) < 1e-8
        ? chooseAcross(tangent, preferredUp)
        : normalize(projected)
    if (dot(across, previousAcross) < 0) across = scale(across, -1)
    const normal = normalize(cross(tangent, across))
    frames.push({
      center: path[index]!,
      tangent,
      across,
      normal,
      distance: cumulativeDistance,
    })
    previousAcross = across
  }
  return frames
}

const pointAtDistance = (
  path: readonly Point3D[],
  distances: readonly number[],
  target: number,
): Point3D => {
  if (target <= 0) return path[0]!
  const lastIndex = path.length - 1
  if (target >= distances[lastIndex]!) return path[lastIndex]!
  for (let index = 1; index < path.length; index += 1) {
    if (distances[index]! >= target) {
      const from = distances[index - 1]!
      const to = distances[index]!
      return lerp(path[index - 1]!, path[index]!, (target - from) / (to - from))
    }
  }
  return path[lastIndex]!
}

export const trimPath = (
  path: readonly Point3D[],
  trimStart: number,
  trimEnd: number,
): Point3D[] => {
  const distances = [0]
  for (let index = 1; index < path.length; index += 1) {
    distances.push(
      distances[index - 1]! + distance(path[index - 1]!, path[index]!),
    )
  }
  const total = distances.at(-1)!
  const safeStart = Math.min(trimStart, total * 0.24)
  const safeEnd = Math.min(trimEnd, total * 0.24)
  const endDistance = total - safeEnd
  const result = [pointAtDistance(path, distances, safeStart)]
  for (let index = 1; index < path.length - 1; index += 1) {
    if (distances[index]! > safeStart && distances[index]! < endDistance) {
      result.push(path[index]!)
    }
  }
  result.push(pointAtDistance(path, distances, endDistance))
  return result
}
