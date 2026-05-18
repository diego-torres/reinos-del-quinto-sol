import {
  normalizeCeremonialCenterCulture,
  type CeremonialCenterCulture,
  type OnlineGameState,
} from "@reinos/shared";

/** Cultura visual del dueño según estado online (centro ceremonial). */
export function resolveBuildingCultureFromState(
  state: OnlineGameState | undefined,
  ownerId: string,
): CeremonialCenterCulture {
  const fromOnline = state?.ceremonialCenters.find((c) => c.ownerId === ownerId)?.culture;
  if (fromOnline !== undefined) return normalizeCeremonialCenterCulture(fromOnline);
  return "maya";
}

/** Cultura para edificios colocados en modo offline (centro local). */
export function resolveOfflinePlacementCulture(culture: CeremonialCenterCulture | undefined): CeremonialCenterCulture {
  if (culture !== undefined) return normalizeCeremonialCenterCulture(culture);
  return "maya";
}
