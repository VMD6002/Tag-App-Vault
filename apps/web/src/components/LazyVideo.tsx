import React, { useRef, useEffect, useState } from "react";

type LazyVideoProps = React.VideoHTMLAttributes<HTMLVideoElement> & {
  src?: string;
  alt?: string;
  AutoPlay?: boolean;
};

const LazyVideo: React.FC<LazyVideoProps> = ({
  src,
  alt,
  AutoPlay,
  ...props
}) => {
  const [shouldLoad, setShouldLoad] = useState<boolean>(false);
  const parentDivRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if ("IntersectionObserver" in window) {
      const observerOptions: IntersectionObserverInit = {
        root: null,
        rootMargin: "100px",
        threshold: 0.0,
      };

      const observerCallback: IntersectionObserverCallback = (
        entries,
        observer,
      ) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.unobserve(entry.target);
          }
        });
      };

      const observer = new IntersectionObserver(
        observerCallback,
        observerOptions,
      );
      if (parentDivRef.current) {
        observer.observe(parentDivRef.current);
      }

      return () => {
        if (parentDivRef.current) {
          observer.unobserve(parentDivRef.current);
        }
        observer.disconnect();
      };
    } else {
      setShouldLoad(true);
    }
  }, []);

  useEffect(() => {
    if (!videoRef.current || !shouldLoad) return;

    if (AutoPlay) videoRef.current.play();
    else videoRef.current.pause();
  }, [AutoPlay, videoRef.current]);

  return (
    <div ref={parentDivRef} className="w-full">
      {shouldLoad ? (
        <video
          ref={videoRef}
          loop
          muted
          playsInline
          autoPlay={AutoPlay}
          aria-label={alt}
          width="100%"
          {...props}
        >
          <source src={src} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : (
        <div
          style={{
            height: props.height || "200px",
            width: "100%",
            backgroundColor: "#eee",
          }}
        >
          Loading...
        </div>
      )}
    </div>
  );
};

export default LazyVideo;
