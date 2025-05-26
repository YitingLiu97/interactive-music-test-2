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
    const files = await fs.readdir(folderPath);

    // Filter audio files
    const audioFiles = files.filter((file) =>
      file.toLowerCase().match(/\.(mp3|wav|ogg|m4a)$/i)
    );

    // Find image file
    const imageFile = files.find((file) =>
      file.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)
    );

    // Generate AudioInfo array
    const audioInfos: AudioInfo[] = audioFiles.map((file, index) => {
      // Extract instrument name from filename (remove extension and common prefixes)
      const instrumentName = file
        .replace(/\.(mp3|wav|ogg|m4a)$/i, "")
        .replace(/^(ATC|atc|track|Track)_?/i, "")
        .replace(/_?\d+$/, "") // Remove trailing numbers like _03
        .replace(/[_-]/g, " ")
        .trim();

      return {
        id: instrumentName || `Track ${index + 1}`,
        audioUrl: `/content/${slug}/Sounds/${file}`,
        circleColor: COLORS[index % COLORS.length],
        instrumentName: instrumentName || `Track ${index + 1}`,
        audioSource: "file",
      };
    });

    return {
      projectName: slug,
      title: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
      author: "Unknown Artist", // Default, can be overridden by manual JSON
      imageUrl: imageFile ? `/content/${slug}/Image/${imageFile}` : "",
      folderUrl: `/content/${slug}/Sounds/`,
      audioInfos,
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

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Define paths
    const contentDir = path.join(process.cwd(), "public", "content");
    const folderPath = path.join(contentDir, slug);
    const manualJsonPath = path.join(folderPath, "info.json");

    // Check if folder exists
    try {
      await fs.access(folderPath);
    } catch {
      return NextResponse.json(
        { error: `Content folder '${slug}' not found` },
        { status: 404 }
      );
    }

    let jsonInfo: JsonInfo;

    // Try to load manual JSON first, fallback to auto-generation
    try {
      jsonInfo = await loadManualJson(manualJsonPath);
      console.log(`Loaded manual JSON for ${slug}`);
    } catch {
      jsonInfo = await generateJsonFromFolder(folderPath, slug);
      console.log(`Auto-generated JSON for ${slug}`);
    }

    return NextResponse.json(jsonInfo);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}
