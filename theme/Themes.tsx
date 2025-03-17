
interface Theme {
  backgroundColor: string;
  titleColor: string;
  bodyColor: string;
}

const themes: Record<string, Theme> = {
  Light: {
    backgroundColor: "#ffffff",
    titleColor: "#000000",
    bodyColor: "#333333",
  },
  Dark: {
    backgroundColor: "#2c3e50",
    titleColor: "#ffffff",
    bodyColor: "#cccccc",
  },

  Crimsonco: {
    backgroundColor: "#330000",
    titleColor: "#ff4d4d",
    bodyColor: "#f2b6b6",
  },
  Blushwhis: {
    backgroundColor: "#fadadd",
    titleColor: "#ff477e",
    bodyColor: "#4a4a4a",
  },
  Lavenderhaze: {
    backgroundColor: "#d7c0e2",
    titleColor: "#9253a1",
    bodyColor: "#4a4a4a",
  },
  Skyseren: {
    backgroundColor: "#d4eaff",
    titleColor: "#5271ff",
    bodyColor: "#3d3d3d",
  },
  Mintdream: {
    backgroundColor: "#dcf8c6",
    titleColor: "#388e3c",
    bodyColor: "#4a4a4a",
  },
  Retro: {
    backgroundColor: "#ffbf00",
    titleColor: "#d35400",
    bodyColor: "#4a4a4a",
  },
};


export { themes };
