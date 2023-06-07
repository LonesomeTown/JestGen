// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createTestFile } from './createTestFile';
import * as utils from './utils';

export interface JestGenConfig {
    useCustomizeTemplate: boolean;
    customizeTemplatePath: string;
    useSupertest: boolean;
    appPath: string | null;
}

const defaultJestConfig: JestGenConfig = {
    useCustomizeTemplate: false,
    customizeTemplatePath: __dirname + '/defaultTemplate.txt',
    useSupertest: false,
    appPath: null,
};

export const readConfig = async (): Promise<JestGenConfig> => {
    const rootPath = utils.getRootPath();

    if (!rootPath) {
        // If neither workspace nor single file is opened, return default config
        return defaultJestConfig;
    }

    const configFilePath = path.join(rootPath, '.jestgen.json');

    try {
        const configFileContent = await fs.promises.readFile(configFilePath, 'utf8');
        const config: JestGenConfig = JSON.parse(configFileContent);
        
        // Update `templatePath` to an absolute path
        if (config.useCustomizeTemplate) {
            config.customizeTemplatePath = path.resolve(path.dirname(configFilePath), config.customizeTemplatePath);
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
