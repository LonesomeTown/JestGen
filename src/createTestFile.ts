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
    customPlaceholders?: Map<string, string>;
    relativePathLevel: string | null;
    useSupertest: boolean;
    appPath: string | null;
    beforeAll: string | null;
    afterAll: string | null;
    projectFolder: string | null;
}

const defaultJestConfig: JestGenConfig = {
    useCustomTemplate: false,
    customTemplatePath: __dirname + '/default-template.txt',
    customPlaceholders: new Map<string, string>(),
    relativePathLevel: null,
    useSupertest: false,
    appPath: null,
    beforeAll: null,
    afterAll: null,
    projectFolder: null,
};

/**
 * Command function to create a Jest test file 
 * for a selected method in a .ts file.
 */
export const createTestFile = async () => {

    // Make sure we have a.ts file selected
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('Please open a .js/.ts file to create a Jest test file.');
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'typescript' && document.languageId !== 'javascript') {
        vscode.window.showInformationMessage('Please select a method in a .js/.ts file to create a Jest test file.');
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

    // Get config
    const config = await readConfig();
  
    // Build the path for the test file
    const finalTestFilePath = await buildTestFilePath(sourceFilePath, config);

    // Create test file content
    let templateContent = '';

    // Either use the default template or create a custom one
    if (config.useCustomTemplate) {
      try {
            templateContent = await fs.promises.readFile(config.customTemplatePath, 'utf8');
            templateContent = await buildCustomTemplateContent(templateContent, config);
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
            const testFileContent = await fs.promises.readFile(finalTestFilePath, 'utf8');
            const testSuitsTemplateContent = await buildTestSuitsTemplate(sourceFilePropertise);

            // Determine if the test case already exists
            if (await ifFunctionExists(testFileContent, functionName)) {
                const newTestFileContent = await replaceOldFunctionTestCase(testFileContent,functionName, sourceFilePropertise);
                // Write test file
                await fs.promises.writeFile(finalTestFilePath, newTestFileContent);
                vscode.window.showInformationMessage('Jest File Updated!');
            } else {
                await utils.removeLastLine(finalTestFilePath, testFileContent);
                await fs.promises.appendFile(finalTestFilePath, testSuitsTemplateContent);
                vscode.window.showInformationMessage('Jest File Updated!');
            }
            
        } catch {
            // Otherwise create the test file
            templateContent = await buildDefaultTemplateContent(templateContent, config, sourceFilePropertise);
            const testSuitsTemplateContent = await buildTestSuitsTemplate(sourceFilePropertise);
            fs.promises.writeFile(finalTestFilePath, templateContent + testSuitsTemplateContent);
            vscode.window.showInformationMessage('Jest File Created!');
        }
    }

    console.log(`Test file created at ${finalTestFilePath}`);
};

const readConfig = async (): Promise<JestGenConfig> => {
    const rootPath = await utils.getRootPath();

    if (!rootPath) {
        // If neither workspace nor single file is opened, return default config
        return defaultJestConfig;
    }

    const configFilePath = path.join(rootPath, '.jestgen.json');

    try {
        const configFileContent = await fs.promises.readFile(configFilePath, 'utf8');
        const config: JestGenConfig = JSON.parse(configFileContent);
        
        if (config.useCustomTemplate) {
            // Update `templatePath` to an absolute path
            config.customTemplatePath = path.resolve(path.dirname(configFilePath), config.customTemplatePath);
            // Covert `customPlaceholders` to a Map
            config.customPlaceholders = new Map(config.customPlaceholders);
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

const buildCustomTemplateContent = async (
    templateContent: string
    , config: JestGenConfig
): Promise<string> => {

    if (!config.customPlaceholders || config.customPlaceholders.size === 0) {
        return templateContent;
    }

    const substitutePlaceholder = async (value: string, config: JestGenConfig): Promise<string> =>{
        const matches = value.match(/\$\{(.*?)\}/g);
        if (matches) {
            for (const match of matches) {
                const placeholder = match.substring(2, match.length - 1);
                if ((config as any)[placeholder]) {
                    value = value.replace(match, (config as any)[placeholder]);
                }
            }
        }
        return value;
    }

    for (const [placeholder, value] of config.customPlaceholders.entries()) {
            const substituteValue = await substitutePlaceholder(value, config);
            // Replace the placeholder in the template
            const regex = new RegExp(placeholder.replace(/\$/g, '\\$').replace(/{/g, '\\{').replace(/}/g, '\\}'), 'g');
            templateContent = templateContent.replace(regex, substituteValue);
    }
    
    return templateContent;

}

const buildDefaultTemplateContent = async (
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

const updateDefaultTemplateContent = async (
    oldTestFilePath: string
    , config: JestGenConfig
    , sourceFilePropertise: SourceFileProperties
): Promise<string> => {

    try {
        let templateContent = await fs.promises.readFile(oldTestFilePath, 'utf8');
        templateContent = await replaceDefaultTemplatePlaceholders(templateContent, config, sourceFilePropertise);
        return templateContent;
    } catch {
        vscode.window.showErrorMessage('Failed to read old template file');
    }  

    return '';
};

const replaceDefaultTemplatePlaceholders = async (
    templateContent: string
    , config: JestGenConfig
    , sourceFilePropertise: SourceFileProperties
): Promise<string> => {
    let { useSupertest, appPath, beforeAll, afterAll } = config;
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

    if (beforeAll) {
        templateContent = templateContent.replace('${beforeAll}', beforeAll);
    } else {
        templateContent = templateContent.replace('${beforeAll}', '');
    }

    if (afterAll) {
        templateContent = templateContent.replace('${afterAll}', afterAll);
    } else {
        templateContent = templateContent.replace('${afterAll}', '');
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
    , config: JestGenConfig
): Promise<string> => {
    const rootPath = config.projectFolder ? config.projectFolder : await utils.getRootPath();
    
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

    // Calculate the relative path level
    const relativePathLevel = path.relative(testFileDirName, rootPath)
        .split(path.sep)
        .filter(part => part !== '.')
        .map(() => '..')
        .join('/');
    
    config.relativePathLevel = relativePathLevel;

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