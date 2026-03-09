# Serion Engine - Virtualized Tree View Outliner
## ID: SER-09-OUTLINER-VIRTUAL | Estado: Activo

### 1. Visión General (El Nivel Dios)
El Outliner es el panel central de gestión del editor. Para cumplir con el estándar AAA y soportar mundos masivos (>10,000 actores) sin causar bloqueos en el hilo principal (DOM Lag), el panel implementa un **Virtual Scroller Jerárquico**. No se dibuja un elemento HTML por cada actor; se dibuja una ventana de ~30 elementos que se reciclan a medida que el usuario hace scroll.

### 2. Puente de Eventos (Decoupling Absoluto)
El Outliner es un observador pasivo y ciego. No interroga al motor; solo escucha eventos emitidos en el objeto global `window`:
* `serion:actor-spawned`: Añade un nodo a la memoria cruda. Payload: `{ id: number, name: string, parentId: number | null }`
* `serion:actor-destroyed`: Elimina un nodo de la memoria cruda. Payload: `{ id: number }`
* `serion:selection-changed`: Actualiza el renderizado visual de selección. Payload: `{ selectedIds: number[] }`

### 3. La Memoria y El Algoritmo de Aplanamiento (Flattening)
Dado que no se puede virtualizar un árbol directamente, el panel mantiene dos estructuras en RAM:

1. **La Memoria Cruda (`Raw Data`):** Un `Map` que almacena todos los actores, sus relaciones (Padre-Hijo) y su estado visual (`isExpanded: boolean`).
2. **El Arreglo Plano (`Flattened List`):** Un arreglo 1D (unidimensional) generado dinámicamente. 
   * **El Algoritmo:** Cada vez que el motor crea/destruye un actor, o el usuario expande/colapsa una rama, se ejecuta un recorrido de Búsqueda en Profundidad (DFS). Si un nodo padre está colapsado (`isExpanded === false`), el algoritmo ignora a todos sus descendientes. El resultado es una lista secuencial de solo los elementos que *deberían* ser visibles, incluyendo su nivel de profundidad (`depth`) para la sangría visual.

### 4. La Matemática de la Virtualización (DOM Recycling)
En lugar de crear miles de `<div>`, el HTML se compone de:
* **Viewport (`overflow-y: auto`):** El contenedor visible.
* **Contenedor Fantasma (`height: FlattenedList.length * 24px`):** Un `div` vacío que fuerza al navegador a dibujar una barra de desplazamiento del tamaño real.
* **El Pool de Nodos:** Se instancian en el DOM únicamente la cantidad de filas que caben en la pantalla + un margen de seguridad (ej. 40 filas).
* **El Motor de Scroll:** Al interceptar el evento `scroll`, se calcula el índice inicial: `Math.floor(scrollTop / 24)`. El motor toma los nodos del Pool y les aplica `transform: translateY(Y px)` para moverlos a la posición correcta, inyectando los datos del arreglo plano (`Flattened List`) que corresponden a esos índices.

### 5. Flujo Unidireccional de Selección (Single Source of Truth)
Al hacer clic en un ítem virtualizado:
1. **Delegación:** La UI NO aplica estilos localmente. Llama a `EditorState.selectActor(id, isMulti)`.
2. **Reacción:** El `EditorState` emite `serion:selection-changed`.
3. **Redibujado:** El Virtual Scroller re-evalúa los nodos actualmente visibles y aplica la clase CSS `.selected` a los que coinciden.