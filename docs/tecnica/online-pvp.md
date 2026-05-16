# Online PvP

## Primer Corte Implementado

El servidor WebSocket mantiene el estado autoritativo inicial de la partida para:

- jugadores conectados
- unidades iniciales por jugador
- posiciones de unidades
- comandos de movimiento

El cliente se conecta a:

```text
ws://127.0.0.1:8787
```

Al conectarse, el servidor asigna un `playerId`, crea unidades iniciales para ese jugador y transmite snapshots de estado a todos los clientes.

## Comandos Actuales

### Cliente a servidor

- `move-unit`: mueve una unidad propia hacia una posicion del mapa.

### Servidor a cliente

- `welcome`: confirma conexion, `playerId` y estado inicial.
- `state`: snapshot autoritativo de la partida.

## Alcance Actual

Este corte sincroniza movimiento de unidades entre navegadores. Todavia falta migrar al servidor:

- recoleccion
- construccion
- produccion
- combate
- Camazotz
- recursos globales por jugador

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

