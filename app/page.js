"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");
  const [error, setError] = useState(null);
  const imgRef = useRef(null);
  const [localFolderPath, setLocalFolderPath] = useState("");
  const [isPlayingLocalVideos, setIsPlayingLocalVideos] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoSegments, setVideoSegments] = useState([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [playbackMode, setPlaybackMode] = useState("server"); // Changed default to 'server'
  const [showCanvas, setShowCanvas] = useState(false);

  // Keep track of whether video has started playing
  const [videoStarted, setVideoStarted] = useState(false);

  // Function to capture the last frame of a video
  const captureVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame on the canvas
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Show the canvas
    setShowCanvas(true);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const url = e.target.elements.url.value;
    setStreamUrl(url);
    setIsPlayingLocalVideos(false);

    // Start stream directly instead of preflight check
    startStream(url);
    setIsLoading(false);
  }

  function startStream(url) {
    if (imgRef.current) {
      imgRef.current.src = url;
      imgRef.current.onerror = () => {
        setError(
          <div>
            Unable to load stream. Please{" "}
            <button
              onClick={() => {
                window.open(url, "_blank");
                setError(
                  "After accepting the certificate in the new tab, close it and click 'Try Again' here."
                );
              }}
              className="underline text-green-300 hover:text-green-200"
            >
              click here
            </button>{" "}
            to accept the certificate first.{" "}
            <button
              onClick={() => startStream(url)}
              className="ml-2 px-3 py-1 bg-green-600 rounded-md hover:bg-green-500"
            >
              Try Again
            </button>
          </div>
        );
      };
      imgRef.current.onload = () => {
        setError(null);
      };
    }
  }

  async function handleLocalVideos(e) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setVideoStarted(false);

    const folderPath = e.target.elements.folderPath.value.trim();
    setLocalFolderPath(folderPath);

    try {
      // Fetch video segments based on the selected playback mode
      const videoFiles = await fetchVideoSegments(folderPath, e);

      if (videoFiles.length === 0) {
        throw new Error("No video files found in the specified folder");
      }

      // Set up the video playlist
      setVideoSegments(videoFiles);
      setCurrentSegmentIndex(0);

      // Start playback
      setIsPlayingLocalVideos(true);
      setStreamUrl("");
    } catch (err) {
      console.error("Error loading video segments:", err);
      setError(`Error loading video segments: ${err.message}`);
      setIsPlayingLocalVideos(false);
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch video segments from the specified folder
  async function fetchVideoSegments(folderPath, e) {
    try {
      if (playbackMode === "api") {
        // Use our API route to get video segments
        const response = await fetch(
          `/api/video-segments?path=${encodeURIComponent(folderPath)}`
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch video segments");
        }

        const data = await response.json();
        console.log("Fetched files:", data);

        // Map file names to complete URLs that will be served by our API
        return data.files.map(
          (file) =>
            `/api/video/${encodeURIComponent(folderPath)}/${encodeURIComponent(
              file
            )}`
        );
      } else {
        // Using external HTTP server with CORS handling
        const serverUrl =
          e.target.elements.serverUrl?.value || "http://localhost:8080";

        try {
          // Attempt to fetch the directory listing from the server
          // Use mode: 'cors' explicitly to ensure CORS headers are respected
          const response = await fetch(`${serverUrl}/`, {
            mode: "cors",
            headers: {
              Accept: "text/html",
            },
          });

          const html = await response.text();

          // Extract filenames from the directory listing HTML
          // This regex looks for links to MP4, WebM, etc. files in the HTML
          const videoRegex = /<a href="([^"]+\.(mp4|webm|mov|avi|ogg))"/gi;
          const matches = [...html.matchAll(videoRegex)];

          if (matches.length === 0) {
            console.log("No video files found in directory listing");
            throw new Error(
              "No video files found on the server. Make sure you started the HTTP server."
            );
          }

          // Get the filenames from the matches
          const videoFiles = matches.map((match) => match[1]);
          console.log("Found video files:", videoFiles);

          // Sort them by name if they contain numbers
          videoFiles.sort((a, b) => {
            const numA = parseInt(a.match(/\d+/) || [0]);
            const numB = parseInt(b.match(/\d+/) || [0]);
            return numA - numB;
          });

          // Return URLs pointing to the HTTP server
          return videoFiles.map((file) => `${serverUrl}/${file}`);
        } catch (error) {
          console.error("Error fetching directory listing:", error);
          // Fallback approach - try individual files directly
          console.log("Using fallback file list");

          // Test if we can detect video files by trying some common patterns
          const testPatterns = ["segment*.mp4", "video*.mp4", "*.mp4"];

          // Check if we need to append the folder path to the URL
          let urlBase = serverUrl;
          if (folderPath && folderPath.trim() !== "") {
            urlBase = `${serverUrl}/${folderPath}`;
          }

          // Create a reasonable set of video filenames to try
          const simulatedFiles = [
            "segment1.mp4",
            "segment2.mp4",
            "segment3.mp4",
            "segment4.mp4",
            "segment5.mp4",
            "video1.mp4",
            "video2.mp4",
            "video3.mp4",
          ];

          return simulatedFiles.map((file) => `${urlBase}/${file}`);
        }
      }
    } catch (error) {
      console.error("Error fetching video segments:", error);
      throw error;
    }
  }

  // Play the video segments sequentially
  useEffect(() => {
    if (
      !isPlayingLocalVideos ||
      videoSegments.length === 0 ||
      !videoRef.current
    ) {
      return;
    }

    // Set the video source
    videoRef.current.src = videoSegments[currentSegmentIndex];
    videoRef.current.load();

    // Add loading timeout to detect if video doesn't load
    const loadingTimeout = setTimeout(() => {
      console.warn("Video loading timeout - source might be invalid");
      setError(
        `Video is taking too long to load. Make sure the server is running at ${videoSegments[
          currentSegmentIndex
        ]
          .split("/")
          .slice(0, 3)
          .join("/")}`
      );
    }, 10000); // 10 seconds timeout

    // Play the video when loaded
    const playVideo = async () => {
      try {
        clearTimeout(loadingTimeout);
        // Hide canvas and show video when ready to play
        setShowCanvas(false);
        setError(null);

        await videoRef.current.play();
        setVideoStarted(true);
        console.log(
          `Playing segment ${currentSegmentIndex + 1}/${videoSegments.length}`
        );
      } catch (err) {
        console.error("Error playing video:", err);

        // Provide more helpful error messages
        if (err.name === "NotSupportedError") {
          setError(
            `The video source is not supported. Make sure your server is running and accessible at ${videoSegments[
              currentSegmentIndex
            ]
              .split("/")
              .slice(0, 3)
              .join("/")}. Try refreshing the page.`
          );
        } else if (err.name === "AbortError") {
          setError("Video playback was aborted. Try clicking Play again.");
        } else {
          setError(`Error playing video: ${err.message}. Try clicking Play.`);
        }
      }
    };

    // Add error handler for video
    const handleVideoError = () => {
      clearTimeout(loadingTimeout);
      console.error("Video error event triggered");
      setError(
        `Failed to load video from: ${videoSegments[currentSegmentIndex]}. 
        Make sure your server is running and accessible.`
      );
    };

    // Wait for video to be loaded before playing
    videoRef.current.onloadeddata = playVideo;
    videoRef.current.onerror = handleVideoError;

    // Handle video ended event to play the next segment
    const handleVideoEnded = () => {
      // Capture the last frame before changing to next segment
      captureVideoFrame();

      const nextIndex = (currentSegmentIndex + 1) % videoSegments.length;
      setCurrentSegmentIndex(nextIndex);
    };

    videoRef.current.addEventListener("ended", handleVideoEnded);

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener("ended", handleVideoEnded);
        videoRef.current.onloadeddata = null;
        videoRef.current.onerror = null;
        clearTimeout(loadingTimeout);
      }
    };
  }, [isPlayingLocalVideos, videoSegments, currentSegmentIndex]);

  // Handle manual play button click
  const handleManualPlay = () => {
    if (videoRef.current) {
      // Check if the source is valid before trying to play
      if (!videoRef.current.src || videoRef.current.src === "about:blank") {
        setError(
          "No valid video source available. Please check server connection."
        );
        return;
      }

      // Try to load the video source directly first to check availability
      fetch(videoRef.current.src, { method: "HEAD", mode: "no-cors" })
        .then(() => {
          // If we can reach the source, try to play
          videoRef.current
            .play()
            .then(() => {
              setVideoStarted(true);
              setError(null);
            })
            .catch((err) => {
              console.error("Error on manual play:", err);

              if (err.name === "NotSupportedError") {
                setError(
                  `The video can't be played. Make sure the CORS server is running at ${videoRef.current.src
                    .split("/")
                    .slice(0, 3)
                    .join("/")}`
                );
              } else {
                setError(
                  `Error playing video: ${err.message}. If using server mode, be sure to run the CORS-enabled server.`
                );
              }
            });
        })
        .catch((err) => {
          console.error("Error checking video source:", err);
          setError(
            `Cannot access video source. Make sure the server is running and CORS is enabled.`
          );
        });
    }
  };

  // Add custom styling for fullscreen mode
  const startFullscreen = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (videoElement.requestFullscreen) {
      videoElement.requestFullscreen();
    } else if (videoElement.webkitRequestFullscreen) {
      videoElement.webkitRequestFullscreen();
    } else if (videoElement.msRequestFullscreen) {
      videoElement.msRequestFullscreen();
    }
  };

  // API mode instructions
  const apiModeInstructions = `
1. On your Raspberry Pi, enter the full path to the folder containing video segments.
2. Make sure the folder has video files with names like segment1.mp4, segment2.mp4, etc.
3. The built-in API will read and serve these files directly.
  `;

  // Server mode instructions
  const serverModeInstructions = `
1. On your Raspberry Pi, copy the cors_server.py script to your videos folder.
2. Navigate to the folder with your video segments.
3. Run this command to serve the videos: python3 cors_server.py
4. In the "Server URL" field below, enter "http://localhost:8080" if you're viewing this page directly on the Pi,
   or use your Pi's local IP address (e.g., "http://192.168.1.100:8080") if you're accessing from another device.
5. In the "Folder Path" field, just enter the name of the folder where you're running the server.
  `;

  return (
    <div className="min-h-screen bg-green-800 p-4 sm:p-8 relative">
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Image
          src="/hometurf_logo.png"
          alt="HomeTurf Logo"
          width={200}
          height={50}
          priority
          className="w-[150px] sm:w-[200px] h-auto"
        />
      </div>

      <div className="max-w-[95vw] w-full mx-auto pt-24 sm:pt-32">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-white text-3xl sm:text-4xl font-bold mb-2">
            Backwoods Arena
          </h1>
          <h2 className="text-green-200 text-xl sm:text-2xl">Court 4</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-white text-xl mb-4">Stream URL</h3>
            <form onSubmit={handleSubmit} className="mb-6">
              <div className="flex flex-col gap-3">
                <input
                  name="url"
                  type="url"
                  placeholder="Enter stream URL"
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-green-600 focus:outline-none focus:border-green-500 bg-green-700/20 text-white placeholder-green-300"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-500 transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Loading..." : "Start Stream"}
                </button>
              </div>
            </form>
          </div>

          <div>
            <h3 className="text-white text-xl mb-4">Local Video Segments</h3>
            <div className="mb-3">
              <div className="flex space-x-4 mb-2">
                <button
                  onClick={() => setPlaybackMode("server")}
                  className={`px-4 py-2 rounded-lg ${
                    playbackMode === "server"
                      ? "bg-green-600 text-white"
                      : "bg-green-800 text-green-200"
                  }`}
                >
                  Server Mode (Recommended)
                </button>
                <button
                  onClick={() => setPlaybackMode("api")}
                  className={`px-4 py-2 rounded-lg ${
                    playbackMode === "api"
                      ? "bg-green-600 text-white"
                      : "bg-green-800 text-green-200"
                  }`}
                >
                  API Mode
                </button>
              </div>
              <div className="bg-black/20 p-3 rounded-lg mb-4 text-green-100 text-sm whitespace-pre-line">
                {playbackMode === "api"
                  ? apiModeInstructions
                  : serverModeInstructions}
              </div>
            </div>
            <form onSubmit={handleLocalVideos} className="mb-6">
              <div className="flex flex-col gap-3">
                {playbackMode === "server" ? (
                  <>
                    <input
                      name="serverUrl"
                      type="text"
                      placeholder="Server URL (e.g., http://localhost:8080)"
                      defaultValue="http://localhost:8080"
                      className="w-full px-4 py-3 rounded-lg border-2 border-green-600 focus:outline-none focus:border-green-500 bg-green-700/20 text-white placeholder-green-300"
                    />
                    <input
                      name="folderPath"
                      type="text"
                      placeholder="Folder name (if needed, usually leave empty)"
                      className="w-full px-4 py-3 rounded-lg border-2 border-green-600 focus:outline-none focus:border-green-500 bg-green-700/20 text-white placeholder-green-300"
                    />
                    <div className="text-white text-xs">
                      <div className="p-2 bg-green-700/30 rounded mb-2">
                        <strong>For Pi Users:</strong> Make sure to run the HTTP
                        server on your Pi first!
                      </div>
                    </div>
                  </>
                ) : (
                  <input
                    name="folderPath"
                    type="text"
                    placeholder="Enter folder path (e.g., /home/pi/videos)"
                    required
                    className="w-full px-4 py-3 rounded-lg border-2 border-green-600 focus:outline-none focus:border-green-500 bg-green-700/20 text-white placeholder-green-300"
                  />
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-500 transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Loading..." : "Play Video Segments"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border-2 border-red-500 rounded-lg text-white">
            {error}
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-sm p-4 sm:p-6 rounded-lg shadow-lg">
          {streamUrl && !isPlayingLocalVideos && (
            <img
              ref={imgRef}
              width="640"
              height="480"
              className="w-full h-auto rounded-lg max-h-[80vh] object-contain"
              alt="Stream preview"
            />
          )}

          {isPlayingLocalVideos && (
            <div className="relative">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  width="100%"
                  height="auto"
                  className={`w-full h-auto ${showCanvas ? "hidden" : "block"}`}
                  playsInline
                  preload="auto"
                  muted={false}
                  disablePictureInPicture
                  disableRemotePlayback
                />
                <canvas
                  ref={canvasRef}
                  className={`w-full h-auto ${showCanvas ? "block" : "hidden"}`}
                />
              </div>

              {!videoStarted && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <button
                    onClick={handleManualPlay}
                    className="bg-green-600 hover:bg-green-500 text-white rounded-full p-4"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="white"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              )}

              {videoStarted && (
                <div className="absolute top-2 right-2">
                  <button
                    onClick={startFullscreen}
                    className="bg-green-600/50 hover:bg-green-500 text-white rounded-full p-2"
                    title="Fullscreen"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="white"
                    >
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                    </svg>
                  </button>
                </div>
              )}

              {videoStarted ? (
                <div className="mt-4 mb-2 text-white text-center flex justify-between items-center">
                  <div className="text-sm">
                    Playing segment {currentSegmentIndex + 1} of{" "}
                    {videoSegments.length}
                  </div>
                  <div>
                    <span className="text-xs bg-green-700 px-2 py-1 rounded">
                      Seamless Mode
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-white text-center">
                  <p>Ready to play segments from: {localFolderPath}</p>
                  <p className="text-xs mt-1">Click the play button to start</p>
                </div>
              )}
            </div>
          )}

          {!streamUrl && !isPlayingLocalVideos && (
            <div className="text-white text-center p-12">
              Enter a stream URL or a local folder path to begin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
