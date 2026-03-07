/**
 * Serion Engine Core
 * Principios: SOLID, Clean Code.
 */

export class SerionEngine {
  constructor() {
    console.log("Serion Engine Core Initialized");
  }

  public static start(): void {
    new SerionEngine();
  }
}
