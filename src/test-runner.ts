import { Disposable, TextDocument, TextDocumentWillSaveEvent, TextEditor } from 'vscode';
import { PHPUnit, State } from './command/phpunit';
import { TestCase, Type } from './parsers/parser';

import { ConfigRepository } from './config';
import { Container } from './container';
import { DecorateManager } from './decorate-manager';
import { DelayHandler } from './delay-handler';
import { DiagnosticManager } from './diagnostic-manager';
import { StatusBar } from './status-bar';
import { Store } from './store';
import { Validator } from './validator';
import { tap } from './helpers';

export interface TestRunnerOptions {
    container: Container;
    command: PHPUnit;
    statusBar: StatusBar;
    decorateManager: DecorateManager;
    diagnosticManager: DiagnosticManager;
}

export class TestRunner {
    private disposable: Disposable;
    private window: any;
    private workspace: any;
    private store: Store;
    private validator: Validator;
    private config: ConfigRepository;

    private container: Container;
    private command: PHPUnit;
    private statusBar: StatusBar;
    private decorateManager: DecorateManager;
    private diagnosticManager: DiagnosticManager;

    private delayHandler = new DelayHandler();

    constructor(options: TestRunnerOptions) {
        this.container = options.container;
        this.command = options.command;
        this.statusBar = options.statusBar;
        this.decorateManager = options.decorateManager;
        this.diagnosticManager = options.diagnosticManager;

        this.window = this.container.window;
        this.workspace = this.container.workspace;
        this.store = this.container.store;
        this.validator = this.container.validator;
        this.config = this.container.config;
    }

    subscribe(commands: any): this {
        const subscriptions: Disposable[] = [];

        this.window.onDidChangeActiveTextEditor(
            (editor: TextEditor) => {
                if (!editor) {
                    return;
                }

                this.delayHandler.delay(1000).then(cancelled => {
                    if (cancelled === true) {
                        return;
                    }

                    const document: TextDocument = editor.document;

                    if (this.validator.isGitFile(document.uri.fsPath)) {
                        return;
                    }

                    this.decoratedGutter();

                    if (<boolean>this.config.get('testOnOpen') === false || this.store.has(document.uri.fsPath)) {
                        return;
                    }

                    const path = document.uri.fsPath;
                    const content = document.getText();
                    this.handle(path, [], {
                        content,
                    });
                });
            },
            null,
            subscriptions
        );

        this.workspace.onWillSaveTextDocument(
            (event: TextDocumentWillSaveEvent) => {
                const document: TextDocument = event.document;
                if (<boolean>this.config.get('testOnSave') === false) {
                    return;
                }
                const path = document.uri.fsPath;
                const content = document.getText();
                this.handle(path, [], {
                    content,
                });
            },
            null,
            subscriptions
        );

        subscriptions.push(
            commands.registerCommand('phpunit.TestFile', () => {
                const document = this.document;
                const path = document.uri.fsPath;
                const content = document.getText();
                this.handle(path, [], {
                    content,
                });
            })
        );

        subscriptions.push(
            commands.registerCommand('phpunit.TestSuite', () => {
                this.handle('');
            })
        );

        this.disposable = Disposable.from(...subscriptions);

        return this;
    }

    handle(path: string, args: string[] = [], options?: any) {
        const content: string = options.content || '';

        if (this.validate(path, content) === false) {
            return;
        }

        this.statusBar.show();
        this.statusBar.running('testing changes');

        this.clearDecoratedGutter();

        return tap(
            this.command.handle(path, this.config.get('args', []).concat(args), {
                execPath: this.config.get('execPath', ''),
                basePath: this.container.basePath(this.editor, this.workspace),
            }),
            promise => {
                promise.then(this.onFinish.bind(this));
                promise.catch(this.onError.bind(this));
            }
        );
    }

    private onFinish(items: TestCase[]): Promise<TestCase[]> {
        this.store.put(items);

        this.decoratedGutter();
        this.handleDiagnostic();

        items.some(item => item.type !== Type.PASSED) ? this.statusBar.failed() : this.statusBar.success();

        return Promise.resolve(items);
    }

    private onError(error): Promise<any> {
        this.decoratedGutter();
        this.handleDiagnostic();

        this.statusBar.failed(error);

        if (error === State.PHPUNIT_NOT_FOUND) {
            this.window.showErrorMessage("'Couldn't find a vendor/bin/phpunit file'");
        }

        console.error(error);

        return Promise.reject(error);
    }

    private validate(path, content) {
        try {
            this.validator.validate(path, content);

            return true;
        } catch (error) {
            console.warn(error);

            return false;
        }
    }

    dispose() {
        this.store.dispose();
        this.diagnosticManager.dispose();
        this.disposable.dispose();
    }

    private decoratedGutter() {
        this.decorateManager.decoratedGutter(this.store, [this.window.activeTextEditor]);
    }

    private clearDecoratedGutter() {
        this.decorateManager.clearDecoratedGutter([this.window.activeTextEditor]);
    }

    private handleDiagnostic() {
        this.diagnosticManager.handle(this.store, this.window.visibleTextEditors);
    }

    get editor(): TextEditor {
        return this.window.activeTextEditor;
    }

    get document(): TextDocument {
        return this.window.activeTextEditor.document;
    }

    get hasEditor(): boolean {
        return !!this.editor && !!this.document;
    }
}
