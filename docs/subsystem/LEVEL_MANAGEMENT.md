# Serion Engine - Level & Tab Management Architecture
## ID: SER-11-LEVELS | Estado: Activo | Revisión: AAA Standard

### 1. Jerarquía de Datos Core (El Estándar Unreal)
La estructura de memoria del motor se divide estrictamente en tres capas para separar los datos en reposo de la ejecución en vivo:

1. **`SProject` (El Contenedor Maestro):** Es la raíz de la sesión. Almacena la configuración global, las físicas por defecto y el "Manifiesto de Niveles" (rutas a todos los mapas del juego). Solo existe uno activo a la vez en el `EditorState`.
2. **`SWorld` (La Instancia Viva / Espacio-Tiempo):** Es el motor ejecutándose. Maneja el pipeline de WebGPU, el sistema ECS (Físicas, TransformPool) y el bucle `tick()`. 
3. **`SLevel` (La Caja de Datos):** Es un objeto puro de datos que vive *dentro* del `SWorld`. Contiene la lista de `SActor`s. Al guardar un mapa en el disco duro (JSON), lo que se serializa es únicamente el `SLevel`. Un `SWorld` siempre tiene un "Persistent Level" (Nivel Persistente principal).

### 2. Aislamiento de Memoria (RAM vs VRAM)
Para prevenir el colapso de la memoria (Out of Memory) al tener múltiples pestañas abiertas, el motor implementa un estricto patrón de agrupación de recursos (Asset Pooling):

* **Memoria Local (RAM - Duplicada por Pestaña/Mundo):** Cada `SWorld` posee su propio Grafo de Escena, su propio `TransformPool` (TypedArrays) y sus propias instancias lógicas de `SActor` dentro de su `SLevel`. Esto es extremadamente ligero en CPU.
* **Memoria Global (VRAM - Compartida):** Los recursos pesados (Geometrías, Texturas, Shaders) NUNCA pertenecen al `SWorld` ni al `SLevel`. Son propiedad del `SerionEngine` (Global Asset Registry). Si tres mundos distintos utilizan el mismo "Cubo" o "Textura 4K", solo existe una copia en la VRAM de WebGPU.

### 3. Ciclo de Vida y Suspensión (Tick Suspension)
El motor de renderizado (`SerionRHI`) solo puede dibujar un mundo a la vez.
1. **Active World:** El mundo asociado a la pestaña visible. Su método `update()` se ejecuta en cada frame, resolviendo físicas, animaciones y enviando comandos de dibujo a WebGPU.
2. **Suspended World:** Los mundos en pestañas ocultas entran en hibernación. Sus datos permanecen en RAM, pero el motor detiene su ciclo `update()` y `render()`. El consumo de CPU/GPU de un mundo suspendido es **cero**.

### 4. Gestión de Estado UI (Dirty Flag)
El `TabManager` rastrea las mutaciones del `SWorld` activo. Si el sistema de Undo/Redo registra un nuevo comando, o si un actor es modificado dentro del `SLevel`, la pestaña se marca como "Sucia" (`isDirty = true`). 
* Visualmente, la pestaña añade un asterisco `*` a su nombre (ej. `Level_Main*`).
* Al intentar cerrar la pestaña (clic en la 'X'), el `TabManager` intercepta la acción y exige guardar los cambios o descartarlos antes de destruir la instancia de `SWorld` en memoria.