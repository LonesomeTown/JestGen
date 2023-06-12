# JestGen

JestGen is a powerful and versatile extension for developers that automates the process of creating unit test files for Jest testing framework. It dynamically generates test templates based on your JavaScript or TypeScript source files, enabling you to focus more on writing test cases, rather than setting up the test files.

JestGen leverages the AST parsing technique to fetch the necessary information about the source file, including the file name, function names, and user-defined descriptions and expectations from the comments. It is built to be highly configurable, allowing users to define the naming conventions and directory structure for test files.

With JestGen, creating and managing Jest test files becomes effortless, giving you more time to focus on the logic of your tests and less on boilerplate code.

This extension is ideal for both beginners who are just getting started with Jest and seasoned developers looking for a productivity boost in their testing process.

Start using JestGen today and experience a more efficient, enjoyable testing workflow!

## Quick Menu
1. [Features](#features)
2. [Requirements](#requirements)
3. [Usages](#usages)
4. [Extension Settings](#extension-settings)
5. [Release Notes](#release-notes)
6. [Issues](#issues)
7. [Contribution](#contribution)

## Features

1. **Automated Test File Generation**: JestGen automatically generates a Jest test file template based on the source file you select. It takes care of all the setup, allowing you to get straight into writing test cases.
2. **Dynamic Template Generation**: Test templates are dynamically generated based on the source file properties, such as the file name and function names. This allows your test files to reflect the structure and content of your source files, making your tests more intuitive and easier to manage.
3. **Custom Comment Parsing**: JestGen uses AST parsing to extract user-defined descriptions and expectations from comments in the source file. You can use special tags to indicate the description of what a function does and what it should do, and JestGen will incorporate this information into the test file.
4. **Configurable Test File Naming and Structure**: The extension is highly configurable, allowing you to specify the naming conventions for test files and the directory structure. You can set up JestGen to fit seamlessly into your existing workflow and project structure.
5. **Test Case Update**: JestGen identifies and updates existing test cases when changes are made in source file comments. It eliminates the need for manual updates and ensures your test files are always up-to-date.

More features are coming!

## Usages
Using JestGen is intuitive and straightforward. There are several ways to generate Jest test templates:

1. **Keyboard Shortcut**: Simply select (a single click will suffice) the name of the method you want to generate a test case for and press **`cmd+alt+t`**. JestGen will automatically generate a corresponding test file.
2. **Context Menu**: You can also generate a Jest test file by double-clicking the method name and then selecting Generate Jest File from the right-click context menu.
3. **Dynamic Generation with Comments**: JestGen can enhance your tests by dynamically generating descriptive content from comments placed above your methods. By default, the generated test case doesn't come with descriptions. If you want to provide more context to your test cases, consider adding special comments. 

> It is recommended that whichever generation method is used, it be used in conjunction with the annotation method. Not only will this give you richer test templates, it also improves the readability of your code.

Here's an example of how to format your comments for dynamic generation:
```typescript
/**
 * loginUser
 * 
 * @JestGen.describe: When user logs in to the platform
 * @JestGen.it: Should successfully authenticate user credentials
 */
export const loginUser = async () => {
  // method body...
}
```


## Requirements

In order to use JestGen effectively, you will need to have the Jest testing framework installed in your workspace. If you haven't installed Jest yet, you can do so by using the following npm command:
```bash
npm install --save-dev jest ts-jest @types/jest
```


## Extension Settings

JestGen is designed to be versatile and adaptable to your specific needs. You can use it out of the box with its default settings to generate Jest test templates, or customize its behavior through a **`.jestgen.json`** configuration file in the root directory of your workspace.

Here's a list of the currently supported configuration options:

* **`useCustomTemplate`**: A boolean value that determines whether to use a custom template for generating the test files. Defaults to false.
* **`customTemplatePath`**: A string value representing the path to the custom template file. This option is used only if useCustomTemplate is set to true.
* **`useSupertest`**: A boolean value indicating whether to use [Supertest](https://www.npmjs.com/package/supertest) in the test files. Supertest is a high-level abstraction for testing HTTP, useful for testing your Express.js server.
* **`appPath`**: A string value representing the relative path to the app file. This is required if useSupertest is set to true.

Below is an example configuration:
```json
{
  "useCustomTemplate": true,
  "customTemplatePath": "/path/to/your/template.txt",
  "useSupertest": true,
  "appPath": "/path/to/your/app"
}
```

> Due to the different project structures, it is recommended to use absolute paths for all configuration paths.

## Release Notes

More change details can be found in [CHANGELOG] (https://github.com/LonesomeTown/JestGen/blob/main/CHANGELOG.md)
### 1.0.2

Change the test file path

### 1.0.1

Upload extension icon

### 1.0.0

Initial release of JestGen

## Issues
Submit the [issues](https://github.com/LonesomeTown/JestGen/issues) if you find any bug or have any suggestion.

## Contribution
Fork the [repo](https://github.com/LonesomeTown/JestGen) and submit pull requests.
