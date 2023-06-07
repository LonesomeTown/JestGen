import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { JestGenConfig, readConfig } from './extension';
import * as utils from './utils';

interface SourceFileProperties {
    fileName: string;
    functionName: string;
}

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
  
    // Get source file path
    const sourceFilePath = document.fileName;
    const sourceFileBasename = path.basename(sourceFilePath, path.extname(sourceFilePath));
    const rootPath = utils.getRootPath();
    // Remove the rootPath from the source file path
    const relativeSourceFilePath = sourceFilePath.replace(rootPath, '');
    // Create the test file path
    const testFilePath = path.join(rootPath, 'test', relativeSourceFilePath);
    // Change the test file extension to `.test.ts`
    const testFileBaseName = path.basename(testFilePath, path.extname(testFilePath));
    const testFileDirName = path.dirname(testFilePath);
    const finalTestFilePath = path.join(testFileDirName, `${testFileBaseName}.test.ts`);

    // Get config
    const config = await readConfig();

    // Create test file content
    let templateContent = '';

    if (config.useCustomizeTemplate) {
      try {
        templateContent = await fs.promises.readFile(config.customizeTemplatePath, 'utf8');
      } catch {
        vscode.window.showErrorMessage('Failed to read Jest template file');
      }
    } else {
        try {
            // `__dirname` is a global variable provided by Node.js 
            // which presents the folder of current excuted file.
            const defaultTemplatePath = path.join(__dirname, 'defaultTemplate.txt');
            templateContent = await fs.promises.readFile(defaultTemplatePath, 'utf8');
        } catch {
            vscode.window.showErrorMessage('Failed to read default Jest template file');
        }
    }

    // Create source file properties
    const sourceFilePropertise: SourceFileProperties = {
        fileName: sourceFileBasename,
        functionName: document.getText(range)
    }

    templateContent = await replaceTemplatePlaceholders(templateContent, config, sourceFilePropertise);

    // Make sure the test directory exists
    await fs.promises.mkdir(testFileDirName, { recursive: true });

    // Write test file
    await fs.promises.writeFile(finalTestFilePath, templateContent);

    console.log(`Test file created at ${finalTestFilePath}`);
};

const replaceTemplatePlaceholders = async (
    templateContent: string
    , config: JestGenConfig
    , sourceFilePropertise: SourceFileProperties
): Promise<string> => {
    let { useSupertest, appPath } = config;
    const { fileName, functionName } = sourceFilePropertise;

    templateContent = templateContent.replace('${sourceFilePropertise_fileName}', fileName);
    templateContent = templateContent.replace('${sourceFilePropertise_functionName}', functionName);

    if (useSupertest) {
        templateContent = templateContent.replace('${useSupertest_app_import}', `import { app } from '${appPath}';`);
        templateContent = templateContent.replace('${useSupertest_supertest_import}', `import supertest from 'supertest';`);
        templateContent = templateContent.replace('${useSupertest_gen_server}', `const server = app.listen();`);
        templateContent = templateContent.replace('${useSupertest_gen_request}', `const request = supertest( server );`);
        templateContent = templateContent.replace('${useSupertest_close_server}', `server.close();`);
    } else {
        // Use regular expressions to remove all placeholders starting with useSupertest_ and empty lines
        const useSupertestLine = new RegExp(`.*\\\${useSupertest_.*}${os.EOL}(${os.EOL})?`, 'g');
        templateContent = templateContent.replace(useSupertestLine, '');
    }

    return templateContent;
}