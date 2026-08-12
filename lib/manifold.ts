import ManifoldModule, {
  type Manifold,
  type ManifoldToplevel,
} from "manifold-3d"
import { createFpcCableGeometry } from "./geometry"
import type { CompactTriangleMeshData } from "./sweep"
import type {
  FpcCableDefinition,
  FpcCableManifoldModel,
  FpcCableOptions,
} from "./types"

let manifoldModulePromise: Promise<ManifoldToplevel> | undefined

const getManifoldModule = async (): Promise<ManifoldToplevel> => {
  manifoldModulePromise ??= ManifoldModule().then((module) => {
    module.setup()
    return module
  })
  return manifoldModulePromise
}

const toManifold = (
  module: ManifoldToplevel,
  meshData: CompactTriangleMeshData,
  name: string,
): Manifold => {
  const mesh = new module.Mesh({
    numProp: 3,
    vertProperties: meshData.positions,
    triVerts: meshData.indices,
  })
  const solid = new module.Manifold(mesh)
  const status = solid.status()
  if (solid.isEmpty() || status !== "NoError") {
    solid.delete()
    throw new Error(`manifold-3d could not construct ${name}: ${status}`)
  }
  return solid
}

export const createFpcCableManifolds = async (
  definition: FpcCableDefinition,
  options: FpcCableOptions = {},
): Promise<FpcCableManifoldModel> => {
  const geometry = createFpcCableGeometry(definition, options)
  const module = await getManifoldModule()
  const substrate = toManifold(
    module,
    geometry.substrate.compact,
    "polyimide substrate",
  )
  const coverlay = toManifold(
    module,
    geometry.coverlay.compact,
    "polyimide coverlay",
  )
  const conductors: Manifold[] = []
  let polyimide: Manifold | undefined
  let combined: Manifold | undefined

  try {
    polyimide = module.Manifold.union([substrate, coverlay])
    const polyimideStatus = polyimide.status()
    if (polyimide.isEmpty() || polyimideStatus !== "NoError") {
      throw new Error(
        `manifold-3d could not construct the polyimide layers: ${polyimideStatus}`,
      )
    }
    for (const [index, conductor] of geometry.conductors.entries()) {
      conductors.push(
        toManifold(module, conductor.compact, `conductor ${index + 1}`),
      )
    }
    combined = module.Manifold.union([polyimide, ...conductors])
    const combinedStatus = combined.status()
    if (combined.isEmpty() || combinedStatus !== "NoError") {
      throw new Error(
        `manifold-3d could not union the cable assembly: ${combinedStatus}`,
      )
    }
  } catch (error) {
    combined?.delete()
    polyimide?.delete()
    for (const conductor of conductors) conductor.delete()
    coverlay.delete()
    substrate.delete()
    throw error
  }

  coverlay.delete()
  substrate.delete()

  let disposed = false
  return {
    polyimide,
    conductors,
    combined,
    dimensions: geometry.dimensions,
    dispose: () => {
      if (disposed) return
      disposed = true
      combined.delete()
      for (const conductor of conductors) conductor.delete()
      polyimide.delete()
    },
  }
}
