# Seek & Bellman · El Mundo del Wumpus (edición Metallica)

Juego web del **Mundo del Wumpus** con temática de Metallica que resuelve la práctica de Aprendizaje Reforzado con la
**Ecuación de Optimalidad de Bellman (V\*)** por iteración de valores, en una rejilla de 10 × 10.

**En línea:** https://sebastiux.github.io/audioibero/

Cinco escenarios, uno por disco y con dificultad creciente (la ruta segura más corta pasa de 18 a 26 pasos):

| Nivel | Disco | Wumpus | Pozos | Bellman |
|---:|---|---|---|---|
| 1 | Kill 'Em All (1983) | El Jinete | Charcos de sangre | *Seek & Bellman* |
| 2 | Ride the Lightning (1984) | Creeping Death | Sillas eléctricas | *For Whom the Bellman Tolls* |
| 3 | Master of Puppets (1986) | El Titiritero | Tumbas | *Master of Policies* |
| 4 | ...And Justice for All (1988) | La Justicia rota | Minas terrestres | *...And Bellman for All* |
| 5 | Metallica / The Black Album (1991) | La Serpiente | Agujeros negros | *Enter Bellman* |

El agente es un integrante de la banda en pixel-art (James, Kirk, Lars y Cliff o Jason según la época del disco).

## Qué incluye

- **Jugar**: niebla de guerra, percepciones clásicas (hedor junto al Wumpus, viento junto a un pozo, brillo junto al oro),
  las recompensas de la práctica y la comparación de tu ganancia descontada contra V\*(S0,0). Flechas/WASD o D-pad táctil.
- **Bellman (IA)**: iteración de valores barrido por barrido (V_k como mapa de calor y política greedy), inspector de la
  ecuación para cualquier celda (Q(s,a) de cada acción), gráfica de convergencia ΔV vs ε, ejecución animada de π\* y
  parámetros editables (γ, ε, resbalón) para experimentar.
- **Explicación**: los resultados paso a paso calculados en vivo sobre el mapa elegido: definición del MDP, iteraciones 1 y
  2 desglosadas, la onda de valor (ΔV_k = 100·γ^(k−1)), convergencia en K = d_max + 1, V\* y π\*, verificación del punto
  fijo, trayectoria óptima (G₀ = V\*(S0,0)) y la fórmula cerrada V\*(s) = −10 + 110·0.9^(d(s)−1).
- **[RESULTADOS.md](./RESULTADOS.md)**: la misma explicación como documento estático, generada con `npm run report`.

## MDP de la práctica

| | |
|---|---|
| Estados | 100 celdas S0,0 … S9,9 (x = columna, y = fila; S0,0 abajo a la izquierda) |
| Acciones | Norte, Sur, Este, Oeste |
| Meta | S9,9 (oro), r = +100, terminal |
| Peligros | 20 pozos + 5 Wumpus aleatorios (semilla por disco), r = −100, terminales |
| Costo de vida | r = −1 por movimiento a celda vacía |
| Fronteras | salir de la red deja al agente en s con r = −2 |
| γ / ε | 0.9 / 10⁻⁴ (iterar hasta ΔV < ε) |

El núcleo es TypeScript puro y probado: `src/core/mdp.ts` (modelo P(s′,r|s,a)), `src/core/valueIteration.ts`
(Bellman, iteración de valores, política greedy, trayectorias) y `src/core/explain.ts` (datos de la explicación).

## Desarrollo

```bash
npm install
npm run dev       # servidor local
npm test          # pruebas (Vitest)
npm run build     # typecheck + build de producción en dist/
npm run report    # regenera RESULTADOS.md
```

Stack: Vite 8 · React 19 · TypeScript · KaTeX · Vitest. Sprites pixel-art originales generados como SVG a partir de
texto (`src/sprites`) y efectos de sonido sintetizados con Web Audio (`src/audio/sfx.ts`), sin archivos externos.

## Despliegue en GitHub Pages

El workflow `.github/workflows/wumpus-pages.yml` corre pruebas y build en cada push o PR que toque esta carpeta, y
**publica automáticamente** en GitHub Pages cuando el cambio llega a la rama por defecto del repositorio (también se puede
lanzar a mano desde *Actions → Wumpus Metallica · GitHub Pages → Run workflow*).

Requisito único: en **Settings → Pages → Build and deployment → Source** elegir **GitHub Actions**.

---

Proyecto académico hecho por fans, sin afiliación con Metallica. Los sprites son pixel-art original y sólo se mencionan
títulos de discos y canciones.
