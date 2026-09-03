import { z } from 'zod'
export const pointSchema = z
  .object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) })
  .strict()
export const desktopPointSchema = z
  .object({
    x: z.number().int().min(-100000).max(100000),
    y: z.number().int().min(-100000).max(100000),
  })
  .strict()
export const keySchema = z.enum([
  'WIN',
  'ENTER',
  'ESC',
  'TAB',
  'BACKSPACE',
  'DELETE',
  'CTRL+A',
  'CTRL+C',
  'CTRL+V',
  'CTRL+S',
  'ALT+F4',
  'CMD+A',
  'CMD+C',
  'CMD+V',
  'CMD+S',
  'CMD+W',
  'CMD+SPACE',
  'LEFT',
  'RIGHT',
  'UP',
  'DOWN',
])
const id = z.string().min(1).max(64)
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('pointer.move'), point: desktopPointSchema }).strict(),
  z
    .object({
      id,
      type: z.literal('pointer.click'),
      point: desktopPointSchema,
      button: z.enum(['left', 'right']),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('pointer.drag'),
      points: z.array(desktopPointSchema).min(2).max(128),
      durationMs: z.number().int().min(50).max(5000),
    })
    .strict(),
  z.object({ id, type: z.literal('keyboard.text'), text: z.string().min(1).max(2000) }).strict(),
  z.object({ id, type: z.literal('keyboard.key'), key: keySchema }).strict(),
  z
    .object({ id, type: z.literal('scroll'), delta: z.number().int().min(-1200).max(1200) })
    .strict(),
])
export const resultSchema = z
  .object({
    id,
    ok: z.boolean(),
    executedAt: z.number().finite(),
    error: z.string().max(1000).optional(),
  })
  .strict()
export const boundsSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .strict()
export const capabilitiesSchema = z
  .object({
    protocolVersion: z.literal(1).optional(),
    bridgeVersion: z.string().max(40).optional(),
    sessionId: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .optional(),
    timestamp: z.number().int().nonnegative().optional(),
    device: z.string().max(200).optional(),
    displayRevision: z.string().max(8000).optional(),
    keys: z.array(keySchema).optional(),
    platform: z.enum(['mock', 'windows', 'macos', 'linux']),
    coordinateSpace: z.enum(['physical-pixels', 'logical-points']).optional(),
    desktopBounds: boundsSchema,
    displayScale: z.number().positive(),
    commands: z.array(
      z.enum([
        'pointer.move',
        'pointer.click',
        'pointer.drag',
        'keyboard.text',
        'keyboard.key',
        'scroll',
      ]),
    ),
    emergencyStop: z.boolean(),
    displays: z
      .array(
        z
          .object({ id: z.string(), name: z.string(), bounds: boundsSchema, primary: z.boolean() })
          .strict(),
      )
      .optional(),
  })
  .strict()
export const pairedResponseSchema = z
  .object({
    protocolVersion: z.literal(1),
    bridgeVersion: z.string().max(40),
    sessionId: z.string().regex(/^[a-f0-9]{32}$/),
    timestamp: z.number().int().nonnegative(),
    token: z.string().regex(/^[a-f0-9]{64}$/),
    expiresIn: z.number().int().positive().max(1800),
  })
  .strict()
export const nativeCapabilitiesSchema = capabilitiesSchema.extend({
  protocolVersion: z.literal(1),
  bridgeVersion: z.string().max(40),
  sessionId: z.string().regex(/^[a-f0-9]{32}$/),
  timestamp: z.number().int().nonnegative(),
  device: z.string().max(200),
  displayRevision: z.string().max(8000),
  keys: z.array(keySchema),
})
export const bridgeRequestSchema = z
  .object({
    protocolVersion: z.literal(1),
    sessionId: z.string().regex(/^[a-f0-9]{32}$/),
    timestamp: z.number().int().nonnegative(),
    displayRevision: z.string().max(8000),
    command: commandSchema,
  })
  .strict()
export const bridgeReceiptSchema = z
  .object({
    protocolVersion: z.literal(1),
    bridgeVersion: z.string().max(40),
    sessionId: z.string().regex(/^[a-f0-9]{32}$/),
    commandId: id,
    timestamp: z.number().int().nonnegative(),
    status: z.enum(['completed', 'failed']),
    result: resultSchema,
    error: z
      .object({ code: z.string().max(80), message: z.string().max(1000) })
      .strict()
      .optional(),
  })
  .strict()
const stepBase = { approval: z.boolean().optional() }
const target = { targetId: z.string().max(120).optional(), point: pointSchema.optional() }
export const cartridgeStepSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...stepBase,
      type: z.literal('click'),
      ...target,
      button: z.enum(['left', 'right']).optional(),
    })
    .strict(),
  z.object({ ...stepBase, type: z.literal('type'), text: z.string().min(1).max(2000) }).strict(),
  z.object({ ...stepBase, type: z.literal('press'), key: keySchema }).strict(),
  z
    .object({
      ...stepBase,
      type: z.literal('scroll'),
      delta: z.number().int().min(-1200).max(1200),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal('drag'),
      points: z.array(pointSchema).min(2).max(128),
      durationMs: z.number().int().min(50).max(5000).optional(),
    })
    .strict(),
  ...(['locate', 'waitFor', 'assert'] as const).map((type) =>
    z.object({ ...stepBase, type: z.literal(type), text: z.string().min(1).max(500) }).strict(),
  ),
])
export const cartridgeSchema = z
  .object({
    version: z.literal(1),
    id,
    name: z.string().min(1).max(100),
    description: z.string().max(1000),
    application: z.string().max(100),
    inputs: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/), z.string().max(500)),
    steps: z.array(cartridgeStepSchema).min(1).max(100),
    assertions: z.array(z.string().max(500)).max(20),
    approvalRequirements: z.array(z.string().max(200)).max(20),
    metadata: z
      .object({
        createdAt: z.number(),
        observationSource: z.string().max(100),
        author: z.string().max(100),
        notes: z.array(z.string().max(1000)).max(100).optional(),
      })
      .strict(),
  })
  .strict()
export const sequenceSchema = z
  .object({
    name: z.string().min(1).max(100),
    steps: z.array(cartridgeStepSchema).min(1).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    value.steps.forEach((step, index) => {
      if (step.type === 'click' && !!step.targetId === !!step.point)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index],
          message: 'A click needs exactly one targetId or point.',
        })
    })
  })
