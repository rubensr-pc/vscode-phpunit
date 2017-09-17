import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range, TextEditor, TextLine, Uri } from 'vscode'
import { Message, State } from './parser'

import { MessageCollection } from './message-collection'
import { Project } from './project'

export class DiagnosticManager {
    private collection: DiagnosticCollection

    public constructor(private project: Project) {
        this.collection = this.project.diagnosticCollection
    }

    public handle(messageCollection: MessageCollection, editor: TextEditor) {
        this.collection.clear()

        messageCollection.forEach((messages: Message[], file: string) => {
            this.collection.set(Uri.file(file), this.covertToDiagnostic(messages, editor))
        })
    }

    public dispose() {
        this.collection.clear()
        this.collection.dispose()
    }

    protected covertToDiagnostic(messages: Message[], editor: TextEditor): Diagnostic[] {
        return messages.map((message: Message) => {
            return new Diagnostic(
                this.messageToRange(message, editor),
                message.error.fullMessage,
                message.state === State.FAILED ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning
            )
        })
    }

    protected messageToRange(message: Message, editor: TextEditor) {
        const textLine: TextLine = editor.document.lineAt(message.lineNumber)

        return new Range(
            textLine.lineNumber,
            textLine.firstNonWhitespaceCharacterIndex,
            textLine.lineNumber,
            textLine.range.end.character + 1
        )
    }
}
