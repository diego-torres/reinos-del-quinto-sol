# Nombres de Edificios

## Edificio Militar Basico

En código compartido (`packages/shared`) el tipo de edificio que entrena guerreros comunes sigue siendo **`telpochcalli`** para una sola ruta jugable estable. Las **etiquetas en pantalla** y el **sprite terminado** varían por cultura del jugador (centro ceremonial), documentadas aquí.

| Cultura     | Etiqueta en pantalla | Justificación breve |
| ----------- | ------------------- | ------------------- |
| mexica      | **Telpochcalli** | Término nahua documentado para la institución de barrio vinculada a formación y guerra; mismo criterio que el prototipo. |
| tlaxcalteca | **Telpochcalli** | Pueblo nahua-plausible en el mismo marco cultural/arquitectónico mesoamericano central; mismo término que mexica hasta que una fuente local más específica sugiera etiqueta corta mejor documentada (ver issue #12). |
| maya        | **Popol na** | Léxico maya/colonial sobrio para estructuras cívicas/comunitarias tipo “casa del consejo” en sitios bajíos; uso en juego como abstracción del espacio municipal ligado al orden militar, sin pretender reproducir una tipología única excavada como “solo cuartel”. |
| inca        | **Kallanka** | Léxico habitual en español especializado sobre arquitectura inca para recintos alargados ligados a plazas y asambleas; encaja mejor que cualquier préstamo mesoamericano para el mismo rol RTS en los Andes. |

Archivos de sprites terminados (`assets/sprites/telpochcalli/*.png`): ver `assets/sprites/README.md`.

Función cliente que unifica etiqueta (`telpochcalliDisplayLabel`): `apps/client/src/art.ts`.

## Telpochcalli (contexto mexica/nahua)

Nombre mexica documentado para el mismo rol genérico de “primer edificio militar”:

**Telpochcalli**

Uso en juego (facciones mexica / nahua relacionadas):

- Edificio militar basico.
- Primer lugar para entrenar guerreros comunes.
- Construido por aldeanos.

Justificacion historica mesoamericana:

En la sociedad mexica, el telpochcalli era una institucion de barrio para jovenes, asociada con educacion comunitaria y entrenamiento para la guerra. Para un RTS mesoamericano, funciona mejor que una traduccion generica como "cuartel", porque mantiene identidad cultural y comunica que el edificio forma guerreros.

## Terminos Relacionados

### Calmecac

Institucion de formacion ligada a elites, sacerdocio, gobierno y tambien guerra. Es mejor reservarlo para tecnologias avanzadas, sacerdotes, nobles o unidades de elite.

### Cuauhcalli

Puede entenderse como "casa de aguilas" o espacio asociado a guerra y ordenes guerreras. Es un gran candidato para un edificio avanzado relacionado con guerreros aguila/jaguar o mejoras militares de elite.

## Decision de Diseno

Para el prototipo:

- Usar el identificador de reglas **`telpochcalli`** como equivalente jugable de “cuartel” en código compartido.
- Etiquetas visibles y arte por cultura según tabla arriba.
- Reservar **Cuauhcalli** para una fase posterior.
- Reservar **Calmecac** para tecnologias, nobleza, sacerdocio o unidades especiales.
