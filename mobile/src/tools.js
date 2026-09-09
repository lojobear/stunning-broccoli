export const TOOLS = [
  { id: 'autopilot', name: 'Auto Pilot', icon: 'sparkles-outline', blurb: 'Analyzes blur, noise, contrast and exposure, then builds a repair chain.', control: 'strength' },
  { id: 'smart_enhance', name: 'Smart Enhance', icon: 'color-wand-outline', blurb: 'One-tap global cleanup and detail recovery.', control: 'strength' },
  { id: 'unblur', name: 'Unblur', icon: 'eye-outline', blurb: 'Recovers edge contrast in soft or slightly blurred images.', control: 'strength' },
  { id: 'sharpen', name: 'Sharpen', icon: 'aperture-outline', blurb: 'Adds local detail with adjustable strength.', control: 'strength' },
  { id: 'sharpen_auto', name: 'Sharpen Auto', icon: 'scan-outline', blurb: 'Estimates softness and applies an automatic sharpening amount.', control: null },
  { id: 'denoise', name: 'Denoise', icon: 'moon-outline', blurb: 'Reduces grain while protecting edges.', control: 'strength' },
  { id: 'denoise_auto', name: 'Denoise Auto', icon: 'analytics-outline', blurb: 'Estimates noise level automatically.', control: null },
  { id: 'denoise_max', name: 'Denoise Max', icon: 'cloudy-night-outline', blurb: 'Aggressive cleanup for high-noise images.', control: 'strength' },
  { id: 'relight', name: 'Relight', icon: 'sunny-outline', blurb: 'Corrects underexposure, overexposure and low contrast.', control: 'lighting' },
  { id: 'upscale', name: 'Standard Upscale', icon: 'resize-outline', blurb: 'Increases image dimensions with detail-preserving interpolation.', control: 'scale' },
  { id: 'restore', name: 'Photo Restoration', icon: 'images-outline', blurb: 'Combines cleanup, contrast recovery, face-aware detail and upscale.', control: 'strength' },
  { id: 'face', name: 'Face Enhancer', icon: 'person-circle-outline', blurb: 'Detects faces and restores local contrast/detail.', control: 'strength' },
  { id: 'creative_upscale', name: 'Creative Upscale', icon: 'brush-outline', blurb: 'Adds stylized micro-detail while enlarging the image.', control: 'creativity' },
  { id: 'background', name: 'Background Remover', icon: 'cut-outline', blurb: 'Produces a transparent-background PNG. Uses rembg when installed.', control: null },
  { id: 'colorize', name: 'Colorizer', icon: 'color-palette-outline', blurb: 'Adds naturalistic color toning to grayscale/aged photographs.', control: 'strength' },
  { id: 'creative_detail', name: 'Creative Detail', icon: 'planet-outline', blurb: 'Texture/detail re-imagining with an original non-Topaz workflow.', control: 'creativity' }
];
