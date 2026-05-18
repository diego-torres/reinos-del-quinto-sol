# Sprites del proyecto

## Casas y construcción (`casas/`, `construccion/`)

PNG RGBA 1024×1024 (fuente de arte), una variante por cultura: `maya`, `mexica`, `tlaxcalteca`, `inca`.

- **Licencia:** obra original para **Reinos del Quinto Sol** (misma licencia que el repositorio salvo que se indique otro archivo README junto a un asset concreto).
- **Uso en cliente:** precarga en `apps/client/src/scenes/gameScene.ts`; claves de textura en `apps/client/src/art.ts` (`HOUSE_TEXTURE_KEYS`, `CONSTRUCTION_TEXTURE_KEYS`). Si falta un archivo, el cliente hace *fallback* (otra cultura, SVG legacy de casa o formas placeholder).

Detalle del alcance: [issue #10](https://github.com/diego-torres/reinos-del-quinto-sol/issues/10).
