# Serion Engine - Details Panel & Property Bridge
## ID: SER-10-DETAILS-PANEL | Estado: Activo

### 1. Visión General
El Panel de Detalles (Details Panel) es la interfaz principal de manipulación de Actores. Permite visualizar y modificar en tiempo real las propiedades (Transformación, Materiales, Luces) del objeto actualmente seleccionado en el `EditorState`.

### 2. El Reto del Desacoplamiento (Two-Way Binding)
El Editor no tiene acceso directo a la memoria de WebGPU ni a los punteros del `TransformPool` del Motor. Toda comunicación debe fluir a través de un puente estandarizado.

#### A. Lectura (Engine -> UI)
Cuando el `EditorState` cambia la selección (o cuando la selección cambia físicamente en el mundo), el Editor necesita los datos frescos.
* **El Enrutador:** Se establecerá una API global segura (ej. `window.SerionEngineAPI.getActorData(id)`) que devuelve un DTO (Data Transfer Object) estático con la posición, rotación, escala y componentes del Actor.
* **La Reacción:** El Panel de Detalles reconstruye su HTML basándose en este DTO.

#### B. Escritura (UI -> Engine)
Cuando el usuario arrastra un deslizador numérico en el Panel de Detalles, el motor debe reaccionar en el mismo fotograma.
* **El Evento:** La UI emite un evento de alta frecuencia: `serion:actor-property-changed`.
* **El Payload:** `{ id: number, component: string, property: string, value: number | number[] }`
* **La Ejecución:** El `SWorld` (o un puente dedicado) escucha este evento, localiza al `SActor`, y muta su valor. Al ser un setter del `SActor`, este actualizará automáticamente el `TransformPool` y marcará el Grafo de Escena como sucio.

### 3. Estructura de la Interfaz (Categorías)
Para mantener el orden, el panel se dividirá dinámicamente en categorías según los componentes que posea el DTO del Actor:
1. **Transform (Siempre presente):** Position (X,Y,Z), Rotation (Roll, Pitch, Yaw), Scale (X,Y,Z).
2. **Material (Condicional):** Base Color (RGB), Metallic, Roughness.
3. **Light (Condicional):** Intensity, Color.

### 4. Componentes UI Reutilizables
Se desarrollarán micro-componentes nativos para los inputs:
* `SerionVector3Input`: Un control de 3 ejes (X, Y, Z) con capacidad de arrastre (Drag) sobre las etiquetas para cambiar los valores suavemente como en Unreal Engine.