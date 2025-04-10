import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request, { params }) {
  try {
    // Fix for the params.path error - properly handle dynamic params in Next.js App Router
    const resolvedParams = await Promise.resolve(params);
    const pathParams = Array.isArray(resolvedParams.path)
      ? resolvedParams.path
      : [resolvedParams.path];

    const filePath = decodeURIComponent(pathParams.join("/"));

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get file stats
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // Get range from request header
    const range = request.headers.get("range");

    if (range) {
      // Parse the range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Calculate the chunk size
      const chunkSize = end - start + 1;

      // Create read stream with the specified range
      const fileStream = fs.createReadStream(filePath, { start, end });
      const fileBuffer = await streamToBuffer(fileStream);

      // Set appropriate headers for range request
      const headers = new Headers();
      headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Length", chunkSize.toString());
      headers.set("Content-Type", getContentType(filePath));

      // Return the video chunk
      return new NextResponse(fileBuffer, {
        status: 206,
        headers,
      });
    } else {
      // Return the entire file if no range is specified
      // For small files this is okay, but for larger files you should handle ranges
      // even if no range header is present
      const fileBuffer = fs.readFileSync(filePath);

      // Set appropriate headers
      const headers = new Headers();
      headers.set("Content-Type", getContentType(filePath));
      headers.set("Content-Length", fileSize.toString());
      headers.set("Accept-Ranges", "bytes");

      // Return the video file
      return new NextResponse(fileBuffer, {
        status: 200,
        headers,
      });
    }
  } catch (error) {
    console.error("Error serving video file:", error);
    return NextResponse.json(
      { error: "Failed to serve video file" },
      { status: 500 }
    );
  }
}

// Helper function to convert stream to buffer
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// Helper function to determine content type based on file extension
function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  const contentTypes = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
  };

  return contentTypes[extension] || "application/octet-stream";
}
