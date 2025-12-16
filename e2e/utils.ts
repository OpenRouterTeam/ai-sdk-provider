import { writeFile } from 'node:fs/promises';

export const writeOutputJsonFile = async ({
  fileName,
  fileData,
  baseUrl,
}: {
  fileName?: string;
  fileData: unknown;
  baseUrl: string;
}) =>
  writeFile(
    new URL(fileName ?? './output.ignore.json', baseUrl),
    JSON.stringify(fileData, null, 2),
  );
