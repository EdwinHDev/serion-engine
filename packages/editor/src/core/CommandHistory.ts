export interface ICommand {
    execute(): void;
    undo(): void;
    readonly name: string;
}

export class CommandHistory {
    private static undoStack: ICommand[] = [];
    private static redoStack: ICommand[] = [];
    private static readonly MAX_HISTORY = 100;
    public static isMutatingHistory = false;

    public static executeCommand(command: ICommand): void {
        this.isMutatingHistory = true;
        command.execute();
        this.isMutatingHistory = false;
        
        this.undoStack.push(command);
        this.redoStack = []; // Romper la línea temporal alternativa
        if (this.undoStack.length > this.MAX_HISTORY) this.undoStack.shift();
    }

    // Para comandos que ya se ejecutaron visualmente (ej. Gizmos) y solo necesitan registrarse
    public static registerCommand(command: ICommand): void {
        this.undoStack.push(command);
        this.redoStack = [];
        if (this.undoStack.length > this.MAX_HISTORY) this.undoStack.shift();
    }

    public static undo(): void {
        const command = this.undoStack.pop();
        if (command) {
            this.isMutatingHistory = true;
            command.undo();
            this.isMutatingHistory = false;
            this.redoStack.push(command);
        }
    }

    public static redo(): void {
        const command = this.redoStack.pop();
        if (command) {
            this.isMutatingHistory = true;
            command.execute();
            this.isMutatingHistory = false;
            this.undoStack.push(command);
        }
    }
}
