# Documentación Maestra: Serion Engine
## ID: SER-00-MASTER | Estado: Activo

### 1. Visión General
Serion Engine es un motor de videojuegos profesional basado en la web, inspirado en la arquitectura de Unreal Engine 5. Utiliza **WebGPU** para renderizado de alto rendimiento, **TypeScript** para seguridad de tipos y **Vite** como orquestador de desarrollo.

### 2. Pilares de Desarrollo (Mandamientos)
1. **SOLID sobre Conveniencia:** No se sacrificará la arquitectura por rapidez. Cada clase tiene una única responsabilidad.
2. **Clean Code:** Nombramiento semántico, funciones pequeñas y código auto-documentado.
3. **Decoupling (Desacoplamiento):** El `Engine` no conoce al `Editor`. La comunicación es mediante interfaces y eventos.
4. **Performance First:** Uso de `TypedArrays`, `Web Workers` y gestión manual de buffers en WebGPU para evitar el Garbage Collector.

### 3. Estructura de Monorepo (Workspaces)
El proyecto se organiza en paquetes independientes bajo la raíz:
- `/packages/engine`: El corazón del motor (Math, RHI, ECS, Scene Graph).
- `/packages/editor`: La herramienta de autoría (Web Components, UI, Gizmos).
- `/packages/templates`: Lógica de juego predefinida (FPS, TPS, Empty).

### 4. Flujo de Trabajo con Antigravity (Gemini 3)
- Cada incremento de código será precedido por un **Prompt Maestro** generado por el Arquitecto.
- Cada prompt debe incluir: Contexto, Requisitos Técnicos, Código Completo y Pruebas Unitarias/Integración.
- **Auditoría Obligatoria:** Cada 10 versiones (o hitos importantes), se realizará un análisis de deuda técnica y refactorización.

### 5. Scripts Globales de Ejecución
Ubicados en el `package.json` raíz para control centralizado:
- `npm run dev:editor`: Inicia el entorno de desarrollo del editor.
- `npm run build:all`: Compila todos los paquetes para producción.
- `npm run test`: Ejecuta la suite de pruebas en todo el monorepo.