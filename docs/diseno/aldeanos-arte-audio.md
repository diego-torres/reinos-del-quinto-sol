# Aldeanos: arte, variantes y audio

## Decision actual

El MVP usa hojas PNG generadas como arte fuente de aldeanos. Si una hoja falta o no carga, el cliente conserva un rig procedural en Phaser como fallback para mantener el juego verificable. El contrato visual por cultura es:

- `maya`
- `mexica`
- `tlaxcalteca`
- `inca`

Cada cultura cambia paleta, acentos y lectura de silueta. Las variantes `masculino` y `femenina` son solo esteticas: no cambian velocidad, vida, costos, capacidad de carga ni reglas.

## Formato de hojas

Los sprites fuente viven en `assets/sprites/aldeanos/` con esta nomenclatura:

- `maya-masculino.png`
- `maya-femenina.png`
- `mexica-masculino.png`
- `mexica-femenina.png`
- `tlaxcalteca-masculino.png`
- `tlaxcalteca-femenina.png`
- `inca-masculino.png`
- `inca-femenina.png`

Formato esperado:

- PNG RGBA con transparencia.
- 2048 x 2048 px.
- Grilla de 4 filas x 6 columnas.
- Sin texto ni UI dentro de la imagen.
- Personaje centrado y escala consistente entre frames.

## Asignacion de variantes

La variante de genero se deriva de un hash estable del id de unidad y propietario. Esto se comporta como aleatoriedad visual para el jugador, pero evita que diferentes clientes online vean variantes distintas para la misma unidad.

## Estados visuales actuales

| Estado de gameplay | Estado visual | Decision |
| --- | --- | --- |
| Sin objetivo | `idle` | balanceo suave para mantener lectura sin distraer |
| Movimiento normal | `walk` | fila 1 de la hoja |
| Modo/orden de construccion | `build` | fila 2 de la hoja |
| Recoleccion de alimento/recurso | `gather-food` | fila 3 de la hoja |
| Regreso con recurso | `carry` | fila 4 de la hoja |

Por ahora `gather-food` se usa como estado visual de recoleccion general porque el cliente todavia no distingue clips por tipo de recurso. Cuando existan spritesheets, se puede separar `gather-wood`, `gather-stone` y `gather-obsidian` sin cambiar gameplay.

## Audio

La seleccion y la confirmacion de orden usan tonos procedurales cortos generados con Web Audio. Son distintos entre si y tienen enfriamiento para evitar spam cuando se seleccionan o comandan varias unidades.

No hay fuente externa que atribuir para estos sonidos. Si se reemplazan por voces o foley, los archivos fuente y la atribucion deben quedar en `assets/audio/` con licencia compatible con el proyecto.
