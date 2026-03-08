import { SCamera } from './SCamera';

/**
 * CameraManager - Gestor de cámaras activas del motor.
 */
export class CameraManager {
  private activeCamera: SCamera | null = null;

  public setActiveCamera(camera: SCamera): void {
    this.activeCamera = camera;
  }

  public getActiveCamera(): SCamera | null {
    return this.activeCamera;
  }
}
