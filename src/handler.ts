import { CancellationToken, EventEmitter, OutputChannel, TestController, TestItem, TestItemCollection, TestRun, TestRunRequest, Uri, window, workspace } from 'vscode';
import { Command, LocalCommand, RemoteCommand, TestRunner } from './phpunit';
import { TestFile } from './test-file';
import { Configuration } from './configuration';
import { OutputChannelObserver, TestResultObserver } from './observers';

export class Handler {
    private latestTestRunRequest: TestRunRequest | undefined;

    constructor(
        private testData: Map<string, TestFile>,
        private configuration: Configuration,
        private outputChannel: OutputChannel,
        private ctrl: TestController,
        private fileChangedEmitter: EventEmitter<Uri>,
        private getOrCreateFile: Function,
    ) {
    }

    getLatestTestRunRequest() {
        return this.latestTestRunRequest;
    }

    async run(shouldDebug: boolean, request: TestRunRequest, cancellation: CancellationToken) {
        if (!request.continuous) {
            return this.startTestRun(shouldDebug, request, cancellation);
        }

        const l = this.fileChangedEmitter.event(async (uri) => {
            await this.getOrCreateFile(this.ctrl, uri);

            await this.startTestRun(
                shouldDebug,
                new TestRunRequest(
                    request.include ?? [],
                    undefined,
                    request.profile,
                    true,
                ),
                cancellation,
            );
        });
        cancellation.onCancellationRequested(() => l.dispose());
    }

    private async startTestRun(shouldDebug: boolean, request: TestRunRequest, cancellation: CancellationToken) {
        const command = await this.createCommand(shouldDebug);

        if (!command) {
            return;
        }

        this.latestTestRunRequest = request;

        const run = this.ctrl.createTestRun(request);
        const queueHandler = new TestQueueHandler(request, run, this.testData);
        const runner = this.createTestRunner(queueHandler, run, request, cancellation);

        await queueHandler.discoverTests(request.include ?? gatherTestItems(this.ctrl.items));
        await queueHandler.runQueue(runner, command);
    }

    private async createCommand(shouldDebug: boolean) {
        const workspaceFolder = await getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return;
        }

        const options = { cwd: workspaceFolder!.uri.fsPath };

        return this.isRemote()
            ? new RemoteCommand(shouldDebug, this.configuration, options)
            : new LocalCommand(shouldDebug, this.configuration, options);
    }

    private isRemote() {
        const command = (this.configuration.get('command') as string) ?? '';

        return command.match(/docker|ssh|sail/) !== null;
    }

    private createTestRunner(
        queueHandler: TestQueueHandler,
        run: TestRun,
        request: TestRunRequest,
        cancellation: CancellationToken,
    ) {
        const runner = new TestRunner();
        runner.observe(new TestResultObserver(queueHandler.queue, run, cancellation));
        runner.observe(new OutputChannelObserver(this.outputChannel, this.configuration, request));

        return runner;
    }
}

class TestQueueHandler {
    public queue: { test: TestItem }[] = [];

    constructor(
        private request: TestRunRequest,
        private run: TestRun,
        private testData: Map<string, TestFile>,
    ) {
    }

    public async discoverTests(tests: Iterable<TestItem>) {
        for (const test of tests) {
            if (this.request.exclude?.includes(test)) {
                continue;
            }

            if (!test.canResolveChildren) {
                this.run.enqueued(test);
                this.queue.push({ test });
            } else {
                await this.discoverTests(gatherTestItems(test.children));
            }
        }
    }

    public async runQueue(runner: TestRunner, command: Command) {
        if (!this.request.include) {
            return runner.run(command);
        }

        return await Promise.all(
            this.request.include.map((test) =>
                runner.run(command.setArguments(this.getTestArguments(test), test.id)),
            ),
        );
    }

    private getTestArguments(test: TestItem) {
        return !test.parent
            ? test.uri!.fsPath
            : this.testData.get(test.parent.uri!.toString())!.getArguments(test.id);
    }
}

function gatherTestItems(collection: TestItemCollection) {
    const items: TestItem[] = [];
    collection.forEach((item) => items.push(item));
    return items;
}

async function getCurrentWorkspaceFolder() {
    if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
        return null;
    }

    if (workspace.workspaceFolders.length === 1) {
        return workspace.workspaceFolders[0];
    }

    if (window.activeTextEditor) {
        return workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);
    }

    return window.showWorkspaceFolderPick();
}
