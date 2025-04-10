"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bookingId, setBookingId] = useState("");
  const [isPlayingLocalVideos, setIsPlayingLocalVideos] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoSegments, setVideoSegments] = useState([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [showCanvas, setShowCanvas] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const [serverUrl, setServerUrl] = useState("https://localhost:8443");

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

  async function handleLocalVideos(e) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setVideoStarted(false);

    const booking = e.target.elements.bookingId.value.trim();
    const url = e.target.elements.serverUrl.value.trim();
    setBookingId(booking);
    setServerUrl(url);

    try {
      // Fetch video segments from the server
      const videoFiles = await fetchVideoSegments(booking, url);

      if (videoFiles.length === 0) {
        throw new Error("No video files found in the specified booking folder");
      }

      // Set up the video playlist
      setVideoSegments(videoFiles);
      setCurrentSegmentIndex(0);

      // Start playback
      setIsPlayingLocalVideos(true);
    } catch (err) {
      console.error("Error loading video segments:", err);
      setError(`Error loading video segments: ${err.message}`);
      setIsPlayingLocalVideos(false);
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch video segments from the specified booking folder
  async function fetchVideoSegments(bookingId, serverUrl) {
    try {
      // Construct booking folder URL
      const bookingUrl = `${serverUrl}/${bookingId}`;

      try {
        // Attempt to fetch the directory listing from the booking folder
        const response = await fetch(`${bookingUrl}/`, {
          mode: "cors",
          headers: {
            Accept: "text/html",
          },
        });

        const html = await response.text();

        // Extract filenames from the directory listing HTML
        const videoRegex = /<a href="([^"]+\.(mp4|webm|mov|avi|ogg))"/gi;
        const matches = [...html.matchAll(videoRegex)];

        if (matches.length === 0) {
          console.log("No video files found in directory listing");
          throw new Error(
            "No video files found in this booking folder. Make sure the server is running and the booking ID is correct."
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

        // Return URLs pointing to the HTTPS server with booking path
        return videoFiles.map((file) => `${bookingUrl}/${file}`);
      } catch (error) {
        console.error("Error fetching directory listing:", error);

        // More helpful error message for HTTPS issues
        if (
          error.message.includes("certificate") ||
          serverUrl.startsWith("https:")
        ) {
          setError(
            `Certificate error: You need to accept the self-signed certificate. 
             Open ${serverUrl} directly in a new tab, accept the certificate warning,
             then return here and try again.`
          );
          throw new Error(
            "Certificate not accepted. Open server URL directly first."
          );
        }

        // Fallback approach - try individual files directly
        console.log("Using fallback file list");

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

        return simulatedFiles.map((file) => `${bookingUrl}/${file}`);
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

    // Capture the ref value in a variable for cleanup
    const videoElement = videoRef.current;

    // Set the video source
    videoElement.src = videoSegments[currentSegmentIndex];
    videoElement.load();

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

        await videoElement.play();
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
    videoElement.onloadeddata = playVideo;
    videoElement.onerror = handleVideoError;

    // Handle video ended event to play the next segment
    const handleVideoEnded = () => {
      // Capture the last frame before changing to next segment
      captureVideoFrame();

      const nextIndex = (currentSegmentIndex + 1) % videoSegments.length;
      setCurrentSegmentIndex(nextIndex);
    };

    videoElement.addEventListener("ended", handleVideoEnded);

    return () => {
      if (videoElement) {
        videoElement.removeEventListener("ended", handleVideoEnded);
        videoElement.onloadeddata = null;
        videoElement.onerror = null;
        clearTimeout(loadingTimeout);
      }
    };
  }, [
    isPlayingLocalVideos,
    videoSegments,
    currentSegmentIndex,
    captureVideoFrame,
  ]);

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

  return (
    <div className="min-h-screen bg-green-800 p-4 sm:p-6 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <Image
          src="/hometurf_logo.png"
          alt="HomeTurf Logo"
          width={150}
          height={38}
          priority
          className="h-auto"
        />
        <div className="text-white text-right">
          <h1 className="text-xl font-bold">Backwoods Arena</h1>
          <h2 className="text-green-200 text-sm">Court 4</h2>
        </div>
      </div>

      <form onSubmit={handleLocalVideos} className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-6">
            <input
              name="serverUrl"
              type="text"
              placeholder="Server URL (e.g., https://localhost:8443)"
              defaultValue={serverUrl}
              className="w-full px-3 py-2 rounded-lg border-2 border-green-600 focus:outline-none focus:border-green-500 bg-green-700/20 text-white placeholder-green-300"
            />
          </div>
          <div className="md:col-span-4">
            <input
              name="bookingId"
              type="text"
              placeholder="Booking ID (e.g., booking_12345)"
              defaultValue={bookingId}
              className="w-full px-3 py-2 rounded-lg border-2 border-green-600 focus:outline-none focus:border-green-500 bg-green-700/20 text-white placeholder-green-300"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-green-500 transition-colors disabled:opacity-50"
            >
              {isLoading ? "Loading..." : "Play Videos"}
            </button>
          </div>
        </div>

        <div className="text-white text-xs mt-1 flex space-x-2">
          <button
            type="button"
            onClick={() => window.open(serverUrl, "_blank")}
            className="px-2 py-1 bg-green-700/50 rounded hover:bg-green-700/70"
          >
            Accept Certificate
          </button>
          <span className="py-1">
            {isPlayingLocalVideos && videoSegments.length > 0 && (
              <span>
                Playing {currentSegmentIndex + 1}/{videoSegments.length}
                {bookingId && ` from ${bookingId}`}
              </span>
            )}
          </span>
        </div>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border-2 border-red-500 rounded-lg text-white text-sm">
          {error}
        </div>
      )}

      <div className="flex-grow flex flex-col items-center justify-center bg-black/50 rounded-lg overflow-hidden">
        {isPlayingLocalVideos ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-full max-h-[85vh] flex items-center justify-center">
              <video
                ref={videoRef}
                width="100%"
                height="auto"
                className={`max-w-full max-h-[85vh] ${
                  showCanvas ? "hidden" : "block"
                }`}
                playsInline
                preload="auto"
                muted={false}
                disablePictureInPicture
                disableRemotePlayback
              />
              <canvas
                ref={canvasRef}
                className={`max-w-full max-h-[85vh] ${
                  showCanvas ? "block" : "hidden"
                }`}
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
              <button
                onClick={startFullscreen}
                className="absolute top-2 right-2 bg-green-600/50 hover:bg-green-500 text-white rounded-full p-2"
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
            )}
          </div>
        ) : (
          <div className="text-white text-center p-12">
            Enter the server URL and booking ID above and click &quot;Play
            Videos&quot;
          </div>
        )}
      </div>
    </div>
  );
}
