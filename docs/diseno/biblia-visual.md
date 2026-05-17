# Biblia Visual

## Intencion

La primera direccion visual de **Reinos del Quinto Sol** sera un estilo **ilustrado plano** con lectura RTS: formas claras, colores ceremoniales, siluetas fuertes y detalles mesoamericanos simplificados.

La referencia compartida sugiere una ciudad lacustre monumental inspirada en Tenochtitlan: plazas amplias, templos escalonados, patios amurallados, calzadas, canales, chinampas, piedra clara, acentos rojos y turquesas. No buscamos copiar la imagen ni su estilo pixel/isometrico exacto; buscamos traducir su sensacion de orden urbano, densidad ceremonial y escala imperial a un lenguaje flat art propio.

## Pilar Visual

**Ciudad sagrada sobre agua viva.**

El mapa debe sentirse como una red de tierra, agua, cultivo y piedra ceremonial. Incluso con arte simple, el jugador debe percibir:

- Lago y canales como parte de la identidad del escenario.
- Plazas y templos como centros de poder.
- Chinampas y maizales como base economica.
- Jade, turquesa, rojo y ocre como acentos de prestigio.
- Siluetas simples antes que detalle decorativo.

## Paleta Sagrada e Imperial

La propuesta de paleta hace sentido para un vertical slice inspirado en Tenochtitlan. Ajuste recomendado: usarla como paleta principal, pero reservar los colores mas saturados para lectura tactica y puntos de interes.

| Color | Uso principal | Nota |
| --- | --- | --- |
| Azul turquesa / calipso | Agua, canales, iconos ceremoniales, acentos nobles | Debe sentirse luminoso, no electrico. |
| Ocre / amarillo mostaza | Maiz, estuco, sol, detalles de riqueza | Usarlo tambien para lectura de recursos. |
| Terracota / adobe | Suelo seco, calzadas, bases de edificios, tierra compactada | Buen color neutral calido para mapa. |
| Verde jade | Chinampas, vegetacion cuidada, plumas, elite | Reservar para vegetacion y detalles de prestigio. |
| Rojo carmin / coral | Escalinatas, banderas, frisos, contraste militar | Color de poder; no abusar para que siga destacando. |

## Valores Iniciales

Estos tonos son punto de partida, no contrato final:

```text
Turquesa agua       #27A7B8
Turquesa profundo   #146C78
Ocre maiz           #D7A735
Estuco claro        #D8C99A
Terracota           #B96542
Adobe oscuro        #743D2E
Jade                #2E8B64
Jade oscuro         #1F5E49
Carmin              #B33A32
Coral ritual        #D95A49
Obsidiana           #1B1824
Sombra calida       #4A382F
```

## Aplicacion

### Fondos y Terreno

- Agua: turquesa con bandas mas oscuras para profundidad.
- Suelo: terracota clara y adobe, con variacion por tiles.
- Plazas: estuco claro, piedra caliza o losas crema.
- Caminos y calzadas: terracota mas clara, bordeada con piedra.
- Chinampas: rectangulos verdes con bordes de tierra y canales visibles.

### Edificios

- Base en estuco, ocre y terracota.
- Escalinatas en rojo carmin o coral para hacerlas reconocibles.
- Bordes y terrazas con sombras del mismo color, no negro puro.
- Turquesa y jade solo como acentos: dinteles, mascarones, frisos, remates.
- Cada edificio debe tener una silueta distinta:
  - Casa: baja, rectangular, techo simple, tonos tierra.
  - Telpochcalli: mas ancho, militar, banderas o rojo marcado.
  - Centro ceremonial: piramide/plataforma alta, escalinata dominante.

### Personajes

- Cuerpos y ropa en bloques simples.
- Aldeano: silueta redondeada, carga visible, colores maiz/tierra.
- Guerrero basico: silueta angular, arma legible, acento rojo.
- Elite futura: jade, plumas, escudos mas grandes.
- Evitar exceso de patron en unidades pequenas; reservar patrones para retratos, iconos o unidades elite.

### Recursos

- Maizal: amarillo mostaza + verde jade, formas verticales repetidas.
- Bosque: verdes medios, troncos terracota oscuro.
- Piedra: estuco gris/caliza, volumen simple con sombra calida.
- Obsidiana: oscuro violeta/negro con brillo turquesa.

### Sombras

- Evitar negro puro salvo obsidiana o contornos muy especificos.
- Usar sombras analogas:
  - Turquesa con azul profundo.
  - Terracota con adobe oscuro.
  - Jade con verde oscuro.
  - Ocre con sombra calida.
- Sombra de suelo suave y consistente bajo unidades/edificios.

## Elementos de Estilo Inspirados en la Referencia

- Composicion urbana en terrazas y recintos.
- Piramides escalonadas con escalinatas rojas.
- Patios claros para crear contraste alrededor de edificios importantes.
- Canales y puentes como separadores tacticos.
- Muros bajos y plataformas para delimitar zonas.
- Pequeños estandartes para facciones y edificios militares.
- Arboles y chinampas en grupos ordenados, no bosque aleatorio solamente.
- Detalle ornamental concentrado en bordes, remates y entradas.

## Reglas de Flat Art

- Maximo 3 valores por material: base, sombra, acento.
- Silueta primero, textura despues.
- Contornos selectivos: usar borde oscuro solo cuando mejore lectura.
- No usar degradados grandes como solucion principal.
- No meter detalle historico si rompe lectura RTS.
- Cada asset debe verse bien al 50% de su tamano.

## Camara y Lectura

La direccion puede sugerir isometria, pero el prototipo actual usa top-down con ligera perspectiva. Para no rehacer el motor ahora:

- Mantener sprites 2D con vista superior inclinada.
- Edificios pueden tener fachadas frontales simplificadas.
- Unidades deben leerse desde arriba, con cabeza, cuerpo, arma y sombra.
- Los edificios importantes pueden ser mas altos visualmente, pero sin tapar unidades.

## Primer Paquete Visual

Prioridad de produccion:

1. Aldeano.
2. Guerrero basico.
3. Casa.
4. Telpochcalli.
5. Centro ceremonial.
6. Maizal.
7. Bosque.
8. Piedra.
9. Obsidiana.
10. Camazotz.
11. Tile de agua.
12. Tile de tierra/plaza.
13. Tile de chinampa.

## Hoja de Estilo Inicial

Primera lamina de referencia generada:

```text
assets/style/tenochtitlan-flat-style-sheet-v1.png
```

Esta hoja define una primera traduccion de la paleta a tres elementos: tile de agua, casa y aldeano. Debe usarse como guia de direccion, no como asset final listo para spritesheet.

Primeros assets integrados en Phaser:

```text
apps/client/public/assets/terrain/water-tile.svg
apps/client/public/assets/buildings/house-flat.svg
```

## Formato Tecnico Inicial

- Usar PNG transparentes para sprites finales/provisionales.
- Mantener SVG o Phaser shapes solo como placeholder temporal.
- Tamano sugerido:
  - Unidad: `128x128`.
  - Recurso pequeno: `160x160`.
  - Casa: `192x192`.
  - Telpochcalli: `256x256`.
  - Centro ceremonial: `384x384`.
  - Tile terreno: `256x256` o `128x128`.
- Guardar fuente en `assets/` con nombres descriptivos.

## Nota de Alcance Cultural

Esta biblia apunta a un primer paquete visual inspirado en Tenochtitlan y el Valle de Mexico. El proyecto puede conservar otras civilizaciones jugables en el roadmap, como Maya, pero cada civilizacion debe tener su propia sub-biblia visual para no mezclar arquitectura, simbolos y materiales sin intencion.
