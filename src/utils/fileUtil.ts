import fs from 'fs';
import { EOL } from 'os';

export const removeLastLine = async (filePath: string): Promise<void> => {
  // Step 1: Read the file.
  const content = await fs.promises.readFile(filePath, 'utf-8');

  // Step 2: Split the content by new line.
  const lines = content.split(EOL);

  // Step 3: Remove the last line.
  lines.pop();

  // Step 4: Join the remaining lines back into a single string.
  const newContent = lines.join(EOL);

  // Step 5: Write the new content back to the file.
  await fs.promises.writeFile(filePath, newContent, 'utf-8');
}
