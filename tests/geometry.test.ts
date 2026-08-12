import { describe, expect, test } from "bun:test"
import { createFpcCableGeometry } from "lib/geometry"

describe("ribbon cable geometry", () => {
  test("passes through every required 3D point", () => {
    const requiredPoints = [
      [0, 0, 0],
      [8, 5, 2],
      [17, -2, 7],
      [28, 4, 3],
    ] as const
    const geometry = createFpcCableGeometry({
      start: requiredPoints[0],
      end: requiredPoints[3],
      navPoints: [requiredPoints[1], requiredPoints[2]],
      wireCount: 6,
      pitch: 1,
    })

    for (const required of requiredPoints) {
      expect(
        geometry.path.some(
          (sample) =>
            Math.hypot(
              sample.x - required[0],
              sample.y - required[1],
              sample.z - required[2],
            ) < 1e-8,
        ),
      ).toBe(true)
    }
    expect(geometry.conductors).toHaveLength(6)
    expect(geometry.dimensions.width).toBeCloseTo(6.22)
    expect(geometry.polyimide.compact.indices.length).toBeGreaterThan(100)
  })

  test("rejects invalid cable definitions", () => {
    expect(() =>
      createFpcCableGeometry({
        start: [0, 0, 0],
        end: [10, 0, 0],
        wireCount: 0,
        pitch: 1,
      }),
    ).toThrow("wireCount")
    expect(() =>
      createFpcCableGeometry({
        start: [0, 0, 0],
        end: [0, 0, 0],
        wireCount: 4,
        pitch: 1,
      }),
    ).toThrow("Consecutive cable points")
  })
})
