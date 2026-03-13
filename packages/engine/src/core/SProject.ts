export class SProject {
    public name: string;
    public levelManifest: string[]; // Rutas o IDs de los niveles guardados
    public defaultLevel: string;

    constructor(name: string = "Untitled Project") {
        this.name = name;
        this.levelManifest = [];
        this.defaultLevel = "";
    }

    public addLevelToManifest(levelId: string): void {
        if (!this.levelManifest.includes(levelId)) {
            this.levelManifest.push(levelId);
        }
    }
}
