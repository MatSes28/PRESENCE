/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "375px", // iPhone SE, iPhone X, XS, 11 Pro, 12 mini, 13 mini
        sm: "640px", // Small tablets and large phones
        md: "768px", // iPad mini, iPad
        lg: "1024px", // iPad Pro 11", laptops
        xl: "1280px", // Desktop
        "2xl": "1536px", // Large desktop
        // iOS specific breakpoints
        "iphone-se": "375px", // iPhone SE (2nd gen)
        "iphone-xr": "414px", // iPhone XR, 11
        "iphone-12": "390px", // iPhone 12, 12 Pro, 13, 13 Pro
        "iphone-12-max": "428px", // iPhone 12 Pro Max, 13 Pro Max
        "iphone-14": "393px", // iPhone 14, 14 Plus, 15, 15 Pro
        "iphone-14-max": "430px", // iPhone 14 Pro Max, 15 Plus, 15 Pro Max
        "iphone-16-pro": "402px", // iPhone 16 Pro
        "iphone-16-max": "440px", // iPhone 16 Pro Max
        ipad: "768px", // iPad, iPad mini
        "ipad-pro-11": "834px", // iPad Pro 11"
        "ipad-pro-12": "1024px", // iPad Pro 12.9"
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)",
      },
      minHeight: {
        "screen-safe":
          "calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
        "screen-ios": "calc(100vh - env(safe-area-inset-top))",
      },
      padding: {
        safe: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
        "safe-x": "env(safe-area-inset-left) env(safe-area-inset-right)",
        "safe-y": "env(safe-area-inset-top) env(safe-area-inset-bottom)",
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)",
      },
      margin: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)",
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "5xl": ["3rem", { lineHeight: "1" }],
      },
      touchAction: {
        "pan-x": "pan-x",
        "pan-y": "pan-y",
        "pinch-zoom": "pinch-zoom",
        manipulation: "manipulation",
      },
    },
  },
  plugins: [],
};
