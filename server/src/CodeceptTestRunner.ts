import files from './Filesystem';
import URI from 'vscode-uri';
import { Command } from 'vscode-languageserver-protocol';
import { PathLike } from 'fs';
import { Process } from './Process';
import { SpawnOptions } from 'child_process';

export interface Params {
    file?: PathLike | URI;
    method?: string;
    depends?: string[];
}

export class CodeceptTestRunner {
    private phpBinary = '';
    private codeceptBinary = '';
    private enableCoverage = false;
    private args: string[] = [];
    private phpArgs: string[] = [];
    private lastArgs: string[] = [];
    private lastOutput: string = '';
    private lastCommand: Command = {
        title: '',
        command: '',
        arguments: [],
    };

    constructor(private process = new Process(), private _files = files) {}

    setPhpBinary(phpBinary: PathLike | URI | undefined) {
        this.phpBinary = phpBinary ? this._files.asUri(phpBinary).fsPath : '';

        return this;
    }

    setBinary(codeceptBinary: PathLike | URI | undefined) {
        this.codeceptBinary = codeceptBinary
            ? this._files.asUri(codeceptBinary).fsPath
            : '';

        return this;
    }

    setArgs(args: string[] | undefined) {
        this.args = args || [];

        return this;
    }

    setPhpArgs(args: string[] | undefined) {
        this.phpArgs = args || [];

        return this;
    }

    setEnableCoverage(enable: boolean | undefined) {
        this.enableCoverage = enable || false;

        return this;
    }

    async rerun(p?: Params, options?: SpawnOptions) {
        if (p && this.lastArgs.length === 0) {
            return await this.run(p, options);
        }

        return await this.doRun(this.lastArgs, options);
    }

    async run(p?: Params, options?: SpawnOptions) {
        if (!p) {
            return await this.doRun([], options);
        }

        const params : string[] = [];

        if (p.file) {
            let fname = this._files.asUri(p.file).fsPath;
            const cwd = options && options.cwd ? options.cwd : process.cwd();
            fname = '.' + fname.replace(cwd, '');
            if (p.method) {
                fname = fname.concat(':', p.method);
            }
            params.push(fname);
        }

        return await this.doRun(params, options);
    }

    async doRun(args: string[] = [], options?: SpawnOptions) {
        try {
            this.lastArgs = args;
            this.lastCommand = await this.toCommand(args, options);
            this.lastOutput = await this.process.run(this.lastCommand, options);

            return 0;
        } catch (e) {
            return 1;
        }
    }

    getOutput() {
        return this.lastOutput;
    }

    getCommand() {
        return this.lastCommand;
    }

    cancel(): boolean {
        const killed = this.process.kill();
        this.lastOutput = '';
        this.lastCommand = {
            title: '',
            command: '',
            arguments: [],
        };

        return killed;
    }

    private async toCommand(
        args: string[],
        spawnOptions?: SpawnOptions
    ): Promise<Command> {
        let params : string[] = [];

        const [phpBinary, codeceptBinary,
            codeceptionConfig] = await Promise.all([
            this.getPhpBinary(),
            this.getCodeceptBinary(spawnOptions),
            this.getCodeceptionConfig(args, spawnOptions)
        ]);

        if (phpBinary) {
            params.push(phpBinary);
            params = params.concat(this.phpArgs);
        }

        if (codeceptBinary) {
            params.push(codeceptBinary);
        }

        // const hasConfiguration = this.args.some((arg: string) =>
        //     ['-c', '--configuration'].some(key => arg.indexOf(key) !== -1)
        // );

        params = params.concat([
            'run',
            'unit',
            '--ansi',
            '--no-colors',
            '--config=' + codeceptionConfig,
            '--ext=DotReporter'
        ]);

        if (this.enableCoverage) {
            params = params.concat(["--coverage-xml"]);
        }

        params = params.concat(this.args, args).filter(arg => !!arg);

        return {
            title: 'Codecept LSP',
            command: params.shift() as string,
            arguments: params,
        };
    }

    private getPhpBinary(): Promise<string> {
        return Promise.resolve(this.phpBinary);
    }

    private async getCodeceptBinary(
        spawnOptions?: SpawnOptions
    ): Promise<string | void> {
        if (this.codeceptBinary) {
            return this.codeceptBinary;
        }

        return await this._files.findup(
            ['vendor/bin/codecept', 'codecept'],
            spawnOptions
        );
    }

    private async getCodeceptionConfig(args: string[], spawnOptions?: SpawnOptions) {
        // this is probably wrong
        if (args.length === 0) return '';

        return await this._files.finduptocwd('codeception.yml',
            args[0], spawnOptions);
    }
}
