## 5. Arquitectura de Estado y Selección (Editor State)

Para soportar mundos masivos con miles de actores sin colapsar el DOM, el Editor implementa un patrón de **Eventos Granulares** y una **Fuente Única de Verdad** para la selección, imitando el subsistema `USelection` de Unreal Engine.

### 5.1 Pilar 1: Eventos Granulares del Motor (Zero-Rebuild)
El motor (`SWorld`) **jamás** enviará arreglos completos con toda la escena para redibujar la UI. En su lugar, emitirá eventos granulares de ciclo de vida mediante `CustomEvent` en el `window`:
* `serion:actor-spawned`: Emitido cuando nace un actor. Payload: `{ id: number, name: string }`.
* `serion:actor-destroyed`: Emitido cuando muere un actor. Payload: `{ id: number }`.

### 5.2 Pilar 2: El Cerebro del Editor (EditorState)
La UI no es dueña de qué objeto está seleccionado. Existirá un Singleton o Store estático llamado `EditorState` en `/packages/editor/src/core/EditorState.ts`.
* **Responsabilidad:** Mantener el arreglo `selectedActorIds`.
* **Acción:** Es la única entidad autorizada para modificar la selección y disparar el evento global `serion:selection-changed`.

### 5.3 Pilar 3: UI Reactiva (Desacoplamiento Absoluto)
Los paneles de la interfaz (Outliner, Details, Viewport) actúan como observadores ciegos:
1. **El Outliner:** Escucha `actor-spawned` y crea un nodo DOM (`div`) individual. Escucha `actor-destroyed` y elimina ese nodo específico.
2. **Interacción:** Si el usuario hace clic en el Outliner o en el Viewport 3D, estos NO se auto-iluminan. Simplemente llaman a `EditorState.selectActor(id)`.
3. **Reacción:** Todos los paneles escuchan `serion:selection-changed`. Cuando se dispara, el Outliner pinta la fila correspondiente de azul (`var(--serion-accent)`) y el panel de Detalles carga la información del ID seleccionado.