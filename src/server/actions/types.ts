export type ActionState = {
  error?: string;
  message?: string;
  ok?: boolean;
};

export const idleState: ActionState = {};

export function fail(error: string): ActionState {
  return { error, ok: false };
}

export function succeed(message?: string): ActionState {
  return { message, ok: true };
}
