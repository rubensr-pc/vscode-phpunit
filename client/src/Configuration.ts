import { workspace } from 'vscode';

export class Configuration {
    constructor(private _workspace = workspace) {}

    get clearOutputOnRun() {
        return this.get('clearOutputOnRun', true);
    }

    get showAfterExecution() {
        return this.get('showAfterExecution', 'onFailure');
    }

    get enableCoverage() {
        return this.get('enableCoverage', true);
    }

    set enableCoverage(v : boolean) {
        this.set('enableCoverage', v);
    }

    set(property: string, defaultvalue?: any) {
        return this._workspace
            .getConfiguration('codecept')
            .update(property, defaultvalue);
    }

    get(property: string, defaultValue?: any) {
        return this._workspace
            .getConfiguration('codecept')
            .get(property, defaultValue);
    }
}
