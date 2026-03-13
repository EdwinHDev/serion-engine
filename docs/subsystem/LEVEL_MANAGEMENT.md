# Serion Engine - Level & Tab Management Architecture
## ID: SER-11-LEVELS | Estado: Activo | Revisión: AAA Standard

### 1. Visión General (El Paradigma Multi-Mundo)
Al igual que en Unreal Engine, un "Nivel" (Level) en el Editor no es simplemente una capa visual; es una instancia completa y aislada de la clase `SWorld`. El editor permite tener múltiples niveles abiertos simultáneamente representados mediante pestañas (Tabs).

### 2. Aislamiento de Memoria (RAM vs VRAM)
Para prevenir el colapso de la memoria (Out of Memory) al tener múltiples pestañas abiertas, el motor implementa un estricto patrón de agrupación de recursos (Asset Pooling):

* **Memoria Local (RAM - Duplicada por Nivel):** Cada `SWorld` posee su propio Grafo de Escena, su propio `TransformPool` (TypedArrays) y sus propias instancias lógicas de `SActor`. Esto es extremadamente ligero en CPU.
* **Memoria Global (VRAM - Compartida):** Los recursos pesados (Geometrías, Texturas, Shaders) NUNCA pertenecen al `SWorld`. Son propiedad del `SerionEngine` (Global Asset Registry). Si tres niveles distintos utilizan el mismo "Cubo" o "Textura 4K", solo existe una copia en la VRAM de WebGPU.

### 3. Ciclo de Vida y Suspensión (Tick Suspension)
El motor de renderizado (`SerionRHI`) solo puede dibujar un mundo a la vez.
1. **Active World:** El nivel asociado a la pestaña visible. Su método `update()` se ejecuta en cada frame, resolviendo físicas, animaciones y enviando comandos de dibujo a WebGPU.
2. **Suspended World:** Los niveles en pestañas ocultas entran en hibernación. Sus datos permanecen en RAM, pero el motor detiene su ciclo `update()` y `render()`. El consumo de CPU/GPU de un nivel suspendido es **cero**.

### 4. Gestión de Estado UI (Dirty Flag)
El `TabManager` rastrea las mutaciones del `SWorld`. Si el sistema de Undo/Redo registra un nuevo comando, o si un actor es modificado, el nivel se marca como "Sucio" (`isDirty = true`). 
* Visualmente, la pestaña añade un asterisco `*` a su nombre (ej. `Level_01*`).
* Al intentar cerrar la pestaña (clic en la 'X'), el `TabManager` intercepta la acción y exige guardar los cambios o descartarlos antes de destruir la instancia de `SWorld` en memoria.