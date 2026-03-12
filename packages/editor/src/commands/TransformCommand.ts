import { ICommand } from '../core/CommandHistory';

export interface TransformState {
    p: number[]; // Position [x,y,z]
    r: number[]; // Rotation [x,y,z,w]
    s: number[]; // Scale [x,y,z]
}

export class TransformCommand implements ICommand {
    public readonly name = 'Transform Actor';

    constructor(
        private actorId: number,
        private startState: TransformState,
        private endState: TransformState
    ) {}

    private applyState(state: TransformState) {
        const event = new CustomEvent('serion:force-transform', {
            detail: { id: this.actorId, state: state }
        });
        window.dispatchEvent(event);
    }

    public execute(): void {
        this.applyState(this.endState);
    }

    public undo(): void {
        this.applyState(this.startState);
    }
}
