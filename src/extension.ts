// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { createTestFile } from './createTestFile';
import * as fs from 'fs';
import * as path from 'path';

interface JestGenConfig {
    useTemplate: boolean;
    templatePath: string;
    useSupertest: boolean;
    appPath: string | null;
}

const defaultJestConfig: JestGenConfig = {
    useTemplate: false,
    templatePath: __dirname + '/defaultTemplate.txt',
    useSupertest: false,
    appPath: null,
};

export const readConfig = async (): Promise<JestGenConfig> => {
    let rootPath: string;

    // If a workspace is opened
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        rootPath = workspaceFolders[0].uri.fsPath;
    } 
    // If a single file is opened
    else if (vscode.window.activeTextEditor) {
        rootPath = path.dirname(vscode.window.activeTextEditor.document.fileName);
    } 
    else {
        // If neither workspace nor single file is opened, return default config
        return defaultJestConfig;
    }

    const configFilePath = path.join(rootPath, '.jestgen.json');

    try {
        const configFileContent = await fs.promises.readFile(configFilePath, 'utf8');
        const config: JestGenConfig = JSON.parse(configFileContent);
        
        // Update `templatePath` to an absolute path
        if (config.useTemplate) {
            config.templatePath = path.resolve(path.dirname(configFilePath), config.templatePath);
        }
        
        return config;
    } catch {
        // If the config file can't be read, use the default config
        return defaultJestConfig;
    }
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate (context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "JestGen" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.createTestFile', () => {
        console.log('Command triggered...');
        createTestFile();
        vscode.window.showInformationMessage('Jest File Created!');
    });

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
