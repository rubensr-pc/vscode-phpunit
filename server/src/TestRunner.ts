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

export class TestRunner {
    private phpBinary = '';
    private phpUnitBinary = '';
    private args: string[] = [];
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

    setCodeceptBinary(phpUnitBinary: PathLike | URI | undefined) {
        this.phpUnitBinary = phpUnitBinary
            ? this._files.asUri(phpUnitBinary).fsPath
            : '';

        return this;
    }

    setArgs(args: string[] | undefined) {
        this.args = args || [];

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
        let params = [];

        const [phpBinary, phpUnitBinary, phpUnitXml] = await Promise.all([
            this.getPhpBinary(),
            this.getPhpUnitBinary(spawnOptions),
            this.getPhpUnitXml(spawnOptions),
        ]);

        if (phpBinary) {
            // params.push('phpBinary');
            params.push('php');
        }

        if (phpUnitBinary) {
            // params.push(phpUnitBinary);
        }

        const hasConfiguration = this.args.some((arg: string) =>
            ['-c', '--configuration'].some(key => arg.indexOf(key) !== -1)
        );

        if (!hasConfiguration && phpUnitXml) {
            // params.push('-c');
            // params.push(phpUnitXml);
        }

        params = [
            '-dxdebug.remote_port=8000',
            //'-dauto_prepend_file=xdebug_filter.php',
            './vendor/bin/codecept',
            'run',
            'unit',
            //'--coverage-xml',
            '--ansi',
            '--no-colors',
            '--config=./tests/unit/codeception.yml',
            '--ext=DotReporter'
        ];

        params = params.concat(this.args, args).filter(arg => !!arg);

        return {
            title: 'PHPUnit LSP',
            command: 'php', //params.shift() as string,
            arguments: params,
        };
    }

    private getPhpBinary(): Promise<string> {
        return Promise.resolve(this.phpBinary);
    }

    private async getPhpUnitBinary(
        spawnOptions?: SpawnOptions
    ): Promise<string | void> {
        if (this.phpUnitBinary) {
            return this.phpUnitBinary;
        }

        return await this._files.findup(
            ['vendor/bin/phpunit', 'phpunit'],
            spawnOptions
        );
    }

    private async getPhpUnitXml(spawnOptions?: SpawnOptions) {
        return await this._files.findup(
            ['phpunit.xml', 'phpunit.xml.dist'],
            spawnOptions
        );
    }
}
