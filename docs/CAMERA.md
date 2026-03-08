# Serion Engine - Camera Architecture & Viewport Standards
## ID: SER-03-CAMERA | Estado: Activo

### 1. Visión General (The Unreal Standard)
En Serion Engine, la cámara no es un objeto monolítico global. Siguiendo los principios SOLID y la arquitectura de motores AAA (como Unreal Engine), el sistema visual está completamente desacoplado en tres capas lógicas:
1. **Los Ojos (Datos Ópticos):** La cámara en sí misma.
2. **El Director (Orquestación):** El gestor que decide qué se renderiza.
3. **El Piloto (Input/Transformación):** El controlador que mueve la cámara.

Esta separación permite que una misma cámara pueda ser usada por el Editor (vuelo libre), atada al hueso de un personaje (Tercera Persona), o interpolada en una cinemática de forma transparente.

---

### 2. Estructura de Componentes

#### 2.1 `SCamera` (El Lente Óptico)
Es un *Proxy* ligero que envuelve a un `SActor` (el cual posee posición y rotación en el `TransformPool` DOD).
* **Responsabilidad:** Contener exclusivamente datos ópticos: `FOV` (Field of View), `AspectRatio`, `Near Clip`, `Far Clip`.
* **Cálculo:** Es el único componente autorizado para generar la Matriz de Proyección (Perspective) y calcular la Matriz de Vista (LookAt / View) basándose en la posición local de su Actor.
* **Output:** Genera el `Float32Array` (Matriz 4x4) que el RHI inyecta en el *Uniform Buffer* de la GPU.

#### 2.2 `CameraManager` (El Orquestador)
Pertenece al `SWorld` (Cada mundo instanciado tiene su propio director de cámaras).
* **Responsabilidad:** Mantener el estado de cuál es la `activeCamera` actual.
* **Transiciones (Futuro):** Será el encargado de realizar operaciones de *Camera Blending* (interpolar la posición y rotación entre dos `SCamera` durante cinemáticas o cambios de jugador).
* **Interconexión:** El `SerionEngine` (Main Loop) siempre le pide la matriz final a este Manager para enviarla al renderizador gráfico, sin importarle quién la controla.

#### 2.3 `Controllers` (Los Pilotos)
Son sistemas independientes que aplican mutaciones al `SActor` de una cámara.
* **`FreeCameraController` (Editor Fly Camera):**
  * Lee el `InputManager` del motor.
  * Mueve la cámara en el espacio **Local** (relativo hacia donde está mirando la cámara, no a los ejes globales del mundo).
  * Aplica un multiplicador de velocidad y usa el `deltaTime` para un movimiento fluido independiente de los FPS.

---

### 3. Convenciones Espaciales y de Navegación

El movimiento de las cámaras debe adherirse estrictamente al **Serion Standard (Z-Up)**:
* **Eje Forward (Adelante/Atrás):** Teclas `W` / `S`.
* **Eje Right (Strafe Lateral):** Teclas `A` / `D`.
* **Eje Up (Vertical Absoluto):** Teclas `E` (Subir / Z+) y `Q` (Bajar / Z-).

**Matemática de Vectores Locales:**
Cuando la cámara se desplaza hacia adelante (W), no suma valores al eje Y global, sino que avanza a lo largo de su propio *Vector Forward* (calculado a partir de su *Pitch* y *Yaw* actuales).

---

### 4. Reglas de Implementación (Mandamientos)
1. **Zero Render Knowledge:** El sistema de cámara (`SCamera`, `CameraManager`) jamás debe importar referencias directas a WebGPU o `SerionRHI`. Trabajan puramente con matemáticas (Float32Array) y el DOD.
2. **Data-Oriented Update:** Las cámaras no "poseen" sus coordenadas `X, Y, Z`. Las leen del `TransformPool` central a través de su Actor asociado.
3. **Viewport Independency:** La cámara desconoce la resolución de la pantalla. El `AspectRatio` debe ser inyectado por el sistema de UI (`SerionViewport`) cada vez que ocurre un evento de redimensión (*Resize*).