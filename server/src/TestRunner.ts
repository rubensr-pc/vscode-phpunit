import { Command } from "vscode-languageserver-protocol";

export interface TestRunner {
    run(params: any, options: { cwd: string; }) : void;
    rerun(params: any, options: { cwd: string; }) : void;
	cancel() : boolean;
    setBinary(codecept: string | undefined) : TestRunner;
	setPhpBinary(php: string | undefined) : TestRunner;
	setArgs(args: string[] | undefined) : TestRunner;
    getOutput(): string;
    getCommand() : Command;
}
