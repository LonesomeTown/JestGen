import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as utils from './utils';

interface SourceFileProperties {
    fileName: string;
    functionName: string;
}

interface JestGenConfig {
    useCustomTemplate: boolean;
    customTemplatePath: string;
    useSupertest: boolean;
    appPath: string | null;
}

const defaultJestConfig: JestGenConfig = {
    useCustomTemplate: false,
    customTemplatePath: __dirname + '/default-template.txt',
    useSupertest: false,
    appPath: null,
};

/**
 * Command function to create a Jest test file 
 * for a selected method in a .ts file.
 */
export const createTestFile = async () => {

    // Make sure we have a.ts file selected
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

    // Get source file information
    const sourceFilePath = document.fileName;
    const sourceFileBasename = path.basename(sourceFilePath, path.extname(sourceFilePath));
  
    // Build the path for the test file
    const finalTestFilePath = await buildTestFilePath(sourceFilePath);

    // Get config
    const config = await readConfig();

    // Create test file content
    let templateContent = '';

    // Either use the default template or create a custom one
    if (config.useCustomTemplate) {
      try {
            templateContent = await fs.promises.readFile(config.customTemplatePath, 'utf8');
            // Write test file
            await fs.promises.writeFile(finalTestFilePath, templateContent);
      } catch {
        vscode.window.showErrorMessage('Failed to read Jest template file');
      }
    } else {
        // Create source file properties
        const sourceFilePropertise: SourceFileProperties = {
            fileName: sourceFileBasename,
            functionName: document.getText(range)
        }
        try {
            // If the test file already exists
            // then remove the last line (`}):`) 
            // and just append the test suits content
            await fs.promises.access(finalTestFilePath);
            await utils.removeLastLine(finalTestFilePath);

            const testSuitsTemplateContent = await buildTestSuitsTemplate(sourceFilePropertise);
            fs.promises.appendFile(finalTestFilePath, testSuitsTemplateContent);
        } catch {
            // Otherwise create the test file
            templateContent = await buildDefaultTemplate(templateContent, config, sourceFilePropertise);
            const testSuitsTemplateContent = await buildTestSuitsTemplate(sourceFilePropertise);
            fs.promises.writeFile(finalTestFilePath, templateContent + testSuitsTemplateContent);
        }
    }

    console.log(`Test file created at ${finalTestFilePath}`);
};

const readConfig = async (): Promise<JestGenConfig> => {
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
        if (config.useCustomTemplate) {
            config.customTemplatePath = path.resolve(path.dirname(configFilePath), config.customTemplatePath);
        }
        
        return config;
    } catch {
        // If the config file can't be read, use the default config
        return defaultJestConfig;
    }
};

const buildDefaultTemplate = async (
    templateContent: string
    , config: JestGenConfig
    , sourceFilePropertise: SourceFileProperties
): Promise<string> => {

    try {
        // `__dirname` is a global variable provided by Node.js 
        // which presents the folder of current excuted file.
        const defaultTemplatePath = path.join(__dirname, 'default-template.txt');
        templateContent = await fs.promises.readFile(defaultTemplatePath, 'utf8');

        templateContent = await replaceDefaultTemplatePlaceholders(templateContent, config, sourceFilePropertise);
        return templateContent;
    } catch {
        vscode.window.showErrorMessage('Failed to read default Jest template file');
    }  

    return '';
};

const replaceDefaultTemplatePlaceholders = async (
    templateContent: string
    , config: JestGenConfig
    , sourceFilePropertise: SourceFileProperties
): Promise<string> => {
    let { useSupertest, appPath } = config;
    let { fileName } = sourceFilePropertise;
    templateContent = templateContent.replace('${sourceFilePropertise_fileName}', fileName);


    if (useSupertest) {
        templateContent = templateContent.replace('${useSupertest_app_import}', `import { app } from '${appPath}';`);
        templateContent = templateContent.replace('${useSupertest_supertest_import}', `import supertest from 'supertest';`);
        templateContent = templateContent.replace('${useSupertest_gen_server}', `const server = app.listen();`);
        templateContent = templateContent.replace('${useSupertest_gen_request}', `const request = supertest( server );`);
        templateContent = templateContent.replace('${useSupertest_close_server}', `server.close();`);
    } else {
        // Use regular expressions to remove 
        // all placeholders starting with
        // `useSupertest_` and empty lines
        const useSupertestLine = new RegExp(`.*\\\${useSupertest_.*}${os.EOL}(${os.EOL})?`, 'g');
        templateContent = templateContent.replace(useSupertestLine, '');
    }

    return templateContent;
};

const buildTestSuitsTemplate = async (
    sourceFilePropertise: SourceFileProperties
): Promise<string> => {
    let testSuitsTemplateContent = '';
    try {
        const testSuitsTemplatePath = path.join(__dirname, 'test-suits-template.txt');
        testSuitsTemplateContent = await fs.promises.readFile(testSuitsTemplatePath, 'utf8');

        testSuitsTemplateContent = await replaceTestSuitsTemplatePlaceholders(testSuitsTemplateContent, sourceFilePropertise);
    } catch {
        vscode.window.showErrorMessage('Failed to read default Jest template file');
    }  

    return testSuitsTemplateContent;
};

const replaceTestSuitsTemplatePlaceholders = async (
    testSuitsTemplateContent: string
    , sourceFilePropertise: SourceFileProperties
): Promise<string> => {
    const { functionName } = sourceFilePropertise;

    testSuitsTemplateContent = testSuitsTemplateContent.replace('${sourceFilePropertise_functionName}', functionName);

    return testSuitsTemplateContent;
};


const buildTestFilePath = async (
    sourceFilePath: string
): Promise<string> => {
    const rootPath = utils.getRootPath();
    // Remove the rootPath from the source file path
    const relativeSourceFilePath = sourceFilePath.replace(rootPath, '');
    // Create the test file path
    const testFilePath = path.join(rootPath, 'test', relativeSourceFilePath);
    // Change the test file extension to `.test.ts`
    const testFileBaseName = path.basename(testFilePath, path.extname(testFilePath));
    const testFileDirName = path.dirname(testFilePath);
    const finalTestFilePath = path.join(testFileDirName, `${testFileBaseName}.test.ts`);

    // Make sure the test directory exists
    await fs.promises.mkdir(testFileDirName, { recursive: true });

    return finalTestFilePath;
};