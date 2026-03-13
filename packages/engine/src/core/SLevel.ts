import { SActor } from './SActor';

export class SLevel {
    public name: string;
    public actors: Map<number, SActor>;

    constructor(name: string = "New Level") {
        this.name = name;
        this.actors = new Map<number, SActor>();
    }

    public addActor(actor: SActor): void {
        this.actors.set(actor.id, actor);
    }

    public removeActor(id: number): void {
        this.actors.delete(id);
    }

    public getActor(id: number): SActor | undefined {
        return this.actors.get(id);
    }

    public getActors(): SActor[] {
        return Array.from(this.actors.values());
    }


}
