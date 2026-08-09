// Jersey silhouette for the Studio poster mode. Pure shape only — the number
// on top comes from StudioToken's own overlay, same content-rendering path
// as the circle style. The source asset also included a baked-in "11" on the
// chest; that's dropped here so it doesn't double up with the real overlay
// number (only the outline + a small hem/collar tag detail are kept).
export default function JerseyShape({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 479.916 479.916"
      className="jersey-shape"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        fill={color}
        d="M399.556,77.384c-28.3-14.5-57.4-26.7-87.2-37.5c-4.2-8.8-19.5-9-27.6-8c-14.801,2-29.9,4-44.7,4.3
          c-14.8-0.3-29.9-2.3-44.7-4.3c-8-1.1-23.4-0.8-27.6,8c-29.9,10.9-58.9,23-87.2,37.5c-6.8,3.5-82.9,45-80.5,49
          c11.3,18.8,56.6,103.1,62.2,103.1c7.9,0,21.3-14.5,28.6-11.9c0.4,16.8,1.1,211.4,1.1,222.6c0,7.1,83.1,8.301,148,8.301
          c65,0,148-1.201,148-8.301c0.1-11.299,0.699-205.8,1.1-222.6c7.3-2.6,20.7,11.9,28.6,11.9c5.601,0,50.9-84.3,62.2-103.1
          C482.355,122.484,406.355,80.884,399.556,77.384z M135.756,426.184h-24v-31.5h24V426.184z"
      />
    </svg>
  );
}
