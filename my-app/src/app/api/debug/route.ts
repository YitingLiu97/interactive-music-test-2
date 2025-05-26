/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/debug/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

async function scanDirectory(dirPath: string, relativePath = ""): Promise<any> {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = {
      path: relativePath || dirPath,
      files: [],
      directories: {}
    };

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const relPath = path.join(relativePath, item.name);
      
      if (item.isDirectory()) {
        result.directories[item.name] = await scanDirectory(fullPath, relPath);
      } else {
        const stats = await fs.stat(fullPath);
        result.files.push({
          name: item.name,
          size: stats.size,
          extension: path.extname(item.name),
          relativePath: relPath
        });
      }
    }
    
    return result;
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), "public");
    
    const result = {
      publicDir,
      timestamp: new Date().toISOString(),
      structure: await scanDirectory(publicDir, "/")
    };
    
    return NextResponse.json(result, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      publicDir: path.join(process.cwd(), "public"),
      timestamp: new Date().toISOString()
    });
  }
}