// my-app/src/app/api/content/[slug]/route.ts
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

async function generateJsonFromFolder(
  folderPath: string,
  slug: string
): Promise<JsonInfo> {
  try {
    // Check both sounds and image folders
    const soundsPath = path.join(folderPath, "sounds");
    const imagePath = path.join(folderPath, "image");
    
    let audioFiles: string[] = [];
    let imageFile: string | undefined;

    // Try to read sounds folder
    try {
      const soundFiles = await fs.readdir(soundsPath);
      audioFiles = soundFiles.filter((file) =>
        file.toLowerCase().match(/\.(mp3|wav|ogg|m4a)$/i)
      );
    } catch (error) {
      console.warn(`Could not read sounds folder: ${soundsPath}: `+ error);
    }

    // Try to read image folder
    try {
      const imageFiles = await fs.readdir(imagePath);
      imageFile = imageFiles.find((file) =>
        file.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );
    } catch (error) {
      console.warn(`Could not read image folder: ${imagePath}, error: `+error);
    }

    // Generate AudioInfo array
    const audioInfos: AudioInfo[] = audioFiles.map((file, index) => {
      // Extract instrument name from filename (remove extension and common prefixes)
     const instrumentName = file
        .replace(/\.(mp3|wav|ogg|m4a)$/i, "")
        .replace(/^(ATC|atc|track|Track)_?/i, "")
        .replace(/_?\d+$/, "") // Remove trailing numbers
        .replace(/[_-]/g, " ")
        .trim();


      return {
        id: instrumentName.toLowerCase().replace(/\s+/g, "-") || `track-${index + 1}`,
        audioUrl: `/content/${slug}/sounds/${file}`, // Fixed: lowercase 'sounds'
        circleColor: COLORS[index % COLORS.length],
        instrumentName: instrumentName || `Track ${index + 1}`,
        audioSource: "file" as const,
      };
    });

    return {
      projectName: slug,
      title: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
      author: "Unknown Artist", // Default, can be overridden by manual JSON
      imageUrl: imageFile ? `/content/${slug}/image/${imageFile}` : "", // Fixed: lowercase 'image'
      folderUrl: `/content/${slug}/sounds/`, // Fixed: lowercase 'sounds'
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
  } catch (error) {
    console.error("Error generating JSON from folder:", error);
    throw new Error("Failed to read folder contents");
  }
}

async function loadManualJson(jsonPath: string): Promise<JsonInfo> {
  try {
    const jsonContent = await fs.readFile(jsonPath, "utf-8");
    return JSON.parse(jsonContent);
  } catch (error) {
    throw new Error("Manual JSON file not found or invalid: " + error);
  }
}

// Updated function signature for Next.js 15
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

    console.log(`Loading content for slug: ${slug}`);
    // Define paths
    const contentDir = path.join(process.cwd(), "public", "content");
    const folderPath = path.join(contentDir, slug);
    const manualJsonPath = path.join(folderPath, "info.json");
    console.log(`Checking folder: ${folderPath}`);

   // Check if folder exists
    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        throw new Error("Not a directory");
      }
    } catch {
      return NextResponse.json(
        { error: `Content folder '${slug}' not found` },
        { status: 404 }
      );
    }

    let jsonInfo: JsonInfo;

     // Try to load manual JSON first
    try {
      jsonInfo = await loadManualJson(manualJsonPath);
      console.log(`✓ Loaded manual JSON for ${slug}`);
    } catch (manualError) {
      console.log(`Manual JSON not found, auto-generating for ${slug}`);
      console.error(`Manual error ${manualError}`);
      try {
        jsonInfo = await generateJsonFromFolder(folderPath, slug);
        console.log(`✓ Auto-generated JSON for ${slug}`);
      } catch (autoError) {
        console.error("Auto-generation failed:", autoError);
        return NextResponse.json(
          { error: "Failed to load or generate content" },
          { status: 500 }
        );
      }
    }

    // Add CORS headers for development
    const response = NextResponse.json(jsonInfo);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET');
    
    return response;

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}