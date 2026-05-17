export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function actionError(error: unknown): ActionResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Something went wrong.",
  };
}
