import { SCamera } from './SCamera';
import { InputManager } from '../core/InputManager';

/**
 * FreeCameraController - Controlador de vuelo libre AAA.
 * Implementa rotación por ratón, movimiento local e inercia matemática.
 * Estilo Unreal: Solo activo mientras se mantiene el Click Derecho.
 */
export class FreeCameraController {
  // Respetar la escala de 1 unidad = 1 centimetro
  public speed: number = 2000.0; // 20 m/s
  public mouseSensitivity: number = 0.15;
  public lerpFactor: number = 8.0;

  private currentVelocity = [0, 0, 0];
  private targetVelocity = [0, 0, 0];

  constructor(private camera: SCamera) { }

  public update(deltaTime: number): void {
    // CORRECCIÓN AAA: Consumir el delta SIEMPRE al inicio del frame.
    // Esto drena el acumulador de InputManager. Si no estamos navegando, este valor simplemente se descarta.
    const mouseDelta = InputManager.consumeMouseDelta();

    // Standard UX: Solo navegamos si se mantiene el click derecho presionado
    if (!InputManager.isRightMouseDown) {
      // Resetear velocidades para evitar deslizamientos infinitos si se suelta el botón
      this.targetVelocity = [0, 0, 0];
      this.applyInertia(deltaTime);
      return;
    }

    const actor = this.camera.actor;

    // --- 1. ROTACIÓN (Mouse Look) ---
    // Usamos el delta fresco y recién drenado
    // Corregimos inversión: Mouse a la derecha -> Yaw disminuye (gira a la derecha en LookAt Z-Up)
    this.camera.yaw -= mouseDelta.x * this.mouseSensitivity;
    this.camera.pitch -= mouseDelta.y * this.mouseSensitivity;

    // Clamp Pitch para evitar "gimbal lock"
    if (this.camera.pitch > 89.0) this.camera.pitch = 89.0;
    if (this.camera.pitch < -89.0) this.camera.pitch = -89.0;

    // --- 2. MOVIMIENTO LOCAL (Inercia) ---
    const radYaw = this.camera.yaw * (Math.PI / 180);

    // Vectores unitarios en el plano XY (Z-Up)
    const forwardX = Math.cos(radYaw);
    const forwardY = Math.sin(radYaw);
    const rightX = Math.sin(radYaw);
    const rightY = -Math.cos(radYaw);

    let moveX = 0;
    let moveY = 0;
    let moveZ = 0;

    if (InputManager.isKeyDown('KeyW')) { moveX += forwardX; moveY += forwardY; }
    if (InputManager.isKeyDown('KeyS')) { moveX -= forwardX; moveY -= forwardY; }
    if (InputManager.isKeyDown('KeyD')) { moveX += rightX; moveY += rightY; }
    if (InputManager.isKeyDown('KeyA')) { moveX -= rightX; moveY -= rightY; }

    // Elevación absoluta (Q/E)
    if (InputManager.isKeyDown('KeyE')) moveZ += 1;
    if (InputManager.isKeyDown('KeyQ')) moveZ -= 1;

    // Normalizar dirección de movimiento
    const len = Math.sqrt(moveX * moveX + moveY * moveY + moveZ * moveZ);
    if (len > 0) {
      moveX /= len;
      moveY /= len;
      moveZ /= len;
    }

    // Calcular Velocidad Objetivo
    this.targetVelocity[0] = moveX * this.speed;
    this.targetVelocity[1] = moveY * this.speed;
    this.targetVelocity[2] = moveZ * this.speed;

    this.applyInertia(deltaTime);

    // Aplicar posición al actor
    actor.x += this.currentVelocity[0] * deltaTime;
    actor.y += this.currentVelocity[1] * deltaTime;
    actor.z += this.currentVelocity[2] * deltaTime;
  }

  private applyInertia(deltaTime: number): void {
    // ESTÁNDAR AAA: Frame-Independent Exponential Decay.
    // Esto garantiza que "t" nunca exceda 1.0, sin importar lo grande que sea el deltaTime,
    // eliminando las vibraciones o "congelamientos" violentos de velocidad.
    const t = 1.0 - Math.exp(-this.lerpFactor * deltaTime);

    this.currentVelocity[0] += (this.targetVelocity[0] - this.currentVelocity[0]) * t;
    this.currentVelocity[1] += (this.targetVelocity[1] - this.currentVelocity[1]) * t;
    this.currentVelocity[2] += (this.targetVelocity[2] - this.currentVelocity[2]) * t;
  }
}
