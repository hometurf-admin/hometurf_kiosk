"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export default function Home() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState("");

  useEffect(() => {
    // More comprehensive local network detection
    const detectLocalStream = () => {
      // Check if we're on a local network (improved detection)
      const hostname = window.location.hostname;
      const userAgent = navigator.userAgent.toLowerCase();

      // Check if this is running on a Raspberry Pi
      const isRaspberryPi =
        userAgent.includes("linux") &&
        (userAgent.includes("arm") ||
          userAgent.includes("raspbian") ||
          userAgent.includes("raspberry"));

      // Define patterns for local networks
      const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
      const isPrivateNetwork =
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
        hostname.match(/\.local$/);

      console.log("Detected environment:", {
        hostname,
        isRaspberryPi,
        isLocalhost,
        isPrivateNetwork,
      });

      // Special case: If we're on a Pi, always try the local stream first
      if (isRaspberryPi) {
        console.log("Raspberry Pi detected, using local stream");
        return "http://localhost/stream.m3u8";
      }

      // If we're on localhost or private network, use the locally defined stream
      if (isLocalhost || isPrivateNetwork) {
        // Use our proxy API route when in development
        if (window.location.port === "3000") {
          console.log("Development mode detected, using proxy API route");
          return "/api/proxy/stream.m3u8";
        }
        // Otherwise use direct Pi address
        return "http://192.168.1.8/stream.m3u8";
      }

      // Return the remote stream URL if neither local option works
      return (
        process.env.NEXT_PUBLIC_HLS_STREAM_URL ||
        "https://yourdomain.com/stream.m3u8"
      );
    };

    // Set initial stream URL
    setStreamUrl(detectLocalStream());

    // Additional approach: Try to detect local network streams
    const checkLocalStreams = async () => {
      if (!isLocalhost && !isPrivateNetwork) return;

      const localIpPrefix = "192.168.1.";

      // Try to find the stream on common local IPs
      for (let i = 1; i <= 10; i++) {
        const testUrl = `http://${localIpPrefix}${i}/stream.m3u8`;
        try {
          // Try to fetch the playlist to see if it exists
          const response = await fetch(testUrl, {
            method: "HEAD",
            mode: "no-cors",
            timeout: 500,
          });
          if (response) {
            setStreamUrl(testUrl);
            console.log("Found local stream at:", testUrl);
            break;
          }
        } catch (error) {
          // Continue trying other IPs
          console.log("No stream at:", testUrl);
        }
      }
    };

    // Try to detect local streams in background
    checkLocalStreams();
  }, []);

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    // Clean up previous instance if it exists
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    // Create new HLS instance with optimized settings
    const video = videoRef.current;
    hlsRef.current = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 0,
      maxBufferLength: 5, // Reduce buffer for lower latency
      maxMaxBufferLength: 10,
    });

    // Setup event handlers
    hlsRef.current.on(Hls.Events.MEDIA_ATTACHED, () => {
      console.log("HLS attached to video element");
    });

    hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log("Manifest loaded, starting playback");
      setIsLoading(false);
      video.play().catch((e) => {
        console.log("Autoplay prevented:", e);
      });
    });

    hlsRef.current.on(Hls.Events.ERROR, (event, data) => {
      console.log("HLS error:", data);

      if (data.fatal) {
        const errorMsg = `Stream error: ${data.type}`;
        console.error(errorMsg, data);
        setError(errorMsg);
        setIsLoading(false);

        // Try to recover from errors
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log("Attempting to recover from network error");
            hlsRef.current.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log("Attempting to recover from media error");
            hlsRef.current.recoverMediaError();
            break;
          default:
            // Try to auto-fallback to remote stream if local fails
            if (
              streamUrl.includes("localhost") ||
              streamUrl.includes("192.168.")
            ) {
              const fallbackUrl = process.env.NEXT_PUBLIC_HLS_STREAM_URL;
              if (fallbackUrl && fallbackUrl !== streamUrl) {
                console.log("Falling back to remote stream:", fallbackUrl);
                setStreamUrl(fallbackUrl);
                setError(null);
                setIsLoading(true);
              }
            }
            break;
        }
      }
    });

    // Load the stream
    console.log("Loading stream from:", streamUrl);
    hlsRef.current.loadSource(streamUrl);
    hlsRef.current.attachMedia(video);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center">
        <h1 className="text-2xl font-bold">Raspberry Pi Camera Stream</h1>
        <div className="relative w-full max-w-3xl aspect-video bg-black/10 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            controls
            autoPlay
            muted // Add muted for better autoplay behavior
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
              Loading stream...
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-red-400 p-4 text-center">
              {error}
            </div>
          )}
        </div>
        <div className="text-sm text-center">
          <p>Streaming from Raspberry Pi 5</p>
          <p className="text-xs mt-2 text-gray-600">
            Status: {error ? "Error" : isLoading ? "Loading..." : "Connected"}
          </p>
          <p className="text-xs mt-1 text-gray-400">Source: {streamUrl}</p>
          <p className="text-xs mt-1 text-gray-400">
            Running on: {navigator.userAgent}
          </p>
          {/* Debug button */}
          <button
            className="mt-4 px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs"
            onClick={() => {
              // Try alternate stream URLs for debugging
              const alternateUrls = [
                "http://localhost/stream.m3u8",
                "http://127.0.0.1/stream.m3u8",
                "http://192.168.1.8/stream.m3u8",
                "/api/proxy/stream.m3u8",
              ];
              const nextUrl =
                alternateUrls.find((url) => url !== streamUrl) ||
                alternateUrls[0];
              console.log("Switching to alternate URL:", nextUrl);
              setError(null);
              setIsLoading(true);
              setStreamUrl(nextUrl);
            }}
          >
            Try Alternate Source
          </button>
        </div>
      </main>
    </div>
  );
}
