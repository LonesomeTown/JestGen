// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as path from 'path';

export const getRootPath = (): string => {
    let rootPath = '';
    // If a workspace is opened
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        rootPath = workspaceFolders[0].uri.fsPath;
    } 
    // If a single file is opened
    else if (vscode.window.activeTextEditor) {
        rootPath = path.dirname(vscode.window.activeTextEditor.document.fileName);
    }
    return rootPath;
}