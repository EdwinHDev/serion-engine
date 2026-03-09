import { SStaticMesh } from '../geometry/SStaticMesh';

/**
 * SStaticMeshComponent.ts - Componente para asignación de geometría.
 * Define qué malla del GeometryRegistry debe renderizar un actor.
 */
export class SStaticMeshComponent {
  public mesh: SStaticMesh | null = null;
  constructor(public meshId: string) { }
}
