/**
 * LogLevel - Niveles de severidad para el sistema de telemetría.
 */
export enum LogLevel {
  INFO,
  WARN,
  ERROR,
  FATAL
}

/**
 * Logger - Clase estática para estandarizar la telemetría del motor y el editor.
 * Implementa estilos CSS en consola para facilitar la depuración técnica.
 */
export class Logger {
  private static readonly STYLES: Record<string, string> = {
    // Niveles
    INFO: 'color: #3b82f6; font-weight: bold;',         // Azul Brillante
    WARN: 'color: #fbbf24; font-weight: bold;',         // Ámbar
    ERROR: 'color: #ef4444; font-weight: bold;',        // Rojo
    FATAL: 'background: #ef4444; color: white; font-weight: bold; padding: 2px 5px; border-radius: 2px;', // Rojo Fondo

    // Categorías
    RHI: 'color: #10b981; font-weight: bold;',          // Esmeralda (Hardware)
    ENGINE: 'color: #8b5cf6; font-weight: bold;',       // Violeta
    EDITOR: 'color: #ec4899; font-weight: bold;',       // Rosa
    VIEWPORT: 'color: #06b6d4; font-weight: bold;',     // Cian
  };

  /**
   * Registra un mensaje informativo.
   */
  public static info(category: string, message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, category, message, ...args);
  }

  /**
   * Registra una advertencia.
   */
  public static warn(category: string, message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, category, message, ...args);
  }

  /**
   * Registra un error recuperable.
   */
  public static error(category: string, message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, category, message, ...args);
  }

  /**
   * Registra un error crítico (Fallo de sistema).
   */
  public static fatal(category: string, message: string, ...args: any[]): void {
    this.log(LogLevel.FATAL, category, message, ...args);
  }

  /**
   * Método interno de formateo y salida.
   */
  private static log(level: LogLevel, category: string, message: string, ...args: any[]): void {
    const levelStr = LogLevel[level];
    const levelStyle = this.STYLES[levelStr] || '';
    const catStyle = this.STYLES[category.toUpperCase()] || 'color: #94a3b8; font-weight: bold;';

    const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });

    // Formato: [HH:MM:SS] [LEVEL] [CATEGORY] Message
    const prefix = `%c[${timestamp}] %c[${levelStr}] %c[${category.toUpperCase()}]`;
    const styles = [
      'color: #64748b;', // Timestamp: Slate
      levelStyle,
      catStyle
    ];

    switch (level) {
      case LogLevel.INFO:
        console.log(`${prefix} %c${message}`, ...styles, 'color: inherit;', ...args);
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} %c${message}`, ...styles, 'color: inherit;', ...args);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(`${prefix} %c${message}`, ...styles, 'color: inherit;', ...args);
        break;
    }
  }
}
