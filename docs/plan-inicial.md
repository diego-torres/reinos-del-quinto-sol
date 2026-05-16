# Reinos del Quinto Sol

## Vision

**Reinos del Quinto Sol** sera un juego de estrategia en tiempo real online, open source, inspirado en la era prehispanica de Mesoamerica. La meta es capturar la sensacion de construir una ciudad, recolectar recursos, avanzar tecnologicamente, formar ejercitos, explorar el mapa y competir contra otros jugadores, con civilizaciones, unidades, arquitectura y sistemas historicos propios de la region.

El juego debe inspirarse en la jugabilidad clasica de los RTS, pero sin copiar assets, nombres, campanas, balance, codigo, audio ni identidad visual de Age of Empires. Queremos una obra original, historicamente informada y legalmente limpia.

## Principios del Proyecto

1. **Online desde el inicio**
   El modo multijugador no debe ser un agregado tardio. La simulacion, comandos, mapas y partidas deben pensarse desde el primer prototipo para funcionar por red.

2. **Open source**
   El repositorio debe incluir codigo, documentacion tecnica, guias de contribucion, licencia y una estructura que facilite que otros puedan ayudar.

3. **RTS clasico, identidad propia**
   El jugador debe reconocer patrones familiares: aldeanos, recursos, edificios, tecnologias, unidades militares, exploracion, niebla de guerra, edades o fases, combate y economia. Pero el lenguaje del juego debe venir de Mesoamerica.

4. **Historia con respeto**
   Usaremos nombres, culturas y referencias historicas con cuidado. Cuando haya incertidumbre historica, se documentara y se convertira en una decision de diseno transparente.

5. **Primero divertido, luego enorme**
   No empezamos con "todo Age of Empires". Empezamos con una partida pequena que ya tenga alma: recolectar, construir, producir unidades, explorar y ganar.

## Civilizaciones Iniciales Candidatas

Para el primer ciclo podemos escoger 3 civilizaciones jugables:

- **Maya**: ciudades-estado, astronomia, escritura, comercio, arquitectura ceremonial.
- **Mexica**: expansion militar, tributo, calpulli, guerra ritual, chinampas.
- **Pipil / Nahua centroamericanos**: conexion cultural mesoamericana con enfoque centroamericano.

Civilizaciones futuras:

- Zapoteca
- Mixteca
- Tolteca
- Teotihuacana
- Purepecha
- Lenca
- Chorotega
- Olmeca, probablemente como cultura antigua o escenario especial mas que faccion estandar

## Recursos Base

Recursos propuestos para diferenciarlo del modelo generico:

- **Maiz**: alimento principal.
- **Madera**: construccion y herramientas.
- **Piedra**: templos, defensas y edificios avanzados.
- **Obsidiana**: armas, elite militar y comercio.
- **Jade**: tecnologias, nobleza, diplomacia o unidades especiales.

Para el MVP conviene usar solo 4 recursos:

- Maiz
- Madera
- Piedra
- Obsidiana

## Estructura de Gameplay

El nucleo debe incluir:

- Vista isometrica o top-down 2D.
- Seleccion de unidades con mouse.
- Movimiento por clic derecho.
- Aldeanos recolectando recursos.
- Construccion de edificios.
- Produccion de unidades.
- Combate basico.
- Exploracion y niebla de guerra.
- Progresion por fases historicas.
- Partidas online 1v1 como primer objetivo multijugador.

## Fases en Lugar de "Edades"

Podemos usar fases con nombres propios:

1. **Aldea del Maiz**
2. **Ciudad de Piedra**
3. **Reino del Jade**
4. **Quinto Sol**

Otra opcion mas sobria:

1. Periodo Formativo
2. Periodo Clasico
3. Periodo Posclasico

Para un juego, recomiendo la primera opcion: es mas memorable.

## MVP Jugable

El primer MVP no debe intentar ser un RTS completo. Debe permitir una partida corta de 10 a 15 minutos.

Incluye:

- Un mapa pequeno generado o fijo.
- Dos jugadores online.
- Una civilizacion inicial, probablemente Maya.
- Centro ceremonial como edificio principal.
- Aldeanos.
- Recoleccion de maiz, madera, piedra y obsidiana.
- Casas para limite de poblacion.
- Cuartel o casa de guerreros.
- Una unidad militar basica.
- Un edificio defensivo simple.
- Condicion de victoria: destruir el centro ceremonial enemigo.

No incluye todavia:

- Campanas historicas.
- IA avanzada.
- Balance competitivo.
- Muchas civilizaciones.
- Arbol tecnologico completo.
- Diplomacia.
- Mercado complejo.
- Editor de mapas.

## Arquitectura Tecnica Recomendada

### Cliente

- **TypeScript**
- **Phaser** para el motor 2D.
- **React** para menus, lobby, HUD complejo y pantallas fuera de partida.
- **Vite** como build tool.

### Servidor

- **Node.js + TypeScript**
- **Colyseus** o servidor WebSocket propio para partidas online.
- Simulacion autoritativa en servidor para evitar trampas basicas.

### Datos del Juego

- Definiciones en JSON o TypeScript:
  - unidades
  - edificios
  - civilizaciones
  - tecnologias
  - mapas
  - costos
  - tiempos de produccion

### Persistencia

Para MVP:

- Sin base de datos o con almacenamiento local simple.

Luego:

- PostgreSQL para usuarios, ranking, partidas y estadisticas.

## Estructura Inicial del Repositorio

```text
reinos-del-quinto-sol/
  apps/
    client/
    server/
  packages/
    shared/
  docs/
    historia/
    diseno/
    tecnica/
  assets/
    sprites/
    audio/
    mapas/
  LICENSE
  README.md
  CONTRIBUTING.md
```

## Licencia Open Source

Recomendacion inicial:

- **Codigo**: GPLv3 si queremos que los forks tambien mantengan el codigo abierto.
- **Assets**: Creative Commons BY-SA 4.0, si queremos permitir remix con atribucion y misma licencia.

Alternativa mas permisiva:

- **Codigo**: MIT
- **Assets**: CC BY 4.0

Mi recomendacion para este juego: **GPLv3 para codigo y CC BY-SA 4.0 para assets**.

## Riesgos Importantes

- Un RTS completo es un proyecto grande. Hay que cortar el alcance con disciplina.
- Multiplayer en tiempo real es dificil; debe entrar desde el principio.
- Pathfinding, sincronizacion, niebla de guerra y balance seran sistemas centrales.
- La inspiracion en Age of Empires debe ser mecanica general, no copia exacta.
- La representacion historica necesita investigacion y notas de diseno.

## Primer Sprint

Objetivo: tener una demo local donde una unidad se mueve en un mapa y el proyecto ya compila.

Tareas:

1. Crear monorepo.
2. Configurar cliente con Vite, React, TypeScript y Phaser.
3. Configurar servidor TypeScript con WebSocket o Colyseus.
4. Crear paquete compartido con tipos de unidades, comandos y estado de partida.
5. Renderizar mapa simple.
6. Crear una unidad seleccionable.
7. Mover unidad con clic derecho.
8. Sincronizar movimiento basico desde servidor.

## Siguiente Decision

Antes de escribir codigo, conviene decidir:

- Motor 2D: Phaser o PixiJS.
- Estilo visual: pixel art, ilustrado 2D o low-poly falso 3D.
- Primeras civilizaciones: una sola para MVP o tres desde el diseno.
- Licencia exacta.

Recomendacion: empezar con **Phaser + TypeScript + servidor autoritativo Node.js**, una civilizacion Maya inicial y arte placeholder hasta que el gameplay funcione.

