// src/app/api/content/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { AudioInfo, JsonInfo } from "@/app/types/audioType";

// Predefined colors for auto-generation
const COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
];

// Helper function to find folder case-insensitively
async function findFolderCaseInsensitive(parentDir: string, targetName: string): Promise<string | null> {
  try {
    const items = await fs.readdir(parentDir);
    const found = items.find(item => item.toLowerCase() === targetName.toLowerCase());
    return found ? path.join(parentDir, found) : null;
  } catch {
    return null;
  }
}

async function generateJsonFromFolder(
  folderPath: string,
  slug: string
): Promise<JsonInfo> {
  try {
    console.log(`Generating JSON for folder: ${folderPath}`);
    
    // Find sounds and image folders case-insensitively
    const soundsPath = await findFolderCaseInsensitive(folderPath, "sounds");
    const imagePath = await findFolderCaseInsensitive(folderPath, "image");
    
    let audioFiles: string[] = [];
    let imageFile: string | undefined;

    // Try to read sounds folder
    if (soundsPath) {
      try {
        console.log(`Checking sounds folder: ${soundsPath}`);
        const soundFiles = await fs.readdir(soundsPath);
        console.log(`Found sound files:`, soundFiles);
        
        audioFiles = soundFiles.filter((file) =>
          file.toLowerCase().match(/\.(mp3|wav|ogg|m4a)$/i)
        );
        console.log(`Filtered audio files:`, audioFiles);
      } catch (error) {
        console.warn(`Could not read sounds folder: ${soundsPath}:`, error);
      }
    } else {
      console.warn(`Sounds folder not found in: ${folderPath}`);
    }

    // Try to read image folder
    if (imagePath) {
      try {
        console.log(`Checking image folder: ${imagePath}`);
        const imageFiles = await fs.readdir(imagePath);
        console.log(`Found image files:`, imageFiles);
        
        imageFile = imageFiles.find((file) =>
          file.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)
        );
        console.log(`Selected image file:`, imageFile);
      } catch (error) {
        console.warn(`Could not read image folder: ${imagePath}:`, error);
      }
    } else {
      console.warn(`Image folder not found in: ${folderPath}`);
    }

    // Generate AudioInfo array
    const audioInfos: AudioInfo[] = audioFiles.map((file, index) => {
      const instrumentName = file
        .replace(/\.(mp3|wav|ogg|m4a)$/i, "")
        .replace(/^(ATC|atc|track|Track)_?/i, "")
        .replace(/_?\d+$/, "") // Remove trailing numbers
        .replace(/[_-]/g, " ")
        .trim();

      return {
        id: instrumentName.toLowerCase().replace(/\s+/g, "-") || `track-${index + 1}`,
        audioUrl: `/content/${slug}/sounds/${file}`,
        circleColor: COLORS[index % COLORS.length],
        instrumentName: instrumentName || `Track ${index + 1}`,
        audioSource: "file" as const,
      };
    });

    const result = {
      projectName: slug,
      title: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
      author: "Unknown Artist",
      imageUrl: imageFile ? `/content/${slug}/image/${imageFile}` : "",
      folderUrl: `/content/${slug}/sounds/`,
      audioInfos,
      sections: [
        {
          id: "1",
          name: "Full Track",
          startTime: 0,
          endTime: 180
        }
      ]
    };

    console.log(`Generated JSON result:`, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error("Error generating JSON from folder:", error);
    throw new Error("Failed to read folder contents");
  }
}

async function loadManualJson(jsonPath: string): Promise<JsonInfo> {
  try {
    console.log(`Attempting to load manual JSON from: ${jsonPath}`);
    const jsonContent = await fs.readFile(jsonPath, "utf-8");
    const parsed = JSON.parse(jsonContent);
    console.log(`Successfully loaded manual JSON:`, parsed);
    return parsed;
  } catch (error) {
    console.log(`Manual JSON loading failed:`, error);
    throw new Error("Manual JSON file not found or invalid: " + error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    // Validate slug
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json(
        { error: "Invalid slug parameter" },
        { status: 400 }
      );
    }

    console.log(`=== API Request for slug: ${slug} ===`);
    
    // Define paths
    const contentDir = path.join(process.cwd(), "public", "content");
    console.log(`Content directory: ${contentDir}`);

    // Find the folder case-insensitively
    const folderPath = await findFolderCaseInsensitive(contentDir, slug);
    
    if (!folderPath) {
      console.error(`✗ Target folder not found for slug: ${slug}`);
      
      // List available folders
      try {
        const contentContents = await fs.readdir(contentDir);
        console.log(`Available folders in content directory:`, contentContents);
        
        return NextResponse.json(
          { 
            error: `Content folder '${slug}' not found`,
            debug: {
              slug,
              contentDir,
              availableFolders: contentContents
            }
          },
          { status: 404 }
        );
      } catch (e) {
        console.error(`Cannot read content directory:`, e);
        return NextResponse.json(
          { error: `Content directory not accessible` },
          { status: 500 }
        );
      }
    }

    console.log(`✓ Found target folder: ${folderPath}`);
    
    // Check if it's actually a directory
    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        throw new Error("Not a directory");
      }
    } catch (error) {
      console.error(`✗ Target path is not a directory: ${folderPath}`);
      return NextResponse.json(
        { 
          error: `Content path '${slug}' is not a directory`,
          debug: { folderPath, error: error instanceof Error ? error.message : String(error) }
        },
        { status: 404 }
      );
    }

    // Look for manual JSON file
    const manualJsonPath = path.join(folderPath, "info.json");
    let jsonInfo: JsonInfo;

    // Try to load manual JSON first
    try {
      jsonInfo = await loadManualJson(manualJsonPath);
      console.log(`✓ Loaded manual JSON for ${slug}`);
    } catch (manualError) {
      console.log(`Manual JSON not found, auto-generating for ${slug}`);
      console.log(`Manual error:`, manualError);
      
      try {
        jsonInfo = await generateJsonFromFolder(folderPath, slug);
        console.log(`✓ Auto-generated JSON for ${slug}`);
      } catch (autoError) {
        console.error("Auto-generation failed:", autoError);
        return NextResponse.json(
          { 
            error: "Failed to load or generate content",
            debug: {
              manualError: manualError instanceof Error ? manualError.message : String(manualError),
              autoError: autoError instanceof Error ? autoError.message : String(autoError),
              folderPath
            }
          },
          { status: 500 }
        );
      }
    }

    console.log(`=== Successfully returning JSON for ${slug} ===`);
    
    // Add CORS headers
    const response = NextResponse.json(jsonInfo);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET');
    
    return response;

  } catch (error) {
    console.error("=== API Error ===", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        debug: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      },
      { status: 500 }
    );
  }
}