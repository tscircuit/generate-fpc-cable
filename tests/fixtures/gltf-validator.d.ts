declare module "gltf-validator" {
  export interface ValidationReport {
    issues: {
      numErrors: number
      numWarnings: number
      messages: Array<{ code: string; message: string; severity: number }>
    }
  }

  export function validateBytes(
    data: Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<ValidationReport>
}
