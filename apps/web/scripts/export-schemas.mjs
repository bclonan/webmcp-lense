import { writeFile } from 'node:fs/promises'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  cartridgeSchema,
  commandSchema,
  resultSchema,
} from '../../../packages/schemas/src/index.ts'

for (const [name, schema] of [
  ['capability-cartridge', cartridgeSchema],
  ['desktop-command', commandSchema],
  ['desktop-result', resultSchema],
]) {
  await writeFile(
    new URL(`../../../packages/schemas/${name}.schema.json`, import.meta.url),
    JSON.stringify(zodToJsonSchema(schema, { name, $refStrategy: 'none' }), null, 2) + '\n',
  )
}
