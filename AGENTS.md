# AGENTS.md

Guia de colaboracion para agentes que trabajen en **Reinos del Quinto Sol**.

## Proyecto

**Reinos del Quinto Sol** es un RTS online open source inspirado en las civilizaciones prehispanicas de Mesoamerica. El proyecto busca jugabilidad familiar para fans de estrategia historica, pero con identidad, arte, nombres, balance, campanas y codigo propios.

No copies assets, codigo, audio, textos, campanas, balance especifico ni identidad visual de juegos comerciales. La inspiracion debe ser mecanica y de genero, no una replica.

## Estructura

```text
apps/
  client/   Cliente web con Vite, TypeScript y Phaser
  server/   Servidor TypeScript para partidas online
packages/
  shared/   Tipos, datos y reglas compartidas
docs/
  diseno/   Roadmap, direccion artistica y campana
  historia/ Investigacion y notas historicas
  tecnica/  Decisiones tecnicas
assets/
  sprites/  Assets visuales iniciales y placeholders
  audio/
  mapas/
```

## Prioridades Actuales

El proyecto esta en fase de prototipo. Prioriza:

1. Gameplay jugable antes que sistemas grandes.
2. Recoleccion, construccion, produccion, combate y victoria.
3. Online desde temprano, con servidor autoritativo cuando el loop basico este estable.
4. Arte placeholder legible antes que arte final.
5. Documentar decisiones de historia y diseno cuando afecten gameplay.

## Reglas Tecnicas

- Usa TypeScript estricto.
- Mantén la logica compartida en `packages/shared` cuando sea usada por cliente y servidor.
- Mantén el gameplay de Phaser en `apps/client`.
- No metas reglas de juego importantes solo en texto del HUD; deben existir como estado manipulable.
- Evita dependencias nuevas sin razon clara.
- Si agregas una dependencia, actualiza `package-lock.json`.
- No hagas refactors amplios mientras implementas una feature pequena.
- No mezcles cambios de gameplay, arte y arquitectura si pueden ir en commits separados.

## Modularidad

- Evita que `apps/client/src/main.ts` vuelva a convertirse en un archivo monolitico.
- Coloca tipos del cliente en `apps/client/src/types.ts`.
- Coloca constantes, costos, estadisticas y reglas puras del cliente en `apps/client/src/rules.ts`.
- Coloca dibujo Phaser reutilizable o placeholder art en `apps/client/src/art.ts`.
- Si una regla debe ser autoritativa para online, no la dupliques solo en cliente: muévela o compártela desde `packages/shared`.
- Mantén `main.ts` enfocado en orquestar la escena: input, ciclo de update, sincronizacion online y coordinacion entre sistemas.
- Cuando un bloque pase de ~80-120 lineas o se pueda nombrar claramente, considera extraerlo a un modulo pequeno.
- Prefiere funciones puras y exports nombrados antes que clases utilitarias globales.

## Verificacion

Antes de cerrar un cambio de codigo, corre:

```bash
npm run typecheck
npm run build
```

Si el cambio afecta interaccion visual, prueba tambien en el navegador local:

```bash
npm run dev --workspace @reinos/client -- --host 127.0.0.1 --port 5173
```

## Diseño e Historia

- Usa `docs/diseno/roadmap.md` para orientar el alcance.
- Usa `docs/diseno/direccion-artistica.md` para decisiones visuales.
- Usa `docs/diseno/campania.md` para personajes, tono y misiones.
- Representa culturas reales con cuidado. Si una decision es especulativa, documentala.
- Evita convertir culturas reales en fantasia generica.
- Evita reducir Mesoamerica a guerra, sacrificio o exotismo.

## Assets

- Los assets iniciales pueden ser SVG o formas simples de Phaser.
- Prioriza siluetas claras y lectura tactica.
- Guarda assets fuente en `assets/`.
- No agregues assets con licencia desconocida.
- Si usas assets externos, deben ser compatibles con la licencia del proyecto y tener atribucion documentada.

## Git

- Trabaja en cambios pequenos y revisables.
- No reescribas historia de Git sin aprobacion explicita.
- No reviertas cambios ajenos sin permiso.
- Commits recomendados:
  - `Add villager resource gathering`
  - `Add basic house construction`
  - `Document Maya visual direction`

## Comunicacion

Cuando termines una tarea, reporta:

- Que cambiaste.
- Donde estan los archivos principales.
- Que comandos corriste.
- Si algo no se pudo verificar.
- El hash del commit si subiste cambios.
