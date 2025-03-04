"use client";

export default function Home() {
  function handleSubmit(e) {
    e.preventDefault();
    const url = e.target.elements.url.value;
    const img = document.querySelector("img");
    img.src = url;
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input name="url" type="url" placeholder="Stream URL" required />
        <button type="submit">Start</button>
      </form>

      <img width="640" height="480" />
    </div>
  );
}
