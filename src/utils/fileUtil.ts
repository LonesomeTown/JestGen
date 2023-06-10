import fs from 'fs';
import { EOL } from 'os';

export const removeLastLine = async (filePath: string, sourceFileContent: string): Promise<void> => {
  // Step 1: Split the content by new line.
  const lines = sourceFileContent.split(EOL);

  // Step 2: Remove the last line.
  lines.pop();

  // Step 3: Join the remaining lines back into a single string.
  const newContent = lines.join(EOL);

  // Step 4: Write the new content back to the file.
  await fs.promises.writeFile(filePath, newContent, 'utf-8');
}
