// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export const getRootPath = async (): Promise<string> => {
    // If a workspace is opened
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
        if (activeFile) {
            const projectRoot = await getProjectRootDir(activeFile)
            if (projectRoot) {
                return projectRoot;
            }
        } else {
            return workspaceFolders[0].uri.fsPath;
        }
    } 
    // If a single file is opened
    else if (vscode.window.activeTextEditor) {
        return path.dirname(vscode.window.activeTextEditor.document.fileName);
    }

    return '';
}

const getProjectRootDir = async (file: string): Promise<string | null> => {
    let dir = path.dirname(file);
    while (dir !== '/') {
        const entries = await fs.promises.readdir(dir);
        if (entries.includes('.git') || entries.includes('package.json')) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return null;
}