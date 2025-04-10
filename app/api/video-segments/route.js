import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const folderPath = searchParams.get("path");

  if (!folderPath) {
    return NextResponse.json(
      { error: "Folder path is required" },
      { status: 400 }
    );
  }

  try {
    // Check if the directory exists
    if (!fs.existsSync(folderPath)) {
      return NextResponse.json(
        { error: "Directory not found" },
        { status: 404 }
      );
    }

    // Read directory contents
    const files = fs.readdirSync(folderPath);

    // Filter for video files
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi"];
    const videoFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return videoExtensions.includes(ext);
    });

    // Sort video files by name, assuming filenames have numbers in them
    videoFiles.sort((a, b) => {
      // Extract numbers from filenames or default to 0
      const numA = parseInt(a.match(/\d+/) || [0]);
      const numB = parseInt(b.match(/\d+/) || [0]);
      return numA - numB;
    });

    return NextResponse.json({ files: videoFiles });
  } catch (error) {
    console.error("Error reading directory:", error);
    return NextResponse.json(
      { error: "Failed to read directory" },
      { status: 500 }
    );
  }
}
