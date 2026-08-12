import { encode } from "fast-png"

const createTexture = (
  width: number,
  height: number,
  pixel: (x: number, y: number) => readonly [number, number, number, number],
): Uint8Array => {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = pixel(x, y)
      const offset = (y * width + x) * 4
      data[offset] = color[0]
      data[offset + 1] = color[1]
      data[offset + 2] = color[2]
      data[offset + 3] = color[3]
    }
  }
  return encode({ width, height, data, channels: 4 })
}

/** Deterministic amber weave with faint manufacturing streaks. */
export const createPolyimideTexture = (): Uint8Array =>
  createTexture(64, 64, (x, y) => {
    const weave = Math.sin(x * 0.72) * 5 + Math.sin(y * 0.48) * 4
    const streak = x % 16 === 0 || y % 21 === 0 ? -8 : 0
    return [
      Math.max(0, Math.min(255, 232 + weave + streak)),
      Math.max(0, Math.min(255, 135 + weave * 0.55 + streak)),
      Math.max(0, Math.min(255, 28 + weave * 0.2)),
      255,
    ]
  })

/** Deterministic warm copper with fine longitudinal brushing. */
export const createCopperTexture = (): Uint8Array =>
  createTexture(64, 64, (x, y) => {
    const brush = Math.sin(x * 1.9) * 9 + Math.sin(x * 0.31 + y * 0.07) * 5
    const highlight = x % 13 === 0 ? 12 : 0
    return [
      Math.max(0, Math.min(255, 202 + brush + highlight)),
      Math.max(0, Math.min(255, 103 + brush * 0.46 + highlight * 0.4)),
      Math.max(0, Math.min(255, 38 + brush * 0.18)),
      255,
    ]
  })
