import { expect, test } from "bun:test"
import { generateFpcCableGlb } from "lib/index"
import { renderGLTFToPNGFromGLB } from "poppygl"

test("renders an amber eight-wire FPC with exposed copper contacts", async () => {
  const glb = generateFpcCableGlb({
    start: [0, 0, 0],
    end: [42, 1, 3],
    wireCount: 8,
    pitch: 1,
    navPoints: [
      [12, 7, 2],
      [27, 6, 7],
    ],
  })
  const png = await renderGLTFToPNGFromGLB(glb, {
    width: 800,
    height: 600,
    supersampling: 2,
    up: "z+",
    camPos: [37, -34, 23],
    lookAt: [21, 3, 2.5],
    ambient: 0.34,
    lightDir: [-0.45, 0.55, -0.7],
    backgroundColor: "#F4F1EA",
  })

  await expect(png).toMatchPngSnapshot(import.meta.path, "eight-wire-arched")
})

test("renders a cable routed through multiple 3D navpoints", async () => {
  const glb = generateFpcCableGlb({
    start: [-15, -8, 0],
    end: [20, 10, 12],
    wireCount: 5,
    pitch: 0.8,
    navPoints: [
      [-5, -12, 5],
      [2, 2, 11],
      [10, 14, 7],
    ],
  })
  const png = await renderGLTFToPNGFromGLB(glb, {
    width: 800,
    height: 600,
    supersampling: 2,
    up: "z+",
    camPos: [31, -31, 24],
    lookAt: [3, 1, 12],
    ambient: 0.36,
    lightDir: [-0.4, 0.5, -0.75],
    backgroundColor: "#F4F1EA",
  })

  await expect(png).toMatchPngSnapshot(
    import.meta.path,
    "three-dimensional-route",
  )
})
