# Serion Engine - Core Architecture & Engineering Specification

Este documento establece los pilares técnicos y la hoja de ruta de implementación para `@serion/engine`. El objetivo primordial es alcanzar un rendimiento de grado AAA en la web mediante el uso de WebGPU, Diseño Orientado a Datos (DOD) y una gestión de memoria de "Cero Copia".

---

## 1. El Corazón del Sistema: SObject y Reflexión

Inspirado en el `UObject` de Unreal, el `SObject` es la clase base de toda la jerarquía del motor.

### 1.1 Metadatos y Reflexión
* **Sistema de Decoradores:** Utilizaremos decoradores de TypeScript (`@property`) para marcar variables que el Editor deba exponer en tiempo real.
* **Descubrimiento Dinámico:** El motor genera un esquema de metadatos al inicio, permitiendo que el panel de Detalles del Editor construya interfaces automáticamente sin acoplamiento directo de código.

### 1.2 Gestión de Memoria "Pool-Based"
* **Zero New:** Prohibida la instanciación de `SObjects` durante el bucle de ejecución principal (`Tick`).
* **Reciclaje de Objetos:** Implementación de un **Global Object Pool**. Los objetos se "activan" y "desactivan" en lugar de ser eliminados, neutralizando las pausas del Garbage Collector de JavaScript.

---

## 2. Arquitectura de Simulación: Proyectos, Mundos y Niveles

Para replicar el comportamiento de motores AAA, la memoria de simulación se divide en tres entidades jerárquicas:

### 2.1 SProject (El Contenedor Maestro)
Es la entidad raíz de una sesión de desarrollo. Mantiene la configuración global (Project Settings) y un Manifiesto que registra todos los niveles que pertenecen al juego.

### 2.2 SWorld (El Espacio-Tiempo Vivo)
Cada `SWorld` es un contenedor estanco que gestiona su propio ECS (Entity Component System), motor de físicas e iluminación.
* Es el encargado de procesar la lógica y enviar los comandos de renderizado a WebGPU.
* Contiene un nivel principal en memoria llamado **Persistent Level**.
* Soporta suspensión: Un `SWorld` en segundo plano no consume ciclos de CPU/GPU.

### 2.3 SLevel (La Caja de Datos)
Es el contenedor puramente de datos que agrupa a los `SActor`s. No tiene físicas ni renderizado propio. Al guardar el juego en el disco, lo que se serializa a JSON es el `SLevel`, no el `SWorld`.

---

## 3. Modelo de Actores: Actor-Component Híbrido (DOD)

Para manejar miles de actores simultáneamente, abandonamos el modelo de "clases pesadas" en favor de un enfoque orientado a datos.

### 3.1 SActor (Proxy Ligero)
El `SActor` es un contenedor lógico con un ID único de 32 bits. No almacena datos de transformación internamente.

### 3.2 Componentes de Datos (ECS)
* **Transform Component:** Los datos de posición, rotación y escala de todos los actores residen en un único `SharedArrayBuffer` continuo (`Float32Array`).
* **Linear Processing:** Los sistemas del motor procesan estos buffers secuencialmente, maximizando el aprovechamiento de la caché de la CPU.
* **GPU Mirroring:** Los buffers de transformación se envían a la GPU mediante `device.queue.writeBuffer` en un solo bloque por frame, reduciendo el overhead de comunicación.

---

## 4. RHI (Rendering Hardware Interface)

Capa de abstracción que separa la lógica del motor de la API nativa de WebGPU.

### 4.1 Responsabilidades del RHI
* **DPI Awareness:** Sincronización automática de la resolución del canvas con el `devicePixelRatio` para nitidez absoluta.
* **Bind Group Caching:** Sistema de caché para evitar la recreación costosa de grupos de recursos de GPU en cada frame.
* **The Grid Overlay:** La rejilla de referencia se implementa como un sombreador de post-procesado (Shader) vinculado al Viewport, no como un actor en el mundo, garantizando que no consuma recursos de simulación.

---

## 5. Ejecución Multihilo (Multi-Threaded Architecture)

Para garantizar 60 FPS estables mientras el Editor realiza tareas pesadas:
* **Main Thread:** Gestiona la UI del Editor, la entrada del usuario y la orquestación del RHI.
* **Simulation Worker (Web Worker):** Ejecuta el bucle de física, IA y actualización del `SWorld`.
* **Interlink:** La comunicación entre hilos se realiza mediante la transferencia de `SharedArrayBuffers`, eliminando la latencia de copia de datos.

---

## 6. Mandamientos de Optimización

1.  **Strict Memory Alignment:** Todos los datos binarios deben estar alineados a 16 bytes para compatibilidad nativa con WebGPU.
2.  **No Dynamic Arrays:** Los pools de memoria deben tener tamaños pre-asignados ajustables en el `Project Settings`.
3.  **Command Pattern:** Cada cambio en el mundo desde el Editor debe ser un objeto `Command`, permitiendo un sistema de Undo/Redo eficiente y serializable.