import {
    window,
    DecorationRenderOptions,
    TextEditorDecorationType,
    TextEditor,
    StatusBarAlignment,
    StatusBarItem,
    Disposable,
} from 'vscode';

export class Window {
    get activeTextEditor(): TextEditor | undefined {
        return window.activeTextEditor;
    }

    createTextEditorDecorationType(options: DecorationRenderOptions): TextEditorDecorationType {
        return window.createTextEditorDecorationType(options);
    }

    createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem {
        return window.createStatusBarItem(alignment, priority);
    }

    onDidChangeActiveTextEditor(params: any): Disposable {
        return window.onDidChangeActiveTextEditor(params);
    }
}