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
  const polyimide = toManifold(
    module,
    geometry.polyimide.compact,
    "polyimide cover",
  )
  const conductors: Manifold[] = []
  let combined: Manifold | undefined

  try {
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
    for (const conductor of conductors) conductor.delete()
    polyimide.delete()
    throw error
  }

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
