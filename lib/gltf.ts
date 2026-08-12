import { createFpcCableGeometry } from "./geometry"
import type { TriangleMeshData } from "./sweep"
import { createCopperTexture, createPolyimideTexture } from "./textures"
import type {
  FpcCableAssetOptions,
  FpcCableDefinition,
  FpcCableGltfAsset,
} from "./types"

interface BufferViewDefinition {
  buffer: number
  byteOffset: number
  byteLength: number
  target?: number
}

interface AccessorDefinition {
  bufferView: number
  componentType: number
  count: number
  type: "SCALAR" | "VEC2" | "VEC3"
  min?: number[]
  max?: number[]
}

interface GltfDocument {
  asset: { version: string; generator: string }
  scene: number
  scenes: Array<{ nodes: number[] }>
  nodes: Array<{ name: string; mesh: number }>
  meshes: Array<{
    name: string
    primitives: Array<{
      attributes: { POSITION: number; NORMAL: number; TEXCOORD_0: number }
      indices: number
      material: number
      mode: number
    }>
  }>
  materials: unknown[]
  textures: Array<{ sampler: number; source: number }>
  samplers: Array<{
    magFilter: number
    minFilter: number
    wrapS: number
    wrapT: number
  }>
  images: Array<{ name: string; bufferView: number; mimeType: string }>
  buffers: Array<{ byteLength: number; uri?: string }>
  bufferViews: BufferViewDefinition[]
  accessors: AccessorDefinition[]
}

class BinaryBufferBuilder {
  private readonly chunks: Uint8Array[] = []
  private byteLength = 0

  add(data: ArrayBufferView): { byteOffset: number; byteLength: number } {
    const padding = (4 - (this.byteLength % 4)) % 4
    if (padding > 0) {
      this.chunks.push(new Uint8Array(padding))
      this.byteLength += padding
    }
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    const copy = new Uint8Array(bytes)
    const byteOffset = this.byteLength
    this.chunks.push(copy)
    this.byteLength += copy.byteLength
    return { byteOffset, byteLength: copy.byteLength }
  }

  finish(): Uint8Array {
    const padding = (4 - (this.byteLength % 4)) % 4
    const output = new Uint8Array(this.byteLength + padding)
    let offset = 0
    for (const chunk of this.chunks) {
      output.set(chunk, offset)
      offset += chunk.byteLength
    }
    return output
  }
}

const bounds = (positions: Float32Array): { min: number[]; max: number[] } => {
  const min = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ]
  const max = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]
  for (let offset = 0; offset < positions.length; offset += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis]!, positions[offset + axis]!)
      max[axis] = Math.max(max[axis]!, positions[offset + axis]!)
    }
  }
  return { min, max }
}

const bytesToDataUri = (bytes: Uint8Array): string =>
  `data:application/octet-stream;base64,${Buffer.from(bytes).toString("base64")}`

const resolveColor = (
  color: readonly [number, number, number, number] | undefined,
  fallback: readonly [number, number, number, number],
): number[] => [...(color ?? fallback)]

const buildDocument = (
  definition: FpcCableDefinition,
  options: FpcCableAssetOptions,
): {
  document: GltfDocument
  binary: Uint8Array
  dimensions: FpcCableGltfAsset["dimensions"]
} => {
  const geometry = createFpcCableGeometry(definition, options)
  const binaryBuilder = new BinaryBufferBuilder()
  const bufferViews: BufferViewDefinition[] = []
  const accessors: AccessorDefinition[] = []
  const meshes: GltfDocument["meshes"] = []
  const nodes: GltfDocument["nodes"] = []

  const addBufferView = (data: ArrayBufferView, target?: number): number => {
    const added = binaryBuilder.add(data)
    return (
      bufferViews.push({
        buffer: 0,
        byteOffset: added.byteOffset,
        byteLength: added.byteLength,
        ...(target === undefined ? {} : { target }),
      }) - 1
    )
  }

  const addMesh = (
    name: string,
    mesh: TriangleMeshData,
    material: number,
  ): void => {
    const positionView = addBufferView(mesh.positions, 34962)
    const normalView = addBufferView(mesh.normals, 34962)
    const texcoordView = addBufferView(mesh.texcoords, 34962)
    const indexView = addBufferView(mesh.indices, 34963)
    const positionBounds = bounds(mesh.positions)
    const positionAccessor =
      accessors.push({
        bufferView: positionView,
        componentType: 5126,
        count: mesh.positions.length / 3,
        type: "VEC3",
        ...positionBounds,
      }) - 1
    const normalAccessor =
      accessors.push({
        bufferView: normalView,
        componentType: 5126,
        count: mesh.normals.length / 3,
        type: "VEC3",
      }) - 1
    const texcoordAccessor =
      accessors.push({
        bufferView: texcoordView,
        componentType: 5126,
        count: mesh.texcoords.length / 2,
        type: "VEC2",
      }) - 1
    const indexAccessor =
      accessors.push({
        bufferView: indexView,
        componentType: 5125,
        count: mesh.indices.length,
        type: "SCALAR",
      }) - 1
    const meshIndex =
      meshes.push({
        name,
        primitives: [
          {
            attributes: {
              POSITION: positionAccessor,
              NORMAL: normalAccessor,
              TEXCOORD_0: texcoordAccessor,
            },
            indices: indexAccessor,
            material,
            mode: 4,
          },
        ],
      }) - 1
    nodes.push({ name, mesh: meshIndex })
  }

  addMesh("Polyimide substrate", geometry.substrate.render, 0)
  addMesh("Polyimide coverlay", geometry.coverlay.render, 0)
  for (const [index, conductor] of geometry.conductors.entries()) {
    addMesh(`Copper conductor ${index + 1}`, conductor.render, 1)
  }

  const polyimideImageView = addBufferView(createPolyimideTexture())
  const copperImageView = addBufferView(createCopperTexture())
  const binary = binaryBuilder.finish()
  const document: GltfDocument = {
    asset: {
      version: "2.0",
      generator: "@tscircuit/generate-fpc-cable",
    },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes,
    materials: [
      {
        name: "Translucent amber polyimide",
        pbrMetallicRoughness: {
          baseColorFactor: resolveColor(
            options.polyimideColor,
            [1, 0.96, 0.9, 0.76],
          ),
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 0.58,
        },
        alphaMode: "BLEND",
        doubleSided: true,
      },
      {
        name: "Brushed copper conductors",
        pbrMetallicRoughness: {
          baseColorFactor: resolveColor(options.copperColor, [1, 0.9, 0.76, 1]),
          baseColorTexture: { index: 1 },
          metallicFactor: 0.92,
          roughnessFactor: 0.28,
        },
      },
    ],
    textures: [
      { sampler: 0, source: 0 },
      { sampler: 0, source: 1 },
    ],
    samplers: [
      {
        magFilter: 9729,
        minFilter: 9987,
        wrapS: 10497,
        wrapT: 10497,
      },
    ],
    images: [
      {
        name: "Polyimide weave",
        bufferView: polyimideImageView,
        mimeType: "image/png",
      },
      {
        name: "Brushed copper",
        bufferView: copperImageView,
        mimeType: "image/png",
      },
    ],
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews,
    accessors,
  }
  return { document, binary, dimensions: geometry.dimensions }
}

const padToFourBytes = (input: Uint8Array, paddingByte: number): Uint8Array => {
  const padding = (4 - (input.byteLength % 4)) % 4
  if (padding === 0) return input
  const output = new Uint8Array(input.byteLength + padding)
  output.set(input)
  output.fill(paddingByte, input.byteLength)
  return output
}

const createGlb = (document: GltfDocument, binary: Uint8Array): Uint8Array => {
  const jsonBytes = padToFourBytes(
    new TextEncoder().encode(JSON.stringify(document)),
    0x20,
  )
  const binaryBytes = padToFourBytes(binary, 0)
  const byteLength = 12 + 8 + jsonBytes.byteLength + 8 + binaryBytes.byteLength
  const output = new Uint8Array(byteLength)
  const view = new DataView(output.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, byteLength, true)
  view.setUint32(12, jsonBytes.byteLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  output.set(jsonBytes, 20)
  const binaryHeader = 20 + jsonBytes.byteLength
  view.setUint32(binaryHeader, binaryBytes.byteLength, true)
  view.setUint32(binaryHeader + 4, 0x004e4942, true)
  output.set(binaryBytes, binaryHeader + 8)
  return output
}

/** Generate a self-contained glTF 2.0 JSON document with embedded textures. */
export const generateFpcCableGltf = (
  definition: FpcCableDefinition,
  options: FpcCableAssetOptions = {},
): FpcCableGltfAsset => {
  const built = buildDocument(definition, options)
  const selfContained = structuredClone(built.document)
  selfContained.buffers[0]!.uri = bytesToDataUri(built.binary)
  const json = JSON.stringify(selfContained, null, 2)
  return {
    json,
    bytes: new TextEncoder().encode(json),
    dimensions: built.dimensions,
  }
}

/** Generate a binary glTF (`.glb`) with embedded polyimide and copper textures. */
export const generateFpcCableGlb = (
  definition: FpcCableDefinition,
  options: FpcCableAssetOptions = {},
): Uint8Array => {
  const built = buildDocument(definition, options)
  return createGlb(built.document, built.binary)
}
