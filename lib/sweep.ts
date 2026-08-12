import type { CableFrame } from "./path"
import type { Point3D } from "./types"
import { add, scale } from "./vector"

export interface TriangleMeshData {
  positions: Float32Array
  normals: Float32Array
  texcoords: Float32Array
  indices: Uint32Array
}

export interface CompactTriangleMeshData {
  positions: Float32Array
  indices: Uint32Array
}

export interface SweptSolidGeometry {
  compact: CompactTriangleMeshData
  render: TriangleMeshData
}

const ringCorners = (
  frame: CableFrame,
  halfWidth: number,
  halfThickness: number,
  acrossOffset: number,
): [Point3D, Point3D, Point3D, Point3D] => {
  const center = add(frame.center, scale(frame.across, acrossOffset))
  const across = scale(frame.across, halfWidth)
  const normal = scale(frame.normal, halfThickness)
  return [
    add(add(center, scale(across, -1)), scale(normal, -1)),
    add(add(center, across), scale(normal, -1)),
    add(add(center, across), normal),
    add(add(center, scale(across, -1)), normal),
  ]
}

const pushPoint = (target: number[], value: Point3D): number => {
  target.push(value.x, value.y, value.z)
  return target.length / 3 - 1
}

const createCompactMesh = (
  frames: readonly CableFrame[],
  halfWidth: number,
  halfThickness: number,
  acrossOffset: number,
): CompactTriangleMeshData => {
  const positions: number[] = []
  const indices: number[] = []
  for (const frame of frames) {
    for (const corner of ringCorners(
      frame,
      halfWidth,
      halfThickness,
      acrossOffset,
    )) {
      pushPoint(positions, corner)
    }
  }

  for (let ring = 0; ring < frames.length - 1; ring += 1) {
    const current = ring * 4
    const next = (ring + 1) * 4
    for (let edge = 0; edge < 4; edge += 1) {
      const a = current + edge
      const b = current + ((edge + 1) % 4)
      const nextA = next + edge
      const nextB = next + ((edge + 1) % 4)
      indices.push(a, b, nextB, a, nextB, nextA)
    }
  }

  const end = (frames.length - 1) * 4
  indices.push(0, 2, 1, 0, 3, 2)
  indices.push(end, end + 1, end + 2, end, end + 2, end + 3)
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  }
}

const faceNormal = (frame: CableFrame, edge: number): Point3D => {
  if (edge === 0) return scale(frame.normal, -1)
  if (edge === 1) return frame.across
  if (edge === 2) return frame.normal
  return scale(frame.across, -1)
}

const createRenderMesh = (
  frames: readonly CableFrame[],
  halfWidth: number,
  halfThickness: number,
  acrossOffset: number,
  textureRepeatLength: number,
): TriangleMeshData => {
  const positions: number[] = []
  const normals: number[] = []
  const texcoords: number[] = []
  const indices: number[] = []

  for (let edge = 0; edge < 4; edge += 1) {
    const edgeStart = positions.length / 3
    for (const frame of frames) {
      const corners = ringCorners(frame, halfWidth, halfThickness, acrossOffset)
      for (const [u, cornerIndex] of [
        [0, edge],
        [1, (edge + 1) % 4],
      ] as const) {
        pushPoint(positions, corners[cornerIndex]!)
        pushPoint(normals, faceNormal(frame, edge))
        texcoords.push(u, frame.distance / textureRepeatLength)
      }
    }
    for (let ring = 0; ring < frames.length - 1; ring += 1) {
      const a = edgeStart + ring * 2
      const b = a + 1
      const nextA = a + 2
      const nextB = a + 3
      indices.push(a, b, nextB, a, nextB, nextA)
    }
  }

  const addCap = (frame: CableFrame, isStart: boolean): void => {
    const corners = ringCorners(frame, halfWidth, halfThickness, acrossOffset)
    const capStart = positions.length / 3
    const normal = scale(frame.tangent, isStart ? -1 : 1)
    const capUvs: Array<readonly [number, number]> = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    for (let index = 0; index < 4; index += 1) {
      pushPoint(positions, corners[index]!)
      pushPoint(normals, normal)
      texcoords.push(...capUvs[index]!)
    }
    if (isStart) {
      indices.push(capStart, capStart + 2, capStart + 1)
      indices.push(capStart, capStart + 3, capStart + 2)
    } else {
      indices.push(capStart, capStart + 1, capStart + 2)
      indices.push(capStart, capStart + 2, capStart + 3)
    }
  }
  addCap(frames[0]!, true)
  addCap(frames.at(-1)!, false)

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    texcoords: new Float32Array(texcoords),
    indices: new Uint32Array(indices),
  }
}

export const createSweptSolid = (
  frames: readonly CableFrame[],
  width: number,
  thickness: number,
  acrossOffset: number,
  textureRepeatLength: number,
): SweptSolidGeometry => ({
  compact: createCompactMesh(frames, width / 2, thickness / 2, acrossOffset),
  render: createRenderMesh(
    frames,
    width / 2,
    thickness / 2,
    acrossOffset,
    textureRepeatLength,
  ),
})
