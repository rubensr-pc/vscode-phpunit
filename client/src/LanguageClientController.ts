import { commands, Disposable, OutputChannel, TextEditor, window, StatusBarAlignment } from 'vscode';
import { Configuration } from './Configuration';
import { ExecuteCommandRequest } from 'vscode-languageserver-protocol';
import { LanguageClient } from 'vscode-languageclient';
import { TestEvent } from 'vscode-test-adapter-api';
import { Notify } from './Notify';

export class LanguageClientController implements Disposable {
    private disposables: Disposable[] = [];

    constructor(
        private client: LanguageClient,
        private config: Configuration,
        private outputChannel: OutputChannel,
        private notify: Notify,
        private _commands = commands
    ) {}

    init() {
        this.runAll();
        this.rerun();
        this.runFile();
        this.runTestAtCursor();
        this.cancel();
        this.onTestRunStartedEvent();
        this.onTestRunFinishedEvent();
        this.toggleCoverage();

        return this;
    }

    dispose() {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }

    private async onTestRunStartedEvent() {
        await this.client.onReady();

        this.client.onNotification('TestRunStartedEvent', () => {
            this.notify.show('Codecept Running');

            if (this.config.clearOutputOnRun === true) {
                this.outputChannel.clear();
            }
        });
    }

    private async onTestRunFinishedEvent() {
        await this.client.onReady();

        this.client.onNotification('TestRunFinishedEvent', ({ events }) => {
            this.notify.hide();

            const showAfterExecution = this.config.showAfterExecution;

            const hasFailure = (events: TestEvent[]) => {
                return events.some(event =>
                    ['failed', 'errored'].includes(event.state)
                );
            };

            if (showAfterExecution === 'never') {
                return;
            }

            if (showAfterExecution === 'always' || hasFailure(events)) {
                this.outputChannel.show(true);
            }
        });
    }

    private runAll() {
        this.registerCommand('codecept.run-all');
    }

    private rerun() {
        this.registerCommand('codecept.rerun');
    }

    private runFile() {
        this.registerCommand('codecept.run-file');
    }

    private runTestAtCursor() {
        this.registerCommand('codecept.run-test-at-cursor');
    }

    private cancel() {
        this.registerCommand('codecept.cancel');
    }

    private toggleCoverage() {
        const cmdId = 'codecept.toggleCoverage';

        let coverageToggle = window.createStatusBarItem(StatusBarAlignment.Left, 100);
        coverageToggle.command = cmdId;
        coverageToggle.text = this.config.enableCoverage
            ? '$(thumbsup) Coverage'
            : '$(thumbsdown) Coverage';
        coverageToggle.show();

        this.disposables.push(
            this._commands.registerCommand(cmdId, () => {
                this.config.enableCoverage = !this.config.enableCoverage;
                coverageToggle.text = this.config.enableCoverage
                    ? '$(thumbsup) Coverage'
                    : '$(thumbsdown) Coverage'

                window.showInformationMessage(this.config.enableCoverage
                    ? 'Coverage enabled'
                    : 'Coverage disabled');
            })
        );

    }

    private registerCommand(command: string) {
        this.disposables.push(
            this._commands.registerTextEditorCommand(
                command,
                async textEditor => {
                    await this.client.onReady();

                    if (this.isValidTextEditor(textEditor) === false) {
                        return;
                    }

                    const document = textEditor.document;

                    this.client.sendRequest(ExecuteCommandRequest.type, {
                        command: command.replace(/^codecept/, 'codecept.lsp'),
                        arguments: [
                            document.uri.toString(),
                            document.uri.toString(),
                            textEditor.selection.active.line,
                        ],
                    });
                }
            )
        );
    }

    private isValidTextEditor(editor: TextEditor): boolean {
        if (!editor || !editor.document) {
            return false;
        }

        return editor.document.languageId === 'php';
    }
}
