/** Bridge for UI elements (minimap, log) that need to move the canvas camera. */
export const cameraBus: {
  centerOn: (x: number, y: number) => void;
} = {
  centerOn: () => {},
};
