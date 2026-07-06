import { z } from "zod";

export const MovementConfigSchema = z.object({
  walkSpeed: z.number().positive(), // meters per second
  sprintSpeed: z.number().positive(), // meters per second
  groundAcceleration: z.number().positive(), // meters per second squared
  groundFriction: z.number().nonnegative(), // meters per second squared
  gravity: z.number().positive(), // meters per second squared
  jumpApexHeight: z.number().positive(), // meters
  airControl: z.number().min(0).max(1), // unitless air acceleration multiplier
  coyoteTime: z.number().nonnegative(), // seconds
  jumpBufferTime: z.number().nonnegative(), // seconds
  dashSpeed: z.number().positive(), // meters per second
  dashDuration: z.number().positive(), // seconds
  dashCooldown: z.number().nonnegative(), // seconds
  maxSlopeDegrees: z.number().min(0).max(89), // degrees
  groundSnapDistance: z.number().nonnegative(), // meters
  playerHeight: z.number().positive(), // meters
  playerRadius: z.number().positive(), // meters
  eyeHeight: z.number().positive(), // meters
  mouseSensitivity: z.number().positive(), // radians per mouse pixel
  baseFovDegrees: z.number().min(30).max(120), // degrees
});

export type MovementConfig = z.infer<typeof MovementConfigSchema>;

export const defaultMovementConfig: MovementConfig = MovementConfigSchema.parse({
  walkSpeed: 6,
  sprintSpeed: 9,
  groundAcceleration: 60,
  groundFriction: 40,
  gravity: 25,
  jumpApexHeight: 1.1,
  airControl: 0.3,
  coyoteTime: 0.1,
  jumpBufferTime: 0.12,
  dashSpeed: 18,
  dashDuration: 0.18,
  dashCooldown: 1.5,
  maxSlopeDegrees: 45,
  groundSnapDistance: 0.3,
  playerHeight: 1.8,
  playerRadius: 0.4,
  eyeHeight: 1.65,
  mouseSensitivity: 0.0022,
  baseFovDegrees: 75,
});
