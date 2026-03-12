# Serion Engine - Transaction & History System Architecture
## ID: SER-10-HISTORY | Estado: Activo | Revisión: AAA Standard

### 1. Visión General
El Sistema de Transacciones (Undo/Redo) de Serion Engine es el pilar de la herramienta de autoría. Está diseñado bajo el principio de **"Almacenamiento Delta" (Delta Storage)**. 
Queda **estrictamente prohibido** realizar "Snapshots" (copias completas de la escena) para guardar el historial. Cada paso en el historial debe registrar *únicamente* los bytes de información que cambiaron.

### 2. Patrón Arquitectónico: Command Pattern Avanzado
El sistema se basa en el patrón de diseño "Command", donde cada acción del usuario se encapsula en un objeto independiente que sabe cómo aplicarse y cómo revertirse.

#### 2.1 La Interfaz Universal (`ICommand`)
Todo comando en el motor debe implementar esta interfaz estricta:
* `execute()`: Aplica la mutación hacia adelante (Redo).
* `undo()`: Aplica la mutación hacia atrás (Undo).
* `name`: Un identificador en string (ej. "Mover Cubo", "Crear Luz") para mostrar en la UI si fuera necesario.

#### 2.2 El Cerebro: `CommandHistory` (Singleton)
Gestor global que reside en la capa del Editor (no en el motor de renderizado).
* **Pilas de Tiempo:** Mantiene un `undoStack` y un `redoStack`.
* **Ruptura Temporal:** Si el usuario hace *Undo* 3 veces y luego realiza una *Nueva Acción*, el `redoStack` se vacía por completo y se destruye esa línea temporal alternativa.
* **Límite de Memoria (History Limit):** Limitado a un máximo de 50-100 pasos. Si se excede, el comando más antiguo en la base de la pila se destruye (Shift) para liberar RAM y evitar fugas de memoria (Memory Leaks).
* **El Candado de Mutación (`isMutatingHistory`):** Un flag crítico. Cuando el sistema está ejecutando un `undo()`, el motor emitirá eventos de cambio (ej. "Me moví"). El gestor debe bloquear la escucha de estos eventos para evitar registrar un Undo como si fuera una nueva acción del usuario (Bucle infinito).

### 3. Catálogo de Comandos Atómicos
Los comandos deben ser lo más pequeños y granulares posibles:
1. **`TransformCommand`:** Registra el ID de un actor y sus vectores de `[Posición, Rotación, Escala]` en el estado inicial y final.
2. **`SpawnActorCommand`:** Registra la clase y propiedades iniciales del actor. Su `undo` lo destruye, su `execute` lo instancia con el **mismo ID original**.
3. **`DestroyActorCommand`:** Registra un volcado (dump) del actor antes de morir. Su `undo` lo revive, su `execute` lo elimina.
4. **`PropertyCommand`:** Registra el cambio de una propiedad específica (ej. color de una luz, intensidad, nombre del actor).

### 4. Macro-Comandos (Transacciones / Batching)
Para acciones masivas (ej. mover 50 actores a la vez con el Gizmo), no se empujan 50 comandos al historial. Se utiliza un `MacroCommand`.
* **Definición:** Es un contenedor que agrupa múltiples `ICommand` atómicos.
* **Comportamiento:** Su método `execute()` itera y ejecuta todos sus sub-comandos. Su método `undo()` itera en **orden inverso** y revierte todos sus sub-comandos. Visualmente, el usuario percibe un solo salto en el tiempo.

### 5. Flujo de Comunicación (Decoupling)
El Editor y el Engine se comunican mediante Eventos:
1. **Engine -> Editor:** `serion:transform-ended`. El motor avisa que el usuario soltó el Gizmo y envía los deltas. El Editor crea el comando y lo guarda.
2. **Editor -> Engine:** `serion:force-transform`. Al presionar `Ctrl+Z`, el Editor saca el comando, extrae los vectores antiguos y le exige al motor (mediante un evento o API call) que posicione el Actor exactamente ahí.