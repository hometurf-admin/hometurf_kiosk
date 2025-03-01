"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export default function Home() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const streamUrl =
      process.env.NEXT_PUBLIC_HLS_STREAM_URL ||
      "http://your-raspberry-pi-ip:8080/stream/index.m3u8";

    if (Hls.isSupported()) {
      hlsRef.current = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hlsRef.current.on(Hls.Events.MEDIA_ATTACHED, () => {
        setIsLoading(false);
      });

      hlsRef.current.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError(`Stream error: ${data.type}`);
          setIsLoading(false);
        }
      });

      hlsRef.current.loadSource(streamUrl);
      hlsRef.current.attachMedia(videoRef.current);

      videoRef.current.play().catch((e) => {
        console.log("Autoplay prevented:", e);
      });
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      // For Safari
      videoRef.current.src = streamUrl;
      videoRef.current.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
        videoRef.current.play();
      });
    } else {
      setError("HLS is not supported in your browser");
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

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
        </div>
      </main>
    </div>
  );
}
