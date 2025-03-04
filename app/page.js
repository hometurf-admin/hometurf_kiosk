"use client";
import { useState, useRef } from "react";
import Image from "next/image";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");
  const [error, setError] = useState(null);
  const imgRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const url = e.target.elements.url.value;
    setStreamUrl(url);

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

        <form onSubmit={handleSubmit} className="mb-8 sm:mb-10">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
              className="w-full sm:w-auto bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-500 transition-colors disabled:opacity-50"
            >
              {isLoading ? "Loading..." : "Start Stream"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border-2 border-red-500 rounded-lg text-white">
            {error}
          </div>
        )}

        {streamUrl && (
          <div className="bg-white/10 backdrop-blur-sm p-4 sm:p-6 rounded-lg shadow-lg">
            <img
              ref={imgRef}
              width="640"
              height="480"
              className="w-full h-auto rounded-lg max-h-[80vh] object-contain"
              alt="Stream preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}
