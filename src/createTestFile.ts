import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as utils from './utils';

interface SourceFileProperties {
    fileName: string;
    functionName: string;
    functionDescription: string;
    functionExpectation: string;
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
    const functionName = document.getText(range)
  
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
            vscode.window.showInformationMessage('Jest File Created!');
      } catch {
        vscode.window.showErrorMessage('Failed to read Jest template file');
      }
    } else {
        // Create source file properties
        const sourceFilePropertise = await buildSourceFileProperties(sourceFilePath, functionName);

        try {
            // If the test file already exists
            // then remove the last line (`}):`) 
            // and just append the test suits content
            await fs.promises.access(finalTestFilePath);
            // Read the source file content
            const oldTestFileContent = await fs.promises.readFile(finalTestFilePath, 'utf-8');
            
            const testSuitsTemplateContent = await buildTestSuitsTemplate(sourceFilePropertise);

            if (await ifFunctionExists(oldTestFileContent, functionName)) {
                const newTestFileContent = await replaceOldFunctionTestCase(oldTestFileContent,functionName, sourceFilePropertise);
                // Write test file
                await fs.promises.writeFile(finalTestFilePath, newTestFileContent);
                vscode.window.showInformationMessage('Jest File Created!');
            } else {
                await utils.removeLastLine(finalTestFilePath, oldTestFileContent);
                await fs.promises.appendFile(finalTestFilePath, testSuitsTemplateContent);
                vscode.window.showInformationMessage('Jest File Updated!');
            }
            
        } catch {
            // Otherwise create the test file
            templateContent = await buildDefaultTemplate(templateContent, config, sourceFilePropertise);
            const testSuitsTemplateContent = await buildTestSuitsTemplate(sourceFilePropertise);
            fs.promises.writeFile(finalTestFilePath, templateContent + testSuitsTemplateContent);
            vscode.window.showInformationMessage('Jest File Created!');
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

const buildSourceFileProperties = async (
    sourceFilePath: string
    , functionName: string
): Promise<SourceFileProperties> => {
    const functionComments = await parseFunctionComments(sourceFilePath, functionName);
    const functionComment = functionComments.filter((comment) => comment.indexOf(functionName) > 0)[0];
    const describeMatch = functionComment?.match(/\*?\s*@JestGen.describe:\s*([\s\S]*?)(?=\n|\*\/|$)/);
    const describeText = describeMatch ? describeMatch[1].trim() : '';

    const itMatch = functionComment?.match(/\*?\s*@JestGen.it:\s*([\s\S]*?)(?=\n|\*\/|$)/);
    const itText = itMatch ? itMatch[1].trim() : '';

    const sourceFilePropertis: SourceFileProperties = {
        fileName: path.basename(sourceFilePath, path.extname(sourceFilePath))
        , functionName: functionName
        , functionDescription: describeText || ""
        , functionExpectation: itText || ""
    };
    
    return sourceFilePropertis;
}

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
    templateContent = utils.replaceAll(templateContent,'${sourceFilePropertise_fileName}',fileName);

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
    const { functionName, functionDescription, functionExpectation } = sourceFilePropertise;

    testSuitsTemplateContent = testSuitsTemplateContent.replace('${sourceFilePropertise_functionName}', functionName);
    testSuitsTemplateContent = testSuitsTemplateContent.replace('${sourceFilePropertise_functionDescription}', functionDescription !== '' ? functionDescription : functionName);
    testSuitsTemplateContent = testSuitsTemplateContent.replace('${sourceFilePropertise_functionExpectation}', functionExpectation !== '' ? functionExpectation : functionName);

    return testSuitsTemplateContent;
};


const buildTestFilePath = async (
    sourceFilePath: string
): Promise<string> => {
    const rootPath = utils.getRootPath();
    // Remove the rootPath from the source file path
    const relativeSourceFilePath = sourceFilePath.replace(rootPath, '');
    // Create the test file path
    const testFilePath = path.join(rootPath, 'tests', relativeSourceFilePath);
    // Change the test file extension to `.test.ts`
    const testFileBaseName = path.basename(testFilePath, path.extname(testFilePath));
    const testFileDirName = path.dirname(testFilePath);
    const finalTestFilePath = path.join(testFileDirName, `${testFileBaseName}.test.ts`);

    // Make sure the test directory exists
    await fs.promises.mkdir(testFileDirName, { recursive: true });

    return finalTestFilePath;
};

const parseFunctionComments = async (sourceFilePath: string, functionName:string): Promise<string[]> => {
    const sourceCode = fs.readFileSync(sourceFilePath, 'utf-8');
    const ast = parser.parse(sourceCode, {
        sourceType: 'module',
        plugins: ['typescript']
    });

    let functionComments: string[] = [];

    traverse(ast, {
        ExportNamedDeclaration(path) {
            const leadingComments = path.node.leadingComments;

            if (leadingComments) {
                leadingComments.forEach((comment) => {
                    if (comment.type === 'CommentBlock') {
                        functionComments.push(comment.value.trim());
                    }
                });
            }
            
        },
    });

    return functionComments;
}

const ifFunctionExists = async (sourceFileContent: string, functionName: string): Promise<boolean> => {
    const testCaseRegex = new RegExp(`// Test case for ${functionName}\n(.*?)(?=// Test case for|$)`, 'gs');
    return testCaseRegex.test(sourceFileContent);
}

const replaceOldFunctionTestCase = async (oldTestFileContent: string, functionName: string, sourceFilePropertise: SourceFileProperties): Promise<string> => {
    const testCaseRegex = new RegExp(`(// Test case for ${functionName}\\s*describe\\(')(.*?)(', \\(\\) => \\{[\\s\\S]*?it\\(')(.*?)(', \\(\\) => {)`, 'gs');
    const newTestFileContent = oldTestFileContent.replace(testCaseRegex, `$1${sourceFilePropertise.functionDescription}$3${sourceFilePropertise.functionExpectation}$5`);
    return newTestFileContent;
}