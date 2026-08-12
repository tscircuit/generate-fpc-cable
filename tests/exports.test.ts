import { describe, expect, test } from "bun:test"
import { validateBytes } from "gltf-validator"
import {
  createFpcCableManifolds,
  generateFpcCableGlb,
  generateFpcCableGltf,
} from "lib/index"

const definition = {
  start: [0, 0, 0],
  end: [32, 4, 2],
  navPoints: [
    [10, 6, 3],
    [22, -3, 7],
  ],
  wireCount: 5,
  pitch: 0.8,
} as const

describe("FPC cable exports", () => {
  test("creates valid textured GLB with distinct material meshes", async () => {
    const glb = generateFpcCableGlb(definition)
    expect(new TextDecoder().decode(glb.slice(0, 4))).toBe("glTF")
    const report = await validateBytes(glb)
    expect(report.issues.numErrors, report.issues.messages.join("\n")).toBe(0)
  })

  test("creates self-contained GLTF with polyimide and copper textures", () => {
    const asset = generateFpcCableGltf(definition)
    const gltf = JSON.parse(asset.json)
    expect(gltf.buffers[0].uri).toStartWith(
      "data:application/octet-stream;base64,",
    )
    expect(gltf.images).toHaveLength(2)
    expect(gltf.textures).toHaveLength(2)
    expect(gltf.materials[0].alphaMode).toBe("BLEND")
    expect(
      gltf.materials[1].pbrMetallicRoughness.metallicFactor,
    ).toBeGreaterThan(0.9)
    expect(gltf.nodes).toHaveLength(definition.wireCount + 2)
    expect(gltf.nodes[0].name).toBe("Polyimide substrate")
    expect(gltf.nodes[1].name).toBe("Polyimide coverlay")
  })

  test("creates valid manifold-3d solids", async () => {
    const model = await createFpcCableManifolds(definition)
    try {
      expect(model.polyimide.status()).toBe("NoError")
      expect(model.conductors).toHaveLength(definition.wireCount)
      expect(
        model.conductors.every((solid) => solid.status() === "NoError"),
      ).toBe(true)
      expect(model.combined.status()).toBe("NoError")
      expect(model.combined.numTri()).toBeGreaterThan(0)
    } finally {
      model.dispose()
    }
  })
})
