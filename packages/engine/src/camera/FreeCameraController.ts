import { SCamera } from './SCamera';
import { InputManager } from '../core/InputManager';

/**
 * FreeCameraController - Controlador de vuelo libre AAA.
 * Implementa rotación por ratón, movimiento 6-DOF (Vuelo) y Zero-Inertia.
 * Estilo Unreal Engine: Detención instantánea y navegación según la mirada.
 */
export class FreeCameraController {
  // Escala: 1 unidad = 1 centimetro
  public speed: number = 2000.0; // 20 m/s (Base)
  public mouseSensitivity: number = 0.15;

  constructor(private camera: SCamera) { }

  public update(deltaTime: number): void {
    // Consumir el delta de ratón al inicio del frame
    const mouseDelta = InputManager.consumeMouseDelta();

    // Navegar solo con Click Derecho presionado (UX Estándar)
    if (!InputManager.isRightMouseDown) {
      return;
    }

    const actor = this.camera.actor;

    // --- 1. ROTACIÓN (Mouse Look) ---
    this.camera.yaw -= mouseDelta.x * this.mouseSensitivity;
    this.camera.pitch -= mouseDelta.y * this.mouseSensitivity;

    // Clamp Pitch para evitar rotaciones invertidas (-90 a 90 grados)
    if (this.camera.pitch > 89.0) this.camera.pitch = 89.0;
    if (this.camera.pitch < -89.0) this.camera.pitch = -89.0;

    // --- 2. MODIFICADORES DE VELOCIDAD (Sprint / Precision) ---
    let currentSpeed = this.speed;

    if (InputManager.isKeyDown('ShiftLeft') || InputManager.isKeyDown('ShiftRight')) {
      currentSpeed *= 4.0; // Sprint AAA
    } else if (InputManager.isKeyDown('AltLeft') || InputManager.isKeyDown('AltRight')) {
      currentSpeed *= 0.25; // Precisión milimétrica
    }

    // --- 3. CÁLCULO DE VECTORES (Zero-GC / 6-DOF) ---
    const radYaw = this.camera.yaw * (Math.PI / 180);
    const radPitch = this.camera.pitch * (Math.PI / 180);

    // Forward Vector (Orientado hacia donde mira la cámara - Vuelo Libre)
    // forwardX = cos(pitch) * cos(yaw)
    // forwardY = cos(pitch) * sin(yaw)
    // forwardZ = sin(pitch)
    const forwardX = Math.cos(radPitch) * Math.cos(radYaw);
    const forwardY = Math.cos(radPitch) * Math.sin(radYaw);
    const forwardZ = Math.sin(radPitch);

    // Right Vector (Perpendicular al Forward en el plano XY)
    // El Right Vector no depende del Pitch para mantener la cámara nivelada horizontalmente
    const rightX = Math.sin(radYaw);
    const rightY = -Math.cos(radYaw);
    // rightZ = 0 (Estricto Z-Up horizontal)

    // --- 4. DETECCIÓN DE INPUT Y MOVIMIENTO (Zero-Inertia) ---
    let moveX = 0;
    let moveY = 0;
    let moveZ = 0;

    // Movimiento Horizontal/Vuelo (W/S/D/A)
    if (InputManager.isKeyDown('KeyW')) { moveX += forwardX; moveY += forwardY; moveZ += forwardZ; }
    if (InputManager.isKeyDown('KeyS')) { moveX -= forwardX; moveY -= forwardY; moveZ -= forwardZ; }
    if (InputManager.isKeyDown('KeyD')) { moveX += rightX; moveY += rightY; }
    if (InputManager.isKeyDown('KeyA')) { moveX -= rightX; moveY -= rightY; }

    // Elevación Absoluta (E/Q) - Sigue el eje Z del mundo
    if (InputManager.isKeyDown('KeyE')) moveZ += 1;
    if (InputManager.isKeyDown('KeyQ')) moveZ -= 1;

    // Normalización de Dirección para evitar velocidad diagonal extra
    const lenSq = moveX * moveX + moveY * moveY + moveZ * moveZ;
    if (lenSq > 0) {
      const invLen = 1.0 / Math.sqrt(lenSq);
      moveX *= invLen;
      moveY *= invLen;
      moveZ *= invLen;
    }

    // APLICACIÓN DIRECTA: Zero-Inertia (Sin lerp, sin acumuladores)
    actor.x += moveX * currentSpeed * deltaTime;
    actor.y += moveY * currentSpeed * deltaTime;
    actor.z += moveZ * currentSpeed * deltaTime;
  }
}
