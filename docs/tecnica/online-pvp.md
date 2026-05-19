# Online PvP

## Primer Corte Implementado

El servidor WebSocket mantiene el estado autoritativo inicial de la partida para:

- jugadores conectados
- unidades iniciales por jugador
- posiciones de unidades
- comandos de movimiento
- recursos globales por jugador
- nodos de recursos del mapa
- recoleccion, carga y deposito de aldeanos
- construccion de casa y telpochcalli
- entrenar aldeano desde el centro ceremonial y guerrero desde un telpochcalli terminado
- edificios visibles para todos los clientes conectados
- centros ceremoniales por jugador
- objetivo de victoria por destruir el centro ceremonial rival

El cliente se conecta a:

```text
ws://127.0.0.1:8787
```

Al conectarse, el servidor asigna un `playerId`, crea unidades iniciales para ese jugador y transmite snapshots de estado a todos los clientes.

## Comandos Actuales

### Cliente a servidor

- `move-unit`: mueve una unidad propia hacia una posicion del mapa.
- `gather-resource`: ordena a un aldeano propio recolectar un nodo de recurso.
- `deposit-resources`: ordena a un aldeano propio depositar su carga en el centro ceremonial.
- `build-structure`: solicita a un aldeano propio construir una casa o telpochcalli.
- `attack-center`: ordena a un guerrero propio atacar un centro ceremonial enemigo.
- `train-unit`: pide crear un **aldeano** (centro ceremonial) o **guerrero** (telpochcalli terminado), con coste y cupo poblacional validados en el servidor.

### Servidor a cliente

- `welcome`: confirma conexion, `playerId` y estado inicial.
- `state`: snapshot autoritativo de la partida.

## Alcance Actual

Este corte sincroniza movimiento, recoleccion y construccion entre navegadores. El servidor decide:

- cuanto recurso carga cada aldeano
- cuando vuelve al centro ceremonial
- cuando deposita recursos al inventario del jugador
- cuando un nodo queda agotado
- si un aldeano puede construir
- si el jugador tiene recursos suficientes
- si el edificio puede colocarse en esa posicion
- que edificios existen en el mapa
- donde esta cada centro ceremonial
- vida y destruccion de centros ceremoniales
- ganador de la partida cuando cae un centro rival

Todavia falta migrar al servidor:

- produccion
- combate entre unidades
- Camazotz

El snapshot compartido no incluye el limite de poblacion de jugadores rivales. El cliente calcula y muestra solo el limite propio a partir de sus casas.

El mapa online usa `6800x4500`, aproximadamente ocho veces el area del primer prototipo (`2400x1600`). El cliente permite zoom out hasta `25%` para revisar grandes porciones del mapa.

## Como Probar

En una terminal:

```bash
npm run dev --workspace @reinos/server
```

En otra terminal:

```bash
npm run dev --workspace @reinos/client -- --host 127.0.0.1 --port 5173
```

Luego abrir dos navegadores o dos pestanas en:

```text
http://127.0.0.1:5173/
```

Mover una unidad propia con clic derecho. El otro cliente debe ver la misma unidad moverse.

Para probar recoleccion online, seleccionar un aldeano propio y hacer clic derecho sobre un recurso. Ambos clientes deben ver al aldeano recolectar, volver al centro ceremonial, depositar y actualizar el inventario compartido del jugador.

Para probar construccion online, seleccionar un aldeano propio, presionar `H` para casa o `T` para telpochcalli y colocar el edificio con clic izquierdo. Ambos clientes deben ver aparecer el mismo edificio y solo el jugador constructor debe ver su propio limite de poblacion actualizado.

Para probar el objetivo de victoria, abrir dos clientes, seleccionar un guerrero propio y hacer clic derecho sobre el centro ceremonial enemigo. El servidor mueve el guerrero, aplica dano al centro cuando entra en rango y declara ganador al jugador atacante cuando la vida llega a cero.
