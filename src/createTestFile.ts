import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { readConfig } from './extension';

/**
 * Command function to create a Jest test file for a selected method in a .ts file.
 */
export const createTestFile = async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('Please open a .ts file to create a Jest test file.');
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'typescript') {
        vscode.window.showInformationMessage('Please select a method in a .ts file to create a Jest test file.');
        return;
    }

    const selection = editor.selection;
    const range = document.getWordRangeAtPosition(selection.start);
    if (!range) {
        vscode.window.showInformationMessage('Please place the cursor on a method name to create a Jest test file.');
        return;
    }

    const methodName = document.getText(range);
  
    // Get source file path
    const sourceFilePath = document.fileName;

    // Transform source file path to test file path
    const parsedSourceFilePath = path.parse(sourceFilePath);
    const pathSegments = parsedSourceFilePath.dir.split(path.sep);
    const srcIndex = pathSegments.findIndex(segment => segment === 'src');
    if (srcIndex >= 0 && srcIndex < pathSegments.length - 1) {
        pathSegments.splice(srcIndex + 1, 0, 'test');
    }
    const testDirectoryPath = pathSegments.join(path.sep);
    const testFilePath = path.join(
        testDirectoryPath,
        `${parsedSourceFilePath.name}.test${parsedSourceFilePath.ext}`
    );

    // Get config
    const config = await readConfig();

    // Create test file content
    let jestTestBlock = '';

    if (config.useTemplate) {
      try {
        jestTestBlock = await fs.promises.readFile(config.templatePath, 'utf8');
      } catch {
        vscode.window.showErrorMessage('Failed to read Jest template file');
      }
    } else {
        try {
            // `__dirname` is a global variable provided by Node.js 
            // which presents the folder of current excuted file.
            const defaultTemplatePath = path.join(__dirname, 'defaultTemplate.txt');
            jestTestBlock = await fs.promises.readFile(defaultTemplatePath, 'utf8');
        } catch {
            vscode.window.showErrorMessage('Failed to read default Jest template file');
        }
    }

    // Make sure the test directory exists
    await fs.promises.mkdir(testDirectoryPath, { recursive: true });

    // Write test file
    await fs.promises.writeFile(testFilePath, jestTestBlock);

    console.log(`Test file created at ${testFilePath}`);
};