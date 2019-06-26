import {
    Connection,
    WorkspaceFolder as _WorkspaceFolder,
} from 'vscode-languageserver';

interface IConfiguration {
    maxNumberOfProblems: number;
    files: string;
    php?: string;
    codecept?: string;
    args?: string[];
}

export class Configuration implements IConfiguration {
    defaults: IConfiguration = {
        maxNumberOfProblems: 10000,
        files: '**/*.php',
    };

    constructor(
        private connection: Connection,
        private workspaceFolder: _WorkspaceFolder
    ) {}

    get maxNumberOfProblems(): number {
        return this.defaults.maxNumberOfProblems;
    }

    get files(): string {
        return this.defaults.files;
    }

    get php(): string | undefined {
        return this.defaults.php;
    }

    get codecept(): string | undefined {
        return this.defaults.codecept;
    }

    get args(): string[] | undefined {
        return this.defaults.args;
    }

    async update(configurationCapability = true) {
        if (configurationCapability) {
            this.defaults = await this.connection.workspace.getConfiguration({
                scopeUri: this.workspaceFolder.uri,
                section: 'codecept',
            });
        }

        return this;
    }
}
