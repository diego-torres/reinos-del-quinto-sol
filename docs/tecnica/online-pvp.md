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

### Servidor a cliente

- `welcome`: confirma conexion, `playerId` y estado inicial.
- `state`: snapshot autoritativo de la partida.

## Alcance Actual

Este corte sincroniza movimiento y recoleccion de unidades entre navegadores. El servidor decide:

- cuanto recurso carga cada aldeano
- cuando vuelve al centro ceremonial
- cuando deposita recursos al inventario del jugador
- cuando un nodo queda agotado

Todavia falta migrar al servidor:

- construccion
- produccion
- combate
- Camazotz

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
