import type { Point3D, Point3DInput } from "./types"

export const point = (value: Point3DInput): Point3D =>
  "x" in value
    ? { x: value.x, y: value.y, z: value.z }
    : { x: value[0], y: value[1], z: value[2] }

export const add = (a: Point3D, b: Point3D): Point3D => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
})

export const subtract = (a: Point3D, b: Point3D): Point3D => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
})

export const scale = (value: Point3D, factor: number): Point3D => ({
  x: value.x * factor,
  y: value.y * factor,
  z: value.z * factor,
})

export const dot = (a: Point3D, b: Point3D): number =>
  a.x * b.x + a.y * b.y + a.z * b.z

export const cross = (a: Point3D, b: Point3D): Point3D => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

export const length = (value: Point3D): number => Math.sqrt(dot(value, value))

export const distance = (a: Point3D, b: Point3D): number =>
  length(subtract(a, b))

export const normalize = (value: Point3D): Point3D => {
  const magnitude = length(value)
  if (magnitude < 1e-12)
    throw new Error("Cannot normalize a zero-length vector")
  return scale(value, 1 / magnitude)
}

export const lerp = (a: Point3D, b: Point3D, t: number): Point3D =>
  add(scale(a, 1 - t), scale(b, t))

export const isFinitePoint = (value: Point3D): boolean =>
  Number.isFinite(value.x) &&
  Number.isFinite(value.y) &&
  Number.isFinite(value.z)

export const toTuple = (value: Point3D): [number, number, number] => [
  value.x,
  value.y,
  value.z,
]
