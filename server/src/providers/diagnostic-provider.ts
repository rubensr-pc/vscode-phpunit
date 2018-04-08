import { Diagnostic, DiagnosticSeverity, PublishDiagnosticsParams, IConnection } from 'vscode-languageserver';
import { Test, Type } from '../phpunit';
import { Collection } from '../collection';

export class DiagnosticProvider {
    constructor(private collect: Collection) {}

    sendDiagnostics(connection: IConnection): void {
        this.collect.forEach((tests: Test[], uri: string) => {
            connection.sendDiagnostics({
                uri,
                diagnostics: this.provideDiagnostics(tests),
            } as PublishDiagnosticsParams);
        });
    }

    provideDiagnostics(tests: Test[]): Diagnostic[] {
        return tests.filter(this.filterByType.bind(this)).map((test: Test) => this.convertToDiagonstic(test));
    }

    private convertToDiagonstic(test: Test): Diagnostic {
        return {
            severity: DiagnosticSeverity.Error,
            range: test.range,
            message: test.fault.message,
            source: 'phpunit',
        };
    }

    private filterByType(test: Test): boolean {
        return [Type.ERROR, Type.FAILED, Type.FAILURE].indexOf(test.type) !== -1;
    }
}