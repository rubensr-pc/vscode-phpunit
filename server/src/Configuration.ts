import {
    Connection,
    WorkspaceFolder as _WorkspaceFolder,
} from 'vscode-languageserver';

interface IConfiguration {
    maxNumberOfProblems: number;
    files: string;
    php?: string;
    phpArgs?: string[];
    codecept?: string;
    phpunit?: string;
    args?: string[];
    enableCoverage: boolean;
}

export class Configuration implements IConfiguration {
    defaults: IConfiguration = {
        maxNumberOfProblems: 10000,
        files: '**/*.php',
        enableCoverage: false
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

    get phpArgs(): string[] | undefined {
        return this.defaults.phpArgs;
    }

    get codecept(): string | undefined {
        return this.defaults.codecept;
    }

    get phpunit(): string | undefined {
        return this.defaults.phpunit;
    }

    get args(): string[] | undefined {
        return this.defaults.args;
    }

    get enableCoverage() : boolean {
        return this.defaults.enableCoverage;
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
