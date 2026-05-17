# Recurso alimento: categoría y fuentes

## Categoría jugable

- El contador global del jugador es **alimento** (clave `alimento` en datos compartidos).
- La UI y los mensajes muestran la palabra **alimento**, no “maíz” como nombre único del recurso económico.
- **Milpa / maizal** sigue siendo una fuente principal y referencia visual clara en el mapa (etiqueta “Maizal” en nodos de milpa).

## Orígenes en v1

| Origen (`foodSource`) | Rol en el mapa | Notas |
| --------------------- | -------------- | ----- |
| `milpa`               | Parcela cultivada (placeholder de maizal) | Misma regla de recolección que antes del renombre. |
| `caza`                | “Zona de caza” | Mismo recurso acumulable **alimento**; ritmo y riesgo se pueden diferenciar después. |

Ambos tipos depositan en el mismo stock. No hay subtipos de inventario en el prototipo actual.

## Futuro cercano

- **Crianza** de fauna útil (ganadería mesoamericana inspirada, nomenclatura propia) puede añadirse como otro `foodSource` sin añadir un segundo recurso si el diseño sigue priorizando un solo contador.
- Cualquier mecánica con carga cultural concreta debe tener nota breve en `docs/diseno` o `docs/historia`.
