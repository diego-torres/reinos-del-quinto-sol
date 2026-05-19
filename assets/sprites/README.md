# Sprites del proyecto

## Casas y construcción (`casas/`, `construccion/`)

PNG RGBA 1024×1024 (fuente de arte), una variante por cultura: `maya`, `mexica`, `tlaxcalteca`, `inca`.

- **Licencia:** obra original para **Reinos del Quinto Sol** (misma licencia que el repositorio salvo que se indique otro archivo README junto a un asset concreto).
- **Uso en cliente:** precarga en `apps/client/src/scenes/gameScene.ts`; claves de textura en `apps/client/src/art.ts` (`HOUSE_TEXTURE_KEYS`, `CONSTRUCTION_TEXTURE_KEYS`, `TELPOCHCALLI_TEXTURE_KEYS`). Si falta un archivo, el cliente hace *fallback* (otra cultura, SVG legacy de casa o formas placeholder).

Detalle casas/construcción: [issue #10](https://github.com/diego-torres/reinos-del-quinto-sol/issues/10).

## Telpochcalli terminado (`telpochcalli/`)

PNG RGBA por cultura: `maya`, `mexica`, `tlaxcalteca`, `inca` (misma convención que casas; tamaño recomendado 1024×1024 en pipeline de arte).

- **Licencia:** obra original para **Reinos del Quinto Sol** (misma licencia que el repositorio salvo un README específico del asset).
- **Uso en cliente:** mismas rutas que casas (`gameScene.ts` precarga texturas registradas como `telpochcalli-culture-*` en `art.ts`).
- Obra **en construcción** sigue usando solo sprites de `construccion/` (todas las culturas).

Issue de alcance: [issue #12](https://github.com/diego-torres/reinos-del-quinto-sol/issues/12).
