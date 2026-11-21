import { z } from 'zod';
import { AppError } from '../errors.js';

const coord = (min, max) => z.number().finite().min(min).max(max);

export const locationSchema = z.object({
  address: z.string().trim().min(3, 'Address is required').max(300),
  latitude: coord(-90, 90),
  longitude: coord(-180, 180),
});

export const estimateSchema = z.object({ pickup: locationSchema, destination: locationSchema });

export const createRideSchema = estimateSchema.extend({
  idempotencyKey: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
});

export const availabilitySchema = z.object({ is_online: z.boolean() });

export const locationUpdateSchema = z.object({ latitude: coord(-90, 90), longitude: coord(-180, 180) });

export const idParamSchema = z.object({ id: z.string().uuid() });

/** Parse or throw a 400 AppError with readable field messages. */
export function parse(schema, value) {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request.', details);
  }
  return result.data;
}
