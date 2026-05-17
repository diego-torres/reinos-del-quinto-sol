# Reinos del Quinto Sol

Juego de estrategia en tiempo real online, open source, inspirado en las civilizaciones prehispanicas de Mesoamerica.

## Objetivo

Construir un RTS online con jugabilidad familiar para fans de los clasicos del genero: recoleccion de recursos, construccion de ciudades, unidades militares, tecnologias, exploracion, niebla de guerra y partidas competitivas.

El proyecto toma inspiracion mecanica de los RTS historicos, pero sera una obra original: codigo, arte, balance, nombres, musica, campanas y direccion visual propios.

## Estructura

```text
apps/
  client/   Cliente web del juego
  server/   Servidor autoritativo para partidas online
packages/
  shared/   Tipos, datos y reglas compartidas
docs/
  plan-inicial.md
  historia/
  diseno/
  tecnica/
assets/
  sprites/
  audio/
  mapas/
```

## Stack inicial propuesto

- TypeScript
- Vite + React para interfaz web
- Phaser para gameplay 2D
- Node.js para servidor
- WebSocket o Colyseus para multiplayer

## Pipeline visual y audio de aldeanos

El cliente carga hojas PNG para aldeanos por cultura desde `assets/sprites/aldeanos/`, con variantes masculino/femenina solo esteticas y audio procedural de seleccion/orden. El formato de grilla, fallback procedural y decisiones de licencia quedan documentados en `docs/diseno/aldeanos-arte-audio.md`.

## Licencia

Propuesta inicial:

- Codigo: GPLv3
- Assets y documentacion: CC BY-SA 4.0

La licencia definitiva debe confirmarse antes de aceptar contribuciones externas.
